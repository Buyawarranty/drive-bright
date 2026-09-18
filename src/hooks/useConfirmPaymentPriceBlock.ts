import { useCallback, useEffect, useState } from 'react';
import { supabase } from '@/integrations/supabase/client';

export const CONFIRM_PAYMENT_PRICE_BLOCK_KEY = 'confirm_payment_price_block_enabled';

/**
 * Whether Confirm external payment (Quotes & Orders) blocks agents who go past
 * the 30% ceiling / under the net floor.
 *
 * Defaults to OFF: no agent is blocked on Confirm payment unless management
 * switches this on from Lead Allocation (?tab=lead-teams). Kept live via
 * realtime so flipping it applies immediately.
 */
export function useConfirmPaymentPriceBlock() {
  const [enabled, setEnabledState] = useState(false);
  const [loading, setLoading] = useState(true);

  const fetchConfig = useCallback(async () => {
    const { data } = await supabase
      .from('admin_config')
      .select('config_value')
      .eq('config_key', CONFIRM_PAYMENT_PRICE_BLOCK_KEY)
      .maybeSingle();
    setEnabledState(data?.config_value === true);
    setLoading(false);
  }, []);

  useEffect(() => {
    fetchConfig();
    const channel = supabase
      .channel(`confirm-payment-price-block-config-${Math.random().toString(36).slice(2)}`)
      .on(
        'postgres_changes',
        {
          event: '*',
          schema: 'public',
          table: 'admin_config',
          filter: `config_key=eq.${CONFIRM_PAYMENT_PRICE_BLOCK_KEY}`,
        },
        () => fetchConfig()
      )
      .subscribe();
    return () => {
      supabase.removeChannel(channel);
    };
  }, [fetchConfig]);

  const setEnabled = useCallback(async (next: boolean) => {
    const { error } = await supabase
      .from('admin_config')
      .upsert(
        { config_key: CONFIRM_PAYMENT_PRICE_BLOCK_KEY, config_value: next, updated_at: new Date().toISOString() },
        { onConflict: 'config_key' }
      );
    if (error) return false;
    setEnabledState(next);
    return true;
  }, []);

  return { enabled, loading, setEnabled, refresh: fetchConfig };
}
