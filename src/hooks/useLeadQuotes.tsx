import { useState, useEffect, useCallback } from 'react';
import { supabase } from '@/integrations/supabase/client';

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

  const fetchQuotes = useCallback(async () => {
    if (leadEmails.length === 0) return;
    
    setLoading(true);
    try {
      // Get unique emails
      const uniqueEmails = [...new Set(leadEmails.filter(Boolean))];
      
      const { data, error } = await supabase
        .from('admin_sent_quotes')
        .select(`
          id, quote_reference, customer_email, vehicle_reg, plan_name,
          payment_type, total_price, monthly_price, sent_at, sent_by,
          resent_count, customer_responded, customer_purchased
        `)
        .in('customer_email', uniqueEmails)
        .order('sent_at', { ascending: false });

      if (error) throw error;

      // Group quotes by email
      const grouped: Record<string, SentQuote[]> = {};
      (data || []).forEach((quote: SentQuote) => {
        const email = quote.customer_email.toLowerCase();
        if (!grouped[email]) {
          grouped[email] = [];
        }
        grouped[email].push(quote);
      });

      setQuotesByEmail(grouped);
    } catch (error) {
      console.error('Error fetching quotes for leads:', error);
    } finally {
      setLoading(false);
    }
  }, [leadEmails.join(',')]); // Use join to create stable dependency

  useEffect(() => {
    fetchQuotes();
  }, [fetchQuotes]);

  return { quotesByEmail, loading, refetch: fetchQuotes };
};
