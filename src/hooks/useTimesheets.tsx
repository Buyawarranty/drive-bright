import { useState, useEffect, useCallback } from 'react';
import { isWeekend } from 'date-fns';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/hooks/useAuth';
import { toast } from 'sonner';

export type TimesheetEntryType = 'worked' | 'sick' | 'holiday' | 'unpaid_leave' | 'training' | 'wfh';

export interface TimesheetEntry {
  id: string;
  user_id: string;
  admin_user_id: string | null;
  entry_date: string;
  entry_type: TimesheetEntryType;
  hours_worked: number;
  start_time: string | null;
  end_time: string | null;
  break_minutes: number;
  notes: string | null;
  is_approved: boolean;
  approved_by: string | null;
  approved_at: string | null;
  created_at: string;
  updated_at: string;
}

export interface DealRecord {
  id: string;
  user_id: string;
  admin_user_id: string | null;
  customer_id: string | null;
  deal_date: string;
  deal_value: number;
  plan_type: string | null;
  customer_name: string | null;
  vehicle_reg: string | null;
  notes: string | null;
  commission_record_id: string | null;
  created_at: string;
  updated_at: string;
}

export interface CommissionRecord {
  id: string;
  user_id: string;
  admin_user_id: string | null;
  period_start: string;
  period_end: string;
  deals_count: number;
  total_sales_value: number;
  commission_rate: number;
  commission_amount: number;
  bonus_amount: number;
  notes: string | null;
  status: 'pending' | 'approved' | 'paid';
  approved_by: string | null;
  approved_at: string | null;
  paid_at: string | null;
  created_at: string;
  updated_at: string;
}

export interface TimesheetStats {
  totalWorkedDays: number;
  totalWorkedHours: number;
  fullDays: number;
  halfDays: number;
  weekendDays: number;
  sickDays: number;
  holidayDays: number;
  wfhDays: number;
  trainingDays: number;
}

export function useTimesheets(month?: Date, viewingUserId?: string) {
  const { session } = useAuth();
  const effectiveUserId = viewingUserId || session?.user?.id;
  const [entries, setEntries] = useState<TimesheetEntry[]>([]);
  const [deals, setDeals] = useState<DealRecord[]>([]);
  const [commissions, setCommissions] = useState<CommissionRecord[]>([]);
  const [loading, setLoading] = useState(true);
  const [stats, setStats] = useState<TimesheetStats>({
    totalWorkedDays: 0,
    totalWorkedHours: 0,
    fullDays: 0,
    halfDays: 0,
    weekendDays: 0,
    sickDays: 0,
    holidayDays: 0,
    wfhDays: 0,
    trainingDays: 0,
  });

  const currentMonth = month || new Date();
  const startOfMonth = new Date(currentMonth.getFullYear(), currentMonth.getMonth(), 1);
  const endOfMonth = new Date(currentMonth.getFullYear(), currentMonth.getMonth() + 1, 0);

  const fetchTimesheets = useCallback(async () => {
    if (!effectiveUserId) return;
    
    setLoading(true);
    try {
      const { data, error } = await supabase
        .from('staff_timesheets')
        .select('*')
        .eq('user_id', effectiveUserId)
        .gte('entry_date', startOfMonth.toISOString().split('T')[0])
        .lte('entry_date', endOfMonth.toISOString().split('T')[0])
        .order('entry_date', { ascending: true });

      if (error) throw error;
      
      const typedEntries = (data || []).map(entry => ({
        ...entry,
        entry_type: entry.entry_type as TimesheetEntryType,
        hours_worked: Number(entry.hours_worked) || 0,
      }));
      
      setEntries(typedEntries);
      
      const workedEntries = typedEntries.filter(e => e.entry_type === 'worked' || e.entry_type === 'wfh' || e.entry_type === 'training');
      const fullDays = workedEntries.filter(e => (e.hours_worked || 0) > 5).length;
      const halfDays = workedEntries.filter(e => (e.hours_worked || 0) > 0 && (e.hours_worked || 0) <= 5).length;
      const weekendDays = workedEntries.filter(e => isWeekend(new Date(e.entry_date))).length;

      const newStats: TimesheetStats = {
        totalWorkedDays: workedEntries.length,
        totalWorkedHours: workedEntries.reduce((sum, e) => sum + (e.hours_worked || 0), 0),
        fullDays,
        halfDays,
        weekendDays,
        sickDays: typedEntries.filter(e => e.entry_type === 'sick').length,
        holidayDays: typedEntries.filter(e => e.entry_type === 'holiday').length,
        wfhDays: 0,
        trainingDays: typedEntries.filter(e => e.entry_type === 'training').length,
      };
      setStats(newStats);
    } catch (error) {
      console.error('Error fetching timesheets:', error);
      toast.error('Failed to load timesheets');
    } finally {
      setLoading(false);
    }
  }, [effectiveUserId, startOfMonth.toISOString(), endOfMonth.toISOString()]);

  const fetchDeals = useCallback(async () => {
    if (!effectiveUserId) return;
    
    try {
      const { data, error } = await supabase
        .from('deal_records')
        .select('*')
        .eq('user_id', effectiveUserId)
        .gte('deal_date', startOfMonth.toISOString().split('T')[0])
        .lte('deal_date', endOfMonth.toISOString().split('T')[0])
        .order('deal_date', { ascending: false });

      if (error) throw error;
      setDeals((data || []) as DealRecord[]);
    } catch (error) {
      console.error('Error fetching deals:', error);
    }
  }, [effectiveUserId, startOfMonth.toISOString(), endOfMonth.toISOString()]);

  const fetchCommissions = useCallback(async () => {
    if (!effectiveUserId) return;
    
    try {
      const { data, error } = await supabase
        .from('commission_records')
        .select('*')
        .eq('user_id', effectiveUserId)
        .order('period_start', { ascending: false })
        .limit(12);

      if (error) throw error;
      setCommissions((data || []) as CommissionRecord[]);
    } catch (error) {
      console.error('Error fetching commissions:', error);
    }
  }, [effectiveUserId]);

  useEffect(() => {
    fetchTimesheets();
    fetchDeals();
    fetchCommissions();
  }, [fetchTimesheets, fetchDeals, fetchCommissions]);

  const upsertEntry = async (
    date: Date,
    entryType: TimesheetEntryType,
    hoursWorked?: number,
    startTime?: string,
    endTime?: string,
    breakMinutes?: number,
    notes?: string
  ) => {
    if (!session?.user?.id) return;

    const dateStr = date.toISOString().split('T')[0];
    
    try {
      const { data: adminUser } = await supabase
        .from('admin_users')
        .select('id')
        .eq('user_id', session.user.id)
        .maybeSingle();

      const { error } = await supabase
        .from('staff_timesheets')
        .upsert({
          user_id: session.user.id,
          admin_user_id: adminUser?.id || null,
          entry_date: dateStr,
          entry_type: entryType,
          hours_worked: hoursWorked || 0,
          start_time: startTime || null,
          end_time: endTime || null,
          break_minutes: breakMinutes || 0,
          notes: notes || null,
        }, {
          onConflict: 'user_id,entry_date'
        });

      if (error) throw error;
      
      toast.success('Timesheet updated');
      await fetchTimesheets();
    } catch (error) {
      console.error('Error saving timesheet:', error);
      toast.error('Failed to save timesheet');
    }
  };

  const deleteEntry = async (date: Date) => {
    if (!session?.user?.id) return;

    const dateStr = date.toISOString().split('T')[0];
    
    try {
      const { error } = await supabase
        .from('staff_timesheets')
        .delete()
        .eq('user_id', session.user.id)
        .eq('entry_date', dateStr);

      if (error) throw error;
      
      toast.success('Entry removed');
      await fetchTimesheets();
    } catch (error) {
      console.error('Error deleting entry:', error);
      toast.error('Failed to delete entry');
    }
  };

  const addDeal = async (
    dealValue: number,
    dealDate: Date,
    planType?: string,
    customerName?: string,
    vehicleReg?: string,
    notes?: string,
    customerId?: string
  ) => {
    if (!session?.user?.id) return;

    try {
      const { data: adminUser } = await supabase
        .from('admin_users')
        .select('id')
        .eq('user_id', session.user.id)
        .maybeSingle();

      const { error } = await supabase
        .from('deal_records')
        .insert({
          user_id: session.user.id,
          admin_user_id: adminUser?.id || null,
          deal_date: dealDate.toISOString().split('T')[0],
          deal_value: dealValue,
          plan_type: planType || null,
          customer_name: customerName || null,
          vehicle_reg: vehicleReg || null,
          notes: notes || null,
          customer_id: customerId || null,
        });

      if (error) throw error;
      
      toast.success('Deal recorded');
      await fetchDeals();
    } catch (error) {
      console.error('Error adding deal:', error);
      toast.error('Failed to record deal');
    }
  };

  const deleteDeal = async (dealId: string) => {
    try {
      const { error } = await supabase
        .from('deal_records')
        .delete()
        .eq('id', dealId);

      if (error) throw error;
      
      toast.success('Deal removed');
      await fetchDeals();
    } catch (error) {
      console.error('Error deleting deal:', error);
      toast.error('Failed to delete deal');
    }
  };

  return {
    entries,
    deals,
    commissions,
    stats,
    loading,
    upsertEntry,
    deleteEntry,
    addDeal,
    deleteDeal,
    refresh: () => {
      fetchTimesheets();
      fetchDeals();
      fetchCommissions();
    },
  };
}
