/** Cue replies for persona `heavy_texter` - voice-locked, deep banks for scale. */
import type { CueBank } from '../types.js';

export const cues = {
  greeting: [
    "Good day to you; I hope your schedule is treating you well today and that you are enjoying the lively exchanges currently taking place in the lounge.",
    "Hello and welcome; I was just reviewing the backlog of earlier messages and it is truly delightful to see another thoughtful participant join our channel.",
  ],
  thanks: [
    "You are most graciously welcome; it is always an absolute pleasure to contribute meaningful context and assistance whenever the opportunity presents itself.",
    "Please do not mention it; I firmly believe that mutual cooperation and thorough communication are what make any shared community experience truly enriching.",
  ],
  bug: [
    "That is an exceptionally intriguing anomaly; when you analyze the behavioral symptoms you described, it strongly suggests a state synchronization breakdown occurring between the client-side optimistic cache and the backend event bus.",
    "I have observed a similar technical irregularity under high-load conditions, and it would be very beneficial if you could document the exact sequence of user actions leading up to the failure state so the developers can reproduce it accurately.",
  ],
  help: [
    "Allow me to outline the procedure in comprehensive detail so that you can navigate through the entire workflow without encountering any ambiguity or frustration.",
    "The most reliable way to address that dilemma is to systematically proceed through your configuration parameters, verifying each value against the official documentation before committing changes.",
  ],
  market: [
    "When evaluating marketplace listings of this nature, it is prudent to analyze not merely the nominal asking price, but also the historical transaction volume, seller settlement ratios, and prevailing market spreads across comparable items.",
    "The escrow infrastructure is specifically engineered to insulate both trading counterparties from counterparty default risk, making adherence to the established protocol an essential prerequisite for any sound transaction.",
  ],
  event: [
    "I have meticulously documented the scheduled commencement time in my calendar, and I am genuinely anticipating the comprehensive discussions that will inevitably unfold throughout the convocation.",
    "An event of this magnitude provides an exceptional forum for cross-pollinating ideas and establishing coherent alignment across various community initiatives.",
  ],
  opinion: [
    "That is a remarkably nuanced perspective, and while I can certainly appreciate the underlying rationale behind your assertion, I believe there are several secondary variables that merit deeper consideration before reaching a definitive conclusion.",
    "Your thesis presents a compelling narrative that effectively bridges several disparate viewpoints, and I find myself largely in agreement with the foundational principles you have articulated.",
  ],
  compliment: [
    "Your generous commendation is received with profound appreciation, and it is genuinely gratifying to know that my contributions have provided tangible value and clarity to your perspective.",
    "Thank you sincerely for your kind words; fostering thorough and intellectual discourse is an objective I hold in the highest regard.",
  ],
  dismiss: [
    "Upon rigorous examination of the empirical evidence currently available to us, I must respectfully suggest that the premise you have advanced is fundamentally inconsistent with observable reality.",
    "While I acknowledge the conviction with which you hold that viewpoint, the analytical foundation supporting that position appears somewhat fragile upon closer inspection.",
  ],
  question: [
    "That inquiry touches upon a deeply consequential subject matter that requires a careful, multi-dimensional analysis before a satisfactory answer can be formulated.",
    "To address your inquiry adequately, we must first establish clear definitions for the foundational terms and constraints governing the problem domain.",
  ],
  farewell: [
    "I must now respectfully take my leave to attend to several pressing deliverables, but I look forward with great enthusiasm to resuming our intellectual discourse at the next convenient opportunity.",
    "Wishing you all an intellectually stimulating and productive remainder of your day; until we converse again, farewell.",
  ],
  agree: [
    "I find myself in complete and unequivocal alignment with the principles you have laid out, as they mirror the exact conclusions drawn from extensive observation and analysis.",
    "That synthesis encapsulates the core issue with remarkable fidelity, and I wholeheartedly endorse the trajectory you have proposed.",
  ],
  hype: [
    "This represents an extraordinary milestone of monumental significance, reflecting the tireless dedication, intellectual rigor, and relentless execution of everyone involved!",
    "A truly magnificent and exemplary accomplishment that establishes a benchmark of excellence for all future endeavors across this ecosystem!",
  ],
  general: [
    "I have thoroughly documented that statement for ongoing contemplation.",
    "The implications of that assertion are indeed far-reaching and warrant careful observation.",
    "Noted with keen intellectual interest.",
    "Understood in its comprehensive context.",
  ],
} as const satisfies CueBank;
