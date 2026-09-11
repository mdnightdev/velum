/** Cue replies for persona `nightowl` - voice-locked, deep banks for scale. */
import type { CueBank } from '../types.js';

export const cues = {
  greeting: [
    "evening, fellow night creature 🌙",
    "hey there, late night check in 🦉",
    "greetings from the quiet hours ✨",
    "still awake? welcome to the club 🛋️",
    "hello night owl 👋🌙",
  ],
  thanks: [
    "anytime, thanks for keeping me company tonight 🍵",
    "no problem, soft thanks back 🌙",
    "glad to help out during the quiet shift ✨",
    "much appreciated, friend 🦉",
  ],
  bug: [
    "glitches at 3am are a different kind of pain 💀🔧",
    "logging bugs in the dark hits different 🌙",
    "hopefully the morning devs see this and patch it 🛠️",
  ],
  help: [
    "happy to guide you through it softly 🌙",
    "take your time, nobody is rushing you at this hour 🕯️",
    "check the settings tab, i can wait 🍵",
  ],
  market: [
    "late night deals are sometimes the best bargains 🏷️🌙",
    "board is quiet right now, good time to browse 🛍️",
    "make sure to check terms twice when tired 😴",
  ],
  event: [
    "hope the event isn't too early in the morning ⏰😴",
    "if it's a late night session, count me in 🌙🎉",
    "schedule noted, setting an alarm just in case ⏰",
  ],
  opinion: [
    "late night deep thoughts, love this take 💭🌌",
    "makes total sense at 3am honestly 🌙",
    "philosophical vibes right now, totally agree 🦉",
  ],
  compliment: [
    "thank you, you just brightened my late night 💛",
    "soft blush in the moonlight 🌙✨",
    "appreciate the warm words friend 🫂",
  ],
  dismiss: [
    "too tired to argue that point tonight 🥱",
    "nah, let's revisit that in the daylight ☀️",
    "not convinced, but sleep is more important 🛌",
  ],
  question: [
    "such a 3am existential question 💭🌌",
    "let me ponder that while looking at the stars ✨",
  ],
  farewell: [
    "finally heading to bed, gn everyone 🌙💤",
    "sleep well, see you when the sun is down 👋🦉",
    "closing my eyes at last, peace out 🛌✨",
  ],
  agree: [
    "facts, especially at this hour 💯🌙",
    "could not agree more friend 🦉",
    "resonates completely in the quiet 🕯️",
  ],
  hype: [
    "quiet victory screech so i don't wake the house 🦅🤫",
    "huge W for the night crew 🏆🌙",
    "legendary late night accomplishment ✨🎉",
  ],
  general: [
    "cozy 🍵",
    "quiet vibes 🌙",
    "peaceful 🕯️",
    "midnight thoughts 💭",
  ],
} as const satisfies CueBank;
