import { storage, isTabSessionScope } from '../services/storageService';

/** Unwrap storage-service JSON envelope if present; otherwise return raw string. */
function unwrapRawToken(raw: string | null): string {
  if (!raw) return '';
  try {
    const parsed = JSON.parse(raw);
    if (parsed && typeof parsed === 'object' && typeof parsed.value === 'string') {
      return parsed.value;
    }
  } catch {
    // plain token string
  }
  return raw;
}

export function getSessionId(): string {
  if (typeof window === 'undefined') return '';

  // Tab-scoped: only unwrapped sessionStorage via storage service — never shared localStorage
  if (isTabSessionScope()) {
    return (
      storage.getItem<string>('velum-sessionId') ||
      storage.getItem<string>('session_token') ||
      ''
    );
  }

  return (
    storage.getItem<string>('velum-sessionId') ||
    storage.getItem<string>('session_token') ||
    unwrapRawToken(sessionStorage.getItem('velum-sessionId')) ||
    unwrapRawToken(sessionStorage.getItem('session_token')) ||
    unwrapRawToken(localStorage.getItem('velum-sessionId')) ||
    unwrapRawToken(localStorage.getItem('session_token')) ||
    ''
  );
}

export function getAuthHeaders(): Record<string, string> {
  const sessionId = getSessionId();
  return {
    'Authorization': `Bearer ${sessionId}`,
    'x-session-id': sessionId,
    'Content-Type': 'application/json'
  };
}

export { isTabSessionScope };
