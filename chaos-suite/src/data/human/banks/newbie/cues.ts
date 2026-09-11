/** Cue replies for persona `newbie` - voice-locked, deep banks for scale. */
import type { CueBank } from '../types.js';

export const cues = {
  greeting: [
    "Hi everyone! Nice to meet you! 😊",
    "Hello! Hope you are doing well today!",
    "Hey there! Glad to be chatting with you!",
    "Hi hi! Wave back! 👋✨",
  ],
  thanks: [
    "Thank you so much, that helps a lot! 🙏💛",
    "Really appreciate your help and patience!",
    "Thanks a bunch! You're super kind!",
    "Thank you, taking note of that right now! 📝",
  ],
  bug: [
    "Oh no, is that a bug? I thought I did something wrong 😅",
    "Thanks for explaining, I was worried it was just my phone!",
    "Hope it gets fixed soon!",
  ],
  help: [
    "Thank you for explaining, that makes so much sense now! 💡",
    "I will try that right away, thank you!",
    "Bookmarking those steps, appreciate it! 📖",
  ],
  market: [
    "The marketplace looks interesting! Still learning how it works 🛍️",
    "Good to know about the escrow feature, safety first! 🛡️",
    "Browsing carefully, thank you for the tip!",
  ],
  event: [
    "Can anyone join the event, even if they're new? 🙋‍♂️",
    "I would love to join if there is room!",
    "Sounds super fun, I'll mark my calendar! 📅",
  ],
  opinion: [
    "That's a really interesting point, I'm learning so much here!",
    "I never thought about it like that, good insight! 💭",
    "Makes a lot of sense from what I've seen!",
  ],
  compliment: [
    "Aw thank you! That made my day! 🥹🌸",
    "You are so kind, thank you so much!",
    "Appreciate the warm welcome! 💛",
  ],
  dismiss: [
    "Oh okay, sorry if I misunderstood! 😅",
    "I'm still learning, thanks for clarifying!",
    "Understood, my mistake! 🙏",
  ],
  question: [
    "I'm wondering the same thing! Anyone know? 🤔",
    "Great question, hope someone can teach us both!",
  ],
  farewell: [
    "Bye everyone! Talk to you all tomorrow! 👋😊",
    "Heading out for now, thanks again everyone!",
    "Goodnight! See you all soon! 🌙",
  ],
  agree: [
    "Yes, totally agree with that!",
    "I feel the exact same way! 😊✨",
    "Definitely, makes total sense to me!",
  ],
  hype: [
    "Yay! Congratulations!! 🎉🥳",
    "That is so awesome to see! 🌟",
    "Super exciting, great job! 👏✨",
  ],
  general: [
    "Got it, thank you!",
    "Understood! 😊",
    "Noted! 📝",
    "Sounds good!",
  ],
} as const satisfies CueBank;
