/**
 * Conversation cues: classify last message → pick a matching reply bank.
 * No em dashes. Expandable.
 */

export type CueId =
  | 'greeting'
  | 'bug'
  | 'help'
  | 'market'
  | 'event'
  | 'opinion'
  | 'thanks'
  | 'general';

const CUE_PATTERNS: Array<{ cue: CueId; re: RegExp }> = [
  {
    cue: 'greeting',
    re: /\b(hey|hi|hello|morning|evening|who is around|hopped in|checking in)\b/i,
  },
  {
    cue: 'bug',
    re: /\b(bug|glitch|flicker|broken|error|crash|lag|stuck|reproduc|ui issue)\b/i,
  },
  {
    cue: 'help',
    re: /\b(help|how do i|where do i|stuck on|need a hand|point me|settings|login question)\b/i,
  },
  {
    cue: 'market',
    re: /\b(listing|market|seller|buy|price|deal|escrow|hold)\b/i,
  },
  {
    cue: 'event',
    re: /\b(event|meetup|schedule|live chat|this week|announce)\b/i,
  },
  {
    cue: 'opinion',
    re: /\b(think|opinion|hot take|prefer|coffee or|recommend|anyone else)\b/i,
  },
  {
    cue: 'thanks',
    re: /\b(thanks|thank you|appreciate|helpful|that helped)\b/i,
  },
];

const SEEDS: Record<Exclude<CueId, 'general'>, readonly string[]> = {
  greeting: [
    'Hey everyone, who is around?',
    'Morning. Just hopped in.',
    'Hello. Checking in for a bit.',
  ],
  bug: [
    'Seeing a small glitch on refresh. Anyone else?',
    'Messages flicker order for a second then settle.',
    'Not urgent, just logging a UI bug I saw.',
  ],
  help: [
    'Need a hand with account settings.',
    'Where do I change my profile picture?',
    'Can someone point me to the right help path?',
  ],
  market: [
    'Anyone see good listings today?',
    'Curious what people are buying lately.',
    'Market feels quieter than last week.',
  ],
  event: [
    'Any events coming up this week?',
    'Is there a live chat schedule posted?',
    'When is the next lounge event?',
  ],
  opinion: [
    'Random: coffee or tea today?',
    'Drop a harmless hot take.',
    'What do you think about quieter notifications?',
  ],
  thanks: [
    'Thanks, that helped a lot.',
    'Appreciate the quick tip earlier.',
    'Thank you for pointing me in the right direction.',
  ],
};

const REPLIES: Record<CueId, readonly string[]> = {
  greeting: [
    'Hey, I am here.',
    'Hello. Good to see you.',
    'Hi. Just landed too.',
    'Morning. How is it going?',
  ],
  bug: [
    'I saw something similar once.',
    'Can you still reproduce it?',
    'Worth a short note in bugs.',
    'Same flicker for me earlier.',
  ],
  help: [
    'Try settings then profile.',
    'I can walk through it with you.',
    'Usually under account settings.',
    'Happy to help if you say which step.',
  ],
  market: [
    'I browsed a bit this morning.',
    'Prices look mixed today.',
    'I am watching a few sellers.',
    'Quiet board for me too.',
  ],
  event: [
    'I am watching for the next one.',
    'Hope they post details soon.',
    'I would join if the time works.',
    'Same, I want the schedule.',
  ],
  opinion: [
    'Coffee for me.',
    'Fair take.',
    'I am with you on that.',
    'Interesting angle.',
  ],
  thanks: [
    'Anytime.',
    'Glad it helped.',
    'No problem.',
    'Happy to help.',
  ],
  general: [
    'Makes sense.',
    'Got it.',
    'Interesting.',
    'Same here.',
    'Noted.',
  ],
};

function pick<T>(list: readonly T[]): T {
  return list[Math.floor(Math.random() * list.length)];
}

export function detectCue(text: string): CueId {
  const t = (text || '').trim();
  if (!t) return 'general';
  for (const row of CUE_PATTERNS) {
    if (row.re.test(t)) return row.cue;
  }
  return 'general';
}

export function seedForCue(cue: Exclude<CueId, 'general'>): string {
  return pick(SEEDS[cue]);
}

export function replyForCue(cue: CueId): string {
  return pick(REPLIES[cue] || REPLIES.general);
}

/** Seed cues we actively test in the cues gate (excludes general). */
export const TEST_CUES: ReadonlyArray<Exclude<CueId, 'general'>> = [
  'greeting',
  'bug',
  'help',
  'market',
  'event',
  'opinion',
  'thanks',
];

export function cueReplyFromLast(lastOther: string): { cue: CueId; text: string } {
  const cue = detectCue(lastOther);
  return { cue, text: replyForCue(cue) };
}
