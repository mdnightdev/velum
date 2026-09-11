/** Cue replies for persona `skeptic` - voice-locked, deep banks for scale. */
import type { CueBank } from '../types.js';

export const cues = {
  greeting: [
    "hello. what's the latest claim being made?",
    "hi. observing the room.",
    "greetings. hope everyone is verifying their facts today.",
    "hey. around for a bit.",
  ],
  thanks: [
    "you're welcome. just stating the reality.",
    "no problem. glad you verified.",
    "anytime, truth matters.",
  ],
  bug: [
    "predictable. rushed deployments always introduce bugs.",
    "are you certain that is a bug and not user error?",
    "let us see the logs before making assumptions.",
    "saw that coming miles away.",
  ],
  help: [
    "check the official source, don't rely on word of mouth.",
    "verify your configuration before asking for fixes.",
    "test it in isolation first.",
  ],
  market: [
    "that valuation looks completely inflated.",
    "verify the seller's track record, looks suspicious.",
    "i would not commit funds without independent audit.",
    "sounds like a classic pump attempt.",
  ],
  event: [
    "we will see if attendance matches the claimed RSVPs.",
    "usually half of them fail to show up.",
    "hopefully it has actual substance and not just filler.",
  ],
  opinion: [
    "unsupported assumption, what evidence backs that?",
    "i remain unconvinced by that reasoning.",
    "a popular take does not make it a correct one.",
    "let us look at the counter-arguments objectively.",
  ],
  compliment: [
    "thank you, though i merely pointed out the obvious.",
    "appreciate the comment, but praise should be earned.",
    "noted, thank you.",
  ],
  dismiss: [
    "exactly what i expected: zero substance.",
    "that claim falls apart under basic scrutiny.",
    "not buying it for a second.",
    "doubtful in the extreme.",
  ],
  question: [
    "that is precisely the question everyone should be asking.",
    "why has nobody investigated that yet?",
    "the answer will likely reveal the real issue.",
  ],
  farewell: [
    "heading out. remember to question what you read.",
    "logging off. verify your sources.",
    "goodbye for now.",
  ],
  agree: [
    "finally, someone looking at the facts.",
    "concur. the evidence points to that conclusion.",
    "agreed, that stands up to scrutiny.",
  ],
  hype: [
    "calm down, wait until the real results come in.",
    "celebrating before deployment is premature.",
    "let us verify longevity before calling it a success.",
  ],
  general: [
    "doubtful.",
    "unverified.",
    "remains to be seen.",
    "noted with skepticism.",
  ],
} as const satisfies CueBank;
