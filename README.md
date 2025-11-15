# normalizer.app

## Quick Start

### 1. Setup Environment Variables

Copy the environment template to create your local configuration:

```bash
cp env-template.txt .env
```

This file contains all necessary configuration for local development, including:

- Database connection settings
- MinIO/S3 configuration
- Optional Google OAuth credentials

### 2. Start Docker Services

```bash
bun docker
```

This starts PostgreSQL and MinIO services defined in `docker-compose.yml`.

### 3. Run Migrations

```bash
bun run db:migrate
```

### 4. Start Development Server

```bash
bun run server
```

The app will be available at `http://localhost:5000`.

## Environment Variables

All environment configuration is stored in `env-template.txt` as the single source of truth. Both local development and CI/CD pipelines use this template.

**Important**: The `.env` file is git-ignored. Always update `env-template.txt` when adding new environment variables so that all developers and CI have the same configuration.

### Google OAuth (Optional)

Google OAuth authentication is optional. The app works perfectly without it, showing anonymous users by default.

To enable Google Sign-In:

1. Go to [Google Cloud Console](https://console.cloud.google.com/)
2. Create a new project or select an existing one
3. Enable the Google+ API or Google Identity Services
4. Create OAuth 2.0 credentials (Web application):
   - **Authorized JavaScript origins**: `http://localhost:5000`, `https://yourdomain.com`
   - **Authorized redirect URIs**: `http://localhost:5000/api/auth/google/callback`
5. Add these environment variables to your `.env` file:

```bash
# Google OAuth Credentials (optional)
GOOGLE_CLIENT_ID=your_client_id_here
GOOGLE_CLIENT_SECRET=your_client_secret_here
```

The redirect URI is automatically derived from your application's domain. Make sure to add all domains (dev, staging, production) to Google's Authorized redirect URIs list in the format: `https://yourdomain.com/api/auth/google/callback`

If these credentials are not configured, the app will gracefully degrade and show "Authentication not configured" in the user menu.
