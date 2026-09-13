import React, { useEffect, useMemo, useState } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Checkbox } from '@/components/ui/checkbox';
import { Switch } from '@/components/ui/switch';
import { Loader2, Send } from 'lucide-react';
import { toast } from 'sonner';
import { supabase } from '@/integrations/supabase/client';
import WhatsAppTemplateSelect from './WhatsAppTemplateSelect';

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
}

type Preset = 'newest20' | 'newest50' | 'newest100' | 'since6pm' | 'today' | 'custom';

const BLOCKED = ['do_not_contact', 'unsubscribed', 'fake_lead'];

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

  const load = async () => {
    setLoading(true);
    let query = supabase
      .from('sales_leads')
      .select('id, first_name, last_name, phone, status, lead_source, created_at')
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

  const sendable = useMemo(
    () => leads.filter((l) => hasUkMobile(l.phone) && !BLOCKED.includes(String(l.status))),
    [leads],
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
    setSending(true);
    const { data, error } = await supabase.functions.invoke('wati-send-template-batch', {
      body: {
        leadIds: sendable.filter((l) => selected.has(l.id)).map((l) => l.id),
        templateName: template.trim(),
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
    toast.success(
      `${data.queued} message${data.queued === 1 ? '' : 's'} on their way (${data.templateName}).`,
    );
    void load();
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

        <div className="flex flex-wrap gap-2">
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
          {leads.length - sendable.length > 0 && (
            <Badge variant="outline">
              Left out (no mobile or do not contact): {leads.length - sendable.length}
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
          {!loading && leads.length === 0 && (
            <p className="p-4 text-sm text-muted-foreground">No leads match that choice.</p>
          )}
          {!loading &&
            leads.map((l, i) => {
              const canSend = hasUkMobile(l.phone) && !BLOCKED.includes(String(l.status));
              const name = [l.first_name, l.last_name].filter(Boolean).join(' ') || 'No name';
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

        <Button
          onClick={() => void handleSend()}
          disabled={sending || !template.trim() || chosenCount === 0}
        >
          {sending ? (
            <Loader2 className="mr-2 h-4 w-4 animate-spin" />
          ) : (
            <Send className="mr-2 h-4 w-4" />
          )}
          Send to {chosenCount} lead{chosenCount === 1 ? '' : 's'}
        </Button>
      </CardContent>
    </Card>
  );
};

export default WhatsAppBulkTemplateSend;
