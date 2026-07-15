import crypto from 'crypto';

export function getStepOTP(): string {
  const window = Math.floor(Date.now() / 30000);
  const secret = process.env.OTP_SECRET || 'velum_default_step_secret_key_999';
  const hmac = crypto.createHmac('sha256', secret);
  hmac.update(window.toString());
  const hash = hmac.digest('hex');
  const code = parseInt(hash.substring(0, 8), 16) % 1000000;
  return code.toString().padStart(6, '0');
}

export function checkStepOTP(token: string): boolean {
  if (!token) return false;
  const current = Math.floor(Date.now() / 30000);
  const secret = process.env.OTP_SECRET || 'velum_default_step_secret_key_999';

  for (let i = -1; i <= 1; i++) {
    const window = current + i;
    const hmac = crypto.createHmac('sha256', secret);
    hmac.update(window.toString());
    const hash = hmac.digest('hex');
    const code = parseInt(hash.substring(0, 8), 16) % 1000000;
    if (code.toString().padStart(6, '0') === token.trim()) {
      return true;
    }
  }
  return false;
}
