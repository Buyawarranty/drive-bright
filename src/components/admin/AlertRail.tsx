import React from 'react';
import { createPortal } from 'react-dom';

/**
 * Single sticky alert rail for the admin dashboard.
 *
 * Agents had several independently `position: fixed` pop-ups (new leads, ORR
 * "take lead", sandbox hand-overs) that could land on top of each other in the
 * corners. They now all portal into ONE fixed column on the left-hand side of
 * the screen, stacked vertically in a stable priority order, so nothing ever
 * overlaps and everything stays visible however far the page is scrolled.
 */
const RAIL_ID = 'admin-alert-rail';

export const ALERT_RAIL_ORDER = {
  newLeadPopup: 10,
  // Hot WhatsApp leads sit just under the new-lead cards.
  whatsappHotLead: 15,
  // Sits BELOW the new-lead cards so a stuck checkout never covers a new lead.
  stuckCheckout: 20,
} as const;


export const AlertRailHost: React.FC = () => (
  <div
    id={RAIL_ID}
    className="fixed left-2 bottom-2 top-16 z-[120] flex w-[340px] max-w-[calc(100vw-1rem)] flex-col justify-end gap-2 overflow-y-auto overflow-x-hidden pointer-events-none"
  />
);

interface SlotProps {
  /** Lower numbers sit higher up the rail. */
  order: number;
  children: React.ReactNode;
}

export const AlertRailSlot: React.FC<SlotProps> = ({ order, children }) => {
  const [host, setHost] = React.useState<HTMLElement | null>(null);

  React.useEffect(() => {
    let cancelled = false;
    const find = () => {
      const el = document.getElementById(RAIL_ID);
      if (el && !cancelled) setHost(el);
      else if (!cancelled) window.setTimeout(find, 200);
    };
    find();
    return () => {
      cancelled = true;
    };
  }, []);

  const content = (
    <div className="pointer-events-auto w-full shrink-0" style={{ order }}>
      {children}
    </div>
  );

  if (!host) {
    // Rail not mounted (rendered outside the dashboard shell) — fall back to a
    // left-hand fixed position so the alert is still visible.
    return (
      <div className="fixed bottom-2 left-2 z-[120] w-[300px] max-w-[calc(100vw-1rem)]">{content}</div>
    );
  }

  return createPortal(content, host);
};

export default AlertRailHost;
