import React, { useEffect, useState, useCallback, useMemo, useRef, useSyncExternalStore } from 'react';
import { Flame, X, Phone, Copy, Check, Mail, ChevronDown, ChevronUp, Clock, Volume2, VolumeX, PhoneCall } from 'lucide-react';
import { useNavigate } from 'react-router-dom';
import { useNewLeadAlert, formatElapsed, playNewLeadBeep, type NewLeadAlertData } from '@/hooks/useNewLeadAlert';
import { dialWithZoiper } from '@/utils/zoiperDial';
import { MuteAlertsMenu } from '@/components/admin/MuteAlertsMenu';
import { isAgentOnCall, clearAgentOnCall, subscribeAgentOnCall } from '@/lib/agentCallState';
import { supabase } from '@/integrations/supabase/client';
import { useIsRepeatCustomer } from '@/hooks/useRepeatCustomers';
import { toast } from 'sonner';

const formatUKPhoneShort = (p: string) => {
  const d = p.replace(/[^\d+]/g, '');
  if (d.startsWith('+44')) return '0' + d.slice(3);
  return d;
};

// A lead is "ORR" (Open Round Robin, Team Blue) when it was released with a
// 2-minute first-call deadline. Presence of a FUTURE deadline flips the
// pop-up to a blue theme + live countdown so agents can tell an ORR claim
// window apart from a normal round-robin assignment at a glance.
const isOrrLead = (l: NewLeadAlertData): boolean => !!l.orr_first_call_deadline;

const useOnCall = () =>
  useSyncExternalStore(subscribeAgentOnCall, isAgentOnCall, () => false);


/**
 * Persistent stack of "new lead" cards, one per un-dismissed assigned lead.
 * - Cards STAY until the agent hits X, or logs a note/call for that lead
 *   (the hook subscribes to lead_quick_notes / lead_call_logs INSERTs and
 *   auto-dismisses on match). No time-based auto-dismiss — a long call
 *   never causes a missed lead.
 * - Beeps every 10s while any un-muted card is visible.
 * - While the agent is on an active call (fired by dialWithZoiper), new
 *   pop-ups queue silently: no beep, nothing auto-expands, only a compact
 *   "On call" pill shows the waiting count.
 * - Stack is narrow (240px) so it never dominates the screen.
 */
export const NewLeadAlerts: React.FC = () => {
  const { queue, dismissLead, snoozeLead } = useNewLeadAlert();
  const [mutedIds, setMutedIds] = useState<Set<string>>(new Set());
  const [expandedId, setExpandedId] = useState<string | null>(null);
  const [collapsedStack, setCollapsedStack] = useState(false);
  const onCall = useOnCall();
  const lastBeepCountRef = useRef(0);

  // Newest lead is expanded by default — UNLESS the agent is on a call, in
  // which case nothing auto-expands so the pop-up doesn't cover the CRM
  // mid-conversation. The agent can click any row to expand it.
  useEffect(() => {
    if (queue.length === 0) {
      setExpandedId(null);
      return;
    }
    if (onCall) return;
    setExpandedId((current) => (current && queue.some((l) => l.id === current) ? current : queue[0].id));
  }, [queue, onCall]);

  const toggleMute = useCallback((id: string) => {
    setMutedIds((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id); else next.add(id);
      return next;
    });
  }, []);

  // Beeping for new leads is owned by NewLeadTopBanner (single source of
  // truth) so the banner and this stack can never double-chime.
  useEffect(() => {
    if (queue.length === 0) lastBeepCountRef.current = 0;
    else lastBeepCountRef.current = queue.length;
  }, [queue, mutedIds, onCall]);


  if (queue.length === 0) return null;

  // "On call" mode: show only the compact pill until the agent clears it or
  // expands the stack manually. Leads keep stacking safely in the background.
  if (onCall && collapsedStack === false && expandedId === null) {
    return (
      <div className="fixed top-4 right-4 z-[100] w-auto max-w-[calc(100vw-2rem)]">
        <div className="flex items-center gap-2 rounded-full bg-[#0F1B34] text-white pl-3 pr-1 py-1 shadow-lg border border-emerald-500">
          <PhoneCall className="w-4 h-4 text-emerald-300 animate-pulse" />
          <span className="text-xs font-semibold">
            On call — {queue.length} lead{queue.length === 1 ? '' : 's'} waiting
          </span>
          <button
            type="button"
            onClick={() => setExpandedId(queue[0].id)}
            className="text-[11px] font-semibold bg-white/10 hover:bg-white/20 rounded-full px-2 py-0.5"
          >
            Show
          </button>
          <button
            type="button"
            onClick={() => { clearAgentOnCall(); }}
            className="text-[11px] font-semibold bg-emerald-500 hover:bg-emerald-400 rounded-full px-2 py-0.5"
            title="Mark call as ended — pop-ups resume"
          >
            Call ended
          </button>
        </div>
      </div>
    );
  }

  const expandedLead = expandedId ? queue.find((l) => l.id === expandedId) || null : null;
  const collapsedLeads = expandedLead ? queue.filter((l) => l.id !== expandedLead.id) : queue;
  const maxVisible = 4;
  const visibleCollapsed = collapsedLeads.slice(0, expandedLead ? maxVisible - 1 : maxVisible);
  const hiddenCount = collapsedLeads.length - visibleCollapsed.length;

  const orrCount = queue.filter(isOrrLead).length;
  const rrCount = queue.length - orrCount;
  const allOrr = orrCount > 0 && rrCount === 0;
  const headerBorder = allOrr ? 'border-blue-500' : 'border-emerald-500';
  const headerFlame = allOrr ? 'text-blue-300' : 'text-emerald-300';

  return (
    <div className="fixed top-4 right-4 z-[100] w-[240px] max-w-[calc(100vw-2rem)] flex flex-col gap-1.5 max-h-[calc(100vh-2rem)]">
      <div className={`flex items-center justify-between rounded-lg bg-[#0F1B34] text-white px-2.5 py-1.5 shadow-lg border ${headerBorder} shrink-0`}>
        <div className="flex items-center gap-1.5 text-xs font-semibold min-w-0">
          <Flame className={`w-3.5 h-3.5 ${headerFlame} animate-pulse shrink-0`} />
          <span className="truncate">
            {orrCount > 0 && rrCount > 0
              ? `${rrCount} new · ${orrCount} ORR`
              : orrCount > 0
                ? `${orrCount} ORR lead${orrCount === 1 ? '' : 's'}`
                : queue.length === 1 ? 'New lead' : `${queue.length} new leads`}
          </span>
        </div>
        <div className="flex items-center gap-0.5 shrink-0">
          {onCall && (
            <button
              type="button"
              onClick={() => clearAgentOnCall()}
              className="text-[10px] font-semibold bg-emerald-500 hover:bg-emerald-400 rounded px-1.5 py-0.5"
              title="Mark call as ended"
            >
              End call
            </button>
          )}
          <MuteAlertsMenu />
          <button
            type="button"
            onClick={() => {
              queue.forEach((l) => dismissLead(l.id));
              toast('All alerts dismissed', { duration: 2000 });
            }}
            className="inline-flex items-center gap-0.5 text-[11px] font-medium hover:text-emerald-200 px-1 py-0.5 rounded"
            aria-label="Dismiss all new lead alerts"
            title="Close all"
          >
            <X className="w-3 h-3" /> All
          </button>
        </div>
      </div>

      <div className="flex-1 min-h-0 overflow-y-auto space-y-1.5 pr-1 -mr-1">
        {expandedLead && (
          <LeadAlertCard
            key={expandedLead.id}
            lead={expandedLead}
            muted={mutedIds.has(expandedLead.id)}
            onToggleMute={() => toggleMute(expandedLead.id)}
            onDismiss={() => dismissLead(expandedLead.id)}
            onCollapse={() => setExpandedId(null)}
            onSnooze={() => {
              snoozeLead(expandedLead.id, 5);
              toast('Reminder set', { description: "We'll ping you again in 5 minutes.", duration: 2500 });
            }}
          />
        )}
        {visibleCollapsed.map((lead) => (
          <LeadAlertCard
            key={lead.id}
            lead={lead}
            collapsed
            muted={mutedIds.has(lead.id)}
            onToggleMute={() => toggleMute(lead.id)}
            onExpand={() => setExpandedId(lead.id)}
            onDismiss={() => dismissLead(lead.id)}
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
              const hiddenIndex = collapsedLeads.findIndex((l) => !visibleCollapsed.some((v) => v.id === l.id));
              if (hiddenIndex >= 0) setExpandedId(collapsedLeads[hiddenIndex].id);
            }}
            className="w-full rounded-md bg-white/90 hover:bg-white text-slate-700 text-[11px] font-semibold py-1.5 shadow border border-slate-200"
          >
            + {hiddenCount} more waiting
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
  /** Render as a thin row instead of the full card. */
  collapsed?: boolean;
  /** Click handler for collapsed rows to expand. */
  onExpand?: () => void;
  /** Collapse the expanded card back into a row without dismissing. */
  onCollapse?: () => void;
}

const LeadAlertCard: React.FC<CardProps> = ({
  lead,
  muted,
  onToggleMute,
  onDismiss,
  onSnooze,
  collapsed = false,
  onExpand,
  onCollapse,
}) => {
  const navigate = useNavigate();
  // Repeat customer? (already bought from us — matched on email or reg)
  const repeatInfo = useIsRepeatCustomer(
    useMemo(() => ({ id: lead.id, email: lead.email, vehicle_reg: lead.vehicle_reg, created_at: (lead as any).created_at }), [lead.id, lead.email, lead.vehicle_reg, (lead as any).created_at])
  );
  const [now, setNow] = useState(() => Date.now());
  const [copiedPhone, setCopiedPhone] = useState(false);
  const [copiedEmail, setCopiedEmail] = useState(false);
  const [copiedAll, setCopiedAll] = useState(false);
  const [showDetails, setShowDetails] = useState(false);

  useEffect(() => {
    const t = setInterval(() => setNow(Date.now()), 1000);
    return () => clearInterval(t);
  }, []);

  // NO time-based auto-dismiss — cards stay until the agent explicitly
  // dismisses them or logs a note/call (handled by useNewLeadAlert). A long
  // call can never cause a missed lead. Cards can pile up; the stack is
  // narrow and scrollable so it never dominates the screen.

  const firstName = (lead.first_name || 'AGENT').trim().toUpperCase();
  const anchorTs = lead.assigned_at ? new Date(lead.assigned_at).getTime() : new Date(lead.created_at).getTime();
  const elapsedMs = now - anchorTs;
  const urgent = elapsedMs > 5 * 60 * 1000;
  const clock = formatElapsed(elapsedMs);
  const displayPhone = lead.phone ? formatUKPhoneShort(lead.phone) : null;
  const fullName = [lead.first_name, lead.last_name].filter(Boolean).join(' ') || '—';
  const vehicleParts = [lead.vehicle_year, lead.vehicle_make, lead.vehicle_model].filter(Boolean).join(' ');

  // ORR (Open Round Robin, Team Blue) styling — blue palette + 2-min claim
  // countdown so it visually pops as different to the standard emerald RR card.
  const isOrr = isOrrLead(lead);
  const isOffer = (lead as any).pool_status === 'offered';
  const deadlineMs = lead.orr_first_call_deadline ? new Date(lead.orr_first_call_deadline).getTime() : 0;
  const remainingMs = deadlineMs ? deadlineMs - now : 0;
  const orrExpired = isOrr && remainingMs <= 0;
  const orrCountdown = isOrr ? formatElapsed(Math.max(0, remainingMs)) : '';
  const themeBorder = isOrr ? 'border-blue-500' : 'border-emerald-500';
  const themeFlame = isOrr ? 'text-blue-500' : 'text-emerald-500';
  const themeFlameHeader = isOrr ? 'text-blue-300' : 'text-emerald-300';
  const themeBadge = isOrr
    ? (orrExpired ? 'bg-red-500' : 'bg-blue-500')
    : (urgent ? 'bg-red-500' : 'bg-emerald-500');
  const themeHoverBg = isOrr ? 'hover:bg-blue-50' : 'hover:bg-emerald-50';

  const [busy, setBusy] = useState<'accept' | 'pass' | null>(null);
  const acceptOffer = useCallback(async (e: React.MouseEvent) => {
    e.stopPropagation();
    setBusy('accept');
    const { data, error } = await supabase.rpc('orr_accept_offer', { _lead: lead.id });
    setBusy(null);
    if (error || !data) {
      toast.error('Could not accept — offer may have expired');
      return;
    }
    toast.success('Lead claimed — dialling now');
    if (lead.phone) dialWithZoiper(lead.phone, { leadId: lead.id, leadType: 'sales_lead' });
  }, [lead]);
  const passOffer = useCallback(async (e: React.MouseEvent) => {
    e.stopPropagation();
    setBusy('pass');
    const { error } = await supabase.rpc('orr_pass_offer', { _lead: lead.id });
    setBusy(null);
    if (error) { toast.error('Could not pass'); return; }
    toast('Passed to next agent', { duration: 2000 });
    onDismiss();
  }, [lead, onDismiss]);


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
      <div className={`w-full rounded-md border ${themeBorder} bg-white shadow-md hover:shadow-lg transition-shadow animate-in slide-in-from-right-4 flex items-center`}>
        <button
          type="button"
          onClick={onExpand}
          className="flex-1 text-left flex items-center gap-1.5 px-2 py-1.5 min-w-0"
        >
          <Flame className={`w-3 h-3 shrink-0 ${urgent && !isOrr ? 'text-red-500 animate-pulse' : themeFlame + ' animate-pulse'}`} />
          <div className="min-w-0 flex-1">
            <div className="text-[12px] font-bold text-slate-900 truncate leading-tight">
              {isOrr && <span className="mr-1 text-[9px] font-extrabold uppercase tracking-wider text-blue-700 bg-blue-100 px-1 py-px rounded">ORR</span>}
              {repeatInfo && <span className="mr-1 text-[9px] font-extrabold uppercase tracking-wider text-white bg-emerald-600 px-1 py-px rounded">REPEAT</span>}
              {fullName}
            </div>
            <div className="text-[10px] text-slate-500 tabular-nums truncate">
              {displayPhone ?? 'No phone'} · {isOrr ? (orrExpired ? 'claim expired' : `claim in ${orrCountdown}`) : clock}
            </div>
          </div>
        </button>

        <button
          type="button"
          onClick={onDismiss}
          className="p-1 mr-1 rounded hover:bg-slate-100 text-slate-400 hover:text-slate-700"
          aria-label="Dismiss"
          title="Close"
        >
          <X className="w-3 h-3" />
        </button>
      </div>
    );
  }

  return (
    <div className={`rounded-lg border-2 ${themeBorder} bg-white shadow-2xl overflow-hidden animate-in slide-in-from-right-4`}>
      <div className="flex items-center gap-1.5 px-2 py-1.5 bg-[#0F1B34] text-white">
        <Flame className={`w-3.5 h-3.5 shrink-0 ${urgent && !isOrr ? 'text-red-400 animate-pulse' : themeFlameHeader + ' animate-pulse'}`} />
        <span className="font-bold text-[11px] tracking-wide truncate">
          {isOrr ? '⚡ ORR' : '🔥'} {firstName}
        </span>
        <span className={`ml-auto font-mono font-bold text-[10px] px-1.5 py-0.5 rounded ${themeBadge}`}>
          {isOrr ? (orrExpired ? 'EXPIRED' : orrCountdown) : clock}
        </span>
        <button
          type="button"
          onClick={(e) => { e.stopPropagation(); onToggleMute(); }}
          className="p-0.5 rounded hover:bg-white/20"
          aria-label={muted ? 'Unmute alert sound' : 'Mute alert sound'}
          title={muted ? 'Unmute' : 'Mute beep'}
        >
          {muted ? <VolumeX className="w-3.5 h-3.5" /> : <Volume2 className="w-3.5 h-3.5" />}
        </button>
        {onCollapse && (
          <button
            type="button"
            onClick={(e) => { e.stopPropagation(); onCollapse(); }}
            className="p-0.5 rounded hover:bg-white/20"
            aria-label="Collapse"
            title="Collapse"
          >
            <ChevronUp className="w-3.5 h-3.5" />
          </button>
        )}
        <button
          type="button"
          onClick={(e) => { e.stopPropagation(); onDismiss(); }}
          className="p-0.5 rounded hover:bg-white/20"
          aria-label="Dismiss this lead alert"
          title="Close"
        >
          <X className="w-3.5 h-3.5" />
        </button>
      </div>

      <button onClick={openLead} className={`w-full text-left px-2.5 pt-2 pb-1 ${themeHoverBg} transition-colors`}>
        <div className="text-[13px] font-extrabold text-slate-900 leading-tight truncate">{fullName}</div>
        {repeatInfo && (
          <div className="mt-0.5 inline-flex items-center gap-1 rounded bg-emerald-600 text-white text-[9px] font-extrabold uppercase tracking-wider px-1.5 py-px">
            Repeat customer
            <span className="font-semibold normal-case tracking-normal opacity-90">
              {repeatInfo.policyCount > 1 ? `${repeatInfo.policyCount} policies` : '1 policy'}
            </span>
          </div>
        )}
        <div className={`text-[10px] ${isOrr ? 'text-blue-700 font-semibold' : 'text-slate-500'}`}>
          {isOffer
            ? (orrExpired ? 'Offer expired — passing to next agent' : `ORR offer — Accept or Pass within ${orrCountdown}`)
            : isOrr
              ? (orrExpired ? 'Claim window expired — passing to next agent' : `ORR lead — call within ${orrCountdown} to keep it.`)
              : 'New lead — call now.'}
        </div>

      </button>

      {isOffer && !orrExpired && (
        <div className="px-2 pt-1.5 flex items-center gap-1.5">
          <button
            type="button"
            onClick={acceptOffer}
            disabled={busy !== null}
            className="flex-1 rounded-md bg-blue-600 hover:bg-blue-700 disabled:opacity-60 text-white text-[11px] font-bold py-1.5 shadow"
          >
            {busy === 'accept' ? 'Accepting…' : '✓ Accept lead'}
          </button>
          <button
            type="button"
            onClick={passOffer}
            disabled={busy !== null}
            className="rounded-md bg-slate-100 hover:bg-slate-200 disabled:opacity-60 text-slate-700 text-[11px] font-semibold px-2.5 py-1.5 border border-slate-300"
          >
            {busy === 'pass' ? '…' : 'Pass'}
          </button>
        </div>
      )}

      <div className="px-2 pb-2 pt-1 space-y-1.5">

        {displayPhone && (
          <div className="flex items-center gap-1">
            <a
              href={`tel:${lead.phone!.replace(/[^\d+]/g, '')}`}
              onClick={handleDial}
              className="flex-1 inline-flex items-center justify-center gap-1 rounded-full bg-emerald-500 hover:bg-emerald-600 text-white px-2 py-1 text-[11px] font-bold shadow-sm cursor-pointer transition-colors min-w-0"
              aria-label={`Click to dial ${displayPhone} via Zoiper`}
            >
              <Phone className="h-3 w-3 shrink-0" fill="currentColor" strokeWidth={0} />
              <span className="tabular-nums select-all truncate">{displayPhone}</span>
            </a>
            <button
              type="button"
              onClick={copyPhone}
              aria-label="Copy phone number"
              title={copiedPhone ? 'Copied!' : 'Copy number'}
              className="inline-flex h-7 w-7 items-center justify-center rounded-full bg-slate-100 hover:bg-slate-200 text-slate-700 shrink-0"
            >
              {copiedPhone ? <Check className="h-3 w-3" /> : <Copy className="h-3 w-3" />}
            </button>
          </div>
        )}
        {lead.email && (
          <div className="flex items-center gap-1">
            <a
              href={`mailto:${lead.email}`}
              onClick={(e) => e.stopPropagation()}
              className="flex-1 inline-flex items-center gap-1 rounded bg-slate-100 hover:bg-slate-200 text-slate-800 px-2 py-1 text-[10px] font-semibold truncate min-w-0"
              title={lead.email}
            >
              <Mail className="h-3 w-3 shrink-0" />
              <span className="truncate select-all">{lead.email}</span>
            </a>
            <button
              type="button"
              onClick={copyEmail}
              aria-label="Copy email"
              title={copiedEmail ? 'Copied!' : 'Copy email'}
              className="inline-flex h-7 w-7 items-center justify-center rounded-full bg-slate-100 hover:bg-slate-200 text-slate-700 shrink-0"
            >
              {copiedEmail ? <Check className="h-3 w-3" /> : <Copy className="h-3 w-3" />}
            </button>
          </div>
        )}

        <button
          type="button"
          onClick={(e) => { e.stopPropagation(); setShowDetails((s) => !s); }}
          className="w-full flex items-center justify-between text-[10px] font-semibold text-slate-600 hover:text-slate-900 px-1"
          aria-label={showDetails ? 'Hide details' : 'Show details'}
        >
          <span>{showDetails ? 'Hide details' : 'Show details'}</span>
          {showDetails ? <ChevronUp className="w-3 h-3" /> : <ChevronDown className="w-3 h-3" />}
        </button>

        {showDetails && (
          <div className="rounded border border-slate-200 overflow-hidden">
            <div className="flex items-center justify-between px-1.5 py-0.5 bg-slate-50 border-b border-slate-200">
              <span className="text-[10px] font-semibold uppercase tracking-wide text-slate-600">Details</span>
              <button
                type="button"
                onClick={copyAll}
                className="inline-flex items-center gap-0.5 text-[10px] font-semibold text-slate-700 hover:text-slate-900"
                title="Copy all details"
              >
                {copiedAll ? <Check className="h-2.5 w-2.5" /> : <Copy className="h-2.5 w-2.5" />}
                {copiedAll ? 'Copied' : 'Copy'}
              </button>
            </div>
            <table className="w-full text-[10px]">
              <tbody>
                {detailRows.map(([k, v]) => (
                  <tr key={k} className="border-b border-slate-100 last:border-0">
                    <td className="px-1.5 py-0.5 font-semibold text-slate-500 w-12 align-top">{k}</td>
                    <td className="px-1.5 py-0.5 text-slate-800 select-all break-all">{v}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}

        <button
          type="button"
          onClick={(e) => { e.stopPropagation(); onSnooze(); }}
          className="w-full inline-flex items-center justify-center gap-1 rounded bg-amber-50 hover:bg-amber-100 text-amber-800 border border-amber-200 px-2 py-1 text-[10px] font-semibold"
          aria-label="Remind me in 5 minutes"
        >
          <Clock className="h-3 w-3" />
          Remind in 5 min
        </button>
      </div>
    </div>
  );
};
