import React, { useState, useEffect, useMemo } from 'react';
import { AdminNotificationBell } from '@/components/admin/AdminNotificationBell';
import { AdminNotification } from '@/hooks/useAdminNotifications';
import { supabase } from '@/integrations/supabase/client';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { FileSpreadsheet, FileDown, Plus, Trash2, Car, ExternalLink } from 'lucide-react';
import { useToast } from '@/hooks/use-toast';
import { ClaimsAnalyticsPanel } from './claims/ClaimsAnalyticsPanel';
import { ClaimsAgeMileageAnalytics } from './claims/ClaimsAgeMileageAnalytics';
import { ClaimDetailDialog } from './claims/ClaimDetailDialog';
import { ClaimAmountEditDialog } from './claims/ClaimAmountEditDialog';
import { ClaimEmailDialog } from './claims/ClaimEmailDialog';
import { AddClaimDialog } from './claims/AddClaimDialog';
import { ClaimsTriageBlocks, getTriageFilterFn, TriageFilter } from './claims/ClaimsTriageBlocks';
import { ClaimsFilterBar, getReadinessState } from './claims/ClaimsFilterBar';
import { ClaimsEnhancedTable } from './claims/ClaimsEnhancedTable';
import { exportToCSV, exportToPDF, formatClaimForExport } from './claims/exportUtils';
import { VehicleIntelligenceExplorer } from './claims/VehicleIntelligenceExplorer';
import { RequestUpdateDialog } from './claims/RequestUpdateDialog';
import { ClaimUpdateNotifications } from './claims/ClaimUpdateNotifications';

interface ClaimSubmission {
  id: string;
  name: string;
  email: string;
  phone?: string;
  message?: string;
  file_url?: string;
  file_name?: string;
  file_size?: number;
  status: string;
  assigned_to?: string;
  created_at: string;
  updated_at: string;
  vehicle_registration?: string;
  warranty_type?: string;
  payment_amount?: number;
  claim_reason?: string;
  internal_notes?: string;
  approved_at?: string;
  rejected_at?: string;
  paid_at?: string;
  rejection_reason?: string;
  date_of_incident?: string;
  mileage_at_claim?: number;
  tag_id?: string;
  priority?: string;
  follow_up_date?: string;
  last_contacted_at?: string;
  purchase_mileage?: number;
  mileage_driven?: number;
  days_on_risk?: number;
  warranty_start_date?: string;
}

interface ClaimsTabProps {
  notifications?: AdminNotification[];
  unreadCount?: number;
  onMarkAsRead?: (id: string) => void;
  onMarkAllAsRead?: () => void;
  onNavigateToTab?: (tab: string) => void;
  userRole?: string | null;
}

export const ClaimsTab = ({
  notifications = [],
  unreadCount = 0,
  onMarkAsRead,
  onMarkAllAsRead,
  onNavigateToTab,
  userRole,
}: ClaimsTabProps) => {
  const { toast } = useToast();
  const [claims, setClaims] = useState<ClaimSubmission[]>([]);
  const [loading, setLoading] = useState(true);
  const [selectedClaim, setSelectedClaim] = useState<ClaimSubmission | null>(null);
  const [editingClaim, setEditingClaim] = useState<ClaimSubmission | null>(null);
  const [emailingClaim, setEmailingClaim] = useState<ClaimSubmission | null>(null);
  const [showAddClaimDialog, setShowAddClaimDialog] = useState(false);
  const [selectedClaimIds, setSelectedClaimIds] = useState<Set<string>>(new Set());
  const [showRequestUpdate, setShowRequestUpdate] = useState(false);
  const [activeSubTab, setActiveSubTab] = useState<'claims' | 'vehicle-intelligence'>('claims');

  // Filters
  const [triageFilter, setTriageFilter] = useState<TriageFilter>('all');
  const [statusFilter, setStatusFilter] = useState('all');
  const [priorityFilter, setPriorityFilter] = useState('all');
  const [readinessFilter, setReadinessFilter] = useState('all');
  const [warrantyFilter, setWarrantyFilter] = useState('all');
  const [costRange, setCostRange] = useState('all');
  const [searchQuery, setSearchQuery] = useState(() => {
    const params = new URLSearchParams(window.location.search);
    return params.get('search') || '';
  });
  const [dateFrom, setDateFrom] = useState('');
  const [dateTo, setDateTo] = useState('');

  useEffect(() => { fetchClaims(); }, []);

  const fetchClaims = async () => {
    try {
      const { data, error } = await supabase
        .from('claims_submissions')
        .select('*')
        .order('created_at', { ascending: false });

      if (error) {
        console.error('Error fetching claims:', error);
        toast({ title: "Error", description: "Failed to fetch claims", variant: "destructive" });
        return;
      }
      setClaims(data || []);
    } catch (error) {
      console.error('Error fetching claims:', error);
    } finally {
      setLoading(false);
    }
  };

  const handlePriorityChange = async (claimId: string, priority: string) => {
    try {
      const { error } = await supabase
        .from('claims_submissions')
        .update({ priority })
        .eq('id', claimId);
      if (error) throw error;
      toast({ title: "Priority Updated", description: `Set to ${priority}` });
      fetchClaims();
    } catch {
      toast({ title: "Error", description: "Failed to update priority", variant: "destructive" });
    }
  };

  // Avg resolution time
  const avgResolutionDays = useMemo(() => {
    const resolved = claims.filter(c => ['paid', 'resolved', 'rejected'].includes(c.status));
    if (resolved.length === 0) return 0;
    const total = resolved.reduce((sum, c) => {
      const end = c.paid_at || c.rejected_at || c.updated_at;
      return sum + Math.floor((new Date(end).getTime() - new Date(c.created_at).getTime()) / (1000 * 60 * 60 * 24));
    }, 0);
    return Math.round(total / resolved.length);
  }, [claims]);

  const uniqueWarrantyTypes = useMemo(
    () => Array.from(new Set(claims.map(c => c.warranty_type).filter(Boolean))) as string[],
    [claims]
  );

  // Filtering pipeline
  const filteredClaims = useMemo(() => {
    const triageFn = getTriageFilterFn(triageFilter);
    
    return claims.filter(claim => {
      // Hide fake/test claims unless explicitly filtering for them
      if (claim.status === 'fake_test' && statusFilter !== 'fake_test') return false;
      if (!triageFn(claim)) return false;
      if (statusFilter !== 'all' && claim.status !== statusFilter) return false;
      if (priorityFilter !== 'all' && claim.priority !== priorityFilter) return false;
      if (warrantyFilter !== 'all' && claim.warranty_type !== warrantyFilter) return false;

      if (readinessFilter !== 'all') {
        const readiness = getReadinessState(claim);
        if (readiness !== readinessFilter) return false;
      }

      if (costRange !== 'all') {
        const amt = claim.payment_amount || 0;
        if (costRange === '0-100' && (amt < 0 || amt > 100)) return false;
        if (costRange === '100-500' && (amt < 100 || amt > 500)) return false;
        if (costRange === '500-1000' && (amt < 500 || amt > 1000)) return false;
        if (costRange === '1000+' && amt < 1000) return false;
      }

      if (searchQuery) {
        const q = searchQuery.toLowerCase();
        if (
          !claim.name?.toLowerCase().includes(q) &&
          !claim.email?.toLowerCase().includes(q) &&
          !claim.vehicle_registration?.toLowerCase().includes(q) &&
          !claim.claim_reason?.toLowerCase().includes(q)
        ) return false;
      }

      if (dateFrom && new Date(claim.created_at) < new Date(dateFrom)) return false;
      if (dateTo) {
        const to = new Date(dateTo);
        to.setHours(23, 59, 59, 999);
        if (new Date(claim.created_at) > to) return false;
      }

      return true;
    });
  }, [claims, triageFilter, statusFilter, priorityFilter, readinessFilter, warrantyFilter, costRange, searchQuery, dateFrom, dateTo]);

  // Group claims
  const groupedFilteredClaims = useMemo(() => {
    // Sort by created_at descending first
    const sorted = [...filteredClaims].sort((a, b) => new Date(b.created_at).getTime() - new Date(a.created_at).getTime());
    
    const groups: (ClaimSubmission & { relatedClaimsCount: number; relatedClaims: ClaimSubmission[] })[] = [];
    const assigned = new Set<string>();

    for (const claim of sorted) {
      if (assigned.has(claim.id)) continue;

      const reg = claim.vehicle_registration?.toLowerCase().trim();
      
      // Find related claims: same reg plate, within 30 days of each other
      const related = reg
        ? sorted.filter(c => {
            if (c.id === claim.id || assigned.has(c.id)) return false;
            if (c.vehicle_registration?.toLowerCase().trim() !== reg) return false;
            const daysDiff = Math.abs(new Date(claim.created_at).getTime() - new Date(c.created_at).getTime()) / (1000 * 60 * 60 * 24);
            return daysDiff <= 30;
          })
        : [];

      assigned.add(claim.id);
      related.forEach(c => assigned.add(c.id));

      const allInGroup = [claim, ...related];
      groups.push({ ...claim, relatedClaimsCount: allInGroup.length, relatedClaims: allInGroup });
    }

    return groups;
  }, [filteredClaims]);

  const handleSelectAll = (checked: boolean) => {
    if (checked) {
      const allIds = new Set<string>();
      groupedFilteredClaims.forEach(g => g.relatedClaims.forEach(c => allIds.add(c.id)));
      setSelectedClaimIds(allIds);
    } else {
      setSelectedClaimIds(new Set());
    }
  };

  const handleSelectClaim = (claimGroup: { relatedClaims: ClaimSubmission[] }, checked: boolean) => {
    const newSelected = new Set(selectedClaimIds);
    claimGroup.relatedClaims.forEach(c => checked ? newSelected.add(c.id) : newSelected.delete(c.id));
    setSelectedClaimIds(newSelected);
  };

  const handleBulkDelete = async () => {
    if (selectedClaimIds.size === 0) return;
    if (!confirm(`Delete ${selectedClaimIds.size} claim(s)? This cannot be undone.`)) return;
    setLoading(true);
    try {
      const { error } = await supabase.from('claims_submissions').delete().in('id', Array.from(selectedClaimIds));
      if (error) throw error;
      toast({ title: "Success", description: `Deleted ${selectedClaimIds.size} claim(s)` });
      setSelectedClaimIds(new Set());
      await fetchClaims();
    } catch {
      toast({ title: "Error", description: "Failed to delete claims", variant: "destructive" });
    } finally {
      setLoading(false);
    }
  };

  const downloadFile = (fileUrl: string, fileName: string) => {
    const { data } = supabase.storage.from('policy-documents').getPublicUrl(fileUrl);
    const link = document.createElement('a');
    link.href = data.publicUrl;
    link.download = fileName;
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
  };

  const handleExportCSV = () => {
    exportToCSV(filteredClaims.map(formatClaimForExport), 'claims_export');
    toast({ title: "Success", description: "Exported to CSV" });
  };

  const handleExportPDF = () => {
    exportToPDF(filteredClaims.map(formatClaimForExport), 'claims_report');
  };

  const hasActiveFilters = statusFilter !== 'all' || priorityFilter !== 'all' || readinessFilter !== 'all' ||
    warrantyFilter !== 'all' || costRange !== 'all' || searchQuery !== '' || dateFrom !== '' || dateTo !== '';

  const clearAllFilters = () => {
    setTriageFilter('all');
    setStatusFilter('all');
    setPriorityFilter('all');
    setReadinessFilter('all');
    setWarrantyFilter('all');
    setCostRange('all');
    setSearchQuery('');
    setDateFrom('');
    setDateTo('');
  };

  if (loading) {
    return (
      <div className="p-6 flex items-center justify-center h-64">
        <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-orange-600" />
      </div>
    );
  }

  return (
    <div className="p-6 space-y-5">
      {/* Header */}
      <div className="flex justify-between items-center">
        <div>
          <h1 className="text-2xl font-bold">Claims Management</h1>
          <p className="text-sm text-muted-foreground mt-1">
            {claims.length} total claims · {filteredClaims.length} shown
          </p>
        </div>
        <div className="flex items-center gap-2">
          {/* Notification Bell for admin/super_admin */}
          {(userRole === 'admin' || userRole === 'super_admin') && onMarkAsRead && onMarkAllAsRead && (
            <AdminNotificationBell
              notifications={notifications}
              unreadCount={unreadCount}
              onMarkAsRead={onMarkAsRead}
              onMarkAllAsRead={onMarkAllAsRead}
              onNavigateToTab={onNavigateToTab}
            />
          )}
          <Button
            variant="outline"
            size="sm"
            onClick={() => setActiveSubTab('vehicle-intelligence')}
            className="gap-1.5"
          >
            <Car className="h-4 w-4" /> Vehicle Intelligence
          </Button>
          <Button
            variant="outline"
            size="sm"
            onClick={() => {
              setActiveSubTab('claims');
              setTimeout(() => document.getElementById('claims-analytics-section')?.scrollIntoView({ behavior: 'smooth' }), 100);
            }}
          >
            📊 Analytics & Charts
          </Button>
          <Button onClick={() => {
            if (selectedClaimIds.size > 0) {
              setShowRequestUpdate(true);
            } else {
              toast({ title: "Select Claims", description: "Select one or more claims to request an update", variant: "destructive" });
            }
          }} variant="outline" size="sm" className="border-emerald-300 text-emerald-700 hover:bg-emerald-50">
            <ExternalLink className="h-4 w-4 mr-1" /> Request Update
          </Button>
          <Button onClick={() => setShowAddClaimDialog(true)} size="sm">
            <Plus className="h-4 w-4 mr-1" /> Add Claim
          </Button>
          <Button onClick={handleExportCSV} variant="outline" size="sm">
            <FileSpreadsheet className="h-4 w-4 mr-1" /> CSV
          </Button>
          <Button onClick={handleExportPDF} variant="outline" size="sm">
            <FileDown className="h-4 w-4 mr-1" /> PDF
          </Button>
        </div>
      </div>

      {/* Sub-tab navigation */}
      <div className="flex gap-1 border-b border-border">
        <button
          onClick={() => setActiveSubTab('claims')}
          className={`px-4 py-2 text-sm font-medium border-b-2 transition-colors ${activeSubTab === 'claims' ? 'border-orange-500 text-orange-600' : 'border-transparent text-muted-foreground hover:text-foreground'}`}
        >
          Claims List
        </button>
        <button
          onClick={() => setActiveSubTab('vehicle-intelligence')}
          className={`px-4 py-2 text-sm font-medium border-b-2 transition-colors flex items-center gap-1.5 ${activeSubTab === 'vehicle-intelligence' ? 'border-orange-500 text-orange-600' : 'border-transparent text-muted-foreground hover:text-foreground'}`}
        >
          <Car className="h-3.5 w-3.5" /> Vehicle Intelligence
        </button>
      </div>

      {/* Vehicle Intelligence Sub-tab */}
      {activeSubTab === 'vehicle-intelligence' && (
        <VehicleIntelligenceExplorer claims={claims.filter(c => c.status !== 'fake_test')} />
      )}

      {/* Claims List Sub-tab */}
      {activeSubTab === 'claims' && (
        <>
          {/* Claim Update Notifications */}
          <ClaimUpdateNotifications />
          {/* Triage Command Centre */}
          <ClaimsTriageBlocks
            claims={claims}
            activeFilter={triageFilter}
            onFilterChange={setTriageFilter}
            avgResolutionDays={avgResolutionDays}
          />

          {/* Filters */}
          <ClaimsFilterBar
            searchQuery={searchQuery}
            onSearchChange={setSearchQuery}
            statusFilter={statusFilter}
            onStatusChange={setStatusFilter}
            priorityFilter={priorityFilter}
            onPriorityChange={setPriorityFilter}
            readinessFilter={readinessFilter}
            onReadinessChange={setReadinessFilter}
            warrantyFilter={warrantyFilter}
            onWarrantyChange={setWarrantyFilter}
            costRange={costRange}
            onCostRangeChange={setCostRange}
            dateFrom={dateFrom}
            dateTo={dateTo}
            onDateFromChange={setDateFrom}
            onDateToChange={setDateTo}
            onClearAll={clearAllFilters}
            hasActiveFilters={hasActiveFilters}
            uniqueWarrantyTypes={uniqueWarrantyTypes}
          />

          {/* Bulk actions */}
          {selectedClaimIds.size > 0 && (
            <div className="flex items-center gap-3 p-3 bg-muted/50 rounded-lg border">
              <span className="text-sm font-medium">{selectedClaimIds.size} selected</span>
              <Button variant="destructive" size="sm" onClick={handleBulkDelete} disabled={loading}>
                <Trash2 className="h-4 w-4 mr-1" /> Delete
              </Button>
            </div>
          )}

          {/* Enhanced Table */}
          <Card>
            <CardContent className="p-0">
              <ClaimsEnhancedTable
                groupedClaims={groupedFilteredClaims}
                filteredClaimsCount={filteredClaims.length}
                selectedClaimIds={selectedClaimIds}
                onSelectAll={handleSelectAll}
                onSelectClaim={handleSelectClaim}
                onViewClaim={setSelectedClaim}
                onEditAmount={setEditingClaim}
                onEmailClaim={setEmailingClaim}
                onPriorityChange={handlePriorityChange}
                onStatusUpdate={fetchClaims}
                onDownloadFile={downloadFile}
                loading={loading}
              />
            </CardContent>
          </Card>

          {/* Analytics */}
          <div id="claims-analytics-section" className="scroll-mt-4 space-y-6">
            <ClaimsAnalyticsPanel claims={claims.filter(c => c.status !== 'fake_test')} />
            <ClaimsAgeMileageAnalytics claims={claims.filter(c => c.status !== 'fake_test')} />
          </div>
        </>
      )}

      {/* Dialogs */}
      {selectedClaim && (
        <ClaimDetailDialog
          claim={selectedClaim}
          open={!!selectedClaim}
          onOpenChange={(open) => !open && setSelectedClaim(null)}
          onUpdate={fetchClaims}
        />
      )}
      {editingClaim && (
        <ClaimAmountEditDialog
          claim={editingClaim}
          open={!!editingClaim}
          onOpenChange={(open) => !open && setEditingClaim(null)}
          onUpdate={fetchClaims}
        />
      )}
      {emailingClaim && (
        <ClaimEmailDialog
          claim={emailingClaim}
          open={!!emailingClaim}
          onOpenChange={(open) => !open && setEmailingClaim(null)}
          onEmailSent={fetchClaims}
        />
      )}
      <AddClaimDialog
        open={showAddClaimDialog}
        onOpenChange={setShowAddClaimDialog}
        onClaimAdded={fetchClaims}
      />
      <RequestUpdateDialog
        claims={claims.filter(c => selectedClaimIds.has(c.id)).map(c => ({
          id: c.id,
          name: c.name,
          vehicle_registration: c.vehicle_registration,
          claim_reason: c.claim_reason,
        }))}
        open={showRequestUpdate}
        onOpenChange={setShowRequestUpdate}
        onSent={() => {
          fetchClaims();
          setSelectedClaimIds(new Set());
        }}
      />
    </div>
  );
};
