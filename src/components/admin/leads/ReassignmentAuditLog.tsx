import React, { useEffect, useMemo, useState } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Input } from '@/components/ui/input';
import { Calendar } from '@/components/ui/calendar';
import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { ClipboardList, CalendarIcon, Search, ChevronLeft, ChevronRight, ArrowRight, RefreshCw, Download } from 'lucide-react';
import { format } from 'date-fns';
import { toast } from 'sonner';

interface ChangelogRow {
  id: string;
  lead_id: string;
  changed_at: string;
  changed_by: string | null;
  change_type: string;
  old_assigned_to: string | null;
  new_assigned_to: string | null;
  old_record: any;
  new_record: any;
}

interface AuditRow {
  lead_id: string;
  assigned_to_id: string | null;
  assigned_by: string | null;
  assignment_type: string | null;
  reason: string | null;
  previous_assigned_to_id?: string | null;
  was_worked?: boolean | null;
  created_at: string;
}

interface AdminLite {
  id: string;
  user_id: string | null;
  first_name: string | null;
  last_name: string | null;
  email: string;
  role: string;
}

const PAGE_SIZE = 50;
const MATCH_WINDOW_MS = 15_000;

const humanise = (value: string | null) => {
  if (!value) return null;
  return value.replace(/_/g, ' ').replace(/\b\w/g, (c) => c.toUpperCase());
};

export const ReassignmentAuditLog: React.FC = () => {
  const [rows, setRows] = useState<ChangelogRow[]>([]);
  const [audits, setAudits] = useState<AuditRow[]>([]);
  const [admins, setAdmins] = useState<AdminLite[]>([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState('');
  const [agentFilter, setAgentFilter] = useState<string>('all');
  const [direction, setDirection] = useState<'any' | 'from' | 'to'>('any');
  const [selectedDate, setSelectedDate] = useState<Date | undefined>(undefined);
  const [page, setPage] = useState(0);
  const [refreshKey, setRefreshKey] = useState(0);

  useEffect(() => {
    (async () => {
      const { data } = await supabase
        .from('admin_users')
        .select('id, user_id, first_name, last_name, email, role')
        .order('first_name');
      setAdmins((data as AdminLite[]) || []);
    })();
  }, []);

  const byAdminId = useMemo(() => {
    const map: Record<string, AdminLite> = {};
    admins.forEach((a) => { map[a.id] = a; });
    return map;
  }, [admins]);

  const byUserId = useMemo(() => {
    const map: Record<string, AdminLite> = {};
    admins.forEach((a) => { if (a.user_id) map[a.user_id] = a; });
    return map;
  }, [admins]);

  const nameOf = (admin?: AdminLite) => {
    if (!admin) return null;
    const name = `${admin.first_name || ''} ${admin.last_name || ''}`.trim();
    return name || admin.email;
  };

  const agentName = (adminUserId: string | null) => {
    if (!adminUserId) return 'Unassigned';
    return nameOf(byAdminId[adminUserId]) || adminUserId.slice(0, 8);
  };

  const actorLabel = (row: ChangelogRow, audit?: AuditRow) => {
    // changelog.changed_by is an auth user id; audit.assigned_by is an admin_users id or a system label
    if (row.changed_by) {
      const admin = byUserId[row.changed_by] || byAdminId[row.changed_by];
      if (admin) return { label: nameOf(admin)!, system: false };
      return { label: row.changed_by.slice(0, 8), system: false };
    }
    if (audit?.assigned_by) {
      const admin = byAdminId[audit.assigned_by] || byUserId[audit.assigned_by];
      if (admin) return { label: nameOf(admin)!, system: false };
      return { label: humanise(audit.assigned_by)!, system: true };
    }
    return { label: 'System / automation', system: true };
  };

  useEffect(() => {
    const run = async () => {
      setLoading(true);
      try {
        let query = supabase
          .from('sales_leads_changelog')
          .select('id, lead_id, changed_at, changed_by, change_type, old_assigned_to, new_assigned_to, old_record, new_record')
          .or('old_assigned_to.is.null,new_assigned_to.is.null,old_assigned_to.neq.new_assigned_to')
          .order('changed_at', { ascending: false })
          .range(page * PAGE_SIZE, (page + 1) * PAGE_SIZE - 1);

        if (selectedDate) {
          const start = new Date(selectedDate); start.setHours(0, 0, 0, 0);
          const end = new Date(selectedDate); end.setHours(23, 59, 59, 999);
          query = query.gte('changed_at', start.toISOString()).lte('changed_at', end.toISOString());
        }

        if (agentFilter !== 'all') {
          if (direction === 'from') query = query.eq('old_assigned_to', agentFilter);
          else if (direction === 'to') query = query.eq('new_assigned_to', agentFilter);
          else query = query.or(`old_assigned_to.eq.${agentFilter},new_assigned_to.eq.${agentFilter}`);
        }

        const { data, error } = await query;
        if (error) throw error;

        const changes = ((data as ChangelogRow[]) || []).filter(
          (r) => r.old_assigned_to !== r.new_assigned_to
        );
        setRows(changes);

        if (changes.length) {
          const leadIds = Array.from(new Set(changes.map((c) => c.lead_id)));
          const oldest = changes[changes.length - 1].changed_at;
          const newest = changes[0].changed_at;
          const { data: auditData } = await supabase
            .from('lead_assignment_audit')
            .select('lead_id, assigned_to_id, previous_assigned_to_id, was_worked, assigned_by, assignment_type, reason, created_at')
            .in('lead_id', leadIds)
            .gte('created_at', new Date(new Date(oldest).getTime() - MATCH_WINDOW_MS).toISOString())
            .lte('created_at', new Date(new Date(newest).getTime() + MATCH_WINDOW_MS).toISOString())
            .order('created_at', { ascending: false });
          setAudits((auditData as AuditRow[]) || []);
        } else {
          setAudits([]);
        }
      } catch (err: any) {
        console.error(err);
        toast.error('Failed to load reassignment audit log');
      } finally {
        setLoading(false);
      }
    };
    run();
  }, [page, selectedDate, agentFilter, direction, refreshKey]);

  const auditFor = (row: ChangelogRow): AuditRow | undefined => {
    const t = new Date(row.changed_at).getTime();
    const candidates = audits.filter((a) => a.lead_id === row.lead_id);
    const exact = candidates.find(
      (a) =>
        a.assigned_to_id === row.new_assigned_to &&
        Math.abs(new Date(a.created_at).getTime() - t) <= MATCH_WINDOW_MS
    );
    if (exact) return exact;
    return candidates.find((a) => Math.abs(new Date(a.created_at).getTime() - t) <= MATCH_WINDOW_MS);
  };

  const leadLabel = (row: ChangelogRow) => {
    const rec = row.new_record || row.old_record || {};
    return rec.vehicle_reg || rec.email || rec.first_name || row.lead_id.slice(0, 8);
  };

  const filtered = useMemo(() => {
    if (!search.trim()) return rows;
    const s = search.trim().toLowerCase();
    return rows.filter((r) => {
      const rec = r.new_record || r.old_record || {};
      const audit = auditFor(r);
      return (
        (rec.email && String(rec.email).toLowerCase().includes(s)) ||
        (rec.vehicle_reg && String(rec.vehicle_reg).toLowerCase().includes(s)) ||
        (rec.first_name && String(rec.first_name).toLowerCase().includes(s)) ||
        (rec.phone && String(rec.phone).includes(s)) ||
        r.lead_id.includes(s) ||
        agentName(r.old_assigned_to).toLowerCase().includes(s) ||
        agentName(r.new_assigned_to).toLowerCase().includes(s) ||
        (audit?.reason || '').toLowerCase().includes(s) ||
        (audit?.assignment_type || '').toLowerCase().includes(s)
      );
    });
  }, [rows, search, audits, byAdminId]);

  const exportCsv = () => {
    const header = ['Time', 'Lead', 'Lead ID', 'From agent', 'To agent', 'Changed by', 'Type', 'Reason'];
    const lines = filtered.map((r) => {
      const audit = auditFor(r);
      const actor = actorLabel(r, audit);
      return [
        format(new Date(r.changed_at), 'yyyy-MM-dd HH:mm:ss'),
        leadLabel(r),
        r.lead_id,
        agentName(r.old_assigned_to),
        agentName(r.new_assigned_to),
        actor.label,
        humanise(audit?.assignment_type || null) || r.change_type,
        audit?.reason || '',
      ]
        .map((v) => `"${String(v).replace(/"/g, '""')}"`)
        .join(',');
    });
    const blob = new Blob([[header.join(','), ...lines].join('\n')], { type: 'text/csv' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `lead-reassignment-audit-${format(new Date(), 'yyyy-MM-dd-HHmm')}.csv`;
    a.click();
    URL.revokeObjectURL(url);
  };

  const salesAgents = useMemo(
    () => admins.filter((a) => ['sales', 'sales_lead', 'sales_manager'].includes(a.role)),
    [admins]
  );

  return (
    <Card>
      <CardHeader>
        <CardTitle className="flex items-center gap-2">
          <ClipboardList className="h-5 w-5" />
          Lead Reassignment Audit Log
        </CardTitle>
        <p className="text-sm text-muted-foreground">
          Every ownership change on a lead: who changed it, when, the agent it moved from and to, and the
          recorded reason or routing rule behind it.
        </p>
      </CardHeader>
      <CardContent className="space-y-4">
        {/* Filters */}
        <div className="flex flex-wrap gap-3 items-center">
          <div className="relative flex-1 min-w-[220px]">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
            <Input
              placeholder="Search reg, email, name, agent, reason..."
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              className="pl-9"
            />
          </div>

          <Select value={agentFilter} onValueChange={(v) => { setAgentFilter(v); setPage(0); }}>
            <SelectTrigger className="w-[200px]">
              <SelectValue placeholder="All agents" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all">All agents</SelectItem>
              {salesAgents.map((a) => (
                <SelectItem key={a.id} value={a.id}>{nameOf(a)}</SelectItem>
              ))}
            </SelectContent>
          </Select>

          <Select
            value={direction}
            onValueChange={(v) => { setDirection(v as any); setPage(0); }}
          >
            <SelectTrigger className="w-[170px]" disabled={agentFilter === 'all'}>
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="any">Moved to or from</SelectItem>
              <SelectItem value="from">Moved away from</SelectItem>
              <SelectItem value="to">Moved to</SelectItem>
            </SelectContent>
          </Select>

          <Popover>
            <PopoverTrigger asChild>
              <Button variant="outline" className="gap-2">
                <CalendarIcon className="h-4 w-4" />
                {selectedDate ? format(selectedDate, 'dd MMM yyyy') : 'Filter by date'}
              </Button>
            </PopoverTrigger>
            <PopoverContent className="w-auto p-0" align="end">
              <Calendar mode="single" selected={selectedDate} onSelect={(d) => { setSelectedDate(d); setPage(0); }} />
              {selectedDate && (
                <div className="p-2 border-t">
                  <Button variant="ghost" size="sm" className="w-full" onClick={() => { setSelectedDate(undefined); setPage(0); }}>
                    Clear date
                  </Button>
                </div>
              )}
            </PopoverContent>
          </Popover>

          <Button variant="outline" size="icon" onClick={() => setRefreshKey((k) => k + 1)} title="Refresh">
            <RefreshCw className="h-4 w-4" />
          </Button>
          <Button variant="outline" className="gap-2" onClick={exportCsv} disabled={filtered.length === 0}>
            <Download className="h-4 w-4" />
            Export CSV
          </Button>
        </div>

        {/* Table */}
        <div className="rounded-md border overflow-x-auto">
          <Table>
            <TableHeader>
              <TableRow className="bg-muted/30">
                <TableHead className="w-[140px]">When</TableHead>
                <TableHead className="w-[130px]">Lead</TableHead>
                <TableHead className="w-[220px]">From → To</TableHead>
                <TableHead className="w-[150px]">Changed by</TableHead>
                <TableHead className="w-[160px]">Type</TableHead>
                <TableHead>Reason</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {loading ? (
                <TableRow>
                  <TableCell colSpan={6} className="text-center py-8">
                    <div className="animate-spin rounded-full h-6 w-6 border-b-2 border-orange-500 mx-auto" />
                  </TableCell>
                </TableRow>
              ) : filtered.length === 0 ? (
                <TableRow>
                  <TableCell colSpan={6} className="text-center py-8 text-muted-foreground">
                    No reassignments found for these filters
                  </TableCell>
                </TableRow>
              ) : (
                filtered.map((row) => {
                  const audit = auditFor(row);
                  const actor = actorLabel(row, audit);
                  return (
                    <TableRow key={row.id}>
                      <TableCell className="text-xs whitespace-nowrap">
                        {format(new Date(row.changed_at), 'dd MMM HH:mm:ss')}
                      </TableCell>
                      <TableCell>
                        <span className="text-xs font-mono bg-yellow-100 text-black px-1.5 py-0.5 rounded-sm">
                          {leadLabel(row)}
                        </span>
                      </TableCell>
                      <TableCell className="text-xs">
                        <span className="flex items-center gap-1 flex-wrap">
                          <span className="text-red-600">{agentName(row.old_assigned_to)}</span>
                          <ArrowRight className="h-3 w-3 shrink-0" />
                          <span className="text-green-600 font-medium">{agentName(row.new_assigned_to)}</span>
                        </span>
                      </TableCell>
                      <TableCell className="text-xs">
                        <span className={actor.system ? 'text-muted-foreground italic' : ''}>{actor.label}</span>
                      </TableCell>
                      <TableCell>
                        <Badge variant="outline" className="text-[11px]">
                          {humanise(audit?.assignment_type || null) || (row.change_type === 'insert' ? 'Lead Created' : 'Manual Update')}
                        </Badge>
                      </TableCell>
                      <TableCell className="text-xs text-muted-foreground">
                        {audit?.reason ? humanise(audit.reason) : '—'}
                      </TableCell>
                    </TableRow>
                  );
                })
              )}
            </TableBody>
          </Table>
        </div>

        {/* Pagination */}
        <div className="flex items-center justify-between">
          <p className="text-xs text-muted-foreground">
            Showing {filtered.length} reassignments
            {selectedDate ? ` on ${format(selectedDate, 'dd MMM yyyy')}` : ''} (page {page + 1})
          </p>
          <div className="flex gap-2">
            <Button variant="outline" size="sm" disabled={page === 0} onClick={() => setPage((p) => p - 1)}>
              <ChevronLeft className="h-4 w-4" />
            </Button>
            <Button variant="outline" size="sm" disabled={rows.length < PAGE_SIZE} onClick={() => setPage((p) => p + 1)}>
              <ChevronRight className="h-4 w-4" />
            </Button>
          </div>
        </div>
      </CardContent>
    </Card>
  );
};
