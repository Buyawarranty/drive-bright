import React, { useState, useEffect } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Input } from '@/components/ui/input';
import { Checkbox } from '@/components/ui/checkbox';
import { Eye, Download, Calendar, User, Mail, Phone, Paperclip, FileDown, FileSpreadsheet, Search, Filter, Trash2, Edit, Clock, Send, AlertTriangle, ArrowUp, ArrowDown, Minus, Plus } from 'lucide-react';
import { useToast } from '@/hooks/use-toast';
import { ClaimsAnalyticsPanel } from './claims/ClaimsAnalyticsPanel';
import { ClaimDetailDialog } from './claims/ClaimDetailDialog';
import { ClaimAmountEditDialog } from './claims/ClaimAmountEditDialog';
import { ClaimStatusDropdown } from './claims/ClaimStatusDropdown';
import { ClaimEmailDialog } from './claims/ClaimEmailDialog';
import { ClaimPriorityBadge } from './claims/ClaimPriorityBadge';
import { exportToCSV, exportToPDF, formatClaimForExport } from './claims/exportUtils';
import { AddClaimDialog } from './claims/AddClaimDialog';

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
  const [statusFilter, setStatusFilter] = useState<string>('all');
  const [warrantyFilter, setWarrantyFilter] = useState<string>('all');
  const [priorityFilter, setPriorityFilter] = useState<string>('all');
  const [searchQuery, setSearchQuery] = useState<string>('');
  const [dateFrom, setDateFrom] = useState<string>('');
  const [dateTo, setDateTo] = useState<string>('');

  useEffect(() => {
    fetchClaims();
  }, []);

  const fetchClaims = async () => {
    try {
      const { data, error } = await supabase
        .from('claims_submissions')
        .select('*')
        .order('created_at', { ascending: false });

      if (error) {
        console.error('Error fetching claims:', error);
        toast({
          title: "Error",
          description: "Failed to fetch claims submissions",
          variant: "destructive",
        });
        return;
      }

      setClaims(data || []);
    } catch (error) {
      console.error('Error fetching claims:', error);
    } finally {
      setLoading(false);
    }
  };


  const getDaysSinceClaim = (createdAt: string) => {
    const claimDate = new Date(createdAt);
    const today = new Date();
    const diffTime = today.getTime() - claimDate.getTime();
    const diffDays = Math.floor(diffTime / (1000 * 60 * 60 * 24));
    return diffDays;
  };

  const getDaysColor = (days: number) => {
    if (days <= 3) return 'text-green-600 bg-green-50';
    if (days <= 7) return 'text-yellow-600 bg-yellow-50';
    if (days <= 14) return 'text-orange-600 bg-orange-50';
    return 'text-red-600 bg-red-50';
  };

  const handlePriorityChange = async (claimId: string, priority: string) => {
    try {
      const { error } = await supabase
        .from('claims_submissions')
        .update({ priority })
        .eq('id', claimId);

      if (error) throw error;

      toast({
        title: "Priority Updated",
        description: `Claim priority set to ${priority}`,
      });
      fetchClaims();
    } catch (error) {
      console.error('Error updating priority:', error);
      toast({
        title: "Error",
        description: "Failed to update priority",
        variant: "destructive",
      });
    }
  };

  // Group claims by customer email + claim_reason (same matter = consolidated)
  const groupClaimsByCustomer = (claimsList: ClaimSubmission[]): (ClaimSubmission & { relatedClaimsCount: number; relatedClaims: ClaimSubmission[] })[] => {
    const grouped = new Map<string, ClaimSubmission[]>();
    
    claimsList.forEach(claim => {
      // Create a key based on email + normalized claim reason
      // If claim_reason is null/empty, each claim is unique
      const reasonKey = claim.claim_reason?.toLowerCase().trim() || `unique_${claim.id}`;
      const key = `${claim.email.toLowerCase()}_${reasonKey}`;
      
      if (!grouped.has(key)) {
        grouped.set(key, []);
      }
      grouped.get(key)!.push(claim);
    });
    
    // Return the most recent claim from each group with count
    const result: (ClaimSubmission & { relatedClaimsCount: number; relatedClaims: ClaimSubmission[] })[] = [];
    grouped.forEach((claimsInGroup) => {
      // Sort by created_at descending to get the most recent
      claimsInGroup.sort((a, b) => new Date(b.created_at).getTime() - new Date(a.created_at).getTime());
      const primaryClaim = claimsInGroup[0];
      result.push({
        ...primaryClaim,
        relatedClaimsCount: claimsInGroup.length,
        relatedClaims: claimsInGroup,
      });
    });
    
    // Sort the result by created_at descending
    result.sort((a, b) => new Date(b.created_at).getTime() - new Date(a.created_at).getTime());
    
    return result;
  };

  const filteredClaims = claims.filter(claim => {
    if (statusFilter !== 'all' && claim.status !== statusFilter) return false;
    if (warrantyFilter !== 'all' && claim.warranty_type !== warrantyFilter) return false;
    if (priorityFilter !== 'all' && claim.priority !== priorityFilter) return false;
    
    if (searchQuery) {
      const query = searchQuery.toLowerCase();
      const matchesSearch = 
        claim.name?.toLowerCase().includes(query) ||
        claim.email?.toLowerCase().includes(query) ||
        claim.vehicle_registration?.toLowerCase().includes(query);
      if (!matchesSearch) return false;
    }
    
    if (dateFrom) {
      const claimDate = new Date(claim.created_at);
      const fromDate = new Date(dateFrom);
      if (claimDate < fromDate) return false;
    }
    if (dateTo) {
      const claimDate = new Date(claim.created_at);
      const toDate = new Date(dateTo);
      toDate.setHours(23, 59, 59, 999);
      if (claimDate > toDate) return false;
    }
    
    return true;
  });

  // Group claims by customer and claim reason
  const groupedFilteredClaims = groupClaimsByCustomer(filteredClaims);

  const handleExportCSV = () => {
    const exportData = filteredClaims.map(formatClaimForExport);
    exportToCSV(exportData, 'claims_export');
    toast({
      title: "Success",
      description: "Claims exported to CSV successfully",
    });
  };

  const handleExportPDF = () => {
    const exportData = filteredClaims.map(formatClaimForExport);
    exportToPDF(exportData, 'claims_report');
  };

  const downloadFile = (fileUrl: string, fileName: string) => {
    const { data } = supabase.storage
      .from('policy-documents')
      .getPublicUrl(fileUrl);
    
    const link = document.createElement('a');
    link.href = data.publicUrl;
    link.download = fileName;
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
  };

  const uniqueWarrantyTypes = Array.from(new Set(claims.map(c => c.warranty_type).filter(Boolean)));

  const handleSelectAll = (checked: boolean) => {
    if (checked) {
      // Select all individual claim IDs from grouped claims
      const allIds = new Set<string>();
      groupedFilteredClaims.forEach(group => {
        group.relatedClaims.forEach(claim => allIds.add(claim.id));
      });
      setSelectedClaimIds(allIds);
    } else {
      setSelectedClaimIds(new Set());
    }
  };

  const handleSelectClaim = (claimGroup: { relatedClaims: ClaimSubmission[] }, checked: boolean) => {
    const newSelected = new Set(selectedClaimIds);
    claimGroup.relatedClaims.forEach(claim => {
      if (checked) {
        newSelected.add(claim.id);
      } else {
        newSelected.delete(claim.id);
      }
    });
    setSelectedClaimIds(newSelected);
  };

  const handleBulkDelete = async () => {
    if (selectedClaimIds.size === 0) {
      toast({
        title: "No Selection",
        description: "Please select claims to delete",
        variant: "destructive",
      });
      return;
    }

    if (!confirm(`Are you sure you want to delete ${selectedClaimIds.size} claim(s)? This action cannot be undone.`)) {
      return;
    }

    setLoading(true);
    try {
      const { error } = await supabase
        .from('claims_submissions')
        .delete()
        .in('id', Array.from(selectedClaimIds));

      if (error) throw error;

      toast({
        title: "Success",
        description: `Deleted ${selectedClaimIds.size} claim(s) successfully`,
      });
      
      setSelectedClaimIds(new Set());
      await fetchClaims();
    } catch (error) {
      console.error('Error deleting claims:', error);
      toast({
        title: "Error",
        description: "Failed to delete claims",
        variant: "destructive",
      });
    } finally {
      setLoading(false);
    }
  };

  if (loading) {
    return (
      <div className="p-6">
        <div className="flex items-center justify-center h-64">
          <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-orange-600"></div>
        </div>
      </div>
    );
  }

  return (
    <div className="p-6 space-y-6">
      {/* Header */}
      <div className="flex justify-between items-center">
        <div>
          <h1 className="text-3xl font-bold text-gray-900">Claims Management</h1>
          <p className="text-gray-600 mt-2">Comprehensive claims tracking and management system</p>
        </div>
        <div className="flex gap-2">
          <Button onClick={() => setShowAddClaimDialog(true)}>
            <Plus className="h-4 w-4 mr-2" />
            Add Claim
          </Button>
          <Button onClick={handleExportCSV} variant="outline">
            <FileSpreadsheet className="h-4 w-4 mr-2" />
            Export CSV
          </Button>
          <Button onClick={handleExportPDF} variant="outline">
            <FileDown className="h-4 w-4 mr-2" />
            Export PDF
          </Button>
        </div>
      </div>

      {/* Analytics Panel with charts, date filter, and summary */}
      <ClaimsAnalyticsPanel claims={claims} />

      {/* Filters */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Filter className="h-5 w-5" />
            Filters & Search
          </CardTitle>
          <CardDescription>Filter and search through claims submissions</CardDescription>
        </CardHeader>
        <CardContent>
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-6 gap-4">
            {/* Search */}
            <div className="lg:col-span-2">
              <div className="relative">
                <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 h-4 w-4 text-gray-400" />
                <Input
                  placeholder="Search by name, email, or vehicle reg..."
                  value={searchQuery}
                  onChange={(e) => setSearchQuery(e.target.value)}
                  className="pl-10"
                />
              </div>
            </div>

            {/* Status Filter */}
            <Select value={statusFilter} onValueChange={setStatusFilter}>
              <SelectTrigger>
                <SelectValue placeholder="Filter by status" />
              </SelectTrigger>
              <SelectContent className="bg-background border shadow-lg z-50">
                <SelectItem value="all">All Statuses</SelectItem>
                <SelectItem value="new">New</SelectItem>
                <SelectItem value="in_progress">In Progress</SelectItem>
                <SelectItem value="awaiting_info">Awaiting Info</SelectItem>
                <SelectItem value="approved">Approved</SelectItem>
                <SelectItem value="paid">Paid</SelectItem>
                <SelectItem value="rejected">Rejected</SelectItem>
                <SelectItem value="resolved">Resolved</SelectItem>
              </SelectContent>
            </Select>

            {/* Priority Filter */}
            <Select value={priorityFilter} onValueChange={setPriorityFilter}>
              <SelectTrigger>
                <SelectValue placeholder="Filter by priority" />
              </SelectTrigger>
              <SelectContent className="bg-background border shadow-lg z-50">
                <SelectItem value="all">All Priorities</SelectItem>
                <SelectItem value="urgent">Urgent</SelectItem>
                <SelectItem value="high">High</SelectItem>
                <SelectItem value="normal">Normal</SelectItem>
                <SelectItem value="low">Low</SelectItem>
              </SelectContent>
            </Select>

            {/* Date From */}
            <Input
              type="date"
              value={dateFrom}
              onChange={(e) => setDateFrom(e.target.value)}
              placeholder="From date"
            />

            {/* Date To */}
            <Input
              type="date"
              value={dateTo}
              onChange={(e) => setDateTo(e.target.value)}
              placeholder="To date"
            />
          </div>

          {/* Active Filters Display */}
          {(statusFilter !== 'all' || warrantyFilter !== 'all' || priorityFilter !== 'all' || searchQuery || dateFrom || dateTo) && (
            <div className="flex flex-wrap gap-2 mt-4 pt-4 border-t">
              <span className="text-sm font-medium text-gray-600">Active Filters:</span>
              {statusFilter !== 'all' && (
                <Badge variant="outline">Status: {statusFilter.replace('_', ' ').toUpperCase()}</Badge>
              )}
              {priorityFilter !== 'all' && (
                <Badge variant="outline">Priority: {priorityFilter}</Badge>
              )}
              {warrantyFilter !== 'all' && (
                <Badge variant="outline">Warranty: {warrantyFilter}</Badge>
              )}
              {searchQuery && (
                <Badge variant="outline">Search: {searchQuery}</Badge>
              )}
              {dateFrom && (
                <Badge variant="outline">From: {dateFrom}</Badge>
              )}
              {dateTo && (
                <Badge variant="outline">To: {dateTo}</Badge>
              )}
              <Button 
                variant="ghost" 
                size="sm" 
                onClick={() => {
                  setStatusFilter('all');
                  setWarrantyFilter('all');
                  setPriorityFilter('all');
                  setSearchQuery('');
                  setDateFrom('');
                  setDateTo('');
                }}
              >
                Clear All
              </Button>
            </div>
          )}
        </CardContent>
      </Card>

      {/* Claims Table */}
      <Card>
        <CardHeader>
          <div className="flex items-center justify-between">
            <div>
              <CardTitle>Claims Submissions ({groupedFilteredClaims.length} groups, {filteredClaims.length} total)</CardTitle>
              <CardDescription>
                All claim submissions including website forms and emails to claims@buyawarranty.co.uk
              </CardDescription>
            </div>
            {selectedClaimIds.size > 0 && (
              <Button 
                variant="destructive" 
                onClick={handleBulkDelete}
                disabled={loading}
              >
                <Trash2 className="h-4 w-4 mr-2" />
                Delete ({selectedClaimIds.size})
              </Button>
            )}
          </div>
        </CardHeader>
        <CardContent>
          {groupedFilteredClaims.length === 0 ? (
            <div className="text-center py-8">
              <FileSpreadsheet className="mx-auto h-12 w-12 text-gray-400 mb-4" />
              <h3 className="text-lg font-medium text-gray-900 mb-2">No claims found</h3>
              <p className="text-gray-600">
                {claims.length === 0 
                  ? 'No claims have been submitted yet.' 
                  : 'No claims match your current filters.'
                }
              </p>
            </div>
          ) : (
            <div className="overflow-x-auto">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead className="w-12">
                      <Checkbox
                        checked={groupedFilteredClaims.length > 0 && selectedClaimIds.size === filteredClaims.length}
                        onCheckedChange={handleSelectAll}
                        aria-label="Select all claims"
                      />
                    </TableHead>
                    <TableHead>
                      <div className="flex items-center gap-1">
                        <Clock className="h-4 w-4" />
                        Days
                      </div>
                    </TableHead>
                    <TableHead>Date</TableHead>
                    <TableHead>Customer</TableHead>
                    <TableHead>Claim Reason</TableHead>
                    <TableHead>Vehicle Reg</TableHead>
                    <TableHead>Status</TableHead>
                    <TableHead>Priority</TableHead>
                    <TableHead>Payment</TableHead>
                    <TableHead>Attachment</TableHead>
                    <TableHead>Actions</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {groupedFilteredClaims.map((claimGroup) => {
                    const claim = claimGroup; // Primary claim in the group
                    const daysSinceClaim = getDaysSinceClaim(claim.created_at);
                    const isGroupSelected = claimGroup.relatedClaims.every(c => selectedClaimIds.has(c.id));
                    const totalPayment = claimGroup.relatedClaims.reduce((sum, c) => sum + (c.payment_amount || 0), 0);
                    
                    return (
                      <TableRow key={claim.id} className={claimGroup.relatedClaimsCount > 1 ? 'bg-blue-50/50' : ''}>
                        <TableCell>
                          <Checkbox
                            checked={isGroupSelected}
                            onCheckedChange={(checked) => handleSelectClaim(claimGroup, checked as boolean)}
                            aria-label={`Select claim group ${claim.id}`}
                          />
                        </TableCell>
                        <TableCell>
                          <div className={`inline-flex items-center gap-1 px-2 py-1 rounded-full text-xs font-bold ${getDaysColor(daysSinceClaim)}`}>
                            <Clock className="h-3 w-3" />
                            {daysSinceClaim}d
                          </div>
                        </TableCell>
                        <TableCell>
                          <div className="flex items-center gap-2">
                            <Calendar className="h-4 w-4 text-gray-400" />
                            <div>
                              <div className="font-medium text-sm">
                                {new Date(claim.created_at).toLocaleDateString('en-GB')}
                              </div>
                              <div className="text-xs text-gray-500">
                                {new Date(claim.created_at).toLocaleTimeString('en-GB', { hour: '2-digit', minute: '2-digit' })}
                              </div>
                            </div>
                          </div>
                        </TableCell>
                        <TableCell>
                          <div className="space-y-1">
                            <div className="flex items-center gap-2">
                              <User className="h-4 w-4 text-gray-400" />
                              <span className="font-medium text-sm">{claim.name}</span>
                              {claimGroup.relatedClaimsCount > 1 && (
                                <Badge variant="secondary" className="text-xs">
                                  {claimGroup.relatedClaimsCount} submissions
                                </Badge>
                              )}
                            </div>
                            <div className="flex items-center gap-2 text-xs">
                              <Mail className="h-3 w-3 text-gray-400" />
                              <a 
                                href={`mailto:${claim.email}`}
                                className="text-blue-600 hover:underline"
                              >
                                {claim.email}
                              </a>
                            </div>
                            {claim.phone && (
                              <div className="flex items-center gap-2 text-xs">
                                <Phone className="h-3 w-3 text-gray-400" />
                                <a 
                                  href={`tel:${claim.phone}`}
                                  className="text-blue-600 hover:underline"
                                >
                                  {claim.phone}
                                </a>
                              </div>
                            )}
                          </div>
                        </TableCell>
                        <TableCell>
                          <span className="text-sm text-gray-700 max-w-[200px] truncate block" title={claim.claim_reason || '-'}>
                            {claim.claim_reason || '-'}
                          </span>
                        </TableCell>
                        <TableCell>
                          <span className="font-mono text-sm bg-gray-100 px-2 py-1 rounded">
                            {claim.vehicle_registration || '-'}
                          </span>
                        </TableCell>
                        <TableCell>
                          <ClaimStatusDropdown
                            claimId={claim.id}
                            currentTagId={claim.tag_id}
                            currentStatus={claim.status}
                            onUpdate={fetchClaims}
                          />
                        </TableCell>
                        <TableCell>
                          <Select
                            value={claim.priority || 'normal'}
                            onValueChange={(value) => handlePriorityChange(claim.id, value)}
                          >
                            <SelectTrigger className="w-[100px] h-7 text-xs">
                              <SelectValue />
                            </SelectTrigger>
                            <SelectContent className="bg-background border shadow-lg z-50">
                              <SelectItem value="urgent">
                                <div className="flex items-center gap-1 text-red-600">
                                  <AlertTriangle className="h-3 w-3" /> Urgent
                                </div>
                              </SelectItem>
                              <SelectItem value="high">
                                <div className="flex items-center gap-1 text-orange-600">
                                  <ArrowUp className="h-3 w-3" /> High
                                </div>
                              </SelectItem>
                              <SelectItem value="normal">
                                <div className="flex items-center gap-1 text-blue-600">
                                  <Minus className="h-3 w-3" /> Normal
                                </div>
                              </SelectItem>
                              <SelectItem value="low">
                                <div className="flex items-center gap-1 text-gray-600">
                                  <ArrowDown className="h-3 w-3" /> Low
                                </div>
                              </SelectItem>
                            </SelectContent>
                          </Select>
                        </TableCell>
                        <TableCell>
                          <div className="flex items-center gap-1">
                            {totalPayment > 0 ? (
                              <span className="font-semibold text-green-600">
                                £{totalPayment.toLocaleString('en-GB', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
                              </span>
                            ) : (
                              <span className="text-gray-400 text-sm">£0.00</span>
                            )}
                            <Button
                              variant="ghost"
                              size="sm"
                              onClick={() => setEditingClaim(claim)}
                              className="h-6 w-6 p-0"
                              title={totalPayment > 0 ? "Edit amount" : "Add payment amount"}
                            >
                              <Edit className="h-3 w-3 text-blue-600" />
                            </Button>
                          </div>
                        </TableCell>
                        <TableCell>
                          {claim.file_url && claim.file_name ? (
                            <Button
                              variant="ghost"
                              size="sm"
                              onClick={() => downloadFile(claim.file_url!, claim.file_name!)}
                              className="p-0 h-auto"
                            >
                              <Paperclip className="h-4 w-4 text-blue-600" />
                            </Button>
                          ) : (
                            <span className="text-gray-400">-</span>
                          )}
                        </TableCell>
                        <TableCell>
                          <div className="flex items-center gap-1">
                            <Button 
                              variant="ghost" 
                              size="sm"
                              onClick={() => setSelectedClaim(claim)}
                            >
                              <Eye className="h-4 w-4 mr-1" />
                              View
                            </Button>
                            <Button
                              variant="ghost"
                              size="sm"
                              onClick={() => setEmailingClaim(claim)}
                              title="Send email to claims department"
                            >
                              <Send className="h-4 w-4 text-blue-600" />
                            </Button>
                          </div>
                        </TableCell>
                      </TableRow>
                    );
                  })}
                </TableBody>
              </Table>
            </div>
          )}
        </CardContent>
      </Card>

      {/* Claim Detail Dialog */}
      {selectedClaim && (
        <ClaimDetailDialog
          claim={selectedClaim}
          open={!!selectedClaim}
          onOpenChange={(open) => !open && setSelectedClaim(null)}
          onUpdate={fetchClaims}
        />
      )}

      {/* Claim Amount Edit Dialog */}
      {editingClaim && (
        <ClaimAmountEditDialog
          claim={editingClaim}
          open={!!editingClaim}
          onOpenChange={(open) => !open && setEditingClaim(null)}
          onUpdate={fetchClaims}
        />
      )}

      {/* Claim Email Dialog */}
      {emailingClaim && (
        <ClaimEmailDialog
          claim={emailingClaim}
          open={!!emailingClaim}
          onOpenChange={(open) => !open && setEmailingClaim(null)}
          onEmailSent={fetchClaims}
        />
      )}

      {/* Add Claim Dialog */}
      <AddClaimDialog
        open={showAddClaimDialog}
        onOpenChange={setShowAddClaimDialog}
        onClaimAdded={fetchClaims}
      />
    </div>
  );
};
