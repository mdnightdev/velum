/** Cue replies for persona `chat_spammer` - voice-locked, deep banks for scale. */
import type { CueBank } from '../types.js';

export const cues = {
  greeting: ["yo yo yo yo", "hi hi hi hi", "hey hey hey hey", "ping pong"],
  thanks: ["thx thx thx", "np np np np", "ty ty ty ty"],
  bug: ["lag lag lag", "broken broken", "glitch glitch glitch"],
  help: ["help help help", "fast fast fast", "read read read"],
  market: ["buy buy buy", "sell sell sell", "deal deal deal"],
  event: ["party party party", "hype hype hype", "go go go"],
  opinion: ["fast take fast take", "yep yep yep", "nah nah nah"],
  compliment: ["ty ty ty", "w w w w", "fire fire fire"],
  dismiss: ["no no no no", "cap cap cap", "skip skip skip"],
  question: ["what what what", "why why why", "who who who"],
  farewell: ["bye bye bye bye", "cya cya cya", "out out out"],
  agree: ["yes yes yes yes", "true true true", "facts facts facts"],
  hype: ["LETS GO LETS GO LETS GO", "W W W W W", "HYPE HYPE HYPE"],
  general: ["ping", "pong", "burst", "speed"],
} as const satisfies CueBank;
