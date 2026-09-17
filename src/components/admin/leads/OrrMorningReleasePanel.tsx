import React from 'react';
import { Sunrise, RefreshCw, Moon, CheckCircle2 } from 'lucide-react';
import { supabase } from '@/integrations/supabase/client';
import { cn } from '@/lib/utils';
import { isSecondaryCrmTab } from '@/lib/crmTabCoordinator';

/**
 * Morning lead release — read-only view of the overnight batch.
 *
 * Leads that land outside working hours (before 09:00, after 18:00, or on a
 * non-working day) are parked and released at 09:00 on the next working day.
 * This panel shows both halves of that batch: still parked (waiting for 09:00)
 * and already released this morning. No writes, no assignment actions.
 */

const LONDON = 'Europe/London';
const OPEN_HOUR = 9;
const CLOSE_HOUR = 18;

type Row = {
  id: string;
  name: string;
  phone: string;
  reg: string;
  source: string;
  createdAt: string;
  eligibleAt: string | null;
  agent: string;
  contacted: boolean;
};

// Hour of day in London for a given instant.
const londonHour = (iso: string) =>
  Number(
    new Intl.DateTimeFormat('en-GB', { hour: '2-digit', hour12: false, timeZone: LONDON }).format(
      new Date(iso),
    ),
  );

const londonDayIndex = (iso: string) =>
  new Intl.DateTimeFormat('en-GB', { weekday: 'short', timeZone: LONDON }).format(new Date(iso));

const isOutsideHours = (iso: string) => {
  const h = londonHour(iso);
  const day = londonDayIndex(iso);
  if (day === 'Sun') return true;
  return h < OPEN_HOUR || h >= CLOSE_HOUR;
};

const fmtTime = (iso: string) =>
  new Date(iso).toLocaleTimeString('en-GB', { hour: '2-digit', minute: '2-digit', timeZone: LONDON });

const fmtDayTime = (iso: string) => {
  const d = new Date(iso);
  const sameDay =
    new Intl.DateTimeFormat('en-GB', { dateStyle: 'short', timeZone: LONDON }).format(d) ===
    new Intl.DateTimeFormat('en-GB', { dateStyle: 'short', timeZone: LONDON }).format(new Date());
  const time = fmtTime(iso);
  return sameDay ? time : `${londonDayIndex(iso)} ${time}`;
};

export const OrrMorningReleasePanel: React.FC = () => {
  const [rows, setRows] = React.useState<Row[]>([]);
  const [loading, setLoading] = React.useState(true);

  const load = React.useCallback(async () => {
    setLoading(true);
    try {
      // Everything that arrived since 18:00 the previous day — the window a
      // morning release is drawn from.
      const since = new Date();
      since.setDate(since.getDate() - 1);
      since.setHours(17, 0, 0, 0);

      const [leadsRes, agentsRes] = await Promise.all([
        supabase
          .from('sales_leads')
          .select(
            'id, first_name, last_name, phone, vehicle_reg, lead_source, created_at, eligible_at, intake_class, assigned_to, last_contacted_at, status',
          )
          .gte('created_at', since.toISOString())
          .not('status', 'in', '(converted,lost,fake_lead,dormant,archived,not_eligible)')
          .order('created_at', { ascending: true })
          .limit(400),
        supabase.from('admin_users').select('id, first_name, last_name, email').limit(300),
      ]);

      const agentName = new Map(
        (agentsRes.data || []).map(a => [
          a.id as string,
          [a.first_name, a.last_name].filter(Boolean).join(' ') || (a.email as string) || 'Agent',
        ]),
      );

      const mapped: Row[] = (leadsRes.data || [])
        .filter((l: any) => l.intake_class === 'overnight' || isOutsideHours(l.created_at as string))
        .map((l: any) => ({
          id: l.id as string,
          name: [l.first_name, l.last_name].filter(Boolean).join(' ') || 'No name yet',
          phone: (l.phone as string) || '—',
          reg: (l.vehicle_reg as string) || '—',
          source: (l.lead_source as string) || 'unknown',
          createdAt: l.created_at as string,
          eligibleAt: (l.eligible_at as string) || null,
          agent: l.assigned_to ? agentName.get(l.assigned_to as string) || 'Unknown agent' : 'Unassigned',
          contacted: !!l.last_contacted_at,
        }));

      setRows(mapped);
    } catch (err) {
      console.error('[OrrMorningReleasePanel] load failed', err);
      setRows([]);
    } finally {
      setLoading(false);
    }
  }, []);

  React.useEffect(() => {
    load();
    const t = setInterval(() => { if (document.hidden || isSecondaryCrmTab()) return; load(); }, 120_000);
    return () => clearInterval(t);
  }, [load]);

  const now = Date.now();
  const parked = rows.filter(r => r.eligibleAt && new Date(r.eligibleAt).getTime() > now);
  const released = rows.filter(r => !parked.includes(r));
  const awaitingFirstCall = released.filter(r => !r.contacted);
  const nextRelease = parked.reduce<string | null>(
    (acc, r) => (!acc || (r.eligibleAt as string) < acc ? (r.eligibleAt as string) : acc),
    null,
  );

  return (
    <div className="rounded-lg border border-border bg-card">
      <div className="flex items-center justify-between gap-3 p-4 border-b border-border flex-wrap">
        <div className="flex items-center gap-2">
          <Sunrise className="h-4 w-4 text-amber-500" />
          <h3 className="text-base font-semibold text-foreground">Morning lead release</h3>
          <span className="inline-flex items-center rounded-md bg-muted text-muted-foreground text-[10px] font-semibold uppercase tracking-wide px-2 py-0.5">
            Read-only view
          </span>
        </div>
        <button
          type="button"
          onClick={load}
          className="inline-flex items-center gap-1.5 h-8 px-3 rounded-md border border-input bg-background text-xs font-medium hover:bg-muted transition-colors"
        >
          <RefreshCw className={cn('h-3.5 w-3.5', loading && 'animate-spin')} />
          Refresh
        </button>
      </div>

      <ul className="px-4 pt-3 text-xs text-muted-foreground max-w-3xl list-disc pl-4 space-y-1">
        <li>Enquiries that arrive after {CLOSE_HOUR}:00, before 0{OPEN_HOUR}:00 or on a non-working day are held back.</li>
        <li>They are handed out in rotation at 0{OPEN_HOUR}:00 the next working day.</li>
        <li>The whole batch starts fresh with the team on shift.</li>
      </ul>

      <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 p-4">
        <div className="rounded-md border border-border bg-background p-3">
          <div className="text-[11px] font-medium text-muted-foreground flex items-center gap-1">
            <Moon className="h-3 w-3" /> Held for 0{OPEN_HOUR}:00
          </div>
          <div className="text-xl font-bold text-foreground mt-1">{parked.length}</div>
        </div>
        <div className="rounded-md border border-border bg-background p-3">
          <div className="text-[11px] font-medium text-muted-foreground flex items-center gap-1">
            <CheckCircle2 className="h-3 w-3" /> Released
          </div>
          <div className="text-xl font-bold text-foreground mt-1">{released.length}</div>
        </div>
        <div className="rounded-md border border-border bg-background p-3">
          <div className="text-[11px] font-medium text-muted-foreground">Awaiting first call</div>
          <div
            className={cn(
              'text-xl font-bold mt-1',
              awaitingFirstCall.length > 0 ? 'text-amber-600' : 'text-emerald-600',
            )}
          >
            {awaitingFirstCall.length}
          </div>
        </div>
        <div className="rounded-md border border-border bg-background p-3">
          <div className="text-[11px] font-medium text-muted-foreground">Next release</div>
          <div className="text-xl font-bold text-foreground mt-1">
            {nextRelease ? fmtDayTime(nextRelease) : `0${OPEN_HOUR}:00`}
          </div>
        </div>
      </div>

      <div className="overflow-x-auto">
        <table className="w-full text-sm">
          <thead>
            <tr className="border-y border-border bg-muted/40 text-[11px] uppercase tracking-wide text-muted-foreground">
              <th className="text-left font-semibold px-4 py-2">#</th>
              <th className="text-left font-semibold px-4 py-2">Lead</th>
              <th className="text-left font-semibold px-4 py-2">Came in</th>
              <th className="text-left font-semibold px-4 py-2">Release</th>
              <th className="text-left font-semibold px-4 py-2">Source</th>
              <th className="text-left font-semibold px-4 py-2">State</th>
              <th className="text-left font-semibold px-4 py-2">Assigned to</th>
            </tr>
          </thead>
          <tbody>
            {rows.length === 0 && (
              <tr>
                <td colSpan={7} className="px-4 py-6 text-center text-sm text-muted-foreground">
                  {loading
                    ? 'Loading the overnight batch…'
                    : 'No out-of-hours enquiries in the current window — nothing is waiting for a morning release.'}
                </td>
              </tr>
            )}
            {[...parked, ...released].slice(0, 12).map((r, i) => {
              const isParked = parked.includes(r);
              return (
                <tr key={r.id} className="border-b border-border last:border-0">
                  <td className="px-4 py-2.5 text-muted-foreground">{i + 1}</td>
                  <td className="px-4 py-2.5">
                    <div className="font-medium text-foreground">{r.name}</div>
                    <div className="text-[11px] text-muted-foreground">
                      {r.phone}
                      {r.reg !== '—' ? ` · ${r.reg}` : ''}
                    </div>
                  </td>
                  <td className="px-4 py-2.5 whitespace-nowrap text-muted-foreground">{fmtDayTime(r.createdAt)}</td>
                  <td className="px-4 py-2.5 whitespace-nowrap text-foreground">
                    {r.eligibleAt ? fmtDayTime(r.eligibleAt) : 'Released'}
                  </td>
                  <td className="px-4 py-2.5 text-muted-foreground capitalize">{r.source.replace(/_/g, ' ')}</td>
                  <td className="px-4 py-2.5">
                    <span
                      className={cn(
                        'inline-flex items-center rounded-full border px-2 py-0.5 text-[11px] font-semibold',
                        isParked
                          ? 'bg-muted text-muted-foreground border-border'
                          : r.contacted
                            ? 'bg-emerald-500/10 text-emerald-700 dark:text-emerald-300 border-emerald-500/30'
                            : 'bg-amber-500/10 text-amber-700 dark:text-amber-300 border-amber-500/30',
                      )}
                    >
                      {isParked ? 'Held' : r.contacted ? 'Called' : 'Awaiting call'}
                    </span>
                  </td>
                  <td className="px-4 py-2.5 text-foreground">{r.agent}</td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>

      {rows.length > 12 && (
        <p className="px-4 py-3 text-[11px] text-muted-foreground border-t border-border">
          Showing the first 12 of {rows.length} in the overnight batch.
        </p>
      )}
    </div>
  );
};

export default OrrMorningReleasePanel;
