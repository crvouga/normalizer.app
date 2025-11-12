import type { UserId } from '../users/user-id';
import type { Permission } from './permission';

/**
 * Error thrown when a user is not authorized to perform an action
 */
export class AuthorizationError extends Error {
  public readonly permission: Permission;
  public readonly userId: UserId;
  public readonly reason: string;

  constructor(params: { permission: Permission; userId: UserId; reason: string }) {
    const message = `Authorization failed: User ${params.userId} cannot ${params.permission.action} ${params.permission.resource}${params.permission.resourceId ? ` ${params.permission.resourceId}` : ''}. Reason: ${params.reason}`;
    super(message);
    this.name = 'AuthorizationError';
    this.permission = params.permission;
    this.userId = params.userId;
    this.reason = params.reason;

    // Maintains proper stack trace for where our error was thrown (only available on V8)
    if (Error.captureStackTrace) {
      Error.captureStackTrace(this, AuthorizationError);
    }
  }

  /**
   * User-friendly error message for display
   */
  public toUserMessage(): string {
    return `You don't have permission to ${this.permission.action} this ${this.permission.resource}.`;
  }

  /**
   * Check if an error is an AuthorizationError
   */
  static isAuthorizationError(error: unknown): error is AuthorizationError {
    return error instanceof AuthorizationError;
  }
}
