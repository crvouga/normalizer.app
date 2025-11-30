export function getGoogleClientId(): string | null {
  return process.env.GOOGLE_CLIENT_ID ?? null;
}

export function getGoogleClientSecret(): string | null {
  return process.env.GOOGLE_CLIENT_SECRET ?? null;
}

export function isGoogleAuthEnabled(): boolean {
  return Boolean(getGoogleClientId() && getGoogleClientSecret());
}
