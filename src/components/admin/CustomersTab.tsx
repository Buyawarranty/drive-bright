import React, { useState, useEffect, useMemo, useCallback } from 'react';
import { AdminNotificationBell } from '@/components/admin/AdminNotificationBell';
import { AdminNotification } from '@/hooks/useAdminNotifications';
import { useSearchParams } from 'react-router-dom';
import { supabase } from '@/integrations/supabase/client';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from '@/components/ui/dialog';
import { AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent, AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle, AlertDialogTrigger } from '@/components/ui/alert-dialog';
import { Textarea } from '@/components/ui/textarea';
import { Badge } from '@/components/ui/badge';
import { Label } from '@/components/ui/label';
import { Card } from '@/components/ui/card';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Calendar } from '@/components/ui/calendar';
import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { toast } from 'sonner';
import { Edit, Download, Search, RefreshCw, AlertCircle, CalendarIcon, Save, Key, Send, Clock, CheckCircle, Trash2, UserX, Phone, Mail, RotateCcw, Archive, ChevronDown, ChevronUp, Eye, EyeOff, Copy, CopyPlus, FileText, User, Sparkles, FileSpreadsheet, Star, Ban, PoundSterling, FlaskConical, UserMinus, Printer, GitMerge, Trophy } from 'lucide-react';
import { CommissionClaimedBadge } from './CommissionClaimedBadge';
import { Checkbox } from '@/components/ui/checkbox';
import { Collapsible, CollapsibleContent, CollapsibleTrigger } from '@/components/ui/collapsible';
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuTrigger } from '@/components/ui/dropdown-menu';
import { usePermissions } from '@/hooks/usePermissions';
import { useDataExport } from '@/hooks/useDataExport';
import { useDebounce } from '@/hooks/useDebounce';
import { usePagination } from '@/hooks/usePagination';
import { PaginationControls } from '@/components/ui/pagination-controls';

import { CustomerNotesSection } from './CustomerNotesSection';
import { StructuredNotesSection } from './StructuredNotesSection';
import { CustomerServiceNotes } from './CustomerServiceNotes';
import { WarrantyActions } from './WarrantyActions';
import { EditOrderButton } from './EditOrderButton';
import { MOTHistorySection } from './MOTHistorySection';
import { W2000DataPreview } from './W2000DataPreview';
import { SendNotificationDialog } from './SendNotificationDialog';
import { ViewAsCustomerButton } from './ViewAsCustomerButton';
import { AddIncompleteCustomerDialog } from './AddIncompleteCustomerDialog';
import { CustomerTagsManager } from './CustomerTagsManager';
import { CustomerTagsDisplay } from './CustomerTagsDisplay';
import { InlineCustomerTags } from './InlineCustomerTags';
import { BulkEmailDialog } from './BulkEmailDialog';
import { BulkTagDialog } from './BulkTagDialog';
import { CancelWarrantyDialog } from './CancelWarrantyDialog';
import { ArchiveCustomerDialog } from './ArchiveCustomerDialog';
import { MergeDuplicateDialog } from './MergeDuplicateDialog';
import { InvoiceDialog } from './InvoiceDialog';
import CoverageDetailsDisplay from '@/components/CoverageDetailsDisplay';
import { CustomerClaimsSummary } from './claims/CustomerClaimsSummary';
import AddOnProtectionDisplay from '@/components/AddOnProtectionDisplay';
import { W2KAuditLog } from './W2KAuditLog';
import { WarrantyUpgradeDialog } from './WarrantyUpgradeDialog';
import { InlineWarrantyUpgrade } from './InlineWarrantyUpgrade';
import { InlineFutureActivationEdit } from './InlineFutureActivationEdit';
import { InlineUpgradeCell } from './InlineUpgradeCell';
import { TrustpilotReviewDialog } from './TrustpilotReviewDialog';
import { PurchaseSourceBadge } from './PurchaseSourceBadge';
import { PrintableWarrantyLetter } from './PrintableWarrantyLetter';
import { PaymentDueDatePicker } from './PaymentDueDatePicker';
import { CancellationsTab } from './CancellationsTab';
import { RemindMePopover } from './leads/RemindMePopover';
import { DateRangeFilter } from './DateRangeFilter';
import { QuickCustomerSignupButton } from './QuickCustomerSignupButton';
import { format } from 'date-fns';
import { DateRange } from 'react-day-picker';
import { cn } from '@/lib/utils';
import { getWarrantyDurationInMonths } from '@/lib/warrantyDurationUtils';
import { ToggleGroup, ToggleGroupItem } from '@/components/ui/toggle-group';
import { WEBSITE_SALES_ACCOUNT_ID } from '@/constants/salesDefaults';
import { useViewAs } from '@/contexts/ViewAsContext';

// Helper function to map plan types to Warranties 2000 warranty types
function getWarrantyType(planType: string): string {
  // WarType must be one of: B-BASIC, B-GOLD, B-PLATINUM, B-EV, B-PHEV or B-MOTORCYCLE
  const lowerPlanType = planType?.toLowerCase() || '';
  
  // Handle full plan type names first
  if (lowerPlanType.includes('electric vehicle') || lowerPlanType.includes('ev extended warranty')) {
    return 'B-EV';
  }
  if (lowerPlanType.includes('phev') || lowerPlanType.includes('hybrid extended warranty')) {
    return 'B-PHEV';
  }
  if (lowerPlanType.includes('motorbike') || lowerPlanType.includes('motorcycle')) {
    return 'B-MOTORCYCLE';
  }
  if (lowerPlanType.includes('platinum')) {
    return 'B-PLATINUM';
  }
  if (lowerPlanType.includes('gold')) {
    return 'B-GOLD';
  }
  if (lowerPlanType.includes('basic')) {
    return 'B-BASIC';
  }
  
  // Fallback for simple cases
  switch (lowerPlanType) {
    case 'basic': return 'B-BASIC';
    case 'gold': return 'B-GOLD';
    case 'platinum': return 'B-PLATINUM';
    case 'phev': return 'B-PHEV';
    case 'ev': return 'B-EV';
    case 'motorbike': 
    case 'motorcycle': return 'B-MOTORCYCLE';
    default: return 'B-BASIC';
  }
}

// Helper function to calculate expiry date based on start date and payment type
function calculateExpiryDate(startDate: string, paymentType: string): Date {
  const start = new Date(startDate);
  const months = getWarrantyDurationInMonths(paymentType);
  const expiry = new Date(start);
  expiry.setMonth(expiry.getMonth() + months);
  return expiry;
}

interface Customer {
  id: string;
  name: string;
  email: string;
  phone?: string;
  first_name?: string;
  last_name?: string;
  flat_number?: string;
  building_name?: string;
  building_number?: string;
  street?: string;
  town?: string;
  county?: string;
  postcode?: string;
  country?: string;
  address?: string;
  plan_type: string;
  signup_date: string;
  created_at?: string;
  voluntary_excess: number;
  status: string;
  registration_plate: string;
  vehicle_make?: string;
  vehicle_model?: string;
  vehicle_year?: string;
  vehicle_fuel_type?: string;
  vehicle_transmission?: string;
  mileage?: string;
  payment_type?: string;
  stripe_session_id?: string;
  bumper_order_id?: string;
  discount_code?: string;
  discount_amount: number;
  original_amount: number;
  final_amount: number;
  warranty_reference_number: string;
  warranty_number: string;
  stripe_customer_id: string;
  warranty_expiry?: string;
  policy_number?: string;
  policy_status?: string;
  policy_start_date?: string;
  warranties_2000_scheduled_for?: string;
  welcome_email_status?: 'sent' | 'not_sent';
  activation_email_status?: 'sent' | 'not_sent';
  assigned_to?: string;
  assigned_admin_name?: string;
  is_deleted?: boolean;
  deleted_at?: string;
  deleted_by?: string;
  last_login?: string;
  temporary_password?: string;
  // Add-on coverage fields
  tyre_cover?: boolean;
  wear_tear?: boolean;
  europe_cover?: boolean;
  transfer_cover?: boolean;
  breakdown_recovery?: boolean;
  vehicle_rental?: boolean;
  mot_fee?: boolean;
  claim_limit?: number;
  labour_rate?: number;
  mot_repair?: boolean;
  lost_key?: boolean;
  consequential?: boolean;
  // Manual upgrade tracking fields
  manual_upgrade_at?: string;
  manual_upgrade_by?: string;
  manual_upgrade_notes?: string;
  // Review tracking fields
  trustpilot_review_requested?: boolean;
  trustpilot_review_requested_at?: string;
  trustpilot_review_completed?: boolean;
  trustpilot_review_completed_at?: string;
  google_review_requested?: boolean;
  google_review_requested_at?: string;
  google_review_completed?: boolean;
  google_review_completed_at?: string;
  // Payment verification fields
  is_manual_entry?: boolean;
  payment_verified?: boolean;
  // Payment collection tracking
  payment_due_date?: string | null;
  // Purchase source tracking
  purchase_source?: string | null;
  customer_dob?: string | null;
  admin_users?: {
    id: string;
    email: string;
    first_name?: string;
    last_name?: string;
  } | null;
  customer_policies?: Array<{
    id?: string;
    policy_end_date: string;
    policy_start_date?: string;
    policy_number: string;
    status: string;
    warranty_number?: string;
    email_sent_status?: string;
    warranties_2000_status?: string;
    warranties_2000_sent_at?: string;
    created_at?: string;
    user_id?: string;
    customer_id?: string;
    email?: string;
    additional_notes?: string;
    seasonal_bonus_months?: number | null;
  }>;
}

interface IncompleteCustomer {
  id: string;
  email: string;
  full_name?: string;
  phone?: string;
  vehicle_reg?: string;
  vehicle_make?: string;
  vehicle_model?: string;
  vehicle_year?: string;
  mileage?: string;
  plan_name?: string;
  payment_type?: string;
  vehicle_type?: string;
  step_abandoned: number;
  created_at: string;
  updated_at: string;
  contact_status: string;
  contact_notes?: string;
  last_contacted_at?: string;
  contacted_by?: string;
  cart_metadata?: any;
}

interface EmailStatus {
  policy_documents: boolean;
  portal_signup: boolean;
}

interface AdminNote {
  id: string;
  note: string;
  created_at: string;
  created_by: string;
  admin_name?: string;
  admin_users?: {
    email: string;
    first_name?: string;
    last_name?: string;
  } | null;
}

interface Plan {
  name: string;
}

interface AdminUser {
  id: string;
  user_id: string;
  email: string;
  first_name?: string;
  last_name?: string;
  role: string;
}

// Number plate component
const NumberPlate = ({ plateNumber }: { plateNumber: string }) => {
  if (!plateNumber) return <span className="text-gray-400">N/A</span>;
  
  return (
    <div className="inline-flex items-center bg-white border-2 border-black rounded-sm overflow-hidden font-mono text-lg font-bold shadow-md">
      <div className="bg-blue-600 text-white px-2 py-1 text-xs font-normal">
        GB
      </div>
      <div className="bg-yellow-400 text-black px-3 py-1 tracking-wider">
        {plateNumber.toUpperCase()}
      </div>
    </div>
  );
};

interface CustomersTabProps {
  notifications?: AdminNotification[];
  unreadCount?: number;
  onMarkAsRead?: (id: string) => void;
  onMarkAllAsRead?: () => void;
  onNavigateToTab?: (tab: string) => void;
  userRole?: string | null;
}

export const CustomersTab = ({
  notifications = [],
  unreadCount = 0,
  onMarkAsRead,
  onMarkAllAsRead,
  onNavigateToTab,
  userRole,
}: CustomersTabProps) => {
  const { canExportTab, hasGranularPermission } = usePermissions();
  const { exportToCSV: exportDataToCSV, exportToExcel } = useDataExport();
  const canExport = canExportTab('customers');
  const canDelete = hasGranularPermission('customers', 'delete');
  
  const [searchParams, setSearchParams] = useSearchParams();
  const [customers, setCustomers] = useState<Customer[]>([]);
  const [filteredCustomers, setFilteredCustomers] = useState<Customer[]>([]);
  const [deletedCustomers, setDeletedCustomers] = useState<Customer[]>([]);
  const [filteredDeletedCustomers, setFilteredDeletedCustomers] = useState<Customer[]>([]);
  const [incompleteCustomers, setIncompleteCustomers] = useState<IncompleteCustomer[]>([]);
  const [filteredIncompleteCustomers, setFilteredIncompleteCustomers] = useState<IncompleteCustomer[]>([]);
  const [selectedIncompleteCustomers, setSelectedIncompleteCustomers] = useState<string[]>([]);
  const [loading, setLoading] = useState(true);
  const [initialLoadDone, setInitialLoadDone] = useState(false);
  const [deletedLoading, setDeletedLoading] = useState(true);
  const [incompleteLoading, setIncompleteLoading] = useState(true);
  // Initialize search term from URL parameter if present
  const [searchTerm, setSearchTerm] = useState(searchParams.get('search') || '');
  const [deletedSearchTerm, setDeletedSearchTerm] = useState('');
  const [sortBy, setSortBy] = useState('newest'); // Default to newest first
  const [filterByPlan, setFilterByPlan] = useState('all');
  const [filterByStatus, setFilterByStatus] = useState('all');
  const [filterByTag, setFilterByTag] = useState('all');
  const [filterBySource, setFilterBySource] = useState('all_view'); // Default to All View
  const [filterByWarrantyPeriod, setFilterByWarrantyPeriod] = useState('all');
  const [filterByAgent, setFilterByAgent] = useState('all');
  const [dateRange, setDateRange] = useState<DateRange | undefined>(undefined);
  const [availableTags, setAvailableTags] = useState<any[]>([]);
  const [selectedCustomer, setSelectedCustomer] = useState<Customer | null>(null);
  const [editingCustomer, setEditingCustomer] = useState<Customer | null>(null);
  const [notes, setNotes] = useState<AdminNote[]>([]);
  const [newNote, setNewNote] = useState('');
  const [noteDate, setNoteDate] = useState<Date>(new Date());
  const [notesLoading, setNotesLoading] = useState(false);
  const [debugInfo, setDebugInfo] = useState<string>('');
  const [plans, setPlans] = useState<Plan[]>([]);
  const [passwordResetLoading, setPasswordResetLoading] = useState<{ [key: string]: boolean }>({});
  const [emailStatuses, setEmailStatuses] = useState<{ [key: string]: EmailStatus }>({});
  const [emailSendingLoading, setEmailSendingLoading] = useState<{ [key: string]: { [key: string]: boolean } }>({});
  const [dvlaLookupLoading, setDvlaLookupLoading] = useState<{ [key: string]: boolean }>({});
  const [adminUsers, setAdminUsers] = useState<AdminUser[]>([]);
  const [currentUser, setCurrentUser] = useState<{ id: string; email: string; } | null>(null);
  const [currentAdminUser, setCurrentAdminUser] = useState<AdminUser | null>(null);
  const [assignmentLoading, setAssignmentLoading] = useState<{ [key: string]: boolean }>({});
  const [selectedCustomers, setSelectedCustomers] = useState<Set<string>>(new Set());
  const [bulkDeleteLoading, setBulkDeleteLoading] = useState(false);
  const [restoreLoading, setRestoreLoading] = useState<{ [key: string]: boolean }>({});
  const [customerCredentials, setCustomerCredentials] = useState<{ email: string; password: string } | null>(null);
  const [credentialsLoading, setCredentialsLoading] = useState(false);
  const [sendingCredentials, setSendingCredentials] = useState(false);
  const [credentialsExpanded, setCredentialsExpanded] = useState(false);
  const [isPrintLetterOpen, setIsPrintLetterOpen] = useState(false);
  const [cancelWarrantyDialog, setCancelWarrantyDialog] = useState<{
    isOpen: boolean;
    policy: {
      id: string;
      email: string;
      policy_number?: string;
      user_id?: string;
      customer_id?: string;
    } | null;
    customerName?: string;
  }>({ isOpen: false, policy: null });
  const [upgradeDialogOpen, setUpgradeDialogOpen] = useState(false);
  const [upgradeCustomer, setUpgradeCustomer] = useState<Customer | null>(null);
  const [trustpilotReviewCustomer, setTrustpilotReviewCustomer] = useState<Customer | null>(null);
  const [archiveDialogOpen, setArchiveDialogOpen] = useState(false);
  const [archiveCustomers, setArchiveCustomers] = useState<Array<{
    id: string;
    name: string;
    email: string;
    policy_id?: string;
    policy_number?: string;
    user_id?: string;
    customer_id?: string;
  }>>([]);
  const [mergeDialogOpen, setMergeDialogOpen] = useState(false);
  const [mergeDuplicates, setMergeDuplicates] = useState<any[]>([]);
  const [totalSalesDateFilter, setTotalSalesDateFilter] = useState<string>('30days');
  const [agentDealCounts, setAgentDealCounts] = useState<Record<string, { sales: number; cancelled: number }>>({});
  const [revenueDateRange, setRevenueDateRange] = useState<DateRange | undefined>(() => {
    const today = new Date();
    return { from: today, to: today };
  });

  // ViewAs impersonation support — override role and admin ID when impersonating
  const { isImpersonating, viewAsAgent, effectiveRole: viewAsEffectiveRole, effectiveAdminUserId } = useViewAs();

  // Compute today's sales and date-filtered revenue (super_admin only)
  const normalizedRole = isImpersonating && viewAsAgent
    ? viewAsAgent.role?.trim().toLowerCase() || ''
    : currentAdminUser?.role?.trim().toLowerCase() || '';
  const effectiveAdminId = isImpersonating && viewAsAgent
    ? viewAsAgent.id
    : currentAdminUser?.id;
  const isSuperAdmin = normalizedRole === 'super_admin';
  const isSalesAgent = normalizedRole === 'sales';
  const isSalesLead = normalizedRole === 'sales_lead';
  const isSalesScopedRole = isSalesAgent || isSalesLead;
  
  // Track whether role has been determined to prevent flash of unrestricted UI
  const isRoleLoaded = !!currentAdminUser;

  const filteredRevenueStats = useMemo(() => {
    if (!isSuperAdmin) return null;
    // Use filteredCustomers which already respects status, agent, source, tag, and other filters
    let filtered = [...filteredCustomers];
    // Only exclude cancelled/refunded when viewing 'all' status AND not specifically looking at cancelled_refunded source
    if (filterByStatus === 'all' && filterBySource !== 'cancelled_refunded') {
      filtered = filtered.filter(c => {
        const status = (c.status || '').toLowerCase();
        return status !== 'cancelled' && status !== 'refunded';
      });
    }
    if (revenueDateRange?.from) {
      const from = new Date(revenueDateRange.from);
      from.setHours(0, 0, 0, 0);
      const to = revenueDateRange.to ? new Date(revenueDateRange.to) : new Date(from);
      to.setHours(23, 59, 59, 999);
      filtered = filtered.filter(c => {
        const signupDate = c.signup_date ? new Date(c.signup_date) : (c.created_at ? new Date(c.created_at) : null);
        return signupDate && signupDate >= from && signupDate <= to;
      });
    }
    // Dynamic label based on active filters
    let statusLabel = 'sales';
    if (filterBySource === 'cancelled_refunded') {
      statusLabel = 'cancellations/refunds';
    } else if (filterBySource === 'website') {
      statusLabel = 'website sales';
    } else if (filterBySource === 'website_google') {
      statusLabel = 'Google Ads sales';
    } else if (filterBySource === 'website_facebook') {
      statusLabel = 'Facebook Ads sales';
    } else if (filterBySource === 'website_organic') {
      statusLabel = 'organic sales';
    } else if (filterBySource === 'staff_purchase') {
      statusLabel = 'staff sales';
    } else if (filterBySource === 'quote_order') {
      statusLabel = 'quote/order sales';
    } else if (filterBySource === 'agent_sales') {
      statusLabel = 'agent sales';
    } else if (filterByStatus !== 'all') {
      statusLabel = filterByStatus === 'cancelled_and_refunded' ? 'cancellations/refunds' : filterByStatus;
    }
    return {
      count: filtered.length,
      revenue: filtered.reduce((sum, c) => sum + (c.final_amount || 0), 0),
      label: statusLabel,
    };
  }, [filteredCustomers, revenueDateRange, isSuperAdmin, filterByStatus, filterBySource]);

  // Detect customers with future activations due today
  const dueTodayCustomers = useMemo(() => {
    const today = new Date();
    today.setHours(0, 0, 0, 0);
    const endOfToday = new Date();
    endOfToday.setHours(23, 59, 59, 999);
    
    return customers.filter(c => {
      const scheduledFor = c.warranties_2000_scheduled_for || c.policy_start_date;
      const policyStatus = c.customer_policies?.[0]?.status || c.policy_status;
      const w2kStatus = c.customer_policies?.[0]?.warranties_2000_status;
      // Only show as "due today" if still scheduled — once processed (sent/active), drop them
      if (!scheduledFor) return false;
      if (policyStatus === 'active' || w2kStatus === 'sent' || w2kStatus === 'processing') return false;
      if (policyStatus !== 'scheduled' && w2kStatus !== 'scheduled') return false;
      const scheduledDate = new Date(scheduledFor);
      return scheduledDate >= today && scheduledDate <= endOfToday;
    });
  }, [customers]);

  // Helper to check if a customer is due today
  const isDueToday = useCallback((customer: Customer) => {
    return dueTodayCustomers.some(c => c.id === customer.id);
  }, [dueTodayCustomers]);

  // Detect duplicate registrations (same reg, non-deleted, active customers)
  const duplicateRegMap = useMemo(() => {
    const regCounts = new Map<string, string[]>();
    customers.forEach(c => {
      if (c.registration_plate && !c.is_deleted) {
        const reg = c.registration_plate.toUpperCase().replace(/\s/g, '');
        const ids = regCounts.get(reg) || [];
        ids.push(c.id);
        regCounts.set(reg, ids);
      }
    });
    // Only keep entries with 2+ records
    const dupes = new Map<string, string[]>();
    regCounts.forEach((ids, reg) => {
      if (ids.length >= 2) dupes.set(reg, ids);
    });
    return dupes;
  }, [customers]);

  const isDuplicate = (regPlate: string) => {
    if (!regPlate) return false;
    return duplicateRegMap.has(regPlate.toUpperCase().replace(/\s/g, ''));
  };

  const openMergeForReg = (regPlate: string) => {
    const reg = regPlate.toUpperCase().replace(/\s/g, '');
    const ids = duplicateRegMap.get(reg);
    if (!ids) return;
    const dupes = customers.filter(c => ids.includes(c.id)).map(c => ({
      id: c.id,
      name: c.name,
      email: c.email,
      registration_plate: c.registration_plate,
      plan_type: c.plan_type,
      payment_type: c.payment_type,
      final_amount: c.final_amount,
      signup_date: c.signup_date,
      status: c.status,
      warranty_reference_number: c.warranty_reference_number,
      warranty_number: c.warranty_number,
      vehicle_make: c.vehicle_make,
      vehicle_model: c.vehicle_model,
      vehicle_year: c.vehicle_year,
      policy_id: c.customer_policies?.[0]?.id,
      policy_number: c.customer_policies?.[0]?.policy_number,
      user_id: c.customer_policies?.[0]?.user_id,
    }));
    setMergeDuplicates(dupes);
    setMergeDialogOpen(true);
  };

  // Pagination for customers table - only paginate filtered results
  const customersPagination = usePagination(filteredCustomers, { initialPageSize: 50 });

  // Cache for tag assignments to avoid DB calls in filter function
  const [tagAssignmentsCache, setTagAssignmentsCache] = useState<Record<string, Set<string>>>({});
  const [refundedCustomerIds, setRefundedCustomerIds] = useState<Set<string>>(new Set());

  const fetchTagAssignmentsCache = useCallback(async () => {
    try {
      const { data } = await supabase
        .from('customer_tag_assignments')
        .select('customer_id, tag_id');
      if (data) {
        const cache: Record<string, Set<string>> = {};
        data.forEach(({ customer_id, tag_id }) => {
          if (!cache[tag_id]) cache[tag_id] = new Set();
          cache[tag_id].add(customer_id);
        });
        setTagAssignmentsCache(cache);

        // Find refunded tag
        const refundedTag = availableTags.find(t => t.name?.toLowerCase() === 'refunded');
        if (refundedTag && cache[refundedTag.id]) {
          setRefundedCustomerIds(cache[refundedTag.id]);
        }
      }
    } catch (error) {
      console.error('Error fetching tag assignments cache:', error);
    }
  }, [availableTags]);

  useEffect(() => {
    fetchCustomers();
    fetchDeletedCustomers();
    fetchIncompleteCustomers();
    fetchPlans();
    fetchEmailStatuses();
    fetchAdminUsers();
    fetchAgentDealCounts();
    getCurrentUser();
    fetchAvailableTags();
  }, []);

  // Re-fetch agent deal counts when date filters change
  useEffect(() => {
    fetchAgentDealCounts();
  }, [totalSalesDateFilter, dateRange]);

  // Fetch tag assignments after tags and customers are loaded
  useEffect(() => {
    if (availableTags.length > 0 && customers.length > 0) {
      fetchTagAssignmentsCache();
    }
  }, [availableTags, customers.length]);

  // Auto-select own agent filter for sales agents + keep their period locked to 60 days max
  useEffect(() => {
    if (!isSalesAgent) return;
    const agentId = effectiveAdminId;
    if (!agentId) return;

    setFilterByAgent((prev) => (prev === 'all' ? agentId : prev));

    if (totalSalesDateFilter === 'all') {
      setTotalSalesDateFilter('60days');
    }
  }, [effectiveAdminId, isSalesAgent, totalSalesDateFilter]);

  // Keep the shared customer date filter in sync with the Deals Period dropdown for all roles
  useEffect(() => {
    const selectedPeriod = isSalesAgent && totalSalesDateFilter === 'all'
      ? '60days'
      : totalSalesDateFilter;

    const range = getAgentCountsDateRange(selectedPeriod);
    setDateRange(range ? { from: range.start, to: range.end } : undefined);
  }, [isSalesAgent, totalSalesDateFilter]);

  // Listen for URL search parameter changes
  useEffect(() => {
    const urlSearch = searchParams.get('search');
    if (urlSearch && urlSearch !== searchTerm) {
      setSearchTerm(urlSearch);
    }
  }, [searchParams]);

  // Debounce search term to avoid filtering on every keystroke
  const debouncedSearchTerm = useDebounce(searchTerm, 300);

  useEffect(() => {
    applyFiltersAndSort();
  }, [debouncedSearchTerm, customers, sortBy, filterByPlan, filterByStatus, filterByTag, filterBySource, filterByWarrantyPeriod, filterByAgent, dateRange, totalSalesDateFilter, tagAssignmentsCache, refundedCustomerIds, currentAdminUser, isSalesAgent, isSalesScopedRole, effectiveAdminId, isImpersonating]);

  const fetchAvailableTags = async () => {
    try {
      const { data, error } = await supabase
        .from('customer_tags')
        .select('*')
        .order('category', { ascending: true })
        .order('name', { ascending: true });

      if (error) throw error;
      setAvailableTags(data || []);
    } catch (error) {
      console.error('Error fetching tags:', error);
    }
  };

  const applyFiltersAndSort = useCallback(() => {
    let filtered = [...customers];

    // Apply search filter — sales/sales_lead restricted to name, email, phone, reg plate only
    if (debouncedSearchTerm) {
      const searchLower = debouncedSearchTerm.toLowerCase();
      const isSalesRole = isSalesScopedRole;

      filtered = filtered.filter(customer => {
        // Core fields available to all roles
        const coreMatch =
          customer.name?.toLowerCase().includes(searchLower) ||
          customer.email?.toLowerCase().includes(searchLower) ||
          customer.first_name?.toLowerCase().includes(searchLower) ||
          customer.last_name?.toLowerCase().includes(searchLower) ||
          customer.phone?.toLowerCase().includes(searchLower) ||
          customer.registration_plate?.toLowerCase().includes(searchLower);

        if (isSalesRole) return coreMatch;

        // Extended fields for admin/super_admin and other roles
        return coreMatch ||
          customer.vehicle_make?.toLowerCase().includes(searchLower) ||
          customer.vehicle_model?.toLowerCase().includes(searchLower) ||
          customer.vehicle_year?.toLowerCase().includes(searchLower) ||
          customer.vehicle_fuel_type?.toLowerCase().includes(searchLower) ||
          customer.vehicle_transmission?.toLowerCase().includes(searchLower) ||
          customer.mileage?.toLowerCase().includes(searchLower) ||
          customer.flat_number?.toLowerCase().includes(searchLower) ||
          customer.building_name?.toLowerCase().includes(searchLower) ||
          customer.building_number?.toLowerCase().includes(searchLower) ||
          customer.street?.toLowerCase().includes(searchLower) ||
          customer.town?.toLowerCase().includes(searchLower) ||
          customer.county?.toLowerCase().includes(searchLower) ||
          customer.postcode?.toLowerCase().includes(searchLower) ||
          customer.country?.toLowerCase().includes(searchLower) ||
          customer.warranty_reference_number?.toLowerCase().includes(searchLower) ||
          customer.warranty_number?.toLowerCase().includes(searchLower) ||
          customer.plan_type?.toLowerCase().includes(searchLower) ||
          customer.payment_type?.toLowerCase().includes(searchLower) ||
          customer.discount_code?.toLowerCase().includes(searchLower) ||
          customer.stripe_session_id?.toLowerCase().includes(searchLower) ||
          customer.bumper_order_id?.toLowerCase().includes(searchLower) ||
          customer.stripe_customer_id?.toLowerCase().includes(searchLower) ||
          customer.status?.toLowerCase().includes(searchLower) ||
          customer.customer_policies?.some(policy => 
            policy.policy_number?.toLowerCase().includes(searchLower) ||
            policy.warranty_number?.toLowerCase().includes(searchLower)
          );
      });
    }

    // Apply plan filter
    if (filterByPlan !== 'all') {
      filtered = filtered.filter(customer =>
        customer.plan_type?.toLowerCase() === filterByPlan.toLowerCase()
      );
    }

    // Apply status filter - using cached data instead of DB calls
    if (filterByStatus !== 'all') {
      if (filterByStatus === 'refunded') {
        filtered = filtered.filter(customer => refundedCustomerIds.has(customer.id));
      } else if (filterByStatus === 'cancelled_and_refunded') {
        filtered = filtered.filter(customer =>
          refundedCustomerIds.has(customer.id) || customer.status?.toLowerCase() === 'cancelled'
        );
      } else {
        filtered = filtered.filter(customer =>
          customer.status?.toLowerCase() === filterByStatus.toLowerCase()
        );
      }
    }

    // Hide "Claim Made" customers from sales agents and sales leads
    if (isSalesScopedRole) {
      filtered = filtered.filter(customer => customer.status?.toLowerCase() !== 'claim_made');
    }

    // Apply tag filter - using cached data instead of DB calls
    if (filterByTag !== 'all') {
      const taggedIds = tagAssignmentsCache[filterByTag];
      if (taggedIds) {
        filtered = filtered.filter(customer => taggedIds.has(customer.id));
      } else {
        filtered = [];
      }
    }

    // Apply source filter based on warranty number prefix as single source of truth
    // BAW- = website/self-service, ADM- = manual/sales-team confirmed
    if (filterBySource !== 'all_view') {
      filtered = filtered.filter(customer => {
        // Get the definitive warranty number (from policy first, then customer record)
        const warrantyNum = customer.customer_policies?.[0]?.warranty_number || 
                           customer.warranty_reference_number || 
                           customer.warranty_number || '';
        
        if (filterBySource === 'website') {
          // BAW- prefix (but NOT BAW-S-) AND not assigned to an agent = pure website sale
          return warrantyNum.startsWith('BAW-') && !warrantyNum.startsWith('BAW-S-') && !customer.assigned_to;
        } else if (filterBySource === 'website_google') {
          // Website sale with Google Ads attribution
          const isWebsite = warrantyNum.startsWith('BAW-') && !warrantyNum.startsWith('BAW-S-') && !customer.assigned_to;
          const source = customer.purchase_source?.toLowerCase() || '';
          return isWebsite && source === 'google_ads';
        } else if (filterBySource === 'website_facebook') {
          // Website sale with Facebook Ads attribution
          const isWebsite = warrantyNum.startsWith('BAW-') && !warrantyNum.startsWith('BAW-S-') && !customer.assigned_to;
          const source = customer.purchase_source?.toLowerCase() || '';
          return isWebsite && source === 'facebook_ads';
        } else if (filterBySource === 'website_organic') {
          // Website sale with no paid attribution (organic)
          const isWebsite = warrantyNum.startsWith('BAW-') && !warrantyNum.startsWith('BAW-S-') && !customer.assigned_to;
          const source = customer.purchase_source?.toLowerCase() || '';
          return isWebsite && source !== 'google_ads' && source !== 'facebook_ads';
        } else if (filterBySource === 'staff_purchase') {
          // BAW-S- prefix OR BAW- with an agent assigned = staff claimed purchase
          return warrantyNum.startsWith('BAW-S-') || (warrantyNum.startsWith('BAW-') && !!customer.assigned_to);
        } else if (filterBySource === 'quote_order') {
          // ADM- prefix = sales team confirmed / manual entry
          return warrantyNum.startsWith('ADM');
        } else if (filterBySource === 'agent_sales') {
          // Combined: BAW-S- (staff purchase) + ADM- (quote & orders)
          return warrantyNum.startsWith('BAW-S-') || warrantyNum.startsWith('ADM');
        } else if (filterBySource === 'cancelled_refunded') {
          const status = customer.status?.toLowerCase() || '';
          return status === 'cancelled' || status === 'refunded';
        }
        return true;
      });
    }

    // Apply agent filter — skip when sales/sales_lead is actively searching
    const isSalesSearching = !!debouncedSearchTerm && isSalesScopedRole;

    // For sales agents: enforce own-agent filter when no explicit agent selection or search bypass
    const effectiveAgentFilter = (isSalesAgent && filterByAgent === 'all' && !isSalesSearching)
      ? (effectiveAdminId || currentAdminUser.id)  // Default to own deals even if somehow reset to 'all'
      : filterByAgent;

    if (effectiveAgentFilter !== 'all' && !isSalesSearching) {
      if (effectiveAgentFilter === 'unassigned') {
        filtered = filtered.filter(customer => !customer.assigned_to);
      } else {
        filtered = filtered.filter(customer => customer.assigned_to === effectiveAgentFilter);
      }
    }

    // Apply warranty period filter
    if (filterByWarrantyPeriod !== 'all') {
      const targetMonths = parseInt(filterByWarrantyPeriod, 10);
      filtered = filtered.filter(customer => {
        const warrantyMonths = getWarrantyDurationInMonths(customer.payment_type || '');
        return warrantyMonths === targetMonths;
      });
    }

    // Apply date range filter — bypass when actively searching (so users can find any customer by name/email/reg)
    // For sales agents: ALWAYS enforce 2-month restriction even if dateRange state is somehow cleared
    const isActivelySearching = !!debouncedSearchTerm;
    const isSalesAgentSearching = isActivelySearching && isSalesAgent;
    if (!isActivelySearching || (isSalesAgent && !isSalesAgentSearching)) {
      let effectiveDateRange = dateRange;
      
      // Hard enforcement: sales agents are locked to the selected period, capped at 2 months max
      if (isSalesAgent) {
        const lockedRange = getAgentCountsDateRange(totalSalesDateFilter === 'all' ? '60days' : totalSalesDateFilter) || getAgentCountsDateRange('60days');
        if (lockedRange) {
          effectiveDateRange = { from: lockedRange.start, to: lockedRange.end };
        }
      }
      
      if (effectiveDateRange?.from) {
        filtered = filtered.filter(customer => {
          const signupDate = new Date(customer.signup_date);
          const fromDate = new Date(effectiveDateRange!.from!);
          fromDate.setHours(0, 0, 0, 0);
          
          if (effectiveDateRange!.to) {
            const toDate = new Date(effectiveDateRange!.to);
            toDate.setHours(23, 59, 59, 999);
            return signupDate >= fromDate && signupDate <= toDate;
          }
          return signupDate >= fromDate;
        });
      }
    }

    // Apply sorting - due today activations always come first
    filtered.sort((a, b) => {
      // Due today customers always at the top
      const aDueToday = isDueToday(a);
      const bDueToday = isDueToday(b);
      if (aDueToday && !bDueToday) return -1;
      if (!aDueToday && bDueToday) return 1;

      const dateA = new Date(a.signup_date).getTime();
      const dateB = new Date(b.signup_date).getTime();
      
      switch (sortBy) {
        case 'newest':
          return dateB - dateA;
        case 'oldest':
          return dateA - dateB;
        case 'name':
          return a.name.localeCompare(b.name);
        case 'email':
          return a.email.localeCompare(b.email);
        case 'plan':
          return (a.plan_type || '').localeCompare(b.plan_type || '');
        default:
          return dateB - dateA;
      }
    });

    setFilteredCustomers(filtered);
  }, [customers, debouncedSearchTerm, sortBy, filterByPlan, filterByStatus, filterByTag, filterBySource, filterByWarrantyPeriod, filterByAgent, dateRange, totalSalesDateFilter, tagAssignmentsCache, refundedCustomerIds, currentAdminUser, isSalesAgent, isSalesScopedRole, effectiveAdminId, isImpersonating]);

  const getCurrentUser = async () => {
    try {
      console.log('getCurrentUser: Starting...');
      const { data: { user }, error } = await supabase.auth.getUser();
      if (error) throw error;
      if (user) {
        console.log('getCurrentUser: Found user:', user.email);
        setCurrentUser({ id: user.id, email: user.email || '' });
        
        // Find the corresponding admin user
        const { data: adminUserData, error: adminError } = await supabase
          .from('admin_users')
          .select('id, user_id, email, first_name, last_name, role')
          .eq('user_id', user.id)
          .eq('is_active', true)
          .single();
          
        console.log('getCurrentUser: Admin user query result:', { adminUserData, adminError });
          
        if (!adminError && adminUserData) {
          console.log('getCurrentUser: Setting current admin user:', adminUserData);
          setCurrentAdminUser(adminUserData);
        } else if (adminError) {
          console.error('getCurrentUser: Admin user error:', adminError);
        }
      } else {
        console.log('getCurrentUser: No user found');
      }
    } catch (error) {
      console.error('Error getting current user:', error);
    }
  };

  const fetchAdminUsers = async () => {
    try {
      const { data, error } = await supabase
        .from('admin_users')
        .select('id, user_id, email, first_name, last_name, role')
        .eq('is_active', true);
      
      if (error) throw error;
      setAdminUsers(data || []);
      
      // Update current admin user if currentUser exists
      if (currentUser) {
        const currentAdmin = data?.find(admin => admin.user_id === currentUser.id);
        if (currentAdmin) {
          setCurrentAdminUser(currentAdmin);
        }
      }
    } catch (error) {
      console.error('Error fetching admin users:', error);
    }
  };

  const getAgentCountsDateRange = (period: string) => {
    const now = new Date();
    const todayStart = new Date(now.getFullYear(), now.getMonth(), now.getDate());
    const todayEnd = new Date(now.getFullYear(), now.getMonth(), now.getDate(), 23, 59, 59, 999);
    switch (period) {
      case 'today':
        return { start: todayStart, end: todayEnd };
      case 'yesterday': {
        const y = new Date(todayStart); y.setDate(y.getDate() - 1);
        const ye = new Date(y); ye.setHours(23, 59, 59, 999);
        return { start: y, end: ye };
      }
      case 'last7':
      case '7days':
        return { start: new Date(todayStart.getTime() - 6 * 86400000), end: todayEnd };
      case 'last14':
      case '14days':
        return { start: new Date(todayStart.getTime() - 13 * 86400000), end: todayEnd };
      case 'last30':
      case '30days':
        return { start: new Date(todayStart.getTime() - 29 * 86400000), end: todayEnd };
      case 'last60':
      case '60days':
        return { start: new Date(todayStart.getTime() - 59 * 86400000), end: todayEnd };
      case 'month':
      case 'this_month':
        return { start: new Date(now.getFullYear(), now.getMonth(), 1), end: new Date(now.getFullYear(), now.getMonth() + 1, 0, 23, 59, 59, 999) };
      case 'last_month':
        return { start: new Date(now.getFullYear(), now.getMonth() - 1, 1), end: new Date(now.getFullYear(), now.getMonth(), 0, 23, 59, 59, 999) };
      case 'all':
      default:
        return null;
    }
  };

  const fetchAgentDealCounts = async () => {
    try {
      // Prefer the explicit dateRange (from DateRangeFilter) over the dropdown period
      let range: { start: Date; end: Date } | null = null;
      if (dateRange?.from) {
        const from = new Date(dateRange.from);
        from.setHours(0, 0, 0, 0);
        const to = dateRange.to ? new Date(dateRange.to) : new Date(from);
        to.setHours(23, 59, 59, 999);
        range = { start: from, end: to };
      } else {
        range = getAgentCountsDateRange(isSalesAgent && totalSalesDateFilter === 'all' ? '60days' : totalSalesDateFilter);
      }

      let activeQuery = supabase
        .from('customers')
        .select('id, assigned_to')
        .eq('is_deleted', false)
        .ilike('status', 'active');

      let cancelledQuery = supabase
        .from('customers')
        .select('id, assigned_to')
        .eq('is_deleted', false)
        .or('status.ilike.cancelled,status.ilike.refunded');

      let claimsQuery = supabase
        .from('commission_claims')
        .select('id, agent_id')
        .eq('status', 'approved');

      if (range) {
        activeQuery = activeQuery.gte('created_at', range.start.toISOString()).lte('created_at', range.end.toISOString());
        cancelledQuery = cancelledQuery.gte('updated_at', range.start.toISOString()).lte('updated_at', range.end.toISOString());
        claimsQuery = claimsQuery.gte('created_at', range.start.toISOString()).lte('created_at', range.end.toISOString());
      }

      const { data: activeCustomers } = await activeQuery;
      const { data: cancelledCustomers } = await cancelledQuery;
      const { data: approvedClaims } = await claimsQuery;

      const counts: Record<string, { sales: number; cancelled: number }> = {};
      const ensure = (id: string) => { if (!counts[id]) counts[id] = { sales: 0, cancelled: 0 }; };
      (activeCustomers || []).forEach(c => {
        if (c.assigned_to) { ensure(c.assigned_to); counts[c.assigned_to].sales++; }
      });
      (approvedClaims || []).forEach(c => {
        if (c.agent_id) { ensure(c.agent_id); counts[c.agent_id].sales++; }
      });
      (cancelledCustomers || []).forEach(c => {
        if (c.assigned_to) { ensure(c.assigned_to); counts[c.assigned_to].cancelled++; }
      });
      setAgentDealCounts(counts);
    } catch (error) {
      console.error('Error fetching agent deal counts:', error);
    }
  };

  const fetchPlans = async () => {
    try {
      const { data, error } = await supabase
        .from('plans')
        .select('name')
        .eq('is_active', true);
      
      if (error) throw error;
      setPlans(data || []);
    } catch (error) {
      console.error('Error fetching plans:', error);
    }
  };

  const normaliseEmail = (value?: string | null) => value?.trim().toLowerCase() || '';
  const normaliseReg = (value?: string | null) => value?.toUpperCase().replace(/\s+/g, '') || '';
  const normalisePhone = (value?: string | null) => value?.replace(/\s+/g, '') || '';

  const fetchPhoneSources = async (table: 'sales_leads' | 'abandoned_carts') => {
    const pageSize = 1000;
    let from = 0;
    const rows: Array<{ email: string | null; vehicle_reg: string | null; phone: string | null; created_at: string }> = [];

    while (true) {
      const { data, error } = await supabase
        .from(table)
        .select('email, vehicle_reg, phone, created_at')
        .not('phone', 'is', null)
        .order('created_at', { ascending: false })
        .range(from, from + pageSize - 1);

      if (error) throw error;

      const valid = (data || []).filter((row: any) => row.phone && String(row.phone).trim().length > 0);
      rows.push(...valid);

      if (!data || data.length < pageSize) break;
      from += pageSize;
    }

    return rows;
  };

  const recoverMissingPhones = async (customerRows: Customer[]) => {
    const missing = customerRows.filter((customer) => !customer.phone || !customer.phone.trim());
    if (missing.length === 0) {
      return { recoveredRows: customerRows, recoveredCount: 0 };
    }

    const [salesPhones, cartPhones] = await Promise.all([
      fetchPhoneSources('sales_leads'),
      fetchPhoneSources('abandoned_carts'),
    ]);

    const phoneByEmail = new Map<string, string>();
    const phoneByReg = new Map<string, string>();

    for (const source of [...salesPhones, ...cartPhones]) {
      const phone = normalisePhone(source.phone);
      if (!phone) continue;

      const emailKey = normaliseEmail(source.email);
      const regKey = normaliseReg(source.vehicle_reg);

      if (emailKey && !phoneByEmail.has(emailKey)) {
        phoneByEmail.set(emailKey, phone);
      }

      if (regKey && !phoneByReg.has(regKey)) {
        phoneByReg.set(regKey, phone);
      }
    }

    let recoveredCount = 0;

    const recoveredRows = customerRows.map((customer) => {
      if (customer.phone && customer.phone.trim()) return customer;

      const recoveredPhone =
        phoneByEmail.get(normaliseEmail(customer.email)) ||
        phoneByReg.get(normaliseReg(customer.registration_plate));

      if (!recoveredPhone) return customer;

      recoveredCount += 1;
      return {
        ...customer,
        phone: recoveredPhone,
      };
    });

    const rowsToPersist = recoveredRows.filter((customer) => {
      const original = customerRows.find((row) => row.id === customer.id);
      return (!original?.phone || !original.phone.trim()) && !!customer.phone;
    });

    if (rowsToPersist.length > 0) {
      await Promise.all(
        rowsToPersist.map((customer) =>
          supabase
            .from('customers')
            .update({ phone: customer.phone })
            .eq('id', customer.id)
        )
      );
    }

    return { recoveredRows, recoveredCount };
  };

  const fetchCustomers = async () => {
    try {
      // Only show full loading spinner on initial load
      if (!initialLoadDone) {
        setLoading(true);
      }
      setDebugInfo('Starting fetch...');

      // Check current user
      const { data: { user }, error: userError } = await supabase.auth.getUser();
      console.log('👤 Current user:', user);
      console.log('❌ User error:', userError);
      
      const isMasterAdmin = localStorage.getItem('masterAdmin') === 'true';
      console.log('🔐 Is master admin:', isMasterAdmin);
      
      setDebugInfo(`User: ${user?.email || 'Master Admin'}, Master Admin: ${isMasterAdmin}`);

      // Query both customers and orphaned policies (policies without customer records)
      console.log('📊 Attempting query with policy data and real customers only...');
      
      // First get customers with their policies and assigned admin details (exclude soft-deleted)
      const { data: customersData, error: customersError } = await supabase
        .from('customers')
        .select(`
          *,
          customer_policies!customer_id(
            id,
            policy_number,
            policy_end_date,
            policy_start_date,
            status,
            warranty_number,
            email_sent_status,
            warranties_2000_status,
            warranties_2000_sent_at,
            warranties_2000_scheduled_for,
            mot_fee,
            tyre_cover,
            wear_tear,
            europe_cover,
            transfer_cover,
            breakdown_recovery,
            vehicle_rental,
            claim_limit,
            mot_repair,
            lost_key,
            consequential,
            additional_notes,
            seasonal_bonus_months,
            user_id,
            customer_id,
            email
          ),
          admin_users!assigned_to(
            id,
            first_name,
            last_name,
            email
          )
        `)
        .not('email', 'ilike', '%@test.com%')
        .not('email', 'ilike', '%testuser%')
        .not('email', 'ilike', '%guest@%')
        .not('name', 'eq', 'Test Customer')
        .not('name', 'eq', 'Guest Customer')
        .eq('is_deleted', false)
        .order('updated_at', { ascending: false })
        .limit(3000);

      // Then get orphaned policies (policies without customer records)
      const { data: orphanedPolicies, error: orphanedError } = await supabase
        .from('customer_policies')
        .select('*')
        .is('customer_id', null)
        .order('created_at', { ascending: false })
        .limit(500);

      let directData = customersData || [];
      let directError = customersError;
      
      // Add orphaned policies as customer records
      if (orphanedPolicies && orphanedPolicies.length > 0) {
        const orphanedAsCustomers = orphanedPolicies.map(policy => ({
          id: policy.id,
          name: 'Unknown Customer',
          email: policy.email,
          phone: null,
          first_name: null,
          last_name: null,
          flat_number: null,
          building_name: null,
          building_number: null,
          street: null,
          town: null,
          county: null,
          postcode: null,
          country: 'United Kingdom',
          plan_type: policy.plan_type,
          signup_date: policy.created_at,
          voluntary_excess: 0, // Orphaned policies don't have voluntary excess data
          status: 'Incomplete Record',
          registration_plate: 'Unknown',
          vehicle_make: null,
          vehicle_model: null,
          vehicle_year: null,
          vehicle_fuel_type: null,
          vehicle_transmission: null,
          mileage: null,
          payment_type: policy.payment_type,
          stripe_session_id: null,
          bumper_order_id: policy.policy_number?.startsWith('BAW-') ? policy.policy_number : null,
          discount_code: null,
          discount_amount: 0,
          original_amount: null,
          final_amount: null,
          assigned_to: null,
          warranty_reference_number: null,
          customer_policies: [policy],
          created_at: policy.created_at,
          updated_at: policy.updated_at,
          stripe_customer_id: null,
          warranty_number: null,
          admin_users: null,
          is_deleted: false,
          deleted_at: undefined,
          deleted_by: undefined,
          last_login: null,
          // Add missing add-on columns
          tyre_cover: false,
          wear_tear: false,
          europe_cover: false,
          transfer_cover: false,
          breakdown_recovery: false,
          vehicle_rental: false,
          mot_fee: false,
          mot_repair: false,
          lost_key: false,
          consequential: false,
          claim_limit: policy.claim_limit || 1250,
          brevo_contact_id: null,
          review_email_sent_at: null,
          seasonal_bonus_months: 0,
          labour_rate: 70,
          manual_upgrade_at: null,
          manual_upgrade_by: null,
          manual_upgrade_notes: null,
          // Review tracking columns
          trustpilot_review_requested: false,
          trustpilot_review_requested_at: null,
          trustpilot_review_completed: false,
          trustpilot_review_completed_at: null,
          google_review_requested: false,
          google_review_requested_at: null,
          google_review_completed: false,
          google_review_completed_at: null,
          // Payment verification columns
          is_manual_entry: true,
          payment_verified: false,
          // Purchase source tracking
          purchase_source: 'external' as const,
          // Sales agent attribution
          quote_sent_by: null,
          payment_confirmed_by: null,
          gclid: null,
          ga_client_id: null,
          payment_due_date: null,
          google_ads_conversion_uploaded_at: null,
          google_ads_conversion_status: null,
          customer_dob: null,
          dealer_id: null
        }));
        
        directData = [...directData, ...orphanedAsCustomers];
      }
      
      const directCount = directData.length;

      console.log('📊 Query result:', { data: directData, error: directError, count: directCount });

      if (directError) {
        console.error('❌ Query error, trying fallback without policies:', directError);
        setDebugInfo(prev => prev + `\nQuery with policies error: ${directError.message}, trying fallback...`);
        
        // Fallback: try without joining policies table
        const { data: fallbackData, error: fallbackError } = await supabase
          .from('customers')
          .select('*');
          
        if (fallbackError) {
          console.error('❌ Fallback query error:', fallbackError);
          setDebugInfo(prev => prev + `\nFallback query error: ${fallbackError.message}`);
          
          // Auto-refresh session on JWT expired
          if (fallbackError.message?.includes('JWT expired')) {
            console.log('🔄 JWT expired, refreshing session...');
            const { error: refreshError } = await supabase.auth.refreshSession();
            if (!refreshError) {
              toast.info('Session refreshed. Please try again.');
            } else {
              toast.error('Session expired. Please log in again.');
              window.location.href = '/auth';
            }
            return;
          }
          
          if (isMasterAdmin) {
            toast.error('RLS policies might be blocking access. Check database policies.');
          } else {
            toast.error(`Database query failed: ${fallbackError.message}`);
          }
          return;
        }
        
        // Process fallback data (without warranty expiry)
        const processedData = fallbackData?.map((customer: any) => ({
          ...customer,
          warranty_expiry: null,
          last_login: customer.last_login || null
        })) || [];
        
        setCustomers(processedData);
        setFilteredCustomers(processedData);
        toast.success(`Loaded ${processedData.length} customers (warranty expiry unavailable)`);
        return;
      }

      console.log('✅ Query successful, processing data...');
      setDebugInfo(prev => prev + `\nQuery successful. Count: ${directCount}`);
      
      if (!directData || directData.length === 0) {
        console.warn('⚠️ No customers found in database');
        setDebugInfo(prev => prev + '\nNo customers found in result');
        toast.info('No customers found in database. Check if data was inserted correctly.');
      } else {
        console.log('✅ Found customers:', directData.length);
        setDebugInfo(prev => prev + `\nFound ${directData.length} customers`);
        toast.success(`Loaded ${directData.length} customers`);
      }
      
      // Fetch lead dates from sales_leads for all customers (by email)
      const customerEmails = directData?.map((c: any) => c.email?.toLowerCase()).filter(Boolean) || [];
      let leadDateMap: Record<string, string> = {};
      if (customerEmails.length > 0) {
        try {
          // Fetch in batches of 200 to stay under query limits
          for (let i = 0; i < customerEmails.length; i += 200) {
            const batch = customerEmails.slice(i, i + 200);
            const { data: leadsData } = await supabase
              .from('sales_leads')
              .select('email, created_at')
              .in('email', batch)
              .order('created_at', { ascending: true });
            if (leadsData) {
              for (const lead of leadsData) {
                const key = lead.email?.toLowerCase();
                if (key && !leadDateMap[key]) {
                  leadDateMap[key] = lead.created_at; // earliest lead date
                }
              }
            }
          }
        } catch (e) {
          console.warn('Could not fetch lead dates:', e);
        }
      }

      // Process the data to flatten the customer_policies relationship
      const processedData = directData?.map((customer: any) => ({
        ...customer,
        warranty_expiry: customer.customer_policies?.[0]?.policy_end_date || null,
        warranty_reference_number: customer.warranty_reference_number || null,
        policy_number: customer.customer_policies?.[0]?.policy_number || null,
        policy_status: customer.customer_policies?.[0]?.status || null,
        policy_start_date: customer.customer_policies?.[0]?.policy_start_date || null,
        warranties_2000_scheduled_for: customer.customer_policies?.[0]?.warranties_2000_scheduled_for || null,
        last_login: customer.last_login || null,
        lead_date: leadDateMap[customer.email?.toLowerCase()] || null
      })) || [];

      const { recoveredRows, recoveredCount } = await recoverMissingPhones(processedData);

      setCustomers(recoveredRows);
      setFilteredCustomers(recoveredRows);

      if (recoveredCount > 0) {
        toast.success(`Recovered ${recoveredCount} missing phone number${recoveredCount > 1 ? 's' : ''} from Step 2 backups`);
      }
      
      // Fetch email statuses after customers are loaded
      fetchEmailStatuses();
    } catch (error) {
      console.error('💥 Unexpected error fetching customers:', error);
      setDebugInfo(prev => prev + `\nUnexpected error: ${error}`);
      toast.error('Unexpected error occurred while fetching customers');
    } finally {
      setLoading(false);
      if (!initialLoadDone) setInitialLoadDone(true);
    }
  };

  const fetchIncompleteCustomers = async () => {
    try {
      setIncompleteLoading(true);
      console.log('🔍 Fetching incomplete customers...');
      
      const { data, error } = await supabase
        .from('abandoned_carts')
        .select('*')
        .order('created_at', { ascending: false });

      if (error) {
        console.error('Error fetching incomplete customers:', error);
        throw error;
      }

      console.log('✅ Found incomplete customers:', data?.length || 0);
      setIncompleteCustomers(data || []);
      setFilteredIncompleteCustomers(data || []);
    } catch (error) {
      console.error('Error fetching incomplete customers:', error);
      toast.error('Failed to load incomplete customers');
    } finally {
      setIncompleteLoading(false);
    }
  };

  const handleDeleteIncompleteCustomer = async (customerId: string) => {
    try {
      const { error } = await supabase
        .from('abandoned_carts')
        .delete()
        .eq('id', customerId);

      if (error) {
        console.error('Error deleting incomplete customer:', error);
        throw error;
      }

      toast.success('Incomplete customer deleted successfully');
      await fetchIncompleteCustomers();
    } catch (error) {
      console.error('Error deleting incomplete customer:', error);
      toast.error('Failed to delete incomplete customer');
    }
  };

  const handleBulkDeleteIncompleteCustomers = async () => {
    try {
      const { error } = await supabase
        .from('abandoned_carts')
        .delete()
        .in('id', selectedIncompleteCustomers);

      if (error) {
        console.error('Error deleting incomplete customers:', error);
        throw error;
      }

      toast.success(`Successfully deleted ${selectedIncompleteCustomers.length} incomplete customer${selectedIncompleteCustomers.length > 1 ? 's' : ''}`);
      
      // Clear selection and refresh
      setSelectedIncompleteCustomers([]);
      await fetchIncompleteCustomers();
    } catch (error) {
      console.error('Error deleting incomplete customers:', error);
      toast.error('Failed to delete incomplete customers');
    }
  };

  const fetchDeletedCustomers = async () => {
    try {
      setDeletedLoading(true);
      console.log('🔍 Fetching deleted customers...');
      
      // First fetch deleted customers
      const { data: customersData, error: customersError } = await supabase
        .from('customers')
        .select(`
          *,
          customer_policies!customer_id(
            id,
            policy_number,
            policy_end_date,
            policy_start_date,
            status,
            warranty_number,
            email_sent_status,
            warranties_2000_status,
            warranties_2000_sent_at,
            mot_fee,
            tyre_cover,
            wear_tear,
            europe_cover,
            transfer_cover,
            breakdown_recovery,
            vehicle_rental,
            claim_limit,
            mot_repair,
            lost_key,
            consequential,
            additional_notes,
            seasonal_bonus_months,
            user_id,
            customer_id,
            email
          )
        `)
        .eq('is_deleted', true)
        .order('deleted_at', { ascending: false });

      if (customersError) {
        console.error('Error fetching deleted customers:', customersError);
        throw customersError;
      }

      // Fetch admin users separately to match deleted_by
      const { data: adminUsersData } = await supabase
        .from('admin_users')
        .select('id, user_id, first_name, last_name, email');

      // Create a map of user_id to admin user info
      const adminUserMap = new Map(
        (adminUsersData || []).map(admin => [admin.user_id, admin])
      );

      const processedData = customersData?.map((customer: any) => {
        // Look up the admin user who deleted this customer
        const deletedByAdmin = customer.deleted_by ? adminUserMap.get(customer.deleted_by) : null;
        
        return {
          ...customer,
          warranty_expiry: customer.customer_policies?.[0]?.policy_end_date || null,
          warranty_reference_number: customer.warranty_reference_number || null,
          policy_number: customer.customer_policies?.[0]?.policy_number || null,
          policy_status: customer.customer_policies?.[0]?.status || null,
          admin_users: deletedByAdmin || null
        };
      }) || [];

      console.log('✅ Found deleted customers:', processedData.length);
      setDeletedCustomers(processedData);
      setFilteredDeletedCustomers(processedData);
    } catch (error) {
      console.error('Error fetching deleted customers:', error);
      toast.error('Failed to load deleted customers');
    } finally {
      setDeletedLoading(false);
    }
  };

  const restoreCustomer = async (customerId: string, customerName: string) => {
    if (!canDeleteCustomers()) {
      toast.error('Only administrators can restore customer records');
      return;
    }

    if (!confirm(`Restore "${customerName}"? This will make the order active again.`)) {
      return;
    }

    setRestoreLoading(prev => ({ ...prev, [customerId]: true }));

    try {
      const { error } = await supabase.rpc('restore_customer', {
        customer_uuid: customerId
      });

      if (error) {
        console.error('Error restoring customer:', error);
        toast.error('Failed to restore customer: ' + error.message);
        return;
      }

      toast.success(`"${customerName}" restored successfully!`);
      fetchCustomers();
      fetchDeletedCustomers();
    } catch (error) {
      console.error('Unexpected error restoring record:', error);
      toast.error('An unexpected error occurred while restoring the record');
    } finally {
      setRestoreLoading(prev => ({ ...prev, [customerId]: false }));
    }
  };

  const updateContactStatus = async (
    customerId: string, 
    status: string, 
    notes?: string
  ) => {
    try {
      const { error } = await supabase
        .from('abandoned_carts')
        .update({
          contact_status: status,
          contact_notes: notes,
          last_contacted_at: new Date().toISOString(),
          contacted_by: (await supabase.auth.getUser()).data.user?.id
        })
        .eq('id', customerId);

      if (error) throw error;

      toast.success('Contact status updated successfully');
      fetchIncompleteCustomers(); // Refresh the list
    } catch (error) {
      console.error('Error updating contact status:', error);
      toast.error('Failed to update contact status');
    }
  };

  // Update review status (Trustpilot/Google)
  const updateReviewStatus = async (
    customerId: string,
    field: 'trustpilot_review_requested' | 'trustpilot_review_completed' | 'google_review_requested' | 'google_review_completed',
    value: boolean
  ) => {
    try {
      const updateData: Record<string, any> = { [field]: value };
      
      // Add timestamp if marking as true
      if (value) {
        const timestampField = field + '_at';
        updateData[timestampField] = new Date().toISOString();
      }

      const { error } = await supabase
        .from('customers')
        .update(updateData)
        .eq('id', customerId);

      if (error) throw error;

      // Update local state
      setCustomers(prev => prev.map(c => 
        c.id === customerId 
          ? { ...c, [field]: value, [field + '_at']: value ? new Date().toISOString() : null }
          : c
      ));
      setFilteredCustomers(prev => prev.map(c => 
        c.id === customerId 
          ? { ...c, [field]: value, [field + '_at']: value ? new Date().toISOString() : null }
          : c
      ));

      toast.success('Review status updated');
    } catch (error) {
      console.error('Error updating review status:', error);
      toast.error('Failed to update review status');
    }
  };

  const sendBulkReminderEmails = async () => {
    if (selectedIncompleteCustomers.length === 0) {
      toast.error('Please select at least one customer');
      return;
    }

    try {
      const selectedCustomerData = filteredIncompleteCustomers.filter(c => 
        selectedIncompleteCustomers.includes(c.id)
      );

      toast.info(`Sending reminder emails to ${selectedCustomerData.length} customers...`);

      const { data, error } = await supabase.functions.invoke('send-bulk-reminder-emails', {
        body: { customers: selectedCustomerData }
      });

      if (error) throw error;

      toast.success(`Successfully sent ${selectedCustomerData.length} reminder emails`);
      
      // Update contact status for all selected customers
      await Promise.all(
        selectedIncompleteCustomers.map(id => 
          updateContactStatus(id, 'contacted', 'Bulk reminder email sent')
        )
      );

      setSelectedIncompleteCustomers([]);
    } catch (error) {
      console.error('Error sending bulk emails:', error);
      toast.error('Failed to send bulk emails');
    }
  };

  const updateBulkContactStatus = async (status: string) => {
    if (selectedIncompleteCustomers.length === 0) {
      toast.error('Please select at least one customer');
      return;
    }

    try {
      await Promise.all(
        selectedIncompleteCustomers.map(id => 
          updateContactStatus(id, status)
        )
      );

      toast.success(`Updated ${selectedIncompleteCustomers.length} customer statuses`);
      setSelectedIncompleteCustomers([]);
    } catch (error) {
      console.error('Error updating bulk status:', error);
      toast.error('Failed to update statuses');
    }
  };

  const toggleSelectAll = () => {
    if (selectedIncompleteCustomers.length === filteredIncompleteCustomers.length) {
      setSelectedIncompleteCustomers([]);
    } else {
      setSelectedIncompleteCustomers(filteredIncompleteCustomers.map(c => c.id));
    }
  };

  const toggleSelectCustomer = (customerId: string) => {
    setSelectedIncompleteCustomers(prev => 
      prev.includes(customerId)
        ? prev.filter(id => id !== customerId)
        : [...prev, customerId]
    );
  };

  const fetchNotes = async (customerId: string) => {
    setNotesLoading(true);
    try {
      const { data, error } = await supabase
        .from('admin_notes')
        .select('*')
        .eq('customer_id', customerId)
        .order('created_at', { ascending: false });

      if (error) {
        console.error('Error fetching notes:', error);
        throw error;
      }
      
      setNotes(data || []);
    } catch (error) {
      console.error('Error fetching notes:', error);
      toast.error('Failed to load notes');
    } finally {
      setNotesLoading(false);
    }
  };

  const assignCustomerToAgent = async (customerId: string, agentId: string | null, markAsWebsite: boolean = false) => {
    setAssignmentLoading(prev => ({ ...prev, [customerId]: true }));

    try {
      const { error } = await supabase
        .from('customers')
        .update({ assigned_to: agentId })
        .eq('id', customerId);

      if (error) {
        console.error('Assignment error:', error);
        throw error;
      }

      // Reverse sync: update matching sales_leads record by email
      const customer = customers.find(c => c.id === customerId);
      if (customer?.email) {
        const cleanEmail = customer.email.toLowerCase().trim();
        await supabase
          .from('sales_leads')
          .update({ 
            assigned_to: agentId, 
            assigned_at: agentId ? new Date().toISOString() : null,
            updated_at: new Date().toISOString() 
          })
          .eq('email', cleanEmail);
      }
      const policyWarrantyNum = customer?.customer_policies?.[0]?.warranty_number || '';
      const policyId = customer?.customer_policies?.[0]?.id;

      if (markAsWebsite) {
        // Revert BAW-S- back to BAW- (website sale)
        if (policyWarrantyNum.startsWith('BAW-S-') && policyId) {
          const newWarrantyNum = policyWarrantyNum.replace('BAW-S-', 'BAW-');
          await supabase
            .from('customer_policies')
            .update({ warranty_number: newWarrantyNum })
            .eq('id', policyId);
          console.log(`Warranty number updated: ${policyWarrantyNum} → ${newWarrantyNum} (website sale)`);
        }
        toast.success('Customer marked as Website sale');
      } else if (agentId) {
        // When assigning to an agent, change BAW- prefix to BAW-S- (staff purchase)
        if (policyWarrantyNum.startsWith('BAW-') && !policyWarrantyNum.startsWith('BAW-S-') && policyId) {
          const newWarrantyNum = policyWarrantyNum.replace('BAW-', 'BAW-S-');
          await supabase
            .from('customer_policies')
            .update({ warranty_number: newWarrantyNum })
            .eq('id', policyId);
          console.log(`Warranty number updated: ${policyWarrantyNum} → ${newWarrantyNum} (staff purchase)`);
        }

        const agent = adminUsers.find(u => u.id === agentId);
        const agentName = agent ? `${agent.first_name || ''} ${agent.last_name || ''}`.trim() || agent.email : 'agent';
        toast.success(`Customer assigned to ${agentName}`);
      } else {
        toast.success('Customer unassigned successfully');
      }
      fetchCustomers();
    } catch (error) {
      console.error('Error assigning customer:', error);
      toast.error('Failed to assign customer');
    } finally {
      setAssignmentLoading(prev => ({ ...prev, [customerId]: false }));
    }
  };

  const assignCustomerToMe = async (customerId: string) => {
    if (!currentAdminUser) {
      toast.error('Unable to assign customer - admin user not found');
      return;
    }
    await assignCustomerToAgent(customerId, currentAdminUser.id);
  };

  const unassignCustomer = async (customerId: string) => {
    await assignCustomerToAgent(customerId, null);
  };

  const addNote = async () => {
    if (!newNote.trim() || !selectedCustomer) {
      toast.error('Please enter a note');
      return;
    }

    try {
      console.log('Adding note for customer:', selectedCustomer.id);
      console.log('Note content:', newNote);
      console.log('Note date:', noteDate.toISOString());

      // Check if user is authenticated or master admin
      const { data: { user } } = await supabase.auth.getUser();
      const isMasterAdmin = localStorage.getItem('masterAdmin') === 'true';
      
      const noteData = {
        customer_id: selectedCustomer.id,
        note: newNote,
        created_at: noteDate.toISOString(),
        created_by: isMasterAdmin ? null : user?.id
      };

      console.log('Inserting note data:', noteData);

      const { data, error } = await supabase
        .from('admin_notes')
        .insert([noteData])
        .select();

      if (error) {
        console.error('Database error adding note:', error);
        throw error;
      }

      console.log('Note added successfully:', data);
      
      setNewNote('');
      setNoteDate(new Date());
      fetchNotes(selectedCustomer.id);
      toast.success('Note added successfully');
    } catch (error) {
      console.error('Error adding note:', error);
      toast.error(`Failed to add note: ${error.message || 'Unknown error'}`);
    }
  };

  const updateCustomer = async () => {
    if (!editingCustomer) return;

    try {
      // Update customer table
      const { error: customerError } = await supabase
        .from('customers')
        .update({
          name: editingCustomer.name,
          email: editingCustomer.email,
          phone: editingCustomer.phone,
          first_name: editingCustomer.first_name,
          last_name: editingCustomer.last_name,
          flat_number: editingCustomer.flat_number,
          building_name: editingCustomer.building_name,
          building_number: editingCustomer.building_number,
          street: editingCustomer.street,
          town: editingCustomer.town,
          county: editingCustomer.county,
          postcode: editingCustomer.postcode,
          country: editingCustomer.country,
          registration_plate: editingCustomer.registration_plate,
          vehicle_make: editingCustomer.vehicle_make,
          vehicle_model: editingCustomer.vehicle_model,
          vehicle_year: editingCustomer.vehicle_year,
          vehicle_fuel_type: editingCustomer.vehicle_fuel_type,
          vehicle_transmission: editingCustomer.vehicle_transmission,
          mileage: editingCustomer.mileage,
          plan_type: editingCustomer.plan_type,
          payment_type: editingCustomer.payment_type,
          status: editingCustomer.status,
          voluntary_excess: editingCustomer.voluntary_excess,
          claim_limit: editingCustomer.claim_limit,
          discount_code: editingCustomer.discount_code,
          original_amount: editingCustomer.original_amount,
          discount_amount: editingCustomer.discount_amount,
          final_amount: editingCustomer.final_amount,
          mot_fee: editingCustomer.mot_fee,
          tyre_cover: editingCustomer.tyre_cover,
          wear_tear: editingCustomer.wear_tear,
          europe_cover: editingCustomer.europe_cover,
          transfer_cover: editingCustomer.transfer_cover,
          breakdown_recovery: editingCustomer.breakdown_recovery,
          vehicle_rental: editingCustomer.vehicle_rental,
          mot_repair: editingCustomer.mot_repair,
          lost_key: editingCustomer.lost_key,
          consequential: editingCustomer.consequential,
          labour_rate: editingCustomer.labour_rate
        })
        .eq('id', editingCustomer.id);

      if (customerError) throw customerError;

      let authAccountCreated = false;
      // Create customer dashboard account if credentials provided
      if (editingCustomer.email && editingCustomer.temporary_password) {
        try {
          const { data: authData, error: authError } = await supabase.functions.invoke(
            'create-customer-account',
            {
              body: {
                email: editingCustomer.email,
                password: editingCustomer.temporary_password,
                firstName: editingCustomer.first_name || editingCustomer.name?.split(' ')[0] || '',
                lastName: editingCustomer.last_name || editingCustomer.name?.split(' ').slice(1).join(' ') || '',
                customerId: editingCustomer.id
              }
            }
          );

          if (authError) {
            console.error('Error creating auth account:', authError);
            toast.error(`Customer updated but failed to create auth account: ${authError.message}`);
          } else {
            console.log('Auth account created/updated successfully for:', editingCustomer.email);
            authAccountCreated = true;
          }
        } catch (authErr: any) {
          console.error('Exception creating auth account:', authErr);
          toast.warning('Customer updated but auth account creation had issues. Check admin notes.');
        }
      }

        // Update customer_policies table to sync warranty details
        if (editingCustomer.customer_policies && editingCustomer.customer_policies.length > 0) {
          const policyId = editingCustomer.customer_policies[0].id;
          
          const policyUpdateData: any = {
            plan_type: editingCustomer.plan_type,
            email: editingCustomer.email?.toLowerCase()?.trim(),
            customer_full_name: `${(editingCustomer.first_name || '').trim()} ${(editingCustomer.last_name || '').trim()}`.trim() || editingCustomer.name,
            voluntary_excess: editingCustomer.voluntary_excess,
            claim_limit: editingCustomer.claim_limit,
            payment_type: editingCustomer.payment_type,
            payment_amount: editingCustomer.final_amount || null,
            mot_fee: editingCustomer.mot_fee,
            tyre_cover: editingCustomer.tyre_cover,
            wear_tear: editingCustomer.wear_tear,
            europe_cover: editingCustomer.europe_cover,
            transfer_cover: editingCustomer.transfer_cover,
            breakdown_recovery: editingCustomer.breakdown_recovery,
            vehicle_rental: editingCustomer.vehicle_rental,
            mot_repair: editingCustomer.mot_repair,
            lost_key: editingCustomer.lost_key,
            consequential: editingCustomer.consequential,
            additional_notes: editingCustomer.customer_policies[0].additional_notes || null,
            updated_at: new Date().toISOString()
          };

          // Add policy dates if they exist
          if (editingCustomer.customer_policies[0].policy_start_date) {
            policyUpdateData.policy_start_date = new Date(editingCustomer.customer_policies[0].policy_start_date).toISOString();
          }
          if (editingCustomer.customer_policies[0].policy_end_date) {
            policyUpdateData.policy_end_date = new Date(editingCustomer.customer_policies[0].policy_end_date).toISOString();
          }
          
          const { error: policyError } = await supabase
            .from('customer_policies')
            .update(policyUpdateData)
            .eq('id', policyId);

          if (policyError) {
            console.error('Error updating policy:', policyError);
            toast.error('Customer updated but failed to sync policy details');
          } else if (authAccountCreated) {
            toast.success(`Customer, warranty, and auth account updated for ${editingCustomer.email}`);
          } else {
            toast.success('Customer and warranty details updated successfully');
          }
        } else {
          if (authAccountCreated) {
            toast.success(`Customer updated and auth account created for ${editingCustomer.email}`);
          } else {
            toast.success('Customer updated successfully');
          }
        }
      
      fetchCustomers();
      // Keep the dialog open with updated data so Print Letter / Send Update still work
      // Don't reset editingCustomer - just update it with the saved values
      
    } catch (error) {
      console.error('Error updating customer:', error);
      toast.error('Failed to update customer');
    }
  };

  const getExportData = useCallback(() => {
    const canViewFinancials = currentAdminUser?.role === 'super_admin' || currentAdminUser?.role === 'admin';
    return filteredCustomers.map(customer => {
      const row: Record<string, any> = {
        'Name': customer.name,
        'Email': customer.email,
        'Phone': customer.phone || '',
        'Address': `${customer.street || ''} ${customer.town || ''} ${customer.county || ''} ${customer.postcode || ''}`.trim(),
        'Registration Plate': customer.registration_plate || '',
        'Vehicle': `${customer.vehicle_make || ''} ${customer.vehicle_model || ''} ${customer.vehicle_year || ''}`.trim(),
        'Plan Type': customer.plan_type,
        'Payment Type': customer.payment_type || '',
        'Signup Date': new Date(customer.signup_date).toLocaleDateString('en-GB'),
        'Warranty Expiry': customer.warranty_expiry ? new Date(customer.warranty_expiry).toLocaleDateString('en-GB') : 'N/A',
        'Voluntary Excess': customer.voluntary_excess || 0,
        'Status': customer.status,
      };
      if (canViewFinancials) {
        row['Final Amount'] = customer.final_amount || 0;
      }
      return row;
    });
  }, [filteredCustomers, currentAdminUser?.role]);

  const handleExport = (format: 'csv' | 'xlsx') => {
    const exportData = getExportData();
    if (format === 'csv') {
      exportDataToCSV(exportData, { filename: 'customers', format: 'csv' });
    } else {
      exportToExcel(exportData, { filename: 'customers', format: 'xlsx' });
    }
  };

  const handleExportPDF = () => {
    const exportData = getExportData();
    if (!exportData.length) {
      toast.error('No data to export');
      return;
    }
    const headers = Object.keys(exportData[0]);
    const printWindow = window.open('', '_blank');
    if (!printWindow) return;
    printWindow.document.write(`<!DOCTYPE html><html><head><title>Customers Report</title>
      <style>
        body{font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',sans-serif;margin:20px;font-size:11px;color:#1a1a1a}
        h1{font-size:18px;margin-bottom:4px}
        p.meta{color:#666;font-size:12px;margin-bottom:16px}
        table{width:100%;border-collapse:collapse}
        th,td{border:1px solid #ddd;padding:5px 8px;text-align:left;white-space:nowrap}
        th{background:#f97316;color:#fff;font-size:10px;text-transform:uppercase}
        tr:nth-child(even){background:#f9f9f9}
        @media print{body{margin:10px}th{-webkit-print-color-adjust:exact;print-color-adjust:exact}}
      </style></head><body>
      <h1>Customers Report</h1>
      <p class="meta">Generated: ${new Date().toLocaleString('en-GB')} &bull; ${exportData.length} records</p>
      <table><thead><tr>${headers.map(h=>`<th>${h}</th>`).join('')}</tr></thead>
      <tbody>${exportData.map(row=>`<tr>${headers.map(h=>`<td>${row[h]??''}</td>`).join('')}</tr>`).join('')}</tbody></table>
      <script>window.onload=function(){window.print();setTimeout(function(){window.close()},100)}<\/script>
    </body></html>`);
    printWindow.document.close();
  };

  const fetchCustomerCredentials = async (customerEmail: string) => {
    try {
      setCredentialsLoading(true);
      const { data, error } = await supabase
        .from('welcome_emails')
        .select('email, temporary_password')
        .eq('email', customerEmail)
        .order('created_at', { ascending: false })
        .limit(1)
        .maybeSingle();
      
      if (error) {
        console.error('Error fetching customer credentials:', error);
        setCustomerCredentials(null);
        return;
      }
      
      if (data) {
        setCustomerCredentials({
          email: data.email,
          password: data.temporary_password
        });
      } else {
        setCustomerCredentials(null);
      }
    } catch (error) {
      console.error('Error fetching credentials:', error);
      setCustomerCredentials(null);
    } finally {
      setCredentialsLoading(false);
    }
  };

  const sendCredentialsEmail = async (customerEmail: string) => {
    try {
      setSendingCredentials(true);
      const { data, error } = await supabase.functions.invoke('resend-customer-credentials', {
        body: { email: customerEmail }
      });
      
      if (error) {
        toast.error('Failed to send credentials email: ' + error.message);
        return;
      }
      
      toast.success('Login credentials sent successfully to ' + customerEmail);
    } catch (error) {
      console.error('Error sending credentials:', error);
      toast.error('Failed to send credentials email');
    } finally {
      setSendingCredentials(false);
    }
  };

  const openCustomerDialog = (customer: Customer) => {
    setSelectedCustomer(customer);
    setEditingCustomer({ ...customer });
    fetchNotes(customer.id);
    fetchCustomerCredentials(customer.email);
  };

  // Check if current user can delete (admin role OR has delete permission)
  const canDeleteCustomers = () => {
    const isMasterAdmin = localStorage.getItem('masterAdmin') === 'true';
    const hasAdminRole = currentAdminUser?.role === 'admin' || currentAdminUser?.role === 'super_admin';
    
    // Admin role OR granular delete permission
    return isMasterAdmin || hasAdminRole || canDelete;
  };

  const deleteCustomer = async (customerId: string, customerName: string) => {
    if (!canDeleteCustomers()) {
      toast.error('Only administrators can delete customer records');
      return;
    }

    if (!confirm(`Are you sure you want to archive "${customerName}"? You can restore it anytime from the Order Archive.`)) {
      return;
    }

    try {
      const { data: { user } } = await supabase.auth.getUser();
      const adminId = user?.id;

      if (!adminId) {
        toast.error('Unable to identify admin user');
        return;
      }

      // Check if this is an orphaned policy (fake customer record)
      const isOrphanedPolicy = customerName === 'Unknown Customer';
      
      if (isOrphanedPolicy) {
        // This is an orphaned policy - soft delete the policy record directly
        console.log('Soft deleting orphaned policy with ID:', customerId);
        
        const { error: policyError } = await supabase
          .from('customer_policies')
          .update({
            is_deleted: true,
            deleted_at: new Date().toISOString(),
            deleted_by: adminId
          })
          .eq('id', customerId);

        if (policyError) {
          console.error('Error archiving orphaned policy:', policyError);
          toast.error('Failed to archive policy record: ' + policyError.message);
          return;
        }

        toast.success('Policy archived successfully. Find it in Order Archive.');
      } else {
        // Use the database function for soft delete
        console.log('Soft deleting customer with ID:', customerId);
        
        const { error } = await supabase.rpc('soft_delete_customer', {
          customer_uuid: customerId,
          admin_uuid: adminId
        });

        if (error) {
          console.error('Error archiving customer:', error);
          toast.error('Failed to archive customer: ' + error.message);
          return;
        }

        toast.success(`"${customerName}" archived successfully. Find it in Order Archive.`);
      }
      
      fetchCustomers(); // Refresh the customer list
      fetchDeletedCustomers(); // Refresh deleted list
    } catch (error) {
      console.error('Unexpected error archiving record:', error);
      toast.error('An unexpected error occurred while archiving the record');
    }
  };

  const handleSelectAll = () => {
    if (selectedCustomers.size === filteredCustomers.length) {
      setSelectedCustomers(new Set());
    } else {
      setSelectedCustomers(new Set(filteredCustomers.map(c => c.id)));
    }
  };

  const handleSelectCustomer = (customerId: string) => {
    const newSelected = new Set(selectedCustomers);
    if (newSelected.has(customerId)) {
      newSelected.delete(customerId);
    } else {
      newSelected.add(customerId);
    }
    setSelectedCustomers(newSelected);
  };

  const bulkDeleteCustomers = async () => {
    if (!canDeleteCustomers()) {
      toast.error('Only administrators can delete customer records');
      return;
    }

    if (selectedCustomers.size === 0) {
      toast.error('No customers selected for archiving');
      return;
    }

    const selectedCount = selectedCustomers.size;
    if (!confirm(`Archive ${selectedCount} customer(s)? You can restore them anytime from Order Archive.`)) {
      return;
    }

    setBulkDeleteLoading(true);
    try {
      const { data: { user } } = await supabase.auth.getUser();
      const adminId = user?.id;

      if (!adminId) {
        toast.error('Unable to identify admin user');
        setBulkDeleteLoading(false);
        return;
      }

      const errors = [];
      let successCount = 0;

      for (const customerId of selectedCustomers) {
        const customer = filteredCustomers.find(c => c.id === customerId);
        if (!customer) continue;

        try {
          const isOrphanedPolicy = customer.name === 'Unknown Customer';
          
          if (isOrphanedPolicy) {
            const { error: policyError } = await supabase
              .from('customer_policies')
              .update({
                is_deleted: true,
                deleted_at: new Date().toISOString(),
                deleted_by: adminId
              })
              .eq('id', customerId);

            if (policyError) {
              errors.push(`Failed to archive policy ${customerId}: ${policyError.message}`);
            } else {
              successCount++;
            }
          } else {
            const { error } = await supabase.rpc('soft_delete_customer', {
              customer_uuid: customerId,
              admin_uuid: adminId
            });

            if (error) {
              errors.push(`Failed to archive customer ${customer.name}: ${error.message}`);
            } else {
              successCount++;
            }
          }
        } catch (error) {
          errors.push(`Error archiving ${customer.name}: ${error}`);
        }
      }

      if (errors.length > 0) {
        console.error('Bulk archive errors:', errors);
        toast.error(`${successCount} customers archived, ${errors.length} failed`);
      } else {
        toast.success(`Successfully archived ${successCount} customer(s). Find them in Order Archive.`);
      }

      setSelectedCustomers(new Set());
      fetchCustomers();
      fetchDeletedCustomers();
    } catch (error) {
      console.error('Bulk archive error:', error);
      toast.error('An error occurred during bulk archiving');
    } finally {
      setBulkDeleteLoading(false);
    }
  };
  // Quick archive for test/fake leads - no dialog needed
  const quickArchiveAsTestOrFake = async (customerIds: Set<string> | string[], action: 'test' | 'fake' | 'duplicate') => {
    const ids = Array.from(customerIds);
    if (ids.length === 0) return;

    try {
      const { data: { user } } = await supabase.auth.getUser();
      const adminId = user?.id;
      if (!adminId) { toast.error('Unable to identify admin user'); return; }

      let successCount = 0;
      const statusLabel = action === 'test' ? 'Test Purchase' : action === 'fake' ? 'Fake Lead' : 'Duplicate';
      const reason = action === 'test' ? 'Test record cleanup' : action === 'fake' ? 'Fake/Spam lead' : 'Duplicate record';

      for (const id of ids) {
        const { error } = await supabase.rpc('soft_delete_customer', {
          customer_uuid: id,
          admin_uuid: adminId
        });

        if (error) {
          // Fallback to direct update
          await supabase.from('customers').update({
            is_deleted: true,
            deleted_at: new Date().toISOString(),
            deleted_by: adminId,
            status: statusLabel
          }).eq('id', id);
        } else {
          // Update status
          await supabase.from('customers').update({ status: statusLabel }).eq('id', id);
        }

        // Archive related policies
        const customer = filteredCustomers.find(c => c.id === id);
        const policyId = customer?.customer_policies?.[0]?.id;
        if (policyId) {
          await supabase.from('customer_policies').update({
            is_deleted: true,
            deleted_at: new Date().toISOString(),
            deleted_by: adminId,
            status: action === 'test' ? 'test' : action === 'fake' ? 'fake_lead' : 'duplicate'
          }).eq('id', policyId);
        }

        // Log a note
        await supabase.from('admin_notes').insert({
          customer_id: id,
          created_by: adminId,
          note: `WARRANTY ${statusLabel.toUpperCase()} ARCHIVED\nReason: ${reason}`
        });

        successCount++;
      }

      toast.success(`${successCount} record(s) marked as ${statusLabel.toLowerCase()} and archived.`);
      setSelectedCustomers(new Set());
      fetchCustomers();
      fetchDeletedCustomers();
    } catch (error) {
      console.error('Quick archive error:', error);
      toast.error('An error occurred while archiving');
    }
  };

  const fetchEmailStatuses = async () => {
    try {
      // Fetch welcome and activation email statuses for all customers
      const { data: emailLogs, error } = await supabase
        .from('email_logs')
        .select('recipient_email, subject, status')
        .in('status', ['sent', 'delivered']);

      if (error) {
        console.error('Error fetching email statuses:', error);
        return;
      }

      // Process email logs to determine status for each customer
      const statuses: { [key: string]: EmailStatus } = {};
      
      customers.forEach(customer => {
        const customerEmails = emailLogs?.filter(log => log.recipient_email === customer.email) || [];
        statuses[customer.email] = {
          portal_signup: customerEmails.some(log => 
            log.subject?.toLowerCase().includes('welcome to buyawarranty.co.uk') &&
            log.subject?.toLowerCase().includes('get you started')
          ),
          policy_documents: customerEmails.some(log => 
            log.subject?.toLowerCase().includes('policy') || 
            log.subject?.toLowerCase().includes('warranty') ||
            log.subject?.toLowerCase().includes('document')
          )
        };
      });

      setEmailStatuses(statuses);
    } catch (error) {
      console.error('Error fetching email statuses:', error);
    }
  };

  const sendManualEmail = async (customerId: string, customerEmail: string, emailType: 'policy_documents' | 'portal_signup') => {
    const emailKey = `${customerId}_${emailType}`;
    setEmailSendingLoading(prev => ({
      ...prev,
      [customerId]: { ...prev[customerId], [emailType]: true }
    }));

    try {
      const customer = customers.find(c => c.id === customerId);
      let functionName: string;
      let payload: any;
      
      if (emailType === 'portal_signup') {
        functionName = 'send-email';
        payload = {
          templateId: 'Welcome Email - Portal Signup',
          recipientEmail: customerEmail,
          variables: {
            customer_name: customer?.name || customer?.first_name || 'Customer',
            customerName: customer?.name || customer?.first_name || 'Customer',
            loginLink: `${window.location.origin}/customer-dashboard`,
            portalLink: `${window.location.origin}/customer-dashboard`
          }
        };
      } else {
        functionName = 'send-policy-documents';
        payload = {
          recipientEmail: customerEmail,
          variables: {
            planType: customer?.plan_type || 'basic',
            customerName: customer?.name || customer?.first_name || 'Customer'
          }
        };
      }

      const { error } = await supabase.functions.invoke(functionName, {
        body: payload
      });

      if (error) throw error;

      const emailTypeNames = {
        portal_signup: 'Portal Signup',
        policy_documents: 'Policy Documents'
      };

      toast.success(`${emailTypeNames[emailType]} email sent successfully`);
      
      // Update email status locally
      setEmailStatuses(prev => ({
        ...prev,
        [customerEmail]: {
          ...prev[customerEmail],
          [emailType]: true
        }
      }));
      
      // Refresh email statuses from database
      setTimeout(fetchEmailStatuses, 1000);
    } catch (error) {
      console.error(`Error sending ${emailType} email:`, error);
      toast.error(`Failed to send ${emailType} email`);
    } finally {
      setEmailSendingLoading(prev => ({
        ...prev,
        [customerId]: { ...prev[customerId], [emailType]: false }
      }));
    }
  };

  const EmailStatusIndicator = ({ customer }: { customer: Customer }) => {
    const status = emailStatuses[customer.email] || { policy_documents: false, portal_signup: false };
    
    return (
      <div className="flex flex-col space-y-1">
        <div className="flex items-center space-x-2">
          {status.portal_signup ? (
            <CheckCircle className="h-4 w-4 text-green-600" />
          ) : (
            <Clock className="h-4 w-4 text-red-500" />
          )}
          <span className="text-xs">Portal Signup</span>
          <Button
            variant="ghost"
            size="sm"
            className="h-6 w-6 p-0"
            onClick={() => sendManualEmail(customer.id, customer.email, 'portal_signup')}
            disabled={emailSendingLoading[customer.id]?.portal_signup}
          >
            {emailSendingLoading[customer.id]?.portal_signup ? (
              <div className="animate-spin rounded-full h-3 w-3 border border-orange-600 border-t-transparent"></div>
            ) : (
              <Send className="h-3 w-3" />
            )}
          </Button>
        </div>
        
        <div className="flex items-center space-x-2">
          {status.policy_documents ? (
            <CheckCircle className="h-4 w-4 text-green-600" />
          ) : (
            <Clock className="h-4 w-4 text-red-500" />
          )}
          <span className="text-xs">Policy Documents</span>
          {!status.policy_documents && (
            <Button
              variant="ghost"
              size="sm"
              className="h-6 w-6 p-0"
              onClick={() => sendManualEmail(customer.id, customer.email, 'policy_documents')}
              disabled={emailSendingLoading[customer.id]?.policy_documents}
            >
              {emailSendingLoading[customer.id]?.policy_documents ? (
                <div className="animate-spin rounded-full h-3 w-3 border border-orange-600 border-t-transparent"></div>
              ) : (
                <Send className="h-3 w-3" />
              )}
            </Button>
          )}
        </div>
      </div>
    );
  };

  const handleSendWelcomeEmail = async (policyId: string, customerId: string) => {
    setEmailSendingLoading(prev => ({ 
      ...prev, 
      [customerId]: { ...prev[customerId], email: true } 
    }));
    
    try {
      const { data, error } = await supabase.functions.invoke('send-welcome-email-manual', {
        body: { 
          policyId: policyId,
          customerId: customerId 
        }
      });

      if (error) throw error;
      
      toast.success('Welcome email sent successfully!');
      fetchCustomers(); // Refresh to update status
    } catch (error: any) {
      console.error('Error sending welcome email:', error);
      toast.error(`Failed to send email: ${error.message}`);
    } finally {
      setEmailSendingLoading(prev => ({ 
        ...prev, 
        [customerId]: { ...prev[customerId], email: false } 
      }));
    }
  };

  const handleSendToWarranties2000 = async (policyId: string, customerId: string, force = false) => {
    setEmailSendingLoading(prev => ({ 
      ...prev, 
      [customerId]: { ...prev[customerId], warranties2000: true } 
    }));
    
    try {
      const { data, error } = await supabase.functions.invoke('send-to-warranties-2000', {
        body: { 
          policyId: policyId,
          customerId: customerId,
          force: force // Allow resending even if already sent
        }
      });

      if (error) throw error;
      
      toast.success('Successfully sent to Warranties Register!');
      fetchCustomers(); // Refresh to update status
    } catch (error: any) {
      console.error('Error sending to Warranties Register:', error);
      toast.error(`Failed to send to Warranties Register: ${error.message}`);
    } finally {
      setEmailSendingLoading(prev => ({ 
        ...prev, 
        [customerId]: { ...prev[customerId], warranties2000: false } 
      }));
    }
  };

  const refreshVehicleDataFromDVLA = async (customerId: string, registrationPlate: string) => {
    if (!registrationPlate) {
      toast.error('Registration plate is required for DVLA lookup');
      return;
    }

    setDvlaLookupLoading(prev => ({ ...prev, [customerId]: true }));
    
    try {
      console.log(`Starting DVLA lookup for registration: ${registrationPlate}`);
      
      const { data, error } = await supabase.functions.invoke('dvla-vehicle-lookup', {
        body: { registrationNumber: registrationPlate }
      });

      if (error) {
        console.error('DVLA lookup error:', error);
        throw error;
      }

      console.log('DVLA lookup response:', data);

      if (!data.found) {
        toast.error(`Vehicle not found in DVLA database: ${data.error || 'Unknown error'}`);
        return;
      }

      // Update customer record with DVLA data
      const updateData = {
        vehicle_make: data.make || null,
        vehicle_model: data.model || null,
        vehicle_year: data.yearOfManufacture ? data.yearOfManufacture.toString() : null,
        vehicle_fuel_type: data.fuelType || null,
        vehicle_transmission: data.transmission || null,
        updated_at: new Date().toISOString()
      };

      console.log('Updating customer with DVLA data:', updateData);

      const { error: updateError } = await supabase
        .from('customers')
        .update(updateData)
        .eq('id', customerId);

      if (updateError) {
        console.error('Error updating customer with DVLA data:', updateError);
        throw updateError;
      }

      toast.success(`Vehicle data updated from DVLA: ${data.make} ${data.model || ''}`);
      
      // Refresh customers list to show updated data
      fetchCustomers();
      
    } catch (error: any) {
      console.error('Error in DVLA vehicle lookup:', error);
      toast.error(`DVLA lookup failed: ${error.message || 'Unknown error'}`);
    } finally {
      setDvlaLookupLoading(prev => ({ ...prev, [customerId]: false }));
    }
  };

  const resetCustomerPassword = async (customerId: string, customerEmail: string) => {
    setPasswordResetLoading(prev => ({ ...prev, [customerId]: true }));
    
    try {
      console.log('Resetting password for customer:', customerId, customerEmail);
      
      // Generate a secure temporary password
      const generateSecurePassword = () => {
        const chars = 'ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789!@#$%^&*';
        let password = '';
        for (let i = 0; i < 12; i++) {
          password += chars.charAt(Math.floor(Math.random() * chars.length));
        }
        return password;
      };
      
      const tempPassword = generateSecurePassword();
      
      console.log('Generated temporary password for admin use:', tempPassword);
      
      // Log the password reset in our tracking table
      const { error: logError } = await supabase
        .from('welcome_emails')
        .insert({
          email: customerEmail,
          temporary_password: tempPassword,
          password_reset: true,
          user_id: customerId
        });
      
      if (logError) {
        console.error('Error logging password reset:', logError);
      }
      
      // Send reset email as backup
      const { error: emailError } = await supabase.functions.invoke('send-password-reset-email', {
        body: { email: customerEmail }
      });
      
      if (emailError) {
        console.error('Error sending reset email:', emailError);
        // Don't throw here, as we still want to show the temp password
      }
      
      // Show the temporary password to the admin with copy functionality
      const message = `Temporary password generated: ${tempPassword}\n\nThis password has been logged in the system. Please provide this to the customer securely. A password reset email has also been sent as backup.`;
      
      // Create a more user-friendly dialog
      if (navigator.clipboard) {
        try {
          await navigator.clipboard.writeText(tempPassword);
          toast.success(`Password reset successful! Temporary password copied to clipboard: ${tempPassword}`, {
            duration: 15000,
            action: {
              label: 'Copy Again',
              onClick: () => navigator.clipboard.writeText(tempPassword)
            }
          });
        } catch (clipboardError) {
          toast.success(`Password reset successful! Temporary password: ${tempPassword}`, {
            duration: 15000,
          });
        }
      } else {
        toast.success(`Password reset successful! Temporary password: ${tempPassword}`, {
          duration: 15000,
        });
      }
      
      // Also log to console for admin reference
      console.log('='.repeat(50));
      console.log('CUSTOMER PASSWORD RESET');
      console.log('Customer:', customerEmail);
      console.log('Temporary Password:', tempPassword);
      console.log('Reset Time:', new Date().toISOString());
      console.log('='.repeat(50));
      
    } catch (error) {
      console.error('Error resetting password:', error);
      toast.error(`Failed to reset password: ${error.message || 'Unknown error'}`);
    } finally {
      setPasswordResetLoading(prev => ({ ...prev, [customerId]: false }));
    }
  };

  if (loading) {
    return (
      <div className="flex justify-center items-center h-64">
        <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-orange-600"></div>
        <span className="ml-2">Loading customers...</span>
      </div>
    );
  }

  const getContactStatusColor = (status: string) => {
    switch (status) {
      case 'not_contacted': return 'bg-red-500';
      case 'contacted': return 'bg-yellow-500'; 
      case 'follow_up': return 'bg-green-500';
      default: return 'bg-gray-500';
    }
  };

  const getContactStatusText = (status: string) => {
    switch (status) {
      case 'not_contacted': return 'Not Contacted';
      case 'contacted': return 'Contacted';
      case 'follow_up': return 'Follow-up Done';
      default: return 'Unknown';
    }
  };

  // Don't render the full UI until role is determined (prevents flash of unrestricted features for sales agents)
  if (!isRoleLoaded) {
    return (
      <div className="space-y-6">
        <div className="flex justify-between items-center">
          <h2 className="text-2xl font-bold text-gray-900">Customer Management</h2>
          <Button variant="outline" disabled className="flex items-center space-x-2">
            <RefreshCw className="h-4 w-4 animate-spin" />
            <span>Loading...</span>
          </Button>
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {/* Revenue by Date is now inline in the filter row below */}
      <div className="flex justify-between items-center">
        <div className="flex items-center gap-3">
          <h2 className="text-2xl font-bold text-gray-900">Customer Management</h2>
        </div>
        <div className="flex items-center space-x-2">
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
          {!isSalesAgent && <QuickCustomerSignupButton />}
          
          <Button
            onClick={fetchCustomers} 
            variant="outline"
            className="flex items-center space-x-2"
          >
            <RefreshCw className="h-4 w-4" />
            <span>Refresh</span>
          </Button>
          {canExport && (
            <DropdownMenu>
              <DropdownMenuTrigger asChild>
                <Button className="flex items-center space-x-2">
                  <Download className="h-4 w-4" />
                  <span>Export</span>
                </Button>
              </DropdownMenuTrigger>
              <DropdownMenuContent align="end">
                <DropdownMenuItem onClick={() => handleExport('csv')}>
                  <Download className="h-4 w-4 mr-2" />
                  Export as CSV
                </DropdownMenuItem>
                <DropdownMenuItem onClick={() => handleExport('xlsx')}>
                  <FileSpreadsheet className="h-4 w-4 mr-2" />
                  Export as Excel
                </DropdownMenuItem>
                <DropdownMenuItem onClick={handleExportPDF}>
                  <Printer className="h-4 w-4 mr-2" />
                  Save as PDF
                </DropdownMenuItem>
              </DropdownMenuContent>
            </DropdownMenu>
          )}
          
          {/* Debug Info Button - hidden for sales agents */}
          {debugInfo && !isSalesAgent && (
            <Popover>
              <PopoverTrigger asChild>
                <Button variant="outline" className="flex items-center space-x-2 text-gray-600">
                  <AlertCircle className="h-4 w-4" />
                  <span>Debug Info</span>
                </Button>
              </PopoverTrigger>
              <PopoverContent className="w-96">
                <div className="space-y-2">
                  <h4 className="font-semibold text-sm">Debug Information</h4>
                  <pre className="text-xs text-gray-700 whitespace-pre-wrap bg-gray-50 p-2 rounded">{debugInfo}</pre>
                </div>
              </PopoverContent>
            </Popover>
          )}

          {/* Order Management Guide Button - hidden for sales agents */}
          {!isSalesAgent && (
          <Popover>
            <PopoverTrigger asChild>
              <Button variant="outline" className="flex items-center space-x-2 text-gray-600">
                <AlertCircle className="h-4 w-4" />
                <span>Order Management Guide</span>
              </Button>
            </PopoverTrigger>
            <PopoverContent className="w-96">
              <div className="space-y-3">
                <h4 className="font-semibold text-sm text-blue-900">Easily manage your vehicle warranty orders</h4>
                <p className="text-xs text-blue-700">
                  Need to delete an order? You can do that anytime — and if you change your mind, it's not gone forever.
                </p>
                <div className="space-y-2 text-xs text-blue-700">
                  <div className="flex items-start gap-2">
                    <Archive className="h-3.5 w-3.5 mt-0.5 flex-shrink-0" />
                    <div>
                      <strong>Deleted orders are safely stored</strong> — You'll find them in your Order Archive, where you can restore or review them whenever you like.
                    </div>
                  </div>
                  <div className="flex items-start gap-2">
                    <RotateCcw className="h-3.5 w-3.5 mt-0.5 flex-shrink-0" />
                    <div>
                      <strong>Restore with one click</strong> — Mistakes happen. That's why we've made it easy to bring back any deleted order.
                    </div>
                  </div>
                </div>
              </div>
            </PopoverContent>
          </Popover>
          )}
        </div>
      </div>

      <Tabs defaultValue="complete" className="w-full">
        <div className="flex items-center gap-2">
          <TabsList className="flex flex-1 bg-transparent gap-2">
            <TabsTrigger 
              value="complete" 
              className="flex-1 bg-blue-50 text-blue-700 border border-blue-200 data-[state=active]:bg-blue-100 data-[state=active]:text-blue-900 data-[state=active]:border-blue-400 data-[state=active]:border-2 data-[state=active]:shadow-sm cursor-pointer"
            >
              Active Orders
            </TabsTrigger>
            {!isSalesAgent && (
            <>
            <TabsTrigger 
              value="cancellations"
              className="h-9 px-3 bg-red-50 text-red-700 border border-red-200 rounded-md text-xs data-[state=active]:bg-red-100 data-[state=active]:text-red-900 data-[state=active]:border-red-400 data-[state=active]:border-2 data-[state=active]:shadow-sm cursor-pointer flex items-center gap-1"
            >
              <Ban className="h-3.5 w-3.5" />
              Cancellations
            </TabsTrigger>
            <TabsTrigger 
              value="deleted"
              className="h-9 px-3 bg-amber-50 text-amber-700 border border-amber-200 rounded-md text-xs data-[state=active]:bg-amber-100 data-[state=active]:text-amber-900 data-[state=active]:border-amber-400 data-[state=active]:border-2 data-[state=active]:shadow-sm cursor-pointer flex items-center gap-1"
            >
              <Archive className="h-3.5 w-3.5" />
              Archive
            </TabsTrigger>
            </>
            )}
          </TabsList>
        </div>

        <TabsContent value="complete" className="space-y-4">
          {/* Due Today Activations – lightweight inline banner */}
          {dueTodayCustomers.length > 0 && (
            <div className="flex items-center gap-2 px-3 py-2 bg-amber-50 border border-amber-200 rounded-md text-sm">
              <Clock className="h-3.5 w-3.5 text-amber-600 flex-shrink-0" />
              <span className="text-amber-800 font-medium">
                {dueTodayCustomers.length} activation{dueTodayCustomers.length !== 1 ? 's' : ''} due today
              </span>
              <span className="text-amber-600">—</span>
              {dueTodayCustomers.map((c, i) => (
                <span key={c.id} className="text-amber-700 text-xs">
                  {c.name} ({c.registration_plate}){i < dueTodayCustomers.length - 1 ? ', ' : ''}
                </span>
              ))}
            </div>
          )}
          {/* Enhanced Search and Filter Controls */}
          <div className="bg-white p-4 rounded-lg border space-y-4">
            {/* Row 1: Search, Status */}
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
              {/* Search */}
              <div className="space-y-1 lg:col-span-3">
                <Label htmlFor="search" className="text-sm font-medium">Search</Label>
                <div className="relative">
                  <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 h-4 w-4 text-muted-foreground" />
                  <Input
                    id="search"
                    placeholder="Search by name, email, phone, reg plate, vehicle, address..."
                    value={searchTerm}
                    onChange={(e) => setSearchTerm(e.target.value)}
                    className="pl-10"
                  />
                </div>
              </div>

              {/* Filter by Status */}
              <div className="space-y-1">
                <Label htmlFor="statusFilter" className="text-sm font-medium">Status</Label>
                <Select value={filterByStatus} onValueChange={setFilterByStatus}>
                  <SelectTrigger>
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="all">All Status</SelectItem>
                    <SelectItem value="active">Active</SelectItem>
                    <SelectItem value="pending">Pending</SelectItem>
                    <SelectItem value="cancelled">Cancelled</SelectItem>
                    <SelectItem value="refunded">Refunded</SelectItem>
                    <SelectItem value="cancelled_and_refunded">Cancelled & Refunded</SelectItem>
                    {!isSalesScopedRole && (
                      <SelectItem value="claim_made">Claim Made</SelectItem>
                    )}
                  </SelectContent>
                </Select>
              </div>
            </div>

             {/* Row 2: Filter by Tag, Date Range, Warranty Period, Purchase Source - hidden for sales agents */}
            {!isSalesAgent && (
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4 items-end">
              {/* Filter by Tag */}
              <div className="space-y-1">
                <Label htmlFor="tagFilter" className="text-sm font-medium">Filter by Tag</Label>
                <Select value={filterByTag} onValueChange={setFilterByTag}>
                  <SelectTrigger>
                    <SelectValue>
                      {filterByTag === 'all' ? (
                        'All Tags'
                      ) : (
                        <div className="flex items-center gap-2">
                          <div 
                            className="w-3 h-3 rounded-full flex-shrink-0" 
                            style={{ backgroundColor: availableTags.find(t => t.id === filterByTag)?.color }}
                          />
                          <span>{availableTags.find(t => t.id === filterByTag)?.name || 'Select Tag'}</span>
                        </div>
                      )}
                    </SelectValue>
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="all">All Tags</SelectItem>
                    {Object.entries(
                      availableTags.reduce((acc: any, tag) => {
                        if (!acc[tag.category]) {
                          acc[tag.category] = [];
                        }
                        acc[tag.category].push(tag);
                        return acc;
                      }, {})
                    ).map(([category, tags]: [string, any]) => (
                      <React.Fragment key={category}>
                        <SelectItem value={`category-${category}`} disabled className="font-semibold text-xs uppercase text-muted-foreground">
                          {category}
                        </SelectItem>
                        {tags.map((tag: any) => (
                          <SelectItem key={tag.id} value={tag.id} className="pl-6">
                            <div className="flex items-center gap-2">
                              <div 
                                className="w-3 h-3 rounded-full flex-shrink-0" 
                                style={{ backgroundColor: tag.color }}
                              />
                              <span>{tag.name}</span>
                            </div>
                          </SelectItem>
                        ))}
                      </React.Fragment>
                    ))}
                  </SelectContent>
                </Select>
              </div>

              {/* Date Range Filter */}
              <div className="space-y-1">
                <Label className="text-sm font-medium invisible">Date Range</Label>
                <DateRangeFilter
                  dateRange={dateRange}
                  onDateRangeChange={setDateRange}
                />
              </div>

              {/* Filter by Warranty Period */}
              <div className="space-y-1">
                <Label htmlFor="warrantyPeriodFilter" className="text-sm font-medium">Warranty Period</Label>
                <Select value={filterByWarrantyPeriod} onValueChange={setFilterByWarrantyPeriod}>
                  <SelectTrigger>
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="all">All Periods</SelectItem>
                    <SelectItem value="12">1 Year (12 months)</SelectItem>
                    <SelectItem value="24">2 Years (24 months)</SelectItem>
                    <SelectItem value="36">3 Years (36 months)</SelectItem>
                    <SelectItem value="48">4 Years (48 months)</SelectItem>
                    <SelectItem value="60">5 Years (60 months)</SelectItem>
                  </SelectContent>
                </Select>
              </div>

              {/* Filter by Source */}
              <div className="space-y-1">
                <Label htmlFor="sourceFilter" className="text-sm font-medium">Purchase Source</Label>
                <Select value={filterBySource} onValueChange={setFilterBySource}>
                  <SelectTrigger>
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="all_view">
                      <div className="flex items-center gap-2">
                        <div className="w-2 h-2 rounded-full bg-gray-400" />
                        All View
                      </div>
                    </SelectItem>
                    <SelectItem value="website">
                      <div className="flex items-center gap-2">
                        <div className="w-2 h-2 rounded-full bg-blue-500" />
                        Website (BAW)
                      </div>
                    </SelectItem>
                    {(currentAdminUser?.role === 'super_admin' || currentAdminUser?.role === 'admin' || currentAdminUser?.role === 'lead_gen') && (
                      <>
                        <SelectItem value="website_google">
                          <div className="flex items-center gap-2">
                            <div className="w-2 h-2 rounded-full bg-emerald-500" />
                            Website G (Google Ads)
                          </div>
                        </SelectItem>
                        <SelectItem value="website_facebook">
                          <div className="flex items-center gap-2">
                            <div className="w-2 h-2 rounded-full bg-sky-500" />
                            Website F (Facebook Ads)
                          </div>
                        </SelectItem>
                        <SelectItem value="website_organic">
                          <div className="flex items-center gap-2">
                            <div className="w-2 h-2 rounded-full bg-amber-500" />
                            Website O (Organic)
                          </div>
                        </SelectItem>
                      </>
                    )}
                    <SelectItem value="staff_purchase">
                      <div className="flex items-center gap-2">
                        <div className="w-2 h-2 rounded-full bg-green-500" />
                        Staff Purchase (BAW-S)
                      </div>
                    </SelectItem>
                    <SelectItem value="quote_order">
                      <div className="flex items-center gap-2">
                        <div className="w-2 h-2 rounded-full bg-purple-500" />
                        Quote & Orders (ADM)
                      </div>
                    </SelectItem>
                    <SelectItem value="agent_sales">
                      <div className="flex items-center gap-2">
                        <div className="w-2 h-2 rounded-full bg-orange-500" />
                        Agent Sales (BAW-S + ADM)
                      </div>
                    </SelectItem>
                    <SelectItem value="cancelled_refunded">
                      <div className="flex items-center gap-2">
                        <div className="w-2 h-2 rounded-full bg-red-500" />
                        Cancelled / Refunded
                      </div>
                    </SelectItem>
                  </SelectContent>
                </Select>
               </div>
            </div>
            )}

             {/* Row 3: Sales by Agent + Deals Period + Revenue by Date */}
            <div className="flex items-end gap-4 flex-wrap">
              {/* Filter by Agent */}
              {(currentAdminUser?.role === 'admin' || currentAdminUser?.role === 'super_admin' || currentAdminUser?.role === 'sales_lead' || currentAdminUser?.role === 'sales_manager' || currentAdminUser?.role === 'sales' || currentAdminUser?.role === 'lead_gen') && (
                <>
                <div className="space-y-1 w-[220px]">
                  <Label className="text-sm font-medium">Sales by Agent</Label>
                  <Select value={filterByAgent} onValueChange={setFilterByAgent}>
                    <SelectTrigger>
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      {(currentAdminUser?.role === 'admin' || currentAdminUser?.role === 'super_admin' || currentAdminUser?.role === 'sales_lead' || currentAdminUser?.role === 'sales' || currentAdminUser?.role === 'lead_gen') && (
                        <>
                          <SelectItem value="all">All Agents</SelectItem>
                          {!isSalesAgent && <SelectItem value="unassigned">Unassigned</SelectItem>}
                        </>
                      )}
                      {adminUsers
                        .filter(u => ['sales', 'sales_lead', 'sales_manager', 'admin', 'super_admin'].includes(u.role))
                        .map(user => {
                          const stats = agentDealCounts[user.id] || { sales: 0, cancelled: 0 };
                          const displayName = `${user.first_name || ''} ${user.last_name || ''}`.trim() || user.email;
                          const isSalesAgentRole = isSalesAgent;
                          return (
                            <SelectItem key={user.id} value={user.id}>
                              {displayName}{!isSalesAgentRole && ` (${stats.sales}${stats.cancelled > 0 ? ` · ${stats.cancelled} refunds` : ''})`}
                            </SelectItem>
                          );
                        })}
                    </SelectContent>
                  </Select>
                </div>

                {/* Deals Period Selector */}
                <div className="space-y-1 w-[160px]">
                  <Label className="text-sm font-medium">Deals Period</Label>
                  <Select value={totalSalesDateFilter} onValueChange={setTotalSalesDateFilter}>
                    <SelectTrigger>
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="today">Today</SelectItem>
                      <SelectItem value="yesterday">Yesterday</SelectItem>
                      <SelectItem value="7days">Last 7 Days</SelectItem>
                      <SelectItem value="14days">Last 14 Days</SelectItem>
                      <SelectItem value="30days">Last 30 Days</SelectItem>
                      <SelectItem value="60days">Last 60 Days</SelectItem>
                      <SelectItem value="this_month">This Month</SelectItem>
                      <SelectItem value="last_month">Last Month</SelectItem>
                      {!isSalesAgent && <SelectItem value="all">All Time</SelectItem>}
                    </SelectContent>
                  </Select>
                </div>
                </>
              )}

              {/* Revenue by Date - inline (super_admin only) */}
              {isSuperAdmin && (
                <div className="flex items-end gap-3 border-l pl-4">
                  <div className="flex items-center gap-2 pb-1.5">
                    <CalendarIcon className="h-4 w-4 text-muted-foreground" />
                    <span className="text-sm font-medium whitespace-nowrap">Revenue:</span>
                  </div>
                  <div className="flex items-center gap-1 pb-0.5">
                    {[
                      { label: 'Today', getRange: () => { const d = new Date(); return { from: d, to: d }; } },
                      { label: 'Yesterday', getRange: () => { const d = new Date(); d.setDate(d.getDate() - 1); return { from: d, to: d }; } },
                      { label: 'This Month', getRange: () => { const now = new Date(); return { from: new Date(now.getFullYear(), now.getMonth(), 1), to: now }; } },
                      { label: 'Last Month', getRange: () => { const now = new Date(); return { from: new Date(now.getFullYear(), now.getMonth() - 1, 1), to: new Date(now.getFullYear(), now.getMonth(), 0) }; } },
                      { label: 'All Time', getRange: () => undefined as DateRange | undefined },
                    ].map((preset) => {
                      const isActive = (() => {
                        const r = preset.getRange();
                        if (!r && !revenueDateRange?.from) return true;
                        if (!r || !revenueDateRange?.from) return false;
                        const rf = new Date(r.from); rf.setHours(0,0,0,0);
                        const rt = r.to ? new Date(r.to) : rf; rt.setHours(0,0,0,0);
                        const cf = new Date(revenueDateRange.from); cf.setHours(0,0,0,0);
                        const ct = revenueDateRange.to ? new Date(revenueDateRange.to) : cf; ct.setHours(0,0,0,0);
                        return rf.getTime() === cf.getTime() && rt.getTime() === ct.getTime();
                      })();
                      return (
                        <Button
                          key={preset.label}
                          variant={isActive ? 'default' : 'outline'}
                          size="sm"
                          className="text-xs h-7 px-2.5"
                          onClick={() => {
                            const range = preset.getRange();
                            setRevenueDateRange(range ?? { from: new Date(2020, 0, 1), to: new Date() });
                          }}
                        >
                          {preset.label}
                        </Button>
                      );
                    })}
                  </div>
                  {filteredRevenueStats && (
                    <div className="flex items-center gap-2 pb-1.5">
                      <span className="text-emerald-600 font-bold text-sm whitespace-nowrap">
                        £{filteredRevenueStats.revenue.toLocaleString('en-GB', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
                      </span>
                      <Badge variant="outline" className="text-xs">
                        {filteredRevenueStats.count} {filteredRevenueStats.label}
                      </Badge>
                    </div>
                  )}
                </div>
              )}

              {/* Activity summary - hidden for sales agents */}
              {!isSalesAgent && (
              <div className="flex items-end pb-0.5 ml-auto">
                <span className="text-sm text-muted-foreground">
                  Showing {filteredCustomers.length} of {customers.length} customers
                </span>
              </div>
              )}
            </div>

            {/* Results Summary and Bulk Actions */}
            <div className="flex items-center justify-between text-sm text-muted-foreground pt-2 border-t">
              <div className="flex items-center gap-4">
                {selectedCustomers.size > 0 && (() => {
                  const selectedItems = filteredCustomers.filter(c => selectedCustomers.has(c.id));
                  const selectedTotal = selectedItems.reduce((sum, c) => sum + (c.final_amount || 0), 0);
                  const selectedAvg = selectedItems.length > 0 ? selectedTotal / selectedItems.length : 0;
                  const canViewFinancials = currentAdminUser?.role === 'super_admin' || currentAdminUser?.role === 'admin';
                  return (
                    <div className="flex items-center gap-2">
                      <Badge variant="secondary" className="bg-blue-50 text-blue-700">
                        {selectedCustomers.size} selected
                      </Badge>
                      {canViewFinancials && (
                        <Badge variant="secondary" className="bg-green-50 text-green-700 font-semibold">
                          Total: £{selectedTotal.toLocaleString('en-GB', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
                          {' · '}Avg: £{selectedAvg.toLocaleString('en-GB', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
                        </Badge>
                      )}
                    </div>
                  );
                })()}
              </div>
              <div className="flex items-center gap-2">
                {selectedCustomers.size > 0 && (
                  <>
                    <InvoiceDialog
                      customers={filteredCustomers}
                      selectedCustomerIds={Array.from(selectedCustomers)}
                      onComplete={() => setSelectedCustomers(new Set())}
                    />
                    <BulkTagDialog 
                      selectedCustomerIds={Array.from(selectedCustomers)}
                      onComplete={() => {
                        setSelectedCustomers(new Set());
                        fetchCustomers();
                      }}
                    />
                    <BulkEmailDialog 
                      selectedCustomerIds={Array.from(selectedCustomers)}
                      onComplete={() => setSelectedCustomers(new Set())}
                    />
                    {canDeleteCustomers() && (
                      <DropdownMenu>
                        <DropdownMenuTrigger asChild>
                          <Button
                            variant="outline"
                            size="sm"
                            className="text-xs border-orange-300 text-orange-700 hover:bg-orange-50"
                          >
                            <Archive className="h-3 w-3 mr-1" />
                            Archive Selected ({selectedCustomers.size})
                            <ChevronDown className="h-3 w-3 ml-1" />
                          </Button>
                        </DropdownMenuTrigger>
                        <DropdownMenuContent align="end">
                          <DropdownMenuItem 
                            onClick={() => {
                              const selected = filteredCustomers.filter(c => selectedCustomers.has(c.id));
                              setArchiveCustomers(selected.map(c => ({
                                id: c.id,
                                name: c.name,
                                email: c.email,
                                policy_id: c.customer_policies?.[0]?.id,
                                policy_number: c.customer_policies?.[0]?.policy_number,
                                user_id: c.customer_policies?.[0]?.user_id,
                                customer_id: c.id
                              })));
                              setArchiveDialogOpen(true);
                            }}
                            className="text-red-600"
                          >
                            <Ban className="h-4 w-4 mr-2" />
                            Cancel Warranty
                          </DropdownMenuItem>
                          <DropdownMenuItem 
                            onClick={() => {
                              const selected = filteredCustomers.filter(c => selectedCustomers.has(c.id));
                              setArchiveCustomers(selected.map(c => ({
                                id: c.id,
                                name: c.name,
                                email: c.email,
                                policy_id: c.customer_policies?.[0]?.id,
                                policy_number: c.customer_policies?.[0]?.policy_number,
                                user_id: c.customer_policies?.[0]?.user_id,
                                customer_id: c.id
                              })));
                              setArchiveDialogOpen(true);
                            }}
                            className="text-amber-600"
                          >
                            <PoundSterling className="h-4 w-4 mr-2" />
                            Mark as Refunded
                          </DropdownMenuItem>
                          <DropdownMenuItem 
                            onClick={() => {
                              const selected = filteredCustomers.filter(c => selectedCustomers.has(c.id));
                              setArchiveCustomers(selected.map(c => ({
                                id: c.id,
                                name: c.name,
                                email: c.email,
                                policy_id: c.customer_policies?.[0]?.id,
                                policy_number: c.customer_policies?.[0]?.policy_number,
                                user_id: c.customer_policies?.[0]?.user_id,
                                customer_id: c.id
                              })));
                              setArchiveDialogOpen(true);
                            }}
                            className="text-gray-600"
                          >
                            <Archive className="h-4 w-4 mr-2" />
                            Archive (Hide)
                          </DropdownMenuItem>
                          <DropdownMenuItem 
                            onClick={() => quickArchiveAsTestOrFake(selectedCustomers, 'test')}
                            className="text-purple-600"
                          >
                            <FlaskConical className="h-4 w-4 mr-2" />
                            Mark as Test
                          </DropdownMenuItem>
                          <DropdownMenuItem 
                            onClick={() => quickArchiveAsTestOrFake(selectedCustomers, 'fake')}
                            className="text-orange-600"
                          >
                            <UserMinus className="h-4 w-4 mr-2" />
                            Mark as Fake Lead
                          </DropdownMenuItem>
                          <DropdownMenuItem 
                            onClick={() => quickArchiveAsTestOrFake(selectedCustomers, 'duplicate')}
                            className="text-blue-600"
                          >
                            <Copy className="h-4 w-4 mr-2" />
                            Mark as Duplicate
                          </DropdownMenuItem>
                        </DropdownMenuContent>
                      </DropdownMenu>
                    )}
                  </>
                )}
                <Button
                  variant="ghost"
                  size="sm"
                  onClick={() => {
                    setSearchTerm('');
                    setSortBy('newest');
                    setFilterByPlan('all');
                    setFilterByStatus('all');
                    setFilterByTag('all');
                    setFilterByWarrantyPeriod('all');
                    setFilterBySource(isSalesAgent ? 'all_view' : 'website');
                    setFilterByAgent(isSalesAgent && currentAdminUser ? currentAdminUser.id : 'all');
                    setTotalSalesDateFilter(isSalesAgent ? '60days' : '30days');
                    const resetRange = isSalesAgent ? getAgentCountsDateRange('60days') : null;
                    setDateRange(resetRange ? { from: resetRange.start, to: resetRange.end } : undefined);
                    setSelectedCustomers(new Set());
                  }}
                  className="text-xs"
                >
                  Clear Filters
                </Button>
              </div>
            </div>
          </div>

      {/* Results Table */}
      <div className="bg-white rounded-lg shadow overflow-hidden mt-2">

        <div className="overflow-x-auto">
          <Table className="min-w-[1800px]">
          <TableHeader>
            <TableRow>
              <TableHead className="w-12">
                <Checkbox
                  checked={selectedCustomers.size === filteredCustomers.length && filteredCustomers.length > 0}
                  onCheckedChange={handleSelectAll}
                  aria-label="Select all customers"
                />
              </TableHead>
              <TableHead>Name</TableHead>
              <TableHead>Lead Date</TableHead>
              <TableHead>Purchase Date</TableHead>
              <TableHead>Email</TableHead>
              <TableHead>Phone</TableHead>
              <TableHead>DOB</TableHead>
              <TableHead>RegNum</TableHead>
              <TableHead>Payment</TableHead>
              <TableHead>Ref</TableHead>
              <TableHead>Email Status</TableHead>
              <TableHead>Warranties Register</TableHead>
              <TableHead>Status</TableHead>
              <TableHead>Assigned To</TableHead>
              <TableHead>Make</TableHead>
              <TableHead>Model</TableHead>
              <TableHead>RegDate</TableHead>
              <TableHead>Address</TableHead>
              <TableHead>WarType</TableHead>
              <TableHead>Dur.</TableHead>
              <TableHead>Start Date</TableHead>
              
              {!isSalesAgent && <TableHead className="bg-gradient-to-r from-amber-50 to-orange-50">Upgrade</TableHead>}
              <TableHead>Expiry Date</TableHead>
              <TableHead>Payment Method</TableHead>
              <TableHead className="bg-purple-50">Source</TableHead>
              <TableHead>Vol. Excess</TableHead>
              <TableHead>Claim Limit</TableHead>
              <TableHead>Claims Made</TableHead>
              <TableHead>Claims Paid</TableHead>
              <TableHead className="text-center bg-green-50">Trustpilot</TableHead>
              <TableHead className="text-center bg-blue-50">Google</TableHead>
              <TableHead>Labour Rate</TableHead>
              <TableHead>Mileage</TableHead>
              <TableHead>Tags</TableHead>
              <TableHead>Actions</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {filteredCustomers.length === 0 ? (
              <TableRow>
                <TableCell colSpan={33} className="text-center py-8">
                  <div className="space-y-4">
                    <AlertCircle className="h-12 w-12 text-gray-400 mx-auto" />
                    <div>
                      <p className="text-gray-500 text-lg">No customers found</p>
                      <p className="text-gray-400 text-sm mt-2">
                        This might be due to RLS policies or missing data
                      </p>
                    </div>
                    <Button onClick={fetchCustomers} variant="outline" size="sm">
                      <RefreshCw className="h-4 w-4 mr-2" />
                      Try Again
                    </Button>
                  </div>
                </TableCell>
              </TableRow>
            ) : (
              customersPagination.paginatedData.map((customer) => (
                <TableRow key={customer.id} className={isDueToday(customer) ? 'bg-orange-50 border-l-4 border-l-orange-500' : ''}>
                  <TableCell>
                    <Checkbox
                      checked={selectedCustomers.has(customer.id)}
                      onCheckedChange={() => handleSelectCustomer(customer.id)}
                      aria-label={`Select ${customer.name}`}
                    />
                  </TableCell>
                  <TableCell className="font-medium">
                    <div className="flex items-center gap-2">
                      <Dialog>
                        <DialogTrigger asChild>
                          <Button
                            variant="ghost"
                            size="sm"
                            onClick={() => openCustomerDialog(customer)}
                            title="Edit Customer"
                            className="h-6 w-6 p-0"
                          >
                            <Edit className="h-3 w-3" />
                          </Button>
                        </DialogTrigger>
                        <DialogContent className="max-w-4xl max-h-[90vh] overflow-y-auto">
                          <DialogHeader>
                            <div className="flex items-center justify-between">
                              <DialogTitle>Manage Customer: {selectedCustomer?.name}</DialogTitle>
                              {selectedCustomer && (
                                <div className="flex items-center gap-2">
                                  <Button
                                    variant="outline"
                                    size="sm"
                                    onClick={() => setIsPrintLetterOpen(true)}
                                  >
                                    <Printer className="h-4 w-4 mr-1" />
                                    Print Letter
                                  </Button>
                                  <SendNotificationDialog 
                                    customerId={selectedCustomer.id}
                                    customerName={selectedCustomer.name}
                                    customerEmail={selectedCustomer.email}
                                  />
                                </div>
                              )}
                            </div>
                          </DialogHeader>
                          
                          {editingCustomer && (
                            <>
                              {/* Customer Login Credentials Section */}
                              <Collapsible 
                                open={credentialsExpanded} 
                                onOpenChange={setCredentialsExpanded}
                                className="mb-6"
                              >
                                <div className="p-4 bg-green-50 border-2 border-green-300 rounded-lg">
                                  <CollapsibleTrigger asChild>
                                    <button className="w-full flex items-center justify-between text-lg font-semibold text-green-900 hover:text-green-700 transition-colors">
                                      <div className="flex items-center">
                                        <Key className="h-5 w-5 mr-2" />
                                        Customer Login Credentials
                                      </div>
                                      {credentialsExpanded ? (
                                        <ChevronUp className="h-5 w-5" />
                                      ) : (
                                        <ChevronDown className="h-5 w-5" />
                                      )}
                                    </button>
                                  </CollapsibleTrigger>
                                  
                                  <CollapsibleContent className="mt-4">
                                    {credentialsLoading ? (
                                      <div className="text-sm text-gray-600">Loading credentials...</div>
                                    ) : customerCredentials ? (
                                      <div className="space-y-3">
                                        <div className="bg-white p-4 rounded border border-green-200">
                                          <div className="space-y-3">
                                            <div>
                                              <Label className="text-sm font-medium text-gray-700">Customer Dashboard URL</Label>
                                              <code className="text-sm font-mono bg-gray-100 px-2 py-1 rounded block mt-1">
                                                https://buyawarranty.co.uk/customer-dashboard
                                              </code>
                                            </div>
                                            
                                            <div>
                                              <Label className="text-sm font-medium text-gray-700">Username (Email)</Label>
                                              <code className="text-sm font-mono bg-gray-100 px-2 py-1 rounded block mt-1">
                                                {customerCredentials.email}
                                              </code>
                                            </div>
                                            
                                            <div>
                                              <Label className="text-sm font-medium text-gray-700">Temporary Password</Label>
                                              <code className="text-sm font-mono bg-gray-100 px-2 py-1 rounded block mt-1">
                                                {customerCredentials.password}
                                              </code>
                                            </div>
                                          </div>
                                          
                                          <Button
                                            size="sm"
                                            variant="outline"
                                            className="w-full mt-3"
                                            onClick={() => {
                                              const credentials = `Customer Dashboard Login Details

Dashboard URL: https://buyawarranty.co.uk/customer-dashboard
Username: ${customerCredentials.email}
Password: ${customerCredentials.password}

Please log in and change your password after first login.`;
                                              navigator.clipboard.writeText(credentials);
                                              toast.success('All credentials copied to clipboard');
                                            }}
                                          >
                                            Copy All Credentials
                                          </Button>
                                        </div>
                                        
                                        <div className="bg-yellow-50 border border-yellow-200 rounded p-3 mt-3">
                                          <p className="text-xs text-yellow-800 flex items-center gap-1">
                                            <AlertCircle className="h-3 w-3" />
                                            Customer should change password after first login
                                          </p>
                                        </div>
                                        
                                        <div className="flex gap-2 mt-4">
                                          <Button
                                            onClick={() => sendCredentialsEmail(customerCredentials.email)}
                                            disabled={sendingCredentials}
                                            className="flex-1"
                                          >
                                            {sendingCredentials ? (
                                              <>
                                                <div className="animate-spin rounded-full h-4 w-4 border-b-2 border-white mr-2"></div>
                                                Sending...
                                              </>
                                            ) : (
                                              <>
                                                <Send className="h-4 w-4 mr-2" />
                                                Email Login Credentials to Customer
                                              </>
                                            )}
                                          </Button>
                                          
                                          {/* View as Customer Info Box */}
                                          <div className="bg-blue-50 border border-blue-300 rounded-lg p-4 mt-4">
                                            <div className="flex items-start gap-3">
                                              <Eye className="h-5 w-5 text-blue-600 mt-0.5 flex-shrink-0" />
                                              <div className="flex-1 space-y-2">
                                                <h4 className="font-semibold text-blue-900">Safe Customer View</h4>
                                                <p className="text-sm text-blue-800">
                                                  Use the button below to view this customer's dashboard safely. Your admin session will remain active in other tabs - no need to log out!
                                                </p>
                                              </div>
                                            </div>
                                          </div>
                                          
                                          <ViewAsCustomerButton
                                            customerId={selectedCustomer.id}
                                            customerEmail={customerCredentials.email}
                                            customerName={selectedCustomer.name}
                                          />
                                        </div>
                                        
                                        {/* Last Login Information */}
                                        {selectedCustomer.last_login && (
                                          <div className="bg-blue-50 border border-blue-200 rounded p-3 mt-3">
                                            <p className="text-xs text-blue-800 flex items-center gap-1">
                                              <Clock className="h-3 w-3" />
                                              Last Login: {new Date(selectedCustomer.last_login).toLocaleString('en-GB', {
                                                dateStyle: 'medium',
                                                timeStyle: 'short'
                                              })}
                                            </p>
                                          </div>
                                        )}
                                      </div>
                                    ) : (
                                      <div className="text-sm text-red-600">
                                        Unable to load credentials. Please try again.
                                      </div>
                                    )}
                                  </CollapsibleContent>
                                </div>
                              </Collapsible>

                              <Tabs defaultValue="details" className="w-full">
                                <TabsList className="grid w-full grid-cols-8">
                                  <TabsTrigger value="details">Customer Details</TabsTrigger>
                                  <TabsTrigger value="warranty">Warranty Details</TabsTrigger>
                                  <TabsTrigger value="claims">Claims</TabsTrigger>
                                  <TabsTrigger value="tags">Tags</TabsTrigger>
                                  <TabsTrigger value="notes">Notes</TabsTrigger>
                                  <TabsTrigger value="actions">Warranty Actions</TabsTrigger>
                                  <TabsTrigger value="mot">MOT History</TabsTrigger>
                                  <TabsTrigger value="w2000">Warranties Register</TabsTrigger>
                                </TabsList>

                                <TabsContent value="details" className="space-y-4">
                                  <div className="grid grid-cols-2 gap-4">
                                    <div>
                                      <Label htmlFor="edit-first-name">First Name</Label>
                                      <Input
                                        id="edit-first-name"
                                        value={editingCustomer.first_name || ''}
                                        onChange={(e) => setEditingCustomer({ 
                                          ...editingCustomer, 
                                          first_name: e.target.value,
                                          name: `${e.target.value} ${editingCustomer.last_name || ''}`.trim()
                                        })}
                                      />
                                    </div>
                                    <div>
                                      <Label htmlFor="edit-last-name">Surname</Label>
                                      <Input
                                        id="edit-last-name"
                                        value={editingCustomer.last_name || ''}
                                        onChange={(e) => setEditingCustomer({ 
                                          ...editingCustomer, 
                                          last_name: e.target.value,
                                          name: `${editingCustomer.first_name || ''} ${e.target.value}`.trim()
                                        })}
                                      />
                                    </div>
                                    <div>
                                      <Label htmlFor="edit-email">Email</Label>
                                      <Input
                                        id="edit-email"
                                        type="email"
                                        value={editingCustomer.email}
                                        onChange={(e) => setEditingCustomer({ ...editingCustomer, email: e.target.value })}
                                      />
                                    </div>
                                    <div>
                                      <Label htmlFor="edit-phone">Phone</Label>
                                      <Input
                                        id="edit-phone"
                                        value={editingCustomer.phone || ''}
                                        onChange={(e) => setEditingCustomer({ ...editingCustomer, phone: e.target.value })}
                                      />
                                    </div>
                                    <div>
                                      <Label htmlFor="edit-registration">Registration Plate</Label>
                                      <Input
                                        id="edit-registration"
                                        value={editingCustomer.registration_plate}
                                        onChange={(e) => setEditingCustomer({ ...editingCustomer, registration_plate: e.target.value })}
                                      />
                                    </div>
                                  </div>

                                  <div className="space-y-4 pt-4 border-t">
                                    <h3 className="text-lg font-semibold">Vehicle Details</h3>
                                    <div className="grid grid-cols-2 gap-4">
                                      <div>
                                        <Label htmlFor="edit-vehicle-make">Make</Label>
                                        <Input
                                          id="edit-vehicle-make"
                                          value={editingCustomer.vehicle_make || ''}
                                          onChange={(e) => setEditingCustomer({ ...editingCustomer, vehicle_make: e.target.value })}
                                        />
                                      </div>
                                      <div>
                                        <Label htmlFor="edit-vehicle-model">Model</Label>
                                        <Input
                                          id="edit-vehicle-model"
                                          value={editingCustomer.vehicle_model || ''}
                                          onChange={(e) => setEditingCustomer({ ...editingCustomer, vehicle_model: e.target.value })}
                                        />
                                      </div>
                                      <div>
                                        <Label htmlFor="edit-vehicle-year">Year</Label>
                                        <Input
                                          id="edit-vehicle-year"
                                          value={editingCustomer.vehicle_year || ''}
                                          onChange={(e) => setEditingCustomer({ ...editingCustomer, vehicle_year: e.target.value })}
                                        />
                                      </div>
                                      <div>
                                        <Label htmlFor="edit-mileage">Mileage</Label>
                                        <Input
                                          id="edit-mileage"
                                          value={editingCustomer.mileage || ''}
                                          onChange={(e) => setEditingCustomer({ ...editingCustomer, mileage: e.target.value })}
                                        />
                                      </div>
                                      <div>
                                        <Label htmlFor="edit-fuel-type">Fuel Type</Label>
                                        <Input
                                          id="edit-fuel-type"
                                          value={editingCustomer.vehicle_fuel_type || ''}
                                          onChange={(e) => setEditingCustomer({ ...editingCustomer, vehicle_fuel_type: e.target.value })}
                                        />
                                      </div>
                                      <div>
                                        <Label htmlFor="edit-transmission">Transmission</Label>
                                        <Input
                                          id="edit-transmission"
                                          value={editingCustomer.vehicle_transmission || ''}
                                          onChange={(e) => setEditingCustomer({ ...editingCustomer, vehicle_transmission: e.target.value })}
                                        />
                                      </div>
                                    </div>
                                  </div>

                                  <div className="space-y-4 pt-4 border-t">
                                    <h3 className="text-lg font-semibold">Address Details</h3>
                                    <div className="grid grid-cols-2 gap-4">
                                      <div>
                                        <Label htmlFor="edit-flat-number">Flat Number</Label>
                                        <Input
                                          id="edit-flat-number"
                                          value={editingCustomer.flat_number || ''}
                                          onChange={(e) => setEditingCustomer({ ...editingCustomer, flat_number: e.target.value })}
                                        />
                                      </div>
                                      <div>
                                        <Label htmlFor="edit-building-name">Building Name</Label>
                                        <Input
                                          id="edit-building-name"
                                          value={editingCustomer.building_name || ''}
                                          onChange={(e) => setEditingCustomer({ ...editingCustomer, building_name: e.target.value })}
                                        />
                                      </div>
                                      <div>
                                        <Label htmlFor="edit-building-number">Building Number</Label>
                                        <Input
                                          id="edit-building-number"
                                          value={editingCustomer.building_number || ''}
                                          onChange={(e) => setEditingCustomer({ ...editingCustomer, building_number: e.target.value })}
                                        />
                                      </div>
                                      <div>
                                        <Label htmlFor="edit-street">Street</Label>
                                        <Input
                                          id="edit-street"
                                          value={editingCustomer.street || ''}
                                          onChange={(e) => setEditingCustomer({ ...editingCustomer, street: e.target.value })}
                                        />
                                      </div>
                                      <div>
                                        <Label htmlFor="edit-town">Town</Label>
                                        <Input
                                          id="edit-town"
                                          value={editingCustomer.town || ''}
                                          onChange={(e) => setEditingCustomer({ ...editingCustomer, town: e.target.value })}
                                        />
                                      </div>
                                      <div>
                                        <Label htmlFor="edit-county">County</Label>
                                        <Input
                                          id="edit-county"
                                          value={editingCustomer.county || ''}
                                          onChange={(e) => setEditingCustomer({ ...editingCustomer, county: e.target.value })}
                                        />
                                      </div>
                                      <div>
                                        <Label htmlFor="edit-postcode">Postcode</Label>
                                        <Input
                                          id="edit-postcode"
                                          value={editingCustomer.postcode || ''}
                                          onChange={(e) => setEditingCustomer({ ...editingCustomer, postcode: e.target.value })}
                                        />
                                      </div>
                                      <div>
                                        <Label htmlFor="edit-country">Country</Label>
                                        <Input
                                          id="edit-country"
                                          value={editingCustomer.country || ''}
                                          onChange={(e) => setEditingCustomer({ ...editingCustomer, country: e.target.value })}
                                        />
                                      </div>
                                    </div>
                                  </div>

                                  <div className="space-y-4 pt-4 border-t">
                                    <h3 className="text-lg font-semibold">Warranty & Payment Details</h3>
                                    <div className="space-y-4">
                                      <div>
                                        <Label className="mb-2 block">Plan Type</Label>
                                        <ToggleGroup 
                                          type="single" 
                                          value={editingCustomer.plan_type || 'Platinum'} 
                                          onValueChange={(value) => value && setEditingCustomer({ ...editingCustomer, plan_type: value })}
                                          className="justify-start flex-wrap gap-2"
                                        >
                                          <ToggleGroupItem value="Basic" className="px-4 data-[state=on]:bg-primary data-[state=on]:text-primary-foreground">Basic</ToggleGroupItem>
                                          <ToggleGroupItem value="Gold" className="px-4 data-[state=on]:bg-primary data-[state=on]:text-primary-foreground">Gold</ToggleGroupItem>
                                          <ToggleGroupItem value="Platinum" className="px-4 data-[state=on]:bg-primary data-[state=on]:text-primary-foreground">Platinum</ToggleGroupItem>
                                          <ToggleGroupItem value="Electric" className="px-4 data-[state=on]:bg-primary data-[state=on]:text-primary-foreground">Electric</ToggleGroupItem>
                                          <ToggleGroupItem value="PHEV" className="px-4 data-[state=on]:bg-primary data-[state=on]:text-primary-foreground">PHEV</ToggleGroupItem>
                                          <ToggleGroupItem value="Motorbike" className="px-4 data-[state=on]:bg-primary data-[state=on]:text-primary-foreground">Motorbike</ToggleGroupItem>
                                        </ToggleGroup>
                                      </div>

                                      <div>
                                        <Label className="mb-2 block">Duration</Label>
                                        <ToggleGroup 
                                          type="single" 
                                          value={editingCustomer.payment_type || '12months'} 
                                          onValueChange={(value) => {
                                            if (value) {
                                              setEditingCustomer({ ...editingCustomer, payment_type: value });
                                              
                                              // Auto-calculate expiry date
                                              if (editingCustomer.customer_policies?.[0]?.policy_start_date) {
                                                const startDate = new Date(editingCustomer.customer_policies[0].policy_start_date);
                                                const months = getWarrantyDurationInMonths(value);
                                                const expiry = new Date(startDate);
                                                expiry.setMonth(expiry.getMonth() + months);
                                                
                                                const updatedPolicies = [...(editingCustomer.customer_policies || [])];
                                                updatedPolicies[0] = {
                                                  ...updatedPolicies[0],
                                                  policy_end_date: expiry.toISOString()
                                                };
                                                setEditingCustomer({ ...editingCustomer, payment_type: value, customer_policies: updatedPolicies });
                                              }
                                            }
                                          }}
                                          className="justify-start flex-wrap gap-2"
                                        >
                                          <ToggleGroupItem value="3months" className="px-4 data-[state=on]:bg-primary data-[state=on]:text-primary-foreground">3 Months</ToggleGroupItem>
                                          <ToggleGroupItem value="6months" className="px-4 data-[state=on]:bg-primary data-[state=on]:text-primary-foreground">6 Months</ToggleGroupItem>
                                          <ToggleGroupItem value="12months" className="px-4 data-[state=on]:bg-primary data-[state=on]:text-primary-foreground">1 Year</ToggleGroupItem>
                                          <ToggleGroupItem value="24months" className="px-4 data-[state=on]:bg-primary data-[state=on]:text-primary-foreground">2 Years</ToggleGroupItem>
                                          <ToggleGroupItem value="36months" className="px-4 data-[state=on]:bg-primary data-[state=on]:text-primary-foreground">3 Years</ToggleGroupItem>
                                          <ToggleGroupItem value="48months" className="px-4 data-[state=on]:bg-primary data-[state=on]:text-primary-foreground">4 Years</ToggleGroupItem>
                                          <ToggleGroupItem value="60months" className="px-4 data-[state=on]:bg-primary data-[state=on]:text-primary-foreground">5 Years</ToggleGroupItem>
                                        </ToggleGroup>
                                      </div>

                                      <div>
                                        <Label className="mb-2 block">Voluntary Excess</Label>
                                        <ToggleGroup 
                                          type="single" 
                                          value={editingCustomer.voluntary_excess?.toString() || '0'} 
                                          onValueChange={(value) => value && setEditingCustomer({ ...editingCustomer, voluntary_excess: parseInt(value) })}
                                          className="justify-start flex-wrap gap-2"
                                        >
                                          <ToggleGroupItem value="0" className="px-4 data-[state=on]:bg-primary data-[state=on]:text-primary-foreground">£0</ToggleGroupItem>
                                          <ToggleGroupItem value="50" className="px-4 data-[state=on]:bg-primary data-[state=on]:text-primary-foreground">£50</ToggleGroupItem>
                                          <ToggleGroupItem value="100" className="px-4 data-[state=on]:bg-primary data-[state=on]:text-primary-foreground">£100</ToggleGroupItem>
                                          <ToggleGroupItem value="150" className="px-4 data-[state=on]:bg-primary data-[state=on]:text-primary-foreground">£150</ToggleGroupItem>
                                          <ToggleGroupItem value="200" className="px-4 data-[state=on]:bg-primary data-[state=on]:text-primary-foreground">£200</ToggleGroupItem>
                                        </ToggleGroup>
                                      </div>

                                      <div>
                                        <Label className="mb-2 block">Claim Limit</Label>
                                        <ToggleGroup 
                                          type="single" 
                                          value={editingCustomer.claim_limit?.toString() || '1250'} 
                                          onValueChange={(value) => value && setEditingCustomer({ ...editingCustomer, claim_limit: parseInt(value) })}
                                          className="justify-start flex-wrap gap-2"
                                        >
                                          <ToggleGroupItem value="750" className="px-4 data-[state=on]:bg-primary data-[state=on]:text-primary-foreground">£1,000</ToggleGroupItem>
                                          <ToggleGroupItem value="1250" className="px-4 data-[state=on]:bg-primary data-[state=on]:text-primary-foreground">£1,250</ToggleGroupItem>
                                          <ToggleGroupItem value="2000" className="px-4 data-[state=on]:bg-primary data-[state=on]:text-primary-foreground">£2,000</ToggleGroupItem>
                                          <ToggleGroupItem value="2500" className="px-4 data-[state=on]:bg-primary data-[state=on]:text-primary-foreground">£2,500</ToggleGroupItem>
                                          <ToggleGroupItem value="3000" className="px-4 data-[state=on]:bg-primary data-[state=on]:text-primary-foreground">£3,000</ToggleGroupItem>
                                          <ToggleGroupItem value="4000" className="px-4 data-[state=on]:bg-primary data-[state=on]:text-primary-foreground">£4,000</ToggleGroupItem>
                                          <ToggleGroupItem value="5000" className="px-4 data-[state=on]:bg-primary data-[state=on]:text-primary-foreground">£5,000</ToggleGroupItem>
                                        </ToggleGroup>
                                      </div>

                                      <div>
                                        <Label className="mb-2 block">Labour Rate</Label>
                                        <ToggleGroup 
                                          type="single" 
                                          value={editingCustomer.labour_rate?.toString() || '70'} 
                                          onValueChange={(value) => value && setEditingCustomer({ ...editingCustomer, labour_rate: parseInt(value) })}
                                          className="justify-start flex-wrap gap-2"
                                        >
                                          <ToggleGroupItem value="50" className="px-4 data-[state=on]:bg-primary data-[state=on]:text-primary-foreground">£50/hr</ToggleGroupItem>
                                          <ToggleGroupItem value="70" className="px-4 data-[state=on]:bg-primary data-[state=on]:text-primary-foreground">£70/hr</ToggleGroupItem>
                                          <ToggleGroupItem value="100" className="px-4 data-[state=on]:bg-primary data-[state=on]:text-primary-foreground">£100/hr</ToggleGroupItem>
                                          <ToggleGroupItem value="150" className="px-4 data-[state=on]:bg-primary data-[state=on]:text-primary-foreground">£150/hr</ToggleGroupItem>
                                          <ToggleGroupItem value="200" className="px-4 data-[state=on]:bg-primary data-[state=on]:text-primary-foreground">£200/hr</ToggleGroupItem>
                                        </ToggleGroup>
                                      </div>
                                    </div>

                                    <div className="grid grid-cols-2 gap-4 pt-4">
                                      <div>
                                        <Label htmlFor="edit-original-amount">Original Amount (£)</Label>
                                        <Input
                                          id="edit-original-amount"
                                          type="number"
                                          step="0.01"
                                          value={editingCustomer.original_amount || ''}
                                          onChange={(e) => setEditingCustomer({ ...editingCustomer, original_amount: Number(e.target.value) })}
                                        />
                                      </div>
                                      <div>
                                        <Label htmlFor="edit-discount-amount">Discount Amount (£)</Label>
                                        <Input
                                          id="edit-discount-amount"
                                          type="number"
                                          step="0.01"
                                          value={editingCustomer.discount_amount || ''}
                                          onChange={(e) => setEditingCustomer({ ...editingCustomer, discount_amount: Number(e.target.value) })}
                                        />
                                      </div>
                                      <div>
                                        <Label htmlFor="edit-final-amount">Total Amount Paid (£)</Label>
                                        <Input
                                          id="edit-final-amount"
                                          type="number"
                                          step="0.01"
                                          placeholder="e.g. 396 (full amount, not monthly)"
                                          value={editingCustomer.final_amount || ''}
                                          onChange={(e) => setEditingCustomer({ ...editingCustomer, final_amount: Number(e.target.value) })}
                                        />
                                        <p className="text-xs text-muted-foreground mt-1">Enter the total amount paid, not the monthly price</p>
                                      </div>
                                      <div>
                                        <Label htmlFor="edit-discount-code">Discount Code</Label>
                                        <Input
                                          id="edit-discount-code"
                                          value={editingCustomer.discount_code || ''}
                                          onChange={(e) => setEditingCustomer({ ...editingCustomer, discount_code: e.target.value })}
                                        />
                                      </div>
                                      <div>
                                        <Label htmlFor="edit-status">Status</Label>
                                        <Select
                                          value={editingCustomer.status}
                                          onValueChange={(value) => setEditingCustomer({ ...editingCustomer, status: value })}
                                        >
                                          <SelectTrigger id="edit-status">
                                            <SelectValue placeholder="Select status" />
                                          </SelectTrigger>
                                          <SelectContent>
                                            <SelectItem value="Active">Active</SelectItem>
                                            <SelectItem value="Inactive">Inactive</SelectItem>
                                            <SelectItem value="Pending">Pending</SelectItem>
                                            <SelectItem value="Cancelled">Cancelled</SelectItem>
                                            <SelectItem value="Refunded">Refunded</SelectItem>
                                          </SelectContent>
                                        </Select>
                                      </div>
                                      <div>
                                        <Label htmlFor="edit-signup-date">Signup Date</Label>
                                        <Popover>
                                          <PopoverTrigger asChild>
                                            <Button
                                              id="edit-signup-date"
                                              variant="outline"
                                              className={cn(
                                                "w-full justify-start text-left font-normal",
                                                !editingCustomer.signup_date && "text-muted-foreground"
                                              )}
                                            >
                                              <CalendarIcon className="mr-2 h-4 w-4" />
                                              {editingCustomer.signup_date ? (
                                                format(new Date(editingCustomer.signup_date), 'dd/MM/yyyy')
                                              ) : (
                                                <span>Pick a date</span>
                                              )}
                                            </Button>
                                          </PopoverTrigger>
                                          <PopoverContent className="w-auto p-0" align="start">
                                            <Calendar
                                              mode="single"
                                              selected={editingCustomer.signup_date ? new Date(editingCustomer.signup_date) : undefined}
                                              onSelect={(date) => date && setEditingCustomer({ ...editingCustomer, signup_date: date.toISOString() })}
                                              initialFocus
                                            className="p-3 pointer-events-auto"
                                           />
                                          </PopoverContent>
                                        </Popover>
                                      </div>
                                       <div>
                                        <Label>Purchase Date</Label>
                                        <div className="w-full px-3 py-2 text-sm border rounded-md bg-gray-50">
                                          {editingCustomer.customer_policies?.[0]?.created_at ? (
                                            <>
                                              {format(new Date(editingCustomer.customer_policies[0].created_at), 'dd/MM/yyyy')}
                                              <span className="text-gray-500 ml-2">
                                                {format(new Date(editingCustomer.customer_policies[0].created_at), 'HH:mm:ss')}
                                              </span>
                                            </>
                                          ) : editingCustomer.created_at ? (
                                            <>
                                              {format(new Date(editingCustomer.created_at), 'dd/MM/yyyy')}
                                              <span className="text-gray-500 ml-2">
                                                {format(new Date(editingCustomer.created_at), 'HH:mm:ss')}
                                              </span>
                                            </>
                                          ) : (
                                            <span className="text-gray-400">N/A</span>
                                          )}
                                        </div>
                                      </div>
                                      <div>
                                        <Label htmlFor="edit-start-date">Warranty Start Date</Label>
                                        <Popover>
                                          <PopoverTrigger asChild>
                                            <Button
                                              id="edit-start-date"
                                              variant="outline"
                                              className={cn(
                                                "w-full justify-start text-left font-normal",
                                                !editingCustomer.customer_policies?.[0]?.policy_start_date && "text-muted-foreground"
                                              )}
                                            >
                                              <CalendarIcon className="mr-2 h-4 w-4" />
                                              {editingCustomer.customer_policies?.[0]?.policy_start_date ? (
                                                format(new Date(editingCustomer.customer_policies[0].policy_start_date), 'dd/MM/yyyy')
                                              ) : (
                                                <span>Pick a date</span>
                                              )}
                                            </Button>
                                          </PopoverTrigger>
                                          <PopoverContent className="w-auto p-0" align="start">
                                            <Calendar
                                              mode="single"
                                              selected={editingCustomer.customer_policies?.[0]?.policy_start_date ? new Date(editingCustomer.customer_policies[0].policy_start_date) : undefined}
                                              onSelect={(date) => {
                                                if (date && editingCustomer.customer_policies && editingCustomer.customer_policies[0]) {
                                                  const months = getWarrantyDurationInMonths(editingCustomer.payment_type || '12months');
                                                  const expiry = new Date(date);
                                                  expiry.setMonth(expiry.getMonth() + months);
                                                  
                                                  const updatedPolicies = [...editingCustomer.customer_policies];
                                                  updatedPolicies[0] = {
                                                    ...updatedPolicies[0],
                                                    policy_start_date: date.toISOString(),
                                                    policy_end_date: expiry.toISOString()
                                                  };
                                                  setEditingCustomer({ ...editingCustomer, customer_policies: updatedPolicies });
                                                }
                                              }}
                                              initialFocus
                                              className="p-3 pointer-events-auto"
                                            />
                                          </PopoverContent>
                                        </Popover>
                                      </div>
                                      <div>
                                        <Label htmlFor="edit-expiry-date">Warranty Expiry Date</Label>
                                        <Popover>
                                          <PopoverTrigger asChild>
                                            <Button
                                              id="edit-expiry-date"
                                              variant="outline"
                                              className={cn(
                                                "w-full justify-start text-left font-normal",
                                                !editingCustomer.customer_policies?.[0]?.policy_end_date && "text-muted-foreground"
                                              )}
                                            >
                                              <CalendarIcon className="mr-2 h-4 w-4" />
                                              {editingCustomer.customer_policies?.[0]?.policy_end_date ? (
                                                format(new Date(editingCustomer.customer_policies[0].policy_end_date), 'dd/MM/yyyy')
                                              ) : (
                                                <span>Pick a date</span>
                                              )}
                                            </Button>
                                          </PopoverTrigger>
                                          <PopoverContent className="w-auto p-0" align="start">
                                            <Calendar
                                              mode="single"
                                              selected={editingCustomer.customer_policies?.[0]?.policy_end_date ? new Date(editingCustomer.customer_policies[0].policy_end_date) : undefined}
                                              onSelect={(date) => {
                                                if (date && editingCustomer.customer_policies && editingCustomer.customer_policies[0]) {
                                                  const updatedPolicies = [...editingCustomer.customer_policies];
                                                  updatedPolicies[0] = {
                                                    ...updatedPolicies[0],
                                                    policy_end_date: date.toISOString()
                                                  };
                                                  setEditingCustomer({ ...editingCustomer, customer_policies: updatedPolicies });
                                                }
                                              }}
                                              initialFocus
                                              className="p-3 pointer-events-auto"
                                            />
                                          </PopoverContent>
                                        </Popover>
                                      </div>
                                    </div>
                                  </div>
                                  
                                  <div className="space-y-4 pt-4 border-t">
                                    <h3 className="text-lg font-semibold">Add-On Protections</h3>
                                    <div className="grid grid-cols-2 gap-4">
                                      <div className="flex items-center space-x-2">
                                        <Checkbox 
                                          id="edit-breakdown-recovery"
                                          checked={editingCustomer.breakdown_recovery || false}
                                          onCheckedChange={(checked) => setEditingCustomer({ ...editingCustomer, breakdown_recovery: !!checked })}
                                        />
                                        <Label htmlFor="edit-breakdown-recovery" className="font-normal cursor-pointer">Breakdown Recovery</Label>
                                      </div>
                                      <div className="flex items-center space-x-2">
                                        <Checkbox 
                                          id="edit-tyre-cover"
                                          checked={editingCustomer.tyre_cover || false}
                                          onCheckedChange={(checked) => setEditingCustomer({ ...editingCustomer, tyre_cover: !!checked })}
                                        />
                                        <Label htmlFor="edit-tyre-cover" className="font-normal cursor-pointer">Tyre Cover</Label>
                                      </div>
                                      <div className="flex items-center space-x-2">
                                        <Checkbox 
                                          id="edit-wear-tear"
                                          checked={editingCustomer.wear_tear || false}
                                          onCheckedChange={(checked) => setEditingCustomer({ ...editingCustomer, wear_tear: !!checked })}
                                        />
                                        <Label htmlFor="edit-wear-tear" className="font-normal cursor-pointer">Wear & Tear Cover</Label>
                                      </div>
                                      <div className="flex items-center space-x-2">
                                        <Checkbox 
                                          id="edit-europe-cover"
                                          checked={editingCustomer.europe_cover || false}
                                          onCheckedChange={(checked) => setEditingCustomer({ ...editingCustomer, europe_cover: !!checked })}
                                        />
                                        <Label htmlFor="edit-europe-cover" className="font-normal cursor-pointer">Europe Cover</Label>
                                      </div>
                                      <div className="flex items-center space-x-2">
                                        <Checkbox 
                                          id="edit-vehicle-rental"
                                          checked={editingCustomer.vehicle_rental || false}
                                          onCheckedChange={(checked) => setEditingCustomer({ ...editingCustomer, vehicle_rental: !!checked })}
                                        />
                                        <Label htmlFor="edit-vehicle-rental" className="font-normal cursor-pointer">Vehicle Rental</Label>
                                      </div>
                                      <div className="flex items-center space-x-2">
                                        <Checkbox 
                                          id="edit-transfer-cover"
                                          checked={editingCustomer.transfer_cover || false}
                                          onCheckedChange={(checked) => setEditingCustomer({ ...editingCustomer, transfer_cover: !!checked })}
                                        />
                                        <Label htmlFor="edit-transfer-cover" className="font-normal cursor-pointer">Transfer Cover</Label>
                                      </div>
                                      <div className="flex items-center space-x-2">
                                        <Checkbox 
                                          id="edit-mot-repair"
                                          checked={editingCustomer.mot_repair || false}
                                          onCheckedChange={(checked) => setEditingCustomer({ ...editingCustomer, mot_repair: !!checked })}
                                        />
                                        <Label htmlFor="edit-mot-repair" className="font-normal cursor-pointer">MOT Repair</Label>
                                      </div>
                                      <div className="flex items-center space-x-2">
                                        <Checkbox 
                                          id="edit-lost-key"
                                          checked={editingCustomer.lost_key || false}
                                          onCheckedChange={(checked) => setEditingCustomer({ ...editingCustomer, lost_key: !!checked })}
                                        />
                                        <Label htmlFor="edit-lost-key" className="font-normal cursor-pointer">Lost Key Cover</Label>
                                      </div>
                                      <div className="flex items-center space-x-2">
                                        <Checkbox 
                                          id="edit-consequential"
                                          checked={editingCustomer.consequential || false}
                                          onCheckedChange={(checked) => setEditingCustomer({ ...editingCustomer, consequential: !!checked })}
                                        />
                                        <Label htmlFor="edit-consequential" className="font-normal cursor-pointer">Consequential Loss</Label>
                                      </div>
                                    </div>
                                  </div>

                                  {/* Additional Notes for Customer Dashboard */}
                                  <div className="space-y-2 pt-4 border-t">
                                    <Label htmlFor="edit-additional-notes" className="text-base font-semibold">Additional Notes (visible in Customer Dashboard)</Label>
                                    <Textarea
                                      id="edit-additional-notes"
                                      value={editingCustomer.customer_policies?.[0]?.additional_notes || ''}
                                      onChange={(e) => {
                                        if (editingCustomer.customer_policies && editingCustomer.customer_policies[0]) {
                                          const updatedPolicies = [...editingCustomer.customer_policies];
                                          updatedPolicies[0] = {
                                            ...updatedPolicies[0],
                                            additional_notes: e.target.value
                                          };
                                          setEditingCustomer({ ...editingCustomer, customer_policies: updatedPolicies });
                                        }
                                      }}
                                      placeholder="e.g., Transfer cover included, Labour rate increased to £150/hr, 3 months FREE extended cover..."
                                      rows={3}
                                    />
                                    <p className="text-xs text-muted-foreground">
                                      These notes will appear in the customer's dashboard under "Additional Notes". Changes here do NOT resend to Warranties Register.
                                    </p>
                                  </div>

                                  {/* Customer Dashboard Access */}
                                  <div className="space-y-4 pt-6 border-t">
                                    <div className="flex items-center gap-2 mb-4">
                                      <User className="h-5 w-5" />
                                      <h3 className="text-lg font-semibold">Customer Dashboard Access</h3>
                                    </div>
                                    
                                    <div className="bg-muted/50 p-4 rounded-lg">
                                      <p className="text-sm text-muted-foreground">
                                        Set up dashboard credentials to test customer login before they receive their welcome email.
                                      </p>
                                    </div>

                                    <div className="grid grid-cols-2 gap-4">
                                      <div>
                                        <Label htmlFor="edit-dashboard-email">Dashboard Email</Label>
                                        <Input
                                          id="edit-dashboard-email"
                                          type="email"
                                          value={editingCustomer.email || ''}
                                          onChange={(e) => setEditingCustomer({ ...editingCustomer, email: e.target.value })}
                                          placeholder="customer@example.com"
                                        />
                                      </div>
                                      <div>
                                        <Label htmlFor="edit-temp-password">Temporary Password</Label>
                                        <Input
                                          id="edit-temp-password"
                                          type="text"
                                          value={editingCustomer.temporary_password || ''}
                                          onChange={(e) => setEditingCustomer({ ...editingCustomer, temporary_password: e.target.value })}
                                          placeholder="temp-password-123"
                                        />
                                      </div>
                                    </div>
                                  </div>
                                  
                                  <div className="flex justify-end space-x-2 pt-4">
                                    <Button onClick={updateCustomer}>
                                      <Save className="h-4 w-4 mr-2" />
                                      Save Changes
                                    </Button>
                                  </div>
                                </TabsContent>

                                <TabsContent value="warranty">
                                  {editingCustomer.customer_policies && editingCustomer.customer_policies.length > 0 ? (
                                    <div className="space-y-4">
                                      {/* Last Sent Info & Action Buttons */}
                                      <div className="space-y-3">
                                        {editingCustomer.customer_policies[0]?.warranties_2000_sent_at && (
                                          <div className="bg-blue-50 border border-blue-200 rounded-lg p-3">
                                            <div className="flex items-center gap-2 text-sm">
                                              <Clock className="h-4 w-4 text-blue-600" />
                                              <span className="font-medium text-blue-900">Last sent to Warranties Register:</span>
                                              <span className="text-blue-700">
                                                {new Date(editingCustomer.customer_policies[0].warranties_2000_sent_at).toLocaleString('en-GB', {
                                                  day: '2-digit',
                                                  month: 'short',
                                                  year: 'numeric',
                                                  hour: '2-digit',
                                                  minute: '2-digit'
                                                })}
                                              </span>
                                            </div>
                                          </div>
                                        )}
                                        
                                        <div className="flex justify-between items-center gap-2">
                                          <Button 
                                            onClick={() => {
                                              if (editingCustomer.customer_policies[0]?.id) {
                                                if (confirm('⚠️ WARNING: Warranties Register should only receive ONE submission per warranty.\n\nOnly resend if you have updated critical information that must be corrected in their system.\n\nContinue with manual resend?')) {
                                                  handleSendToWarranties2000(
                                                    editingCustomer.customer_policies[0].id,
                                                    editingCustomer.id,
                                                    true // Force resend - overrides duplicate check
                                                  );
                                                }
                                              }
                                            }}
                                            variant="outline"
                                            className="flex items-center gap-2 border-orange-300 hover:bg-orange-50 hover:border-orange-400"
                                            disabled={emailSendingLoading[editingCustomer.id]?.warranties2000}
                                          >
                                            {emailSendingLoading[editingCustomer.id]?.warranties2000 ? (
                                              <div className="animate-spin rounded-full h-4 w-4 border-b-2 border-orange-600"></div>
                                            ) : (
                                              <Send className="h-4 w-4 text-orange-600" />
                                            )}
                                            <span className="text-orange-600">Manual Resend to Warranties Register</span>
                                          </Button>
                                          <EditOrderButton 
                                            customer={editingCustomer}
                                            policy={editingCustomer.customer_policies[0]}
                                          />
                                          {!isSalesAgent && (
                                          <Button
                                            onClick={() => {
                                              setUpgradeCustomer(editingCustomer);
                                              setUpgradeDialogOpen(true);
                                            }}
                                            variant="outline"
                                            className="flex items-center gap-2 border-amber-300 hover:bg-amber-50 hover:border-amber-400"
                                          >
                                            <Sparkles className="h-4 w-4 text-amber-500" />
                                            <span className="text-amber-600">Manual Upgrade</span>
                                          </Button>
                                          )}
                                        </div>
                                        
                                        {/* Show manual upgrade badge if upgraded */}
                                        {editingCustomer.manual_upgrade_at && (
                                          <div className="p-3 bg-amber-50 border border-amber-200 rounded-lg flex items-center gap-2">
                                            <Sparkles className="h-4 w-4 text-amber-500" />
                                            <span className="text-sm text-amber-700">
                                              <strong>Manually Upgraded</strong> on {format(new Date(editingCustomer.manual_upgrade_at), 'dd/MM/yyyy HH:mm')}
                                              {editingCustomer.manual_upgrade_notes && (
                                                <span className="block text-xs text-amber-600 mt-0.5">{editingCustomer.manual_upgrade_notes}</span>
                                              )}
                                            </span>
                                          </div>
                                        )}
                                      </div>
                                      
                                      {editingCustomer.customer_policies.map((policy: any, index: number) => (
                                        <Card key={index} className="p-4">
                                          <div className="grid grid-cols-2 gap-4">
                                            <div>
                                              <Label className="text-sm font-medium text-gray-500">Warranty Number</Label>
                                              <div className="flex items-center gap-2">
                                                <p className="text-sm font-semibold">{policy.warranty_number || 'N/A'}</p>
                                                {policy.warranty_number && policy.warranty_number.startsWith('BAW-') && (currentAdminUser?.role === 'admin' || currentAdminUser?.role === 'super_admin') && (
                                                  <Button
                                                    variant="ghost"
                                                    size="sm"
                                                    className="h-6 px-2 text-xs"
                                                    onClick={async () => {
                                                      const currentNum = policy.warranty_number || '';
                                                      const newNum = currentNum.replace('BAW-', 'ADM-');
                                                      const { error } = await supabase
                                                        .from('customer_policies')
                                                        .update({ warranty_number: newNum })
                                                        .eq('id', policy.id);
                                                      if (error) {
                                                        toast.error('Failed to update warranty number');
                                                      } else {
                                                        toast.success(`Warranty number changed to ${newNum}`);
                                                        fetchCustomers();
                                                      }
                                                    }}
                                                  >
                                                    Switch to ADM-
                                                  </Button>
                                                )}
                                              </div>
                                            </div>
                                            <div>
                                              <Label className="text-sm font-medium text-gray-500">Policy Number</Label>
                                              <p className="text-sm">{policy.policy_number || 'N/A'}</p>
                                            </div>
                                            <div>
                                              <Label className="text-sm font-medium text-gray-500">Start Date</Label>
                                              <p className="text-sm">{policy.start_date ? format(new Date(policy.start_date), 'dd/MM/yyyy') : 'N/A'}</p>
                                            </div>
                                            <div>
                                              <Label className="text-sm font-medium text-gray-500">Expiry Date</Label>
                                              <p className="text-sm">{policy.expiry_date ? format(new Date(policy.expiry_date), 'dd/MM/yyyy') : 'N/A'}</p>
                                            </div>
                                            <div>
                                              <Label className="text-sm font-medium text-gray-500">Payment Type</Label>
                                              <p className="text-sm">{policy.payment_type || 'N/A'}</p>
                                            </div>
                                            <div>
                                              <Label className="text-sm font-medium text-gray-500">Payment Status</Label>
                                              <Badge variant={policy.payment_status === 'paid' ? 'default' : 'destructive'}>
                                                {policy.payment_status}
                                              </Badge>
                                            </div>
                                            <div>
                                              <Label className="text-sm font-medium text-gray-500">Policy Status</Label>
                                              <Badge variant={policy.status === 'active' ? 'default' : policy.status === 'cancelled' ? 'destructive' : 'secondary'}>
                                                {policy.status || 'active'}
                                              </Badge>
                                            </div>
                                            <div className="col-span-2">
                                              <Label className="text-sm font-medium text-gray-500 mb-2 block">Coverage Details</Label>
                                              <CoverageDetailsDisplay 
                                                mot_fee={editingCustomer.mot_fee}
                                                tyre_cover={editingCustomer.tyre_cover}
                                                wear_tear={editingCustomer.wear_tear}
                                                europe_cover={editingCustomer.europe_cover}
                                                transfer_cover={editingCustomer.transfer_cover}
                                                breakdown_recovery={editingCustomer.breakdown_recovery}
                                                vehicle_rental={editingCustomer.vehicle_rental}
                                                mot_repair={editingCustomer.mot_repair}
                                                lost_key={editingCustomer.lost_key}
                                                consequential={editingCustomer.consequential}
                                              />
                                            </div>
                                            <div className="col-span-2">
                                              <Label className="text-sm font-medium text-gray-500 mb-2 block">Add-On Protections</Label>
                                              <AddOnProtectionDisplay 
                                                mot_fee={policy.mot_fee}
                                                tyre_cover={policy.tyre_cover}
                                                wear_tear={policy.wear_tear}
                                                europe_cover={policy.europe_cover}
                                                transfer_cover={policy.transfer_cover}
                                                breakdown_recovery={policy.breakdown_recovery}
                                                vehicle_rental={policy.vehicle_rental}
                                                mot_repair={policy.mot_repair}
                                                lost_key={policy.lost_key}
                                                consequential={policy.consequential}
                                                payment_type={editingCustomer.payment_type || 'monthly'}
                                              />
                                            </div>
                                            <div className="col-span-2 pt-4 border-t">
                                              <div className="flex items-center justify-between">
                                                <div>
                                                  <Label className="text-sm font-medium text-gray-700">Warranty Management</Label>
                                                  <p className="text-xs text-gray-500 mt-1">
                                                    {policy.status === 'cancelled' 
                                                      ? 'This warranty has been cancelled and is inactive'
                                                      : 'Cancel this warranty if it needs to be voided or deactivated'}
                                                  </p>
                                                </div>
                                                {policy.status !== 'cancelled' ? (
                                                  <Button
                                                    variant="destructive"
                                                    size="sm"
                                                    onClick={() => {
                                                      setCancelWarrantyDialog({
                                                        isOpen: true,
                                                        policy: {
                                                          id: policy.id,
                                                          email: policy.email,
                                                          policy_number: policy.policy_number,
                                                          user_id: policy.user_id,
                                                          customer_id: policy.customer_id
                                                        },
                                                        customerName: editingCustomer?.name
                                                      });
                                                    }}
                                                  >
                                                    Cancel Warranty
                                                  </Button>
                                                ) : (
                                                  <Button
                                                    variant="outline"
                                                    size="sm"
                                                    onClick={async () => {
                                                      if (!confirm('Are you sure you want to reactivate this warranty?')) return;
                                                      
                                                      try {
                                                        const { error } = await supabase
                                                          .from('customer_policies')
                                                          .update({ status: 'active' })
                                                          .eq('id', policy.id);

                                                        if (error) throw error;

                                                        toast.success('Warranty reactivated successfully');
                                                        fetchCustomers(); // Refresh data
                                                      } catch (error) {
                                                        console.error('Error reactivating warranty:', error);
                                                        toast.error('Failed to reactivate warranty');
                                                      }
                                                    }}
                                                  >
                                                    Reactivate Warranty
                                                  </Button>
                                                )}
                                              </div>
                                            </div>
                                          </div>
                                        </Card>
                                      ))}
                                      
                                      {/* Warranties Register Submission History */}
                                      {editingCustomer.customer_policies[0]?.id && (
                                        <W2KAuditLog policyId={editingCustomer.customer_policies[0].id} />
                                      )}
                                    </div>
                                  ) : (
                                    <div className="text-center text-gray-500 py-8">
                                      No warranty policies found for this customer
                                    </div>
                                  )}
                                </TabsContent>

                                <TabsContent value="claims">
                                  {selectedCustomer && (
                                    <CustomerClaimsSummary
                                      customerId={selectedCustomer.id}
                                      customerEmail={selectedCustomer.email}
                                      customerName={selectedCustomer.name}
                                      vehicleReg={selectedCustomer.registration_plate}
                                      onClaimAdded={fetchCustomers}
                                    />
                                  )}
                                </TabsContent>

                                <TabsContent value="tags">
                                  {selectedCustomer && (
                                    <div className="space-y-4">
                                      <div>
                                        <h3 className="text-lg font-semibold mb-2">Customer Tags</h3>
                                        <p className="text-sm text-muted-foreground mb-4">
                                          Manage tags to organize and track customer status, payment info, and follow-ups.
                                        </p>
                                        <CustomerTagsManager 
                                          customerId={selectedCustomer.id}
                                          onTagsUpdate={fetchCustomers}
                                        />
                                      </div>
                                    </div>
                                  )}
                                </TabsContent>

                                <TabsContent value="notes" className="space-y-6">
                                  {selectedCustomer && (
                                    <>
                                      <StructuredNotesSection 
                                        customerId={selectedCustomer.id}
                                        customerName={selectedCustomer.name}
                                        policyNumber={selectedCustomer.customer_policies?.[0]?.policy_number}
                                        vehicleReg={selectedCustomer.registration_plate}
                                      />
                                      <CustomerServiceNotes customerId={selectedCustomer.id} customerType="active" />
                                    </>
                                  )}
                                </TabsContent>

                                <TabsContent value="actions">
                                  {selectedCustomer && (
                                    <WarrantyActions 
                                      customerId={selectedCustomer.id}
                                      customerEmail={selectedCustomer.email}
                                      policyId={selectedCustomer.customer_policies?.[0]?.id}
                                      warrantyNumber={selectedCustomer.customer_policies?.[0]?.warranty_number}
                                      emailStatus={selectedCustomer.customer_policies?.[0]?.email_sent_status}
                                      warranties2000Status={selectedCustomer.customer_policies?.[0]?.warranties_2000_status}
                                      onActionComplete={fetchCustomers}
                                    />
                                  )}
                                </TabsContent>

                                <TabsContent value="mot">
                                  {selectedCustomer && (
                                    <MOTHistorySection 
                                      registrationNumber={selectedCustomer.registration_plate}
                                      customerId={selectedCustomer.id}
                                    />
                                  )}
                                </TabsContent>

                                <TabsContent value="w2000">
                                  {selectedCustomer && (
                                    <W2000DataPreview 
                                      customer={selectedCustomer}
                                    />
                                  )}
                                </TabsContent>
                              </Tabs>
                            </>
                          )}
                        </DialogContent>
                      </Dialog>
                      <div className="flex items-center justify-between gap-2 w-full">
                        <div className="flex items-center gap-1.5 flex-wrap">
                          <span className="font-medium">{customer.name}</span>
                          {isDueToday(customer) && (
                            <Badge className="bg-orange-500 text-white text-[10px] px-1.5 py-0 h-4 font-bold animate-pulse">
                              🔔 DUE TODAY
                            </Badge>
                          )}
                          <PaymentDueDatePicker
                            customerId={customer.id}
                            paymentDueDate={(customer as any).payment_due_date}
                            onUpdate={fetchCustomers}
                          />
                        </div>
                        <InlineFutureActivationEdit
                          customerId={customer.id}
                          policyId={(customer.customer_policies as any)?.[0]?.id}
                          currentDate={(customer.customer_policies as any)?.[0]?.policy_start_date || customer.signup_date}
                          scheduledFor={customer.warranties_2000_scheduled_for}
                          w2000Status={(customer.customer_policies as any)?.[0]?.warranties_2000_status}
                          onUpdate={fetchCustomers}
                        />
                      </div>
                    </div>
                  </TableCell>
                   <TableCell>
                     {(customer as any).lead_date ? (
                       <>
                         <div className="text-sm">
                           {format(new Date((customer as any).lead_date), 'dd/MM/yyyy')}
                         </div>
                         <div className="text-xs text-muted-foreground">
                           {format(new Date((customer as any).lead_date), 'HH:mm')}
                         </div>
                       </>
                     ) : (
                       <span className="text-xs text-muted-foreground">—</span>
                     )}
                   </TableCell>
                   <TableCell>
                     <div className="text-sm">
                       {format(new Date(customer.signup_date), 'dd/MM/yyyy')}
                     </div>
                     <div className="text-xs text-muted-foreground">
                       {format(new Date(customer.signup_date), 'HH:mm')}
                     </div>
                   </TableCell>
                  <TableCell>{customer.email}</TableCell>
                  <TableCell>
                    {customer.phone ? (
                      <span className="text-foreground text-sm flex items-center gap-1">
                        <Phone className="h-3 w-3" />
                        {customer.phone}
                      </span>
                    ) : 'N/A'}
                  </TableCell>
                  <TableCell>
                    {customer.customer_dob ? (
                      <span className="text-sm">{format(new Date(customer.customer_dob), 'dd/MM/yyyy')}</span>
                    ) : (
                      <span className="text-xs text-muted-foreground">—</span>
                    )}
                  </TableCell>
                  <TableCell>
                    <div className="flex items-center gap-1.5">
                      <NumberPlate plateNumber={customer.registration_plate} />
                      {isDuplicate(customer.registration_plate) && (
                        <button
                          onClick={() => openMergeForReg(customer.registration_plate)}
                          title="Duplicate registration detected — click to merge"
                        >
                          <Badge className="bg-orange-100 text-orange-700 border-orange-300 text-[10px] cursor-pointer hover:bg-orange-200 transition-colors">
                            <CopyPlus className="h-3 w-3 mr-0.5" />
                            DUP
                          </Badge>
                        </button>
                      )}
                    </div>
                  </TableCell>
                  <TableCell>
                    <div className="flex flex-col gap-0.5">
                      <PurchaseSourceBadge 
                        source={customer.purchase_source} 
                        bumperOrderId={customer.bumper_order_id}
                        stripeSessionId={customer.stripe_session_id}
                        className="text-[10px]"
                      />
                      {(currentAdminUser?.role === 'super_admin' || currentAdminUser?.role === 'admin') && customer.final_amount ? (
                        <span className="text-xs font-semibold text-foreground">£{Number(customer.final_amount).toFixed(2)}</span>
                      ) : null}
                    </div>
                  </TableCell>
                    <TableCell className="font-mono text-sm">
                    {customer.warranty_reference_number || customer.warranty_number ? (
                      <div className="bg-green-50 px-2 py-1 rounded border">
                        {customer.warranty_reference_number || customer.warranty_number}
                      </div>
                    ) : (
                      <span className="text-gray-400">No Reference</span>
                    )}
                  </TableCell>
                   <TableCell>
                     <div className="flex items-center gap-2">
                       {customer.customer_policies?.[0]?.email_sent_status === 'sent' ? (
                         <Badge variant="secondary" className="bg-green-100 text-green-800">
                           <CheckCircle className="w-3 h-3 mr-1" />
                           Sent
                         </Badge>
                       ) : customer.customer_policies?.[0]?.email_sent_status === 'failed' ? (
                         <Badge variant="destructive" className="bg-red-100 text-red-800">
                           <AlertCircle className="w-3 h-3 mr-1" />
                           Failed
                         </Badge>
                       ) : (
                         <Badge variant="outline" className="bg-gray-100 text-gray-800">
                           <Clock className="w-3 h-3 mr-1" />
                           Not Sent
                         </Badge>
                       )}
                       
                       {customer.customer_policies?.[0]?.id && (
                         <Button
                           variant="ghost"
                           size="sm"
                           onClick={() => handleSendWelcomeEmail(customer.customer_policies[0].id, customer.id)}
                           disabled={emailSendingLoading[customer.id]?.email}
                           title="Send Welcome Email"
                           className="hover:bg-blue-50 hover:text-blue-600"
                         >
                           {emailSendingLoading[customer.id]?.email ? (
                             <div className="animate-spin rounded-full h-3 w-3 border-b-2 border-blue-600"></div>
                           ) : (
                             <Send className="h-3 w-3" />
                           )}
                         </Button>
                       )}
                     </div>
                   </TableCell>
                   <TableCell>
                     <div className="flex items-center gap-2">
                       {customer.customer_policies?.[0]?.warranties_2000_status === 'sent' ? (
                         <Badge variant="secondary" className="bg-green-100 text-green-800">
                           <CheckCircle className="w-3 h-3 mr-1" />
                           Sent
                         </Badge>
                       ) : customer.customer_policies?.[0]?.warranties_2000_status === 'failed' ? (
                         <Badge variant="destructive" className="bg-red-100 text-red-800">
                           <AlertCircle className="w-3 h-3 mr-1" />
                           Failed
                         </Badge>
                       ) : (
                         <Badge variant="outline" className="bg-gray-100 text-gray-800">
                           <Clock className="w-3 h-3 mr-1" />
                           Not Sent
                         </Badge>
                       )}
                       
                       {customer.customer_policies?.[0]?.id && (
                         <Button
                           variant="ghost"
                           size="sm"
                           onClick={() => handleSendToWarranties2000(customer.customer_policies[0].id, customer.id)}
                           disabled={emailSendingLoading[customer.id]?.warranties2000}
                           title="Send to Warranties Register"
                           className="hover:bg-purple-50 hover:text-purple-600"
                         >
                           {emailSendingLoading[customer.id]?.warranties2000 ? (
                             <div className="animate-spin rounded-full h-3 w-3 border-b-2 border-purple-600"></div>
                           ) : (
                             <Send className="h-3 w-3" />
                           )}
                         </Button>
                       )}
                     </div>
                   </TableCell>
                   <TableCell>
                    <div className="flex flex-col gap-1">
                     <Badge 
                       variant={customer.status === 'Active' ? 'default' : 'destructive'}
                       className={cn(
                         customer.status?.toLowerCase() === 'refunded' && 'bg-amber-500 hover:bg-amber-600 text-white',
                         customer.status?.toLowerCase() === 'cancelled' && 'bg-red-500 hover:bg-red-600 text-white'
                       )}
                     >
                       {customer.status?.toLowerCase() === 'refunded' && '💰 '}
                       {customer.status}
                     </Badge>
                     <CommissionClaimedBadge customerId={customer.id} />
                    </div>
                   </TableCell>
                    <TableCell>
                      <div className="flex flex-col space-y-1">
                        <Select
                          value={customer.assigned_to ? customer.assigned_to : (
                            (customer.customer_policies?.[0]?.warranty_number || '').startsWith('BAW-') && !(customer.customer_policies?.[0]?.warranty_number || '').startsWith('BAW-S-')
                              ? WEBSITE_SALES_ACCOUNT_ID : 'unassigned'
                          )}
                          onValueChange={(val) => {
                            if (val === WEBSITE_SALES_ACCOUNT_ID) {
                              assignCustomerToAgent(customer.id, WEBSITE_SALES_ACCOUNT_ID, true);
                            } else {
                              assignCustomerToAgent(customer.id, val === 'unassigned' ? null : val);
                            }
                          }}
                          disabled={assignmentLoading[customer.id]}
                        >
                          <SelectTrigger className="w-[160px] h-8 text-xs">
                            <SelectValue placeholder="Assign agent" />
                          </SelectTrigger>
                          <SelectContent>
                            <SelectItem value="unassigned">Unassigned</SelectItem>
                            <SelectItem value={WEBSITE_SALES_ACCOUNT_ID}>Website</SelectItem>
                            {adminUsers.filter(u => u.id !== WEBSITE_SALES_ACCOUNT_ID && (u.role === 'sales' || u.role === 'sales_lead' || u.role === 'sales_manager' || u.role === 'admin' || u.role === 'super_admin')).map(user => (
                              <SelectItem key={user.id} value={user.id}>
                                {`${user.first_name || ''} ${user.last_name || ''}`.trim() || user.email}
                              </SelectItem>
                            ))}
                          </SelectContent>
                        </Select>
                      </div>
                    </TableCell>
                  <TableCell className="font-medium">
                    <div className="flex items-center space-x-2">
                      <span className={customer.vehicle_make ? 'text-gray-900' : 'text-gray-400'}>
                        {customer.vehicle_make || 'N/A'}
                      </span>
                      {!customer.vehicle_make && (
                        <Badge variant="outline" className="text-xs bg-yellow-50 text-yellow-700 border-yellow-200">
                          Missing
                        </Badge>
                      )}
                      {customer.vehicle_make && (
                        <Badge variant="outline" className="text-xs bg-blue-50 text-blue-700 border-blue-200">
                          DVLA
                        </Badge>
                      )}
                    </div>
                  </TableCell>
                  <TableCell className="font-medium">
                    <div className="flex items-center space-x-2">
                      <span className={customer.vehicle_model ? 'text-gray-900' : 'text-gray-400'}>
                        {customer.vehicle_model || 'N/A'}
                      </span>
                      {!customer.vehicle_model && (
                        <Badge variant="outline" className="text-xs bg-yellow-50 text-yellow-700 border-yellow-200">
                          Missing
                        </Badge>
                      )}
                      {customer.vehicle_model && (
                        <Badge variant="outline" className="text-xs bg-blue-50 text-blue-700 border-blue-200">
                          DVLA
                        </Badge>
                      )}
                    </div>
                  </TableCell>
                  <TableCell className="text-center">
                    <span className={customer.vehicle_year ? 'text-gray-900' : 'text-gray-400'}>
                      {customer.vehicle_year || 'N/A'}
                    </span>
                  </TableCell>
                  <TableCell className="max-w-xs truncate">
                    {customer.street || customer.town || customer.postcode 
                      ? `${customer.street || ''} ${customer.town || ''} ${customer.postcode || ''}`.trim()
                      : 'N/A'
                    }
                  </TableCell>
                   <TableCell>
                     <Badge variant="secondary">{getWarrantyType(customer.plan_type)}</Badge>
                   </TableCell>
                    <TableCell className="text-center">
                      <Badge variant="outline" className="font-mono">
                        {getWarrantyDurationInMonths(customer.payment_type || '')} months
                      </Badge>
                    </TableCell>
                    <TableCell className="text-center">
                      {(() => {
                        const startDate = customer.policy_start_date || customer.customer_policies?.[0]?.policy_start_date || customer.signup_date;
                        const scheduledFor = customer.warranties_2000_scheduled_for;
                        const w2000Status = customer.customer_policies?.[0]?.warranties_2000_status;
                        const isFutureActivation = startDate && new Date(startDate) > new Date();
                        const isScheduled = w2000Status === 'scheduled' && scheduledFor;
                        
                        if (startDate) {
                          return (
                            <div className={`text-sm px-2 py-1 rounded ${
                              isFutureActivation || isScheduled
                                ? 'bg-amber-100 text-amber-800 font-semibold border border-amber-300'
                                : ''
                            }`}>
                              {format(new Date(startDate), 'dd/MM/yyyy')}
                              {(isFutureActivation || isScheduled) && (
                                <div className="text-xs text-amber-600 mt-0.5">
                                  ⏳ Scheduled
                                </div>
                              )}
                            </div>
                          );
                        }
                        return <span className="text-gray-400">N/A</span>;
                      })()}
                    </TableCell>
                    {/* Future Activation Column - moved to name cell */}
                    {/* Upgrade Column */}
                    {!isSalesAgent && (
                    <TableCell className="text-center">
                      <InlineUpgradeCell
                        customerId={customer.id}
                        customerEmail={customer.email}
                        customerName={customer.name}
                        registrationPlate={customer.registration_plate || ''}
                        currentClaimLimit={customer.claim_limit || 1250}
                        currentLabourRate={customer.labour_rate || 70}
                        currentExcess={customer.voluntary_excess || 100}
                        onUpdate={fetchCustomers}
                        tyreCover={customer.tyre_cover}
                        wearTear={customer.wear_tear}
                        europeCover={customer.europe_cover}
                        transferCover={customer.transfer_cover}
                        breakdownRecovery={customer.breakdown_recovery}
                        vehicleRental={customer.vehicle_rental}
                        motFee={customer.mot_fee}
                        motRepair={customer.mot_repair}
                        lostKey={customer.lost_key}
                        consequential={customer.consequential}
                      />
                    </TableCell>
                    )}
                    <TableCell className="text-center">
                      {customer.customer_policies?.[0]?.policy_start_date || customer.signup_date ? (
                        <div className="text-sm">
                          {format(
                            calculateExpiryDate(
                              customer.customer_policies?.[0]?.policy_start_date || customer.signup_date,
                              customer.payment_type || ''
                           ), 
                           'dd/MM/yyyy'
                         )}
                       </div>
                     ) : (
                       <span className="text-gray-400">N/A</span>
                     )}
                   </TableCell>
                     <TableCell>
                       <div className="flex flex-col gap-1">
                         <div className="flex items-center gap-1">
                           <Badge variant={customer.is_manual_entry ? 'secondary' : 'outline'}>
                             {customer.is_manual_entry ? 'Manual' :
                              customer.bumper_order_id ? 'Bumper' : 
                              customer.stripe_session_id ? 'Stripe' : 'N/A'}
                           </Badge>
                           {customer.payment_verified ? (
                             <span className="text-green-600" title="Payment verified">✓</span>
                           ) : customer.is_manual_entry ? (
                             <span className="text-amber-500" title="Manual entry - no payment record">⚠</span>
                           ) : (
                             <span className="text-red-500" title="Payment not verified">✗</span>
                           )}
                         </div>
                         {customer.final_amount && customer.final_amount > 0 && (normalizedRole === 'super_admin' || normalizedRole === 'admin' || normalizedRole === 'accounts' || normalizedRole === 'accounts_manager') && (
                            <span className="text-xs font-medium text-green-700">
                              £{customer.final_amount.toFixed(2)}
                            </span>
                          )}
                       </div>
                     </TableCell>
                     {/* Purchase Source */}
                     <TableCell className="bg-purple-50/30">
                       <PurchaseSourceBadge 
                         source={customer.purchase_source} 
                         bumperOrderId={customer.bumper_order_id}
                         stripeSessionId={customer.stripe_session_id}
                       />
                     </TableCell>
                       <TableCell>
                         <div className="flex items-center gap-1">
                           {isSalesAgent ? (
                             <span className="text-sm">£{customer.voluntary_excess || 100}</span>
                           ) : (
                           <>
                           <InlineWarrantyUpgrade
                             customerId={customer.id}
                             customerEmail={customer.email}
                             customerName={customer.name}
                             registrationPlate={customer.registration_plate}
                             field="excess"
                             currentValue={customer.voluntary_excess || 100}
                             onUpdate={fetchCustomers}
                           />
                           {customer.manual_upgrade_at && (
                             <span title="Manually upgraded"><Sparkles className="h-3 w-3 text-amber-500" /></span>
                           )}
                           </>
                           )}
                         </div>
                       </TableCell>
                        <TableCell>
                          <div className="flex items-center gap-1">
                            {isSalesAgent ? (
                              <span className="text-sm">£{(customer.customer_policies?.[0] as any)?.claim_limit || customer.claim_limit || 1250}</span>
                            ) : (
                            <>
                            <InlineWarrantyUpgrade
                              customerId={customer.id}
                              customerEmail={customer.email}
                              customerName={customer.name}
                              registrationPlate={customer.registration_plate}
                              field="claim_limit"
                              currentValue={(customer.customer_policies?.[0] as any)?.claim_limit || customer.claim_limit || 1250}
                              onUpdate={fetchCustomers}
                            />
                            {customer.manual_upgrade_at && (
                              <span title="Manually upgraded"><Sparkles className="h-3 w-3 text-amber-500" /></span>
                            )}
                            </>
                            )}
                         </div>
                       </TableCell>
                       <TableCell>
                         <CustomerClaimsSummary
                           customerEmail={customer.email}
                           customerName={customer.name}
                           vehicleReg={customer.registration_plate}
                           showOnly="claimsMade"
                         />
                       </TableCell>
                       <TableCell>
                         <CustomerClaimsSummary
                           customerEmail={customer.email}
                           vehicleReg={customer.registration_plate}
                           showOnly="claimsPaid"
                         />
                       </TableCell>
                       <TableCell className="text-center">
                         <DropdownMenu>
                           <DropdownMenuTrigger asChild>
                             <Button variant="ghost" size="sm" className="h-7 px-2">
                               {customer.trustpilot_review_completed ? (
                                 <Badge className="bg-green-500 hover:bg-green-600 cursor-pointer">
                                   <CheckCircle className="h-3 w-3 mr-1" />Done
                                 </Badge>
                               ) : customer.trustpilot_review_requested ? (
                                 <Badge variant="outline" className="border-yellow-500 text-yellow-600 cursor-pointer">
                                   <Clock className="h-3 w-3 mr-1" />Sent
                                 </Badge>
                               ) : (
                                 <span className="text-muted-foreground text-xs hover:text-foreground cursor-pointer">+ Add</span>
                               )}
                             </Button>
                           </DropdownMenuTrigger>
                           <DropdownMenuContent align="center">
                             <DropdownMenuItem 
                               onClick={() => setTrustpilotReviewCustomer(customer)}
                               className="text-[#00b67a]"
                             >
                               <Star className="h-4 w-4 mr-2 fill-[#00b67a]" />
                               Send Review Request
                             </DropdownMenuItem>
                             <DropdownMenuItem 
                               onClick={() => updateReviewStatus(customer.id, 'trustpilot_review_requested', !customer.trustpilot_review_requested)}
                             >
                               <Clock className="h-4 w-4 mr-2" />
                               {customer.trustpilot_review_requested ? 'Unmark Requested' : 'Mark as Requested'}
                             </DropdownMenuItem>
                             <DropdownMenuItem 
                               onClick={() => updateReviewStatus(customer.id, 'trustpilot_review_completed', !customer.trustpilot_review_completed)}
                             >
                               <CheckCircle className="h-4 w-4 mr-2" />
                               {customer.trustpilot_review_completed ? 'Unmark Completed' : 'Mark Review Received'}
                             </DropdownMenuItem>
                           </DropdownMenuContent>
                         </DropdownMenu>
                       </TableCell>
                       <TableCell className="text-center">
                         <DropdownMenu>
                           <DropdownMenuTrigger asChild>
                             <Button variant="ghost" size="sm" className="h-7 px-2">
                               {customer.google_review_completed ? (
                                 <Badge className="bg-green-500 hover:bg-green-600 cursor-pointer">
                                   <CheckCircle className="h-3 w-3 mr-1" />Done
                                 </Badge>
                               ) : customer.google_review_requested ? (
                                 <Badge variant="outline" className="border-yellow-500 text-yellow-600 cursor-pointer">
                                   <Clock className="h-3 w-3 mr-1" />Sent
                                 </Badge>
                               ) : (
                                 <span className="text-muted-foreground text-xs hover:text-foreground cursor-pointer">+ Add</span>
                               )}
                             </Button>
                           </DropdownMenuTrigger>
                           <DropdownMenuContent align="center">
                             <DropdownMenuItem 
                               onClick={() => updateReviewStatus(customer.id, 'google_review_requested', !customer.google_review_requested)}
                             >
                               <Clock className="h-4 w-4 mr-2" />
                               {customer.google_review_requested ? 'Unmark Requested' : 'Mark as Requested'}
                             </DropdownMenuItem>
                             <DropdownMenuItem 
                               onClick={() => updateReviewStatus(customer.id, 'google_review_completed', !customer.google_review_completed)}
                             >
                               <CheckCircle className="h-4 w-4 mr-2" />
                               {customer.google_review_completed ? 'Unmark Completed' : 'Mark Review Received'}
                             </DropdownMenuItem>
                           </DropdownMenuContent>
                         </DropdownMenu>
                       </TableCell>
                       <TableCell>
                         <div className="flex items-center gap-1">
                           <InlineWarrantyUpgrade
                             customerId={customer.id}
                             customerEmail={customer.email}
                             customerName={customer.name}
                             registrationPlate={customer.registration_plate}
                             field="labour_rate"
                             currentValue={customer.labour_rate || 70}
                             onUpdate={fetchCustomers}
                           />
                           {customer.manual_upgrade_at && (
                             <span title="Manually upgraded"><Sparkles className="h-3 w-3 text-amber-500" /></span>
                           )}
                          </div>
                        </TableCell>
                       <TableCell className="text-center">
                         {customer.mileage || 'N/A'}
                       </TableCell>
                       <TableCell>
                         <CustomerTagsDisplay customerId={customer.id} maxVisible={2} />
                       </TableCell>
                    <TableCell>
                     <div className="flex space-x-2">
                        {/* DVLA Vehicle Data Refresh */}
                        <Button
                          variant="ghost"
                          size="sm"
                          onClick={() => refreshVehicleDataFromDVLA(customer.id, customer.registration_plate)}
                          disabled={dvlaLookupLoading[customer.id] || !customer.registration_plate}
                          title="Refresh Vehicle Data from DVLA"
                          className="hover:bg-green-50 hover:text-green-600"
                        >
                          {dvlaLookupLoading[customer.id] ? (
                            <div className="animate-spin rounded-full h-4 w-4 border-b-2 border-green-600"></div>
                          ) : (
                            <RefreshCw className="h-4 w-4" />
                          )}
                        </Button>


                        {canDeleteCustomers() && (
                          <DropdownMenu>
                            <DropdownMenuTrigger asChild>
                              <Button
                                variant="ghost"
                                size="sm"
                                className="text-orange-600 hover:text-orange-800 hover:bg-orange-50"
                                title="Archive Customer"
                              >
                                <Archive className="h-4 w-4" />
                              </Button>
                            </DropdownMenuTrigger>
                            <DropdownMenuContent align="end">
                              <DropdownMenuItem 
                                onClick={() => {
                                  setArchiveCustomers([{
                                    id: customer.id,
                                    name: customer.name,
                                    email: customer.email,
                                    policy_id: customer.customer_policies?.[0]?.id,
                                    policy_number: customer.customer_policies?.[0]?.policy_number,
                                    user_id: customer.customer_policies?.[0]?.user_id,
                                    customer_id: customer.id
                                  }]);
                                  setArchiveDialogOpen(true);
                                }}
                                className="text-red-600"
                              >
                                <Ban className="h-4 w-4 mr-2" />
                                Cancel Warranty
                              </DropdownMenuItem>
                              <DropdownMenuItem 
                                onClick={() => {
                                  setArchiveCustomers([{
                                    id: customer.id,
                                    name: customer.name,
                                    email: customer.email,
                                    policy_id: customer.customer_policies?.[0]?.id,
                                    policy_number: customer.customer_policies?.[0]?.policy_number,
                                    user_id: customer.customer_policies?.[0]?.user_id,
                                    customer_id: customer.id
                                  }]);
                                  setArchiveDialogOpen(true);
                                }}
                                className="text-amber-600"
                              >
                                <PoundSterling className="h-4 w-4 mr-2" />
                                Mark as Refunded
                              </DropdownMenuItem>
                              <DropdownMenuItem 
                                onClick={() => {
                                  setArchiveCustomers([{
                                    id: customer.id,
                                    name: customer.name,
                                    email: customer.email,
                                    policy_id: customer.customer_policies?.[0]?.id,
                                    policy_number: customer.customer_policies?.[0]?.policy_number,
                                    user_id: customer.customer_policies?.[0]?.user_id,
                                    customer_id: customer.id
                                  }]);
                                  setArchiveDialogOpen(true);
                                }}
                                className="text-gray-600"
                              >
                                <Archive className="h-4 w-4 mr-2" />
                                Archive (Hide)
                              </DropdownMenuItem>
                              <DropdownMenuItem 
                                onClick={() => quickArchiveAsTestOrFake(new Set([customer.id]), 'test')}
                                className="text-purple-600"
                              >
                                <FlaskConical className="h-4 w-4 mr-2" />
                                Mark as Test
                              </DropdownMenuItem>
                              <DropdownMenuItem 
                                onClick={() => quickArchiveAsTestOrFake(new Set([customer.id]), 'fake')}
                                className="text-orange-600"
                              >
                                <UserMinus className="h-4 w-4 mr-2" />
                                Mark as Fake Lead
                              </DropdownMenuItem>
                              <DropdownMenuItem 
                                onClick={() => quickArchiveAsTestOrFake(new Set([customer.id]), 'duplicate')}
                                className="text-blue-600"
                              >
                                <Copy className="h-4 w-4 mr-2" />
                                Mark as Duplicate
                              </DropdownMenuItem>
                              {isDuplicate(customer.registration_plate) && (
                                <DropdownMenuItem
                                  onClick={() => openMergeForReg(customer.registration_plate)}
                                  className="text-blue-600 font-medium"
                                >
                                  <GitMerge className="h-4 w-4 mr-2" />
                                  Merge Duplicate
                                </DropdownMenuItem>
                              )}
                            </DropdownMenuContent>
                          </DropdownMenu>
                        )}
                       
                       <Button
                        variant="ghost"
                        size="sm"
                        onClick={() => resetCustomerPassword(customer.id, customer.email)}
                        disabled={passwordResetLoading[customer.id]}
                        title="Generate New Password"
                        className="hover:bg-orange-50 hover:text-orange-600"
                      >
                        {passwordResetLoading[customer.id] ? (
                          <div className="animate-spin rounded-full h-4 w-4 border-b-2 border-orange-600"></div>
                        ) : (
                          <Key className="h-4 w-4" />
                        )}
                      </Button>

                      <RemindMePopover leadId={`customer_${customer.id}`} />
                       
                       
                    </div>
                  </TableCell>
                </TableRow>
              ))
            )}
          </TableBody>
        </Table>
          </div>
        </div>
        <PaginationControls
          currentPage={customersPagination.currentPage}
          totalPages={customersPagination.totalPages}
          totalItems={customersPagination.totalItems}
          startIndex={customersPagination.startIndex}
          endIndex={customersPagination.endIndex}
          pageSize={customersPagination.pageSize}
          onPageChange={customersPagination.goToPage}
          onPageSizeChange={customersPagination.setPageSize}
          canGoNext={customersPagination.canGoNext}
          canGoPrev={customersPagination.canGoPrev}
        />
        </TabsContent>

        <TabsContent value="cancellations" className="space-y-4">
          <CancellationsTab adminUsers={adminUsers} currentAdminUser={currentAdminUser} />
        </TabsContent>

        <TabsContent value="deleted" className="space-y-4">
          {/* Info Banner for Deleted Orders */}
          <div className="bg-amber-50 border border-amber-200 rounded-lg p-4">
            <div className="flex items-start space-x-3">
              <Archive className="h-5 w-5 text-amber-600 mt-0.5" />
              <div>
                <h3 className="font-semibold text-amber-900 mb-1">Order Archive</h3>
                <p className="text-sm text-amber-700">
                  These orders have been deleted but can be restored anytime. Orders remain in the archive until permanently removed.
                </p>
              </div>
            </div>
          </div>

          {/* Search */}
          <div className="bg-white p-4 rounded-lg border">
            <div className="relative max-w-md">
              <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 h-4 w-4 text-gray-400" />
              <Input
                placeholder="Search deleted orders by any details..."
                value={deletedSearchTerm}
                onChange={(e) => {
                  setDeletedSearchTerm(e.target.value);
                  const searchLower = e.target.value.toLowerCase();
                  const filtered = deletedCustomers.filter(customer =>
                    // Basic info
                    customer.name?.toLowerCase().includes(searchLower) ||
                    customer.email?.toLowerCase().includes(searchLower) ||
                    customer.first_name?.toLowerCase().includes(searchLower) ||
                    customer.last_name?.toLowerCase().includes(searchLower) ||
                    customer.phone?.toLowerCase().includes(searchLower) ||
                    
                    // Vehicle info
                    customer.registration_plate?.toLowerCase().includes(searchLower) ||
                    customer.vehicle_make?.toLowerCase().includes(searchLower) ||
                    customer.vehicle_model?.toLowerCase().includes(searchLower) ||
                    customer.vehicle_year?.toLowerCase().includes(searchLower) ||
                    
                    // Warranty info
                    customer.warranty_reference_number?.toLowerCase().includes(searchLower) ||
                    customer.warranty_number?.toLowerCase().includes(searchLower) ||
                    customer.plan_type?.toLowerCase().includes(searchLower) ||
                    
                    // Policy numbers
                    customer.customer_policies?.some(policy => 
                      policy.policy_number?.toLowerCase().includes(searchLower) ||
                      policy.warranty_number?.toLowerCase().includes(searchLower)
                    )
                  );
                  setFilteredDeletedCustomers(filtered);
                }}
                className="pl-10"
              />
            </div>
          </div>

          {deletedLoading ? (
            <div className="flex justify-center items-center h-64">
              <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-orange-600"></div>
              <span className="ml-2">Loading archived orders...</span>
            </div>
          ) : filteredDeletedCustomers.length === 0 ? (
            <div className="bg-white rounded-lg shadow p-8">
              <div className="text-center space-y-4">
                <Archive className="h-12 w-12 text-gray-400 mx-auto" />
                <div>
                  <p className="text-gray-500 text-lg">No archived orders</p>
                  <p className="text-gray-400 text-sm mt-2">
                    {deletedSearchTerm ? 'No orders match your search' : 'Deleted orders will appear here'}
                  </p>
                </div>
              </div>
            </div>
          ) : (
            <div className="bg-white rounded-lg shadow overflow-hidden">
              <div className="overflow-x-auto">
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead>Name</TableHead>
                      <TableHead>Email</TableHead>
                      <TableHead>Registration</TableHead>
                      <TableHead>Plan Type</TableHead>
                      <TableHead>Deleted Date</TableHead>
                      <TableHead>Deleted By</TableHead>
                      <TableHead>Actions</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {filteredDeletedCustomers.map((customer) => (
                      <TableRow key={customer.id} className="bg-gray-50">
                        <TableCell className="font-medium">{customer.name}</TableCell>
                        <TableCell>{customer.email}</TableCell>
                        <TableCell>
                          <NumberPlate plateNumber={customer.registration_plate} />
                        </TableCell>
                        <TableCell>
                          <Badge variant="secondary">{customer.plan_type}</Badge>
                        </TableCell>
                        <TableCell>
                          {customer.deleted_at ? format(new Date(customer.deleted_at), 'dd/MM/yyyy HH:mm') : 'N/A'}
                        </TableCell>
                        <TableCell>
                          {customer.admin_users ? (
                            <span className="text-sm">
                              {customer.admin_users.first_name} {customer.admin_users.last_name}
                            </span>
                          ) : (
                            <span className="text-gray-400 text-sm">System</span>
                          )}
                        </TableCell>
                        <TableCell>
                          <Button
                            variant="outline"
                            size="sm"
                            onClick={() => restoreCustomer(customer.id, customer.name)}
                            disabled={restoreLoading[customer.id]}
                            className="text-green-600 hover:text-green-700 hover:bg-green-50"
                          >
                            {restoreLoading[customer.id] ? (
                              <div className="animate-spin rounded-full h-3 w-3 border-b-2 border-green-600 mr-2"></div>
                            ) : (
                              <RotateCcw className="h-3 w-3 mr-2" />
                            )}
                            Restore
                          </Button>
                        </TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
              </div>
            </div>
          )}
        </TabsContent>

      </Tabs>

      {/* Cancel Warranty Dialog */}
      <CancelWarrantyDialog
        isOpen={cancelWarrantyDialog.isOpen}
        onClose={() => setCancelWarrantyDialog({ isOpen: false, policy: null })}
        policy={cancelWarrantyDialog.policy || { id: '', email: '' }}
        customerName={cancelWarrantyDialog.customerName}
        onSuccess={fetchCustomers}
      />

      {/* Archive Customer Dialog */}
      <ArchiveCustomerDialog
        isOpen={archiveDialogOpen}
        onClose={() => {
          setArchiveDialogOpen(false);
          setArchiveCustomers([]);
        }}
        customers={archiveCustomers}
        onSuccess={() => {
          fetchCustomers();
          fetchDeletedCustomers();
          setSelectedCustomers(new Set());
        }}
      />

      {/* Merge Duplicate Dialog */}
      <MergeDuplicateDialog
        isOpen={mergeDialogOpen}
        onClose={() => {
          setMergeDialogOpen(false);
          setMergeDuplicates([]);
        }}
        duplicates={mergeDuplicates}
        onSuccess={() => {
          fetchCustomers();
          fetchDeletedCustomers();
        }}
      />

      {/* Manual Warranty Upgrade Dialog */}
      {upgradeCustomer && (
        <WarrantyUpgradeDialog
          open={upgradeDialogOpen}
          onOpenChange={setUpgradeDialogOpen}
          customerId={upgradeCustomer.id}
          customerEmail={upgradeCustomer.email}
          customerName={upgradeCustomer.name}
          registrationPlate={upgradeCustomer.registration_plate || ''}
          currentClaimLimit={upgradeCustomer.claim_limit || 1250}
          currentLabourRate={upgradeCustomer.labour_rate || 70}
          currentExcess={upgradeCustomer.voluntary_excess || 100}
          onUpgradeComplete={() => {
            fetchCustomers();
            setUpgradeCustomer(null);
          }}
        />
      )}

      {/* Trustpilot Review Request Dialog */}
      {trustpilotReviewCustomer && (
        <TrustpilotReviewDialog
          open={!!trustpilotReviewCustomer}
          onOpenChange={(open) => {
            if (!open) {
              setTrustpilotReviewCustomer(null);
              // Refresh customers to update the status
              fetchCustomers();
            }
          }}
          customerId={trustpilotReviewCustomer.id}
          customerName={trustpilotReviewCustomer.name}
          customerEmail={trustpilotReviewCustomer.email}
          customerFirstName={trustpilotReviewCustomer.first_name}
          alreadyRequested={trustpilotReviewCustomer.trustpilot_review_requested}
          requestedAt={trustpilotReviewCustomer.trustpilot_review_requested_at}
        />
      )}

      {/* Print Warranty Letter Dialog */}
      {editingCustomer && (
        <PrintableWarrantyLetter
          open={isPrintLetterOpen}
          onOpenChange={setIsPrintLetterOpen}
          policy={{
            customerName: editingCustomer.name || '',
            customerEmail: editingCustomer.email,
            customerAddress: {
              flatNumber: editingCustomer.flat_number || undefined,
              buildingName: editingCustomer.building_name || undefined,
              buildingNumber: editingCustomer.building_number || undefined,
              street: editingCustomer.street || undefined,
              town: editingCustomer.town || undefined,
              county: editingCustomer.county || undefined,
              postcode: editingCustomer.postcode || undefined,
            },
            vehicleReg: editingCustomer.registration_plate || '',
            vehicleMake: editingCustomer.vehicle_make || undefined,
            vehicleModel: editingCustomer.vehicle_model || undefined,
            vehicleYear: editingCustomer.vehicle_year || undefined,
            mileage: editingCustomer.mileage || undefined,
            warrantyNumber: editingCustomer.customer_policies?.[0]?.warranty_number || editingCustomer.warranty_number || '',
            policyNumber: editingCustomer.customer_policies?.[0]?.policy_number || '',
            planType: editingCustomer.plan_type || '',
            policyStartDate: editingCustomer.customer_policies?.[0]?.policy_start_date || editingCustomer.signup_date || '',
            policyEndDate: editingCustomer.customer_policies?.[0]?.policy_end_date || '',
            claimLimit: editingCustomer.claim_limit || undefined,
            voluntaryExcess: editingCustomer.voluntary_excess ?? undefined,
            labourRate: editingCustomer.labour_rate || undefined,
            breakdownRecovery: editingCustomer.breakdown_recovery || false,
            wearTear: editingCustomer.wear_tear || false,
            europeCover: editingCustomer.europe_cover || false,
            motFee: editingCustomer.mot_fee || false,
            motRepair: editingCustomer.mot_repair || false,
            tyreCover: editingCustomer.tyre_cover || false,
            lostKey: editingCustomer.lost_key || false,
            vehicleRental: editingCustomer.vehicle_rental || false,
            transferCover: editingCustomer.transfer_cover || false,
            consequential: editingCustomer.consequential || false,
            seasonalBonusMonths: editingCustomer.customer_policies?.[0]?.seasonal_bonus_months ?? (editingCustomer as any).seasonal_bonus_months ?? undefined,
            additionalNotes: editingCustomer.customer_policies?.[0]?.additional_notes || undefined,
          }}
        />
      )}
    </div>
  );
};
