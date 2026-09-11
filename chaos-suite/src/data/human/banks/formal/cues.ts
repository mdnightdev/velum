/** Cue replies for persona `formal` - voice-locked, deep banks for scale. */
import type { CueBank } from '../types.js';

export const cues = {
  greeting: [
    "Greetings and salutations.",
    "A pleasant day to you.",
    "Good day. I trust you are well.",
    "Welcome to our assembly.",
    "I extend my warmest regards upon your arrival.",
    "It is an honor to share this assembly with you.",
    "May your presence bring enlightenment to our circle.",
  ],
  thanks: [
    "You have my sincere gratitude.",
    "I am most obliged.",
    "It is my distinct pleasure.",
    "Pray accept my thanks.",
    "I remain deeply indebted to your graciousness.",
    "Your generosity does not go unacknowledged.",
  ],
  bug: [
    "An irregularity has manifested; it merits diligent examination.",
    "Such technical anomalies necessitate formal reporting.",
    "Let us document the occurrence with precision.",
    "A disruption in the system requires methodical investigation.",
    "I trust the overseers shall rectify this defect in due course.",
  ],
  help: [
    "I shall gladly endeavor to assist your endeavor.",
    "Allow me to delineate the necessary steps.",
    "Consultation of the instructions is advisable.",
    "Permit me to offer guidance on this intricate procedure.",
    "One finds that systematic progression unravels all difficulty.",
  ],
  market: [
    "Prudence dictates careful appraisal of the terms.",
    "One must ensure integrity before concluding an agreement.",
    "Fiscal temperance is ever commendable.",
    "Let honor and transparency govern all commerce undertaken here.",
    "Equitable exchange remains the bedrock of honorable trading.",
  ],
  event: [
    "I have recorded the scheduled hour.",
    "May the gathering prove both edifying and orderly.",
    "I anticipate the convocation with interest.",
    "I shall endeavor to present myself at the appointed time.",
  ],
  opinion: [
    "An intriguing contemplation, eloquently proposed.",
    "I hold a slightly differing perspective, yet respect yours.",
    "A balanced deliberation is worthy of praise.",
    "Your thesis presents substantial merit for contemplation.",
    "Let us weigh the philosophical implications with measured care.",
  ],
  compliment: [
    "Your kind sentiment honors me greatly.",
    "I am humbled by your generous regard.",
    "Such courtesy reflects exceedingly well upon you.",
    "Your gracious commendation is received with profound esteem.",
  ],
  dismiss: [
    "I find myself unpersuaded by that premise.",
    "Regrettably, that assertion lacks substantiated weight.",
    "I must dissent from that view.",
    "Reason compels me to decline that interpretation.",
  ],
  question: [
    "That inquiry deserves thoughtful reflection.",
    "Let us seek a definitive answer in due course.",
    "A profound query that warrants deliberate examination.",
  ],
  farewell: [
    "I bid you all a courteous farewell.",
    "Until we converse once again, adieu.",
    "May the remainder of your day be fruitful.",
    "I take my humble leave, wishing you peace and prosperity.",
  ],
  agree: [
    "Indeed, our sentiments are in harmony.",
    "I concur without reservation.",
    "That aligns precisely with my estimation.",
    "Our conclusions are in mutual accord.",
  ],
  hype: [
    "A truly magnificent accomplishment.",
    "Splendid endeavor, worthy of high acclaim.",
    "Bravo on such distinguished success.",
    "A triumph of dedication and refinement.",
  ],
  general: [
    "Understood.",
    "Indeed.",
    "Quite so.",
    "Acknowledged.",
    "Precisely.",
    "I take note.",
  ],
} as const satisfies CueBank;
