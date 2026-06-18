import React, { useCallback, useEffect, useMemo, useState } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { Lead } from '@/hooks/useLeads';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Card, CardContent } from '@/components/ui/card';
import { Tabs, TabsList, TabsTrigger, TabsContent } from '@/components/ui/tabs';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import {
  Select, SelectContent, SelectItem, SelectTrigger, SelectValue,
} from '@/components/ui/select';
import { Input } from '@/components/ui/input';
import { Phone, Mail, RotateCcw, Loader2, CheckCircle2, AlertCircle } from 'lucide-react';
import { toast } from 'sonner';
import { formatDistanceToNow, format } from 'date-fns';
import { LeadDetailsPanel } from './LeadDetailsPanel';

type SegmentId =
  | 'never_contacted'
  | 'quote_cold'
  | 'stalled'
  | 'abandoned_cart'
  | 'all_aged';

const SEGMENTS: { id: SegmentId; label: string; description: string }[] = [
  { id: 'never_contacted', label: 'Never Contacted', description: 'Created >30 days ago, 0 calls, 0 notes' },
  { id: 'quote_cold', label: 'Quote Sent, Cold', description: 'Quote sent but no reply in 14+ days' },
  { id: 'stalled', label: 'Contacted, Stalled', description: 'Last contact >30 days, status still active' },
  { id: 'abandoned_cart', label: 'Abandoned Cart', description: 'Cart >7 days old, no order' },
  { id: 'all_aged', label: 'All Aged', description: 'Master list, oldest first' },
];

const OUTCOMES = [
  { value: 'revived', label: 'Revived' },
  { value: 'still_trying', label: 'Still trying' },
  { value: 'no_answer', label: 'No answer' },
  { value: 'mark_lost', label: 'Mark lost' },
  { value: 'not_interested', label: 'Not interested' },
];

const TERMINAL_STATUSES = new Set(['lost', 'converted', 'fake_lead']);
const PAGE_SIZE = 100;

function daysSince(iso: string | null | undefined): number | null {
  if (!iso) return null;
  return Math.floor((Date.now() - new Date(iso).getTime()) / 86400000);
}

function ageBadge(days: number | null) {
  if (days == null) return <Badge variant="outline">—</Badge>;
  if (days >= 60) return <Badge className="bg-red-100 text-red-800 border-red-200">{days}d</Badge>;
  if (days >= 30) return <Badge className="bg-amber-100 text-amber-800 border-amber-200">{days}d</Badge>;
  return <Badge variant="outline">{days}d</Badge>;
}

export const LeadRecoveryTab: React.FC = () => {
  const [segment, setSegment] = useState<SegmentId>('never_contacted');
  const [leads, setLeads] = useState<Lead[]>([]);
  const [loading, setLoading] = useState(false);
  const [counts, setCounts] = useState<Record<SegmentId, number>>({} as any);
  const [selected, setSelected] = useState<Lead | null>(null);
  const [search, setSearch] = useState('');
  const [workedToday, setWorkedToday] = useState(0);
  const [currentUserId, setCurrentUserId] = useState<string | null>(null);

  useEffect(() => {
    supabase.auth.getUser().then(({ data }) => setCurrentUserId(data.user?.id ?? null));
  }, []);

  const buildBaseQuery = useCallback(() => {
    // Reuses the same select shape as useLeads → maps cleanly to Lead type
    const select =
      'id, first_name, last_name, full_name, email, phone, lead_source, status, priority, priority_score, ' +
      'plan_interest, cart_value, quote_amount, vehicle_reg, vehicle_make, vehicle_model, vehicle_year, ' +
      'vehicle_type, mileage, assigned_to, assigned_at, next_action_type, next_action_date, follow_up_status, ' +
      'last_activity_date, last_contacted_at, notes, converted_at, lost_at, lost_reason, abandoned_cart_id, ' +
      'created_at, updated_at, is_paid, payment_amount, payment_method, payment_date, step_two_completed_at, ' +
      'plan_name, payment_type, step_abandoned, contact_status, is_from_abandoned_cart, call_count, is_callback, ' +
      'cart_metadata, application_count, resubmission_count, last_resubmitted_at, recovery_worked_at, recovery_outcome';

    const q = (supabase.from('sales_leads') as any).select(select);

    // Exclude terminal statuses, paid leads, and cancelled/refunded customers globally
    return q
      .not('status', 'in', '(lost,converted,fake_lead,cancelled,refunded,paid,completed)')
      .or('is_paid.is.null,is_paid.eq.false');
  }, []);

  const applySegment = useCallback((q: any, id: SegmentId) => {
    const now = Date.now();
    const d30 = new Date(now - 30 * 86400000).toISOString();
    const d14 = new Date(now - 14 * 86400000).toISOString();
    const d7 = new Date(now - 7 * 86400000).toISOString();

    switch (id) {
      case 'never_contacted':
        return q
          .lt('created_at', d30)
          .or('last_contacted_at.is.null,last_contacted_at.eq.')
          .eq('call_count', 0);
      case 'quote_cold':
        return q
          .not('quote_amount', 'is', null)
          .or(`last_contacted_at.is.null,last_contacted_at.lt.${d14}`);
      case 'stalled':
        return q.lt('last_contacted_at', d30);
      case 'abandoned_cart':
        return q.eq('is_from_abandoned_cart', true).lt('created_at', d7).eq('is_paid', false);
      case 'all_aged':
      default:
        return q.lt('created_at', d30);
    }
  }, []);

  const fetchLeads = useCallback(async () => {
    setLoading(true);
    try {
      let q = buildBaseQuery();
      q = applySegment(q, segment);
      // Oldest first, but de-prioritise leads we've recently worked
      q = q.order('recovery_worked_at', { ascending: true, nullsFirst: true })
           .order('created_at', { ascending: true })
           .limit(PAGE_SIZE);
      const { data, error } = await q;
      if (error) throw error;
      setLeads((data as any) || []);
    } catch (e: any) {
      toast.error('Failed to load recovery leads', { description: e.message });
    } finally {
      setLoading(false);
    }
  }, [buildBaseQuery, applySegment, segment]);

  const fetchCounts = useCallback(async () => {
    const results = await Promise.all(
      SEGMENTS.map(async (s) => {
        try {
          let q: any = (supabase.from('sales_leads') as any)
            .select('id', { count: 'exact', head: true })
            .not('status', 'in', '(lost,converted,fake_lead,cancelled,refunded,paid,completed)')
            .or('is_paid.is.null,is_paid.eq.false');
          q = applySegment(q, s.id);
          const { count } = await q;
          return [s.id, count || 0] as const;
        } catch {
          return [s.id, 0] as const;
        }
      })
    );
    setCounts(Object.fromEntries(results) as any);
  }, [applySegment]);

  const fetchWorkedToday = useCallback(async () => {
    if (!currentUserId) return;
    const startOfDay = new Date();
    startOfDay.setHours(0, 0, 0, 0);
    const { count } = await (supabase.from('lead_activities') as any)
      .select('id', { count: 'exact', head: true })
      .eq('performed_by', currentUserId)
      .eq('activity_type', 'recovery_attempt')
      .gte('created_at', startOfDay.toISOString());
    setWorkedToday(count || 0);
  }, [currentUserId]);

  useEffect(() => { fetchLeads(); }, [fetchLeads]);
  useEffect(() => { fetchCounts(); }, [fetchCounts]);
  useEffect(() => { fetchWorkedToday(); }, [fetchWorkedToday]);

  const filteredLeads = useMemo(() => {
    if (!search.trim()) return leads;
    const s = search.toLowerCase();
    return leads.filter((l) =>
      [l.first_name, l.last_name, l.email, l.phone, l.vehicle_reg, l.vehicle_make, l.vehicle_model]
        .some((v) => (v || '').toString().toLowerCase().includes(s))
    );
  }, [leads, search]);

  const logActivity = useCallback(
    async (leadId: string, type: string, description: string) => {
      await (supabase.from('lead_activities') as any).insert({
        lead_id: leadId,
        activity_type: type,
        description,
        performed_by: currentUserId,
      });
    },
    [currentUserId]
  );

  const markWorked = useCallback(
    async (lead: Lead, outcome?: string) => {
      try {
        const updates: any = { recovery_worked_at: new Date().toISOString() };
        if (outcome) updates.recovery_outcome = outcome;
        const { error } = await (supabase.from('sales_leads') as any)
          .update(updates)
          .eq('id', lead.id);
        if (error) throw error;

        await logActivity(
          lead.id,
          'recovery_attempt',
          outcome ? `Recovery attempt — outcome: ${outcome}` : 'Recovery attempt logged'
        );

        if (outcome === 'mark_lost') {
          await (supabase.from('sales_leads') as any)
            .update({ status: 'lost', lost_at: new Date().toISOString(), lost_reason: 'Recovery: unable to revive' })
            .eq('id', lead.id);
        } else if (outcome === 'not_interested') {
          await (supabase.from('sales_leads') as any)
            .update({ status: 'lost', lost_at: new Date().toISOString(), lost_reason: 'Recovery: not interested' })
            .eq('id', lead.id);
        }

        toast.success('Worked', { description: outcome ? `Outcome: ${outcome}` : 'Logged recovery attempt' });
        setWorkedToday((n) => n + 1);
        // Optimistic remove if terminal, otherwise just bump in-place
        setLeads((prev) =>
          outcome === 'mark_lost' || outcome === 'not_interested'
            ? prev.filter((l) => l.id !== lead.id)
            : prev.map((l) => (l.id === lead.id ? { ...l, recovery_worked_at: updates.recovery_worked_at } as any : l))
        );
      } catch (e: any) {
        toast.error('Could not mark as worked', { description: e.message });
      }
    },
    [logActivity]
  );

  const currentSegment = SEGMENTS.find((s) => s.id === segment)!;

  return (
    <div className="p-4 md:p-6 space-y-4">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <h1 className="text-2xl font-semibold flex items-center gap-2">
            <RotateCcw className="h-6 w-6 text-primary" />
            Lead Recovery
          </h1>
          <p className="text-sm text-muted-foreground mt-1">
            Chase aged leads no one has worked. Oldest leads appear first within each segment.
          </p>
        </div>
        <Card className="border-primary/30">
          <CardContent className="py-3 px-4 flex items-center gap-3">
            <CheckCircle2 className="h-5 w-5 text-green-600" />
            <div>
              <div className="text-xs text-muted-foreground">Worked today</div>
              <div className="text-xl font-semibold">{workedToday}</div>
            </div>
          </CardContent>
        </Card>
      </div>

      <Tabs value={segment} onValueChange={(v) => setSegment(v as SegmentId)}>
        <TabsList className="w-full justify-start flex-wrap h-auto">
          {SEGMENTS.map((s) => (
            <TabsTrigger key={s.id} value={s.id} className="gap-2">
              {s.label}
              <Badge variant="secondary" className="ml-1">{counts[s.id] ?? '…'}</Badge>
            </TabsTrigger>
          ))}
        </TabsList>

        <TabsContent value={segment} className="mt-4 space-y-3">
          <div className="flex items-center justify-between gap-3">
            <p className="text-sm text-muted-foreground">{currentSegment.description}</p>
            <Input
              placeholder="Search name, email, phone, reg…"
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              className="max-w-xs"
            />
          </div>

          {loading ? (
            <div className="flex items-center gap-2 text-muted-foreground py-12 justify-center">
              <Loader2 className="h-4 w-4 animate-spin" /> Loading aged leads…
            </div>
          ) : filteredLeads.length === 0 ? (
            <Card>
              <CardContent className="py-12 text-center text-muted-foreground">
                <AlertCircle className="h-8 w-8 mx-auto mb-2 opacity-50" />
                No leads in this segment right now.
              </CardContent>
            </Card>
          ) : (
            <div className="border rounded-lg overflow-hidden bg-card">
              <div className="overflow-x-auto">
                <table className="w-full text-sm">
                  <thead className="bg-muted/50 text-xs uppercase text-muted-foreground">
                    <tr>
                      <th className="text-left p-3">Lead</th>
                      <th className="text-left p-3">Contact</th>
                      <th className="text-left p-3">Vehicle</th>
                      <th className="text-left p-3">Source</th>
                      <th className="text-left p-3">Age</th>
                      <th className="text-left p-3">Last touched</th>
                      <th className="text-left p-3">Last worked</th>
                      <th className="text-right p-3">Actions</th>
                    </tr>
                  </thead>
                  <tbody>
                    {filteredLeads.map((lead) => {
                      const ageDays = daysSince(lead.created_at);
                      const lastTouchedDays = daysSince(lead.last_contacted_at);
                      const lastWorked = (lead as any).recovery_worked_at as string | null;
                      return (
                        <tr key={lead.id} className="border-t hover:bg-muted/30 cursor-pointer" onClick={() => setSelected(lead)}>
                          <td className="p-3">
                            <div className="font-medium">
                              {[lead.first_name, lead.last_name].filter(Boolean).join(' ') || lead.full_name || '—'}
                            </div>
                            <div className="text-xs text-muted-foreground">
                              {lead.status} · {lead.call_count || 0} calls
                            </div>
                          </td>
                          <td className="p-3 text-xs">
                            {lead.phone && (
                              <div className="flex items-center gap-1"><Phone className="h-3 w-3" />{lead.phone}</div>
                            )}
                            {lead.email && (
                              <div className="flex items-center gap-1 text-muted-foreground"><Mail className="h-3 w-3" />{lead.email}</div>
                            )}
                          </td>
                          <td className="p-3 text-xs">
                            <div>{[lead.vehicle_make, lead.vehicle_model].filter(Boolean).join(' ') || '—'}</div>
                            <div className="text-muted-foreground">{lead.vehicle_reg || ''} {lead.vehicle_year ? `· ${lead.vehicle_year}` : ''}</div>
                          </td>
                          <td className="p-3 text-xs">{lead.lead_source || '—'}</td>
                          <td className="p-3">{ageBadge(ageDays)}</td>
                          <td className="p-3">{ageBadge(lastTouchedDays)}</td>
                          <td className="p-3 text-xs text-muted-foreground">
                            {lastWorked ? formatDistanceToNow(new Date(lastWorked), { addSuffix: true }) : 'Never'}
                          </td>
                          <td className="p-3" onClick={(e) => e.stopPropagation()}>
                            <div className="flex items-center justify-end gap-2">
                              <Select onValueChange={(v) => markWorked(lead, v)}>
                                <SelectTrigger className="h-8 w-[140px]">
                                  <SelectValue placeholder="Outcome…" />
                                </SelectTrigger>
                                <SelectContent>
                                  {OUTCOMES.map((o) => (
                                    <SelectItem key={o.value} value={o.value}>{o.label}</SelectItem>
                                  ))}
                                </SelectContent>
                              </Select>
                              <Button size="sm" variant="outline" onClick={() => markWorked(lead)}>
                                Worked
                              </Button>
                            </div>
                          </td>
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
              </div>
            </div>
          )}
        </TabsContent>
      </Tabs>

      <Dialog open={!!selected} onOpenChange={(o) => !o && setSelected(null)}>
        <DialogContent className="max-w-5xl max-h-[90vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle>
              {selected && (
                <span>
                  {[selected.first_name, selected.last_name].filter(Boolean).join(' ') || selected.email}
                  <span className="ml-2 text-xs text-muted-foreground font-normal">
                    Created {format(new Date(selected.created_at), 'd MMM yyyy')}
                  </span>
                </span>
              )}
            </DialogTitle>
          </DialogHeader>
          {selected && (
            <LeadDetailsPanel
              lead={selected}
              onLogActivity={logActivity}
              onRefresh={() => { fetchLeads(); fetchCounts(); }}
            />
          )}
        </DialogContent>
      </Dialog>
    </div>
  );
};

export default LeadRecoveryTab;
