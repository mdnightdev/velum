export async function computeClientHash(secret: string, salt: string): Promise<string> {
  const encoder = new TextEncoder();
  const data = encoder.encode(salt + secret);
  const hashBuffer = await window.crypto.subtle.digest('SHA-256', data);
  const hashArray = Array.from(new Uint8Array(hashBuffer));
  return hashArray.map(b => b.toString(16).padStart(2, '0')).join('');
}

export function checkPasswordStrength(password: string): string | null {
  if (password.length < 8) {
    return 'Password must be at least 8 characters long.';
  }
  if (password.length > 128) {
    return 'Password must not exceed 128 characters.';
  }
  const weakPasswords = ['password', '12345678', '123456789', 'qwertyuiop', 'password123', 'admin123'];
  if (weakPasswords.includes(password.toLowerCase())) {
    return 'The password chosen is too common or weak.';
  }
  return null;
}
