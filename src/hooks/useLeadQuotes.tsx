import { useState, useEffect, useCallback, useRef, useMemo } from 'react';
import { supabase } from '@/integrations/supabase/client';

const BATCH_SIZE = 200;

export interface SentQuote {
  id: string;
  quote_reference: string;
  customer_email: string;
  vehicle_reg: string;
  plan_name: string;
  payment_type: string;
  total_price: number;
  monthly_price: number | null;
  sent_at: string;
  sent_by: string | null;
  resent_count: number;
  customer_responded: boolean;
  customer_purchased: boolean;
}

export const useLeadQuotes = (leadEmails: string[]) => {
  const [quotesByEmail, setQuotesByEmail] = useState<Record<string, SentQuote[]>>({});
  const [loading, setLoading] = useState(false);
  const lastFetchedKeyRef = useRef('');
  const debounceTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  // Create a stable key from unique emails (use count + first/last for speed)
  const uniqueEmails = useMemo(() => {
    const unique = [...new Set(leadEmails.filter(Boolean).map(e => e.toLowerCase()))];
    unique.sort();
    return unique;
  }, [leadEmails]);

  const emailsKey = useMemo(() => {
    if (uniqueEmails.length === 0) return '';
    return `${uniqueEmails.length}:${uniqueEmails[0]}:${uniqueEmails[uniqueEmails.length - 1]}`;
  }, [uniqueEmails]);

  const fetchQuotes = useCallback(async (key: string) => {
    if (!key) return;
    
    // Skip if we already fetched this exact set of emails
    if (lastFetchedKeyRef.current === key) return;
    lastFetchedKeyRef.current = key;
    
    setLoading(true);
    try {
      const grouped: Record<string, SentQuote[]> = {};

      // Batch the .in() query to avoid URL length limits
      for (let i = 0; i < uniqueEmails.length; i += BATCH_SIZE) {
        const batch = uniqueEmails.slice(i, i + BATCH_SIZE);
        const { data, error } = await supabase
          .from('admin_sent_quotes')
          .select(`
            id, quote_reference, customer_email, vehicle_reg, plan_name,
            payment_type, total_price, monthly_price, sent_at, sent_by,
            resent_count, customer_responded, customer_purchased
          `)
          .in('customer_email', batch)
          .order('sent_at', { ascending: false });

        if (error) {
          console.error('Error fetching quotes batch:', error);
          continue;
        }

        (data || []).forEach((quote: SentQuote) => {
          const email = quote.customer_email.toLowerCase();
          if (!grouped[email]) {
            grouped[email] = [];
          }
          grouped[email].push(quote);
        });
      }

      setQuotesByEmail(grouped);
    } catch (error) {
      console.error('Error fetching quotes for leads:', error);
    } finally {
      setLoading(false);
    }
  }, [uniqueEmails]);

  useEffect(() => {
    if (!emailsKey) return;
    
    // Debounce quote fetching to avoid rapid re-fetches when leads list updates
    if (debounceTimerRef.current) clearTimeout(debounceTimerRef.current);
    debounceTimerRef.current = setTimeout(() => {
      fetchQuotes(emailsKey);
    }, 1500);
    
    return () => {
      if (debounceTimerRef.current) clearTimeout(debounceTimerRef.current);
    };
  }, [emailsKey, fetchQuotes]);

  const refetch = useCallback(() => {
    lastFetchedKeyRef.current = ''; // Force refetch
    fetchQuotes(emailsKey);
  }, [emailsKey, fetchQuotes]);

  return { quotesByEmail, loading, refetch };
};
