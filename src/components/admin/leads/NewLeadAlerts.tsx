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
 * - When multiple leads land at once only the newest is expanded; the rest
 *   collapse into thin one-line rows so the stack never buries the screen.
 */
export const NewLeadAlerts: React.FC = () => {
  const { queue, dismissLead, snoozeLead } = useNewLeadAlert();
  const [mutedIds, setMutedIds] = useState<Set<string>>(new Set());
  const [expandedId, setExpandedId] = useState<string | null>(null);
  const lastBeepCountRef = useRef(0);

  // The newest lead is always expanded by default.
  useEffect(() => {
    if (queue.length > 0) {
      setExpandedId((current) => (current && queue.some((l) => l.id === current) ? current : queue[0].id));
    }
  }, [queue]);

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

  const expandedLead = queue.find((l) => l.id === expandedId) || queue[0];
  const collapsedLeads = queue.filter((l) => l.id !== expandedLead.id);
  const maxVisible = 3;
  const visibleCollapsed = collapsedLeads.slice(0, Math.max(0, maxVisible - 1));
  const hiddenCount = collapsedLeads.length - visibleCollapsed.length;

  return (
    <div className="fixed top-4 right-4 z-[100] w-[360px] max-w-[calc(100vw-2rem)] flex flex-col gap-2 max-h-[calc(100vh-2rem)]">
      {/* Header is always shown when there is at least one card so the
          shared "Mute all sounds" control is reachable from the very first
          pop-up, not only when 2+ leads are stacked. */}
      <div className="flex items-center justify-between rounded-lg bg-[#0F1B34] text-white px-3 py-2 shadow-lg border border-emerald-500 shrink-0">
        <div className="flex items-center gap-2 text-sm font-semibold">
          <Flame className="w-4 h-4 text-emerald-300 animate-pulse" />
          {queue.length === 1 ? 'New lead waiting' : `${queue.length} new leads waiting`}
        </div>
        <div className="flex items-center gap-1">
          <MuteAlertsMenu />
          <button
            type="button"
            onClick={() => {
              queue.forEach((l) => dismissLead(l.id));
              toast('All alerts dismissed', { duration: 2000 });
            }}
            className="inline-flex items-center gap-1 text-xs font-medium hover:text-emerald-200 px-1.5 py-0.5 rounded"
            aria-label="Dismiss all new lead alerts"
            title="Close all"
          >
            <X className="w-3.5 h-3.5" /> All
          </button>
        </div>
      </div>
      {/* Scrollable stack — prevents the pop-ups running off the bottom of
          the screen when 4+ leads are queued. `pr-1` reserves space for the
          scrollbar so the right edge of the cards stays visible. */}
      <div className="flex-1 min-h-0 overflow-y-auto space-y-2 pr-1 -mr-1">
        <LeadAlertCard
          key={expandedLead.id}
          lead={expandedLead}
          muted={mutedIds.has(expandedLead.id)}
          onToggleMute={() => toggleMute(expandedLead.id)}
          onDismiss={() => dismissLead(expandedLead.id)}
          onAutoSnooze={() => dismissLead(expandedLead.id)}
          onSnooze={() => {
            snoozeLead(expandedLead.id, 5);
            toast('Reminder set', { description: "We'll ping you again in 5 minutes.", duration: 2500 });
          }}
        />
        {visibleCollapsed.map((lead) => (
          <LeadAlertCard
            key={lead.id}
            lead={lead}
            collapsed
            muted={mutedIds.has(lead.id)}
            onToggleMute={() => toggleMute(lead.id)}
            onExpand={() => setExpandedId(lead.id)}
            onDismiss={() => dismissLead(lead.id)}
            onAutoSnooze={() => dismissLead(lead.id)}
            onSnooze={() => {
              snoozeLead(lead.id, 5);
              toast('Reminder set', { description: "We'll ping you again in 5 minutes.", duration: 2500 });
            }}
          />
        ))}
        {hiddenCount > 0 && (
          <button
            type="button"
            onClick={() => {
              // Expand the next hidden lead into the visible set by revealing
              // the first lead that is not currently visible.
              const hiddenIndex = collapsedLeads.findIndex((l) => !visibleCollapsed.some((v) => v.id === l.id));
              if (hiddenIndex >= 0) setExpandedId(collapsedLeads[hiddenIndex].id);
            }}
            className="w-full rounded-lg bg-white/90 hover:bg-white text-slate-700 text-xs font-semibold py-2 shadow border border-slate-200"
          >
            + {hiddenCount} more waiting — show next
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
  onAutoSnooze: () => void;
  onSnooze: () => void;
  /** Render as a thin row instead of the full card. */
  collapsed?: boolean;
  /** Click handler for collapsed rows to expand. */
  onExpand?: () => void;
}

const LeadAlertCard: React.FC<CardProps> = ({
  lead,
  muted,
  onToggleMute,
  onDismiss,
  onAutoSnooze,
  onSnooze,
  collapsed = false,
  onExpand,
}) => {
  const navigate = useNavigate();
  const [now, setNow] = useState(() => Date.now());
  const [copiedPhone, setCopiedPhone] = useState(false);
  const [copiedEmail, setCopiedEmail] = useState(false);
  const [copiedAll, setCopiedAll] = useState(false);
  const [showDetails, setShowDetails] = useState(false);

  useEffect(() => {
    const t = setInterval(() => setNow(Date.now()), 1000);
    return () => clearInterval(t);
  }, []);

  // Card stays visible for 5 minutes then permanently dismisses itself so
  // the pop-up stack never overwhelms the agent. Manual X or interaction on
  // the New Leads page also clears it. After 5 min the lead is still in the
  // queue table — it just no longer pops up.
  useEffect(() => {
    const t = setTimeout(() => onAutoSnooze(), 5 * 60 * 1000);
    return () => clearTimeout(t);
  }, [onAutoSnooze]);

  const firstName = (lead.first_name || 'AGENT').trim().toUpperCase();
  const anchorTs = lead.assigned_at ? new Date(lead.assigned_at).getTime() : new Date(lead.created_at).getTime();
  const elapsedMs = now - anchorTs;
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

  if (collapsed) {
    return (
      <button
        type="button"
        onClick={onExpand}
        className="w-full text-left rounded-lg border border-emerald-500 bg-white shadow-md hover:shadow-lg transition-shadow animate-in slide-in-from-right-4"
      >
        <div className="flex items-center gap-2 px-3 py-2.5">
          <Flame className={`w-4 h-4 shrink-0 ${urgent ? 'text-red-500 animate-pulse' : 'text-emerald-500'}`} />
          <div className="min-w-0 flex-1">
            <div className="text-sm font-bold text-slate-900 truncate">{fullName}</div>
            <div className="text-xs text-slate-500 tabular-nums">
              {displayPhone ? <span className="font-medium text-slate-700">{displayPhone}</span> : 'No phone'} · {clock}
            </div>
          </div>
          <span className={`shrink-0 text-[10px] font-bold px-2 py-0.5 rounded ${urgent ? 'bg-red-100 text-red-700' : 'bg-emerald-100 text-emerald-700'}`}>
            ⏱ {clock}
          </span>
        </div>
      </button>
    );
  }

  return (
    <div className="rounded-xl border-2 border-emerald-500 bg-white shadow-2xl overflow-hidden animate-in slide-in-from-right-4">
      <div className="flex items-center gap-2 px-3 py-2 bg-[#0F1B34] text-white">
        <Flame className={`w-4 h-4 ${urgent ? 'text-red-400 animate-pulse' : 'text-emerald-300 animate-pulse'}`} />
        <span className="font-bold text-sm tracking-wide">🔥 {firstName}</span>
        <span className={`ml-auto font-mono font-bold text-xs px-2 py-0.5 rounded ${urgent ? 'bg-red-500' : 'bg-emerald-500'}`}>
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

      <button onClick={openLead} className="w-full text-left px-3 pt-3 pb-1 hover:bg-emerald-50 transition-colors">
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

        <button
          type="button"
          onClick={(e) => { e.stopPropagation(); setShowDetails((s) => !s); }}
          className="w-full flex items-center justify-between text-xs font-semibold text-slate-600 hover:text-slate-900 px-1 py-1"
          aria-label={showDetails ? 'Hide details' : 'Show details'}
        >
          <span>{showDetails ? 'Hide details' : 'Show details'}</span>
          {showDetails ? <ChevronUp className="w-3.5 h-3.5" /> : <ChevronDown className="w-3.5 h-3.5" />}
        </button>

        {showDetails && (
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
        )}

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