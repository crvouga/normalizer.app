const LOOPBACK_HOSTNAMES = new Set(['localhost', '127.0.0.1', '::1', '[::1]', '0.0.0.0']);

/**
 * True when the given URL or hostname refers to the local loopback interface.
 * Inputs may be either a hostname like `127.0.0.1` or a full URL like
 * `http://127.0.0.1:9000`.
 */
export function isLoopbackHost(hostnameOrUrl: string): boolean {
  if (!hostnameOrUrl) return false;
  let hostname = hostnameOrUrl;
  try {
    hostname = new URL(hostnameOrUrl).hostname;
  } catch {
    // not a full URL; treat the input as a bare hostname
  }
  return LOOPBACK_HOSTNAMES.has(hostname);
}
