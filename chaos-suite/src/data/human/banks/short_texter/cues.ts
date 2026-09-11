/** Cue replies for persona `short_texter` - voice-locked, deep banks for scale. */
import type { CueBank } from '../types.js';

export const cues = {
  greeting: ["yo", "sup", "hey", "hi"],
  thanks: ["np", "sure", "anytime", "ty"],
  bug: ["oof", "broken", "glitch", "rip"],
  help: ["settings", "faq", "idk", "reboot"],
  market: ["price?", "cheap", "nah", "deal"],
  event: ["when?", "maybe", "where?"],
  opinion: ["fair", "mid", "true", "nah"],
  compliment: ["ty", "thx", "u2"],
  dismiss: ["cap", "nah", "pass", "ratio"],
  question: ["idk", "why?", "who?"],
  farewell: ["cya", "bye", "later", "gn"],
  agree: ["fr", "same", "facts", "true"],
  hype: ["w", "lfg", "fire", "gg"],
  general: ["k", "aight", "cool", "yeah"],
} as const satisfies CueBank;
