import React, { useEffect, useState, useCallback, useRef } from 'react';
import { Flame, X, Phone, Copy, Check, Mail, ChevronDown, ChevronUp, Clock, Volume2, VolumeX } from 'lucide-react';
import { useNavigate } from 'react-router-dom';
import { useNewLeadAlert, formatElapsed, playNewLeadBeep, type NewLeadAlertData } from '@/hooks/useNewLeadAlert';
import { dialWithZoiper } from '@/utils/zoiperDial';
import { MuteAlertsMenu } from '@/components/admin/MuteAlertsMenu';
import { toast } from 'sonner';

const formatUKPhoneShort = (p: string) => {
  const d = p.replace(/[^\d+]/g, '');
  if (d.startsWith('+44')) return '0' + d.slice(3);
  return d;
};

/**
 * Persistent stack of "🔥 new lead" cards, one per un-dismissed assigned lead.
 * - Cards stay until the agent hits X on each (or logs a note/call).
 * - Beeps every 10s while any card is visible so the agent can't miss it.
 * - Phone: click-to-dial via Zoiper + copy button. Email: copy button.
 * - When multiple leads land at once they stack top-down (newest first) with
 *   a collapse toggle so the screen isn't buried.
 */
export const NewLeadAlerts: React.FC = () => {
  const { queue, dismissLead, snoozeLead } = useNewLeadAlert();
  const [collapsed, setCollapsed] = useState(false);
  const [mutedIds, setMutedIds] = useState<Set<string>>(new Set());
  const lastBeepCountRef = useRef(0);

  const toggleMute = useCallback((id: string) => {
    setMutedIds((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id); else next.add(id);
      return next;
    });
  }, []);

  // Repeat beep every 10s while any UN-muted card is up, and beep immediately
  // when a NEW id enters the queue (unless every card is muted).
  useEffect(() => {
    if (queue.length === 0) {
      lastBeepCountRef.current = 0;
      return;
    }
    const anyUnmuted = queue.some((l) => !mutedIds.has(l.id));
    // Immediate beep when the queue grows.
    if (anyUnmuted && queue.length > lastBeepCountRef.current) {
      playNewLeadBeep();
    }
    lastBeepCountRef.current = queue.length;
    if (!anyUnmuted) return;
    const t = setInterval(() => {
      playNewLeadBeep();
    }, 10000);
    return () => clearInterval(t);
  }, [queue, mutedIds]);

  if (queue.length === 0) return null;

  const visible = collapsed ? queue.slice(0, 1) : queue.slice(0, 5);
  const hiddenCount = queue.length - visible.length;


  return (
    <div className="fixed top-4 right-4 z-[100] w-[360px] max-w-[calc(100vw-2rem)] flex flex-col gap-2 max-h-[calc(100vh-2rem)]">
      {/* Header is always shown when there is at least one card so the
          shared "Mute all sounds" control is reachable from the very first
          pop-up, not only when 2+ leads are stacked. */}
      <div className="flex items-center justify-between rounded-lg bg-[#0F1B34] text-white px-3 py-2 shadow-lg border border-orange-500 shrink-0">
        <div className="flex items-center gap-2 text-sm font-semibold">
          <Flame className="w-4 h-4 text-orange-400 animate-pulse" />
          {queue.length === 1 ? 'New lead waiting' : `${queue.length} new leads waiting`}
        </div>
        <div className="flex items-center gap-1">
          <MuteAlertsMenu />
          {queue.length > 1 && (
            <button
              type="button"
              onClick={() => setCollapsed((c) => !c)}
              className="inline-flex items-center gap-1 text-xs font-medium hover:text-orange-300 px-1.5 py-0.5 rounded"
              aria-label={collapsed ? 'Expand new lead stack' : 'Collapse new lead stack'}
            >
              {collapsed ? <><ChevronDown className="w-3.5 h-3.5" /> Show all</> : <><ChevronUp className="w-3.5 h-3.5" /> Collapse</>}
            </button>
          )}
        </div>
      </div>
      {/* Scrollable stack — prevents the pop-ups running off the bottom of
          the screen when 4+ leads are queued. `pr-1` reserves space for the
          scrollbar so the right edge of the cards stays visible. */}
      <div className="flex-1 min-h-0 overflow-y-auto space-y-2 pr-1 -mr-1">
        {visible.map((lead) => (
          <LeadAlertCard
            key={lead.id}
            lead={lead}
            muted={mutedIds.has(lead.id)}
            onToggleMute={() => toggleMute(lead.id)}
            onDismiss={() => dismissLead(lead.id)}
            onAutoSnooze={() => snoozeLead(lead.id, 5)}
            onSnooze={() => {
              snoozeLead(lead.id, 5);
              toast('Reminder set', { description: "We'll ping you again in 5 minutes.", duration: 2500 });
            }}
          />
        ))}
        {hiddenCount > 0 && (
          <button
            type="button"
            onClick={() => setCollapsed(false)}
            className="w-full rounded-lg bg-white/90 hover:bg-white text-slate-700 text-xs font-semibold py-2 shadow border border-slate-200"
          >
            + {hiddenCount} more waiting — show all
          </button>
        )}
      </div>
    </div>
  );
};

interface CardProps {
  lead: NewLeadAlertData;
  muted: boolean;
  onToggleMute: () => void;
  onDismiss: () => void;
  onSnooze: () => void;
}

const LeadAlertCard: React.FC<CardProps> = ({ lead, muted, onToggleMute, onDismiss, onSnooze }) => {

  const navigate = useNavigate();
  const [now, setNow] = useState(() => Date.now());
  const [copiedPhone, setCopiedPhone] = useState(false);
  const [copiedEmail, setCopiedEmail] = useState(false);
  const [copiedAll, setCopiedAll] = useState(false);

  useEffect(() => {
    const t = setInterval(() => setNow(Date.now()), 1000);
    return () => clearInterval(t);
  }, []);

  // Auto-dismiss this card after 20 seconds.
  useEffect(() => {
    const t = setTimeout(() => onDismiss(), 20000);
    return () => clearTimeout(t);
  }, [onDismiss]);


  const firstName = (lead.first_name || 'AGENT').trim().toUpperCase();
  const elapsedMs = now - new Date(lead.created_at).getTime();
  const urgent = elapsedMs > 5 * 60 * 1000;
  const clock = formatElapsed(elapsedMs);
  const displayPhone = lead.phone ? formatUKPhoneShort(lead.phone) : null;
  const fullName = [lead.first_name, lead.last_name].filter(Boolean).join(' ') || '—';
  const vehicleParts = [lead.vehicle_year, lead.vehicle_make, lead.vehicle_model].filter(Boolean).join(' ');

  const detailRows: Array<[string, string]> = [
    ['Name', fullName],
    ['Phone', displayPhone || '—'],
    ['Email', lead.email || '—'],
    ['Reg', lead.vehicle_reg || '—'],
    ['Vehicle', vehicleParts || '—'],
    ['Mileage', lead.mileage ? String(lead.mileage) : '—'],
    ['Source', lead.lead_source || '—'],
  ];

  const openLead = (e: React.MouseEvent) => {
    e.preventDefault();
    navigate(`/admin-dashboard/?tab=new-leads&leadId=${lead.id}`);
  };

  const handleDial = useCallback((e: React.MouseEvent) => {
    e.preventDefault();
    e.stopPropagation();
    if (!lead.phone) return;
    dialWithZoiper(lead.phone, { leadId: lead.id, leadType: 'sales_lead' });
    navigator.clipboard?.writeText(lead.phone.replace(/[^\d+]/g, '')).catch(() => {});
    toast.success('Dialling via Zoiper', {
      duration: 2500,
      description: "If Zoiper didn't open, the number is on your clipboard.",
    });
  }, [lead]);

  const copyPhone = useCallback(async (e: React.MouseEvent) => {
    e.stopPropagation();
    if (!lead.phone) return;
    try {
      await navigator.clipboard.writeText(lead.phone);
      setCopiedPhone(true);
      toast.success('Phone number copied', { duration: 1500 });
      setTimeout(() => setCopiedPhone(false), 2000);
    } catch { toast.error('Failed to copy'); }
  }, [lead]);

  const copyEmail = useCallback(async (e: React.MouseEvent) => {
    e.stopPropagation();
    if (!lead.email) return;
    try {
      await navigator.clipboard.writeText(lead.email);
      setCopiedEmail(true);
      toast.success('Email copied', { duration: 1500 });
      setTimeout(() => setCopiedEmail(false), 2000);
    } catch { toast.error('Failed to copy'); }
  }, [lead]);

  const copyAll = useCallback(async (e: React.MouseEvent) => {
    e.stopPropagation();
    const text = detailRows.map(([k, v]) => `${k}\t${v}`).join('\n');
    try {
      await navigator.clipboard.writeText(text);
      setCopiedAll(true);
      toast.success('Lead details copied', { duration: 1500 });
      setTimeout(() => setCopiedAll(false), 2000);
    } catch { toast.error('Failed to copy'); }
  }, [detailRows]);

  return (
    <div className="rounded-xl border-2 border-orange-500 bg-white shadow-2xl overflow-hidden animate-in slide-in-from-right-4">
      <div className="flex items-center gap-2 px-3 py-2 bg-[#0F1B34] text-white">
        <Flame className={`w-4 h-4 ${urgent ? 'text-red-400 animate-pulse' : 'text-orange-400 animate-pulse'}`} />
        <span className="font-bold text-sm tracking-wide">🔥 {firstName}</span>
        <span className={`ml-auto font-mono font-bold text-xs px-2 py-0.5 rounded ${urgent ? 'bg-red-500' : 'bg-orange-500'}`}>
          ⏱ {clock}
        </span>
        <button
          type="button"
          onClick={(e) => { e.stopPropagation(); onToggleMute(); }}
          className="ml-1 p-1 rounded hover:bg-white/20"
          aria-label={muted ? 'Unmute alert sound' : 'Mute alert sound'}
          title={muted ? 'Unmute' : 'Mute beep'}
        >
          {muted ? <VolumeX className="w-4 h-4" /> : <Volume2 className="w-4 h-4" />}
        </button>
        <button
          type="button"
          onClick={(e) => { e.stopPropagation(); onDismiss(); }}
          className="p-1 rounded hover:bg-white/20"
          aria-label="Dismiss this lead alert"
          title="Close"
        >
          <X className="w-4 h-4" />
        </button>
      </div>


      <button onClick={openLead} className="w-full text-left px-3 pt-3 pb-1 hover:bg-orange-50 transition-colors">
        <div className="text-base font-extrabold text-slate-900">{fullName}</div>
        <div className="text-xs text-slate-500">New lead — call now before it goes cold.</div>
      </button>

      <div className="px-3 pb-3 pt-2 space-y-2">
        {displayPhone && (
          <div className="flex items-center gap-2">
            <a
              href={`tel:${lead.phone!.replace(/[^\d+]/g, '')}`}
              onClick={handleDial}
              className="flex-1 inline-flex items-center justify-center gap-1.5 rounded-full bg-emerald-500 hover:bg-emerald-600 text-white px-3 py-1.5 text-sm font-bold shadow-sm cursor-pointer transition-colors"
              aria-label={`Click to dial ${displayPhone} via Zoiper`}
            >
              <Phone className="h-3.5 w-3.5" fill="currentColor" strokeWidth={0} />
              <span className="tabular-nums select-all">{displayPhone}</span>
            </a>
            <button
              type="button"
              onClick={copyPhone}
              aria-label="Copy phone number"
              title={copiedPhone ? 'Copied!' : 'Copy number'}
              className="inline-flex h-9 w-9 items-center justify-center rounded-full bg-slate-100 hover:bg-slate-200 text-slate-700"
            >
              {copiedPhone ? <Check className="h-4 w-4" /> : <Copy className="h-4 w-4" />}
            </button>
          </div>
        )}
        {lead.email && (
          <div className="flex items-center gap-2">
            <a
              href={`mailto:${lead.email}`}
              onClick={(e) => e.stopPropagation()}
              className="flex-1 inline-flex items-center gap-1.5 rounded-md bg-slate-100 hover:bg-slate-200 text-slate-800 px-3 py-1.5 text-xs font-semibold truncate"
              title={lead.email}
            >
              <Mail className="h-3.5 w-3.5 shrink-0" />
              <span className="truncate select-all">{lead.email}</span>
            </a>
            <button
              type="button"
              onClick={copyEmail}
              aria-label="Copy email"
              title={copiedEmail ? 'Copied!' : 'Copy email'}
              className="inline-flex h-9 w-9 items-center justify-center rounded-full bg-slate-100 hover:bg-slate-200 text-slate-700"
            >
              {copiedEmail ? <Check className="h-4 w-4" /> : <Copy className="h-4 w-4" />}
            </button>
          </div>
        )}

        {/* Copy-paste details table */}
        <div className="rounded-md border border-slate-200 overflow-hidden">
          <div className="flex items-center justify-between px-2 py-1 bg-slate-50 border-b border-slate-200">
            <span className="text-[11px] font-semibold uppercase tracking-wide text-slate-600">Lead details</span>
            <button
              type="button"
              onClick={copyAll}
              className="inline-flex items-center gap-1 text-[11px] font-semibold text-slate-700 hover:text-slate-900"
              title="Copy all details"
            >
              {copiedAll ? <Check className="h-3 w-3" /> : <Copy className="h-3 w-3" />}
              {copiedAll ? 'Copied' : 'Copy all'}
            </button>
          </div>
          <table className="w-full text-[11px]">
            <tbody>
              {detailRows.map(([k, v]) => (
                <tr key={k} className="border-b border-slate-100 last:border-0">
                  <td className="px-2 py-1 font-semibold text-slate-500 w-16 align-top">{k}</td>
                  <td className="px-2 py-1 text-slate-800 select-all break-all">{v}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>

        <button
          type="button"
          onClick={(e) => { e.stopPropagation(); onSnooze(); }}
          className="w-full inline-flex items-center justify-center gap-1.5 rounded-md bg-amber-50 hover:bg-amber-100 text-amber-800 border border-amber-200 px-3 py-1.5 text-xs font-semibold"
          aria-label="Remind me in 5 minutes"
        >
          <Clock className="h-3.5 w-3.5" />
          Remind me in 5 min
        </button>
      </div>
    </div>
  );
};

