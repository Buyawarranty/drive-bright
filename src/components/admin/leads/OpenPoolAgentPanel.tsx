import { useCallback, useEffect, useState } from 'react';
import { Zap, Phone, Mail, Lock, CheckCircle2, XCircle } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Textarea } from '@/components/ui/textarea';
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

const OUTCOMES: { key: string; label: string; meaningful: boolean; tone: 'green' | 'red' | 'neutral' }[] = [
  { key: 'answered',                label: 'Answered — had conversation', meaningful: true,  tone: 'green' },
  { key: 'callback_requested',      label: 'Callback requested',           meaningful: true,  tone: 'green' },
  { key: 'quote_discussed',         label: 'Quote discussed',              meaningful: true,  tone: 'green' },
  { key: 'policy_requested',        label: 'Policy booklet requested',     meaningful: true,  tone: 'green' },
  { key: 'payment_link_requested',  label: 'Payment link requested',       meaningful: true,  tone: 'green' },
  { key: 'objection',               label: 'Raised objection',             meaningful: true,  tone: 'green' },
  { key: 'buying_intent',           label: 'Showed buying intent',         meaningful: true,  tone: 'green' },
  { key: 'no_answer',               label: 'No answer (releases lock)',    meaningful: false, tone: 'red' },
];

export function OpenPoolAgentPanel() {
  const { settings } = useSharkTankSettings();
  const adminId = useCurrentAdminId();
  const [lead, setLead] = useState<Lead | null>(null);
  const [loading, setLoading] = useState(false);
  const [reason, setReason] = useState('');
  const [logging, setLogging] = useState<string | null>(null);

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
      toast.success('Lead locked to you — call now.');
    } catch (e: any) {
      toast.error(e.message ?? 'Could not fetch next lead');
    } finally {
      setLoading(false);
    }
  };

  const handleOutcome = async (outcome: string, meaningful: boolean) => {
    if (!lead || !adminId) return;
    setLogging(outcome);
    try {
      const { error } = await (supabase as any).rpc('open_pool_log_outcome', {
        _lead_id: lead.id,
        _agent: adminId,
        _outcome: outcome,
        _reason: reason || null,
        _next_action_at: null,
      });
      if (error) throw error;
      toast.success(meaningful ? 'Ownership taken — lead is yours.' : 'Lock released, back to pool.');
      setReason('');
      setLead(null);
      loadCurrentLock();
    } catch (e: any) {
      toast.error(e.message ?? 'Could not log outcome');
    } finally {
      setLogging(null);
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
          <Button
            onClick={handleGetNext}
            disabled={loading || !adminId}
            className="gap-2"
          >
            <Zap className={`h-4 w-4 ${loading ? 'animate-pulse' : ''}`} />
            {loading ? 'Getting…' : lead ? 'Resume active lead' : 'Get Next Lead'}
          </Button>
        </div>
      </CardHeader>
      <CardContent>
        {!lead && (
          <p className="text-sm text-muted-foreground py-6 text-center">
            No lead locked to you. Click <b>Get Next Lead</b> — one at a time. A no-answer will not create ownership.
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

            <div>
              <label className="text-xs font-medium text-muted-foreground">Reason / notes (optional)</label>
              <Textarea
                value={reason}
                onChange={(e) => setReason(e.target.value)}
                placeholder="What happened on the call?"
                rows={2}
                className="mt-1"
              />
            </div>

            <div>
              <div className="text-xs font-medium mb-2">Log call outcome — meaningful contact takes ownership</div>
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
                {OUTCOMES.map(o => (
                  <Button
                    key={o.key}
                    variant="outline"
                    size="sm"
                    disabled={logging !== null}
                    onClick={() => handleOutcome(o.key, o.meaningful)}
                    className={`justify-start gap-2 ${
                      o.tone === 'green'
                        ? 'border-green-300 hover:bg-green-50 hover:text-green-900'
                        : 'border-red-300 hover:bg-red-50 hover:text-red-900'
                    }`}
                  >
                    {o.tone === 'green' ? (
                      <CheckCircle2 className="h-4 w-4 text-green-600" />
                    ) : (
                      <XCircle className="h-4 w-4 text-red-600" />
                    )}
                    {o.label}
                  </Button>
                ))}
              </div>
            </div>
          </div>
        )}
      </CardContent>
    </Card>
  );
}
