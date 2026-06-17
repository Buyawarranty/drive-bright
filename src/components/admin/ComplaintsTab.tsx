import React, { useEffect, useMemo, useState } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { Card, CardContent } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Textarea } from '@/components/ui/textarea';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Search, MessageSquare, AlertTriangle, Clock, CheckCircle, Mail, Phone } from 'lucide-react';
import { format } from 'date-fns';
import { useToast } from '@/hooks/use-toast';

type Status = 'new' | 'acknowledged' | 'in_progress' | 'resolved' | 'closed';

interface Complaint {
  id: string;
  reference: string;
  first_name: string;
  last_name: string;
  email: string;
  phone: string | null;
  warranty_ref: string | null;
  registration_plate: string | null;
  category: string;
  description: string;
  desired_outcome: string | null;
  status: Status;
  assigned_to: string | null;
  internal_notes: string | null;
  resolution: string | null;
  preferred_contact_method: string | null;
  acknowledged_at: string | null;
  resolved_at: string | null;
  closed_at: string | null;
  created_at: string;
  updated_at: string;
}

interface AdminUser {
  id: string;
  first_name: string | null;
  last_name: string | null;
  email: string;
}

const STATUS_META: Record<Status, { label: string; color: string; icon: any }> = {
  new: { label: 'New', color: 'bg-red-100 text-red-800 border-red-300', icon: AlertTriangle },
  acknowledged: { label: 'Acknowledged', color: 'bg-blue-100 text-blue-800 border-blue-300', icon: Mail },
  in_progress: { label: 'In progress', color: 'bg-amber-100 text-amber-800 border-amber-300', icon: Clock },
  resolved: { label: 'Resolved', color: 'bg-green-100 text-green-800 border-green-300', icon: CheckCircle },
  closed: { label: 'Closed', color: 'bg-gray-100 text-gray-700 border-gray-300', icon: CheckCircle },
};

export const ComplaintsTab: React.FC = () => {
  const { toast } = useToast();
  const [complaints, setComplaints] = useState<Complaint[]>([]);
  const [admins, setAdmins] = useState<AdminUser[]>([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState('');
  const [statusFilter, setStatusFilter] = useState<Status | 'all'>('all');
  const [selected, setSelected] = useState<Complaint | null>(null);

  const load = async () => {
    setLoading(true);
    const [cRes, aRes] = await Promise.all([
      supabase.from('complaints').select('*').order('created_at', { ascending: false }),
      supabase.from('admin_users').select('id, first_name, last_name, email').eq('is_active', true).order('first_name'),
    ]);
    if (cRes.error) {
      toast({ title: 'Failed to load complaints', description: cRes.error.message, variant: 'destructive' });
    } else {
      setComplaints((cRes.data || []) as Complaint[]);
    }
    setAdmins((aRes.data || []) as AdminUser[]);
    setLoading(false);
  };

  useEffect(() => { load(); }, []);

  const filtered = useMemo(() => {
    return complaints.filter(c => {
      if (statusFilter !== 'all' && c.status !== statusFilter) return false;
      if (search.trim()) {
        const t = search.toLowerCase();
        return (
          c.reference.toLowerCase().includes(t) ||
          `${c.first_name} ${c.last_name}`.toLowerCase().includes(t) ||
          c.email.toLowerCase().includes(t) ||
          (c.registration_plate || '').toLowerCase().includes(t) ||
          (c.warranty_ref || '').toLowerCase().includes(t)
        );
      }
      return true;
    });
  }, [complaints, search, statusFilter]);

  const counts = useMemo(() => {
    const out: Record<string, number> = { all: complaints.length, new: 0, acknowledged: 0, in_progress: 0, resolved: 0, closed: 0 };
    complaints.forEach(c => { out[c.status] = (out[c.status] || 0) + 1; });
    return out;
  }, [complaints]);

  const updateComplaint = async (id: string, patch: Partial<Complaint>) => {
    const now = new Date().toISOString();
    const updates: any = { ...patch };
    if (patch.status === 'acknowledged' && !selected?.acknowledged_at) updates.acknowledged_at = now;
    if (patch.status === 'resolved') updates.resolved_at = now;
    if (patch.status === 'closed') updates.closed_at = now;

    const { error } = await supabase.from('complaints').update(updates).eq('id', id);
    if (error) {
      toast({ title: 'Update failed', description: error.message, variant: 'destructive' });
      return;
    }
    toast({ title: 'Complaint updated' });
    setComplaints(prev => prev.map(c => c.id === id ? { ...c, ...updates } : c));
    setSelected(prev => prev && prev.id === id ? { ...prev, ...updates } : prev);
  };

  const adminLabel = (id: string | null) => {
    if (!id) return 'Unassigned';
    const a = admins.find(x => x.id === id);
    return a ? `${a.first_name || ''} ${a.last_name || ''}`.trim() || a.email : 'Unknown';
  };

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold flex items-center gap-2">
          <MessageSquare className="h-6 w-6 text-primary" /> Complaints
        </h1>
        <p className="text-muted-foreground">Manage customer complaints submitted via the website.</p>
      </div>

      {/* Status pills */}
      <div className="flex flex-wrap gap-2">
        {(['all','new','acknowledged','in_progress','resolved','closed'] as const).map(s => (
          <Button
            key={s}
            size="sm"
            variant={statusFilter === s ? 'default' : 'outline'}
            onClick={() => setStatusFilter(s)}
          >
            {s === 'all' ? 'All' : STATUS_META[s].label} ({counts[s] || 0})
          </Button>
        ))}
      </div>

      {/* Search */}
      <div className="relative max-w-md">
        <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
        <Input
          placeholder="Search reference, name, email, reg plate..."
          value={search}
          onChange={e => setSearch(e.target.value)}
          className="pl-9"
        />
      </div>

      <Card>
        <CardContent className="p-0">
          <div className="overflow-auto">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Reference</TableHead>
                  <TableHead>Submitted</TableHead>
                  <TableHead>Customer</TableHead>
                  <TableHead>Reg / Warranty</TableHead>
                  <TableHead>Category</TableHead>
                  <TableHead>Status</TableHead>
                  <TableHead>Assigned to</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {loading ? (
                  <TableRow><TableCell colSpan={7} className="text-center py-8">Loading…</TableCell></TableRow>
                ) : filtered.length === 0 ? (
                  <TableRow><TableCell colSpan={7} className="text-center py-8 text-muted-foreground">No complaints found</TableCell></TableRow>
                ) : filtered.map(c => {
                  const meta = STATUS_META[c.status];
                  const Icon = meta.icon;
                  return (
                    <TableRow key={c.id} className="cursor-pointer hover:bg-muted/40" onClick={() => setSelected(c)}>
                      <TableCell className="font-mono text-xs">{c.reference}</TableCell>
                      <TableCell className="text-xs whitespace-nowrap">{format(new Date(c.created_at), 'dd/MM/yyyy HH:mm')}</TableCell>
                      <TableCell>
                        <div className="text-sm font-medium">{c.first_name} {c.last_name}</div>
                        <div className="text-xs text-muted-foreground">{c.email}</div>
                      </TableCell>
                      <TableCell>
                        {c.registration_plate && (
                          <span className="inline-block bg-[#FFD307] text-black font-bold font-mono text-xs px-2 py-0.5 rounded border border-black/20 tracking-wider uppercase mr-1">
                            {c.registration_plate}
                          </span>
                        )}
                        <div className="text-xs text-muted-foreground mt-0.5">{c.warranty_ref || '—'}</div>
                      </TableCell>
                      <TableCell className="text-xs">{c.category}</TableCell>
                      <TableCell>
                        <Badge variant="outline" className={`${meta.color} text-xs gap-1`}>
                          <Icon className="h-3 w-3" /> {meta.label}
                        </Badge>
                      </TableCell>
                      <TableCell className="text-xs">{adminLabel(c.assigned_to)}</TableCell>
                    </TableRow>
                  );
                })}
              </TableBody>
            </Table>
          </div>
        </CardContent>
      </Card>

      <Dialog open={!!selected} onOpenChange={o => !o && setSelected(null)}>
        <DialogContent className="max-w-3xl max-h-[90vh] overflow-y-auto">
          {selected && (
            <>
              <DialogHeader>
                <DialogTitle className="flex items-center gap-2">
                  <MessageSquare className="h-5 w-5" /> {selected.reference}
                  <Badge variant="outline" className={STATUS_META[selected.status].color}>
                    {STATUS_META[selected.status].label}
                  </Badge>
                </DialogTitle>
              </DialogHeader>

              <div className="space-y-5 mt-3">
                {/* Customer info */}
                <div className="grid grid-cols-2 gap-3 text-sm">
                  <div>
                    <div className="text-xs text-muted-foreground">Customer</div>
                    <div className="font-medium">{selected.first_name} {selected.last_name}</div>
                  </div>
                  <div>
                    <div className="text-xs text-muted-foreground">Submitted</div>
                    <div>{format(new Date(selected.created_at), 'dd MMM yyyy HH:mm')}</div>
                  </div>
                  <div className="flex items-center gap-2">
                    <Mail className="h-4 w-4 text-muted-foreground" />
                    <a href={`mailto:${selected.email}`} className="text-primary hover:underline">{selected.email}</a>
                  </div>
                  <div className="flex items-center gap-2">
                    <Phone className="h-4 w-4 text-muted-foreground" />
                    {selected.phone ? <a href={`tel:${selected.phone}`} className="text-primary hover:underline">{selected.phone}</a> : <span className="text-muted-foreground">No phone</span>}
                  </div>
                  <div>
                    <div className="text-xs text-muted-foreground">Registration plate</div>
                    {selected.registration_plate ? (
                      <span className="inline-block bg-[#FFD307] text-black font-bold font-mono text-xs px-2 py-0.5 rounded border border-black/20 tracking-wider uppercase">
                        {selected.registration_plate}
                      </span>
                    ) : '—'}
                  </div>
                  <div>
                    <div className="text-xs text-muted-foreground">Warranty ref</div>
                    <div className="font-mono text-xs">{selected.warranty_ref || '—'}</div>
                  </div>
                  <div>
                    <div className="text-xs text-muted-foreground">Category</div>
                    <div>{selected.category}</div>
                  </div>
                  <div>
                    <div className="text-xs text-muted-foreground">Preferred contact</div>
                    <div>{selected.preferred_contact_method || '—'}</div>
                  </div>
                </div>

                {/* What happened */}
                <div className="bg-muted/30 border-l-4 border-orange-500 p-3 rounded">
                  <div className="text-xs font-semibold text-muted-foreground uppercase mb-1">What happened</div>
                  <div className="text-sm whitespace-pre-wrap">{selected.description}</div>
                </div>

                {selected.desired_outcome && (
                  <div className="bg-muted/30 border-l-4 border-primary p-3 rounded">
                    <div className="text-xs font-semibold text-muted-foreground uppercase mb-1">Desired outcome</div>
                    <div className="text-sm whitespace-pre-wrap">{selected.desired_outcome}</div>
                  </div>
                )}

                {/* Handling controls */}
                <div className="grid grid-cols-2 gap-3 pt-2 border-t">
                  <div>
                    <label className="text-xs font-medium text-muted-foreground">Status</label>
                    <Select value={selected.status} onValueChange={(v) => updateComplaint(selected.id, { status: v as Status })}>
                      <SelectTrigger><SelectValue /></SelectTrigger>
                      <SelectContent>
                        {(Object.keys(STATUS_META) as Status[]).map(s => (
                          <SelectItem key={s} value={s}>{STATUS_META[s].label}</SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  </div>
                  <div>
                    <label className="text-xs font-medium text-muted-foreground">Assigned to</label>
                    <Select
                      value={selected.assigned_to || 'unassigned'}
                      onValueChange={(v) => updateComplaint(selected.id, { assigned_to: v === 'unassigned' ? null : v })}
                    >
                      <SelectTrigger><SelectValue /></SelectTrigger>
                      <SelectContent>
                        <SelectItem value="unassigned">Unassigned</SelectItem>
                        {admins.map(a => (
                          <SelectItem key={a.id} value={a.id}>
                            {`${a.first_name || ''} ${a.last_name || ''}`.trim() || a.email}
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  </div>
                </div>

                <div>
                  <label className="text-xs font-medium text-muted-foreground">Internal notes (staff only)</label>
                  <Textarea
                    rows={3}
                    defaultValue={selected.internal_notes || ''}
                    onBlur={(e) => {
                      if (e.target.value !== (selected.internal_notes || '')) {
                        updateComplaint(selected.id, { internal_notes: e.target.value });
                      }
                    }}
                  />
                </div>

                <div>
                  <label className="text-xs font-medium text-muted-foreground">Resolution / outcome</label>
                  <Textarea
                    rows={3}
                    defaultValue={selected.resolution || ''}
                    onBlur={(e) => {
                      if (e.target.value !== (selected.resolution || '')) {
                        updateComplaint(selected.id, { resolution: e.target.value });
                      }
                    }}
                  />
                </div>

                {/* Timeline */}
                <div className="text-xs text-muted-foreground space-y-1 pt-2 border-t">
                  <div>Submitted: {format(new Date(selected.created_at), 'dd MMM yyyy HH:mm')}</div>
                  {selected.acknowledged_at && <div>Acknowledged: {format(new Date(selected.acknowledged_at), 'dd MMM yyyy HH:mm')}</div>}
                  {selected.resolved_at && <div>Resolved: {format(new Date(selected.resolved_at), 'dd MMM yyyy HH:mm')}</div>}
                  {selected.closed_at && <div>Closed: {format(new Date(selected.closed_at), 'dd MMM yyyy HH:mm')}</div>}
                </div>

                {/* Quick actions */}
                <div className="flex flex-wrap gap-2 pt-2 border-t">
                  {selected.status === 'new' && (
                    <Button size="sm" onClick={() => updateComplaint(selected.id, { status: 'acknowledged' })}>
                      Mark as acknowledged
                    </Button>
                  )}
                  {(selected.status === 'new' || selected.status === 'acknowledged') && (
                    <Button size="sm" variant="outline" onClick={() => updateComplaint(selected.id, { status: 'in_progress' })}>
                      Start investigation
                    </Button>
                  )}
                  {selected.status !== 'resolved' && selected.status !== 'closed' && (
                    <Button size="sm" variant="outline" className="text-green-700 border-green-300" onClick={() => updateComplaint(selected.id, { status: 'resolved' })}>
                      Mark as resolved
                    </Button>
                  )}
                  {selected.status === 'resolved' && (
                    <Button size="sm" variant="outline" onClick={() => updateComplaint(selected.id, { status: 'closed' })}>
                      Close complaint
                    </Button>
                  )}
                </div>
              </div>
            </>
          )}
        </DialogContent>
      </Dialog>
    </div>
  );
};

export default ComplaintsTab;
