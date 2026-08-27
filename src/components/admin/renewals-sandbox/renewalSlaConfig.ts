/**
 * RENEWALS SANDBOX — single configurable source of ownership/SLA settings
 * (Stage 5, Steps 13–15)
 * ---------------------------------------------------------------------------
 * The SLA is NOT hard-coded into components. Every sandbox component reads the
 * numbers from here, and management can tune them in the sandbox UI. Values are
 * kept in localStorage only — no database writes, nothing shared with live
 * leads until the renewals engine is switched on.
 */

export interface RenewalSlaConfig {
  /** First-touch SLA in hours, by days remaining on the policy. */
  slaHotHours: number;        // 0–7 days
  slaDue8to14Hours: number;   // 8–14 days
  slaDue15to30Hours: number;  // 15–30 days
  slaLaterHours: number;      // 31+ days
  slaLapsedHours: number;     // already expired
  /** A booked callback protects ownership for this long past the callback time. */
  callbackProtectionHours: number;
  /** The original selling agent gets first refusal for this many hours. */
  originalAgentFirstOpportunityHours: number;
  /** Inside this many days to expiry, retention beats historic ownership. */
  retentionOverridesOwnershipDays: number;
}

export const DEFAULT_RENEWAL_SLA: RenewalSlaConfig = {
  slaHotHours: 4,
  slaDue8to14Hours: 24,
  slaDue15to30Hours: 48,
  slaLaterHours: 72,
  slaLapsedHours: 24,
  callbackProtectionHours: 2,
  originalAgentFirstOpportunityHours: 48,
  retentionOverridesOwnershipDays: 7,
};

const KEY = 'renewals_sandbox_sla_config_v1';

let cache: RenewalSlaConfig | null = null;
const listeners = new Set<() => void>();

export function getRenewalSlaConfig(): RenewalSlaConfig {
  if (cache) return cache;
  try {
    const raw = localStorage.getItem(KEY);
    cache = raw ? { ...DEFAULT_RENEWAL_SLA, ...JSON.parse(raw) } : { ...DEFAULT_RENEWAL_SLA };
  } catch {
    cache = { ...DEFAULT_RENEWAL_SLA };
  }
  return cache;
}

export function setRenewalSlaConfig(next: Partial<RenewalSlaConfig>) {
  cache = { ...getRenewalSlaConfig(), ...next };
  try { localStorage.setItem(KEY, JSON.stringify(cache)); } catch { /* private mode */ }
  listeners.forEach((l) => l());
}

export function resetRenewalSlaConfig() {
  cache = { ...DEFAULT_RENEWAL_SLA };
  try { localStorage.removeItem(KEY); } catch { /* ignore */ }
  listeners.forEach((l) => l());
}

export function subscribeRenewalSlaConfig(cb: () => void): () => void {
  listeners.add(cb);
  return () => { listeners.delete(cb); };
}

/** SLA hours for a given days-to-expiry, straight from the config. */
export function slaHoursFromConfig(daysLeft: number | null, cfg = getRenewalSlaConfig()): number {
  if (daysLeft === null) return cfg.slaLaterHours;
  if (daysLeft < 0) return cfg.slaLapsedHours;
  if (daysLeft <= 7) return cfg.slaHotHours;
  if (daysLeft <= 14) return cfg.slaDue8to14Hours;
  if (daysLeft <= 30) return cfg.slaDue15to30Hours;
  return cfg.slaLaterHours;
}
