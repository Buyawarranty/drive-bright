import type { PracticeAgent, PracticeLead } from './types';

/**
 * Made-up leads and agents for the Open Round Robin practice run.
 *
 * Phone numbers use the 07700 900xxx range Ofcom reserves for fiction and
 * testing, so a practice lead can never be dialled by accident. Emails use
 * example.com, which is reserved for documents. Nothing here is a real person.
 */

const FIRST_NAMES = [
  'Amelia', 'Oliver', 'Freya', 'Harry', 'Isla', 'Jack', 'Mia', 'Charlie',
  'Poppy', 'Thomas', 'Elsie', 'George', 'Sophie', 'Noah', 'Grace', 'Leo',
];

const LAST_NAMES = [
  'Bramley', 'Whitfield', 'Ashcombe', 'Hollis', 'Pemberton', 'Carrick',
  'Delaney', 'Rowbottom', 'Fairhurst', 'Nightingale', 'Okafor', 'Petersen',
  'Sandoval', 'Thackeray', 'Vaughan', 'Wetherby',
];

const TOWNS = [
  'Leeds', 'Bristol', 'Norwich', 'Cardiff', 'Sheffield', 'Exeter',
  'Perth', 'Lancaster', 'Ipswich', 'Durham', 'Salisbury', 'Bangor',
];

const pick = <T,>(list: T[], seed: number) => list[Math.abs(seed) % list.length];

/** A fake registration that reads plausibly but is not a real vehicle. */
const makeReg = (seed: number) => {
  const letters = 'ABCDEFGHJKLMNPRSTUVWXYZ';
  const a = letters[(seed >> 3) % letters.length];
  const b = letters[(seed >> 7) % letters.length];
  const numbers = String(10 + (Math.abs(seed) % 89));
  const c = letters[(seed >> 11) % letters.length];
  const d = letters[(seed >> 13) % letters.length];
  const e = letters[(seed >> 17) % letters.length];
  return `${a}${b}${numbers} ${c}${d}${e}`;
};

const makePhone = (seed: number) => `07700 900${String(100 + (Math.abs(seed) % 899))}`;

let counter = 0;

/** Builds one invented lead. `seed` makes a run repeatable when you want it. */
export const makeSyntheticLead = (at: number, seed = counter++): PracticeLead => {
  const first = pick(FIRST_NAMES, seed * 7 + 3);
  const last = pick(LAST_NAMES, seed * 13 + 5);
  const town = pick(TOWNS, seed * 5 + 11);
  const phone = makePhone(seed);
  const email = `${first.toLowerCase()}.${last.toLowerCase()}@example.com`;
  return {
    id: `practice-${at}-${seed}`,
    personKey: `${email}|${phone.replace(/\D/g, '').slice(-9)}`,
    name: `${first} ${last}`,
    phone,
    email,
    reg: makeReg(seed),
    stage: 'anonymous',
    identified: false,
    activeSession: false,
    createdAt: at,
    lastActivityAt: at,
    lastStageChangeAt: at,
    callbackRequestedAt: null,
    callbackTime: null,
    purchased: false,
    suppressed: false,
    tpsClear: seed % 9 !== 0,
    phoneConsent: seed % 7 !== 0,
    ownerAgentId: null,
    reservedAgentId: null,
    reservedAt: null,
    reservedExpiresAt: null,
    reReleaseDueAt: null,
  releaseCount: 0,
  firstAttemptLeadMinutes: null,
  value: 0,
  events: [],

    outcomes: [],
    history: [`Practice lead created for ${town} rehearsal (${email})`],
  };
};

/** A small invented team so rotation and capacity can be rehearsed. */
export const makeSyntheticAgents = (): PracticeAgent[] => [
  { id: 'agent-a', name: 'Practice agent A', dailyCap: 12, usedToday: 0, available: true },
  { id: 'agent-b', name: 'Practice agent B', dailyCap: 12, usedToday: 0, available: true },
  { id: 'agent-c', name: 'Practice agent C', dailyCap: 8, usedToday: 0, available: true },
  { id: 'agent-d', name: 'Practice agent D', dailyCap: 0, usedToday: 0, available: true },
  { id: 'agent-e', name: 'Practice agent E', dailyCap: 10, usedToday: 0, available: false },
];
