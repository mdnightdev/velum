/** Cue replies for persona `creative` - voice-locked, deep banks for scale. */
import type { CueBank } from '../types.js';

export const cues = {
  greeting: [
    "hello creative soul 🎨✨",
    "welcome in! love your vibe 🌸",
    "hey there, hope you're feeling inspired today 💡",
    "hi hi! good to see your face in here ✨",
    "greetings! ready to create something awesome? 🖌️",
  ],
  thanks: [
    "so glad it resonated with your aesthetic 💖",
    "anytime! always happy to share ideas 🎨",
    "thank you for taking the time to look! ✨",
    "means a lot coming from you 💛",
    "my pleasure entirely! 🌸",
  ],
  bug: [
    "the visual alignment glitch is hurting my designer soul 😭📐",
    "looks like an aspect ratio mismatch on rendering 🖥️",
    "hope the visual layout gets patched soon 🎨🔧",
  ],
  help: [
    "try adjusting the canvas grid in preferences 📐",
    "i can help you pick the right palette if you want! 🎨",
    "start with a simple wireframe first, super helpful ✏️",
  ],
  market: [
    "that art asset is worth way more than the asking price 💎",
    "love the visual branding on that listing 🛍️✨",
    "quality craftsmanship always commands a fair price 🎨🏷️",
  ],
  event: [
    "so excited for the showcase! will be bringing my sketches 🎨",
    "can't wait to see everyone's designs during the event ✨",
    "the visual presentation for this meetup looks stunning 🌟",
  ],
  opinion: [
    "from a compositional standpoint, i completely agree 📐",
    "such an evocative perspective, love how you framed that 💭✨",
    "a bold artistic choice, it really stands out 🎨",
    "i love how unique your style is 🌟",
  ],
  compliment: [
    "thank you so much! poured my heart into that piece 🥹💖",
    "your feedback inspires me to keep creating 🎨✨",
    "means the world to hear that from you! 🌸",
  ],
  dismiss: [
    "art is subjective, we all see different things in it 🖼️",
    "i appreciate the critique, but sticking with my vision 🎨",
    "to each their own aesthetic taste 🌿",
  ],
  question: [
    "what medium or tool did you use for that? 🎨🤔",
    "curious about the creative process behind this 💭✨",
  ],
  farewell: [
    "heading back to my sketchpad, see you later! ✏️👋",
    "time to render out some ideas, catch you all soon 🎨",
    "goodnight, may your dreams be full of colors 🌙🎨✨",
  ],
  agree: [
    "the aesthetic harmony is undeniable ✨",
    "yes! totally captured the intended vibe 🎯🎨",
    "100% aligned with that artistic vision 💛",
  ],
  hype: [
    "A MASTERPIECE HONESTLY 🏆🎨✨",
    "the colors, the detail, the sheer talent! 🌟🔥",
    "absolutely breathtaking work! 👏💖",
  ],
  general: [
    "vibes 🌸✨",
    "so aesthetic 🌿",
    "inspired 💡",
    "beautiful composition 📐",
  ],
} as const satisfies CueBank;
