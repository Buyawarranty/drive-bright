import { useCallback, useEffect, useState } from 'react';
import { supabase } from '@/integrations/supabase/client';

type AgentOpenPoolModeState = {
  adminId: string | null;
  isOpenPoolAgent: boolean;
  /** True when the agent is configured for open_pool but currently paused by a manager. */
  isOpenPoolPaused: boolean;
  loading: boolean;
};

/**
 * Reads the per-agent Allocate Leads mode for the signed-in admin user.
 * This is intentionally independent from the global Open Lead Pool switch:
 * if an agent is set to `open_pool`, their bar/popup must be live.
 */
export function useAgentOpenPoolMode(preferredAdminId?: string | null) {
  const [state, setState] = useState<AgentOpenPoolModeState>({
    adminId: preferredAdminId ?? null,
    isOpenPoolAgent: false,
    loading: true,
  });

  const load = useCallback(async () => {
    let resolvedAdminId = preferredAdminId ?? null;
    setState(prev => ({ ...prev, adminId: resolvedAdminId ?? prev.adminId, loading: true }));

    try {
      if (!resolvedAdminId) {
        const { data: userData } = await supabase.auth.getUser();
        if (userData.user?.id) {
          const { data: adminUser } = await supabase
            .from('admin_users')
            .select('id')
            .eq('user_id', userData.user.id)
            .maybeSingle();
          resolvedAdminId = adminUser?.id ?? null;
        }
      }

      if (!resolvedAdminId) {
        setState({ adminId: null, isOpenPoolAgent: false, loading: false });
        return;
      }

      const { data } = await supabase
        .from('agent_distribution_caps')
        .select('assignment_mode, paused')
        .eq('admin_user_id', resolvedAdminId)
        .maybeSingle();

      if (!data) {
        setState({
          adminId: resolvedAdminId,
          isOpenPoolAgent: false,
          loading: false,
        });
        return;
      }


      const mode = ((data as any)?.assignment_mode ?? 'round_robin') as string;
      const paused = !!(data as any)?.paused;
      setState({
        adminId: resolvedAdminId,
        isOpenPoolAgent: mode === 'open_pool' && !paused,
        loading: false,
      });
    } catch {
      setState(prev => ({
        adminId: resolvedAdminId ?? prev.adminId,
        isOpenPoolAgent: false,
        loading: false,
      }));
    }
  }, [preferredAdminId]);

  useEffect(() => { load(); }, [load]);

  useEffect(() => {
    const adminId = state.adminId;
    if (!adminId) return;

    const channel = supabase
      .channel(`agent-open-pool-mode-${adminId}`)
      .on(
        'postgres_changes',
        { event: '*', schema: 'public', table: 'agent_distribution_caps', filter: `admin_user_id=eq.${adminId}` },
        () => load(),
      )
      .subscribe();

    const refreshIfVisible = () => {
      if (document.visibilityState === 'visible') load();
    };
    window.addEventListener('focus', load);
    document.addEventListener('visibilitychange', refreshIfVisible);

    return () => {
      supabase.removeChannel(channel);
      window.removeEventListener('focus', load);
      document.removeEventListener('visibilitychange', refreshIfVisible);
    };
  }, [load, state.adminId]);

  return { ...state, reload: load };
}