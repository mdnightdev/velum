/**
 * Topic-aware talk replies: answer the partner's last line, stay on pair topic.
 */

import type { PersonaId } from './personas.js';
import { isDeadFiller } from './cues/detect.js';

export type TalkIntent =
  | 'presence'
  | 'hang'
  | 'greeting'
  | 'question'
  | 'bug'
  | 'opinion'
  | 'dismiss'
  | 'agree'
  | 'hype'
  | 'general';

export interface TalkReplyContext {
  topic: string;
  persona: PersonaId;
  avoid: ReadonlySet<string>;
  pairTalks: number;
}

const THREAD_KILLERS =
  /^(ask again clearer\??|hi hi|hello hello|hey hey!?|glad you said hi|not buying it|say more|i can see that|interesting|fair take|hot take received|mid but fun|anyone know\??|good question|not sure|maybe|depends|let me think|i wonder too)$/i;

export function isThreadKiller(text: string): boolean {
  return THREAD_KILLERS.test((text || '').trim());
}

/** Strip em/en dashes from outbound chat text. */
export function stripMdash(text: string): string {
  return (text || '')
    .replace(/[—–]/g, ',')
    .replace(/\s+,/g, ',')
    .replace(/,{2,}/g, ',')
    .replace(/,\s*\./g, '.')
    .trim();
}

export function classifyTalkIntent(peer: string): TalkIntent {
  const t = (peer || '').trim();
  if (!t) return 'greeting';

  if (
    /\b(who is around|who'?s around|who else|anyone (here|around|free|on)|anyone down|looking for|is anyone)\b/i.test(
      t
    )
  ) {
    return 'presence';
  }
  if (/\b(bug|glitch|flicker|lag|repro|crash|error|ui|refresh)\b/i.test(t)) return 'bug';
  if (/\b(cap|nah|mid|doubt|not buying|pass|whatever|skill issue)\b/i.test(t)) return 'dismiss';
  if (/\b(same|agreed|true|facts|exactly|fr\b|real\b|bet\b)\b/i.test(t)) return 'agree';
  if (/\b(lfg|gg|hype|fire|lets go|let's go|clutch)\b/i.test(t)) return 'hype';
  if (/\b(hot take|hear me out|unpopular)\b/i.test(t)) return 'opinion';
  // Questions win over hang keywords so we answer instead of re-asking.
  if (/\?/.test(t)) return 'question';
  if (/\b(hang|chat|vibe|company|lobby|queue|party|round|play|chill)\b/i.test(t)) {
    return 'hang';
  }
  if (/\b(who|what|where|when|why|how|anyone)\b/i.test(t)) return 'question';
  if (/^(hey|hi|hello|yo|sup|hey hey|hi friends|morning)[!.,\s]*$/i.test(t)) return 'greeting';
  if (/\b(hey|hi|hello|yo|morning|evening)\b/i.test(t) && t.split(/\s+/).length <= 6) {
    return 'greeting';
  }
  return 'general';
}

/**
 * Concrete answers to common peer questions (Q -> A, not Q -> Q).
 */
function answerPeerQuestion(
  peer: string,
  persona: PersonaId,
  avoid: ReadonlySet<string>
): string | null {
  const t = peer.toLowerCase();
  const picks: string[] = [];

  const add = (lines: string[]) => {
    for (const line of lines) {
      const clean = stripMdash(line);
      if (!avoid.has(clean) && !isDeadFiller(clean)) picks.push(clean);
    }
  };

  if (/how is everyone|who is around|who'?s around|anyone (here|around|free)/i.test(t)) {
    add([
      'I am here and free for a light hang.',
      'Present. Soft chat sounds good if you are in.',
      'Right here. Happy to keep you company.',
    ]);
  }
  if (/mood|vibe (for you|today)|kind of mood/i.test(t)) {
    add([
      'Chill mood on my side. Soft hang.',
      'Pretty easygoing tonight. You?',
      'Low-key and friendly. That works for me.',
    ]);
  }
  if (/weekend|surviving the week|week\?/i.test(t)) {
    add([
      'Surviving the week, soft weekend plans only.',
      'Week was fine. Weekend is still open.',
      'Mostly recovering from the week. Nothing wild planned.',
    ]);
  }
  if (/snack/i.test(t)) {
    add([
      'Chips and tea if I am honest.',
      'Something salty. Classic.',
      'Whatever is closest. No judgment zone.',
    ]);
  }
  if (/how is your day|day going/i.test(t)) {
    add([
      'Pretty decent so far. Quiet but good.',
      'Solid day. Glad to land in a friendly corner.',
      'Not bad at all. Better with company.',
    ]);
  }
  if (/what are you up to|up to\?/i.test(t)) {
    add([
      'Just parked here for a light chat.',
      'Nothing heavy. Looking for easy company.',
      'Killing a few minutes with friendly noise.',
    ]);
  }
  if (/music|silence/i.test(t)) {
    add([
      'Low music on my side.',
      'Silence here, so chat is welcome.',
      'Soft playlist. Keeps the mood easy.',
    ]);
  }
  if (/pulled you in|what pulled/i.test(t)) {
    add([
      'Needed friendly noise more than anything.',
      'Saw the room and wanted a soft hang.',
      'Just felt like saying hi to someone real.',
    ]);
  }
  if (/fun happening|anything fun/i.test(t)) {
    add([
      'Nothing wild, just glad for company.',
      'Quiet night, so this chat is the fun.',
      'Not much on my end. Open to whatever light.',
    ]);
  }
  if (/you\?|you sticking|jumping in|free for|hang .*you/i.test(t)) {
    add([
      'Yeah I can stay a bit.',
      'I am in. Soft hang works.',
      'Count me in for a short one.',
    ]);
  }
  if (/playing lately|main right now|duo vibe|on tonight/i.test(t)) {
    add([
      'Casual only for me tonight.',
      'Mostly chill, no ranked stress.',
      'Just lobby energy and talk.',
    ]);
  }
  if (/mobile or desktop|still seeing|repro|refresh help/i.test(t)) {
    add([
      'Desktop on my side, settled after a refresh.',
      'Mobile once, then it cleared.',
      'Could not hard-repro after reconnect.',
    ]);
  }
  if (/mornings are optional|agree or nah|hot take|sharper version/i.test(t)) {
    add([
      'I allow that take. Soft agree.',
      'Mid but fun. I am with you.',
      'Nah lightly, but I respect the bit.',
    ]);
  }

  // Persona flavor: prefer shorter for gamer, precise for tech
  if (!picks.length) {
    if (persona === 'tech') {
      add(['On my side it looks fine now. Any other detail?']);
    } else if (persona === 'gamer') {
      add(['Casual for me. I am down to keep talking.']);
    } else if (persona === 'drama') {
      add(['I hear you. Give me the next beat.']);
    } else {
      add([
        'For me, just a chill hang. Happy to keep going.',
        'Honest answer: I am here for easy company.',
      ]);
    }
  }

  if (!picks.length) return null;
  return picks[Math.floor(Math.random() * picks.length)];
}

type MovePool = Record<TalkIntent, readonly string[]>;

const SOCIAL_MOVES: MovePool = {
  presence: [
    "I'm here, free for a light hang if you are.",
    'Right here. Want to just vibe a minute?',
    'Present. Soft chat sounds good to me.',
    "I'm around. What are you up to?",
    'Yep, parked in this corner. How is everyone treating you?',
    'I showed up for people, not noise. You sticking around?',
  ],
  hang: [
    'Yeah I can hang for a bit. How is your day going?',
    'Down to chat. Anything fun happening on your end?',
    'I am in. Tell me something small and good.',
    'Soft hang works. Coffee-chat energy without the coffee.',
    'I can stay. Weekend plans or just surviving the week?',
    'Happy to keep this going. Snack of choice right now?',
    'I am sticky in the lounge today. What pulled you in?',
    "Let's make this corner less quiet. Tiny win from today?",
    'Company mode on. Music on your side or silence?',
    'I will match your energy. Start soft if you want.',
  ],
  greeting: [
    'Hey, glad you showed up. How is the vibe for you?',
    'Hi back. Who else should we pull into this corner?',
    'Hey hey. I am sticking around if you want company.',
    'Hello. Easy mode: what did you do today?',
  ],
  question: [
    'For me, just dropping in to say hi and stay a minute.',
    'I am free for a short hang. You?',
    'Still figuring the room out, but I am here for people first.',
    'Honest answer: looking for a chill thread, not noise.',
    'Mostly checking who is friendly tonight. You count.',
    'I came for light chat. What kind of mood are you in?',
  ],
  bug: [
    'Ugh that sounds annoying. Did a refresh help at all?',
    'I have not hit that yet. Which screen was it on?',
    'Worth noting. Was it mobile or desktop for you?',
  ],
  opinion: [
    'I can ride with that. What pushed you to say it?',
    'Fair. I land a little softer, but I get the point.',
    'Okay I hear you. Give me the short version why.',
    'That tracks for me. Want to unpack it one more beat?',
  ],
  dismiss: [
    'Ha okay, push back noted. What would you prefer instead?',
    'Alright, not sold. What would convince you?',
    'We can leave that take. Want a lighter topic?',
  ],
  agree: [
    'Same page. Want to keep going on that or switch soft?',
    'Yes, that tracks. Anything else on your mind?',
    'Agreed. Tell me the next piece.',
  ],
  hype: ['Love that energy. Keep it going.', 'Yes, that pep talk landed.'],
  general: [
    'Okay, I am with you. What is the next thought?',
    'That makes room for more. Keep going.',
    'Listening. Give me one more detail.',
    'Got you. Want to keep this hang going?',
  ],
};

const GAMER_MOVES: MovePool = {
  presence: [
    'I am on. Casual only. You jumping in?',
    'Lobby energy from me. Anyone else queue-curious?',
    'Here. No ranked stress, just chill.',
  ],
  hang: [
    'Down for a chill round vibe even if we just talk.',
    'Yeah party up in spirit. What are you playing lately?',
    'Soft queue in the lounge works for me.',
  ],
  greeting: [
    'Yo, lobby is open in spirit. You on tonight?',
    'Hey. Casual mode. What is your main right now?',
  ],
  question: [
    'Casual for me tonight. You looking for a duo vibe or just chat?',
    'I am down to hang in hub world. You?',
  ],
  bug: [
    'That lag sounds cursed. Did reconnect fix it?',
    'I saw flicker once then it settled. Same for you?',
  ],
  opinion: [
    'Respect. I rate that take mid-high.',
    'Okay hot take received. I almost agree.',
  ],
  dismiss: [
    'Skill issue on the take maybe, joke. What is your real pick?',
    'Cap lightly noted. Sell me a better one.',
  ],
  agree: [
    'Facts. Want one more round of that thought?',
    'Same. Ping me if you want to keep going.',
  ],
  hype: ['LFG. That energy is clutch.', 'GG on the vibe, keep sending.'],
  general: [
    'Copy that. Keep the lobby talk going.',
    'I am still in queue for this chat.',
  ],
};

const TECH_MOVES: MovePool = {
  presence: [
    'Here, mostly poking at small UI notes if anyone cares.',
    'Online. Happy to compare notes on weird client behavior.',
  ],
  hang: [
    'I can hang and file soft observations while we chat.',
    'Down to talk product nits if you have any.',
  ],
  greeting: [
    'Hey. Anything odd on your build tonight?',
    'Hi, logging in with eyeballs on refresh flicker.',
  ],
  question: [
    'On my side it settles after a second. You still seeing it?',
    'I can try to repro if you give the short steps.',
  ],
  bug: [
    'Same class of issue for me earlier. Mobile or desktop?',
    'Refresh helped once. Did yours stick after reconnect?',
    'Worth a note. Empty state or mid-thread when it hit?',
  ],
  opinion: [
    'Reasonable. I would bias toward clearer empty-state copy.',
    'I land nearby. Denser mute options would help too.',
  ],
  dismiss: [
    'Fair skepticism. What would you measure instead?',
    'Okay, not convinced either. Need a cleaner repro.',
  ],
  agree: [
    'Agreed. Want to keep comparing notes?',
    'Same observation bucket. Any other edge cases?',
  ],
  hype: ['Nice catch energy. Keep the notes coming.', 'Yes, useful signal.'],
  general: [
    'Following. Add one detail and I will match.',
    'Still listening. More context helps.',
  ],
};

const DRAMA_MOVES: MovePool = {
  presence: [
    'I am here and mildly ready for a soft hot take.',
    'Present. Someone start a harmless argument.',
  ],
  hang: [
    'I will hang if the takes stay fun.',
    'Soft drama only. Drop something spicy-light.',
  ],
  greeting: [
    'Hey. This chat has main character energy today.',
    'Hi, I brought commentary, not chaos. Mostly.',
  ],
  question: [
    'My answer: mornings are optional. Fight me softly.',
    'I think the room is too polite. Agree or nah?',
  ],
  bug: [
    'Even the bugs have plot. Did it happen twice?',
    'Glitch arc noted. Still more fun than silence.',
  ],
  opinion: [
    'Okay but hear me out. I almost agree.',
    'I allow that take. Give me the sequel.',
    'Mid but fun. What is the sharper version?',
  ],
  dismiss: [
    'Cap with love. Sell a better take.',
    'Nahhh, try again with more seasoning.',
  ],
  agree: [
    'Facts. Keep going before the vibe cools.',
    'Exactly. Do not leave me hanging on the next beat.',
  ],
  hype: ['Fire. That landed.', 'Yes, that energy.'],
  general: [
    'I am entertained. Continue.',
    'Plot thickens if you add one more line.',
  ],
};

const MOVES_BY_PERSONA: Partial<Record<PersonaId, MovePool>> = {
  social: SOCIAL_MOVES,
  casual: SOCIAL_MOVES,
  cheer: SOCIAL_MOVES,
  gamer: GAMER_MOVES,
  tech: TECH_MOVES,
  drama: DRAMA_MOVES,
};

function pickFromPool(pool: readonly string[], avoid: ReadonlySet<string>): string | null {
  const clean = pool
    .map(stripMdash)
    .filter(
      (l) => !avoid.has(l) && !isDeadFiller(l) && !isThreadKiller(l) && l.trim().split(/\s+/).length >= 3
    );
  if (!clean.length) return null;
  return clean[Math.floor(Math.random() * clean.length)];
}

/**
 * Produce a reply that answers `peer` and stays near `ctx.topic`.
 */
export function pickCoherentReply(
  peer: string,
  ctx: TalkReplyContext
): { tag: string; text: string; intent: TalkIntent } {
  const intent = classifyTalkIntent(peer);
  const moves = MOVES_BY_PERSONA[ctx.persona] || SOCIAL_MOVES;

  // Direct Q -> A before any more questions.
  if (intent === 'question' || /\?/.test(peer)) {
    const answered = answerPeerQuestion(peer, ctx.persona, ctx.avoid);
    if (answered) {
      return { tag: 'reply:answer', text: answered, intent: 'question' };
    }
  }

  let moveIntent = intent;
  if (ctx.pairTalks >= 2 && intent === 'greeting') moveIntent = 'hang';
  if (ctx.pairTalks >= 3 && intent === 'presence') moveIntent = 'hang';
  if (intent === 'general' && ctx.pairTalks >= 2) moveIntent = 'hang';

  // After answering a few beats, ask at most one follow-up from hang pool.
  const fromMoves = pickFromPool(moves[moveIntent] || moves.general, ctx.avoid);
  if (fromMoves) {
    return { tag: `reply:${moveIntent}`, text: fromMoves, intent: moveIntent };
  }

  for (const key of ['hang', 'presence', 'opinion', 'agree', 'general'] as TalkIntent[]) {
    const alt = pickFromPool(moves[key], ctx.avoid);
    if (alt) return { tag: `reply:${key}`, text: alt, intent: key };
  }

  const topicBit = (ctx.topic || 'this chat').split('/')[0].trim();
  const invented = stripMdash(
    `Still on ${topicBit} with you. What is one more thing on your mind?`
  );
  return { tag: 'reply:invent', text: invented, intent: 'general' };
}
