const fs = require('fs');
const file = 'src/services/doubleRatchetService.ts';
let code = fs.readFileSync(file, 'utf8');

// 1. Add hmacHex to RatchetMessageEnvelope
code = code.replace(
  '  tagHex: string;\n}',
  '  tagHex: string;\n  hmacHex?: string;\n}'
);

// 2. Add getMacKey to DoubleRatchetService
const getMacKeyCode = `
  private async getMacKey(messageKey: CryptoKey): Promise<CryptoKey> {
    const subtle = window.crypto.subtle;
    const rawKey = await subtle.exportKey('raw', messageKey);
    const macKeyBytes = await subtle.digest('SHA-256', rawKey);
    return subtle.importKey('raw', macKeyBytes, { name: 'HMAC', hash: 'SHA-256' }, false, ['sign', 'verify']);
  }
`;

code = code.replace(
  'class DoubleRatchetService {',
  'class DoubleRatchetService {' + getMacKeyCode
);

// 3. Update encryptDirectMessage
const encryptBodyHexOld = `    const bodyHex = Array.from(body).map(b => b.toString(16).padStart(2, '0')).join('');
    const tagHex = Array.from(tag).map(b => b.toString(16).padStart(2, '0')).join('');

    const envelope: RatchetMessageEnvelope = {
      header,
      ivHex,
      ciphertextHex: bodyHex,
      tagHex
    };

    return \`ratchet:v2:\${JSON.stringify(envelope)}\`;`;

const encryptBodyHexNew = `    const bodyHex = Array.from(body).map(b => b.toString(16).padStart(2, '0')).join('');
    const tagHex = Array.from(tag).map(b => b.toString(16).padStart(2, '0')).join('');

    const envelope: RatchetMessageEnvelope = {
      header,
      ivHex,
      ciphertextHex: bodyHex,
      tagHex
    };

    const macKey = await this.getMacKey(messageKey);
    const envelopeString = JSON.stringify(envelope);
    const hmacBuffer = await subtle.sign('HMAC', macKey, new TextEncoder().encode(envelopeString));
    const hmacHex = Array.from(new Uint8Array(hmacBuffer)).map(b => b.toString(16).padStart(2, '0')).join('');
    envelope.hmacHex = hmacHex;

    return \`ratchet:v2:\${JSON.stringify(envelope)}\`;`;

code = code.replace(encryptBodyHexOld, encryptBodyHexNew);

// 4. Update decryptDirectMessage
const decryptAuthOld = `    // Decrypt message
    try {
      const ivMatches = envelopeData.ivHex.match(/.{1,2}/g) || [];`;

const decryptAuthNew = `    // Verify HMAC prior to AES-GCM decryption
    if (envelopeData.hmacHex) {
      const macKey = await this.getMacKey(messageKey);
      const envelopeForMac = {
        header: envelopeData.header,
        ivHex: envelopeData.ivHex,
        ciphertextHex: envelopeData.ciphertextHex,
        tagHex: envelopeData.tagHex
      };
      const envelopeString = JSON.stringify(envelopeForMac);
      const hmacBuffer = await subtle.sign('HMAC', macKey, new TextEncoder().encode(envelopeString));
      const expectedHmacHex = Array.from(new Uint8Array(hmacBuffer)).map(b => b.toString(16).padStart(2, '0')).join('');
      
      if (expectedHmacHex !== envelopeData.hmacHex) {
        console.error('[DoubleRatchet] HMAC verification failed! Ciphertext authenticity compromised.');
        return '[Decryption Error - Integrity Check Failed]';
      }
    }

    // Decrypt message
    try {
      const ivMatches = envelopeData.ivHex.match(/.{1,2}/g) || [];`;

code = code.replace(decryptAuthOld, decryptAuthNew);

fs.writeFileSync(file, code);
console.log('Patched');
