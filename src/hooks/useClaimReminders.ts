import { useCallback, useEffect, useMemo, useState } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { toast } from 'sonner';

export type ReminderKind = 'claim' | 'mediation' | 'appeal' | 'other';

export interface ClaimReminder {
  id: string;
  claim_id: string | null;
  reminder_kind: ReminderKind;
  title: string;
  notes: string | null;
  due_at: string;
  lead_time_minutes: number;
  snoozed_until: string | null;
  is_muted: boolean;
  status: string;
  assigned_to: string | null;
  completed_at: string | null;
  created_at: string;
}

export interface NewClaimReminder {
  claim_id?: string | null;
  reminder_kind: ReminderKind;
  title: string;
  notes?: string | null;
  due_at: string;
  lead_time_minutes: number;
  assigned_to?: string | null;
}

/** How early the banner appears, in minutes. */
export const LEAD_TIME_OPTIONS: { value: number; label: string }[] = [
  { value: 15, label: '15 minutes before' },
  { value: 60, label: '1 hour before' },
  { value: 240, label: '4 hours before' },
  { value: 1440, label: '1 day before' },
  { value: 2880, label: '2 days before' },
  { value: 4320, label: '3 days before' },
  { value: 10080, label: '1 week before' },
];

export const KIND_LABELS: Record<ReminderKind, string> = {
  claim: 'Claim',
  mediation: 'Mediation',
  appeal: 'Submission appeal',
  other: 'Other',
};

const ONE_DAY_MS = 24 * 60 * 60 * 1000;

/** A reminder is "showing" once we're inside its lead-time window and it isn't snoozed. */
export const isReminderShowing = (r: ClaimReminder, now = Date.now()) => {
  if (r.status !== 'active') return false;
  const due = new Date(r.due_at).getTime();
  const showFrom = due - r.lead_time_minutes * 60 * 1000;
  if (now < showFrom) return false;
  if (r.snoozed_until && now < new Date(r.snoozed_until).getTime()) return false;
  return true;
};

export function useClaimReminders() {
  const [reminders, setReminders] = useState<ClaimReminder[]>([]);
  const [loading, setLoading] = useState(true);
  const [tick, setTick] = useState(0);

  const load = useCallback(async () => {
    const { data, error } = await supabase
      .from('claim_reminders')
      .select('*')
      .order('due_at', { ascending: true });
    if (error) {
      console.error('Failed to load claim reminders', error);
    } else {
      setReminders((data || []) as ClaimReminder[]);
    }
    setLoading(false);
  }, []);

  useEffect(() => { load(); }, [load]);

  // Re-evaluate windows every 30s and re-fetch every 2 minutes.
  useEffect(() => {
    const t = setInterval(() => setTick(v => v + 1), 30_000);
    const r = setInterval(() => { load(); }, 120_000);
    return () => { clearInterval(t); clearInterval(r); };
  }, [load]);

  useEffect(() => {
    const channel = supabase
      .channel('claim-reminders-live')
      .on('postgres_changes', { event: '*', schema: 'public', table: 'claim_reminders' }, () => load())
      .subscribe();
    return () => { supabase.removeChannel(channel); };
  }, [load]);

  const create = useCallback(async (input: NewClaimReminder) => {
    const { data: auth } = await supabase.auth.getUser();
    const { error } = await supabase.from('claim_reminders').insert({
      claim_id: input.claim_id || null,
      reminder_kind: input.reminder_kind,
      title: input.title.trim(),
      notes: input.notes?.trim() || null,
      due_at: input.due_at,
      lead_time_minutes: input.lead_time_minutes,
      assigned_to: input.assigned_to || null,
      created_by: auth?.user?.id ?? null,
    });
    if (error) {
      toast.error(error.message || 'Could not save reminder');
      return false;
    }
    toast.success('Reminder set');
    await load();
    return true;
  }, [load]);

  const patch = useCallback(async (id: string, values: Partial<ClaimReminder>) => {
    // Optimistic — the banner should react instantly.
    setReminders(prev => prev.map(r => (r.id === id ? { ...r, ...values } as ClaimReminder : r)));
    const { error } = await supabase.from('claim_reminders').update(values as any).eq('id', id);
    if (error) {
      toast.error(error.message || 'Could not update reminder');
      await load();
      return false;
    }
    return true;
  }, [load]);

  const snoozeOneDay = useCallback(async (r: ClaimReminder) => {
    const base = r.snoozed_until && new Date(r.snoozed_until).getTime() > Date.now()
      ? new Date(r.snoozed_until).getTime()
      : Date.now();
    const ok = await patch(r.id, { snoozed_until: new Date(base + ONE_DAY_MS).toISOString() });
    if (ok) toast.success('Reminder delayed by 1 day');
  }, [patch]);

  const unsnooze = useCallback((r: ClaimReminder) => patch(r.id, { snoozed_until: null }), [patch]);

  const toggleMute = useCallback(async (r: ClaimReminder) => {
    const ok = await patch(r.id, { is_muted: !r.is_muted });
    if (ok) toast.success(r.is_muted ? 'Alert sound on' : 'Alert sound muted for this reminder');
  }, [patch]);

  const complete = useCallback(async (r: ClaimReminder) => {
    const ok = await patch(r.id, { status: 'done', completed_at: new Date().toISOString() });
    if (ok) toast.success('Reminder marked as done');
  }, [patch]);

  const reopen = useCallback((r: ClaimReminder) =>
    patch(r.id, { status: 'active', completed_at: null, snoozed_until: null }), [patch]);

  const remove = useCallback(async (id: string) => {
    setReminders(prev => prev.filter(r => r.id !== id));
    const { error } = await supabase.from('claim_reminders').delete().eq('id', id);
    if (error) {
      toast.error(error.message || 'Could not delete reminder');
      await load();
    } else {
      toast.success('Reminder deleted');
    }
  }, [load]);

  const active = useMemo(() => reminders.filter(r => r.status === 'active'), [reminders]);
  const done = useMemo(() => reminders.filter(r => r.status !== 'active'), [reminders]);

  const showing = useMemo(() => {
    const now = Date.now();
    return active
      .filter(r => isReminderShowing(r, now))
      .sort((a, b) => new Date(a.due_at).getTime() - new Date(b.due_at).getTime());
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [active, tick]);

  return {
    reminders, active, done, showing, loading,
    refresh: load, create, patch, snoozeOneDay, unsnooze, toggleMute, complete, reopen, remove,
  };
}
