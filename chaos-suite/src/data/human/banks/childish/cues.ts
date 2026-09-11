/** Cue replies for persona `childish` - voice-locked, deep banks for scale. */
import type { CueBank } from '../types.js';

export const cues = {
  greeting: [
    "HIIIIIIIIIIII 👋😄",
    "LOOK AT ME I'M HERE 🙋‍♂️✨",
    "YAY YOU'RE HERE LETS PLAY 🎮🎉",
    "HELLO HELLO HELLO 👋👋👋",
  ],
  thanks: [
    "THANK YOOOOOU!! 🍭💖",
    "YAY YAY YAY!! 🎉",
    "You're the bestest ever! 🌟",
  ],
  bug: [
    "WAHHH IT BROKE FIX IT FIX IT 😭💥",
    "The app is being mean to me! 🥺",
    "Pout! Everything is glitchy! 😾",
  ],
  help: [
    "Show me show me show me! 🤩",
    "Help me pweaseee 🥺👉👈",
    "Press the big shiny button right? 🔴",
  ],
  market: [
    "I WANNA BUY ALL THE CANDY 🍬🍭",
    "Gimme that shiny thing!! 💎✨",
    "Too expensive! Not fair! 😤💸",
  ],
  event: [
    "PARTY TIME BRING BALLOONS 🎈🥳",
    "CAN WE PLAY GAMES AT THE EVENT?! 🎲",
    "I'M COMING I'M COMING ZOOM 🏃‍♂️💨",
  ],
  opinion: [
    "NUH UH MY WAY IS BETTER 😝",
    "That is silly! 🤪",
    "Chocolate is the best flavor forever and ever 🍫",
  ],
  compliment: [
    "YAY I AM THE COOLEST KID EVER 🦸‍♂️✨",
    "Hehehe thank you!! 🙈💖",
    "Tell me again! Tell me again! 🤩",
  ],
  dismiss: [
    "LALALA CAN'T HEAR YOU 🙉",
    "Nuh uh! You're wrong! 😝",
    "Whatever! You're a stinky head! 🦨",
  ],
  question: [
    "BUT WHYYYYYYYY? 🤔",
    "Can we find out right now right now? ⏰",
  ],
  farewell: [
    "BYE BYE GONNA GO PLAY NOW 👋🏃‍♂️",
    "Bedtime noooo! Nighty night 🛌💤",
    "See you tomorrow alligator! 🐊",
  ],
  agree: [
    "YES YES TOTALLY! 🥳",
    "I said that first! 😝",
    "High five! ✋✨",
  ],
  hype: [
    "YAYAYAYAYAY WE WON!! 🏆🎉",
    "HOORAY FOR EVERYBODY!! 🥳🎈",
    "BOOM SHAKALAKA!! 💥",
  ],
  general: [
    "Wheeee! 🎢",
    "Giggle! 🤭",
    "Boop! 👃",
    "Yay! 🎉",
  ],
} as const satisfies CueBank;
