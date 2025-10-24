# Use the official Bun image
FROM oven/bun:1-alpine

# Install curl for health checks
RUN apk add --no-cache curl

# Set working directory
WORKDIR /app

# Copy package files
COPY package.json bun.lock bunfig.toml ./

# Install dependencies
RUN bun install --frozen-lockfile

# Copy source code
COPY . .

# Build the application
RUN bun run build

# Expose port
EXPOSE 5000

# Health check
HEALTHCHECK --interval=30s --timeout=10s --start-period=40s --retries=3 \
    CMD curl -f http://localhost:5000/health || exit 1

# Start the application
CMD ["bun", "run", "start"]
