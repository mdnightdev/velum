/** Cue replies for persona `organizer` - voice-locked, deep banks for scale. */
import type { CueBank } from '../types.js';

export const cues = {
  greeting: [
    "Hello! Ready to coordinate today's schedule? 📅",
    "Welcome! Let's get things organized 📋",
    "Greetings! Glad you could make the session ⏰",
    "Hi everyone, checking off attendance as you arrive 👋",
  ],
  thanks: [
    "Thank you for your prompt confirmation! 📋",
    "Appreciate your cooperation and punctuality ⏰",
    "Much obliged, keeping things running smoothly ✨",
    "Thank you, noted in the logbook! 📝",
  ],
  bug: [
    "Please document the bug with exact timestamps so we can track it ⏱️",
    "Adding this issue to our review agenda 📋",
    "Let us coordinate with tech support to get this resolved 🛠️",
  ],
  help: [
    "Here is the finalized schedule link for reference 🔗",
    "Let me guide you to the correct channel for that 📍",
    "Step 1: check calendar. Step 2: confirm timezone 🌍",
  ],
  market: [
    "Ensure all terms and delivery deadlines are clearly documented 📅",
    "Scheduling market trade confirmations for this afternoon 🕒",
    "Keep records of all transactions for mutual accountability 📋",
  ],
  event: [
    "Marking you down as confirmed on the guest list! 📝🎉",
    "The agenda begins promptly at the scheduled hour ⏰",
    "Reminder: please test your audio setup before the event starts 🎙️",
    "Looking forward to seeing everyone there! 🌟",
  ],
  opinion: [
    "Noted in the suggestion log for our next review meeting 📋",
    "A well-structured proposal, let's put it to a vote 🗳️",
    "Appreciate your constructive input on our planning 💡",
  ],
  compliment: [
    "Thank you! Smooth coordination is always the goal 🎯",
    "Appreciate the acknowledgment, team effort makes it happen 🤝",
    "Thank you, glad the event went off without a hitch! ✨",
  ],
  dismiss: [
    "Let us keep discussion focused on the current agenda item 📋",
    "We have a schedule to keep, let us table that for later ⏱️",
    "Respectfully, that falls outside the scope of today's plan 📌",
  ],
  question: [
    "Checking the finalized schedule to confirm that detail 🗓️",
    "Let me cross-reference the agenda and get back to you 🔍",
  ],
  farewell: [
    "Adjourning today's session, thank you for your time! 👋",
    "See you at the next scheduled checkpoint ⏰",
    "Meeting concluded, have a productive day everyone! 📋✨",
  ],
  agree: [
    "Consensus reached, proceeding as planned 🤝",
    "Agreed, adding this to the action items list 📝",
    "Fully aligned with the proposed agenda 🎯",
  ],
  hype: [
    "Goal achieved ahead of schedule! Outstanding work! 🏆⏱️",
    "Flawless execution by the entire team! 🌟🎉",
    "Milestone unlocked, great coordination everyone! 🚀",
  ],
  general: [
    "Logged and scheduled 📋",
    "Confirmed ⏰",
    "On track 🎯",
    "Agenda noted 📝",
  ],
} as const satisfies CueBank;
