import { useEffect, useMemo, useRef, useState, useCallback } from 'react';
import { supabase } from '@/integrations/supabase/client';

/**
 * Aggregates the most recent CUSTOMER-side signals for a set of emails so
 * agents can see when a lead last did something themselves — e.g. requested
 * another quote, filled in step 2, or logged into the customer portal.
 *
 * Sources merged (max timestamp wins):
 *  - abandoned_carts.updated_at        → they filled/updated the quote form
 *  - live_quotes.updated_at            → they opened / re-fetched a live quote
 *  - step2_submission_attempts.created_at → they submitted step 2 details
 *  - customer_login_attempts.created_at (success) → they logged in
 */

export interface CustomerActivity {
  lastAt: string;
  source: 'filled_quote_form' | 'shopping_page' | 'checkout_page' | 'portal_login';
}

const SOURCE_LABEL: Record<CustomerActivity['source'], string> = {
  filled_quote_form: 'Filled quote form',
  shopping_page: 'Shopping page',
  checkout_page: 'Checkout page',
  portal_login: 'Logged into portal',
};

export const getCustomerActivityLabel = (s: CustomerActivity['source']) => SOURCE_LABEL[s];

const BATCH = 200;

export const useCustomerActivity = (emails: string[]) => {
  const [activityByEmail, setActivityByEmail] = useState<Record<string, CustomerActivity>>({});
  const [loading, setLoading] = useState(false);
  const lastKeyRef = useRef('');
  const debounceRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  const uniqueEmails = useMemo(() => {
    const set = new Set(emails.filter(Boolean).map(e => e.toLowerCase()));
    return [...set].sort();
  }, [emails]);

  const key = useMemo(() => {
    if (!uniqueEmails.length) return '';
    return `${uniqueEmails.length}:${uniqueEmails[0]}:${uniqueEmails[uniqueEmails.length - 1]}`;
  }, [uniqueEmails]);

  const fetchAll = useCallback(async () => {
    if (!key || lastKeyRef.current === key) return;
    lastKeyRef.current = key;
    setLoading(true);

    const merged: Record<string, CustomerActivity> = {};
    const upsert = (email: string, at: string | null, source: CustomerActivity['source']) => {
      if (!email || !at) return;
      const k = email.toLowerCase();
      const existing = merged[k];
      if (!existing || new Date(at).getTime() > new Date(existing.lastAt).getTime()) {
        merged[k] = { lastAt: at, source };
      }
    };

    try {
      for (let i = 0; i < uniqueEmails.length; i += BATCH) {
        const batch = uniqueEmails.slice(i, i + BATCH);

        const [carts, quotes, step2, logins] = await Promise.all([
          supabase.from('abandoned_carts')
            .select('email, updated_at, created_at, step_abandoned')
            .in('email', batch)
            .order('updated_at', { ascending: false })
            .limit(batch.length * 3),
          supabase.from('live_quotes')
            .select('customer_email, updated_at, created_at')
            .in('customer_email', batch)
            .order('updated_at', { ascending: false })
            .limit(batch.length * 3),
          supabase.from('step2_submission_attempts')
            .select('email, created_at')
            .in('email', batch)
            .order('created_at', { ascending: false })
            .limit(batch.length * 3),
          supabase.from('customer_login_attempts')
            .select('email, created_at, event_type, success')
            .in('email', batch)
            .eq('event_type', 'login_success')
            .eq('success', true)
            .order('created_at', { ascending: false })
            .limit(batch.length * 3),
        ]);

        (carts.data || []).forEach((r: any) => {
          const at = r.updated_at || r.created_at;
          const step = Number(r.step_abandoned) || 0;
          // step_abandoned: 2 = quote form, 3 = shopping/pricing, 4 = checkout
          const source: CustomerActivity['source'] =
            step >= 4 ? 'checkout_page' : step === 3 ? 'shopping_page' : 'filled_quote_form';
          upsert(r.email, at, source);
        });
        // Viewing a live quote link = shopping page (Step 3)
        (quotes.data || []).forEach((r: any) => upsert(r.customer_email, r.updated_at || r.created_at, 'shopping_page'));
        (step2.data || []).forEach((r: any) => upsert(r.email, r.created_at, 'filled_quote_form'));
        (logins.data || []).forEach((r: any) => upsert(r.email, r.created_at, 'portal_login'));
      }

      setActivityByEmail(merged);
    } catch (e) {
      console.error('useCustomerActivity error', e);
    } finally {
      setLoading(false);
    }
  }, [key, uniqueEmails]);

  useEffect(() => {
    if (!key) return;
    if (debounceRef.current) clearTimeout(debounceRef.current);
    debounceRef.current = setTimeout(fetchAll, 1500);
    return () => { if (debounceRef.current) clearTimeout(debounceRef.current); };
  }, [key, fetchAll]);

  return { activityByEmail, loading };
};
