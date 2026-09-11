/**
 * Shared cue detection only - reply text lives in each persona's cues.ts.
 */

export type CueId =
  | 'greeting'
  | 'thanks'
  | 'bug'
  | 'help'
  | 'market'
  | 'event'
  | 'opinion'
  | 'compliment'
  | 'dismiss'
  | 'question'
  | 'farewell'
  | 'agree'
  | 'hype'
  | 'general';

const CUE_PATTERNS: Array<{ cue: CueId; re: RegExp }> = [
  {
    cue: 'compliment',
    re: /\b(cute|beautiful|handsome|pretty|love that|you rock|nice work|proud of|damn you)\b/i,
  },
  {
    cue: 'dismiss',
    re: /\b(cap|mid|nah|pass|doubt|not convinced|whatever|lie|nuh uh|skill issue)\b/i,
  },
  {
    cue: 'thanks',
    re: /\b(thanks|thank you|appreciate|thx|ty)\b/i,
  },
  {
    cue: 'bug',
    re: /\b(bug|glitch|flicker|broken|error|crash|lag|stuck|reproduc|ui issue)\b/i,
  },
  {
    cue: 'help',
    re: /\b(help|how do i|where do i|stuck on|need a hand|point me|how does|what is a|lost|confused|settings)\b/i,
  },
  {
    cue: 'market',
    re: /\b(listing|market|seller|buy|price|deal|escrow|lowball|offer|comps|board|budget)\b/i,
  },
  {
    cue: 'event',
    re: /\b(event|meetup|schedule|live chat|this week|rsvp|hang|lobby|queue|party up)\b/i,
  },
  {
    cue: 'hype',
    re: /\b(hype|fire|lets go|let's go|gg|clutch|lfg|spotlight|lets gooo)\b/i,
  },
  {
    cue: 'opinion',
    re: /\b(think|opinion|hot take|prefer|anyone else|unpopular|rate this|vibe|mood|snack|coffee|tea|weather)\b/i,
  },
  {
    cue: 'agree',
    re: /\b(same|agreed|true|facts|exactly|fr\b|real\b|bet\b)\b/i,
  },
  {
    cue: 'farewell',
    re: /\b(bye|goodbye|later|signing off|afk|brb|good night|gn|heading out)\b/i,
  },
  {
    cue: 'greeting',
    re: /\b(hey|hi|hello|yo|yoh|morning|evening|who is around|hopped in|checking in|say hi|wave|pull up|what's up|whats up|sup)\b/i,
  },
  {
    cue: 'question',
    re: /\?/,
  },
];

/** Lines that do not carry a thread - next speaker should open a real topic. */
const DEAD_FILLER =
  /^(makes sense|got it|interesting|noted|alright|cool|hmm|okay|ok|k|sure|yeah|eh|fair|true|same|yep|real|mood|lol|maybe|depends|not sure|fair take|i wonder too|let me think|good question|mid but fun|anyone know\?|ask again clearer\?|hi hi|hello hello|hey hey!?|glad you said hi|not buying it|say more|i can see that|hot take received|this|y|m|…|\.\.\.)$/i;

const SHORT_PING =
  /^(hey|hi|hello|yo|sup|hey hey|hi hi|true|same|facts|agreed|exactly|yep|real|bet|gg|w|fire|hype|cap|nah|mid)[!.,\s]*$/i;

export function isDeadFiller(text: string): boolean {
  return DEAD_FILLER.test((text || '').trim());
}

export function detectCue(text: string): CueId {
  const t = (text || '').trim();
  if (!t) return 'general';
  for (const row of CUE_PATTERNS) {
    if (row.re.test(t)) return row.cue;
  }
  return 'general';
}

/**
 * Which cue bank to answer with.
 * Real openers keep their cue (greeting stays greeting).
 * Only empty pings get rotated so the thread does not stall.
 */
export function resolveReplyCue(text: string): CueId {
  const t = text.trim();
  if (!t) return 'greeting';

  if (SHORT_PING.test(t) || isDeadFiller(t)) {
    const roll = Math.random();
    if (roll < 0.3) return 'opinion';
    if (roll < 0.55) return 'question';
    if (roll < 0.75) return 'compliment';
    if (roll < 0.9) return 'hype';
    return 'dismiss';
  }

  const cue = detectCue(t);
  if (cue !== 'general') return cue;

  if (/\b(who|what|where|when|why|how|anyone|looking|need|miss|should)\b/i.test(t)) {
    return 'question';
  }
  return 'opinion';
}

export const CUE_IDS: readonly CueId[] = [
  'greeting',
  'thanks',
  'bug',
  'help',
  'market',
  'event',
  'opinion',
  'compliment',
  'dismiss',
  'question',
  'farewell',
  'agree',
  'hype',
  'general',
];
