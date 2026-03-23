import React, { useState, useMemo, useCallback } from 'react';
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
  RotateCcw, Percent, ArrowRight, AlertCircle, CalendarIcon, X, ShieldCheck, UserCheck, Eye, EyeOff, Check
} from 'lucide-react';
import { format, formatDistanceToNow, startOfWeek, startOfMonth, startOfYear, endOfDay, isWithinInterval, subWeeks, subMonths, endOfWeek, endOfMonth } from 'date-fns';
import { toast } from '@/hooks/use-toast';
import { DateRange } from 'react-day-picker';

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
    case 'new': return 'bg-blue-100 text-blue-800';
    case 'contacted': return 'bg-yellow-100 text-yellow-800';
    case 'follow_up': return 'bg-purple-100 text-purple-800';
    case 'qualified': return 'bg-cyan-100 text-cyan-800';
    case 'negotiating': return 'bg-orange-100 text-orange-800';
    case 'converted': return 'bg-green-100 text-green-800';
    case 'lost': return 'bg-red-100 text-red-800';
    case 'fake_lead': return 'bg-gray-100 text-gray-800';
    default: return 'bg-gray-100 text-gray-800';
  }
};

type DistributionMode = 'round_robin' | 'percentage';

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
    if (newCap === undefined) return;

    setSaving(adminUserId);
    const success = await updateAgentCap(adminUserId, { daily_cap: newCap });
    if (success) {
      setEditedCaps(prev => {
        const { [adminUserId]: _, ...rest } = prev;
        return rest;
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
    let sourceLeads = leads.filter(l => l.assigned_to === bulkSourceAgent);
    if (bulkDateRange?.from) {
      sourceLeads = sourceLeads.filter(lead => {
        const leadDate = new Date(lead.created_at);
        const from = bulkDateRange.from!;
        const to = bulkDateRange.to || endOfDay(new Date());
        return isWithinInterval(leadDate, { start: from, end: to });
      });
    }
    return sourceLeads.length;
  }, [bulkSourceAgent, leads, bulkDateRange]);

  const handleBulkReassign = async () => {
    if (!bulkSourceAgent || bulkTargetAgents.length === 0) return;
    
    setBulkReassigning(true);
    try {
      // First, get the actual lead IDs to reassign (so we can distribute equally)
      let leadsQuery = supabase
        .from('sales_leads')
        .select('id')
        .eq('assigned_to', bulkSourceAgent);
      
      // Apply date filter if set
      if (bulkDateRange?.from) {
        leadsQuery = leadsQuery.gte('created_at', bulkDateRange.from.toISOString());
        if (bulkDateRange.to) {
          leadsQuery = leadsQuery.lte('created_at', endOfDay(bulkDateRange.to).toISOString());
        }
      }

      const { data: leadsToReassign, error: fetchError } = await leadsQuery;
      if (fetchError) throw fetchError;
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
    const awaitingContactLeads = groupMap.get(null) || [];
    groups.push({
      agent: null,
      agentId: null,
      agentName: 'Awaiting Contact',
      leads: awaitingContactLeads,
      newCount: awaitingContactLeads.filter(l => l.status === 'new').length,
      contactedCount: awaitingContactLeads.filter(l => l.status === 'contacted').length,
      convertedCount: awaitingContactLeads.filter(l => l.status === 'converted' || l.is_paid).length,
      lostCount: awaitingContactLeads.filter(l => l.status === 'lost').length,
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

      {/* Agent Distribution Settings Section */}
      {canSeeDistributionSettings ? (
      <Card>
        <CardHeader className="pb-4">
          <div className="flex items-center justify-between">
            <div>
              <CardTitle className="text-lg flex items-center gap-2">
                <Users className="h-5 w-5" />
                Lead Distribution Settings
              </CardTitle>
              <CardDescription>Configure how leads are distributed to agents</CardDescription>
            </div>
            <div className="flex items-center gap-2">
              <Button variant="outline" size="sm" onClick={() => setBulkReassignOpen(true)} className="gap-2">
                <ArrowRight className="h-4 w-4" />
                Reassign Agent's Leads
              </Button>
              {/* Add Agent Search */}
              {(isFullAdmin || (isSalesLead && canSeeDistributionSettings)) && (
                <Popover open={showAddAgent} onOpenChange={setShowAddAgent}>
                  <PopoverTrigger asChild>
                    <Button variant="outline" size="sm" className="gap-2">
                      <UserPlus className="h-4 w-4" />
                      Add Agent
                    </Button>
                  </PopoverTrigger>
                  <PopoverContent className="w-80 p-3" align="end">
                    <div className="space-y-2">
                      <p className="text-sm font-medium">Search for a user to add</p>
                      <Input
                        placeholder="Search by name or email..."
                        value={addAgentSearch}
                        onChange={(e) => handleAgentSearch(e.target.value)}
                        className="h-8 text-sm"
                      />
                      {addAgentLoading && (
                        <p className="text-xs text-muted-foreground">Searching...</p>
                      )}
                      {addAgentResults.length > 0 && (
                        <div className="max-h-48 overflow-y-auto space-y-1">
                          {addAgentResults.map(user => (
                            <button
                              key={user.id}
                              className="w-full flex items-center justify-between p-2 rounded hover:bg-muted text-left text-sm"
                              onClick={() => handleAddAgent(user.id)}
                            >
                              <div>
                                <div className="font-medium">{user.first_name || ''} {user.last_name || ''}</div>
                                <div className="text-xs text-muted-foreground">{user.email}</div>
                              </div>
                              <Badge variant="outline" className="text-[10px] capitalize">
                                {(user.role || '').replace('_', ' ')}
                              </Badge>
                            </button>
                          ))}
                        </div>
                      )}
                      {addAgentSearch.length >= 2 && !addAgentLoading && addAgentResults.length === 0 && (
                        <p className="text-xs text-muted-foreground">No users found or all already added.</p>
                      )}
                    </div>
                  </PopoverContent>
                </Popover>
              )}
              {unconfiguredAgents.length > 0 && (
                <Tooltip>
                  <TooltipTrigger asChild>
                    <Button variant="outline" size="sm" onClick={initializeAgentCaps} className="gap-2">
                      <UserPlus className="h-4 w-4" />
                      Add Missing ({unconfiguredAgents.length})
                    </Button>
                  </TooltipTrigger>
                  <TooltipContent side="bottom" className="max-w-xs">
                    <p className="font-medium mb-1">These agents aren't in distribution yet:</p>
                    <ul className="text-xs space-y-0.5">
                      {unconfiguredAgents.map(a => (
                        <li key={a.id}>• {a.first_name || ''} {a.last_name || a.email}</li>
                      ))}
                    </ul>
                  </TooltipContent>
                </Tooltip>
              )}
            </div>
          </div>

          {/* Admin toggles */}
          <div className="flex flex-wrap gap-3 mt-4 pt-4 border-t">
            {isFullAdmin && (
              <div className="flex items-center gap-2 p-2.5 bg-muted/30 border rounded-lg">
                <ShieldCheck className="h-4 w-4 text-muted-foreground" />
                <span className="text-sm font-medium">Sales Lead Distribution Access</span>
                <Switch
                  checked={salesLeadDistributionAccess !== false}
                  onCheckedChange={async (checked) => {
                    const success = await updateDistributionAccess(checked);
                    if (success) {
                      toast({
                        title: checked ? 'Access granted' : 'Access revoked',
                        description: checked
                          ? 'Sales Leads can now view and manage distribution settings.'
                          : 'Sales Leads can no longer access distribution settings.',
                      });
                    }
                  }}
                />
                <span className="text-xs text-muted-foreground flex items-center gap-1">
                  {salesLeadDistributionAccess !== false ? 'Sales Leads can manage distribution' : 'Restricted to admins'}
                  <Check className="h-5 w-5 text-green-500" strokeWidth={3} />
                </span>
              </div>
            )}

            {(isFullAdmin || isSalesLead) && (
              <div className="flex items-center gap-2 p-2.5 bg-muted/30 border rounded-lg">
                {showAssignmentsToAgents === false ? (
                  <EyeOff className="h-4 w-4 text-muted-foreground" />
                ) : (
                  <Eye className="h-4 w-4 text-muted-foreground" />
                )}
                <span className="text-sm font-medium">Show "Assigned To" column to agents</span>
                <Switch
                  checked={showAssignmentsToAgents === false}
                  onCheckedChange={async (checked) => {
                    // checked = true means "hidden from agents" (config value = false)
                    const success = await updateShowAssignments(!checked);
                    if (success) {
                      toast({
                        title: checked ? 'Assignments hidden' : 'Assignments visible',
                        description: checked
                          ? 'Sales agents can no longer see lead assignments.'
                          : 'Sales agents can now see who is assigned to each lead.',
                      });
                    }
                  }}
                />
                <span className="text-xs text-muted-foreground flex items-center gap-1">
                  {showAssignmentsToAgents === false ? 'Agents can\'t see who\'s assigned' : 'Agents can see who\'s assigned'}
                  <Check className="h-5 w-5 text-green-500" strokeWidth={3} />
                </span>
              </div>
            )}

            {(isFullAdmin || isSalesLead) && (
              <div className="flex items-center gap-2 p-2.5 bg-muted/30 border rounded-lg">
                <Zap className="h-4 w-4 text-muted-foreground" />
                <span className="text-sm font-medium">Allow Agents to Claim Leads</span>
                <Switch
                  checked={allowAgentSelfAssign !== false}
                  onCheckedChange={async (checked) => {
                    const success = await updateAllowSelfAssign(checked);
                    if (success) {
                      toast({
                        title: checked ? 'Self-assign enabled' : 'Self-assign disabled',
                        description: checked
                          ? 'Agents can now also claim leads manually. Round-robin auto-distribution continues as normal.'
                          : 'Agents can no longer self-assign. Leads are distributed via round-robin only.',
                      });
                    }
                  }}
                />
                <span className="text-xs text-muted-foreground flex items-center gap-1">
                  {allowAgentSelfAssign !== false
                    ? 'Auto-distribution + manual claiming'
                    : 'Auto-distribution only'}
                  <Check className="h-5 w-5 text-green-500" strokeWidth={3} />
                </span>
              </div>
            )}

            {(isFullAdmin || isSalesLead) && (
              <div className="flex items-center gap-2 p-2.5 bg-muted/30 border rounded-lg">
                <Eye className="h-4 w-4 text-muted-foreground" />
                <span className="text-sm font-medium">Let all agents see all leads</span>
                <Switch
                  checked={agentsOwnLeadsOnly === true}
                  onCheckedChange={async (checked) => {
                    const success = await updateAgentsOwnLeadsOnly(checked);
                    if (success) {
                      toast({
                        title: checked ? 'All leads visible to agents' : 'Agents see own leads only',
                        description: checked
                          ? 'All sales agents can now see all leads.'
                          : 'Agents can only see their own assigned leads (unless individually allowed below).',
                      });
                    }
                  }}
                />
                <span className="text-xs text-muted-foreground flex items-center gap-1">
                  {agentsOwnLeadsOnly === true ? 'All agents can see all leads' : 'Agents see only their own leads'}
                  <Check className="h-5 w-5 text-green-500" strokeWidth={3} />
                </span>
              </div>
            )}

            {/* Per-agent visibility checkboxes - show when global toggle is OFF */}
            {(isFullAdmin || isSalesLead) && agentsOwnLeadsOnly !== true && (
              <div className="p-3 bg-muted/20 border rounded-lg space-y-2">
                <div className="flex items-center gap-2 mb-2">
                  <UserCheck className="h-4 w-4 text-muted-foreground" />
                  <span className="text-sm font-medium">Which agents can see all leads?</span>
                </div>
                <div className="grid gap-1.5">
                  {salesUsers
                    .filter(u => u.role === 'sales')
                    .map(agent => {
                      const perms = (agent as any).permissions || {};
                      const hasAllLeads = agentVisibilityOverrides[agent.id] ?? perms['tab_new-leads_all-leads'] === true;
                      const agentName = `${agent.first_name || ''} ${agent.last_name || ''}`.trim() || agent.email;
                      return (
                        <label key={agent.id} className="flex items-center gap-2 p-1.5 rounded hover:bg-muted/40 cursor-pointer">
                          <input
                            type="checkbox"
                            checked={hasAllLeads}
                            onChange={async (e) => {
                              const checked = e.target.checked;
                              setAgentVisibilityOverrides(prev => ({ ...prev, [agent.id]: checked }));
                              const newPerms = { ...perms, 'tab_new-leads_all-leads': checked };
                              const { error } = await supabase
                                .from('admin_users')
                                .update({ permissions: newPerms })
                                .eq('id', agent.id);
                              if (!error) {
                                toast({
                                  title: checked ? `${agentName} can see all leads` : `${agentName} restricted to own leads`,
                                });
                              } else {
                                setAgentVisibilityOverrides(prev => ({ ...prev, [agent.id]: !checked }));
                                toast({ title: 'Error saving permission', variant: 'destructive' });
                              }
                            }}
                            className="h-4 w-4 rounded border-primary text-primary focus:ring-primary"
                          />
                          <span className="text-sm">{agentName}</span>
                          {hasAllLeads && <Check className="h-3.5 w-3.5 text-green-500" />}
                        </label>
                      );
                    })}
                </div>
                <p className="text-xs text-muted-foreground mt-1">
                  Tick agents who should be able to see all leads, not just their own.
                </p>
              </div>
            )}
          </div>
        </CardHeader>
        <CardContent className="space-y-6">
          {/* Active Status Info Box */}
          <div className="bg-blue-50 dark:bg-blue-950/30 border border-blue-200 dark:border-blue-800 rounded-lg p-4">
            <div className="flex items-start gap-3">
              <Info className="h-5 w-5 text-blue-600 mt-0.5 shrink-0" />
              <div className="text-sm text-blue-800 dark:text-blue-200 space-y-2">
                <p className="font-semibold">Active Status Explained</p>
                <div className="grid gap-1.5">
                  <div className="flex items-center gap-2">
                    <span className="flex items-center gap-1.5">
                      <span className="h-2.5 w-2.5 rounded-full bg-green-500"></span>
                      <Badge variant="outline" className="bg-green-600 text-white border-green-600 text-[10px] px-1.5 py-0">
                        <Zap className="h-2.5 w-2.5 mr-0.5" />LIVE
                      </Badge>
                    </span>
                    <span className="text-blue-700 dark:text-blue-300">
                      <strong>Active (green)</strong>: Agent clicked/scrolled/typed within 90 seconds — actively working leads
                    </span>
                  </div>
                  <div className="flex items-center gap-2">
                    <span className="h-2.5 w-2.5 rounded-full bg-amber-500"></span>
                    <span className="text-blue-700 dark:text-blue-300">
                      <strong>Idle (yellow)</strong>: No interaction for 90s-5min — browser open but not working
                    </span>
                  </div>
                  <div className="flex items-center gap-2">
                    <span className="h-2.5 w-2.5 rounded-full bg-gray-400"></span>
                    <span className="text-blue-700 dark:text-blue-300">
                      <strong>Offline (gray)</strong>: No interaction for 5+ minutes or tab closed
                    </span>
                  </div>
                </div>
              </div>
            </div>
          </div>

          {/* Distribution Mode Toggle - Admin only can change */}
          <div className="flex items-center gap-4 p-4 bg-muted/50 rounded-lg">
            <span className="text-sm font-medium">Distribution Mode:</span>
            <div className="flex gap-2">
              <Button
                variant={displayMode === 'round_robin' ? 'default' : 'outline'}
                size="sm"
                onClick={() => handleModeChange('round_robin')}
                className="gap-2"
                disabled={!isFullAdmin}
              >
                <RotateCcw className="h-4 w-4" />
                Round Robin
              </Button>
              <Button
                variant={displayMode === 'percentage' ? 'default' : 'outline'}
                size="sm"
                onClick={() => handleModeChange('percentage')}
                className="gap-2"
                disabled={!isFullAdmin}
              >
                <Percent className="h-4 w-4" />
                Percentage Split
              </Button>
            </div>
            {!isFullAdmin && (
              <span className="text-xs text-muted-foreground italic">Only admins can change distribution mode</span>
            )}
            {hasPendingModeChange && (
              <Button 
                size="sm" 
                onClick={handleSaveMode}
                disabled={savingMode}
                className="gap-2 bg-green-600 hover:bg-green-700"
              >
                <Save className="h-4 w-4" />
                {savingMode ? 'Saving...' : 'Save Mode'}
              </Button>
            )}
            {loading && (
              <span className="text-sm text-muted-foreground">Loading...</span>
            )}
          </div>

          {/* Overflow Recipients */}
          <div className="p-4 bg-amber-50 dark:bg-amber-950/30 border border-amber-200 dark:border-amber-800 rounded-lg space-y-3">
            <div className="flex items-center gap-2">
              <UserCheck className="h-4 w-4 text-amber-600" />
              <span className="text-sm font-medium">Overflow Recipients</span>
              <span className="text-xs text-amber-700 dark:text-amber-300">
                When all agents hit their daily cap, extra leads rotate among these people.
              </span>
            </div>
            
            {/* Current overflow recipients */}
            {overflowRecipients.length > 0 && (
              <div className="flex flex-wrap gap-2">
                {overflowRecipients.map((recipient, idx) => {
                  const user = salesUsers.find(u => u.id === recipient.admin_user_id);
                  const name = user?.first_name ? `${user.first_name} ${user.last_name || ''}`.trim() : user?.email || 'Unknown';
                  return (
                    <Badge key={recipient.id} variant="secondary" className="flex items-center gap-1 py-1 px-2">
                      <span className="text-xs font-medium text-amber-700">#{idx + 1}</span>
                      <span className="text-xs">{name}</span>
                      {isFullAdmin && (
                        <button
                          onClick={() => removeOverflowRecipient(recipient.id)}
                          className="ml-1 hover:text-destructive"
                        >
                          <X className="h-3 w-3" />
                        </button>
                      )}
                    </Badge>
                  );
                })}
              </div>
            )}

            {/* Add overflow recipient */}
            {isFullAdmin && (
              <Select
                value=""
                onValueChange={(value) => {
                  if (value) addOverflowRecipient(value);
                }}
              >
                <SelectTrigger className="w-[220px] h-9 text-sm">
                  <SelectValue placeholder="+ Add overflow recipient" />
                </SelectTrigger>
                <SelectContent>
                  {salesUsers
                    .filter(u => !overflowRecipients.some(r => r.admin_user_id === u.id))
                    .map(user => (
                      <SelectItem key={user.id} value={user.id}>
                        {user.first_name ? `${user.first_name} ${user.last_name || ''}`.trim() : user.email}
                      </SelectItem>
                    ))}
                </SelectContent>
              </Select>
            )}
          </div>

          {/* Agent Controls Table */}
          <div className="border-2 border-border rounded-lg overflow-hidden">
            <Table>
              <TableHeader>
                <TableRow className="bg-muted/50 border-b-2 border-border">
                  <TableHead className="w-[250px]">Agent</TableHead>
                  <TableHead className="w-[100px]">Status</TableHead>
                  {displayMode === 'percentage' && (
                    <TableHead className="w-[140px]">Percentage (%)</TableHead>
                  )}
                  <TableHead className="w-[140px]">Daily Cap</TableHead>
                  <TableHead className="w-[100px]">Today</TableHead>
                  <TableHead className="w-[120px]">ON/OFF</TableHead>
                  {isFullAdmin && <TableHead className="w-[80px] text-center">Delete</TableHead>}
                </TableRow>
              </TableHeader>
              <TableBody>
                {loading ? (
                  <TableRow>
                    <TableCell colSpan={isFullAdmin ? 6 : 5} className="text-center py-8 text-muted-foreground">
                      <p>Loading agent distribution settings...</p>
                    </TableCell>
                  </TableRow>
                ) : agentCaps.length === 0 ? (
                  <TableRow>
                    <TableCell colSpan={isFullAdmin ? 6 : 5} className="text-center py-8 text-muted-foreground">
                      <p className="mb-2">No agents configured for lead distribution.</p>
                      {salesUsers.length > 0 ? (
                        <Button variant="outline" size="sm" onClick={initializeAgentCaps}>
                          Add {salesUsers.length} Agent(s) to Distribution
                        </Button>
                      ) : (
                        <p className="text-sm">No sales agents available.</p>
                      )}
                    </TableCell>
                  </TableRow>
                ) : (
                  agentCaps.map(cap => {
                    const agent = salesUsers.find(u => u.id === cap.admin_user_id);
                    const status = getAgentPresenceStatus(cap.admin_user_id);
                    const presence = getPresence(cap.admin_user_id);
                    const editedCap = editedCaps[cap.admin_user_id];
                    const hasCapChanges = editedCap !== undefined && editedCap !== cap.daily_cap;
                    const editedPercent = editedPercentages[cap.admin_user_id];

                    return (
                      <TableRow 
                        key={cap.id}
                        className={cap.paused ? 'opacity-60 bg-muted/30' : status === 'active' ? 'bg-green-50/50 dark:bg-green-950/20' : ''}
                      >
                        {/* Agent Name */}
                        <TableCell>
                          <div className="flex items-center gap-3">
                            <div className="h-8 w-8 rounded-full bg-primary text-primary-foreground flex items-center justify-center text-sm font-medium">
                              {agent?.first_name?.[0]?.toUpperCase() || agent?.email[0].toUpperCase() || '?'}
                            </div>
                            <div>
                              <div className="font-medium text-sm flex items-center gap-2">
                                {getAgentName(agent)}
                                {status === 'active' && !cap.paused && (
                                  <Badge variant="default" className="text-[10px] px-1.5 py-0 bg-green-600 hover:bg-green-600">
                                    <Zap className="h-2.5 w-2.5 mr-0.5" />
                                    LIVE
                                  </Badge>
                                )}
                              </div>
                              <div className="flex items-center gap-1.5">
                                <span className="text-xs text-muted-foreground">{agent?.email}</span>
                                {agent?.role && (
                                  <Badge variant="outline" className="text-[10px] px-1.5 py-0 font-normal capitalize">
                                    {agent.role.replace('_', ' ')}
                                  </Badge>
                                )}
                              </div>
                            </div>
                          </div>
                        </TableCell>

                        {/* Status */}
                        <TableCell>
                          <div className="flex items-center gap-2">
                            <PresenceBadge
                              status={status}
                              size="md"
                              showLabel
                              lastInteractionAt={presence?.last_interaction_at}
                            />
                          </div>
                        </TableCell>

                        {/* Percentage column (only in percentage mode) */}
                        {displayMode === 'percentage' && (
                        <TableCell>
                          <div className="flex items-center gap-2">
                              <div className="flex items-center gap-3 w-full min-w-[200px]">
                                <Slider
                                  value={[editedPercent ?? cap.percentage ?? 0]}
                                  onValueChange={([val]) => handlePercentageChange(cap.admin_user_id, val)}
                                  max={100}
                                  min={0}
                                  step={1}
                                  className="flex-1"
                                  disabled={cap.paused}
                                />
                                <div className="flex items-center gap-1 shrink-0">
                                  <Input
                                    type="number"
                                    min={0}
                                    max={100}
                                    step={1}
                                    value={editedPercent ?? cap.percentage ?? 0}
                                    onChange={(e) => {
                                      const val = e.target.value === '' ? 0 : parseInt(e.target.value, 10);
                                      if (!isNaN(val)) handlePercentageChange(cap.admin_user_id, val);
                                    }}
                                    onFocus={(e) => e.target.select()}
                                    className="w-16 h-8 text-sm text-center"
                                    disabled={cap.paused}
                                  />
                                  <span className="text-muted-foreground text-sm">%</span>
                                </div>
                                {saving === cap.admin_user_id && (
                                  <span className="text-xs text-muted-foreground animate-pulse">Saving…</span>
                                )}
                              </div>
                          </div>
                        </TableCell>
                        )}

                        {/* Daily Cap (always visible, always editable) */}
                        <TableCell>
                          <div className="flex items-center gap-2">
                              <Input
                                type="number"
                                min={0}
                                placeholder="∞"
                                value={editedCap ?? (cap.daily_cap === null ? '' : cap.daily_cap)}
                                onChange={(e) => handleCapChange(cap.admin_user_id, e.target.value)}
                                className="w-20 h-8 text-sm"
                              />
                              {hasCapChanges && (
                                <Button
                                  size="sm"
                                  variant="default"
                                  className="h-8 w-8 p-0"
                                  onClick={() => handleSaveCap(cap.admin_user_id)}
                                  disabled={saving === cap.admin_user_id}
                                >
                                  <Save className="h-3.5 w-3.5" />
                                </Button>
                              )}
                          </div>
                        </TableCell>

                        {/* Today's Count */}
                        <TableCell>
                          <div className="flex items-center gap-2">
                            <span className="font-medium">{todayLeadCounts[cap.admin_user_id] || 0}</span>
                            <span className="text-muted-foreground text-xs">
                              / {cap.daily_cap === null ? '∞' : cap.daily_cap}
                            </span>
                          </div>
                        </TableCell>

                        {/* ON/OFF Toggle */}
                        <TableCell>
                          <Tooltip>
                            <TooltipTrigger asChild>
                              <div className="flex items-center gap-2">
                                <Switch
                                  checked={!cap.paused}
                                  onCheckedChange={() => handleTogglePause(cap.admin_user_id)}
                                  disabled={saving === cap.admin_user_id}
                                  className="data-[state=checked]:bg-green-600"
                                />
                                <span className={`text-xs font-semibold ${cap.paused ? 'text-red-600' : 'text-green-600'}`}>
                                  {cap.paused ? 'OFF' : 'ON'}
                                </span>
                              </div>
                            </TooltipTrigger>
                            <TooltipContent side="top" className="text-xs">
                              {cap.paused 
                                ? 'Agent is switched OFF - will not receive leads' 
                                : 'Agent is switched ON - receiving leads'}
                            </TooltipContent>
                          </Tooltip>
                        </TableCell>

                        {/* Delete - Opens reassignment dialog (Admin only) */}
                        {isFullAdmin && (
                          <TableCell className="text-center">
                            <Button 
                              variant="ghost" 
                              size="sm" 
                              className="h-8 w-8 p-0 text-muted-foreground hover:text-red-600 hover:bg-red-50"
                              disabled={deleting === cap.admin_user_id}
                              onClick={() => openReassignDialog(cap.admin_user_id)}
                            >
                              <Trash2 className="h-4 w-4" />
                            </Button>
                          </TableCell>
                        )}
                      </TableRow>
                    );
                  })
                )}
                {/* Total percentage indicator row (only in percentage mode) */}
                {displayMode === 'percentage' && agentCaps.length > 0 && !loading && (
                  <TableRow className="bg-muted/50 border-t-2">
                    <TableCell colSpan={2} className="py-3">
                      <span className="font-semibold text-sm">Total</span>
                    </TableCell>
                    <TableCell className="py-3">
                      <div className="flex items-center gap-2">
                        <span className={`font-bold text-sm ${
                          totalPercentage === 100
                            ? 'text-green-600'
                            : totalPercentage > 100
                              ? 'text-red-600'
                              : 'text-amber-600'
                        }`}>
                          {totalPercentage}%
                        </span>
                        {totalPercentage > 100 && (
                          <Badge variant="destructive" className="text-[10px] px-1.5 py-0">
                            <AlertCircle className="h-2.5 w-2.5 mr-0.5" />
                            Exceeds 100%
                          </Badge>
                        )}
                        {totalPercentage < 100 && totalPercentage > 0 && (
                          <Badge variant="outline" className="text-[10px] px-1.5 py-0 border-amber-400 text-amber-700 bg-amber-50">
                            {100 - totalPercentage}% unallocated
                          </Badge>
                        )}
                        {totalPercentage === 100 && (
                          <Badge variant="outline" className="text-[10px] px-1.5 py-0 border-green-400 text-green-700 bg-green-50">
                            ✓ Fully allocated
                          </Badge>
                        )}
                      </div>
                    </TableCell>
                    <TableCell colSpan={isFullAdmin ? 3 : 2} />
                  </TableRow>
                )}
              </TableBody>
            </Table>
          </div>

          {/* Summary Info */}
          <div className="text-xs text-muted-foreground space-y-1.5 bg-muted/30 p-3 rounded-lg">
            <p><strong>How it works:</strong></p>
            <p>• Agents switched <strong>OFF</strong> will not receive any auto-assigned leads.</p>
            <p>• <strong>Leads per day</strong> sets the maximum leads an agent can receive daily.</p>
            <p>• <strong>Round Robin</strong>: Leads are distributed evenly in rotation.</p>
            <p>• <strong>Percentage Split</strong>: Leads are distributed based on assigned percentages.</p>
            <p>• Caps reset automatically at midnight (server time).</p>
          </div>
        </CardContent>
      </Card>
      ) : (
        <Card className="border-dashed">
          <CardHeader className="pb-4">
            <CardTitle className="text-lg flex items-center gap-2 text-muted-foreground">
              <ShieldCheck className="h-5 w-5" />
              Lead Distribution Settings
            </CardTitle>
            <CardDescription>Distribution settings are managed by administrators. Contact your admin for changes.</CardDescription>
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
