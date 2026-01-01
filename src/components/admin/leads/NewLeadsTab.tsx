import React, { useState, useMemo } from 'react';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { useLeads, Lead } from '@/hooks/useLeads';
import { LeadsTable } from './LeadsTable';
import { LeadsFilters } from './LeadsFilters';
import { SalespersonDashboard } from './SalespersonDashboard';
import { ManagerDashboard } from './ManagerDashboard';
import { ManualOrderEntry } from '../ManualOrderEntry';
import { Users, UserCircle, LayoutDashboard } from 'lucide-react';

export const NewLeadsTab: React.FC = () => {
  const [activeView, setActiveView] = useState<'leads' | 'my-dashboard' | 'team-dashboard'>('leads');
  const [searchTerm, setSearchTerm] = useState('');
  
  const {
    leads,
    tags,
    salesUsers,
    loading,
    filter,
    setFilter,
    fetchLeads,
    updateLeadStatus,
    assignLead,
    autoAssignLead,
    updateLeadPriority,
    scheduleFollowUp,
    addTagToLead,
    removeTagFromLead,
    updateLeadNotes,
    markContactedAt,
    logActivity,
    migrateFromAbandonedCarts
  } = useLeads();

  const filteredLeads = useMemo(() => {
    if (!searchTerm) return leads;
    
    const term = searchTerm.toLowerCase();
    return leads.filter(lead => 
      lead.email.toLowerCase().includes(term) ||
      (lead.first_name?.toLowerCase().includes(term)) ||
      (lead.last_name?.toLowerCase().includes(term)) ||
      (lead.phone?.toLowerCase().includes(term)) ||
      (lead.vehicle_reg?.toLowerCase().includes(term)) ||
      (lead.plan_interest?.toLowerCase().includes(term))
    );
  }, [leads, searchTerm]);

  const leadCounts = useMemo(() => ({
    all: leads.length,
    new: leads.filter(l => l.status === 'new').length,
    contacted: leads.filter(l => l.status === 'contacted').length,
    follow_up: leads.filter(l => l.status === 'follow_up').length,
    converted: leads.filter(l => l.status === 'converted').length,
    lost: leads.filter(l => l.status === 'lost').length,
    high_priority: leads.filter(l => l.priority === 'high' || l.priority === 'urgent').length,
  }), [leads]);

  if (loading) {
    return (
      <div className="flex items-center justify-center h-64">
        <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-orange-500"></div>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold">New Leads</h1>
          <p className="text-muted-foreground">Manage and track your sales pipeline</p>
        </div>
        
        <div className="flex items-center gap-3">
          {/* Add Manual Order Button */}
          <ManualOrderEntry />
          
          {/* View Toggle */}
          <Tabs value={activeView} onValueChange={(v) => setActiveView(v as any)}>
            <TabsList>
              <TabsTrigger value="leads" className="flex items-center gap-2">
                <LayoutDashboard className="h-4 w-4" />
                All Leads
              </TabsTrigger>
              <TabsTrigger value="my-dashboard" className="flex items-center gap-2">
                <UserCircle className="h-4 w-4" />
                My Dashboard
              </TabsTrigger>
              <TabsTrigger value="team-dashboard" className="flex items-center gap-2">
                <Users className="h-4 w-4" />
                Team View
              </TabsTrigger>
            </TabsList>
          </Tabs>
        </div>
      </div>

      {/* Content based on view */}
      {activeView === 'leads' && (
        <div className="space-y-4">
          <LeadsFilters
            filter={filter}
            onFilterChange={setFilter}
            searchTerm={searchTerm}
            onSearchChange={setSearchTerm}
            onRefresh={fetchLeads}
            onMigrate={migrateFromAbandonedCarts}
            leadCounts={leadCounts}
          />
          
          <Card>
            <CardContent className="pt-6">
              <LeadsTable
                leads={filteredLeads}
                tags={tags}
                salesUsers={salesUsers}
                onUpdateStatus={updateLeadStatus}
                onAssign={assignLead}
                onAutoAssign={autoAssignLead}
                onUpdatePriority={updateLeadPriority}
                onScheduleFollowUp={scheduleFollowUp}
                onAddTag={addTagToLead}
                onRemoveTag={removeTagFromLead}
                onUpdateNotes={updateLeadNotes}
                onMarkContacted={markContactedAt}
                onLogActivity={logActivity}
              />
            </CardContent>
          </Card>
        </div>
      )}

      {activeView === 'my-dashboard' && <SalespersonDashboard />}
      {activeView === 'team-dashboard' && <ManagerDashboard />}
    </div>
  );
};
