import { chmod, mkdir, stat } from 'node:fs/promises';
import net from 'node:net';
import os from 'node:os';
import path from 'node:path';
import type { Subprocess } from 'bun';
import { DEFAULT_TEST_S3_ENV } from './test-env-defaults';

const MINIO_ACCESS_KEY = DEFAULT_TEST_S3_ENV.S3_ACCESS_KEY;
const MINIO_SECRET_KEY = DEFAULT_TEST_S3_ENV.S3_SECRET_KEY;
const DOCKER_CONTAINER_NAME = `normalizer-test-minio-${process.pid}`;
const MINIO_CACHE_DIR = path.join(process.cwd(), 'node_modules', '.cache', 'minio');

let endpoint: string | null = null;
let managedProcess: Subprocess | null = null;
let managedDocker = false;
let isStopping = false;

async function findAvailablePort(): Promise<number> {
  return new Promise((resolve, reject) => {
    const server = net.createServer();
    server.listen(0, '127.0.0.1', () => {
      const address = server.address();
      if (address && typeof address === 'object') {
        const port = address.port;
        server.close((error) => {
          if (error) {
            reject(error);
            return;
          }
          resolve(port);
        });
      } else {
        server.close();
        reject(new Error('Failed to find an available port'));
      }
    });
    server.on('error', reject);
  });
}

function buildEndpoint(port: number): string {
  return `http://127.0.0.1:${port}`;
}

async function isMinioHealthy(endpointUrl: string): Promise<boolean> {
  try {
    const response = await fetch(`${endpointUrl}/minio/health/live`);
    return response.ok;
  } catch {
    return false;
  }
}

async function waitForMinioHealthy(endpointUrl: string, timeoutMs = 30_000): Promise<boolean> {
  const deadline = Date.now() + timeoutMs;
  while (Date.now() < deadline) {
    if (await isMinioHealthy(endpointUrl)) {
      return true;
    }
    await Bun.sleep(250);
  }
  return false;
}

async function isDockerAvailable(): Promise<boolean> {
  try {
    const proc = Bun.spawn(['docker', 'info'], {
      stdout: 'pipe',
      stderr: 'pipe',
    });
    return (await proc.exited) === 0;
  } catch {
    return false;
  }
}

function getMinioBinaryDownloadUrl(): string {
  const platform = process.platform;
  const arch = process.arch;

  if (platform === 'darwin' && arch === 'arm64') {
    return 'https://dl.min.io/server/minio/release/darwin-arm64/minio';
  }
  if (platform === 'darwin' && arch === 'x64') {
    return 'https://dl.min.io/server/minio/release/darwin-amd64/minio';
  }
  if (platform === 'linux' && arch === 'x64') {
    return 'https://dl.min.io/server/minio/release/linux-amd64/minio';
  }
  if (platform === 'linux' && arch === 'arm64') {
    return 'https://dl.min.io/server/minio/release/linux-arm64/minio';
  }

  throw new Error(`Unsupported platform for embedded MinIO: ${platform}-${arch}`);
}

async function ensureMinioBinary(): Promise<string> {
  await mkdir(MINIO_CACHE_DIR, { recursive: true });
  const binaryPath = path.join(MINIO_CACHE_DIR, 'minio');

  try {
    const info = await stat(binaryPath);
    if (info.isFile() && info.size > 0) {
      return binaryPath;
    }
  } catch {
    // Download below.
  }

  const downloadUrl = getMinioBinaryDownloadUrl();
  const response = await fetch(downloadUrl);
  if (!response.ok) {
    throw new Error(`Failed to download MinIO binary (${response.status}): ${downloadUrl}`);
  }

  const bytes = await response.arrayBuffer();
  await Bun.write(binaryPath, bytes);
  await chmod(binaryPath, 0o755);
  return binaryPath;
}

async function startMinioWithDocker(port: number): Promise<boolean> {
  if (!(await isDockerAvailable())) {
    return false;
  }

  const remove = Bun.spawn(['docker', 'rm', '-f', DOCKER_CONTAINER_NAME], {
    stdout: 'pipe',
    stderr: 'pipe',
  });
  await remove.exited;

  const proc = Bun.spawn(
    [
      'docker',
      'run',
      '-d',
      '--name',
      DOCKER_CONTAINER_NAME,
      '-p',
      `${port}:9000`,
      '-e',
      `MINIO_ROOT_USER=${MINIO_ACCESS_KEY}`,
      '-e',
      `MINIO_ROOT_PASSWORD=${MINIO_SECRET_KEY}`,
      'minio/minio',
      'server',
      '/data',
    ],
    {
      stdout: 'pipe',
      stderr: 'pipe',
    },
  );

  if ((await proc.exited) !== 0) {
    return false;
  }

  managedDocker = true;
  return true;
}

async function startMinioWithBinary(port: number): Promise<void> {
  const binaryPath = await ensureMinioBinary();
  const dataDir = path.join(os.tmpdir(), `normalizer-test-minio-${process.pid}-${Date.now()}`);
  await mkdir(dataDir, { recursive: true });

  const proc = Bun.spawn(
    [
      binaryPath,
      'server',
      dataDir,
      '--address',
      `127.0.0.1:${port}`,
      '--console-address',
      `127.0.0.1:${port + 1}`,
    ],
    {
      env: {
        ...process.env,
        MINIO_ROOT_USER: MINIO_ACCESS_KEY,
        MINIO_ROOT_PASSWORD: MINIO_SECRET_KEY,
      },
      stdout: 'pipe',
      stderr: 'pipe',
    },
  );

  managedProcess = proc;
}

function applyS3Endpoint(endpointUrl: string): void {
  process.env.S3_ENDPOINT = endpointUrl;
  process.env.S3_ACCESS_KEY = MINIO_ACCESS_KEY;
  process.env.S3_SECRET_KEY = MINIO_SECRET_KEY;
  if (!process.env.S3_BUCKET) {
    process.env.S3_BUCKET = DEFAULT_TEST_S3_ENV.S3_BUCKET;
  }
  if (!process.env.S3_REGION) {
    process.env.S3_REGION = DEFAULT_TEST_S3_ENV.S3_REGION;
  }
  if (!process.env.S3_USE_SSL) {
    process.env.S3_USE_SSL = DEFAULT_TEST_S3_ENV.S3_USE_SSL;
  }
}

/**
 * Ensures a local MinIO-compatible S3 endpoint is available for tests.
 * Reuses an existing healthy endpoint when possible; otherwise starts one via Docker or a cached binary.
 */
export async function startTestMinio(): Promise<string> {
  if (endpoint) {
    return endpoint;
  }

  const configuredEndpoint = process.env.S3_ENDPOINT ?? DEFAULT_TEST_S3_ENV.S3_ENDPOINT;
  if (await isMinioHealthy(configuredEndpoint)) {
    endpoint = configuredEndpoint;
    applyS3Endpoint(configuredEndpoint);
    return configuredEndpoint;
  }

  const port = await findAvailablePort();
  const localEndpoint = buildEndpoint(port);

  const startedWithDocker = await startMinioWithDocker(port);
  if (!startedWithDocker) {
    await startMinioWithBinary(port);
  }

  const healthy = await waitForMinioHealthy(localEndpoint);
  if (!healthy) {
    await stopTestMinio();
    throw new Error(
      `Failed to start local MinIO for tests on ${localEndpoint}. ` +
        'Start MinIO manually or ensure Docker is available.',
    );
  }

  endpoint = localEndpoint;
  applyS3Endpoint(localEndpoint);

  process.on('beforeExit', () => {
    void stopTestMinio();
  });

  return localEndpoint;
}

export function getTestMinioEndpoint(): string {
  if (!endpoint) {
    throw new Error('Test MinIO not started. Ensure test-setup preload ran.');
  }
  return endpoint;
}

export async function stopTestMinio(): Promise<void> {
  if (isStopping) {
    return;
  }

  isStopping = true;

  try {
    if (managedProcess) {
      managedProcess.kill();
      await managedProcess.exited;
      managedProcess = null;
    }

    if (managedDocker) {
      const proc = Bun.spawn(['docker', 'rm', '-f', DOCKER_CONTAINER_NAME], {
        stdout: 'pipe',
        stderr: 'pipe',
      });
      await proc.exited;
      managedDocker = false;
    }
  } catch {
    // Best-effort cleanup when the process is exiting.
  } finally {
    endpoint = null;
    isStopping = false;
  }
}
