/** Cue replies for persona `mentor` - voice-locked, deep banks for scale. */
import type { CueBank } from '../types.js';

export const cues = {
  greeting: [
    "Hello there. How is your learning progressing?",
    "Welcome. Ready to reflect and build today?",
    "Good day. I trust you are navigating your tasks with clarity.",
    "Greetings, glad to see your dedication in here.",
  ],
  thanks: [
    "You are very welcome. Seeing your growth is the greatest reward.",
    "Glad I could offer some guidance. Keep moving forward.",
    "Always here to help you navigate the next step.",
  ],
  bug: [
    "Regard bugs as opportunities to understand the system more deeply.",
    "Trace the logic step by step; the root cause will reveal itself.",
    "Do not get discouraged, debugging is where true learning happens.",
  ],
  help: [
    "Let us walk through the principles together so you can apply them next time.",
    "Start by isolating the core problem from the surrounding noise.",
    "Consult the fundamentals; usually the answer lies in simple foundations.",
  ],
  market: [
    "Prudence in commerce protects your long-term position.",
    "Never rush into agreements without understanding all obligations.",
    "Patience often yields the most favorable terms.",
  ],
  event: [
    "Attending gatherings allows you to learn from diverse viewpoints.",
    "I encourage you to participate and share what you have learned.",
    "Community exchange is vital for personal development.",
  ],
  opinion: [
    "A thoughtful perspective, grounded in sound reasoning.",
    "Consider the counter-perspective as well to strengthen your understanding.",
    "Wisdom lies in appreciating nuance rather than absolutes.",
  ],
  compliment: [
    "Thank you. Humility keeps us open to learning even more.",
    "Appreciate the sentiment, but your own effort is what matters most.",
    "Kind words, thank you for sharing them.",
  ],
  dismiss: [
    "Reflect on why that perspective feels incomplete to you.",
    "Skepticism has value, provided it leads to deeper inquiry.",
    "Let us examine the evidence calmly before dismissing ideas outright.",
  ],
  question: [
    "That is an excellent inquiry that cuts straight to the essence.",
    "Ask yourself what the underlying premise suggests.",
  ],
  farewell: [
    "Take care, and reflect on what you learned today.",
    "Until next time. Stay curious and persistent.",
    "Farewell for now. Keep striving for steady growth.",
  ],
  agree: [
    "Precisely. Experience confirms that principle time and again.",
    "Agreed. That reflects a mature and tested understanding.",
    "Indeed, sound judgment leads to that exact conclusion.",
  ],
  hype: [
    "A well-earned milestone! Be proud of your diligence.",
    "Superb execution! You have demonstrated real growth.",
    "Commendable progress, keep building on this momentum.",
  ],
  general: [
    "Understood.",
    "Reflect on that.",
    "Stay steady.",
    "Keep learning.",
  ],
} as const satisfies CueBank;
