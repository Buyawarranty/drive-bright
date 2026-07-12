import React, { useEffect, useMemo, useState } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Badge } from '@/components/ui/badge';
import {
  Table, TableBody, TableCell, TableHead, TableHeader, TableRow,
} from '@/components/ui/table';
import {
  Select, SelectContent, SelectItem, SelectTrigger, SelectValue,
} from '@/components/ui/select';
import { format } from 'date-fns';
import { toast } from 'sonner';
import { PhoneCall, PhoneOff, ShieldCheck, ShieldAlert, HelpCircle, RefreshCw } from 'lucide-react';
import { useAuth } from '@/hooks/useAuth';
import { logPhoneEvent } from '@/utils/phoneEventLogger';

interface PhoneEvent {
  id: string;
  agent_id: string | null;
  agent_name: string | null;
  lead_id: string | null;
  customer_id: string | null;
  customer_name: string | null;
  phone_number: string | null;
  lead_source: string | null;
  event_type: string;
  selected_outcome: string | null;
  source_page: string | null;
  reservation_id: string | null;
  recording_url: string | null;
  metadata: any;
  created_at: string;
}

interface Verification {
  id: string;
  phone_event_id: string;
  manager_id: string;
  manager_name: string | null;
  result: 'confirmed_match' | 'confirmed_mismatch' | 'unable_to_verify';
  notes: string | null;
  recording_url: string | null;
  created_at: string;
}

interface Restriction {
  id: string;
  agent_id: string;
  agent_name: string | null;
  level: number;
  status: string;
  starts_at: string;
  ends_at: string | null;
  active_hours_remaining: number | null;
  reason: string | null;
}

const EVENT_LABELS: Record<string, string> = {
  phone_clicked: 'Phone clicked',
  spoken_to_selected: 'Spoken to selected',
  no_answer_selected: 'No answer selected',
  voicemail_selected: 'Left voicemail',
  busy_selected: 'Busy',
  callback_requested: 'Callback requested',
  wrong_number_selected: 'Wrong number',
  not_interested_selected: 'Not interested',
  retry_started: 'Retry started',
  retry_completed: 'Retry completed',
  retry_missed: 'Retry missed',
  reservation_expired: 'Reservation expired',
  manager_confirmed_match: 'Manager confirmed match',
  manager_confirmed_mismatch: 'Manager confirmed mismatch',
  manager_unable_to_verify: 'Manager unable to verify',
  restriction_applied: 'Restriction applied',
  restriction_ended: 'Restriction ended',
};

const OUTCOME_FILTERS = [
  { value: 'all', label: 'All outcomes' },
  { value: 'spoken_to', label: 'Spoken to' },
  { value: 'no_answer', label: 'No answer' },
  { value: 'voicemail_left', label: 'Voicemail' },
  { value: 'busy', label: 'Busy' },
  { value: 'callback_requested', label: 'Callback' },
  { value: 'wrong_number', label: 'Wrong number' },
];

const EVENT_FILTERS = [
  { value: 'all', label: 'All events' },
  { value: 'phone_clicked', label: 'Phone clicked' },
  { value: 'spoken_to_selected', label: 'Spoken to' },
  { value: 'no_answer_selected', label: 'No answer' },
  { value: 'voicemail_selected', label: 'Voicemail' },
  { value: 'busy_selected', label: 'Busy' },
  { value: 'callback_requested', label: 'Callback' },
];

const VERIF_FILTERS = [
  { value: 'all', label: 'All verification states' },
  { value: 'unreviewed', label: 'Unreviewed spoken-to' },
  { value: 'confirmed_match', label: 'Confirmed match' },
  { value: 'confirmed_mismatch', label: 'Confirmed mismatch' },
  { value: 'unable_to_verify', label: 'Unable to verify' },
];

interface Props {
  userRole?: string | null;
}

export const PhoneLogsTab: React.FC<Props> = ({ userRole }) => {
  const { user } = useAuth();
  const [events, setEvents] = useState<PhoneEvent[]>([]);
  const [verifications, setVerifications] = useState<Record<string, Verification>>({});
  const [restrictions, setRestrictions] = useState<Restriction[]>([]);
  const [agents, setAgents] = useState<{ id: string; name: string }[]>([]);
  const [loading, setLoading] = useState(true);

  // Filters
  const today = format(new Date(), 'yyyy-MM-dd');
  const sevenAgo = format(new Date(Date.now() - 7 * 24 * 3600 * 1000), 'yyyy-MM-dd');
  const [dateFrom, setDateFrom] = useState(sevenAgo);
  const [dateTo, setDateTo] = useState(today);
  const [agentFilter, setAgentFilter] = useState<string>('all');
  const [eventFilter, setEventFilter] = useState<string>('all');
  const [outcomeFilter, setOutcomeFilter] = useState<string>('all');
  const [verifFilter, setVerifFilter] = useState<string>('all');
  const [searchTerm, setSearchTerm] = useState('');

  const isManager = ['admin', 'super_admin', 'sales_manager', 'performance_manager'].includes(
    userRole || ''
  );

  const load = async () => {
    setLoading(true);
    try {
      const from = new Date(dateFrom).toISOString();
      const to = new Date(new Date(dateTo).getTime() + 24 * 3600 * 1000).toISOString();

      let q = supabase
        .from('phone_events')
        .select('*')
        .gte('created_at', from)
        .lt('created_at', to)
        .order('created_at', { ascending: false })
        .limit(1000);
      if (agentFilter !== 'all') q = q.eq('agent_id', agentFilter);
      if (eventFilter !== 'all') q = q.eq('event_type', eventFilter);
      if (outcomeFilter !== 'all') q = q.eq('selected_outcome', outcomeFilter);

      const { data: evData, error: evErr } = await q;
      if (evErr) throw evErr;
      setEvents((evData || []) as PhoneEvent[]);

      const eventIds = (evData || []).map((e) => e.id);
      if (eventIds.length > 0) {
        const { data: vData } = await supabase
          .from('phone_event_verifications')
          .select('*')
          .in('phone_event_id', eventIds);
        const map: Record<string, Verification> = {};
        (vData || []).forEach((v: any) => { map[v.phone_event_id] = v as Verification; });
        setVerifications(map);
      } else {
        setVerifications({});
      }

      const { data: rData } = await supabase
        .from('open_pool_restrictions')
        .select('*')
        .order('created_at', { ascending: false })
        .limit(200);
      setRestrictions((rData || []) as Restriction[]);
    } catch (err: any) {
      console.error('PhoneLogsTab load failed', err);
      toast.error('Could not load phone logs');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    // Load agent list for filter
    supabase
      .from('admin_users')
      .select('id, first_name, last_name, email')
      .order('first_name', { ascending: true })
      .then(({ data }) => {
        setAgents(
          (data || []).map((a: any) => ({
            id: a.id,
            name: [a.first_name, a.last_name].filter(Boolean).join(' ').trim() || a.email,
          }))
        );
      });
  }, []);

  useEffect(() => {
    load();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [dateFrom, dateTo, agentFilter, eventFilter, outcomeFilter]);

  // Client-side filter for verification + search
  const visibleEvents = useMemo(() => {
    return events.filter((ev) => {
      if (verifFilter !== 'all') {
        const v = verifications[ev.id];
        if (verifFilter === 'unreviewed') {
          if (ev.event_type !== 'spoken_to_selected' || v) return false;
        } else {
          if (!v || v.result !== verifFilter) return false;
        }
      }
      if (searchTerm.trim()) {
        const t = searchTerm.toLowerCase();
        const hay = [
          ev.customer_name, ev.phone_number, ev.lead_id, ev.agent_name, ev.lead_source,
        ].filter(Boolean).join(' ').toLowerCase();
        if (!hay.includes(t)) return false;
      }
      return true;
    });
  }, [events, verifications, verifFilter, searchTerm]);

  // Summary metrics
  const metrics = useMemo(() => {
    const m = {
      phoneClicks: 0,
      uniqueLeads: new Set<string>(),
      spokenTo: 0,
      noAnswer: 0,
      verifiedSpoken: 0,
      confirmedMismatch: 0,
      retryStarted: 0,
      retryMissed: 0,
    };
    events.forEach((e) => {
      if (e.lead_id) m.uniqueLeads.add(e.lead_id);
      switch (e.event_type) {
        case 'phone_clicked': m.phoneClicks++; break;
        case 'spoken_to_selected':
          m.spokenTo++;
          {
            const v = verifications[e.id];
            if (v?.result === 'confirmed_match') m.verifiedSpoken++;
            if (v?.result === 'confirmed_mismatch') m.confirmedMismatch++;
          }
          break;
        case 'no_answer_selected': m.noAnswer++; break;
        case 'retry_started': m.retryStarted++; break;
        case 'retry_missed': m.retryMissed++; break;
      }
    });
    const activeRestrictions = restrictions.filter((r) => r.status === 'active').length;
    return { ...m, activeRestrictions, uniqueLeadsCount: m.uniqueLeads.size };
  }, [events, verifications, restrictions]);

  const activeRestrictionByAgent = useMemo(() => {
    const s = new Set<string>();
    restrictions.forEach((r) => { if (r.status === 'active') s.add(r.agent_id); });
    return s;
  }, [restrictions]);

  const submitVerification = async (
    ev: PhoneEvent,
    result: Verification['result']
  ) => {
    if (!user) return;
    try {
      // Manager name lookup
      const { data: me } = await supabase
        .from('admin_users')
        .select('id, first_name, last_name, email')
        .eq('user_id', user.id)
        .maybeSingle();
      const managerName = me
        ? [me.first_name, me.last_name].filter(Boolean).join(' ').trim() || me.email
        : user.email || null;

      const { error, data: inserted } = await supabase
        .from('phone_event_verifications')
        .insert({
          phone_event_id: ev.id,
          manager_id: me?.id || user.id,
          manager_name: managerName,
          result,
        })
        .select()
        .maybeSingle();
      if (error) throw error;

      // Append audit event
      const auditType =
        result === 'confirmed_match' ? 'manager_confirmed_match'
        : result === 'confirmed_mismatch' ? 'manager_confirmed_mismatch'
        : 'manager_unable_to_verify';
      await logPhoneEvent({
        eventType: auditType as any,
        leadId: ev.lead_id,
        customerId: ev.customer_id,
        customerName: ev.customer_name,
        phoneNumber: ev.phone_number,
        leadSource: ev.lead_source,
        metadata: {
          original_event_id: ev.id,
          agent_id: ev.agent_id,
          agent_name: ev.agent_name,
          verification_id: inserted?.id,
        },
      });

      toast.success(
        result === 'confirmed_match' ? 'Confirmed spoken to'
        : result === 'confirmed_mismatch' ? 'Mismatch confirmed — restriction will apply'
        : 'Marked as unable to verify'
      );
      load();
    } catch (err: any) {
      console.error(err);
      toast.error(err.message || 'Verification failed');
    }
  };

  return (
    <div className="p-4 md:p-6 space-y-6">
      <div className="flex items-start justify-between flex-wrap gap-3">
        <div>
          <h1 className="text-2xl font-semibold flex items-center gap-2">
            <PhoneCall className="h-6 w-6 text-primary" />
            Phone Logs
          </h1>
          <p className="text-sm text-muted-foreground mt-1">
            Every phone click and call outcome from your sales team, plus manager verification of Spoken to.
          </p>
        </div>
        <Button variant="outline" size="sm" onClick={load} disabled={loading}>
          <RefreshCw className={`h-4 w-4 mr-2 ${loading ? 'animate-spin' : ''}`} />
          Refresh
        </Button>
      </div>

      {/* Summary cards */}
      <div className="grid grid-cols-2 md:grid-cols-4 lg:grid-cols-5 gap-3">
        <MetricCard label="Phone clicks" value={metrics.phoneClicks} />
        <MetricCard label="Unique leads attempted" value={metrics.uniqueLeadsCount} />
        <MetricCard label="Spoken to selected" value={metrics.spokenTo} tone="green" />
        <MetricCard label="No answer selected" value={metrics.noAnswer} tone="orange" />
        <MetricCard label="Verified Spoken to" value={metrics.verifiedSpoken} tone="green" />
        <MetricCard label="Confirmed mismatches" value={metrics.confirmedMismatch} tone="red" />
        <MetricCard label="Retry started" value={metrics.retryStarted} />
        <MetricCard label="Missed retries" value={metrics.retryMissed} tone="red" />
        <MetricCard label="Agents restricted" value={metrics.activeRestrictions} tone="red" />
      </div>

      {/* Filters */}
      <Card>
        <CardHeader className="pb-3">
          <CardTitle className="text-sm">Filters</CardTitle>
        </CardHeader>
        <CardContent className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-3">
          <div>
            <label className="text-xs text-muted-foreground">From</label>
            <Input type="date" value={dateFrom} onChange={(e) => setDateFrom(e.target.value)} />
          </div>
          <div>
            <label className="text-xs text-muted-foreground">To</label>
            <Input type="date" value={dateTo} onChange={(e) => setDateTo(e.target.value)} />
          </div>
          <div>
            <label className="text-xs text-muted-foreground">Agent</label>
            <Select value={agentFilter} onValueChange={setAgentFilter}>
              <SelectTrigger><SelectValue /></SelectTrigger>
              <SelectContent>
                <SelectItem value="all">All agents</SelectItem>
                {agents.map((a) => (
                  <SelectItem key={a.id} value={a.id}>{a.name}</SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
          <div>
            <label className="text-xs text-muted-foreground">Event</label>
            <Select value={eventFilter} onValueChange={setEventFilter}>
              <SelectTrigger><SelectValue /></SelectTrigger>
              <SelectContent>
                {EVENT_FILTERS.map((f) => (
                  <SelectItem key={f.value} value={f.value}>{f.label}</SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
          <div>
            <label className="text-xs text-muted-foreground">Selected outcome</label>
            <Select value={outcomeFilter} onValueChange={setOutcomeFilter}>
              <SelectTrigger><SelectValue /></SelectTrigger>
              <SelectContent>
                {OUTCOME_FILTERS.map((f) => (
                  <SelectItem key={f.value} value={f.value}>{f.label}</SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
          <div>
            <label className="text-xs text-muted-foreground">Manager verification</label>
            <Select value={verifFilter} onValueChange={setVerifFilter}>
              <SelectTrigger><SelectValue /></SelectTrigger>
              <SelectContent>
                {VERIF_FILTERS.map((f) => (
                  <SelectItem key={f.value} value={f.value}>{f.label}</SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
          <div className="md:col-span-2">
            <label className="text-xs text-muted-foreground">Search customer, phone, agent, source</label>
            <Input
              placeholder="Search…"
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
            />
          </div>
        </CardContent>
      </Card>

      {/* Events table */}
      <Card>
        <CardHeader className="pb-3 flex flex-row items-center justify-between">
          <CardTitle className="text-sm">
            {visibleEvents.length} event{visibleEvents.length === 1 ? '' : 's'}
            {loading && ' · loading…'}
          </CardTitle>
        </CardHeader>
        <CardContent className="p-0 overflow-x-auto">
          <Table>
            <TableHeader>
              <TableRow className="bg-muted/30">
                <TableHead className="text-[11px] uppercase">Date · Time</TableHead>
                <TableHead className="text-[11px] uppercase">Agent</TableHead>
                <TableHead className="text-[11px] uppercase">Customer</TableHead>
                <TableHead className="text-[11px] uppercase">Phone</TableHead>
                <TableHead className="text-[11px] uppercase">Source</TableHead>
                <TableHead className="text-[11px] uppercase">Event</TableHead>
                <TableHead className="text-[11px] uppercase">Outcome</TableHead>
                <TableHead className="text-[11px] uppercase">Manager result</TableHead>
                <TableHead className="text-[11px] uppercase">Restriction</TableHead>
                {isManager && <TableHead className="text-[11px] uppercase">Verify</TableHead>}
              </TableRow>
            </TableHeader>
            <TableBody>
              {visibleEvents.map((ev) => {
                const v = verifications[ev.id];
                const restricted = ev.agent_id ? activeRestrictionByAgent.has(ev.agent_id) : false;
                return (
                  <TableRow key={ev.id} className="text-sm">
                    <TableCell className="whitespace-nowrap text-xs">
                      {format(new Date(ev.created_at), 'dd MMM HH:mm:ss')}
                    </TableCell>
                    <TableCell className="whitespace-nowrap">{ev.agent_name || '—'}</TableCell>
                    <TableCell>{ev.customer_name || <span className="text-muted-foreground">—</span>}</TableCell>
                    <TableCell className="font-mono text-xs">{ev.phone_number || '—'}</TableCell>
                    <TableCell className="text-xs">{ev.lead_source || '—'}</TableCell>
                    <TableCell>
                      <EventBadge type={ev.event_type} />
                    </TableCell>
                    <TableCell className="text-xs">
                      {ev.selected_outcome || '—'}
                    </TableCell>
                    <TableCell>
                      {v ? <VerifBadge result={v.result} /> : <span className="text-xs text-muted-foreground">Unreviewed</span>}
                    </TableCell>
                    <TableCell>
                      {restricted ? (
                        <Badge variant="destructive" className="text-[10px]">Open Pool paused</Badge>
                      ) : (
                        <span className="text-xs text-muted-foreground">—</span>
                      )}
                    </TableCell>
                    {isManager && (
                      <TableCell>
                        {ev.event_type === 'spoken_to_selected' && !v && (
                          <div className="flex gap-1">
                            <Button
                              size="sm" variant="outline"
                              className="h-7 px-2 text-[11px] border-green-300 text-green-700 hover:bg-green-50"
                              onClick={() => submitVerification(ev, 'confirmed_match')}
                            >
                              <ShieldCheck className="h-3 w-3 mr-1" /> Match
                            </Button>
                            <Button
                              size="sm" variant="outline"
                              className="h-7 px-2 text-[11px] border-red-300 text-red-700 hover:bg-red-50"
                              onClick={() => submitVerification(ev, 'confirmed_mismatch')}
                            >
                              <ShieldAlert className="h-3 w-3 mr-1" /> Mismatch
                            </Button>
                            <Button
                              size="sm" variant="ghost"
                              className="h-7 px-2 text-[11px]"
                              onClick={() => submitVerification(ev, 'unable_to_verify')}
                            >
                              <HelpCircle className="h-3 w-3 mr-1" /> N/A
                            </Button>
                          </div>
                        )}
                      </TableCell>
                    )}
                  </TableRow>
                );
              })}
              {!loading && visibleEvents.length === 0 && (
                <TableRow>
                  <TableCell colSpan={isManager ? 10 : 9} className="text-center text-muted-foreground py-8">
                    No phone events match these filters.
                  </TableCell>
                </TableRow>
              )}
            </TableBody>
          </Table>
        </CardContent>
      </Card>

      {/* Active restrictions panel */}
      {restrictions.filter((r) => r.status === 'active').length > 0 && (
        <Card className="border-red-200">
          <CardHeader>
            <CardTitle className="text-sm text-red-700 flex items-center gap-2">
              <PhoneOff className="h-4 w-4" /> Active Open Pool restrictions
            </CardTitle>
          </CardHeader>
          <CardContent className="p-0 overflow-x-auto">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Agent</TableHead>
                  <TableHead>Level</TableHead>
                  <TableHead>Started</TableHead>
                  <TableHead>Ends</TableHead>
                  <TableHead>Hours remaining</TableHead>
                  <TableHead>Reason</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {restrictions.filter((r) => r.status === 'active').map((r) => (
                  <TableRow key={r.id}>
                    <TableCell>{r.agent_name || r.agent_id}</TableCell>
                    <TableCell><Badge variant="destructive">Level {r.level}</Badge></TableCell>
                    <TableCell className="text-xs">{format(new Date(r.starts_at), 'dd MMM HH:mm')}</TableCell>
                    <TableCell className="text-xs">{r.ends_at ? format(new Date(r.ends_at), 'dd MMM HH:mm') : '—'}</TableCell>
                    <TableCell className="text-xs">{r.active_hours_remaining ?? '—'}</TableCell>
                    <TableCell className="text-xs">{r.reason || '—'}</TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </CardContent>
        </Card>
      )}
    </div>
  );
};

const MetricCard: React.FC<{ label: string; value: number; tone?: 'green' | 'orange' | 'red' }> = ({
  label, value, tone,
}) => {
  const toneClass =
    tone === 'green' ? 'text-green-700 bg-green-50 border-green-200'
    : tone === 'orange' ? 'text-orange-700 bg-orange-50 border-orange-200'
    : tone === 'red' ? 'text-red-700 bg-red-50 border-red-200'
    : 'text-foreground bg-card border-border';
  return (
    <div className={`rounded-lg border-2 p-3 ${toneClass}`}>
      <div className="text-[11px] uppercase font-semibold opacity-80">{label}</div>
      <div className="text-2xl font-bold mt-1">{value}</div>
    </div>
  );
};

const EventBadge: React.FC<{ type: string }> = ({ type }) => {
  const label = EVENT_LABELS[type] || type;
  const cls =
    type === 'spoken_to_selected' ? 'bg-green-100 text-green-800 border-green-300'
    : type === 'no_answer_selected' ? 'bg-orange-100 text-orange-800 border-orange-300'
    : type === 'manager_confirmed_mismatch' ? 'bg-red-100 text-red-800 border-red-300'
    : type === 'restriction_applied' ? 'bg-red-100 text-red-800 border-red-300'
    : type === 'phone_clicked' ? 'bg-blue-50 text-blue-800 border-blue-200'
    : 'bg-muted text-muted-foreground border-border';
  return <Badge variant="outline" className={`text-[10px] ${cls}`}>{label}</Badge>;
};

const VerifBadge: React.FC<{ result: string }> = ({ result }) => {
  if (result === 'confirmed_match')
    return <Badge className="text-[10px] bg-green-600 text-white">Confirmed</Badge>;
  if (result === 'confirmed_mismatch')
    return <Badge className="text-[10px] bg-red-600 text-white">Mismatch</Badge>;
  return <Badge variant="outline" className="text-[10px]">Unable to verify</Badge>;
};

export default PhoneLogsTab;
