/**
 * Unified file representation that supports both local files and remote artifacts.
 * Files are downloaded lazily on-demand when needed for preview.
 */
export type TabularFile = {
  /**
   * Optional unique identifier (useful for artifacts)
   */
  id?: string;

  /**
   * Display name of the file
   */
  name: string;

  /**
   * URL to download the file from
   * For local files, this can be a blob URL created with URL.createObjectURL()
   * For remote files/artifacts, this is the download URL from the server
   */
  downloadUrl: string;

  /**
   * File size in bytes (optional)
   */
  size?: number;

  /**
   * MIME type of the file (optional)
   */
  contentType?: string;
};
