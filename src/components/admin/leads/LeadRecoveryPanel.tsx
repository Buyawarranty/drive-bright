import React, { useCallback, useEffect, useMemo, useState } from 'react';
import { format } from 'date-fns';
import { CalendarIcon, LifeBuoy, Loader2, Search, ArrowRightLeft, Info } from 'lucide-react';
import { supabase } from '@/integrations/supabase/client';
import { Card, CardContent } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Calendar } from '@/components/ui/calendar';
import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover';
import {
  Select, SelectContent, SelectItem, SelectTrigger, SelectValue,
} from '@/components/ui/select';
import { Checkbox } from '@/components/ui/checkbox';
import {
  AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent,
  AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle,
} from '@/components/ui/alert-dialog';
import { cn } from '@/lib/utils';
import { toast } from 'sonner';

type Agent = { id: string; name: string; email: string | null; role: string };
type LeadRow = {
  id: string;
  first_name: string | null;
  last_name: string | null;
  email: string;
  phone: string | null;
  vehicle_reg: string | null;
  status: string | null;
  is_paid: boolean | null;
  assigned_to: string | null;
  assigned_at: string | null;
  created_at: string;
};

const ANY_AGENT = '__any__';
const UNASSIGNED = '__unassigned__';

/**
 * Management-only Lead Recovery panel.
 * Filter leads by a date range and (optionally) the current assigned agent,
 * then reassign the whole set to a chosen agent — refreshes assigned_at so
 * they resurface at the top of that agent's New Leads. Paid leads keep
 * their converted / paid status.
 */
export const LeadRecoveryPanel: React.FC = () => {
  const [agents, setAgents] = useState<Agent[]>([]);
  const [fromDate, setFromDate] = useState<Date | undefined>(() => {
    const d = new Date(); d.setDate(d.getDate() - 1); d.setHours(0, 0, 0, 0); return d;
  });
  const [toDate, setToDate] = useState<Date | undefined>(() => {
    const d = new Date(); d.setDate(d.getDate() - 1); d.setHours(23, 59, 59, 999); return d;
  });
  const [sourceAgent, setSourceAgent] = useState<string>(ANY_AGENT);
  const [targetAgents, setTargetAgents] = useState<string[]>([]);
  const [resetStatus, setResetStatus] = useState(true);
  const [rows, setRows] = useState<LeadRow[]>([]);
  const [loading, setLoading] = useState(false);
  const [scanning, setScanning] = useState(false);
  const [confirmOpen, setConfirmOpen] = useState(false);

  useEffect(() => {
    (async () => {
      const { data, error } = await (supabase.from('admin_users') as any)
        .select('id, first_name, last_name, email, role')
        .eq('is_active', true)
        .in('role', ['sales', 'sales_lead'])
        .order('first_name');
      if (error) { console.error('[LeadRecovery] agents load', error); return; }
      setAgents((data ?? []).map((a: any) => ({
        id: a.id,
        name: [a.first_name, a.last_name].filter(Boolean).join(' ').trim() || a.email || 'Agent',
        email: a.email,
        role: a.role,
      })));
    })();
  }, []);

  const rangeText = useMemo(() => {
    if (!fromDate || !toDate) return 'Pick a date range';
    if (format(fromDate, 'yyyy-MM-dd') === format(toDate, 'yyyy-MM-dd')) {
      return format(fromDate, 'EEE d MMM yyyy');
    }
    return `${format(fromDate, 'd MMM')} → ${format(toDate, 'd MMM yyyy')}`;
  }, [fromDate, toDate]);

  const scan = useCallback(async () => {
    if (!fromDate || !toDate) { toast.error('Pick a date range first'); return; }
    setScanning(true);
    try {
      const fromIso = new Date(fromDate); fromIso.setHours(0, 0, 0, 0);
      const toIso = new Date(toDate); toIso.setHours(23, 59, 59, 999);
      const page = 1000;
      const all: LeadRow[] = [];
      for (let i = 0; i < 10; i += 1) {
        let q = (supabase.from('sales_leads') as any)
          .select('id, first_name, last_name, email, phone, vehicle_reg, status, is_paid, assigned_to, assigned_at, created_at')
          .gte('created_at', fromIso.toISOString())
          .lte('created_at', toIso.toISOString())
          .order('created_at', { ascending: true })
          .range(i * page, i * page + page - 1);
        if (sourceAgent === UNASSIGNED) q = q.is('assigned_to', null);
        else if (sourceAgent !== ANY_AGENT) q = q.eq('assigned_to', sourceAgent);
        const { data, error } = await q;
        if (error) throw error;
        all.push(...((data ?? []) as LeadRow[]));
        if (!data || data.length < page) break;
      }
      setRows(all);
      if (all.length === 0) toast.info('No leads matched that filter');
      else toast.success(`Found ${all.length} lead${all.length === 1 ? '' : 's'}`);
    } catch (e: any) {
      console.error('[LeadRecovery] scan', e);
      toast.error(e?.message || 'Scan failed');
    } finally {
      setScanning(false);
    }
  }, [fromDate, toDate, sourceAgent]);

  /** Leads per calendar day in the scanned range (oldest first). */
  const perDay = useMemo(() => {
    const map = new Map<string, { total: number; paid: number }>();
    rows.forEach(r => {
      const key = format(new Date(r.created_at), 'yyyy-MM-dd');
      const cur = map.get(key) ?? { total: 0, paid: 0 };
      cur.total += 1;
      if (r.is_paid) cur.paid += 1;
      map.set(key, cur);
    });
    return Array.from(map.entries())
      .sort((a, b) => a[0].localeCompare(b[0]))
      .map(([day, v]) => ({ day, ...v }));
  }, [rows]);

  /** Even round-robin split of the scanned leads across the chosen agents. */
  const splitPlan = useMemo(() => {
    if (targetAgents.length === 0) return [] as { agentId: string; ids: string[] }[];
    const buckets = targetAgents.map(id => ({ agentId: id, ids: [] as string[] }));
    rows.forEach((r, i) => { buckets[i % buckets.length].ids.push(r.id); });
    return buckets;
  }, [rows, targetAgents]);

  const toggleTarget = (id: string) => {
    setTargetAgents(prev => prev.includes(id) ? prev.filter(x => x !== id) : [...prev, id]);
  };

  const doRecover = useCallback(async () => {
    if (targetAgents.length === 0) { toast.error('Pick who to assign to'); return; }
    if (rows.length === 0) { toast.error('Nothing to recover — scan first'); return; }
    setLoading(true);
    try {
      const now = new Date().toISOString();
      const paid = new Set(rows.filter(r => r.is_paid).map(r => r.id));
      let moved = 0;

      for (const bucket of splitPlan) {
        const paidIds = bucket.ids.filter(id => paid.has(id));
        const unpaidIds = bucket.ids.filter(id => !paid.has(id));

        for (let i = 0; i < paidIds.length; i += 200) {
          const { error } = await (supabase.from('sales_leads') as any)
            .update({ assigned_to: bucket.agentId, assigned_at: now, last_activity_date: now })
            .in('id', paidIds.slice(i, i + 200));
          if (error) throw error;
        }
        for (let i = 0; i < unpaidIds.length; i += 200) {
          const patch: any = { assigned_to: bucket.agentId, assigned_at: now, last_activity_date: now };
          if (resetStatus) patch.status = 'new';
          const { error } = await (supabase.from('sales_leads') as any)
            .update(patch)
            .in('id', unpaidIds.slice(i, i + 200));
          if (error) throw error;
        }
        moved += bucket.ids.length;
      }

      toast.success(
        `Reassigned ${moved} lead${moved === 1 ? '' : 's'} across ${targetAgents.length} agent${targetAgents.length === 1 ? '' : 's'}`,
      );
      setRows([]);
      setConfirmOpen(false);
    } catch (e: any) {
      console.error('[LeadRecovery] recover', e);
      toast.error(e?.message || 'Recovery failed');
    } finally {
      setLoading(false);
    }
  }, [rows, targetAgents, splitPlan, resetStatus]);

  const paidCount = rows.filter(r => r.is_paid).length;
  const nameOf = (id: string) => agents.find(a => a.id === id)?.name ?? 'Agent';
  const targetName = targetAgents.length === 1
    ? nameOf(targetAgents[0])
    : targetAgents.length > 1
      ? `${targetAgents.length} agents`
      : '';


  return (
    <Card className="border-border">
      <CardContent className="p-5 space-y-4">
        <div className="flex items-start gap-2">
          <LifeBuoy className="h-5 w-5 text-primary mt-0.5 shrink-0" />
          <div className="min-w-0">
            <h3 className="text-base font-semibold text-foreground">Recover Leads</h3>
            <p className="text-sm text-muted-foreground mt-0.5">
              Pull leads from a specific date (and optionally a specific agent) and reassign the whole batch to another agent. Paid leads keep their converted status.
            </p>
          </div>
        </div>

        {/* Filters */}
        <div className="grid gap-3 md:grid-cols-4">
          <div className="space-y-1">
            <label className="text-xs font-medium text-muted-foreground">From</label>
            <Popover>
              <PopoverTrigger asChild>
                <Button variant="outline" className={cn('w-full justify-start text-left font-normal', !fromDate && 'text-muted-foreground')}>
                  <CalendarIcon className="mr-2 h-4 w-4" />
                  {fromDate ? format(fromDate, 'd MMM yyyy') : 'From'}
                </Button>
              </PopoverTrigger>
              <PopoverContent className="w-auto p-0" align="start">
                <Calendar mode="single" selected={fromDate} onSelect={setFromDate} initialFocus className={cn('p-3 pointer-events-auto')} />
              </PopoverContent>
            </Popover>
          </div>

          <div className="space-y-1">
            <label className="text-xs font-medium text-muted-foreground">To</label>
            <Popover>
              <PopoverTrigger asChild>
                <Button variant="outline" className={cn('w-full justify-start text-left font-normal', !toDate && 'text-muted-foreground')}>
                  <CalendarIcon className="mr-2 h-4 w-4" />
                  {toDate ? format(toDate, 'd MMM yyyy') : 'To'}
                </Button>
              </PopoverTrigger>
              <PopoverContent className="w-auto p-0" align="start">
                <Calendar mode="single" selected={toDate} onSelect={setToDate} initialFocus className={cn('p-3 pointer-events-auto')} />
              </PopoverContent>
            </Popover>
          </div>

          <div className="space-y-1">
            <label className="text-xs font-medium text-muted-foreground">Currently assigned to</label>
            <Select value={sourceAgent} onValueChange={setSourceAgent}>
              <SelectTrigger><SelectValue placeholder="Any agent" /></SelectTrigger>
              <SelectContent className="bg-popover z-50">
                <SelectItem value={ANY_AGENT}>Any agent (all leads in range)</SelectItem>
                <SelectItem value={UNASSIGNED}>Unassigned only</SelectItem>
                {agents.map(a => (
                  <SelectItem key={a.id} value={a.id}>{a.name}</SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>

          <div className="space-y-1">
            <label className="text-xs font-medium text-muted-foreground">Reassign to (one or more)</label>
            <Popover>
              <PopoverTrigger asChild>
                <Button variant="outline" className={cn('w-full justify-start text-left font-normal', targetAgents.length === 0 && 'text-muted-foreground')}>
                  {targetAgents.length === 0
                    ? 'Pick agents'
                    : targetAgents.length === 1
                      ? nameOf(targetAgents[0])
                      : `${targetAgents.length} agents selected`}
                </Button>
              </PopoverTrigger>
              <PopoverContent className="w-64 p-2 bg-popover z-50" align="start">
                <div className="max-h-64 overflow-auto space-y-1">
                  {agents.map(a => (
                    <label
                      key={a.id}
                      className="flex items-center gap-2 px-2 py-1.5 rounded-md hover:bg-muted cursor-pointer text-sm"
                    >
                      <Checkbox
                        checked={targetAgents.includes(a.id)}
                        onCheckedChange={() => toggleTarget(a.id)}
                      />
                      {a.name}
                    </label>
                  ))}
                </div>
                {targetAgents.length > 0 && (
                  <Button variant="ghost" size="sm" className="w-full mt-1" onClick={() => setTargetAgents([])}>
                    Clear selection
                  </Button>
                )}
              </PopoverContent>
            </Popover>
          </div>
        </div>

        <div className="flex flex-wrap items-center gap-3">
          <Button onClick={scan} disabled={scanning} variant="secondary">
            {scanning ? <Loader2 className="h-4 w-4 mr-2 animate-spin" /> : <Search className="h-4 w-4 mr-2" />}
            Scan {rangeText}
          </Button>
          <label className="inline-flex items-center gap-2 text-sm text-muted-foreground">
            <Checkbox checked={resetStatus} onCheckedChange={(v) => setResetStatus(!!v)} />
            Reset status to "new" (unpaid only)
          </label>
        </div>

        {/* Per-day breakdown */}
        {perDay.length > 0 && (
          <div className="rounded-md border border-border bg-muted/20 p-3">
            <div className="text-xs font-semibold uppercase tracking-wide text-muted-foreground mb-2">
              Leads per date
            </div>
            <div className="flex flex-wrap gap-2">
              {perDay.map(d => (
                <span
                  key={d.day}
                  className="inline-flex items-center gap-1.5 rounded-full border border-border bg-background px-2.5 py-1 text-xs"
                >
                  <span className="text-muted-foreground">{format(new Date(`${d.day}T12:00:00`), 'EEE d MMM')}</span>
                  <strong className="text-foreground">{d.total}</strong>
                  {d.paid > 0 && <span className="text-green-700">({d.paid} paid)</span>}
                </span>
              ))}
            </div>
          </div>
        )}

        {/* Results */}
        {rows.length > 0 && (
          <div className="rounded-md border border-border overflow-hidden">
            <div className="flex items-center justify-between gap-3 px-4 py-2 bg-muted/40 border-b border-border">
              <div className="text-sm">
                <strong className="text-foreground">{rows.length}</strong> lead{rows.length === 1 ? '' : 's'} found
                {paidCount > 0 && <span className="ml-2 text-muted-foreground">({paidCount} paid)</span>}
                {splitPlan.length > 1 && (
                  <span className="ml-2 text-muted-foreground">
                    → split {splitPlan.map(b => `${nameOf(b.agentId)} ${b.ids.length}`).join(' · ')}
                  </span>
                )}
              </div>
              <Button
                size="sm"
                onClick={() => setConfirmOpen(true)}
                disabled={targetAgents.length === 0 || loading}
              >
                {loading ? <Loader2 className="h-4 w-4 mr-2 animate-spin" /> : <ArrowRightLeft className="h-4 w-4 mr-2" />}
                Reassign all to {targetName || 'agent'}
              </Button>
            </div>

            <div className="max-h-72 overflow-auto">
              <table className="w-full text-sm">
                <thead className="bg-muted/20 text-xs text-muted-foreground">
                  <tr>
                    <th className="text-left px-3 py-2">Created</th>
                    <th className="text-left px-3 py-2">Name</th>
                    <th className="text-left px-3 py-2">Email</th>
                    <th className="text-left px-3 py-2">Reg</th>
                    <th className="text-left px-3 py-2">Status</th>
                    <th className="text-left px-3 py-2">Currently on</th>
                  </tr>
                </thead>
                <tbody>
                  {rows.map(r => {
                    const cur = agents.find(a => a.id === r.assigned_to)?.name ?? (r.assigned_to ? 'Unknown' : '—');
                    return (
                      <tr key={r.id} className="border-t border-border">
                        <td className="px-3 py-2 whitespace-nowrap text-muted-foreground">
                          {format(new Date(r.created_at), 'd MMM HH:mm')}
                        </td>
                        <td className="px-3 py-2 whitespace-nowrap">{[r.first_name, r.last_name].filter(Boolean).join(' ') || '—'}</td>
                        <td className="px-3 py-2 whitespace-nowrap">{r.email}</td>
                        <td className="px-3 py-2 whitespace-nowrap font-mono text-xs">{r.vehicle_reg ?? '—'}</td>
                        <td className="px-3 py-2 whitespace-nowrap">
                          {r.is_paid
                            ? <Badge className="bg-green-100 text-green-800 border-green-200">Paid</Badge>
                            : <Badge variant="outline">{r.status ?? 'new'}</Badge>}
                        </td>
                        <td className="px-3 py-2 whitespace-nowrap text-muted-foreground">{cur}</td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          </div>
        )}

        <div className="flex items-start gap-2 rounded-md bg-muted/40 border border-border p-3 text-xs text-muted-foreground">
          <Info className="h-4 w-4 mt-0.5 shrink-0" />
          <div>
            Scans <code className="font-mono">sales_leads</code> by <em>created</em> date. The reassignment
            refreshes <code className="font-mono">assigned_at</code> so the batch surfaces at the top of the
            chosen agent's New Leads. Paid / converted leads keep their status; unpaid ones can be reset to
            "new" so the agent works them as fresh.
          </div>
        </div>
      </CardContent>

      <AlertDialog open={confirmOpen} onOpenChange={setConfirmOpen}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Reassign {rows.length} lead{rows.length === 1 ? '' : 's'} to {targetName}?</AlertDialogTitle>
            <AlertDialogDescription>
              These leads will move to {targetName} and appear at the top of their New Leads queue.
              {paidCount > 0 && <> {paidCount} paid lead{paidCount === 1 ? '' : 's'} will keep converted status.</>}
              {' '}This cannot be undone in one click.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel disabled={loading}>Cancel</AlertDialogCancel>
            <AlertDialogAction onClick={(e) => { e.preventDefault(); doRecover(); }} disabled={loading}>
              {loading ? <Loader2 className="h-4 w-4 mr-2 animate-spin" /> : null}
              Yes, reassign
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </Card>
  );
};

export default LeadRecoveryPanel;
