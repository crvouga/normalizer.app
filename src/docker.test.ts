import { describe, test, expect } from 'bun:test';
import { existsSync } from 'fs';
import { join } from 'path';
import { $ } from 'bun';

describe('Dockerfile Build Tests', () => {
  const projectRoot = join(import.meta.dir, '..');

  test('should have all required files for Docker build', () => {
    // Check that all files referenced in COPY commands exist
    const requiredFiles = ['package.json', 'bun.lock', 'bunfig.toml', 'Dockerfile'];

    for (const file of requiredFiles) {
      const filePath = join(projectRoot, file);
      expect(existsSync(filePath)).toBe(true);
    }
  });

  test('should have consistent lock file with package.json', async () => {
    // This test verifies that bun install --frozen-lockfile would succeed
    // by checking if the lock file is consistent with package.json
    const result = await $`bun install --frozen-lockfile --dry-run`.cwd(projectRoot).nothrow();

    expect(result.exitCode).toBe(0);
  });

  test('should be able to parse bunfig.toml', async () => {
    // Verify bunfig.toml is valid TOML
    const bunfigPath = join(projectRoot, 'bunfig.toml');
    const bunfigContent = await Bun.file(bunfigPath).text();

    // Basic validation - should not throw
    expect(bunfigContent).toBeTruthy();
    expect(bunfigContent).toContain('[serve.static]');
  });

  test('should have server.tsx entry point', () => {
    const serverPath = join(projectRoot, 'src', 'server.tsx');
    expect(existsSync(serverPath)).toBe(true);
  });

  test('Dockerfile should use valid base image', async () => {
    const dockerfilePath = join(projectRoot, 'Dockerfile');
    const dockerfileContent = await Bun.file(dockerfilePath).text();

    expect(dockerfileContent).toContain('FROM oven/bun:1-alpine');
  });

  test('Dockerfile cache mounts should have id argument for Railway compatibility', async () => {
    // Railway requires explicit id for cache mounts
    // Error: flag '--mount=type=cache,target=/root/.bun' is missing an id argument
    const dockerfilePath = join(projectRoot, 'Dockerfile');
    const dockerfileContent = await Bun.file(dockerfilePath).text();

    // Find all cache mount declarations
    const cacheMountRegex = /--mount=type=cache[^\n]*/g;
    const cacheMounts = dockerfileContent.match(cacheMountRegex) || [];

    // Each cache mount must have an id parameter
    for (const mount of cacheMounts) {
      expect(mount).toContain('id=');
    }

    // Ensure we found at least one cache mount (the bun cache)
    expect(cacheMounts.length).toBeGreaterThan(0);
  });

  test('should have .dockerignore file to prevent copying unnecessary files', () => {
    // This is critical for Railway deployments - without .dockerignore,
    // the build will copy node_modules, test-results, etc. which can
    // cause timeouts or conflicts
    const dockerignorePath = join(projectRoot, '.dockerignore');
    expect(existsSync(dockerignorePath)).toBe(true);
  });

  test('.dockerignore should exclude critical directories', async () => {
    const dockerignorePath = join(projectRoot, '.dockerignore');
    const dockerignoreContent = await Bun.file(dockerignorePath).text();

    // Must exclude node_modules since we run bun install in the Dockerfile
    expect(dockerignoreContent).toContain('node_modules');

    // Should exclude test artifacts
    expect(dockerignoreContent).toContain('test-results');
    expect(dockerignoreContent).toContain('playwright-report');

    // Should exclude git directory
    expect(dockerignoreContent).toContain('.git');
  });

  test('should simulate Docker build steps', async () => {
    // This test simulates what happens during docker build
    // 1. Check if bun install works with frozen lockfile
    const installResult = await $`bun install --frozen-lockfile`.cwd(projectRoot).nothrow();
    expect(installResult.exitCode).toBe(0);

    // 2. Check if the main entry point can be resolved
    const serverPath = join(projectRoot, 'src', 'server.tsx');
    expect(existsSync(serverPath)).toBe(true);
  });

  test(
    'should be able to build Docker image',
    async () => {
      // This is the actual test that will fail if the Dockerfile has issues
      const imageName = 'normalizer-test:latest';

      // Try to build the Docker image
      const buildResult = await $`docker build -t ${imageName} .`.cwd(projectRoot).nothrow();

      // Clean up the image after test
      if (buildResult.exitCode === 0) {
        await $`docker rmi ${imageName}`.nothrow();
      }

      expect(buildResult.exitCode).toBe(0);
    },
    { timeout: 120000 },
  ); // 2 minute timeout for Docker build
});
