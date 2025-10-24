# Database Connection Management

This document explains the database connection management solution implemented to prevent connection leaks during hot reloading in development.

## Problem

During development with hot reloading, the application was creating new database connections on each restart without properly closing previous connections. This led to PostgreSQL hitting its connection limit with errors like:

```
FATAL: sorry, too many clients already
```

## Solution

### 1. Connection Reuse

- Implemented a global connection instance that persists across hot reloads
- Added health checks to ensure existing connections are still valid
- Only create new connections when the existing one is unhealthy

### 2. Graceful Shutdown

- Added signal handlers for SIGINT, SIGTERM, and SIGHUP
- Proper cleanup of database connections on shutdown
- Error handling for graceful shutdown failures

### 3. PostgreSQL Configuration

- Increased `max_connections` from default (100) to 200
- Optimized PostgreSQL settings for development
- Added connection monitoring capabilities

## Files Modified

### `src/sql.ts`

- Added global connection instance management
- Implemented connection reuse logic
- Added `cleanupSQL` function for graceful shutdown

### `src/index.tsx`

- Added graceful shutdown handlers
- Improved error handling in main function

### `docker-compose.yml`

- Increased PostgreSQL connection limits
- Added performance optimizations

### `scripts/check-connections.sh`

- Monitoring script to check connection status
- Usage: `./scripts/check-connections.sh`

## Usage

### Development

The connection management is automatic during development. The application will:

1. Reuse existing connections when possible
2. Create new connections only when needed
3. Clean up connections on shutdown

### Monitoring

Use the provided script to monitor connection usage:

```bash
./scripts/check-connections.sh
```

This will show:

- Current active connections
- Connection details
- Usage percentage
- Warnings if usage is high

### Production Considerations

For production, consider:

- Using a proper connection pooler like PgBouncer
- Implementing connection limits in your application
- Monitoring connection usage
- Setting appropriate PostgreSQL connection limits

## Benefits

1. **Prevents Connection Leaks**: No more "too many clients" errors
2. **Faster Hot Reloads**: Reuses existing connections when possible
3. **Better Resource Management**: Proper cleanup on shutdown
4. **Development Friendly**: Optimized settings for development workflow
5. **Monitoring**: Easy way to check connection status

## Troubleshooting

If you still experience connection issues:

1. Check current connections: `./scripts/check-connections.sh`
2. Restart the database: `docker-compose restart db`
3. Check for zombie connections in PostgreSQL
4. Verify the application is properly shutting down

## Future Improvements

- Implement connection pooling for production
- Add connection metrics and monitoring
- Consider using PgBouncer for connection pooling
- Add automatic connection health checks
