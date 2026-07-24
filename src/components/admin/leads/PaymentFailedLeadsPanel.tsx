import React, { useEffect, useState, useCallback, useRef } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { AlertTriangle, Phone, Mail, Hand, X, Copy, Volume2, VolumeX } from 'lucide-react';
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

const MUTE_KEY = 'payment-failed-panel-muted';
const HIDDEN_KEY = 'payment-failed-panel-hidden-ids';

// Short attention beep — synthesised at runtime.
let _beepCtx: AudioContext | null = null;
const playAlertBeep = () => {
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
  } catch { /* ignore */ }
};

export const PaymentFailedLeadsPanel: React.FC<Props> = ({ userRole }) => {
  const isSuperAdmin = userRole === 'super_admin';
  const [alerts, setAlerts] = useState<StruggleAlert[]>([]);
  const [currentAdminId, setCurrentAdminId] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);
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

  const hideLocally = (id: string) => {
    setHiddenIds((prev) => {
      const next = new Set(prev);
      next.add(id);
      persistHidden(next);
      return next;
    });
  };

  const fetchActive = useCallback(async () => {
    // Only ACTIVE alerts — once someone takes it, status flips to acknowledged
    // and it vanishes from everyone's panel automatically.
    const { data } = await supabase
      .from('checkout_struggle_alerts')
      .select('*')
      .eq('status', 'active')
      .gte('created_at', new Date(Date.now() - 60 * 60 * 1000).toISOString())
      .order('created_at', { ascending: false })
      .limit(25);
    const rows = (data as StruggleAlert[]) || [];
    // Beep once per new unseen alert.
    let hasNew = false;
    for (const a of rows) {
      if (!seenIdsRef.current.has(a.id) && !hiddenIds.has(a.id)) {
        hasNew = true;
        seenIdsRef.current.add(a.id);
      }
    }
    if (hasNew && !muted) playAlertBeep();
    setAlerts(rows);
  }, [muted, hiddenIds]);

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
      .is('acknowledged_by', null);
    setLoading(false);
    if (error) {
      toast.error('Could not claim — someone may have grabbed it first');
    } else {
      toast.success('Lead claimed — call the customer now');
      fetchActive();
    }
  };

  const copyPhone = (phone: string) => {
    navigator.clipboard.writeText(phone.replace(/\s/g, '')).then(
      () => toast.success('Number copied'),
      () => toast.error('Copy failed')
    );
  };

  const visible = alerts.filter((a) => !hiddenIds.has(a.id));
  if (visible.length === 0) return null;

  return (
    <div className="rounded-lg overflow-hidden shadow-lg bg-red-600 text-white border-2 border-red-800">
      {/* Header */}
      <div className="flex items-center justify-between px-4 py-2.5 bg-red-700">
        <div className="flex items-center gap-2 font-semibold text-sm">
          <AlertTriangle className="h-4 w-4" />
          Failed payment — customer needs a call now ({visible.length})
        </div>
        <button
          onClick={toggleMute}
          className="inline-flex items-center gap-1.5 bg-red-800/70 hover:bg-red-900 text-white text-xs font-medium px-2.5 py-1 rounded"
          title={muted ? 'Unmute alerts' : 'Mute alerts'}
          aria-label={muted ? 'Unmute alerts' : 'Mute alerts'}
        >
          {muted ? <VolumeX className="h-3.5 w-3.5" /> : <Volume2 className="h-3.5 w-3.5" />}
          {muted ? 'Muted' : 'Mute'}
        </button>
      </div>

      {/* Column headers */}
      <div className="hidden md:grid grid-cols-[minmax(0,1.4fr)_minmax(0,1.6fr)_minmax(0,1fr)_minmax(0,0.8fr)_auto] gap-3 px-4 py-2 text-[11px] uppercase tracking-wide font-semibold bg-red-700/60 text-red-50">
        <div>Customer</div>
        <div>Signal / details</div>
        <div>Phone</div>
        <div>When</div>
        <div className="text-right">Actions</div>
      </div>

      {/* Rows */}
      <div className="divide-y divide-red-500/50">
        {visible.map((a) => {
          const name = a.customer_name || a.customer_email || a.customer_phone || 'Customer';
          const label = SIGNAL_LABELS[a.signal_type] || a.signal_type;
          const phone = a.customer_phone || '';
          const telHref = phone ? `tel:${phone.replace(/\s/g, '')}` : null;
          return (
            <div
              key={a.id}
              className="grid grid-cols-1 md:grid-cols-[minmax(0,1.4fr)_minmax(0,1.6fr)_minmax(0,1fr)_minmax(0,0.8fr)_auto] gap-3 px-4 py-3 items-center"
            >
              {/* Customer */}
              <div className="min-w-0">
                <div className="font-semibold text-sm truncate">{name}</div>
                {a.customer_email && (
                  <div className="flex items-center gap-1 text-xs text-red-100/90 truncate">
                    <Mail className="h-3 w-3 shrink-0" />
                    <span className="truncate">{a.customer_email}</span>
                  </div>
                )}
                {a.vehicle_reg && (
                  <div className="text-[11px] font-mono uppercase mt-0.5 text-red-100/90">{a.vehicle_reg}</div>
                )}
              </div>

              {/* Signal + tags */}
              <div className="flex flex-wrap items-center gap-1.5 min-w-0">
                <span className="inline-flex items-center bg-white text-red-700 text-[10px] font-bold uppercase tracking-wide px-2 py-0.5 rounded">
                  {label}
                </span>
                {isSuperAdmin && a.device_type && (
                  <span className="inline-flex items-center bg-red-800/60 text-white text-[10px] px-2 py-0.5 rounded">
                    {a.device_type}
                  </span>
                )}
                {isSuperAdmin && a.payment_method && (
                  <span className="inline-flex items-center bg-red-800/60 text-white text-[10px] px-2 py-0.5 rounded">
                    {a.payment_method}
                  </span>
                )}
                {isSuperAdmin && a.plan_name && (
                  <span className="inline-flex items-center bg-red-800/60 text-white text-[10px] px-2 py-0.5 rounded">
                    {a.plan_name}{a.amount ? ` · £${a.amount}` : ''}
                  </span>
                )}
              </div>

              {/* Phone column — click-to-dial + copy */}
              <div className="min-w-0">
                {telHref ? (
                  <div className="flex items-center gap-1.5">
                    <Phone className="h-3.5 w-3.5 shrink-0" />
                    <a
                      href={telHref}
                      className="font-mono text-sm underline decoration-red-200/70 hover:decoration-white select-all truncate"
                      title={`Call ${phone}`}
                    >
                      {phone}
                    </a>
                    <button
                      onClick={() => copyPhone(phone)}
                      className="p-1 rounded hover:bg-red-800/70 shrink-0"
                      title="Copy number"
                      aria-label="Copy number"
                    >
                      <Copy className="h-3.5 w-3.5" />
                    </button>
                  </div>
                ) : (
                  <span className="text-xs text-red-100/70">No phone</span>
                )}
              </div>

              {/* When */}
              <div className="text-xs text-red-50/90 whitespace-nowrap">
                {formatDistanceToNow(new Date(a.created_at), { addSuffix: true })}
              </div>

              {/* Actions */}
              <div className="flex items-center justify-end gap-2">
                <button
                  disabled={loading}
                  onClick={() => claim(a.id)}
                  className="inline-flex items-center gap-1.5 bg-white text-red-700 hover:bg-red-50 text-xs font-bold px-3 py-1.5 rounded disabled:opacity-60"
                >
                  <Hand className="h-3.5 w-3.5" />
                  Take this lead
                </button>
                {telHref && (
                  <a
                    href={telHref}
                    className="inline-flex items-center gap-1.5 bg-green-600 hover:bg-green-700 text-white text-xs font-bold px-3 py-1.5 rounded"
                  >
                    <Phone className="h-3.5 w-3.5" /> Call
                  </a>
                )}
                <button
                  onClick={() => hideLocally(a.id)}
                  className="p-1.5 rounded hover:bg-red-800/70"
                  title="Hide for me — stays live for other agents until someone takes it"
                  aria-label="Hide for me"
                >
                  <X className="h-4 w-4" />
                </button>
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
};
