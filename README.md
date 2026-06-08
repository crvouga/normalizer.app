# normalizer.app

## Quick Start (local)

### 1. Install the vault CLI wrapper

One-time per machine — from the [secret-store](https://github.com/crvouga/secret-store) repo:

```bash
./scripts/install-cli.sh
vault login hvs.your-root-token   # or scoped dev token
```

Requires the [OpenBao/Vault CLI](https://openbao.org/docs/install/) and `jq` on PATH.

### 2. Configure this repo

```bash
vault setup --project personal --config dev
```

This writes [`.vault.yaml`](.vault.yaml) (coordinates only, safe to commit).

### 3. Ensure secrets exist in the store

Create `secret/personal/dev` with the keys listed in [`.env.example`](.env.example). See that file for required variable names.

### 4. Run migrations and start the app

```bash
bun install
vault run -- bun run db:migrate
vault run -- bun run server    # or: bun run dev
```

The HTTP server and background worker run in a single process at `http://localhost:8080`.

## Architecture

- **App**: one Fly.io machine (`normalizer-app`) serves `https://normalizer.app` and runs graphile-worker in-process
- **Database**: shared Postgres; all tables live in schema `normalizer_app` (never `public`)
- **Object storage**: Backblaze B2 (S3-compatible); all keys are prefixed `normalizer-app/`
- **Secrets**: self-hosted OpenBao at `https://secret-store.chrisvouga.dev`

## Secrets workflow

| Context     | How secrets are loaded                                                     |
| ----------- | -------------------------------------------------------------------------- |
| Local dev   | `vault run -- <command>` reads `secret/personal/dev`                       |
| CI          | GitHub Actions OIDC → `hashicorp/vault-action` reads `secret/personal/prd` |
| Fly runtime | `VAULT_TOKEN` + KV v2 HTTP read of `secret/personal/prd` at boot           |

Never commit secret values. [`.env.example`](.env.example) lists names only.

## Deployment

CI on push to `main`:

1. Runs tests (Postgres service + ephemeral MinIO)
2. Migrates production DB via Vault OIDC (`DATABASE_URL` from `secret/personal/prd`)
3. `flyctl deploy` using [`fly.toml`](fly.toml)

### Manual Fly setup (one-time)

```bash
fly apps create normalizer-app
./scripts/create-dev-token.sh   # in secret-store repo
fly secrets set VAULT_TOKEN=hvs.xxx -a normalizer-app
fly certs add normalizer.app -a normalizer-app
```

Add the Fly DNS record in Cloudflare for `normalizer.app` (grey-cloud until cert validates).

## Google OAuth (optional)

1. Create OAuth credentials in [Google Cloud Console](https://console.cloud.google.com/)
2. Add `NORMALIZER_APP_GOOGLE_CLIENT_ID` and `NORMALIZER_APP_GOOGLE_CLIENT_SECRET` to `secret/personal/dev` and `secret/personal/prd`
3. Authorized redirect URIs:
   - Production: `https://normalizer.app/api/auth/google/callback`
   - Local dev: `http://localhost:8080/api/auth/google/callback` (must match `SERVER_BASE_URL` in `.env`)
4. If the app is in **Testing** mode on the OAuth consent screen, add your Google account under **Test users**

Without OAuth credentials the app works with anonymous users. The server logs a startup warning when credentials are missing, partial, or empty.
