#!/bin/bash
set -e

echo "Waiting for database to be ready..."
until nc -z host.docker.internal 5433; do
  echo "Database is unavailable - sleeping"
  sleep 1
done
echo "Database is up!"

echo "Waiting for S3 (MinIO) to be ready..."
until nc -z host.docker.internal 9010; do
  echo "S3 is unavailable - sleeping"
  sleep 1
done
echo "S3 is up!"

echo "Running database migrations..."
bun run src/db/run-migrations.ts

echo "Starting development server with hot reload..."
exec bun run --hot src/server.tsx

