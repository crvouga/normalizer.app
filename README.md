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

### 5. Run checks (with remote cache)

Checks run through [Turborepo](https://turbo.build) with a self-hosted remote cache. Turbo creds (`TURBO_API`, `TURBO_TOKEN`, `TURBO_TEAM`) are loaded from Vault:

```bash
vault run -- bun run check
```

Individual tasks can also be run directly:

```bash
vault run -- bunx turbo run type-check:once
vault run -- bunx turbo run test
```

## Architecture

- **App**: Docker containers on the chrisvouga.dev origin stack — `normalizer.chrisvouga.dev` (web) and a separate worker container; `normalizer.app` / `www.normalizer.app` redirect via Cloudflare
- **Database**: shared Postgres; all tables live in schema `normalizer_app` (never `public`)
- **Object storage**: Backblaze B2 (S3-compatible); all keys are prefixed `normalizer-app/`
- **Secrets**: self-hosted OpenBao at `https://vault.chrisvouga.dev`

## Secrets workflow

| Context     | How secrets are loaded                                                     |
| ----------- | -------------------------------------------------------------------------- |
| Local dev   | `vault run -- <command>` reads `secret/personal/dev`                       |
| CI          | GitHub Actions OIDC → `hashicorp/vault-action` reads `secret/personal/prd` |
| Production  | Infra syncs env from Vault to the origin droplet at deploy time            |

Never commit secret values. [`.env.example`](.env.example) lists names only.

## Deployment

Push to `main` triggers **Publish image** (builds `normalizer` + `normalizer-worker` images) and dispatches infra **Deploy Pipeline**.

**Deployment Pipeline** in this repo runs checks and production DB migrations only.

### One-time secret-store setup

Add these keys to `secret/personal/prd`:

| Key                    | Purpose                                                                      |
| ---------------------- | ---------------------------------------------------------------------------- |
| `TURBO_API`            | Self-hosted Turborepo remote cache server URL                                  |
| `TURBO_TOKEN`          | Auth token for the remote cache                                              |
| `TURBO_TEAM`           | Team slug for the remote cache                                               |
| `VAULT_TOKEN`          | Long-lived token for runtime secret loading (if not using infra env sync)    |
| `CLOUDFLARE_API_TOKEN` | DNS + redirect rule edit access for the `normalizer.app` zone                |

## Google OAuth (optional)

1. Create OAuth credentials in [Google Cloud Console](https://console.cloud.google.com/)
2. Add `NORMALIZER_APP_GOOGLE_CLIENT_ID` and `NORMALIZER_APP_GOOGLE_CLIENT_SECRET` to `secret/personal/dev` and `secret/personal/prd`
3. Authorized redirect URIs:
   - Production: `https://www.normalizer.app/api/auth/google/callback`
   - Local dev: `http://localhost:8080/api/auth/google/callback` (must match `SERVER_BASE_URL` in `.env`)
4. If the app is in **Testing** mode on the OAuth consent screen, add your Google account under **Test users**

Without OAuth credentials the app works with anonymous users. The server logs a startup warning when credentials are missing, partial, or empty.
