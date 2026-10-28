import React, { useCallback, useEffect, useMemo, useState } from 'react';
import { ChevronDown, ChevronUp, ShieldAlert, X } from 'lucide-react';
import { supabase } from '@/integrations/supabase/client';
import { pushRecentAlert } from '@/lib/recentAlerts';
import { setVisibleInterval } from '@/lib/visibilityInterval';
import { AlertRailSlot, ALERT_RAIL_ORDER } from '@/components/admin/AlertRail';
import { useAuth } from '@/hooks/useAuth';
import { canViewStaffSigninAudit } from '@/lib/crmAttendanceRules';
import { formatCrmAuditTime } from '@/lib/crmAuditTime';
import { describeActivity } from '../../../../supabase/functions/_shared/leadOpeningRate';

/**
 * "Opened leads without dialling" card.
 *
 * The server notices when someone opens leads or copies phone numbers over the
 * limit without a call to those leads afterwards, and writes an entry naming
 * them. This card shows exactly that: who, how many they looked at, how many
 * they called, how many they reached and how many had no call at all. Calls
 * that rang out or went to voicemail count as calls, so an agent working the
 * phone is never carded for it.
 *
 * Admins and super admins only — the same people who can read the lead access
 * history. Nothing here blocks anything; it is a prompt to go and look.
 */
interface AlertRow {
  id: string;
  actor_id: string | null;
  title: string;
  message: string;
  detail: {
    opened?: number;
    with_dial?: number;
    connected?: number;
    no_dial?: number;
    threshold?: number;
    window_minutes?: number;
  };
  created_at: string;
}

const KIND = 'rapid_lead_opening';
const LOOKBACK_HOURS = 6;

const linesFor = (row: AlertRow): string[] => {
  const { opened, with_dial, connected, no_dial } = row.detail || {};
  if (opened === undefined || with_dial === undefined || connected === undefined || no_dial === undefined) {
    return row.message ? row.message.split(' · ') : [];
  }
  return describeActivity({
    actorId: row.actor_id || '',
    opened,
    withDial: with_dial,
    connected,
    noDial: no_dial,
  });
};

export const LeadOpeningRateAlert: React.FC = () => {
  const { userRole } = useAuth();
  const allowed = canViewStaffSigninAudit(userRole);
  const [rows, setRows] = useState<AlertRow[]>([]);
  const [expanded, setExpanded] = useState(true);

  const load = useCallback(async () => {
    const since = new Date(Date.now() - LOOKBACK_HOURS * 60 * 60 * 1000).toISOString();
    const { data } = await supabase
      .from('security_alerts')
      .select('id, actor_id, title, message, detail, created_at')
      .eq('kind', KIND)
      .is('dismissed_at', null)
      .gte('created_at', since)
      .order('created_at', { ascending: false })
      .limit(10);
    setRows((data as AlertRow[]) || []);
  }, []);

  useEffect(() => {
    if (!allowed) return;
    load();
    const channel = supabase
      .channel(`lead-opening-rate-alert-${Math.random().toString(36).slice(2)}`)
      .on('postgres_changes', { event: 'INSERT', schema: 'public', table: 'security_alerts' }, () => load())
      .subscribe();
    const stop = setVisibleInterval(load, 45_000);
    return () => {
      supabase.removeChannel(channel);
      stop();
    };
  }, [allowed, load]);

  const dismiss = useCallback(async (row: AlertRow) => {
    await supabase.from('security_alerts').update({ dismissed_at: new Date().toISOString() }).eq('id', row.id);
    pushRecentAlert({
      key: `lead-opening-rate-${row.id}`,
      title: 'Lead opening check',
      detail: row.title,
      tone: 'red',
    });
    setRows((prev) => prev.filter((r) => r.id !== row.id));
  }, []);

  const openSection = useCallback(async () => {
    for (const row of rows) {
      await supabase.from('security_alerts').update({ dismissed_at: new Date().toISOString() }).eq('id', row.id);
    }
    window.location.assign('/admin-dashboard/?tab=attendance');
  }, [rows]);

  const live = useMemo(() => rows, [rows]);

  if (!allowed || live.length === 0) return null;

  return (
    <AlertRailSlot order={ALERT_RAIL_ORDER.leadOpeningRate}>
      <div className="alert-scroll-x rounded-xl border border-red-200 border-l-4 border-l-red-600 bg-red-50 text-gray-900 shadow-sm">
        <div className="flex items-start justify-between gap-2 px-3 py-2">
          <button
            onClick={() => setExpanded((v) => !v)}
            className="flex items-start gap-2 text-left min-w-0"
          >
            <ShieldAlert className="h-4 w-4 mt-0.5 shrink-0 text-red-700" />
            <div className="min-w-0">
              <p className="text-sm font-bold leading-tight text-gray-900">
                {live.length === 1
                  ? 'Lead opening check'
                  : `${live.length} lead opening checks`}
              </p>
              <p className="text-[11px] text-gray-600">Admins only · nothing has been blocked</p>
            </div>
            {expanded ? (
              <ChevronUp className="h-4 w-4 mt-0.5 shrink-0" />
            ) : (
              <ChevronDown className="h-4 w-4 mt-0.5 shrink-0" />
            )}
          </button>
          <button
            onClick={openSection}
            aria-label="Dismiss"
            className="shrink-0 rounded p-0.5 hover:bg-red-100"
          >
            <X className="h-4 w-4" />
          </button>
        </div>

        {expanded && (
          <div className="space-y-2 px-3 pb-3">
            {live.map((row) => {
              const window = row.detail?.window_minutes;
              const limit = row.detail?.threshold;
              return (
                <div key={row.id} className="rounded bg-white border border-red-100 px-2 py-2">
                  <div className="flex items-center gap-1.5 flex-wrap">
                    <span className="text-[11px] text-gray-900/80">
                      {formatCrmAuditTime(row.created_at, 'UTC')} GMT
                    </span>
                    {window && limit ? (
                      <span className="text-[11px] bg-red-100 text-red-900 font-semibold px-1.5 py-0.5 rounded">
                        {limit}+ openings in {window} minutes
                      </span>
                    ) : null}
                  </div>
                  <p className="text-sm font-semibold mt-1">{row.title}</p>
                  <ul className="mt-1 space-y-0.5">
                    {linesFor(row).map((line) => (
                      <li key={line} className="text-[12px] text-gray-700">
                        {line}
                      </li>
                    ))}
                  </ul>
                  <div className="flex flex-wrap gap-1.5 mt-1.5">
                    <button
                      onClick={openSection}
                      className="inline-flex items-center rounded border border-white/60 text-gray-900 text-xs font-semibold px-2 py-1 hover:bg-red-100"
                    >
                      Open staff access log
                    </button>
                    <button
                      onClick={() => dismiss(row)}
                      className="inline-flex items-center rounded border border-white/60 text-gray-600 text-xs font-semibold px-2 py-1 hover:bg-red-100"
                    >
                      Dismiss
                    </button>
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </div>
    </AlertRailSlot>
  );
};

export default LeadOpeningRateAlert;
