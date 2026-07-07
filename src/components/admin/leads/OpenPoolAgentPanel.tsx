import { useCallback, useEffect, useState } from 'react';
import { Zap, Phone, Mail, Lock } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Textarea } from '@/components/ui/textarea';
import { Input } from '@/components/ui/input';
import {
  Select, SelectContent, SelectItem, SelectTrigger, SelectValue,
} from '@/components/ui/select';
import { supabase } from '@/integrations/supabase/client';
import { useSharkTankSettings } from '@/hooks/useSharkTank';
import { useCurrentAdminId } from '@/hooks/useCurrentAdminId';
import { toast } from 'sonner';

type Lead = {
  id: string;
  first_name: string | null;
  last_name: string | null;
  email: string | null;
  phone: string | null;
  vehicle_reg: string | null;
  vehicle_make: string | null;
  vehicle_model: string | null;
  pool_status: string | null;
  queue: string | null;
  locked_at: string | null;
  owner_agent: string | null;
};

type OutcomeKey =
  | 'spoke_to_customer' | 'no_answer' | 'voicemail_left' | 'callback_requested'
  | 'not_interested' | 'wrong_number' | 'quote_sent' | 'policy_sent'
  | 'payment_link_sent' | 'sold';

const OUTCOMES: { key: OutcomeKey; label: string }[] = [
  { key: 'spoke_to_customer',  label: 'Spoke to customer' },
  { key: 'no_answer',          label: 'No answer' },
  { key: 'voicemail_left',     label: 'Voicemail left' },
  { key: 'callback_requested', label: 'Call back requested' },
  { key: 'not_interested',     label: 'Not interested' },
  { key: 'wrong_number',       label: 'Wrong number' },
  { key: 'quote_sent',         label: 'Quote sent' },
  { key: 'policy_sent',        label: 'Policy sent' },
  { key: 'payment_link_sent',  label: 'Payment link sent' },
  { key: 'sold',               label: 'Sold' },
];

export function OpenPoolAgentPanel() {
  const { settings } = useSharkTankSettings();
  const adminId = useCurrentAdminId();
  const [lead, setLead] = useState<Lead | null>(null);
  const [loading, setLoading] = useState(false);
  const [outcome, setOutcome] = useState<OutcomeKey | ''>('');
  const [reason, setReason] = useState('');
  const [callbackAt, setCallbackAt] = useState('');
  const [submitting, setSubmitting] = useState(false);

  const loadCurrentLock = useCallback(async () => {
    if (!adminId) return;
    const { data } = await supabase
      .from('sales_leads')
      .select('id, first_name, last_name, email, phone, vehicle_reg, vehicle_make, vehicle_model, pool_status, queue, locked_at, owner_agent')
      .eq('locked_by', adminId)
      .eq('pool_status', 'calling_locked')
      .order('locked_at', { ascending: false })
      .limit(1)
      .maybeSingle();
    setLead((data as Lead) ?? null);
  }, [adminId]);

  useEffect(() => { loadCurrentLock(); }, [loadCurrentLock]);

  const resetForm = () => {
    setOutcome('');
    setReason('');
    setCallbackAt('');
  };

  const handleGetNext = async () => {
    if (!adminId) return;
    setLoading(true);
    try {
      const { data, error } = await (supabase as any).rpc('open_pool_get_next', { _agent: adminId });
      if (error) throw error;
      const id = data?.[0]?.lead_id;
      if (!id) {
        toast.info('No available leads in the Open Pool right now.');
        setLead(null);
        return;
      }
      const { data: row } = await supabase
        .from('sales_leads')
        .select('id, first_name, last_name, email, phone, vehicle_reg, vehicle_make, vehicle_model, pool_status, queue, locked_at, owner_agent')
        .eq('id', id)
        .maybeSingle();
      setLead(row as Lead);
      resetForm();
      toast.success('Lead locked to you — call now.');
    } catch (e: any) {
      toast.error(e.message ?? 'Could not fetch next lead');
    } finally {
      setLoading(false);
    }
  };

  const requiresCallback = outcome === 'callback_requested';
  const requiresLostReason = outcome === 'not_interested';

  const handleSubmit = async () => {
    if (!lead || !adminId || !outcome) return;
    if (requiresCallback && !callbackAt) {
      toast.error('Please choose a callback date/time.');
      return;
    }
    if (requiresLostReason && !reason.trim()) {
      toast.error('Please add a lost reason.');
      return;
    }
    setSubmitting(true);
    try {
      const { error } = await (supabase as any).rpc('open_pool_log_outcome', {
        _lead_id: lead.id,
        _agent: adminId,
        _outcome: outcome,
        _reason: reason.trim() || null,
        _next_action_at: requiresCallback ? new Date(callbackAt).toISOString() : null,
      });
      if (error) throw error;
      toast.success('Outcome logged.');
      setLead(null);
      resetForm();
      loadCurrentLock();
    } catch (e: any) {
      toast.error(e.message ?? 'Could not log outcome');
    } finally {
      setSubmitting(false);
    }
  };

  if (!settings.enabled) return null;

  return (
    <Card className="border-2 border-primary/30">
      <CardHeader className="pb-3">
        <div className="flex items-center justify-between gap-3">
          <CardTitle className="text-base flex items-center gap-2">
            <Zap className="h-4 w-4 text-primary" />
            Open Pool — Your active lead
            {settings.dry_run && (
              <Badge variant="outline" className="border-amber-400 text-amber-700 text-[10px]">Dry run</Badge>
            )}
          </CardTitle>
          <Button onClick={handleGetNext} disabled={loading || !adminId} className="gap-2">
            <Zap className={`h-4 w-4 ${loading ? 'animate-pulse' : ''}`} />
            {loading ? 'Getting…' : lead ? 'Resume active lead' : 'Get Next Lead'}
          </Button>
        </div>
      </CardHeader>
      <CardContent>
        {!lead && (
          <p className="text-sm text-muted-foreground py-6 text-center">
            No lead locked to you. Click <b>Get Next Lead</b> — one at a time. Unattended locks auto-release after 7 minutes.
          </p>
        )}

        {lead && (
          <div className="space-y-4">
            <div className="flex flex-wrap items-start justify-between gap-3 rounded-md border p-3 bg-muted/30">
              <div className="min-w-0">
                <div className="flex items-center gap-2 flex-wrap">
                  <p className="font-semibold">
                    {lead.first_name || 'Unknown'} {lead.last_name || ''}
                  </p>
                  <Badge className="bg-amber-100 text-amber-900 gap-1">
                    <Lock className="h-3 w-3" /> Calling / Locked
                  </Badge>
                  {lead.queue && (
                    <Badge variant="outline" className="text-[10px] uppercase">{lead.queue.replace(/_/g, ' ')}</Badge>
                  )}
                </div>
                <div className="text-xs text-muted-foreground mt-1 flex flex-wrap gap-3">
                  {lead.phone && (
                    <a href={`tel:${lead.phone}`} className="inline-flex items-center gap-1 text-foreground font-medium">
                      <Phone className="h-3 w-3" /> {lead.phone}
                    </a>
                  )}
                  {lead.email && (
                    <a href={`mailto:${lead.email}`} className="inline-flex items-center gap-1">
                      <Mail className="h-3 w-3" /> {lead.email}
                    </a>
                  )}
                  {lead.vehicle_reg && (
                    <span className="font-mono">{lead.vehicle_reg} · {lead.vehicle_make} {lead.vehicle_model}</span>
                  )}
                </div>
              </div>
            </div>

            <div className="grid gap-3 sm:grid-cols-2">
              <div>
                <label className="text-xs font-medium text-muted-foreground">Call outcome</label>
                <Select value={outcome} onValueChange={(v) => setOutcome(v as OutcomeKey)}>
                  <SelectTrigger className="mt-1"><SelectValue placeholder="Select outcome…" /></SelectTrigger>
                  <SelectContent>
                    {OUTCOMES.map(o => (
                      <SelectItem key={o.key} value={o.key}>{o.label}</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>

              {requiresCallback && (
                <div>
                  <label className="text-xs font-medium text-muted-foreground">
                    Callback date &amp; time <span className="text-red-600">*</span>
                  </label>
                  <Input
                    type="datetime-local"
                    value={callbackAt}
                    onChange={(e) => setCallbackAt(e.target.value)}
                    className="mt-1"
                  />
                </div>
              )}
            </div>

            <div>
              <label className="text-xs font-medium text-muted-foreground">
                {requiresLostReason ? <>Lost reason <span className="text-red-600">*</span></> : 'Reason / notes (optional)'}
              </label>
              <Textarea
                value={reason}
                onChange={(e) => setReason(e.target.value)}
                placeholder={requiresLostReason ? 'Why is this lead lost?' : 'What happened on the call?'}
                rows={2}
                className="mt-1"
              />
            </div>

            <div className="flex justify-end">
              <Button
                onClick={handleSubmit}
                disabled={!outcome || submitting}
                className="gap-2"
              >
                {submitting ? 'Saving…' : 'Save outcome'}
              </Button>
            </div>
          </div>
        )}
      </CardContent>
    </Card>
  );
}
