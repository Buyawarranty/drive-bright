import React, { memo, useState, useCallback } from 'react';
import { Lead, LeadStatus, LeadPriority, LeadTag, AdminUser } from '@/hooks/useLeads';
import { SentQuote } from '@/hooks/useLeadQuotes';
import { TableCell, TableRow } from '@/components/ui/table';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover';
import { Calendar } from '@/components/ui/calendar';
import { Tooltip, TooltipContent, TooltipTrigger } from '@/components/ui/tooltip';
import { Checkbox } from '@/components/ui/checkbox';
import { RemindMePopover } from './RemindMePopover';
import { CopyButton } from './CopyButton';
import { CallCountCell } from './CallCountCell';
import { QuoteSentCell } from './QuoteSentCell';
import { 
  Phone, Mail, MessageSquare, Calendar as CalendarIcon, 
  Tag, AlertTriangle, FileText, StickyNote,
  CheckCircle, ChevronDown, Send, ExternalLink, Flame, X, Plus, User
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
  
  return { label: 'Low', color: 'bg-gray-100 text-gray-600', priority: 4 };
};

const getRowUrgencyClass = (lead: Lead): string => {
  if (lead.is_paid) return 'bg-green-50 hover:bg-green-100/70';
  const sla = getUrgencySLA(lead);
  if (sla.priority === 0) return 'bg-red-50 hover:bg-red-100/70';
  if (sla.priority === 1) return 'bg-amber-50 hover:bg-amber-100/70';
  if (lead.is_from_abandoned_cart) return 'bg-amber-50/30 hover:bg-amber-100/50';
  return 'hover:bg-muted/50';
};

// Memoized copy text component
const PhoneCopyText = memo<{ phone: string }>(({ phone }) => {
  const [copied, setCopied] = useState(false);
  
  const handleCopy = useCallback(async () => {
    try {
      await navigator.clipboard.writeText(phone);
      setCopied(true);
      toast.success('Phone number copied', { duration: 1500 });
      setTimeout(() => setCopied(false), 2000);
    } catch (error) {
      toast.error('Failed to copy');
    }
  }, [phone]);
  
  return (
    <Tooltip delayDuration={100}>
      <TooltipTrigger asChild>
        <span 
          className={cn(
            "text-xs font-medium cursor-pointer hover:text-primary select-all truncate max-w-[100px] transition-colors",
            copied && "text-green-600"
          )}
          onClick={handleCopy}
          role="button"
          tabIndex={0}
        >
          {copied ? 'Copied ✓' : formatUKPhone(phone)}
        </span>
      </TooltipTrigger>
      <TooltipContent side="top" className="text-xs">
        {copied ? 'Copied ✓' : 'Click to copy'}
      </TooltipContent>
    </Tooltip>
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
  onSendQuote
}) => {
  const [followUpDate, setFollowUpDate] = useState<Date | undefined>();
  const [followUpType, setFollowUpType] = useState('call');
  const navigate = useNavigate();
  
  const sla = getUrgencySLA(lead);
  
  const displayName = lead.first_name || lead.last_name 
    ? `${lead.first_name || ''} ${lead.last_name || ''}`.trim()
    : lead.full_name && !lead.full_name.includes('@') ? lead.full_name : null;
  
  const isOverdue = lead.next_action_date && isPast(new Date(lead.next_action_date)) && lead.follow_up_status === 'pending';
  const isFakeLead = lead.status === 'fake_lead';

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
      "transition-colors", 
      getRowUrgencyClass(lead),
      isFakeLead && "opacity-40 bg-gray-50 hover:opacity-60"
    )}>
      {/* Selection Checkbox */}
      <TableCell onClick={(e) => e.stopPropagation()}>
        <Checkbox
          checked={isSelected}
          onCheckedChange={onSelect}
          aria-label={`Select ${lead.email}`}
        />
      </TableCell>

      {/* Assigned To - Shows "Assign now" for unassigned leads */}
      <TableCell className="sticky left-0 bg-inherit z-10" onClick={(e) => e.stopPropagation()}>
        <Select
          value={lead.assigned_to || 'unassigned'}
          onValueChange={(value) => {
            if (value === 'auto') {
              onAutoAssign();
            } else {
              onAssign(value === 'unassigned' ? null : value);
            }
          }}
        >
            <SelectTrigger 
              className={cn(
                "w-[120px] h-8 text-xs font-medium transition-all",
                !lead.assigned_to 
                  ? "border-2 border-dashed border-blue-500 bg-blue-50 text-blue-700 hover:border-blue-600 hover:bg-blue-100 animate-pulse" 
                  : "border border-green-300 bg-green-50 text-green-800 hover:border-green-400"
              )}
            >
              <div className="flex items-center gap-1.5 w-full">
                {lead.assigned_to ? (
                  // Assigned state - show initials avatar
                  // Fall back to salesUsers lookup if assigned_user is not populated
                  (() => {
                    const assignedUser = lead.assigned_user || salesUsers.find(u => u.id === lead.assigned_to);
                    const initial = assignedUser?.first_name?.[0]?.toUpperCase() || assignedUser?.email?.[0]?.toUpperCase() || 'A';
                    const displayName = assignedUser 
                      ? `${assignedUser.first_name || ''}`.trim() || assignedUser.email?.split('@')[0] || 'Assigned'
                      : 'Assigned';
                    return (
                      <>
                        <div className="h-5 w-5 rounded-full bg-green-600 text-white flex items-center justify-center text-[10px] font-bold flex-shrink-0">
                          {initial}
                        </div>
                        <span className="truncate">{displayName}</span>
                      </>
                    );
                  })()
                ) : (
                  // Unassigned state - "Assign now" call to action
                  <>
                    <User className="h-3.5 w-3.5 flex-shrink-0" />
                    <span className="font-semibold">Assign now</span>
                  </>
                )}
              </div>
            </SelectTrigger>
            <SelectContent className="bg-popover border shadow-lg z-50">
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
              <div className="h-px bg-border my-1" />
              {salesUsers.map((user) => (
                <SelectItem key={user.id} value={user.id}>
                  <div className="flex items-center gap-2">
                    <div className="h-5 w-5 rounded-full bg-muted flex items-center justify-center text-[10px] font-medium">
                      {user.first_name?.[0]?.toUpperCase() || user.email?.[0]?.toUpperCase()}
                    </div>
                    <span>{`${user.first_name || ''} ${user.last_name || ''}`.trim() || user.email}</span>
                  </div>
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
      </TableCell>

      {/* Status */}
      <TableCell onClick={(e) => e.stopPropagation()}>
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
            <SelectItem value="fake_lead">Fake Lead</SelectItem>
          </SelectContent>
        </Select>
      </TableCell>

      {/* Call Count - Enhanced with dialog and guardrails */}
      <TableCell onClick={(e) => e.stopPropagation()}>
        <CallCountCell
          lead={lead}
          onUpdateCallCount={onUpdateCallCount}
          onUpdateStatus={onUpdateStatus}
          onScheduleFollowUp={onScheduleFollowUp}
          onLogActivity={onLogActivity}
        />
      </TableCell>

      {/* Quick Actions */}
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
                className={cn("h-7 w-7 relative", lead.notes && "text-amber-600")}
                onClick={onToggleExpand}
              >
                <StickyNote className="h-3.5 w-3.5" />
                {lead.notes && <span className="absolute -top-0.5 -right-0.5 h-2 w-2 rounded-full bg-amber-500" />}
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
        </div>
      </TableCell>

      {/* Payment Status */}
      <TableCell onClick={(e) => e.stopPropagation()}>
        {lead.is_paid ? (
          <div className="space-y-0.5">
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
          </div>
        ) : (
          <span className="text-muted-foreground text-xs">—</span>
        )}
      </TableCell>

      {/* Price - Competitor price + Our quotes */}
      <TableCell onClick={(e) => e.stopPropagation()}>
        <div className="space-y-1">
          {/* Competitor price from cart_metadata */}
          {lead.cart_metadata?.competitorPrice && (
            <div className="flex items-center gap-1">
              <Badge variant="outline" className="text-[10px] px-1.5 py-0.5 bg-red-50 text-red-700 border-red-200 font-semibold">
                🎯 £{lead.cart_metadata.competitorPrice}
              </Badge>
            </div>
          )}
          {/* Our sent quotes */}
          {sentQuotes && sentQuotes.length > 0 && (
            <div className="flex flex-col gap-0.5">
              {sentQuotes.slice(0, 2).map((quote, idx) => (
                <Badge 
                  key={idx} 
                  variant="outline" 
                  className="text-[10px] px-1.5 py-0.5 bg-green-50 text-green-700 border-green-200 font-medium"
                >
                  📤 £{quote.total_price?.toFixed(0) || 'N/A'}
                </Badge>
              ))}
              {sentQuotes.length > 2 && (
                <span className="text-[10px] text-muted-foreground">+{sentQuotes.length - 2} more</span>
              )}
            </div>
          )}
          {/* Fallback if no pricing info */}
          {!lead.cart_metadata?.competitorPrice && (!sentQuotes || sentQuotes.length === 0) && (
            <span className="text-muted-foreground text-xs">—</span>
          )}
        </div>
      </TableCell>

      {/* Quote Sent */}
      <TableCell onClick={(e) => e.stopPropagation()}>
        <QuoteSentCell quotes={sentQuotes || []} leadEmail={lead.email} />
      </TableCell>

      {/* Next Action */}
      <TableCell onClick={(e) => e.stopPropagation()}>
        {lead.next_action_date ? (
          <div className={cn("text-xs", isOverdue && "text-red-600 font-semibold")}>
            <div className="flex items-center gap-1 font-medium">
              {lead.next_action_type === 'call' && <Phone className="h-3 w-3" />}
              {lead.next_action_type === 'email' && <Mail className="h-3 w-3" />}
              {lead.next_action_type === 'meeting' && <User className="h-3 w-3" />}
              {lead.next_action_type === 'sms' && <MessageSquare className="h-3 w-3" />}
              {getNextActionLabel()}
            </div>
            <div className="text-muted-foreground">
              {format(new Date(lead.next_action_date), 'MMM d, HH:mm')}
            </div>
          </div>
        ) : (
          <Popover>
            <PopoverTrigger asChild>
              <Button variant="outline" size="sm" className="h-7 text-xs w-full">
                <CalendarIcon className="h-3 w-3 mr-1" />Schedule
              </Button>
            </PopoverTrigger>
            <PopoverContent className="w-auto p-3">
              <div className="space-y-3">
                <Select value={followUpType} onValueChange={setFollowUpType}>
                  <SelectTrigger className="w-full">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="call">📞 Call</SelectItem>
                    <SelectItem value="email">✉️ Email</SelectItem>
                    <SelectItem value="whatsapp">💬 WhatsApp</SelectItem>
                    <SelectItem value="sms">📱 SMS</SelectItem>
                    <SelectItem value="quote">📄 Send quote</SelectItem>
                    <SelectItem value="meeting">👤 Meeting</SelectItem>
                  </SelectContent>
                </Select>
                <Calendar mode="single" selected={followUpDate} onSelect={setFollowUpDate} />
                <Button 
                  size="sm" 
                  className="w-full"
                  disabled={!followUpDate}
                  onClick={() => {
                    if (followUpDate) {
                      onScheduleFollowUp(followUpType, followUpDate.toISOString());
                      setFollowUpDate(undefined);
                    }
                  }}
                >
                  Schedule
                </Button>
              </div>
            </PopoverContent>
          </Popover>
        )}
      </TableCell>

      {/* Urgency SLA */}
      <TableCell>
        <Badge className={cn("text-xs font-medium", sla.color)}>{sla.label}</Badge>
      </TableCell>

      {/* Name */}
      <TableCell>
        <div className="flex items-center gap-1.5">
          {isOverdue && <AlertTriangle className="h-3.5 w-3.5 text-red-500 flex-shrink-0" />}
          {lead.application_count > 1 && (
            <Badge className="text-[10px] px-1.5 py-0.5 bg-orange-500 text-white border-0 flex items-center gap-0.5 flex-shrink-0">
              <Flame className="h-3 w-3" />{lead.application_count}x
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
        </div>
      </TableCell>

      {/* Phone */}
      <TableCell onClick={(e) => e.stopPropagation()}>
        {lead.phone ? (
          <div className="flex items-center gap-0.5">
            <PhoneCopyText phone={lead.phone} />
            <div className="flex items-center">
              <Tooltip delayDuration={100}>
                <TooltipTrigger asChild>
                  <Button 
                    variant="ghost" 
                    size="icon"
                    className="h-6 w-6 text-green-600 hover:text-green-700 hover:bg-green-50"
                    onClick={() => {
                      window.open(`tel:${lead.phone}`);
                      if (!lead.is_from_abandoned_cart) onLogActivity('call', 'Made phone call');
                    }}
                  >
                    <Phone className="h-3 w-3" />
                  </Button>
                </TooltipTrigger>
                <TooltipContent side="top" className="text-xs">Call</TooltipContent>
              </Tooltip>
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

      {/* Step Reached */}
      <TableCell>
        {lead.step_abandoned ? (
          <Badge 
            variant="outline" 
            className={cn(
              "text-xs font-medium",
              lead.step_abandoned === 1 && "bg-red-50 text-red-700 border-red-200",
              lead.step_abandoned === 2 && "bg-orange-50 text-orange-700 border-orange-200",
              lead.step_abandoned === 3 && "bg-yellow-50 text-yellow-700 border-yellow-200",
              lead.step_abandoned === 4 && "bg-blue-50 text-blue-700 border-blue-200"
            )}
          >
            Step {lead.step_abandoned}
          </Badge>
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
                  window.open(`mailto:${lead.email}`);
                  if (!lead.is_from_abandoned_cart) onLogActivity('email', 'Sent email');
                }}
              >
                <Send className="h-3 w-3" />
              </Button>
            </TooltipTrigger>
            <TooltipContent side="top" className="text-xs">Send email</TooltipContent>
          </Tooltip>
        </div>
      </TableCell>

      {/* Plan */}
      <TableCell>
        {lead.plan_name || lead.plan_interest ? (
          <Badge variant="secondary" className="text-xs font-normal truncate max-w-[110px]">
            {lead.plan_name || lead.plan_interest}
            {lead.payment_type && <span className="ml-1 opacity-70 capitalize">• {lead.payment_type}</span>}
          </Badge>
        ) : (
          <Badge variant="outline" className="text-xs text-muted-foreground">Quote requested</Badge>
        )}
      </TableCell>

      {/* Reg Plate */}
      <TableCell>
        {lead.vehicle_reg ? (
          <Badge variant="outline" className="font-mono text-xs">{lead.vehicle_reg}</Badge>
        ) : (
          <span className="text-muted-foreground text-xs">—</span>
        )}
      </TableCell>

      {/* Mileage */}
      <TableCell className="text-right">
        {lead.mileage ? (
          <span className="text-xs font-medium">{formatMileageTier(lead.mileage)}</span>
        ) : (
          <span className="text-muted-foreground text-xs">—</span>
        )}
      </TableCell>

      {/* Tags */}
      <TableCell onClick={(e) => e.stopPropagation()}>
        <div className="flex flex-wrap gap-1 items-center max-w-[130px]">
          {(lead.tags || []).slice(0, 2).map((tag) => (
            <Badge 
              key={tag.id}
              style={{ backgroundColor: tag.color }}
              className="text-[10px] px-1.5 py-0 text-white flex items-center gap-0.5"
            >
              {tag.name}
              {!lead.is_from_abandoned_cart && (
                <X 
                  className="h-2.5 w-2.5 cursor-pointer hover:opacity-75" 
                  onClick={() => onRemoveTag(tag.id)}
                />
              )}
            </Badge>
          ))}
          {(lead.tags || []).length > 2 && (
            <Badge variant="outline" className="text-[10px] px-1">+{(lead.tags || []).length - 2}</Badge>
          )}
          {!lead.is_from_abandoned_cart && (
            <Popover>
              <PopoverTrigger asChild>
                <Button variant="ghost" size="icon" className="h-5 w-5">
                  <Plus className="h-3 w-3" />
                </Button>
              </PopoverTrigger>
              <PopoverContent className="w-40 p-2">
                <div className="space-y-1 max-h-32 overflow-y-auto">
                  {tags.filter(t => !(lead.tags || []).some(lt => lt.id === t.id)).map((tag) => (
                    <Button
                      key={tag.id}
                      variant="ghost"
                      size="sm"
                      className="w-full justify-start text-xs h-7"
                      onClick={() => onAddTag(tag.id)}
                    >
                      <span 
                        className="w-2 h-2 rounded-full mr-2" 
                        style={{ backgroundColor: tag.color }}
                      />
                      {tag.name}
                    </Button>
                  ))}
                </div>
              </PopoverContent>
            </Popover>
          )}
        </div>
      </TableCell>

      {/* Last Activity */}
      <TableCell>
        <span className="text-xs text-muted-foreground">
          {formatDistanceToNow(new Date(lead.last_activity_date), { addSuffix: true })}
        </span>
      </TableCell>

      {/* Date Created */}
      <TableCell>
        <span className="text-xs text-muted-foreground">
          {format(new Date(lead.created_at), 'MMM d, yyyy')}
        </span>
      </TableCell>
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
    prevProps.lead.call_count === nextProps.lead.call_count &&
    prevProps.lead.tags?.length === nextProps.lead.tags?.length &&
    prevProps.isSelected === nextProps.isSelected &&
    prevProps.isExpanded === nextProps.isExpanded
  );
});

LeadTableRow.displayName = 'LeadTableRow';
