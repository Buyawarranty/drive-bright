import React, { useEffect, useState, useCallback, useRef } from 'react';
import { Flame, X, Phone, Copy, Check, Mail, ChevronDown, ChevronUp, Clock } from 'lucide-react';
import { useNavigate } from 'react-router-dom';
import { useNewLeadAlert, formatElapsed, playNewLeadBeep, type NewLeadAlertData } from '@/hooks/useNewLeadAlert';
import { dialWithZoiper } from '@/utils/zoiperDial';
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
  const { queue, dismissLead } = useNewLeadAlert();
  const [collapsed, setCollapsed] = useState(false);
  const lastBeepCountRef = useRef(0);

  // Repeat beep every 10s while any card is up, and beep immediately when a
  // NEW id enters the queue.
  useEffect(() => {
    if (queue.length === 0) {
      lastBeepCountRef.current = 0;
      return;
    }
    // Immediate beep when the queue grows.
    if (queue.length > lastBeepCountRef.current) {
      playNewLeadBeep();
    }
    lastBeepCountRef.current = queue.length;
    const t = setInterval(() => {
      playNewLeadBeep();
    }, 10000);
    return () => clearInterval(t);
  }, [queue.length]);

  if (queue.length === 0) return null;

  const visible = collapsed ? queue.slice(0, 1) : queue.slice(0, 5);
  const hiddenCount = queue.length - visible.length;

  return (
    <div className="fixed top-4 right-4 z-[100] w-[360px] max-w-[calc(100vw-2rem)] space-y-2">
      {queue.length > 1 && (
        <div className="flex items-center justify-between rounded-lg bg-[#0F1B34] text-white px-3 py-2 shadow-lg border border-orange-500">
          <div className="flex items-center gap-2 text-sm font-semibold">
            <Flame className="w-4 h-4 text-orange-400 animate-pulse" />
            {queue.length} new leads waiting
          </div>
          <button
            type="button"
            onClick={() => setCollapsed((c) => !c)}
            className="inline-flex items-center gap-1 text-xs font-medium hover:text-orange-300"
            aria-label={collapsed ? 'Expand new lead stack' : 'Collapse new lead stack'}
          >
            {collapsed ? <><ChevronDown className="w-3.5 h-3.5" /> Show all</> : <><ChevronUp className="w-3.5 h-3.5" /> Collapse</>}
          </button>
        </div>
      )}
      {visible.map((lead) => (
        <LeadAlertCard key={lead.id} lead={lead} onDismiss={() => dismissLead(lead.id)} />
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
  );
};

interface CardProps {
  lead: NewLeadAlertData;
  onDismiss: () => void;
}

const LeadAlertCard: React.FC<CardProps> = ({ lead, onDismiss }) => {
  const navigate = useNavigate();
  const [now, setNow] = useState(() => Date.now());
  const [copiedPhone, setCopiedPhone] = useState(false);
  const [copiedEmail, setCopiedEmail] = useState(false);

  useEffect(() => {
    const t = setInterval(() => setNow(Date.now()), 1000);
    return () => clearInterval(t);
  }, []);

  const firstName = (lead.first_name || 'AGENT').trim().toUpperCase();
  const elapsedMs = now - new Date(lead.created_at).getTime();
  const urgent = elapsedMs > 5 * 60 * 1000;
  const clock = formatElapsed(elapsedMs);
  const displayPhone = lead.phone ? formatUKPhoneShort(lead.phone) : null;

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
          onClick={(e) => { e.stopPropagation(); onDismiss(); }}
          className="ml-1 p-1 rounded hover:bg-white/20"
          aria-label="Dismiss this lead alert"
          title="Close"
        >
          <X className="w-4 h-4" />
        </button>
      </div>

      <button onClick={openLead} className="w-full text-left px-3 pt-3 pb-1 hover:bg-orange-50 transition-colors">
        <div className="text-base font-extrabold text-slate-900">
          {[lead.first_name, lead.last_name].filter(Boolean).join(' ') || 'New lead'}
        </div>
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
      </div>
    </div>
  );
};
