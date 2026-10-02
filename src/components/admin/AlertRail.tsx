import React from 'react';
import { createPortal } from 'react-dom';
import { Bell, ChevronDown, ChevronUp, Plus, X } from 'lucide-react';
import { readRecentAlerts, removeRecentAlert, RECENT_ALERTS_EVENT, type RecentAlert, type RecentAlertTone } from '@/lib/recentAlerts';
import { useAdminSidebarCollapsed } from '@/hooks/useAdminSidebarCollapsed';

/**
 * Live Alerts panel for the admin dashboard.
 *
 * Every admin pop-up portals into ONE persistent rail element. On desktop the
 * rail sits at the top of the left-hand Admin Panel menu (above the tab list);
 * when the menu is collapsed or on mobile it floats bottom-left instead. The
 * rail element itself is created once and moved between hosts, so alerts keep
 * their state, timers and sounds when the layout changes.
 */
const RAIL_ID = 'admin-alert-rail';
export const SIDEBAR_ALERTS_ANCHOR_ID = 'admin-sidebar-alerts-anchor';
const VISIBLE_LIMIT = 3;
const OPEN_KEY = 'bw:live-alerts-open';

export const ALERT_RAIL_ORDER = {
  newLeadPopup: 10,
  whatsappHotLead: 15,
  stuckCheckout: 20,
  chatAgentRequest: 25,
  complaintAlert: 30,
} as const;

const TONE: Record<RecentAlertTone, { card: string; dot: string }> = {
  red: { card: 'bg-red-50 border-red-200', dot: 'bg-red-600' },
  blue: { card: 'bg-blue-50 border-blue-200', dot: 'bg-blue-600' },
  amber: { card: 'bg-amber-50 border-amber-200', dot: 'bg-amber-500' },
  green: { card: 'bg-green-50 border-green-200', dot: 'bg-green-600' },
  orange: { card: 'bg-orange-50 border-orange-200', dot: 'bg-orange-500' },
  emerald: { card: 'bg-emerald-50 border-emerald-200', dot: 'bg-emerald-600' },
};

const ago = (at: number) => {
  const m = Math.max(0, Math.round((Date.now() - at) / 60000));
  if (m < 1) return 'Just now';
  if (m < 60) return `${m} min${m === 1 ? '' : 's'} ago`;
  const h = Math.floor(m / 60);
  return `${h}h ${m % 60}m ago`;
};

const RecentAlerts: React.FC = () => {
  const [list, setList] = React.useState<RecentAlert[]>(() => readRecentAlerts());
  const [all, setAll] = React.useState(false);
  const [open, setOpen] = React.useState(true);
  const [, tick] = React.useState(0);
  React.useEffect(() => {
    const on = () => setList(readRecentAlerts());
    window.addEventListener(RECENT_ALERTS_EVENT, on);
    window.addEventListener('storage', on);
    const t = window.setInterval(() => tick((n) => n + 1), 60000);
    return () => { window.removeEventListener(RECENT_ALERTS_EVENT, on); window.removeEventListener('storage', on); window.clearInterval(t); };
  }, []);
  if (!list.length) return null;
  const shown = all ? list : list.slice(0, 3);
  const more = list.length - 3;
  return (
    <div className="mt-2 rounded-xl border bg-white p-2">
      <button type="button" onClick={() => setOpen((v) => !v)} className="flex w-full items-center gap-2 px-1 pb-1.5" aria-expanded={open}>
        <Bell className="h-4 w-4 text-gray-700" />
        <span className="text-sm font-semibold text-gray-900">Recent alerts</span>
        {open ? <ChevronUp className="ml-auto h-4 w-4 text-gray-500" /> : <ChevronDown className="ml-auto h-4 w-4 text-gray-500" />}
      </button>
      {open && (
        <div className="flex flex-col gap-1.5">
          {shown.map((a) => (
            <div key={a.key} className={`relative flex items-start gap-2 rounded-lg border px-2 py-1.5 ${TONE[a.tone].card}`}>
              <span className={`mt-1 h-2.5 w-2.5 shrink-0 rounded-full ${TONE[a.tone].dot}`} />
              <div className="min-w-0 flex-1 pr-4">
                <div className="flex items-baseline justify-between gap-1">
                  <span className="truncate text-xs font-semibold text-gray-900">{a.title}</span>
                  <span className="shrink-0 text-[10px] text-gray-500">{ago(a.at)}</span>
                </div>
                <div className="truncate text-[11px] text-gray-600">{a.detail}</div>
              </div>
              <button type="button" aria-label="Remove from recent" onClick={() => removeRecentAlert(a.key)} className="absolute right-1 top-1 rounded p-0.5 text-gray-400 hover:bg-black/5">
                <X className="h-3 w-3" />
              </button>
            </div>
          ))}
          {more > 0 && (
            <button type="button" onClick={() => setAll((v) => !v)} className="flex items-center justify-center gap-1 rounded-lg bg-blue-100 py-1.5 text-xs font-semibold text-gray-900 hover:bg-blue-200">
              {all ? <>Show less <ChevronUp className="h-3.5 w-3.5" /></> : <><Plus className="h-3.5 w-3.5" />{more} more alert{more === 1 ? '' : 's'} <ChevronDown className="h-3.5 w-3.5" /></>}
            </button>
          )}
        </div>
      )}
    </div>
  );
};

let railEl: HTMLElement | null = null;
const getRailEl = (): HTMLElement => {
  if (!railEl) {
    railEl = document.createElement('div');
    railEl.id = RAIL_ID;
    railEl.className = 'flex flex-col gap-2';
  }
  return railEl;
};

const useIsDesktop = () => {
  const q = '(min-width: 1024px)';
  const [m, setM] = React.useState(() => typeof window !== 'undefined' && window.matchMedia(q).matches);
  React.useEffect(() => {
    const mq = window.matchMedia(q);
    const on = () => setM(mq.matches);
    mq.addEventListener('change', on);
    return () => mq.removeEventListener('change', on);
  }, []);
  return m;
};

export const AlertRailHost: React.FC = () => {
  const { collapsed } = useAdminSidebarCollapsed();
  const isDesktop = useIsDesktop();
  const [anchor, setAnchor] = React.useState<HTMLElement | null>(null);
  const [open, setOpen] = React.useState(() => {
    try { return localStorage.getItem(OPEN_KEY) !== '0'; } catch { return true; }
  });
  const [showAll, setShowAll] = React.useState(false);
  const [count, setCount] = React.useState(0);

  React.useEffect(() => {
    let cancelled = false;
    const find = () => {
      if (cancelled) return;
      const el = document.getElementById(SIDEBAR_ALERTS_ANCHOR_ID);
      setAnchor(el);
      if (!el) window.setTimeout(find, 300);
    };
    find();
    return () => { cancelled = true; };
  }, [collapsed]);

  // Count live alerts and limit to 3 unless "show more" is on.
  React.useEffect(() => {
    const el = getRailEl();
    const update = () => {
      const kids = (Array.from(el.children) as HTMLElement[])
        .filter((k) => k.childElementCount > 0)
        .sort((a, b) => Number(a.style.order || 0) - Number(b.style.order || 0));
      kids.forEach((k, i) => {
        k.style.display = !showAll && i >= VISIBLE_LIMIT ? 'none' : '';
      });
      setCount(kids.length);
    };
    const mo = new MutationObserver(update);
    mo.observe(el, { childList: true, subtree: true });
    update();
    return () => mo.disconnect();
  }, [showAll]);

  const holderRef = React.useCallback((node: HTMLDivElement | null) => {
    if (node) node.appendChild(getRailEl());
  }, []);

  const toggleOpen = () => {
    const next = !open;
    setOpen(next);
    try { localStorage.setItem(OPEN_KEY, next ? '1' : '0'); } catch { /* ignore */ }
  };

  const inSidebar = isDesktop && !collapsed && !!anchor;
  const hidden = count - VISIBLE_LIMIT;

  const panel = (
    <div
      className={
        inSidebar
          ? 'border-b bg-slate-50 px-2 py-2'
          : `fixed bottom-2 ${collapsed && isDesktop ? 'left-16' : 'left-2'} z-[120] w-[320px] max-w-[calc(100vw-1rem)] rounded-xl border bg-slate-50 p-2 shadow-xl ${count === 0 ? 'hidden' : ''}`
      }
    >
      <div className="flex items-center justify-between px-1 pb-1.5">
        <button type="button" onClick={toggleOpen} className="flex items-center gap-2" aria-expanded={open}>
          <span className="text-sm font-bold text-gray-900">Live Alerts</span>
          <span className={`inline-flex min-w-5 h-5 items-center justify-center rounded-md px-1.5 text-[11px] font-bold ${count ? 'bg-red-600 text-white' : 'bg-gray-200 text-gray-600'}`}>{count}</span>
          {open ? <ChevronUp className="h-4 w-4 text-gray-500" /> : <ChevronDown className="h-4 w-4 text-gray-500" />}
        </button>
        {count > VISIBLE_LIMIT && open && (
          <button type="button" onClick={() => setShowAll((v) => !v)} className="text-xs font-semibold text-blue-600 hover:underline">
            {showAll ? 'Show less' : `View all (${count})`}
          </button>
        )}
      </div>
      <div className={open ? (inSidebar ? 'max-h-[50vh] overflow-y-auto overflow-x-hidden' : 'max-h-[70vh] overflow-y-auto overflow-x-hidden') : 'hidden'}>
        <div ref={holderRef} />
        {count === 0 && <p className="px-1 py-1 text-xs text-gray-500">No live alerts right now.</p>}
        {hidden > 0 && (
          <button
            type="button"
            onClick={() => setShowAll((v) => !v)}
            className="mt-2 flex w-full items-center justify-center gap-1 rounded-lg bg-blue-100 py-1.5 text-xs font-semibold text-gray-900 hover:bg-blue-200"
          >
            {showAll ? <>Show less <ChevronUp className="h-3.5 w-3.5" /></> : <><Plus className="h-3.5 w-3.5" />{hidden} more alert{hidden === 1 ? '' : 's'} <ChevronDown className="h-3.5 w-3.5" /></>}
          </button>
        )}
        <RecentAlerts />
      </div>
    </div>
  );

  return createPortal(panel, inSidebar ? anchor! : document.body);
};

interface SlotProps {
  /** Lower numbers sit higher up the rail. */
  order: number;
  children: React.ReactNode;
}

export const AlertRailSlot: React.FC<SlotProps> = ({ order, children }) => {
  const host = React.useMemo(() => (typeof document !== 'undefined' ? getRailEl() : null), []);
  const content = (
    <div className="w-full shrink-0" style={{ order }}>
      {children}
    </div>
  );
  if (!host) return null;
  return createPortal(content, host);
};

export default AlertRailHost;
