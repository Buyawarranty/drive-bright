import React, { useState, useMemo } from 'react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Collapsible, CollapsibleContent, CollapsibleTrigger } from '@/components/ui/collapsible';
import { Lead, AdminUser } from '@/hooks/useLeads';
import { 
  Users, ChevronDown, ChevronRight, Phone, Mail, Car, 
  Calendar, UserCircle, AlertCircle
} from 'lucide-react';
import { format } from 'date-fns';

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
  const [expandedAgents, setExpandedAgents] = useState<Set<string>>(new Set(['unassigned']));

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
  const totalStats = useMemo(() => ({
    totalLeads: leads.length,
    unassigned: leads.filter(l => !l.assigned_to).length,
    assigned: leads.filter(l => l.assigned_to).length,
    agentsWithLeads: agentGroups.filter(g => g.agentId && g.leads.length > 0).length,
    totalAgents: salesUsers.length,
  }), [leads, agentGroups, salesUsers]);

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
            <CardTitle className="text-2xl">{totalStats.agentsWithLeads} / {totalStats.totalAgents}</CardTitle>
          </CardHeader>
        </Card>
      </div>

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
