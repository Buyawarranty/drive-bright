import React, { useEffect, useState, useCallback, useRef } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { AlertTriangle, Phone, Check, X, ChevronDown, Volume2, VolumeX, Copy } from 'lucide-react';
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

// Roles allowed to see the banner. Sales agents see it too — they just can't
// resolve it for everyone else, only hide it locally with X.
const STAFF_ROLES = new Set([
  'admin',
  'super_admin',
  'sales_manager',
  'sales_lead',
  'sales',
  'claims',
  'claims_manager',
]);

const MUTE_KEY = 'checkout-struggle-muted';
const HIDDEN_KEY = 'checkout-struggle-hidden-ids';

// Short attention beep — synthesised at runtime so no audio asset is shipped.
let _beepCtx: AudioContext | null = null;
const playStruggleBeep = () => {
  try {
    const Ctor = (window.AudioContext || (window as any).webkitAudioContext) as typeof AudioContext | undefined;
    if (!Ctor) return;
    _beepCtx = _beepCtx || new Ctor();
    const ctx = _beepCtx;
    if (ctx.state === 'suspended') ctx.resume().catch(() => {});
    const now = ctx.currentTime;
    [660, 990].forEach((freq, i) => {
      const osc = ctx.createOscillator();
      const gain = ctx.createGain();
      osc.type = 'sine';
      osc.frequency.value = freq;
      const start = now + i * 0.18;
      gain.gain.setValueAtTime(0.0001, start);
      gain.gain.exponentialRampToValueAtTime(0.3, start + 0.02);
      gain.gain.exponentialRampToValueAtTime(0.0001, start + 0.18);
      osc.connect(gain).connect(ctx.destination);
      osc.start(start);
      osc.stop(start + 0.2);
    });
  } catch {
    // Audio is nice-to-have; never let it break the UI.
  }
};

export const CheckoutStruggleAlertBar: React.FC<Props> = ({ userRole }) => {
  const canView = !!userRole && STAFF_ROLES.has(userRole);
  const canResolve = userRole === 'admin' || userRole === 'super_admin';
  const [alerts, setAlerts] = useState<StruggleAlert[]>([]);
  const [muted, setMuted] = useState<boolean>(() => {
    try { return localStorage.getItem(MUTE_KEY) === '1'; } catch { return false; }
  });
  const [hiddenIds, setHiddenIds] = useState<Set<string>>(() => {
    try {
      const raw = localStorage.getItem(HIDDEN_KEY);
      return new Set<string>(raw ? JSON.parse(raw) : []);
    } catch {
      return new Set<string>();
    }
  });
  const seenIdsRef = useRef<Set<string>>(new Set());

  const persistHidden = useCallback((next: Set<string>) => {
    try {
      const arr = Array.from(next).slice(-200);
      localStorage.setItem(HIDDEN_KEY, JSON.stringify(arr));
    } catch { /* ignore */ }
  }, []);

  const toggleMute = () => {
    setMuted((m) => {
      const next = !m;
      try { localStorage.setItem(MUTE_KEY, next ? '1' : '0'); } catch { /* ignore */ }
      return next;
    });
  };

  const fetchActive = useCallback(async () => {
    const { data } = await supabase
      .from('checkout_struggle_alerts')
      .select('*')
      .eq('status', 'active')
      .gte('created_at', new Date(Date.now() - 30 * 60 * 1000).toISOString()) // last 30 min
      .order('created_at', { ascending: false })
      .limit(20);
    const list = (data as StruggleAlert[]) || [];
    // Beep once per new alert id we haven't seen before this session.
    let hasNew = false;
    for (const a of list) {
      if (!seenIdsRef.current.has(a.id) && !hiddenIds.has(a.id)) {
        hasNew = true;
        seenIdsRef.current.add(a.id);
      }
    }
    if (hasNew && !muted) playStruggleBeep();
    setAlerts(list);
  }, [muted, hiddenIds]);

  useEffect(() => {
    if (!canView) return;
    fetchActive();
    const channel = supabase
      .channel('checkout-struggle-alerts')
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
  }, [canView, fetchActive]);

  // Hide locally — X button. Does NOT resolve the row in the DB, so other
  // agents still see the customer live on the page.
  const hideLocally = (id: string) => {
    setHiddenIds((prev) => {
      const next = new Set(prev);
      next.add(id);
      persistHidden(next);
      return next;
    });
  };

  const acknowledge = async (id: string) => {
    if (!canResolve) { hideLocally(id); return; }
    setAlerts((prev) => prev.filter((a) => a.id !== id));
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
    const { error } = await supabase
      .from('checkout_struggle_alerts')
      .update({ status: 'acknowledged', acknowledged_by: adminId, acknowledged_at: new Date().toISOString() })
      .eq('id', id);
    if (error) {
      console.error('[CheckoutStruggleAlertBar] acknowledge failed', error);
      fetchActive();
    }
  };

  const dismiss = async (id: string) => {
    if (!canResolve) { hideLocally(id); return; }
    setAlerts((prev) => prev.filter((a) => a.id !== id));
    const { error } = await supabase
      .from('checkout_struggle_alerts')
      .update({ status: 'resolved', resolved_at: new Date().toISOString() })
      .eq('id', id);
    if (error) {
      console.error('[CheckoutStruggleAlertBar] dismiss failed', error);
      fetchActive();
    }
  };

  if (!canView) return null;
  const visible = alerts.filter((a) => !hiddenIds.has(a.id));
  if (visible.length === 0) return null;

  const top = visible[0];
  const extra = visible.length - 1;
  const label = SIGNAL_LABELS[top.signal_type] || top.signal_type;
  const who = top.customer_name || top.customer_email || top.customer_phone || 'Customer';
  const device = top.device_type ? ` · ${top.device_type}` : '';
  const method = top.payment_method ? ` · ${top.payment_method}` : '';
  const reg = top.vehicle_reg ? ` · ${top.vehicle_reg.toUpperCase()}` : '';
  const failMsg = top.signal_type === 'payment_failed' && top.details?.message ? ` — “${top.details.message}”` : '';

  const phoneNumber = top.customer_phone || null;
  const telHref = phoneNumber ? `tel:${phoneNumber.replace(/\s/g, '')}` : null;
  const copyNumber = () => {
    if (!phoneNumber) return;
    navigator.clipboard.writeText(phoneNumber.replace(/\s/g, '')).catch(() => {});
  };

  return (
    <div className="bg-red-600 text-white shadow-lg border-b-2 border-red-800 animate-pulse-once">
      <div className="mx-auto px-4 sm:px-6 lg:px-8 py-3 flex items-center justify-between gap-4">
        <div className="flex items-center gap-2 min-w-0 flex-1">
          <AlertTriangle className="h-5 w-5 shrink-0" />
          <div
            className="text-sm font-medium flex items-center min-w-0"
            title={`${who} is ${label}${device}${method}${reg}${failMsg}${phoneNumber ? ' · ' + phoneNumber : ''}`}
          >
            <span className="truncate">
              🚨 <strong>{who}</strong> is {label}{device}{method}{reg}{failMsg}
            </span>
            {telHref && (
              <span className="whitespace-nowrap shrink-0 opacity-90">
                {' · '}
                <a
                  href={telHref}
                  className="underline hover:opacity-100 select-text"
                  title={`Call ${phoneNumber}`}
                >
                  {phoneNumber}
                </a>
              </span>
            )}
          </div>
        </div>
        <div className="flex items-center gap-2 shrink-0">
          {telHref && (
            <>
              <a
                href={telHref}
                className="bg-white text-red-700 hover:bg-red-50 px-3 py-1.5 rounded text-sm font-bold inline-flex items-center gap-1.5"
              >
                <Phone className="h-3.5 w-3.5" /> Call now
              </a>
              <button
                onClick={copyNumber}
                className="bg-red-700 hover:bg-red-800 p-1.5 rounded"
                title="Copy phone number"
                aria-label="Copy phone number"
              >
                <Copy className="h-4 w-4" />
              </button>
            </>
          )}
          <button
            onClick={toggleMute}
            className="bg-red-700 hover:bg-red-800 p-1.5 rounded"
            title={muted ? 'Unmute beep' : 'Mute beep'}
            aria-label={muted ? 'Unmute beep' : 'Mute beep'}
          >
            {muted ? <VolumeX className="h-4 w-4" /> : <Volume2 className="h-4 w-4" />}
          </button>
          {canResolve && (
            <button
              onClick={() => acknowledge(top.id)}
              className="bg-red-700 hover:bg-red-800 px-3 py-1.5 rounded text-sm font-medium inline-flex items-center gap-1.5"
              title="Mark as seen (clears for everyone)"
            >
              <Check className="h-3.5 w-3.5" /> Got it
            </button>
          )}
          <button
            onClick={() => canResolve ? dismiss(top.id) : hideLocally(top.id)}
            className="bg-red-700 hover:bg-red-800 p-1.5 rounded"
            title={canResolve ? 'Dismiss (clears for everyone)' : 'Hide for me — stays live for others'}
          >
            <X className="h-4 w-4" />
          </button>
          {extra > 0 && (
            <DropdownMenu>
              <DropdownMenuTrigger className="bg-red-800 hover:bg-red-900 px-2.5 py-1.5 rounded text-sm font-semibold inline-flex items-center gap-1">
                +{extra} more <ChevronDown className="h-3.5 w-3.5" />
              </DropdownMenuTrigger>
              <DropdownMenuContent align="end" className="max-w-md w-96">
                {visible.slice(1).map((a) => {
                  const aTel = a.customer_phone ? `tel:${a.customer_phone.replace(/\s/g, '')}` : null;
                  return (
                    <DropdownMenuItem key={a.id} className="flex flex-col items-start gap-1 cursor-default" onSelect={(e) => e.preventDefault()}>
                      <div className="text-sm font-medium">
                        {a.customer_name || a.customer_email || 'Customer'} · {SIGNAL_LABELS[a.signal_type] || a.signal_type}
                      </div>
                      <div className="text-xs text-muted-foreground">
                        {aTel ? (
                          <a href={aTel} className="underline hover:text-red-600 select-text">{a.customer_phone}</a>
                        ) : (
                          a.customer_phone || ''
                        )}
                        {' '}
                        {a.vehicle_reg ? `· ${a.vehicle_reg}` : ''} {a.device_type ? `· ${a.device_type}` : ''}
                      </div>
                      <div className="flex gap-2 mt-1">
                        {aTel && (
                          <a href={aTel} className="text-xs bg-red-600 text-white px-2 py-1 rounded">Call</a>
                        )}
                        {canResolve && (
                          <button onClick={() => acknowledge(a.id)} className="text-xs bg-gray-200 px-2 py-1 rounded">Got it</button>
                        )}
                        <button
                          onClick={() => canResolve ? dismiss(a.id) : hideLocally(a.id)}
                          className="text-xs bg-gray-200 px-2 py-1 rounded"
                        >
                          {canResolve ? 'Dismiss' : 'Hide'}
                        </button>
                      </div>
                    </DropdownMenuItem>
                  );
                })}
              </DropdownMenuContent>
            </DropdownMenu>
          )}
        </div>
      </div>
    </div>
  );
};
