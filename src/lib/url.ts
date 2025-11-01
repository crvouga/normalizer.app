export function deriveURL(input: unknown): string | null {
  if (typeof input !== 'string' || input.trim() === '') {
    return null;
  }
  let str = input.trim();

  // Check for clearly invalid patterns
  if (str.includes('///')) {
    return null;
  }

  // If it's already a valid URL, normalize protocol to https
  try {
    let url: URL;
    try {
      url = new URL(str);
      // Check if URL has a proper host (not empty)
      // If host is empty, it means the URL was parsed incorrectly
      // (e.g., "example.com:3000" becomes protocol="example.com:" host="" path="3000")
      if (!url.host) {
        // Try adding https:// prefix
        url = new URL('https://' + str);
        if (!url.host) {
          return null;
        }
        return url.href;
      }
      // Already a valid URL, convert http to https
      if (url.protocol === 'http:') {
        url = new URL('https://' + url.host + url.pathname + url.search + url.hash);
      } else if (url.protocol !== 'https:') {
        // Non-http(s) protocol, try to convert
        url = new URL('https://' + url.host + url.pathname + url.search + url.hash);
      }
      return url.href;
    } catch (e) {
      // If it fails maybe it's missing the protocol, try to add one and retry
      // Handle hostname with port (e.g., "example.com:3000")
      // The URL constructor interprets "example.com:3000" as scheme:path
      // So we need to add https:// prefix first
      url = new URL('https://' + str);
      // Validate that the URL has a proper host
      if (!url.host) {
        return null;
      }
      return url.href;
    }
  } catch (finalError) {
    // Could not parse as URL
    return null;
  }
}
