import { beforeEach, describe, expect, test } from "bun:test";
import { createLogger } from "../lib/logger";
import { createS3 } from "../s3";
import { createSQL } from "../sql";
import { createFileUploadRouter } from "./file-upload-router";

describe("FileUploadRouter", () => {
  const logger = createLogger();
  let sql: Awaited<ReturnType<typeof createSQL>>;
  let s3: Awaited<ReturnType<typeof createS3>>;
  let router: ReturnType<typeof createFileUploadRouter>;

  beforeEach(async () => {
    sql = await createSQL({ logger });
    s3 = await createS3({ logger });
    router = createFileUploadRouter({ sql, s3 });
  });

  describe("getUploadUrl", () => {
    test("should generate upload URL and create file record", async () => {
      const input = {
        filename: "test.txt",
        contentType: "text/plain",
        userId: "test-user",
      };

      const result = await router.getUploadUrl.call(input);

      expect(result.uploadUrl).toBeDefined();
      expect(result.uploadUrl).toContain(input.filename);
      expect(result.fileKey).toBeDefined();
    });
  });

  describe("getFile", () => {
    test("should return file metadata", async () => {
      // First create a file
      const input = {
        filename: "test.txt",
        contentType: "text/plain",
        userId: "test-user",
      };

      const { fileKey } = await router.getUploadUrl.call(input);

      const result = await router.getFile.call({ key: fileKey });

      expect(result).toMatchObject({
        filename: input.filename,
        content_type: input.contentType,
        user_id: input.userId,
      });
    });
  });

  describe("listFiles", () => {
    test("should return list of files for user", async () => {
      // First create some files
      const file1 = await router.getUploadUrl.call({
        filename: "test1.txt",
        contentType: "text/plain",
        userId: "test-user",
      });

      const file2 = await router.getUploadUrl.call({
        filename: "test2.txt",
        contentType: "text/plain",
        userId: "test-user",
      });

      const result = await router.listFiles.call({
        userId: "test-user",
      });

      expect(result).toHaveLength(2);
      expect(result.map((f) => f.key)).toContain(file1.fileKey);
      expect(result.map((f) => f.key)).toContain(file2.fileKey);
    });
  });

  describe("markUploaded", () => {
    test("should update file status and size", async () => {
      // First create a file
      const { fileKey } = await router.getUploadUrl.call({
        filename: "test.txt",
        contentType: "text/plain",
        userId: "test-user",
      });

      await router.markUploaded.call({
        key: fileKey,
        size: 1000,
      });

      const file = await router.getFile.call({ key: fileKey });
      expect(file.size).toBe(1000);
      expect(file.status).toBe("uploaded");
    });
  });

  describe("deleteFile", () => {
    test("should delete file from S3 and mark as deleted in database", async () => {
      // First create and upload a file
      const { fileKey } = await router.getUploadUrl.call({
        filename: "test.txt",
        contentType: "text/plain",
        userId: "test-user",
      });

      await router.markUploaded.call({
        key: fileKey,
        size: 1000,
      });

      await router.deleteFile.call({ key: fileKey });

      await expect(router.getFile.call({ key: fileKey })).rejects.toThrow(
        "File not found"
      );
    });

    test("should throw error if file not found", async () => {
      await expect(
        router.deleteFile.call({ key: "non-existent" })
      ).rejects.toThrow("File not found");
    });
  });
});
