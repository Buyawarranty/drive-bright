import React, { useEffect, useState, useCallback } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { AlertTriangle, Phone, Check, X, ChevronDown } from 'lucide-react';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu';

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
  created_at: string;
}

interface Props {
  userRole: string | null;
}

const SIGNAL_LABELS: Record<string, string> = {
  idle_timeout: 'idle on checkout',
  long_dwell: 'stuck on checkout',
  payment_failed: 'payment failed',
  multi_attempt: 'multiple payment attempts',
  method_thrash: 'toggling payment methods',
  bumper_cancelled: 'cancelled Bumper checkout',
};

export const CheckoutStruggleAlertBar: React.FC<Props> = ({ userRole }) => {
  const isAdmin = userRole === 'admin' || userRole === 'super_admin';
  const [alerts, setAlerts] = useState<StruggleAlert[]>([]);

  const fetchActive = useCallback(async () => {
    const { data } = await supabase
      .from('checkout_struggle_alerts')
      .select('*')
      .eq('status', 'active')
      .gte('created_at', new Date(Date.now() - 30 * 60 * 1000).toISOString()) // last 30 min
      .order('created_at', { ascending: false })
      .limit(20);
    setAlerts((data as StruggleAlert[]) || []);
  }, []);

  useEffect(() => {
    if (!isAdmin) return;
    fetchActive();
    const channel = supabase
      .channel('checkout-struggle-alerts')
      .on(
        'postgres_changes',
        { event: '*', schema: 'public', table: 'checkout_struggle_alerts' },
        () => fetchActive()
      )
      .subscribe();
    // Auto-refresh every minute to expire 30-min-old alerts from view
    const t = window.setInterval(fetchActive, 60_000);
    return () => {
      supabase.removeChannel(channel);
      window.clearInterval(t);
    };
  }, [isAdmin, fetchActive]);

  const acknowledge = async (id: string) => {
    const { data: { user } } = await supabase.auth.getUser();
    let adminId: string | null = null;
    if (user) {
      const { data: au } = await supabase
        .from('admin_users')
        .select('id')
        .eq('user_id', user.id)
        .maybeSingle();
      adminId = au?.id || null;
    }
    await supabase
      .from('checkout_struggle_alerts')
      .update({ status: 'acknowledged', acknowledged_by: adminId, acknowledged_at: new Date().toISOString() })
      .eq('id', id);
  };

  const dismiss = async (id: string) => {
    await supabase
      .from('checkout_struggle_alerts')
      .update({ status: 'resolved', resolved_at: new Date().toISOString() })
      .eq('id', id);
  };

  if (!isAdmin || alerts.length === 0) return null;

  const top = alerts[0];
  const extra = alerts.length - 1;
  const label = SIGNAL_LABELS[top.signal_type] || top.signal_type;
  const who = top.customer_name || top.customer_email || top.customer_phone || 'Customer';
  const device = top.device_type ? ` · ${top.device_type}` : '';
  const method = top.payment_method ? ` · ${top.payment_method}` : '';
  const reg = top.vehicle_reg ? ` · ${top.vehicle_reg.toUpperCase()}` : '';
  const failMsg = top.signal_type === 'payment_failed' && top.details?.message ? ` — “${top.details.message}”` : '';

  return (
    <div className="bg-red-600 text-white shadow-lg border-b-2 border-red-800 animate-pulse-once">
      <div className="max-w-7xl mx-auto px-4 py-2.5 flex items-center justify-between gap-3 flex-wrap">
        <div className="flex items-center gap-2 min-w-0 flex-1">
          <AlertTriangle className="h-5 w-5 shrink-0" />
          <div className="text-sm font-medium truncate">
            🚨 <strong>{who}</strong> is {label}{device}{method}{reg}{failMsg}
            {top.customer_phone && (
              <span className="ml-2 opacity-90">· {top.customer_phone}</span>
            )}
          </div>
        </div>
        <div className="flex items-center gap-2 shrink-0">
          {top.customer_phone && (
            <a
              href={`tel:${top.customer_phone.replace(/\s/g, '')}`}
              className="bg-white text-red-700 hover:bg-red-50 px-3 py-1.5 rounded text-sm font-bold inline-flex items-center gap-1.5"
            >
              <Phone className="h-3.5 w-3.5" /> Call now
            </a>
          )}
          <button
            onClick={() => acknowledge(top.id)}
            className="bg-red-700 hover:bg-red-800 px-3 py-1.5 rounded text-sm font-medium inline-flex items-center gap-1.5"
            title="Mark as seen"
          >
            <Check className="h-3.5 w-3.5" /> Got it
          </button>
          <button
            onClick={() => dismiss(top.id)}
            className="bg-red-700 hover:bg-red-800 p-1.5 rounded"
            title="Dismiss"
          >
            <X className="h-4 w-4" />
          </button>
          {extra > 0 && (
            <DropdownMenu>
              <DropdownMenuTrigger className="bg-red-800 hover:bg-red-900 px-2.5 py-1.5 rounded text-sm font-semibold inline-flex items-center gap-1">
                +{extra} more <ChevronDown className="h-3.5 w-3.5" />
              </DropdownMenuTrigger>
              <DropdownMenuContent align="end" className="max-w-md w-96">
                {alerts.slice(1).map((a) => (
                  <DropdownMenuItem key={a.id} className="flex flex-col items-start gap-1 cursor-default" onSelect={(e) => e.preventDefault()}>
                    <div className="text-sm font-medium">
                      {a.customer_name || a.customer_email || 'Customer'} · {SIGNAL_LABELS[a.signal_type] || a.signal_type}
                    </div>
                    <div className="text-xs text-muted-foreground">
                      {a.customer_phone || ''} {a.vehicle_reg ? `· ${a.vehicle_reg}` : ''} {a.device_type ? `· ${a.device_type}` : ''}
                    </div>
                    <div className="flex gap-2 mt-1">
                      {a.customer_phone && (
                        <a href={`tel:${a.customer_phone.replace(/\s/g, '')}`} className="text-xs bg-red-600 text-white px-2 py-1 rounded">Call</a>
                      )}
                      <button onClick={() => acknowledge(a.id)} className="text-xs bg-gray-200 px-2 py-1 rounded">Got it</button>
                      <button onClick={() => dismiss(a.id)} className="text-xs bg-gray-200 px-2 py-1 rounded">Dismiss</button>
                    </div>
                  </DropdownMenuItem>
                ))}
              </DropdownMenuContent>
            </DropdownMenu>
          )}
        </div>
      </div>
    </div>
  );
};
