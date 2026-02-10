import { useState, useEffect, useCallback } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { toast } from '@/hooks/use-toast';

interface DistributionSettings {
  id: string;
  active_only_distribution: boolean;
  overflow_recipient_id: string | null;
  solo_agent_id: string | null;
  solo_mode_enabled: boolean;
  distribution_mode: 'round_robin' | 'percentage';
}

interface AgentCap {
  id: string;
  admin_user_id: string;
  daily_cap: number;
  assigned_today: number;
  last_assigned_at: string | null;
  paused: boolean;
  percentage: number | null;
  admin_user?: {
    id: string;
    email: string;
    first_name: string | null;
    last_name: string | null;
  };
}

interface AgentPresence {
  admin_user_id: string;
  status: string;
  last_interaction_at: string | null;
  last_seen_at: string | null;
  is_paused_receiving: boolean;
}

export const useLeadDistribution = () => {
  const [settings, setSettings] = useState<DistributionSettings | null>(null);
  const [agentCaps, setAgentCaps] = useState<AgentCap[]>([]);
  const [agentPresences, setAgentPresences] = useState<AgentPresence[]>([]);
  const [loading, setLoading] = useState(true);
  const [currentAgentCap, setCurrentAgentCap] = useState<AgentCap | null>(null);

  // Fetch distribution settings
  const fetchSettings = useCallback(async () => {
    try {
      const { data, error } = await supabase
        .from('lead_distribution_settings')
        .select('*')
        .limit(1)
        .maybeSingle();

      if (error) throw error;
      if (data) {
        setSettings({
          ...data,
          distribution_mode: (data.distribution_mode as 'round_robin' | 'percentage') || 'round_robin'
        });
      }
    } catch (error) {
      console.error('Error fetching distribution settings:', error);
    }
  }, []);

  // Fetch agent caps with admin user info
  const fetchAgentCaps = useCallback(async () => {
    try {
      const { data, error } = await supabase
        .from('agent_distribution_caps')
        .select(`
          *,
          admin_user:admin_users(id, email, first_name, last_name)
        `);

      if (error) throw error;
      setAgentCaps(data || []);

      // Get current user's cap
      const { data: { user } } = await supabase.auth.getUser();
      if (user) {
        const { data: adminUser } = await supabase
          .from('admin_users')
          .select('id')
          .eq('user_id', user.id)
          .maybeSingle();

        if (adminUser) {
          const currentCap = data?.find(cap => cap.admin_user_id === adminUser.id);
          setCurrentAgentCap(currentCap || null);
        }
      }
    } catch (error) {
      console.error('Error fetching agent caps:', error);
    }
  }, []);

  // Fetch agent presences
  const fetchAgentPresences = useCallback(async () => {
    try {
      const { data, error } = await supabase
        .from('user_presence')
        .select('admin_user_id, status, last_interaction_at, last_seen_at, is_paused_receiving')
        .not('admin_user_id', 'is', null);

      if (error) throw error;
      setAgentPresences(data || []);
    } catch (error) {
      console.error('Error fetching agent presences:', error);
    }
  }, []);

  // Update distribution settings
  const updateSettings = useCallback(async (updates: Partial<DistributionSettings>) => {
    if (!settings?.id) return false;

    try {
      const { error } = await supabase
        .from('lead_distribution_settings')
        .update(updates)
        .eq('id', settings.id);

      if (error) throw error;

      setSettings(prev => prev ? { ...prev, ...updates } : null);
      toast({ title: 'Settings updated', description: 'Distribution settings saved successfully.' });
      return true;
    } catch (error) {
      console.error('Error updating settings:', error);
      toast({ title: 'Error', description: 'Failed to update settings.', variant: 'destructive' });
      return false;
    }
  }, [settings?.id]);

  // Update agent cap
  const updateAgentCap = useCallback(async (adminUserId: string, updates: Partial<AgentCap>) => {
    try {
      // Check if cap record exists
      const existing = agentCaps.find(cap => cap.admin_user_id === adminUserId);

      if (existing) {
        const { error } = await supabase
          .from('agent_distribution_caps')
          .update(updates)
          .eq('admin_user_id', adminUserId);

        if (error) throw error;
      } else {
        const { error } = await supabase
          .from('agent_distribution_caps')
          .insert({ admin_user_id: adminUserId, ...updates });

        if (error) throw error;
      }

      await fetchAgentCaps();
      return true;
    } catch (error) {
      console.error('Error updating agent cap:', error);
      toast({ title: 'Error', description: 'Failed to update agent cap.', variant: 'destructive' });
      return false;
    }
  }, [agentCaps, fetchAgentCaps]);

  // Toggle agent pause status
  const toggleAgentPause = useCallback(async (adminUserId: string) => {
    const currentCap = agentCaps.find(cap => cap.admin_user_id === adminUserId);
    return updateAgentCap(adminUserId, { paused: !currentCap?.paused });
  }, [agentCaps, updateAgentCap]);

  // Delete agent from distribution
  const deleteAgentFromDistribution = useCallback(async (adminUserId: string) => {
    try {
      const { error } = await supabase
        .from('agent_distribution_caps')
        .delete()
        .eq('admin_user_id', adminUserId);

      if (error) throw error;

      await fetchAgentCaps();
      toast({ title: 'Agent removed', description: 'Agent has been removed from lead distribution.' });
      return true;
    } catch (error) {
      console.error('Error deleting agent from distribution:', error);
      toast({ title: 'Error', description: 'Failed to remove agent.', variant: 'destructive' });
      return false;
    }
  }, [fetchAgentCaps]);

  // Claim next available lead
  const claimNextLead = useCallback(async () => {
    try {
      // Get current user's admin ID first
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) throw new Error('Not authenticated');

      const { data: adminUser } = await supabase
        .from('admin_users')
        .select('id')
        .eq('user_id', user.id)
        .maybeSingle();

      if (!adminUser) throw new Error('Admin user not found');

      // CRITICAL: Force presence update BEFORE claiming to ensure database has latest interaction
      // This fixes the race condition where local state shows 'active' but database is stale
      await supabase.rpc('log_agent_interaction', { p_event_type: 'claim_attempt' });

      // Get the next eligible unassigned lead
      const { data: unassignedLead, error: leadError } = await supabase
        .from('sales_leads')
        .select('id')
        .is('assigned_to', null)
        .neq('status', 'lost')
        .neq('status', 'fake_lead')
        .order('created_at', { ascending: true })
        .limit(1)
        .maybeSingle();

      if (leadError) throw leadError;

      if (!unassignedLead) {
        toast({ title: 'No leads available', description: 'There are no unassigned leads to claim.' });
        return null;
      }

      // Attempt to claim the lead
      const { data: result, error: claimError } = await supabase
        .rpc('claim_lead_for_agent', {
          p_lead_id: unassignedLead.id,
          p_agent_id: adminUser.id
        });

      if (claimError) throw claimError;

      const claimResult = result as { success: boolean; error?: string; message?: string };

      if (claimResult.success) {
        toast({ title: 'Lead claimed!', description: claimResult.message || 'You have been assigned a new lead.' });
        await fetchAgentCaps();
        return unassignedLead.id;
      } else {
        toast({ title: 'Cannot claim lead', description: claimResult.error, variant: 'destructive' });
        return null;
      }
    } catch (error) {
      console.error('Error claiming lead:', error);
      toast({ title: 'Error', description: 'Failed to claim lead.', variant: 'destructive' });
      return null;
    }
  }, [fetchAgentCaps]);

  // Toggle pause receiving for current user
  const togglePauseReceiving = useCallback(async () => {
    try {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) return false;

      const { data: presence } = await supabase
        .from('user_presence')
        .select('is_paused_receiving')
        .eq('user_id', user.id)
        .maybeSingle();

      const { error } = await supabase
        .from('user_presence')
        .update({ is_paused_receiving: !presence?.is_paused_receiving })
        .eq('user_id', user.id);

      if (error) throw error;

      await fetchAgentPresences();
      toast({
        title: presence?.is_paused_receiving ? 'Receiving enabled' : 'Receiving paused',
        description: presence?.is_paused_receiving
          ? 'You will now receive new leads.'
          : 'You will not receive auto-assigned leads.'
      });
      return true;
    } catch (error) {
      console.error('Error toggling pause receiving:', error);
      return false;
    }
  }, [fetchAgentPresences]);

  // Initialize agent caps for all sales agents
  const initializeAgentCaps = useCallback(async () => {
    try {
      // Get all active sales/admin users
      const { data: adminUsers, error } = await supabase
        .from('admin_users')
        .select('id')
        .eq('is_active', true);

      if (error) throw error;

      // Create cap records for users that don't have one
      const existingCapUserIds = new Set(agentCaps.map(cap => cap.admin_user_id));
      const newUsers = adminUsers?.filter(u => !existingCapUserIds.has(u.id)) || [];

      if (newUsers.length > 0) {
        const { error: insertError } = await supabase
          .from('agent_distribution_caps')
          .insert(newUsers.map(u => ({
            admin_user_id: u.id,
            daily_cap: 20, // Default cap - admins can set to NULL for unlimited
            assigned_today: 0,
            paused: false
          })));

        if (insertError) throw insertError;
        await fetchAgentCaps();
      }
    } catch (error) {
      console.error('Error initializing agent caps:', error);
    }
  }, [agentCaps, fetchAgentCaps]);

  // Load all data
  useEffect(() => {
    const loadData = async () => {
      setLoading(true);
      await Promise.all([fetchSettings(), fetchAgentCaps(), fetchAgentPresences()]);
      setLoading(false);
    };

    loadData();

    // Set up real-time subscription for presence changes
    const presenceChannel = supabase
      .channel('presence-changes')
      .on('postgres_changes', 
        { event: '*', schema: 'public', table: 'user_presence' },
        () => fetchAgentPresences()
      )
      .subscribe();

    // Real-time sync for distribution settings (admin ↔ sales lead)
    const settingsChannel = supabase
      .channel('distribution-settings-sync')
      .on('postgres_changes',
        { event: '*', schema: 'public', table: 'lead_distribution_settings' },
        () => fetchSettings()
      )
      .subscribe();

    // Real-time sync for agent caps (admin ↔ sales lead)
    const capsChannel = supabase
      .channel('agent-caps-sync')
      .on('postgres_changes',
        { event: '*', schema: 'public', table: 'agent_distribution_caps' },
        () => fetchAgentCaps()
      )
      .subscribe();

    // Refresh caps every 30 seconds
    const refreshInterval = setInterval(() => {
      fetchAgentCaps();
      fetchAgentPresences();
    }, 30000);

    return () => {
      presenceChannel.unsubscribe();
      settingsChannel.unsubscribe();
      capsChannel.unsubscribe();
      clearInterval(refreshInterval);
    };
  }, [fetchSettings, fetchAgentCaps, fetchAgentPresences]);

  // Get presence status for an agent
  const getAgentPresenceStatus = useCallback((adminUserId: string): 'active' | 'idle' | 'offline' => {
    const presence = agentPresences.find(p => p.admin_user_id === adminUserId);
    if (!presence) return 'offline';

    const lastInteraction = presence.last_interaction_at 
      ? new Date(presence.last_interaction_at).getTime() 
      : 0;
    const now = Date.now();
    const diff = now - lastInteraction;

    if (presence.status === 'offline') return 'offline';
    if (diff > 300000) return 'offline'; // 5 minutes
    if (diff > 90000) return 'idle';     // 90 seconds
    return 'active';
  }, [agentPresences]);

  return {
    settings,
    agentCaps,
    agentPresences,
    currentAgentCap,
    loading,
    updateSettings,
    updateAgentCap,
    toggleAgentPause,
    deleteAgentFromDistribution,
    claimNextLead,
    togglePauseReceiving,
    initializeAgentCaps,
    getAgentPresenceStatus,
    refreshCaps: fetchAgentCaps,
    refreshPresences: fetchAgentPresences
  };
};
