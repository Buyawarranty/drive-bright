import { useState, useEffect, useCallback, useRef } from 'react';
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

export interface OverflowRecipient {
  id: string;
  admin_user_id: string;
  sort_order: number;
  is_active: boolean;
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
  const [overflowRecipients, setOverflowRecipients] = useState<OverflowRecipient[]>([]);
  const [loading, setLoading] = useState(true);
  const [currentAgentCap, setCurrentAgentCap] = useState<AgentCap | null>(null);
  const [todayLeadCounts, setTodayLeadCounts] = useState<Record<string, number>>({});
  const adminUserIdRef = useRef<string | null>(null);

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

  // Resolve admin user ID once and cache it
  const resolveAdminUserId = useCallback(async () => {
    if (adminUserIdRef.current) return adminUserIdRef.current;
    const { data: { session } } = await supabase.auth.getSession();
    if (!session?.user) return null;
    const { data: adminUser } = await supabase
      .from('admin_users')
      .select('id')
      .eq('user_id', session.user.id)
      .maybeSingle();
    if (adminUser) {
      adminUserIdRef.current = adminUser.id;
    }
    return adminUserIdRef.current;
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

      // Use cached admin user ID instead of calling getUser() every time
      const myAdminId = await resolveAdminUserId();
      if (myAdminId) {
        const currentCap = data?.find(cap => cap.admin_user_id === myAdminId);
        setCurrentAgentCap(currentCap || null);
      }
    } catch (error) {
      console.error('Error fetching agent caps:', error);
    }
  }, [resolveAdminUserId]);

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

  // Fetch overflow recipients
  const fetchOverflowRecipients = useCallback(async () => {
    try {
      const { data, error } = await supabase
        .from('overflow_recipients')
        .select('*')
        .order('sort_order', { ascending: true });

      if (error) throw error;
      setOverflowRecipients(data || []);
    } catch (error) {
      console.error('Error fetching overflow recipients:', error);
    }
  }, []);

  // Fetch actual lead counts for today from sales_leads table
  const fetchTodayLeadCounts = useCallback(async () => {
    try {
      const todayStart = new Date();
      todayStart.setHours(0, 0, 0, 0);
      
      const { data, error } = await supabase
        .from('sales_leads')
        .select('assigned_to')
        .not('assigned_to', 'is', null)
        .gte('created_at', todayStart.toISOString());

      if (error) throw error;
      
      const counts: Record<string, number> = {};
      (data || []).forEach((lead: any) => {
        if (lead.assigned_to) {
          counts[lead.assigned_to] = (counts[lead.assigned_to] || 0) + 1;
        }
      });
      setTodayLeadCounts(counts);
    } catch (error) {
      console.error('Error fetching today lead counts:', error);
    }
  }, []);

  // Add overflow recipient
  const addOverflowRecipient = useCallback(async (adminUserId: string) => {
    try {
      const maxOrder = overflowRecipients.length > 0
        ? Math.max(...overflowRecipients.map(r => r.sort_order)) + 1
        : 0;

      const { error } = await supabase
        .from('overflow_recipients')
        .insert({ admin_user_id: adminUserId, sort_order: maxOrder });

      if (error) throw error;
      await fetchOverflowRecipients();
      toast({ title: 'Overflow recipient added' });
      return true;
    } catch (error: any) {
      console.error('Error adding overflow recipient:', error);
      toast({ title: 'Error', description: error?.message || 'Failed to add overflow recipient.', variant: 'destructive' });
      return false;
    }
  }, [overflowRecipients, fetchOverflowRecipients]);

  // Remove overflow recipient
  const removeOverflowRecipient = useCallback(async (id: string) => {
    try {
      const { error } = await supabase
        .from('overflow_recipients')
        .delete()
        .eq('id', id);

      if (error) throw error;
      await fetchOverflowRecipients();
      toast({ title: 'Overflow recipient removed' });
      return true;
    } catch (error) {
      console.error('Error removing overflow recipient:', error);
      return false;
    }
  }, [fetchOverflowRecipients]);

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
        const { data: updatedRows, error } = await supabase
          .from('agent_distribution_caps')
          .update(updates)
          .eq('admin_user_id', adminUserId)
          .select();

        if (error) throw error;
        // RLS may silently block the update — check if rows were actually affected
        if (!updatedRows || updatedRows.length === 0) {
          throw new Error('Update blocked — you may not have permission to change distribution settings.');
        }
      } else {
        const { error } = await supabase
          .from('agent_distribution_caps')
          .insert({ admin_user_id: adminUserId, ...updates });

        if (error) throw error;
      }

      // Optimistically update local state to prevent realtime flicker
      setAgentCaps(prev => prev.map(cap => 
        cap.admin_user_id === adminUserId ? { ...cap, ...updates } : cap
      ));
      
      // Delay refetch slightly so realtime doesn't race
      setTimeout(() => fetchAgentCaps(), 500);
      return true;
    } catch (error: any) {
      console.error('Error updating agent cap:', error);
      toast({ title: 'Error', description: error?.message || 'Failed to update agent cap.', variant: 'destructive' });
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
      // Use cached admin user ID
      const myAdminId = await resolveAdminUserId();
      if (!myAdminId) throw new Error('Admin user not found');

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
          p_agent_id: myAdminId
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
      const { data: { session } } = await supabase.auth.getSession();
      if (!session?.user) return false;
      const user = session.user;

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
      // Get all sales/admin users (including inactive — they show but can be turned off)
      const { data: adminUsers, error } = await supabase
        .from('admin_users')
        .select('id')
        .in('role', ['sales', 'sales_lead']);

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

  // Load all data and auto-initialize missing agents
  useEffect(() => {
    const loadData = async () => {
      setLoading(true);
      await Promise.all([fetchSettings(), fetchAgentCaps(), fetchAgentPresences(), fetchOverflowRecipients(), fetchTodayLeadCounts()]);
      setLoading(false);
    };

    loadData();

    // Auto-initialize: after initial load, ensure all sales/sales_lead agents have cap records
    const autoInit = async () => {
      try {
        const { data: adminUsers, error } = await supabase
          .from('admin_users')
          .select('id')
          .in('role', ['sales', 'sales_lead']);

        if (error || !adminUsers) return;

        // Fetch current caps to compare
        const { data: currentCaps } = await supabase
          .from('agent_distribution_caps')
          .select('admin_user_id');

        const existingIds = new Set((currentCaps || []).map(c => c.admin_user_id));
        const newUsers = adminUsers.filter(u => !existingIds.has(u.id));

        if (newUsers.length > 0) {
          await supabase
            .from('agent_distribution_caps')
            .insert(newUsers.map(u => ({
              admin_user_id: u.id,
              daily_cap: 20,
              assigned_today: 0,
              paused: false
            })));
          // Re-fetch after auto-init
          fetchAgentCaps();
        }
      } catch (err) {
        console.error('Auto-initialize agent caps failed:', err);
      }
    };
    // Run auto-init after a short delay to avoid blocking initial render
    const initTimer = setTimeout(autoInit, 1500);

    const presenceChannel = supabase
      .channel('presence-changes')
      .on('postgres_changes', 
        { event: '*', schema: 'public', table: 'user_presence' },
        () => fetchAgentPresences()
      )
      .subscribe();

    const settingsChannel = supabase
      .channel('distribution-settings-sync')
      .on('postgres_changes',
        { event: '*', schema: 'public', table: 'lead_distribution_settings' },
        () => fetchSettings()
      )
      .subscribe();

    const capsChannel = supabase
      .channel('agent-caps-sync')
      .on('postgres_changes',
        { event: '*', schema: 'public', table: 'agent_distribution_caps' },
        () => fetchAgentCaps()
      )
      .subscribe();

    const overflowChannel = supabase
      .channel('overflow-recipients-sync')
      .on('postgres_changes',
        { event: '*', schema: 'public', table: 'overflow_recipients' },
        () => fetchOverflowRecipients()
      )
      .subscribe();

    const refreshInterval = setInterval(() => {
      fetchAgentCaps();
      fetchAgentPresences();
      fetchTodayLeadCounts();
    }, 60000);

    return () => {
      presenceChannel.unsubscribe();
      settingsChannel.unsubscribe();
      capsChannel.unsubscribe();
      overflowChannel.unsubscribe();
      clearInterval(refreshInterval);
      clearTimeout(initTimer);
    };
  }, [fetchSettings, fetchAgentCaps, fetchAgentPresences, fetchOverflowRecipients, fetchTodayLeadCounts]);

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

  // Add a specific agent to distribution by admin_user_id
  const addAgentToDistribution = useCallback(async (adminUserId: string) => {
    try {
      // Check if already exists
      const existing = agentCaps.find(cap => cap.admin_user_id === adminUserId);
      if (existing) {
        toast({ title: 'Already added', description: 'This agent is already in distribution.' });
        return true;
      }

      const { error } = await supabase
        .from('agent_distribution_caps')
        .insert({
          admin_user_id: adminUserId,
          daily_cap: 20,
          assigned_today: 0,
          paused: false
        });

      if (error) throw error;
      await fetchAgentCaps();
      toast({ title: 'Agent added', description: 'Agent has been added to lead distribution.' });
      return true;
    } catch (error: any) {
      console.error('Error adding agent to distribution:', error);
      toast({ title: 'Error', description: error?.message || 'Failed to add agent.', variant: 'destructive' });
      return false;
    }
  }, [agentCaps, fetchAgentCaps]);

  return {
    settings,
    agentCaps,
    agentPresences,
    overflowRecipients,
    currentAgentCap,
    todayLeadCounts,
    loading,
    updateSettings,
    updateAgentCap,
    toggleAgentPause,
    deleteAgentFromDistribution,
    claimNextLead,
    togglePauseReceiving,
    initializeAgentCaps,
    getAgentPresenceStatus,
    addOverflowRecipient,
    removeOverflowRecipient,
    addAgentToDistribution,
    refreshCaps: fetchAgentCaps,
    refreshPresences: fetchAgentPresences,
    refreshTodayLeadCounts: fetchTodayLeadCounts
  };
};
