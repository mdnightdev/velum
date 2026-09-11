export type LiveStyle = 'butterfly' | 'lurker' | 'idle' | 'bounce' | 'mixed';

export function styleFor(persona: string, salt: number): LiveStyle {
  switch (persona) {
    case 'social':
    case 'attention':
      return 'butterfly';
    case 'casual':
      return salt % 2 === 0 ? 'idle' : 'bounce';
    case 'tech':
    case 'drama':
    case 'support':
      return 'mixed';
    default:
      return 'lurker';
  }
}

export function talkGapMs(style: LiveStyle): number {
  switch (style) {
    case 'butterfly':
      return 6000 + Math.floor(Math.random() * 9000);
    case 'mixed':
      return 12000 + Math.floor(Math.random() * 15000);
    case 'lurker':
      return 20000 + Math.floor(Math.random() * 20000);
    case 'bounce':
    case 'idle':
    default:
      return 25000 + Math.floor(Math.random() * 20000);
  }
}

export function logoutAfterMs(style: LiveStyle, windowMs: number): number | null {
  switch (style) {
    case 'bounce':
      return 25000 + Math.floor(Math.random() * 25000);
    case 'idle':
      return Math.floor(windowMs * 0.7) + Math.floor(Math.random() * 15000);
    case 'mixed':
      return Math.random() < 0.35 ? Math.floor(windowMs * 0.75) : null;
    case 'butterfly':
    case 'lurker':
    default:
      return null;
  }
}
