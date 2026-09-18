import { useCallback, useEffect, useMemo, useState } from 'react';
import { Coffee, Loader2, Play, Users, UtensilsCrossed, ChevronDown, ChevronUp } from 'lucide-react';
import { cn } from '@/lib/utils';
import { supabase } from '@/integrations/supabase/client';
import { useCurrentAdminId } from '@/hooks/useCurrentAdminId';
import { useSeesAllAgents } from '@/hooks/useSeesAllAgents';
import { Button } from '@/components/ui/button';
import { toast } from 'sonner';

type BreakStatus = 'available' | 'break' | 'lunch' | 'training' | 'meeting' | 'off';

interface StatusRow {
  admin_user_id: string;
  status: BreakStatus;
  reason: string | null;
  started_at: string;
}

interface AdminLite {
  id: string;
  first_name: string | null;
  last_name: string | null;
  email: string;
  role: string;
}

const PRESENCE_ROLES = ['sales', 'sales_lead', 'lead_gen', 'sales_manager', 'claims_agent', 'claims_manager'] as const;

const STATUS_META: Record<BreakStatus, { label: string; chip: string; dot: string }> = {
  available: { label: 'Available', chip: 'bg-teal-50 text-teal-700 border-teal-200', dot: 'bg-teal-500' },
  break: { label: 'On break', chip: 'bg-amber-50 text-amber-800 border-amber-200', dot: 'bg-amber-500' },
  lunch: { label: 'Lunch', chip: 'bg-orange-50 text-orange-800 border-orange-200', dot: 'bg-orange-500' },
  training: { label: 'Training', chip: 'bg-sky-50 text-sky-800 border-sky-200', dot: 'bg-sky-500' },
  meeting: { label: 'Meeting', chip: 'bg-violet-50 text-violet-800 border-violet-200', dot: 'bg-violet-500' },
  off: { label: 'Off shift', chip: 'bg-muted text-muted-foreground border-border', dot: 'bg-muted-foreground' },
};

const nameOf = (a: AdminLite) =>
  [a.first_name, a.last_name].filter(Boolean).join(' ').trim() ||
  (a.email || '').split('@')[0] ||
  'Team member';

/** Never trust the stored status blindly — an unknown value must not blank the page. */
const metaFor = (s: string | null | undefined) =>
  STATUS_META[(s as BreakStatus)] ?? STATUS_META.available;

const elapsed = (iso: string) => {
  const mins = Math.max(0, Math.floor((Date.now() - new Date(iso).getTime()) / 60000));
  if (mins < 60) return `${mins}m`;
  return `${Math.floor(mins / 60)}h ${mins % 60}m`;
};

const LUNCH_MINUTES = 60;

/** Remaining lunch time as m:ss, or null once the hour is used up. */
const lunchRemaining = (iso: string) => {
  const ms = new Date(iso).getTime() + LUNCH_MINUTES * 60000 - Date.now();
  if (ms <= 0) return null;
  const total = Math.floor(ms / 1000);
  return `${Math.floor(total / 60)}:${String(total % 60).padStart(2, '0')}`;
};

/**
 * Break / back-from-break control for the New Leads section.
 *
 * Every staff member gets a one-click "On break" toggle so the floor knows who is
 * away from the phones. Management sees a single line that expands to show every
 * agent's current state and how long they have been away.
 */
export const AgentBreakStrip = () => {
  const currentAdminId = useCurrentAdminId();
  const { seesAll: isManagement } = useSeesAllAgents();
  const [rows, setRows] = useState<StatusRow[]>([]);
  const [agents, setAgents] = useState<AdminLite[]>([]);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [expanded, setExpanded] = useState(false);
  const [, setTick] = useState(0);

  // Tick every second so the lunch countdown stays live.
  useEffect(() => {
    const t = setInterval(() => { if (document.hidden) return; setTick((n) => n + 1); }, 1000);
    return () => clearInterval(t);
  }, []);

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const [statusRes, agentsRes] = await Promise.all([
        (supabase as any).from('agent_break_status').select('admin_user_id, status, reason, started_at'),
        supabase
          .from('admin_users')
          .select('id, first_name, last_name, email, role')
          .eq('is_active', true)
          .in('role', PRESENCE_ROLES),
      ]);
      setRows(((statusRes.data as StatusRow[]) || []).filter(Boolean));
      setAgents(((agentsRes.data as AdminLite[]) || []).filter(Boolean));
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    load();
  }, [load]);

  // Live updates so managers see breaks appear without refreshing.
  useEffect(() => {
    const channel = (supabase as any)
      .channel(`agent-break-status-strip-${Math.random().toString(36).slice(2)}`)
      .on('postgres_changes', { event: '*', schema: 'public', table: 'agent_break_status' }, () => load())
      .subscribe();
    return () => {
      (supabase as any).removeChannel(channel);
    };
  }, [load]);

  const byAgent = useMemo(() => {
    const m = new Map<string, StatusRow>();
    rows.forEach((r) => m.set(r.admin_user_id, r));
    return m;
  }, [rows]);

  const mine = currentAdminId ? byAgent.get(currentAdminId) : undefined;
  const myStatus: BreakStatus = mine?.status || 'available';

  const setStatus = async (status: BreakStatus, reason?: string) => {
    if (!currentAdminId) {
      toast.error('Could not identify your staff record');
      return;
    }
    setSaving(true);
    try {
      const { error } = await (supabase as any).from('agent_break_status').upsert(
        {
          admin_user_id: currentAdminId,
          status,
          reason: reason ?? null,
          started_at: new Date().toISOString(),
        },
        { onConflict: 'admin_user_id' },
      );
      if (error) throw error;
      setRows((prev) => {
        const next = prev.filter((r) => r.admin_user_id !== currentAdminId);
        next.push({ admin_user_id: currentAdminId, status, reason: reason ?? null, started_at: new Date().toISOString() });
        return next;
      });
      toast.success(status === 'available' ? 'Welcome back — you are on the phones' : `Marked as ${metaFor(status).label.toLowerCase()}`);
    } catch (e: any) {
      toast.error(e?.message || 'Could not update your status');
    } finally {
      setSaving(false);
    }
  };

  const away = agents.filter((a) => {
    const s = byAgent.get(a.id)?.status;
    return s && s !== 'available';
  });
  const availableCount = agents.length - away.length;

  const onBreak = myStatus !== 'available';
  const myRemaining = onBreak && mine ? lunchRemaining(mine.started_at) : null;

  return (
    <div className="rounded-lg border bg-card">
      <div className="flex flex-wrap items-center gap-3 px-3 py-2">
        <div className="flex items-center gap-2 text-sm font-medium">
          <Coffee className="h-4 w-4 text-muted-foreground" />
          <span>Break status</span>
        </div>

        <span
          className={cn(
            'inline-flex items-center gap-1.5 rounded-full border px-2 py-0.5 text-xs font-medium',
            metaFor(myStatus).chip,
          )}
        >
          <span className={cn('h-1.5 w-1.5 rounded-full', metaFor(myStatus).dot)} />
          {metaFor(myStatus).label}
          {onBreak && mine ? (
            <span className="tabular-nums font-normal opacity-80">
              · {myRemaining ? `${myRemaining} left` : `over by ${elapsed(mine.started_at)}`}
            </span>
          ) : null}
        </span>

        <div className="flex flex-wrap items-center gap-2">
          {onBreak ? (
            <Button size="sm" className="h-7 gap-1.5" disabled={saving} onClick={() => setStatus('available')}>
              {saving ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <Play className="h-3.5 w-3.5" />}
              Back from lunch
            </Button>
          ) : (
            <Button
              size="sm"
              variant="outline"
              className="h-7 gap-1.5"
              disabled={saving}
              onClick={() => setStatus('lunch')}
            >
              <UtensilsCrossed className="h-3.5 w-3.5" />
              Lunch (1 hour)
            </Button>
          )}
        </div>

        <div className="ml-auto flex items-center gap-3 text-xs text-muted-foreground">
          {loading ? (
            <Loader2 className="h-3.5 w-3.5 animate-spin" />
          ) : (
            <span className="flex items-center gap-1.5">
              <Users className="h-3.5 w-3.5" />
              {availableCount} of {agents.length} on the phones
              {away.length > 0 ? ` · ${away.length} away` : ''}
            </span>
          )}
          {isManagement && (
            <button
              type="button"
              onClick={() => setExpanded((v) => !v)}
              className="flex items-center gap-1 font-medium text-foreground hover:underline"
            >
              {expanded ? 'Hide team' : 'View team'}
              {expanded ? <ChevronUp className="h-3.5 w-3.5" /> : <ChevronDown className="h-3.5 w-3.5" />}
            </button>
          )}
        </div>
      </div>

      {isManagement && expanded && (
        <div className="border-t px-3 py-2">
          {agents.length === 0 ? (
            <p className="py-2 text-xs text-muted-foreground">No active staff found.</p>
          ) : (
            <div className="grid gap-1.5 sm:grid-cols-2 lg:grid-cols-3">
              {agents
                .slice()
                .sort((a, b) => nameOf(a).localeCompare(nameOf(b)))
                .map((a) => {
                  const row = byAgent.get(a.id);
                  const s: BreakStatus = row?.status || 'available';
                  return (
                    <div
                      key={a.id}
                      className="flex items-center justify-between gap-2 rounded-md border bg-background px-2 py-1.5"
                    >
                      <span className="truncate text-xs font-medium">{nameOf(a)}</span>
                      <span
                        className={cn(
                          'inline-flex shrink-0 items-center gap-1.5 rounded-full border px-2 py-0.5 text-[11px] font-medium',
                          metaFor(s).chip,
                        )}
                      >
                        <span className={cn('h-1.5 w-1.5 rounded-full', metaFor(s).dot)} />
                        {metaFor(s).label}
                        {s !== 'available' && row ? (
                          <span className="tabular-nums font-normal opacity-80">
                            · {lunchRemaining(row.started_at) ? `${lunchRemaining(row.started_at)} left` : `over by ${elapsed(row.started_at)}`}
                          </span>
                        ) : null}
                      </span>
                    </div>
                  );
                })}
            </div>
          )}
        </div>
      )}
    </div>
  );
};
