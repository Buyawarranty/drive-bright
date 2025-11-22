import React, { useState, useEffect } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Input } from '@/components/ui/input';
import { Checkbox } from '@/components/ui/checkbox';
import { Eye, Download, Calendar, User, Mail, Phone, Paperclip, FileDown, FileSpreadsheet, Search, Filter, Trash2, Edit } from 'lucide-react';
import { useToast } from '@/hooks/use-toast';
import { ClaimsSummaryCards } from './claims/ClaimsSummaryCards';
import { ClaimsChart } from './claims/ClaimsChart';
import { ClaimDetailDialog } from './claims/ClaimDetailDialog';
import { ClaimAmountEditDialog } from './claims/ClaimAmountEditDialog';
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
}

export const ClaimsTab = () => {
  const { toast } = useToast();
  const [claims, setClaims] = useState<ClaimSubmission[]>([]);
  const [loading, setLoading] = useState(true);
  const [selectedClaim, setSelectedClaim] = useState<ClaimSubmission | null>(null);
  const [editingClaim, setEditingClaim] = useState<ClaimSubmission | null>(null);
  const [selectedClaimIds, setSelectedClaimIds] = useState<Set<string>>(new Set());
  const [statusFilter, setStatusFilter] = useState<string>('all');
  const [warrantyFilter, setWarrantyFilter] = useState<string>('all');
  const [searchQuery, setSearchQuery] = useState<string>('');
  const [dateFrom, setDateFrom] = useState<string>('');
  const [dateTo, setDateTo] = useState<string>('');
  const [monthlyData, setMonthlyData] = useState<any[]>([]);
  const [summaryData, setSummaryData] = useState({
    totalClaims: 0,
    approvedClaims: 0,
    pendingClaims: 0,
    totalPaid: 0,
    avgClaimValue: 0,
    monthlyChange: 0,
  });

  useEffect(() => {
    fetchClaims();
    fetchMonthlyStats();
  }, []);

  useEffect(() => {
    calculateSummary();
  }, [claims]);

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

  const fetchMonthlyStats = async () => {
    try {
      const { data, error } = await supabase
        .from('monthly_claims_stats')
        .select('*')
        .limit(12);

      if (error) {
        console.error('Error fetching monthly stats:', error);
        return;
      }

      const formattedData = (data || []).map(item => ({
        month: new Date(item.month).toLocaleDateString('en-GB', { month: 'short', year: '2-digit' }),
        totalClaims: item.total_claims || 0,
        approvedClaims: item.approved_claims || 0,
        totalPaid: item.total_paid || 0,
      })).reverse();

      setMonthlyData(formattedData);
    } catch (error) {
      console.error('Error fetching monthly stats:', error);
    }
  };

  const calculateSummary = () => {
    const currentMonth = new Date().getMonth();
    const currentYear = new Date().getFullYear();
    
    const thisMonthClaims = claims.filter(c => {
      const claimDate = new Date(c.created_at);
      return claimDate.getMonth() === currentMonth && claimDate.getFullYear() === currentYear;
    });

    const approvedClaims = claims.filter(c => c.status === 'approved' || c.status === 'paid');
    const pendingClaims = claims.filter(c => c.status === 'new' || c.status === 'in_progress' || c.status === 'awaiting_info');
    const totalPaid = thisMonthClaims.reduce((sum, c) => sum + (c.payment_amount || 0), 0);
    const paidClaims = approvedClaims.filter(c => c.payment_amount && c.payment_amount > 0);
    const avgClaimValue = paidClaims.length > 0 
      ? paidClaims.reduce((sum, c) => sum + (c.payment_amount || 0), 0) / paidClaims.length 
      : 0;

    // Calculate monthly change
    const lastMonth = currentMonth === 0 ? 11 : currentMonth - 1;
    const lastMonthYear = currentMonth === 0 ? currentYear - 1 : currentYear;
    const lastMonthClaims = claims.filter(c => {
      const claimDate = new Date(c.created_at);
      return claimDate.getMonth() === lastMonth && claimDate.getFullYear() === lastMonthYear;
    });

    const monthlyChange = lastMonthClaims.length > 0 
      ? ((thisMonthClaims.length - lastMonthClaims.length) / lastMonthClaims.length) * 100 
      : 0;

    setSummaryData({
      totalClaims: thisMonthClaims.length,
      approvedClaims: approvedClaims.length,
      pendingClaims: pendingClaims.length,
      totalPaid,
      avgClaimValue,
      monthlyChange: Math.round(monthlyChange),
    });
  };

  const getStatusBadgeVariant = (status: string) => {
    const variants: Record<string, any> = {
      new: 'destructive',
      in_progress: 'default',
      approved: 'secondary',
      rejected: 'destructive',
      awaiting_info: 'outline',
      paid: 'secondary',
      resolved: 'secondary',
    };
    return variants[status] || 'outline';
  };

  const getStatusLabel = (status: string) => {
    return status.replace('_', ' ').toUpperCase();
  };

  const filteredClaims = claims.filter(claim => {
    // Status filter
    if (statusFilter !== 'all' && claim.status !== statusFilter) return false;
    
    // Warranty type filter
    if (warrantyFilter !== 'all' && claim.warranty_type !== warrantyFilter) return false;
    
    // Search query
    if (searchQuery) {
      const query = searchQuery.toLowerCase();
      const matchesSearch = 
        claim.name?.toLowerCase().includes(query) ||
        claim.email?.toLowerCase().includes(query) ||
        claim.vehicle_registration?.toLowerCase().includes(query);
      if (!matchesSearch) return false;
    }
    
    // Date range filter
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
      setSelectedClaimIds(new Set(filteredClaims.map(c => c.id)));
    } else {
      setSelectedClaimIds(new Set());
    }
  };

  const handleSelectClaim = (claimId: string, checked: boolean) => {
    const newSelected = new Set(selectedClaimIds);
    if (checked) {
      newSelected.add(claimId);
    } else {
      newSelected.delete(claimId);
    }
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

      {/* Summary Cards */}
      <ClaimsSummaryCards summaryData={summaryData} />

      {/* Charts */}
      <ClaimsChart monthlyData={monthlyData} />

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
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-5 gap-4">
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
              <SelectContent>
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

            {/* Warranty Type Filter */}
            <Select value={warrantyFilter} onValueChange={setWarrantyFilter}>
              <SelectTrigger>
                <SelectValue placeholder="Filter by warranty" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">All Warranties</SelectItem>
                {uniqueWarrantyTypes.map(type => (
                  <SelectItem key={type} value={type!}>{type}</SelectItem>
                ))}
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
          {(statusFilter !== 'all' || warrantyFilter !== 'all' || searchQuery || dateFrom || dateTo) && (
            <div className="flex flex-wrap gap-2 mt-4 pt-4 border-t">
              <span className="text-sm font-medium text-gray-600">Active Filters:</span>
              {statusFilter !== 'all' && (
                <Badge variant="outline">Status: {getStatusLabel(statusFilter)}</Badge>
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
              <CardTitle>Claims Submissions ({filteredClaims.length})</CardTitle>
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
          {filteredClaims.length === 0 ? (
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
                        checked={filteredClaims.length > 0 && selectedClaimIds.size === filteredClaims.length}
                        onCheckedChange={handleSelectAll}
                        aria-label="Select all claims"
                      />
                    </TableHead>
                    <TableHead>Date</TableHead>
                    <TableHead>Customer</TableHead>
                    <TableHead>Vehicle Reg</TableHead>
                    <TableHead>Warranty</TableHead>
                    <TableHead>Claim Reason</TableHead>
                    <TableHead>Status</TableHead>
                    <TableHead>Payment</TableHead>
                    <TableHead>Attachment</TableHead>
                    <TableHead>Actions</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {filteredClaims.map((claim) => (
                    <TableRow key={claim.id}>
                      <TableCell>
                        <Checkbox
                          checked={selectedClaimIds.has(claim.id)}
                          onCheckedChange={(checked) => handleSelectClaim(claim.id, checked as boolean)}
                          aria-label={`Select claim ${claim.id}`}
                        />
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
                            <Button
                              variant="ghost"
                              size="sm"
                              onClick={() => setEditingClaim(claim)}
                              className="h-6 w-6 p-0"
                              title="Edit claim amount"
                            >
                              <Edit className="h-3 w-3 text-blue-600" />
                            </Button>
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
                        <span className="font-mono text-sm">
                          {claim.vehicle_registration || '-'}
                        </span>
                      </TableCell>
                      <TableCell>
                        <span className="text-sm">
                          {claim.warranty_type || '-'}
                        </span>
                      </TableCell>
                      <TableCell>
                        <span className="text-sm max-w-xs truncate block">
                          {claim.claim_reason || '-'}
                        </span>
                      </TableCell>
                      <TableCell>
                        <Badge variant={getStatusBadgeVariant(claim.status)}>
                          {getStatusLabel(claim.status)}
                        </Badge>
                      </TableCell>
                      <TableCell>
                        {claim.payment_amount && claim.payment_amount > 0 ? (
                          <span className="font-semibold text-green-600">
                            £{claim.payment_amount.toLocaleString('en-GB', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
                          </span>
                        ) : (
                          <span className="text-gray-400">-</span>
                        )}
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
                        <Button 
                          variant="ghost" 
                          size="sm"
                          onClick={() => setSelectedClaim(claim)}
                        >
                          <Eye className="h-4 w-4 mr-1" />
                          View
                        </Button>
                      </TableCell>
                    </TableRow>
                  ))}
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
    </div>
  );
};
