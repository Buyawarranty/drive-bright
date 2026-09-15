import React, { useEffect, useMemo, useState } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Checkbox } from '@/components/ui/checkbox';
import { Switch } from '@/components/ui/switch';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { CalendarClock, Loader2, Send, X } from 'lucide-react';
import { toast } from 'sonner';
import { supabase } from '@/integrations/supabase/client';
import WhatsAppTemplateSelect from './WhatsAppTemplateSelect';
import { useAllAdminUsersMap } from '@/hooks/useAllAdminUsersMap';

interface AutoSettings {
  id: string;
  is_enabled: boolean;
  template_name: string;
}

interface LeadRow {
  id: string;
  first_name: string | null;
  last_name: string | null;
  phone: string | null;
  status: string | null;
  lead_source: string | null;
  created_at: string;
  assigned_to: string | null;
}

interface ScheduledBatch {
  batch_label: string;
  template_name: string | null;
  send_at: string;
  count: number;
}

type Preset = 'newest20' | 'newest50' | 'newest100' | 'since6pm' | 'today' | 'custom';

const BLOCKED = ['do_not_contact', 'unsubscribed', 'fake_lead'];

/** Same status values and labels as the New Leads table. */
const STATUS_LABELS: Record<string, string> = {
  new: 'Not spoken to',
  contacted: 'Spoken to',
  follow_up: 'Follow-up',
  quote_sent: 'Quote sent',
  negotiating: 'Negotiating',
  converted: 'Converted',
  lost: 'Lost',
  not_interested: 'Not interested',
  fake_lead: 'Fake / 404',
  urgent_callback: 'Urgent call-back',
  no_answer: 'No answer',
  left_voicemail: 'Left voicemail',
  wrong_number: 'Wrong number',
  callback_booked: 'Callback booked',
  bought_elsewhere: 'Bought elsewhere',
  vehicle_sold: 'Vehicle sold',
  do_not_contact: 'Do not contact',
  not_eligible: 'Not eligible',
  unsubscribed: 'Unsubscribed',
};

const hasUkMobile = (phone: string | null): boolean => {
  let digits = (phone || '').replace(/[^\d]/g, '');
  if (digits.startsWith('0044')) digits = digits.slice(2);
  if (digits.startsWith('44')) digits = `0${digits.slice(2)}`;
  if (digits.startsWith('7') && digits.length === 10) digits = `0${digits}`;
  return /^07\d{9}$/.test(digits);
};

const sixPmYesterday = (): Date => {
  const d = new Date();
  d.setDate(d.getDate() - 1);
  d.setHours(18, 0, 0, 0);
  return d;
};

const startOfToday = (): Date => {
  const d = new Date();
  d.setHours(0, 0, 0, 0);
  return d;
};

const toLocalInput = (d: Date) => {
  const pad = (n: number) => String(n).padStart(2, '0');
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}T${pad(d.getHours())}:${pad(d.getMinutes())}`;
};

/** Management tool: pick a WhatsApp template and send it to a chosen set of new leads. */
const WhatsAppBulkTemplateSend: React.FC = () => {
  const [template, setTemplate] = useState('');
  const [preset, setPreset] = useState<Preset>('newest20');
  const [since, setSince] = useState(toLocalInput(sixPmYesterday()));
  const [leads, setLeads] = useState<LeadRow[]>([]);
  const [selected, setSelected] = useState<Set<string>>(new Set());
  const [loading, setLoading] = useState(false);
  const [sending, setSending] = useState(false);
  const [autoSettings, setAutoSettings] = useState<AutoSettings | null>(null);
  const [autoCounts, setAutoCounts] = useState({ pending: 0, sent: 0, failed: 0 });
  const [autoSaving, setAutoSaving] = useState(false);
  const [sendLater, setSendLater] = useState('');
  const [scheduled, setScheduled] = useState<ScheduledBatch[]>([]);
  const agents = useAllAdminUsersMap(leads.map((l) => l.assigned_to));
  const [agentFilter, setAgentFilter] = useState<string>('all');
  const [statusFilter, setStatusFilter] = useState<string>('all');

  const agentLabel = (id: string | null): string | null => {
    if (!id) return null;
    const a = agents.get(id);
    if (!a) return 'Agent';
    const name = [a.first_name, a.last_name].filter(Boolean).join(' ').trim();
    return name || a.email || 'Agent';
  };

  // Agents that own at least one loaded lead, alphabetical, with "(left)" for inactive ones.
  const agentOptions = useMemo(() => {
    const owners = new Set(leads.map((l) => l.assigned_to).filter(Boolean) as string[]);
    return Array.from(owners)
      .map((id) => ({ id, label: agentLabel(id), inactive: agents.get(id)?.is_active === false }))
      .sort((a, b) => a.label.localeCompare(b.label));
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [leads, agents]);

  // Statuses present in the loaded leads (New Leads labels), most common first.
  const statusOptions = useMemo(() => {
    const counts = new Map<string, number>();
    for (const l of leads) {
      const s = String(l.status || 'new');
      counts.set(s, (counts.get(s) || 0) + 1);
    }
    return Array.from(counts.entries()).sort((a, b) => b[1] - a[1]);
  }, [leads]);

  const loadScheduled = async () => {
    const { data } = await supabase
      .from('whatsapp_auto_message_queue')
      .select('batch_label, template_name, next_attempt_at')
      .eq('status', 'pending')
      .gt('next_attempt_at', new Date(Date.now() + 60 * 1000).toISOString())
      .order('next_attempt_at', { ascending: true })
      .limit(1000);
    if (!data) return;
    const grouped = new Map<string, ScheduledBatch>();
    for (const row of data as {
      batch_label: string | null;
      template_name: string | null;
      next_attempt_at: string;
    }[]) {
      const key = row.batch_label || '';
      const existing = grouped.get(key);
      if (existing) {
        existing.count += 1;
        if (row.next_attempt_at < existing.send_at) existing.send_at = row.next_attempt_at;
      } else {
        grouped.set(key, {
          batch_label: key,
          template_name: row.template_name,
          send_at: row.next_attempt_at,
          count: 1,
        });
      }
    }
    setScheduled(Array.from(grouped.values()).sort((a, b) => (a.send_at < b.send_at ? -1 : 1)));
  };

  const cancelScheduled = async (batchLabel: string) => {
    const { error } = await supabase
      .from('whatsapp_auto_message_queue')
      .delete()
      .eq('status', 'pending')
      .eq('batch_label', batchLabel);
    if (error) {
      toast.error('That scheduled batch could not be cancelled.');
      return;
    }
    toast.success('Scheduled batch cancelled — nothing will be sent.');
    void loadScheduled();
    void loadAuto();
  };

  const loadAuto = async () => {
    const { data } = await supabase
      .from('whatsapp_auto_message_settings')
      .select('id, is_enabled, template_name')
      .limit(1)
      .maybeSingle();
    if (data) {
      setAutoSettings(data as AutoSettings);
      setTemplate((prev) => prev || data.template_name);
    }

    const { data: rows } = await supabase
      .from('whatsapp_auto_message_queue')
      .select('status')
      .order('created_at', { ascending: false })
      .limit(500);
    if (rows) {
      setAutoCounts({
        pending: rows.filter((r) => r.status === 'pending').length,
        sent: rows.filter((r) => r.status === 'sent').length,
        failed: rows.filter((r) => r.status === 'failed').length,
      });
    }
  };

  const toggleAuto = async (enabled: boolean) => {
    if (!autoSettings) return;
    if (enabled && !template.trim()) {
      toast.error('Choose a WhatsApp template first.');
      return;
    }
    setAutoSaving(true);
    const patch = enabled
      ? { is_enabled: true, template_name: template.trim() }
      : { is_enabled: false };
    const { error } = await supabase
      .from('whatsapp_auto_message_settings')
      .update(patch)
      .eq('id', autoSettings.id);
    setAutoSaving(false);
    if (error) {
      toast.error('Could not save that change.');
      return;
    }
    setAutoSettings({ ...autoSettings, ...patch });
    toast.success(
      enabled
        ? `Every new lead will now get "${template.trim()}" automatically.`
        : 'Automatic messages switched off.',
    );
  };

  const load = async () => {
    setLoading(true);
    let query = supabase
      .from('sales_leads')
      .select('id, first_name, last_name, phone, status, lead_source, created_at, assigned_to')
      .order('created_at', { ascending: false });

    if (preset === 'since6pm') query = query.gte('created_at', sixPmYesterday().toISOString());
    else if (preset === 'today') query = query.gte('created_at', startOfToday().toISOString());
    else if (preset === 'custom' && since)
      query = query.gte('created_at', new Date(since).toISOString());

    const limit =
      preset === 'newest20' ? 20 : preset === 'newest50' ? 50 : preset === 'newest100' ? 100 : 500;

    const { data, error } = await query.limit(limit);
    setLoading(false);
    if (error) {
      toast.error('Those leads could not be loaded.');
      return;
    }
    const rows = (data || []) as LeadRow[];
    setLeads(rows);
    setSelected(
      new Set(
        rows
          .filter((l) => hasUkMobile(l.phone) && !BLOCKED.includes(String(l.status)))
          .map((l) => l.id),
      ),
    );
  };

  useEffect(() => {
    void load();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [preset, since]);

  useEffect(() => {
    void loadAuto();
    void loadScheduled();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const visibleLeads = useMemo(() => {
    let out = statusFilter === 'all'
      ? leads
      : leads.filter((l) => String(l.status || 'new') === statusFilter);
    if (agentFilter !== 'all') {
      out =
        agentFilter === 'unassigned'
          ? out.filter((l) => !l.assigned_to)
          : out.filter((l) => l.assigned_to === agentFilter);
    }
    return out;
  }, [leads, agentFilter, statusFilter]);

  const sendable = useMemo(
    () => visibleLeads.filter((l) => hasUkMobile(l.phone) && !BLOCKED.includes(String(l.status))),
    [visibleLeads],
  );
  const chosenCount = sendable.filter((l) => selected.has(l.id)).length;
  const allChosen = sendable.length > 0 && chosenCount === sendable.length;

  const toggle = (id: string) => {
    setSelected((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  };

  const handleSend = async () => {
    if (!template.trim() || chosenCount === 0) return;
    const sendAfter = sendLater ? new Date(sendLater) : null;
    const isScheduled = !!sendAfter && sendAfter.getTime() > Date.now();
    setSending(true);
    const { data, error } = await supabase.functions.invoke('wati-send-template-batch', {
      body: {
        leadIds: sendable.filter((l) => selected.has(l.id)).map((l) => l.id),
        templateName: template.trim(),
        ...(isScheduled ? { sendAfter: sendAfter!.toISOString() } : {}),
      },
    });
    setSending(false);

    if (error || !data?.ok) {
      toast.error(
        (data as any)?.error === 'forbidden'
          ? 'Only managers can send WhatsApp batches.'
          : 'The messages could not be sent. Nothing has gone out.',
      );
      return;
    }
    if (data.scheduledFor) {
      toast.success(
        `${data.queued} message${data.queued === 1 ? '' : 's'} scheduled for ${new Date(
          data.scheduledFor,
        ).toLocaleString('en-GB', {
          day: '2-digit',
          month: 'short',
          hour: '2-digit',
          minute: '2-digit',
        })} (${data.templateName}).`,
      );
    } else {
      toast.success(
        `${data.queued} message${data.queued === 1 ? '' : 's'} on their way (${data.templateName}).`,
      );
    }
    setSendLater('');
    void load();
    void loadAuto();
    void loadScheduled();
  };

  const presets: { key: Preset; label: string }[] = [
    { key: 'newest20', label: 'Newest 20' },
    { key: 'newest50', label: 'Newest 50' },
    { key: 'newest100', label: 'Newest 100' },
    { key: 'since6pm', label: 'Since 6pm yesterday' },
    { key: 'today', label: 'Today' },
    { key: 'custom', label: 'Since a time I choose' },
  ];

  return (
    <Card>
      <CardHeader className="pb-3">
        <CardTitle className="text-base">Send a WhatsApp template to new leads</CardTitle>
      </CardHeader>
      <CardContent className="space-y-4">
        <WhatsAppTemplateSelect value={template} onChange={setTemplate} id="wa-bulk-template" />

        {autoSettings && (
          <div className="space-y-2 rounded-md border border-border p-3">
            <div className="flex items-center justify-between gap-4">
              <Label htmlFor="wa-auto-toggle" className="font-medium">
                Automatically send this template to every new lead
              </Label>
              <Switch
                id="wa-auto-toggle"
                checked={autoSettings.is_enabled}
                disabled={autoSaving}
                onCheckedChange={(v) => void toggleAuto(v)}
              />
            </div>
            {autoSettings.is_enabled &&
              autoSettings.template_name !== template.trim() &&
              template.trim() && (
                <p className="text-xs text-muted-foreground">
                  Automatic messages currently use "{autoSettings.template_name}". Switch this off
                  and back on to use "{template.trim()}" instead.
                </p>
              )}
            <div className="flex flex-wrap items-center gap-2">
              <Badge variant="secondary">Waiting to send: {autoCounts.pending}</Badge>
              <Badge variant="secondary">Sent: {autoCounts.sent}</Badge>
              <Badge variant={autoCounts.failed ? 'destructive' : 'secondary'}>
                Not delivered: {autoCounts.failed}
              </Badge>
            </div>
          </div>
        )}

        <div className="flex flex-wrap items-center gap-2">
          {presets.map((p) => (
            <Button
              key={p.key}
              size="sm"
              variant={preset === p.key ? 'default' : 'outline'}
              onClick={() => setPreset(p.key)}
            >
              {p.label}
            </Button>
          ))}
          <Select value={agentFilter} onValueChange={setAgentFilter}>
            <SelectTrigger className="h-9 w-44">
              <SelectValue placeholder="All agents" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all">All agents</SelectItem>
              <SelectItem value="unassigned">Unassigned</SelectItem>
              {agentOptions.map((a) => (
                <SelectItem key={a.id} value={a.id}>
                  {a.label}
                  {a.inactive ? ' (left)' : ''}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>

        {preset === 'custom' && (
          <div className="max-w-xs space-y-1">
            <Label htmlFor="wa-bulk-since">Leads created after</Label>
            <Input
              id="wa-bulk-since"
              type="datetime-local"
              value={since}
              onChange={(e) => setSince(e.target.value)}
            />
          </div>
        )}

        <div className="flex flex-wrap items-center gap-2">
          <Badge variant="secondary">Can be messaged: {sendable.length}</Badge>
          <Badge variant="secondary">Chosen: {chosenCount}</Badge>
          {visibleLeads.length - sendable.length > 0 && (
            <Badge variant="outline">
              Left out (no mobile or do not contact): {visibleLeads.length - sendable.length}
            </Badge>
          )}
          <Button
            size="sm"
            variant="outline"
            onClick={() =>
              setSelected(allChosen ? new Set() : new Set(sendable.map((l) => l.id)))
            }
            disabled={!sendable.length}
          >
            {allChosen ? 'Clear all' : 'Select all'}
          </Button>
        </div>

        <div className="max-h-72 divide-y divide-border overflow-y-auto rounded-md border border-border">
          {loading && (
            <div className="p-4">
              <Loader2 className="h-4 w-4 animate-spin" />
            </div>
          )}
          {!loading && visibleLeads.length === 0 && (
            <p className="p-4 text-sm text-muted-foreground">
              {agentFilter === 'all'
                ? 'No leads match that choice.'
                : agentFilter === 'unassigned'
                  ? 'No unassigned leads in that choice.'
                  : 'No leads for that agent in this list. Try a wider time range.'}
            </p>
          )}
          {!loading &&
            visibleLeads.map((l, i) => {
              const canSend = hasUkMobile(l.phone) && !BLOCKED.includes(String(l.status));
              const name = [l.first_name, l.last_name].filter(Boolean).join(' ') || 'No name';
              const owner = agentLabel(l.assigned_to);
              return (
                <label
                  key={l.id}
                  className="flex cursor-pointer items-center gap-3 px-3 py-2 text-sm hover:bg-muted/50"
                >
                  <span className="w-6 shrink-0 text-right text-xs tabular-nums text-muted-foreground">
                    {i + 1}.
                  </span>
                  <Checkbox
                    checked={selected.has(l.id)}
                    disabled={!canSend}
                    onCheckedChange={() => toggle(l.id)}
                  />
                  <span className="min-w-0 flex-1 truncate font-medium">{name}</span>
                  <span className="w-28 shrink-0 text-muted-foreground">{l.phone || 'no number'}</span>
                  {owner ? (
                    <Badge
                      variant="outline"
                      className="w-24 shrink-0 justify-center truncate border-blue-300 bg-blue-50 text-xs text-blue-700"
                      title={`Lead owner: ${owner}`}
                    >
                      {owner}
                    </Badge>
                  ) : (
                    <span className="w-24 shrink-0 text-center text-xs text-muted-foreground">
                      Unassigned
                    </span>
                  )}
                  <span className="w-32 shrink-0 text-right text-xs text-muted-foreground">
                    {new Date(l.created_at).toLocaleString('en-GB', {
                      day: '2-digit',
                      month: 'short',
                      hour: '2-digit',
                      minute: '2-digit',
                    })}
                  </span>
                  {!canSend && (
                    <Badge variant="outline" className="shrink-0 text-xs">
                      Cannot message
                    </Badge>
                  )}
                </label>
              );
            })}
        </div>

        <div className="space-y-2">
          <div className="flex flex-wrap items-end gap-3">
            <div className="space-y-1">
              <Label htmlFor="wa-send-later" className="text-xs text-muted-foreground">
                Send later (optional)
              </Label>
              <Input
                id="wa-send-later"
                type="datetime-local"
                className="w-56"
                value={sendLater}
                min={toLocalInput(new Date())}
                onChange={(e) => setSendLater(e.target.value)}
              />
            </div>
            <Button
              onClick={() => void handleSend()}
              disabled={sending || !template.trim() || chosenCount === 0}
            >
              {sending ? (
                <Loader2 className="mr-2 h-4 w-4 animate-spin" />
              ) : sendLater && new Date(sendLater).getTime() > Date.now() ? (
                <CalendarClock className="mr-2 h-4 w-4" />
              ) : (
                <Send className="mr-2 h-4 w-4" />
              )}
              {sendLater && new Date(sendLater).getTime() > Date.now()
                ? `Schedule for ${chosenCount} lead${chosenCount === 1 ? '' : 's'}`
                : `Send to ${chosenCount} lead${chosenCount === 1 ? '' : 's'}`}
            </Button>
            {sendLater && (
              <Button size="sm" variant="ghost" onClick={() => setSendLater('')}>
                Clear time
              </Button>
            )}
          </div>
          {sendLater && new Date(sendLater).getTime() > Date.now() && (
            <p className="text-xs text-muted-foreground">
              Goes out at {new Date(sendLater).toLocaleString('en-GB')} — you can cancel it below
              any time before then.
            </p>
          )}
        </div>

        {scheduled.length > 0 && (
          <div className="space-y-2 rounded-md border border-border p-3">
            <p className="text-sm font-medium">Scheduled sends</p>
            <div className="divide-y divide-border">
              {scheduled.map((batch) => (
                <div
                  key={batch.batch_label}
                  className="flex flex-wrap items-center gap-3 py-2 text-sm"
                >
                  <CalendarClock className="h-4 w-4 shrink-0 text-muted-foreground" />
                  <span className="min-w-0 flex-1 truncate">
                    {batch.template_name || 'Template'} to {batch.count} lead
                    {batch.count === 1 ? '' : 's'}
                  </span>
                  <span className="shrink-0 text-muted-foreground">
                    {new Date(batch.send_at).toLocaleString('en-GB', {
                      day: '2-digit',
                      month: 'short',
                      hour: '2-digit',
                      minute: '2-digit',
                    })}
                  </span>
                  <Button
                    size="sm"
                    variant="outline"
                    onClick={() => void cancelScheduled(batch.batch_label)}
                  >
                    <X className="mr-1 h-3.5 w-3.5" />
                    Cancel
                  </Button>
                </div>
              ))}
            </div>
          </div>
        )}
      </CardContent>
    </Card>
  );
};

export default WhatsAppBulkTemplateSend;
