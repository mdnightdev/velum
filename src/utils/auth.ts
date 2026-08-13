export function getSessionId(): string {
  if (typeof window === 'undefined') return '';
  return sessionStorage.getItem('velum-sessionId') || 
         sessionStorage.getItem('velum_sessionId') || 
         '';
}

export function getAuthHeaders(): Record<string, string> {
  const sessionId = getSessionId();
  return {
    'Authorization': `Bearer ${sessionId}`,
    'Content-Type': 'application/json'
  };
}
