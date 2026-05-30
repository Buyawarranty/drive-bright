import React, { useState, useEffect, useMemo, useCallback } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { startOfWeek, startOfMonth, endOfWeek, endOfMonth, subWeeks, subMonths, format, formatDistanceToNow, parseISO } from 'date-fns';
import { Card, CardContent } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Tabs, TabsList, TabsTrigger } from '@/components/ui/tabs';
import {
  Table, TableBody, TableCell, TableHead, TableHeader, TableRow,
} from '@/components/ui/table';
import {
  Collapsible, CollapsibleContent, CollapsibleTrigger,
} from '@/components/ui/collapsible';
import {
  Tooltip, TooltipContent, TooltipTrigger,
} from '@/components/ui/tooltip';
import {
  ShieldCheck, RotateCcw, ChevronDown, ChevronRight, Phone, Mail, Car,
  AlertTriangle, CheckCircle2, Loader2, Download, Calendar as CalendarIcon, X,
} from 'lucide-react';
import { toast } from 'sonner';
import { detectSuspiciousLead } from '@/utils/suspiciousLeadDetection';
import { cn } from '@/lib/utils';
import { FAKE_REASONS } from './MarkFakeReasonDialog';

type Period = 'this_week' | 'last_week' | 'this_month' | 'last_month' | 'last_90';

interface FakeLeadRow {
  id: string;
  first_name: string | null;
  last_name: string | null;
  email: string;
  phone: string | null;
  vehicle_reg: string | null;
  vehicle_make: string | null;
  vehicle_model: string | null;
  call_count: number | null;
  status: string;
  created_at: string;
  fake_marked_at: string | null;
  fake_marked_by: string | null;
  fake_reason: string | null;
  fake_reason_note: string | null;
  fake_audit_status: string | null;
  fake_audited_at: string | null;
  fake_audited_by: string | null;
}

interface CallLogRow {
  id: string;
  lead_id: string;
  attempt_number: number;
  agent_name: string | null;
  outcome: string;
  notes: string | null;
  created_at: string;
}

interface AdminLite { id: string; first_name: string | null; last_name: string | null; email: string }

interface FakeLeadsAuditPanelProps {
  userRole?: string | null;
  currentAdminId: string | null;
}

const REASON_LABELS = Object.fromEntries(FAKE_REASONS.map(r => [r.value, r.label])) as Record<string, string>;

const phoneValidity = (phone?: string | null): { tier: 'valid' | 'suspicious' | 'invalid' | 'missing'; reason: string } => {
  if (!phone || !phone.trim()) return { tier: 'missing', reason: 'No phone number provided' };
  const flags = detectSuspiciousLead({ phone });
  const phoneFlag = flags.find(f => f.type === 'invalid_phone');
  if (phoneFlag) return { tier: 'invalid', reason: phoneFlag.reason };
  const digits = phone.replace(/\D/g, '');
  if (digits.length < 10) return { tier: 'invalid', reason: `Only ${digits.length} digits` };
  if (digits.length > 13) return { tier: 'suspicious', reason: 'Unusually long' };
  return { tier: 'valid', reason: 'Looks like a valid UK number' };
};

const getPeriodRange = (period: Period): { from: Date; to: Date; label: string } => {
  const now = new Date();
  switch (period) {
    case 'this_week':  return { from: startOfWeek(now, { weekStartsOn: 1 }), to: endOfWeek(now, { weekStartsOn: 1 }), label: 'This week' };
    case 'last_week':  { const lw = subWeeks(now, 1); return { from: startOfWeek(lw, { weekStartsOn: 1 }), to: endOfWeek(lw, { weekStartsOn: 1 }), label: 'Last week' }; }
    case 'this_month': return { from: startOfMonth(now), to: endOfMonth(now), label: 'This month' };
    case 'last_month': { const lm = subMonths(now, 1); return { from: startOfMonth(lm), to: endOfMonth(lm), label: 'Last month' }; }
    case 'last_90':    { const from = new Date(now); from.setDate(from.getDate() - 90); return { from, to: now, label: 'Last 90 days' }; }
  }
};

export const FakeLeadsAuditPanel: React.FC<FakeLeadsAuditPanelProps> = ({ userRole, currentAdminId }) => {
  const [period, setPeriod] = useState<Period>('this_month');
  const [groupBy, setGroupBy] = useState<'week' | 'month' | 'flat'>('week');
  const [statusFilter, setStatusFilter] = useState<'all' | 'pending' | 'confirmed' | 'reinstated'>('pending');
  const [loading, setLoading] = useState(true);
  const [leads, setLeads] = useState<FakeLeadRow[]>([]);
  const [callLogsByLead, setCallLogsByLead] = useState<Record<string, CallLogRow[]>>({});
  const [admins, setAdmins] = useState<Record<string, AdminLite>>({});
  const [expanded, setExpanded] = useState<Set<string>>(new Set());

  const canExport = userRole === 'super_admin' || userRole === 'admin';
  const { from, to, label } = useMemo(() => getPeriodRange(period), [period]);

  const fetchData = useCallback(async () => {
    setLoading(true);
    try {
      // Fetch fake leads in range — primarily by fake_marked_at, fallback to status
      const { data: leadsData, error: leadsErr } = await supabase
        .from('sales_leads')
        .select(`id, first_name, last_name, email, phone, vehicle_reg, vehicle_make, vehicle_model,
                 call_count, status, created_at,
                 fake_marked_at, fake_marked_by, fake_reason, fake_reason_note,
                 fake_audit_status, fake_audited_at, fake_audited_by`)
        .gte('fake_marked_at', from.toISOString())
        .lte('fake_marked_at', to.toISOString())
        .order('fake_marked_at', { ascending: false })
        .limit(2000);

      if (leadsErr) throw leadsErr;
      const rows = (leadsData || []) as FakeLeadRow[];
      setLeads(rows);

      // Fetch call logs for those leads
      const leadIds = rows.map(r => r.id);
      if (leadIds.length > 0) {
        const logsByLead: Record<string, CallLogRow[]> = {};
        // chunk to avoid huge IN clauses
        for (let i = 0; i < leadIds.length; i += 100) {
          const batch = leadIds.slice(i, i + 100);
          const { data: logs } = await supabase
            .from('lead_call_logs')
            .select('id, lead_id, attempt_number, agent_name, outcome, notes, created_at')
            .in('lead_id', batch)
            .order('attempt_number', { ascending: true });
          (logs || []).forEach((l: any) => {
            if (!logsByLead[l.lead_id]) logsByLead[l.lead_id] = [];
            logsByLead[l.lead_id].push(l as CallLogRow);
          });
        }
        setCallLogsByLead(logsByLead);
      } else {
        setCallLogsByLead({});
      }

      // Fetch admin names for marker/auditor display
      const adminIds = Array.from(new Set([
        ...rows.map(r => r.fake_marked_by).filter(Boolean),
        ...rows.map(r => r.fake_audited_by).filter(Boolean),
      ])) as string[];
      if (adminIds.length > 0) {
        const { data: adminRows } = await supabase
          .from('admin_users')
          .select('id, first_name, last_name, email')
          .in('id', adminIds);
        const map: Record<string, AdminLite> = {};
        (adminRows || []).forEach((a: any) => { map[a.id] = a; });
        setAdmins(map);
      } else {
        setAdmins({});
      }
    } catch (e) {
      console.error('Fake audit fetch failed:', e);
      toast.error('Failed to load fake leads audit');
    } finally {
      setLoading(false);
    }
  }, [from, to]);

  useEffect(() => { fetchData(); }, [fetchData]);

  const filteredLeads = useMemo(() => {
    if (statusFilter === 'all') return leads;
    return leads.filter(l => (l.fake_audit_status || 'pending') === statusFilter);
  }, [leads, statusFilter]);

  const kpis = useMemo(() => {
    const total = leads.length;
    const zeroCalls = leads.filter(l => (l.call_count || 0) === 0).length;
    const invalidPhone = leads.filter(l => phoneValidity(l.phone).tier === 'invalid').length;
    const pending = leads.filter(l => (l.fake_audit_status || 'pending') === 'pending').length;
    const confirmed = leads.filter(l => l.fake_audit_status === 'confirmed').length;
    const reinstated = leads.filter(l => l.fake_audit_status === 'reinstated').length;

    const byMarker: Record<string, { name: string; count: number; reinstated: number }> = {};
    leads.forEach(l => {
      const id = l.fake_marked_by || 'unknown';
      const a = admins[id];
      const name = a ? `${a.first_name || ''} ${a.last_name || ''}`.trim() || a.email : 'Unknown';
      if (!byMarker[id]) byMarker[id] = { name, count: 0, reinstated: 0 };
      byMarker[id].count++;
      if (l.fake_audit_status === 'reinstated') byMarker[id].reinstated++;
    });
    const topMarkers = Object.values(byMarker).sort((a, b) => b.count - a.count).slice(0, 5);

    return { total, zeroCalls, invalidPhone, pending, confirmed, reinstated, topMarkers };
  }, [leads, admins]);

  const grouped = useMemo(() => {
    if (groupBy === 'flat') return [{ key: 'all', label: '', rows: filteredLeads }];
    const buckets: Record<string, FakeLeadRow[]> = {};
    filteredLeads.forEach(l => {
      const d = l.fake_marked_at ? parseISO(l.fake_marked_at) : parseISO(l.created_at);
      const key = groupBy === 'week'
        ? `Week of ${format(startOfWeek(d, { weekStartsOn: 1 }), 'd MMM yyyy')}`
        : format(startOfMonth(d), 'MMMM yyyy');
      if (!buckets[key]) buckets[key] = [];
      buckets[key].push(l);
    });
    return Object.entries(buckets).map(([key, rows]) => ({ key, label: key, rows }));
  }, [filteredLeads, groupBy]);

  const updateAudit = async (lead: FakeLeadRow, action: 'confirm' | 'reinstate' | 'reset') => {
    try {
      if (action === 'reinstate') {
        // Move status off fake_lead → 'new'. Trigger sets fake_audit_status = 'reinstated' and auditor.
        const { error } = await supabase
          .from('sales_leads')
          .update({ status: 'new', fake_audited_by: currentAdminId } as any)
          .eq('id', lead.id);
        if (error) throw error;
        toast.success('Lead reinstated to Live');
      } else if (action === 'confirm') {
        const { error } = await supabase
          .from('sales_leads')
          .update({
            fake_audit_status: 'confirmed',
            fake_audited_at: new Date().toISOString(),
            fake_audited_by: currentAdminId,
          } as any)
          .eq('id', lead.id);
        if (error) throw error;
        toast.success('Marked as confirmed fake');
      } else {
        const { error } = await supabase
          .from('sales_leads')
          .update({
            fake_audit_status: 'pending',
            fake_audited_at: null,
            fake_audited_by: null,
          } as any)
          .eq('id', lead.id);
        if (error) throw error;
        toast.success('Reset to pending');
      }
      fetchData();
    } catch (e: any) {
      console.error(e);
      toast.error(`Failed: ${e.message || 'unknown error'}`);
    }
  };

  const exportCsv = () => {
    const headers = ['Marked at', 'Marked by', 'Name', 'Email', 'Phone', 'Phone validity', 'Reg', 'Call count',
      'Reason', 'Reason note', 'Audit status', 'Audited by', 'Audited at'];
    const lines = [headers.join(',')];
    filteredLeads.forEach(l => {
      const marker = l.fake_marked_by && admins[l.fake_marked_by]
        ? `${admins[l.fake_marked_by].first_name || ''} ${admins[l.fake_marked_by].last_name || ''}`.trim()
        : '';
      const auditor = l.fake_audited_by && admins[l.fake_audited_by]
        ? `${admins[l.fake_audited_by].first_name || ''} ${admins[l.fake_audited_by].last_name || ''}`.trim()
        : '';
      const pv = phoneValidity(l.phone);
      const cells = [
        l.fake_marked_at || '',
        marker,
        `${l.first_name || ''} ${l.last_name || ''}`.trim(),
        l.email,
        l.phone || '',
        `${pv.tier} — ${pv.reason}`,
        l.vehicle_reg || '',
        String(l.call_count || 0),
        l.fake_reason ? (REASON_LABELS[l.fake_reason] || l.fake_reason) : '',
        l.fake_reason_note || '',
        l.fake_audit_status || 'pending',
        auditor,
        l.fake_audited_at || '',
      ].map(v => `"${String(v).replace(/"/g, '""')}"`);
      lines.push(cells.join(','));
    });
    const blob = new Blob([lines.join('\n')], { type: 'text/csv' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `fake-leads-audit_${format(from, 'yyyy-MM-dd')}_to_${format(to, 'yyyy-MM-dd')}.csv`;
    a.click();
    URL.revokeObjectURL(url);
  };

  const toggleExpand = (id: string) => {
    const next = new Set(expanded);
    if (next.has(id)) next.delete(id); else next.add(id);
    setExpanded(next);
  };

  const renderPhoneBadge = (phone?: string | null) => {
    const { tier, reason } = phoneValidity(phone);
    const styles = {
      valid: 'bg-green-100 text-green-800 border-green-300',
      suspicious: 'bg-amber-100 text-amber-800 border-amber-300',
      invalid: 'bg-red-100 text-red-800 border-red-300',
      missing: 'bg-gray-100 text-gray-700 border-gray-300',
    }[tier];
    const labels = { valid: 'Valid UK', suspicious: 'Suspicious', invalid: 'Invalid', missing: 'Missing' } as const;
    return (
      <Tooltip>
        <TooltipTrigger asChild>
          <Badge variant="outline" className={cn('text-[10px]', styles)}>{labels[tier]}</Badge>
        </TooltipTrigger>
        <TooltipContent>{reason}</TooltipContent>
      </Tooltip>
    );
  };

  const outcomeStyle = (o: string) => {
    if (o === 'connected') return 'bg-green-100 text-green-800';
    if (o === 'wrong_number') return 'bg-red-100 text-red-800';
    if (o === 'voicemail') return 'bg-purple-100 text-purple-800';
    if (o === 'no_answer') return 'bg-gray-100 text-gray-700';
    if (o === 'busy') return 'bg-amber-100 text-amber-800';
    return 'bg-blue-100 text-blue-800';
  };

  return (
    <Card className="border-2 border-red-200 bg-red-50/30 mb-4">
      <CardContent className="p-4 space-y-3">
        <div className="flex flex-wrap items-center justify-between gap-3">
          <div className="flex items-center gap-2">
            <ShieldCheck className="h-5 w-5 text-red-700" />
            <h2 className="text-base font-bold text-red-900">Fake Leads Audit</h2>
            <Badge variant="outline" className="bg-white text-xs">{label}</Badge>
          </div>
          <div className="flex items-center gap-2 flex-wrap">
            <Tabs value={period} onValueChange={(v) => setPeriod(v as Period)}>
              <TabsList className="h-8">
                <TabsTrigger value="this_week" className="text-xs px-2">This week</TabsTrigger>
                <TabsTrigger value="last_week" className="text-xs px-2">Last week</TabsTrigger>
                <TabsTrigger value="this_month" className="text-xs px-2">This month</TabsTrigger>
                <TabsTrigger value="last_month" className="text-xs px-2">Last month</TabsTrigger>
                <TabsTrigger value="last_90" className="text-xs px-2">90d</TabsTrigger>
              </TabsList>
            </Tabs>
            <Tabs value={groupBy} onValueChange={(v) => setGroupBy(v as any)}>
              <TabsList className="h-8">
                <TabsTrigger value="week" className="text-xs px-2">By week</TabsTrigger>
                <TabsTrigger value="month" className="text-xs px-2">By month</TabsTrigger>
                <TabsTrigger value="flat" className="text-xs px-2">Flat</TabsTrigger>
              </TabsList>
            </Tabs>
            {canExport && (
              <Button variant="outline" size="sm" onClick={exportCsv} disabled={filteredLeads.length === 0}>
                <Download className="h-3.5 w-3.5 mr-1" /> Export CSV
              </Button>
            )}
          </div>
        </div>

        {/* KPI strip */}
        <div className="grid grid-cols-2 md:grid-cols-6 gap-2 text-xs">
          <div className="bg-white rounded-md border p-2"><div className="text-muted-foreground">Total fake</div><div className="text-lg font-bold">{kpis.total}</div></div>
          <div className="bg-white rounded-md border p-2"><div className="text-muted-foreground">Pending</div><div className="text-lg font-bold text-amber-700">{kpis.pending}</div></div>
          <div className="bg-white rounded-md border p-2"><div className="text-muted-foreground">Confirmed</div><div className="text-lg font-bold text-red-700">{kpis.confirmed}</div></div>
          <div className="bg-white rounded-md border p-2"><div className="text-muted-foreground">Reinstated</div><div className="text-lg font-bold text-green-700">{kpis.reinstated}</div></div>
          <div className="bg-white rounded-md border p-2"><div className="text-muted-foreground">Zero call attempts</div><div className="text-lg font-bold text-amber-700">{kpis.zeroCalls}</div></div>
          <div className="bg-white rounded-md border p-2"><div className="text-muted-foreground">Invalid phone</div><div className="text-lg font-bold text-red-700">{kpis.invalidPhone}</div></div>
        </div>

        {kpis.topMarkers.length > 0 && (
          <div className="bg-white rounded-md border p-2 text-xs flex flex-wrap items-center gap-2">
            <span className="text-muted-foreground font-semibold">Top fake-markers:</span>
            {kpis.topMarkers.map(m => (
              <Badge key={m.name} variant="outline" className="bg-gray-50">
                {m.name}: {m.count}
                {m.reinstated > 0 && <span className="ml-1 text-green-700">({m.reinstated} reinstated)</span>}
              </Badge>
            ))}
          </div>
        )}

        {/* Status filter */}
        <div className="flex items-center gap-2 text-xs">
          <span className="text-muted-foreground">Show:</span>
          {(['pending', 'confirmed', 'reinstated', 'all'] as const).map(s => (
            <Button
              key={s}
              variant={statusFilter === s ? 'default' : 'outline'}
              size="sm"
              className="h-7 text-xs capitalize"
              onClick={() => setStatusFilter(s)}
            >
              {s}
            </Button>
          ))}
        </div>

        {/* Body */}
        {loading ? (
          <div className="flex items-center justify-center py-8 text-muted-foreground">
            <Loader2 className="h-5 w-5 animate-spin mr-2" /> Loading audit…
          </div>
        ) : filteredLeads.length === 0 ? (
          <div className="text-center py-8 text-muted-foreground text-sm">
            No fake leads in this period.
          </div>
        ) : (
          <div className="bg-white rounded-md border overflow-hidden">
            {grouped.map(group => (
              <div key={group.key}>
                {group.label && (
                  <div className="bg-muted/50 px-3 py-1.5 text-xs font-semibold border-b flex items-center justify-between">
                    <span>{group.label}</span>
                    <Badge variant="secondary" className="text-[10px]">{group.rows.length}</Badge>
                  </div>
                )}
                <Table>
                  <TableHeader>
                    <TableRow className="text-xs">
                      <TableHead className="w-8"></TableHead>
                      <TableHead>Customer</TableHead>
                      <TableHead>Phone</TableHead>
                      <TableHead className="text-center">Calls</TableHead>
                      <TableHead>Marked fake</TableHead>
                      <TableHead>Reason</TableHead>
                      <TableHead>Audit</TableHead>
                      <TableHead className="text-right">Actions</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {group.rows.map(lead => {
                      const isExpanded = expanded.has(lead.id);
                      const calls = callLogsByLead[lead.id] || [];
                      const marker = lead.fake_marked_by ? admins[lead.fake_marked_by] : null;
                      const auditor = lead.fake_audited_by ? admins[lead.fake_audited_by] : null;
                      const auditStatus = lead.fake_audit_status || 'pending';
                      const pv = phoneValidity(lead.phone);
                      return (
                        <React.Fragment key={lead.id}>
                          <TableRow
                            className={cn(
                              'text-xs',
                              pv.tier === 'invalid' && 'bg-red-50/40',
                              (lead.call_count || 0) === 0 && 'border-l-4 border-l-amber-400',
                            )}
                          >
                            <TableCell>
                              <Button variant="ghost" size="icon" className="h-6 w-6" onClick={() => toggleExpand(lead.id)}>
                                {isExpanded ? <ChevronDown className="h-3.5 w-3.5" /> : <ChevronRight className="h-3.5 w-3.5" />}
                              </Button>
                            </TableCell>
                            <TableCell>
                              <div className="font-medium">
                                {`${lead.first_name || ''} ${lead.last_name || ''}`.trim() || '—'}
                              </div>
                              <div className="text-muted-foreground flex items-center gap-1">
                                <Mail className="h-3 w-3" /> {lead.email}
                              </div>
                              {lead.vehicle_reg && (
                                <div className="text-muted-foreground flex items-center gap-1 mt-0.5">
                                  <Car className="h-3 w-3" />
                                  <span className="font-mono uppercase">{lead.vehicle_reg}</span>
                                  {(lead.vehicle_make || lead.vehicle_model) && (
                                    <span>· {lead.vehicle_make} {lead.vehicle_model}</span>
                                  )}
                                </div>
                              )}
                            </TableCell>
                            <TableCell>
                              <div className="flex flex-col gap-0.5">
                                <span className="flex items-center gap-1">
                                  <Phone className="h-3 w-3" />
                                  {lead.phone || <span className="text-muted-foreground italic">none</span>}
                                </span>
                                {renderPhoneBadge(lead.phone)}
                              </div>
                            </TableCell>
                            <TableCell className="text-center">
                              <Badge variant="outline" className={cn(
                                'tabular-nums',
                                (lead.call_count || 0) === 0 ? 'bg-amber-100 text-amber-800 border-amber-300' : 'bg-gray-100',
                              )}>
                                {lead.call_count || 0}
                              </Badge>
                            </TableCell>
                            <TableCell>
                              <div className="font-medium">
                                {marker ? `${marker.first_name || ''} ${marker.last_name || ''}`.trim() || marker.email : '—'}
                              </div>
                              <div className="text-muted-foreground">
                                {lead.fake_marked_at ? formatDistanceToNow(parseISO(lead.fake_marked_at), { addSuffix: true }) : '—'}
                              </div>
                              {lead.fake_marked_at && (
                                <div className="text-[10px] text-muted-foreground">
                                  {format(parseISO(lead.fake_marked_at), 'd MMM yyyy HH:mm')}
                                </div>
                              )}
                            </TableCell>
                            <TableCell className="max-w-[200px]">
                              {lead.fake_reason ? (
                                <div>
                                  <Badge variant="outline" className="text-[10px]">
                                    {REASON_LABELS[lead.fake_reason] || lead.fake_reason}
                                  </Badge>
                                  {lead.fake_reason_note && (
                                    <div className="text-[11px] text-muted-foreground mt-0.5 italic">"{lead.fake_reason_note}"</div>
                                  )}
                                </div>
                              ) : (
                                <span className="text-muted-foreground italic">(no reason — legacy)</span>
                              )}
                            </TableCell>
                            <TableCell>
                              <Badge className={cn(
                                'text-[10px]',
                                auditStatus === 'pending' && 'bg-amber-100 text-amber-800',
                                auditStatus === 'confirmed' && 'bg-red-100 text-red-800',
                                auditStatus === 'reinstated' && 'bg-green-100 text-green-800',
                              )}>
                                {auditStatus}
                              </Badge>
                              {auditor && lead.fake_audited_at && (
                                <div className="text-[10px] text-muted-foreground mt-0.5">
                                  by {`${auditor.first_name || ''} ${auditor.last_name || ''}`.trim() || auditor.email}
                                  <br />
                                  {format(parseISO(lead.fake_audited_at), 'd MMM HH:mm')}
                                </div>
                              )}
                            </TableCell>
                            <TableCell className="text-right">
                              <div className="flex items-center gap-1 justify-end flex-wrap">
                                {auditStatus !== 'confirmed' && (
                                  <Button size="sm" variant="outline" className="h-7 text-xs"
                                    onClick={() => updateAudit(lead, 'confirm')}>
                                    <CheckCircle2 className="h-3 w-3 mr-1 text-red-600" /> Confirm fake
                                  </Button>
                                )}
                                {auditStatus !== 'reinstated' && lead.status === 'fake_lead' && (
                                  <Button size="sm" variant="outline" className="h-7 text-xs"
                                    onClick={() => updateAudit(lead, 'reinstate')}>
                                    <RotateCcw className="h-3 w-3 mr-1 text-green-600" /> Reinstate
                                  </Button>
                                )}
                                {auditStatus !== 'pending' && (
                                  <Button size="sm" variant="ghost" className="h-7 text-xs"
                                    onClick={() => updateAudit(lead, 'reset')}>
                                    <X className="h-3 w-3" />
                                  </Button>
                                )}
                              </div>
                            </TableCell>
                          </TableRow>
                          {isExpanded && (
                            <TableRow className="bg-muted/20">
                              <TableCell colSpan={8} className="text-xs">
                                <div className="font-semibold mb-1 flex items-center gap-1">
                                  <Phone className="h-3 w-3" /> Call attempts ({calls.length})
                                </div>
                                {calls.length === 0 ? (
                                  <div className="text-amber-700 flex items-center gap-1">
                                    <AlertTriangle className="h-3 w-3" />
                                    No call attempts logged for this lead before it was marked fake.
                                  </div>
                                ) : (
                                  <ol className="space-y-1 ml-4 list-decimal">
                                    {calls.map(c => (
                                      <li key={c.id} className="flex items-start gap-2">
                                        <Badge variant="outline" className={cn('text-[10px] shrink-0', outcomeStyle(c.outcome))}>
                                          {c.outcome.replace(/_/g, ' ')}
                                        </Badge>
                                        <span className="text-muted-foreground shrink-0">
                                          {format(parseISO(c.created_at), 'd MMM HH:mm')}
                                        </span>
                                        <span>{c.agent_name || '—'}</span>
                                        {c.notes && <span className="italic text-muted-foreground">"{c.notes}"</span>}
                                      </li>
                                    ))}
                                  </ol>
                                )}
                              </TableCell>
                            </TableRow>
                          )}
                        </React.Fragment>
                      );
                    })}
                  </TableBody>
                </Table>
              </div>
            ))}
          </div>
        )}
      </CardContent>
    </Card>
  );
};
