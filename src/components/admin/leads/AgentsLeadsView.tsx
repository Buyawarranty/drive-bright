import React, { useState, useMemo, useCallback, useEffect } from 'react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Switch } from '@/components/ui/switch';
import { Slider } from '@/components/ui/slider';
import { Label } from '@/components/ui/label';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Collapsible, CollapsibleContent, CollapsibleTrigger } from '@/components/ui/collapsible';
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent, AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle, AlertDialogTrigger } from '@/components/ui/alert-dialog';
import { Tooltip, TooltipContent, TooltipTrigger } from '@/components/ui/tooltip';
import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover';
import { Calendar as CalendarComponent } from '@/components/ui/calendar';
import { Lead, AdminUser } from '@/hooks/useLeads';
import { useLeadDistribution } from '@/hooks/useLeadDistribution';
import { useAdminConfig } from '@/hooks/useAdminConfig';
import { PresenceBadge } from './distribution/PresenceBadge';
import { supabase } from '@/integrations/supabase/client';
import { 
  Users, ChevronDown, ChevronRight, Phone, Mail, Car, 
  Calendar, UserCircle, Hourglass, Info, Trash2, Save, Zap, UserPlus,
  RotateCcw, Percent, ArrowRight, AlertCircle, CalendarIcon, X, ShieldCheck, UserCheck, Eye, EyeOff, Check, Network
} from 'lucide-react';
import { format, formatDistanceToNow, startOfWeek, startOfMonth, startOfYear, endOfDay, isWithinInterval, subWeeks, subMonths, endOfWeek, endOfMonth } from 'date-fns';
import { toast } from '@/hooks/use-toast';
import { DateRange } from 'react-day-picker';
import { TeamBadge } from './TeamBadge';

interface AgentsLeadsViewProps {
  leads: Lead[];
  salesUsers: AdminUser[];
  viewerRole?: string | null;
}

interface AgentLeadGroup {
  agent: AdminUser | null;
  agentId: string | null;
  agentName: string;
  leads: Lead[];
  newCount: number;
  contactedCount: number;
  convertedCount: number;
  lostCount: number;
}

const getStatusBadgeVariant = (status: string) => {
  switch (status) {
    case 'new': return 'bg-green-100 text-green-800';
    case 'contacted': return 'bg-yellow-100 text-yellow-800';
    case 'follow_up': return 'bg-purple-100 text-purple-800';
    case 'qualified': return 'bg-cyan-100 text-cyan-800';
    case 'negotiating': return 'bg-orange-100 text-orange-800';
    case 'converted': return 'bg-teal-100 text-teal-800';
    case 'lost': return 'bg-red-100 text-red-800';
    case 'fake_lead': return 'bg-gray-100 text-gray-800';
    default: return 'bg-gray-100 text-gray-800';
  }
};

type DistributionMode = 'round_robin' | 'percentage';

// Module-level cache so team tabs load instantly on re-mount / tab switches
const _teamCache: {
  teams: Array<{ id: string; name: string; color: string; emoji: string | null }>;
  members: Array<{ admin_user_id: string; team_id: string }>;
  promise: Promise<any> | null;
} = { teams: [], members: [], promise: null };

export const AgentsLeadsView: React.FC<AgentsLeadsViewProps> = ({
  leads,
  salesUsers,
  viewerRole,
}) => {
  // Admin has ultimate control — only admin can delete agents and change distribution mode
  const isFullAdmin = viewerRole === 'admin' || viewerRole === 'global_admin' || viewerRole === 'super_admin';
  const isSalesLead = viewerRole === 'sales_lead';
  
  // Check if sales leads have distribution access (admin-controlled toggle)
  const { value: salesLeadDistributionAccess, loading: configLoading, updateConfig: updateDistributionAccess } = useAdminConfig('sales_lead_distribution_access');
  
  // Admin-controlled toggle: whether sales agents can see the "Assigned To" column
  const { value: showAssignmentsToAgents, updateConfig: updateShowAssignments } = useAdminConfig('show_assignments_to_agents');
  
  // Admin-controlled toggle: whether sales agents can self-assign (claim) leads
  const { value: allowAgentSelfAssign, updateConfig: updateAllowSelfAssign } = useAdminConfig('allow_agent_self_assign');
  
  // Admin-controlled toggle: force all agents to only see their own leads
  const { value: agentsOwnLeadsOnly, updateConfig: updateAgentsOwnLeadsOnly } = useAdminConfig('agents_own_leads_only');
  
  // Sales leads can see distribution settings only if admin has granted access
  // Default to true if config not set (backwards compatible)
  const canSeeDistributionSettings = isFullAdmin || (isSalesLead && salesLeadDistributionAccess !== false);
  
  const [selectedAgent, setSelectedAgent] = useState<string>('all');
  const [expandedAgents, setExpandedAgents] = useState<Set<string>>(new Set(['awaiting_contact']));
  const [editedCaps, setEditedCaps] = useState<Record<string, number>>({});
  const [editedPercentages, setEditedPercentages] = useState<Record<string, number>>({});
  const [saving, setSaving] = useState<string | null>(null);
  const [deleting, setDeleting] = useState<string | null>(null);
  
  // Show all leads state per group
  const [showAllLeads, setShowAllLeads] = useState<Set<string>>(new Set());
  
  // Track per-agent visibility overrides locally for immediate UI updates
  const [agentVisibilityOverrides, setAgentVisibilityOverrides] = useState<Record<string, boolean>>({});
  
  // Date filter state
  const [dateRange, setDateRange] = useState<DateRange | undefined>(undefined);
  const [quickDateFilter, setQuickDateFilter] = useState<string>('all');
  const [isCalendarOpen, setIsCalendarOpen] = useState(false);
  const [savingMode, setSavingMode] = useState(false);
  
  // Reassignment dialog state
  const [reassignDialogOpen, setReassignDialogOpen] = useState(false);
  const [agentToDelete, setAgentToDelete] = useState<{ id: string; name: string; leadCount: number } | null>(null);
  const [reassignTargetAgent, setReassignTargetAgent] = useState<string>('');

  // Bulk reassign dialog state (for absent agents)
  const [bulkReassignOpen, setBulkReassignOpen] = useState(false);
  const [bulkSourceAgent, setBulkSourceAgent] = useState<string>('');
  const [bulkTargetAgents, setBulkTargetAgents] = useState<string[]>([]);
  const [bulkDateRange, setBulkDateRange] = useState<DateRange | undefined>(undefined);
  const [bulkReassigning, setBulkReassigning] = useState(false);
  const [bulkCalendarOpen, setBulkCalendarOpen] = useState(false);

  // Team filter tabs (split distribution view per team for managers)
  const [teams, setTeams] = useState<Array<{ id: string; name: string; color: string; emoji: string | null }>>(() => _teamCache.teams);
  const [teamMembers, setTeamMembers] = useState<Array<{ admin_user_id: string; team_id: string }>>(() => _teamCache.members);
  const [activeTeamTab, setActiveTeamTab] = useState<string>('all'); // 'all' | team.id | 'unassigned'

  useEffect(() => {
    // Always refetch on mount so team-membership changes (e.g. an agent moved
    // from Red to Blue) propagate immediately. The previous module-level cache
    // pinned a stale snapshot until full page reload, which caused agents to
    // appear under their old team's flow.
    let cancelled = false;
    Promise.all([
      supabase.from('lead_teams').select('id, name, color, emoji').order('sort_order'),
      supabase.from('lead_team_members').select('admin_user_id, team_id'),
    ]).then(([teamsRes, membersRes]) => {
      if (cancelled) return;
      const t = (teamsRes.data as any) || [];
      const m = (membersRes.data as any) || [];
      _teamCache.teams = t;
      _teamCache.members = m;
      setTeams(t);
      setTeamMembers(m);
    });
    return () => { cancelled = true; };
  }, []);


  // Full unscoped roster used ONLY for resolving agent names in the caps table.
  // The `salesUsers` prop may be team-scoped by the parent, which would cause
  // agents on other teams (or whose team membership is loading) to render as "Unknown"
  // even though their cap row exists. This fallback prevents that.
  const [allAgentsForLookup, setAllAgentsForLookup] = useState<AdminUser[]>([]);
  useEffect(() => {
    let cancelled = false;
    (async () => {
      const { data, error } = await supabase
        .from('admin_users')
        .select('id, user_id, first_name, last_name, email, is_active, role')
        .in('role', ['sales', 'sales_lead', 'admin', 'super_admin', 'sales_manager']);
      if (!cancelled && !error && data) setAllAgentsForLookup(data as AdminUser[]);
    })();
    return () => { cancelled = true; };
  }, []);

  const agentLookup = useMemo(() => {
    const map = new Map<string, AdminUser>();
    allAgentsForLookup.forEach(u => map.set(u.id, u));
    // Prefer the prop's copy when present (it may be fresher / scoped)
    salesUsers.forEach(u => map.set(u.id, u));
    return map;
  }, [allAgentsForLookup, salesUsers]);


  const memberTeamMap = useMemo(() => {
    const m = new Map<string, string>();
    teamMembers.forEach(tm => m.set(tm.admin_user_id, tm.team_id));
    return m;
  }, [teamMembers]);


  // Lead distribution hook for agent caps
  const {
    settings,
    agentCaps,
    agentPresences,
    overflowRecipients,
    todayLeadCounts,
    updateAgentCap,
    updateSettings,
    toggleAgentPause,
    deleteAgentFromDistribution,
    getAgentPresenceStatus,
    initializeAgentCaps,
    addOverflowRecipient,
    removeOverflowRecipient,
    addAgentToDistribution,
    loading
  } = useLeadDistribution();

  // Add agent search state
  const [addAgentSearch, setAddAgentSearch] = useState('');
  const [addAgentResults, setAddAgentResults] = useState<Array<{id: string; first_name: string | null; last_name: string | null; email: string; role: string}>>([]);
  const [addAgentLoading, setAddAgentLoading] = useState(false);
  const [showAddAgent, setShowAddAgent] = useState(false);

  // Search for admin users to add to distribution
  const handleAgentSearch = useCallback(async (query: string) => {
    setAddAgentSearch(query);
    if (query.length < 2) {
      setAddAgentResults([]);
      return;
    }
    setAddAgentLoading(true);
    try {
      const { data, error } = await supabase
        .from('admin_users')
        .select('id, first_name, last_name, email, role')
        .or(`email.ilike.%${query}%,first_name.ilike.%${query}%,last_name.ilike.%${query}%`)
        .limit(10);
      
      if (error) throw error;
      const existingIds = new Set(agentCaps.map(c => c.admin_user_id));
      setAddAgentResults((data || []).filter(u => !existingIds.has(u.id)));
    } catch (err) {
      console.error('Agent search failed:', err);
    } finally {
      setAddAgentLoading(false);
    }
  }, [agentCaps]);

  const handleAddAgent = useCallback(async (adminUserId: string) => {
    const success = await addAgentToDistribution(adminUserId);
    if (success) {
      setAddAgentSearch('');
      setAddAgentResults([]);
      setShowAddAgent(false);
    }
  }, [addAgentToDistribution]);

  // Get distribution mode from settings (persisted in DB)
  const distributionMode = (settings?.distribution_mode as DistributionMode) || 'round_robin';
  
  // Track local mode changes before save
  const [pendingMode, setPendingMode] = useState<DistributionMode | null>(null);
  const displayMode = pendingMode ?? distributionMode;
  const hasPendingModeChange = pendingMode !== null && pendingMode !== distributionMode;

  // Handle distribution mode change
  const handleModeChange = (mode: DistributionMode) => {
    if (mode !== distributionMode) {
      setPendingMode(mode);
    } else {
      setPendingMode(null);
    }
  };

  // Save distribution mode to database
  const handleSaveMode = async () => {
    if (!pendingMode || pendingMode === distributionMode) return;
    
    setSavingMode(true);
    const success = await updateSettings({ distribution_mode: pendingMode });
    if (success) {
      setPendingMode(null);
    }
    setSavingMode(false);
  };

  // Get presence for agent
  const getPresence = (adminUserId: string) => {
    return agentPresences.find(p => p.admin_user_id === adminUserId);
  };

  // Get activity description
  const getActivityDescription = (adminUserId: string) => {
    const presence = getPresence(adminUserId);
    const status = getAgentPresenceStatus(adminUserId);
    
    if (!presence?.last_interaction_at) {
      return 'No recent activity';
    }
    
    const lastInteraction = new Date(presence.last_interaction_at);
    const timeAgo = formatDistanceToNow(lastInteraction, { addSuffix: true });
    
    if (status === 'active') {
      return `Active ${timeAgo}`;
    } else if (status === 'idle') {
      return `Idle - ${timeAgo}`;
    }
    return `Offline - ${timeAgo}`;
  };

  // Handle cap change
  const handleCapChange = (adminUserId: string, value: string) => {
    if (value === '' || value.trim() === '') {
      setEditedCaps(prev => ({ ...prev, [adminUserId]: null as any }));
      return;
    }
    const numValue = parseInt(value, 10);
    if (!isNaN(numValue) && numValue >= 0) {
      setEditedCaps(prev => ({ ...prev, [adminUserId]: numValue }));
    }
  };

  // Auto-save debounce refs
  const autoSaveTimers = React.useRef<Record<string, ReturnType<typeof setTimeout>>>({});

  // Handle percentage change - allow free typing, auto-save after debounce
  const handlePercentageChange = (adminUserId: string, value: number) => {
    const clampedValue = Math.max(0, Math.min(100, value));
    setEditedPercentages(prev => ({ ...prev, [adminUserId]: clampedValue }));

    // Clear previous auto-save timer
    if (autoSaveTimers.current[adminUserId]) {
      clearTimeout(autoSaveTimers.current[adminUserId]);
    }

    // Auto-save after 800ms of inactivity
    autoSaveTimers.current[adminUserId] = setTimeout(() => {
      autoSavePercentage(adminUserId, clampedValue);
    }, 800);
  };

  // Auto-save a percentage value
  const autoSavePercentage = async (adminUserId: string, value: number) => {
    // Calculate what total would be
    const otherActiveTotal = agentCaps.reduce((sum, cap) => {
      if (cap.paused || cap.admin_user_id === adminUserId) return sum;
      const val = editedPercentages[cap.admin_user_id] ?? cap.percentage ?? 0;
      return sum + val;
    }, 0);
    const newTotal = otherActiveTotal + value;

    if (newTotal > 100) {
      toast({
        title: 'Cannot save — exceeds 100%',
        description: `Total would be ${newTotal}%. Reduce by ${newTotal - 100}% to save.`,
        variant: 'destructive'
      });
      return;
    }

    setSaving(adminUserId);
    const success = await updateAgentCap(adminUserId, { percentage: value });
    if (success) {
      setEditedPercentages(prev => {
        const { [adminUserId]: _, ...rest } = prev;
        return rest;
      });
      toast({ title: 'Saved', description: `${value}% allocation saved.` });
    }
    setSaving(null);
  };

  // Handle save cap
  const handleSaveCap = async (adminUserId: string) => {
    const newCap = editedCaps[adminUserId];
    if (newCap === undefined) {
      toast({ title: 'No changes', description: 'Edit the cap value first.' });
      return;
    }

    setSaving(adminUserId);
    const success = await updateAgentCap(adminUserId, { daily_cap: newCap });
    if (success) {
      setEditedCaps(prev => {
        const { [adminUserId]: _, ...rest } = prev;
        return rest;
      });
      toast({
        title: 'Daily cap updated',
        description: `New limit: ${newCap === null ? 'Unlimited' : newCap} leads/day.`,
      });
    }
    setSaving(null);
  };

  // Compute total percentage across active (non-paused) agents only
  const totalPercentage = useMemo(() => {
    return agentCaps.reduce((sum, cap) => {
      // Only count agents that are ON (not paused)
      if (cap.paused) return sum;
      const value = editedPercentages[cap.admin_user_id] ?? cap.percentage ?? 0;
      return sum + value;
    }, 0);
  }, [agentCaps, editedPercentages]);


  // Cleanup auto-save timers on unmount
  React.useEffect(() => {
    return () => {
      Object.values(autoSaveTimers.current).forEach(clearTimeout);
    };
  }, []);

  // Handle toggle pause
  const handleTogglePause = async (adminUserId: string) => {
    setSaving(adminUserId);
    await toggleAgentPause(adminUserId);
    setSaving(null);
  };

  // Open reassignment dialog before deleting
  const openReassignDialog = (adminUserId: string) => {
    const agent = salesUsers.find(u => u.id === adminUserId);
    const agentLeadCount = leads.filter(l => l.assigned_to === adminUserId).length;
    
    setAgentToDelete({
      id: adminUserId,
      name: getAgentName(agent),
      leadCount: agentLeadCount
    });
    setReassignTargetAgent('');
    setReassignDialogOpen(true);
  };

  // Handle delete agent with optional reassignment
  const handleDeleteAgent = async () => {
    if (!agentToDelete) return;
    
    setDeleting(agentToDelete.id);
    
    try {
      // If reassignment target is selected, reassign leads first
      if (reassignTargetAgent && agentToDelete.leadCount > 0) {
        const { error: reassignError } = await supabase
          .from('sales_leads')
          .update({ assigned_to: reassignTargetAgent })
          .eq('assigned_to', agentToDelete.id);
        
        if (reassignError) throw reassignError;
        
        const targetAgent = salesUsers.find(u => u.id === reassignTargetAgent);
        toast({
          title: 'Leads reassigned',
          description: `${agentToDelete.leadCount} leads reassigned to ${getAgentName(targetAgent)}.`
        });
      }
      
      // Now delete from distribution
      await deleteAgentFromDistribution(agentToDelete.id);
      
      setReassignDialogOpen(false);
      setAgentToDelete(null);
    } catch (error) {
      console.error('Error during agent deletion/reassignment:', error);
      toast({
        title: 'Error',
        description: 'Failed to complete the operation.',
        variant: 'destructive'
      });
    } finally {
      setDeleting(null);
    }
  };

  // Get agent name
  const getAgentName = (agent: AdminUser | undefined | null) => {
    if (!agent) return 'Unknown';
    if (agent.first_name) {
      return `${agent.first_name} ${agent.last_name || ''}`.trim();
    }
    return agent.email;
  };

  // Bulk reassign leads from one agent to another
  const bulkSourceLeadCount = useMemo(() => {
    if (!bulkSourceAgent) return 0;
    // If a partial range is selected (only 'from'), don't preview a count —
    // the user must pick both ends so we never accidentally over-select.
    if (bulkDateRange?.from && !bulkDateRange?.to) return 0;
    let sourceLeads = leads.filter(l => l.assigned_to === bulkSourceAgent);
    if (bulkDateRange?.from && bulkDateRange?.to) {
      sourceLeads = sourceLeads.filter(lead => {
        const leadDate = new Date(lead.created_at);
        return isWithinInterval(leadDate, { start: bulkDateRange.from!, end: endOfDay(bulkDateRange.to!) });
      });
    }
    return sourceLeads.length;
  }, [bulkSourceAgent, leads, bulkDateRange]);

  const handleBulkReassign = async () => {
    if (!bulkSourceAgent || bulkTargetAgents.length === 0) return;

    // SAFETY: if a partial date range is selected (only 'from' picked), force the
    // user to also pick a 'to' date — otherwise the query unbounds the upper end
    // and sweeps every lead from that date forward (this caused the previous
    // accidental mass reassignment).
    if (bulkDateRange?.from && !bulkDateRange?.to) {
      toast({
        title: 'Pick an end date',
        description: 'Please select both a start and end date, or clear the date filter.',
        variant: 'destructive',
      });
      return;
    }

    setBulkReassigning(true);
    try {
      // Normalize date boundaries to local-day start/end so timezone shifts can't
      // expand the window (avoid raw new Date(dateStr).toISOString() drift).
      const fromIso = bulkDateRange?.from
        ? new Date(
            bulkDateRange.from.getFullYear(),
            bulkDateRange.from.getMonth(),
            bulkDateRange.from.getDate(),
            0, 0, 0, 0,
          ).toISOString()
        : null;
      const toIso = bulkDateRange?.to
        ? endOfDay(bulkDateRange.to).toISOString()
        : null;

      // First, get the actual lead IDs to reassign (so we can distribute equally).
      // Page through results to bypass Supabase's default 1000-row select cap —
      // otherwise the count preview and the actual update can disagree.
      const PAGE = 1000;
      const collected: { id: string }[] = [];
      let offset = 0;
      // Hard ceiling to prevent runaway loops if something is misconfigured
      const HARD_LIMIT = 50000;
      while (offset < HARD_LIMIT) {
        let pageQuery = supabase
          .from('sales_leads')
          .select('id')
          .eq('assigned_to', bulkSourceAgent)
          .order('created_at', { ascending: false })
          .range(offset, offset + PAGE - 1);
        if (fromIso) pageQuery = pageQuery.gte('created_at', fromIso);
        if (toIso) pageQuery = pageQuery.lte('created_at', toIso);
        const { data: pageData, error: pageError } = await pageQuery;
        if (pageError) throw pageError;
        const rows = pageData || [];
        collected.push(...rows);
        if (rows.length < PAGE) break;
        offset += PAGE;
      }
      const leadsToReassign = collected;
      if (!leadsToReassign || leadsToReassign.length === 0) {
        toast({ title: 'No leads', description: 'No leads found matching the criteria.', variant: 'destructive' });
        return;
      }

      // Distribute leads equally (round-robin) across target agents
      const now = new Date().toISOString();
      const updatePromises = leadsToReassign.map((lead, index) => {
        const targetAgent = bulkTargetAgents[index % bulkTargetAgents.length];
        return supabase
          .from('sales_leads')
          .update({ assigned_to: targetAgent, updated_at: now })
          .eq('id', lead.id);
      });

      const results = await Promise.all(updatePromises);
      const errors = results.filter(r => r.error);
      if (errors.length > 0) throw errors[0].error;

      const sourceAgent = salesUsers.find(u => u.id === bulkSourceAgent);
      const targetNames = bulkTargetAgents
        .map(id => getAgentName(salesUsers.find(u => u.id === id)))
        .join(', ');
      
      // Calculate per-agent counts
      const perAgent = Math.floor(leadsToReassign.length / bulkTargetAgents.length);
      const remainder = leadsToReassign.length % bulkTargetAgents.length;
      const distribution = bulkTargetAgents.length === 1
        ? `${leadsToReassign.length} leads`
        : `~${perAgent}${remainder > 0 ? `–${perAgent + 1}` : ''} leads each`;
      
      toast({
        title: 'Leads reassigned',
        description: `${leadsToReassign.length} leads from ${getAgentName(sourceAgent)} reassigned to ${targetNames} (${distribution}).`,
      });

      setBulkReassignOpen(false);
      setBulkSourceAgent('');
      setBulkTargetAgents([]);
      setBulkDateRange(undefined);
    } catch (error) {
      console.error('Bulk reassign error:', error);
      toast({
        title: 'Error',
        description: 'Failed to reassign leads. Please try again.',
        variant: 'destructive',
      });
    } finally {
      setBulkReassigning(false);
    }
  };

  // Find unconfigured agents
  const configuredAgentIds = new Set(agentCaps.map(c => c.admin_user_id));
  const unconfiguredAgents = salesUsers.filter(u => !configuredAgentIds.has(u.id));

  // Group leads by agent
  const agentGroups = useMemo((): AgentLeadGroup[] => {
    const groupMap = new Map<string | null, Lead[]>();
    
    // Initialize with all agents (even those with no leads)
    salesUsers.forEach(user => {
      groupMap.set(user.id, []);
    });
    groupMap.set(null, []); // Awaiting Contact (previously unassigned)
    
    // Group leads
    leads.forEach(lead => {
      const agentId = lead.assigned_to || null;
      if (!groupMap.has(agentId)) {
        groupMap.set(agentId, []);
      }
      groupMap.get(agentId)!.push(lead);
    });

    // Convert to array with agent info
    const groups: AgentLeadGroup[] = [];
    
    // Awaiting Contact first (previously unassigned)
    // Exclude already-converted/paid, lost and fake leads — no one needs to "contact" them.
    const awaitingContactLeads = (groupMap.get(null) || []).filter(l =>
      l.status !== 'converted' &&
      l.status !== 'lost' &&
      l.status !== 'fake_lead' &&
      !l.is_paid
    );
    groups.push({
      agent: null,
      agentId: null,
      agentName: 'Awaiting Contact',
      leads: awaitingContactLeads,
      newCount: awaitingContactLeads.filter(l => l.status === 'new').length,
      contactedCount: awaitingContactLeads.filter(l => l.status === 'contacted').length,
      convertedCount: 0,
      lostCount: 0,
    });

    // Then agents sorted by lead count
    salesUsers.forEach(user => {
      const agentLeads = groupMap.get(user.id) || [];
      groups.push({
        agent: user,
        agentId: user.id,
        agentName: `${user.first_name || ''} ${user.last_name || ''}`.trim() || user.email,
        leads: agentLeads,
        newCount: agentLeads.filter(l => l.status === 'new').length,
        contactedCount: agentLeads.filter(l => l.status === 'contacted').length,
        convertedCount: agentLeads.filter(l => l.status === 'converted' || l.is_paid).length,
        lostCount: agentLeads.filter(l => l.status === 'lost').length,
      });
    });

    // Sort by total leads (descending), but keep awaiting contact first
    groups.sort((a, b) => {
      if (a.agentId === null) return -1;
      if (b.agentId === null) return 1;
      return b.leads.length - a.leads.length;
    });

    return groups;
  }, [leads, salesUsers]);

  // Handle quick date filter selection
  const handleQuickDateFilter = (filter: string) => {
    setQuickDateFilter(filter);
    const now = new Date();
    
    switch (filter) {
      case 'today':
        setDateRange({ from: new Date(now.getFullYear(), now.getMonth(), now.getDate()), to: endOfDay(now) });
        break;
      case 'yesterday': {
        const yesterday = new Date(now);
        yesterday.setDate(yesterday.getDate() - 1);
        setDateRange({ from: new Date(yesterday.getFullYear(), yesterday.getMonth(), yesterday.getDate()), to: endOfDay(yesterday) });
        break;
      }
      case 'week':
        setDateRange({ from: startOfWeek(now, { weekStartsOn: 1 }), to: endOfDay(now) });
        break;
      case 'month':
        setDateRange({ from: startOfMonth(now), to: endOfDay(now) });
        break;
      case 'year':
        setDateRange({ from: startOfYear(now), to: endOfDay(now) });
        break;
      case 'all':
      default:
        setDateRange(undefined);
        break;
    }
    setIsCalendarOpen(false);
  };

  const clearDateFilter = () => {
    setDateRange(undefined);
    setQuickDateFilter('all');
  };

  // Filter leads by date
  const filterLeadsByDate = (leadsToFilter: Lead[]) => {
    if (!dateRange?.from) return leadsToFilter;
    
    return leadsToFilter.filter(lead => {
      const leadDate = new Date(lead.created_at);
      const from = dateRange.from!;
      const to = dateRange.to || endOfDay(new Date());
      return isWithinInterval(leadDate, { start: from, end: to });
    });
  };

  // Filter by selected agent
  const filteredGroups = useMemo(() => {
    let groups = agentGroups;
    
    // Filter by agent
    if (selectedAgent === 'awaiting_contact') {
      groups = groups.filter(g => g.agentId === null);
    } else if (selectedAgent !== 'all') {
      groups = groups.filter(g => g.agentId === selectedAgent);
    }
    
    // Apply date filter to each group's leads
    if (dateRange?.from) {
      groups = groups.map(group => {
        const filteredLeads = filterLeadsByDate(group.leads);
        return {
          ...group,
          leads: filteredLeads,
          newCount: filteredLeads.filter(l => l.status === 'new').length,
          contactedCount: filteredLeads.filter(l => l.status === 'contacted').length,
          convertedCount: filteredLeads.filter(l => l.status === 'converted' || l.is_paid).length,
          lostCount: filteredLeads.filter(l => l.status === 'lost').length,
        };
      });
    }
    
    return groups;
  }, [agentGroups, selectedAgent, dateRange]);

  const toggleExpand = (agentId: string | null) => {
    const key = agentId || 'awaiting_contact';
    setExpandedAgents(prev => {
      const newSet = new Set(prev);
      if (newSet.has(key)) {
        newSet.delete(key);
      } else {
        newSet.add(key);
      }
      return newSet;
    });
  };

  const expandAll = () => {
    setExpandedAgents(new Set(['awaiting_contact', ...salesUsers.map(u => u.id)]));
  };

  const collapseAll = () => {
    setExpandedAgents(new Set());
  };

  // Summary stats
  const totalStats = useMemo(() => {
    const activeAgents = agentCaps.filter(cap => {
      const status = getAgentPresenceStatus(cap.admin_user_id);
      return status === 'active' && !cap.paused;
    }).length;

    // Calculate assigned but uncontacted leads (leads assigned to an agent but still in 'new' status)
    const assignedUncontactedLeads = leads.filter(l => l.assigned_to && l.status === 'new');

    return {
      totalLeads: leads.length,
      awaitingContact: leads.filter(l => !l.assigned_to).length,
      assigned: leads.filter(l => l.assigned_to).length,
      assignedUncontacted: assignedUncontactedLeads.length,
      agentsWithLeads: agentGroups.filter(g => g.agentId && g.leads.length > 0).length,
      totalAgents: salesUsers.length,
      activeAgents,
    };
  }, [leads, agentGroups, salesUsers, agentCaps, getAgentPresenceStatus]);

  // Calculate uncontacted leads per agent (assigned but status is still 'new')
  const uncontactedByAgent = useMemo(() => {
    const result: Array<{
      agentId: string;
      agentName: string;
      agentEmail: string;
      uncontactedCount: number;
      oldestUncontacted: Date | null;
      leads: Lead[];
    }> = [];

    salesUsers.forEach(user => {
      const agentLeads = leads.filter(
        l => l.assigned_to === user.id && l.status === 'new'
      );
      
      if (agentLeads.length > 0) {
        const oldestDate = agentLeads.reduce((oldest, lead) => {
          const leadDate = new Date(lead.created_at);
          return !oldest || leadDate < oldest ? leadDate : oldest;
        }, null as Date | null);

        result.push({
          agentId: user.id,
          agentName: getAgentName(user),
          agentEmail: user.email,
          uncontactedCount: agentLeads.length,
          oldestUncontacted: oldestDate,
          leads: agentLeads.sort((a, b) => 
            new Date(a.created_at).getTime() - new Date(b.created_at).getTime()
          ),
        });
      }
    });

    // Sort by uncontacted count (highest first)
    return result.sort((a, b) => b.uncontactedCount - a.uncontactedCount);
  }, [leads, salesUsers]);

  // Expand/collapse state for uncontacted leads per agent
  const [expandedUncontacted, setExpandedUncontacted] = useState<Set<string>>(new Set());
  
  // Date filter state for "Not Picked Up" section
  const [uncontactedDateFilter, setUncontactedDateFilter] = useState<string>('all');
  
  // Get date range for uncontacted filter
  const getUncontactedDateRange = (filter: string): { from: Date; to: Date } | null => {
    const now = new Date();
    switch (filter) {
      case 'this_week':
        return { from: startOfWeek(now, { weekStartsOn: 1 }), to: endOfDay(now) };
      case 'last_week':
        const lastWeekStart = startOfWeek(subWeeks(now, 1), { weekStartsOn: 1 });
        const lastWeekEnd = endOfWeek(subWeeks(now, 1), { weekStartsOn: 1 });
        return { from: lastWeekStart, to: lastWeekEnd };
      case 'this_month':
        return { from: startOfMonth(now), to: endOfDay(now) };
      case 'last_month':
        const lastMonthStart = startOfMonth(subMonths(now, 1));
        const lastMonthEnd = endOfMonth(subMonths(now, 1));
        return { from: lastMonthStart, to: lastMonthEnd };
      case 'this_year':
        return { from: startOfYear(now), to: endOfDay(now) };
      default:
        return null;
    }
  };
  
  // Filtered uncontacted leads by date
  const filteredUncontactedByAgent = useMemo(() => {
    const dateRange = getUncontactedDateRange(uncontactedDateFilter);
    
    return uncontactedByAgent.map(agent => {
      if (!dateRange) return agent;
      
      const filteredLeads = agent.leads.filter(lead => {
        const leadDate = new Date(lead.created_at);
        return isWithinInterval(leadDate, { start: dateRange.from, end: dateRange.to });
      });
      
      const oldestDate = filteredLeads.reduce((oldest, lead) => {
        const leadDate = new Date(lead.created_at);
        return !oldest || leadDate < oldest ? leadDate : oldest;
      }, null as Date | null);
      
      return {
        ...agent,
        uncontactedCount: filteredLeads.length,
        oldestUncontacted: oldestDate,
        leads: filteredLeads,
      };
    }).filter(agent => agent.uncontactedCount > 0);
  }, [uncontactedByAgent, uncontactedDateFilter]);
  
  // Total filtered uncontacted count
  const filteredUncontactedTotal = useMemo(() => {
    return filteredUncontactedByAgent.reduce((sum, agent) => sum + agent.uncontactedCount, 0);
  }, [filteredUncontactedByAgent]);

  return (
    <div className="space-y-6">
      {/* Reassignment Dialog */}
      <Dialog open={reassignDialogOpen} onOpenChange={setReassignDialogOpen}>
        <DialogContent className="sm:max-w-[425px]">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <Trash2 className="h-5 w-5 text-red-600" />
              Remove Agent from Distribution
            </DialogTitle>
            <DialogDescription>
              {agentToDelete && (
                <>
                  You are removing <strong>{agentToDelete.name}</strong> from lead distribution.
                  {agentToDelete.leadCount > 0 && (
                    <span className="block mt-2 text-amber-600 font-medium">
                      This agent has {agentToDelete.leadCount} leads assigned. You can reassign them to another agent.
                    </span>
                  )}
                </>
              )}
            </DialogDescription>
          </DialogHeader>
          
          {agentToDelete && agentToDelete.leadCount > 0 && (
            <div className="space-y-3 py-4">
              <Label htmlFor="reassign-target" className="text-sm font-medium">
                Reassign {agentToDelete.leadCount} leads to:
              </Label>
              <Select value={reassignTargetAgent} onValueChange={setReassignTargetAgent}>
                <SelectTrigger id="reassign-target">
                  <SelectValue placeholder="Select agent (optional)" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="">
                    <span className="text-muted-foreground">Don't reassign (leads become awaiting contact)</span>
                  </SelectItem>
                  {salesUsers
                    .filter(u => u.id !== agentToDelete.id)
                    .map(user => (
                      <SelectItem key={user.id} value={user.id}>
                        <div className="flex items-center gap-2">
                          <div className="h-5 w-5 rounded-full bg-primary/10 flex items-center justify-center text-[10px] font-medium">
                            {user.first_name?.[0]?.toUpperCase() || user.email[0].toUpperCase()}
                          </div>
                          {getAgentName(user)}
                        </div>
                      </SelectItem>
                    ))
                  }
                </SelectContent>
              </Select>
              
              {reassignTargetAgent && (
                <div className="flex items-center gap-2 text-sm text-green-600 bg-green-50 p-2 rounded">
                  <ArrowRight className="h-4 w-4" />
                  {agentToDelete.leadCount} leads will be reassigned to {getAgentName(salesUsers.find(u => u.id === reassignTargetAgent))}
                </div>
              )}
            </div>
          )}
          
          <DialogFooter className="gap-2">
            <Button variant="outline" onClick={() => setReassignDialogOpen(false)}>
              Cancel
            </Button>
            <Button 
              variant="destructive" 
              onClick={handleDeleteAgent}
              disabled={deleting !== null}
            >
              {deleting ? 'Processing...' : 'Remove Agent'}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Bulk Reassign Dialog */}
      <Dialog open={bulkReassignOpen} onOpenChange={setBulkReassignOpen}>
        <DialogContent className="sm:max-w-[480px]">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <ArrowRight className="h-5 w-5 text-primary" />
              Reassign Agent's Leads
            </DialogTitle>
            <DialogDescription>
              Transfer leads from one agent to one or more covering agents. Leads are distributed equally using round-robin.
            </DialogDescription>
          </DialogHeader>
          
          <div className="space-y-4 py-4">
            {/* Source Agent */}
            <div className="space-y-2">
              <Label className="text-sm font-medium">From (absent agent)</Label>
              <Select value={bulkSourceAgent} onValueChange={(v) => { setBulkSourceAgent(v); setBulkTargetAgents([]); }}>
                <SelectTrigger>
                  <SelectValue placeholder="Select agent to reassign from" />
                </SelectTrigger>
                <SelectContent>
                  {salesUsers.map(user => {
                    const agentLeadCount = leads.filter(l => l.assigned_to === user.id).length;
                    return (
                      <SelectItem key={user.id} value={user.id}>
                        <div className="flex items-center gap-2">
                          <PresenceBadge status={getAgentPresenceStatus(user.id)} size="sm" />
                          <span>{getAgentName(user)}</span>
                          <Badge variant="secondary" className="text-[10px] ml-1">{agentLeadCount} leads</Badge>
                        </div>
                      </SelectItem>
                    );
                  })}
                </SelectContent>
              </Select>
            </div>

            {/* Date Range (optional) */}
            <div className="space-y-2">
              <Label className="text-sm font-medium">Date range <span className="text-muted-foreground font-normal">(optional)</span></Label>
              <div className="flex items-center gap-2">
                <Popover open={bulkCalendarOpen} onOpenChange={setBulkCalendarOpen}>
                  <PopoverTrigger asChild>
                    <Button variant="outline" size="sm" className="w-full justify-start text-left font-normal">
                      <CalendarIcon className="h-4 w-4 mr-2" />
                      {bulkDateRange?.from ? (
                        bulkDateRange.to ? (
                          `${format(bulkDateRange.from, 'dd MMM yyyy')} - ${format(bulkDateRange.to, 'dd MMM yyyy')}`
                        ) : (
                          format(bulkDateRange.from, 'dd MMM yyyy')
                        )
                      ) : (
                        <span className="text-muted-foreground">All time (no filter)</span>
                      )}
                    </Button>
                  </PopoverTrigger>
                  <PopoverContent className="w-auto p-0" align="start">
                    <CalendarComponent
                      mode="range"
                      selected={bulkDateRange}
                      onSelect={(range) => { setBulkDateRange(range); if (range?.to) setBulkCalendarOpen(false); }}
                      numberOfMonths={2}
                      className="p-3 pointer-events-auto"
                    />
                  </PopoverContent>
                </Popover>
                {bulkDateRange?.from && (
                  <Button variant="ghost" size="icon" className="h-8 w-8 shrink-0" onClick={() => setBulkDateRange(undefined)}>
                    <X className="h-4 w-4" />
                  </Button>
                )}
              </div>
            </div>

            {/* Target Agents (multi-select) */}
            <div className="space-y-2">
              <Label className="text-sm font-medium">
                To (covering agents)
                {bulkTargetAgents.length > 0 && (
                  <Badge variant="secondary" className="ml-2 text-[10px]">{bulkTargetAgents.length} selected</Badge>
                )}
              </Label>
              {!bulkSourceAgent ? (
                <p className="text-sm text-muted-foreground py-2">Select source agent first</p>
              ) : (
                <div className="border rounded-md max-h-[200px] overflow-y-auto">
                  {salesUsers
                    .filter(u => u.id !== bulkSourceAgent)
                    .map(user => {
                      const isSelected = bulkTargetAgents.includes(user.id);
                      return (
                        <button
                          key={user.id}
                          type="button"
                          className={`w-full flex items-center gap-2 px-3 py-2 text-sm hover:bg-accent transition-colors text-left ${
                            isSelected ? 'bg-primary/5' : ''
                          }`}
                          onClick={() => {
                            setBulkTargetAgents(prev =>
                              isSelected ? prev.filter(id => id !== user.id) : [...prev, user.id]
                            );
                          }}
                        >
                          <div className={`h-4 w-4 rounded border flex items-center justify-center shrink-0 ${
                            isSelected ? 'bg-primary border-primary text-primary-foreground' : 'border-input'
                          }`}>
                            {isSelected && <span className="text-[10px]">✓</span>}
                          </div>
                          <PresenceBadge status={getAgentPresenceStatus(user.id)} size="sm" />
                          <span>{getAgentName(user)}</span>
                        </button>
                      );
                    })}
                </div>
              )}
              {bulkTargetAgents.length > 1 && (
                <p className="text-xs text-muted-foreground">
                  Leads will be distributed equally across {bulkTargetAgents.length} agents (round-robin).
                </p>
              )}
            </div>

            {/* Preview */}
            {bulkSourceAgent && bulkTargetAgents.length > 0 && (
              <div className="flex items-start gap-2 text-sm bg-primary/5 border border-primary/20 p-3 rounded-lg">
                <ArrowRight className="h-4 w-4 text-primary shrink-0 mt-0.5" />
                <span>
                  <strong>{bulkSourceLeadCount}</strong> lead{bulkSourceLeadCount !== 1 ? 's' : ''} from{' '}
                  <strong>{getAgentName(salesUsers.find(u => u.id === bulkSourceAgent))}</strong> will be reassigned to{' '}
                  <strong>
                    {bulkTargetAgents.map(id => getAgentName(salesUsers.find(u => u.id === id))).join(', ')}
                  </strong>
                  {bulkTargetAgents.length > 1 && (
                    <span> (~{Math.floor(bulkSourceLeadCount / bulkTargetAgents.length)} each)</span>
                  )}
                  {bulkDateRange?.from && (
                    <span className="text-muted-foreground">
                      {' '}(created {format(bulkDateRange.from, 'dd MMM')}
                      {bulkDateRange.to ? ` – ${format(bulkDateRange.to, 'dd MMM')}` : ' onwards'})
                    </span>
                  )}
                </span>
              </div>
            )}
          </div>

          <DialogFooter className="gap-2">
            <Button variant="outline" onClick={() => setBulkReassignOpen(false)}>
              Cancel
            </Button>
            <Button
              onClick={handleBulkReassign}
              disabled={!bulkSourceAgent || bulkTargetAgents.length === 0 || bulkSourceLeadCount === 0 || bulkReassigning}
            >
              {bulkReassigning ? 'Reassigning...' : `Reassign ${bulkSourceLeadCount} Lead${bulkSourceLeadCount !== 1 ? 's' : ''}`}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Summary Cards */}
      <div className="grid grid-cols-2 md:grid-cols-5 gap-4">
        <Card>
          <CardHeader className="pb-2">
            <CardDescription>Total Leads</CardDescription>
            <CardTitle className="text-2xl">{totalStats.totalLeads}</CardTitle>
          </CardHeader>
        </Card>
        <Card>
          <CardHeader className="pb-2">
            <CardDescription className="flex items-center gap-1.5">
              <Hourglass className="h-3.5 w-3.5" />
              Awaiting Contact
            </CardDescription>
            <CardTitle className="text-2xl text-amber-600">{totalStats.awaitingContact}</CardTitle>
          </CardHeader>
        </Card>
        <Card>
          <CardHeader className="pb-2">
            <CardDescription>Assigned</CardDescription>
            <CardTitle className="text-2xl text-green-600">{totalStats.assigned}</CardTitle>
          </CardHeader>
        </Card>
        <Card className={totalStats.assignedUncontacted > 0 ? 'border-red-200 bg-red-50/50 dark:bg-red-950/20' : ''}>
          <CardHeader className="pb-2">
            <CardDescription className="flex items-center gap-1.5">
              <AlertCircle className="h-3.5 w-3.5 text-red-500" />
              Not Picked Up
            </CardDescription>
            <CardTitle className="text-2xl text-red-600">{totalStats.assignedUncontacted}</CardTitle>
          </CardHeader>
        </Card>
        <Card>
          <CardHeader className="pb-2">
            <CardDescription>Active Agents</CardDescription>
            <CardTitle className="text-2xl">{totalStats.activeAgents} / {totalStats.totalAgents}</CardTitle>
          </CardHeader>
        </Card>
      </div>

      {/* Not Picked Up Breakdown - Assigned but not contacted */}
      {uncontactedByAgent.length > 0 && (
        <Card className="border-red-200 bg-red-50/30 dark:bg-red-950/10">
          <CardHeader className="pb-3">
            <div className="flex items-center justify-between flex-wrap gap-3">
              <div>
                <CardTitle className="text-lg flex items-center gap-2 text-red-700 dark:text-red-400">
                  <AlertCircle className="h-5 w-5" />
                  Leads Not Picked Up by Agents
                </CardTitle>
                <CardDescription className="text-red-600/80">
                  These leads were assigned to agents but haven't been contacted yet
                </CardDescription>
              </div>
              <div className="flex items-center gap-3">
                {/* Date Filter */}
                <Select value={uncontactedDateFilter} onValueChange={setUncontactedDateFilter}>
                  <SelectTrigger className="w-[140px] h-8 text-xs">
                    <CalendarIcon className="h-3 w-3 mr-1" />
                    <SelectValue placeholder="All Time" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="all">All Time</SelectItem>
                    <SelectItem value="this_week">This Week</SelectItem>
                    <SelectItem value="last_week">Last Week</SelectItem>
                    <SelectItem value="this_month">This Month</SelectItem>
                    <SelectItem value="last_month">Last Month</SelectItem>
                    <SelectItem value="this_year">This Year</SelectItem>
                  </SelectContent>
                </Select>
                <Badge variant="destructive" className="text-sm">
                  {filteredUncontactedTotal} leads
                </Badge>
              </div>
            </div>
          </CardHeader>
          <CardContent>
            {filteredUncontactedByAgent.length === 0 ? (
              <div className="text-center py-8 text-muted-foreground">
                <AlertCircle className="h-8 w-8 mx-auto mb-2 opacity-50" />
                <p className="text-sm">No uncontacted leads found for this period</p>
              </div>
            ) : (
            <div className="space-y-3">
              {filteredUncontactedByAgent.map(agent => {
                const isExpanded = expandedUncontacted.has(agent.agentId);
                const presenceStatus = getAgentPresenceStatus(agent.agentId);
                
                return (
                  <div key={agent.agentId} className="border rounded-lg bg-background">
                    <Collapsible
                      open={isExpanded}
                      onOpenChange={() => {
                        setExpandedUncontacted(prev => {
                          const newSet = new Set(prev);
                          if (newSet.has(agent.agentId)) {
                            newSet.delete(agent.agentId);
                          } else {
                            newSet.add(agent.agentId);
                          }
                          return newSet;
                        });
                      }}
                    >
                      <CollapsibleTrigger className="w-full">
                        <div className="flex items-center justify-between p-4 hover:bg-muted/50 rounded-t-lg">
                          <div className="flex items-center gap-3">
                            <PresenceBadge status={presenceStatus} size="sm" />
                            <div className="text-left">
                              <div className="font-medium">{agent.agentName}</div>
                              <div className="text-xs text-muted-foreground">{agent.agentEmail}</div>
                            </div>
                          </div>
                          <div className="flex items-center gap-3">
                            <div className="text-right">
                              <div className="font-semibold text-red-600">{agent.uncontactedCount} leads</div>
                              {agent.oldestUncontacted && (
                                <div className="text-xs text-muted-foreground">
                                  Oldest: {formatDistanceToNow(agent.oldestUncontacted, { addSuffix: true })}
                                </div>
                              )}
                            </div>
                            {isExpanded ? (
                              <ChevronDown className="h-4 w-4 text-muted-foreground" />
                            ) : (
                              <ChevronRight className="h-4 w-4 text-muted-foreground" />
                            )}
                          </div>
                        </div>
                      </CollapsibleTrigger>
                      <CollapsibleContent>
                        <div className="border-t px-4 py-3">
                          <Table>
                            <TableHeader>
                              <TableRow className="text-xs">
                                <TableHead className="py-2">Name</TableHead>
                                <TableHead className="py-2">Phone</TableHead>
                                <TableHead className="py-2">Email</TableHead>
                                <TableHead className="py-2">Vehicle</TableHead>
                                <TableHead className="py-2">Assigned</TableHead>
                                <TableHead className="py-2">Age</TableHead>
                              </TableRow>
                            </TableHeader>
                            <TableBody>
                              {agent.leads.slice(0, 10).map(lead => (
                                <TableRow key={lead.id} className="text-xs">
                                  <TableCell className="py-2 font-medium">
                                    {lead.first_name || lead.last_name 
                                      ? `${lead.first_name || ''} ${lead.last_name || ''}`.trim()
                                      : 'N/A'}
                                  </TableCell>
                                  <TableCell className="py-2">
                                    {lead.phone ? (
                                      <a href={`tel:${lead.phone}`} className="text-primary hover:underline flex items-center gap-1">
                                        <Phone className="h-3 w-3" />
                                        {lead.phone}
                                      </a>
                                    ) : (
                                      <span className="text-muted-foreground">—</span>
                                    )}
                                  </TableCell>
                                  <TableCell className="py-2">
                                    <a href={`mailto:${lead.email}`} className="text-primary hover:underline flex items-center gap-1">
                                      <Mail className="h-3 w-3" />
                                      <span className="max-w-[150px] truncate">{lead.email}</span>
                                    </a>
                                  </TableCell>
                                  <TableCell className="py-2">
                                    {lead.vehicle_reg ? (
                                      <div className="flex items-center gap-1">
                                        <Car className="h-3 w-3 text-muted-foreground" />
                                        <span className="uppercase font-mono">{lead.vehicle_reg}</span>
                                      </div>
                                    ) : (
                                      <span className="text-muted-foreground">—</span>
                                    )}
                                  </TableCell>
                                  <TableCell className="py-2 text-muted-foreground">
                                    {lead.assigned_at 
                                      ? format(new Date(lead.assigned_at), 'dd MMM, HH:mm')
                                      : format(new Date(lead.created_at), 'dd MMM, HH:mm')}
                                  </TableCell>
                                  <TableCell className="py-2">
                                    <Badge variant="outline" className="text-[10px] bg-red-50 text-red-700 border-red-200">
                                      {formatDistanceToNow(new Date(lead.created_at))}
                                    </Badge>
                                  </TableCell>
                                </TableRow>
                              ))}
                            </TableBody>
                          </Table>
                          {agent.leads.length > 10 && (
                            <div className="text-center text-xs text-muted-foreground mt-2 py-2 border-t">
                              + {agent.leads.length - 10} more leads not shown
                            </div>
                          )}
                        </div>
                      </CollapsibleContent>
                    </Collapsible>
                  </div>
                );
              })}
            </div>
            )}
          </CardContent>
        </Card>
      )}

      {/*
        Lead-distribution editing has been consolidated onto the
        "Lead Distribution" page (?tab=lead-teams). This card is now
        a lightweight pointer for managers so they don't edit share %,
        pause/resume, or add/remove agents in two different places.
        The routing/assignment logic itself is unchanged.
      */}
      {canSeeDistributionSettings && (
        <Card className="border-dashed">
          <CardHeader className="pb-4">
            <div className="flex items-start justify-between gap-4 flex-wrap">
              <div>
                <CardTitle className="text-lg flex items-center gap-2">
                  <Users className="h-5 w-5" />
                  Lead Distribution Settings
                </CardTitle>
                <CardDescription className="mt-1">
                  All distribution controls — team assignment (Red / Blue), lead share, pause / resume, add or remove agents — are now managed in one place.
                </CardDescription>
              </div>
              <Button
                variant="default"
                size="sm"
                onClick={() => {
                  const url = new URL(window.location.href);
                  url.searchParams.set('tab', 'lead-teams');
                  window.history.pushState({}, '', url.toString());
                  window.dispatchEvent(new PopStateEvent('popstate'));
                }}
                className="gap-2"
              >
                <Network className="h-4 w-4" />
                Open Lead Distribution
              </Button>
            </div>
          </CardHeader>
        </Card>
      )}

      {/* Filter and Controls */}
      <div className="flex items-center justify-between gap-4 flex-wrap">
        <div className="flex items-center gap-3">
          <Select value={selectedAgent} onValueChange={setSelectedAgent}>
            <SelectTrigger className="w-[200px]">
              <SelectValue placeholder="Filter by agent" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all">All Agents</SelectItem>
              <SelectItem value="awaiting_contact">
                <div className="flex items-center gap-2">
                  <Hourglass className="h-3.5 w-3.5 text-amber-600" />
                  Awaiting Contact Only
                </div>
              </SelectItem>
              <div className="h-px bg-border my-1" />
              {salesUsers.map(user => (
                <SelectItem key={user.id} value={user.id}>
                  <div className="flex items-center gap-2">
                    <div className="h-5 w-5 rounded-full bg-primary/10 flex items-center justify-center text-[10px] font-medium">
                      {user.first_name?.[0]?.toUpperCase() || user.email[0].toUpperCase()}
                    </div>
                    {`${user.first_name || ''} ${user.last_name || ''}`.trim() || user.email}
                  </div>
                </SelectItem>
              ))}
            </SelectContent>
          </Select>

          {/* Date Filter with Quick Options */}
          <Popover open={isCalendarOpen} onOpenChange={setIsCalendarOpen}>
            <PopoverTrigger asChild>
              <Button 
                variant={dateRange?.from ? "default" : "outline"} 
                size="sm" 
                className="gap-2 min-w-[160px]"
              >
                <CalendarIcon className="h-4 w-4" />
                {dateRange?.from ? (
                  <span className="text-xs">
                    {format(dateRange.from, 'dd MMM')} 
                    {dateRange.to ? ` - ${format(dateRange.to, 'dd MMM')}` : ''}
                  </span>
                ) : (
                  'Date Range'
                )}
              </Button>
            </PopoverTrigger>
            <PopoverContent className="w-auto p-0" align="start">
              <div className="p-3 border-b space-y-2">
                <div className="text-sm font-medium">Quick filters</div>
                <div className="flex flex-wrap gap-1">
                  <Button 
                    variant={quickDateFilter === 'today' ? 'default' : 'outline'} 
                    size="sm" 
                    onClick={() => handleQuickDateFilter('today')}
                  >
                    Today
                  </Button>
                  <Button 
                    variant={quickDateFilter === 'yesterday' ? 'default' : 'outline'} 
                    size="sm" 
                    onClick={() => handleQuickDateFilter('yesterday')}
                  >
                    Yesterday
                  </Button>
                  <Button 
                    variant={quickDateFilter === 'week' ? 'default' : 'outline'} 
                    size="sm" 
                    onClick={() => handleQuickDateFilter('week')}
                  >
                    This Week
                  </Button>
                  <Button 
                    variant={quickDateFilter === 'month' ? 'default' : 'outline'} 
                    size="sm" 
                    onClick={() => handleQuickDateFilter('month')}
                  >
                    This Month
                  </Button>
                  <Button 
                    variant={quickDateFilter === 'year' ? 'default' : 'outline'} 
                    size="sm" 
                    onClick={() => handleQuickDateFilter('year')}
                  >
                    This Year
                  </Button>
                  <Button 
                    variant={quickDateFilter === 'all' ? 'default' : 'outline'} 
                    size="sm" 
                    onClick={() => handleQuickDateFilter('all')}
                  >
                    All Time
                  </Button>
                </div>
              </div>
              <CalendarComponent
                mode="range"
                defaultMonth={dateRange?.from}
                selected={dateRange}
                onSelect={(range) => {
                  setDateRange(range);
                  setQuickDateFilter('custom');
                }}
                numberOfMonths={2}
                className="p-3 pointer-events-auto"
              />
            </PopoverContent>
          </Popover>
          
          {dateRange?.from && (
            <Button variant="ghost" size="sm" onClick={clearDateFilter} className="h-8 px-2">
              <X className="h-4 w-4" />
            </Button>
          )}
        </div>
        
        <div className="flex items-center gap-2">
          <Button variant="outline" size="sm" onClick={expandAll}>
            Expand All
          </Button>
          <Button variant="outline" size="sm" onClick={collapseAll}>
            Collapse All
          </Button>
        </div>
      </div>

      {/* Agent Lead Groups */}
      <div className="space-y-3">
        {filteredGroups.map((group) => {
          const isExpanded = expandedAgents.has(group.agentId || 'awaiting_contact');
          
          return (
            <Card key={group.agentId || 'awaiting_contact'} className="overflow-hidden">
              <Collapsible open={isExpanded} onOpenChange={() => toggleExpand(group.agentId)}>
                <CollapsibleTrigger asChild>
                  <CardHeader className="cursor-pointer hover:bg-muted/50 transition-colors py-3">
                    <div className="flex items-center justify-between">
                      <div className="flex items-center gap-3">
                        {isExpanded ? (
                          <ChevronDown className="h-5 w-5 text-muted-foreground" />
                        ) : (
                          <ChevronRight className="h-5 w-5 text-muted-foreground" />
                        )}
                        
                        {group.agentId ? (
                          <div className="h-9 w-9 rounded-full bg-primary text-primary-foreground flex items-center justify-center font-medium">
                            {group.agent?.first_name?.[0]?.toUpperCase() || group.agent?.email[0].toUpperCase()}
                          </div>
                        ) : (
                          <div className="h-9 w-9 rounded-full bg-amber-100 text-amber-700 flex items-center justify-center">
                            <Hourglass className="h-5 w-5" />
                          </div>
                        )}
                        
                        <div>
                          <CardTitle className="text-base">{group.agentName}</CardTitle>
                          {group.agent?.email && (
                            <CardDescription className="text-xs">{group.agent.email}</CardDescription>
                          )}
                        </div>
                      </div>
                      
                      <div className="flex items-center gap-4">
                        <div className="flex items-center gap-2">
                          <Badge variant="outline" className="bg-blue-50">
                            New: {group.newCount}
                          </Badge>
                          <Badge variant="outline" className="bg-yellow-50">
                            Contacted: {group.contactedCount}
                          </Badge>
                          <Badge variant="outline" className="bg-green-50">
                            Converted: {group.convertedCount}
                          </Badge>
                          <Badge variant="outline" className="bg-red-50">
                            Lost: {group.lostCount}
                          </Badge>
                        </div>
                        <Badge className="text-sm px-3">
                          {group.leads.length} leads
                        </Badge>
                      </div>
                    </div>
                  </CardHeader>
                </CollapsibleTrigger>
                
                <CollapsibleContent>
                  <CardContent className="pt-0">
                    {group.leads.length === 0 ? (
                      <div className="text-center py-6 text-muted-foreground">
                        No leads assigned to this agent
                      </div>
                    ) : (
                      <div className="border-2 border-border rounded-lg overflow-hidden">
                        <Table>
                          <TableHeader>
                            <TableRow className="bg-muted/30 border-b-2 border-border">
                              <TableHead>Customer</TableHead>
                              <TableHead>Contact</TableHead>
                              <TableHead>Vehicle</TableHead>
                              <TableHead>Status</TableHead>
                              <TableHead>Created</TableHead>
                            </TableRow>
                          </TableHeader>
                          <TableBody>
                            {(() => {
                              const groupKey = group.agentId || 'awaiting_contact';
                              const isShowingAll = showAllLeads.has(groupKey);
                              const leadsToShow = isShowingAll ? group.leads : group.leads.slice(0, 20);
                              
                              return leadsToShow.map((lead) => (
                                <TableRow key={lead.id}>
                                  <TableCell>
                                    <div className="font-medium">
                                      {`${lead.first_name || ''} ${lead.last_name || ''}`.trim() || 'Unknown'}
                                    </div>
                                  </TableCell>
                                  <TableCell>
                                    <div className="space-y-1">
                                      <div className="flex items-center gap-1.5 text-sm">
                                        <Mail className="h-3 w-3 text-muted-foreground" />
                                        <span className="truncate max-w-[150px]">{lead.email}</span>
                                      </div>
                                      {lead.phone && (
                                        <div className="flex items-center gap-1.5 text-sm text-muted-foreground">
                                          <Phone className="h-3 w-3" />
                                          {lead.phone}
                                        </div>
                                      )}
                                    </div>
                                  </TableCell>
                                  <TableCell>
                                    {lead.vehicle_reg && (
                                      <div className="flex items-center gap-1.5">
                                        <Car className="h-3 w-3 text-muted-foreground" />
                                        <span className="font-mono text-sm">{lead.vehicle_reg}</span>
                                      </div>
                                    )}
                                    {(lead.vehicle_make || lead.vehicle_model) && (
                                      <div className="text-xs text-muted-foreground">
                                        {`${lead.vehicle_make || ''} ${lead.vehicle_model || ''}`.trim()}
                                      </div>
                                    )}
                                  </TableCell>
                                  <TableCell>
                                    <Badge className={getStatusBadgeVariant(lead.status)}>
                                      {lead.status.replace('_', ' ')}
                                    </Badge>
                                    {lead.is_paid && (
                                      <Badge className="ml-1 bg-green-600 text-white">Paid</Badge>
                                    )}
                                  </TableCell>
                                  <TableCell>
                                    <div className="flex items-center gap-1.5 text-sm text-muted-foreground">
                                      <Calendar className="h-3 w-3" />
                                      {format(new Date(lead.created_at), 'dd MMM yyyy, HH:mm')}
                                    </div>
                                  </TableCell>
                                </TableRow>
                              ));
                            })()}
                          </TableBody>
                        </Table>
                        {group.leads.length > 20 && (
                          <div className="flex items-center justify-center gap-4 py-2 text-sm bg-muted/30">
                            {(() => {
                              const groupKey = group.agentId || 'awaiting_contact';
                              const isShowingAll = showAllLeads.has(groupKey);
                              
                              return (
                                <>
                                  <span className="text-muted-foreground">
                                    Showing {isShowingAll ? group.leads.length : 20} of {group.leads.length} leads
                                  </span>
                                  <Button 
                                    variant="link" 
                                    size="sm" 
                                    className="h-auto p-0 text-primary font-medium"
                                    onClick={(e) => {
                                      e.stopPropagation();
                                      setShowAllLeads(prev => {
                                        const newSet = new Set(prev);
                                        if (isShowingAll) {
                                          newSet.delete(groupKey);
                                        } else {
                                          newSet.add(groupKey);
                                        }
                                        return newSet;
                                      });
                                    }}
                                  >
                                    {isShowingAll ? 'Show Less' : 'Show All'}
                                  </Button>
                                </>
                              );
                            })()}
                          </div>
                        )}
                      </div>
                    )}
                  </CardContent>
                </CollapsibleContent>
              </Collapsible>
            </Card>
          );
        })}
      </div>
    </div>
  );
};
