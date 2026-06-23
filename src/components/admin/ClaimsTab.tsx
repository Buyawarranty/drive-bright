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
import { exportToCSV, exportToPDF, formatClaimForExport } from './claims/exportUtils';
import { VehicleIntelligenceExplorer } from './claims/VehicleIntelligenceExplorer';
import { RequestUpdateDialog } from './claims/RequestUpdateDialog';
import { ClaimUpdateNotifications } from './claims/ClaimUpdateNotifications';
// New Claims Manager UI
import { useClaims } from '@/hooks/useClaims';
import type { Claim } from '@/types/claim';
import { UrgencyBanner } from './claims-manager/UrgencyBanner';
import { KpiStrip } from './claims-manager/ClaimsManagerDashboard';
import { Toolbar, applyFilters, DEFAULT_FILTERS, type ClaimsFilters } from './claims-manager/Toolbar';
import { BulkActionsBar, type AssignableAgent } from './claims-manager/BulkActionsBar';
import { ClaimsTable } from './claims-manager/ClaimsTable';
import { ClaimDetailPanel } from './claims-manager/ClaimDetailPanel';

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
  const [showRequestUpdate, setShowRequestUpdate] = useState(false);
  const [activeSubTab, setActiveSubTab] = useState<'claims' | 'vehicle-intelligence'>('claims');

  // New dashboard UI state
  const { claims: managerClaims, loading: managerLoading, refetch: refetchManager } = useClaims();
  const [filters, setFilters] = useState<ClaimsFilters>(() => {
    const params = new URLSearchParams(window.location.search);
    return { ...DEFAULT_FILTERS, search: params.get('search') || '' };
  });
  const [selectedPanelClaim, setSelectedPanelClaim] = useState<Claim | null>(null);
  const [selectedIds, setSelectedIds] = useState<Set<string>>(new Set());
  const [agents, setAgents] = useState<AssignableAgent[]>([]);
  const [currentUserId, setCurrentUserId] = useState<string | null>(null);
  const [assigning, setAssigning] = useState(false);

  useEffect(() => { fetchClaims(); fetchAgents(); }, []);

  const fetchAgents = async () => {
    try {
      const { data: { user } } = await supabase.auth.getUser();
      setCurrentUserId(user?.id ?? null);

      const { data: roleRows } = await supabase
        .from('user_roles')
        .select('user_id, role')
        .in('role', ['claims_agent', 'claims_manager', 'admin', 'super_admin']);
      const ids = Array.from(new Set((roleRows || []).map((r: any) => r.user_id)));
      if (ids.length === 0) { setAgents([]); return; }
      const roleByUser: Record<string, string> = {};
      (roleRows || []).forEach((r: any) => {
        // prefer claims_agent label if user has multiple roles
        const prev = roleByUser[r.user_id];
        const priority = ['claims_agent', 'claims_manager', 'admin', 'super_admin'];
        if (!prev || priority.indexOf(r.role) < priority.indexOf(prev)) {
          roleByUser[r.user_id] = r.role;
        }
      });
      const { data: users } = await supabase
        .from('admin_users')
        .select('user_id, first_name, last_name, email, is_active')
        .in('user_id', ids)
        .eq('is_active', true);
      const list: AssignableAgent[] = (users || []).map((u: any) => ({
        userId: u.user_id,
        name: [u.first_name, u.last_name].filter(Boolean).join(' ').trim() || u.email || 'Staff',
        role: roleByUser[u.user_id],
      })).sort((a, b) => a.name.localeCompare(b.name));
      setAgents(list);
    } catch (e) {
      console.error('Failed to fetch claims agents', e);
    }
  };

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

  // Apply toolbar filters
  const filtered = useMemo(() => applyFilters(managerClaims, filters), [managerClaims, filters]);

  // Keep the open detail panel in sync with the latest data after a refetch
  useEffect(() => {
    if (!selectedPanelClaim) return;
    const fresh = managerClaims.find((c) => c.id === selectedPanelClaim.id);
    if (fresh && fresh !== selectedPanelClaim) setSelectedPanelClaim(fresh);
  }, [managerClaims, selectedPanelClaim]);

  const totalCount = managerClaims.length;
  const shownCount = filtered.length;

  const toggleOne = (id: string) =>
    setSelectedIds(prev => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id); else next.add(id);
      return next;
    });

  const toggleAll = (checked: boolean) =>
    setSelectedIds(prev => {
      const next = new Set(prev);
      if (checked) filtered.forEach(c => next.add(c.id));
      else filtered.forEach(c => next.delete(c.id));
      return next;
    });

  const handleBulkDelete = async () => {
    if (selectedIds.size === 0) return;
    if (!confirm(`Delete ${selectedIds.size} claim(s)? This cannot be undone.`)) return;
    setLoading(true);
    try {
      const { error } = await supabase.from('claims_submissions').delete().in('id', Array.from(selectedIds));
      if (error) throw error;
      toast({ title: "Success", description: `Deleted ${selectedIds.size} claim(s)` });
      setSelectedIds(new Set());
      await refetchAll();
    } catch {
      toast({ title: "Error", description: "Failed to delete claims", variant: "destructive" });
    } finally {
      setLoading(false);
    }
  };

  const handleBulkAssign = async (userId: string | null) => {
    if (selectedIds.size === 0) return;
    setAssigning(true);
    try {
      const { error } = await supabase
        .from('claims_submissions')
        .update({ assigned_to: userId, updated_at: new Date().toISOString() })
        .in('id', Array.from(selectedIds));
      if (error) throw error;
      const label = userId
        ? agents.find((a) => a.userId === userId)?.name || 'agent'
        : 'unassigned';
      toast({ title: 'Assigned', description: `${selectedIds.size} claim(s) → ${label}` });
      setSelectedIds(new Set());
      await refetchAll();
    } catch (e: any) {
      toast({ title: 'Error', description: e?.message || 'Failed to assign claims', variant: 'destructive' });
    } finally {
      setAssigning(false);
    }
  };

  const handleExportCSV = () => {
    exportToCSV(claims.map(formatClaimForExport), 'claims_export');
    toast({ title: "Success", description: "Exported to CSV" });
  };

  const handleExportPDF = () => {
    exportToPDF(claims.map(formatClaimForExport), 'claims_report');
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
          <p className="text-sm text-muted-foreground mt-1">
            {totalCount} total · <span className="font-semibold text-foreground">{shownCount}</span> shown
          </p>
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
          <Button onClick={() => {
            if (selectedIds.size > 0) {
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
        <div className="space-y-6">
          <VehicleIntelligenceExplorer claims={claims.filter(c => c.status !== 'fake_test')} />
          <div id="claims-analytics-section" className="scroll-mt-4 space-y-6">
            <ClaimsAnalyticsPanel claims={claims.filter(c => c.status !== 'fake_test')} />
            <ClaimsAgeMileageAnalytics claims={claims.filter(c => c.status !== 'fake_test')} />
          </div>
        </div>
      )}

      {/* Claims List Sub-tab — new dashboard UI */}
      {activeSubTab === 'claims' && (
        <>
          <ClaimUpdateNotifications />

          <UrgencyBanner claims={managerClaims} avgResolutionDays={avgResolutionDays} />

          <KpiStrip claims={managerClaims} avgResolutionDays={avgResolutionDays} />

          <Toolbar filters={filters} onChange={setFilters} />

          {selectedIds.size > 0 && (
            <div className="flex items-center gap-3">
              <div className="flex-1">
                <BulkActionsBar count={selectedIds.size} onClear={() => setSelectedIds(new Set())} />
              </div>
              <Button variant="destructive" size="sm" onClick={handleBulkDelete} disabled={loading}>
                <Trash2 className="h-4 w-4 mr-1" /> Delete
              </Button>
            </div>
          )}

          <ClaimsTable
            claims={filtered}
            onRowClick={(c) => setSelectedPanelClaim((prev) => (prev?.id === c.id ? null : c))}
            selectedId={selectedPanelClaim?.id ?? null}
            selectedIds={selectedIds}
            onToggleOne={toggleOne}
            onToggleAll={toggleAll}
            onUpdated={refetchAll}
            onApprove={async (c) => {
              if (!window.confirm(
                `Approve this claim for ${c.customerName} (${c.reg})?\n\nThe claim will be marked as approved. No email is sent automatically — use "Email Customer" if you want to notify them.`,
              )) return;
              try {
                const { error } = await supabase
                  .from('claims_submissions')
                  .update({ status: 'approved', approved_at: new Date().toISOString(), updated_at: new Date().toISOString() })
                  .eq('id', c.id);
                if (error) throw error;
                toast({ title: 'Approved', description: `Claim for ${c.customerName} approved.` });
                await refetchAll();
              } catch (e: any) {
                toast({ title: 'Failed', description: e?.message || 'Could not approve claim', variant: 'destructive' });
              }
            }}
            onCall={(c) => {
              if (c.phone) window.location.href = `tel:${c.phone}`;
            }}
            renderExpanded={(c) => (
              <ClaimDetailPanel
                claim={c}
                onClose={() => setSelectedPanelClaim(null)}
                onUpdated={refetchAll}
              />
            )}
          />
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
        onClaimAdded={refetchAll}
      />
      <RequestUpdateDialog
        claims={claims.filter(c => selectedIds.has(c.id)).map(c => ({
          id: c.id,
          name: c.name,
          vehicle_registration: c.vehicle_registration,
          claim_reason: c.claim_reason,
        }))}
        open={showRequestUpdate}
        onOpenChange={setShowRequestUpdate}
        onSent={() => {
          refetchAll();
          setSelectedIds(new Set());
        }}
      />
    </div>
  );
};
