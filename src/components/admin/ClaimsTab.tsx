import React, { useState, useEffect, useMemo } from 'react';
import { AdminNotificationBell } from '@/components/admin/AdminNotificationBell';
import { AdminNotification } from '@/hooks/useAdminNotifications';
import { supabase } from '@/integrations/supabase/client';
import { Button } from '@/components/ui/button';
import { FileSpreadsheet, FileDown, Plus, Car } from 'lucide-react';
import { useToast } from '@/hooks/use-toast';
import { ClaimsAnalyticsPanel } from './claims/ClaimsAnalyticsPanel';
import { ClaimsAgeMileageAnalytics } from './claims/ClaimsAgeMileageAnalytics';
import { AddClaimDialog } from './claims/AddClaimDialog';
import { exportToCSV, exportToPDF, formatClaimForExport } from './claims/exportUtils';
import { VehicleIntelligenceExplorer } from './claims/VehicleIntelligenceExplorer';
import { ClaimUpdateNotifications } from './claims/ClaimUpdateNotifications';
import { useClaims } from '@/hooks/useClaims';
import { UrgencyBanner } from './claims-manager/UrgencyBanner';
import { ClaimsWorkbench, KpiStrip } from './claims-manager/ClaimsManagerDashboard';
import { PerformanceKpiStrip } from './claims-manager/PerformanceKpiStrip';

interface ClaimSubmission {
  id: string;
  name: string;
  email: string;
  phone?: string;
  status: string;
  assigned_to?: string;
  created_at: string;
  updated_at: string;
  vehicle_registration?: string;
  payment_amount?: number;
  approved_at?: string;
  rejected_at?: string;
  paid_at?: string;
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
  const [showAddClaimDialog, setShowAddClaimDialog] = useState(false);
  const [activeSubTab, setActiveSubTab] = useState<'claims' | 'vehicle-intelligence'>('claims');

  const { claims: managerClaims, loading: managerLoading, refetch: refetchManager } = useClaims();

  useEffect(() => { fetchClaims(); }, []);

  const fetchClaims = async () => {
    try {
      const { data, error } = await supabase
        .from('claims_submissions')
        .select('*')
        .order('created_at', { ascending: false });
      if (error) {
        toast({ title: 'Error', description: 'Failed to fetch claims', variant: 'destructive' });
        return;
      }
      setClaims((data as any) || []);
    } finally {
      setLoading(false);
    }
  };

  const refetchAll = async () => {
    await Promise.all([fetchClaims(), refetchManager()]);
  };

  // Avg resolution time (real, from raw rows)
  const avgResolutionDays = useMemo(() => {
    const resolved = claims.filter(c => ['paid', 'resolved', 'rejected', 'closed', 'approved'].includes(c.status));
    if (resolved.length === 0) return 0;
    const total = resolved.reduce((sum, c) => {
      const end = c.paid_at || c.rejected_at || c.approved_at || c.updated_at;
      return sum + Math.floor((new Date(end).getTime() - new Date(c.created_at).getTime()) / (1000 * 60 * 60 * 24));
    }, 0);
    return Math.max(0, Math.round(total / resolved.length));
  }, [claims]);

  // Performance KPIs: avg payout, avg resolution, avg claims per month
  const perfKpis = useMemo(() => {
    const paid = managerClaims.filter((c: any) => (c.paidAmount ?? 0) > 0);
    const avgPayout = paid.length
      ? Math.round(paid.reduce((s: number, c: any) => s + (c.paidAmount || 0), 0) / paid.length)
      : 0;

    // Avg claims per month across the active date range of submissions
    const dates = managerClaims
      .map((c: any) => c.submittedAt ? new Date(c.submittedAt).getTime() : null)
      .filter((t): t is number => !!t);
    let avgPerMonth = 0;
    if (dates.length) {
      const min = Math.min(...dates);
      const max = Math.max(...dates);
      const months = Math.max(1, (max - min) / (1000 * 60 * 60 * 24 * 30.44));
      avgPerMonth = Math.round(managerClaims.length / months);
    }
    return { avgPayout, avgPerMonth };
  }, [managerClaims]);

  const totalCount = managerClaims.length;


  const handleExportCSV = () => {
    exportToCSV(claims.map(formatClaimForExport as any), 'claims_export');
    toast({ title: 'Success', description: 'Exported to CSV' });
  };

  const handleExportPDF = () => {
    exportToPDF(claims.map(formatClaimForExport as any), 'claims_report');
  };

  if (loading || managerLoading) {
    return (
      <div className="p-6 flex items-center justify-center h-64">
        <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-orange-600" />
      </div>
    );
  }

  return (
    <div className="p-6 space-y-5">
      {/* Header */}
      <div className="flex justify-between items-center flex-wrap gap-3">
        <div>
          <h1 className="text-2xl font-bold">Claims Management</h1>
          <p className="text-sm text-muted-foreground mt-1">{totalCount} total claims</p>
        </div>
        <div className="flex items-center gap-2 flex-wrap">
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
        <div className="space-y-6">
          <VehicleIntelligenceExplorer claims={claims.filter(c => c.status !== 'fake_test') as any} />
          <div id="claims-analytics-section" className="scroll-mt-4 space-y-6">
            <ClaimsAnalyticsPanel claims={claims.filter(c => c.status !== 'fake_test') as any} />
            <ClaimsAgeMileageAnalytics claims={claims.filter(c => c.status !== 'fake_test') as any} />
          </div>
        </div>
      )}

      {/* Claims List Sub-tab — Workbench (queues + tabbed drawer) */}
      {activeSubTab === 'claims' && (
        <>
          <ClaimUpdateNotifications />
          <UrgencyBanner claims={managerClaims} avgResolutionDays={avgResolutionDays} />
          <KpiStrip claims={managerClaims} avgResolutionDays={avgResolutionDays} />
          <ClaimsWorkbench showUrgencyBanner={false} />
        </>
      )}

      <AddClaimDialog
        open={showAddClaimDialog}
        onOpenChange={setShowAddClaimDialog}
        onClaimAdded={refetchAll}
      />
    </div>
  );
};
