import { describe, expect, test } from "bun:test";
import { createLogger } from "./lib/logger";
import { createS3 } from "./s3";

describe("S3 Client", () => {
  const logger = createLogger();

  test("should initialize S3 client successfully", async () => {
    const s3Client = await createS3({ logger });
    expect(s3Client).toBeDefined();
  });

  test("should be able to presign URLs", async () => {
    const s3Client = await createS3({ logger });
    const presignedUrl = s3Client.presign("test-file.txt");
    expect(presignedUrl).toBeString();
    expect(presignedUrl).toContain(process.env.S3_ENDPOINT as string);
  });

  test("should handle file operations", async () => {
    const s3Client = await createS3({ logger });
    const testFile = new Blob(["Hello World"], { type: "text/plain" });
    const key = "test-upload.txt";

    // Upload file
    await s3Client.write(key, testFile);

    // Get file
    const downloadedFile = s3Client.file(key);
    expect(downloadedFile).toBeDefined();

    const text = await downloadedFile.text();
    expect(text).toBe("Hello World");

    // Delete file
    await s3Client.delete(key);

    // Verify deletion
    try {
      s3Client.file(key);
      throw new Error("File should not exist");
    } catch (error) {
      expect(error).toBeDefined();
    }
  });
});
