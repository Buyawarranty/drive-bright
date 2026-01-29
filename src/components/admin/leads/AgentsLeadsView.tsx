import React, { useState, useMemo } from 'react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Switch } from '@/components/ui/switch';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Collapsible, CollapsibleContent, CollapsibleTrigger } from '@/components/ui/collapsible';
import { AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent, AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle, AlertDialogTrigger } from '@/components/ui/alert-dialog';
import { Tooltip, TooltipContent, TooltipTrigger } from '@/components/ui/tooltip';
import { Lead, AdminUser } from '@/hooks/useLeads';
import { useLeadDistribution } from '@/hooks/useLeadDistribution';
import { PresenceBadge } from './distribution/PresenceBadge';
import { 
  Users, ChevronDown, ChevronRight, Phone, Mail, Car, 
  Calendar, UserCircle, AlertCircle, Info, Trash2, Save, Zap, UserPlus,
  RotateCcw, Percent
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

type DistributionMode = 'round_robin' | 'percentage';

export const AgentsLeadsView: React.FC<AgentsLeadsViewProps> = ({
  leads,
  salesUsers,
}) => {
  const [selectedAgent, setSelectedAgent] = useState<string>('all');
  const [expandedAgents, setExpandedAgents] = useState<Set<string>>(new Set(['unassigned']));
  const [distributionMode, setDistributionMode] = useState<DistributionMode>('round_robin');
  const [editedCaps, setEditedCaps] = useState<Record<string, number>>({});
  const [editedPercentages, setEditedPercentages] = useState<Record<string, number>>({});
  const [saving, setSaving] = useState<string | null>(null);
  const [deleting, setDeleting] = useState<string | null>(null);

  // Lead distribution hook for agent caps
  const {
    agentCaps,
    agentPresences,
    updateAgentCap,
    toggleAgentPause,
    deleteAgentFromDistribution,
    getAgentPresenceStatus,
    initializeAgentCaps
  } = useLeadDistribution();

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

  // Handle delete agent
  const handleDeleteAgent = async (adminUserId: string) => {
    setDeleting(adminUserId);
    await deleteAgentFromDistribution(adminUserId);
    setDeleting(null);
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
    groupMap.set(null, []); // Unassigned
    
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
    
    // Unassigned first
    const unassignedLeads = groupMap.get(null) || [];
    groups.push({
      agent: null,
      agentId: null,
      agentName: 'Unassigned',
      leads: unassignedLeads,
      newCount: unassignedLeads.filter(l => l.status === 'new').length,
      contactedCount: unassignedLeads.filter(l => l.status === 'contacted').length,
      convertedCount: unassignedLeads.filter(l => l.status === 'converted' || l.is_paid).length,
      lostCount: unassignedLeads.filter(l => l.status === 'lost').length,
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

    // Sort by total leads (descending), but keep unassigned first
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
    if (selectedAgent === 'unassigned') return agentGroups.filter(g => g.agentId === null);
    return agentGroups.filter(g => g.agentId === selectedAgent);
  }, [agentGroups, selectedAgent]);

  const toggleExpand = (agentId: string | null) => {
    const key = agentId || 'unassigned';
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
    setExpandedAgents(new Set(['unassigned', ...salesUsers.map(u => u.id)]));
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
      unassigned: leads.filter(l => !l.assigned_to).length,
      assigned: leads.filter(l => l.assigned_to).length,
      agentsWithLeads: agentGroups.filter(g => g.agentId && g.leads.length > 0).length,
      totalAgents: salesUsers.length,
      activeAgents,
    };
  }, [leads, agentGroups, salesUsers, agentCaps, getAgentPresenceStatus]);

  return (
    <div className="space-y-6">
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
            <CardDescription>Unassigned</CardDescription>
            <CardTitle className="text-2xl text-amber-600">{totalStats.unassigned}</CardTitle>
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

          {/* Distribution Mode Toggle */}
          <div className="flex items-center gap-4 p-4 bg-muted/50 rounded-lg">
            <span className="text-sm font-medium">Distribution Mode:</span>
            <div className="flex gap-2">
              <Button
                variant={distributionMode === 'round_robin' ? 'default' : 'outline'}
                size="sm"
                onClick={() => setDistributionMode('round_robin')}
                className="gap-2"
              >
                <RotateCcw className="h-4 w-4" />
                Round Robin
              </Button>
              <Button
                variant={distributionMode === 'percentage' ? 'default' : 'outline'}
                size="sm"
                onClick={() => setDistributionMode('percentage')}
                className="gap-2"
              >
                <Percent className="h-4 w-4" />
                Percentage Split
              </Button>
            </div>
          </div>

          {/* Agent Controls Table */}
          <div className="border rounded-lg overflow-hidden">
            <Table>
              <TableHeader>
                <TableRow className="bg-muted/50">
                  <TableHead className="w-[250px]">Agent</TableHead>
                  <TableHead className="w-[100px]">Status</TableHead>
                  <TableHead className="w-[140px]">
                    {distributionMode === 'round_robin' ? 'Leads per day' : 'Percentage (%)'}
                  </TableHead>
                  <TableHead className="w-[100px]">Today</TableHead>
                  <TableHead className="w-[120px]">ON/OFF</TableHead>
                  <TableHead className="w-[80px] text-center">Delete</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {agentCaps.length === 0 ? (
                  <TableRow>
                    <TableCell colSpan={6} className="text-center py-8 text-muted-foreground">
                      <p className="mb-2">No agents configured for lead distribution.</p>
                      <Button variant="outline" size="sm" onClick={initializeAgentCaps}>
                        Initialize Agent Caps
                      </Button>
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
                              <div className="text-xs text-muted-foreground">{agent?.email}</div>
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

                        {/* Leads per day / Percentage */}
                        <TableCell>
                          <div className="flex items-center gap-2">
                            {distributionMode === 'round_robin' ? (
                              <>
                                <Input
                                  type="number"
                                  min={0}
                                  value={editedCap ?? cap.daily_cap}
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
                              </>
                            ) : (
                              <div className="flex items-center gap-1">
                                <Input
                                  type="number"
                                  min={0}
                                  max={100}
                                  value={editedPercent ?? 0}
                                  onChange={(e) => handlePercentageChange(cap.admin_user_id, e.target.value)}
                                  className="w-16 h-8 text-sm"
                                />
                                <span className="text-muted-foreground">%</span>
                              </div>
                            )}
                          </div>
                        </TableCell>

                        {/* Today's Count */}
                        <TableCell>
                          <div className="flex items-center gap-2">
                            <span className="font-medium">{cap.assigned_today}</span>
                            <span className="text-muted-foreground text-xs">/ {cap.daily_cap}</span>
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

                        {/* Delete */}
                        <TableCell className="text-center">
                          <AlertDialog>
                            <AlertDialogTrigger asChild>
                              <Button 
                                variant="ghost" 
                                size="sm" 
                                className="h-8 w-8 p-0 text-muted-foreground hover:text-red-600 hover:bg-red-50"
                                disabled={deleting === cap.admin_user_id}
                              >
                                <Trash2 className="h-4 w-4" />
                              </Button>
                            </AlertDialogTrigger>
                            <AlertDialogContent>
                              <AlertDialogHeader>
                                <AlertDialogTitle>Remove agent from distribution?</AlertDialogTitle>
                                <AlertDialogDescription>
                                  This will remove <strong>{getAgentName(agent)}</strong> from the lead distribution system. 
                                  They will no longer receive auto-assigned leads. This can be undone by adding them back.
                                </AlertDialogDescription>
                              </AlertDialogHeader>
                              <AlertDialogFooter>
                                <AlertDialogCancel>Cancel</AlertDialogCancel>
                                <AlertDialogAction 
                                  onClick={() => handleDeleteAgent(cap.admin_user_id)}
                                  className="bg-red-600 hover:bg-red-700"
                                >
                                  Remove Agent
                                </AlertDialogAction>
                              </AlertDialogFooter>
                            </AlertDialogContent>
                          </AlertDialog>
                        </TableCell>
                      </TableRow>
                    );
                  })
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

      {/* Filter and Controls */}
      <div className="flex items-center justify-between gap-4 flex-wrap">
        <div className="flex items-center gap-3">
          <Select value={selectedAgent} onValueChange={setSelectedAgent}>
            <SelectTrigger className="w-[200px]">
              <SelectValue placeholder="Filter by agent" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all">All Agents</SelectItem>
              <SelectItem value="unassigned">Unassigned Only</SelectItem>
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
          const isExpanded = expandedAgents.has(group.agentId || 'unassigned');
          
          return (
            <Card key={group.agentId || 'unassigned'} className="overflow-hidden">
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
                            <AlertCircle className="h-5 w-5" />
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
