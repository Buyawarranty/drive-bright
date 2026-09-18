import React, { useEffect, useState, useCallback, useRef } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { AlertTriangle, Phone, Mail, Hand, X, Copy, Volume2, VolumeX } from 'lucide-react';
import { toast } from 'sonner';
import { formatDistanceToNow } from 'date-fns';
import { withBackgroundPriority } from '@/lib/requestQueue';
import { consumeAlertSound } from '@/lib/alertSoundBudget';

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

// Same customer signalling repeatedly within this window is ONE alert row.
// A fresh row (and a fresh beep) only appears once they go quiet for longer than this.
const DEDUPE_WINDOW_MS = 30 * 60 * 1000;

/** Stable identity for a customer across signals: email → phone tail-9 → name. */
const customerKey = (a: StruggleAlert): string => {
  const email = (a.customer_email || '').trim().toLowerCase();
  if (email) return `e:${email}`;
  const digits = (a.customer_phone || '').replace(/\D/g, '');
  if (digits.length >= 9) return `p:${digits.slice(-9)}`;
  const reg = (a.vehicle_reg || '').replace(/\s/g, '').toUpperCase();
  if (reg) return `r:${reg}`;
  return `n:${(a.customer_name || 'unknown').trim().toLowerCase()}`;
};

interface AlertGroup {
  primary: StruggleAlert;
  ids: string[];
  repeats: number;
  extraLabels: string[];
  firstAt: string;
}

/**
 * Collapse alerts so one customer never stacks up multiple pop-up rows at the
 * same time. Signals within DEDUPE_WINDOW_MS of each other roll into the newest
 * row; a genuinely later burst (hours apart) gets its own row again.
 */
const groupAlerts = (rows: StruggleAlert[]): AlertGroup[] => {
  const byKey = new Map<string, StruggleAlert[]>();
  for (const a of rows) {
    const k = customerKey(a);
    const list = byKey.get(k) || [];
    list.push(a);
    byKey.set(k, list);
  }
  const groups: AlertGroup[] = [];
  byKey.forEach((list) => {
    const sorted = [...list].sort(
      (x, y) => new Date(y.created_at).getTime() - new Date(x.created_at).getTime()
    );
    let bucket: StruggleAlert[] = [];
    const flush = () => {
      if (!bucket.length) return;
      const primary = bucket[0];
      const extras = bucket.slice(1);
      const labels = Array.from(
        new Set(extras.map((e) => SIGNAL_LABELS[e.signal_type] || e.signal_type))
      ).filter((l) => l !== (SIGNAL_LABELS[primary.signal_type] || primary.signal_type));
      groups.push({
        primary,
        ids: bucket.map((b) => b.id),
        repeats: extras.length,
        extraLabels: labels,
        firstAt: bucket[bucket.length - 1].created_at,
      });
      bucket = [];
    };
    for (const a of sorted) {
      if (!bucket.length) {
        bucket.push(a);
        continue;
      }
      const prev = new Date(bucket[bucket.length - 1].created_at).getTime();
      const cur = new Date(a.created_at).getTime();
      if (prev - cur <= DEDUPE_WINDOW_MS) bucket.push(a);
      else {
        flush();
        bucket.push(a);
      }
    }
    flush();
  });
  return groups.sort(
    (a, b) => new Date(b.primary.created_at).getTime() - new Date(a.primary.created_at).getTime()
  );
};


// Short attention beep — synthesised at runtime.
let _beepCtx: AudioContext | null = null;
const playAlertBeep = () => {
  if (!consumeAlertSound()) return;
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
  const seenKeysRef = useRef<Map<string, number>>(new Map());

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

  const hideLocally = (ids: string[]) => {
    setHiddenIds((prev) => {
      const next = new Set(prev);
      ids.forEach((id) => next.add(id));
      persistHidden(next);
      return next;
    });
  };


  const fetchActive = useCallback(async () => {
    // Only ACTIVE alerts — once someone takes it, status flips to acknowledged
    // and it vanishes from everyone's panel automatically.
    const data = await withBackgroundPriority(async () => {
      const { data } = await supabase
        .from('checkout_struggle_alerts')
        .select('*')
        .eq('status', 'active')
        .gte('created_at', new Date(Date.now() - 60 * 60 * 1000).toISOString())
        .order('created_at', { ascending: false })
        .limit(25);
      return data;
    });
    const rows = (data as StruggleAlert[]) || [];
    // Beep once per customer per dedupe window — never again for the same person
    // signalling repeatedly minutes apart.
    let hasNew = false;
    const now = Date.now();
    for (const g of groupAlerts(rows)) {
      if (g.ids.every((id) => hiddenIds.has(id))) continue;
      const key = customerKey(g.primary);
      const last = seenKeysRef.current.get(key);
      if (last === undefined || now - last > DEDUPE_WINDOW_MS) hasNew = true;
      seenKeysRef.current.set(key, now);
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
      .channel(`payment-failed-leads-panel-${Math.random().toString(36).slice(2)}`)
      .on(
        'postgres_changes',
        { event: '*', schema: 'public', table: 'checkout_struggle_alerts' },
        () => fetchActive()
      )
      .subscribe();
    const t = window.setInterval(() => { if (document.hidden) return; fetchActive(); }, 60_000);
    return () => {
      supabase.removeChannel(channel);
      window.clearInterval(t);
    };
  }, [fetchActive]);

  const claim = async (ids: string[]) => {
    if (!currentAdminId) {
      toast.error('Unable to identify you — please refresh and try again');
      return;
    }
    setLoading(true);
    // Claim every signal from this customer in one go so the row can't reappear.
    const { error } = await supabase
      .from('checkout_struggle_alerts')
      .update({
        status: 'acknowledged',
        acknowledged_by: currentAdminId,
        acknowledged_at: new Date().toISOString(),
      })
      .in('id', ids)
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

  const groups = groupAlerts(alerts.filter((a) => !hiddenIds.has(a.id)));
  if (groups.length === 0) return null;


  return (
    <div className="rounded-lg overflow-hidden shadow-lg bg-red-600 text-white border-2 border-red-800">
      {/* Header */}
      <div className="flex items-center justify-between px-4 py-2.5 bg-red-700">
        <div className="flex items-center gap-2 font-semibold text-sm">
          <AlertTriangle className="h-4 w-4" />
          Failed payment — customer needs a call now ({groups.length})
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
        {groups.map((g) => {
          const a = g.primary;
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
                {g.extraLabels.map((l) => (
                  <span
                    key={l}
                    className="inline-flex items-center bg-red-900/70 text-white text-[10px] font-semibold uppercase tracking-wide px-2 py-0.5 rounded"
                  >
                    {l}
                  </span>
                ))}
                {g.repeats > 0 && (
                  <span
                    className="inline-flex items-center bg-red-100 text-red-800 text-[10px] font-bold px-2 py-0.5 rounded"
                    title={`${g.repeats + 1} signals from this customer in this session — collapsed into one alert`}
                  >
                    ×{g.repeats + 1} signals
                  </span>
                )}
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
                {g.repeats > 0 && (
                  <div className="text-[11px] text-red-100/80">
                    first signal {formatDistanceToNow(new Date(g.firstAt), { addSuffix: true })}
                  </div>
                )}
              </div>

              {/* Actions */}
              <div className="flex items-center justify-end gap-2">
                <button
                  disabled={loading}
                  onClick={() => claim(g.ids)}

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
                  onClick={() => hideLocally(g.ids)}
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
