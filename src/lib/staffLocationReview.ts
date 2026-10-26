export interface LocationEvidence {
  admin_user_id: string; ip_address: string | null; city: string | null;
  region: string | null; country: string | null; device_type: string | null;
}
export function staffLocationReview(rows: LocationEvidence[]) {
  const grouped = new Map<string, { ips: Set<string>; locations: Set<string>; deviceTypes: Set<string> }>();
  for (const row of rows) {
    const group = grouped.get(row.admin_user_id) || { ips: new Set<string>(), locations: new Set<string>(), deviceTypes: new Set<string>() };
    if (row.ip_address?.trim()) group.ips.add(row.ip_address.trim().toLowerCase());
    const parts = [row.city, row.region, row.country].map(value => value?.trim().toLowerCase() || '');
    if (parts.some(Boolean)) group.locations.add(parts.join('|'));
    if (row.device_type?.trim()) group.deviceTypes.add(row.device_type.trim().toLowerCase());
    grouped.set(row.admin_user_id, group);
  }
  return new Map([...grouped].map(([id, group]) => [id, { ips: group.ips.size, locations: group.locations.size, deviceTypes: group.deviceTypes.size, review: group.ips.size > 1 || group.locations.size > 1 || group.deviceTypes.size > 1 }]));
}