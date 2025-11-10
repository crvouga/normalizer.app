# normalizer.app

## Environment Variables

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

# Optional: Custom redirect URI (defaults to http://localhost:PORT/api/auth/google/callback)
# GOOGLE_REDIRECT_URI=http://localhost:5000/api/auth/google/callback
```

If these credentials are not configured, the app will gracefully degrade and show "Authentication not configured" in the user menu.
