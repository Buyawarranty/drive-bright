import { useEffect, useMemo, useState } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import {
  Select, SelectContent, SelectItem, SelectTrigger, SelectValue,
} from '@/components/ui/select';
import { ShieldAlert, Filter, RefreshCw } from 'lucide-react';
import { format } from 'date-fns';

type OverrideRow = {
  id: string;
  lead_id: string | null;
  phone_normalized: string | null;
  manager_id: string;
  override_type: string;
  reason: string;
  previous_value: any;
  new_value: any;
  previous_owner_id: string | null;
  new_owner_id: string | null;
  allowed_extra_call: boolean;
  refused: boolean;
  refused_reason: string | null;
  created_at: string;
};

const TYPES = [
  { value: 'all', label: 'All override types' },
  { value: 'reassign', label: 'Reassign locked lead' },
  { value: 'release_lock', label: 'Release stuck assignment' },
  { value: 'correct_attempt', label: 'Correct attempt number' },
  { value: 'correct_next_eligible', label: 'Correct next-eligible time' },
  { value: 'move_queue', label: 'Move between queues' },
  { value: 'correct_owner', label: 'Correct owner' },
  { value: 'refused_dnc', label: 'Refused — DNC/Legal' },
];

export function ManagerOverrideAuditPanel() {
  const [rows, setRows] = useState<OverrideRow[]>([]);
  const [loading, setLoading] = useState(false);
  const [nameByAdminId, setNameByAdminId] = useState<Record<string, string>>({});
  const [nameByLeadId, setNameByLeadId] = useState<Record<string, { name: string; phone: string | null }>>({});

  // filters
  const [type, setType] = useState('all');
  const [managerId, setManagerId] = useState('all');
  const [agentId, setAgentId] = useState('all');
  const [phone, setPhone] = useState('');
  const [customer, setCustomer] = useState('');
  const [leadId, setLeadId] = useState('');
  const [attempt, setAttempt] = useState('');
  const [queue, setQueue] = useState('');
  const [fromDate, setFromDate] = useState('');
  const [toDate, setToDate] = useState('');

  const loadStaff = async () => {
    const { data } = await supabase
      .from('admin_users')
      .select('id, user_id, first_name, last_name, email, role, is_active')
      .order('first_name', { ascending: true });
    const map: Record<string, string> = {};
    (data || []).forEach((u: any) => {
      const name = [u.first_name, u.last_name].filter(Boolean).join(' ') || u.email || 'Staff';
      if (u.user_id) map[u.user_id] = name;
    });
    setNameByAdminId(map);
  };

  const load = async () => {
    setLoading(true);
    let q = supabase
      .from('orr_manager_overrides')
      .select('*')
      .order('created_at', { ascending: false })
      .limit(500);

    if (type !== 'all') q = q.eq('override_type', type);
    if (managerId !== 'all') q = q.eq('manager_id', managerId);
    if (agentId !== 'all') q = q.or(`previous_owner_id.eq.${agentId},new_owner_id.eq.${agentId}`);
    if (phone.trim()) q = q.ilike('phone_normalized', `%${phone.trim().replace(/\D/g, '')}%`);
    if (leadId.trim()) q = q.eq('lead_id', leadId.trim());
    if (fromDate) q = q.gte('created_at', `${fromDate}T00:00:00Z`);
    if (toDate) q = q.lte('created_at', `${toDate}T23:59:59Z`);

    const { data, error } = await q;
    setLoading(false);
    if (error) {
      console.error(error);
      return;
    }
    const list = (data || []) as OverrideRow[];
    setRows(list);

    // Enrich lead names
    const ids = Array.from(new Set(list.map(r => r.lead_id).filter(Boolean))) as string[];
    if (ids.length) {
      const { data: leads } = await supabase
        .from('sales_leads')
        .select('id, first_name, last_name, phone_number, email')
        .in('id', ids);
      const map: Record<string, { name: string; phone: string | null }> = {};
      (leads || []).forEach((l: any) => {
        map[l.id] = {
          name: [l.first_name, l.last_name].filter(Boolean).join(' ') || l.email || l.id.slice(0, 8),
          phone: l.phone_number ?? null,
        };
      });
      setNameByLeadId(map);
    } else {
      setNameByLeadId({});
    }
  };

  useEffect(() => { loadStaff(); }, []);
  useEffect(() => { load(); /* eslint-disable-next-line */ }, [type, managerId, agentId, fromDate, toDate]);

  const filtered = useMemo(() => {
    return rows.filter(r => {
      if (customer.trim()) {
        const nm = r.lead_id ? nameByLeadId[r.lead_id]?.name?.toLowerCase() ?? '' : '';
        if (!nm.includes(customer.trim().toLowerCase())) return false;
      }
      if (attempt.trim()) {
        const a = String(r.new_value?.attempt_count ?? r.previous_value?.orr_attempt_count ?? '');
        if (!a.includes(attempt.trim())) return false;
      }
      if (queue.trim()) {
        const pk = `${r.new_value?.pool_kind ?? ''} ${r.new_value?.pool_state ?? ''} ${r.previous_value?.orr_pool_kind ?? ''} ${r.previous_value?.orr_pool_state ?? ''}`.toLowerCase();
        if (!pk.includes(queue.trim().toLowerCase())) return false;
      }
      return true;
    });
  }, [rows, customer, attempt, queue, nameByLeadId]);

  const managerOptions = Object.entries(nameByAdminId);

  return (
    <Card>
      <CardHeader>
        <CardTitle className="flex items-center gap-2">
          <ShieldAlert className="h-5 w-5 text-primary" />
          Manager Override Audit Log
        </CardTitle>
        <p className="text-xs text-muted-foreground">
          Every manager override to the Open Round Robin engine is recorded here.
          Do Not Call, Opted Out, Wrong Number, and legal suppressions cannot be overridden — refused attempts are still logged.
          Records are read-only for agents.
        </p>
      </CardHeader>
      <CardContent className="space-y-4">
        {/* Filters */}
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-3 p-3 rounded-md border border-border bg-muted/30">
          <div>
            <Label className="text-xs flex items-center gap-1"><Filter className="h-3 w-3" /> Override type</Label>
            <Select value={type} onValueChange={setType}>
              <SelectTrigger className="h-9"><SelectValue /></SelectTrigger>
              <SelectContent>
                {TYPES.map(t => <SelectItem key={t.value} value={t.value}>{t.label}</SelectItem>)}
              </SelectContent>
            </Select>
          </div>
          <div>
            <Label className="text-xs">Manager</Label>
            <Select value={managerId} onValueChange={setManagerId}>
              <SelectTrigger className="h-9"><SelectValue placeholder="All managers" /></SelectTrigger>
              <SelectContent>
                <SelectItem value="all">All managers</SelectItem>
                {managerOptions.map(([uid, name]) => (
                  <SelectItem key={uid} value={uid}>{name}</SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
          <div>
            <Label className="text-xs">Agent (prev or new owner)</Label>
            <Select value={agentId} onValueChange={setAgentId}>
              <SelectTrigger className="h-9"><SelectValue placeholder="All agents" /></SelectTrigger>
              <SelectContent>
                <SelectItem value="all">All agents</SelectItem>
                {managerOptions.map(([uid, name]) => (
                  <SelectItem key={uid} value={uid}>{name}</SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
          <div>
            <Label className="text-xs">Telephone number</Label>
            <Input className="h-9" value={phone} onChange={e => setPhone(e.target.value)} placeholder="e.g. 07…" />
          </div>
          <div>
            <Label className="text-xs">Customer name</Label>
            <Input className="h-9" value={customer} onChange={e => setCustomer(e.target.value)} placeholder="Search name" />
          </div>
          <div>
            <Label className="text-xs">Lead ID</Label>
            <Input className="h-9" value={leadId} onChange={e => setLeadId(e.target.value)} placeholder="UUID" />
          </div>
          <div>
            <Label className="text-xs">Attempt #</Label>
            <Input className="h-9" value={attempt} onChange={e => setAttempt(e.target.value)} placeholder="1–7" />
          </div>
          <div>
            <Label className="text-xs">Queue</Label>
            <Input className="h-9" value={queue} onChange={e => setQueue(e.target.value)} placeholder="morning / lunch / evening" />
          </div>
          <div>
            <Label className="text-xs">From</Label>
            <Input className="h-9" type="date" value={fromDate} onChange={e => setFromDate(e.target.value)} />
          </div>
          <div>
            <Label className="text-xs">To</Label>
            <Input className="h-9" type="date" value={toDate} onChange={e => setToDate(e.target.value)} />
          </div>
          <div className="flex items-end">
            <Button variant="outline" size="sm" onClick={load} disabled={loading} className="h-9">
              <RefreshCw className={`h-3.5 w-3.5 mr-1 ${loading ? 'animate-spin' : ''}`} />
              Refresh
            </Button>
          </div>
        </div>

        <div className="text-xs text-muted-foreground">
          {loading ? 'Loading…' : `${filtered.length} override${filtered.length === 1 ? '' : 's'}`}
        </div>

        {/* Rows */}
        <div className="border border-border rounded-md divide-y">
          {filtered.length === 0 && !loading && (
            <div className="p-6 text-center text-sm text-muted-foreground">No override records match these filters.</div>
          )}
          {filtered.map(r => {
            const lead = r.lead_id ? nameByLeadId[r.lead_id] : null;
            const managerName = nameByAdminId[r.manager_id] || 'Manager';
            const prevOwner = r.previous_owner_id ? nameByAdminId[r.previous_owner_id] || '—' : '—';
            const newOwner = r.new_owner_id ? nameByAdminId[r.new_owner_id] || '—' : '—';
            return (
              <div key={r.id} className="p-3 text-sm space-y-2">
                <div className="flex flex-wrap items-center gap-2">
                  <Badge variant={r.refused ? 'destructive' : 'secondary'} className="uppercase text-[10px]">
                    {r.override_type.split('_').join(' ')}
                  </Badge>
                  {r.refused && <Badge variant="destructive">Refused</Badge>}
                  {r.allowed_extra_call && <Badge variant="outline">Extra call allowed</Badge>}
                  <span className="text-xs text-muted-foreground ml-auto">
                    {format(new Date(r.created_at), 'dd MMM yyyy HH:mm')}
                  </span>
                </div>
                <div className="grid grid-cols-1 md:grid-cols-2 gap-x-6 gap-y-1 text-xs">
                  <div><span className="text-muted-foreground">Manager:</span> <span className="font-medium">{managerName}</span></div>
                  <div><span className="text-muted-foreground">Customer / lead:</span> <span className="font-medium">{lead?.name ?? (r.lead_id ? r.lead_id.slice(0, 8) : '—')}</span> {r.phone_normalized && <span className="text-muted-foreground">({r.phone_normalized})</span>}</div>
                  <div><span className="text-muted-foreground">Previous owner:</span> {prevOwner}</div>
                  <div><span className="text-muted-foreground">New owner:</span> {newOwner}</div>
                  <div className="md:col-span-2"><span className="text-muted-foreground">Reason:</span> {r.reason || '—'}</div>
                  {r.refused_reason && (
                    <div className="md:col-span-2 text-destructive"><strong>Refused:</strong> {r.refused_reason}</div>
                  )}
                </div>
                <details className="text-xs">
                  <summary className="cursor-pointer text-muted-foreground">Show previous / new values</summary>
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-3 mt-2">
                    <pre className="bg-muted p-2 rounded overflow-x-auto"><strong>Previous</strong>{'\n'}{JSON.stringify(r.previous_value, null, 2)}</pre>
                    <pre className="bg-muted p-2 rounded overflow-x-auto"><strong>New</strong>{'\n'}{JSON.stringify(r.new_value, null, 2)}</pre>
                  </div>
                </details>
              </div>
            );
          })}
        </div>
      </CardContent>
    </Card>
  );
}

export default ManagerOverrideAuditPanel;
