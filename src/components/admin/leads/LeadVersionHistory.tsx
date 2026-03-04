import React, { useState, useEffect, useMemo } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Input } from '@/components/ui/input';
import { Calendar } from '@/components/ui/calendar';
import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent, AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle, AlertDialogTrigger } from '@/components/ui/alert-dialog';
import { History, RotateCcw, CalendarIcon, Search, ChevronLeft, ChevronRight, ArrowRight } from 'lucide-react';
import { format } from 'date-fns';
import { toast } from 'sonner';

interface ChangelogEntry {
  id: string;
  lead_id: string;
  changed_at: string;
  changed_by: string | null;
  change_type: string;
  old_assigned_to: string | null;
  new_assigned_to: string | null;
  old_status: string | null;
  new_status: string | null;
  old_notes: string | null;
  new_notes: string | null;
  old_record: any;
  new_record: any;
}

interface AgentMap {
  [id: string]: string;
}

export const LeadVersionHistory: React.FC = () => {
  const [entries, setEntries] = useState<ChangelogEntry[]>([]);
  const [agents, setAgents] = useState<AgentMap>({});
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState('');
  const [selectedDate, setSelectedDate] = useState<Date | undefined>(undefined);
  const [page, setPage] = useState(0);
  const [restoring, setRestoring] = useState<string | null>(null);
  const PAGE_SIZE = 50;

  useEffect(() => {
    const fetchAgents = async () => {
      const { data } = await supabase.from('admin_users').select('id, first_name, last_name');
      const map: AgentMap = {};
      (data || []).forEach((a: any) => { map[a.id] = `${a.first_name || ''} ${a.last_name || ''}`.trim() || 'Unknown'; });
      setAgents(map);
    };
    fetchAgents();
  }, []);

  useEffect(() => {
    const fetchChangelog = async () => {
      setLoading(true);
      let query = supabase
        .from('sales_leads_changelog')
        .select('*')
        .order('changed_at', { ascending: false })
        .range(page * PAGE_SIZE, (page + 1) * PAGE_SIZE - 1);

      if (selectedDate) {
        const start = new Date(selectedDate);
        start.setHours(0, 0, 0, 0);
        const end = new Date(selectedDate);
        end.setHours(23, 59, 59, 999);
        query = query.gte('changed_at', start.toISOString()).lte('changed_at', end.toISOString());
      }

      const { data, error } = await query;
      if (error) {
        toast.error('Failed to load changelog');
        console.error(error);
      }
      setEntries((data as any[]) || []);
      setLoading(false);
    };
    fetchChangelog();
  }, [page, selectedDate]);

  const filtered = useMemo(() => {
    if (!search) return entries;
    const s = search.toLowerCase();
    return entries.filter(e => {
      const rec = e.new_record || e.old_record || {};
      return (
        (rec.email && rec.email.toLowerCase().includes(s)) ||
        (rec.vehicle_reg && rec.vehicle_reg.toLowerCase().includes(s)) ||
        (rec.first_name && rec.first_name.toLowerCase().includes(s)) ||
        (rec.phone && rec.phone.includes(s)) ||
        e.lead_id.includes(s)
      );
    });
  }, [entries, search]);

  const getAgentName = (id: string | null) => {
    if (!id) return '—';
    return agents[id] || id.slice(0, 8);
  };

  const getChangeSummary = (entry: ChangelogEntry) => {
    if (entry.change_type === 'snapshot') return 'Baseline snapshot';
    if (entry.change_type === 'insert') return 'Lead created';
    const changes: string[] = [];
    if (entry.old_assigned_to !== entry.new_assigned_to) changes.push('Assignment');
    if (entry.old_status !== entry.new_status) changes.push('Status');
    if (entry.old_notes !== entry.new_notes) changes.push('Notes');
    return changes.length > 0 ? changes.join(', ') : 'Other fields';
  };

  const handleRestore = async (entryId: string) => {
    setRestoring(entryId);
    try {
      const { data, error } = await supabase.rpc('restore_lead_to_snapshot', { p_changelog_id: entryId });
      if (error) throw error;
      const result = data as any;
      if (result?.success) {
        toast.success('Lead restored successfully');
      } else {
        toast.error(result?.error || 'Failed to restore');
      }
    } catch (err: any) {
      toast.error(err.message || 'Restore failed');
    } finally {
      setRestoring(null);
    }
  };

  const getLeadLabel = (entry: ChangelogEntry) => {
    const rec = entry.new_record || entry.old_record || {};
    return rec.vehicle_reg || rec.email || rec.first_name || entry.lead_id.slice(0, 8);
  };

  return (
    <Card>
      <CardHeader>
        <CardTitle className="flex items-center gap-2">
          <History className="h-5 w-5" />
          Lead Version History
        </CardTitle>
        <p className="text-sm text-muted-foreground">
          Every change to assigned_to, status, and notes is recorded. You can restore any lead to a previous state.
        </p>
      </CardHeader>
      <CardContent className="space-y-4">
        {/* Filters */}
        <div className="flex flex-wrap gap-3 items-center">
          <div className="relative flex-1 min-w-[200px]">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
            <Input
              placeholder="Search by reg, email, name, phone..."
              value={search}
              onChange={e => setSearch(e.target.value)}
              className="pl-9"
            />
          </div>
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
                    Clear filter
                  </Button>
                </div>
              )}
            </PopoverContent>
          </Popover>
        </div>

        {/* Table */}
        <div className="rounded-md border overflow-x-auto">
          <Table>
            <TableHeader>
              <TableRow className="bg-muted/30">
                <TableHead className="w-[140px]">Time</TableHead>
                <TableHead className="w-[120px]">Lead</TableHead>
                <TableHead className="w-[80px]">Type</TableHead>
                <TableHead className="w-[160px]">What Changed</TableHead>
                <TableHead className="w-[200px]">Assignment Change</TableHead>
                <TableHead className="w-[140px]">Status Change</TableHead>
                <TableHead className="w-[100px]">Actions</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {loading ? (
                <TableRow>
                  <TableCell colSpan={7} className="text-center py-8">
                    <div className="animate-spin rounded-full h-6 w-6 border-b-2 border-orange-500 mx-auto" />
                  </TableCell>
                </TableRow>
              ) : filtered.length === 0 ? (
                <TableRow>
                  <TableCell colSpan={7} className="text-center py-8 text-muted-foreground">
                    No changelog entries found
                  </TableCell>
                </TableRow>
              ) : (
                filtered.map(entry => (
                  <TableRow key={entry.id}>
                    <TableCell className="text-xs">
                      {format(new Date(entry.changed_at), 'dd MMM HH:mm:ss')}
                    </TableCell>
                    <TableCell>
                      <span className="text-xs font-mono bg-yellow-100 text-black px-1.5 py-0.5 rounded-sm">
                        {getLeadLabel(entry)}
                      </span>
                    </TableCell>
                    <TableCell>
                      <Badge variant={entry.change_type === 'snapshot' ? 'secondary' : entry.change_type === 'insert' ? 'default' : 'outline'} className="text-xs">
                        {entry.change_type}
                      </Badge>
                    </TableCell>
                    <TableCell className="text-xs">{getChangeSummary(entry)}</TableCell>
                    <TableCell className="text-xs">
                      {entry.old_assigned_to !== entry.new_assigned_to ? (
                        <span className="flex items-center gap-1">
                          <span className="text-red-600">{getAgentName(entry.old_assigned_to)}</span>
                          <ArrowRight className="h-3 w-3" />
                          <span className="text-green-600">{getAgentName(entry.new_assigned_to)}</span>
                        </span>
                      ) : (
                        <span className="text-muted-foreground">{getAgentName(entry.new_assigned_to)}</span>
                      )}
                    </TableCell>
                    <TableCell className="text-xs">
                      {entry.old_status !== entry.new_status ? (
                        <span className="flex items-center gap-1">
                          <span className="text-red-600">{entry.old_status || '—'}</span>
                          <ArrowRight className="h-3 w-3" />
                          <span className="text-green-600">{entry.new_status || '—'}</span>
                        </span>
                      ) : (
                        <span className="text-muted-foreground">{entry.new_status || '—'}</span>
                      )}
                    </TableCell>
                    <TableCell>
                      <AlertDialog>
                        <AlertDialogTrigger asChild>
                          <Button
                            variant="ghost"
                            size="sm"
                            className="gap-1 text-xs"
                            disabled={restoring === entry.id || entry.change_type === 'insert'}
                          >
                            <RotateCcw className="h-3 w-3" />
                            Restore
                          </Button>
                        </AlertDialogTrigger>
                        <AlertDialogContent>
                          <AlertDialogHeader>
                            <AlertDialogTitle>Restore lead to this point?</AlertDialogTitle>
                            <AlertDialogDescription>
                              This will revert <strong>{getLeadLabel(entry)}</strong> back to its state at{' '}
                              <strong>{format(new Date(entry.changed_at), 'dd MMM yyyy HH:mm:ss')}</strong>.
                              Fields restored: assigned_to, status, notes, priority, call_count, payment info.
                              This action is logged and can itself be reverted.
                            </AlertDialogDescription>
                          </AlertDialogHeader>
                          <AlertDialogFooter>
                            <AlertDialogCancel>Cancel</AlertDialogCancel>
                            <AlertDialogAction onClick={() => handleRestore(entry.id)}>
                              Restore
                            </AlertDialogAction>
                          </AlertDialogFooter>
                        </AlertDialogContent>
                      </AlertDialog>
                    </TableCell>
                  </TableRow>
                ))
              )}
            </TableBody>
          </Table>
        </div>

        {/* Pagination */}
        <div className="flex items-center justify-between">
          <p className="text-xs text-muted-foreground">
            Showing {filtered.length} entries {selectedDate ? `for ${format(selectedDate, 'dd MMM yyyy')}` : ''} (page {page + 1})
          </p>
          <div className="flex gap-2">
            <Button variant="outline" size="sm" disabled={page === 0} onClick={() => setPage(p => p - 1)}>
              <ChevronLeft className="h-4 w-4" />
            </Button>
            <Button variant="outline" size="sm" disabled={entries.length < PAGE_SIZE} onClick={() => setPage(p => p + 1)}>
              <ChevronRight className="h-4 w-4" />
            </Button>
          </div>
        </div>
      </CardContent>
    </Card>
  );
};
