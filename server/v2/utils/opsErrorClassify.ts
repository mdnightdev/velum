export type OpsSeverity = 'amber' | 'red';

/** Auth/crypto/session paths worth durable ops audit (not every 404 on the API). */
export function isOpsWatchedPath(url: string): boolean {
  const u = (url || '').toLowerCase().split('?')[0];
  return (
    u.includes('/auth') ||
    u.includes('/crypto') ||
    u.includes('/prekeys') ||
    u.includes('/webauthn') ||
    u.includes('/support/diagnostics')
  );
}

export function severityForHttpStatus(statusCode: number): OpsSeverity {
  return statusCode >= 500 ? 'red' : 'amber';
}

export function opsCodeForHttp(method: string, path: string, statusCode: number): string {
  const p = path.toLowerCase();
  if (p.includes('/prekeys') && statusCode === 401) return 'PREKEY_AUTH_401';
  if (p.includes('/prekeys') && statusCode >= 400) return `PREKEY_HTTP_${statusCode}`;
  if (p.includes('/crypto') && statusCode >= 400) return `CRYPTO_HTTP_${statusCode}`;
  if (p.includes('/auth') && statusCode === 401) return 'AUTH_401';
  if (p.includes('/auth') && statusCode >= 400) return `AUTH_HTTP_${statusCode}`;
  return `HTTP_${method.toUpperCase()}_${statusCode}`;
}
