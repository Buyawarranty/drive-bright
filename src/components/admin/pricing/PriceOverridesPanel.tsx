import React, { useEffect, useMemo, useState } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Badge } from '@/components/ui/badge';
import { Input } from '@/components/ui/input';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { format } from 'date-fns';
import { AlertTriangle, PencilLine, Search } from 'lucide-react';

interface OverrideRow {
  id: string;
  created_at: string;
  agent_name: string | null;
  agent_email: string | null;
  context: string;
  customer_name: string | null;
  customer_email: string | null;
  vehicle_reg: string | null;
  vehicle_make: string | null;
  vehicle_model: string | null;
  payment_type: string | null;
  excess_amount: number | null;
  claim_limit: number | null;
  labour_rate: number | null;
  matrix_total: number | null;
  entered_total: number | null;
  diff_amount: number | null;
  diff_pct: number | null;
  floor_amount: number | null;
  below_floor: boolean;
  price_match_mode: boolean;
  price_match_company: string | null;
  price_match_price: number | null;
}

const PERIODS = [
  { key: '7', label: 'Last 7 days' },
  { key: '30', label: 'Last 30 days' },
  { key: '90', label: 'Last 90 days' },
  { key: 'all', label: 'All time' },
] as const;

/**
 * Manual price overrides audit log (Option C — audit only, nothing is blocked).
 * Managers see every agent; agents see only their own rows (enforced by RLS).
 */
export const PriceOverridesPanel: React.FC = () => {
  const [rows, setRows] = useState<OverrideRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [period, setPeriod] = useState<string>('30');
  const [agent, setAgent] = useState<string>('all');
  const [search, setSearch] = useState('');
  const [onlyBelowFloor, setOnlyBelowFloor] = useState(false);

  useEffect(() => {
    let cancelled = false;
    (async () => {
      setLoading(true);
      let query = supabase
        .from('price_override_audit')
        .select('*')
        .order('created_at', { ascending: false })
        .limit(500);
      if (period !== 'all') {
        const since = new Date();
        since.setDate(since.getDate() - Number(period));
        query = query.gte('created_at', since.toISOString());
      }
      const { data } = await query;
      if (!cancelled) {
        setRows((data || []) as OverrideRow[]);
        setLoading(false);
      }
    })();
    return () => { cancelled = true; };
  }, [period]);

  const agents = useMemo(() => {
    const set = new Set<string>();
    rows.forEach(r => { if (r.agent_name) set.add(r.agent_name); });
    return Array.from(set).sort();
  }, [rows]);

  const filtered = useMemo(() => {
    const q = search.trim().toLowerCase();
    return rows.filter(r => {
      if (agent !== 'all' && r.agent_name !== agent) return false;
      if (onlyBelowFloor && !r.below_floor) return false;
      if (!q) return true;
      return [r.customer_name, r.customer_email, r.vehicle_reg, r.agent_name]
        .some(v => (v || '').toLowerCase().includes(q));
    });
  }, [rows, agent, onlyBelowFloor, search]);

  const totals = useMemo(() => {
    const belowGrid = filtered.filter(r => (r.diff_amount || 0) < 0);
    const lost = belowGrid.reduce((sum, r) => sum + Math.abs(r.diff_amount || 0), 0);
    return {
      count: filtered.length,
      belowFloor: filtered.filter(r => r.below_floor).length,
      lost: Math.round(lost),
    };
  }, [filtered]);

  return (
    <Card className="border-2">
      <CardHeader className="pb-3">
        <CardTitle className="flex items-center gap-2 text-lg">
          <PencilLine className="w-5 h-5 text-amber-600" />
          Manual price overrides
        </CardTitle>
        <p className="text-sm text-muted-foreground">
          Every time an agent types a custom price in Quotes &amp; Orders we record who did it, the price
          they typed, the live grid price, and the gap. Nothing is blocked — this is the audit trail.
        </p>
      </CardHeader>
      <CardContent className="space-y-4">
        <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
          <div className="rounded-lg border p-3">
            <p className="text-xs text-muted-foreground">Overrides</p>
            <p className="text-2xl font-bold">{totals.count}</p>
          </div>
          <div className="rounded-lg border p-3">
            <p className="text-xs text-muted-foreground">Below the price floor</p>
            <p className="text-2xl font-bold text-destructive">{totals.belowFloor}</p>
          </div>
          <div className="rounded-lg border p-3">
            <p className="text-xs text-muted-foreground">Given away vs grid</p>
            <p className="text-2xl font-bold">£{totals.lost.toLocaleString()}</p>
          </div>
        </div>

        <div className="flex flex-wrap items-center gap-2">
          <Select value={period} onValueChange={setPeriod}>
            <SelectTrigger className="w-[160px]"><SelectValue /></SelectTrigger>
            <SelectContent>
              {PERIODS.map(p => <SelectItem key={p.key} value={p.key}>{p.label}</SelectItem>)}
            </SelectContent>
          </Select>
          <Select value={agent} onValueChange={setAgent}>
            <SelectTrigger className="w-[180px]"><SelectValue placeholder="All agents" /></SelectTrigger>
            <SelectContent>
              <SelectItem value="all">All agents</SelectItem>
              {agents.map(a => <SelectItem key={a} value={a}>{a}</SelectItem>)}
            </SelectContent>
          </Select>
          <div className="relative">
            <Search className="w-4 h-4 absolute left-2.5 top-2.5 text-muted-foreground" />
            <Input
              className="pl-8 w-[220px]"
              placeholder="Customer, reg or agent"
              value={search}
              onChange={(e) => setSearch(e.target.value)}
            />
          </div>
          <Badge
            variant={onlyBelowFloor ? 'destructive' : 'outline'}
            className="cursor-pointer h-9 px-3 flex items-center gap-1.5"
            onClick={() => setOnlyBelowFloor(v => !v)}
          >
            <AlertTriangle className="w-3.5 h-3.5" />
            Below floor only
          </Badge>
        </div>

        <div className="rounded-lg border overflow-x-auto">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>When</TableHead>
                <TableHead>Agent</TableHead>
                <TableHead>Customer</TableHead>
                <TableHead>Vehicle</TableHead>
                <TableHead>Cover</TableHead>
                <TableHead className="text-right">Grid price</TableHead>
                <TableHead className="text-right">Typed price</TableHead>
                <TableHead className="text-right">Gap</TableHead>
                <TableHead>Flags</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {loading && (
                <TableRow><TableCell colSpan={9} className="text-center py-8 text-muted-foreground">Loading…</TableCell></TableRow>
              )}
              {!loading && filtered.length === 0 && (
                <TableRow><TableCell colSpan={9} className="text-center py-8 text-muted-foreground">No manual price overrides in this period.</TableCell></TableRow>
              )}
              {!loading && filtered.map(r => (
                <TableRow key={r.id} className={r.below_floor ? 'bg-destructive/5' : undefined}>
                  <TableCell className="whitespace-nowrap text-xs">
                    {format(new Date(r.created_at), 'd MMM yyyy HH:mm')}
                  </TableCell>
                  <TableCell className="text-sm font-medium">{r.agent_name || r.agent_email || '—'}</TableCell>
                  <TableCell className="text-sm">
                    <div>{r.customer_name || '—'}</div>
                    <div className="text-xs text-muted-foreground">{r.customer_email}</div>
                  </TableCell>
                  <TableCell className="text-sm">
                    <div className="font-mono text-xs">{r.vehicle_reg || '—'}</div>
                    <div className="text-xs text-muted-foreground">{[r.vehicle_make, r.vehicle_model].filter(Boolean).join(' ')}</div>
                  </TableCell>
                  <TableCell className="text-xs text-muted-foreground whitespace-nowrap">
                    {r.payment_type || '—'}
                    {r.claim_limit ? ` · £${r.claim_limit}` : ''}
                    {r.excess_amount != null ? ` · £${r.excess_amount} exc` : ''}
                    {r.labour_rate ? ` · £${r.labour_rate}/hr` : ''}
                  </TableCell>
                  <TableCell className="text-right text-sm">£{Math.round(r.matrix_total || 0)}</TableCell>
                  <TableCell className="text-right text-sm font-semibold">£{Math.round(r.entered_total || 0)}</TableCell>
                  <TableCell className={`text-right text-sm font-semibold ${(r.diff_amount || 0) < 0 ? 'text-destructive' : 'text-emerald-700'}`}>
                    {(r.diff_amount || 0) < 0 ? '−' : '+'}£{Math.abs(Math.round(r.diff_amount || 0))}
                    <span className="block text-xs font-normal text-muted-foreground">{r.diff_pct}%</span>
                  </TableCell>
                  <TableCell className="space-x-1 whitespace-nowrap">
                    {r.below_floor && <Badge variant="destructive" className="text-[10px]">Below floor</Badge>}
                    {r.price_match_mode && (
                      <Badge variant="outline" className="text-[10px]">
                        Price match{r.price_match_company ? `: ${r.price_match_company}` : ''}
                      </Badge>
                    )}
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </div>
      </CardContent>
    </Card>
  );
};

export default PriceOverridesPanel;
