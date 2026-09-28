import React, { useCallback, useEffect, useMemo, useState } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { MessageSquare, Phone, X, ChevronDown, ChevronUp } from 'lucide-react';
import { formatDistanceToNow } from 'date-fns';
import { setVisibleInterval } from '@/lib/visibilityInterval';
import { AlertRailSlot, ALERT_RAIL_ORDER } from '@/components/admin/AlertRail';
import { useIsManagement } from '@/hooks/useIsManagement';

const DISMISSED_IDS_KEY = 'non-claim-complaint-alert-dismissed-ids';

/**
 * Complaint categories that belong to the CLAIMS queue. Everything else —
 * including "Not about a warranty" — lands in the Non claims complaints
 * section and triggers this pop-up.
 */
const CLAIM_CATEGORIES = ['Claim decision', 'Claim delay'];

interface ComplaintRow {
  id: string;
  reference: string;
  first_name: string;
  last_name: string;
  email: string;
  phone: string | null;
  category: string;
  description: string;
  status: string;
  created_at: string;
}

const readDismissed = (): string[] => {
  try {
    const raw = localStorage.getItem(DISMISSED_IDS_KEY);
    const parsed = raw ? JSON.parse(raw) : [];
    return Array.isArray(parsed) ? parsed : [];
  } catch {
    return [];
  }
};

const timeAgo = (iso: string) =>
  formatDistanceToNow(new Date(iso), { addSuffix: true })
    .replace('about ', '')
    .replace('less than a minute ago', 'just now');

const formatUkPhone = (p: string) => {
  const d = p.replace(/\D/g, '').replace(/^44/, '0');
  return d.length === 11 ? `${d.slice(0, 5)} ${d.slice(5)}` : p;
};

/**
 * "New complaint — not claim related" pop-up.
 *
 * Shown ONLY to management (admin / super_admin / sales_manager). Fires when a
 * complaint that is not about a claim — e.g. "Not about a warranty" — arrives;
 * those are exactly the complaints that land in the Non claims complaints
 * section. Portals into the left-hand alert rail so it never overlaps the
 * new-lead or stuck-checkout cards.
 */
export const NonClaimComplaintAlert: React.FC = () => {
  const { isManagement, loading: mgmtLoading } = useIsManagement();
  const [rows, setRows] = useState<ComplaintRow[]>([]);
  const [dismissedIds, setDismissedIds] = useState<string[]>(() => readDismissed());
  const [expanded, setExpanded] = useState(true);

  const load = useCallback(async () => {
    // Only fresh, still-unacknowledged complaints pop up — once a manager
    // picks one up it moves out of "new" and the card disappears.
    const since = new Date(Date.now() - 6 * 60 * 60 * 1000).toISOString();
    const { data } = await supabase
      .from('complaints')
      .select('id, reference, first_name, last_name, email, phone, category, description, status, created_at')
      .eq('status', 'new')
      .gte('created_at', since)
      .order('created_at', { ascending: false })
      .limit(50);
    setRows(
      ((data as ComplaintRow[]) || []).filter((c) => !CLAIM_CATEGORIES.includes(c.category)),
    );
  }, []);

  useEffect(() => {
    if (!isManagement) return;
    load();
    const channel = supabase
      .channel(`non-claim-complaint-alert-${Math.random().toString(36).slice(2)}`)
      .on('postgres_changes', { event: '*', schema: 'public', table: 'complaints' }, () => load())
      .subscribe();
    const stop = setVisibleInterval(load, 45_000);
    return () => {
      supabase.removeChannel(channel);
      stop();
    };
  }, [load, isManagement]);

  const live = useMemo(
    () => rows.filter((r) => !dismissedIds.includes(r.id)),
    [rows, dismissedIds],
  );

  const dismiss = (id: string) => {
    setDismissedIds((prev) => {
      const next = [...new Set([...prev, id])].slice(-200);
      try { localStorage.setItem(DISMISSED_IDS_KEY, JSON.stringify(next)); } catch { /* ignore */ }
      return next;
    });
  };

  const dismissAll = () => live.forEach((r) => dismiss(r.id));

  const openSection = () => {
    dismissAll();
    window.location.assign('/admin-dashboard/?tab=non-claim-complaints');
  };

  if (mgmtLoading || !isManagement || live.length === 0) return null;

  return (
    <AlertRailSlot order={ALERT_RAIL_ORDER.complaintAlert}>
      <div className="rounded-lg border-2 border-orange-600 bg-orange-500 text-white shadow-xl overflow-hidden">
        <div className="flex items-start justify-between gap-2 px-3 py-2">
          <button
            onClick={() => setExpanded((v) => !v)}
            className="flex items-start gap-2 text-left min-w-0"
          >
            <MessageSquare className="h-4 w-4 mt-0.5 shrink-0" />
            <div className="min-w-0">
              <p className="text-sm font-bold leading-tight text-white">
                {live.length === 1 ? 'New complaint — not claim related' : `${live.length} new complaints — not claim related`}
              </p>
              <p className="text-[11px] text-white/90">Managers only · in Non claims complaints</p>
            </div>
            {expanded ? <ChevronUp className="h-4 w-4 mt-0.5 shrink-0" /> : <ChevronDown className="h-4 w-4 mt-0.5 shrink-0" />}
          </button>
          <button onClick={dismissAll} aria-label="Dismiss" className="shrink-0 rounded p-0.5 hover:bg-white/20">
            <X className="h-4 w-4" />
          </button>
        </div>

        {expanded && (
          <div className="space-y-2 px-3 pb-3">
            {live.map((c) => (
              <div key={c.id} className="rounded bg-white/10 px-2 py-2">
                <div className="flex items-center gap-1.5 flex-wrap">
                  <span className="font-mono text-[11px] bg-white/20 px-1.5 py-0.5 rounded">{c.reference}</span>
                  <span className="text-[11px] bg-amber-300 text-amber-950 font-semibold px-1.5 py-0.5 rounded">
                    {c.category === 'Not about a warranty' ? 'Not about a warranty' : c.category}
                  </span>
                  <span className="text-[11px] text-white/80">{timeAgo(c.created_at)}</span>
                </div>
                <p className="text-sm font-semibold mt-1">{c.first_name} {c.last_name}</p>
                <p className="text-[12px] text-white/90 line-clamp-2">{c.description}</p>
                <div className="flex flex-wrap gap-1.5 mt-1.5">
                  {c.phone && (
                    <a
                      href={`tel:${c.phone}`}
                      className="inline-flex items-center gap-1 rounded bg-white text-orange-700 text-xs font-semibold px-2 py-1 hover:bg-white/90"
                    >
                      <Phone className="h-3 w-3" /> Call now: {formatUkPhone(c.phone)}
                    </a>
                  )}
                  <button
                    onClick={openSection}
                    className="inline-flex items-center rounded border border-white/60 text-white text-xs font-semibold px-2 py-1 hover:bg-white/20"
                  >
                    Open Non claims complaints
                  </button>
                </div>
              </div>
            ))}
          </div>
        )}
      </div>
    </AlertRailSlot>
  );
};
