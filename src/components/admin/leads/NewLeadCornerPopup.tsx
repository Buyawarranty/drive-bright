import React, { useEffect, useRef, useState } from 'react';
import { createPortal } from 'react-dom';
import { X, VolumeX, Phone, Copy, Check, MessageCircle, UserCheck, Car } from 'lucide-react';
import { toast } from 'sonner';
import { supabase } from '@/integrations/supabase/client';
import type { NewLeadAlertData } from '@/hooks/useNewLeadAlert';

/**
 * Purple bottom-left pop-up for freshly assigned leads. Sits beside the Live
 * Alerts rail so agents can't miss a new lead even if they closed the rail.
 * Stays until the agent clicks X (shares dismissal with the rail card).
 */

const toUkLocal = (p: string) => {
  const d = p.replace(/[^\d+]/g, '');
  return d.startsWith('+44') ? '0' + d.slice(3) : d;
};
const toWhatsApp = (p: string) => {
  const d = p.replace(/\D/g, '');
  if (d.startsWith('44')) return d;
  if (d.startsWith('0')) return '44' + d.slice(1);
  return d;
};

/**
 * Five short beeps when a new round robin lead lands, then silence. Agents can
 * stop it early with the Silence button. Deliberately separate from the
 * session alert-sound budget at the user's request (Oct 2026).
 */
const BEEP_COUNT = 5;
let beepCtx: AudioContext | null = null;
let beepTimers: number[] = [];
const stopBeeps = () => {
  beepTimers.forEach((t) => clearTimeout(t));
  beepTimers = [];
  if (beepCtx && beepCtx.state !== 'closed') void beepCtx.close().catch(() => undefined);
  beepCtx = null;
};
const playFiveBeeps = () => {
  stopBeeps();
  try {
    const Ctor = window.AudioContext || (window as unknown as { webkitAudioContext?: typeof AudioContext }).webkitAudioContext;
    if (!Ctor) return;
    const ac = new Ctor();
    beepCtx = ac;
    for (let i = 0; i < BEEP_COUNT; i += 1) {
      beepTimers.push(window.setTimeout(() => {
        if (beepCtx !== ac || ac.state === 'closed') return;
        if (ac.state === 'suspended') void ac.resume();
        const t = ac.currentTime;
        const osc = ac.createOscillator();
        const gain = ac.createGain();
        osc.type = 'sine';
        osc.frequency.setValueAtTime(880, t);
        gain.gain.setValueAtTime(0, t);
        gain.gain.linearRampToValueAtTime(0.18, t + 0.02);
        gain.gain.linearRampToValueAtTime(0, t + 0.25);
        osc.connect(gain); gain.connect(ac.destination);
        osc.start(t); osc.stop(t + 0.26);
      }, i * 1000));
    }
    beepTimers.push(window.setTimeout(() => { if (beepCtx === ac) stopBeeps(); }, BEEP_COUNT * 1000 + 300));
  } catch { /* ignore */ }
};

const useMyName = () => {
  const [name, setName] = useState<string>('');
  useEffect(() => {
    let cancelled = false;
    (async () => {
      const { data: u } = await supabase.auth.getUser();
      if (!u?.user) return;
      const { data } = await supabase
        .from('admin_users')
        .select('first_name, last_name, email')
        .eq('user_id', u.user.id)
        .maybeSingle();
      if (cancelled || !data) return;
      setName([data.first_name, data.last_name].filter(Boolean).join(' ') || data.email || '');
    })();
    return () => { cancelled = true; };
  }, []);
  return name;
};

const CopyBtn: React.FC<{ value: string; label: string }> = ({ value, label }) => {
  const [done, setDone] = useState(false);
  return (
    <button
      type="button"
      onClick={async () => {
        try {
          await navigator.clipboard.writeText(value);
          setDone(true);
          toast.success(`${label} copied`, { duration: 1500 });
          setTimeout(() => setDone(false), 1500);
        } catch { toast.error('Failed to copy'); }
      }}
      aria-label={`Copy ${label.toLowerCase()}`}
      title={`Copy ${label.toLowerCase()}`}
      className="inline-flex h-7 w-7 shrink-0 items-center justify-center rounded-md bg-white/15 hover:bg-white/25"
    >
      {done ? <Check className="h-3.5 w-3.5" /> : <Copy className="h-3.5 w-3.5" />}
    </button>
  );
};

const Card: React.FC<{ lead: NewLeadAlertData; owner: string; onClose: () => void }> = ({ lead, owner, onClose }) => {
  const name = [lead.first_name, lead.last_name].filter(Boolean).join(' ') || 'New lead';
  const phone = lead.phone ? toUkLocal(lead.phone) : '';
  const reg = (lead.vehicle_reg || '').toUpperCase();
  const vehicle = [lead.vehicle_make, lead.vehicle_model].filter(Boolean).join(' ');
  const copyAll = [name, phone, reg, vehicle].filter(Boolean).join('\n');

  return (
    <div className="rounded-xl bg-violet-700 text-white shadow-2xl ring-2 ring-violet-300 p-3 animate-in slide-in-from-bottom-2">
      <div className="flex items-start justify-between gap-2">
        <div className="min-w-0">
          <div className="text-[10px] font-extrabold uppercase tracking-wider text-violet-200"><span className="animate-pulse">🔔</span> Just come in — your lead</div>
          <div className="text-base font-bold leading-tight truncate">{name}</div>
        </div>
        <button type="button" onClick={onClose} aria-label="Close new lead pop-up" className="p-1 rounded hover:bg-white/15 shrink-0">
          <X className="h-4 w-4" />
        </button>
      </div>

      <div className="mt-2 space-y-1.5 text-sm">
        {phone && (
          <div className="flex items-center gap-1.5">
            <a href={`tel:${phone}`} className="flex-1 inline-flex items-center gap-1.5 rounded-md bg-white text-violet-800 font-bold px-2.5 py-1.5 tabular-nums hover:bg-violet-50 underline-offset-2 hover:underline min-w-0">
              <Phone className="h-3.5 w-3.5 shrink-0" /> <span className="truncate">{phone}</span>
            </a>
            <CopyBtn value={phone} label="Phone number" />
            <a
              href={`https://wa.me/${toWhatsApp(phone)}`}
              target="_blank"
              rel="noopener noreferrer"
              aria-label="Open in WhatsApp"
              title="Open in WhatsApp"
              className="inline-flex h-7 w-7 shrink-0 items-center justify-center rounded-md bg-white/15 hover:bg-white/25"
            >
              <MessageCircle className="h-3.5 w-3.5" />
            </a>
          </div>
        )}
        {reg && (
          <div className="flex items-center gap-1.5">
            <span className="flex-1 inline-flex items-center gap-1.5 rounded-md bg-white/10 px-2.5 py-1 font-semibold tracking-wide min-w-0">
              <Car className="h-3.5 w-3.5 shrink-0" />
              <span className="truncate">{reg}{vehicle ? ` · ${vehicle}` : ''}</span>
            </span>
            <CopyBtn value={reg} label="Registration" />
          </div>
        )}
        <div className="flex items-center justify-between gap-2 pt-0.5">
          <span className="inline-flex items-center gap-1 text-xs text-violet-100 min-w-0">
            <UserCheck className="h-3.5 w-3.5 shrink-0" />
            <span className="truncate">Assigned to {owner || 'you'}</span>
          </span>
          <button
            type="button"
            onClick={async () => {
              try { await navigator.clipboard.writeText(copyAll); toast.success('Lead details copied', { duration: 1500 }); }
              catch { toast.error('Failed to copy'); }
            }}
            className="text-xs font-semibold rounded-md bg-white/15 hover:bg-white/25 px-2 py-1 shrink-0"
          >
            Copy all
          </button>
        </div>
        <div className="text-center text-[11px] font-semibold text-violet-100 pt-0.5 border-t border-white/10 mt-1.5">
          <span className="animate-pulse">🚗</span> This one's yours — don't let it wait
        </div>
      </div>
    </div>
  );
};

export const NewLeadCornerPopup: React.FC<{ leads: NewLeadAlertData[]; onDismiss: (id: string) => void }> = ({ leads, onDismiss }) => {
  const owner = useMyName();
  const seenRef = useRef<Set<string>>(new Set());
  const [beeping, setBeeping] = useState(false);
  const idsKey = leads.map((l) => l.id).join(',');
  useEffect(() => {
    const fresh = leads.some((l) => !seenRef.current.has(l.id));
    leads.forEach((l) => seenRef.current.add(l.id));
    if (!fresh) return;
    playFiveBeeps();
    setBeeping(true);
    const t = setTimeout(() => setBeeping(false), BEEP_COUNT * 1000 + 300);
    return () => clearTimeout(t);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [idsKey]);
  useEffect(() => { if (leads.length === 0) { stopBeeps(); setBeeping(false); } }, [leads.length]);
  useEffect(() => () => stopBeeps(), []);
  if (leads.length === 0 || typeof document === 'undefined') return null;
  const shown = leads.slice(0, 3);
  const more = leads.length - shown.length;
  return createPortal(
    <div className="fixed bottom-3 left-3 lg:left-[340px] z-[130] w-[300px] max-w-[calc(100vw-1.5rem)] flex flex-col gap-2">
      {beeping && (
        <button
          type="button"
          onClick={() => { stopBeeps(); setBeeping(false); }}
          className="self-start inline-flex items-center gap-1.5 rounded-full bg-violet-900 text-white text-xs font-bold px-3 py-1.5 shadow ring-2 ring-violet-300 hover:bg-violet-800"
        >
          <VolumeX className="h-3.5 w-3.5" /> Silence
        </button>
      )}
      {more > 0 && (
        <div className="self-start rounded-full bg-violet-900 text-white text-xs font-semibold px-3 py-1 shadow">+{more} more new lead{more === 1 ? '' : 's'}</div>
      )}
      {shown.map((l) => <Card key={l.id} lead={l} owner={owner} onClose={() => onDismiss(l.id)} />)}
    </div>,
    document.body,
  );
};
