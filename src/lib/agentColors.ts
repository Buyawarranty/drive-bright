/**
 * Deterministic, collision-free-ish colour per agent.
 * Known agents get a fixed colour; everyone else gets a stable colour
 * derived from their id/name so two agents never share by accident.
 */
const NAMED: Record<string, number> = {
  isobel: 0,
  james: 1,
  ash: 2,
  freddie: 3,
  thomas: 4,
  greg: 5,
  sammie: 6,
};

const SOLID = [
  'bg-emerald-600', // isobel
  'bg-blue-600',    // james
  'bg-violet-600',  // ash
  'bg-orange-600',  // freddie
  'bg-teal-600',    // thomas
  'bg-indigo-600',  // greg
  'bg-rose-600',    // sammie
  'bg-cyan-600',
  'bg-amber-600',
  'bg-pink-600',
  'bg-lime-600',
  'bg-sky-600',
];

const BADGE = [
  'bg-emerald-100 text-emerald-800 border-emerald-300',
  'bg-blue-100 text-blue-800 border-blue-300',
  'bg-violet-100 text-violet-800 border-violet-300',
  'bg-orange-100 text-orange-800 border-orange-300',
  'bg-teal-100 text-teal-800 border-teal-300',
  'bg-indigo-100 text-indigo-800 border-indigo-300',
  'bg-rose-100 text-rose-800 border-rose-300',
  'bg-cyan-100 text-cyan-800 border-cyan-300',
  'bg-amber-100 text-amber-800 border-amber-300',
  'bg-pink-100 text-pink-800 border-pink-300',
  'bg-lime-100 text-lime-800 border-lime-300',
  'bg-sky-100 text-sky-800 border-sky-300',
];

const indexFor = (firstName?: string | null, id?: string | null): number => {
  const key = (firstName || '').trim().toLowerCase();
  if (key && key in NAMED) return NAMED[key];
  const seed = `${key}|${id ?? ''}` || 'unknown';
  let h = 0;
  for (let i = 0; i < seed.length; i++) h = (h * 31 + seed.charCodeAt(i)) >>> 0;
  // avoid the reserved named slots so known agents stay unique
  const reserved = Object.keys(NAMED).length;
  return reserved + (h % (SOLID.length - reserved));
};

export const getAgentColor = (firstName?: string | null, id?: string | null) =>
  SOLID[indexFor(firstName, id)];

export const getAgentBadgeColor = (firstName?: string | null, id?: string | null) =>
  BADGE[indexFor(firstName, id)];
