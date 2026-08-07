import React, { useState, useEffect, useMemo, useCallback, useRef } from 'react';
import { AdminNotificationBell } from '@/components/admin/AdminNotificationBell';
import { AdminNotification } from '@/hooks/useAdminNotifications';
import { useSearchParams } from 'react-router-dom';
import { supabase } from '@/integrations/supabase/client';
import FreeMonthsOptions, { bonusMonthsForOption, type FreeCoverOption } from './quote/FreeMonthsOptions';
import { useCurrentAdminId } from '@/hooks/useCurrentAdminId';
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
import { Edit, Download, Search, RefreshCw, AlertCircle, CalendarIcon, Save, Key, Send, Clock, CheckCircle, Trash2, UserX, Phone, Mail, RotateCcw, Archive, ChevronDown, ChevronUp, Eye, EyeOff, Copy, CopyPlus, FileText, User, Sparkles, FileSpreadsheet, Star, Ban, PoundSterling, FlaskConical, UserMinus, Printer, GitMerge, Trophy, Heart, X, ArrowUp, ArrowDown, ArrowUpDown } from 'lucide-react';
import UnsubscribeQuickLink from '@/components/admin/UnsubscribeQuickLink';
import { CommissionClaimedBadge } from './CommissionClaimedBadge';
import { Checkbox } from '@/components/ui/checkbox';
import { Collapsible, CollapsibleContent, CollapsibleTrigger } from '@/components/ui/collapsible';
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuTrigger, DropdownMenuSub, DropdownMenuSubTrigger, DropdownMenuSubContent, DropdownMenuSeparator } from '@/components/ui/dropdown-menu';
import { usePermissions } from '@/hooks/usePermissions';
import { useDataExport } from '@/hooks/useDataExport';
import { useDebounce } from '@/hooks/useDebounce';
import { usePagination } from '@/hooks/usePagination';
import { PaginationControls } from '@/components/ui/pagination-controls';

import { CustomerNotesSection } from './CustomerNotesSection';
import { SmartDateInput } from './SmartDateInput';
import { StructuredNotesSection } from './StructuredNotesSection';
import { CustomerServiceNotes } from './CustomerServiceNotes';
import { WarrantyActions } from './WarrantyActions';
import { PriceComparisonProofCell } from './customers/PriceComparisonProofCell';

import { EditOrderButton } from './EditOrderButton';
import { MOTHistorySection } from './MOTHistorySection';
import { PartPaymentsPanel } from './customers/PartPaymentsPanel';
import { PartPaymentRemindersBanner } from './customers/PartPaymentRemindersBanner';

import { W2000DataPreview } from './W2000DataPreview';
import { SendNotificationDialog } from './SendNotificationDialog';
import { RecentEmailsDialog } from './RecentEmailsDialog';
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
import { QuickMonthFilter } from './QuickMonthFilter';
import { QuickWeekFilter } from './QuickWeekFilter';
import { UnifiedDateFilter, periodToRange, type DateScope, type PeriodKey } from './UnifiedDateFilter';
import { QuickCustomerSignupButton } from './QuickCustomerSignupButton';
import { AddClaimDialog } from './claims/AddClaimDialog';
import { format } from 'date-fns';
import { DateRange } from 'react-day-picker';
import { cn } from '@/lib/utils';
import { getWarrantyDurationInMonths } from '@/lib/warrantyDurationUtils';
import { ToggleGroup, ToggleGroupItem } from '@/components/ui/toggle-group';
import { WEBSITE_SALES_ACCOUNT_ID } from '@/constants/salesDefaults';
import { useViewAs } from '@/contexts/ViewAsContext';
import { CustomersMobileCards } from './customers/CustomersMobileCards';
import { isNorthernIrelandPlate } from '@/lib/niPlate';

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

// Time from the lead arriving (sales_leads.created_at) to the sale completing
// (customers.signup_date). Used to track round-robin sales conversion speed.
function formatTimeToLead(leadDate?: string | null, saleDate?: string | null): string | null {
  if (!leadDate || !saleDate) return null;
  const lead = new Date(leadDate).getTime();
  const sale = new Date(saleDate).getTime();
  if (!Number.isFinite(lead) || !Number.isFinite(sale)) return null;
  const mins = Math.round((sale - lead) / 60000);
  if (mins < 0) return null;
  if (mins < 60) return `${mins}m`;
  if (mins < 1440) {
    const h = Math.floor(mins / 60);
    const m = mins % 60;
    return m ? `${h}h ${m}m` : `${h}h`;
  }
  const days = Math.floor(mins / 1440);
  const hrs = Math.floor((mins % 1440) / 60);
  return hrs ? `${days}d ${hrs}h` : `${days}d`;
}

/** Returns time-to-lead in minutes, or null when unavailable. */
function getTimeToLeadMinutes(leadDate?: string | null, saleDate?: string | null): number | null {
  if (!leadDate || !saleDate) return null;
  const lead = new Date(leadDate).getTime();
  const sale = new Date(saleDate).getTime();
  if (!Number.isFinite(lead) || !Number.isFinite(sale)) return null;
  const mins = Math.round((sale - lead) / 60000);
  return mins >= 0 ? mins : null;
}




interface Customer {
  id: string;
  device_type?: string | null;
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
  // Purchase source tracking (payment method)
  purchase_source?: string | null;
  // Acquisition source (marketing channel: google_ads / facebook_ads / website)
  acquisition_source?: string | null;
  // Free-text customer contact notes (shown in Customer Management Notes column)
  contact_notes?: string | null;
  gclid?: string | null;
  utm_source?: string | null;
  utm_medium?: string | null;
  utm_campaign?: string | null;
  utm_term?: string | null;
  utm_content?: string | null;
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

const getCustomerAcquisitionChannel = (
  customer: Pick<Customer, 'acquisition_source' | 'gclid' | 'utm_source' | 'purchase_source'> & { is_manual_entry?: boolean | null }
) => {
  const source = (customer.acquisition_source || '').trim().toLowerCase();
  const utm = (customer.utm_source || '').trim().toLowerCase();
  const purchaseSrc = (customer.purchase_source || '').trim().toLowerCase();
  const hasGclid = !!customer.gclid?.trim();

  // Google: ANY Google signal counts as Google — gclid, normalised source, utm_source,
  // or purchase_source. This ensures phone sales from Google ads are included
  // in the "Google all" filter even when the agent closed the deal.
  if (
    hasGclid ||
    source.includes('google') ||
    source === 'adwords' || source === 'g' ||
    utm.includes('google') || utm === 'adwords' ||
    purchaseSrc === 'google_ads'
  ) return 'google_ads';

  if (
    source.includes('facebook') || source.includes('meta') || source.includes('instagram') ||
    ['facebook_ads', 'social_ad', 'facebook', 'meta', 'fb', 'f', 'instagram', 'ig'].includes(source) ||
    utm.includes('facebook') || utm.includes('meta') || utm.includes('instagram') ||
    utm === 'fb' || utm === 'ig' ||
    purchaseSrc === 'facebook_ads'
  ) return 'facebook_ads';

  if (['website', 'organic', 'direct', 'website_organic'].includes(source)) return 'website';

  // Website purchase with no recoverable marketing attribution -> Direct/Website
  if (customer.is_manual_entry !== true) {
    const websitePurchaseSources = ['stripe', 'payment_assist', 'bumper', 'bumper_portal', 'paypal', 'website', ''];
    if (websitePurchaseSources.includes(purchaseSrc)) return 'website';
  }

  // Manual back-office sale with no recoverable marketing source
  if (customer.is_manual_entry === true) return 'manual';

  return source || 'unknown';
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
  const [claimEmails, setClaimEmails] = useState<Set<string>>(new Set());
  const [claimRegs, setClaimRegs] = useState<Set<string>>(new Set());
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
  // 'desc' = slowest (longest) first, 'asc' = fastest (shortest) first, null = inactive
  const [timeToLeadSort, setTimeToLeadSort] = useState<'desc' | 'asc' | null>(null);
  const [initialContactSort, setInitialContactSort] = useState<'desc' | 'asc' | null>(null);
  const [filterByPlan, setFilterByPlan] = useState('all');
  const [filterByStatus, setFilterByStatus] = useState('all');
  const [filterByTag, setFilterByTag] = useState('all');
  const [filterBySource, setFilterBySource] = useState('all_view'); // Default to All View
  const [filterByWarrantyPeriod, setFilterByWarrantyPeriod] = useState('all');
  const [filterByPaymentSource, setFilterByPaymentSource] = useState('all'); // all | bumper | stripe | payment_assist
  const [paymentSourceDateFilter, setPaymentSourceDateFilter] = useState('all');
  const [filterByAgent, setFilterByAgent] = useState('all');
  const [dateRange, setDateRange] = useState<DateRange | undefined>(() => {
    const today = new Date();
    return { from: today, to: today };
  });
  const [availableTags, setAvailableTags] = useState<any[]>([]);
  const [selectedCustomer, setSelectedCustomer] = useState<Customer | null>(null);
  const [editingCustomer, setEditingCustomer] = useState<Customer | null>(null);
  const currentAdminIdForConcessions = useCurrentAdminId();
  const [savingPassword, setSavingPassword] = useState(false);

  // ── Part payment plans (read-only summary used for row tags + filtering) ──────
  const [filterByPartPayment, setFilterByPartPayment] = useState<'all' | 'has' | 'outstanding' | 'completed'>('all');
  const [partPaymentPlans, setPartPaymentPlans] = useState<Map<string, {
    total_due: number; status: string; next_due_date: string | null; paid: number;
  }>>(new Map());

  useEffect(() => {
    let cancelled = false;
    const loadPartPayments = async () => {
      const [{ data: plans }, { data: payments }] = await Promise.all([
        supabase
          .from('customer_part_payment_plans')
          .select('customer_id, total_due, status, next_due_date'),
        supabase
          .from('customer_part_payments')
          .select('customer_id, amount'),
      ]);
      if (cancelled) return;
      const paidById = new Map<string, number>();
      (payments ?? []).forEach((p: any) => {
        paidById.set(p.customer_id, (paidById.get(p.customer_id) ?? 0) + Number(p.amount || 0));
      });
      const map = new Map<string, { total_due: number; status: string; next_due_date: string | null; paid: number }>();
      (plans ?? []).forEach((p: any) => {
        map.set(p.customer_id, {
          total_due: Number(p.total_due || 0),
          status: p.status,
          next_due_date: p.next_due_date,
          paid: paidById.get(p.customer_id) ?? 0,
        });
      });
      setPartPaymentPlans(map);
    };
    loadPartPayments();
    return () => { cancelled = true; };
  }, []);

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
  const [sendingApology, setSendingApology] = useState(false);
  const [credentialsExpanded, setCredentialsExpanded] = useState(false);
  const [credentialsPreview, setCredentialsPreview] = useState<{
    open: boolean;
    mode: 'normal' | 'apology';
    subject: string;
    body: string;
    email: string;
  }>({ open: false, mode: 'normal', subject: '', body: '', email: '' });

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
  const [addClaimCustomer, setAddClaimCustomer] = useState<Customer | null>(null);
  const [archiveDialogOpen, setArchiveDialogOpen] = useState(false);
  const [archiveSimpleConfirm, setArchiveSimpleConfirm] = useState(false);
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
  // Unified date filter UI state
  const [unifiedScope, setUnifiedScope] = useState<DateScope>('signup');
  const [unifiedPeriod, setUnifiedPeriod] = useState<PeriodKey>('today');
  const [unifiedCustomRange, setUnifiedCustomRange] = useState<DateRange | undefined>(undefined);
  const [agentDealCounts, setAgentDealCounts] = useState<Record<string, { sales: number; cancelled: number }>>({});
  const [showPurchaseSource, setShowPurchaseSource] = useState(false);
  const [showPaymentColumn, setShowPaymentColumn] = useState(false);
  const PENDING_DISMISS_KEY = 'pendingPaymentBannerDismissedCount';
  const [pendingDismissedCount, setPendingDismissedCount] = useState<number>(() => {
    if (typeof window === 'undefined') return 0;
    const raw = window.localStorage.getItem(PENDING_DISMISS_KEY);
    const n = raw ? parseInt(raw, 10) : 0;
    return Number.isFinite(n) ? n : 0;
  });

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
  const isAdmin = normalizedRole === 'admin';
  const isLeadGen = normalizedRole === 'lead_gen';
  const isClaimsManager = normalizedRole === 'claims_manager';
  // See Source column — granular permission with role-based defaults
  // (super_admin, admin, lead_gen ON by default; togglable per user)
  const seeSourceGranular = hasGranularPermission('customers', 'see-source');
  const seeSourceDefault = isSuperAdmin || normalizedRole === 'admin' || normalizedRole === 'lead_gen';
  const canSeeSourceColumn = seeSourceGranular === undefined ? seeSourceDefault : seeSourceGranular;
  const isSalesAgent = normalizedRole === 'sales';
  const isSalesLead = normalizedRole === 'sales_lead';
  const isSalesScopedRole = isSalesAgent || isSalesLead;
  // Google Ads-style date filter visible only for these roles
  const canUseDateFilter = isSuperAdmin || isAdmin || isLeadGen || isClaimsManager || isSalesScopedRole;

  // Payment + SRC column visibility — managers, digital@, accounts@ only.
  // Sales / sales_lead can never see or toggle these columns.
  const adminEmail = (currentAdminUser?.email || '').trim().toLowerCase();
  const isAccountsManager = normalizedRole === 'accounts_manager' || normalizedRole === 'accounts';
  const isSalesManager = normalizedRole === 'sales_manager';
  const isDigitalOrAccountsMailbox =
    adminEmail.startsWith('digital@') || adminEmail.startsWith('accounts@');
  const canToggleHColumns =
    !isSalesScopedRole &&
    (isSuperAdmin || isAdmin || isLeadGen || isSalesManager || isAccountsManager || isDigitalOrAccountsMailbox);

  // Track whether role has been determined to prevent flash of unrestricted UI
  const isRoleLoaded = !!currentAdminUser;

  // Default the H (Payment + SRC) columns ON for users who are allowed to see them.
  // Applied once when the role first resolves so manual toggling still works.
  const hDefaultsAppliedRef = React.useRef(false);
  useEffect(() => {
    if (!hDefaultsAppliedRef.current && currentAdminUser && canToggleHColumns) {
      setShowPaymentColumn(true);
      setShowPurchaseSource(true);
      hDefaultsAppliedRef.current = true;
    }
  }, [currentAdminUser, canToggleHColumns]);

  const filteredRevenueStats = useMemo(() => {
    if (!isSuperAdmin) return null;
    // Use filteredCustomers which already respects status, agent, source, tag, and other filters
    let base = [...filteredCustomers];
    // Only exclude cancelled/refunded when viewing 'all' status AND not specifically looking at cancelled_refunded source
    if (filterByStatus === 'all' && filterBySource !== 'cancelled_refunded') {
      base = base.filter(c => {
        const status = (c.status || '').toLowerCase();
        return status !== 'cancelled' && status !== 'refunded';
      });
    }
    let filtered = base;
    let dateFilterActive = false;
    if (revenueDateRange?.from) {
      dateFilterActive = true;
      const from = new Date(revenueDateRange.from);
      from.setHours(0, 0, 0, 0);
      const to = revenueDateRange.to ? new Date(revenueDateRange.to) : new Date(from);
      to.setHours(23, 59, 59, 999);
      filtered = base.filter(c => {
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
    } else if (filterBySource === 'google_all') {
      statusLabel = 'Google Ads + Google Leads sales';
    } else if (filterBySource === 'google_leads_sales') {
      statusLabel = 'Google Leads sales';
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
    const sourceFilterActive = filterBySource !== 'all_view';
    return {
      count: filtered.length,
      revenue: filtered.reduce((sum, c) => sum + (c.final_amount || 0), 0),
      label: statusLabel,
      dateFilterActive,
      sourceFilterActive,
      hiddenByDate: dateFilterActive ? Math.max(0, base.length - filtered.length) : 0,
    };
  }, [filteredCustomers, revenueDateRange, isSuperAdmin, filterByStatus, filterBySource]);

  // Super-admin-only: per-source totals shown inside the Purchase Source dropdown.
  // Honors the active date filter (Quick month / custom range) so April vs May
  // show their own numbers. Falls back to all-time when no date is selected.
  const sourceBreakdownStats = useMemo(() => {
    if (!isSuperAdmin) return null;
    const empty = () => ({ count: 0, revenue: 0 });
    const buckets: Record<string, { count: number; revenue: number }> = {
      all_view: empty(),
      website: empty(),
      website_google: empty(),
      website_facebook: empty(),
      website_organic: empty(),
      staff_purchase: empty(),
      quote_order: empty(),
      agent_sales: empty(),
      cancelled_refunded: empty(),
    };

    // Honour the same date window the main table uses (dateRange/revenueDateRange
    // are kept in sync), and align date-field selection (signup_date only) so
    // breakdown totals match the filtered list exactly.
    let from: Date | null = null;
    let to: Date | null = null;
    const activeRange = revenueDateRange ?? dateRange;
    if (activeRange?.from) {
      from = new Date(activeRange.from);
      from.setHours(0, 0, 0, 0);
      to = activeRange.to ? new Date(activeRange.to) : new Date(from);
      to.setHours(23, 59, 59, 999);
    }

    const inRange = (c: any) => {
      if (!from || !to) return true;
      if (!c.signup_date) return false;
      const d = new Date(c.signup_date);
      return d >= from && d <= to;
    };

    // Honour the active status filter so source totals reflect what the user
    // is looking at (e.g. switching to "Active" updates every bucket).
    const matchesStatus = (c: any) => {
      const status = (c.status || '').toLowerCase();
      if (filterByStatus === 'all') return true;
      if (filterByStatus === 'cancelled_and_refunded') {
        return status === 'cancelled' || status === 'refunded';
      }
      return status === filterByStatus.toLowerCase();
    };

    customers.forEach((c) => {
      if (!inRange(c)) return;
      if (!matchesStatus(c)) return;

      const warrantyNum =
        c.customer_policies?.[0]?.warranty_number ||
        c.warranty_reference_number ||
        c.warranty_number ||
        '';
      const status = (c.status || '').toLowerCase();
      const amount = c.final_amount || 0;
      const isCancelled = status === 'cancelled' || status === 'refunded';

      if (isCancelled) {
        buckets.cancelled_refunded.count += 1;
        buckets.cancelled_refunded.revenue += amount;
        return;
      }

      buckets.all_view.count += 1;
      buckets.all_view.revenue += amount;

      const isWebsite = warrantyNum.startsWith('BAW-') && !warrantyNum.startsWith('BAW-S-');
      const isStaff = warrantyNum.startsWith('BAW-S-');
      const isAdm = warrantyNum.startsWith('ADM');

      // Channel attribution falls back to acquisition_source/gclid so that customers
      // without a warranty number yet still count toward Google/Facebook totals.
      const channel = getCustomerAcquisitionChannel(c);
      const channelOnly = !isWebsite && !isStaff && !isAdm &&
        (channel === 'google_ads' || channel === 'facebook_ads' || channel === 'website');

      if (isWebsite || channelOnly) {
        if (isWebsite) {
          buckets.website.count += 1;
          buckets.website.revenue += amount;
        }
        if (channel === 'google_ads') {
          buckets.website_google.count += 1;
          buckets.website_google.revenue += amount;
        } else if (channel === 'facebook_ads') {
          buckets.website_facebook.count += 1;
          buckets.website_facebook.revenue += amount;
        } else {
          buckets.website_organic.count += 1;
          buckets.website_organic.revenue += amount;
        }
      }
      if (isStaff) {
        buckets.staff_purchase.count += 1;
        buckets.staff_purchase.revenue += amount;
      }
      if (isAdm) {
        buckets.quote_order.count += 1;
        buckets.quote_order.revenue += amount;
      }
      if (isStaff || isAdm) {
        buckets.agent_sales.count += 1;
        buckets.agent_sales.revenue += amount;
      }
    });
    return buckets;
  }, [customers, isSuperAdmin, revenueDateRange, dateRange, filterByStatus]);

  const formatSourceStat = (key: string) => {
    const s = sourceBreakdownStats?.[key];
    if (!s) return null;
    const aov = s.count > 0 ? s.revenue / s.count : 0;
    const fmt = (n: number) =>
      new Intl.NumberFormat('en-GB', {
        style: 'currency',
        currency: 'GBP',
        maximumFractionDigits: 0,
      }).format(n);
    return `${s.count} · ${fmt(s.revenue)} · AOV ${fmt(aov)}`;
  };

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
  const [postedCustomerIds, setPostedCustomerIds] = useState<Set<string>>(new Set());

  const fetchPostedCustomerIds = useCallback(async () => {
    try {
      const { data } = await supabase
        .from('posted_letters_log')
        .select('customer_id, marked_sent_by')
        .not('customer_id', 'is', null)
        .not('marked_sent_by', 'is', null)
        .limit(5000);
      if (data) {
        const set = new Set<string>();
        data.forEach((r: any) => { if (r.customer_id) set.add(r.customer_id); });
        setPostedCustomerIds(set);
      }
    } catch (e) {
      console.error('Error fetching posted customer ids:', e);
    }
  }, []);

  const markCustomerAsPosted = useCallback(async (customer: any) => {
    const { error } = await supabase.from('posted_letters_log').insert({
      customer_id: customer.id,
      registration_plate: customer.registration_plate || 'N/A',
      customer_name: customer.name,
      customer_email: customer.email,
      warranty_number: customer.warranty_number,
      plan_type: customer.plan_type,
      sent_at: new Date().toISOString(),
      marked_sent_by: 'admin',
    } as any);
    if (error) {
      toast.error(error.message);
    } else {
      toast.success(`${customer.name} documents marked as posted.`);
      setPostedCustomerIds(prev => new Set(prev).add(customer.id));
    }
  }, []);

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
    // Critical path first
    fetchCustomers();
    fetchAdminUsers();
    getCurrentUser();

    // Secondary data loaded after the main table so it doesn't slow first paint
    const t = setTimeout(() => {
      fetchDeletedCustomers();
      fetchIncompleteCustomers();
      fetchPlans();
      fetchEmailStatuses();
      fetchAgentDealCounts();
      fetchAvailableTags();
      fetchPostedCustomerIds();
    }, 800);
    return () => clearTimeout(t);
  }, []);


  // Fetch "Claim made" flags for currently-loaded customers (by email and reg plate)
  useEffect(() => {
    let cancelled = false;
    (async () => {
      const emails = Array.from(new Set(
        customers.map((c) => (c.email || '').toLowerCase()).filter(Boolean)
      ));
      const regs = Array.from(new Set(
        customers.map((c: any) => (c.registration_plate || '').replace(/\s+/g, '').toUpperCase()).filter(Boolean)
      ));
      if (emails.length === 0 && regs.length === 0) {
        if (!cancelled) { setClaimEmails(new Set()); setClaimRegs(new Set()); }
        return;
      }
      const eSet = new Set<string>();
      const rSet = new Set<string>();
      if (emails.length) {
        const { data } = await (supabase.from('claims_submissions') as any)
          .select('email').in('email', emails).limit(10000);
        ((data as any[]) || []).forEach((r) => {
          const k = (r.email || '').toLowerCase(); if (k) eSet.add(k);
        });
      }
      if (regs.length) {
        const { data } = await (supabase.from('claims_submissions') as any)
          .select('vehicle_registration').in('vehicle_registration', regs).limit(10000);
        ((data as any[]) || []).forEach((r) => {
          const k = (r.vehicle_registration || '').replace(/\s+/g, '').toUpperCase();
          if (k) rSet.add(k);
        });
      }
      if (!cancelled) { setClaimEmails(eSet); setClaimRegs(rSet); }
    })();
    return () => { cancelled = true; };
  }, [customers]);

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

  // Auto-select own agent filter for sales agents.
  // No date cap: agents can see every customer they have ever sold to.
  useEffect(() => {
    if (!isSalesAgent) return;
    const agentId = effectiveAdminId;
    if (!agentId) return;

    setFilterByAgent((prev) => (prev === 'all' ? agentId : prev));
  }, [effectiveAdminId, isSalesAgent]);

  // Sales agents default to their full history (all time), not a rolling window.
  const [salesAllTimeApplied, setSalesAllTimeApplied] = useState(false);
  useEffect(() => {
    if (!isSalesScopedRole || salesAllTimeApplied) return;
    setSalesAllTimeApplied(true);
    setTotalSalesDateFilter('all');
    setUnifiedScope('signup');
    setUnifiedPeriod('all');
    setUnifiedCustomRange(undefined);
    setDateRange(undefined);
  }, [isSalesScopedRole, salesAllTimeApplied]);

  // Keep the shared customer date filter in sync with the Deals Period dropdown.
  // IMPORTANT: only clobber dateRange when the Deals dropdown is the active driver.
  // For sales roles we wait until the all-time default has been applied, otherwise
  // the stale '30days' default would immediately re-cap them to a rolling window.
  useEffect(() => {
    if (isSalesScopedRole && !salesAllTimeApplied) return;
    if (totalSalesDateFilter === 'all') return; // don't wipe a custom signup range
    const range = getAgentCountsDateRange(totalSalesDateFilter);
    setDateRange(range ? { from: range.start, to: range.end } : undefined);
  }, [isSalesAgent, isSalesScopedRole, salesAllTimeApplied, totalSalesDateFilter]);


  // Listen for URL search parameter changes
  useEffect(() => {
    const urlSearch = searchParams.get('search');
    if (urlSearch && urlSearch !== searchTerm) {
      setSearchTerm(urlSearch);
    }
    const pp = searchParams.get('pp');
    if (pp === 'outstanding' || pp === 'has' || pp === 'completed') {
      setFilterByPartPayment(pp);
    }
  }, [searchParams]);


  // Debounce search term to avoid filtering on every keystroke
  const debouncedSearchTerm = useDebounce(searchTerm, 300);

  // Server-side search fallback: the loaded table is capped/date-scoped, so a search
  // that finds nothing locally queries the database directly (any date, any agent).
  useEffect(() => {
    const term = debouncedSearchTerm.trim();
    if (term.length < 2) return;

    let cancelled = false;
    const run = async () => {
      const clean = term.replace(/[%,]/g, '');
      const like = `%${clean}%`;
      const compact = clean.replace(/\s+/g, '');
      const compactLike = `%${compact}%`;
      // Reg plates are stored both compact ("SE14HNB") and spaced ("SE14 HNB"),
      // so search every sensible variant of what was typed.
      const spaced = compact.length >= 5 ? `%${compact.slice(0, -3)} ${compact.slice(-3)}%` : compactLike;
      try {
        const { data, error } = await supabase
          .from('customers')
          .select('*, customer_policies!customer_id(id, policy_number, policy_end_date, policy_start_date, status, warranty_number, claim_limit, payment_amount)')
          .or([
            `name.ilike.${like}`,
            `first_name.ilike.${like}`,
            `last_name.ilike.${like}`,
            `email.ilike.${like}`,
            `phone.ilike.${like}`,
            `registration_plate.ilike.${like}`,
            `registration_plate.ilike.${compactLike}`,
            `registration_plate.ilike.${spaced}`,
            `warranty_reference_number.ilike.${compactLike}`,
            `warranty_number.ilike.${compactLike}`,
            `postcode.ilike.${compactLike}`,
          ].join(','))
          .eq('is_deleted', false)
          .order('signup_date', { ascending: false })
          .limit(200);


        if (cancelled || error || !data?.length) return;

        setCustomers((prev) => {
          const known = new Set(prev.map((c: any) => c.id));
          const extras = data
            .filter((c: any) => !known.has(c.id))
            .map((c: any) => ({
              ...c,
              warranty_expiry: c.customer_policies?.[0]?.policy_end_date || null,
              policy_number: c.customer_policies?.[0]?.policy_number || null,
              policy_status: c.customer_policies?.[0]?.status || null,
              policy_start_date: c.customer_policies?.[0]?.policy_start_date || null,
              lead_date: null,
            }));
          return extras.length ? [...prev, ...extras] : prev;
        });
      } catch (e) {
        console.warn('Customer search fallback failed:', e);
      }
    };
    run();
    return () => { cancelled = true; };
  }, [debouncedSearchTerm]);

  useEffect(() => {
    applyFiltersAndSort();
  }, [debouncedSearchTerm, customers, sortBy, filterByPlan, filterByStatus, filterByTag, filterBySource, filterByWarrantyPeriod, filterByPaymentSource, paymentSourceDateFilter, filterByAgent, dateRange, totalSalesDateFilter, tagAssignmentsCache, refundedCustomerIds, currentAdminUser, isSalesAgent, isSalesScopedRole, effectiveAdminId, isImpersonating]);


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
      // Normalized form (whitespace removed) for reg-plate / warranty-number style fields
      const searchCompact = searchLower.replace(/\s+/g, '');
      const compact = (v?: string | null) => (v ?? '').toLowerCase().replace(/\s+/g, '');
      const isSalesRole = isSalesScopedRole;

      // Detect a UK-reg style query (letters + digits, no @, 4-8 chars compact).
      // When matched, restrict search to plate/warranty fields so an email like
      // "lee.knap69@gmail.com" doesn't get returned for a reg like "AP69 YUX".
      const isRegLikeQuery =
        !searchCompact.includes('@') &&
        searchCompact.length >= 4 &&
        searchCompact.length <= 8 &&
        /^[a-z0-9]+$/.test(searchCompact) &&
        /[a-z]/.test(searchCompact) &&
        /[0-9]/.test(searchCompact);

      filtered = filtered.filter(customer => {
        if (isRegLikeQuery) {
          return (
            compact(customer.registration_plate).includes(searchCompact) ||
            compact(customer.warranty_reference_number).includes(searchCompact) ||
            compact(customer.warranty_number).includes(searchCompact) ||
            customer.customer_policies?.some(policy =>
              compact(policy.policy_number).includes(searchCompact) ||
              compact(policy.warranty_number).includes(searchCompact)
            )
          );
        }

        // Core fields available to all roles
        const coreMatch =
          customer.name?.toLowerCase().includes(searchLower) ||
          customer.email?.toLowerCase().includes(searchLower) ||
          customer.first_name?.toLowerCase().includes(searchLower) ||
          customer.last_name?.toLowerCase().includes(searchLower) ||
          customer.phone?.toLowerCase().includes(searchLower) ||
          customer.registration_plate?.toLowerCase().includes(searchLower) ||
          compact(customer.registration_plate).includes(searchCompact);

        // Sales roles can search the whole customer base by identity fields
        // (name / email / phone / reg) plus warranty & policy references.
        if (isSalesRole) {
          return coreMatch ||
            compact(customer.warranty_reference_number).includes(searchCompact) ||
            compact(customer.warranty_number).includes(searchCompact) ||
            customer.customer_policies?.some(policy =>
              compact(policy.policy_number).includes(searchCompact) ||
              compact(policy.warranty_number).includes(searchCompact)
            );
        }

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
          compact(customer.postcode).includes(searchCompact) ||
          customer.country?.toLowerCase().includes(searchLower) ||
          customer.warranty_reference_number?.toLowerCase().includes(searchLower) ||
          compact(customer.warranty_reference_number).includes(searchCompact) ||
          customer.warranty_number?.toLowerCase().includes(searchLower) ||
          compact(customer.warranty_number).includes(searchCompact) ||
          customer.plan_type?.toLowerCase().includes(searchLower) ||
          customer.payment_type?.toLowerCase().includes(searchLower) ||
          customer.discount_code?.toLowerCase().includes(searchLower) ||
          customer.stripe_session_id?.toLowerCase().includes(searchLower) ||
          customer.bumper_order_id?.toLowerCase().includes(searchLower) ||
          customer.stripe_customer_id?.toLowerCase().includes(searchLower) ||
          customer.status?.toLowerCase().includes(searchLower) ||
          customer.customer_policies?.some(policy =>
            policy.policy_number?.toLowerCase().includes(searchLower) ||
            policy.warranty_number?.toLowerCase().includes(searchLower) ||
            compact(policy.policy_number).includes(searchCompact) ||
            compact(policy.warranty_number).includes(searchCompact)
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
    } else if (filterBySource !== 'cancelled_refunded' && !debouncedSearchTerm) {
      // Default view hides cancelled/refunded customers — they belong in the
      // "Cancellations & Refunds" source filter only.
      // While searching we keep them so any customer can be found.
      filtered = filtered.filter(customer => {
        const status = (customer.status || '').toLowerCase();
        if (status === 'cancelled' || status === 'refunded') return false;
        if (refundedCustomerIds.has(customer.id)) return false;
        return true;
      });
    }

    // Hide "Claim Made" customers from sales agents and sales leads (browsing only —
    // an explicit search can still surface the record so they know whose customer it is)
    if (isSalesScopedRole && !debouncedSearchTerm) {
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

    // Apply source filter for super admins only — bypassed while searching so a
    // record is never hidden just because it sits under a different source tab.
    // BAW- = website/self-service, ADM- = manual/sales-team confirmed
    if (isSuperAdmin && filterBySource !== 'all_view' && !debouncedSearchTerm) {

      filtered = filtered.filter(customer => {
        // Get the definitive warranty number (from policy first, then customer record)
        const warrantyNum = customer.customer_policies?.[0]?.warranty_number || 
                           customer.warranty_reference_number || 
                           customer.warranty_number || '';
        
        if (filterBySource === 'website') {
          // "Website (BAW)" = pure direct/organic website sales only.
          // Google-ads and Facebook-ads attributed website sales are shown under
          // their own dedicated filters, so exclude them here to avoid double-counting.
          const isWebsitePrefix = warrantyNum.startsWith('BAW-') && !warrantyNum.startsWith('BAW-S-');
          if (!isWebsitePrefix) return false;
          const channel = getCustomerAcquisitionChannel(customer);
          return channel !== 'google_ads' && channel !== 'facebook_ads';
        } else if (filterBySource === 'website_google') {
          // Website sale with Google Ads attribution (normalised acquisition source, fall back to gclid)
          const isWebsite = warrantyNum.startsWith('BAW-') && !warrantyNum.startsWith('BAW-S-');
          return isWebsite && getCustomerAcquisitionChannel(customer) === 'google_ads';
        } else if (filterBySource === 'google_leads_sales') {
          // Agent-closed sales (BAW-S- staff or ADM- quote/order) where lead originated from Google Ads
          const isAgent = warrantyNum.startsWith('BAW-S-') || warrantyNum.startsWith('ADM');
          return isAgent && getCustomerAcquisitionChannel(customer) === 'google_ads';
        } else if (filterBySource === 'google_all') {
          // Google Ads pure (website) + Google Leads sales (agent-closed) combined
          return getCustomerAcquisitionChannel(customer) === 'google_ads';
        } else if (filterBySource === 'website_facebook') {
          // Website sale with Facebook Ads attribution
          const isWebsite = warrantyNum.startsWith('BAW-') && !warrantyNum.startsWith('BAW-S-');
          return isWebsite && getCustomerAcquisitionChannel(customer) === 'facebook_ads';
        } else if (filterBySource === 'website_organic') {
          // Website sale with no paid attribution (organic / direct website)
          const isWebsite = warrantyNum.startsWith('BAW-') && !warrantyNum.startsWith('BAW-S-');
          return isWebsite && getCustomerAcquisitionChannel(customer) === 'website';
        } else if (filterBySource === 'staff_purchase') {
          // BAW-S- prefix = staff claimed purchase
          return warrantyNum.startsWith('BAW-S-');
        } else if (filterBySource === 'quote_order') {
          // ADM- prefix = sales team confirmed / manual entry
          return warrantyNum.startsWith('ADM');
        } else if (filterBySource === 'agent_sales') {
          // Combined: BAW-S- (staff purchase) + ADM- (quote & orders)
          return warrantyNum.startsWith('BAW-S-') || warrantyNum.startsWith('ADM');
        } else if (filterBySource === 'cancelled_refunded') {
          const status = customer.status?.toLowerCase() || '';
          return status === 'cancelled' || status === 'refunded';
        } else if (filterBySource === 'payment_due') {
          // Deposit taken on Stripe, balance still outstanding
          return !!(customer as any).deposit_taken && !(customer as any).payment_collected_at;
        }
        return true;
      });
    }

    // Apply agent filter — an active search always searches the whole customer base,
    // for every role. Sales wrongly credited to another agent still need to be findable.
    const isSalesSearching = !!debouncedSearchTerm;

    // For sales agents: enforce own-agent filter when no explicit agent selection or search bypass
    const effectiveAgentFilter = (isSalesAgent && filterByAgent === 'all' && !isSalesSearching)
      ? (effectiveAdminId || currentAdminUser.id)  // Default to own deals even if somehow reset to 'all'
      : filterByAgent;

    if (effectiveAgentFilter !== 'all' && !isSalesSearching) {

      if (effectiveAgentFilter === 'unassigned') {
        filtered = filtered.filter(customer => !customer.assigned_to && !(customer as any).payment_confirmed_by);
      } else {
        // Attribute a sale to the agent when they own the record (assigned_to),
        // confirmed the payment (payment_confirmed_by), sent the quote (quote_sent_by),
        // OR were given the sale credit via manager override (sale_credit_admin_user_id).
        // This mirrors the Sales Scoreboard so both views agree on totals.
        filtered = filtered.filter(customer =>
          customer.assigned_to === effectiveAgentFilter ||
          (customer as any).payment_confirmed_by === effectiveAgentFilter ||
          (customer as any).quote_sent_by === effectiveAgentFilter ||
          (customer as any).sale_credit_admin_user_id === effectiveAgentFilter
        );
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

    // Apply Payment Source filter (Bumper / Stripe / Payment Assist / PayPal / Other)
    if (filterByPaymentSource !== 'all') {
      filtered = filtered.filter(customer => {
        const purchaseSrc = ((customer as any).purchase_source || '').toLowerCase();
        const hasBumper = !!customer.bumper_order_id || purchaseSrc.includes('bumper');
        const hasStripe = !!customer.stripe_session_id || purchaseSrc.includes('stripe');
        const sessionId = (customer.stripe_session_id || '').toLowerCase();
        const paymentTypeStr = (customer.payment_type || '').toLowerCase();
        const isPaypal = sessionId.includes('paypal') || paymentTypeStr.includes('paypal') || purchaseSrc.includes('paypal');
        const isPaymentAssist = purchaseSrc.includes('payment_assist') || purchaseSrc.includes('payment assist');
        if (filterByPaymentSource === 'bumper') return hasBumper;
        if (filterByPaymentSource === 'stripe') return hasStripe && !isPaypal && !hasBumper;
        if (filterByPaymentSource === 'paypal') return isPaypal;
        if (filterByPaymentSource === 'payment_assist') return isPaymentAssist || (!hasBumper && !hasStripe && !isPaypal && purchaseSrc === '');
        if (filterByPaymentSource === 'other') return !hasBumper && !hasStripe && !isPaypal && !isPaymentAssist;
        return true;
      });
    }

    // Apply part payment filter (independent of source/role filters)
    if (filterByPartPayment !== 'all') {
      filtered = filtered.filter(customer => {
        const plan = partPaymentPlans.get(customer.id);
        if (!plan) return false;
        if (filterByPartPayment === 'has') return true;
        const outstanding = Math.max(plan.total_due - plan.paid, 0);
        if (filterByPartPayment === 'completed') return plan.status === 'completed' || outstanding <= 0;
        return plan.status !== 'completed' && outstanding > 0;
      });
    }

    // Apply Payment Source date filter (uses signup_date)
    if (paymentSourceDateFilter !== 'all') {
      const psRange = getAgentCountsDateRange(paymentSourceDateFilter);
      if (psRange) {
        filtered = filtered.filter(customer => {
          const ds = customer.signup_date || customer.created_at;
          if (!ds) return false;
          const d = new Date(ds);
          return d >= psRange.start && d <= psRange.end;
        });
      }
    }

    // Apply date range filter — bypass when actively searching (so users can find any customer by name/email/reg)
    // For sales agents: ALWAYS enforce 2-month restriction even if dateRange state is somehow cleared
    const isActivelySearching = !!debouncedSearchTerm;
    if (!isActivelySearching) {
      const effectiveDateRange = dateRange;

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
      
      // Initial-contact column sort takes priority when active.
      if (initialContactSort) {
        const ca = getTimeToLeadMinutes((a as any).lead_date, (a as any).first_contact_date);
        const cb = getTimeToLeadMinutes((b as any).lead_date, (b as any).first_contact_date);
        if (ca === null && cb === null) return dateB - dateA;
        if (ca === null) return 1;
        if (cb === null) return -1;
        return initialContactSort === 'desc' ? cb - ca : ca - cb;
      }

      // Time-to-lead column sort takes priority when active.
      if (timeToLeadSort) {
        const ta = getTimeToLeadMinutes((a as any).lead_date, a.signup_date);
        const tb = getTimeToLeadMinutes((b as any).lead_date, b.signup_date);
        // Rows with no time-to-lead always sink to the bottom.
        if (ta === null && tb === null) return dateB - dateA;
        if (ta === null) return 1;
        if (tb === null) return -1;
        return timeToLeadSort === 'desc' ? tb - ta : ta - tb;
      }


      switch (sortBy) {
        case 'newest':
          return dateB - dateA;
        case 'oldest':
          return dateA - dateB;
        case 'highest_amount':
          return (b.final_amount || 0) - (a.final_amount || 0);
        case 'lowest_amount':
          return (a.final_amount || 0) - (b.final_amount || 0);
        case 'name_az':
        case 'name':
          return (a.name || '').localeCompare(b.name || '');
        case 'name_za':
          return (b.name || '').localeCompare(a.name || '');
        case 'email':
          return (a.email || '').localeCompare(b.email || '');
        case 'plan':
          return (a.plan_type || '').localeCompare(b.plan_type || '');
        case 'reg':
          return (a.registration_plate || '').localeCompare(b.registration_plate || '');
        default:
          return dateB - dateA;
      }
    });

    setFilteredCustomers(filtered);
  }, [customers, debouncedSearchTerm, sortBy, timeToLeadSort, initialContactSort, filterByPlan, filterByStatus, filterByTag, filterBySource, filterByWarrantyPeriod, filterByPaymentSource, paymentSourceDateFilter, filterByAgent, filterByPartPayment, partPaymentPlans, dateRange, totalSalesDateFilter, tagAssignmentsCache, refundedCustomerIds, currentAdminUser, isSuperAdmin, isSalesAgent, isSalesScopedRole, effectiveAdminId, isImpersonating]);

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
        range = getAgentCountsDateRange(totalSalesDateFilter);
      }

      // Attribution mirrors the Sales Scoreboard exactly:
      // sale_credit_admin_user_id → payment_confirmed_by → quote_sent_by → assigned_to,
      // counted on signup_date so both views always agree.
      const creditCols = 'id, assigned_to, payment_confirmed_by, quote_sent_by, sale_credit_admin_user_id';

      let activeQuery = supabase
        .from('customers')
        .select(creditCols)
        .eq('is_deleted', false)
        .ilike('status', 'active');

      let cancelledQuery = supabase
        .from('customers')
        .select(creditCols)
        .eq('is_deleted', false)
        .or('status.ilike.cancelled,status.ilike.refunded');

      let claimsQuery = supabase
        .from('commission_claims')
        .select('id, agent_id')
        .eq('status', 'approved');

      if (range) {
        activeQuery = activeQuery.gte('signup_date', range.start.toISOString()).lte('signup_date', range.end.toISOString());
        cancelledQuery = cancelledQuery.gte('signup_date', range.start.toISOString()).lte('signup_date', range.end.toISOString());
        claimsQuery = claimsQuery.gte('created_at', range.start.toISOString()).lte('created_at', range.end.toISOString());
      }

      const { data: activeCustomers } = await activeQuery;
      const { data: cancelledCustomers } = await cancelledQuery;
      const { data: approvedClaims } = await claimsQuery;

      const attributionOf = (c: any) =>
        c.sale_credit_admin_user_id || c.payment_confirmed_by || c.quote_sent_by || c.assigned_to;

      const counts: Record<string, { sales: number; cancelled: number }> = {};
      const ensure = (id: string) => { if (!counts[id]) counts[id] = { sales: 0, cancelled: 0 }; };
      (activeCustomers || []).forEach(c => {
        const id = attributionOf(c);
        if (id) { ensure(id); counts[id].sales++; }
      });
      (approvedClaims || []).forEach(c => {
        if (c.agent_id) { ensure(c.agent_id); counts[c.agent_id].sales++; }
      });
      (cancelledCustomers || []).forEach(c => {
        const id = attributionOf(c);
        if (id) { ensure(id); counts[id].cancelled++; }
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
      const [
        { data: customersData, error: customersError },
        { data: orphanedPolicies, error: orphanedError },
      ] = await Promise.all([
        supabase
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
              payment_amount,
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
          .limit(3000),
        supabase
          .from('customer_policies')
          .select('*')
          .is('customer_id', null)
          .order('created_at', { ascending: false })
          .limit(500),
      ]);


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
        })) as any[];
        
        directData = [...directData, ...orphanedAsCustomers] as typeof directData;
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
        lead_date: null as string | null,
      })) || [];

      // Paint the table immediately, then enrich in the background
      setCustomers(processedData);
      setFilteredCustomers(processedData);
      setLoading(false);
      if (!initialLoadDone) setInitialLoadDone(true);

      // Background enrichment: lead dates + recovered phone numbers
      (async () => {
        try {
          const customerEmails = Array.from(new Set(
            processedData.map((c: any) => c.email?.toLowerCase()).filter(Boolean)
          )) as string[];

          const leadDateMap: Record<string, string> = {};
          // email -> earliest lead id, used to look up first agent contact
          const leadIdMap: Record<string, string> = {};
          if (customerEmails.length > 0) {
            const batches: string[][] = [];
            for (let i = 0; i < customerEmails.length; i += 300) {
              batches.push(customerEmails.slice(i, i + 300));
            }
            const results = await Promise.all(
              batches.map((batch) =>
                supabase
                  .from('sales_leads')
                  .select('id, email, created_at')
                  .in('email', batch)
                  .order('created_at', { ascending: true })
              )
            );
            for (const { data: leadsData } of results) {
              for (const lead of leadsData || []) {
                const key = lead.email?.toLowerCase();
                if (key && !leadDateMap[key]) {
                  leadDateMap[key] = lead.created_at;
                  leadIdMap[key] = (lead as any).id;
                }
              }
            }
          }

          // First initial contact = earliest logged call, quick note or status
          // change against that lead. Whichever happened first counts.
          const firstContactByLeadId: Record<string, string> = {};
          const leadIds = Object.values(leadIdMap).filter(Boolean);
          if (leadIds.length > 0) {
            const idBatches: string[][] = [];
            for (let i = 0; i < leadIds.length; i += 300) {
              idBatches.push(leadIds.slice(i, i + 300));
            }
            const noteFirst = (leadId: string, ts?: string | null) => {
              if (!ts) return;
              const cur = firstContactByLeadId[leadId];
              if (!cur || new Date(ts).getTime() < new Date(cur).getTime()) {
                firstContactByLeadId[leadId] = ts;
              }
            };
            await Promise.all(
              idBatches.map(async (batch) => {
                const [calls, notes, changes] = await Promise.all([
                  supabase.from('lead_call_logs').select('lead_id, created_at').in('lead_id', batch),
                  supabase.from('lead_quick_notes').select('lead_id, created_at').in('lead_id', batch),
                  supabase.from('sales_leads_changelog').select('lead_id, changed_at').in('lead_id', batch),
                ]);
                for (const row of calls.data || []) noteFirst((row as any).lead_id, (row as any).created_at);
                for (const row of notes.data || []) noteFirst((row as any).lead_id, (row as any).created_at);
                for (const row of changes.data || []) noteFirst((row as any).lead_id, (row as any).changed_at);
              })
            );
          }

          const withLeadDates = processedData.map((c: any) => {
            const key = c.email?.toLowerCase();
            const leadId = key ? leadIdMap[key] : undefined;
            return {
              ...c,
              lead_date: (key && leadDateMap[key]) || null,
              first_contact_date: (leadId && firstContactByLeadId[leadId]) || null,
            };
          });


          const { recoveredRows, recoveredCount } = await recoverMissingPhones(withLeadDates);

          setCustomers(recoveredRows);
          setFilteredCustomers((prev) => (prev.length === processedData.length ? recoveredRows : prev));

          if (recoveredCount > 0) {
            toast.success(`Recovered ${recoveredCount} missing phone number${recoveredCount > 1 ? 's' : ''} from Step 2 backups`);
          }
        } catch (e) {
          console.warn('Background customer enrichment failed:', e);
        }
      })();

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
        .order('created_at', { ascending: false })
        .limit(1000);


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
        .order('deleted_at', { ascending: false })
        .limit(1000);


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

  // Staff-facing helper: set/reset a customer's dashboard password without needing
  // to complete the full warranty record (helps elderly customers who can't self-reset).
  const setCustomerDashboardPassword = async (customer: any, password: string) => {
    const email = (customer?.email || '').trim();
    if (!email) {
      toast.error('Customer needs an email address first');
      return;
    }
    if (!password || password.length < 6) {
      toast.error('Password must be at least 6 characters');
      return;
    }
    setSavingPassword(true);
    try {
      const { data, error } = await supabase.functions.invoke('create-customer-account', {
        body: {
          email,
          password,
          firstName: customer.first_name || customer.name?.split(' ')[0] || '',
          lastName: customer.last_name || customer.name?.split(' ').slice(1).join(' ') || '',
          customerId: customer.id,
        },
      });
      if (error) throw error;
      if (data?.error) throw new Error(data.error);
      toast.success(
        data?.action === 'updated'
          ? `Password updated for ${email}`
          : `Login created for ${email}`,
        { description: 'Share the new password with the customer.' }
      );
    } catch (err: any) {
      console.error('Set customer password error:', err);
      toast.error(err.message || 'Failed to update password');
    } finally {
      setSavingPassword(false);
    }
  };

  const updateCustomer = async () => {
    if (!editingCustomer) return;

    // Warranty & Payment Details are only mandatory for manual entries whose payment
    // has not yet been confirmed. Existing/paid records can be edited freely so staff
    // aren't blocked from routine updates (notes, address, passwords, etc.).
    const needsPaymentDetails =
      (editingCustomer as any).is_manual_entry === true &&
      (editingCustomer as any).payment_verified === false;

    if (needsPaymentDetails) {
      // The toggle groups visually show sensible defaults (Platinum / £0 excess /
      // £2,000 claim limit / £70 labour) even when the record has no value stored.
      // Adopt those displayed defaults so staff aren't blocked by fields that
      // already look complete on screen.
      if (!editingCustomer.plan_type) editingCustomer.plan_type = 'Platinum';
      if (editingCustomer.voluntary_excess === null || editingCustomer.voluntary_excess === undefined) {
        editingCustomer.voluntary_excess = 0;
      }
      if (!editingCustomer.claim_limit) editingCustomer.claim_limit = 2000;
      if (!editingCustomer.labour_rate) editingCustomer.labour_rate = 70;

      // Amount can live on the customer record OR on the linked policy
      // (Quotes & Orders writes payment_amount to customer_policies).
      const policyAmount = Number(
        (editingCustomer as any).customer_policies?.[0]?.payment_amount ?? 0
      );
      const originalAmt = Number(editingCustomer.original_amount) || 0;
      const finalAmt = Number(editingCustomer.final_amount) || 0;
      const resolvedAmount = originalAmt > 0 ? originalAmt : finalAmt > 0 ? finalAmt : policyAmount;

      const missing: string[] = [];
      if (!editingCustomer.payment_type) missing.push('Duration');
      if (!(resolvedAmount > 0)) missing.push('Original Amount');
      if (missing.length > 0) {
        toast.error(`Please select: ${missing.join(', ')}`, {
          description: 'All Warranty & Payment Details are required before confirming a payment.',
        });
        return;
      }
      if (!originalAmt) editingCustomer.original_amount = resolvedAmount;
      if (!finalAmt) editingCustomer.final_amount = resolvedAmount;
    }





    try {
      const nowIso = new Date().toISOString();
      const normalizedStatus = (editingCustomer.status || '').toLowerCase();
      const isCancelTransition = normalizedStatus === 'cancelled' || normalizedStatus === 'refunded';

      // Detect whether this edit is the FIRST time the customer is being moved into
      // a Cancelled/Refunded state so we can mirror the CancelWarrantyDialog flow
      // (archive, log, cancel linked policy) and the Cancellations tab tallies correctly.
      let wasAlreadyCancelled = false;
      if (isCancelTransition) {
        const { data: existing } = await supabase
          .from('customers')
          .select('status, is_deleted')
          .eq('id', editingCustomer.id)
          .maybeSingle();
        const prevStatus = (existing?.status || '').toLowerCase();
        wasAlreadyCancelled = prevStatus === 'cancelled' || prevStatus === 'refunded';
      }

      const customerUpdate: Record<string, any> = {
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
        seasonal_bonus_months: (editingCustomer as any).seasonal_bonus_months ?? null,
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
        labour_rate: editingCustomer.labour_rate,
        updated_at: nowIso,
      };

      // When the edit dialog flips status to Cancelled/Refunded, perform the
      // same archival side-effects as the dedicated Cancel Warranty flow so the
      // Cancellations tab picks it up with the correct cancellation date.
      if (isCancelTransition && !wasAlreadyCancelled) {
        customerUpdate.is_deleted = true;
        customerUpdate.deleted_at = nowIso;
        customerUpdate.cancellation_note_updated_at = nowIso;
        const { data: authData } = await supabase.auth.getUser();
        customerUpdate.cancellation_note_updated_by = authData?.user?.id ?? null;
      }

      const { data: updatedCustomerRows, error: customerError } = await supabase
        .from('customers')
        .update(customerUpdate)
        .eq('id', editingCustomer.id)
        .select('id');

      if (customerError) throw customerError;

      // Zero rows updated means row-level permissions blocked the write silently.
      if (!updatedCustomerRows || updatedCustomerRows.length === 0) {
        throw new Error(
          "Nothing was saved — your account doesn't have permission to edit this customer. Ask a manager to check your staff account is active."
        );
      }


      // Mirror the cancellation onto the linked policy + audit log so reporting,
      // commission unwinds and claims views stay in sync.
      if (isCancelTransition && !wasAlreadyCancelled) {
        try {
          await supabase
            .from('customer_policies')
            .update({
              status: 'cancelled',
              is_deleted: true,
              deleted_at: nowIso,
              updated_at: nowIso,
            })
            .eq('customer_id', editingCustomer.id);

          await supabase.from('admin_notes').insert({
            customer_id: editingCustomer.id,
            note:
              `WARRANTY ${normalizedStatus.toUpperCase()} via edit dialog\n` +
              `Customer: ${editingCustomer.name || editingCustomer.email}\n` +
              `At: ${new Date().toLocaleString()}`,
          });
        } catch (sideEffectErr) {
          console.error('Cancellation side-effects failed (non-blocking):', sideEffectErr);
        }
      }


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
            seasonal_bonus_months: (editingCustomer as any).seasonal_bonus_months ?? null,
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
      toast.error(`Failed to update customer: ${(error as any)?.message || 'unknown error'}`, {
        description: (error as any)?.details || (error as any)?.hint || undefined,
      });
    }
  };

  const getExportData = useCallback(() => {
    const role = currentAdminUser?.role || '';
    const emailLower = (currentAdminUser?.email || '').toLowerCase();
    const canViewFinancials = role === 'super_admin' || role === 'admin';
    // Management + accounts + lead gen get every field held against the customer,
    // so nothing from the customer profile is missing in the CSV/Excel export.
    const canExportEveryColumn =
      [
        'super_admin',
        'admin',
        'sales_manager',
        'performance_manager',
        'accounts_manager',
        'accounts',
        'lead_gen',
      ].includes(role) || emailLower.startsWith('accounts@');

    // Union of every key present on any customer row (plus joined policy fields),
    // so agents' rows with sparse data still line up column-for-column.
    const extraKeys: string[] = [];
    const policyKeys: string[] = [];
    if (canExportEveryColumn) {
      const seen = new Set<string>();
      const seenPolicy = new Set<string>();
      filteredCustomers.forEach((c: any) => {
        Object.keys(c || {}).forEach((k) => {
          if (k === 'customer_policies') return;
          if (!seen.has(k)) {
            seen.add(k);
            extraKeys.push(k);
          }
        });
        const p = Array.isArray(c?.customer_policies) ? c.customer_policies[0] : null;
        if (p) {
          Object.keys(p).forEach((k) => {
            if (!seenPolicy.has(k)) {
              seenPolicy.add(k);
              policyKeys.push(k);
            }
          });
        }
      });
      extraKeys.sort();
      policyKeys.sort();
    }


    const flatten = (v: any) => {
      if (v === null || v === undefined) return '';
      if (v instanceof Date) return v.toISOString();
      if (typeof v === 'object') return JSON.stringify(v);
      return v;
    };

    return filteredCustomers.map((customer: any) => {
      const row: Record<string, any> = {
        'Name': customer.name,
        'Email': customer.email,
        'Phone': customer.phone || '',
        'Address': `${customer.street || ''} ${customer.town || ''} ${customer.county || ''} ${customer.postcode || ''}`.trim(),
        'Registration Plate': customer.registration_plate || '',
        'Vehicle': `${customer.vehicle_make || ''} ${customer.vehicle_model || ''} ${customer.vehicle_year || ''}`.trim(),
        'Plan Type': customer.plan_type,
        'Payment Type': customer.payment_type || '',
        'Signup Date': customer.signup_date ? new Date(customer.signup_date).toLocaleDateString('en-GB') : '',
        'Time to Lead': formatTimeToLead((customer as any).lead_date, customer.signup_date) || '',
        'Time to Initial Contact': formatTimeToLead((customer as any).lead_date, (customer as any).first_contact_date) || '',
        'Initial Contact At': (customer as any).first_contact_date ? new Date((customer as any).first_contact_date).toLocaleString('en-GB') : '',

        'Warranty Expiry': customer.warranty_expiry ? new Date(customer.warranty_expiry).toLocaleDateString('en-GB') : 'N/A',
        'Voluntary Excess': customer.voluntary_excess || 0,
        'Status': customer.status,
      };
      if (canViewFinancials) {
        row['Final Amount'] = customer.final_amount || 0;
      }
      if (canExportEveryColumn) {
        extraKeys.forEach((k) => {
          row[k] = flatten(customer[k]);
        });
        const policy = Array.isArray(customer.customer_policies) ? customer.customer_policies[0] : null;
        policyKeys.forEach((k) => {
          row[`policy_${k}`] = flatten(policy ? policy[k] : '');
        });
      }
      return row;
    });
  }, [filteredCustomers, currentAdminUser?.role, currentAdminUser?.email]);


  const handleExport = (format: 'csv' | 'xlsx') => {
    const exportData = getExportData();
    if (format === 'csv') {
      exportDataToCSV(exportData, { filename: 'customers', format: 'csv' });
    } else {
      exportToExcel(exportData, { filename: 'customers', format: 'xlsx' });
    }
  };

  // Full export: every column from the customers row, for management + accounts + lead_gen.
  // Used for deep analysis / data handovers; not available to standard sales agents.
  const managerExportRoles = [
    'super_admin',
    'admin',
    'sales_manager',
    'performance_manager',
    'accounts_manager',
    'accounts',
    'lead_gen',
  ];
  const adminEmailLower = (currentAdminUser?.email || '').toLowerCase();
  const canExportFullCustomers =
    managerExportRoles.includes(currentAdminUser?.role || '') ||
    adminEmailLower.startsWith('accounts@');


  const buildFullCsvRows = (list: any[]) => {
    const keySet = new Set<string>();
    list.forEach(c => Object.keys(c || {}).forEach(k => keySet.add(k)));
    const keys = Array.from(keySet);
    const rows = list.map(c => {
      const out: Record<string, any> = {};
      keys.forEach(k => {
        const v = (c as any)[k];
        if (v === null || v === undefined) out[k] = '';
        else if (v instanceof Date) out[k] = v.toISOString();
        else if (typeof v === 'object') out[k] = JSON.stringify(v);
        else out[k] = v;
      });
      return out;
    });
    return { rows, keys };
  };

  const handleExportFullCsv = () => {
    if (!canExportFullCustomers) {
      toast.error('You do not have permission to export the full customer dataset');
      return;
    }
    if (!filteredCustomers.length) {
      toast.error('No customers to export');
      return;
    }
    const sorted = [...filteredCustomers].sort((a: any, b: any) => {
      const ta = a?.signup_date ? new Date(a.signup_date).getTime() : 0;
      const tb = b?.signup_date ? new Date(b.signup_date).getTime() : 0;
      return tb - ta;
    });
    const { rows, keys } = buildFullCsvRows(sorted);
    exportDataToCSV(rows, {
      filename: `customers-full-${new Date().toISOString().slice(0, 10)}`,
      format: 'csv',
    });
    toast.success(`Exported ${rows.length} customer(s) with ${keys.length} columns`);
  };

  // Export all customers whose signup_date falls in a given [start, end) window.
  // Queries Supabase directly with pagination + signup_date DESC ordering so the
  // export is not capped by the 3000-row in-memory list (which is ordered by updated_at).
  const exportForRange = async (start: Date, end: Date, label: string) => {
    if (!canExportFullCustomers) {
      toast.error('You do not have permission to export');
      return;
    }
    const toastId = toast.loading(`Preparing export for ${label}...`);
    try {
      const startIso = start.toISOString();
      const endIso = end.toISOString();
      const pageSize = 1000;
      let from = 0;
      const collected: any[] = [];
      // Paginate to bypass PostgREST's default 1000-row cap.
      // Sort by signup_date DESC so the CSV is newest → oldest.
      // Fallback secondary sort on created_at keeps rows without signup_date deterministic.
      while (true) {
        const { data, error } = await supabase
          .from('customers')
          .select('*')
          .eq('is_deleted', false)
          .not('email', 'ilike', '%@test.com%')
          .not('email', 'ilike', '%testuser%')
          .not('email', 'ilike', '%guest@%')
          .not('name', 'eq', 'Test Customer')
          .not('name', 'eq', 'Guest Customer')
          .gte('signup_date', startIso)
          .lt('signup_date', endIso)
          .order('signup_date', { ascending: false })
          .order('created_at', { ascending: false })
          .range(from, from + pageSize - 1);
        if (error) throw error;
        const batch = data || [];
        collected.push(...batch);
        if (batch.length < pageSize) break;
        from += pageSize;
        // No hard cap — paginate until Supabase returns a short page.
      }

      if (!collected.length) {
        toast.error(`No customers found for ${label}`, { id: toastId });
        return;
      }

      // Ensure final ordering is newest → oldest by signup_date.
      collected.sort((a, b) => {
        const ta = a?.signup_date ? new Date(a.signup_date).getTime() : 0;
        const tb = b?.signup_date ? new Date(b.signup_date).getTime() : 0;
        return tb - ta;
      });

      const { rows, keys } = buildFullCsvRows(collected);
      exportDataToCSV(rows, { filename: `customers-${label}`, format: 'csv' });
      toast.success(`Exported ${rows.length} customer(s) for ${label} (${keys.length} columns)`, { id: toastId });
    } catch (err: any) {
      console.error('exportForRange failed:', err);
      toast.error(`Export failed: ${err?.message || 'unknown error'}`, { id: toastId });
    }
  };

  // Month list is unbounded — spans from the earliest known signup month up to
  // the current month, so no historical date is ever blocked from the picker.
  const earliestSignupMs = useMemo(() => {
    let earliest = Date.UTC(2025, 7, 1); // Aug 2025 (first signup in DB)
    for (const c of customers) {
      const iso = (c as any)?.signup_date;
      if (!iso) continue;
      const t = new Date(iso).getTime();
      if (Number.isFinite(t) && t < earliest) earliest = t;
    }
    return earliest;
  }, [customers]);

  const monthExportOptions = useMemo(() => {
    const opts: { label: string; filenameLabel: string; start: Date; end: Date }[] = [];
    const now = new Date();
    const earliest = new Date(earliestSignupMs);
    const earliestYear = earliest.getUTCFullYear();
    const earliestMonth = earliest.getUTCMonth();
    const totalMonths =
      (now.getUTCFullYear() - earliestYear) * 12 + (now.getUTCMonth() - earliestMonth) + 1;
    for (let i = 0; i < Math.max(totalMonths, 1); i++) {
      const start = new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth() - i, 1));
      const end = new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth() - i + 1, 1));
      opts.push({
        label: start.toLocaleString('en-GB', { month: 'long', year: 'numeric', timeZone: 'UTC' }),
        filenameLabel: `${start.getUTCFullYear()}-${String(start.getUTCMonth() + 1).padStart(2, '0')}`,
        start, end,
      });
    }
    return opts;
  }, [earliestSignupMs]);

  // Quick-range presets that call the same server-side paginated export as
  // Month / Date Range, so results are never truncated by the in-memory 3000-row cap.
  const quickRangeOptions = useMemo(() => {
    const now = new Date();
    const startOfTodayUtc = new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), now.getUTCDate()));
    const addDays = (d: Date, n: number) => new Date(d.getTime() + n * 86400000);
    // Week starts Monday (UK convention).
    const dow = startOfTodayUtc.getUTCDay(); // 0 = Sun
    const daysSinceMonday = (dow + 6) % 7;
    const startOfThisWeek = addDays(startOfTodayUtc, -daysSinceMonday);
    const startOfLastWeek = addDays(startOfThisWeek, -7);
    const startOfThisMonth = new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), 1));
    const startOfLastMonth = new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth() - 1, 1));
    const startOfThisYear = new Date(Date.UTC(now.getUTCFullYear(), 0, 1));
    const tomorrow = addDays(startOfTodayUtc, 1);
    const veryFarFuture = new Date(Date.UTC(now.getUTCFullYear() + 5, 0, 1));
    const epoch = new Date(Date.UTC(2020, 0, 1));
    return [
      { label: 'Today', filenameLabel: 'today', start: startOfTodayUtc, end: tomorrow },
      { label: 'Yesterday', filenameLabel: 'yesterday', start: addDays(startOfTodayUtc, -1), end: startOfTodayUtc },
      { label: 'Last 7 days', filenameLabel: 'last-7-days', start: addDays(startOfTodayUtc, -6), end: tomorrow },
      { label: 'This week (Mon–today)', filenameLabel: 'this-week', start: startOfThisWeek, end: tomorrow },
      { label: 'Last week', filenameLabel: 'last-week', start: startOfLastWeek, end: startOfThisWeek },
      { label: 'This month', filenameLabel: 'this-month', start: startOfThisMonth, end: tomorrow },
      { label: 'Last month', filenameLabel: 'last-month', start: startOfLastMonth, end: startOfThisMonth },
      { label: 'Last 30 days', filenameLabel: 'last-30-days', start: addDays(startOfTodayUtc, -29), end: tomorrow },
      { label: 'Last 90 days', filenameLabel: 'last-90-days', start: addDays(startOfTodayUtc, -89), end: tomorrow },
      { label: 'Year to date', filenameLabel: 'year-to-date', start: startOfThisYear, end: tomorrow },
      { label: 'All time', filenameLabel: 'all-time', start: epoch, end: veryFarFuture },
    ];
  }, []);

  const [rangeExportOpen, setRangeExportOpen] = useState(false);
  const [rangeExportFrom, setRangeExportFrom] = useState<string>('');
  const [rangeExportTo, setRangeExportTo] = useState<string>('');

  const handleRangeExportSubmit = () => {
    if (!rangeExportFrom || !rangeExportTo) {
      toast.error('Pick a start and end date');
      return;
    }
    const start = new Date(`${rangeExportFrom}T00:00:00Z`);
    const endInclusive = new Date(`${rangeExportTo}T00:00:00Z`);
    const end = new Date(endInclusive.getTime() + 24 * 60 * 60 * 1000);
    if (end.getTime() <= start.getTime()) {
      toast.error('End date must be on or after start date');
      return;
    }
    exportForRange(start, end, `${rangeExportFrom}_to_${rangeExportTo}`);
    setRangeExportOpen(false);
  };


  // Google Ads Offline Conversion Import export.
  // Format follows Google's required schema: Google Click ID, Conversion Name,
  // Conversion Time, Conversion Value, Conversion Currency.
  // Only includes customers that have a gclid recorded.
  const handleExportGoogleConversions = () => {
    const rows = filteredCustomers
      .filter(c => !!(c.gclid && String(c.gclid).trim()))
      .map(c => {
        const ts = new Date(c.signup_date);
        // Google requires: "yyyy-MM-dd HH:mm:ss+0000"
        const pad = (n: number) => String(n).padStart(2, '0');
        const conversionTime = `${ts.getUTCFullYear()}-${pad(ts.getUTCMonth() + 1)}-${pad(ts.getUTCDate())} ${pad(ts.getUTCHours())}:${pad(ts.getUTCMinutes())}:${pad(ts.getUTCSeconds())}+0000`;
        return {
          'Google Click ID': c.gclid,
          'Conversion Name': 'Warranty Purchase',
          'Conversion Time': conversionTime,
          'Conversion Value': Number(c.final_amount || 0).toFixed(2),
          'Conversion Currency': 'GBP',
          'Email': c.email || '',
          'Phone': c.phone || '',
          'Name': c.name || '',
          'Registration Plate': c.registration_plate || '',
        };
      });
    if (!rows.length) {
      toast.error('No customers with a GCLID found in the current filter');
      return;
    }
    exportDataToCSV(rows, { filename: `google-ads-conversions-${new Date().toISOString().slice(0, 10)}`, format: 'csv' });
    toast.success(`Exported ${rows.length} Google Ads conversion(s)`);
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

  const buildCredentialsTemplate = (mode: 'normal' | 'apology') => {
    const firstName = selectedCustomer?.first_name || editingCustomer?.first_name || 'there';
    const email = customerCredentials?.email || selectedCustomer?.email || '';
    const password = customerCredentials?.password || '';
    const dashboardUrl = 'https://buyawarranty.co.uk/customer-dashboard';

    if (mode === 'apology') {
      return {
        subject: 'Sorry you had trouble logging in — here are your details',
        body: `Hi ${firstName},

I'm really sorry for the trouble you've had logging in. To get you back into your account as quickly as possible, please use the details below:

Customer Dashboard: ${dashboardUrl}
Username: ${email}
Temporary password: ${password}

For security, please change your password once you've logged in.

A few quick tips if you're still having trouble:
• Copy and paste the password rather than typing it (it's case-sensitive).
• Try the latest version of Chrome, Safari or Edge, or open a private window.
• Use "Forgot password" on the login page if you'd like to set a new one.

If there's anything else I can help with, please just reply to this email or call us on 0330 229 5040.

Kind regards,
Mike Swan
Buyawarranty.co.uk`,
      };
    }

    return {
      subject: 'Your Customer Dashboard Login Details',
      body: `Hi ${firstName},

I hope you're well.

We have checked the system and everything appears to be running as normal. However, to help you access your account, please try logging in using the details below:

Customer Dashboard: ${dashboardUrl}
Username: ${email}
Temporary password: ${password}

For security, please change your password once you have logged in.

If you experience any further issues or have any questions, please do not hesitate to contact us.

Kind regards,
Mike Swan
Buyawarranty.co.uk`,
    };
  };

  const openCredentialsPreview = (mode: 'normal' | 'apology') => {
    if (!customerCredentials) return;
    const tpl = buildCredentialsTemplate(mode);
    setCredentialsPreview({
      open: true,
      mode,
      subject: tpl.subject,
      body: tpl.body,
      email: customerCredentials.email,
    });
  };

  const sendCredentialsEmail = async (
    customerEmail: string,
    mode: 'normal' | 'apology' = 'normal',
    custom?: { subject: string; body: string }
  ) => {
    try {
      setSendingCredentials(mode === 'normal');
      setSendingApology(mode === 'apology');
      const { data, error } = await supabase.functions.invoke('resend-customer-credentials', {
        body: {
          email: customerEmail,
          mode,
          customSubject: custom?.subject,
          customBody: custom?.body,
        }
      });
      
      if (error) {
        toast.error('Failed to send credentials email: ' + error.message);
        return;
      }
      
      if (!data?.success) {
        throw new Error(data?.error || 'Failed to send credentials');
      }
      
      if (mode === 'apology') {
        toast.success('Apology login details sent successfully to ' + customerEmail);
      } else {
        toast.success('Login credentials sent successfully to ' + customerEmail);
      }
      setCredentialsPreview((p) => ({ ...p, open: false }));
    } catch (error: any) {
      console.error('Error sending credentials:', error);
      toast.error(error.message || 'Failed to send credentials email');
    } finally {
      setSendingCredentials(false);
      setSendingApology(false);
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

  // Warranties Register integration removed — internal handling only.

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

  const pendingConfirmationCount = customers.filter(
    (c) => c.is_manual_entry && c.payment_verified === false
  ).length;
  const canConfirmPayments =
    userRole === 'admin' ||
    userRole === 'super_admin' ||
    userRole === 'sales_manager';

  const showPendingBanner =
    canConfirmPayments && pendingConfirmationCount > pendingDismissedCount;


  return (
    <div className="space-y-6">
      {/* Part payments pending (top-of-page banner) */}
      <PartPaymentRemindersBanner
        canMarkReceived={canConfirmPayments}
        onShowPendingList={() => setFilterByPartPayment('outstanding')}
        onOpenCustomer={(id) => {
          setSearchTerm(id);
        }}
      />


      {/* Pending payment confirmation banner (managers only) */}

      {showPendingBanner && (
        <div className="flex items-center justify-between gap-3 rounded-lg border-2 border-amber-400 bg-amber-50 px-4 py-3 shadow-sm">
          <div className="flex items-center gap-3">
            <div className="flex h-9 w-9 items-center justify-center rounded-full bg-amber-200 text-amber-900 text-lg">
              ⏳
            </div>
            <div>
              <div className="text-sm font-semibold text-amber-900">
                {pendingConfirmationCount} {pendingConfirmationCount === 1 ? 'order needs' : 'orders need'} payment confirmation
              </div>
              <div className="text-xs text-amber-800">
                Agent sales awaiting a manager to tick <strong>Confirm Payment</strong> once funds have cleared.
              </div>
            </div>
          </div>
          <div className="flex items-center gap-2">
            <Button
              size="sm"
              variant="outline"
              className="border-amber-500 bg-white text-amber-900 hover:bg-amber-100"
              onClick={() => {
                setFilterByStatus('pending');
                setSortBy('newest');
                const el = document.getElementById('customers-list-anchor');
                el?.scrollIntoView({ behavior: 'smooth', block: 'start' });
              }}
            >
              Review pending payments
            </Button>
            <button
              type="button"
              aria-label="Dismiss pending payments banner"
              title="Dismiss — will reappear only when new pending payments arrive"
              onClick={() => {
                try {
                  window.localStorage.setItem(
                    PENDING_DISMISS_KEY,
                    String(pendingConfirmationCount)
                  );
                } catch {}
                setPendingDismissedCount(pendingConfirmationCount);
              }}
              className="flex h-8 w-8 items-center justify-center rounded-md text-amber-900 hover:bg-amber-200"
            >
              <X className="h-4 w-4" />
            </button>
          </div>
        </div>
      )}
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
          <UnsubscribeQuickLink />
          <Button
            onClick={fetchCustomers}
            variant="outline"
            className="flex items-center space-x-2"
          >
            <RefreshCw className="h-4 w-4" />
            <span>Refresh</span>
          </Button>
          {(canExport || canExportFullCustomers) && (
            <DropdownMenu>
              <DropdownMenuTrigger asChild>
                <Button className="flex items-center space-x-2">
                  <Download className="h-4 w-4" />
                  <span>Export</span>
                </Button>
              </DropdownMenuTrigger>
              <DropdownMenuContent align="end">
                {(canExport || canExportFullCustomers) && (
                  <>
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
                  </>
                )}
                {canExportFullCustomers && (
                  <>
                    <DropdownMenuSeparator />
                    <DropdownMenuItem onClick={handleExportFullCsv}>
                      <FileSpreadsheet className="h-4 w-4 mr-2" />
                      Full Customer Export (visible rows)
                    </DropdownMenuItem>
                    <DropdownMenuSub>
                      <DropdownMenuSubTrigger>
                        <CalendarIcon className="h-4 w-4 mr-2" />
                        Quick date export
                      </DropdownMenuSubTrigger>
                      <DropdownMenuSubContent className="max-h-80 overflow-y-auto">
                        {quickRangeOptions.map(opt => (
                          <DropdownMenuItem
                            key={opt.filenameLabel}
                            onClick={() => exportForRange(opt.start, opt.end, opt.filenameLabel)}
                          >
                            {opt.label}
                          </DropdownMenuItem>
                        ))}
                      </DropdownMenuSubContent>
                    </DropdownMenuSub>
                    <DropdownMenuSub>
                      <DropdownMenuSubTrigger>
                        <CalendarIcon className="h-4 w-4 mr-2" />
                        Export by Month
                      </DropdownMenuSubTrigger>
                      <DropdownMenuSubContent className="max-h-80 overflow-y-auto">
                        {monthExportOptions.map(opt => (
                          <DropdownMenuItem
                            key={opt.filenameLabel}
                            onClick={() => exportForRange(opt.start, opt.end, opt.filenameLabel)}
                          >
                            {opt.label}
                          </DropdownMenuItem>
                        ))}
                      </DropdownMenuSubContent>
                    </DropdownMenuSub>
                    <DropdownMenuItem onSelect={(e) => { e.preventDefault(); setRangeExportOpen(true); }}>
                      <CalendarIcon className="h-4 w-4 mr-2" />
                      Custom date range…
                    </DropdownMenuItem>
                  </>
                )}
                {canExportFullCustomers && (
                  <>
                    <DropdownMenuSeparator />
                    <DropdownMenuItem onClick={handleExportGoogleConversions}>
                      <Download className="h-4 w-4 mr-2" />
                      Google Ads Conversions (GCLID)
                    </DropdownMenuItem>
                  </>
                )}
              </DropdownMenuContent>
            </DropdownMenu>
          )}

          <Dialog open={rangeExportOpen} onOpenChange={setRangeExportOpen}>
            <DialogContent className="max-w-md">
              <DialogHeader>
                <DialogTitle>Export customers by date range</DialogTitle>
              </DialogHeader>
              <div className="space-y-3">
                <p className="text-xs text-muted-foreground">
                  Exports all customers whose signup date falls within the selected range (inclusive).
                </p>
                <div className="grid grid-cols-2 gap-3">
                  <div>
                    <Label htmlFor="range-from" className="text-xs">From</Label>
                    <Input id="range-from" type="date" value={rangeExportFrom} onChange={(e) => setRangeExportFrom(e.target.value)} />
                  </div>
                  <div>
                    <Label htmlFor="range-to" className="text-xs">To</Label>
                    <Input id="range-to" type="date" value={rangeExportTo} onChange={(e) => setRangeExportTo(e.target.value)} />
                  </div>
                </div>
                <div className="flex justify-end gap-2 pt-2">
                  <Button variant="outline" onClick={() => setRangeExportOpen(false)}>Cancel</Button>
                  <Button onClick={handleRangeExportSubmit}>
                    <Download className="h-4 w-4 mr-2" /> Export CSV
                  </Button>
                </div>
              </div>
            </DialogContent>
          </Dialog>


          
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
          {/* Redesigned filter toolbar — Linear/Notion style */}
          {(() => {
            // Build active filter chips (only show non-defaults)
            const chips: { key: string; label: string; value: string; onRemove: () => void }[] = [];
            if (filterByStatus !== 'all') {
              const statusLabels: Record<string, string> = {
                active: 'Active', pending: 'Pending', cancelled: 'Cancelled',
                refunded: 'Refunded', cancelled_and_refunded: 'Cancelled & Refunded', claim_made: 'Claim Made',
              };
              chips.push({ key: 'status', label: 'Status', value: statusLabels[filterByStatus] || filterByStatus, onRemove: () => setFilterByStatus('all') });
            }
            if (filterByWarrantyPeriod !== 'all') {
              chips.push({ key: 'wlen', label: 'Length', value: `${parseInt(filterByWarrantyPeriod, 10) / 12} Year${filterByWarrantyPeriod === '12' ? '' : 's'}`, onRemove: () => setFilterByWarrantyPeriod('all') });
            }
            if (canSeeSourceColumn && filterBySource !== 'all_view') {
              const srcLabels: Record<string, string> = {
                website: 'Website (BAW)', website_google: 'Google web',
                google_all: 'Google all', google_leads_sales: 'Google leads',
                website_facebook: 'Website F',
                website_organic: 'Website O', staff_purchase: 'Staff', quote_order: 'Quote & Orders',
                agent_sales: 'Agent Sales', cancelled_refunded: 'Cancelled / Refunded',
                payment_due: 'Payment due (deposit)',
              };

              chips.push({ key: 'source', label: 'Source', value: srcLabels[filterBySource] || filterBySource, onRemove: () => setFilterBySource('all_view') });
            }
            if (filterByPaymentSource !== 'all') {
              const payLabels: Record<string, string> = { bumper: 'Bumper', stripe: 'Stripe', payment_assist: 'Payment Assist', paypal: 'PayPal', other: 'Other / Manual' };
              chips.push({ key: 'payment', label: 'Payment', value: payLabels[filterByPaymentSource] || filterByPaymentSource, onRemove: () => setFilterByPaymentSource('all') });
            }
            if (filterByAgent !== 'all') {
              const agent = adminUsers.find(u => u.id === filterByAgent);
              const agentName = filterByAgent === 'unassigned' ? 'Unassigned' : (agent ? (`${agent.first_name || ''} ${agent.last_name || ''}`.trim() || agent.email) : 'Selected');
              chips.push({ key: 'agent', label: 'Agent', value: agentName, onRemove: () => setFilterByAgent('all') });
            }

            const clearAll = () => {
              setSearchTerm('');
              setFilterByStatus('all');
              setSortBy('newest');
              setFilterByWarrantyPeriod('all');
              if (canSeeSourceColumn) setFilterBySource('all_view');
              setFilterByPaymentSource('all');
              setPaymentSourceDateFilter('all');
              setFilterByAgent('all');
              setTotalSalesDateFilter('all');
              setDateRange(undefined);
              setRevenueDateRange(undefined);
              setUnifiedScope('signup');
              setUnifiedPeriod('all');
              setUnifiedCustomRange(undefined);
            };

            const activeFilterCount = chips.length;
            return (
              <div className="bg-white rounded-lg border overflow-hidden">
                {/* Row 1: Date scope + results count */}
                {canUseDateFilter && (
                  <div className="flex items-center gap-3 px-4 py-2.5 border-b bg-muted/20 flex-wrap">
                    <span className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">Date</span>
                    <UnifiedDateFilter
                      scope={unifiedScope}
                      period={unifiedPeriod}
                      customRange={unifiedCustomRange}
                      availableScopes={
                        isSuperAdmin
                          ? ['signup', 'payment', 'deals', 'revenue']
                          : (isSalesAgent || isSalesScopedRole)
                            ? ['signup', 'deals']
                            : ['signup', 'payment', 'deals']
                      }
                      onChange={({ scope, period, customRange }) => {
                        setUnifiedScope(scope);
                        setUnifiedPeriod(period);
                        setUnifiedCustomRange(customRange);
                        setDateRange(undefined);
                        setRevenueDateRange(undefined);
                        setPaymentSourceDateFilter('all');
                        setTotalSalesDateFilter('all');
                        if (period === 'all') return;
                        const range = period === 'custom' ? customRange : periodToRange(period);
                        if (scope === 'signup') {
                          setDateRange(range);
                          setRevenueDateRange(range);
                        } else if (scope === 'revenue') {
                          setRevenueDateRange(range);
                        } else if (scope === 'payment' && period !== 'custom') {
                          setPaymentSourceDateFilter(period);
                        } else if (scope === 'deals' && period !== 'custom') {
                          setTotalSalesDateFilter(period);
                        }
                      }}
                    />
                    {/* Quick month/week navigators removed — use Custom range in the date filter above */}
                    {canToggleHColumns && (
                      <Button
                        variant="ghost"
                        size="sm"
                        onClick={() => {
                          const next = !(showPaymentColumn && showPurchaseSource);
                          setShowPaymentColumn(next);
                          setShowPurchaseSource(next);
                        }}
                        className="text-xs gap-1.5 h-8"
                        title={(showPaymentColumn && showPurchaseSource) ? 'Hide Payment & SRC columns' : 'Show Payment & SRC columns'}
                      >
                        {(showPaymentColumn && showPurchaseSource) ? <Eye className="h-3.5 w-3.5" /> : <EyeOff className="h-3.5 w-3.5" />}
                        H
                      </Button>
                    )}
                    {!isSalesAgent && (
                      <span className="text-xs text-muted-foreground ml-auto whitespace-nowrap">
                        <span className="font-semibold text-foreground">{filteredCustomers.length}</span> of {customers.length} results
                      </span>
                    )}
                  </div>
                )}


                {/* Row 2: Search + Filters + Sort — single compact toolbar */}
                <div className="flex items-center gap-2 px-4 py-2.5 flex-wrap border-b">
                  <div className="relative flex-1 min-w-[260px] max-w-md">
                    <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
                    <Input
                      id="search"
                      placeholder={isSalesScopedRole ? 'Search all customers — name, email, phone, reg…' : 'Search name, email, phone, reg…'}
                      value={searchTerm}
                      onChange={(e) => setSearchTerm(e.target.value)}
                      className="pl-9 h-9"
                    />
                  </div>

                  {isSalesScopedRole && (
                    <Badge
                      variant="outline"
                      className={debouncedSearchTerm
                        ? 'border-blue-300 bg-blue-50 text-blue-700 whitespace-nowrap'
                        : 'border-muted-foreground/30 text-muted-foreground whitespace-nowrap'}
                    >
                      {debouncedSearchTerm
                        ? 'Searching every customer — see “Assigned To” for the owner'
                        : 'Search finds any customer in the database'}
                    </Badge>
                  )}


                  {!isSalesAgent && canSeeSourceColumn && (
                    <Select value={filterBySource} onValueChange={setFilterBySource}>
                      <SelectTrigger className="h-9 w-[150px]"><SelectValue placeholder="Source" /></SelectTrigger>
                      <SelectContent className="max-w-[420px]">
                        <SelectItem value="all_view"><div className="flex items-center gap-2"><div className="w-2 h-2 rounded-full bg-gray-400" /><span>All Sources</span></div></SelectItem>
                        <SelectItem value="website"><div className="flex items-center gap-2"><div className="w-2 h-2 rounded-full bg-blue-500" /><span>Website (BAW)</span></div></SelectItem>
                        <SelectItem value="website_google"><div className="flex items-center gap-2"><div className="w-2 h-2 rounded-full bg-emerald-500" /><span>Google web (pure)</span></div></SelectItem>
                        <SelectItem value="google_all"><div className="flex items-center gap-2"><div className="w-2 h-2 rounded-full bg-emerald-600" /><span>Google all (web + leads)</span></div></SelectItem>
                        <SelectItem value="google_leads_sales"><div className="flex items-center gap-2"><div className="w-2 h-2 rounded-full bg-emerald-700" /><span>Google leads (agent)</span></div></SelectItem>
                        <SelectItem value="website_facebook"><div className="flex items-center gap-2"><div className="w-2 h-2 rounded-full bg-sky-500" /><span>Website F (Facebook)</span></div></SelectItem>
                        <SelectItem value="website_organic"><div className="flex items-center gap-2"><div className="w-2 h-2 rounded-full bg-amber-500" /><span>Website O (Organic)</span></div></SelectItem>
                        <SelectItem value="staff_purchase"><div className="flex items-center gap-2"><div className="w-2 h-2 rounded-full bg-green-500" /><span>Staff (BAW-S)</span></div></SelectItem>
                        <SelectItem value="quote_order"><div className="flex items-center gap-2"><div className="w-2 h-2 rounded-full bg-purple-500" /><span>Quote & Orders (ADM)</span></div></SelectItem>
                        <SelectItem value="agent_sales"><div className="flex items-center gap-2"><div className="w-2 h-2 rounded-full bg-orange-500" /><span>Agent Sales</span></div></SelectItem>
                        <SelectItem value="cancelled_refunded"><div className="flex items-center gap-2"><div className="w-2 h-2 rounded-full bg-red-500" /><span>Cancelled / Refunded</span></div></SelectItem>
                        <SelectItem value="payment_due"><div className="flex items-center gap-2"><div className="w-2 h-2 rounded-full bg-amber-500" /><span>Payment due (deposit)</span></div></SelectItem>
                      </SelectContent>
                    </Select>
                  )}

                  <Select value={filterByPartPayment} onValueChange={(v) => setFilterByPartPayment(v as any)}>
                    <SelectTrigger className="h-9 w-[160px]"><SelectValue placeholder="Part payment" /></SelectTrigger>
                    <SelectContent>
                      <SelectItem value="all">All part payments</SelectItem>
                      <SelectItem value="has">Has part payment plan</SelectItem>
                      <SelectItem value="outstanding">Balance outstanding</SelectItem>
                      <SelectItem value="completed">Part payment completed</SelectItem>
                    </SelectContent>
                  </Select>



                  {(currentAdminUser?.role === 'admin' || currentAdminUser?.role === 'super_admin' || currentAdminUser?.role === 'sales_lead' || currentAdminUser?.role === 'sales_manager' || currentAdminUser?.role === 'sales' || currentAdminUser?.role === 'lead_gen') && (
                    <Select value={filterByAgent} onValueChange={setFilterByAgent}>
                      <SelectTrigger className="h-9 w-[150px]"><SelectValue placeholder="Agent" /></SelectTrigger>
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
                            return (
                              <SelectItem key={user.id} value={user.id}>
                                {displayName} ({stats.sales}{stats.cancelled > 0 ? ` · ${stats.cancelled} refunds` : ''})
                              </SelectItem>
                            );
                          })}
                      </SelectContent>
                    </Select>
                  )}

                  {!isSalesAgent && (
                    <Select value={filterByPaymentSource} onValueChange={setFilterByPaymentSource}>
                      <SelectTrigger className="h-9 w-[140px]"><SelectValue placeholder="Payment" /></SelectTrigger>
                      <SelectContent>
                        <SelectItem value="all">All Payments</SelectItem>
                        <SelectItem value="bumper">Bumper</SelectItem>
                        <SelectItem value="stripe">Stripe</SelectItem>
                        <SelectItem value="payment_assist">Payment Assist</SelectItem>
                        <SelectItem value="paypal">PayPal</SelectItem>
                        <SelectItem value="other">Other / Manual</SelectItem>
                      </SelectContent>
                    </Select>
                  )}

                  {!isSalesAgent && (
                    <Select value={filterByWarrantyPeriod} onValueChange={setFilterByWarrantyPeriod}>
                      <SelectTrigger className="h-9 w-[130px]"><SelectValue placeholder="Length" /></SelectTrigger>
                      <SelectContent>
                        <SelectItem value="all">All Lengths</SelectItem>
                        <SelectItem value="12">1 Year</SelectItem>
                        <SelectItem value="24">2 Years</SelectItem>
                        <SelectItem value="36">3 Years</SelectItem>
                        <SelectItem value="48">4 Years</SelectItem>
                        <SelectItem value="60">5 Years</SelectItem>
                      </SelectContent>
                    </Select>
                  )}

                  <Select value={filterByStatus} onValueChange={setFilterByStatus}>
                    <SelectTrigger className="h-9 w-[130px]"><SelectValue placeholder="Status" /></SelectTrigger>
                    <SelectContent>
                      <SelectItem value="all">All Status</SelectItem>
                      <SelectItem value="active">Active</SelectItem>
                      <SelectItem value="pending">Pending</SelectItem>
                      <SelectItem value="cancelled">Cancelled</SelectItem>
                      <SelectItem value="refunded">Refunded</SelectItem>
                      <SelectItem value="cancelled_and_refunded">Cancelled & Refunded</SelectItem>
                      {!isSalesScopedRole && (<SelectItem value="claim_made">Claim Made</SelectItem>)}
                    </SelectContent>
                  </Select>

                  {!isSalesAgent && (
                    <Select value={sortBy} onValueChange={setSortBy}>
                      <SelectTrigger className="h-9 w-[150px] ml-auto"><SelectValue placeholder="Sort by" /></SelectTrigger>
                      <SelectContent>
                        <SelectItem value="newest">Newest first</SelectItem>
                        <SelectItem value="oldest">Oldest first</SelectItem>
                        <SelectItem value="highest_amount">Highest amount</SelectItem>
                        <SelectItem value="lowest_amount">Lowest amount</SelectItem>
                        <SelectItem value="name_az">Name (A–Z)</SelectItem>
                        <SelectItem value="name_za">Name (Z–A)</SelectItem>
                        <SelectItem value="email">Email (A–Z)</SelectItem>
                        <SelectItem value="plan">Plan</SelectItem>
                        <SelectItem value="reg">Reg plate</SelectItem>
                      </SelectContent>
                    </Select>
                  )}

                  {activeFilterCount > 0 && (
                    <button
                      type="button"
                      onClick={clearAll}
                      className="text-xs font-medium text-orange-600 hover:text-orange-700 hover:underline whitespace-nowrap"
                    >
                      Reset filters
                    </button>
                  )}
                </div>

                {/* Row 3: Active filter chips */}
                {chips.length > 0 && (
                  <div className="flex items-start gap-2 px-4 py-2 border-b bg-blue-50/40 flex-wrap">
                    <span className="text-xs font-semibold text-muted-foreground pt-1">Active</span>
                    <div className="flex items-center gap-1.5 flex-wrap flex-1">
                      {chips.map(chip => (
                        <button
                          key={chip.key}
                          type="button"
                          onClick={chip.onRemove}
                          className="group inline-flex items-center gap-1.5 h-7 pl-2.5 pr-1.5 rounded-full bg-blue-100 hover:bg-blue-200 text-blue-700 text-xs font-medium transition-colors"
                          title={`Remove ${chip.label} filter`}
                        >
                          <span>{chip.label}: {chip.value}</span>
                          <span className="inline-flex items-center justify-center w-4 h-4 rounded-full bg-blue-200 group-hover:bg-blue-300 text-blue-700 text-[10px] leading-none">✕</span>
                        </button>
                      ))}
                    </div>
                    <button
                      type="button"
                      onClick={clearAll}
                      className="text-xs text-blue-600 hover:text-blue-800 hover:underline font-medium whitespace-nowrap"
                    >
                      Clear all
                    </button>
                  </div>
                )}

                {/* Payment stats summary (only when payment filter is applied) */}
                {!isSalesAgent && (() => {
                  if (filterByPaymentSource === 'all' && paymentSourceDateFilter === 'all') return null;
                  // Use filteredCustomers so this respects the same date range, status,
                  // source, agent and other active filters as the table itself.
                  const stats = filteredCustomers.reduce((acc, customer) => {
                    const status = (customer.status || '').toLowerCase();
                    if (status === 'cancelled' || status === 'refunded') return acc;
                    acc.count += 1;
                    acc.total += Number(customer.final_amount) || 0;
                    return acc;
                  }, { count: 0, total: 0 });
                  return (
                    <div className="flex items-center gap-2 px-4 py-2 border-t">
                      <span className="text-xs text-muted-foreground">Payment filter total:</span>
                      <span className="text-emerald-600 font-bold text-sm whitespace-nowrap">
                        £{stats.total.toLocaleString('en-GB', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
                      </span>
                      <Badge variant="outline" className="text-xs whitespace-nowrap">
                        {stats.count} {stats.count === 1 ? 'sale' : 'sales'}
                      </Badge>
                    </div>
                  );
                })()}


                {/* Revenue stats badge — shown for any active date selection so admins always see the total for what they've filtered */}
                {isSuperAdmin && filteredRevenueStats && (() => {
                  const activeRange = revenueDateRange ?? dateRange;
                  let rangeLabel = 'all time';
                  if (activeRange?.from) {
                    const fromD = new Date(activeRange.from);
                    const toD = activeRange.to ? new Date(activeRange.to) : fromD;
                    rangeLabel = format(fromD, 'd MMM yyyy') === format(toD, 'd MMM yyyy')
                      ? format(fromD, 'd MMM yyyy')
                      : `${format(fromD, 'd MMM')} – ${format(toD, 'd MMM yyyy')}`;
                  }
                  const avg = filteredRevenueStats.count > 0
                    ? filteredRevenueStats.revenue / filteredRevenueStats.count
                    : 0;
                  const sourceSuffix = filterBySource && filterBySource !== 'all_view' ? ` per ${filteredRevenueStats.label.replace(/ sales$/, '')} sale` : ' per sale';
                  return (
                    <div className="flex items-center gap-2 px-4 py-2 border-t bg-emerald-50/40 flex-wrap">
                      <span className="text-xs font-medium text-muted-foreground flex items-center gap-1.5">
                        <CalendarIcon className="h-3.5 w-3.5" />
                        Total for {unifiedScope} ({rangeLabel}):
                      </span>
                      <span className="text-emerald-600 font-bold text-base whitespace-nowrap">
                        £{filteredRevenueStats.revenue.toLocaleString('en-GB', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
                      </span>
                      <Badge variant="outline" className="text-xs">
                        {filteredRevenueStats.count} {filteredRevenueStats.label}
                      </Badge>
                      {filteredRevenueStats.count > 0 && (
                        <span className="text-xs text-muted-foreground ml-2">
                          Avg price{sourceSuffix}: <span className="font-semibold text-foreground">£{avg.toLocaleString('en-GB', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}</span>
                        </span>
                      )}
                    </div>
                  );
                })()}
              </div>
            );
          })()}



            {/* Results Summary and Bulk Actions */}
            <div className="flex items-center justify-between text-sm text-muted-foreground p-3">

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
                              setArchiveSimpleConfirm(true);
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
                              setArchiveSimpleConfirm(false);
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
                              setArchiveSimpleConfirm(false);
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
                    setFilterBySource('all_view');
                    setFilterByAgent(isSalesScopedRole && effectiveAdminId ? effectiveAdminId : 'all');
                    setTotalSalesDateFilter(isSalesScopedRole ? 'all' : '30days');
                    setUnifiedScope('signup');
                    setUnifiedPeriod('all');
                    setUnifiedCustomRange(undefined);
                    setDateRange(undefined);
                    setRevenueDateRange(undefined);
                    setSelectedCustomers(new Set());
                  }}
                  className="text-xs"
                >
                  Clear Filters
                </Button>
              </div>
            </div>


          {/* H (Payment + SRC) toggle now lives inline with the Date row above. */}


      {/* Mobile-only card view for managers spot-checking on phones. Desktop table is unchanged. */}
      <CustomersMobileCards
        className="md:hidden mt-2"
        customers={customersPagination.paginatedData}
        onOpen={openCustomerDialog}
      />

      {/* Results Table (desktop) */}
      <div className="hidden md:block bg-white rounded-lg shadow overflow-hidden mt-2">

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
              <TableHead>Price</TableHead>
              {showPaymentColumn && <TableHead>Payment</TableHead>}
              <TableHead className="text-center bg-amber-50 min-w-[130px]" title="Upload a screenshot of the price comparison shown to the customer">Price Comp. Proof</TableHead>

              <TableHead>Assigned To</TableHead>
              {canSeeSourceColumn && showPurchaseSource && <TableHead className="bg-purple-50">SRC</TableHead>}
              <TableHead>Ref</TableHead>
              <TableHead>Email Status</TableHead>
              
              <TableHead>Status</TableHead>
              <TableHead>Make</TableHead>
              <TableHead>Model</TableHead>
              <TableHead>Vol. Excess</TableHead>
              <TableHead>Claim Limit</TableHead>
              <TableHead>Labour Rate</TableHead>
              <TableHead>Mileage</TableHead>
              <TableHead>Address</TableHead>
              <TableHead>RegDate</TableHead>
              <TableHead>WarType</TableHead>
              <TableHead>Dur.</TableHead>
              <TableHead>Start Date</TableHead>
              
              {!isSalesAgent && <TableHead className="bg-gradient-to-r from-amber-50 to-orange-50">Upgrade</TableHead>}
              <TableHead>Expiry Date</TableHead>
              {canSeeSourceColumn && showPurchaseSource && <TableHead className="bg-purple-50">Source</TableHead>}
              {isSuperAdmin && <TableHead className="bg-purple-50">Device</TableHead>}
              <TableHead>Claims Made</TableHead>
              <TableHead>Claims Paid</TableHead>
              <TableHead className="text-center bg-green-50">Trustpilot</TableHead>
              <TableHead className="text-center bg-blue-50">Google</TableHead>
              <TableHead>Tags</TableHead>
              <TableHead className="min-w-[200px]">Notes</TableHead>
              <TableHead>Actions</TableHead>


            </TableRow>

          </TableHeader>
          <TableBody>
            {filteredCustomers.length === 0 ? (
              <TableRow>
                <TableCell colSpan={38} className="text-center py-8">
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
                <TableRow key={customer.id} className={`${isDueToday(customer) ? 'bg-orange-50 border-l-4 border-l-orange-500' : ''} ${postedCustomerIds.has(customer.id) ? 'bg-emerald-50/60 border-l-4 border-l-emerald-500' : ''}`}>
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
                        <DialogContent className="max-w-4xl max-h-[90vh] overflow-y-auto" largeCloseButton>
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
                                  <RecentEmailsDialog
                                    customerEmail={selectedCustomer.email}
                                    customerName={selectedCustomer.name}
                                  />
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
                                            onClick={() => openCredentialsPreview('normal')}
                                            disabled={sendingCredentials || sendingApology}
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
                                          
                                          <Button
                                            onClick={() => openCredentialsPreview('apology')}

                                            disabled={sendingCredentials || sendingApology}
                                            variant="outline"
                                            className="flex-1"
                                          >
                                            {sendingApology ? (
                                              <>
                                                <div className="animate-spin rounded-full h-4 w-4 border-b-2 border-current mr-2"></div>
                                                Sending...
                                              </>
                                            ) : (
                                              <>
                                                <Heart className="h-4 w-4 mr-2" />
                                                Resend with apology
                                              </>
                                            )}
                                          </Button>
                                        </div>

                                        <Dialog
                                          open={credentialsPreview.open}
                                          onOpenChange={(open) => setCredentialsPreview((p) => ({ ...p, open }))}
                                        >
                                          <DialogContent className="max-w-2xl max-h-[90vh] overflow-y-auto">
                                            <DialogHeader>
                                              <DialogTitle>
                                                Preview email to {credentialsPreview.email}
                                              </DialogTitle>
                                            </DialogHeader>
                                            <div className="space-y-4">
                                              <div>
                                                <Label className="text-sm font-medium">From</Label>
                                                <div className="text-sm text-gray-600 mt-1">
                                                  Buyawarranty Customer Care &lt;noreply@buyawarranty.co.uk&gt;
                                                </div>
                                              </div>
                                              <div>
                                                <Label htmlFor="preview-subject" className="text-sm font-medium">Subject</Label>
                                                <Input
                                                  id="preview-subject"
                                                  value={credentialsPreview.subject}
                                                  onChange={(e) => setCredentialsPreview((p) => ({ ...p, subject: e.target.value }))}
                                                  className="mt-1"
                                                />
                                              </div>
                                              <div>
                                                <Label htmlFor="preview-body" className="text-sm font-medium">Message</Label>
                                                <Textarea
                                                  id="preview-body"
                                                  value={credentialsPreview.body}
                                                  onChange={(e) => setCredentialsPreview((p) => ({ ...p, body: e.target.value }))}
                                                  rows={18}
                                                  className="mt-1 font-mono text-sm"
                                                />
                                                <p className="text-xs text-gray-500 mt-1">
                                                  Edit anything above before sending. Line breaks will be preserved in the email.
                                                </p>
                                              </div>
                                              <div className="flex justify-end gap-2 pt-2">
                                                <Button
                                                  variant="outline"
                                                  onClick={() => setCredentialsPreview((p) => ({ ...p, open: false }))}
                                                  disabled={sendingCredentials || sendingApology}
                                                >
                                                  Cancel
                                                </Button>
                                                <Button
                                                  onClick={() => sendCredentialsEmail(
                                                    credentialsPreview.email,
                                                    credentialsPreview.mode,
                                                    { subject: credentialsPreview.subject, body: credentialsPreview.body }
                                                  )}
                                                  disabled={sendingCredentials || sendingApology || !credentialsPreview.subject.trim() || !credentialsPreview.body.trim()}
                                                >
                                                  {(sendingCredentials || sendingApology) ? (
                                                    <>
                                                      <div className="animate-spin rounded-full h-4 w-4 border-b-2 border-white mr-2"></div>
                                                      Sending...
                                                    </>
                                                  ) : (
                                                    <>
                                                      <Send className="h-4 w-4 mr-2" />
                                                      Send Email
                                                    </>
                                                  )}
                                                </Button>
                                              </div>
                                            </div>
                                          </DialogContent>
                                        </Dialog>
                                        
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

                              <Tabs defaultValue={searchParams.get('ctab') === 'part-payments' ? 'part-payments' : 'details'} className="w-full">
                                <TabsList className="grid w-full grid-cols-9">
                                  <TabsTrigger value="details">Customer Details</TabsTrigger>
                                  <TabsTrigger value="warranty">Warranty Details</TabsTrigger>
                                  <TabsTrigger value="part-payments">Part Payments</TabsTrigger>
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
                                           <ToggleGroupItem value="250" className="px-4 data-[state=on]:bg-primary data-[state=on]:text-primary-foreground">£250</ToggleGroupItem>
                                           <ToggleGroupItem value="500" className="px-4 data-[state=on]:bg-primary data-[state=on]:text-primary-foreground">£500</ToggleGroupItem>
                                         </ToggleGroup>
                                       </div>
 
                                       <div>
                                         <Label className="mb-2 block">Claim Limit</Label>
                                         <ToggleGroup 
                                           type="single" 
                                           value={editingCustomer.claim_limit?.toString() || '2000'} 
                                           onValueChange={(value) => value && setEditingCustomer({ ...editingCustomer, claim_limit: parseInt(value) })}
                                           className="justify-start flex-wrap gap-2"
                                         >
                                           <ToggleGroupItem value="750" className="px-4 data-[state=on]:bg-primary data-[state=on]:text-primary-foreground">£1,000</ToggleGroupItem>
                                           <ToggleGroupItem value="2000" className="px-4 data-[state=on]:bg-primary data-[state=on]:text-primary-foreground">£2,000</ToggleGroupItem>
                                           <ToggleGroupItem value="3000" className="px-4 data-[state=on]:bg-primary data-[state=on]:text-primary-foreground">£3,000</ToggleGroupItem>
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

                                          </ToggleGroup>
                                        </div>

                                        <div className="col-span-full">
                                          <Label className="mb-2 block">Optional Extended Cover (free months)</Label>
                                          {(() => {
                                            const coverYears = Math.max(1, Math.round((parseInt(String(editingCustomer.payment_type || '12').replace(/\D/g, '')) || 12) / 12));
                                            const months = Number((editingCustomer as any).seasonal_bonus_months || 0);
                                            const value: FreeCoverOption =
                                              months === 6 ? '6months'
                                                : months === 3 && coverYears !== 3 ? '3months'
                                                  : months > 0 && months === coverYears ? 'peryear'
                                                    : months === 3 ? '3months'
                                                      : 'none';
                                            return (
                                              <FreeMonthsOptions
                                                value={value}
                                                onChange={(next) => setEditingCustomer({
                                                  ...editingCustomer,
                                                  seasonal_bonus_months: bonusMonthsForOption(next, coverYears),
                                                } as any)}
                                                coverYears={coverYears}
                                                adminUserId={currentAdminIdForConcessions}
                                                hideHeader
                                              />
                                            );
                                          })()}
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
                                        <SmartDateInput
                                          id="edit-signup-date"
                                          value={editingCustomer.signup_date}
                                          onChange={(date) => setEditingCustomer({ ...editingCustomer, signup_date: date ? date.toISOString() : null })}
                                        />
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
                                        <SmartDateInput
                                          id="edit-start-date"
                                          value={editingCustomer.customer_policies?.[0]?.policy_start_date}
                                          onChange={(date) => {
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
                                        />
                                      </div>
                                      <div>
                                        <Label htmlFor="edit-expiry-date">Warranty Expiry Date</Label>
                                        <SmartDateInput
                                          id="edit-expiry-date"
                                          value={editingCustomer.customer_policies?.[0]?.policy_end_date}
                                          onChange={(date) => {
                                            if (date && editingCustomer.customer_policies && editingCustomer.customer_policies[0]) {
                                              const updatedPolicies = [...editingCustomer.customer_policies];
                                              updatedPolicies[0] = {
                                                ...updatedPolicies[0],
                                                policy_end_date: date.toISOString()
                                              };
                                              setEditingCustomer({ ...editingCustomer, customer_policies: updatedPolicies });
                                            }
                                          }}
                                        />
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
                                      {/* Tyre Cover removed — no longer offered */}
                                      {/* Wear & Tear Cover removed — no longer offered */}
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
                                      {/* MOT Repair removed — no longer offered */}
                                      {/* Lost Key Cover removed — no longer offered */}
                                      {/* Consequential Loss removed — no longer offered */}
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

                                     <div className="flex flex-wrap items-center gap-2 pt-1">
                                       <Button
                                         type="button"
                                         variant="outline"
                                         size="sm"
                                         onClick={() => {
                                           const generated = `Bw${Math.floor(1000 + Math.random() * 9000)}${['pine', 'rose', 'oak', 'sky'][Math.floor(Math.random() * 4)]}`;
                                           setEditingCustomer({ ...editingCustomer, temporary_password: generated });
                                         }}
                                       >
                                         Generate password
                                       </Button>
                                       <Button
                                         type="button"
                                         size="sm"
                                         disabled={savingPassword || !editingCustomer.email || !editingCustomer.temporary_password}
                                         onClick={() => setCustomerDashboardPassword(editingCustomer, editingCustomer.temporary_password || '')}
                                       >
                                         {savingPassword ? 'Updating…' : 'Set / update password'}
                                       </Button>
                                       {editingCustomer.temporary_password ? (
                                         <Button
                                           type="button"
                                           variant="ghost"
                                           size="sm"
                                           onClick={() => {
                                             navigator.clipboard.writeText(editingCustomer.temporary_password || '');
                                             toast.success('Password copied');
                                           }}
                                         >
                                           Copy
                                         </Button>
                                       ) : null}
                                       <span className="text-xs text-muted-foreground">
                                         Applies immediately — no need to save the record first.
                                       </span>
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
                                        <div className="flex justify-end items-center gap-2">
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
                                      
                                    </div>
                                  ) : (
                                    <div className="text-center text-gray-500 py-8">
                                      No warranty policies found for this customer
                                    </div>
                                  )}
                                </TabsContent>

                                <TabsContent value="part-payments">
                                  {selectedCustomer && (
                                    <PartPaymentsPanel
                                      customerId={selectedCustomer.id}
                                      customerName={selectedCustomer.name}
                                      orderTotal={Number(selectedCustomer.final_amount ?? 0) || null}
                                    />
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

                              {/* Always-available save footer — edits made on any tab
                                  (warranty details, payment fields, etc.) can be saved
                                  without switching back to Customer Details. */}
                              <div className="sticky bottom-0 -mx-6 mt-4 flex items-center justify-end gap-2 border-t bg-background/95 px-6 py-3 backdrop-blur">
                                <span className="mr-auto text-xs text-muted-foreground">
                                  Changes on any tab are saved together.
                                </span>
                                <Button variant="outline" onClick={() => setEditingCustomer(null)}>
                                  Close
                                </Button>
                                <Button onClick={updateCustomer}>
                                  <Save className="h-4 w-4 mr-2" />
                                  Save Changes
                                </Button>
                              </div>

                            </>
                          )}
                        </DialogContent>
                      </Dialog>
                      <div className="flex items-center justify-between gap-2 w-full">
                        <div className="flex items-center gap-1.5 flex-wrap">
                          <span className="font-medium">{customer.name}</span>
                          {(() => {
                            const em = (customer.email || '').toLowerCase();
                            const rg = ((customer as any).registration_plate || '').replace(/\s+/g, '').toUpperCase();
                            const hasClaim = (em && claimEmails.has(em)) || (rg && claimRegs.has(rg));
                            return hasClaim ? (
                              <Badge
                                variant="outline"
                                className="h-5 px-1.5 text-[10px] font-semibold uppercase tracking-wide border-amber-500 text-amber-700 bg-amber-50"
                                title="This customer has submitted a claim"
                              >
                                Claim made
                              </Badge>
                            ) : null;
                          })()}
                          {(() => {
                            const plan = partPaymentPlans.get(customer.id);
                            if (!plan) return null;
                            const outstanding = Math.max(plan.total_due - plan.paid, 0);
                            const done = plan.status === 'completed' || outstanding <= 0;
                            return (
                              <Badge
                                variant="outline"
                                className={`h-5 px-1.5 text-[10px] font-semibold uppercase tracking-wide ${
                                  done
                                    ? 'border-emerald-500 text-emerald-700 bg-emerald-50'
                                    : 'border-orange-500 text-orange-700 bg-orange-50'
                                }`}
                                title={
                                  done
                                    ? 'Part payment plan settled in full'
                                    : `Part payment plan — £${outstanding.toFixed(2)} outstanding of £${plan.total_due.toFixed(2)}`
                                }
                              >
                                {done ? 'Part paid · settled' : `Part payment · £${outstanding.toFixed(0)} due`}
                              </Badge>
                            );
                          })()}
                          {customer.is_manual_entry && customer.payment_verified === false && (
                              <Button
                                variant="ghost"
                                size="sm"
                                onClick={async (e) => {
                                  e.stopPropagation();
                                  // Only truly blocking gaps stop a confirmation — the
                                  // amount can come from the customer record or the policy.
                                  const policyAmt = Number((customer as any).customer_policies?.[0]?.payment_amount ?? 0);
                                  const amountOk =
                                    Number((customer as any).original_amount) > 0 ||
                                    Number((customer as any).final_amount) > 0 ||
                                    policyAmt > 0;
                                  const missing: string[] = [];
                                  if (!customer.payment_type) missing.push('Duration');
                                  if (!amountOk) missing.push('Original Amount');
                                  if (missing.length > 0) {
                                    toast.error(`Cannot confirm payment — missing: ${missing.join(', ')}`, {
                                      description: 'Open the customer edit dialog and complete all Warranty & Payment Details first.',
                                    });
                                    return;
                                  }

                                  if (!window.confirm(`Confirm payment received for ${customer.name}?`)) return;
                                  const nowIso = new Date().toISOString();
                                  const { error: cErr } = await supabase
                                    .from('customers')
                                    .update({ payment_verified: true, payment_confirmed_by: currentAdminUser?.id, updated_at: nowIso })
                                    .eq('id', customer.id);
                                  if (cErr) { toast.error(`Failed to confirm payment: ${cErr.message}`); return; }
                                  await supabase
                                    .from('customer_policies')
                                    .update({ payment_verified: true, updated_at: nowIso })
                                    .eq('customer_id', customer.id);
                                  toast.success('Payment confirmed');
                                  fetchCustomers();
                                }}

                                className="h-5 px-2 text-[10px] gap-1 bg-amber-100 hover:bg-amber-200 text-amber-900 border border-amber-400 rounded font-semibold animate-pulse"
                                title="Click to confirm payment received"
                              >
                                ⏳ Confirm Payment
                              </Button>
                          )}
                          {!!(customer as any).deposit_taken && !(customer as any).payment_collected_at && (
                            <Badge
                              className="bg-amber-500 text-white text-[10px] px-1.5 py-0 h-4 font-bold"
                              title={`Deposit £${Number((customer as any).deposit_amount || 0)} taken on Stripe · balance £${Number((customer as any).balance_due_amount || 0)} outstanding`}
                            >
                              💰 PAYMENT DUE £{Number((customer as any).balance_due_amount || 0)}
                            </Badge>
                          )}
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
                          {(currentAdminUser?.role === 'super_admin' || currentAdminUser?.role === 'admin') && (
                            <Button
                              variant="ghost"
                              size="sm"
                              onClick={(e) => { e.stopPropagation(); setAddClaimCustomer(customer); }}
                              className="h-5 px-1.5 text-[10px] gap-1 text-amber-700 hover:text-amber-900 hover:bg-amber-50 border border-amber-300 rounded"
                              title="Add claim for this customer"
                            >
                              <FileText className="h-3 w-3" />
                              + Claim
                            </Button>
                          )}
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
                      <a
                        href={`tel:${normalisePhone(customer.phone)}`}
                        className="text-foreground text-sm inline-flex items-center gap-1 hover:underline"
                        aria-label={`Call ${customer.phone}`}
                      >
                        <Phone className="h-3 w-3" />
                        {customer.phone}
                      </a>
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
                    <div className="flex items-center gap-1.5 flex-wrap">
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
                      {isNorthernIrelandPlate(customer.registration_plate) && !(customer as any).ni_verified && (
                        <div className="flex items-center gap-1">
                          <Badge className="bg-amber-500 text-white border-amber-600 text-[10px] font-bold animate-pulse">
                            ⚠ VERIFY vehicle (NI)
                          </Badge>
                          <Button
                            size="sm"
                            variant="outline"
                            className="h-5 px-1.5 text-[10px] border-amber-500 text-amber-800 hover:bg-amber-50"
                            title="Mark this NI vehicle as manually verified"
                            onClick={async (e) => {
                              e.stopPropagation();
                              const { data: auth } = await supabase.auth.getUser();
                              const { error } = await supabase
                                .from('customers')
                                .update({
                                  ni_verified: true,
                                  ni_verified_at: new Date().toISOString(),
                                  ni_verified_by: auth?.user?.id ?? null,
                                } as any)
                                .eq('id', customer.id);
                              if (error) {
                                toast.error('Could not mark as verified');
                              } else {
                                toast.success('NI vehicle marked as verified');
                                fetchCustomers();
                              }
                            }}
                          >
                            Mark verified
                          </Button>
                        </div>
                      )}
                    </div>
                  </TableCell>
                  <TableCell>
                    {customer.final_amount != null ? (
                      <span className="text-sm font-semibold text-emerald-700 whitespace-nowrap">
                        £{Number(customer.final_amount).toLocaleString('en-GB', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
                      </span>
                    ) : (
                      <span className="text-xs text-muted-foreground">—</span>
                    )}
                  </TableCell>
                  {showPaymentColumn && (
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
                  )}
                  <TableCell className="text-center bg-amber-50/40">
                    <PriceComparisonProofCell
                      customerId={customer.id}
                      currentPath={(customer as any).price_comparison_proof_url}
                    />
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
                  {canSeeSourceColumn && showPurchaseSource && (
                    <TableCell className="bg-purple-50/30">
                      {(() => {
                        // Use acquisition_source (marketing channel from sales_leads), not purchase_source (payment method).
                        const channel = getCustomerAcquisitionChannel(customer);
                        const utmLines: string[] = [];
                        if (customer.utm_source)   utmLines.push(`UTM Source: ${customer.utm_source}`);
                        if (customer.utm_medium)   utmLines.push(`UTM Medium: ${customer.utm_medium}`);
                        if (customer.utm_campaign) utmLines.push(`UTM Campaign: ${customer.utm_campaign}`);
                        if (customer.utm_term)     utmLines.push(`UTM Term: ${customer.utm_term}`);
                        if (customer.utm_content)  utmLines.push(`UTM Content: ${customer.utm_content}`);
                        const utmTip = utmLines.length ? `\n${utmLines.join('\n')}` : '';
                        const cursor = utmLines.length ? 'cursor-help' : '';
                        if (channel === 'google_ads') {
                          return <Badge title={`Google Ads${utmTip}`} className={`bg-emerald-100 text-emerald-800 border-emerald-200 text-[10px] ${cursor}`}>Google</Badge>;
                        }
                        if (channel === 'facebook_ads') {
                          return <Badge title={`Facebook Ads${utmTip}`} className={`bg-blue-100 text-blue-700 border-blue-200 text-[10px] ${cursor}`}>Facebook</Badge>;
                        }
                        if (channel === 'website') {
                          return <Badge title={`Direct/Website${utmTip}`} className={`bg-gray-100 text-gray-700 border-gray-200 text-[10px] ${cursor}`}>Direct/Website</Badge>;
                        }
                        if (channel === 'manual') {
                          return <Badge className="bg-amber-100 text-amber-800 border-amber-200 text-[10px]" title="Manual back-office sale — no marketing source recorded">Manual</Badge>;
                        }
                        return <Badge title={`Unknown${utmTip}`} className={`bg-gray-100 text-gray-500 border-gray-200 text-[10px] ${cursor}`}>Unknown</Badge>;
                      })()}
                    </TableCell>
                  )}
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
                  <TableCell>
                    <div className="flex items-center gap-1">
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
                    </div>
                  </TableCell>
                  <TableCell>
                    <div className="flex items-center gap-1">
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
                    </div>
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
                  <TableCell className="max-w-xs truncate">
                    {customer.street || customer.town || customer.postcode 
                      ? `${customer.street || ''} ${customer.town || ''} ${customer.postcode || ''}`.trim()
                      : 'N/A'
                    }
                  </TableCell>
                  <TableCell className="text-center">
                    <span className={customer.vehicle_year ? 'text-gray-900' : 'text-gray-400'}>
                      {customer.vehicle_year || 'N/A'}
                    </span>
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
                      {canSeeSourceColumn && showPurchaseSource && (
                        <TableCell className="bg-purple-50/30">
                          <PurchaseSourceBadge 
                            source={customer.purchase_source} 
                            bumperOrderId={customer.bumper_order_id}
                            stripeSessionId={customer.stripe_session_id}
                          />
                        </TableCell>
                      )}
                      {isSuperAdmin && (
                        <TableCell className="bg-purple-50/30">
                          {customer.device_type ? (
                            <Badge
                              className={
                                customer.device_type === 'mobile'
                                  ? 'bg-blue-100 text-blue-700 border-blue-200 text-[10px] capitalize'
                                  : customer.device_type === 'tablet'
                                  ? 'bg-amber-100 text-amber-700 border-amber-200 text-[10px] capitalize'
                                  : 'bg-slate-100 text-slate-700 border-slate-200 text-[10px] capitalize'
                              }
                            >
                              {customer.device_type}
                            </Badge>
                          ) : (
                            <span className="text-xs text-muted-foreground">—</span>
                          )}
                        </TableCell>
                      )}
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
                          <div className="flex flex-col gap-1">
                            <CustomerTagsDisplay customerId={customer.id} maxVisible={2} />
                            {postedCustomerIds.has(customer.id) && (
                              <span className="inline-flex items-center gap-1 text-[10px] font-semibold text-emerald-700 bg-emerald-100 border border-emerald-300 rounded px-1.5 py-0.5 w-fit">
                                <Send className="h-2.5 w-2.5" />
                                Posted
                              </span>
                            )}
                          </div>
                        </TableCell>
                        <TableCell className="max-w-[240px]">
                          {customer.contact_notes ? (
                            <div
                              className="text-xs text-gray-700 whitespace-pre-wrap line-clamp-3"
                              title={customer.contact_notes}
                            >
                              {customer.contact_notes}
                            </div>
                          ) : (
                            <span className="text-xs text-gray-400 italic">No notes</span>
                          )}
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

                        {/* Quick mark as posted */}
                        <Button
                          variant="ghost"
                          size="sm"
                          onClick={() => markCustomerAsPosted(customer)}
                          title={postedCustomerIds.has(customer.id) ? 'Mark as posted again (logs another entry)' : 'Mark documents as posted'}
                          className={postedCustomerIds.has(customer.id)
                            ? 'text-emerald-700 hover:bg-emerald-50'
                            : 'hover:bg-emerald-50 hover:text-emerald-700'}
                        >
                          <Send className="h-4 w-4" />
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
                                  setArchiveSimpleConfirm(true);
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
                                  setArchiveSimpleConfirm(false);
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
                                  setArchiveSimpleConfirm(false);
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
                      <TableHead className="bg-sky-50 min-w-[130px] cursor-pointer select-none" title="Time from the lead arriving to the sale being completed">
                        <button
                          type="button"
                          onClick={() =>
                            setTimeToLeadSort((prev) => (prev === 'desc' ? 'asc' : prev === 'asc' ? null : 'desc'))
                          }
                          className="inline-flex items-center gap-1 hover:text-sky-900"
                        >
                          Time to Lead
                          {timeToLeadSort === 'desc' ? (
                            <ArrowDown className="h-3.5 w-3.5 text-sky-700" />
                          ) : timeToLeadSort === 'asc' ? (
                            <ArrowUp className="h-3.5 w-3.5 text-sky-700" />
                          ) : (
                            <ArrowUpDown className="h-3 w-3 text-muted-foreground/50" />
                          )}
                        </button>
                      </TableHead>
                      <TableHead className="bg-indigo-50 min-w-[140px] cursor-pointer select-none" title="Time from the lead arriving to the first agent contact (call logged, note added or status change)">
                        <button
                          type="button"
                          onClick={() =>
                            setInitialContactSort((prev) => (prev === 'desc' ? 'asc' : prev === 'asc' ? null : 'desc'))
                          }
                          className="inline-flex items-center gap-1 hover:text-indigo-900"
                        >
                          Initial Contact
                          {initialContactSort === 'desc' ? (
                            <ArrowDown className="h-3.5 w-3.5 text-indigo-700" />
                          ) : initialContactSort === 'asc' ? (
                            <ArrowUp className="h-3.5 w-3.5 text-indigo-700" />
                          ) : (
                            <ArrowUpDown className="h-3 w-3 text-muted-foreground/50" />
                          )}
                        </button>
                      </TableHead>
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
          setArchiveSimpleConfirm(false);
        }}
        customers={archiveCustomers}
        simpleConfirm={archiveSimpleConfirm}
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

      {/* Add Claim Dialog (admin/super_admin) */}
      {addClaimCustomer && (
        <AddClaimDialog
          open={!!addClaimCustomer}
          onOpenChange={(open) => { if (!open) setAddClaimCustomer(null); }}
          customerEmail={addClaimCustomer.email}
          customerName={addClaimCustomer.name}
          vehicleReg={addClaimCustomer.registration_plate}
          onClaimAdded={() => { setAddClaimCustomer(null); fetchCustomers(); }}
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
