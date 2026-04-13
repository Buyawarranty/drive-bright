import React, { memo, useState, useCallback, useMemo } from 'react';
import { PaidLeadLockOverlay } from './PaidLeadLockOverlay';
import { WEBSITE_SALES_ACCOUNT_ID } from '@/constants/salesDefaults';
import { CommissionClaimDialog } from './CommissionClaimDialog';
import { useLeadCommissionClaim } from '@/hooks/useLeadCommissionClaims';
import { Lead, LeadStatus, LeadPriority, LeadTag, AdminUser } from '@/hooks/useLeads';
import { SentQuote } from '@/hooks/useLeadQuotes';
import { detectSuspiciousLead, isSuspicious } from '@/utils/suspiciousLeadDetection';
import { TableCell, TableRow } from '@/components/ui/table';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Select, SelectContent, SelectItem, SelectSeparator, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover';
import { Calendar } from '@/components/ui/calendar';
import { Tooltip, TooltipContent, TooltipTrigger } from '@/components/ui/tooltip';
import { Checkbox } from '@/components/ui/checkbox';
import { RemindMePopover } from './RemindMePopover';
import { CopyButton } from './CopyButton';
import { CallCountCell } from './CallCountCell';
import { QuoteSentCell } from './QuoteSentCell';
import { 
  Phone, Mail, MessageSquare, Calendar as CalendarIcon, Clock,
  Tag, AlertTriangle, FileText, StickyNote,
  CheckCircle, ChevronDown, Send, ExternalLink, Flame, X, Plus, User, RotateCw, Award, Globe
} from 'lucide-react';
import { useNavigate } from 'react-router-dom';
import { toast } from 'sonner';
import { format, formatDistanceToNow, isPast, differenceInHours, differenceInDays, isToday } from 'date-fns';
import { cn } from '@/lib/utils';

interface LeadTableRowProps {
  lead: Lead;
  tags: LeadTag[];
  salesUsers: AdminUser[];
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
  noteCount?: number;
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
}

const statusColors: Record<LeadStatus, string> = {
  new: 'bg-blue-100 text-blue-800',
  contacted: 'bg-yellow-100 text-yellow-800',
  follow_up: 'bg-purple-100 text-purple-800',
  quote_sent: 'bg-indigo-100 text-indigo-800',
  negotiating: 'bg-orange-100 text-orange-800',
  converted: 'bg-green-100 text-green-800',
  lost: 'bg-gray-100 text-gray-800',
  fake_lead: 'bg-red-100 text-red-800',
  urgent_callback: 'bg-red-500 text-white'
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
    return { label: 'New', color: 'bg-blue-100 text-blue-800', priority: 2 };
  }
  
  // Closed/resolved leads don't need action
  if (lead.status === 'converted' || lead.status === 'lost' || lead.status === 'fake_lead') {
    const labelMap: Record<string, string> = { converted: 'Converted', lost: 'Lost', fake_lead: 'Fake 404' };
    return { label: labelMap[lead.status] || lead.status, color: 'bg-gray-100 text-gray-600', priority: 5 };
  }
  
  return { label: 'Action needed', color: 'bg-orange-100 text-orange-700', priority: 4 };
};

const getRowUrgencyClass = (lead: Lead, reminderTime?: string): string => {
  if (lead.is_paid) return 'bg-green-50 hover:bg-green-100/70';
  if ((lead.resubmission_count || 0) > 0) return 'bg-purple-50 hover:bg-purple-100/70';
  
  // Reminder-based urgency colouring
  if (reminderTime) {
    const reminderDate = new Date(reminderTime);
    if (isPast(reminderDate)) {
      const overdueMin = differenceInHours(new Date(), reminderDate);
      // Overdue reminder — red tint (stronger than SLA overdue)
      return 'bg-red-50 hover:bg-red-100/70';
    }
    if (isToday(reminderDate)) {
      // Due today — amber tint
      return 'bg-amber-50 hover:bg-amber-100/70';
    }
  }
  
  const sla = getUrgencySLA(lead);
  if (sla.priority === 0) return 'bg-red-50 hover:bg-red-100/70';
  if (sla.priority === 1) return 'bg-amber-50 hover:bg-amber-100/70';
  if (lead.is_from_abandoned_cart) return 'bg-amber-50/30 hover:bg-amber-100/50';
  return 'hover:bg-muted/50';
};

// Memoized phone text component
// Keep the number as plain visible text so Zoiper Click2Dial can detect and convert it,
// while preserving the requested green styling on any injected link.
const PhoneCopyText = memo<{ phone: string }>(({ phone }) => {
  return (
    <span className="inline-flex items-center gap-1 text-emerald-600 hover:text-emerald-700 text-xs font-semibold whitespace-nowrap [&_a]:text-inherit [&_a]:font-inherit [&_a]:underline [&_a]:underline-offset-2 [&_a]:decoration-current">
      <Phone className="h-3.5 w-3.5 flex-shrink-0" />
      <span className="underline underline-offset-2 decoration-current select-text">
        {formatUKPhone(phone)}
      </span>
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
  noteCount = 0,
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
}) => {
  const [followUpDate, setFollowUpDate] = useState<Date | undefined>();
  const [followUpType, setFollowUpType] = useState('call');
  const navigate = useNavigate();
  
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
  const isAdminRole = userRole === 'admin' || userRole === 'super_admin';
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
    <TableRow className={cn(
      "transition-colors border-b border-border/30 group", 
      getRowUrgencyClass(lead, reminderTime),
      isFakeLead && "opacity-50 bg-red-50 hover:bg-red-100/60 pointer-events-auto",
      isLocked && "opacity-70",
      isSuspiciousLead && !isFakeLead && "bg-red-50/50 hover:bg-red-100/40"
    )}>
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
                    const AGENT_COLOR_MAP: Record<string, string> = {
                      'isobel': 'bg-emerald-600',
                      'james': 'bg-blue-600',
                      'ash': 'bg-violet-600',
                    };
                    const FALLBACK_COLORS = [
                      'bg-orange-600', 'bg-pink-600', 'bg-indigo-600', 'bg-teal-600',
                      'bg-rose-600', 'bg-cyan-600', 'bg-amber-600'
                    ];
                    const assignedUser = lead.assigned_user || salesUsers.find(u => u.id === lead.assigned_to);
                    const firstName = (assignedUser?.first_name || '').toLowerCase();
                    const agentColor = AGENT_COLOR_MAP[firstName]
                      || FALLBACK_COLORS[salesUsers.findIndex(u => u.id === lead.assigned_to) % FALLBACK_COLORS.length];
                    const initial = assignedUser?.first_name?.[0]?.toUpperCase() || assignedUser?.email?.[0]?.toUpperCase() || 'A';
                    const displayName = assignedUser 
                      ? `${assignedUser.first_name || ''}`.trim() || assignedUser.email?.split('@')[0] || 'Assigned'
                      : 'Assigned';
                    return (
                      <>
                        <div className={`h-5 w-5 rounded-full ${agentColor} text-white flex items-center justify-center text-[10px] font-bold flex-shrink-0`}>
                          {initial}
                        </div>
                        <span className="truncate">{displayName}</span>
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
              {salesUsers.filter(u => u.id !== WEBSITE_SALES_ACCOUNT_ID).map((user, idx) => {
                const AGENT_COLOR_MAP: Record<string, string> = {
                  'isobel': 'bg-emerald-600',
                  'james': 'bg-blue-600',
                  'ash': 'bg-violet-600',
                };
                const FALLBACK_COLORS = [
                  'bg-orange-600', 'bg-pink-600', 'bg-indigo-600', 'bg-teal-600',
                  'bg-rose-600', 'bg-cyan-600', 'bg-amber-600'
                ];
                const uFirstName = (user.first_name || '').toLowerCase();
                const color = AGENT_COLOR_MAP[uFirstName]
                  || FALLBACK_COLORS[idx % FALLBACK_COLORS.length];
                return (
                <SelectItem key={user.id} value={user.id}>
                  <div className="flex items-center gap-2">
                    <div className={`h-5 w-5 rounded-full ${color} text-white flex items-center justify-center text-[10px] font-medium`}>
                      {user.first_name?.[0]?.toUpperCase() || user.email?.[0]?.toUpperCase()}
                    </div>
                    <span>{`${user.first_name || ''} ${user.last_name || ''}`.trim() || user.email}</span>
                  </div>
                </SelectItem>
                );
              })}
            </SelectContent>
          </Select>
      </TableCell>}

      {/* Source indicator — O/F/G — admin/super_admin only */}
      {showSourceColumn && (
        <TableCell className="text-center">
          {(() => {
            const src = lead.lead_source;
            const metadata = lead.cart_metadata as { gclid?: string; fbclid?: string; utm_source?: string; utm_medium?: string; utm_campaign?: string } | null;
            if (src === 'google_ad') {
              const gclid = metadata?.gclid;
              const tip = gclid ? `Google Ads\nGCLID: ${gclid}` : 'Google Ads (no GCLID captured)';
              return <span className="text-[11px] font-bold text-emerald-700 cursor-help" title={tip}>G</span>;
            }
            if (src === 'social_ad') {
              const fbclid = metadata?.fbclid;
              const utmSrc = metadata?.utm_source;
              const parts = ['Facebook Ads'];
              if (fbclid) parts.push(`FBCLID: ${fbclid}`);
              if (utmSrc) parts.push(`UTM Source: ${utmSrc}`);
              if (!fbclid && !utmSrc) parts.push('(no FBCLID captured)');
              return <span className="text-[11px] font-bold text-blue-700 cursor-help" title={parts.join('\n')}>F</span>;
            }
            return <span className="text-[11px] font-medium text-muted-foreground cursor-help" title="Organic">O</span>;
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
        <Select
          value={lead.status}
          onValueChange={(value) => onUpdateStatus(value as LeadStatus)}
        >
          <SelectTrigger className={cn("w-[100px] h-7 text-xs", statusColors[lead.status])}>
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="new">New</SelectItem>
            <SelectItem value="contacted">Contacted</SelectItem>
            <SelectItem value="follow_up">Follow-up</SelectItem>
            <SelectItem value="quote_sent">Quote Sent</SelectItem>
            <SelectItem value="urgent_callback">Urgent Call-back</SelectItem>
            <SelectItem value="negotiating">Negotiating</SelectItem>
            <SelectItem value="converted">Converted</SelectItem>
            <SelectItem value="lost">Lost</SelectItem>
            <SelectItem value="fake_lead">Fake 404</SelectItem>
          </SelectContent>
        </Select>
        )}
      </TableCell>
      )}

      {/* Callback indicator */}
      {!isLeadGenView && (
      <TableCell className="text-center">
        {lead.is_callback ? (
          <Tooltip delayDuration={100}>
            <TooltipTrigger asChild>
              <Badge className="text-[10px] px-1.5 py-0.5 bg-teal-100 text-teal-800 border-teal-300 cursor-default">
                <Phone className="h-3 w-3 mr-0.5" />
                CB
              </Badge>
            </TooltipTrigger>
            <TooltipContent side="top" className="text-xs">Callback requested from website</TooltipContent>
          </Tooltip>
        ) : (
          <span className="text-muted-foreground text-xs">—</span>
        )}
      </TableCell>
      )}

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
                <ChevronDown className={cn("h-5 w-5 transition-transform duration-180", isExpanded && "rotate-180")} strokeWidth={3} />
              </Button>
            </TooltipTrigger>
            <TooltipContent side="top" className="text-xs">
              {isExpanded ? "Close" : "Click to open"}
            </TooltipContent>
          </Tooltip>
          
          <CopyButton value={lead.phone || ''} type="phone" />
          
          <Tooltip delayDuration={100}>
            <TooltipTrigger asChild>
              <Button 
                variant="ghost" 
                size="icon"
                className={cn("h-7 w-7 relative", (lead.notes || noteCount > 0) && "text-amber-600")}
                onClick={onToggleExpand}
              >
                <StickyNote className="h-3.5 w-3.5" />
                {noteCount > 0 ? (
                  <span className="absolute -top-1 -right-1 h-3.5 w-3.5 bg-amber-500 text-white text-[9px] rounded-full flex items-center justify-center font-bold">
                    {noteCount}
                  </span>
                ) : lead.notes ? (
                  <span className="absolute -top-0.5 -right-0.5 h-2 w-2 rounded-full bg-amber-500" />
                ) : null}
              </Button>
            </TooltipTrigger>
            <TooltipContent side="top" className="text-xs">
              {lead.notes ? 'View notes' : 'Add note'}
            </TooltipContent>
          </Tooltip>
          
          <CopyButton value={lead.email} type="email" />
          <RemindMePopover leadId={lead.id} compact />
          
          {onSendQuote && !lead.is_paid && (
            <Tooltip delayDuration={100}>
              <TooltipTrigger asChild>
                <Button 
                  variant="outline" 
                  size="sm"
                  className="h-7 px-2 text-xs font-medium text-orange-600 border-orange-300 hover:bg-orange-50"
                  onClick={onSendQuote}
                >
                  <FileText className="h-3 w-3 mr-1" />
                  Quote
                </Button>
              </TooltipTrigger>
              <TooltipContent side="top" className="text-xs">Send Quote</TooltipContent>
            </Tooltip>
          )}

          {(lead.status === 'fake_lead' || lead.status === 'lost') && (
            <Tooltip delayDuration={100}>
              <TooltipTrigger asChild>
                <Button
                  variant="outline"
                  size="sm"
                  className="h-7 px-2 text-xs font-medium"
                  onClick={() => onUpdateStatus('archived' as any)}
                >
                  <X className="h-3 w-3 mr-1" />
                  Hide
                </Button>
              </TooltipTrigger>
              <TooltipContent side="top" className="text-xs">Hide from New Leads</TooltipContent>
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
              <PhoneCopyText phone={lead.phone} />
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

      {/* Last Activity */}
      {!isLeadGenView && (
      <TableCell>
        <span className="text-xs text-muted-foreground">
          {formatDistanceToNow(new Date(lead.last_activity_date), { addSuffix: true })}
        </span>
      </TableCell>
      )}

      {/* Lead Date (Created) */}
      {!isLeadGenView && (
      <TableCell>
        <span className="text-xs text-muted-foreground">
          {format(new Date(lead.created_at), 'MMM d, yyyy HH:mm')}
        </span>
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
    prevProps.salesUsers.length === nextProps.salesUsers.length &&
    prevProps.isPaidLocked === nextProps.isPaidLocked &&
    prevProps.showSourceColumn === nextProps.showSourceColumn &&
    prevProps.hasPendingAccessRequest === nextProps.hasPendingAccessRequest &&
    prevProps.hasApprovedAccess === nextProps.hasApprovedAccess &&
    prevProps.isLeadGenView === nextProps.isLeadGenView &&
    prevProps.reminderTime === nextProps.reminderTime
  );
});

LeadTableRow.displayName = 'LeadTableRow';
