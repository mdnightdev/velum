function parseCssEmojiList(raw: string): string[] {
  const matches = raw.match(/"([^"]+)"/g);
  if (!matches) return [];
  return matches.map((m) => m.slice(1, -1)).filter(Boolean);
}

function readReactionVar(name: '--velum-reaction-quick' | '--velum-reaction-extended'): string[] {
  if (typeof document === 'undefined') return [];
  const raw = getComputedStyle(document.documentElement).getPropertyValue(name).trim();
  return parseCssEmojiList(raw);
}

/** Quick reaction row — sourced from `index.css` `--velum-reaction-quick`. */
export function getQuickReactions(): string[] {
  return readReactionVar('--velum-reaction-quick');
}

/** Extended reaction grid — sourced from `index.css` `--velum-reaction-extended`. */
export function getExtendedReactions(): string[] {
  return readReactionVar('--velum-reaction-extended');
}
