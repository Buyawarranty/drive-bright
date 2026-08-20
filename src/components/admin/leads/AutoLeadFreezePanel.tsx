import React from 'react';
import { supabase } from '@/integrations/supabase/client';
import { format } from 'date-fns';
import { Snowflake, RefreshCw, Info, ShieldCheck } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Switch } from '@/components/ui/switch';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { toast } from 'sonner';

interface Row {
  admin_user_id: string;
  name: string;
  paused: boolean;
  auto_freeze_enabled: boolean;
  freeze_source: string | null;
  freeze_reason: string | null;
  frozen_until: string | null;
  outcome?: string;
  reason?: string;
  freeze_days?: number;
  sales_in_window?: number;
  revenue_mtd?: number;
  pro_rata_target?: number | null;
  monthly_target?: number | null;
}

const gbp = (n?: number | null) =>
  n == null ? '—' : `£${Math.round(Number(n)).toLocaleString()}`;

/**
 * Live per-agent lead allocation switch with the automatic two-day
 * no-sales freeze. Pro-rata on-target agents are exempt.
 */
export const AutoLeadFreezePanel: React.FC<{ canEdit?: boolean }> = ({ canEdit = true }) => {
  const [rows, setRows] = React.useState<Row[]>([]);
  const [loading, setLoading] = React.useState(true);
  const [busy, setBusy] = React.useState<string | null>(null);

  const load = React.useCallback(async (runRules: boolean) => {
    setLoading(true);
    try {
      let evaluated: any[] = [];
      if (runRules) {
        const { data, error } = await supabase.rpc('evaluate_agent_lead_freeze');
        if (error) {
          console.warn('[LeadFreeze] evaluation failed', error);
        } else {
          evaluated = data || [];
        }
      }

      const [{ data: caps }, { data: admins }] = await Promise.all([
        supabase
          .from('agent_distribution_caps')
          .select('admin_user_id, paused, auto_freeze_enabled, freeze_source, freeze_reason, frozen_until'),
        supabase
          .from('admin_users')
          .select('id, first_name, last_name, email, role, is_active, archived_at')
          .in('role', ['sales', 'sales_lead'])
          .eq('is_active', true)
          .is('archived_at', null),
      ]);

      const evalMap = new Map<string, any>();
      evaluated.forEach((e: any) => evalMap.set(e.admin_user_id, e));

      const capMap = new Map<string, any>();
      (caps || []).forEach((c: any) => capMap.set(c.admin_user_id, c));

      const built: Row[] = (admins || []).map((a: any) => {
        const cap = capMap.get(a.id) || {};
        const ev = evalMap.get(a.id) || {};
        return {
          admin_user_id: a.id,
          name: `${a.first_name || ''} ${a.last_name || ''}`.trim() || String(a.email).split('@')[0],
          paused: cap.paused === true,
          auto_freeze_enabled: cap.auto_freeze_enabled !== false,
          freeze_source: cap.freeze_source ?? null,
          freeze_reason: cap.freeze_reason ?? null,
          frozen_until: cap.frozen_until ?? null,
          outcome: ev.outcome,
          reason: ev.reason,
          freeze_days: ev.freeze_days,
          sales_in_window: ev.sales_in_window,
          revenue_mtd: ev.revenue_mtd,
          pro_rata_target: ev.pro_rata_target,
          monthly_target: ev.monthly_target,
        };
      });

      built.sort((a, b) => Number(b.paused) - Number(a.paused) || a.name.localeCompare(b.name));
      setRows(built);
    } finally {
      setLoading(false);
    }
  }, []);

  React.useEffect(() => {
    load(true);
  }, [load]);

  const toggleLeads = async (row: Row, on: boolean) => {
    setBusy(row.admin_user_id);
    const { error } = await supabase.rpc('set_agent_lead_allocation', {
      _admin_user_id: row.admin_user_id,
      _enabled: on,
    });
    setBusy(null);
    if (error) {
      toast.error(error.message || 'Could not change lead allocation');
      return;
    }
    toast.success(on ? `Leads switched back on for ${row.name}` : `Leads switched off for ${row.name}`);
    load(false);
  };

  const toggleAuto = async (row: Row, on: boolean) => {
    setBusy(row.admin_user_id);
    const { error } = await supabase.rpc('set_agent_auto_freeze', {
      _admin_user_id: row.admin_user_id,
      _enabled: on,
    });
    setBusy(null);
    if (error) {
      toast.error(error.message || 'Could not change the automatic rule');
      return;
    }
    load(false);
  };

  const frozenCount = rows.filter(r => r.paused).length;

  return (
    <Card>
      <CardHeader className="flex flex-row items-start justify-between gap-3 pb-3">
        <div>
          <CardTitle className="text-sm flex items-center gap-2">
            <Snowflake className="h-4 w-4 text-sky-600" />
            Leads on / off — automatic two-day no-sales freeze
          </CardTitle>
          <p className="text-xs text-muted-foreground mt-1 max-w-3xl">
            Each agent has a live switch. When the automatic rule is on, leads stop after two working days with one
            sale or fewer (two working days off after three such days). Agents who are ahead of their monthly target
            pro-rata — target scaled to the working days elapsed this month — are never frozen. Frozen agents see a
            notice at the top of New leads.
          </p>
        </div>
        <div className="flex items-center gap-2 shrink-0">
          {frozenCount > 0 && (
            <Badge variant="outline" className="border-rose-500 text-rose-700">
              {frozenCount} off
            </Badge>
          )}
          <Button variant="outline" size="sm" onClick={() => load(true)} disabled={loading}>
            <RefreshCw className={`h-3.5 w-3.5 mr-1.5 ${loading ? 'animate-spin' : ''}`} />
            Run rules now
          </Button>
        </div>
      </CardHeader>
      <CardContent>
        {loading ? (
          <div className="text-sm text-muted-foreground py-6 text-center">Checking sales, rota and targets…</div>
        ) : rows.length === 0 ? (
          <div className="text-sm text-muted-foreground py-6 text-center">No active sales agents found.</div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="text-left text-[11px] uppercase tracking-wide text-muted-foreground border-b">
                  <th className="py-2 pr-3">Agent</th>
                  <th className="py-2 pr-3">Leads</th>
                  <th className="py-2 pr-3">Auto freeze</th>
                  <th className="py-2 pr-3">Month vs pro-rata</th>
                  <th className="py-2 pr-3">Status</th>
                </tr>
              </thead>
              <tbody>
                {rows.map(row => {
                  const onTarget =
                    row.pro_rata_target != null && Number(row.revenue_mtd || 0) >= Number(row.pro_rata_target);
                  return (
                    <tr key={row.admin_user_id} className="border-b last:border-0 align-top">
                      <td className="py-2.5 pr-3 font-medium">{row.name}</td>
                      <td className="py-2.5 pr-3">
                        <div className="flex items-center gap-2">
                          <Switch
                            checked={!row.paused}
                            disabled={!canEdit || busy === row.admin_user_id}
                            onCheckedChange={v => toggleLeads(row, v)}
                          />
                          <span className={`text-xs ${row.paused ? 'text-rose-700' : 'text-emerald-700'}`}>
                            {row.paused ? 'Off' : 'On'}
                          </span>
                        </div>
                      </td>
                      <td className="py-2.5 pr-3">
                        <Switch
                          checked={row.auto_freeze_enabled}
                          disabled={!canEdit || busy === row.admin_user_id}
                          onCheckedChange={v => toggleAuto(row, v)}
                        />
                      </td>
                      <td className="py-2.5 pr-3">
                        <div className={onTarget ? 'text-emerald-700' : undefined}>
                          {gbp(row.revenue_mtd)} of {gbp(row.pro_rata_target)} due
                        </div>
                        <div className="text-[11px] text-muted-foreground">
                          Monthly target {gbp(row.monthly_target)}
                          {onTarget && ' · on target, exempt'}
                        </div>
                      </td>
                      <td className="py-2.5 pr-3 max-w-[320px]">
                        {row.paused ? (
                          <Badge variant="outline" className="border-rose-500 text-rose-700">
                            {row.freeze_source === 'auto' ? 'Auto freeze' : 'Switched off by manager'}
                          </Badge>
                        ) : (
                          <Badge variant="outline" className="border-emerald-500 text-emerald-700">
                            Receiving leads
                          </Badge>
                        )}
                        <div className="text-[11px] text-muted-foreground mt-1">
                          {row.freeze_reason || row.reason || '—'}
                        </div>
                        {row.frozen_until && row.paused && row.freeze_source === 'auto' && (
                          <div className="text-[11px] text-muted-foreground mt-0.5">
                            Lifts {format(new Date(row.frozen_until), 'EEE d MMM')}
                          </div>
                        )}
                        {!row.auto_freeze_enabled && (
                          <div className="text-[11px] text-amber-700 mt-0.5">Automatic rule is off for this agent.</div>
                        )}
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        )}

        <p className="text-[11px] text-muted-foreground mt-3 flex items-start gap-1.5">
          <Info className="h-3.5 w-3.5 mt-0.5 shrink-0" />
          A freeze stops new, high-intent and newly allocated leads only — existing leads and manager-assigned recovery
          work continue. Switching leads back on here overrides the automatic rule for the rest of the day.
        </p>
        <p className="text-[11px] text-muted-foreground mt-1.5 flex items-start gap-1.5">
          <ShieldCheck className="h-3.5 w-3.5 mt-0.5 shrink-0" />
          Pro-rata example: on a £20,000 monthly target, an agent halfway through their working days needs £10,000 to
          stay exempt.
        </p>
      </CardContent>
    </Card>
  );
};

export default AutoLeadFreezePanel;
