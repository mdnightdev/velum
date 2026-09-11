import type { PersonaId } from '../personas.js';
import type { CueId } from '../cues/detect.js';

/** Outbound chatter / openers for one persona - never shared across personas. */
export type MessageBank = readonly string[];

/** Cue replies for one persona - never shared across personas. */
export type CueBank = Readonly<Record<CueId, readonly string[]>>;

export type MessageBankMap = Record<PersonaId, MessageBank>;
export type CueBankMap = Record<PersonaId, CueBank>;
