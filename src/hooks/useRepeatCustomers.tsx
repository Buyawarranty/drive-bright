import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { supabase } from '@/integrations/supabase/client';

/**
 * Flags leads that belong to a REPEAT CUSTOMER — someone who has already
 * bought a warranty from us before (a live/expired policy exists on the
 * `customers` table), matched by normalized email OR registration plate.
 *
 * Cancelled / refunded orders are excluded so an unwound sale never shows as
 * a prior purchase. Used by the New Leads table and the new-lead pop-ups so
 * agents and lead allocation immediately know this is an existing customer.
 */

export interface RepeatCustomerInfo {
  /** Number of prior policies found for this person. */
  policyCount: number;
  /** Most recent prior purchase date (ISO), when known. */
  lastPurchaseAt: string | null;
  /** Plan of the most recent prior purchase. */
  lastPlanType: string | null;
  /** True when the match came from the plate rather than the email. */
  matchedOn: 'email' | 'reg';
}

export interface RepeatLeadInput {
  id: string;
  email?: string | null;
  vehicle_reg?: string | null;
  /**
   * When the lead arrived. Only purchases made BEFORE this count as prior
   * policies — otherwise the lead's own conversion would flag it as "repeat".
   */
  created_at?: string | null;
}

const BATCH = 200;
const EXCLUDED_STATUSES = ['cancelled', 'refunded'];

const normReg = (r?: string | null) => (r || '').toUpperCase().replace(/\s+/g, '');
const normEmail = (e?: string | null) => (e || '').trim().toLowerCase();

export const useRepeatCustomers = (leads: RepeatLeadInput[]) => {
  const [repeatByLeadId, setRepeatByLeadId] = useState<Record<string, RepeatCustomerInfo>>({});
  const [loading, setLoading] = useState(false);
  const lastKeyRef = useRef('');
  const debounceRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  const emails = useMemo(
    () => [...new Set(leads.map(l => normEmail(l.email)).filter(Boolean))].sort(),
    [leads]
  );
  const regs = useMemo(
    () => [...new Set(leads.map(l => normReg(l.vehicle_reg)).filter(Boolean))].sort(),
    [leads]
  );

  const key = useMemo(() => {
    if (!emails.length && !regs.length) return '';
    return `${emails.length}:${emails[0] || ''}:${emails[emails.length - 1] || ''}|${regs.length}:${regs[0] || ''}:${regs[regs.length - 1] || ''}`;
  }, [emails, regs]);

  const fetchAll = useCallback(async () => {
    if (!key || lastKeyRef.current === key) return;
    lastKeyRef.current = key;
    setLoading(true);

    type Row = { email: string | null; registration_plate: string | null; signup_date: string | null; plan_type: string | null; status: string | null };
    const rows: Row[] = [];

    try {
      const runs: PromiseLike<void>[] = [];
      for (let i = 0; i < emails.length; i += BATCH) {
        const batch = emails.slice(i, i + BATCH);
        runs.push(
          supabase
            .from('customers')
            .select('email, registration_plate, signup_date, plan_type, status')
            .in('email', batch)
            .limit(BATCH * 4)
            .then(({ data }) => { rows.push(...((data || []) as Row[])); })
        );
      }
      for (let i = 0; i < regs.length; i += BATCH) {
        const batch = regs.slice(i, i + BATCH);
        runs.push(
          supabase
            .from('customers')
            .select('email, registration_plate, signup_date, plan_type, status')
            .in('registration_plate', batch)
            .limit(BATCH * 4)
            .then(({ data }) => { rows.push(...((data || []) as Row[])); })
        );
      }
      await Promise.all(runs);

      const byEmail = new Map<string, Row[]>();
      const byReg = new Map<string, Row[]>();
      rows.forEach((r) => {
        if (EXCLUDED_STATUSES.includes((r.status || '').toLowerCase())) return;
        const e = normEmail(r.email);
        const p = normReg(r.registration_plate);
        if (e) byEmail.set(e, [...(byEmail.get(e) || []), r]);
        if (p) byReg.set(p, [...(byReg.get(p) || []), r]);
      });

      const summarize = (matches: Row[], matchedOn: RepeatCustomerInfo['matchedOn']): RepeatCustomerInfo => {
        const dates = matches.map(m => m.signup_date).filter(Boolean) as string[];
        dates.sort();
        const last = dates[dates.length - 1] || null;
        const lastRow = matches.find(m => m.signup_date === last) || matches[0];
        return {
          policyCount: matches.length,
          lastPurchaseAt: last,
          lastPlanType: lastRow?.plan_type || null,
          matchedOn,
        };
      };

      const next: Record<string, RepeatCustomerInfo> = {};
      leads.forEach((l) => {
        const e = normEmail(l.email);
        const p = normReg(l.vehicle_reg);
        // A purchase only counts as a PRIOR policy if it happened before this
        // lead came in. This stops the lead's own sale (converted today) from
        // making the customer look like a returning buyer.
        const cutoff = l.created_at ? new Date(l.created_at).getTime() : null;
        const prior = (matches?: Row[]) =>
          (matches || []).filter(m => {
            if (!m.signup_date) return false;
            if (cutoff == null) return true;
            return new Date(m.signup_date).getTime() < cutoff;
          });
        const emailMatches = prior(e ? byEmail.get(e) : undefined);
        const regMatches = prior(p ? byReg.get(p) : undefined);
        if (emailMatches.length) next[l.id] = summarize(emailMatches, 'email');
        else if (regMatches.length) next[l.id] = summarize(regMatches, 'reg');
      });

      setRepeatByLeadId(next);
    } catch (e) {
      console.error('useRepeatCustomers error', e);
    } finally {
      setLoading(false);
    }
  }, [key, emails, regs, leads]);

  useEffect(() => {
    if (!key) return;
    if (debounceRef.current) clearTimeout(debounceRef.current);
    debounceRef.current = setTimeout(fetchAll, 1200);
    return () => { if (debounceRef.current) clearTimeout(debounceRef.current); };
  }, [key, fetchAll]);

  return { repeatByLeadId, loading };
};

/** Single-lead convenience wrapper (used by the new-lead pop-ups). */
export const useIsRepeatCustomer = (lead: RepeatLeadInput | null) => {
  const list = useMemo(() => (lead ? [lead] : []), [lead]);
  const { repeatByLeadId } = useRepeatCustomers(list);
  return lead ? repeatByLeadId[lead.id] : undefined;
};
