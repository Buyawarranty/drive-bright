import React, { useEffect, useState, useCallback } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { AlertTriangle, Phone, Mail, Hand, X, CheckCircle2 } from 'lucide-react';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Card, CardContent } from '@/components/ui/card';
import { toast } from 'sonner';
import { formatDistanceToNow } from 'date-fns';

interface StruggleAlert {
  id: string;
  signal_type: string;
  customer_name: string | null;
  customer_email: string | null;
  customer_phone: string | null;
  vehicle_reg: string | null;
  device_type: string | null;
  payment_method: string | null;
  plan_name: string | null;
  amount: number | null;
  details: any;
  status: string;
  acknowledged_by: string | null;
  created_at: string;
}

interface Props {
  userRole?: string | null;
}

const SIGNAL_LABELS: Record<string, string> = {
  idle_timeout: 'Idle on checkout',
  long_dwell: 'Stuck on checkout',
  payment_failed: 'Payment failed',
  multi_attempt: 'Multiple payment attempts',
  method_thrash: 'Switched payment methods',
  bumper_cancelled: 'Cancelled at Bumper',
};

export const PaymentFailedLeadsPanel: React.FC<Props> = ({ userRole }) => {
  const isSuperAdmin = userRole === 'super_admin';
  const [alerts, setAlerts] = useState<StruggleAlert[]>([]);
  const [adminMap, setAdminMap] = useState<Record<string, string>>({});
  const [currentAdminId, setCurrentAdminId] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);

  const fetchActive = useCallback(async () => {
    const { data } = await supabase
      .from('checkout_struggle_alerts')
      .select('*')
      .in('status', ['active', 'acknowledged'])
      .gte('created_at', new Date(Date.now() - 60 * 60 * 1000).toISOString()) // last hour
      .order('created_at', { ascending: false })
      .limit(25);
    const rows = (data as StruggleAlert[]) || [];
    setAlerts(rows);

    // Fetch claimer names
    const claimerIds = Array.from(new Set(rows.map(r => r.acknowledged_by).filter(Boolean))) as string[];
    if (claimerIds.length) {
      const { data: au } = await supabase
        .from('admin_users')
        .select('id, first_name, last_name, email')
        .in('id', claimerIds);
      const map: Record<string, string> = {};
      (au || []).forEach((a: any) => {
        map[a.id] = [a.first_name, a.last_name].filter(Boolean).join(' ').trim() || a.email || 'Agent';
      });
      setAdminMap(map);
    }
  }, []);

  useEffect(() => {
    (async () => {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) return;
      const { data: au } = await supabase
        .from('admin_users')
        .select('id')
        .eq('user_id', user.id)
        .maybeSingle();
      setCurrentAdminId(au?.id || null);
    })();
  }, []);

  useEffect(() => {
    fetchActive();
    const channel = supabase
      .channel('payment-failed-leads-panel')
      .on(
        'postgres_changes',
        { event: '*', schema: 'public', table: 'checkout_struggle_alerts' },
        () => fetchActive()
      )
      .subscribe();
    const t = window.setInterval(fetchActive, 60_000);
    return () => {
      supabase.removeChannel(channel);
      window.clearInterval(t);
    };
  }, [fetchActive]);

  const claim = async (id: string) => {
    if (!currentAdminId) {
      toast.error('Unable to identify you — please refresh and try again');
      return;
    }
    setLoading(true);
    const { error } = await supabase
      .from('checkout_struggle_alerts')
      .update({
        status: 'acknowledged',
        acknowledged_by: currentAdminId,
        acknowledged_at: new Date().toISOString(),
      })
      .eq('id', id)
      .is('acknowledged_by', null); // only if not already claimed
    setLoading(false);
    if (error) {
      toast.error('Could not claim — someone may have grabbed it first');
    } else {
      toast.success('Lead claimed — call the customer now');
      fetchActive();
    }
  };

  const dismiss = async (id: string) => {
    await supabase
      .from('checkout_struggle_alerts')
      .update({ status: 'resolved', resolved_at: new Date().toISOString() })
      .eq('id', id);
    fetchActive();
  };

  if (alerts.length === 0) return null;

  return (
    <Card className="border-2 border-red-500 bg-red-50/50">
      <CardContent className="p-3 space-y-2">
        <div className="flex items-center gap-2 text-red-700 font-semibold text-sm">
          <AlertTriangle className="h-4 w-4" />
          Failed payment — customer needs a call now ({alerts.length})
        </div>
        <div className="grid gap-2">
          {alerts.map((a) => {
            const name = a.customer_name || a.customer_email || a.customer_phone || 'Customer';
            const claimedBy = a.acknowledged_by ? adminMap[a.acknowledged_by] : null;
            const isMine = a.acknowledged_by && a.acknowledged_by === currentAdminId;
            const label = SIGNAL_LABELS[a.signal_type] || a.signal_type;
            return (
              <div
                key={a.id}
                className="bg-white border border-red-200 rounded-md p-3 flex flex-wrap items-center gap-3"
              >
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-2 flex-wrap">
                    <span className="font-semibold text-sm">{name}</span>
                    <Badge variant="destructive" className="text-[10px] uppercase tracking-wide">
                      {label}
                    </Badge>
                    {isSuperAdmin && a.device_type && (
                      <Badge variant="outline" className="text-[10px]">
                        {a.device_type}
                      </Badge>
                    )}
                    {isSuperAdmin && a.payment_method && (
                      <Badge variant="outline" className="text-[10px]">
                        {a.payment_method}
                      </Badge>
                    )}
                    {isSuperAdmin && a.plan_name && (
                      <Badge variant="outline" className="text-[10px]">
                        {a.plan_name}
                        {a.amount ? ` · £${a.amount}` : ''}
                      </Badge>
                    )}
                    <span className="text-xs text-muted-foreground">
                      {formatDistanceToNow(new Date(a.created_at), { addSuffix: true })}
                    </span>
                  </div>
                  <div className="flex items-center gap-3 mt-1 text-xs text-muted-foreground flex-wrap">
                    {a.customer_phone && (
                      <span className="flex items-center gap-1">
                        <Phone className="h-3 w-3" /> {a.customer_phone}
                      </span>
                    )}
                    {a.customer_email && (
                      <span className="flex items-center gap-1">
                        <Mail className="h-3 w-3" /> {a.customer_email}
                      </span>
                    )}
                    {a.vehicle_reg && (
                      <span className="font-mono uppercase">{a.vehicle_reg}</span>
                    )}
                  </div>
                </div>
                <div className="flex items-center gap-2 shrink-0">
                  {claimedBy ? (
                    <Badge variant={isMine ? 'default' : 'secondary'} className="gap-1">
                      <CheckCircle2 className="h-3 w-3" />
                      {isMine ? 'You took this' : `Taken by ${claimedBy}`}
                    </Badge>
                  ) : (
                    <Button
                      size="sm"
                      variant="default"
                      disabled={loading}
                      onClick={() => claim(a.id)}
                      className="gap-1 bg-red-600 hover:bg-red-700 text-white"
                    >
                      <Hand className="h-3.5 w-3.5" />
                      Take this lead
                    </Button>
                  )}
                  {a.customer_phone && (
                    <a
                      href={`tel:${a.customer_phone.replace(/\s/g, '')}`}
                      className="inline-flex items-center gap-1 bg-green-600 hover:bg-green-700 text-white text-xs font-semibold px-3 py-1.5 rounded"
                    >
                      <Phone className="h-3.5 w-3.5" /> Call
                    </a>
                  )}
                  <Button
                    size="icon"
                    variant="ghost"
                    className="h-8 w-8"
                    onClick={() => dismiss(a.id)}
                    title="Dismiss"
                  >
                    <X className="h-4 w-4" />
                  </Button>
                </div>
              </div>
            );
          })}
        </div>
      </CardContent>
    </Card>
  );
};
