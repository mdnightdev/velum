/**
 * Chaos human-mimic persona roster (union).
 * Each persona later gets its own message + cue packs - this file is ids/traits only.
 */

export type PersonaId =
  // A , role / room affinity
  | 'social'
  | 'casual'
  | 'tech'
  | 'drama'
  | 'support'
  | 'attention'
  | 'lurker'
  | 'market'
  | 'creative'
  | 'nightowl'
  | 'newbie'
  | 'organizer'
  | 'skeptic'
  | 'cheer'
  | 'gamer'
  | 'mentor'
  // B , temperament / style / market
  | 'mature'
  | 'childish'
  | 'emotional'
  | 'emoji_addict'
  | 'clueless_newbie'
  | 'rage_quitter'
  | 'lowballer_hustler'
  | 'short_texter'
  | 'heavy_texter'
  | 'chat_spammer'
  // C , adversarial / moderation (rare assign ~10%)
  | 'scammer_phisher'
  | 'stalker_inspector'
  // D , additional social / conversational
  | 'flirty'
  | 'professional'
  | 'sarcastic'
  | 'supportive'
  | 'chaotic'
  | 'formal';

export type PersonaTier = 'core' | 'stress';

export type RoomSlug =
  | 'velum_general'
  | 'velum_market'
  | 'velum_escrow'
  | 'velum_offtopic'
  | 'velum_bugs'
  | 'velum_support'
  | 'velum_suggestions'
  | 'velum_events';

export interface PersonaDef {
  id: PersonaId;
  tier: PersonaTier;
  label: string;
  /** One-line voice / behavior */
  voice: string;
  /** Soft weights for Velum master rooms (activity still prefers master overall) */
  roomWeights: Partial<Record<RoomSlug, number>>;
  /** Chance to post outside preferred rooms */
  drift: number;
  /** Base talk gap ms (peak/quiet multipliers applied at runtime later) */
  talkMs: { min: number; max: number };
  /** High talk volume - needs larger message banks when scaling */
  bursty: boolean;
  odds: {
    createLounge: number;
    joinForeign: number;
    friend: number;
    dm: number;
    media: number;
  };
  /** Prefer cue-driven reply when peer line matches */
  cueBias: number;
}

export const PERSONAS: Record<PersonaId, PersonaDef> = {
  social: {
    id: 'social',
    tier: 'core',
    label: 'Social',
    voice: 'warm hellos, many rooms, talks a lot',
    roomWeights: { velum_general: 3, velum_offtopic: 3, velum_events: 2 },
    drift: 0.35,
    talkMs: { min: 4000, max: 12000 },
    bursty: true,
    odds: { createLounge: 0.08, joinForeign: 0.45, friend: 0.55, dm: 0.25, media: 0.25 },
    cueBias: 0.85,
  },
  casual: {
    id: 'casual',
    tier: 'core',
    label: 'Casual',
    voice: 'short, easy, low urgency',
    roomWeights: { velum_general: 3, velum_offtopic: 2 },
    drift: 0.25,
    talkMs: { min: 12000, max: 28000 },
    bursty: false,
    odds: { createLounge: 0.03, joinForeign: 0.25, friend: 0.3, dm: 0.15, media: 0.15 },
    cueBias: 0.7,
  },
  tech: {
    id: 'tech',
    tier: 'core',
    label: 'Tech',
    voice: 'precise, bugs and suggestions',
    roomWeights: { velum_bugs: 4, velum_suggestions: 3, velum_general: 1, velum_support: 1 },
    drift: 0.2,
    talkMs: { min: 8000, max: 18000 },
    bursty: false,
    odds: { createLounge: 0.04, joinForeign: 0.2, friend: 0.25, dm: 0.12, media: 0.08 },
    cueBias: 0.85,
  },
  drama: {
    id: 'drama',
    tier: 'core',
    label: 'Drama',
    voice: 'opinions, mild heat, offtopic heavy',
    roomWeights: { velum_offtopic: 4, velum_general: 2, velum_events: 1 },
    drift: 0.3,
    talkMs: { min: 7000, max: 16000 },
    bursty: true,
    odds: { createLounge: 0.06, joinForeign: 0.35, friend: 0.4, dm: 0.2, media: 0.2 },
    cueBias: 0.8,
  },
  support: {
    id: 'support',
    tier: 'core',
    label: 'Support',
    voice: 'patient, stepwise, help rooms',
    roomWeights: { velum_support: 4, velum_bugs: 2, velum_general: 1 },
    drift: 0.15,
    talkMs: { min: 9000, max: 20000 },
    bursty: false,
    odds: { createLounge: 0.02, joinForeign: 0.15, friend: 0.35, dm: 0.25, media: 0.05 },
    cueBias: 0.9,
  },
  attention: {
    id: 'attention',
    tier: 'core',
    label: 'Attention',
    voice: 'visible, events, wants eyes',
    roomWeights: { velum_events: 4, velum_general: 3, velum_offtopic: 2 },
    drift: 0.4,
    talkMs: { min: 5000, max: 14000 },
    bursty: true,
    odds: { createLounge: 0.12, joinForeign: 0.5, friend: 0.5, dm: 0.25, media: 0.35 },
    cueBias: 0.75,
  },
  lurker: {
    id: 'lurker',
    tier: 'core',
    label: 'Lurker',
    voice: 'rare short posts',
    roomWeights: { velum_general: 2, velum_offtopic: 1 },
    drift: 0.1,
    talkMs: { min: 25000, max: 55000 },
    bursty: false,
    odds: { createLounge: 0.01, joinForeign: 0.1, friend: 0.15, dm: 0.08, media: 0.05 },
    cueBias: 0.55,
  },
  market: {
    id: 'market',
    tier: 'core',
    label: 'Market',
    voice: 'listings, prices, escrow caution',
    roomWeights: { velum_market: 4, velum_escrow: 3, velum_general: 1 },
    drift: 0.18,
    talkMs: { min: 9000, max: 20000 },
    bursty: false,
    odds: { createLounge: 0.03, joinForeign: 0.2, friend: 0.3, dm: 0.2, media: 0.1 },
    cueBias: 0.85,
  },
  creative: {
    id: 'creative',
    tier: 'core',
    label: 'Creative',
    voice: 'visual, sharey, media-leaning',
    roomWeights: { velum_offtopic: 3, velum_general: 2, velum_events: 2 },
    drift: 0.35,
    talkMs: { min: 8000, max: 18000 },
    bursty: false,
    odds: { createLounge: 0.1, joinForeign: 0.4, friend: 0.4, dm: 0.2, media: 0.55 },
    cueBias: 0.7,
  },
  nightowl: {
    id: 'nightowl',
    tier: 'core',
    label: 'Night owl',
    voice: 'late check-ins, low pressure',
    roomWeights: { velum_offtopic: 3, velum_general: 2, velum_events: 1 },
    drift: 0.3,
    talkMs: { min: 10000, max: 24000 },
    bursty: false,
    odds: { createLounge: 0.05, joinForeign: 0.3, friend: 0.3, dm: 0.15, media: 0.2 },
    cueBias: 0.75,
  },
  newbie: {
    id: 'newbie',
    tier: 'core',
    label: 'Newbie',
    voice: 'learning ropes, polite questions',
    roomWeights: { velum_support: 3, velum_general: 3, velum_suggestions: 1 },
    drift: 0.22,
    talkMs: { min: 10000, max: 22000 },
    bursty: false,
    odds: { createLounge: 0.01, joinForeign: 0.35, friend: 0.45, dm: 0.15, media: 0.1 },
    cueBias: 0.8,
  },
  organizer: {
    id: 'organizer',
    tier: 'core',
    label: 'Organizer',
    voice: 'schedules, events, clear asks',
    roomWeights: { velum_events: 4, velum_general: 2, velum_suggestions: 2 },
    drift: 0.2,
    talkMs: { min: 8000, max: 17000 },
    bursty: false,
    odds: { createLounge: 0.15, joinForeign: 0.35, friend: 0.4, dm: 0.2, media: 0.15 },
    cueBias: 0.8,
  },
  skeptic: {
    id: 'skeptic',
    tier: 'core',
    label: 'Skeptic',
    voice: 'dry, short doubt',
    roomWeights: { velum_general: 2, velum_bugs: 2, velum_suggestions: 2, velum_market: 1 },
    drift: 0.2,
    talkMs: { min: 14000, max: 30000 },
    bursty: false,
    odds: { createLounge: 0.02, joinForeign: 0.15, friend: 0.2, dm: 0.1, media: 0.05 },
    cueBias: 0.65,
  },
  cheer: {
    id: 'cheer',
    tier: 'core',
    label: 'Cheer',
    voice: 'upbeat, thanks, encouragement',
    roomWeights: { velum_general: 3, velum_events: 2, velum_offtopic: 2, velum_support: 1 },
    drift: 0.35,
    talkMs: { min: 7000, max: 16000 },
    bursty: true,
    odds: { createLounge: 0.05, joinForeign: 0.4, friend: 0.5, dm: 0.2, media: 0.25 },
    cueBias: 0.85,
  },
  gamer: {
    id: 'gamer',
    tier: 'core',
    label: 'Gamer',
    voice: 'games, offtopic, lobby energy',
    roomWeights: { velum_offtopic: 4, velum_general: 2, velum_events: 2 },
    drift: 0.35,
    talkMs: { min: 6000, max: 15000 },
    bursty: true,
    odds: { createLounge: 0.08, joinForeign: 0.4, friend: 0.45, dm: 0.2, media: 0.3 },
    cueBias: 0.75,
  },
  mentor: {
    id: 'mentor',
    tier: 'core',
    label: 'Mentor',
    voice: 'steady advice, support and bugs',
    roomWeights: { velum_support: 3, velum_bugs: 2, velum_suggestions: 2, velum_general: 1 },
    drift: 0.15,
    talkMs: { min: 10000, max: 22000 },
    bursty: false,
    odds: { createLounge: 0.04, joinForeign: 0.2, friend: 0.35, dm: 0.2, media: 0.08 },
    cueBias: 0.9,
  },
  mature: {
    id: 'mature',
    tier: 'core',
    label: 'Mature',
    voice: 'calm, measured, complete sentences',
    roomWeights: { velum_general: 3, velum_support: 2, velum_suggestions: 2 },
    drift: 0.2,
    talkMs: { min: 10000, max: 22000 },
    bursty: false,
    odds: { createLounge: 0.04, joinForeign: 0.25, friend: 0.35, dm: 0.15, media: 0.1 },
    cueBias: 0.8,
  },
  childish: {
    id: 'childish',
    tier: 'core',
    label: 'Childish',
    voice: 'silly, impulsive, short bursts',
    roomWeights: { velum_offtopic: 4, velum_general: 2 },
    drift: 0.4,
    talkMs: { min: 5000, max: 14000 },
    bursty: true,
    odds: { createLounge: 0.05, joinForeign: 0.35, friend: 0.4, dm: 0.15, media: 0.25 },
    cueBias: 0.7,
  },
  emotional: {
    id: 'emotional',
    tier: 'core',
    label: 'Emotional',
    voice: 'reactive, mood swings, cue-heavy',
    roomWeights: { velum_general: 3, velum_offtopic: 3, velum_support: 1 },
    drift: 0.3,
    talkMs: { min: 6000, max: 16000 },
    bursty: true,
    odds: { createLounge: 0.04, joinForeign: 0.3, friend: 0.45, dm: 0.2, media: 0.15 },
    cueBias: 0.95,
  },
  emoji_addict: {
    id: 'emoji_addict',
    tier: 'core',
    label: 'Emoji addict',
    voice: 'emoji-dense but still readable',
    roomWeights: { velum_general: 3, velum_offtopic: 3, velum_events: 2 },
    drift: 0.35,
    talkMs: { min: 5000, max: 14000 },
    bursty: true,
    odds: { createLounge: 0.05, joinForeign: 0.4, friend: 0.45, dm: 0.2, media: 0.3 },
    cueBias: 0.8,
  },
  clueless_newbie: {
    id: 'clueless_newbie',
    tier: 'core',
    label: 'Clueless newbie',
    voice: 'confused, wrong-room, polite',
    roomWeights: { velum_support: 3, velum_general: 3, velum_market: 1 },
    drift: 0.45,
    talkMs: { min: 9000, max: 20000 },
    bursty: false,
    odds: { createLounge: 0.01, joinForeign: 0.4, friend: 0.4, dm: 0.15, media: 0.1 },
    cueBias: 0.85,
  },
  rage_quitter: {
    id: 'rage_quitter',
    tier: 'core',
    label: 'Rage quitter',
    voice: 'spike then abrupt leave',
    roomWeights: { velum_general: 2, velum_offtopic: 2, velum_bugs: 2 },
    drift: 0.35,
    talkMs: { min: 4000, max: 10000 },
    bursty: true,
    odds: { createLounge: 0.02, joinForeign: 0.2, friend: 0.2, dm: 0.1, media: 0.1 },
    cueBias: 0.7,
  },
  lowballer_hustler: {
    id: 'lowballer_hustler',
    tier: 'core',
    label: 'Lowballer hustler',
    voice: 'price pressure, last-offer energy',
    roomWeights: { velum_market: 5, velum_escrow: 3, velum_general: 1 },
    drift: 0.15,
    talkMs: { min: 7000, max: 16000 },
    bursty: true,
    odds: { createLounge: 0.03, joinForeign: 0.25, friend: 0.35, dm: 0.3, media: 0.1 },
    cueBias: 0.8,
  },
  short_texter: {
    id: 'short_texter',
    tier: 'core',
    label: 'Short texter',
    voice: '1-6 word fragments',
    roomWeights: { velum_general: 3, velum_offtopic: 2 },
    drift: 0.3,
    talkMs: { min: 5000, max: 14000 },
    bursty: true,
    odds: { createLounge: 0.02, joinForeign: 0.25, friend: 0.3, dm: 0.12, media: 0.1 },
    cueBias: 0.75,
  },
  heavy_texter: {
    id: 'heavy_texter',
    tier: 'core',
    label: 'Heavy texter',
    voice: 'long paragraphs, multi-sentence',
    roomWeights: { velum_general: 3, velum_suggestions: 2, velum_offtopic: 2 },
    drift: 0.25,
    talkMs: { min: 10000, max: 22000 },
    bursty: false,
    odds: { createLounge: 0.04, joinForeign: 0.25, friend: 0.3, dm: 0.15, media: 0.1 },
    cueBias: 0.8,
  },
  chat_spammer: {
    id: 'chat_spammer',
    tier: 'core',
    label: 'Chat spammer',
    voice: 'high rate bursts, moderation + infra load',
    roomWeights: { velum_general: 4, velum_offtopic: 3, velum_events: 2 },
    drift: 0.5,
    talkMs: { min: 1500, max: 5000 },
    bursty: true,
    odds: { createLounge: 0.02, joinForeign: 0.3, friend: 0.25, dm: 0.2, media: 0.2 },
    cueBias: 0.6,
  },
  scammer_phisher: {
    id: 'scammer_phisher',
    tier: 'stress',
    label: 'Scammer phisher',
    voice: 'fishy trust/bait wording for mod pipelines',
    roomWeights: { velum_market: 3, velum_general: 2, velum_offtopic: 2 },
    drift: 0.4,
    talkMs: { min: 8000, max: 18000 },
    bursty: false,
    odds: { createLounge: 0.02, joinForeign: 0.35, friend: 0.55, dm: 0.45, media: 0.15 },
    cueBias: 0.7,
  },
  stalker_inspector: {
    id: 'stalker_inspector',
    tier: 'stress',
    label: 'Stalker inspector',
    voice: 'over-curious probing, boundary stress',
    roomWeights: { velum_general: 3, velum_offtopic: 2, velum_events: 2 },
    drift: 0.35,
    talkMs: { min: 7000, max: 16000 },
    bursty: false,
    odds: { createLounge: 0.02, joinForeign: 0.4, friend: 0.6, dm: 0.5, media: 0.1 },
    cueBias: 0.75,
  },
  flirty: {
    id: 'flirty',
    tier: 'core',
    label: 'Flirty',
    voice: 'charming, playful teasing, emoji banter',
    roomWeights: { velum_general: 3, velum_offtopic: 3, velum_events: 2 },
    drift: 0.35,
    talkMs: { min: 6000, max: 15000 },
    bursty: true,
    odds: { createLounge: 0.05, joinForeign: 0.45, friend: 0.6, dm: 0.4, media: 0.3 },
    cueBias: 0.85,
  },
  professional: {
    id: 'professional',
    tier: 'core',
    label: 'Professional',
    voice: 'formal, structured, polite, punctilious',
    roomWeights: { velum_general: 2, velum_suggestions: 3, velum_bugs: 2, velum_support: 2 },
    drift: 0.15,
    talkMs: { min: 10000, max: 24000 },
    bursty: false,
    odds: { createLounge: 0.04, joinForeign: 0.2, friend: 0.25, dm: 0.15, media: 0.05 },
    cueBias: 0.8,
  },
  sarcastic: {
    id: 'sarcastic',
    tier: 'core',
    label: 'Sarcastic',
    voice: 'dry wit, ironic banter, deadpan dismissals',
    roomWeights: { velum_general: 3, velum_offtopic: 4, velum_bugs: 1 },
    drift: 0.3,
    talkMs: { min: 7000, max: 16000 },
    bursty: false,
    odds: { createLounge: 0.03, joinForeign: 0.35, friend: 0.3, dm: 0.18, media: 0.15 },
    cueBias: 0.75,
  },
  supportive: {
    id: 'supportive',
    tier: 'core',
    label: 'Supportive',
    voice: 'encouraging, validating, patient, warm reinforcement',
    roomWeights: { velum_support: 4, velum_general: 3, velum_suggestions: 2 },
    drift: 0.2,
    talkMs: { min: 8000, max: 18000 },
    bursty: false,
    odds: { createLounge: 0.04, joinForeign: 0.3, friend: 0.5, dm: 0.25, media: 0.15 },
    cueBias: 0.9,
  },
  chaotic: {
    id: 'chaotic',
    tier: 'core',
    label: 'Chaotic',
    voice: 'unpredictable, rapid topic jumps, absurd humor',
    roomWeights: { velum_offtopic: 4, velum_general: 3, velum_events: 3 },
    drift: 0.5,
    talkMs: { min: 3000, max: 10000 },
    bursty: true,
    odds: { createLounge: 0.1, joinForeign: 0.5, friend: 0.4, dm: 0.25, media: 0.4 },
    cueBias: 0.65,
  },
  formal: {
    id: 'formal',
    tier: 'core',
    label: 'Formal',
    voice: 'elevated diction, punctuation-heavy, restrained',
    roomWeights: { velum_general: 3, velum_suggestions: 2, velum_support: 2 },
    drift: 0.15,
    talkMs: { min: 12000, max: 26000 },
    bursty: false,
    odds: { createLounge: 0.02, joinForeign: 0.15, friend: 0.2, dm: 0.1, media: 0.05 },
    cueBias: 0.8,
  },
};

export const PERSONA_IDS = Object.keys(PERSONAS) as PersonaId[];

export const CORE_PERSONA_IDS = PERSONA_IDS.filter((id) => PERSONAS[id].tier === 'core');
export const STRESS_PERSONA_IDS = PERSONA_IDS.filter((id) => PERSONAS[id].tier === 'stress');

/** Default assign: ~90% core, ~10% stress. */
export function assignPersona(roll: number = Math.random()): PersonaId {
  if (roll < 0.1 && STRESS_PERSONA_IDS.length) {
    return STRESS_PERSONA_IDS[Math.floor(Math.random() * STRESS_PERSONA_IDS.length)];
  }
  return CORE_PERSONA_IDS[Math.floor(Math.random() * CORE_PERSONA_IDS.length)];
}

export function personaOf(id: string): PersonaDef {
  if (id in PERSONAS) return PERSONAS[id as PersonaId];
  return PERSONAS.casual;
}

export function talkGapMs(persona: PersonaDef): number {
  const { min, max } = persona.talkMs;
  return min + Math.floor(Math.random() * (max - min + 1));
}
