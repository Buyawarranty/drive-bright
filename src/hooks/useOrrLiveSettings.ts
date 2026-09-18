import { useEffect } from 'react';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';

export interface OrrLiveSettings {
  /** Teams that currently have Open Round Robin switched on. */
  enabledTeamIds: string[];
  /** ORR counts as live as soon as one team is switched on. */
  orrLive: boolean;
  teamNamesById: Record<string, string>;
}

export const ORR_LIVE_SETTINGS_KEY = ['orr-live-settings'] as const;

/**
 * Single source of truth for the Open Round Robin setup (which teams it serves
 * and whether it is live). Read from `lead_distribution_settings` + `lead_teams`
 * — exactly the rows the Lead Allocation page writes.
 *
 * Shared through React Query so the Lead Allocation page and the Open Round
 * Robin Sandbox always show the same picture, and kept fresh with a realtime
 * subscription so a change made on Lead Allocation lands on the sandbox (and
 * anywhere else reading this) without a reload. When ORR goes live the same
 * settings are already the ones acting for real — nothing to migrate.
 */
export function useOrrLiveSettings(enabled = true) {
  const queryClient = useQueryClient();

  const query = useQuery<OrrLiveSettings>({
    queryKey: ORR_LIVE_SETTINGS_KEY,
    enabled,
    staleTime: 15_000,
    refetchOnWindowFocus: true,
    queryFn: async () => {
      const [{ data: settings }, { data: teams }] = await Promise.all([
        supabase.from('lead_distribution_settings').select('team_id, open_round_robin_enabled'),
        supabase.from('lead_teams').select('id, name'),
      ]);
      const enabledTeamIds = (settings || [])
        .filter((r: any) => r.open_round_robin_enabled === true && r.team_id)
        .map((r: any) => r.team_id as string);
      return {
        enabledTeamIds,
        orrLive: enabledTeamIds.length > 0,
        teamNamesById: Object.fromEntries(
          ((teams as { id: string; name: string }[]) || []).map(t => [t.id, t.name]),
        ),
      };
    },
  });

  // Any allocation change (teams, ORR toggle, membership) refreshes every
  // surface that reads these settings — Lead Allocation and the sandbox alike.
  useEffect(() => {
    if (!enabled) return;
    const invalidate = () => {
      queryClient.invalidateQueries({ queryKey: ORR_LIVE_SETTINGS_KEY });
    };
    const channel = supabase
      .channel(`orr-live-settings-sync-${Math.random().toString(36).slice(2)}`)
      .on('postgres_changes', { event: '*', schema: 'public', table: 'lead_distribution_settings' }, invalidate)
      .on('postgres_changes', { event: '*', schema: 'public', table: 'lead_teams' }, invalidate)
      .on('postgres_changes', { event: '*', schema: 'public', table: 'lead_team_members' }, invalidate)
      .subscribe();
    return () => {
      supabase.removeChannel(channel);
    };
  }, [enabled, queryClient]);

  return {
    orrLive: query.data ? query.data.orrLive : null,
    enabledTeamIds: query.data?.enabledTeamIds ?? [],
    teamNamesById: query.data?.teamNamesById ?? {},
    loading: query.isLoading,
    refresh: () => queryClient.invalidateQueries({ queryKey: ORR_LIVE_SETTINGS_KEY }),
  };
}
