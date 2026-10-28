export interface LocationEvidence {
  admin_user_id: string; ip_address: string | null; city: string | null;
  region: string | null; country: string | null; device_type: string | null;
  is_vpn?: boolean | null; isp?: string | null; first_seen_at?: string | null; last_seen_at?: string | null;
}
export interface DestinationDetail { ip: string; location: string; isp: string | null; vpn: boolean; deviceType: string | null; firstSeen: string | null; lastSeen: string | null }
export interface SimultaneousUse { a: DestinationDetail; b: DestinationDetail; overlapStart: string; overlapEnd: string }
export interface StaffLocationReviewResult {
  ips: number; locations: number; deviceTypes: number; review: boolean;
  vpnDestinations: number; destinations: DestinationDetail[]; simultaneous: SimultaneousUse[];
}

const label = (row: LocationEvidence) => [row.city, row.region, row.country].map(v => v?.trim()).filter(Boolean).join(', ') || 'Unknown location';

/** Two observations of one account overlap in time from different networks/places. */
export function findSimultaneousUse(destinations: DestinationDetail[]): SimultaneousUse[] {
  const out: SimultaneousUse[] = [];
  for (let i = 0; i < destinations.length; i++) for (let j = i + 1; j < destinations.length; j++) {
    const a = destinations[i], b = destinations[j];
    if (!a.firstSeen || !a.lastSeen || !b.firstSeen || !b.lastSeen) continue;
    if (a.ip === b.ip && a.location === b.location) continue;
    const start = Math.max(Date.parse(a.firstSeen), Date.parse(b.firstSeen));
    const end = Math.min(Date.parse(a.lastSeen), Date.parse(b.lastSeen));
    if (Number.isFinite(start) && Number.isFinite(end) && start < end) out.push({ a, b, overlapStart: new Date(start).toISOString(), overlapEnd: new Date(end).toISOString() });
  }
  return out;
}

export function staffLocationReview(rows: LocationEvidence[]) {
  const grouped = new Map<string, { ips: Set<string>; locations: Set<string>; deviceTypes: Set<string>; destinations: DestinationDetail[] }>();
  for (const row of rows) {
    const group = grouped.get(row.admin_user_id) || { ips: new Set<string>(), locations: new Set<string>(), deviceTypes: new Set<string>(), destinations: [] };
    if (row.ip_address?.trim()) group.ips.add(row.ip_address.trim().toLowerCase());
    const parts = [row.city, row.region, row.country].map(value => value?.trim().toLowerCase() || '');
    if (parts.some(Boolean)) group.locations.add(parts.join('|'));
    if (row.device_type?.trim()) group.deviceTypes.add(row.device_type.trim().toLowerCase());
    if (row.ip_address?.trim()) group.destinations.push({ ip: row.ip_address.trim(), location: label(row), isp: row.isp ?? null, vpn: !!row.is_vpn, deviceType: row.device_type ?? null, firstSeen: row.first_seen_at ?? null, lastSeen: row.last_seen_at ?? null });
    grouped.set(row.admin_user_id, group);
  }
  return new Map<string, StaffLocationReviewResult>([...grouped].map(([id, group]) => [id, {
    ips: group.ips.size, locations: group.locations.size, deviceTypes: group.deviceTypes.size,
    review: group.ips.size > 1 || group.locations.size > 1 || group.deviceTypes.size > 1,
    vpnDestinations: new Set(group.destinations.filter(d => d.vpn).map(d => d.ip.toLowerCase())).size,
    destinations: group.destinations,
    simultaneous: findSimultaneousUse(group.destinations),
  }]));
}

/** Counts distinct, non-revoked browser credentials registered per staff email. */
export function computersByEmail(devices: { email: string; status: string }[]) {
  const counts = new Map<string, number>();
  for (const d of devices) if (d.status !== 'revoked' && d.email) counts.set(d.email.toLowerCase(), (counts.get(d.email.toLowerCase()) || 0) + 1);
  return counts;
}
