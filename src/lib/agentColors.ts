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

// Hues are deliberately spaced far apart so no two tags look alike.
const SOLID = [
  'bg-emerald-600',  // isobel  — green
  'bg-blue-600',     // james   — blue
  'bg-fuchsia-600',  // ash     — magenta
  'bg-orange-500',   // freddie — orange
  'bg-cyan-500',      // thomas  — cyan
  'bg-red-600',      // greg    — red
  'bg-amber-500',    // sammie  — amber
  'bg-violet-600',
  'bg-lime-600',
  'bg-rose-600',
  'bg-sky-600',
  'bg-slate-600',
];

const BADGE = [
  'bg-emerald-200 text-emerald-900 border-emerald-400',
  'bg-blue-200 text-blue-900 border-blue-400',
  'bg-fuchsia-200 text-fuchsia-900 border-fuchsia-400',
  'bg-orange-200 text-orange-900 border-orange-400',
  'bg-cyan-200 text-cyan-900 border-cyan-400',
  'bg-red-200 text-red-900 border-red-400',
  'bg-amber-200 text-amber-900 border-amber-500',
  'bg-violet-200 text-violet-900 border-violet-400',
  'bg-lime-200 text-lime-900 border-lime-400',
  'bg-rose-200 text-rose-900 border-rose-400',
  'bg-sky-200 text-sky-900 border-sky-400',
  'bg-slate-200 text-slate-900 border-slate-400',
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
