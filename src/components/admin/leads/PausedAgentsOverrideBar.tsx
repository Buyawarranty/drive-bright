import React from 'react';
import { supabase } from '@/integrations/supabase/client';
import { format } from 'date-fns';
import { AlertTriangle, CheckCircle2, Loader2, ShieldCheck } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { toast } from 'sonner';
import { TeamBadge } from './TeamBadge';

interface PausedRow {
  admin_user_id: string;
  name: string;
  freeze_source: string | null;
  freeze_reason: string | null;
  frozen_until: string | null;
}

/**
 * Top-of-page alert for Lead Allocation.
 *
 * Shows every sales agent whose leads are currently switched OFF (either by the
 * automatic no-sales freeze or by a manager) and gives managers a one-click
 * override to put them straight back into the rotation.
 */
export const PausedAgentsOverrideBar: React.FC<{ canEdit?: boolean }> = ({ canEdit = true }) => {
  const [rows, setRows] = React.useState<PausedRow[]>([]);
  const [activeCount, setActiveCount] = React.useState(0);
  const [loading, setLoading] = React.useState(true);
  const [busy, setBusy] = React.useState<string | null>(null);

  const load = React.useCallback(async () => {
    const [{ data: caps }, { data: admins }] = await Promise.all([
      supabase
        .from('agent_distribution_caps')
        .select('admin_user_id, paused, freeze_source, freeze_reason, frozen_until'),
      supabase
        .from('admin_users')
        .select('id, first_name, last_name, email')
        .in('role', ['sales', 'sales_lead'])
        .eq('is_active', true)
        .is('archived_at', null),
    ]);

    const capMap = new Map<string, any>();
    (caps || []).forEach((c: any) => capMap.set(c.admin_user_id, c));

    const paused: PausedRow[] = [];
    let receiving = 0;
    (admins || []).forEach((a: any) => {
      const cap = capMap.get(a.id) || {};
      const name = `${a.first_name || ''} ${a.last_name || ''}`.trim() || String(a.email).split('@')[0];
      if (cap.paused === true) {
        paused.push({
          admin_user_id: a.id,
          name,
          freeze_source: cap.freeze_source ?? null,
          freeze_reason: cap.freeze_reason ?? null,
          frozen_until: cap.frozen_until ?? null,
        });
      } else {
        receiving += 1;
      }
    });

    paused.sort((a, b) => a.name.localeCompare(b.name));
    setRows(paused);
    setActiveCount(receiving);
    setLoading(false);
  }, []);

  React.useEffect(() => { load(); }, [load]);

  // Live updates when a freeze lands or a manager toggles someone elsewhere.
  React.useEffect(() => {
    const ch = supabase
      .channel(`paused-agents-override-bar-${Math.random().toString(36).slice(2)}`)
      .on(
        'postgres_changes',
        { event: '*', schema: 'public', table: 'agent_distribution_caps' },
        () => load(),
      )
      .subscribe();
    return () => { supabase.removeChannel(ch); };
  }, [load]);

  const override = async (row: PausedRow) => {
    setBusy(row.admin_user_id);
    const { error } = await supabase.rpc('set_agent_lead_allocation', {
      _admin_user_id: row.admin_user_id,
      _enabled: true,
    });
    setBusy(null);
    if (error) {
      toast.error(error.message || `Could not switch leads back on for ${row.name}`);
      return;
    }
    toast.success(`${row.name} is back in the rotation`);
    load();
  };

  const overrideAll = async () => {
    setBusy('all');
    for (const row of rows) {
      const { error } = await supabase.rpc('set_agent_lead_allocation', {
        _admin_user_id: row.admin_user_id,
        _enabled: true,
      });
      if (error) console.warn('[PausedAgentsOverrideBar] failed for', row.name, error);
    }
    setBusy(null);
    toast.success('All frozen agents are back in the rotation');
    load();
  };

  if (loading) return null;

  if (rows.length === 0) {
    return (
      <div className="rounded-lg border border-emerald-300 bg-emerald-50 px-4 py-2.5 flex items-center gap-2 text-sm text-emerald-900">
        <CheckCircle2 className="h-4 w-4 shrink-0" />
        <span>
          <strong>All {activeCount} agent{activeCount === 1 ? '' : 's'} are receiving leads.</strong> New enquiries are
          shared out one at a time to whoever has the fewest today.
        </span>
      </div>
    );
  }

  return (
    <div className="rounded-lg border-2 border-rose-400 bg-rose-50 overflow-hidden">
      <div className="px-4 py-3 flex flex-wrap items-start justify-between gap-3">
        <div className="flex items-start gap-2 min-w-0">
          <AlertTriangle className="h-5 w-5 text-rose-600 shrink-0 mt-0.5" />
          <div className="min-w-0">
            <div className="text-sm font-bold text-rose-900">
              {rows.length} agent{rows.length === 1 ? ' is' : 's are'} switched OFF and getting no new leads
            </div>
            <p className="text-xs text-rose-800 mt-0.5 max-w-3xl">
              While they're off, the round robin skips them — every new enquiry goes to the {activeCount} agent
              {activeCount === 1 ? '' : 's'} still switched on. Override below if you need them taking leads today.
            </p>
          </div>
        </div>
        {canEdit && rows.length > 1 && (
          <Button
            size="sm"
            className="h-8 bg-rose-600 hover:bg-rose-700 text-white shrink-0"
            disabled={busy !== null}
            onClick={overrideAll}
          >
            {busy === 'all' ? <Loader2 className="h-3.5 w-3.5 mr-1.5 animate-spin" /> : <ShieldCheck className="h-3.5 w-3.5 mr-1.5" />}
            Override all — switch leads on
          </Button>
        )}
      </div>

      <div className="border-t border-rose-200 divide-y divide-rose-200 bg-white/60">
        {rows.map(row => (
          <div key={row.admin_user_id} className="px-4 py-2.5 flex flex-wrap items-center justify-between gap-3">
            <div className="min-w-0">
              <div className="text-sm font-semibold text-foreground flex flex-wrap items-center gap-2">
                {row.name}
                <TeamBadge userId={row.admin_user_id} variant="pill" />
                <span className="inline-flex items-center rounded-full border border-rose-400 px-2 py-0.5 text-[10px] font-semibold uppercase tracking-wide text-rose-700">
                  {row.freeze_source === 'auto' ? 'Auto freeze' : 'Switched off by manager'}
                </span>
              </div>
              <div className="text-[11px] text-muted-foreground mt-0.5">
                {row.freeze_reason || 'No reason recorded'}
                {row.frozen_until && row.freeze_source === 'auto' && (
                  <> · lifts {format(new Date(row.frozen_until), 'EEE d MMM')}</>
                )}
              </div>
            </div>
            {canEdit && (
              <Button
                size="sm"
                variant="outline"
                className="h-8 border-rose-400 text-rose-700 hover:bg-rose-100 shrink-0"
                disabled={busy !== null}
                onClick={() => override(row)}
              >
                {busy === row.admin_user_id
                  ? <Loader2 className="h-3.5 w-3.5 mr-1.5 animate-spin" />
                  : <ShieldCheck className="h-3.5 w-3.5 mr-1.5" />}
                Override — give leads
              </Button>
            )}
          </div>
        ))}
      </div>

      <div className="px-4 py-2 border-t border-rose-200 bg-rose-50 text-[11px] text-rose-800">
        Overriding switches leads back on now and beats the automatic rule for the rest of the day. A sale today also
        clears the freeze on its own.
      </div>
    </div>
  );
};

export default PausedAgentsOverrideBar;
