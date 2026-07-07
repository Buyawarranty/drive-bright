import { useCallback, useEffect, useMemo, useState } from 'react';
import { AlertTriangle, RefreshCw } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { supabase } from '@/integrations/supabase/client';
import { useAllAdminUsersMap } from '@/hooks/useAllAdminUsersMap';
import { useSharkTankSettings } from '@/hooks/useSharkTank';
import { formatDistanceToNowStrict } from 'date-fns';

type AlertRow = {
  id: string;
  event_type: string;
  event_data: any;
  created_at: string;
};

const ALERT_TYPES = [
  'open_pool_paid_lead_uncalled',
  'open_pool_callback_missed',
  'open_pool_payment_link_reminder',
  'open_pool_payment_link_stalled',
  'open_pool_lock_expired',
  'open_pool_high_priority_stale',
  'open_pool_agent_too_many_lost',
  'open_pool_morning_queue_stale',
  'open_pool_no_answer_exhausted',
];

const META: Record<string, { label: string; tone: 'red' | 'amber' | 'blue'; action: string }> = {
  open_pool_paid_lead_uncalled:    { label: 'Paid lead uncalled',     tone: 'red',   action: 'Call this lead now — paid ad clock is running' },
  open_pool_callback_missed:       { label: 'Callback missed',        tone: 'red',   action: 'Call back immediately or reassign' },
  open_pool_payment_link_reminder: { label: 'Payment link — 30 min',  tone: 'amber', action: 'Agent should follow up now' },
  open_pool_payment_link_stalled:  { label: 'Payment link stalled',   tone: 'red',   action: 'Manager: chase agent or reassign' },
  open_pool_lock_expired:          { label: 'Lock expired (7 min)',   tone: 'amber', action: 'Lead returned to pool — coach agent on speed' },
  open_pool_high_priority_stale:   { label: 'High priority > 24 h',   tone: 'red',   action: 'Reassign or escalate' },
  open_pool_agent_too_many_lost:   { label: 'Agent: too many Lost',   tone: 'amber', action: 'Review agent’s lost/not-interested logs' },
  open_pool_morning_queue_stale:   { label: 'Morning queue backlog',  tone: 'amber', action: 'Add another agent to clear the queue' },
  open_pool_no_answer_exhausted:   { label: 'No-answer limit hit',    tone: 'blue',  action: 'Lead moved to nurture — consider SMS' },
};

const TONE: Record<string, string> = {
  red:   'bg-red-100 text-red-900 border-red-300',
  amber: 'bg-amber-100 text-amber-900 border-amber-300',
  blue:  'bg-blue-100 text-blue-900 border-blue-300',
};

export function OpenPoolManagerAlerts() {
  const { settings } = useSharkTankSettings();
  const [rows, setRows] = useState<AlertRow[]>([]);
  const [loading, setLoading] = useState(false);
  const adminMap = useAllAdminUsersMap();

  const load = useCallback(async () => {
    setLoading(true);
    const since = new Date(Date.now() - 48 * 3600_000).toISOString();
    const { data } = await supabase
      .from('system_event_logs')
      .select('id, event_type, event_data, created_at')
      .in('event_type', ALERT_TYPES)
      .gte('created_at', since)
      .order('created_at', { ascending: false })
      .limit(100);
    setRows((data as AlertRow[]) ?? []);
    setLoading(false);
  }, []);

  useEffect(() => { load(); }, [load]);

  const agentName = (id?: string | null) => {
    if (!id) return '—';
    const a = adminMap.get(id);
    if (!a) return '—';
    return [a.first_name, a.last_name].filter(Boolean).join(' ') || a.email || 'Agent';
  };


  const grouped = useMemo(() => rows, [rows]);

  if (!settings.enabled) return null;

  return (
    <Card className="border-2 border-red-200">
      <CardHeader className="pb-3">
        <div className="flex items-center justify-between gap-3">
          <CardTitle className="text-base flex items-center gap-2">
            <AlertTriangle className="h-4 w-4 text-red-600" />
            Open Pool — Manager alerts
            <Badge variant="outline" className="text-[10px]">{rows.length}</Badge>
          </CardTitle>
          <Button variant="outline" size="sm" onClick={load} disabled={loading} className="gap-2">
            <RefreshCw className={`h-3 w-3 ${loading ? 'animate-spin' : ''}`} />
            Refresh
          </Button>
        </div>
      </CardHeader>
      <CardContent>
        {rows.length === 0 && (
          <p className="text-sm text-muted-foreground py-6 text-center">
            No alerts in the last 48 hours.
          </p>
        )}
        {rows.length > 0 && (
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="text-left text-xs uppercase text-muted-foreground border-b">
                  <th className="py-2 pr-3">Alert</th>
                  <th className="py-2 pr-3">Lead</th>
                  <th className="py-2 pr-3">Agent</th>
                  <th className="py-2 pr-3">Source</th>
                  <th className="py-2 pr-3">Overdue</th>
                  <th className="py-2 pr-3">Recommended action</th>
                </tr>
              </thead>
              <tbody>
                {grouped.map(r => {
                  const meta = META[r.event_type] ?? { label: r.event_type, tone: 'blue' as const, action: '' };
                  const d = r.event_data ?? {};
                  return (
                    <tr key={r.id} className="border-b last:border-0 align-top">
                      <td className="py-2 pr-3">
                        <span className={`inline-block px-2 py-0.5 rounded border text-[11px] font-medium ${TONE[meta.tone]}`}>
                          {meta.label}
                        </span>
                      </td>
                      <td className="py-2 pr-3">
                        <div className="font-medium">{d.name || '—'}</div>
                        {d.phone && <div className="text-xs text-muted-foreground">{d.phone}</div>}
                      </td>
                      <td className="py-2 pr-3">{agentName(d.agent_id || d.owner_agent)}</td>
                      <td className="py-2 pr-3 text-xs uppercase text-muted-foreground">{d.lead_source ?? '—'}</td>
                      <td className="py-2 pr-3 text-xs text-muted-foreground">
                        {formatDistanceToNowStrict(new Date(r.created_at), { addSuffix: true })}
                      </td>
                      <td className="py-2 pr-3 text-xs">{meta.action}</td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        )}
      </CardContent>
    </Card>
  );
}
