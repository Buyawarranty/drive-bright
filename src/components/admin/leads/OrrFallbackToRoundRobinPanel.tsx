import React from 'react';
import { Users, RefreshCw } from 'lucide-react';
import { supabase } from '@/integrations/supabase/client';
import { Button } from '@/components/ui/button';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { toast } from 'sonner';
import { useOrrLiveSettings } from '@/hooks/useOrrLiveSettings';

const WAIT_OPTIONS = [5, 15, 30, 60, 120];

/**
 * "Nobody working Open Round Robin?" — hands waiting pool leads over to the
 * normal Round Robin rotation, so a lead never sits unworked when no ORR agent
 * is on. Only uncalled, unassigned pool leads are moved.
 */
export const OrrFallbackToRoundRobinPanel: React.FC<{ isManagement: boolean }> = ({ isManagement }) => {
  const { enabledTeamIds, teamNamesById } = useOrrLiveSettings(isManagement);
  const [idleMinutes, setIdleMinutes] = React.useState(15);
  const [teamId, setTeamId] = React.useState<string>('any');
  const [waiting, setWaiting] = React.useState<number | null>(null);
  const [busy, setBusy] = React.useState(false);

  const rrTeams = React.useMemo(
    () => Object.entries(teamNamesById).filter(([id]) => !enabledTeamIds.includes(id)),
    [teamNamesById, enabledTeamIds],
  );

  const loadCount = React.useCallback(async () => {
    const { data, error } = await (supabase as any).rpc('orr_pool_waiting_count', { _idle_minutes: idleMinutes });
    if (!error) setWaiting(typeof data === 'number' ? data : 0);
  }, [idleMinutes]);

  React.useEffect(() => {
    if (!isManagement) return;
    loadCount();
    const t = setInterval(loadCount, 60_000);
    return () => clearInterval(t);
  }, [isManagement, loadCount]);

  if (!isManagement) return null;

  const handleSend = async () => {
    setBusy(true);
    try {
      const { data, error } = await (supabase as any).rpc('orr_release_pool_to_round_robin', {
        _team_id: teamId === 'any' ? null : teamId,
        _max_leads: 100,
        _idle_minutes: idleMinutes,
      });
      if (error) throw error;
      const moved = typeof data === 'number' ? data : 0;
      toast.success(
        moved > 0
          ? `${moved} lead${moved === 1 ? '' : 's'} sent to the Round Robin rotation.`
          : 'No waiting leads to send right now.',
      );
      loadCount();
    } catch (e: any) {
      toast.error(e?.message || 'Could not send the leads.');
    } finally {
      setBusy(false);
    }
  };

  return (
    <div className="rounded-lg border border-border bg-card shadow-sm p-4 space-y-3">
      <div className="flex items-center gap-2">
        <Users className="h-4 w-4 text-primary" />
        <h3 className="text-sm font-semibold text-foreground">Nobody working Open Round Robin?</h3>
      </div>
      <ul className="text-xs text-muted-foreground list-disc pl-4 space-y-0.5">
        <li>Sends leads sitting in the Open Round Robin pool over to the normal Round Robin team.</li>
        <li>Only leads that are still unassigned and have never been called are moved.</li>
        <li>Each lead gets a note saying why it moved. Nothing already being worked is touched.</li>
      </ul>

      <div className="flex flex-wrap items-end gap-3">
        <div className="space-y-1">
          <label className="block text-xs font-medium text-foreground">Waiting longer than</label>
          <Select value={String(idleMinutes)} onValueChange={v => setIdleMinutes(Number(v))}>
            <SelectTrigger className="w-40 h-9"><SelectValue /></SelectTrigger>
            <SelectContent>
              {WAIT_OPTIONS.map(m => (
                <SelectItem key={m} value={String(m)}>{m} minutes</SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>

        <div className="space-y-1">
          <label className="block text-xs font-medium text-foreground">Send to</label>
          <Select value={teamId} onValueChange={setTeamId}>
            <SelectTrigger className="w-56 h-9"><SelectValue /></SelectTrigger>
            <SelectContent>
              <SelectItem value="any">Any available agent</SelectItem>
              {rrTeams.map(([id, name]) => (
                <SelectItem key={id} value={id}>{name}</SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>

        <div className="flex items-center gap-2">
          <Button onClick={handleSend} disabled={busy || (waiting ?? 0) === 0} className="h-9">
            {busy ? 'Sending…' : `Send ${waiting ?? 0} waiting lead${(waiting ?? 0) === 1 ? '' : 's'}`}
          </Button>
          <Button variant="outline" size="icon" className="h-9 w-9" onClick={loadCount} title="Refresh count">
            <RefreshCw className="h-4 w-4" />
          </Button>
        </div>
      </div>
    </div>
  );
};

export default OrrFallbackToRoundRobinPanel;
