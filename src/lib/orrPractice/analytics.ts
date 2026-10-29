import { ANALYSIS_INTERVALS_MINUTES } from './settings';
import { hasEvent } from './engine';
import type { PracticeLead } from './types';

/**
 * Practice analytics: does calling sooner after the customer goes quiet help?
 *
 * Every figure comes from made-up leads only, so an interval can be trialled
 * here before anything is changed on a live customer journey.
 */

export interface IntervalStat {
  intervalMinutes: number;
  /** Practice leads whose first attempt landed nearest to this interval. */
  leads: number;
  /** Call attempts recorded on those leads. */
  attempts: number;
  /** Leads where a real conversation happened. */
  conversations: number;
  /** Conversations as a share of leads. */
  contactRate: number;
  /** Leads that submitted quote details, as a share of leads. */
  quoteCompletion: number;
  /** Purchases as a share of the leads that reached checkout. */
  checkoutCompletion: number;
  /** Purchases as a share of leads. */
  conversionRate: number;
  /** Practice money divided by leads. */
  revenuePerLead: number;
  /** Leads that produced a complaint. */
  complaints: number;
  /** Leads that produced an opt-out. */
  optOuts: number;
}

const safeDivide = (a: number, b: number) => (b > 0 ? a / b : 0);

/** Nearest analysis interval to a measured lead time. */
const bucketFor = (minutes: number, intervals: number[]) =>
  intervals.reduce(
    (best, interval) =>
      Math.abs(interval - minutes) < Math.abs(best - minutes) ? interval : best,
    intervals[0],
  );

/**
 * Groups practice leads by how long after the customer went quiet the first
 * call attempt happened, then reports the outcome measures management asked for.
 */
export const intervalReport = (
  leads: PracticeLead[],
  intervals: number[] = ANALYSIS_INTERVALS_MINUTES,
): IntervalStat[] => {
  const buckets = new Map<number, PracticeLead[]>();
  intervals.forEach(i => buckets.set(i, []));

  leads.forEach(lead => {
    if (lead.firstAttemptLeadMinutes === null) return;
    const key = bucketFor(lead.firstAttemptLeadMinutes, intervals);
    buckets.set(key, [...(buckets.get(key) ?? []), lead]);
  });

  return intervals.map(intervalMinutes => {
    const group = buckets.get(intervalMinutes) ?? [];
    const leads_ = group.length;
    const attempts = group.reduce((sum, l) => sum + l.outcomes.length, 0);
    const conversations = group.filter(l =>
      l.outcomes.some(o => o.result === 'spoke' && o.durationSeconds > 0),
    ).length;
    const reachedCheckout = group.filter(l => hasEvent(l, 'checkout_entered')).length;
    const purchased = group.filter(l => l.purchased).length;
    const revenue = group.reduce((sum, l) => sum + l.value, 0);

    return {
      intervalMinutes,
      leads: leads_,
      attempts,
      conversations,
      contactRate: safeDivide(conversations, leads_),
      quoteCompletion: safeDivide(group.filter(l => hasEvent(l, 'quote_details_submitted')).length, leads_),
      checkoutCompletion: safeDivide(purchased, reachedCheckout),
      conversionRate: safeDivide(purchased, leads_),
      revenuePerLead: safeDivide(revenue, leads_),
      complaints: group.filter(l => l.outcomes.some(o => o.result === 'complaint')).length,
      optOuts: group.filter(l => l.outcomes.some(o => o.result === 'opt_out')).length,
    };
  });
};

/** How many practice leads sit in each stage right now. */
export const poolSummary = (leads: PracticeLead[]) => ({
  anonymous: leads.filter(l => l.stage === 'anonymous').length,
  activeSession: leads.filter(l => l.stage === 'active_session').length,
  awaitingRelease: leads.filter(l => l.stage === 'awaiting_release').length,
  queued: leads.filter(l => l.stage === 'queued').length,
  reserved: leads.filter(l => l.stage === 'reserved').length,
  owned: leads.filter(l => l.stage === 'owned').length,
  closed: leads.filter(l => l.stage === 'closed').length,
  suppressed: leads.filter(l => l.suppressed).length,
});
