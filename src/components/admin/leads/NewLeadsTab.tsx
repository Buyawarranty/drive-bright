import React, { useState, useMemo, useCallback } from 'react';
// Tabs import removed - using custom button toggle
import { Card, CardContent } from '@/components/ui/card';
import { useLeads, Lead } from '@/hooks/useLeads';
import { LeadsTable } from './LeadsTable';
import { LeadsFilters } from './LeadsFilters';
import { LeadsTableControlBar } from './LeadsTableControlBar';
import { LeadsTableFooter } from './LeadsTableFooter';
import { SalespersonDashboard } from './SalespersonDashboard';
import { ManagerDashboard } from './ManagerDashboard';
import { ManualOrderEntry } from '../ManualOrderEntry';
import { AdminNotificationBell, AdminNotification } from '@/components/admin/AdminNotificationBell';
import { Users, UserCircle, LayoutDashboard, Download, FileSpreadsheet, Trash2 } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuTrigger } from '@/components/ui/dropdown-menu';
import { AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent, AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle, AlertDialogTrigger } from '@/components/ui/alert-dialog';
import { usePermissions } from '@/hooks/usePermissions';
import { useDataExport } from '@/hooks/useDataExport';
import { useDebounce } from '@/hooks/useDebounce';
import { usePagination } from '@/hooks/usePagination';

// Lead data for quote navigation
interface LeadForQuote {
  id: string;
  first_name: string | null;
  last_name: string | null;
  email: string;
  phone: string | null;
  vehicle_reg: string | null;
  vehicle_make: string | null;
  vehicle_model: string | null;
  vehicle_year: string | null;
  mileage: string | null;
  plan_interest: string | null;
}

interface NewLeadsTabProps {
  notifications?: AdminNotification[];
  unreadCount?: number;
  onMarkAsRead?: (id: string) => void;
  onMarkAllAsRead?: () => void;
  onNavigateToTab?: (tab: string, leadData?: LeadForQuote) => void;
  userRole?: string | null;
}

export const NewLeadsTab: React.FC<NewLeadsTabProps> = ({
  notifications = [],
  unreadCount = 0,
  onMarkAsRead,
  onMarkAllAsRead,
  onNavigateToTab,
  userRole,
}) => {
  const { canExportTab, hasGranularPermission } = usePermissions();
  const { exportToCSV, exportToExcel } = useDataExport();
  
  // Delete permission - admin role OR explicit delete permission
  const isAdmin = userRole === 'admin';
  const canDelete = isAdmin || hasGranularPermission('new-leads', 'delete');
  
  // Export permission - admins always can, others need explicit permission
  const canExport = isAdmin || canExportTab('new-leads') || hasGranularPermission('new-leads', 'export');
  
  // Granular permissions for sub-views
  // hasGranularPermission returns: true (granted), false (denied), undefined (not set)
  const hasAllLeadsPerm = hasGranularPermission('new-leads', 'all-leads');
  const hasTeamViewPerm = hasGranularPermission('new-leads', 'team-view');
  
  // Default behavior:
  // - all-leads: defaults to TRUE unless explicitly denied (false)
  // - my-dashboard: ALWAYS allowed (shows only user's own leads)
  // - team-view: must be explicitly granted (true)
  const canSeeAllLeads = hasAllLeadsPerm !== false; // true if undefined or true
  const canSeeMyDashboard = true; // Always allow - shows only user's own leads
  const canSeeTeamView = hasTeamViewPerm === true; // Must be explicitly granted
  
  // Determine default view based on permissions
  const getDefaultView = () => {
    if (canSeeAllLeads) return 'leads';
    if (canSeeMyDashboard) return 'my-dashboard';
    if (canSeeTeamView) return 'team-dashboard';
    return 'leads';
  };
  
  const [activeView, setActiveView] = useState<'leads' | 'my-dashboard' | 'team-dashboard'>(getDefaultView());
  const [searchTerm, setSearchTerm] = useState('');
  const [selectedLeads, setSelectedLeads] = useState<Set<string>>(new Set());

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
    migrateFromAbandonedCarts,
    deleteLeads
  } = useLeads();

  // Debounce search term to avoid filtering on every keystroke
  const debouncedSearchTerm = useDebounce(searchTerm, 300);

  const filteredLeads = useMemo(() => {
    if (!debouncedSearchTerm) return leads;
    
    const term = debouncedSearchTerm.toLowerCase();
    return leads.filter(lead => 
      lead.email.toLowerCase().includes(term) ||
      (lead.first_name?.toLowerCase().includes(term)) ||
      (lead.last_name?.toLowerCase().includes(term)) ||
      (lead.phone?.toLowerCase().includes(term)) ||
      (lead.vehicle_reg?.toLowerCase().includes(term)) ||
      (lead.plan_interest?.toLowerCase().includes(term))
    );
  }, [leads, debouncedSearchTerm]);

  // Pagination for leads table
  const pagination = usePagination(filteredLeads, { initialPageSize: 50 });

  const leadCounts = useMemo(() => ({
    all: leads.length,
    new: leads.filter(l => l.status === 'new').length,
    contacted: leads.filter(l => l.status === 'contacted').length,
    follow_up: leads.filter(l => l.status === 'follow_up').length,
    paid: leads.filter(l => l.is_paid === true).length,
    lost: leads.filter(l => l.status === 'lost').length,
    high_priority: leads.filter(l => l.priority === 'high' || l.priority === 'urgent').length,
  }), [leads]);

  // Memoize handlers to prevent re-renders
  const handleSelectLead = useCallback((leadId: string) => {
    setSelectedLeads(prev => {
      const newSelected = new Set(prev);
      if (newSelected.has(leadId)) {
        newSelected.delete(leadId);
      } else {
        newSelected.add(leadId);
      }
      return newSelected;
    });
  }, []);

  const handleSelectAll = useCallback(() => {
    setSelectedLeads(prev => {
      if (prev.size === filteredLeads.length) {
        return new Set();
      } else {
        return new Set(filteredLeads.map(l => l.id));
      }
    });
  }, [filteredLeads]);

  // Memoize tab change handler for instant switching
  const handleViewChange = useCallback((view: 'leads' | 'my-dashboard' | 'team-dashboard') => {
    setActiveView(view);
  }, []);

  const handleExport = useCallback((format: 'csv' | 'xlsx') => {
    // Export selected leads if any are selected, otherwise export all filtered leads
    const leadsToExport = selectedLeads.size > 0 
      ? filteredLeads.filter(lead => selectedLeads.has(lead.id))
      : filteredLeads;

    const exportData = leadsToExport.map(lead => ({
      'First Name': lead.first_name || '',
      'Last Name': lead.last_name || '',
      'Email': lead.email,
      'Phone': lead.phone || '',
      'Status': lead.status,
      'Priority': lead.priority,
      'Source': lead.lead_source,
      'Vehicle Reg': lead.vehicle_reg || '',
      'Vehicle': `${lead.vehicle_make || ''} ${lead.vehicle_model || ''} ${lead.vehicle_year || ''}`.trim(),
      'Plan Interest': lead.plan_interest || '',
      'Quote Amount': lead.quote_amount || '',
      'Assigned To': lead.assigned_user?.email || 'Unassigned',
      'Last Contacted': lead.last_contacted_at || '',
      'Created At': lead.created_at,
      'Notes': lead.notes || '',
    }));

    if (format === 'csv') {
      exportToCSV(exportData, { filename: 'leads', format: 'csv' });
    } else {
      exportToExcel(exportData, { filename: 'leads', format: 'xlsx' });
    }
  }, [selectedLeads, filteredLeads, exportToCSV, exportToExcel]);

  const handleDeleteSelected = useCallback(async () => {
    if (selectedLeads.size === 0) return;
    
    await deleteLeads(Array.from(selectedLeads));
    setSelectedLeads(new Set());
  }, [selectedLeads, deleteLeads]);

  // Memoize quote navigation handler
  const handleSendQuote = useCallback((lead: Lead) => {
    if (onNavigateToTab) {
      onNavigateToTab('get-quote', {
        id: lead.id,
        first_name: lead.first_name,
        last_name: lead.last_name,
        email: lead.email,
        phone: lead.phone,
        vehicle_reg: lead.vehicle_reg,
        vehicle_make: lead.vehicle_make,
        vehicle_model: lead.vehicle_model,
        vehicle_year: lead.vehicle_year,
        mileage: lead.mileage,
        plan_interest: lead.plan_interest,
      });
    }
  }, [onNavigateToTab]);

  // Memoize shared lead handlers for dashboards
  const leadHandlers = useMemo(() => ({
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
    deleteLeads,
  }), [
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
    deleteLeads,
  ]);

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
          {/* Notification Bell */}
          {onMarkAsRead && onMarkAllAsRead && (
            <AdminNotificationBell
              notifications={notifications}
              unreadCount={unreadCount}
              onMarkAsRead={onMarkAsRead}
              onMarkAllAsRead={onMarkAllAsRead}
              onNavigateToTab={onNavigateToTab}
            />
          )}
          
          
          {/* Export Button - Permission Controlled */}
          {canExport && (
            <DropdownMenu>
              <DropdownMenuTrigger asChild>
                <Button variant="outline" size="sm" className="gap-2">
                  <Download className="h-4 w-4" />
                  <span className="hidden sm:inline">
                    Export{selectedLeads.size > 0 ? ` (${selectedLeads.size})` : ''}
                  </span>
                </Button>
              </DropdownMenuTrigger>
              <DropdownMenuContent align="end">
                <DropdownMenuItem onClick={() => handleExport('csv')}>
                  <Download className="h-4 w-4 mr-2" />
                  Export {selectedLeads.size > 0 ? `${selectedLeads.size} selected` : 'all'} as CSV
                </DropdownMenuItem>
                <DropdownMenuItem onClick={() => handleExport('xlsx')}>
                  <FileSpreadsheet className="h-4 w-4 mr-2" />
                  Export {selectedLeads.size > 0 ? `${selectedLeads.size} selected` : 'all'} as Excel
                </DropdownMenuItem>
              </DropdownMenuContent>
            </DropdownMenu>
          )}

          {/* Delete Button - Shows when leads selected and user has delete permission */}
          {canDelete && selectedLeads.size > 0 && (
            <AlertDialog>
              <AlertDialogTrigger asChild>
                <Button variant="destructive" size="sm" className="gap-2">
                  <Trash2 className="h-4 w-4" />
                  <span className="hidden sm:inline">Delete ({selectedLeads.size})</span>
                </Button>
              </AlertDialogTrigger>
              <AlertDialogContent>
                <AlertDialogHeader>
                  <AlertDialogTitle>Delete {selectedLeads.size} lead{selectedLeads.size > 1 ? 's' : ''}?</AlertDialogTitle>
                  <AlertDialogDescription>
                    This action cannot be undone. This will permanently delete the selected lead{selectedLeads.size > 1 ? 's' : ''} and all associated data.
                  </AlertDialogDescription>
                </AlertDialogHeader>
                <AlertDialogFooter>
                  <AlertDialogCancel>Cancel</AlertDialogCancel>
                  <AlertDialogAction 
                    onClick={handleDeleteSelected}
                    className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
                  >
                    Delete
                  </AlertDialogAction>
                </AlertDialogFooter>
              </AlertDialogContent>
            </AlertDialog>
          )}
          
          {/* Add Manual Order Button */}
          <ManualOrderEntry />
          
          {/* View Toggle - Optimized with useCallback */}
          <div className="flex items-center border rounded-lg bg-muted/50 p-1">
            {canSeeAllLeads && (
              <Button 
                variant={activeView === 'leads' ? 'default' : 'ghost'}
                size="sm"
                onClick={() => handleViewChange('leads')}
                className="flex items-center gap-2 transition-none"
              >
                <LayoutDashboard className="h-4 w-4" />
                <span className="hidden sm:inline">All Leads</span>
              </Button>
            )}
            {canSeeMyDashboard && (
              <Button 
                variant={activeView === 'my-dashboard' ? 'default' : 'ghost'}
                size="sm"
                onClick={() => handleViewChange('my-dashboard')}
                className="flex items-center gap-2 transition-none"
              >
                <UserCircle className="h-4 w-4" />
                <span className="hidden sm:inline">My Dashboard</span>
              </Button>
            )}
            {canSeeTeamView && (
              <Button 
                variant={activeView === 'team-dashboard' ? 'default' : 'ghost'}
                size="sm"
                onClick={() => handleViewChange('team-dashboard')}
                className="flex items-center gap-2 transition-none"
              >
                <Users className="h-4 w-4" />
                <span className="hidden sm:inline">Team View</span>
              </Button>
            )}
          </div>
        </div>
      </div>

      {/* Content based on view - Using CSS visibility for instant switching */}
      <div className={activeView === 'leads' ? 'block' : 'hidden'}>
        <div className="space-y-4">
          <LeadsFilters
            filter={filter}
            onFilterChange={setFilter}
            searchTerm={searchTerm}
            onSearchChange={setSearchTerm}
            onRefresh={fetchLeads}
            onMigrate={migrateFromAbandonedCarts}
            onExport={handleExport}
            leadCounts={leadCounts}
          />
          
          <Card className="overflow-hidden">
            <CardContent className="p-0">
              {/* Sticky Control Bar */}
              <LeadsTableControlBar
                totalItems={pagination.totalItems}
                pageSize={pagination.pageSize}
                onPageSizeChange={pagination.setPageSize}
                selectedCount={selectedLeads.size}
                totalVisible={pagination.paginatedData.length}
                allSelected={selectedLeads.size === filteredLeads.length && filteredLeads.length > 0}
                onSelectAll={handleSelectAll}
              />
              
              <LeadsTable
                leads={pagination.paginatedData}
                tags={tags}
                salesUsers={salesUsers}
                selectedLeads={selectedLeads}
                onSelectLead={handleSelectLead}
                onSelectAll={handleSelectAll}
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
                onRefresh={fetchLeads}
                onSendQuote={handleSendQuote}
              />
              
              {/* Lightweight Footer Pagination */}
              <LeadsTableFooter
                currentPage={pagination.currentPage}
                totalPages={pagination.totalPages}
                totalItems={pagination.totalItems}
                startIndex={pagination.startIndex}
                endIndex={pagination.endIndex}
                onPageChange={pagination.goToPage}
                canGoNext={pagination.canGoNext}
                canGoPrev={pagination.canGoPrev}
              />
            </CardContent>
          </Card>
        </div>
      </div>

      {/* Pre-render dashboards but hide them - keeps state and avoids re-fetching */}
      <div className={activeView === 'my-dashboard' ? 'block' : 'hidden'}>
        <SalespersonDashboard 
          leads={leads}
          tags={tags}
          salesUsers={salesUsers}
          handlers={leadHandlers}
        />
      </div>
      
      <div className={activeView === 'team-dashboard' ? 'block' : 'hidden'}>
        <ManagerDashboard />
      </div>
    </div>
  );
};
