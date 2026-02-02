import React, { useState, useMemo } from 'react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Switch } from '@/components/ui/switch';
import { Label } from '@/components/ui/label';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Collapsible, CollapsibleContent, CollapsibleTrigger } from '@/components/ui/collapsible';
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent, AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle, AlertDialogTrigger } from '@/components/ui/alert-dialog';
import { Tooltip, TooltipContent, TooltipTrigger } from '@/components/ui/tooltip';
import { Lead, AdminUser } from '@/hooks/useLeads';
import { useLeadDistribution, DistributionMode } from '@/hooks/useLeadDistribution';
import { DistributionModeSelector } from './distribution/DistributionModeSelector';
import { AgentStatusTable } from './distribution/AgentStatusTable';
import { DistributionSimulator } from './distribution/DistributionSimulator';
import { PresenceBadge } from './distribution/PresenceBadge';
import { supabase } from '@/integrations/supabase/client';
import { 
  Users, ChevronDown, ChevronRight, Phone, Mail, Car, 
  Calendar, UserCircle, Hourglass, Info, Trash2, Save, Zap, UserPlus,
  RotateCcw, Percent, ArrowRight, AlertCircle, Settings
} from 'lucide-react';
import { format, formatDistanceToNow } from 'date-fns';
import { toast } from '@/hooks/use-toast';

interface AgentsLeadsViewProps {
  leads: Lead[];
  salesUsers: AdminUser[];
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

export const AgentsLeadsView: React.FC<AgentsLeadsViewProps> = ({
  leads,
  salesUsers,
}) => {
  const [selectedAgent, setSelectedAgent] = useState<string>('all');
  const [expandedAgents, setExpandedAgents] = useState<Set<string>>(new Set(['awaiting_contact']));
  const [editedCaps, setEditedCaps] = useState<Record<string, number>>({});
  const [editedPercentages, setEditedPercentages] = useState<Record<string, number>>({});
  const [saving, setSaving] = useState<string | null>(null);
  const [deleting, setDeleting] = useState<string | null>(null);
  const [savingMode, setSavingMode] = useState(false);
  
  // Reassignment dialog state
  const [reassignDialogOpen, setReassignDialogOpen] = useState(false);
  const [agentToDelete, setAgentToDelete] = useState<{ id: string; name: string; leadCount: number } | null>(null);
  const [reassignTargetAgent, setReassignTargetAgent] = useState<string>('');

  // Lead distribution hook for agent caps
  const {
    settings,
    agentCaps,
    agentPresences,
    updateAgentCap,
    updateSettings,
    toggleAgentPause,
    deleteAgentFromDistribution,
    getAgentPresenceStatus,
    initializeAgentCaps,
    loading
  } = useLeadDistribution();

  // Get distribution mode from settings (persisted in DB)
  const distributionMode = settings?.distribution_mode || 'round_robin';
  
  // Track local mode changes before save
  const [pendingMode, setPendingMode] = useState<DistributionMode | null>(null);
  const [pendingSoloAgentId, setPendingSoloAgentId] = useState<string | null>(null);
  const [pendingOverflowAgentId, setPendingOverflowAgentId] = useState<string | null>(null);
  
  const displayMode = pendingMode ?? distributionMode;
  const displaySoloAgentId = pendingSoloAgentId ?? settings?.solo_agent_id ?? null;
  const displayOverflowAgentId = pendingOverflowAgentId ?? settings?.overflow_recipient_id ?? null;
  
  const hasPendingChanges = 
    (pendingMode !== null && pendingMode !== distributionMode) ||
    (pendingSoloAgentId !== null && pendingSoloAgentId !== settings?.solo_agent_id) ||
    (pendingOverflowAgentId !== null && pendingOverflowAgentId !== settings?.overflow_recipient_id);

  // Handle distribution mode change
  const handleModeChange = (mode: DistributionMode) => {
    if (mode !== distributionMode) {
      setPendingMode(mode);
    } else {
      setPendingMode(null);
    }
  };

  // Handle solo agent change
  const handleSoloAgentChange = (agentId: string) => {
    setPendingSoloAgentId(agentId);
    // Also enable solo mode when selecting an agent
    if (displayMode !== 'solo') {
      setPendingMode('solo');
    }
  };

  // Handle overflow agent change
  const handleOverflowAgentChange = (agentId: string) => {
    setPendingOverflowAgentId(agentId || null);
  };

  // Save all distribution settings to database
  const handleSaveDistributionSettings = async () => {
    setSavingMode(true);
    
    const updates: Record<string, unknown> = {};
    
    if (pendingMode !== null) {
      updates.distribution_mode = pendingMode;
      // Solo mode enabled is derived from mode
      updates.solo_mode_enabled = pendingMode === 'solo';
    }
    
    if (pendingSoloAgentId !== null) {
      updates.solo_agent_id = pendingSoloAgentId || null;
    }
    
    if (pendingOverflowAgentId !== null) {
      updates.overflow_recipient_id = pendingOverflowAgentId || null;
    }
    
    const success = await updateSettings(updates);
    if (success) {
      setPendingMode(null);
      setPendingSoloAgentId(null);
      setPendingOverflowAgentId(null);
    }
    setSavingMode(false);
  };

  // Build agent options for mode selector
  const agentOptions = useMemo(() => {
    return salesUsers.map(user => ({
      id: user.id,
      name: getAgentName(user),
      email: user.email,
      isOnline: getAgentPresenceStatus(user.id) === 'active',
    }));
  }, [salesUsers, getAgentPresenceStatus]);

  // Build agent simulation data
  const agentSimData = useMemo(() => {
    return agentCaps.map(cap => {
      const agent = salesUsers.find(u => u.id === cap.admin_user_id);
      return {
        id: cap.admin_user_id,
        name: getAgentName(agent),
        dailyCap: cap.daily_cap,
        assignedToday: cap.assigned_today,
        percentage: 0, // TODO: Add percentage field
        isOnline: getAgentPresenceStatus(cap.admin_user_id) === 'active',
        isPaused: cap.paused,
      };
    });
  }, [agentCaps, salesUsers, getAgentPresenceStatus]);

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
    const numValue = parseInt(value, 10);
    if (!isNaN(numValue) && numValue >= 0) {
      setEditedCaps(prev => ({ ...prev, [adminUserId]: numValue }));
    }
  };

  // Handle percentage change
  const handlePercentageChange = (adminUserId: string, value: string) => {
    const numValue = parseInt(value, 10);
    if (!isNaN(numValue) && numValue >= 0 && numValue <= 100) {
      setEditedPercentages(prev => ({ ...prev, [adminUserId]: numValue }));
    }
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

  // Filter by selected agent
  const filteredGroups = useMemo(() => {
    if (selectedAgent === 'all') return agentGroups;
    if (selectedAgent === 'awaiting_contact') return agentGroups.filter(g => g.agentId === null);
    return agentGroups.filter(g => g.agentId === selectedAgent);
  }, [agentGroups, selectedAgent]);

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

    return {
      totalLeads: leads.length,
      awaitingContact: leads.filter(l => !l.assigned_to).length,
      assigned: leads.filter(l => l.assigned_to).length,
      agentsWithLeads: agentGroups.filter(g => g.agentId && g.leads.length > 0).length,
      totalAgents: salesUsers.length,
      activeAgents,
    };
  }, [leads, agentGroups, salesUsers, agentCaps, getAgentPresenceStatus]);

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

      {/* Summary Cards */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
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
        <Card>
          <CardHeader className="pb-2">
            <CardDescription>Active Agents</CardDescription>
            <CardTitle className="text-2xl">{totalStats.activeAgents} / {totalStats.totalAgents}</CardTitle>
          </CardHeader>
        </Card>
      </div>

      {/* Agent Distribution Settings Section */}
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
            {unconfiguredAgents.length > 0 && (
              <Button variant="outline" size="sm" onClick={initializeAgentCaps} className="gap-2">
                <UserPlus className="h-4 w-4" />
                Add {unconfiguredAgents.length} new agent(s)
              </Button>
            )}
          </div>
        </CardHeader>
        <CardContent className="space-y-6">
          {/* Distribution Mode Selector */}
          <DistributionModeSelector
            selectedMode={displayMode}
            onModeChange={handleModeChange}
            soloAgentId={displaySoloAgentId}
            onSoloAgentChange={handleSoloAgentChange}
            agents={agentOptions}
            overflowAgentId={displayOverflowAgentId}
            onOverflowAgentChange={handleOverflowAgentChange}
            hasUnsavedChanges={hasPendingChanges}
            onSave={handleSaveDistributionSettings}
            saving={savingMode}
          />

          {/* Active Status Info Box */}
          <Collapsible>
            <CollapsibleTrigger asChild>
              <Button variant="ghost" size="sm" className="gap-2 text-muted-foreground">
                <Info className="h-4 w-4" />
                Status Legend
                <ChevronDown className="h-4 w-4" />
              </Button>
            </CollapsibleTrigger>
            <CollapsibleContent>
              <div className="bg-blue-50 dark:bg-blue-950/30 border border-blue-200 dark:border-blue-800 rounded-lg p-4 mt-2">
                <div className="text-sm text-blue-800 dark:text-blue-200 space-y-2">
                  <div className="grid gap-1.5">
                    <div className="flex items-center gap-2">
                      <span className="flex items-center gap-1.5">
                        <span className="h-2.5 w-2.5 rounded-full bg-green-500"></span>
                        <Badge variant="outline" className="bg-green-600 text-white border-green-600 text-[10px] px-1.5 py-0">
                          <Zap className="h-2.5 w-2.5 mr-0.5" />LIVE
                        </Badge>
                      </span>
                      <span className="text-blue-700 dark:text-blue-300">
                        <strong>Active</strong>: Agent clicked/scrolled/typed within 90 seconds
                      </span>
                    </div>
                    <div className="flex items-center gap-2">
                      <span className="h-2.5 w-2.5 rounded-full bg-amber-500"></span>
                      <span className="text-blue-700 dark:text-blue-300">
                        <strong>Idle</strong>: No interaction for 90s-5min
                      </span>
                    </div>
                    <div className="flex items-center gap-2">
                      <span className="h-2.5 w-2.5 rounded-full bg-gray-400"></span>
                      <span className="text-blue-700 dark:text-blue-300">
                        <strong>Offline</strong>: No interaction for 5+ minutes
                      </span>
                    </div>
                  </div>
                </div>
              </div>
            </CollapsibleContent>
          </Collapsible>

          {/* Agent Status Table */}
          <AgentStatusTable
            mode={displayMode}
            agentCaps={agentCaps}
            agents={salesUsers}
            presences={agentPresences}
            getPresenceStatus={getAgentPresenceStatus}
            editedCaps={editedCaps}
            editedPercentages={editedPercentages}
            onCapChange={handleCapChange}
            onPercentageChange={handlePercentageChange}
            onSaveCap={handleSaveCap}
            onTogglePause={handleTogglePause}
            onDelete={openReassignDialog}
            saving={saving}
            deleting={deleting}
            soloAgentId={displaySoloAgentId}
          />

          {/* Distribution Simulator */}
          <DistributionSimulator
            mode={displayMode}
            agents={agentSimData}
            soloAgentId={displaySoloAgentId}
            overflowAgentId={displayOverflowAgentId}
            leadsToSimulate={10}
          />
        </CardContent>
      </Card>

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
                      <div className="border rounded-lg overflow-hidden">
                        <Table>
                          <TableHeader>
                            <TableRow className="bg-muted/30">
                              <TableHead>Customer</TableHead>
                              <TableHead>Contact</TableHead>
                              <TableHead>Vehicle</TableHead>
                              <TableHead>Status</TableHead>
                              <TableHead>Plan</TableHead>
                              <TableHead>Created</TableHead>
                            </TableRow>
                          </TableHeader>
                          <TableBody>
                            {group.leads.slice(0, 20).map((lead) => (
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
                                  <span className="text-sm">{lead.plan_interest || '-'}</span>
                                </TableCell>
                                <TableCell>
                                  <div className="flex items-center gap-1.5 text-sm text-muted-foreground">
                                    <Calendar className="h-3 w-3" />
                                    {format(new Date(lead.created_at), 'dd MMM yyyy')}
                                  </div>
                                </TableCell>
                              </TableRow>
                            ))}
                          </TableBody>
                        </Table>
                        {group.leads.length > 20 && (
                          <div className="text-center py-2 text-sm text-muted-foreground bg-muted/30">
                            Showing 20 of {group.leads.length} leads
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
