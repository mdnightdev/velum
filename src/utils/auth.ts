export function getSessionId(): string {
  if (typeof window === 'undefined') return '';
  return localStorage.getItem('velum-sessionId') ||
         sessionStorage.getItem('velum-sessionId') || 
         localStorage.getItem('velum_sessionId') ||
         sessionStorage.getItem('velum_sessionId') || 
         '';
}

export function getAuthHeaders(): Record<string, string> {
  const sessionId = getSessionId();
  return {
    'Authorization': `Bearer ${sessionId}`,
    'x-session-id': sessionId,
    'Content-Type': 'application/json'
  };
}
