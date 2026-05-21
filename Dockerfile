# syntax=docker/dockerfile:1.7
#
# Single-container, ephemeral build of the entire app:
#   - PostgreSQL 15 (loopback only)
#   - MinIO (S3-compatible, loopback only)
#   - Background worker (graphile-worker)
#   - HTTP server (exposed on :8080)
#
# Build:  docker build -t normalizer-app .
# Run:    docker run --rm -p 8080:8080 normalizer-app
#
# No volumes, no compose. State lives inside the container and dies with it.
#
# ---------------------------------------------------------------------------
# Fly.io deploy
# ---------------------------------------------------------------------------
#
# fly.toml is managed out-of-band (not in this repo). Required configuration:
#
#   1. Secrets (set once via `fly secrets set ...`):
#
#        SERVER_BASE_URL=https://<your-public-origin>
#          MinIO listens on 127.0.0.1 only, so presigned upload URLs are
#          proxied through the app server's /api/objects/* endpoints. For
#          browsers to reach those URLs, SERVER_BASE_URL must be the public
#          origin (e.g. https://normalizer.chrisvouga.dev).
#
#        OBJECT_STORE_PRESIGNED_URL_SECRET=<openssl rand -hex 32>
#          HMAC key used to sign /api/objects/* presigned URLs. Falls back
#          to a hard-coded default if unset; override in production.
#
#   2. fly.toml [http_service] -- this single-container architecture is NOT
#      auto-suspend safe (loopback Postgres connections go stale on resume
#      and hang requests for minutes). Required settings:
#
#        internal_port      = 8080
#        force_https        = true
#        auto_stop_machines = "off"
#        min_machines_running = 1
#
#   3. fly.toml [[http_service.checks]] -- needed so Fly replaces a machine
#      whose loopback DB connection goes bad. /health probes Postgres and
#      returns 503 on failure. Recommended:
#
#        method       = "GET"
#        path         = "/health"
#        interval     = "30s"
#        timeout      = "10s"
#        grace_period = "60s"   # entrypoint takes a few seconds to boot pg+minio
#
#   4. fly.toml [build] -- point at this Dockerfile (the default behavior).
#
# Local preview of this exact image:  bun run docker:preview

FROM oven/bun:1

ARG TARGETARCH

# System packages: postgres server, curl, ca-certs.
# Symlink the version-specific server binaries into /usr/local/bin so the
# entrypoint doesn't have to care which major version apt installed.
RUN apt-get update \
    && apt-get install -y --no-install-recommends \
        postgresql \
        postgresql-contrib \
        ca-certificates \
        curl \
    && rm -rf /var/lib/apt/lists/* \
    && ln -sf /usr/lib/postgresql/*/bin/postgres /usr/local/bin/postgres \
    && ln -sf /usr/lib/postgresql/*/bin/initdb   /usr/local/bin/initdb

# MinIO server + client, architecture-aware.
RUN ARCH="${TARGETARCH:-amd64}" \
    && curl -fsSL "https://dl.min.io/server/minio/release/linux-${ARCH}/minio" -o /usr/local/bin/minio \
    && curl -fsSL "https://dl.min.io/client/mc/release/linux-${ARCH}/mc"       -o /usr/local/bin/mc \
    && chmod +x /usr/local/bin/minio /usr/local/bin/mc

WORKDIR /app

# Install JS deps first for better layer caching.
COPY package.json bun.lock bunfig.toml ./
RUN bun install --frozen-lockfile

COPY . .

ENV NODE_ENV=production \
    PORT=8080 \
    SERVER_BASE_URL=http://localhost:8080 \
    DATABASE_URL=postgresql://postgres:postgres@127.0.0.1:5432/postgres?sslmode=disable \
    S3_ENDPOINT=http://127.0.0.1:9000 \
    S3_ACCESS_KEY=minioadmin \
    S3_SECRET_KEY=minioadmin \
    S3_BUCKET=main \
    MINIO_ROOT_USER=minioadmin \
    MINIO_ROOT_PASSWORD=minioadmin \
    PGDATA=/var/lib/postgresql/data

EXPOSE 8080

# Inline entrypoint: boot postgres + minio, provision them, run migrations,
# launch the worker in the background, then exec the server in the foreground.
COPY <<'EOF' /entrypoint.sh
#!/usr/bin/env bash
set -euo pipefail

cleanup() {
  echo "[entrypoint] shutting down..."
  jobs -p | xargs -r kill 2>/dev/null || true
  wait 2>/dev/null || true
}
trap cleanup EXIT INT TERM

# --- PostgreSQL ---------------------------------------------------------------
mkdir -p "$PGDATA"
chown -R postgres:postgres "$PGDATA"
chmod 700 "$PGDATA"

if [ ! -s "$PGDATA/PG_VERSION" ]; then
  echo "[entrypoint] initializing postgres data dir at $PGDATA"
  su -s /bin/bash postgres -c "initdb -D \"$PGDATA\" --auth=trust --username=postgres -E UTF8 >/dev/null"
fi

echo "[entrypoint] starting postgres on 127.0.0.1:5432"
su -s /bin/bash postgres -c \
  "postgres -D \"$PGDATA\" -c listen_addresses=127.0.0.1 -c max_connections=100" &

until pg_isready -h 127.0.0.1 -U postgres -q; do
  sleep 0.3
done
echo "[entrypoint] postgres is ready"

# --- MinIO --------------------------------------------------------------------
mkdir -p /tmp/minio-data
echo "[entrypoint] starting minio on 127.0.0.1:9000"
minio server /tmp/minio-data --address ":9000" --console-address ":9001" \
  >/var/log/minio.log 2>&1 &

until curl -fsS http://127.0.0.1:9000/minio/health/live >/dev/null; do
  sleep 0.3
done
echo "[entrypoint] minio is ready"

mc alias set local "http://127.0.0.1:9000" "$MINIO_ROOT_USER" "$MINIO_ROOT_PASSWORD" >/dev/null
mc mb --ignore-existing "local/$S3_BUCKET" >/dev/null
echo "[entrypoint] bucket '$S3_BUCKET' ready"

# --- App ----------------------------------------------------------------------
echo "[entrypoint] running database migrations"
bun run db:migrate

echo "[entrypoint] starting worker"
bun run src/worker.tsx &

echo "[entrypoint] starting server on :$PORT"
exec bun run src/server.tsx
EOF

RUN chmod +x /entrypoint.sh

CMD ["/entrypoint.sh"]
