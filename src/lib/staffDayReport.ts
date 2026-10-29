// Pure helpers for the per-staff daily sign-in report. Read-only projection of
// existing attendance sessions and work-location observations.
export type DayLocation = {
  id: string; admin_user_id: string; first_seen_at: string; last_seen_at: string | null;
  city: string | null; country: string | null; country_code: string | null; isp: string | null;
  ip_address: string | null; is_vpn: boolean | null; device_type: string | null; user_agent: string | null;
  latitude: number | null; longitude: number | null;
};
export type DaySession = { id: string; admin_user_id: string; started_at: string; last_seen_at: string; ended_at: string | null; end_reason: string | null };
export type TravelFlag = { a: DayLocation; b: DayLocation; km: number; kind: 'same_time' | 'impossible_travel'; hours: number };

export const MAX_TRAVEL_KMH = 900; // roughly airliner speed
export const MIN_FLAG_KM = 300; // ignore city mislabelling inside one region
export const GAP_MINUTES = 30;

export function distanceKm(a: DayLocation, b: DayLocation): number | null {
  if (a.latitude == null || a.longitude == null || b.latitude == null || b.longitude == null) return null;
  const r = Math.PI / 180, dLat = (b.latitude - a.latitude) * r, dLon = (b.longitude - a.longitude) * r;
  const h = Math.sin(dLat / 2) ** 2 + Math.cos(a.latitude * r) * Math.cos(b.latitude * r) * Math.sin(dLon / 2) ** 2;
  return Math.round(2 * 6371 * Math.asin(Math.sqrt(h)));
}

const end = (l: DayLocation) => Date.parse(l.last_seen_at || l.first_seen_at);
const start = (l: DayLocation) => Date.parse(l.first_seen_at);

/** Flags pairs of observations that overlap in time far apart, or that would need faster-than-flight travel. */
export function travelFlags(locations: DayLocation[]): TravelFlag[] {
  const list = [...locations].sort((x, y) => start(x) - start(y));
  const flags: TravelFlag[] = [];
  for (let i = 0; i < list.length; i++) for (let j = i + 1; j < list.length; j++) {
    const a = list[i], b = list[j], km = distanceKm(a, b);
    if (km == null || km < MIN_FLAG_KM) continue;
    if (start(b) <= end(a)) { flags.push({ a, b, km, kind: 'same_time', hours: 0 }); continue; }
    const hours = (start(b) - end(a)) / 3600000;
    if (km / Math.max(hours, 1 / 60) > MAX_TRAVEL_KMH) flags.push({ a, b, km, kind: 'impossible_travel', hours });
  }
  return flags;
}

/** Distinct browser/computer signatures. Identical computers with identical browsers count as one. */
export function computerCount(locations: DayLocation[]): number {
  return new Set(locations.map(l => `${l.device_type || ''}|${l.user_agent || ''}`)).size;
}
export function networkCount(locations: DayLocation[]): number {
  return new Set(locations.map(l => l.ip_address || l.isp || l.id)).size;
}

/** Periods with no CRM connection between sessions, at least GAP_MINUTES long. */
export function offlineGaps(sessions: DaySession[]): { from: string; to: string; minutes: number }[] {
  const list = [...sessions].sort((a, b) => a.started_at.localeCompare(b.started_at));
  const gaps: { from: string; to: string; minutes: number }[] = [];
  let lastEnd = 0, lastIso = '';
  for (const s of list) {
    const st = Date.parse(s.started_at), en = Date.parse(s.ended_at || s.last_seen_at);
    if (lastEnd && st - lastEnd >= GAP_MINUTES * 60000) gaps.push({ from: lastIso, to: s.started_at, minutes: Math.round((st - lastEnd) / 60000) });
    if (en > lastEnd) { lastEnd = en; lastIso = s.ended_at || s.last_seen_at; }
  }
  return gaps;
}
