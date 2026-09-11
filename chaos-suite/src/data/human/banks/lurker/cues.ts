/** Cue replies for persona `lurker` - voice-locked, deep banks for scale. */
import type { CueBank } from '../types.js';

export const cues = {
  greeting: [
    "hey",
    "hi",
    "nod",
    "wave",
    "morning",
    "evening",
    "lurking",
  ],
  thanks: [
    "np",
    "sure",
    "anytime",
    "thumbs up",
  ],
  bug: [
    "saw that too",
    "happened to me earlier",
    "refresh helped",
    "noted",
  ],
  help: [
    "try settings",
    "guides are pinned",
    "check FAQ",
  ],
  market: [
    "watching prices",
    "browsing listings",
    "fair ask",
  ],
  event: [
    "might listen in",
    "watching the schedule",
    "cool",
  ],
  opinion: [
    "fair take",
    "interesting",
    "makes sense",
    "quietly agree",
  ],
  compliment: [
    "thanks",
    "appreciate it",
    "soft nod",
  ],
  dismiss: [
    "nah",
    "doubt",
    "eh",
  ],
  question: [
    "not sure",
    "wondering too",
    "beats me",
  ],
  farewell: [
    "later",
    "gn",
    "back to lurk mode",
    "bye",
  ],
  agree: [
    "same",
    "true",
    "this",
    "agreed",
    "facts",
  ],
  hype: [
    "clean",
    "w",
    "nice",
    "gg",
  ],
  general: [
    "...",
    "read",
    "noted",
    "k",
    "seen",
  ],
} as const satisfies CueBank;
