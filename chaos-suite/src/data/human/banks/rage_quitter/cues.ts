/** Cue replies for persona `rage_quitter` - voice-locked, deep banks for scale. */
import type { CueBank } from '../types.js';

export const cues = {
  greeting: [
    "WHAT DO YOU WANT 😤",
    "DON'T TALK TO ME I'M ALREADY TILTED 🤬",
    "HELLO AND PREPARE TO GET YELLED AT 📢",
  ],
  thanks: [
    "WHATEVER JUST DON'T BREAK IT AGAIN 🙄",
    "THANKS FOR NOTHING 😤",
    "ABOUT TIME SOMEONE DID SOMETHING USEFUL 😒",
  ],
  bug: [
    "ANOTHER GLITCH?! I AM UNINSTALLING RIGHT NOW 🗑️💥",
    "DEVS ARE SLEEPING AS USUAL FIX THIS 🤬",
    "TABLE FLIP (╯°□°)╯︵ ┻━┻",
  ],
  help: [
    "FIGURE IT OUT YOURSELF I'M BUSY RAGING 😤",
    "PRESS ALT+F4 THAT FIXES EVERYTHING 🚪",
  ],
  market: [
    "SCAM PRICES AS ALWAYS 💸🤬",
    "WHO PAYS THAT?! ABSOLUTE SCAM 🗑️",
  ],
  event: [
    "SOUNDS TERRIBLE I WILL NOT BE ATTENDING 🚪",
    "IT'S GOING TO CRASH ANYWAY WATCH 💥",
  ],
  opinion: [
    "WORST TAKE I HAVE EVER SEEN IN MY LIFE 🗑️",
    "ARE YOU BLIND?! THAT IS COMPLETELY WRONG 🤬",
  ],
  compliment: [
    "STOP BUTTERING ME UP I'M STILL MAD 😤",
    "DON'T COMPLIMENT ME WHEN THE APP IS BROKEN 🙄",
  ],
  dismiss: [
    "SHUT UP SHUT UP SHUT UP 🙉🤬",
    "YOU DON'T KNOW WHAT YOU'RE TALKING ABOUT 🤡",
    "L + UNINSTALLED 🗑️",
  ],
  question: [
    "WHY ARE YOU ASKING STUPID QUESTIONS 🤦‍♂️",
    "THE ANSWER IS IT'S BROKEN OKAY?! 💥",
  ],
  farewell: [
    "I'M OUT. NEVER RETURNING. BYE. 🚪💥",
    "SLAMS DOOR ON THE WAY OUT 🚪",
    "ALT+F4 GOODBYE FOREVER 🏃‍♂️💨",
  ],
  agree: [
    "EXACTLY!! FINALLY SOMEONE SEES HOW TRASH THIS IS 🤬",
    "THANK YOU! SOMEONE WITH EYES! 👀🔥",
  ],
  hype: [
    "WOW A SINGLE THING WORKED DO YOU WANT A MEDAL?! 🥇🙄",
    "STILL DOESN'T EXCUSE THE REST OF THIS NONSENSE 😤",
  ],
  general: [
    "ANGRY 🤬",
    "TILTED 📉",
    "UNINSTALLING 🗑️",
    "WHATEVER 🙄",
  ],
} as const satisfies CueBank;
