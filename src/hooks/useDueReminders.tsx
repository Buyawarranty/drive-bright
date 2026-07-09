import { useState, useCallback, useEffect, useRef } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { notifyDueReminders, requestNotificationPermission } from '@/lib/reminderAlerts';


export interface DueReminder {
  id: string;
  lead_id: string;
  user_id: string;
  reminder_time: string;
  label: string | null;
  status: string;
  lead?: {
    email: string;
    first_name: string | null;
    last_name: string | null;
    vehicle_reg: string | null;
  } | null;
}

export const useDueReminders = () => {
  const [dueReminders, setDueReminders] = useState<DueReminder[]>([]);
  const [dismissedIds, setDismissedIds] = useState<Set<string>>(new Set());
  const intervalRef = useRef<ReturnType<typeof setInterval> | null>(null);

  const fetchDueReminders = useCallback(async () => {
    try {
      const { data: userData } = await supabase.auth.getUser();
      if (!userData.user) return;

      const { data: adminUser } = await supabase
        .from('admin_users')
        .select('id')
        .eq('user_id', userData.user.id)
        .maybeSingle();

      if (!adminUser?.id) return;

      const now = new Date().toISOString();

      const { data, error } = await (supabase
        .from('lead_reminders' as any)
        .select('*')
        .eq('user_id', adminUser.id)
        .in('status', ['pending', 'snoozed'])
        .lte('reminder_time', now)
        .order('reminder_time', { ascending: true }) as any);

      if (error) throw error;

      const reminderData = (data || []).filter((r: any) => !dismissedIds.has(r.id));

      // Fetch lead data for each reminder
      const regularIds: string[] = [];
      const cartIds: string[] = [];
      const customerIds: string[] = [];
      const claimIds: string[] = [];

      reminderData.forEach((r: any) => {
        if (r.lead_id.startsWith('cart_')) cartIds.push(r.lead_id.replace('cart_', ''));
        else if (r.lead_id.startsWith('customer_')) customerIds.push(r.lead_id.replace('customer_', ''));
        else if (r.lead_id.startsWith('claim_')) claimIds.push(r.lead_id.replace('claim_', ''));
        else regularIds.push(r.lead_id);
      });

      let leadsMap: Record<string, any> = {};
      let cartsMap: Record<string, any> = {};
      let customersMap: Record<string, any> = {};
      let claimsMap: Record<string, any> = {};

      if (regularIds.length > 0) {
        const { data: ld } = await supabase.from('sales_leads').select('id, email, first_name, last_name, vehicle_reg').in('id', regularIds);
        (ld || []).forEach((l: any) => { leadsMap[l.id] = l; });
      }
      if (cartIds.length > 0) {
        const { data: cd } = await supabase.from('abandoned_carts').select('id, email, full_name, vehicle_reg').in('id', cartIds);
        (cd || []).forEach((c: any) => { cartsMap[c.id] = c; });
      }
      if (customerIds.length > 0) {
        const { data: cd } = await supabase.from('customers').select('id, email, name, first_name, last_name, registration_plate').in('id', customerIds);
        (cd || []).forEach((c: any) => { customersMap[c.id] = c; });
      }
      if (claimIds.length > 0) {
        const { data: cd } = await supabase.from('claims_submissions').select('id, email, name, vehicle_registration').in('id', claimIds);
        (cd || []).forEach((c: any) => { claimsMap[c.id] = c; });
      }

      const mapped = reminderData.map((r: any) => {
        let lead = null;
        if (r.lead_id.startsWith('customer_')) {
          const d = customersMap[r.lead_id.replace('customer_', '')];
          if (d) lead = { email: d.email, first_name: d.first_name || d.name?.split(' ')[0] || null, last_name: d.last_name || d.name?.split(' ').slice(1).join(' ') || null, vehicle_reg: d.registration_plate };
        } else if (r.lead_id.startsWith('cart_')) {
          const d = cartsMap[r.lead_id.replace('cart_', '')];
          if (d) lead = { email: d.email, first_name: d.full_name?.split(' ')[0] || null, last_name: d.full_name?.split(' ').slice(1).join(' ') || null, vehicle_reg: d.vehicle_reg };
        } else if (r.lead_id.startsWith('claim_')) {
          const d = claimsMap[r.lead_id.replace('claim_', '')];
          if (d) lead = { email: d.email, first_name: d.name?.split(' ')[0] || null, last_name: d.name?.split(' ').slice(1).join(' ') || null, vehicle_reg: d.vehicle_registration };
        } else {
          lead = leadsMap[r.lead_id] || null;
        }
        return { ...r, lead } as DueReminder;
      });

      setDueReminders(mapped);

      // Fire desktop notification + chime for any newly-due reminders we
      // haven't already alerted on this session.
      notifyDueReminders(
        mapped.map((r: DueReminder) => {
          const first = r.lead?.first_name || '';
          const last = r.lead?.last_name || '';
          const nameLine = `${first} ${last}`.trim() || r.lead?.vehicle_reg || r.lead?.email || 'Reminder';
          return {
            id: r.id,
            title: `⏰ ${r.label || 'Follow up'}`,
            body: nameLine,
          };
        }),
      );
    } catch (err) {
      console.error('Error fetching due reminders:', err);
    }
  }, [dismissedIds]);

  // Dismiss only hides the popup locally — it does NOT mark the reminder
  // as completed. The reminder stays pending so it remains visible in the
  // "Reminders" filter and the My Reminders panel until the agent explicitly
  // completes or deletes it.
  const dismissReminder = useCallback(async (reminderId: string) => {
    setDismissedIds(prev => new Set([...prev, reminderId]));
    setDueReminders(prev => prev.filter(r => r.id !== reminderId));
  }, []);

  useEffect(() => {
    requestNotificationPermission();
    fetchDueReminders();
    // Poll every 20s so newly-due reminders fire promptly.
    intervalRef.current = setInterval(fetchDueReminders, 20000);
    return () => {
      if (intervalRef.current) clearInterval(intervalRef.current);
    };
  }, [fetchDueReminders]);


  return { dueReminders, dismissReminder, refetch: fetchDueReminders };
};
