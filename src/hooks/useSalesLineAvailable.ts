import { useEffect, useState } from 'react';
import { supabase } from '@/integrations/supabase/client';

/**
 * Should the website chat show the sales phone number right now?
 *
 * Monday to Friday it shows during opening hours. Saturday and Sunday nobody is
 * rostered, so it only shows between 10am and 2pm UK time and only while an
 * agent is genuinely live (activity in the New Leads area in the last 5 minutes).
 */
function londonParts(now = new Date()) {
  const parts = new Intl.DateTimeFormat('en-GB', {
    timeZone: 'Europe/London',
    weekday: 'short',
    hour: '2-digit',
    hour12: false,
  }).formatToParts(now);
  const weekday = parts.find((p) => p.type === 'weekday')?.value ?? 'Mon';
  const hour = Number(parts.find((p) => p.type === 'hour')?.value ?? '0');
  const dayIndex = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'].indexOf(weekday);
  return { dayIndex, hour };
}

export function useSalesLineAvailable(): boolean {
  const { dayIndex, hour } = londonParts();
  const isWeekend = dayIndex === 0 || dayIndex === 6;
  const weekdayOpen = !isWeekend && hour >= 9 && hour < 18;
  const weekendWindow = isWeekend && hour >= 10 && hour < 14;

  const [weekendAgentLive, setWeekendAgentLive] = useState(false);

  useEffect(() => {
    if (!weekendWindow) {
      setWeekendAgentLive(false);
      return;
    }
    let cancelled = false;
    const check = async () => {
      try {
        const { data } = await supabase.functions.invoke('sales-line-availability');
        if (!cancelled) setWeekendAgentLive(Boolean((data as { show_phone?: boolean })?.show_phone));
      } catch {
        if (!cancelled) setWeekendAgentLive(false);
      }
    };
    check();
    const interval = window.setInterval(() => {
      if (document.hidden) return;
      check();
    }, 60000);
    return () => {
      cancelled = true;
      window.clearInterval(interval);
    };
  }, [weekendWindow]);

  return weekdayOpen || (weekendWindow && weekendAgentLive);
}
