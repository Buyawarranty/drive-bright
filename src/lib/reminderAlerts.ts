// Helpers for the admin reminder system: browser notifications + audio ping.
// Kept lightweight and side-effect free until explicitly invoked.

const SEEN_KEY = 'admin_reminder_notified_ids_v1';

const readSeen = (): Set<string> => {
  try {
    const raw = sessionStorage.getItem(SEEN_KEY);
    if (!raw) return new Set();
    const arr = JSON.parse(raw);
    return new Set(Array.isArray(arr) ? arr : []);
  } catch {
    return new Set();
  }
};

const writeSeen = (set: Set<string>) => {
  try {
    // keep list bounded
    const arr = Array.from(set).slice(-200);
    sessionStorage.setItem(SEEN_KEY, JSON.stringify(arr));
  } catch {
    // ignore
  }
};

export const requestNotificationPermission = async () => {
  try {
    if (typeof window === 'undefined' || !('Notification' in window)) return;
    if (Notification.permission === 'default') {
      await Notification.requestPermission();
    }
  } catch {
    // ignore
  }
};

let audioCtx: AudioContext | null = null;
const getCtx = (): AudioContext | null => {
  if (typeof window === 'undefined') return null;
  const Ctor = (window as any).AudioContext || (window as any).webkitAudioContext;
  if (!Ctor) return null;
  if (!audioCtx) audioCtx = new Ctor();
  return audioCtx;
};

export const playReminderChime = () => {
  // Respect the shared "mute all alerts" preference.
  // Lazy import to keep this file free of framework deps.
  try {
    // eslint-disable-next-line @typescript-eslint/no-var-requires
    const { isAlertsMuted } = require('@/lib/alertSoundPreference') as typeof import('@/lib/alertSoundPreference');
    if (isAlertsMuted()) return;
  } catch { /* ignore */ }
  try {
    const ctx = getCtx();
    if (!ctx) return;
    // Two-tone chime — attention-grabbing but short.
    const now = ctx.currentTime;
    const play = (freq: number, start: number, dur = 0.22) => {
      const osc = ctx.createOscillator();
      const gain = ctx.createGain();
      osc.type = 'sine';
      osc.frequency.value = freq;
      gain.gain.setValueAtTime(0.0001, now + start);
      gain.gain.exponentialRampToValueAtTime(0.35, now + start + 0.02);
      gain.gain.exponentialRampToValueAtTime(0.0001, now + start + dur);
      osc.connect(gain).connect(ctx.destination);
      osc.start(now + start);
      osc.stop(now + start + dur + 0.02);
    };
    play(880, 0);
    play(1320, 0.18);
  } catch {
    // ignore
  }
};

export interface ReminderNotifyPayload {
  id: string;
  title: string;
  body: string;
}

export const notifyDueReminders = (items: ReminderNotifyPayload[]) => {
  if (items.length === 0) return;
  const seen = readSeen();
  const fresh = items.filter((i) => !seen.has(i.id));
  if (fresh.length === 0) return;

  playReminderChime();

  try {
    if (typeof window !== 'undefined' && 'Notification' in window && Notification.permission === 'granted') {
      fresh.slice(0, 3).forEach((item) => {
        try {
          const n = new Notification(item.title, {
            body: item.body,
            tag: `reminder-${item.id}`,
            requireInteraction: true,
          });
          n.onclick = () => {
            window.focus();
            n.close();
          };
        } catch {
          // ignore
        }
      });
    }
  } catch {
    // ignore
  }

  fresh.forEach((i) => seen.add(i.id));
  writeSeen(seen);
};
