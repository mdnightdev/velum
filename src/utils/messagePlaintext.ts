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
 * Sidebar/list label: known plaintext only. Empty while still opaque — never a fake "Message" label.
 * Never triggers decrypt and never surfaces ciphertext.
 */
export function getSidebarPreviewLabel(msg: {
  plaintext?: string | null;
  client_plaintext?: string | null;
  content?: string | null;
  message?: string | null;
  body?: string | null;
  text?: string | null;
  is_encrypted?: boolean | null;
  isEncrypted?: boolean | null;
} | null | undefined): string {
  return getMessagePreviewPlaintext(msg);
}

/**
 * Notification body: usable plaintext / clear unencrypted text only.
 * Encrypted or unknown → empty (caller should omit body or wait for decrypt stamp).
 * Never decrypt here.
 */
export function getNotificationBodyText(input: {
  plaintext?: string | null;
  content?: string | null;
  isEncrypted?: boolean | null;
} | string | null | undefined): string {
  if (input == null) return '';
  const rejectOpaque = (value: string): boolean =>
    isPoisonPlaintext(value) || /e2ee:|VEL_E2EE\[|ratchet:v/i.test(value);

  if (typeof input === 'string') {
    if (!input.trim() || rejectOpaque(input)) return '';
    return input;
  }
  if (isUsablePlaintext(input.plaintext) && !rejectOpaque(String(input.plaintext))) {
    return String(input.plaintext);
  }
  const raw = input.content || '';
  if (!raw || input.isEncrypted || rejectOpaque(raw)) return '';
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
