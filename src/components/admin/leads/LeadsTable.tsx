import React, { useState, useCallback, useRef } from 'react';
import { Lead, LeadStatus, LeadPriority, LeadTag, AdminUser } from '@/hooks/useLeads';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover';
import { Calendar } from '@/components/ui/calendar';
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from '@/components/ui/tooltip';
import { LeadDetailsPanel } from './LeadDetailsPanel';
import { RemindMePopover } from './RemindMePopover';
import { CopyButton } from './CopyButton';
import { 
  Phone, Mail, MessageSquare, Calendar as CalendarIcon, 
  Tag, User, Clock, AlertTriangle, Copy, FileText, StickyNote,
  CheckCircle, CreditCard, ChevronDown, ChevronUp, Send, ExternalLink, Flame, Check
} from 'lucide-react';
import { useNavigate } from 'react-router-dom';
import { toast } from 'sonner';
import { format, formatDistanceToNow, isPast, differenceInHours, differenceInDays, isToday } from 'date-fns';
import { cn } from '@/lib/utils';


interface LeadsTableProps {
  leads: Lead[];
  tags: LeadTag[];
  salesUsers: AdminUser[];
  onUpdateStatus: (leadId: string, status: LeadStatus) => void;
  onAssign: (leadId: string, userId: string | null) => void;
  onAutoAssign: (leadId: string) => void;
  onUpdatePriority: (leadId: string, priority: LeadPriority) => void;
  onScheduleFollowUp: (leadId: string, actionType: string, actionDate: string) => void;
  onAddTag: (leadId: string, tagId: string) => void;
  onRemoveTag: (leadId: string, tagId: string) => void;
  onUpdateNotes: (leadId: string, notes: string) => void;
  onMarkContacted: (leadId: string) => void;
  onLogActivity: (leadId: string, type: string, description: string) => void;
}

const statusColors: Record<LeadStatus, string> = {
  new: 'bg-blue-100 text-blue-800',
  contacted: 'bg-yellow-100 text-yellow-800',
  follow_up: 'bg-purple-100 text-purple-800',
  quote_sent: 'bg-indigo-100 text-indigo-800',
  negotiating: 'bg-orange-100 text-orange-800',
  converted: 'bg-green-100 text-green-800',
  lost: 'bg-gray-100 text-gray-800'
};

// Format UK phone number for display (e.g., 07788 230 043)
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

// Format mileage tier for display based on Step 1 selection
const formatMileageTier = (mileage: string): string => {
  const numericMileage = parseInt(mileage.replace(/,/g, ''), 10);
  if (isNaN(numericMileage)) return mileage;
  
  // 100000 = "Under 120,000 miles" selection, 130000 = "Over 120,000 miles" selection
  if (numericMileage >= 120000) {
    return 'Over 120k';
  }
  return 'Up to 120k';
};

// Get urgency SLA based on next action date and lead age
const getUrgencySLA = (lead: Lead): { label: string; color: string; priority: number } => {
  // If there's a next action date, use that
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
  
  // For new leads without action, base urgency on age
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

// Get row background based on SLA urgency and payment status
const getRowUrgencyClass = (lead: Lead): string => {
  // Paid leads get a green highlight
  if (lead.is_paid) return 'bg-green-50 hover:bg-green-100/70';
  
  const sla = getUrgencySLA(lead);
  if (sla.priority === 0) return 'bg-red-50 hover:bg-red-100/70'; // Overdue
  if (sla.priority === 1) return 'bg-amber-50 hover:bg-amber-100/70'; // Due today
  if (lead.is_from_abandoned_cart) return 'bg-amber-50/30 hover:bg-amber-100/50'; // Cart leads
  return 'hover:bg-muted/50';
};

// Copy-first text component for phone numbers
const PhoneCopyText: React.FC<{ phone: string }> = ({ phone }) => {
  const [copied, setCopied] = useState(false);
  
  const handleCopy = async () => {
    try {
      await navigator.clipboard.writeText(phone);
      setCopied(true);
      toast.success('Phone number copied to clipboard', { duration: 1500 });
      setTimeout(() => setCopied(false), 2000);
    } catch (error) {
      toast.error('Failed to copy');
    }
  };
  
  return (
    <Tooltip delayDuration={100}>
      <TooltipTrigger asChild>
        <span 
          className={cn(
            "text-xs font-medium cursor-pointer hover:text-primary select-all truncate max-w-[100px] transition-colors",
            copied && "text-green-600"
          )}
          onClick={handleCopy}
          title={phone}
          role="button"
          tabIndex={0}
          onKeyDown={(e) => { if (e.key === 'Enter') handleCopy(); }}
          aria-label="Copy phone number"
        >
          {copied ? 'Copied ✓' : formatUKPhone(phone)}
        </span>
      </TooltipTrigger>
      <TooltipContent side="top" className="text-xs">
        {copied ? 'Copied ✓' : 'Click to copy'}
      </TooltipContent>
    </Tooltip>
  );
};

// Copy-first text component for emails
const EmailCopyText: React.FC<{ email: string }> = ({ email }) => {
  const [copied, setCopied] = useState(false);
  
  const handleCopy = async () => {
    try {
      await navigator.clipboard.writeText(email);
      setCopied(true);
      toast.success('Email copied to clipboard', { duration: 1500 });
      setTimeout(() => setCopied(false), 2000);
    } catch (error) {
      toast.error('Failed to copy');
    }
  };
  
  return (
    <Tooltip delayDuration={100}>
      <TooltipTrigger asChild>
        <span 
          className={cn(
            "text-xs cursor-pointer hover:text-primary select-all truncate max-w-[120px] transition-colors",
            copied && "text-green-600"
          )}
          onClick={handleCopy}
          title={email}
          role="button"
          tabIndex={0}
          onKeyDown={(e) => { if (e.key === 'Enter') handleCopy(); }}
          aria-label="Copy email address"
        >
          {copied ? 'Copied ✓' : email}
        </span>
      </TooltipTrigger>
      <TooltipContent side="top" className="text-xs">
        {copied ? 'Copied ✓' : 'Click to copy'}
      </TooltipContent>
    </Tooltip>
  );
};

export const LeadsTable: React.FC<LeadsTableProps> = ({
  leads,
  tags,
  salesUsers,
  onUpdateStatus,
  onAssign,
  onAutoAssign,
  onUpdatePriority,
  onScheduleFollowUp,
  onAddTag,
  onRemoveTag,
  onUpdateNotes,
  onMarkContacted,
  onLogActivity
}) => {
  const [expandedLead, setExpandedLead] = useState<string | null>(null);
  const [followUpDate, setFollowUpDate] = useState<Date | undefined>();
  const [followUpType, setFollowUpType] = useState('call');
  const [hoverTimeouts, setHoverTimeouts] = useState<Record<string, NodeJS.Timeout>>({});
  const navigate = useNavigate();

  // Hover intent handler (450-600ms delay before opening)
  const handleHoverIntent = useCallback((leadId: string, action: 'enter' | 'leave') => {
    if (action === 'enter') {
      const timeout = setTimeout(() => {
        setExpandedLead(leadId);
      }, 500); // 500ms hover intent
      setHoverTimeouts(prev => ({ ...prev, [leadId]: timeout }));
    } else {
      if (hoverTimeouts[leadId]) {
        clearTimeout(hoverTimeouts[leadId]);
        setHoverTimeouts(prev => {
          const newTimeouts = { ...prev };
          delete newTimeouts[leadId];
          return newTimeouts;
        });
      }
    }
  }, [hoverTimeouts]);

  const handleViewCustomer = (email: string) => {
    // Navigate to customers tab with email filter pre-applied
    navigate(`/admin?tab=customers&search=${encodeURIComponent(email)}`);
  };

  const getDisplayName = (lead: Lead) => {
    // Only show name if we have first_name or last_name (from step 4 or manual entry)
    if (lead.first_name || lead.last_name) {
      return `${lead.first_name || ''} ${lead.last_name || ''}`.trim();
    }
    // If full_name exists and is not the email, use it
    if (lead.full_name && !lead.full_name.includes('@')) {
      return lead.full_name;
    }
    return null; // No name available
  };

  const isOverdue = (lead: Lead) => {
    return lead.next_action_date && isPast(new Date(lead.next_action_date)) && lead.follow_up_status === 'pending';
  };

  const getNextActionLabel = (lead: Lead) => {
    if (!lead.next_action_type) return 'Schedule';
    const labels: Record<string, string> = {
      call: 'Call',
      email: 'Email',
      meeting: 'Meeting',
      sms: 'SMS',
      whatsapp: 'WhatsApp',
      quote: 'Send quote',
      follow_up: 'Follow up'
    };
    return labels[lead.next_action_type] || 'Schedule';
  };

  return (
    <div className="rounded-md border overflow-x-auto">
      <Table>
        <TableHeader>
          <TableRow className="bg-muted/30">
            <TableHead className="sticky left-0 bg-muted/30 z-10 w-[120px] min-w-[120px]">Assigned To</TableHead>
            <TableHead className="w-[100px]">Status</TableHead>
            <TableHead className="w-[120px]">Actions</TableHead>
            <TableHead className="w-[90px]">Payment</TableHead>
            <TableHead className="w-[100px]">Next Action</TableHead>
            <TableHead className="w-[90px]">Urgency</TableHead>
            <TableHead className="w-[120px]">Name</TableHead>
            <TableHead className="w-[160px]">Phone</TableHead>
            <TableHead className="w-[60px]">Step</TableHead>
            <TableHead className="w-[180px]">Email</TableHead>
            <TableHead className="w-[120px]">Plan</TableHead>
            <TableHead className="w-[90px]">Reg Plate</TableHead>
            <TableHead className="w-[70px] text-right">Mileage</TableHead>
            <TableHead className="w-[140px]">Tags</TableHead>
            <TableHead className="w-[100px]">Last Activity</TableHead>
            <TableHead className="w-[100px]">Date Created</TableHead>
          </TableRow>
        </TableHeader>
        <TableBody>
          {leads.map((lead) => {
            const sla = getUrgencySLA(lead);
            const displayName = getDisplayName(lead);
            
            return (
              <React.Fragment key={lead.id}>
                <TableRow 
                  className={cn(
                    "cursor-pointer transition-colors",
                    getRowUrgencyClass(lead)
                  )}
                  onClick={() => setExpandedLead(expandedLead === lead.id ? null : lead.id)}
                  onMouseEnter={() => handleHoverIntent(lead.id, 'enter')}
                  onMouseLeave={() => handleHoverIntent(lead.id, 'leave')}
                >
                  {/* Assigned To - First column, Sticky */}
                  <TableCell className="sticky left-0 bg-inherit z-10" onClick={(e) => e.stopPropagation()}>
                    <Select
                      value={lead.assigned_to || 'unassigned'}
                      onValueChange={(value) => {
                        if (!lead.is_from_abandoned_cart) {
                          if (value === 'auto') {
                            onAutoAssign(lead.id);
                          } else {
                            onAssign(lead.id, value === 'unassigned' ? null : value);
                          }
                        }
                      }}
                      disabled={lead.is_from_abandoned_cart}
                    >
                      <SelectTrigger className={cn(
                        "w-[110px] h-7 text-xs",
                        !lead.assigned_to && "border-amber-400 bg-amber-50"
                      )}>
                        <SelectValue placeholder="Unassigned">
                          {lead.assigned_user 
                            ? `${lead.assigned_user.first_name || ''} ${lead.assigned_user.last_name || ''}`.trim() || lead.assigned_user.email.split('@')[0]
                            : 'Unassigned'
                          }
                        </SelectValue>
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="unassigned">Unassigned</SelectItem>
                        <SelectItem value="auto">🔄 Auto-assign</SelectItem>
                        {salesUsers.map((user) => (
                          <SelectItem key={user.id} value={user.id}>
                            {`${user.first_name || ''} ${user.last_name || ''}`.trim() || user.email}
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  </TableCell>

                  {/* Status */}
                  <TableCell onClick={(e) => e.stopPropagation()}>
                    <Select
                      value={lead.status}
                      onValueChange={(value) => {
                        if (!lead.is_from_abandoned_cart) {
                          onUpdateStatus(lead.id, value as LeadStatus);
                        }
                      }}
                      disabled={lead.is_from_abandoned_cart}
                    >
                      <SelectTrigger className={cn("w-[100px] h-7 text-xs", statusColors[lead.status])}>
                        <SelectValue />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="new">New</SelectItem>
                        <SelectItem value="contacted">Contacted</SelectItem>
                        <SelectItem value="follow_up">Follow-up</SelectItem>
                        <SelectItem value="quote_sent">Quote Sent</SelectItem>
                        <SelectItem value="negotiating">Negotiating</SelectItem>
                        <SelectItem value="converted">Converted</SelectItem>
                        <SelectItem value="lost">Lost</SelectItem>
                      </SelectContent>
                    </Select>
                  </TableCell>

                  {/* Quick Actions */}
                  <TableCell onClick={(e) => e.stopPropagation()}>
                    <TooltipProvider>
                      <div className="flex items-center gap-1">
                        {/* Expand/Collapse - Primary action with hover intent */}
                        <Tooltip delayDuration={100}>
                          <TooltipTrigger asChild>
                            <Button 
                              variant={expandedLead === lead.id ? "default" : "outline"}
                              size="icon"
                              className={cn(
                                "h-9 w-9 transition-all duration-150",
                                expandedLead === lead.id 
                                  ? "bg-primary text-primary-foreground shadow-lg scale-105" 
                                  : "border-2 border-primary hover:border-primary hover:bg-primary hover:text-primary-foreground hover:scale-110 hover:shadow-md"
                              )}
                              onMouseEnter={() => handleHoverIntent(lead.id, 'enter')}
                              onMouseLeave={() => handleHoverIntent(lead.id, 'leave')}
                              onClick={() => {
                                // Clear any pending hover timeout
                                if (hoverTimeouts[lead.id]) {
                                  clearTimeout(hoverTimeouts[lead.id]);
                                }
                                setExpandedLead(expandedLead === lead.id ? null : lead.id);
                              }}
                              onKeyDown={(e) => {
                                if (e.key === 'Enter' || e.key === ' ') {
                                  setExpandedLead(expandedLead === lead.id ? null : lead.id);
                                }
                                if (e.key === 'Escape' && expandedLead === lead.id) {
                                  setExpandedLead(null);
                                }
                              }}
                              aria-expanded={expandedLead === lead.id}
                              aria-label={expandedLead === lead.id ? "Close details" : "Open details"}
                            >
                              <ChevronDown 
                                className={cn(
                                  "h-5 w-5 transition-transform duration-180",
                                  expandedLead === lead.id && "rotate-180"
                                )} 
                                strokeWidth={3} 
                              />
                            </Button>
                          </TooltipTrigger>
                          <TooltipContent side="top" className="text-xs">
                            {expandedLead === lead.id ? "Close" : "Hover or click to open"}
                          </TooltipContent>
                        </Tooltip>
                        
                        {/* Phone - Copy first */}
                        <CopyButton value={lead.phone || ''} type="phone" />
                        
                        {/* Notes */}
                        <Tooltip delayDuration={100}>
                          <TooltipTrigger asChild>
                            <Button 
                              variant="ghost" 
                              size="icon"
                              className="h-7 w-7 hover:scale-110 transition-transform"
                              onClick={() => setExpandedLead(lead.id)}
                              aria-label="Add note"
                            >
                              <StickyNote className="h-3.5 w-3.5" />
                            </Button>
                          </TooltipTrigger>
                          <TooltipContent side="top" className="text-xs">Add note</TooltipContent>
                        </Tooltip>
                        
                        {/* Email - Copy first */}
                        <CopyButton value={lead.email} type="email" />
                        
                        <RemindMePopover leadId={lead.id} compact />
                      </div>
                    </TooltipProvider>
                  </TableCell>

                  {/* Payment Status */}
                  <TableCell onClick={(e) => e.stopPropagation()}>
                    {lead.is_paid ? (
                      <div className="space-y-0.5">
                        <Badge className="bg-green-500 text-white text-[10px] flex items-center gap-1 w-fit">
                          <CheckCircle className="h-3 w-3" />
                          PAID
                        </Badge>
                        <div className="text-[10px] text-muted-foreground">
                          £{lead.payment_amount?.toFixed(2) || 'N/A'}
                        </div>
                        <div className="text-[10px] text-muted-foreground capitalize">
                          {lead.payment_method || '—'}
                        </div>
                        {lead.step_two_completed_at && lead.payment_date && (
                          <div className="text-[9px] text-green-600 font-medium">
                            {(() => {
                              const step2 = new Date(lead.step_two_completed_at);
                              const paid = new Date(lead.payment_date);
                              const diffMs = paid.getTime() - step2.getTime();
                              const diffMins = Math.round(diffMs / 60000);
                              const diffHours = Math.round(diffMs / 3600000);
                              const diffDays = Math.round(diffMs / 86400000);
                              if (diffMins < 60) return `${diffMins}m to pay`;
                              if (diffHours < 24) return `${diffHours}h to pay`;
                              return `${diffDays}d to pay`;
                            })()}
                          </div>
                        )}
                        {/* View Customer Profile Link */}
                        <Button
                          variant="link"
                          size="sm"
                          className="h-5 px-0 text-[10px] text-primary hover:text-primary/80 font-medium"
                          onClick={() => handleViewCustomer(lead.email)}
                        >
                          <ExternalLink className="h-3 w-3 mr-1" />
                          View Customer
                        </Button>
                      </div>
                    ) : (
                      <span className="text-muted-foreground text-xs">—</span>
                    )}
                  </TableCell>

                  {/* Next Action - After Payment */}
                  <TableCell onClick={(e) => e.stopPropagation()}>
                    {lead.next_action_date ? (
                      <div className={cn(
                        "text-xs",
                        isOverdue(lead) && "text-red-600 font-semibold"
                      )}>
                        <div className="flex items-center gap-1 font-medium">
                          {lead.next_action_type === 'call' && <Phone className="h-3 w-3" />}
                          {lead.next_action_type === 'email' && <Mail className="h-3 w-3" />}
                          {lead.next_action_type === 'meeting' && <User className="h-3 w-3" />}
                          {lead.next_action_type === 'sms' && <MessageSquare className="h-3 w-3" />}
                          {getNextActionLabel(lead)}
                        </div>
                        <div className="text-muted-foreground">
                          {format(new Date(lead.next_action_date), 'MMM d, HH:mm')}
                        </div>
                      </div>
                    ) : (
                      <Popover>
                        <PopoverTrigger asChild>
                          <Button variant="outline" size="sm" className="h-7 text-xs w-full">
                            <CalendarIcon className="h-3 w-3 mr-1" />
                            Schedule
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
                            <Calendar
                              mode="single"
                              selected={followUpDate}
                              onSelect={setFollowUpDate}
                            />
                            <Button 
                              size="sm" 
                              className="w-full"
                              disabled={!followUpDate}
                              onClick={() => {
                                if (followUpDate) {
                                  onScheduleFollowUp(lead.id, followUpType, followUpDate.toISOString());
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
                    <Badge className={cn("text-xs font-medium", sla.color)}>
                      {sla.label}
                    </Badge>
                  </TableCell>

                  {/* Name */}
                  <TableCell>
                    <div className="flex items-center gap-1.5">
                      {isOverdue(lead) && <AlertTriangle className="h-3.5 w-3.5 text-red-500 flex-shrink-0" />}
                      {/* Hot Lead Indicator - Applied multiple times */}
                      {lead.application_count > 1 && (
                        <Badge 
                          className="text-[10px] px-1.5 py-0.5 bg-orange-500 text-white border-0 flex items-center gap-0.5 flex-shrink-0"
                          title={`Applied ${lead.application_count} times - Hot Lead!`}
                        >
                          <Flame className="h-3 w-3" />
                          {lead.application_count}x
                        </Badge>
                      )}
                      {displayName ? (
                        <span className="font-medium text-sm truncate max-w-[100px]" title={displayName}>
                          {displayName}
                        </span>
                      ) : (
                        <span className="text-muted-foreground text-xs">—</span>
                      )}
                      {lead.is_from_abandoned_cart && (
                        <Badge variant="outline" className="text-[10px] px-1 py-0 bg-amber-100 text-amber-800 border-amber-300 flex-shrink-0">
                          Cart
                        </Badge>
                      )}
                    </div>
                  </TableCell>

                  {/* Phone - Copy-first behaviour */}
                  <TableCell onClick={(e) => e.stopPropagation()}>
                    <TooltipProvider>
                      {lead.phone ? (
                        <div className="flex items-center gap-0.5">
                          <PhoneCopyText phone={lead.phone} />
                          <div className="flex items-center">
                            <Tooltip delayDuration={100}>
                              <TooltipTrigger asChild>
                                <Button 
                                  variant="ghost" 
                                  size="icon"
                                  className="h-6 w-6 text-green-600 hover:text-green-700 hover:bg-green-50 hover:scale-110 transition-transform"
                                  onClick={() => {
                                    window.open(`tel:${lead.phone}`);
                                    if (!lead.is_from_abandoned_cart) {
                                      onLogActivity(lead.id, 'call', 'Made phone call');
                                    }
                                  }}
                                  aria-label="Call"
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
                                  className="h-6 w-6 text-green-600 hover:text-green-700 hover:bg-green-50 hover:scale-110 transition-transform"
                                  onClick={() => {
                                    window.open(`https://wa.me/${lead.phone?.replace(/\D/g, '')}`);
                                  }}
                                  aria-label="WhatsApp"
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
                    </TooltipProvider>
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
                        title={`Dropped off at Step ${lead.step_abandoned}`}
                      >
                        Step {lead.step_abandoned}
                      </Badge>
                    ) : (
                      <span className="text-muted-foreground text-xs">—</span>
                    )}
                  </TableCell>

                  {/* Email - Copy-first behaviour */}
                  <TableCell onClick={(e) => e.stopPropagation()}>
                    <TooltipProvider>
                      <div className="flex items-center gap-0.5">
                        <EmailCopyText email={lead.email} />
                        <Tooltip delayDuration={100}>
                          <TooltipTrigger asChild>
                            <Button 
                              variant="ghost" 
                              size="icon"
                              className="h-6 w-6 flex-shrink-0 text-blue-600 hover:text-blue-700 hover:bg-blue-50 hover:scale-110 transition-transform"
                              onClick={() => {
                                window.open(`mailto:${lead.email}`);
                                if (!lead.is_from_abandoned_cart) {
                                  onLogActivity(lead.id, 'email', 'Sent email');
                                }
                              }}
                              aria-label="Send email"
                            >
                              <Send className="h-3 w-3" />
                            </Button>
                          </TooltipTrigger>
                          <TooltipContent side="top" className="text-xs">Send email</TooltipContent>
                        </Tooltip>
                      </div>
                    </TooltipProvider>
                  </TableCell>

                  {/* Plan */}
                  <TableCell>
                    {lead.plan_name || lead.plan_interest ? (
                      <Badge variant="secondary" className="text-xs font-normal truncate max-w-[110px]" title={lead.plan_name || lead.plan_interest || ''}>
                        {lead.plan_name || lead.plan_interest}
                        {lead.payment_type && (
                          <span className="ml-1 opacity-70 capitalize">• {lead.payment_type}</span>
                        )}
                      </Badge>
                    ) : (
                      <Badge variant="outline" className="text-xs text-muted-foreground">
                        Quote requested
                      </Badge>
                    )}
                  </TableCell>

                  {/* Reg Plate */}
                  <TableCell>
                    {lead.vehicle_reg ? (
                      <Badge variant="outline" className="font-mono text-xs">
                        {lead.vehicle_reg}
                      </Badge>
                    ) : (
                      <span className="text-muted-foreground text-xs">—</span>
                    )}
                  </TableCell>

                  {/* Mileage - Right aligned */}
                  <TableCell className="text-right">
                    {lead.mileage ? (
                      <span className="text-xs font-medium">{formatMileageTier(lead.mileage)}</span>
                    ) : (
                      <span className="text-muted-foreground text-xs">—</span>
                    )}
                  </TableCell>

                  {/* Tags */}
                  <TableCell onClick={(e) => e.stopPropagation()}>
                    <div className="flex flex-wrap gap-1 max-w-[130px]">
                      {lead.tags?.slice(0, 2).map((tag) => (
                        <Badge 
                          key={tag.id} 
                          style={{ backgroundColor: tag.color, color: 'white' }}
                          className="text-[10px] px-1.5 py-0 cursor-pointer"
                          onClick={() => onRemoveTag(lead.id, tag.id)}
                        >
                          {tag.name}
                        </Badge>
                      ))}
                      {(lead.tags?.length || 0) > 2 && (
                        <Badge variant="outline" className="text-[10px] px-1 py-0">
                          +{(lead.tags?.length || 0) - 2}
                        </Badge>
                      )}
                      <Popover>
                        <PopoverTrigger asChild>
                          <Button variant="ghost" size="icon" className="h-5 w-5">
                            <Tag className="h-3 w-3" />
                          </Button>
                        </PopoverTrigger>
                        <PopoverContent className="w-48 p-2">
                          <div className="space-y-1">
                            {tags.map((tag) => (
                              <Button
                                key={tag.id}
                                variant="ghost"
                                size="sm"
                                className="w-full justify-start text-xs"
                                onClick={() => onAddTag(lead.id, tag.id)}
                              >
                                <div 
                                  className="w-3 h-3 rounded-full mr-2" 
                                  style={{ backgroundColor: tag.color }} 
                                />
                                {tag.name}
                              </Button>
                            ))}
                          </div>
                        </PopoverContent>
                      </Popover>
                    </div>
                  </TableCell>

                  {/* Last Activity */}
                  <TableCell>
                    <div 
                      className="text-xs text-muted-foreground"
                      title={format(new Date(lead.last_activity_date), 'PPp')}
                    >
                      {formatDistanceToNow(new Date(lead.last_activity_date), { addSuffix: true })}
                    </div>
                  </TableCell>

                  {/* Date Created */}
                  <TableCell>
                    <div 
                      className="text-xs text-muted-foreground"
                      title={format(new Date(lead.created_at), 'PPp')}
                    >
                      <div>{format(new Date(lead.created_at), 'dd MMM yy')}</div>
                      <div className="opacity-70">{format(new Date(lead.created_at), 'HH:mm')}</div>
                    </div>
                  </TableCell>
                </TableRow>
                
                {/* Expanded row with new LeadDetailsPanel */}
                {expandedLead === lead.id && (
                  <TableRow>
                    <TableCell colSpan={16} className="p-0 bg-muted/20">
                      <LeadDetailsPanel
                        lead={lead}
                        onUpdateNotes={onUpdateNotes}
                        onLogActivity={onLogActivity}
                      />
                    </TableCell>
                  </TableRow>
                )}
              </React.Fragment>
            );
          })}
          
          {leads.length === 0 && (
            <TableRow>
              <TableCell colSpan={14} className="text-center py-8 text-muted-foreground">
                No leads found
              </TableCell>
            </TableRow>
          )}
        </TableBody>
      </Table>
    </div>
  );
};
