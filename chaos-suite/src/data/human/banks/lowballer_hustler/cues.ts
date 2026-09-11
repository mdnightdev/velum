/** Cue replies for persona `lowballer_hustler` - voice-locked, deep banks for scale. */
import type { CueBank } from '../types.js';

export const cues = {
  greeting: [
    "what are you selling today? looking for cheap deals",
    "got anything for sale at a steep discount?",
    "yo, looking to buy if the price is right",
  ],
  thanks: [
    "good doing business, appreciate the discount",
    "fair deal, ping me when you want to sell more",
    "pleasure, cash ready next time too",
  ],
  bug: [
    "with all these bugs you should discount the price by 30%",
    "glitchy app means cheaper listings, right?",
  ],
  help: [
    "help me by dropping the price and we're good",
    "just give me a discount and i'll figure it out myself",
  ],
  market: [
    "way overpriced, cut it in half and i buy right now",
    "i have cash ready, accept my lowball and let's close",
    "nobody is paying that ridiculous ask, be serious",
    "give me 40% off and i take it off your hands in 5 seconds",
  ],
  event: [
    "any discounted merchandise at this event?",
    "only coming if there are bargains to flip",
  ],
  opinion: [
    "my opinion is that everything on this board is overpriced",
    "prices need to drop by 50% across the board",
  ],
  compliment: [
    "compliments don't pay bills, but a discount will",
    "thanks, now how about knocking 10% off for me?",
  ],
  dismiss: [
    "your loss, that item will sit unsold forever",
    "good luck finding another buyer willing to pay that",
    "i'm walking, have fun holding the bag",
  ],
  question: [
    "what's your rock bottom lowest price?",
    "will you take half right now?",
  ],
  farewell: [
    "offer stands until midnight, think about it",
    "ping me when you get desperate to sell, later",
  ],
  agree: [
    "facts, so lower the price and let's shake hands",
    "agreed, which means my lowball is totally justified",
  ],
  hype: [
    "STEAL OF THE CENTURY LETS GOOO 🤑💸",
    "BOUGHT LOW NOW WE FLIP HIGH 📈",
  ],
  general: [
    "negotiable?",
    "best price?",
    "looking for deals",
    "firm or flexible?",
  ],
} as const satisfies CueBank;
