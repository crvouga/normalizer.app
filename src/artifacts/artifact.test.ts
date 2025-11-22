import { describe, expect, test } from 'bun:test';
import { createLogger } from '../lib/logger';
import type { ObjectStore } from '../lib/object-store/object-store';
import { isOk } from '../lib/result';
import { createObjectStore } from '../shared/s3';
import { Artifact as ArtifactModule } from './artifact';
import { ArtifactId } from './artifact-id';
import { populateArtifactUrls } from './artifact-urls-populate';

describe('Artifact.populateUrls', async () => {
  const logger = createLogger();
  const testBucket = 'test';
  const objectStore: ObjectStore = await createObjectStore({ logger });
  await objectStore.ensureBucketExists(testBucket);

  test('should generate valid presigned upload and download URLs', async () => {
    const artifactId = ArtifactId.generate();
    const s3_key = `populate-live/test-file-${Math.random()}`;
    const filename = 'my-doc.txt';
    const artifact = ArtifactModule.create({
      id: artifactId,
      filename,
      content_type: 'text/plain',
    });
    // Override S3 bucket and key for the test
    const artifactForTest = {
      ...artifact,
      s3_bucket: testBucket,
      s3_key,
    };

    // Ensure upload and download URLs are initially missing
    expect(artifactForTest.upload_url).toBeNull();
    expect(artifactForTest.download_url).toBeNull();

    const { artifacts: populated, updated } = await populateArtifactUrls({
      artifacts: [artifactForTest],
      objectStore,
    });

    expect(updated.has(artifactId.toString())).toBe(true);
    const populatedArtifact = populated[0];
    expect(populatedArtifact).toBeDefined();

    if (!populatedArtifact) {
      throw new Error('Expected populated artifact to be defined');
    }

    expect(populatedArtifact.upload_url).toBeDefined();
    expect(typeof populatedArtifact.upload_url).toBe('string');
    expect(populatedArtifact.upload_url).not.toBe('');

    expect(populatedArtifact.download_url).toBeDefined();
    expect(typeof populatedArtifact.download_url).toBe('string');
    expect(populatedArtifact.download_url).not.toBe('');

    expect(populatedArtifact.upload_url_expires_at).toBeInstanceOf(Date);
    expect(populatedArtifact.download_url_expires_at).toBeInstanceOf(Date);
  });

  test('should not update URLs if still valid and base matches', async () => {
    const artifactId = ArtifactId.generate();
    const s3_key = `populate-valid/test-file-${Math.random()}`;
    const filename = 'valid.txt';
    const artifact = ArtifactModule.create({
      id: artifactId,
      filename,
      content_type: 'text/plain',
    });

    // First run to get fresh URLs and expiration
    const artifactForTest = {
      ...artifact,
      s3_bucket: testBucket,
      s3_key,
    };
    const firstPop = await populateArtifactUrls({
      artifacts: [artifactForTest],
      objectStore,
    });
    const populated = firstPop.artifacts[0];
    expect(populated).toBeDefined();

    if (!populated) {
      throw new Error('Expected populated artifact to be defined');
    }

    // The second run should preserve the URLs (not update them, so the set will be empty)
    const secondPop = await populateArtifactUrls({
      artifacts: [populated],
      objectStore,
    });
    const again = secondPop.artifacts[0];
    expect(again).toBeDefined();

    if (!again) {
      throw new Error('Expected again artifact to be defined');
    }

    expect(secondPop.updated.size).toBe(0);
    expect(again.upload_url).toBe(populated.upload_url);
    expect(again.download_url).toBe(populated.download_url);
  });

  test('should update URLs if they are expired', async () => {
    const artifactId = ArtifactId.generate();
    const s3_key = `expire-test/test-file-${Math.random()}`;
    const filename = 'expire-me.txt';
    const artifact = ArtifactModule.create({
      id: artifactId,
      filename,
      content_type: 'text/plain',
    });

    const pastDate = new Date(Date.now() - 1000 * 60 * 60 * 24 * 30); // 30 days ago

    const artifactForTest = {
      ...artifact,
      s3_bucket: testBucket,
      s3_key,
      upload_url: 'http://should-be-replaced',
      download_url: 'http://should-be-replaced',
      upload_url_expires_at: pastDate,
      download_url_expires_at: pastDate,
    };

    const { artifacts: result, updated } = await populateArtifactUrls({
      artifacts: [artifactForTest],
      objectStore,
    });

    expect(updated.has(artifactId.toString())).toBe(true);
    const updatedArtifact = result[0];
    expect(updatedArtifact).toBeDefined();

    if (!updatedArtifact) {
      throw new Error('Expected updated artifact to be defined');
    }

    expect(updatedArtifact.upload_url).not.toBe('http://should-be-replaced');
    expect(updatedArtifact.download_url).not.toBe('http://should-be-replaced');
    expect(updatedArtifact.upload_url_expires_at?.getTime()).toBeGreaterThan(Date.now());
    expect(updatedArtifact.download_url_expires_at?.getTime()).toBeGreaterThan(Date.now());
  });

  test('should enforce HTTPS on URLs if the S3 endpoint uses HTTPS', async () => {
    // Check if endpoint uses HTTPS
    const endpointInfoResult = await objectStore.getEndpointInfo();
    if (!isOk(endpointInfoResult) || !endpointInfoResult.value.useHTTPS) {
      // Cannot test HTTPS rewriting if not using an HTTPS endpoint
      return;
    }

    const artifactId = ArtifactId.generate();
    const s3_key = `https-enforce/test-file-${Math.random()}`;
    const artifact = ArtifactModule.create({
      id: artifactId,
      filename: 'https-enforce.txt',
      content_type: 'text/plain',
    });

    const artifactForTest = {
      ...artifact,
      s3_bucket: testBucket,
      s3_key,
    };

    const { artifacts: result } = await populateArtifactUrls({
      artifacts: [artifactForTest],
      objectStore,
    });
    const updatedArtifact = result[0];
    expect(updatedArtifact).toBeDefined();

    if (!updatedArtifact) {
      throw new Error('Expected updated artifact to be defined');
    }

    expect(updatedArtifact.upload_url?.startsWith('https://')).toBe(true);
    expect(updatedArtifact.download_url?.startsWith('https://')).toBe(true);
  });
});
