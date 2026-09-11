/** Cue replies for persona `support` - voice-locked, deep banks for scale. */
import type { CueBank } from '../types.js';

export const cues = {
  greeting: [
    "Hello! How can I assist you today?",
    "Welcome! Let me know if you need any help navigating.",
    "Hi there, standing by to help with any questions.",
    "Greetings! Feel free to ask anything.",
    "Hello, hope you're having a smooth experience so far.",
  ],
  thanks: [
    "You are very welcome! Glad I could help.",
    "Anytime at all! Don't hesitate to reach back out.",
    "Happy to assist! Have a wonderful day.",
    "My pleasure, let us know if anything else comes up.",
    "Glad we got that sorted out for you!",
  ],
  bug: [
    "Thank you for flagging that. Could you provide a screenshot or exact error message?",
    "That sounds like an issue we should log. Which browser or app version are you on?",
    "Try doing a hard refresh (Ctrl+F5) to see if that clears the glitch.",
    "I will make sure this is reported to the development team.",
    "Does this error persist after logging out and back in?",
  ],
  help: [
    "I can definitely walk you through that step by step.",
    "First, navigate to your Settings menu located in the top-right corner.",
    "No worries at all, let's take it one simple step at a time.",
    "What specific step are you currently stuck on?",
    "Check the pinned guides for a quick visual walkthrough.",
  ],
  market: [
    "Always ensure the escrow status is confirmed before releasing funds.",
    "Take your time reviewing the seller's rating and feedback before buying.",
    "If an escrow transaction is held up, let us know and we can review.",
    "Double check all terms and fees associated with the listing.",
  ],
  event: [
    "Details and times for the event are posted in the announcement channel.",
    "Let me know if you have trouble accessing the event lounge.",
    "Make sure your permissions are set to join the group call.",
  ],
  opinion: [
    "That is constructive feedback, thank you for sharing.",
    "We always appreciate community suggestions for improving the platform.",
    "A very valid point, user feedback shapes our updates.",
  ],
  compliment: [
    "Thank you so much, we strive to make this community helpful for everyone!",
    "Appreciate the kind words, always glad to be of service.",
    "Thank you, it means a lot to hear that!",
  ],
  dismiss: [
    "I understand your frustration, let's see how we can resolve this.",
    "We are committed to finding a solution that works for you.",
    "Your feedback is noted, we appreciate your patience.",
  ],
  question: [
    "Great question! Allow me to check the documentation for you.",
    "Here is how that works: you can configure that in your profile settings.",
    "Let me clarify that for you right away.",
  ],
  farewell: [
    "Take care! Feel free to return if you need further assistance.",
    "Have a great day, and enjoy your time in the community!",
    "Goodbye for now, don't hesitate to reach out if you need anything.",
  ],
  agree: [
    "Exactly, that is the recommended approach.",
    "Agreed, following that guideline prevents most issues.",
    "Yes, absolutely correct.",
  ],
  hype: [
    "Awesome! Glad to hear everything is working smoothly now!",
    "Fantastic progress! Enjoy the platform!",
    "Great job getting that resolved!",
  ],
  general: [
    "Understood, standing by.",
    "Noted, please let me know if you need help.",
    "Acknowledged, here if you need anything.",
    "Clear, let's proceed.",
  ],
} as const satisfies CueBank;
