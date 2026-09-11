/** Cue replies for persona `market` - voice-locked, deep banks for scale. */
import type { CueBank } from '../types.js';

export const cues = {
  greeting: [
    "hello, looking to buy or sell today?",
    "welcome to the marketplace channel",
    "hey there, checking the board?",
    "greetings, let me know if you have listings to share",
    "market check in, hope deals are closing smoothly",
  ],
  thanks: [
    "pleasure doing business with you",
    "much appreciated, fair trade",
    "thank you, smooth transaction",
    "glad the trade went through cleanly",
    "anytime, always open to fair deals",
  ],
  bug: [
    "escrow lock timeout? flag that immediately",
    "make sure transaction hashes match before retrying",
    "contact support if funds are stuck in pending state",
    "double check transaction logs for errors",
  ],
  help: [
    "step 1: verify seller. step 2: lock funds in escrow. step 3: confirm delivery",
    "never transact outside the platform, escrow protects both parties",
    "check the market guide pinned at the top of the channel",
    "happy to explain the escrow workflow if you are new",
  ],
  market: [
    "comps indicate that is a reasonable ask",
    "seller pricing looks competitive today",
    "watch the order book for better entry points",
    "always verify escrow confirmation before releasing",
    "board volume is healthy right now",
    "be careful with lowball bids on verified listings",
  ],
  event: [
    "will there be special trading or listings during the event?",
    "noted, market activity might surge during that window",
    "hope they feature top community listings during the showcase",
  ],
  opinion: [
    "from a market perspective, pricing dictates demand",
    "the comps support that valuation",
    "sounds like fair market value to me",
    "unrealistic price points usually lead to stalled listings",
  ],
  compliment: [
    "appreciate the positive feedback, reputable trading is key",
    "thank you, transparent deals are the highest priority",
    "much obliged, always a pleasure to deal with honest buyers",
  ],
  dismiss: [
    "that offer is far below realistic comps",
    "unreasonable ask, passing on that deal",
    "not buying at that inflated price point",
    "no deal at those terms",
  ],
  question: [
    "what are the exact terms and delivery timeframe?",
    "is the listing backed by verified escrow?",
    "let me review the historical pricing before committing",
  ],
  farewell: [
    "closing market orders for today, good trading everyone",
    "heading out, back on the board tomorrow",
    "take care, safe trading to all",
  ],
  agree: [
    "agreed, that is fair market value",
    "deal confirmed, fully aligned on terms",
    "exactly, escrow security is non-negotiable",
  ],
  hype: [
    "listing sold at ask, great deal for both sides",
    "smooth transaction completed in record time",
    "high-volume day on the board, fantastic momentum",
  ],
  general: [
    "order acknowledged",
    "monitoring board updates",
    "spread looks tight",
    "tracking transactions",
  ],
} as const satisfies CueBank;
