import crypto from 'crypto';

export const BASE32_CHARS = '0123456789ABCDEFGHJKMNPQRSTVWXYZ';

export function generateUlid(seedTime: number = Date.now()): string {
  let timePart = '';
  let timeVal = seedTime;
  for (let i = 0; i < 10; i++) {
    const mod = timeVal % 32;
    timePart = BASE32_CHARS[mod] + timePart;
    timeVal = Math.floor(timeVal / 32);
  }

  let randomPart = '';
  const randBytes = crypto.randomBytes(10);
  for (let i = 0; i < 10; i++) {
    const index = randBytes[i] % 32;
    randomPart += BASE32_CHARS[index];
  }

  return timePart + randomPart;
}

export function generatePrefixedId(prefix: string): string {
  return `${prefix}_${generateUlid()}`;
}

