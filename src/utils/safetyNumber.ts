function canonicalizeJwk(jwkStr: string): string {
  try {
    const obj = JSON.parse(jwkStr);
    if (typeof obj !== 'object' || obj === null) return jwkStr;
    const sortedObj: Record<string, any> = {};
    Object.keys(obj).sort().forEach(k => {
      sortedObj[k] = obj[k];
    });
    return JSON.stringify(sortedObj);
  } catch {
    return jwkStr;
  }
}

/**
 * Computes a Signal-style Safety Number (6 blocks of 5 digits) from two public identity keys or JWK strings
 */
export async function computeClientSafetyNumber(
  identityKeyJWK1: string,
  identityKeyJWK2: string
): Promise<string> {
  try {
    const norm1 = canonicalizeJwk(identityKeyJWK1 || '');
    const norm2 = canonicalizeJwk(identityKeyJWK2 || '');

    const keys = [norm1, norm2].sort();
    const combined = keys.join('::');
    const encoder = new TextEncoder();
    const data = encoder.encode(combined);

    const hashBuffer = await crypto.subtle.digest('SHA-256', data);
    const view = new DataView(hashBuffer);

    const blocks: string[] = [];
    for (let i = 0; i < 6; i++) {
      const val = view.getUint32(i * 4, false); // Big endian
      const code = (val % 100000).toString().padStart(5, '0');
      blocks.push(code);
    }

    return blocks.join(' ');
  } catch (err) {
    console.error('[SAFETY_NUMBER] Error computing safety number:', err);
    return '00000 00000 00000 00000 00000 00000';
  }
}

/**
 * Validates whether two formatted Safety Numbers match
 */
export function verifySafetyNumbersMatch(numA: string, numB: string): boolean {
  const cleanA = numA.replace(/\s+/g, '');
  const cleanB = numB.replace(/\s+/g, '');
  return cleanA === cleanB && cleanA.length === 30;
}
