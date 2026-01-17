import { useState, useEffect, useCallback } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { toast } from 'sonner';
import { addHours } from 'date-fns';

export type CallOutcome = 'no_answer' | 'voicemail' | 'connected' | 'wrong_number' | 'busy' | 'callback_scheduled';

export interface CallLog {
  id: string;
  lead_id: string;
  lead_type: string;
  attempt_number: number;
  agent_id: string | null;
  agent_name: string | null;
  outcome: CallOutcome;
  notes: string | null;
  next_follow_up_date: string | null;
  created_at: string;
}

export interface LeadSettings {
  max_call_attempts: number;
  call_follow_up_intervals: Record<string, number>;
}

const DEFAULT_SETTINGS: LeadSettings = {
  max_call_attempts: 3,
  call_follow_up_intervals: { '1': 24, '2': 48, '3': 72 }
};

export const useLeadCallTracking = () => {
  const [settings, setSettings] = useState<LeadSettings>(DEFAULT_SETTINGS);
  const [loading, setLoading] = useState(true);

  // Fetch settings on mount
  useEffect(() => {
    const fetchSettings = async () => {
      try {
        const { data, error } = await supabase
          .from('lead_settings')
          .select('setting_key, setting_value')
          .in('setting_key', ['max_call_attempts', 'call_follow_up_intervals']);

        if (error) throw error;

        const settingsMap: Partial<LeadSettings> = {};
        data?.forEach(row => {
          if (row.setting_key === 'max_call_attempts') {
            settingsMap.max_call_attempts = typeof row.setting_value === 'number' 
              ? row.setting_value 
              : parseInt(String(row.setting_value), 10) || 3;
          } else if (row.setting_key === 'call_follow_up_intervals') {
            settingsMap.call_follow_up_intervals = typeof row.setting_value === 'object' 
              ? row.setting_value as Record<string, number>
              : DEFAULT_SETTINGS.call_follow_up_intervals;
          }
        });

        setSettings(prev => ({ ...prev, ...settingsMap }));
      } catch (error) {
        console.error('Error fetching lead settings:', error);
      } finally {
        setLoading(false);
      }
    };

    fetchSettings();
  }, []);

  // Log a call attempt with outcome
  const logCallAttempt = useCallback(async (params: {
    leadId: string;
    attemptNumber: number;
    outcome: CallOutcome;
    notes?: string;
    agentId?: string;
    agentName?: string;
  }): Promise<{ success: boolean; nextFollowUpDate?: Date }> => {
    const { leadId, attemptNumber, outcome, notes, agentId, agentName } = params;
    
    const isAbandonedCart = leadId.startsWith('cart_');
    const actualId = isAbandonedCart ? leadId.replace('cart_', '') : leadId;
    const leadType = isAbandonedCart ? 'abandoned_cart' : 'sales_lead';

    // Calculate next follow-up date based on outcome
    let nextFollowUpDate: Date | null = null;
    if (outcome === 'no_answer' || outcome === 'voicemail' || outcome === 'busy') {
      const hoursToAdd = settings.call_follow_up_intervals[String(attemptNumber)] || 24;
      nextFollowUpDate = addHours(new Date(), hoursToAdd);
    }

    try {
      const { error } = await supabase
        .from('lead_call_logs')
        .insert({
          lead_id: leadId,
          lead_type: leadType,
          attempt_number: attemptNumber,
          agent_id: agentId || null,
          agent_name: agentName || null,
          outcome,
          notes: notes || null,
          next_follow_up_date: nextFollowUpDate?.toISOString() || null
        });

      if (error) throw error;

      return { 
        success: true, 
        nextFollowUpDate: nextFollowUpDate || undefined 
      };
    } catch (error) {
      console.error('Error logging call attempt:', error);
      toast.error('Failed to log call attempt');
      return { success: false };
    }
  }, [settings]);

  // Get call logs for a specific lead
  const getCallLogs = useCallback(async (leadId: string): Promise<CallLog[]> => {
    try {
      const { data, error } = await supabase
        .from('lead_call_logs')
        .select('*')
        .eq('lead_id', leadId)
        .order('created_at', { ascending: false });

      if (error) throw error;
      return (data || []) as CallLog[];
    } catch (error) {
      console.error('Error fetching call logs:', error);
      return [];
    }
  }, []);

  // Get analytics for call attempts
  const getCallAnalytics = useCallback(async (daysBack: number = 7) => {
    try {
      const startDate = new Date();
      startDate.setDate(startDate.getDate() - daysBack);

      const { data, error } = await supabase
        .from('lead_call_logs')
        .select('agent_id, agent_name, outcome, created_at')
        .gte('created_at', startDate.toISOString());

      if (error) throw error;

      // Group by agent
      const byAgent: Record<string, { name: string; count: number }> = {};
      (data || []).forEach((log: any) => {
        if (log.agent_id) {
          if (!byAgent[log.agent_id]) {
            byAgent[log.agent_id] = { name: log.agent_name || 'Unknown', count: 0 };
          }
          byAgent[log.agent_id].count++;
        }
      });

      // Group by outcome
      const byOutcome: Record<string, number> = {};
      (data || []).forEach((log: any) => {
        byOutcome[log.outcome] = (byOutcome[log.outcome] || 0) + 1;
      });

      return {
        byAgent,
        byOutcome,
        totalCalls: data?.length || 0
      };
    } catch (error) {
      console.error('Error fetching call analytics:', error);
      return { byAgent: {}, byOutcome: {}, totalCalls: 0 };
    }
  }, []);

  // Update max call attempts setting (admin only)
  const updateMaxCallAttempts = useCallback(async (value: number): Promise<boolean> => {
    try {
      const { error } = await supabase
        .from('lead_settings')
        .update({ setting_value: value, updated_at: new Date().toISOString() })
        .eq('setting_key', 'max_call_attempts');

      if (error) throw error;

      setSettings(prev => ({ ...prev, max_call_attempts: value }));
      toast.success(`Max call attempts updated to ${value}`);
      return true;
    } catch (error) {
      console.error('Error updating max call attempts:', error);
      toast.error('Failed to update setting');
      return false;
    }
  }, []);

  return {
    settings,
    loading,
    logCallAttempt,
    getCallLogs,
    getCallAnalytics,
    updateMaxCallAttempts
  };
};
