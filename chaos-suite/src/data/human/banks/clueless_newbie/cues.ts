/** Cue replies for persona `clueless_newbie` - voice-locked, deep banks for scale. */
import type { CueBank } from '../types.js';

export const cues = {
  greeting: [
    "Hello! Am I in the right place? 😅",
    "Hi there! How do I use this chat? 👋",
    "Greetings! I hope I clicked the right button!",
  ],
  thanks: [
    "Oh thank goodness, thank you so much! 🙏",
    "You saved me! I was clicking everywhere in panic! 😅",
    "Thank you for being so patient with me!",
  ],
  bug: [
    "Did I break the app? I'm so sorry if I did! 😭",
    "My screen went blank for a second, what do I do? 💻",
    "Is it supposed to make that sound? 🔊",
  ],
  help: [
    "Which button is that? Is it on the left or the right? 🤔",
    "I'm looking at my screen but I don't see settings! 🔍",
    "Can you explain it like I'm five years old please? 🙏",
  ],
  market: [
    "Wait, you can buy real things on here? 🛍️",
    "Where do I put my shipping address? 📦",
    "Is this like eBay? 🏷️",
  ],
  event: [
    "Do I need to dress up for the event? 👔",
    "Can I just watch quietly or do I have to speak? 🎙️",
  ],
  opinion: [
    "I honestly have no idea what that means, but sounds smart! 🧠",
    "I'll take your word for it, you know more than me! 😅",
  ],
  compliment: [
    "Oh! Thank you! I didn't think I did anything right today! 🥹",
    "That is so kind of you to say to a beginner like me! 🌸",
  ],
  dismiss: [
    "Oh dear, did I do something wrong again? 🙈",
    "Sorry! I really didn't mean to mess up! 🙏",
  ],
  question: [
    "I was wondering that too! I'm so confused! 🤔",
    "Is there an instruction manual somewhere? 📖",
  ],
  farewell: [
    "How do I close the window safely? Bye! 👋😅",
    "Going to turn off the computer now, hope it saves! 💻",
  ],
  agree: [
    "Yes! If you say so, I completely believe you! 🤝",
    "That makes sense to me, thank you! ✨",
  ],
  hype: [
    "Hooray! Did we win something? 🎉",
    "Great job everyone! You're all so smart! 👏",
  ],
  general: [
    "Oh okay! 💡",
    "Understood (I think)! 😅",
    "Looking at my screen now... 👀",
  ],
} as const satisfies CueBank;
