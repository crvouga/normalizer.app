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
#   2. fly.toml [http_service] -- pick ONE of:
#
#      (a) Always-on (recommended for production):
#            internal_port        = 8080
#            force_https          = true
#            auto_stop_machines   = "off"
#            min_machines_running = 1
#
#          Why: this single-container architecture is NOT auto-SUSPEND safe.
#          Pausing/resuming the VM strands loopback TCP connections between
#          the bun server and postgres, which then hangs requests for minutes.
#
#      (b) Scale-to-zero (works, but cold-start latency on first request):
#            internal_port        = 8080
#            force_https          = true
#            auto_stop_machines   = "stop"     # NOT "suspend"
#            auto_start_machines  = true
#            min_machines_running = 0
#
#          Why this works: the entrypoint shuts everything down cleanly on
#          SIGTERM (server -> worker -> `pg_ctl stop -m fast` -> minio), so
#          postgres flushes its WAL before the machine is stopped. On the
#          next request Fly cold-starts the machine, the entrypoint sees the
#          existing $PGDATA, skips initdb, and reconnects to fresh data.
#          Cold-start adds ~5-15s of latency to the first request after idle.
#          DO NOT use "suspend" -- see (a).
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
# Diagnostics endpoints:
#   GET /health        -- cheap; probes db only; suitable for Fly health check
#   GET /health/deep   -- comprehensive; probes db + object store; verbose body
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

# Inline entrypoint: boots postgres + minio, runs migrations, launches the
# worker, then the server. Bash stays PID 1 so trap handlers fire on
# SIGTERM and we can shut postgres down cleanly (required for scale-to-zero
# with auto_stop_machines = "stop", and good hygiene either way).
COPY <<'EOF' /entrypoint.sh
#!/usr/bin/env bash
set -euo pipefail

log() { printf '[entrypoint %s] %s\n' "$(date -u +%Y-%m-%dT%H:%M:%SZ)" "$*"; }

# --- Track every long-running child by PID so cleanup can stop them in
# --- the right order. Empty values are ignored by `kill -0` checks.
PG_PID=
MINIO_PID=
WORKER_PID=
SERVER_PID=

# Send SIGTERM and wait up to 30s; escalate to SIGKILL if the process
# refuses to exit. Returns immediately for an empty/already-dead PID.
terminate() {
  local name=$1
  local pid=$2
  if [ -z "$pid" ] || ! kill -0 "$pid" 2>/dev/null; then
    return 0
  fi
  log "stopping $name (pid=$pid)"
  kill -TERM "$pid" 2>/dev/null || true
  local i=0
  while kill -0 "$pid" 2>/dev/null; do
    i=$((i + 1))
    if [ "$i" -gt 60 ]; then  # 60 * 0.5s = 30s
      log "$name did not exit within 30s, sending SIGKILL"
      kill -KILL "$pid" 2>/dev/null || true
      break
    fi
    sleep 0.5
  done
  log "$name stopped"
}

cleanup() {
  trap '' EXIT INT TERM  # disarm; cleanup must be idempotent
  log "shutdown initiated (uptime ${SECONDS}s)"

  # Order matters: stop accepting new requests, drain the worker, then
  # flush the database, then take down minio.
  terminate server "$SERVER_PID"
  terminate worker "$WORKER_PID"

  # Postgres: try a clean `pg_ctl stop -m fast` first (flushes WAL and
  # disconnects clients politely). Fall back to plain SIGTERM only if
  # pg_ctl is unavailable or fails.
  if [ -n "$PG_PID" ] && kill -0 "$PG_PID" 2>/dev/null; then
    log "stopping postgres via pg_ctl (pid=$PG_PID)"
    if ! su -s /bin/bash postgres -c \
      "pg_ctl stop -D \"$PGDATA\" -m fast -w -t 30" >/dev/null 2>&1; then
      log "pg_ctl stop failed, falling back to SIGTERM"
      terminate postgres "$PG_PID"
    else
      wait "$PG_PID" 2>/dev/null || true
      log "postgres stopped"
    fi
  fi

  terminate minio "$MINIO_PID"
  log "shutdown complete (uptime ${SECONDS}s)"
}
trap cleanup EXIT INT TERM

# --- PostgreSQL ---------------------------------------------------------------
mkdir -p "$PGDATA"
chown -R postgres:postgres "$PGDATA"
chmod 700 "$PGDATA"

if [ -s "$PGDATA/PG_VERSION" ]; then
  log "reusing existing postgres data dir at $PGDATA"
else
  log "initializing fresh postgres data dir at $PGDATA"
  su -s /bin/bash postgres -c \
    "initdb -D \"$PGDATA\" --auth=trust --username=postgres -E UTF8 >/dev/null"
fi

log "starting postgres on 127.0.0.1:5432"
su -s /bin/bash postgres -c \
  "postgres -D \"$PGDATA\" -c listen_addresses=127.0.0.1 -c max_connections=100" &
PG_PID=$!

# --- MinIO (start in parallel; we'll wait for both readiness checks) ---------
mkdir -p /tmp/minio-data
log "starting minio on 127.0.0.1:9000"
minio server /tmp/minio-data --address ":9000" --console-address ":9001" \
  >/var/log/minio.log 2>&1 &
MINIO_PID=$!

# --- Wait for postgres -------------------------------------------------------
PG_WAIT_START=$SECONDS
while ! pg_isready -h 127.0.0.1 -U postgres -q; do
  if [ $((SECONDS - PG_WAIT_START)) -gt 30 ]; then
    log "ERROR: postgres did not become ready within 30s"
    exit 1
  fi
  sleep 0.3
done
log "postgres ready in $((SECONDS - PG_WAIT_START))s (pid=$PG_PID)"

# --- Wait for minio ----------------------------------------------------------
MINIO_WAIT_START=$SECONDS
while ! curl -fsS http://127.0.0.1:9000/minio/health/live >/dev/null; do
  if [ $((SECONDS - MINIO_WAIT_START)) -gt 30 ]; then
    log "ERROR: minio did not become ready within 30s"
    exit 1
  fi
  sleep 0.3
done
log "minio ready in $((SECONDS - MINIO_WAIT_START))s (pid=$MINIO_PID)"

mc alias set local "http://127.0.0.1:9000" \
  "$MINIO_ROOT_USER" "$MINIO_ROOT_PASSWORD" >/dev/null
mc mb --ignore-existing "local/$S3_BUCKET" >/dev/null
log "bucket '$S3_BUCKET' ready"

# --- App ---------------------------------------------------------------------
log "running database migrations"
bun run db:migrate

log "starting worker"
bun run src/worker.tsx &
WORKER_PID=$!

log "starting server on :$PORT"
bun run src/server.tsx &
SERVER_PID=$!

log "boot complete in ${SECONDS}s (pg=$PG_PID minio=$MINIO_PID worker=$WORKER_PID server=$SERVER_PID)"

# Bash stays PID 1 and waits on the server. SIGTERM from Fly/Docker
# interrupts `wait`, runs the trap, and we get an orderly shutdown.
wait "$SERVER_PID"
EOF

RUN chmod +x /entrypoint.sh

CMD ["/entrypoint.sh"]
