import React, { memo, useState, useCallback, useMemo, useEffect } from 'react';
import { PaidLeadLockOverlay } from './PaidLeadLockOverlay';
import { formatLeadDateUK } from '@/lib/leadFeedDate';
import { WEBSITE_SALES_ACCOUNT_ID } from '@/constants/salesDefaults';
import { CommissionClaimDialog } from './CommissionClaimDialog';
import { useLeadCommissionClaim } from '@/hooks/useLeadCommissionClaims';
import { Lead, LeadStatus, LeadPriority, LeadTag, AdminUser } from '@/hooks/useLeads';
import { SentQuote } from '@/hooks/useLeadQuotes';
import { detectSuspiciousLead, isSuspicious } from '@/utils/suspiciousLeadDetection';
import { TableCell, TableRow } from '@/components/ui/table';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Select, SelectContent, SelectGroup, SelectItem, SelectLabel, SelectSeparator, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover';
import { Calendar } from '@/components/ui/calendar';
import { Tooltip, TooltipContent, TooltipTrigger } from '@/components/ui/tooltip';
import { Checkbox } from '@/components/ui/checkbox';
import { RemindMePopover } from './RemindMePopover';
import { CopyButton } from './CopyButton';
import { ZoiperDialButton } from './ZoiperDialButton';
import { dialWithZoiper } from '@/utils/zoiperDial';
import { EmailActionsButton } from './EmailActionsButton';
import { CallCountCell } from './CallCountCell';
import { NotesQuickActionsPopover } from './NotesQuickActionsPopover';
import { RetryCountdownBadge } from './RetryCountdownBadge';
import { OvernightBadge } from './OvernightBadge';
import { QuoteSentCell } from './QuoteSentCell';
import { CustomerActivityCell } from './CustomerActivityCell';
import { TimeToContactCell } from './TimeToContactCell';
import { UnsubscribeLeadButton } from './UnsubscribeLeadButton';
import { RepeatCustomerBadge } from './RepeatCustomerBadge';
import { ManualLeadBadge } from './ManualLeadBadge';

import { 
  Phone, Mail, MessageSquare, Calendar as CalendarIcon, Clock,
  Tag, AlertTriangle, FileText, StickyNote, NotebookPen,
  CheckCircle, ChevronDown, Send, ExternalLink, Flame, X, Plus, User, RotateCw, Award, Globe, Copy, Check
} from 'lucide-react';
import { useNavigate } from 'react-router-dom';
import { supabase } from '@/integrations/supabase/client';
import { toast } from 'sonner';
import { format, formatDistanceToNow, isPast, differenceInHours, differenceInDays, isToday } from 'date-fns';
import { cn } from '@/lib/utils';
import { TeamBadge } from './TeamBadge';
import { useAgentTeams } from '@/hooks/useAgentTeams';
import { useAllAdminUsersMap } from '@/hooks/useAllAdminUsersMap';
import { getAgentColor } from '@/lib/agentColors';

interface LeadTableRowProps {
  lead: Lead;
  tags: LeadTag[];
  salesUsers: AdminUser[];
  /** Optional cross-team roster used to populate the in-row assignee dropdown.
   *  Managers (admin / super_admin / sales_manager / performance_manager) pass the
   *  full active agent list so they can reassign any lead to any team.
   *  Falls back to `salesUsers` when not provided. */
  assignableSalesUsers?: AdminUser[];
  isSelected: boolean;
  isExpanded: boolean;
  sentQuotes?: SentQuote[];
  onSelect: () => void;
  onToggleExpand: () => void;
  onUpdateStatus: (status: LeadStatus) => void;
  onAssign: (userId: string | null) => void;
  onAutoAssign: () => void;
  onUpdatePriority: (priority: LeadPriority) => void;
  onScheduleFollowUp: (actionType: string, actionDate: string) => void;
  onAddTag: (tagId: string) => void;
  onRemoveTag: (tagId: string) => void;
  onLogActivity: (type: string, description: string) => void;
  onUpdateCallCount: (increment: number) => void;
  onSendQuote?: () => void;
  hideAssignedColumn?: boolean;
  canAssignLeads?: boolean;
  /** Viewer has explicit lead-routing permission, so website-sale locks don't apply. */
  canOverrideAssignmentLock?: boolean;
  noteCount?: number;
  agentActivity?: { lastAt: string; source: 'note' | 'call' | 'status' };
  showFbBadge?: boolean;
  showRecoveredBadge?: boolean;
  showSourceColumn?: boolean;
  isPaidLocked?: boolean;
  hasPendingAccessRequest?: boolean;
  hasApprovedAccess?: boolean;
  onRequestAccess?: (reason: string) => void;
  isLeadGenView?: boolean;
  userRole?: string | null;
  reminderTime?: string;
  struggleAlert?: { signal_type: string; created_at: string } | null;
  /** Hide the "New" option from the status dropdown (e.g. Recontact / Renewals tabs). */
  hideNewStatus?: boolean;
  /** Open Lead Pool: pin this row with mint styling + quiet countdown chip. */
  isReserved?: boolean;
  reservedRemainingSec?: number;
  /**
   * Recontact tab: suppress the "status=new + >24h old" SLA-overdue red tint
   * (every recontact lead is 30+ days old by definition, so the SLA colour is
   * meaningless there). Instead, only tint red when the lead has been sitting
   * with the *current* agent for >24h without a note/call.
   */
  recontactMode?: boolean;
  /** admin_users.id of the viewer — used by recontactMode to score "sitting with me". */
  currentAdminId?: string | null;
  /** 1-based row number rendered in the leftmost column for easy counting. */
  rowNumber?: number;
  /** Cross-team visibility: viewer can see this lead but not edit it. Shows a
   *  "VIEW ONLY" chip and dims interactive controls. */
  readOnly?: boolean;
  /** Latest customer-side activity (last quote, step 2, portal login, etc.) */
  customerActivity?: import('@/hooks/useCustomerActivity').CustomerActivity;
  /** Time from lead arrival to the agent's first action on it. */
  responseTime?: import('@/hooks/useLeadResponseTime').LeadResponseTime;
  /** Set when this lead matches an existing customer (previous purchase). */
  repeatCustomer?: import('@/hooks/useRepeatCustomers').RepeatCustomerInfo;
}

const statusColors: Record<LeadStatus, string> = {
  new: 'bg-green-100 text-green-800',
  contacted: 'bg-yellow-100 text-yellow-800',
  follow_up: 'bg-purple-100 text-purple-800',
  quote_sent: 'bg-indigo-100 text-indigo-800',
  negotiating: 'bg-orange-100 text-orange-800',
  converted: 'bg-teal-100 text-teal-800',
  lost: 'bg-gray-100 text-gray-800',
  not_interested: 'bg-slate-200 text-slate-700',
  fake_lead: 'bg-red-100 text-red-800',
  urgent_callback: 'bg-red-500 text-white',
  no_answer: 'bg-amber-100 text-amber-800',
  left_voicemail: 'bg-sky-100 text-sky-800',
  wrong_number: 'bg-rose-100 text-rose-800',
  callback_booked: 'bg-blue-100 text-blue-800',
  bought_elsewhere: 'bg-zinc-200 text-zinc-800',
  vehicle_sold: 'bg-stone-200 text-stone-800',
  do_not_contact: 'bg-black text-white',
};

const statusLabels: Record<LeadStatus, string> = {
  new: 'Not spoken to',
  contacted: 'Spoken to',
  follow_up: 'Follow-up',
  quote_sent: 'Quote sent',
  negotiating: 'Negotiating',
  converted: 'Converted',
  lost: 'Lost',
  not_interested: 'Not interested',
  fake_lead: 'Fake / 404',
  urgent_callback: 'Urgent call-back',
  no_answer: 'No answer',
  left_voicemail: 'Left voicemail',
  wrong_number: 'Wrong number',
  callback_booked: 'Callback booked',
  bought_elsewhere: 'Bought elsewhere',
  vehicle_sold: 'Vehicle sold',
  do_not_contact: 'Do not contact',
};

const formatUKPhone = (phone: string): string => {
  const cleaned = phone.replace(/\s/g, '');
  if (cleaned.startsWith('07') && cleaned.length === 11) {
    return `${cleaned.slice(0, 5)} ${cleaned.slice(5, 8)} ${cleaned.slice(8)}`;
  }
  if (cleaned.startsWith('+44') && cleaned.length >= 12) {
    const withoutCode = cleaned.slice(3);
    return `+44 ${withoutCode.slice(0, 4)} ${withoutCode.slice(4, 7)} ${withoutCode.slice(7)}`;
  }
  return phone;
};

const formatMileageTier = (mileage: string): string => {
  const numericMileage = parseInt(mileage.replace(/,/g, ''), 10);
  if (isNaN(numericMileage)) return mileage;
  if (numericMileage >= 120000) return 'Over 120k';
  return 'Up to 120k';
};

const getUrgencySLA = (lead: Lead): { label: string; color: string; priority: number } => {
  if (lead.next_action_date) {
    const actionDate = new Date(lead.next_action_date);
    if (isPast(actionDate)) {
      return { label: 'Overdue', color: 'bg-red-500 text-white', priority: 0 };
    }
    if (isToday(actionDate)) {
      return { label: 'Due today', color: 'bg-amber-500 text-white', priority: 1 };
    }
    const daysUntil = differenceInDays(actionDate, new Date());
    if (daysUntil === 1) {
      return { label: 'Due tomorrow', color: 'bg-yellow-400 text-yellow-900', priority: 2 };
    }
    return { label: `Due in ${daysUntil}d`, color: 'bg-green-100 text-green-800', priority: 3 };
  }
  
  const createdDate = new Date(lead.created_at);
  const hoursOld = differenceInHours(new Date(), createdDate);
  
  if (lead.status === 'new') {
    if (hoursOld > 24) {
      return { label: 'Overdue', color: 'bg-red-500 text-white', priority: 0 };
    }
    if (hoursOld > 4) {
      return { label: 'Due today', color: 'bg-amber-500 text-white', priority: 1 };
    }
    return { label: 'Not spoken to', color: 'bg-blue-100 text-blue-800', priority: 2 };
  }
  
  // Closed/resolved leads don't need action
  if (lead.status === 'converted' || lead.status === 'lost' || lead.status === 'not_interested' || lead.status === 'fake_lead') {
    const labelMap: Record<string, string> = { converted: 'Converted', lost: 'Lost', not_interested: 'Not interested', fake_lead: 'Fake 404' };
    return { label: labelMap[lead.status] || lead.status, color: 'bg-gray-100 text-gray-600', priority: 5 };
  }
  
  return { label: 'Action needed', color: 'bg-orange-100 text-orange-700', priority: 4 };
};

const getRowUrgencyClass = (
  lead: Lead,
  reminderTime?: string,
  recontactMode?: boolean,
  currentAdminId?: string | null,
): string => {
  if (lead.is_paid) return 'bg-green-50 hover:bg-green-100/70';
  if ((lead.resubmission_count || 0) > 0) return 'bg-purple-50 hover:bg-purple-100/70';

  // Reminder-based urgency colouring (kept in every tab)
  if (reminderTime) {
    const reminderDate = new Date(reminderTime);
    if (isPast(reminderDate)) {
      return 'bg-red-50 hover:bg-red-100/70';
    }
    if (isToday(reminderDate)) {
      return 'bg-amber-50 hover:bg-amber-100/70';
    }
  }

  if (recontactMode) {
    // Option 2: tint red if the lead has been sitting with THIS agent for
    // >24h without any note/call/resubmit signal. Uses assigned_at as the
    // "landed with me" timestamp. Falls back to no tint otherwise.
    if (currentAdminId && lead.assigned_to === currentAdminId && lead.assigned_at) {
      const lastTouch = new Date(
        lead.last_activity_date || lead.last_contacted_at || lead.assigned_at
      ).getTime();
      const assignedTime = new Date(lead.assigned_at).getTime();
      const referenceTime = Math.max(lastTouch, assignedTime);
      const hoursSinceTouch = (Date.now() - referenceTime) / 3_600_000;
      if (hoursSinceTouch >= 24) return 'bg-red-50 hover:bg-red-100/70';
    }
    if (lead.is_from_abandoned_cart) return 'bg-amber-50/30 hover:bg-amber-100/50';
    return 'hover:bg-muted/50';
  }

  const sla = getUrgencySLA(lead);
  if (sla.priority === 0) return 'bg-red-50 hover:bg-red-100/70';
  if (sla.priority === 1) return 'bg-amber-50 hover:bg-amber-100/70';
  if (lead.is_from_abandoned_cart) return 'bg-amber-50/30 hover:bg-amber-100/50';
  return 'hover:bg-muted/50';
};

// Memoized phone text component
// Renders the number as a tel: link so click-to-dial works natively (and Zoiper
// Click2Dial can still enhance it). A sibling copy button lets agents copy the
// number to the clipboard for paste into any other dialer.
const PhoneCopyText = memo<{ phone: string; leadId?: string | null }>(({ phone, leadId }) => {
  const telHref = `tel:${phone.replace(/[^\d+]/g, '')}`;
  const [copied, setCopied] = useState(false);

  const handleDial = useCallback((e: React.MouseEvent) => {
    // Middle-click or modifier keys keep native behaviour so power users can
    // still open the tel: link in a new tab / their OS default handler.
    if (e.button !== 0 || e.metaKey || e.ctrlKey || e.shiftKey || e.altKey) return;
    e.preventDefault();
    e.stopPropagation();
    dialWithZoiper(phone, { leadId: leadId ?? null, leadType: 'sales_lead' });
    navigator.clipboard?.writeText(phone.replace(/[^\d+]/g, '')).catch(() => { /* noop */ });
    toast.success('Dialling via Zoiper', {
      duration: 2500,
      description: "If Zoiper didn't open, the number is on your clipboard.",
    });
  }, [phone, leadId]);

  const handleCopy = useCallback(async (e: React.MouseEvent) => {
    e.preventDefault();
    e.stopPropagation();
    try {
      await navigator.clipboard.writeText(phone);
      setCopied(true);
      toast.success('Phone number copied', { duration: 1500 });
      setTimeout(() => setCopied(false), 2000);
    } catch {
      toast.error('Failed to copy');
    }
  }, [phone]);

  return (
    <span className="inline-flex items-center gap-1 whitespace-nowrap">
      <Tooltip delayDuration={100}>
        <TooltipTrigger asChild>
          <button
            type="button"
            onClick={handleDial}
            aria-label="Dial via Zoiper"
            className="inline-flex h-5 w-5 items-center justify-center rounded-full bg-[#F58220] text-white text-[9px] font-black leading-none shadow-sm hover:bg-[#e07216] focus:outline-none focus:ring-2 focus:ring-[#F58220]/40 flex-shrink-0"
          >
            Z
          </button>
        </TooltipTrigger>
        <TooltipContent side="top" className="text-xs">Dial via Zoiper</TooltipContent>
      </Tooltip>
      <Tooltip delayDuration={100}>
        <TooltipTrigger asChild>
          <a
            href={telHref}
            onClick={handleDial}
            onAuxClick={(e) => e.stopPropagation()}
            aria-label={`Click to dial ${formatUKPhone(phone)} via Zoiper`}
            className="inline-flex items-center gap-1 rounded-full border border-emerald-500/40 bg-emerald-50 px-2 py-0.5 text-xs font-semibold text-emerald-700 shadow-sm hover:bg-emerald-100 hover:border-emerald-500 hover:text-emerald-800 focus:outline-none focus:ring-2 focus:ring-emerald-500/40 cursor-pointer transition-colors"
          >
            <Phone className="h-3 w-3 flex-shrink-0" fill="currentColor" strokeWidth={0} />
            <span className="select-text">{formatUKPhone(phone)}</span>
          </a>
        </TooltipTrigger>
        <TooltipContent side="top" className="text-xs">Click to dial via Zoiper</TooltipContent>
      </Tooltip>
      <Tooltip delayDuration={100}>
        <TooltipTrigger asChild>
          <Button
            variant="ghost"
            size="icon"
            className={cn(
              "h-5 w-5 text-muted-foreground hover:text-primary hover:bg-muted",
              copied && "text-green-600"
            )}
            onClick={handleCopy}
            aria-label="Copy phone number"
          >
            {copied ? <Check className="h-3 w-3" /> : <Copy className="h-3 w-3" />}
          </Button>
        </TooltipTrigger>
        <TooltipContent side="top" className="text-xs">
          {copied ? 'Copied!' : 'Copy number'}
        </TooltipContent>
      </Tooltip>
    </span>
  );
});
PhoneCopyText.displayName = 'PhoneCopyText';


const EmailCopyText = memo<{ email: string }>(({ email }) => {
  const [copied, setCopied] = useState(false);
  
  const handleCopy = useCallback(async () => {
    try {
      await navigator.clipboard.writeText(email);
      setCopied(true);
      toast.success('Email copied', { duration: 1500 });
      setTimeout(() => setCopied(false), 2000);
    } catch (error) {
      toast.error('Failed to copy');
    }
  }, [email]);
  
  return (
    <Tooltip delayDuration={100}>
      <TooltipTrigger asChild>
        <span 
          className={cn(
            "text-xs cursor-pointer hover:text-primary select-all truncate max-w-[120px] transition-colors",
            copied && "text-green-600"
          )}
          onClick={handleCopy}
          role="button"
          tabIndex={0}
        >
          {copied ? 'Copied ✓' : email}
        </span>
      </TooltipTrigger>
      <TooltipContent side="top" className="text-xs">
        {copied ? 'Copied ✓' : 'Click to copy'}
      </TooltipContent>
    </Tooltip>
  );
});
EmailCopyText.displayName = 'EmailCopyText';

// Separate component for PAID cell to use hooks (useLeadCommissionClaim)
const PaidCellContent = memo<{
  lead: Lead;
  displayName: string | null;
  handleViewCustomer: () => void;
}>(({ lead, displayName, handleViewCustomer }) => {
  const { claim } = useLeadCommissionClaim(lead.id);

  return (
    <div className={cn(
      "space-y-0.5 rounded-md p-1.5 -m-1.5",
      claim && "bg-amber-50 border border-amber-200"
    )}>
      <Badge className="bg-green-500 text-white text-[10px] flex items-center gap-1 w-fit">
        <CheckCircle className="h-3 w-3" />PAID
      </Badge>
      <div className="text-[10px] text-muted-foreground">£{lead.payment_amount?.toFixed(2) || 'N/A'}</div>
      <div className="text-[10px] text-muted-foreground capitalize">{lead.payment_method || '—'}</div>
      <Button
        variant="link"
        size="sm"
        className="h-5 px-0 text-[10px] text-primary font-medium"
        onClick={handleViewCustomer}
      >
        <ExternalLink className="h-3 w-3 mr-1" />View Customer
      </Button>

      {/* Show claim status if already claimed */}
      {claim ? (
        <div className="space-y-0.5">
          <Badge variant="outline" className={cn(
            "text-[10px] flex items-center gap-1 w-fit",
            claim.status === 'approved' && "bg-green-50 text-green-700 border-green-300",
            claim.status === 'pending' && "bg-amber-50 text-amber-700 border-amber-300",
            claim.status === 'rejected' && "bg-red-50 text-red-700 border-red-300",
          )}>
            <Award className="h-3 w-3" />
            {claim.status === 'pending' ? 'Claimed' : claim.status === 'approved' ? 'Approved' : 'Rejected'}
          </Badge>
          <div className="text-[10px] font-medium text-amber-800">
            By {claim.agent_name}
          </div>
        </div>
      ) : (
        /* Commission Claim - available to all users for PAID leads */
        lead.is_paid && (
          <CommissionClaimDialog
            customerId={lead.id}
            leadId={lead.id}
            agentId={lead.assigned_to || ''}
            customerName={displayName || lead.email}
            dealValue={lead.payment_amount || undefined}
          />
        )
      )}
    </div>
  );
});
PaidCellContent.displayName = 'PaidCellContent';


export const LeadTableRow = memo<LeadTableRowProps>(({
  lead,
  tags,
  salesUsers,
  assignableSalesUsers,
  isSelected,
  isExpanded,
  sentQuotes,
  onSelect,
  onToggleExpand,
  onUpdateStatus,
  onAssign,
  onAutoAssign,
  onUpdatePriority,
  onScheduleFollowUp,
  onAddTag,
  onRemoveTag,
  onLogActivity,
  onUpdateCallCount,
  onSendQuote,
  hideAssignedColumn,
  canAssignLeads = true,
  canOverrideAssignmentLock = false,
  noteCount = 0,
  agentActivity,
  showFbBadge = false,
  showRecoveredBadge = false,
  showSourceColumn = false,
  isPaidLocked = false,
  hasPendingAccessRequest = false,
  hasApprovedAccess = false,
  onRequestAccess,
  isLeadGenView = false,
  userRole,
  reminderTime,
  struggleAlert,
  hideNewStatus = false,
  isReserved = false,
  reservedRemainingSec = 0,
  recontactMode = false,
  currentAdminId = null,
  rowNumber,
  readOnly = false,
  customerActivity,
  responseTime,
  repeatCustomer,
}) => {
  const [followUpDate, setFollowUpDate] = useState<Date | undefined>();
  const [followUpType, setFollowUpType] = useState('call');
  const navigate = useNavigate();
  const { byAgent: agentTeamMap } = useAgentTeams();
  const allAdminUsersMap = useAllAdminUsersMap(lead.assigned_to);

  // Allow child components (e.g. UnifiedNotesPanel retry banner "Close" button)
  // to collapse this row via a window event.
  useEffect(() => {
    const handler = (e: Event) => {
      const detail = (e as CustomEvent<{ leadId?: string }>).detail;
      if (detail?.leadId === lead.id && isExpanded) onToggleExpand();
    };
    window.addEventListener('lead-row:collapse', handler as EventListener);
    return () => window.removeEventListener('lead-row:collapse', handler as EventListener);
  }, [lead.id, isExpanded, onToggleExpand]);

  // Agent activity = latest real human touch: explicit "mark contacted", an
  // agent note, a logged call, a status change made by a user, or a quote the
  // agent actually sent to this customer (sending a quote IS an interaction).
  const lastQuoteSentAt = useMemo(() => {
    if (!sentQuotes || sentQuotes.length === 0) return 0;
    return sentQuotes.reduce((max, q) => {
      const t = q.sent_at ? new Date(q.sent_at).getTime() : 0;
      return t > max ? t : max;
    }, 0);
  }, [sentQuotes]);

  const agentTouchAt = useMemo(() => {
    const a = lead.last_contacted_at ? new Date(lead.last_contacted_at).getTime() : 0;
    const b = agentActivity?.lastAt ? new Date(agentActivity.lastAt).getTime() : 0;
    const best = Math.max(a, b, lastQuoteSentAt);
    if (!best) return null;
    return new Date(best).toISOString();
  }, [lead.last_contacted_at, agentActivity?.lastAt, lastQuoteSentAt]);

  const agentTouchLabel = useMemo(() => {
    const a = lead.last_contacted_at ? new Date(lead.last_contacted_at).getTime() : 0;
    const b = agentActivity?.lastAt ? new Date(agentActivity.lastAt).getTime() : 0;
    if (lastQuoteSentAt && lastQuoteSentAt >= a && lastQuoteSentAt >= b) return 'quote sent';
    if (!agentActivity || b < a) return null;
    return agentActivity.source === 'note' ? 'note'
      : agentActivity.source === 'call' ? 'call'
      : 'status change';
  }, [agentActivity, lead.last_contacted_at, lastQuoteSentAt]);

  const sla = getUrgencySLA(lead);
  
  const displayName = lead.first_name || lead.last_name 
    ? `${lead.first_name || ''} ${lead.last_name || ''}`.trim()
    : lead.full_name && !lead.full_name.includes('@')
      ? lead.full_name
      : lead.email?.split('@')[0] || null;
  
  const isOverdue = lead.next_action_date && isPast(new Date(lead.next_action_date)) && lead.follow_up_status === 'pending';
  const isFakeLead = lead.status === 'fake_lead';
  
  // Suspicious lead detection
  const suspiciousFlags = useMemo(() => detectSuspiciousLead(lead), [lead.phone, lead.email, lead.first_name, lead.vehicle_reg]);
  const isSuspiciousLead = isSuspicious(suspiciousFlags);
  // Paid lead lock: only lock Google Ads paid leads (New Sale G) for non-admin users
  const isGoogleAdsPaid = lead.is_paid && lead.lead_source === 'google_ad';
  const isLocked = isPaidLocked && isGoogleAdsPaid && !hasApprovedAccess;

  // Website sale assignment lock rules:
  // - Google Ads paid leads: ALWAYS locked to Website, only admin/super_admin can reassign
  // - Facebook/Organic paid leads outside work hours (6pm-9am): locked to Website, no agent can claim
  // - Facebook/Organic paid leads during work hours (9am-6pm): default Website but agents can claim
  const isAdminRole = userRole === 'admin' || userRole === 'super_admin' || userRole === 'sales_manager' || userRole === 'performance_manager' || userRole === 'lead_gen' || userRole === 'accounts_manager'
    // Agents explicitly granted lead-routing rights (Staff Lead Access) can move
    // these leads too — otherwise the tick box looks on but every row is locked.
    || canOverrideAssignmentLock;
  const isGoogleAdSale = (lead.is_paid || lead.status === 'converted') && lead.lead_source === 'google_ad';
  const isFacebookSale = lead.is_paid && lead.lead_source === 'social_ad';
  const isOrganicSale = lead.is_paid && (!lead.lead_source || lead.lead_source === 'website');
  
  const isOutsideWorkHours = (() => {
    const now = new Date();
    // Convert to UK time (Europe/London)
    const ukTime = new Date(now.toLocaleString('en-US', { timeZone: 'Europe/London' }));
    const hour = ukTime.getHours();
    return hour < 9 || hour >= 18; // Before 9am or 6pm onwards
  })();

  // Google Ads sales: always locked for non-admin
  const isGoogleAdAssignmentLocked = isGoogleAdSale && !isAdminRole;
  // Facebook/Organic sales: locked outside work hours for non-admin
  const isOffHoursSaleLocked = (isFacebookSale || isOrganicSale) && isOutsideWorkHours && !isAdminRole;
  // Combined: is this lead's assignment locked due to website sale rules?
  const isWebsiteSaleAssignmentLocked = isGoogleAdAssignmentLocked || isOffHoursSaleLocked;

  const getNextActionLabel = () => {
    if (!lead.next_action_type) return 'Schedule';
    const labels: Record<string, string> = {
      call: 'Call', email: 'Email', meeting: 'Meeting', sms: 'SMS',
      whatsapp: 'WhatsApp', quote: 'Send quote', follow_up: 'Follow up'
    };
    return labels[lead.next_action_type] || 'Schedule';
  };

  const handleViewCustomer = useCallback(() => {
    navigate(`/admin?tab=customers&search=${encodeURIComponent(lead.email)}`);
  }, [navigate, lead.email]);

  return (
    <TableRow
      data-lead-id={lead.id}
      className={cn(
      "transition-colors border-b border-border/30 group",
      getRowUrgencyClass(lead, reminderTime, recontactMode, currentAdminId),
      isFakeLead && "opacity-50 bg-red-50 hover:bg-red-100/60 pointer-events-auto",
      isLocked && "opacity-70",
      isSuspiciousLead && !isFakeLead && "bg-red-50/50 hover:bg-red-100/40",
      // Open Lead Pool: pinned reserved row — clearer left rail (6px) + slightly stronger mint tint.
      // Kept restrained so phone / reg / actions still read as the primary content.
      isReserved && "!bg-emerald-100/60 hover:!bg-emerald-100/80 shadow-[inset_6px_0_0_0_theme(colors.emerald.600)]"
    )}>
      {/* Row number (leftmost, for easy counting) */}
      {typeof rowNumber === 'number' && (
        <TableCell className="w-[44px] text-center text-xs tabular-nums text-muted-foreground font-medium">
          {rowNumber}
        </TableCell>
      )}

      {/* Selection Checkbox */}
      {!isLeadGenView && (
      <TableCell onClick={(e) => e.stopPropagation()}>
        <Checkbox
          checked={isSelected}
          onCheckedChange={onSelect}
          aria-label={`Select ${lead.email}`}
        />
      </TableCell>
      )}

      {/* Assigned To - Shows "Assign now" for unassigned leads */}
      {!hideAssignedColumn && !isLeadGenView && <TableCell className="sticky left-0 bg-inherit z-10" onClick={(e) => e.stopPropagation()}>
        <Select
          value={lead.assigned_to || WEBSITE_SALES_ACCOUNT_ID}
          onValueChange={(value) => {
            if (value === 'auto') {
              onAutoAssign();
            } else if (value === 'unassigned') {
              onAssign(null);
            } else {
              onAssign(value);
            }
          }}
          disabled={!canAssignLeads || isLocked || isWebsiteSaleAssignmentLocked}
        >
            <SelectTrigger 
              className={cn(
                "w-[120px] h-8 text-xs font-medium transition-all",
                isWebsiteSaleAssignmentLocked
                  ? "border border-slate-300 bg-slate-100 text-slate-500 cursor-not-allowed"
                  : !lead.assigned_to || lead.assigned_to === WEBSITE_SALES_ACCOUNT_ID
                    ? "border border-slate-300 bg-slate-50 text-slate-600 hover:border-slate-400" 
                    : "border border-green-300 bg-green-50 text-green-800 hover:border-green-400"
              )}
            >
              <Tooltip>
                <TooltipTrigger asChild>
              <div className="flex items-center gap-1.5 w-full">
                {lead.assigned_to && lead.assigned_to !== WEBSITE_SALES_ACCOUNT_ID ? (
                  // Assigned state - show initials avatar with per-agent color
                  (() => {
                    const resolvedFromAllMap = lead.assigned_to ? allAdminUsersMap.get(lead.assigned_to) : null;
                    const assignedUser = lead.assigned_user
                      || salesUsers.find(u => u.id === lead.assigned_to)
                      || resolvedFromAllMap;
                    const isInactiveAgent = !!resolvedFromAllMap && resolvedFromAllMap.is_active === false
                      && !salesUsers.find(u => u.id === lead.assigned_to);
                    const firstName = (assignedUser?.first_name || '').toLowerCase();
                    const agentColor = getAgentColor(firstName, lead.assigned_to);
                    const initial = assignedUser?.first_name?.[0]?.toUpperCase() || assignedUser?.email?.[0]?.toUpperCase() || '?';
                    const displayName = assignedUser
                      ? (`${assignedUser.first_name || ''} ${assignedUser.last_name || ''}`.trim()
                          || assignedUser.email?.split('@')[0]
                          || 'Unknown')
                      : 'Unknown agent';
                     return (
                       <>
                         <div
                           className={`h-5 w-5 rounded-full ${isInactiveAgent ? 'bg-muted-foreground/40' : agentColor} text-white flex items-center justify-center text-[10px] font-bold flex-shrink-0`}
                           title={isInactiveAgent ? `${displayName} (deactivated)` : displayName}
                         >
                           {initial}
                         </div>
                         <span className={`truncate ${isInactiveAgent ? 'italic text-muted-foreground' : ''}`}>
                           {isReserved ? `${(assignedUser?.first_name || displayName).split(' ')[0]} — You` : displayName}{isInactiveAgent ? ' (off)' : ''}
                         </span>
                         {isReserved && (
                           <span className="ml-1 inline-flex items-center rounded-full bg-emerald-600 px-1.5 py-0.5 text-[9px] font-semibold uppercase tracking-wide text-white shadow-sm">
                             Working
                           </span>
                         )}
                         <TeamBadge userId={lead.assigned_to} className="flex-shrink-0" />
                       </>
                     );
                   })()
                ) : (
                  <>
                    <Globe className="h-3.5 w-3.5 flex-shrink-0" />
                    <span>Website</span>
                    {isWebsiteSaleAssignmentLocked && <span className="ml-auto text-[9px]">🔒</span>}
                  </>
                )}
              </div>
                </TooltipTrigger>
                {isWebsiteSaleAssignmentLocked && (
                  <TooltipContent side="top" className="max-w-[220px] text-xs">
                    {isGoogleAdAssignmentLocked
                      ? 'Google Ads sale — only admin can reassign'
                      : 'Out-of-hours website sale (6pm–9am) — only admin can reassign'}
                  </TooltipContent>
                )}
              </Tooltip>
            </SelectTrigger>
            <SelectContent className="bg-popover border shadow-lg z-50">
              <SelectItem value={WEBSITE_SALES_ACCOUNT_ID} className="text-slate-600">
                <div className="flex items-center gap-2">
                  <Globe className="h-3.5 w-3.5" />
                  <span>Website</span>
                </div>
              </SelectItem>
              <SelectItem value="unassigned" className="text-muted-foreground">
                <div className="flex items-center gap-2">
                  <X className="h-3.5 w-3.5" />
                  <span>Remove assignment</span>
                </div>
              </SelectItem>
              <SelectItem value="auto" className="text-primary">
                <div className="flex items-center gap-2">
                  <span>🔄</span>
                  <span>Auto-assign (next available)</span>
                </div>
              </SelectItem>
              <SelectSeparator />
              {(() => {
                const roster = (assignableSalesUsers ?? salesUsers).filter(u => u.id !== WEBSITE_SALES_ACCOUNT_ID);
                // Group by team for managers (cross-team roster). Single-team users see a flat list.
                const groups = new Map<string, typeof roster>();
                roster.forEach(u => {
                  const t = agentTeamMap.get(u.id);
                  const team = t?.name || 'No team';
                  if (!groups.has(team)) groups.set(team, [] as any);
                  (groups.get(team) as any).push(u);
                });
                const showGroups = groups.size > 1;
                const renderUser = (user: typeof roster[number], idx: number) => {
                  const uFirstName = (user.first_name || '').toLowerCase();
                  const color = getAgentColor(uFirstName, user.id);
                  return (
                    <SelectItem key={user.id} value={user.id}>
                      <div className="flex items-center gap-2">
                        <div className={`h-5 w-5 rounded-full ${color} text-white flex items-center justify-center text-[10px] font-medium`}>
                          {user.first_name?.[0]?.toUpperCase() || user.email?.[0]?.toUpperCase()}
                        </div>
                        <span>{`${user.first_name || ''} ${user.last_name || ''}`.trim() || user.email}</span>
                        <TeamBadge userId={user.id} className="ml-auto" />
                      </div>
                    </SelectItem>
                  );
                };
                if (!showGroups) {
                  return roster.map((u, i) => renderUser(u, i));
                }
                // Active sales teams first (Team Blue, Team Red), everything else after,
                // "No team" pinned to the bottom — so managers don't have to scroll past
                // dormant/legacy buckets to reach the agents they actually assign to.
                const TOP_TEAM_ORDER = ['team blue', 'team red'];
                const rankTeam = (name: string) => {
                  const lower = name.toLowerCase();
                  if (lower === 'no team') return 2;
                  const topIdx = TOP_TEAM_ORDER.indexOf(lower);
                  return topIdx >= 0 ? 0 : 1;
                };
                const entries = Array.from(groups.entries()).sort((a, b) => {
                  const ra = rankTeam(a[0]);
                  const rb = rankTeam(b[0]);
                  if (ra !== rb) return ra - rb;
                  if (ra === 0) {
                    return TOP_TEAM_ORDER.indexOf(a[0].toLowerCase()) -
                           TOP_TEAM_ORDER.indexOf(b[0].toLowerCase());
                  }
                  return a[0].localeCompare(b[0]);
                });
                return entries.map(([team, users], gi) => (
                  <React.Fragment key={team}>
                    {gi > 0 && <SelectSeparator />}
                    <div className="px-2 py-1 text-[10px] font-semibold uppercase tracking-wider text-muted-foreground">
                      {team}
                    </div>
                    {users.map((u, i) => renderUser(u, i))}
                  </React.Fragment>
                ));
              })()}
            </SelectContent>
          </Select>
      </TableCell>}

      {/* Source indicator — O/F/G — admin/super_admin only */}
      {showSourceColumn && (
        <TableCell className="text-center">
          {(() => {
            const src = lead.lead_source;
            const metadata = lead.cart_metadata as { gclid?: string; fbclid?: string; utm_source?: string; utm_medium?: string; utm_campaign?: string; utm_term?: string; utm_content?: string } | null;
            const utmLines: string[] = [];
            if (metadata?.utm_source)   utmLines.push(`UTM Source: ${metadata.utm_source}`);
            if (metadata?.utm_medium)   utmLines.push(`UTM Medium: ${metadata.utm_medium}`);
            if (metadata?.utm_campaign) utmLines.push(`UTM Campaign: ${metadata.utm_campaign}`);
            if (metadata?.utm_term)     utmLines.push(`UTM Term: ${metadata.utm_term}`);
            if (metadata?.utm_content)  utmLines.push(`UTM Content: ${metadata.utm_content}`);
            const utmBlock = utmLines.length ? `\n${utmLines.join('\n')}` : '';
            if (src === 'google_ad') {
              const gclid = metadata?.gclid;
              const tip = (gclid ? `Google Ads\nGCLID: ${gclid}` : 'Google Ads (no GCLID captured)') + utmBlock;
              return <span className="text-[11px] font-bold text-emerald-700 cursor-help" title={tip}>G</span>;
            }
            if (src === 'social_ad') {
              const fbclid = metadata?.fbclid;
              const parts = ['Facebook Ads'];
              if (fbclid) parts.push(`FBCLID: ${fbclid}`);
              if (!fbclid && !metadata?.utm_source) parts.push('(no FBCLID captured)');
              return <span className="text-[11px] font-bold text-blue-700 cursor-help" title={parts.join('\n') + utmBlock}>F</span>;
            }
            if (src === 'bing_ad') {
              const msclkid = (metadata as any)?.msclkid;
              const parts = ['Bing Ads'];
              if (msclkid) parts.push(`MSCLKID: ${msclkid}`);
              if (!msclkid && !metadata?.utm_source) parts.push('(no MSCLKID captured)');
              return <span className="text-[11px] font-bold text-teal-700 cursor-help" title={parts.join('\n') + utmBlock}>B</span>;
            }
            const organicTip = 'Organic' + utmBlock;
            return <span className={`text-[11px] font-medium cursor-help ${utmLines.length ? 'text-foreground' : 'text-muted-foreground'}`} title={organicTip}>O</span>;
          })()}
        </TableCell>
      )}

      {/* Status */}
      {!isLeadGenView && (
      <TableCell onClick={(e) => e.stopPropagation()}>
        {isLocked ? (
          <PaidLeadLockOverlay
            hasPendingRequest={hasPendingAccessRequest}
            hasApprovedAccess={hasApprovedAccess}
            onRequestAccess={onRequestAccess || (() => {})}
          />
        ) : (
          <div className="flex items-center gap-0.5">
            <Select value={lead.status} onValueChange={(v) => onUpdateStatus(v as LeadStatus)}>
              <SelectTrigger className={cn("h-7 px-2 text-[10px] font-medium whitespace-nowrap border-0 gap-1 w-auto min-w-[90px]", statusColors[lead.status])}>
                <SelectValue>{statusLabels[lead.status]}</SelectValue>
              </SelectTrigger>
              <SelectContent>
                {(Object.keys(statusLabels) as LeadStatus[])
                  .filter((s) => !(hideNewStatus && s === 'new'))
                  .map((s) => (
                  <SelectItem key={s} value={s} className="text-xs">
                    <span className={cn("inline-block px-2 py-0.5 rounded", statusColors[s])}>{statusLabels[s]}</span>
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
            <UnsubscribeLeadButton
              email={lead.email}
              customerName={lead.full_name || [lead.first_name, lead.last_name].filter(Boolean).join(' ') || null}
              vehicleReg={lead.vehicle_reg}
              alreadyNotInterested={lead.status === 'not_interested'}
              onMarkNotInterested={() => onUpdateStatus('not_interested' as LeadStatus)}
            />
          </div>

        )}
      </TableCell>
      )}

      {/* Send Quote column removed — feature remains available via the row action button */}



      {/* Call Count - Enhanced with dialog and guardrails */}
      {!isLeadGenView && (
      <TableCell onClick={(e) => e.stopPropagation()}>
        {isLocked ? (
          <span className="text-muted-foreground text-xs">🔒</span>
        ) : (
        <CallCountCell
          lead={lead}
          onUpdateCallCount={onUpdateCallCount}
          onUpdateStatus={onUpdateStatus}
          onScheduleFollowUp={onScheduleFollowUp}
          onLogActivity={onLogActivity}
        />
        )}
      </TableCell>
      )}

      {/* Quick Actions */}
      {!isLeadGenView && (
      <TableCell onClick={(e) => e.stopPropagation()}>
        <div className="flex items-center gap-1">
          <Tooltip delayDuration={100}>
            <TooltipTrigger asChild>
              <Button 
                variant={isExpanded ? "default" : "outline"}
                size="icon"
                className={cn(
                  "h-9 w-9 transition-all duration-150",
                  isExpanded 
                    ? "bg-primary text-primary-foreground shadow-lg scale-105" 
                    : "border-2 border-primary hover:border-primary hover:bg-primary hover:text-primary-foreground"
                )}
                onClick={onToggleExpand}
              >
                <ChevronDown className={cn("h-5 w-5 transition-transform duration-180", isExpanded && "rotate-180 text-white")} strokeWidth={3.5} />
              </Button>
            </TooltipTrigger>
            <TooltipContent side="top" className="text-xs">
              {isExpanded ? "Close" : "Click to open"}
            </TooltipContent>
          </Tooltip>
          
          <ZoiperDialButton
            phone={lead.phone || ''}
            leadId={lead.id}
            leadType={lead.is_from_abandoned_cart ? 'abandoned_cart' : 'sales_lead'}
            leadSource={lead.lead_source || null}
            onDialed={(number) => onLogActivity('call_dial', `Dialled ${number} via Zoiper`)}
          />

          <RetryCountdownBadge
            nextActionDate={lead.next_action_date}
            followUpStatus={lead.follow_up_status}
          />

          <OvernightBadge leadId={lead.id} />

          
          <NotesQuickActionsPopover
            lead={lead}
            noteCount={noteCount}
            onOpenFullNotes={onToggleExpand}
            onUpdateCallCount={onUpdateCallCount}
            onScheduleFollowUp={onScheduleFollowUp}
            onLogActivity={onLogActivity}
            agentId={lead.assigned_to || ''}
          />

          
          <EmailActionsButton
            email={lead.email}
            onAction={(a) =>
              onLogActivity(
                a === 'gmail' ? 'email_open_gmail' : 'email_copy',
                a === 'gmail' ? 'Opened lead in Gmail' : 'Copied email address',
              )
            }
          />
          <RemindMePopover leadId={lead.id} compact onReminderSaved={(msg) => onLogActivity('reminder', msg)} />
          
          {onSendQuote && !lead.is_paid && (
            <Tooltip delayDuration={100}>
              <TooltipTrigger asChild>
                <Button 
                  variant="outline" 
                  size="sm"
                  className="h-7 px-2 text-xs font-medium text-orange-600 border-orange-300 hover:bg-orange-50"
                  onClick={() => { onLogActivity('quote_open', 'Opened Send Quote flow'); onSendQuote(); }}
                >
                  <FileText className="h-3 w-3 mr-1" />
                  Quote
                </Button>
              </TooltipTrigger>
              <TooltipContent side="top" className="text-xs">Send Quote</TooltipContent>
            </Tooltip>
          )}

        </div>
      </TableCell>
      )}

      {/* Name */}
      <TableCell>
        <div className="flex items-center gap-1.5">
          {suspiciousFlags.length > 0 && !isFakeLead && (
            <Tooltip delayDuration={100}>
              <TooltipTrigger asChild>
                <Badge className="text-[10px] px-1.5 py-0.5 border-0 flex items-center gap-0.5 flex-shrink-0 bg-red-500 text-white cursor-help">
                  <AlertTriangle className="h-3 w-3" />
                  CHECK
                </Badge>
              </TooltipTrigger>
              <TooltipContent side="top" className="text-xs max-w-[250px]">
                <div className="font-semibold mb-1">⚠️ Suspicious lead detected:</div>
                <ul className="list-disc pl-3 space-y-0.5">
                  {suspiciousFlags.map((f, i) => (
                    <li key={i}>{f.reason}</li>
                  ))}
                </ul>
              </TooltipContent>
            </Tooltip>
          )}
          {isOverdue && !suspiciousFlags.length && <AlertTriangle className="h-3.5 w-3.5 text-red-500 flex-shrink-0" />}
          {reminderTime && isPast(new Date(reminderTime)) && !isFakeLead && (
            <Tooltip delayDuration={100}>
              <TooltipTrigger asChild>
                <Badge className="text-[10px] px-1.5 py-0.5 bg-red-500 text-white border-0 flex items-center gap-0.5 flex-shrink-0">
                  <Clock className="h-3 w-3" />
                  OVERDUE
                </Badge>
              </TooltipTrigger>
              <TooltipContent side="top" className="text-xs">
                Reminder overdue — {formatDistanceToNow(new Date(reminderTime), { addSuffix: true })}
              </TooltipContent>
            </Tooltip>
          )}
          {reminderTime && isToday(new Date(reminderTime)) && !isPast(new Date(reminderTime)) && !isFakeLead && (
            <Tooltip delayDuration={100}>
              <TooltipTrigger asChild>
                <Badge className="text-[10px] px-1.5 py-0.5 bg-amber-500 text-white border-0 flex items-center gap-0.5 flex-shrink-0">
                  <Clock className="h-3 w-3" />
                  DUE
                </Badge>
              </TooltipTrigger>
              <TooltipContent side="top" className="text-xs">
                Reminder due today at {format(new Date(reminderTime), 'h:mm a')}
              </TooltipContent>
            </Tooltip>
          )}
          {repeatCustomer && <RepeatCustomerBadge info={repeatCustomer} />}
          {!repeatCustomer && (lead as any).manual_entry && <ManualLeadBadge />}
          {(lead.resubmission_count || 0) > 0 && (
            <Tooltip delayDuration={100}>
              <TooltipTrigger asChild>
                <Badge className="text-[10px] px-1.5 py-0.5 bg-purple-600 text-white border-0 flex items-center gap-0.5 flex-shrink-0">
                  <RotateCw className="h-3 w-3" />x{Math.min((lead.resubmission_count || 0) + 1, 10)}{(lead.resubmission_count || 0) >= 10 ? '+' : ''}
                </Badge>
              </TooltipTrigger>
              <TooltipContent side="top" className="text-xs">
                Submitted {(lead.resubmission_count || 0) + 1} times{lead.last_resubmitted_at ? ` — last: ${format(new Date(lead.last_resubmitted_at), 'dd/MM HH:mm')}` : ''}
              </TooltipContent>
            </Tooltip>
          )}
          {lead.application_count > 1 && !(lead.resubmission_count || 0) && (
            <Badge className="text-[10px] px-1.5 py-0.5 bg-orange-500 text-white border-0 flex items-center gap-0.5 flex-shrink-0">
              <Flame className="h-3 w-3" />x{lead.application_count > 9 ? '9+' : `${lead.application_count}`}
            </Badge>
          )}
          {(lead.claim_count || 0) >= 1 && (() => {
            const n = lead.claim_count || 0;
            // 1 = first touch (neutral slate), 2 = amber "worked once already",
            // 3+ = red "cold — been round the block". Tooltip shows last claim date.
            const tone = n === 1
              ? 'bg-slate-200 text-slate-700 border-slate-300'
              : n === 2
                ? 'bg-amber-100 text-amber-800 border-amber-300'
                : 'bg-red-100 text-red-800 border-red-300';
            const label = n === 1 ? '1st touch' : n === 2 ? '2nd attempt' : `${n}th attempt`;
            return (
              <Tooltip delayDuration={100}>
                <TooltipTrigger asChild>
                  <Badge variant="outline" className={`text-[10px] px-1.5 py-0.5 border flex items-center gap-0.5 flex-shrink-0 ${tone}`}>
                    {label}
                  </Badge>
                </TooltipTrigger>
                <TooltipContent side="top" className="text-xs">
                  Claimed from recontact pool {n} time{n === 1 ? '' : 's'}
                  {lead.last_claimed_at ? ` — last: ${format(new Date(lead.last_claimed_at), 'dd/MM HH:mm')}` : ''}
                </TooltipContent>
              </Tooltip>
            );
          })()}
          {recontactMode && lead.last_claimed_at && (Date.now() - new Date(lead.last_claimed_at).getTime()) < 3 * 24 * 3600 * 1000 && (
            <Tooltip delayDuration={100}>
              <TooltipTrigger asChild>
                <Badge className="text-[10px] px-1.5 py-0.5 bg-emerald-500 text-white border-0 flex items-center gap-0.5 flex-shrink-0 uppercase tracking-wide font-bold">
                  Newly claimed
                </Badge>
              </TooltipTrigger>
              <TooltipContent side="top" className="text-xs">
                Claimed from recontact pool {format(new Date(lead.last_claimed_at), 'dd/MM HH:mm')} — badge lasts 3 days
              </TooltipContent>
            </Tooltip>
          )}
          {readOnly && (
            <Tooltip delayDuration={100}>
              <TooltipTrigger asChild>
                <Badge
                  variant="outline"
                  className="text-[10px] px-1.5 py-0.5 bg-amber-50 text-amber-800 border-amber-300 flex items-center gap-0.5 flex-shrink-0"
                >
                  VIEW ONLY
                </Badge>
              </TooltipTrigger>
              <TooltipContent side="top" className="text-xs max-w-[240px]">
                Another team's lead. You can view it but not make changes.
              </TooltipContent>
            </Tooltip>
          )}
          {currentAdminId
            && Array.isArray(lead.hidden_from_agent_ids)
            && lead.hidden_from_agent_ids.includes(currentAdminId)
            && lead.assigned_to
            && lead.assigned_to !== currentAdminId && (
              <Tooltip delayDuration={100}>
                <TooltipTrigger asChild>
                  <Badge
                    variant="outline"
                    className="text-[10px] px-1.5 py-0.5 bg-slate-100 text-slate-700 border-slate-300 flex items-center gap-0.5 flex-shrink-0"
                  >
                    OLD LEAD · NEW OWNER
                  </Badge>
                </TooltipTrigger>
                <TooltipContent side="top" className="text-xs max-w-[240px]">
                  You previously worked this lead. It's now owned by another agent — warm-transfer any inbound calls.
                </TooltipContent>
              </Tooltip>
          )}
          {struggleAlert && (
            <Tooltip delayDuration={100}>
              <TooltipTrigger asChild>
                <Badge className="text-[10px] px-1.5 py-0.5 bg-red-600 text-white border-0 flex items-center gap-0.5 flex-shrink-0 cursor-help animate-pulse">
                  🚨
                </Badge>
              </TooltipTrigger>
              <TooltipContent side="top" className="text-xs max-w-[260px]">
                Checkout struggle: {struggleAlert.signal_type.replace(/_/g, ' ')} — {formatDistanceToNow(new Date(struggleAlert.created_at), { addSuffix: true })}
              </TooltipContent>
            </Tooltip>
          )}
          {displayName ? (
            <span className="font-medium text-sm truncate max-w-[100px]" title={displayName}>{displayName}</span>
          ) : (
            <span className="text-muted-foreground text-xs">—</span>
          )}
          {lead.is_from_abandoned_cart && (
            <Badge variant="outline" className="text-[10px] px-1 py-0 bg-amber-100 text-amber-800 border-amber-300">Cart</Badge>
          )}
          {showRecoveredBadge && (lead.abandoned_cart_id || lead.is_from_abandoned_cart) && !lead.assigned_at && !lead.step_two_completed_at && (() => {
            const meta = lead.cart_metadata as { gclid?: string; fbclid?: string; utm_source?: string } | null;
            const isGoogle = !!meta?.gclid;
            const isFb = !!meta?.fbclid || ['facebook', 'fb', 'ig'].includes((meta?.utm_source || '').toLowerCase());
            const srcLabel = isGoogle ? 'G' : isFb ? 'FB' : 'Or';
            const srcColor = isGoogle ? 'bg-emerald-100 text-emerald-800 border-emerald-300' : isFb ? 'bg-blue-100 text-blue-800 border-blue-300' : 'bg-gray-100 text-gray-700 border-gray-300';
            return (
              <Tooltip delayDuration={100}>
                <TooltipTrigger asChild>
                  <Badge className={`text-[10px] px-1 py-0 font-bold flex-shrink-0 ${srcColor}`}>
                    R·{srcLabel}
                  </Badge>
                </TooltipTrigger>
                <TooltipContent side="top" className="text-xs">Recovered from abandoned cart ({isGoogle ? 'Google' : isFb ? 'Facebook' : 'Organic'})</TooltipContent>
              </Tooltip>
            );
          })()}
          {showFbBadge && (() => {
            const metadata = lead.cart_metadata as { fbclid?: string; utm_source?: string } | null;
            const isFacebook = metadata?.fbclid || metadata?.utm_source?.toLowerCase() === 'facebook' || metadata?.utm_source?.toLowerCase() === 'fb' || metadata?.utm_source?.toLowerCase() === 'ig';
            return isFacebook ? (
              <Badge variant="outline" className="text-[10px] px-1 py-0 bg-blue-100 text-blue-800 border-blue-300">📘 FB</Badge>
            ) : null;
          })()}
        </div>
      </TableCell>

      {/* Phone */}
      <TableCell onClick={(e) => e.stopPropagation()}>
        {lead.phone ? (
          <div className="flex items-center gap-1">
            {suspiciousFlags.some(f => f.type === 'invalid_phone') ? (
              <Tooltip delayDuration={100}>
                <TooltipTrigger asChild>
                  <span className="inline-flex items-center gap-1 text-red-500 text-xs font-semibold whitespace-nowrap line-through opacity-70 cursor-help">
                    <Phone className="h-3.5 w-3.5 flex-shrink-0" />
                    <span>{formatUKPhone(lead.phone)}</span>
                  </span>
                </TooltipTrigger>
                <TooltipContent side="top" className="text-xs">
                  ⚠️ {suspiciousFlags.find(f => f.type === 'invalid_phone')?.reason} — Do not call
                </TooltipContent>
              </Tooltip>
            ) : (
              <PhoneCopyText phone={lead.phone} leadId={lead.id} />
            )}
            <div className="flex items-center">
              <Tooltip delayDuration={100}>
                <TooltipTrigger asChild>
                  <Button 
                    variant="ghost" 
                    size="icon"
                    className="h-6 w-6 text-green-600 hover:text-green-700 hover:bg-green-50"
                    onClick={() => window.open(`https://wa.me/${lead.phone?.replace(/\D/g, '')}`)}
                  >
                    <MessageSquare className="h-3 w-3" />
                  </Button>
                </TooltipTrigger>
                <TooltipContent side="top" className="text-xs">WhatsApp</TooltipContent>
              </Tooltip>
            </div>
          </div>
        ) : (
          <span className="text-muted-foreground text-xs">—</span>
        )}
      </TableCell>

      {/* Email */}
      <TableCell onClick={(e) => e.stopPropagation()}>
        <div className="flex items-center gap-0.5">
          <EmailCopyText email={lead.email} />
          <Tooltip delayDuration={100}>
            <TooltipTrigger asChild>
              <Button 
                variant="ghost" 
                size="icon"
                className="h-6 w-6 text-blue-600 hover:text-blue-700 hover:bg-blue-50"
                onClick={() => {
                  if (onSendQuote) {
                    onSendQuote();
                  } else {
                    window.open(`mailto:${lead.email}`);
                  }
                  if (!lead.is_from_abandoned_cart) onLogActivity('email', 'Sent email');
                }}
              >
                <Send className="h-3 w-3" />
              </Button>
            </TooltipTrigger>
            <TooltipContent side="top" className="text-xs">{onSendQuote ? 'Send quote' : 'Send email'}</TooltipContent>
          </Tooltip>
        </div>
      </TableCell>


      {/* Reg Plate */}
      {!isLeadGenView && (
      <TableCell>
        {lead.vehicle_reg ? (
          <Badge variant="outline" className="font-mono text-xs bg-yellow-400 text-black border-yellow-500 rounded-sm">{lead.vehicle_reg}</Badge>
        ) : (
          <span className="text-muted-foreground text-xs">—</span>
        )}
      </TableCell>
      )}

      {/* Payment Status */}
      {!isLeadGenView && (
      <TableCell onClick={(e) => e.stopPropagation()}>
        {lead.is_paid ? (
          <PaidCellContent
            lead={lead}
            displayName={displayName}
            handleViewCustomer={handleViewCustomer}
          />
        ) : (
          <span className="text-muted-foreground text-xs">—</span>
        )}
      </TableCell>
      )}

      {/* Paid Date */}
      {!isLeadGenView && (
      <TableCell>
        {lead.payment_date ? (
          <span className="text-xs text-muted-foreground">
            {format(new Date(lead.payment_date), 'MMM d, yyyy HH:mm')}
          </span>
        ) : (
          <span className="text-muted-foreground text-xs">—</span>
        )}
      </TableCell>
      )}

      {/* Agent activity — human touches only (calls, notes, status changes) */}
      {!isLeadGenView && (
      <TableCell>
        {isReserved ? (() => {
          const mm = Math.floor(Math.max(0, reservedRemainingSec) / 60);
          const ss = Math.max(0, reservedRemainingSec) % 60;
          const label = `${mm}:${ss.toString().padStart(2, '0')}`;
          const warn = reservedRemainingSec <= 30;
          return (
            <span
              className={cn(
                "inline-flex items-center gap-1 rounded-md border px-1.5 py-0.5 text-xs font-semibold tabular-nums",
                warn
                  ? "border-amber-300 bg-amber-50 text-amber-800"
                  : "border-emerald-300 bg-emerald-50 text-emerald-800"
              )}
              title="Reserved to you from the Open Lead Pool"
            >
              <Clock className="h-3 w-3" />
              {warn ? `Releasing soon · ${label}` : `Reserved · ${label}`}
            </span>
          );
        })() : (
          <div className="flex flex-col leading-tight">
            {agentTouchAt ? (
              <span
                className="text-xs text-foreground"
                title={`Agent last touched this lead ${format(new Date(agentTouchAt), 'MMM d, yyyy HH:mm')}${agentTouchLabel ? ` — ${agentTouchLabel}` : ''}`}
              >
                {formatDistanceToNow(new Date(agentTouchAt), { addSuffix: true })}
                {agentTouchLabel && (
                  <span className="ml-1 text-[10px] text-muted-foreground">· {agentTouchLabel}</span>
                )}
              </span>
            ) : (
              <span
                className="text-xs text-muted-foreground italic"
                title="No agent has called, noted, or changed the status of this lead yet"
              >
                No agent activity
              </span>
            )}
            {lead.last_activity_date && (!agentTouchAt || new Date(lead.last_activity_date).getTime() > new Date(agentTouchAt).getTime() + 60_000) && (
              <span
                className="text-[10px] text-muted-foreground/70"
                title={`System/automated write at ${format(new Date(lead.last_activity_date), 'MMM d, yyyy HH:mm')} (not agent activity)`}
              >
                sys {formatDistanceToNow(new Date(lead.last_activity_date), { addSuffix: true })}
              </span>
            )}
          </div>
        )}
      </TableCell>
      )}


      {/* Lead Date — original arrival time in UK time (never assignment/resubmission time) */}
      {!isLeadGenView && (
      <TableCell>
        <span className="text-xs text-muted-foreground" title="UK time">
          {formatLeadDateUK(lead.created_at)}
        </span>
      </TableCell>
      )}

      {/* Date Added — when the lead was reclaimed from the recontact pool */}
      {recontactMode && !isLeadGenView && (
      <TableCell>
        <span className="text-xs text-muted-foreground" title="UK time">
          {lead.last_claimed_at ? formatLeadDateUK(lead.last_claimed_at) : '—'}
        </span>
      </TableCell>
      )}

      {/* Customer activity — last time the CUSTOMER themselves did something
          (asked for another quote, filled step 2, logged into the portal). */}
      {!isLeadGenView && (
      <TableCell>
        <CustomerActivityCell activity={customerActivity} />
      </TableCell>
      )}

      {/* Time to contact — lead arrival → agent's first action (target 120s) */}
      {!isLeadGenView && (
      <TableCell>
        <TimeToContactCell response={responseTime} />
      </TableCell>
      )}
    </TableRow>
  );
}, (prevProps, nextProps) => {
  // Custom comparison - only re-render if relevant props changed
  return (
    prevProps.lead.id === nextProps.lead.id &&
    prevProps.lead.status === nextProps.lead.status &&
    prevProps.lead.priority === nextProps.lead.priority &&
    prevProps.lead.assigned_to === nextProps.lead.assigned_to &&
    prevProps.lead.notes === nextProps.lead.notes &&
    prevProps.lead.next_action_date === nextProps.lead.next_action_date &&
    prevProps.lead.next_action_type === nextProps.lead.next_action_type &&
    prevProps.lead.is_paid === nextProps.lead.is_paid &&
    prevProps.lead.is_callback === nextProps.lead.is_callback &&
    prevProps.lead.call_count === nextProps.lead.call_count &&
    prevProps.lead.tags?.length === nextProps.lead.tags?.length &&
    prevProps.isSelected === nextProps.isSelected &&
    prevProps.isExpanded === nextProps.isExpanded &&
    prevProps.hideAssignedColumn === nextProps.hideAssignedColumn &&
    prevProps.canAssignLeads === nextProps.canAssignLeads &&
    prevProps.canOverrideAssignmentLock === nextProps.canOverrideAssignmentLock &&
    prevProps.salesUsers.length === nextProps.salesUsers.length &&
    (prevProps.assignableSalesUsers?.length ?? -1) === (nextProps.assignableSalesUsers?.length ?? -1) &&
    prevProps.isPaidLocked === nextProps.isPaidLocked &&
    prevProps.showSourceColumn === nextProps.showSourceColumn &&
    prevProps.hasPendingAccessRequest === nextProps.hasPendingAccessRequest &&
    prevProps.hasApprovedAccess === nextProps.hasApprovedAccess &&
    prevProps.isLeadGenView === nextProps.isLeadGenView &&
    prevProps.reminderTime === nextProps.reminderTime &&
    prevProps.isReserved === nextProps.isReserved &&
    prevProps.reservedRemainingSec === nextProps.reservedRemainingSec &&
    prevProps.customerActivity?.lastAt === nextProps.customerActivity?.lastAt &&
    prevProps.responseTime?.seconds === nextProps.responseTime?.seconds &&
    prevProps.repeatCustomer?.policyCount === nextProps.repeatCustomer?.policyCount
  );
});

LeadTableRow.displayName = 'LeadTableRow';
