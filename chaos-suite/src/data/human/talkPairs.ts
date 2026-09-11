/**
 * Who talks to whom: same-kind pairs.
 * Openers come from each persona's message bank — no hand-written seed strings.
 */

import type { PersonaId } from './personas.js';
import { pickMessage } from './banks/index.js';

export interface TalkPairSpec {
  persona: PersonaId;
  topic: string;
}

/** Pair order for talk smokes — personas must exist in `banks/<id>/`. */
export const TALK_PAIR_SPECS: readonly TalkPairSpec[] = [
  { persona: 'social', topic: 'hangout' },
  { persona: 'flirty', topic: 'banter' },
  { persona: 'tech', topic: 'bugs' },
  { persona: 'sarcastic', topic: 'dry takes' },
  { persona: 'gamer', topic: 'lobby' },
  { persona: 'chaotic', topic: 'chaos' },
  { persona: 'supportive', topic: 'check-ins' },
  { persona: 'market', topic: 'trades' },
  { persona: 'drama', topic: 'takes' },
  { persona: 'emoji_addict', topic: 'vibes' },
];

export function personaListFromPairs(pairCount: number = TALK_PAIR_SPECS.length): PersonaId[] {
  const out: PersonaId[] = [];
  const n = Math.min(pairCount, TALK_PAIR_SPECS.length);
  for (let i = 0; i < n; i++) {
    out.push(TALK_PAIR_SPECS[i].persona, TALK_PAIR_SPECS[i].persona);
  }
  return out;
}

/** Opener from the persona message bank only. */
export function pickSeed(spec: TalkPairSpec, avoid: ReadonlySet<string> = new Set()): string {
  return pickMessage(spec.persona, avoid);
}
