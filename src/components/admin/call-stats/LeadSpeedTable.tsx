import React, { useEffect, useMemo, useState } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { AlertTriangle, Loader2, Mail, ChevronLeft, ChevronRight, Timer } from 'lucide-react';
import { cn } from '@/lib/utils';
import { useLeadResponseTime, formatResponseTime, responseTone } from '@/hooks/useLeadResponseTime';
import { TimeToContactCell } from '@/components/admin/leads/TimeToContactCell';

/**
 * Manager-facing per-lead speed-to-dial table for the Call Stats page.
 *
 * One row per lead in the selected window/team, showing how long it took
 * an agent to make the first call ("Speed"). Also surfaces a warning
 * whenever a lead has been flagged as fake AND we've sent an email to
 * that address — so managers can catch fake leads that already received
 * customer-facing mail.
 */

interface LeadRow {
  id: string;
  first_name: string | null;
  last_name: string | null;
  email: string | null;
  phone: string | null;
  status: string | null;
  assigned_to: string | null;
  created_at: string;
  last_activity_date: string | null;
  last_contacted_at: string | null;
  fake_marked_at: string | null;
  vehicle_reg: string | null;
}

interface Props {
  dateFrom: Date;
  dateTo: Date;
  /** 'all' | 'blue-red' | 'unassigned' | team name lowercase */
  teamFilter: string;
}

const STATUS_LABEL: Record<string, string> = {
  new: 'Not spoken to',
  contacted: 'Spoken to',
  qualified: 'Qualified',
  quote_sent: 'Quote sent',
  follow_up: 'Follow up',
  converted: 'Converted',
  lost: 'Lost',
  fake_lead: 'Fake lead',
};

const STATUS_CLS: Record<string, string> = {
  new: 'bg-slate-100 text-slate-700 border-slate-300',
  contacted: 'bg-blue-100 text-blue-800 border-blue-300',
  qualified: 'bg-indigo-100 text-indigo-800 border-indigo-300',
  quote_sent: 'bg-violet-100 text-violet-800 border-violet-300',
  follow_up: 'bg-amber-100 text-amber-800 border-amber-300',
  converted: 'bg-emerald-100 text-emerald-800 border-emerald-300',
  lost: 'bg-rose-100 text-rose-800 border-rose-300',
  fake_lead: 'bg-red-600 text-white border-red-700',
};

/** Format a duration in seconds as "1d 22h 3m", "2h 5m", "45s". */
export const fmtDuration = (sec: number | null | undefined): string => {
  if (sec == null || sec < 0) return '—';
  const d = Math.floor(sec / 86400);
  const h = Math.floor((sec % 86400) / 3600);
  const m = Math.floor((sec % 3600) / 60);
  const s = sec % 60;
  const parts: string[] = [];
  if (d) parts.push(`${d}d`);
  if (h) parts.push(`${h}h`);
  if (m || (!d && !h)) parts.push(d ? `${m}m` : `${m || 0}m`);
  if (!d && !h && !m) return `${s}s`;
  return parts.join(' ');
};

/** Speed bucket colour: <=2m green, <=10m amber, else red, no call = slate. */
const speedTone = (sec: number | null): string => {
  if (sec == null) return 'text-muted-foreground';
  if (sec <= 120) return 'text-emerald-700 font-semibold';
  if (sec <= 600) return 'text-amber-700 font-semibold';
  return 'text-rose-700 font-semibold';
};

const PAGE_SIZE = 250;

export const LeadSpeedTable: React.FC<Props> = ({ dateFrom, dateTo, teamFilter }) => {
  const [rows, setRows] = useState<LeadRow[]>([]);
  const [firstCallByLead, setFirstCallByLead] = useState<Record<string, string>>({});
  const [ownerNames, setOwnerNames] = useState<Record<string, string>>({});
  const [teamByAgent, setTeamByAgent] = useState<Record<string, { name: string }>>({});
  const [emailedLeadIds, setEmailedLeadIds] = useState<Set<string>>(new Set());
  const [loading, setLoading] = useState(true);
  const [page, setPage] = useState(1);
  /** 'all' | 'unassigned' | admin user id — quick-link filter per agent */
  const [agentFilter, setAgentFilter] = useState<string>('all');

  useEffect(() => { setPage(1); }, [dateFrom, dateTo, teamFilter]);

  useEffect(() => {
    let cancelled = false;
    (async () => {
      setLoading(true);
      const from = new Date(dateFrom); from.setHours(0, 0, 0, 0);
      const to = new Date(dateTo); to.setHours(23, 59, 59, 999);

      // 1. Leads in window
      const { data: leads } = await supabase
        .from('sales_leads')
        .select('id, first_name, last_name, email, phone, status, assigned_to, created_at, last_activity_date, last_contacted_at, fake_marked_at, vehicle_reg')
        .gte('created_at', from.toISOString())
        .lte('created_at', to.toISOString())
        .order('created_at', { ascending: false })
        .limit(5000);
      if (cancelled) return;
      const leadRows = (leads as LeadRow[]) || [];

      const leadIds = leadRows.map(l => l.id);
      const ownerIds = Array.from(new Set(leadRows.map(l => l.assigned_to).filter(Boolean))) as string[];
      const emails = Array.from(new Set(leadRows.map(l => l.email?.toLowerCase()).filter(Boolean))) as string[];

      // 2. First call per lead (min created_at from lead_call_logs.lead_id which is text)
      const [callRes, ownerRes, teamRes, emailRes] = await Promise.all([
        leadIds.length
          ? supabase
              .from('lead_call_logs')
              .select('lead_id, created_at')
              .in('lead_id', leadIds)
              .order('created_at', { ascending: true })
          : Promise.resolve({ data: [] as any[] }),
        ownerIds.length
          ? supabase
              .from('admin_users')
              .select('id, first_name, last_name, email')
              .in('id', ownerIds)
          : Promise.resolve({ data: [] as any[] }),
        supabase
          .from('lead_team_members')
          .select('admin_user_id, lead_teams!inner(name)'),
        emails.length
          ? supabase
              .from('email_logs')
              .select('recipient_email')
              .in('recipient_email', emails)
              .limit(5000)
          : Promise.resolve({ data: [] as any[] }),
      ]);
      if (cancelled) return;

      const first: Record<string, string> = {};
      (callRes.data as any[]).forEach(c => {
        if (!first[c.lead_id]) first[c.lead_id] = c.created_at;
      });

      const owners: Record<string, string> = {};
      (ownerRes.data as any[]).forEach(u => {
        owners[u.id] = [u.first_name, u.last_name].filter(Boolean).join(' ').trim() || u.email;
      });

      const teams: Record<string, { name: string }> = {};
      (teamRes.data as any[]).forEach(m => {
        if (m.lead_teams) teams[m.admin_user_id] = { name: m.lead_teams.name };
      });

      const emailed = new Set<string>();
      const emailedAddrs = new Set(
        (emailRes.data as any[]).map(e => (e.recipient_email || '').toLowerCase()).filter(Boolean)
      );
      leadRows.forEach(l => {
        if (l.email && emailedAddrs.has(l.email.toLowerCase())) emailed.add(l.id);
      });

      setRows(leadRows);
      setFirstCallByLead(first);
      setOwnerNames(owners);
      setTeamByAgent(teams);
      setEmailedLeadIds(emailed);
      setLoading(false);
    })();
    return () => { cancelled = true; };
  }, [dateFrom, dateTo]);

  const filtered = useMemo(() => {
    return rows.filter(r => {
      if (agentFilter !== 'all') {
        if (agentFilter === 'unassigned' ? !!r.assigned_to : r.assigned_to !== agentFilter) return false;
      }
      if (teamFilter === 'all') return true;
      const t = r.assigned_to ? teamByAgent[r.assigned_to]?.name?.toLowerCase() : undefined;
      if (teamFilter === 'unassigned') return !t;
      if (teamFilter === 'blue-red') return t === 'team blue' || t === 'team red' || t?.includes('blue') || t?.includes('red');
      return t === teamFilter || (t && t.includes(teamFilter));
    });
  }, [rows, teamByAgent, teamFilter, agentFilter]);

  const paged = useMemo(() => {
    const start = (page - 1) * PAGE_SIZE;
    return filtered.slice(start, start + PAGE_SIZE);
  }, [filtered, page]);

  const totalPages = Math.max(1, Math.ceil(filtered.length / PAGE_SIZE));

  // "Time to contact" — same signal as the New Leads column (first call, note or status change).
  const { responseByLead } = useLeadResponseTime(
    useMemo(() => paged.map(r => ({ id: r.id, created_at: r.created_at })), [paged])
  );

  /** Quick-link chips: one per agent holding leads in this window (self-assigned included). */
  const agentChips = useMemo(() => {
    const counts = new Map<string, number>();
    let unassigned = 0;
    rows.forEach(r => {
      if (!r.assigned_to) { unassigned += 1; return; }
      counts.set(r.assigned_to, (counts.get(r.assigned_to) || 0) + 1);
    });
    const list = Array.from(counts.entries())
      .map(([id, count]) => ({ id, label: ownerNames[id] || 'Unknown agent', count }))
      .sort((a, b) => b.count - a.count);
    return { list, unassigned };
  }, [rows, ownerNames]);

  /** Time-to-contact summary for whatever is currently on screen. */
  const contactSummary = useMemo(() => {
    const secs = paged.map(r => responseByLead[r.id]?.seconds).filter((s): s is number => s != null);
    if (!secs.length) return null;
    return {
      count: secs.length,
      of: paged.length,
      avg: Math.round(secs.reduce((a, c) => a + c, 0) / secs.length),
      fastest: Math.min(...secs),
      slowest: Math.max(...secs),
      withinTarget: secs.filter(s => s <= 120).length,
    };
  }, [paged, responseByLead]);

  const speedFor = (leadId: string, createdAt: string): number | null => {
    const first = firstCallByLead[leadId];
    if (!first) return null;
    return Math.max(0, Math.round((new Date(first).getTime() - new Date(createdAt).getTime()) / 1000));
  };

  return (
    <Card>
      <CardHeader className="pb-2">
        <CardTitle className="text-base flex items-center gap-2">
          <Timer className="w-4 h-4" />
          Speed to dial — per lead
          <Badge variant="secondary" className="text-[10px]">{filtered.length} leads</Badge>
        </CardTitle>
        <p className="text-xs text-muted-foreground">
          Time from lead arriving to the first logged call, plus time to contact (first call,
          note or status change). Pick an agent below to see every one of their times — including
          leads they assigned to themselves from the open pool.
        </p>
      </CardHeader>
      <CardContent>
        {/* Agent quick links */}
        <div className="flex flex-wrap gap-1.5 mb-3">
          <button
            type="button"
            onClick={() => { setAgentFilter('all'); setPage(1); }}
            className={cn(
              'px-2.5 py-1 rounded-full text-xs font-medium border transition-colors',
              agentFilter === 'all'
                ? 'bg-primary text-primary-foreground border-primary'
                : 'bg-background hover:bg-muted border-border'
            )}
          >
            All agents <span className="opacity-70">({rows.length})</span>
          </button>
          {agentChips.list.map(a => (
            <button
              key={a.id}
              type="button"
              onClick={() => { setAgentFilter(a.id); setPage(1); }}
              className={cn(
                'px-2.5 py-1 rounded-full text-xs font-medium border transition-colors',
                agentFilter === a.id
                  ? 'bg-primary text-primary-foreground border-primary'
                  : 'bg-background hover:bg-muted border-border'
              )}
            >
              {a.label} <span className="opacity-70">({a.count})</span>
            </button>
          ))}
          {agentChips.unassigned > 0 && (
            <button
              type="button"
              onClick={() => { setAgentFilter('unassigned'); setPage(1); }}
              className={cn(
                'px-2.5 py-1 rounded-full text-xs font-medium border transition-colors',
                agentFilter === 'unassigned'
                  ? 'bg-primary text-primary-foreground border-primary'
                  : 'bg-background hover:bg-muted border-border'
              )}
            >
              Unassigned <span className="opacity-70">({agentChips.unassigned})</span>
            </button>
          )}
        </div>

        {contactSummary && (
          <div className="grid grid-cols-2 md:grid-cols-4 gap-2 mb-3">
            <div className="rounded-md border p-2">
              <div className="text-[10px] uppercase tracking-wide text-muted-foreground">Average</div>
              <div className={cn('text-base font-bold', responseTone(contactSummary.avg))}>
                {formatResponseTime(contactSummary.avg)}
              </div>
            </div>
            <div className="rounded-md border p-2">
              <div className="text-[10px] uppercase tracking-wide text-muted-foreground">Fastest</div>
              <div className="text-base font-bold text-emerald-700">{formatResponseTime(contactSummary.fastest)}</div>
            </div>
            <div className="rounded-md border p-2">
              <div className="text-[10px] uppercase tracking-wide text-muted-foreground">Slowest</div>
              <div className="text-base font-bold text-rose-700">{formatResponseTime(contactSummary.slowest)}</div>
            </div>
            <div className="rounded-md border p-2">
              <div className="text-[10px] uppercase tracking-wide text-muted-foreground">Within 120s</div>
              <div className="text-base font-bold">
                {Math.round((contactSummary.withinTarget / contactSummary.count) * 100)}%
                <span className="text-[11px] font-normal text-muted-foreground ml-1">
                  ({contactSummary.withinTarget}/{contactSummary.count})
                </span>
              </div>
            </div>
          </div>
        )}

        {loading ? (
          <div className="flex items-center gap-2 text-sm text-muted-foreground py-8 justify-center">
            <Loader2 className="w-4 h-4 animate-spin" /> Loading…
          </div>
        ) : filtered.length === 0 ? (
          <div className="text-sm text-muted-foreground text-center py-8 border border-dashed rounded-md">
            No leads match the selected filter.
          </div>
        ) : (
          <>
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead className="bg-muted/40 text-xs text-muted-foreground">
                  <tr className="text-left">
                    <th className="py-2 px-3 font-medium">Lead</th>
                    <th className="py-2 px-3 font-medium">Last Activity</th>
                    <th className="py-2 px-3 font-medium">Status</th>
                    <th className="py-2 px-3 font-medium">Owner</th>
                    <th className="py-2 px-3 font-medium text-right">Speed</th>
                    <th className="py-2 px-3 font-medium">Time to contact</th>
                    <th className="py-2 px-3 font-medium">Warning</th>
                  </tr>
                </thead>
                <tbody>
                  {paged.map(r => {
                    const sec = speedFor(r.id, r.created_at);
                    const status = r.status || 'new';
                    const isFakeEmailed = status === 'fake_lead' && emailedLeadIds.has(r.id);
                    const name = [r.first_name, r.last_name].filter(Boolean).join(' ').trim() || '—';
                    const lastAct = r.last_activity_date || r.last_contacted_at || r.created_at;
                    const enquired = Math.round((Date.now() - new Date(r.created_at).getTime()) / 86_400_000);
                    return (
                      <tr key={r.id} className={cn('border-t hover:bg-muted/20', isFakeEmailed && 'bg-red-50/60')}>
                        <td className="py-2 px-3">
                          <div className="font-medium">{name}</div>
                          <div className="text-xs text-muted-foreground">
                            {r.email || '—'}{r.phone ? ` · ${r.phone}` : ''}
                          </div>
                        </td>
                        <td className="py-2 px-3">
                          <div>{new Date(lastAct).toLocaleDateString('en-GB', { day: '2-digit', month: 'short', year: 'numeric' })}</div>
                          <div className="text-xs text-muted-foreground">
                            Enquired {enquired === 0 ? 'today' : `${enquired}d ago`}
                          </div>
                        </td>
                        <td className="py-2 px-3">
                          <span className={cn('inline-flex items-center px-2 py-0.5 rounded-full text-[11px] font-medium border', STATUS_CLS[status] || STATUS_CLS.new)}>
                            {STATUS_LABEL[status] || status}
                          </span>
                        </td>
                        <td className="py-2 px-3">
                          {r.assigned_to ? ownerNames[r.assigned_to] || '—' : <span className="text-muted-foreground">Unassigned</span>}
                        </td>
                        <td className={cn('py-2 px-3 text-right tabular-nums', speedTone(sec))}>
                          {sec == null ? 'No call yet' : fmtDuration(sec)}
                        </td>
                        <td className="py-2 px-3">
                          <TimeToContactCell response={responseByLead[r.id]} />
                        </td>
                        <td className="py-2 px-3">
                          {isFakeEmailed ? (
                            <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-md text-[11px] font-semibold bg-red-600 text-white border border-red-700" title="Marked fake but a customer email was already sent">
                              <AlertTriangle className="w-3 h-3" /> Fake · email sent
                            </span>
                          ) : status === 'fake_lead' ? (
                            <span className="inline-flex items-center gap-1 text-[11px] text-rose-700">
                              <AlertTriangle className="w-3 h-3" /> Fake
                            </span>
                          ) : emailedLeadIds.has(r.id) ? (
                            <span className="inline-flex items-center gap-1 text-[11px] text-muted-foreground" title="Automated email was sent to this lead">
                              <Mail className="w-3 h-3" /> Emailed
                            </span>
                          ) : (
                            <span className="text-muted-foreground text-xs">—</span>
                          )}
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>

            {/* Pagination */}
            <div className="flex items-center justify-between mt-3 text-xs text-muted-foreground">
              <div>
                Showing {(page - 1) * PAGE_SIZE + 1}–{Math.min(page * PAGE_SIZE, filtered.length)} of {filtered.length}
              </div>
              <div className="flex items-center gap-2">
                <Button variant="outline" size="sm" className="h-8" disabled={page === 1} onClick={() => setPage(p => Math.max(1, p - 1))}>
                  <ChevronLeft className="w-3.5 h-3.5" /> Prev
                </Button>
                <span>Page {page} / {totalPages}</span>
                <Button variant="outline" size="sm" className="h-8" disabled={page >= totalPages} onClick={() => setPage(p => Math.min(totalPages, p + 1))}>
                  Next <ChevronRight className="w-3.5 h-3.5" />
                </Button>
                <Select value="250" onValueChange={() => { /* fixed at 250 per user spec */ }}>
                  <SelectTrigger className="h-8 w-[110px]"><SelectValue /></SelectTrigger>
                  <SelectContent>
                    <SelectItem value="250">250 / page</SelectItem>
                  </SelectContent>
                </Select>
              </div>
            </div>
          </>
        )}
      </CardContent>
    </Card>
  );
};

export default LeadSpeedTable;
