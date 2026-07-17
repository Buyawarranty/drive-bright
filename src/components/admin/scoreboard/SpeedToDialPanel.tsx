import React, { useEffect, useState, useCallback } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Zap, RefreshCw } from 'lucide-react';
import { supabase } from '@/integrations/supabase/client';

interface AgentRow {
  agentId: string;
  agentName: string;
  leadsDialed: number;
  within120: number;
  avgSeconds: number | null;
  fastest: number | null;
  slowest: number | null;
}

const TARGET_SECONDS = 120;

/**
 * Speed to Dial — measures seconds between sales_leads.created_at and the
 * first lead_call_logs entry for that lead, grouped by the dialing agent.
 * Target: first dial within 120 seconds. Scoped to today (local midnight).
 */
export const SpeedToDialPanel: React.FC = () => {
  const [rows, setRows] = useState<AgentRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [totalLeads, setTotalLeads] = useState(0);
  const [dialedLeads, setDialedLeads] = useState(0);

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const start = new Date(); start.setHours(0, 0, 0, 0);
      const end = new Date(); end.setHours(23, 59, 59, 999);

      const { data: leads } = await supabase
        .from('sales_leads')
        .select('id, created_at')
        .gte('created_at', start.toISOString())
        .lte('created_at', end.toISOString());

      const leadMap = new Map<string, string>();
      (leads || []).forEach(l => leadMap.set(l.id, l.created_at));
      setTotalLeads(leadMap.size);

      if (leadMap.size === 0) { setRows([]); setDialedLeads(0); return; }

      const leadIds = Array.from(leadMap.keys());
      // lead_call_logs.lead_id is text; sales_leads uuid ids match by string.
      const { data: calls } = await supabase
        .from('lead_call_logs')
        .select('lead_id, agent_id, agent_name, created_at')
        .in('lead_id', leadIds)
        .gte('created_at', start.toISOString())
        .order('created_at', { ascending: true });

      // First call per lead
      const firstByLead = new Map<string, { agent_id: string | null; agent_name: string | null; created_at: string }>();
      (calls || []).forEach(c => {
        if (!c.lead_id) return;
        if (!firstByLead.has(c.lead_id)) firstByLead.set(c.lead_id, c as any);
      });
      setDialedLeads(firstByLead.size);

      const perAgent = new Map<string, AgentRow>();
      firstByLead.forEach((call, leadId) => {
        if (!call.agent_id) return;
        const leadAt = leadMap.get(leadId);
        if (!leadAt) return;
        const seconds = Math.max(0, Math.round((new Date(call.created_at).getTime() - new Date(leadAt).getTime()) / 1000));
        const key = call.agent_id;
        const row = perAgent.get(key) || {
          agentId: key,
          agentName: call.agent_name || 'Unknown',
          leadsDialed: 0,
          within120: 0,
          avgSeconds: 0,
          fastest: null,
          slowest: null,
        };
        row.leadsDialed += 1;
        if (seconds <= TARGET_SECONDS) row.within120 += 1;
        row.avgSeconds = ((row.avgSeconds || 0) * (row.leadsDialed - 1) + seconds) / row.leadsDialed;
        row.fastest = row.fastest == null ? seconds : Math.min(row.fastest, seconds);
        row.slowest = row.slowest == null ? seconds : Math.max(row.slowest, seconds);
        perAgent.set(key, row);
      });

      const sorted = Array.from(perAgent.values()).sort((a, b) => {
        const aPct = a.leadsDialed ? a.within120 / a.leadsDialed : 0;
        const bPct = b.leadsDialed ? b.within120 / b.leadsDialed : 0;
        return bPct - aPct || (a.avgSeconds || 0) - (b.avgSeconds || 0);
      });
      setRows(sorted);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    load();
    const iv = setInterval(load, 30_000);
    return () => clearInterval(iv);
  }, [load]);

  const fmt = (s: number | null) => s == null ? '—' : s < 60 ? `${s}s` : `${Math.floor(s / 60)}m ${s % 60}s`;

  return (
    <div className="space-y-4">
      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
        <Card>
          <CardHeader className="pb-2"><CardTitle className="text-sm text-muted-foreground">Leads today</CardTitle></CardHeader>
          <CardContent><div className="text-3xl font-bold">{totalLeads}</div></CardContent>
        </Card>
        <Card>
          <CardHeader className="pb-2"><CardTitle className="text-sm text-muted-foreground">Dialed at least once</CardTitle></CardHeader>
          <CardContent>
            <div className="text-3xl font-bold">{dialedLeads}</div>
            <div className="text-xs text-muted-foreground">{totalLeads > 0 ? Math.round((dialedLeads / totalLeads) * 100) : 0}% of today's leads</div>
          </CardContent>
        </Card>
        <Card>
          <CardHeader className="pb-2"><CardTitle className="text-sm text-muted-foreground">Target</CardTitle></CardHeader>
          <CardContent>
            <div className="text-3xl font-bold flex items-center gap-2"><Zap className="h-6 w-6 text-yellow-500" />≤ 120s</div>
            <div className="text-xs text-muted-foreground">First dial after lead arrival</div>
          </CardContent>
        </Card>
      </div>

      <Card>
        <CardHeader className="flex flex-row items-center justify-between">
          <CardTitle>Speed to Dial — Today</CardTitle>
          <Button variant="outline" size="sm" onClick={load} disabled={loading}>
            <RefreshCw className={`h-4 w-4 mr-2 ${loading ? 'animate-spin' : ''}`} />
            Refresh
          </Button>
        </CardHeader>
        <CardContent>
          {rows.length === 0 ? (
            <div className="text-sm text-muted-foreground py-8 text-center">
              {loading ? 'Loading…' : 'No dials logged for today\'s leads yet.'}
            </div>
          ) : (
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Agent</TableHead>
                  <TableHead className="text-right">Leads dialed</TableHead>
                  <TableHead className="text-right">Within 120s</TableHead>
                  <TableHead className="text-right">Hit rate</TableHead>
                  <TableHead className="text-right">Avg speed</TableHead>
                  <TableHead className="text-right">Fastest</TableHead>
                  <TableHead className="text-right">Slowest</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {rows.map(r => {
                  const pct = r.leadsDialed ? Math.round((r.within120 / r.leadsDialed) * 100) : 0;
                  const avg = r.avgSeconds == null ? null : Math.round(r.avgSeconds);
                  return (
                    <TableRow key={r.agentId}>
                      <TableCell className="font-medium">{r.agentName}</TableCell>
                      <TableCell className="text-right">{r.leadsDialed}</TableCell>
                      <TableCell className="text-right">
                        <Badge variant={r.within120 === r.leadsDialed ? 'default' : 'secondary'}>{r.within120}</Badge>
                      </TableCell>
                      <TableCell className="text-right">
                        <Badge className={pct >= 80 ? 'bg-green-600' : pct >= 50 ? 'bg-yellow-500' : 'bg-red-600'}>
                          {pct}%
                        </Badge>
                      </TableCell>
                      <TableCell className={`text-right font-mono ${avg != null && avg <= TARGET_SECONDS ? 'text-green-600' : 'text-red-600'}`}>
                        {fmt(avg)}
                      </TableCell>
                      <TableCell className="text-right font-mono">{fmt(r.fastest)}</TableCell>
                      <TableCell className="text-right font-mono">{fmt(r.slowest)}</TableCell>
                    </TableRow>
                  );
                })}
              </TableBody>
            </Table>
          )}
        </CardContent>
      </Card>
    </div>
  );
};

export default SpeedToDialPanel;
