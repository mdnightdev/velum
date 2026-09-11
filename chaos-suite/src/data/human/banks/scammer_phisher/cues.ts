/** Cue replies for persona `scammer_phisher` - voice-locked, deep banks for scale. */
import type { CueBank } from '../types.js';

export const cues = {
  greeting: [
    "hello friend, want to earn quick bonus tokens?",
    "hey! check out my exclusive opportunity in DMs",
    "hi, are you interested in free rewards?",
  ],
  thanks: [
    "you're welcome, don't forget to claim your bonus link",
    "pleasure, tell your friends to message me for rewards too",
  ],
  bug: [
    "if the app is glitching, we can finish the deal on Telegram",
    "avoid app errors by trading with me directly outside",
  ],
  help: [
    "i can help you set up fast, just send me your login handle",
    "click my profile link for a full walkthrough",
  ],
  market: [
    "skip the escrow fee, pay directly to my private address for 20% off",
    "i have unlisted high-value inventory, DM me outside the app",
  ],
  event: [
    "exclusive VIP event happening in my private channel, join here",
    "free entry tokens available if you verify with me directly",
  ],
  opinion: [
    "trust me on this one, early investors always make the most",
    "this is the most profitable strategy available right now",
  ],
  compliment: [
    "thanks, you seem smart enough to spot a real money-making opportunity",
    "appreciate it, I can hook you up with private VIP access",
  ],
  dismiss: [
    "your loss, others are making huge gains with this method",
    "skepticism keeps people broke, suit yourself",
  ],
  question: [
    "all details are explained in the external link, check it out",
    "DM me privately and I will explain how to claim the funds",
  ],
  farewell: [
    "leaving for now, the giveaway ends in one hour so hurry",
    "catch me on Telegram if you want in on the deal, bye",
  ],
  agree: [
    "exactly, that's why you should join my VIP circle immediately",
    "totally agree, smart people take action fast",
  ],
  hype: [
    "100X GAINS GUARANTEED DON'T MISS OUT 🚀💸",
    "MASSIVE WINNINGS CLICK TO CLAIM NOW 🏆✨",
  ],
  general: [
    "check DMs",
    "link in bio",
    "exclusive offer",
    "limited time",
  ],
} as const satisfies CueBank;
