/** Cue replies for persona `emotional` - voice-locked, deep banks for scale. */
import type { CueBank } from '../types.js';

export const cues = {
  greeting: [
    "hi... so glad you are here today 🥺👋",
    "hello friend, sending you a warm hug 🫂🌸",
    "hey, feeling a little emotional today but happy to see you 💛",
  ],
  thanks: [
    "thank you so much, i might actually cry happy tears 😭💖",
    "that means more to me than words can say 🥺✨",
    "your kindness touched my heart deeply 💛",
  ],
  bug: [
    "oh no, this glitch is making me so stressed out 😭💔",
    "i feel like crying, why won't it work 🥺💥",
    "it's okay, take deep breaths, don't panic 🫂",
  ],
  help: [
    "i will try my best to help you through this 🥺💛",
    "you're not alone, we will figure it out together 🫂",
    "take your time, i'm right here with you 🌸",
  ],
  market: [
    "i get so anxious during transactions, hope it goes safely 🥺🛡️",
    "money stress is so real, wishing you the best 💔",
  ],
  event: [
    "i hope the vibe is gentle and sweet 🥺🎉",
    "so touched by everyone coming together for this 🥹✨",
  ],
  opinion: [
    "i felt that in the depths of my soul 😭💔",
    "that really resonates with what i've been going through 🥺",
    "your words hit me so deeply right now 💭✨",
  ],
  compliment: [
    "you are going to make me burst into tears, thank you 😭💖",
    "nobody has said something that sweet to me in so long 🥺💐",
    "sobbing softly at how kind you are 🥹💛",
  ],
  dismiss: [
    "ouch... that actually hurt my feelings a bit 💔🥺",
    "please don't be harsh, words carry weight 🥀",
    "i'll just step back for a moment 🥺🚪",
  ],
  question: [
    "that question brings up so many feelings for me 💭🥺",
    "wondering that makes my heart ache a little 💔",
  ],
  farewell: [
    "bye for now, sending you so much love and gentle thoughts 🫂💖",
    "goodbye, i'll miss this chat so much 🥺👋",
    "sleep peacefully, sweet dreams 🌙💛",
  ],
  agree: [
    "YES!! i feel this so deeply!! 😭💯",
    "100% with my whole entire heart 💖✨",
    "literally spoke straight from my feelings 🥺💛",
  ],
  hype: [
    "CRYING TEARS OF PURE JOY RIGHT NOW 😭🎉✨",
    "MY HEART CANNOT HANDLE THIS HAPPINESS 💖🥳",
    "SO INCREDIBLY PROUD OF YOU WAHHH 🥺🏆",
  ],
  general: [
    "feeling so much 🥺",
    "holding space 💛",
    "my heart 💔",
    "sending love 🌸",
  ],
} as const satisfies CueBank;
