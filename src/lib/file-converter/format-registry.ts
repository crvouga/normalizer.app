import type { FileFormatHandler } from './file-format-handler';

/**
 * Registry for managing file format handlers
 * Allows dynamic registration and format detection
 */
export class FormatRegistry {
  private handlers: Map<string, FileFormatHandler> = new Map();
  private handlerOrder: FileFormatHandler[] = [];

  /**
   * Register a file format handler
   * @param handler Handler instance to register
   */
  register(handler: FileFormatHandler): void {
    const formatName = handler.getFormatName();
    this.handlers.set(formatName, handler);
    this.handlerOrder.push(handler);
  }

  /**
   * Get a handler by format name
   * @param formatName Format identifier
   * @returns Handler instance or undefined if not found
   */
  getHandler(formatName: string): FileFormatHandler | undefined {
    return this.handlers.get(formatName);
  }

  /**
   * Detect file format by checking all registered handlers
   * Handlers are checked in registration order
   * @param buffer File buffer to check
   * @param filename Original filename
   * @returns Format name if detected, null otherwise
   */
  detectFormat(buffer: Buffer, filename: string): string | null {
    // Check handlers in registration order (more specific handlers should be registered first)
    for (const handler of this.handlerOrder) {
      if (handler.detect(buffer, filename)) {
        return handler.getFormatName();
      }
    }
    return null;
  }

  /**
   * Get all registered format names
   * @returns Array of format identifiers
   */
  getAllFormats(): string[] {
    return Array.from(this.handlers.keys());
  }

  /**
   * Check if a format is registered
   * @param formatName Format identifier
   * @returns true if format is registered
   */
  hasFormat(formatName: string): boolean {
    return this.handlers.has(formatName);
  }
}
