/** Cue replies for persona `mature` - voice-locked, deep banks for scale. */
import type { CueBank } from '../types.js';

export const cues = {
  greeting: [
    "Good day. I hope you are having a peaceful afternoon.",
    "Hello. It is pleasant to see you in the channel.",
    "Greetings. I trust all is going smoothly on your end.",
  ],
  thanks: [
    "You are very welcome. It was my pleasure.",
    "Thank you kindly. Mutual courtesy is always valued.",
    "Much obliged for your polite note.",
  ],
  bug: [
    "Technical disruptions require calm and methodical reporting.",
    "I have observed this irregularity as well; patience will see it addressed.",
    "Let us document the occurrence clearly for the team.",
  ],
  help: [
    "I would be glad to assist if you share what you need.",
    "Let us take this step by step to ensure nothing is missed.",
    "Reviewing the documentation usually clarifies matters effectively.",
  ],
  market: [
    "Prudent financial decisions are based on careful assessment.",
    "Verify the terms thoroughly before committing your resources.",
    "A measured approach to trading preserves capital and peace of mind.",
  ],
  event: [
    "I have noted the event time on my schedule.",
    "I look forward to participating in the upcoming session.",
    "May the gathering prove productive for all who attend.",
  ],
  opinion: [
    "That is a very balanced viewpoint, well expressed.",
    "I appreciate hearing a perspective delivered with such composure.",
    "A reasonable position that warrants fair consideration.",
  ],
  compliment: [
    "Thank you for your gracious words. They are warmly received.",
    "I appreciate your generous sentiment very much.",
    "Courtesy and kindness are always appreciated.",
  ],
  dismiss: [
    "I see things somewhat differently, though I respect your view.",
    "The facts suggest an alternative conclusion in this case.",
    "Let us agree to disagree respectfully.",
  ],
  question: [
    "That is a pertinent question that deserves a considered answer.",
    "Allow me to reflect on that inquiry for a moment.",
  ],
  farewell: [
    "I shall take my leave now. Have a pleasant evening.",
    "Good evening to everyone. Until our next conversation.",
    "Take good care of yourself.",
  ],
  agree: [
    "I concur fully with your reasoning.",
    "That aligns precisely with my own observations.",
    "Indeed, sound judgment supports that stance.",
  ],
  hype: [
    "A most commendable achievement. Well done.",
    "Splendid progress, worthy of genuine satisfaction.",
    "Congratulations on a thoroughly deserved outcome.",
  ],
  general: [
    "Understood.",
    "Indeed.",
    "Noted with thanks.",
    "Fair enough.",
  ],
} as const satisfies CueBank;
