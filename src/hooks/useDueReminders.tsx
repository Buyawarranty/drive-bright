import { useState, useCallback, useEffect, useRef } from 'react';
import { supabase } from '@/integrations/supabase/client';

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

      reminderData.forEach((r: any) => {
        if (r.lead_id.startsWith('cart_')) cartIds.push(r.lead_id.replace('cart_', ''));
        else if (r.lead_id.startsWith('customer_')) customerIds.push(r.lead_id.replace('customer_', ''));
        else regularIds.push(r.lead_id);
      });

      let leadsMap: Record<string, any> = {};
      let cartsMap: Record<string, any> = {};
      let customersMap: Record<string, any> = {};

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

      const mapped = reminderData.map((r: any) => {
        let lead = null;
        if (r.lead_id.startsWith('customer_')) {
          const d = customersMap[r.lead_id.replace('customer_', '')];
          if (d) lead = { email: d.email, first_name: d.first_name || d.name?.split(' ')[0] || null, last_name: d.last_name || d.name?.split(' ').slice(1).join(' ') || null, vehicle_reg: d.registration_plate };
        } else if (r.lead_id.startsWith('cart_')) {
          const d = cartsMap[r.lead_id.replace('cart_', '')];
          if (d) lead = { email: d.email, first_name: d.full_name?.split(' ')[0] || null, last_name: d.full_name?.split(' ').slice(1).join(' ') || null, vehicle_reg: d.vehicle_reg };
        } else {
          lead = leadsMap[r.lead_id] || null;
        }
        return { ...r, lead } as DueReminder;
      });

      setDueReminders(mapped);
    } catch (err) {
      console.error('Error fetching due reminders:', err);
    }
  }, [dismissedIds]);

  const dismissReminder = useCallback(async (reminderId: string) => {
    try {
      await (supabase.from('lead_reminders' as any).update({ status: 'completed' }).eq('id', reminderId) as any);
      setDismissedIds(prev => new Set([...prev, reminderId]));
      setDueReminders(prev => prev.filter(r => r.id !== reminderId));
    } catch (err) {
      console.error('Error dismissing reminder:', err);
    }
  }, []);

  useEffect(() => {
    fetchDueReminders();
    intervalRef.current = setInterval(fetchDueReminders, 60000);
    return () => {
      if (intervalRef.current) clearInterval(intervalRef.current);
    };
  }, [fetchDueReminders]);

  return { dueReminders, dismissReminder, refetch: fetchDueReminders };
};
