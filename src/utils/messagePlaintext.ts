/** Sentinel strings that must never be persisted or displayed as message plaintext. */
const PLAINTEXT_POISON = new Set([
  '[Encrypted Message]',
  '[Decryption Error]',
  '[Encrypted Message - No Room]',
  '[Legacy Encrypted Message]',
]);

export function isPoisonPlaintext(value: string | null | undefined): boolean {
  if (value == null || value === '') return true;
  const t = String(value).trim();
  if (PLAINTEXT_POISON.has(t)) return true;
  if (t.startsWith('[Legacy Encrypted Message]')) return true;
  if (t.startsWith('e2ee:') || t.startsWith('ratchet:v') || t.startsWith('VEL_E2EE[')) return true;
  return false;
}

/** True when value is usable display plaintext for a message body. */
export function isUsablePlaintext(value: string | null | undefined): boolean {
  return !!value && !isPoisonPlaintext(value);
}

/** Prefer stored plaintext; allow clear unencrypted body; never envelopes/ciphertext. */
export function getMessagePreviewPlaintext(msg: {
  plaintext?: string | null;
  client_plaintext?: string | null;
  content?: string | null;
  message?: string | null;
  body?: string | null;
  text?: string | null;
  is_encrypted?: boolean | null;
  isEncrypted?: boolean | null;
} | null | undefined): string {
  if (!msg) return '';
  if (isUsablePlaintext(msg.plaintext)) return String(msg.plaintext);
  if (isUsablePlaintext(msg.client_plaintext)) return String(msg.client_plaintext);
  const raw = msg.content || msg.message || msg.body || msg.text || '';
  if (!raw) return '';
  if (msg.is_encrypted || msg.isEncrypted || isPoisonPlaintext(raw)) return '';
  return String(raw);
}

/**
 * Prefer existing device plaintext over incoming. Never let poison overwrite real text.
 */
export function mergeMessagePlaintext(
  existing: string | null | undefined,
  incoming: string | null | undefined
): string | undefined {
  if (isUsablePlaintext(existing)) return existing as string;
  if (isUsablePlaintext(incoming)) return incoming as string;
  return undefined;
}
