/**
 * Open Round Robin — no-sale block ladder (practice only).
 *
 * Rule agreed by management on 31 October 2026:
 *  - an agent with no confirmed sale for 1 working day is held out of new
 *    ORR leads for 1 day; 2 sale-free days = 2 days out; 3 = 3 days out;
 *  - the block never grows past 3 days — at that point the agent stays out
 *    and is flagged for a management review instead of the ladder growing;
 *  - any confirmed sale resets the count to zero and releases the agent
 *    immediately;
 *  - new starters are exempt for their first 14 calendar days;
 *  - only working days count: Monday to Saturday (the days the phones are
 *    answered). Sundays and recorded days off never count as sale-free.
 *
 * Pure functions only — no Supabase, no network, nothing live.
 */

import { londonDateKey, londonDaysBetween } from './releaseSchedule';

export const DEFAULT_NEW_STARTER_GRACE_DAYS = 14;
export const DEFAULT_MAX_NO_SALE_BLOCK_DAYS = 3;
/** Hard ceiling management can never configure past. */
export const NO_SALE_BLOCK_HARD_CAP_DAYS = 7;

export interface NoSaleBlockSettings {
  noSaleBlockEnabled: boolean;
  newStarterGraceDays: number;
  maxNoSaleBlockDays: number;
}

export const DEFAULT_NO_SALE_BLOCK_SETTINGS: NoSaleBlockSettings = {
  noSaleBlockEnabled: true,
  newStarterGraceDays: DEFAULT_NEW_STARTER_GRACE_DAYS,
  maxNoSaleBlockDays: DEFAULT_MAX_NO_SALE_BLOCK_DAYS,
};

export const sanitiseNoSaleBlockSettings = (input: Partial<NoSaleBlockSettings>): NoSaleBlockSettings => ({
  noSaleBlockEnabled: input.noSaleBlockEnabled !== false,
  newStarterGraceDays: Math.min(60, Math.max(0, Math.round(Number(input.newStarterGraceDays ?? DEFAULT_NEW_STARTER_GRACE_DAYS)))),
  maxNoSaleBlockDays: Math.min(NO_SALE_BLOCK_HARD_CAP_DAYS, Math.max(1, Math.round(Number(input.maxNoSaleBlockDays ?? DEFAULT_MAX_NO_SALE_BLOCK_DAYS)))),
});

export interface AgentSaleHistory {
  id: string;
  /** When the agent joined the rota. */
  startedAt: number;
  /** Their most recent confirmed sale, or null if none yet. */
  lastSaleAt: number | null;
  /** UK date keys ("2026-10-31") the agent was off — holiday, sickness. */
  daysOff?: string[];
}

export interface NoSaleBlockResult {
  agentId: string;
  /** Working days since the last sale (or since the grace period ended). */
  saleFreeWorkingDays: number;
  /** Days the agent is held out of new ORR leads. 0 when not blocked. */
  blockedDays: number;
  /** True while the new-starter grace period is still running. */
  inGracePeriod: boolean;
  /** True once the ladder has reached its cap and a manager should look. */
  needsManagementReview: boolean;
  /** Human-readable reason, for the practice panel. */
  reason: string;
}

const DAY = 24 * 60 * 60 * 1000;

/** Monday–Saturday count as working days; Sunday never does. */
const isWorkingDay = (ukDateKey: string) => {
  const [y, m, d] = ukDateKey.split('-').map(Number);
  const dow = new Date(Date.UTC(y, m - 1, d)).getUTCDay(); // 0 = Sunday
  return dow !== 0;
};

/** Working days since `fromExclusive`, including today, excluding recorded days off. */
export const saleFreeWorkingDaysBetween = (fromExclusive: number, to: number, daysOff: string[] = []): number => {
  const off = new Set(daysOff);
  const span = londonDaysBetween(fromExclusive, to);
  let count = 0;
  for (let i = 1; i <= span; i += 1) {
    const key = londonDateKey(Date.parse(londonDateKey(fromExclusive)) + i * DAY);
    if (!isWorkingDay(key) || off.has(key)) continue;
    count += 1;
  }
  return count;
};

/**
 * Where an agent sits on the no-sale ladder right now.
 * The clock starts the day after their last sale (or the day after their
 * grace period ends if they have never sold).
 */
export const noSaleBlockStatus = (
  agent: AgentSaleHistory,
  now: number,
  settings: Partial<NoSaleBlockSettings> = {},
): NoSaleBlockResult => {
  const cfg = sanitiseNoSaleBlockSettings(settings);
  const none: Omit<NoSaleBlockResult, 'agentId' | 'reason'> = {
    saleFreeWorkingDays: 0,
    blockedDays: 0,
    inGracePeriod: false,
    needsManagementReview: false,
  };

  if (!cfg.noSaleBlockEnabled) {
    return { agentId: agent.id, ...none, reason: 'No-sale block switched off' };
  }

  const daysOff = agent.daysOff ?? [];

  // New starters: exempt for their first graceDays calendar days.
  const graceEndsAt = agent.startedAt + cfg.newStarterGraceDays * DAY;
  if (now < graceEndsAt) {
    return { agentId: agent.id, ...none, inGracePeriod: true, reason: `New-starter grace period (${cfg.newStarterGraceDays} days)` };
  }

  // The count starts the day after the last sale, or the day the grace
  // period ended for an agent who has never sold.
  const countFrom = agent.lastSaleAt ?? graceEndsAt;
  const saleFreeDays = saleFreeWorkingDaysBetween(countFrom, now, daysOff);

  if (saleFreeDays === 0) {
    return { agentId: agent.id, ...none, reason: 'Sold recently' };
  }

  const blockedDays = Math.min(cfg.maxNoSaleBlockDays, saleFreeDays);
  const needsManagementReview = saleFreeDays >= cfg.maxNoSaleBlockDays;
  return {
    agentId: agent.id,
    saleFreeWorkingDays: saleFreeDays,
    blockedDays,
    inGracePeriod: false,
    needsManagementReview,
    reason: needsManagementReview
      ? `${saleFreeDays} sale-free working days — held out ${blockedDays} days, flagged for management review`
      : `${saleFreeDays} sale-free working day${saleFreeDays === 1 ? '' : 's'} — held out ${blockedDays} day${blockedDays === 1 ? '' : 's'}`,
  };
};

/**
 * IDs of agents currently held out of ORR by the no-sale ladder. Combined
 * with a manager's manual blocks before the rotation runs. A confirmed sale
 * (lastSaleAt = now) drops the agent straight out of this list.
 */
export const noSaleBlockedIds = (
  agents: AgentSaleHistory[],
  now: number,
  settings: Partial<NoSaleBlockSettings> = {},
): string[] =>
  agents
    .map(a => noSaleBlockStatus(a, now, settings))
    .filter(r => r.blockedDays > 0)
    .map(r => r.agentId);
