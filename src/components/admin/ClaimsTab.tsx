import React, { useState, useEffect, useMemo } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { FileSpreadsheet, FileDown, Plus, Trash2 } from 'lucide-react';
import { useToast } from '@/hooks/use-toast';
import { ClaimsAnalyticsPanel } from './claims/ClaimsAnalyticsPanel';
import { ClaimDetailDialog } from './claims/ClaimDetailDialog';
import { ClaimAmountEditDialog } from './claims/ClaimAmountEditDialog';
import { ClaimEmailDialog } from './claims/ClaimEmailDialog';
import { AddClaimDialog } from './claims/AddClaimDialog';
import { ClaimsTriageBlocks, getTriageFilterFn, TriageFilter } from './claims/ClaimsTriageBlocks';
import { ClaimsFilterBar, getReadinessState } from './claims/ClaimsFilterBar';
import { ClaimsEnhancedTable } from './claims/ClaimsEnhancedTable';
import { exportToCSV, exportToPDF, formatClaimForExport } from './claims/exportUtils';

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
}

export const ClaimsTab = () => {
  const { toast } = useToast();
  const [claims, setClaims] = useState<ClaimSubmission[]>([]);
  const [loading, setLoading] = useState(true);
  const [selectedClaim, setSelectedClaim] = useState<ClaimSubmission | null>(null);
  const [editingClaim, setEditingClaim] = useState<ClaimSubmission | null>(null);
  const [emailingClaim, setEmailingClaim] = useState<ClaimSubmission | null>(null);
  const [showAddClaimDialog, setShowAddClaimDialog] = useState(false);
  const [selectedClaimIds, setSelectedClaimIds] = useState<Set<string>>(new Set());

  // Filters
  const [triageFilter, setTriageFilter] = useState<TriageFilter>('all');
  const [statusFilter, setStatusFilter] = useState('all');
  const [priorityFilter, setPriorityFilter] = useState('all');
  const [readinessFilter, setReadinessFilter] = useState('all');
  const [warrantyFilter, setWarrantyFilter] = useState('all');
  const [costRange, setCostRange] = useState('all');
  const [searchQuery, setSearchQuery] = useState('');
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
    const grouped = new Map<string, ClaimSubmission[]>();
    filteredClaims.forEach(claim => {
      const reasonKey = claim.claim_reason?.toLowerCase().trim() || `unique_${claim.id}`;
      const key = `${claim.email.toLowerCase()}_${reasonKey}`;
      if (!grouped.has(key)) grouped.set(key, []);
      grouped.get(key)!.push(claim);
    });

    const result: (ClaimSubmission & { relatedClaimsCount: number; relatedClaims: ClaimSubmission[] })[] = [];
    grouped.forEach((claimsInGroup) => {
      claimsInGroup.sort((a, b) => new Date(b.created_at).getTime() - new Date(a.created_at).getTime());
      result.push({ ...claimsInGroup[0], relatedClaimsCount: claimsInGroup.length, relatedClaims: claimsInGroup });
    });
    result.sort((a, b) => new Date(b.created_at).getTime() - new Date(a.created_at).getTime());
    return result;
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
        <div className="flex gap-2">
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

      {/* Analytics (collapsible below) */}
      <details>
        <summary className="cursor-pointer text-sm font-medium text-muted-foreground hover:text-foreground transition-colors py-2">
          📊 Show Analytics & Charts
        </summary>
        <div className="mt-3">
          <ClaimsAnalyticsPanel claims={claims} />
        </div>
      </details>

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
    </div>
  );
};
