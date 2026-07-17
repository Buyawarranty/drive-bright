import React, { useEffect, useState, useCallback, useMemo } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Zap, RefreshCw, Target, TrendingUp } from 'lucide-react';
import { supabase } from '@/integrations/supabase/client';

interface LeadRow {
  id: string;
  created_at: string;
  assigned_to: string | null;
  is_paid: boolean | null;
  status: string | null;
}
interface CallRow { lead_id: string; agent_id: string | null; agent_name: string | null; created_at: string; }

interface AgentStats {
  agentId: string;
  agentName: string;
  totalLeads: number;
  called: number;
  notCalled: number;
  within120: number;
  after120: number;
  avgSeconds: number | null;
  fastest: number | null;
  slowest: number | null;
  sales: number;
}

const TARGET_SECONDS = 120;

const BANDS: { key: string; label: string; min: number; max: number | null }[] = [
  { key: '0-30',    label: '0–30s',    min: 0,   max: 30 },
  { key: '31-60',   label: '31–60s',   min: 31,  max: 60 },
  { key: '61-120',  label: '61–120s',  min: 61,  max: 120 },
  { key: '121-300', label: '121–300s', min: 121, max: 300 },
  { key: '300+',    label: '> 300s',   min: 301, max: null },
];

const isConverted = (l: LeadRow) => l.is_paid === true || (l.status || '').toLowerCase() === 'converted';

const fmt = (s: number | null) => s == null ? '—' : s < 60 ? `${s}s` : `${Math.floor(s / 60)}m ${s % 60}s`;

/**
 * Speed to Dial reporting — per-agent daily counters and conversion-by-band
 * analysis. "First dial" = earliest lead_call_logs row for each sales_lead.
 */
export const SpeedToDialPanel: React.FC = () => {
  const [leads, setLeads] = useState<LeadRow[]>([]);
  const [firstCallByLead, setFirstCallByLead] = useState<Map<string, CallRow>>(new Map());
  const [agentNames, setAgentNames] = useState<Map<string, string>>(new Map());
  const [loading, setLoading] = useState(true);

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const start = new Date(); start.setHours(0, 0, 0, 0);
      const end = new Date(); end.setHours(23, 59, 59, 999);

      const { data: leadsData } = await supabase
        .from('sales_leads')
        .select('id, created_at, assigned_to, is_paid, status')
        .gte('created_at', start.toISOString())
        .lte('created_at', end.toISOString());
      const leadsRows = (leadsData || []) as LeadRow[];
      setLeads(leadsRows);

      const leadIds = leadsRows.map(l => l.id);
      let firstMap = new Map<string, CallRow>();
      if (leadIds.length > 0) {
        const { data: calls } = await supabase
          .from('lead_call_logs')
          .select('lead_id, agent_id, agent_name, created_at')
          .in('lead_id', leadIds)
          .gte('created_at', start.toISOString())
          .order('created_at', { ascending: true });
        (calls || []).forEach((c: any) => {
          if (!c.lead_id) return;
          if (!firstMap.has(c.lead_id)) firstMap.set(c.lead_id, c);
        });
      }
      setFirstCallByLead(firstMap);

      // Resolve agent names for assigned_to ids
      const ids = new Set<string>();
      leadsRows.forEach(l => { if (l.assigned_to) ids.add(l.assigned_to); });
      firstMap.forEach(c => { if (c.agent_id) ids.add(c.agent_id); });
      const nameMap = new Map<string, string>();
      if (ids.size > 0) {
        const { data: users } = await supabase
          .from('admin_users')
          .select('id, first_name, last_name, email')
          .in('id', Array.from(ids));
        (users || []).forEach((u: any) => {
          const nm = [u.first_name, u.last_name].filter(Boolean).join(' ').trim() || u.email;
          nameMap.set(u.id, nm);
        });
      }
      setAgentNames(nameMap);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    load();
    const iv = setInterval(load, 30_000);
    return () => clearInterval(iv);
  }, [load]);

  // Compute seconds for each lead
  const leadStats = useMemo(() => {
    return leads.map(l => {
      const call = firstCallByLead.get(l.id);
      const seconds = call
        ? Math.max(0, Math.round((new Date(call.created_at).getTime() - new Date(l.created_at).getTime()) / 1000))
        : null;
      const ownerAgentId = l.assigned_to || call?.agent_id || null;
      return { lead: l, call, seconds, ownerAgentId };
    });
  }, [leads, firstCallByLead]);

  // Per-agent stats (owned by assigned_to when present, else first-caller)
  const agentStats: AgentStats[] = useMemo(() => {
    const map = new Map<string, AgentStats>();
    leadStats.forEach(({ lead, seconds, ownerAgentId }) => {
      if (!ownerAgentId) return;
      const s = map.get(ownerAgentId) || {
        agentId: ownerAgentId,
        agentName: agentNames.get(ownerAgentId) || 'Unknown',
        totalLeads: 0, called: 0, notCalled: 0,
        within120: 0, after120: 0,
        avgSeconds: 0, fastest: null, slowest: null,
        sales: 0,
      };
      s.totalLeads += 1;
      if (isConverted(lead)) s.sales += 1;
      if (seconds == null) {
        s.notCalled += 1;
      } else {
        s.called += 1;
        if (seconds <= TARGET_SECONDS) s.within120 += 1; else s.after120 += 1;
        s.avgSeconds = ((s.avgSeconds || 0) * (s.called - 1) + seconds) / s.called;
        s.fastest = s.fastest == null ? seconds : Math.min(s.fastest, seconds);
        s.slowest = s.slowest == null ? seconds : Math.max(s.slowest, seconds);
      }
      map.set(ownerAgentId, s);
    });
    return Array.from(map.values()).sort((a, b) => {
      const aPct = a.called ? a.within120 / a.called : 0;
      const bPct = b.called ? b.within120 / b.called : 0;
      return bPct - aPct || (a.avgSeconds || 9999) - (b.avgSeconds || 9999);
    });
  }, [leadStats, agentNames]);

  // Conversion-by-band analysis
  const bandStats = useMemo(() => {
    const bands = BANDS.map(b => ({ ...b, leads: 0, sales: 0 }));
    let notContacted = { leads: 0, sales: 0 };
    leadStats.forEach(({ lead, seconds }) => {
      if (seconds == null) {
        notContacted.leads += 1;
        if (isConverted(lead)) notContacted.sales += 1;
        return;
      }
      const band = bands.find(b => seconds >= b.min && (b.max == null || seconds <= b.max));
      if (band) {
        band.leads += 1;
        if (isConverted(lead)) band.sales += 1;
      }
    });
    return { bands, notContacted };
  }, [leadStats]);

  const totals = useMemo(() => {
    const total = leads.length;
    const called = firstCallByLead.size;
    const within = leadStats.filter(x => x.seconds != null && x.seconds <= TARGET_SECONDS).length;
    const sales = leads.filter(isConverted).length;
    const avg = (() => {
      const secs = leadStats.map(x => x.seconds).filter((s): s is number => s != null);
      if (!secs.length) return null;
      return Math.round(secs.reduce((a, b) => a + b, 0) / secs.length);
    })();
    return { total, called, within, notCalled: total - called, sales, avg };
  }, [leads, firstCallByLead, leadStats]);

  return (
    <div className="space-y-6">
      {/* Overview KPIs */}
      <div className="grid grid-cols-2 md:grid-cols-6 gap-3">
        <Card><CardHeader className="pb-1"><CardTitle className="text-xs text-muted-foreground">New leads today</CardTitle></CardHeader>
          <CardContent className="pt-0"><div className="text-2xl font-bold">{totals.total}</div></CardContent></Card>
        <Card><CardHeader className="pb-1"><CardTitle className="text-xs text-muted-foreground">Called</CardTitle></CardHeader>
          <CardContent className="pt-0"><div className="text-2xl font-bold">{totals.called}</div></CardContent></Card>
        <Card><CardHeader className="pb-1"><CardTitle className="text-xs text-muted-foreground">Not called</CardTitle></CardHeader>
          <CardContent className="pt-0"><div className="text-2xl font-bold text-red-600">{totals.notCalled}</div></CardContent></Card>
        <Card><CardHeader className="pb-1"><CardTitle className="text-xs text-muted-foreground">Within 120s</CardTitle></CardHeader>
          <CardContent className="pt-0">
            <div className="text-2xl font-bold text-green-600">{totals.within}</div>
            <div className="text-[10px] text-muted-foreground">{totals.total ? Math.round((totals.within / totals.total) * 100) : 0}% of leads</div>
          </CardContent></Card>
        <Card><CardHeader className="pb-1"><CardTitle className="text-xs text-muted-foreground">Avg speed</CardTitle></CardHeader>
          <CardContent className="pt-0"><div className={`text-2xl font-bold ${totals.avg != null && totals.avg <= TARGET_SECONDS ? 'text-green-600' : 'text-red-600'}`}>{fmt(totals.avg)}</div></CardContent></Card>
        <Card><CardHeader className="pb-1"><CardTitle className="text-xs text-muted-foreground">Sales today</CardTitle></CardHeader>
          <CardContent className="pt-0"><div className="text-2xl font-bold">{totals.sales}</div>
            <div className="text-[10px] text-muted-foreground">{totals.total ? ((totals.sales / totals.total) * 100).toFixed(1) : 0}% conv</div>
          </CardContent></Card>
      </div>

      {/* Per-agent table */}
      <Card>
        <CardHeader className="flex flex-row items-center justify-between">
          <CardTitle className="flex items-center gap-2"><Target className="h-5 w-5 text-primary" />Per Agent — Today</CardTitle>
          <Button variant="outline" size="sm" onClick={load} disabled={loading}>
            <RefreshCw className={`h-4 w-4 mr-2 ${loading ? 'animate-spin' : ''}`} />Refresh
          </Button>
        </CardHeader>
        <CardContent>
          {agentStats.length === 0 ? (
            <div className="text-sm text-muted-foreground py-8 text-center">
              {loading ? 'Loading…' : 'No leads assigned to agents today yet.'}
            </div>
          ) : (
            <div className="overflow-x-auto">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Agent</TableHead>
                    <TableHead className="text-right">Leads</TableHead>
                    <TableHead className="text-right">Not called</TableHead>
                    <TableHead className="text-right">≤ 120s</TableHead>
                    <TableHead className="text-right">&gt; 120s</TableHead>
                    <TableHead className="text-right">Hit rate</TableHead>
                    <TableHead className="text-right">Avg</TableHead>
                    <TableHead className="text-right">Fastest</TableHead>
                    <TableHead className="text-right">Slowest</TableHead>
                    <TableHead className="text-right">Sales</TableHead>
                    <TableHead className="text-right">Conv %</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {agentStats.map(r => {
                    const hitPct = r.totalLeads ? Math.round((r.within120 / r.totalLeads) * 100) : 0;
                    const convPct = r.totalLeads ? (r.sales / r.totalLeads) * 100 : 0;
                    const avg = r.avgSeconds == null ? null : Math.round(r.avgSeconds);
                    return (
                      <TableRow key={r.agentId}>
                        <TableCell className="font-medium">{r.agentName}</TableCell>
                        <TableCell className="text-right">{r.totalLeads}</TableCell>
                        <TableCell className="text-right">
                          {r.notCalled > 0 ? <Badge className="bg-red-600">{r.notCalled}</Badge> : <span className="text-muted-foreground">0</span>}
                        </TableCell>
                        <TableCell className="text-right"><Badge className="bg-green-600">{r.within120}</Badge></TableCell>
                        <TableCell className="text-right">{r.after120 > 0 ? <Badge variant="secondary">{r.after120}</Badge> : 0}</TableCell>
                        <TableCell className="text-right">
                          <Badge className={hitPct >= 80 ? 'bg-green-600' : hitPct >= 50 ? 'bg-yellow-500' : 'bg-red-600'}>{hitPct}%</Badge>
                        </TableCell>
                        <TableCell className={`text-right font-mono ${avg != null && avg <= TARGET_SECONDS ? 'text-green-600' : 'text-red-600'}`}>{fmt(avg)}</TableCell>
                        <TableCell className="text-right font-mono">{fmt(r.fastest)}</TableCell>
                        <TableCell className="text-right font-mono">{fmt(r.slowest)}</TableCell>
                        <TableCell className="text-right font-semibold">{r.sales}</TableCell>
                        <TableCell className="text-right">{convPct.toFixed(1)}%</TableCell>
                      </TableRow>
                    );
                  })}
                </TableBody>
              </Table>
            </div>
          )}
        </CardContent>
      </Card>

      {/* Conversion by response-time band */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2"><TrendingUp className="h-5 w-5 text-primary" />Conversion by Response Time</CardTitle>
          <p className="text-xs text-muted-foreground">Does faster contact drive more sales? Today's leads grouped by speed to first dial.</p>
        </CardHeader>
        <CardContent>
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Response band</TableHead>
                <TableHead className="text-right">Leads</TableHead>
                <TableHead className="text-right">Sales</TableHead>
                <TableHead className="text-right">Conversion rate</TableHead>
                <TableHead>Distribution</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {bandStats.bands.map(b => {
                const conv = b.leads ? (b.sales / b.leads) * 100 : 0;
                const shareOfTotal = totals.total ? (b.leads / totals.total) * 100 : 0;
                return (
                  <TableRow key={b.key}>
                    <TableCell className="font-medium">{b.label}</TableCell>
                    <TableCell className="text-right">{b.leads}</TableCell>
                    <TableCell className="text-right">{b.sales}</TableCell>
                    <TableCell className="text-right">
                      <Badge className={conv >= 20 ? 'bg-green-600' : conv >= 10 ? 'bg-yellow-500' : conv > 0 ? 'bg-orange-500' : 'bg-muted text-muted-foreground'}>
                        {conv.toFixed(1)}%
                      </Badge>
                    </TableCell>
                    <TableCell>
                      <div className="w-full h-2 bg-muted rounded">
                        <div className="h-2 bg-primary rounded" style={{ width: `${shareOfTotal}%` }} />
                      </div>
                    </TableCell>
                  </TableRow>
                );
              })}
              <TableRow>
                <TableCell className="font-medium text-red-600">Not contacted</TableCell>
                <TableCell className="text-right">{bandStats.notContacted.leads}</TableCell>
                <TableCell className="text-right">{bandStats.notContacted.sales}</TableCell>
                <TableCell className="text-right">
                  <Badge className="bg-muted text-muted-foreground">
                    {bandStats.notContacted.leads ? ((bandStats.notContacted.sales / bandStats.notContacted.leads) * 100).toFixed(1) : 0}%
                  </Badge>
                </TableCell>
                <TableCell>
                  <div className="w-full h-2 bg-muted rounded">
                    <div className="h-2 bg-red-500 rounded" style={{ width: `${totals.total ? (bandStats.notContacted.leads / totals.total) * 100 : 0}%` }} />
                  </div>
                </TableCell>
              </TableRow>
            </TableBody>
          </Table>
        </CardContent>
      </Card>
    </div>
  );
};

export default SpeedToDialPanel;
