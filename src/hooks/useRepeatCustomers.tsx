import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { supabase } from '@/integrations/supabase/client';

/**
 * Flags leads that belong to a REPEAT CUSTOMER — someone who has already
 * bought a warranty from us before (a live/expired policy exists on the
 * `customers` table).
 *
 * Matching is deliberately wide: normalized email OR registration plate OR
 * phone number (last 9 digits) OR full name. A returning customer who uses a
 * new email address or a different vehicle must still be recognised, which is
 * the same rule the database uses to keep them with their original agent.
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
  /** Which identifier linked the lead to the previous customer record. */
  matchedOn: 'email' | 'reg' | 'phone' | 'name';
}

export interface RepeatLeadInput {
  id: string;
  email?: string | null;
  vehicle_reg?: string | null;
  phone?: string | null;
  first_name?: string | null;
  last_name?: string | null;
  /**
   * When the lead arrived. Only purchases made BEFORE this count as prior
   * policies — otherwise the lead's own conversion would flag it as "repeat".
   */
  created_at?: string | null;
}

const BATCH = 200;
const EXCLUDED_STATUSES = ['cancelled', 'refunded'];
/** Names shorter than this (after stripping punctuation) are too weak to match on. */
const MIN_NAME_LEN = 7;

const normReg = (r?: string | null) => (r || '').toUpperCase().replace(/\s+/g, '');
const normEmail = (e?: string | null) => (e || '').trim().toLowerCase();
/** Last 9 digits — matches the DB's phone tail-9 rule (ignores 0/+44 prefixes). */
const normPhone = (p?: string | null) => {
  const digits = (p || '').replace(/\D/g, '');
  return digits.length >= 9 ? digits.slice(-9) : '';
};
const normName = (...parts: (string | null | undefined)[]) => {
  const n = parts.map(p => p || '').join('').toLowerCase().replace(/[^a-z0-9]/g, '');
  return n.length >= MIN_NAME_LEN ? n : '';
};

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
  const phones = useMemo(
    () => [...new Set(leads.map(l => normPhone(l.phone)).filter(Boolean))].sort(),
    [leads]
  );
  const names = useMemo(
    () => [...new Set(leads.map(l => normName(l.first_name, l.last_name)).filter(Boolean))].sort(),
    [leads]
  );

  const key = useMemo(() => {
    if (!emails.length && !regs.length && !phones.length && !names.length) return '';
    const sig = (arr: string[]) => `${arr.length}:${arr[0] || ''}:${arr[arr.length - 1] || ''}`;
    return [sig(emails), sig(regs), sig(phones), sig(names)].join('|');
  }, [emails, regs, phones, names]);

  const fetchAll = useCallback(async () => {
    if (!key || lastKeyRef.current === key) return;
    lastKeyRef.current = key;
    setLoading(true);

    type Row = {
      id: string;
      email: string | null;
      registration_plate: string | null;
      phone: string | null;
      name: string | null;
      signup_date: string | null;
      plan_type: string | null;
      status: string | null;
      warranty_number?: string | null;
    };
    const COLS = 'id, email, registration_plate, phone, name, signup_date, plan_type, status, warranty_number';
    const rows: Row[] = [];

    try {
      // PERF: one indexed server-side lookup instead of dozens of parallel
      // 25-way `phone ilike '%tail9'` / `name ilike` scans over customers.
      // Those were the single heaviest queries in the whole CRM.
      const { data, error } = await (supabase as any).rpc('match_repeat_customers', {
        p_emails: emails,
        p_regs: regs,
        p_phone_tails: phones,
        p_names: names,
      });
      if (error) throw error;
      rows.push(...((data || []) as Row[]));


      // The same customer record is returned by several of the parallel lookups
      // (email + reg + phone + name), so collapse to one row per record first —
      // otherwise a single previous policy is counted four or five times.
      const uniqueRows = [...new Map(rows.filter(r => r?.id).map(r => [r.id, r])).values()];

      const byEmail = new Map<string, Row[]>();
      const byReg = new Map<string, Row[]>();
      const byPhone = new Map<string, Row[]>();
      const byName = new Map<string, Row[]>();
      const add = (map: Map<string, Row[]>, k: string, r: Row) => {
        if (!k) return;
        map.set(k, [...(map.get(k) || []), r]);
      };
      uniqueRows.forEach((r) => {
        if (EXCLUDED_STATUSES.includes((r.status || '').toLowerCase())) return;
        add(byEmail, normEmail(r.email), r);
        add(byReg, normReg(r.registration_plate), r);
        add(byPhone, normPhone(r.phone), r);
        add(byName, normName(r.name), r);
      });

      /** One policy = one warranty number, or one plate bought on one day. */
      const dedupePolicies = (matches: Row[]) =>
        [...new Map(
          matches.map(m => [
            (m.warranty_number || '').trim() ||
              `${normReg(m.registration_plate)}|${(m.signup_date || '').slice(0, 10)}`,
            m,
          ])
        ).values()];

      const summarize = (rawMatches: Row[], matchedOn: RepeatCustomerInfo['matchedOn']): RepeatCustomerInfo => {
        const matches = dedupePolicies(rawMatches);
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

        const e = normEmail(l.email);
        const p = normReg(l.vehicle_reg);
        const ph = normPhone(l.phone);
        const nm = normName(l.first_name, l.last_name);

        const emailMatches = prior(e ? byEmail.get(e) : undefined);
        const phoneMatches = prior(ph ? byPhone.get(ph) : undefined);
        const regMatches = prior(p ? byReg.get(p) : undefined);
        const nameMatches = prior(nm ? byName.get(nm) : undefined);

        // Strongest signal first: email → phone → registration → name.
        if (emailMatches.length) next[l.id] = summarize(emailMatches, 'email');
        else if (phoneMatches.length) next[l.id] = summarize(phoneMatches, 'phone');
        else if (regMatches.length) next[l.id] = summarize(regMatches, 'reg');
        else if (nameMatches.length) next[l.id] = summarize(nameMatches, 'name');
      });

      setRepeatByLeadId(next);
    } catch (e) {
      console.error('useRepeatCustomers error', e);
    } finally {
      setLoading(false);
    }
  }, [key, emails, regs, phones, names, leads]);

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
