/**
 * Parse and validate a URL, preserving the original protocol.
 * If the input is missing a protocol, tries http:// as a fallback.
 * Throws descriptive errors on failure.
 */
export function parseAndValidateURL(input: string, errorPrefix = 'Invalid URL'): string {
  const trimmed = input.trim();

  // Check for URLs with protocol but missing host (e.g., http:///, https:///foo/bar)
  if (/^https?:\/\/\//.test(trimmed)) {
    throw new Error(`${errorPrefix}: missing host`);
  }

  // Check for clearly invalid patterns
  if (trimmed.includes('///')) {
    throw new Error(
      `${errorPrefix}: ${trimmed}. Must be a valid URL (e.g., http://localhost:9000 or https://s3.example.com)`,
    );
  }

  // Helper to validate hostname looks reasonable
  const isValidHostname = (host: string): boolean => {
    if (!host || host.length === 0) {
      return false;
    }
    // Basic validation: hostname should contain alphanumeric, dots, hyphens, colons (for ports)
    // Reject if it contains obviously invalid characters like multiple exclamation marks
    if (/[!@#$%^&*()_+=\[\]{}|;'",<>?]/.test(host)) {
      return false;
    }
    // Should have at least one alphanumeric character
    if (!/[a-zA-Z0-9]/.test(host)) {
      return false;
    }
    // Hostname should be a valid domain, IP address, or localhost
    // Valid patterns: localhost, 127.0.0.1, example.com, sub.example.com, etc.
    // Reject simple words that aren't localhost or IP addresses
    const isIP = /^(\d{1,3}\.){3}\d{1,3}$/.test(host);
    const isLocalhost = host === 'localhost';
    const hasDot = host.includes('.');
    const hasPort = host.includes(':');

    // If it's not an IP, not localhost, and has no dot, it might be a Docker service name
    // Allow simple alphanumeric hostnames (e.g., "s3", "db") for Docker networking
    if (!isIP && !isLocalhost && !hasDot) {
      // Check if it's a simple alphanumeric hostname (Docker service name)
      const hostnamePart = hasPort ? host.split(':')[0] : host;
      const isSimpleHostname = hostnamePart && /^[a-zA-Z0-9-]+$/.test(hostnamePart);

      // Allow simple hostnames (like Docker service names) or reject
      if (!isSimpleHostname) {
        return false;
      }
    }
    return true;
  };

  try {
    const url = new URL(trimmed);
    // Validate that the URL has a proper host
    if (!url.host || !isValidHostname(url.hostname)) {
      throw new Error(`${errorPrefix}: missing host`);
    }
    return url.href;
  } catch (error) {
    // If it fails, try adding http:// prefix (common for localhost endpoints)
    try {
      const url = new URL('http://' + trimmed);
      if (!url.host || !isValidHostname(url.hostname)) {
        throw new Error(`${errorPrefix}: could not parse URL`);
      }
      return url.href;
    } catch (finalError) {
      throw new Error(
        `${errorPrefix}: ${trimmed}. Must be a valid URL (e.g., http://localhost:9000 or https://s3.example.com)`,
      );
    }
  }
}
