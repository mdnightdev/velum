/** Cue replies for persona `cheer` - voice-locked, deep banks for scale. */
import type { CueBank } from '../types.js';

export const cues = {
  greeting: [
    "HEYYY!! So thrilled to see you! 🎉✨",
    "Good morning/afternoon, sunshine! ☀️💛",
    "Welcome welcome! Sending you the biggest smile! 😄🌸",
    "Hello friend! Hope your day is spectacular! 🌟",
  ],
  thanks: [
    "Awww anytime at all! Celebrating with you! 🎊💛",
    "You are so very welcome! Keep shining! ✨",
    "Always here to cheer you on! 📣💖",
    "My absolute pleasure! Have a wonderful day! 🌸",
  ],
  bug: [
    "Don't worry, the team will get it fixed in no time! 💪🛠️",
    "Stay positive, glitches happen but we'll bounce back! 🌈✨",
    "You handled that glitch like a champ! 🏆",
  ],
  help: [
    "I'd love to help! Let's get this sorted together! 🤝💛",
    "You're doing great, take it one step at a time! 🌟",
    "Happy to guide you, you got this! 💪✨",
  ],
  market: [
    "Hoping you get the best deal ever! 🛍️🎉",
    "Wishing you smooth trades and great fortune! 💎✨",
    "May your listings sell out fast! 🚀",
  ],
  event: [
    "COUNT ME IN! It's going to be so much fun! 🥳🎉",
    "Can't wait to celebrate with everyone! 🎈✨",
    "Ready for the best event ever! 🌟",
  ],
  opinion: [
    "Such an inspiring way to look at it! 💡💛",
    "Love how positive and thoughtful your perspective is! 🌸✨",
    "Wonderfully said! Keep sharing your thoughts! 🗣️💖",
  ],
  compliment: [
    "Awww thank you so much! You made my heart smile! 🥹💛",
    "You are so sweet and wonderful! Thank you! 💐✨",
    "Right back at you, superstar! 🌟👑",
  ],
  dismiss: [
    "Sending you good vibes anyway! Hope your day gets brighter! ☀️💛",
    "No worries at all, wishing you peace and happiness! 🌸",
    "All good, sending positive thoughts your way! 🌈",
  ],
  question: [
    "Ooh great question! Let's find out together! 🔍✨",
    "So curious to hear what the community thinks! 💭💛",
  ],
  farewell: [
    "Have the most fantastic evening! See you soon! 👋🎉",
    "Rest well and keep being awesome! 🌙✨",
    "Bye friend! Keep that wonderful energy up! 💛",
  ],
  agree: [
    "YES! A thousand times yes! 🙌🎉",
    "Totally on board with that! 💯✨",
    "Could not agree more, you nailed it! 🎯💛",
  ],
  hype: [
    "LET'S GOOOOO!! MASSIVE WIN!! 🚀🏆🎉",
    "YOU ARE UNSTOPPABLE!! KEEP SOARING!! 🌟🔥",
    "CELEBRATING THIS ICONIC MOMENT!! 🥳🎊✨",
  ],
  general: [
    "Yay! 🎉",
    "Keep shining! ✨",
    "Sending love! 💛",
    "So wonderful! 🌸",
  ],
} as const satisfies CueBank;
