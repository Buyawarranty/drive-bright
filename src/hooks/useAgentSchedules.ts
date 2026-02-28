import { useState, useEffect, useCallback } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { toast } from '@/hooks/use-toast';

export interface AgentSchedule {
  id: string;
  admin_user_id: string;
  day_of_week: number;
  shift_start: string;
  shift_end: string;
  is_available: boolean;
  break_start: string | null;
  break_end: string | null;
}

const DAY_NAMES = ['Sunday', 'Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday'];

const DEFAULT_SCHEDULE: Omit<AgentSchedule, 'id' | 'admin_user_id'> = {
  day_of_week: 0,
  shift_start: '09:00',
  shift_end: '17:00',
  is_available: true,
  break_start: null,
  break_end: null,
};

export const useAgentSchedules = (adminUserId?: string) => {
  const [schedules, setSchedules] = useState<AgentSchedule[]>([]);
  const [loading, setLoading] = useState(false);

  const fetchSchedules = useCallback(async () => {
    if (!adminUserId) return;
    setLoading(true);
    try {
      const { data, error } = await supabase
        .from('agent_schedules')
        .select('*')
        .eq('admin_user_id', adminUserId)
        .order('day_of_week');

      if (error) throw error;
      setSchedules((data as AgentSchedule[]) || []);
    } catch (error) {
      console.error('Error fetching agent schedules:', error);
    } finally {
      setLoading(false);
    }
  }, [adminUserId]);

  useEffect(() => {
    fetchSchedules();
  }, [fetchSchedules]);

  const initializeWeek = useCallback(async () => {
    if (!adminUserId) return;
    try {
      const rows = Array.from({ length: 7 }, (_, i) => ({
        admin_user_id: adminUserId,
        day_of_week: i,
        shift_start: i >= 1 && i <= 5 ? '09:00' : '10:00',
        shift_end: i >= 1 && i <= 5 ? '17:00' : '14:00',
        is_available: i >= 1 && i <= 5,
        break_start: i >= 1 && i <= 5 ? '12:00' : null,
        break_end: i >= 1 && i <= 5 ? '13:00' : null,
      }));

      const { error } = await supabase
        .from('agent_schedules')
        .upsert(rows as any, { onConflict: 'admin_user_id,day_of_week' });

      if (error) throw error;
      await fetchSchedules();
      toast({ title: 'Schedule initialized', description: 'Default weekly schedule created.' });
    } catch (error) {
      console.error('Error initializing schedule:', error);
      toast({ title: 'Error', description: 'Failed to initialize schedule.', variant: 'destructive' });
    }
  }, [adminUserId, fetchSchedules]);

  const updateSchedule = useCallback(async (dayOfWeek: number, updates: Partial<AgentSchedule>) => {
    if (!adminUserId) return false;
    try {
      const { error } = await supabase
        .from('agent_schedules')
        .update(updates as any)
        .eq('admin_user_id', adminUserId)
        .eq('day_of_week', dayOfWeek);

      if (error) throw error;
      setSchedules(prev =>
        prev.map(s => s.day_of_week === dayOfWeek ? { ...s, ...updates } : s)
      );
      return true;
    } catch (error) {
      console.error('Error updating schedule:', error);
      toast({ title: 'Error', description: 'Failed to update schedule.', variant: 'destructive' });
      return false;
    }
  }, [adminUserId]);

  return { schedules, loading, initializeWeek, updateSchedule, DAY_NAMES };
};
