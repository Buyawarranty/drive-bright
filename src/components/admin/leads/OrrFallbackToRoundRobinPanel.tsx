import { shouldSkipPoll } from '@/lib/crmTabCoordinator';
import React from 'react';
import { Users, RefreshCw, ArrowLeftRight } from 'lucide-react';
import { supabase } from '@/integrations/supabase/client';
import { Button } from '@/components/ui/button';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { toast } from 'sonner';
import { cn } from '@/lib/utils';
import { useOrrLiveSettings } from '@/hooks/useOrrLiveSettings';

const WAIT_OPTIONS = [5, 15, 30, 60, 120];
// How many leads to move in one go.
const BATCH_OPTIONS = [5, 10, 25, 50, 100];
// Only include leads that arrived recently ('all' = no limit).
const WINDOW_OPTIONS: { value: string; label: string }[] = [
  { value: 'all', label: 'Any time' },
  { value: '60', label: 'Last hour' },
  { value: '240', label: 'Last 4 hours' },
  { value: '1440', label: 'Last 24 hours' },
  { value: '4320', label: 'Last 3 days' },
  { value: '10080', label: 'Last 7 days' },
];

type Direction = 'orr_to_rr' | 'rr_to_orr';

/**
 * Hand waiting leads over between the two systems, in either direction:
 *   - Open Round Robin → Round Robin (nobody working the pool)
 *   - Round Robin → Open Round Robin (leads sat uncalled with the rotation)
 * Only uncalled leads are ever moved.
 */
export const OrrFallbackToRoundRobinPanel: React.FC<{ isManagement: boolean }> = ({ isManagement }) => {
  const { enabledTeamIds, teamNamesById } = useOrrLiveSettings(isManagement);
  const [direction, setDirection] = React.useState<Direction>('orr_to_rr');
  const [idleMinutes, setIdleMinutes] = React.useState(15);
  const [teamId, setTeamId] = React.useState<string>('any');
  const [newestFirst, setNewestFirst] = React.useState(false);
  const [batchSize, setBatchSize] = React.useState(50);
  const [windowMinutes, setWindowMinutes] = React.useState<string>('all');
  const [waiting, setWaiting] = React.useState<number | null>(null);
  const [busy, setBusy] = React.useState(false);

  const rrTeams = React.useMemo(
    () => Object.entries(teamNamesById).filter(([id]) => !enabledTeamIds.includes(id)),
    [teamNamesById, enabledTeamIds],
  );

  const loadCount = React.useCallback(async () => {
    const fn = direction === 'orr_to_rr' ? 'orr_pool_waiting_count' : 'orr_rr_waiting_count';
    const { data, error } = await (supabase as any).rpc(fn, {
      _idle_minutes: idleMinutes,
      _within_minutes: windowMinutes === 'all' ? null : Number(windowMinutes),
    });
    if (!error) setWaiting(typeof data === 'number' ? data : 0);
  }, [idleMinutes, direction, windowMinutes]);

  React.useEffect(() => {
    if (!isManagement) return;
    setWaiting(null);
    loadCount();
    const t = setInterval(() => { if (shouldSkipPoll()) return; loadCount(); }, 60_000);
    return () => clearInterval(t);
  }, [isManagement, loadCount]);

  if (!isManagement) return null;

  const handleSend = async () => {
    setBusy(true);
    try {
      const { data, error } =
        direction === 'orr_to_rr'
          ? await (supabase as any).rpc('orr_release_pool_to_round_robin', {
              _team_id: teamId === 'any' ? null : teamId,
              _max_leads: batchSize,
              _idle_minutes: idleMinutes,
              _newest_first: newestFirst,
              _within_minutes: windowMinutes === 'all' ? null : Number(windowMinutes),
            })
          : await (supabase as any).rpc('orr_send_rr_leads_to_pool', {
              _max_leads: batchSize,
              _idle_minutes: idleMinutes,
              _newest_first: newestFirst,
              _within_minutes: windowMinutes === 'all' ? null : Number(windowMinutes),
            });
      if (error) throw error;
      const moved = typeof data === 'number' ? data : 0;
      toast.success(
        moved > 0
          ? `${moved} lead${moved === 1 ? '' : 's'} moved to ${direction === 'orr_to_rr' ? 'the Round Robin rotation' : 'the Open Round Robin pool'}.`
          : 'No waiting leads to move right now.',
      );
      loadCount();
    } catch (e: any) {
      toast.error(e?.message || 'Could not move the leads.');
    } finally {
      setBusy(false);
    }
  };

  const dirButton = (value: Direction, label: string) => (
    <button
      key={value}
      type="button"
      onClick={() => setDirection(value)}
      className={cn(
        'px-3 py-1.5 rounded-md text-xs font-semibold border transition-colors',
        direction === value
          ? 'bg-primary text-primary-foreground border-primary'
          : 'bg-background text-foreground border-input hover:bg-muted',
      )}
    >
      {label}
    </button>
  );

  return (
    <div className="rounded-lg border border-border bg-card shadow-sm p-4 space-y-3">
      <div className="flex items-center gap-2">
        <Users className="h-4 w-4 text-primary" />
        <h3 className="text-sm font-semibold text-foreground">Move waiting leads between the two systems</h3>
      </div>

      <div className="flex flex-wrap items-center gap-2">
        <ArrowLeftRight className="h-4 w-4 text-muted-foreground" />
        {dirButton('orr_to_rr', 'Open Round Robin → Round Robin')}
        {dirButton('rr_to_orr', 'Round Robin → Open Round Robin')}
      </div>

      <ul className="text-xs text-muted-foreground list-disc pl-4 space-y-0.5">
        {direction === 'orr_to_rr' ? (
          <>
            <li>Use when nobody is working the Open Round Robin pool.</li>
            <li>Only leads still unclaimed and never called are moved.</li>
          </>
        ) : (
          <>
            <li>Use when leads are sitting with the normal rotation and nobody has rung them.</li>
            <li>They go back into the Open Round Robin pool and are offered to the next available agent.</li>
          </>
        )}
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
          <label className="block text-xs font-medium text-foreground">Arrived within</label>
          <Select value={windowMinutes} onValueChange={setWindowMinutes}>
            <SelectTrigger className="w-40 h-9"><SelectValue /></SelectTrigger>
            <SelectContent>
              {WINDOW_OPTIONS.map(o => (
                <SelectItem key={o.value} value={o.value}>{o.label}</SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>

        <div className="space-y-1">
          <label className="block text-xs font-medium text-foreground">Take</label>
          <Select value={newestFirst ? 'newest' : 'oldest'} onValueChange={v => setNewestFirst(v === 'newest')}>
            <SelectTrigger className="w-40 h-9"><SelectValue /></SelectTrigger>
            <SelectContent>
              <SelectItem value="oldest">Oldest first</SelectItem>
              <SelectItem value="newest">Newest first</SelectItem>
            </SelectContent>
          </Select>
        </div>

        <div className="space-y-1">
          <label className="block text-xs font-medium text-foreground">How many</label>
          <Select value={String(batchSize)} onValueChange={v => setBatchSize(Number(v))}>
            <SelectTrigger className="w-32 h-9"><SelectValue /></SelectTrigger>
            <SelectContent>
              {BATCH_OPTIONS.map(n => (
                <SelectItem key={n} value={String(n)}>{n} leads</SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>

        {direction === 'orr_to_rr' && (
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
        )}

        <div className="flex items-center gap-2">
          <Button onClick={handleSend} disabled={busy || (waiting ?? 0) === 0} className="h-9">
            {busy
              ? 'Moving…'
              : `Move ${Math.min(batchSize, waiting ?? 0)} of ${waiting ?? 0} waiting lead${(waiting ?? 0) === 1 ? '' : 's'}`}
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
