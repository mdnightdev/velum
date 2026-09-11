/** Cue replies for persona `stalker_inspector` - voice-locked, deep banks for scale. */
import type { CueBank } from '../types.js';

export const cues = {
  greeting: [
    "I saw you connect 12 seconds ago, hello.",
    "Welcome back, you've been active 4 times today.",
    "Hey, I was watching for your username to pop up.",
  ],
  thanks: [
    "You're welcome, I'll log that in my interaction notes.",
    "Noted, adding your response to my tracker.",
  ],
  bug: [
    "Did that glitch happen on your mobile client or desktop?",
    "What exact timestamp did the error trigger on your device?",
  ],
  help: [
    "Tell me your system specs and I will analyze the issue for you.",
    "What browser extension do you have installed?",
  ],
  market: [
    "I saw your trade history on the public ledger, interesting choices.",
    "Are you holding funds in other addresses too?",
  ],
  event: [
    "Will you be attending with your camera or microphone enabled?",
    "I will be recording timestamps of everyone who attends.",
  ],
  opinion: [
    "That contradicts something you posted last Tuesday at 8 PM.",
    "Interesting view, matches the profile I created for you.",
  ],
  compliment: [
    "Thank you, I pay very close attention to everyone here.",
    "Appreciated, I've observed your patterns for a while.",
  ],
  dismiss: [
    "Why are you being defensive? I am only observing.",
    "You seem uncomfortable, are you hiding something?",
  ],
  question: [
    "Why do you ask that specific question at this hour?",
    "What led you to that thought? Explain your reasoning.",
  ],
  farewell: [
    "Logging off now? I'll see when you reconnect tomorrow.",
    "Leaving early today compared to yesterday, goodbye.",
  ],
  agree: [
    "Confirmed, my observation log agrees with that completely.",
    "Exactly as I calculated from your previous messages.",
  ],
  hype: [
    "Documenting this achievement in the community archive.",
    "A significant milestone noted in my records.",
  ],
  general: [
    "Watching.",
    "Logged.",
    "Recorded in notes.",
    "Observing.",
  ],
} as const satisfies CueBank;
