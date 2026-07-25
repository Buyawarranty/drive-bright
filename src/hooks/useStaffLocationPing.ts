import { useEffect, useRef } from 'react';
import { supabase } from '@/integrations/supabase/client';

/**
 * Pings the log-staff-location edge function once per session (and every 30 min)
 * so managers can see which location/network each staff member is working from.
 */
export const useStaffLocationPing = (enabled = true) => {
  const timerRef = useRef<ReturnType<typeof setInterval> | null>(null);

  useEffect(() => {
    if (!enabled) return;

    const ping = async () => {
      try {
        const { data: { session } } = await supabase.auth.getSession();
        if (!session) return;
        await supabase.functions.invoke('log-staff-location');
      } catch {
        // non-critical
      }
    };

    ping();
    timerRef.current = setInterval(ping, 30 * 60 * 1000);

    return () => {
      if (timerRef.current) clearInterval(timerRef.current);
    };
  }, [enabled]);
};
