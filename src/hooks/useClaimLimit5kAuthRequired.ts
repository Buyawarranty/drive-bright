import { useCallback, useEffect, useState } from 'react';
import { supabase } from '@/integrations/supabase/client';

export const CLAIM_LIMIT_5K_AUTH_KEY = 'claim_limit_5000_auth_required';

/**
 * Whether agents need manager authorisation to quote the £5,000 claim limit.
 * Defaults to required (true) when no config row exists. Kept live via realtime
 * so switching it off on Price updates unlocks Quotes & Orders immediately.
 */
export function useClaimLimit5kAuthRequired() {
  const [required, setRequiredState] = useState(true);
  const [loading, setLoading] = useState(true);

  const fetchConfig = useCallback(async () => {
    const { data } = await supabase
      .from('admin_config')
      .select('config_value')
      .eq('config_key', CLAIM_LIMIT_5K_AUTH_KEY)
      .maybeSingle();
    setRequiredState(data?.config_value === false ? false : true);
    setLoading(false);
  }, []);

  useEffect(() => {
    fetchConfig();
    const channel = supabase
      .channel('claim-limit-5k-auth-config')
      .on(
        'postgres_changes',
        {
          event: '*',
          schema: 'public',
          table: 'admin_config',
          filter: `config_key=eq.${CLAIM_LIMIT_5K_AUTH_KEY}`,
        },
        () => fetchConfig()
      )
      .subscribe();
    return () => {
      supabase.removeChannel(channel);
    };
  }, [fetchConfig]);

  const setRequired = useCallback(async (next: boolean) => {
    const { error } = await supabase
      .from('admin_config')
      .upsert(
        { config_key: CLAIM_LIMIT_5K_AUTH_KEY, config_value: next, updated_at: new Date().toISOString() },
        { onConflict: 'config_key' }
      );
    if (error) return false;
    setRequiredState(next);
    return true;
  }, []);

  return { required, loading, setRequired, refresh: fetchConfig };
}
