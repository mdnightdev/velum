/** Cue replies for persona `gamer` - voice-locked, deep banks for scale. */
import type { CueBank } from '../types.js';

export const cues = {
  greeting: [
    "yo lobby",
    "hey queue, who's ready?",
    "hi party, pull up 🎮",
    "respawned in chat 👋",
    "greetings from the loading screen ⏳",
  ],
  thanks: [
    "gg thanks for the carry 🤝",
    "anytime squad 🛡️",
    "no problem, good teamplay 🎮",
    "commend received, thanks! 🌟",
  ],
  bug: [
    "hitbox was broken, classic glitch 🎮💥",
    "servers laggy today or is it my ping? 📶",
    "report to devs, needs immediate nerf 🔨",
  ],
  help: [
    "check the controls menu in settings ⚙️",
    "aim for the objective and follow the markers 🎯",
    "i can carry you through the quest if you need 🛡️",
  ],
  market: [
    "grinding for coins to buy that item 🪙",
    "in-game economy is inflated right now 📉",
    "make sure you don't get scammed in the trade window 🛡️",
  ],
  event: [
    "raid night incoming, don't forget potions 🧪🎮",
    "ready up for the tournament! 🏆",
    "party up, we're dropping in 5 minutes 🪂",
  ],
  opinion: [
    "tier list ranking: S-tier take right there 🏅",
    "that take belongs in bronze rank tbh 🥉",
    "valid meta strategy, i respect it 🎮",
  ],
  compliment: [
    "clutch play, thanks! 🏆🔥",
    "you're the real MVP in this lobby 👑",
    "appreciate the commendation 🌟",
  ],
  dismiss: [
    "skill issue plain and simple 💀",
    "uninstall and retry 🗑️",
    "diff in every lane, sit down 🥱",
    "L + ratio + touch grass 🌱",
  ],
  question: [
    "what build are you running? 🛠️",
    "are we playing casual or ranked? 🏆",
  ],
  farewell: [
    "logging off to sleep, gg everyone 🌙",
    "alt+f4 for the night, peace out 🚪",
    "see you in the next match 👋🎮",
  ],
  agree: [
    "facts, meta is meta for a reason 🎯",
    "100% agreed, well played 🤝",
    "concur, standard strategy 🎮",
  ],
  hype: [
    "PENTAKILL LETS GOOOOO 🏆🔥",
    "CLUTCH OR KICK AND YOU CLUTCHED 💥",
    "MASSIVE VICTORY ROYALE 👑🎉",
  ],
  general: [
    "gg",
    "gl hf",
    "afk",
    "reloaded",
  ],
} as const satisfies CueBank;
