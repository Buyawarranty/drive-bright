import { useEffect, useRef } from 'react';
import { CRM_CONNECTION_WINDOW_MS, isMeaningfulCrmEvent } from '@/lib/crmAttendanceRules';
import { recordCrmAttendance, registerAttendanceLogout } from '@/lib/crmAttendanceClient';

export function useCrmAttendance(currentTab?: string) {
  const tab = useRef(currentTab);
  tab.current = currentTab;
  useEffect(() => {
    let sessionId = crypto.randomUUID();
    let busy = false;
    let disposed = false;
    let activityPending = false;
    let lastSent = 0;
    let lastScrollIntent = 0;
    let lastEvent = 0;
    const positions = new WeakMap<EventTarget, number>();
    const send = async (kind: 'open' | 'activity' | 'ping' | 'hidden' | 'left_crm' | 'logout') => {
      if (busy && !['left_crm', 'logout', 'hidden'].includes(kind)) return;
      // Saved authentication can outlast the CRM connection. Resume as a new
      // attendance session rather than making an overnight/sleep gap look online.
      if (lastSent && Date.now() - lastSent >= CRM_CONNECTION_WINDOW_MS && ['ping', 'activity'].includes(kind)) sessionId = crypto.randomUUID();
      busy = true;
      try {
        await recordCrmAttendance(sessionId, kind, tab.current);
        lastSent = Date.now();
        if (kind === 'activity') activityPending = false;
      } catch { /* retry pending activity on the next scheduled tick */ }
      finally { busy = false; }
    };
    const interaction = (event: Event) => {
      const target = event.target instanceof Element ? event.target : null;
      let relevant = event.type === 'scroll' || Boolean(target?.closest('button,a,input,textarea,select,[role="button"],[role="tab"],[role="checkbox"],[role="switch"],[role="combobox"],[contenteditable="true"]'));
      if (event.type === 'scroll') {
        const scrollTarget = event.target;
        const position = target ? target.scrollTop + target.scrollLeft : window.scrollY + window.scrollX;
        const previous = scrollTarget ? positions.get(scrollTarget) ?? 0 : 0;
        if (scrollTarget) positions.set(scrollTarget, position);
        // Programmatic scrolling and negligible movement do not qualify.
        relevant = Date.now() - lastScrollIntent < 2000 && Math.abs(position - previous) >= 24;
      }
      if (!isMeaningfulCrmEvent(event.type, event.isTrusted, !document.hidden, relevant)) return;
      if (Date.now() - lastEvent < 1000) return;
      lastEvent = Date.now();
      activityPending = true;
      if (Date.now() - lastSent >= 10000) void send('activity');
    };
    const scrollIntent = (event: Event) => {
      if (event.isTrusted) lastScrollIntent = Date.now();
    };
    const keyIntent = (event: KeyboardEvent) => {
      if (['ArrowDown', 'ArrowUp', 'PageDown', 'PageUp', 'Home', 'End', ' '].includes(event.key)) scrollIntent(event);
    };
    const visibility = () => {
      if (document.hidden) { activityPending = false; void send('hidden'); }
      else void send('ping');
    };
    const pagehide = () => { activityPending = false; void send('left_crm'); };
    const pageshow = (event: PageTransitionEvent) => {
      if (event.persisted) { sessionId = crypto.randomUUID(); void send('open'); }
    };
    const removeLogout = registerAttendanceLogout(async () => {
      disposed = true;
      await send('logout');
    });
    void send('open');
    const timer = setInterval(() => {
      if (disposed || document.hidden) return;
      void send(activityPending ? 'activity' : 'ping');
    }, 15000);
    const events = ['click', 'input', 'change', 'paste', 'scroll'];
    events.forEach(type => document.addEventListener(type, interaction, { capture: true, passive: true }));
    window.addEventListener('wheel', scrollIntent, { passive: true });
    window.addEventListener('touchmove', scrollIntent, { passive: true });
    window.addEventListener('pointerdown', scrollIntent, { passive: true });
    window.addEventListener('keydown', keyIntent);
    document.addEventListener('visibilitychange', visibility);
    window.addEventListener('pagehide', pagehide);
    window.addEventListener('pageshow', pageshow);
    return () => {
      clearInterval(timer);
      removeLogout();
      events.forEach(type => document.removeEventListener(type, interaction, true));
      window.removeEventListener('wheel', scrollIntent);
      window.removeEventListener('touchmove', scrollIntent);
      window.removeEventListener('pointerdown', scrollIntent);
      window.removeEventListener('keydown', keyIntent);
      document.removeEventListener('visibilitychange', visibility);
      window.removeEventListener('pagehide', pagehide);
      window.removeEventListener('pageshow', pageshow);
      if (!disposed) void send('left_crm');
    };
  }, []);
}