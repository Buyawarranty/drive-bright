import { useState, useCallback, useEffect } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { toast } from 'sonner';
import { addDays, addWeeks, startOfTomorrow, endOfDay, setHours, setMinutes } from 'date-fns';

export interface LeadReminder {
  id: string;
  lead_id: string;
  user_id: string;
  reminder_time: string;
  label: string | null;
  status: 'pending' | 'snoozed' | 'dismissed' | 'completed';
  snoozed_until: string | null;
  created_at: string;
  updated_at: string;
  lead?: {
    email: string;
    first_name: string | null;
    last_name: string | null;
    vehicle_reg: string | null;
  } | null;
}

export type ReminderPreset = 'today' | 'tomorrow' | 'next_week' | 'custom';

export const useLeadReminders = (leadId?: string) => {
  const [reminders, setReminders] = useState<LeadReminder[]>([]);
  const [currentReminder, setCurrentReminder] = useState<LeadReminder | null>(null);
  const [loading, setLoading] = useState(false);
  const [currentUserId, setCurrentUserId] = useState<string | null>(null);

  // Get current admin user ID
  const getCurrentUserId = useCallback(async () => {
    const { data: userData } = await supabase.auth.getUser();
    if (!userData.user) return null;
    
    const { data: adminUser } = await supabase
      .from('admin_users')
      .select('id')
      .eq('user_id', userData.user.id)
      .single();
    
    return adminUser?.id || null;
  }, []);

  // Fetch all reminders for current user (for global list)
  const fetchAllReminders = useCallback(async () => {
    try {
      setLoading(true);
      const userId = await getCurrentUserId();
      if (!userId) return;
      setCurrentUserId(userId);

      const { data, error } = await (supabase
        .from('lead_reminders' as any)
        .select('*')
        .eq('user_id', userId)
        .in('status', ['pending', 'snoozed'])
        .order('reminder_time', { ascending: true }) as any);

      if (error) throw error;

      // Fetch lead info for each reminder
      const remindersWithLeads = await Promise.all(
        (data || []).map(async (reminder: any) => {
          // Handle both regular leads and abandoned cart leads
          const isAbandonedCart = reminder.lead_id.startsWith('cart_');
          
          if (isAbandonedCart) {
            const cartId = reminder.lead_id.replace('cart_', '');
            const { data: cartData } = await supabase
              .from('abandoned_carts')
              .select('email, full_name, vehicle_reg')
              .eq('id', cartId)
              .single();
            
            return {
              ...reminder,
              status: reminder.status as LeadReminder['status'],
              lead: cartData ? {
                email: cartData.email,
                first_name: cartData.full_name?.split(' ')[0] || null,
                last_name: cartData.full_name?.split(' ').slice(1).join(' ') || null,
                vehicle_reg: cartData.vehicle_reg
              } : null
            };
          } else {
            const { data: leadData } = await supabase
              .from('sales_leads')
              .select('email, first_name, last_name, vehicle_reg')
              .eq('id', reminder.lead_id)
              .single();
            return { 
              ...reminder, 
              status: reminder.status as LeadReminder['status'],
              lead: leadData 
            };
          }
        })
      );

      setReminders(remindersWithLeads as LeadReminder[]);
    } catch (error) {
      console.error('Error fetching reminders:', error);
    } finally {
      setLoading(false);
    }
  }, [getCurrentUserId]);

  // Fetch reminder for a specific lead
  const fetchLeadReminder = useCallback(async () => {
    if (!leadId) return;
    
    try {
      const userId = await getCurrentUserId();
      if (!userId) return;
      setCurrentUserId(userId);

      const { data, error } = await (supabase
        .from('lead_reminders' as any)
        .select('*')
        .eq('lead_id', leadId)
        .eq('user_id', userId)
        .in('status', ['pending', 'snoozed'])
        .single() as any);

      if (error && error.code !== 'PGRST116') throw error; // PGRST116 = no rows
      
      if (data) {
        setCurrentReminder({
          ...data,
          status: data.status as LeadReminder['status']
        } as LeadReminder);
      } else {
        setCurrentReminder(null);
      }
    } catch (error) {
      console.error('Error fetching lead reminder:', error);
    }
  }, [leadId, getCurrentUserId]);

  useEffect(() => {
    if (leadId) {
      fetchLeadReminder();
    } else {
      fetchAllReminders();
    }
  }, [leadId, fetchLeadReminder, fetchAllReminders]);

  const getPresetTime = (preset: ReminderPreset): Date => {
    const now = new Date();
    switch (preset) {
      case 'today':
        // End of today (5pm)
        return setMinutes(setHours(now, 17), 0);
      case 'tomorrow':
        // Tomorrow at 9am
        return setMinutes(setHours(startOfTomorrow(), 9), 0);
      case 'next_week':
        // Next week Monday at 9am
        return setMinutes(setHours(addWeeks(now, 1), 9), 0);
      default:
        return now;
    }
  };

  const createReminder = async (
    targetLeadId: string,
    preset: ReminderPreset,
    customTime?: Date,
    label?: string
  ) => {
    try {
      const userId = await getCurrentUserId();
      if (!userId) {
        toast.error('Could not identify user');
        return null;
      }

      const reminderTime = preset === 'custom' && customTime 
        ? customTime 
        : getPresetTime(preset);

      const { data, error } = await (supabase
        .from('lead_reminders' as any)
        .insert({
          lead_id: targetLeadId,
          user_id: userId,
          reminder_time: reminderTime.toISOString(),
          label: label?.trim() || null
        })
        .select()
        .single() as any);

      if (error) {
        if (error.code === '23505') {
          toast.error('You already have an active reminder for this lead');
          return null;
        }
        throw error;
      }

      toast.success('Reminder set');
      if (leadId) {
        await fetchLeadReminder();
      } else {
        await fetchAllReminders();
      }
      return data;
    } catch (error) {
      console.error('Error creating reminder:', error);
      toast.error('Failed to set reminder');
      return null;
    }
  };

  const snoozeReminder = async (reminderId: string, preset: ReminderPreset, customTime?: Date) => {
    try {
      const snoozedUntil = preset === 'custom' && customTime 
        ? customTime 
        : getPresetTime(preset);

      const { error } = await (supabase
        .from('lead_reminders' as any)
        .update({
          status: 'snoozed',
          snoozed_until: snoozedUntil.toISOString(),
          reminder_time: snoozedUntil.toISOString()
        })
        .eq('id', reminderId) as any);

      if (error) throw error;

      toast.success('Reminder snoozed');
      if (leadId) {
        await fetchLeadReminder();
      } else {
        await fetchAllReminders();
      }
    } catch (error) {
      console.error('Error snoozing reminder:', error);
      toast.error('Failed to snooze reminder');
    }
  };

  const dismissReminder = async (reminderId: string) => {
    try {
      const { error } = await (supabase
        .from('lead_reminders' as any)
        .update({ status: 'dismissed' })
        .eq('id', reminderId) as any);

      if (error) throw error;

      toast.success('Reminder dismissed');
      if (leadId) {
        setCurrentReminder(null);
        await fetchLeadReminder();
      } else {
        await fetchAllReminders();
      }
    } catch (error) {
      console.error('Error dismissing reminder:', error);
      toast.error('Failed to dismiss reminder');
    }
  };

  const completeReminder = async (reminderId: string) => {
    try {
      const { error } = await (supabase
        .from('lead_reminders' as any)
        .update({ status: 'completed' })
        .eq('id', reminderId) as any);

      if (error) throw error;

      toast.success('Reminder completed');
      if (leadId) {
        setCurrentReminder(null);
        await fetchLeadReminder();
      } else {
        await fetchAllReminders();
      }
    } catch (error) {
      console.error('Error completing reminder:', error);
      toast.error('Failed to complete reminder');
    }
  };

  const deleteReminder = async (reminderId: string) => {
    try {
      const { error } = await (supabase
        .from('lead_reminders' as any)
        .delete()
        .eq('id', reminderId) as any);

      if (error) throw error;

      toast.success('Reminder deleted');
      if (leadId) {
        setCurrentReminder(null);
        await fetchLeadReminder();
      } else {
        await fetchAllReminders();
      }
    } catch (error) {
      console.error('Error deleting reminder:', error);
      toast.error('Failed to delete reminder');
    }
  };

  return {
    reminders,
    currentReminder,
    loading,
    currentUserId,
    createReminder,
    snoozeReminder,
    dismissReminder,
    completeReminder,
    deleteReminder,
    refetchAll: fetchAllReminders,
    refetchLead: fetchLeadReminder
  };
};
