import React, { useState } from 'react';
import { Lead, LeadStatus, LeadPriority, LeadTag, AdminUser } from '@/hooks/useLeads';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover';
import { Calendar } from '@/components/ui/calendar';
import { Textarea } from '@/components/ui/textarea';
import { 
  Phone, Mail, MessageSquare, Calendar as CalendarIcon, 
  Tag, User, Clock, AlertTriangle, Copy, FileText, StickyNote
} from 'lucide-react';
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

// Get row background based on SLA urgency
const getRowUrgencyClass = (lead: Lead): string => {
  const sla = getUrgencySLA(lead);
  if (sla.priority === 0) return 'bg-red-50 hover:bg-red-100/70'; // Overdue
  if (sla.priority === 1) return 'bg-amber-50 hover:bg-amber-100/70'; // Due today
  if (lead.is_from_abandoned_cart) return 'bg-amber-50/30 hover:bg-amber-100/50'; // Cart leads
  return 'hover:bg-muted/50';
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
  const [editingNotes, setEditingNotes] = useState<string | null>(null);
  const [notesValue, setNotesValue] = useState('');

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
            <TableHead className="sticky left-0 bg-muted/30 z-10 w-[100px]">Next Action</TableHead>
            <TableHead className="w-[100px]">Status</TableHead>
            <TableHead className="w-[90px]">Urgency</TableHead>
            <TableHead className="sticky left-[100px] bg-muted/30 z-10 w-[160px]">Phone</TableHead>
            <TableHead className="w-[120px]">Name</TableHead>
            <TableHead className="w-[180px]">Email</TableHead>
            <TableHead className="w-[120px]">Plan</TableHead>
            <TableHead className="w-[90px]">Reg Plate</TableHead>
            <TableHead className="w-[70px] text-right">Mileage</TableHead>
            <TableHead className="w-[140px]">Tags</TableHead>
            <TableHead className="w-[120px]">Assigned To</TableHead>
            <TableHead className="w-[100px]">Last Activity</TableHead>
            <TableHead className="w-[100px]">Date Created</TableHead>
            <TableHead className="w-[90px]">Actions</TableHead>
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
                >
                  {/* Next Action - Sticky */}
                  <TableCell className="sticky left-0 bg-inherit z-10" onClick={(e) => e.stopPropagation()}>
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

                  {/* Urgency SLA */}
                  <TableCell>
                    <Badge className={cn("text-xs font-medium", sla.color)}>
                      {sla.label}
                    </Badge>
                  </TableCell>

                  {/* Phone - Sticky */}
                  <TableCell className="sticky left-[100px] bg-inherit z-10" onClick={(e) => e.stopPropagation()}>
                    {lead.phone ? (
                      <div className="flex items-center gap-0.5">
                        <span 
                          className="text-xs font-medium cursor-pointer hover:text-primary select-all truncate max-w-[90px]"
                          onClick={() => {
                            navigator.clipboard.writeText(lead.phone || '');
                            toast.success('Phone copied');
                          }}
                          title={lead.phone}
                        >
                          {lead.phone}
                        </span>
                        <div className="flex items-center">
                          <Button 
                            variant="ghost" 
                            size="icon"
                            className="h-6 w-6"
                            onClick={() => {
                              navigator.clipboard.writeText(lead.phone || '');
                              toast.success('Phone copied');
                            }}
                            title="Copy"
                          >
                            <Copy className="h-3 w-3" />
                          </Button>
                          <Button 
                            variant="ghost" 
                            size="icon"
                            className="h-6 w-6 text-green-600 hover:text-green-700 hover:bg-green-50"
                            onClick={() => {
                              window.open(`tel:${lead.phone}`);
                              if (!lead.is_from_abandoned_cart) {
                                onLogActivity(lead.id, 'call', 'Made phone call');
                              }
                            }}
                            title="Call"
                          >
                            <Phone className="h-3 w-3" />
                          </Button>
                          <Button 
                            variant="ghost" 
                            size="icon"
                            className="h-6 w-6 text-green-600 hover:text-green-700 hover:bg-green-50"
                            onClick={() => {
                              window.open(`https://wa.me/${lead.phone?.replace(/\D/g, '')}`);
                            }}
                            title="WhatsApp"
                          >
                            <MessageSquare className="h-3 w-3" />
                          </Button>
                        </div>
                      </div>
                    ) : (
                      <span className="text-muted-foreground text-xs">—</span>
                    )}
                  </TableCell>

                  {/* Name */}
                  <TableCell>
                    <div className="flex items-center gap-1.5">
                      {isOverdue(lead) && <AlertTriangle className="h-3.5 w-3.5 text-red-500 flex-shrink-0" />}
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

                  {/* Email */}
                  <TableCell onClick={(e) => e.stopPropagation()}>
                    <div className="flex items-center gap-0.5">
                      <span 
                        className="text-xs cursor-pointer hover:text-primary select-all truncate max-w-[120px]"
                        onClick={() => {
                          navigator.clipboard.writeText(lead.email);
                          toast.success('Email copied');
                        }}
                        title={lead.email}
                      >
                        {lead.email}
                      </span>
                      <Button 
                        variant="ghost" 
                        size="icon"
                        className="h-6 w-6 flex-shrink-0"
                        onClick={() => {
                          navigator.clipboard.writeText(lead.email);
                          toast.success('Email copied');
                        }}
                        title="Copy"
                      >
                        <Copy className="h-3 w-3" />
                      </Button>
                      <Button 
                        variant="ghost" 
                        size="icon"
                        className="h-6 w-6 flex-shrink-0 text-blue-600 hover:text-blue-700 hover:bg-blue-50"
                        onClick={() => {
                          window.open(`mailto:${lead.email}`);
                          if (!lead.is_from_abandoned_cart) {
                            onLogActivity(lead.id, 'email', 'Sent email');
                          }
                        }}
                        title="Send email"
                      >
                        <Mail className="h-3 w-3" />
                      </Button>
                    </div>
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
                      <span className="text-xs font-mono">{lead.mileage.replace(/,/g, '')}</span>
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

                  {/* Assigned To */}
                  <TableCell onClick={(e) => e.stopPropagation()}>
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

                  {/* Quick Actions */}
                  <TableCell onClick={(e) => e.stopPropagation()}>
                    <div className="flex items-center gap-0.5">
                      <Button 
                        variant="ghost" 
                        size="icon"
                        className="h-7 w-7 text-green-600 hover:text-green-700 hover:bg-green-50"
                        onClick={() => {
                          if (lead.phone) {
                            window.open(`tel:${lead.phone}`);
                            if (!lead.is_from_abandoned_cart) {
                              onLogActivity(lead.id, 'call', 'Made phone call');
                            }
                          } else {
                            toast.error('No phone number');
                          }
                        }}
                        title="Call"
                      >
                        <Phone className="h-3.5 w-3.5" />
                      </Button>
                      <Button 
                        variant="ghost" 
                        size="icon"
                        className="h-7 w-7"
                        onClick={() => {
                          setExpandedLead(lead.id);
                          setEditingNotes(lead.id);
                          setNotesValue(lead.notes || '');
                        }}
                        title="Add note"
                      >
                        <StickyNote className="h-3.5 w-3.5" />
                      </Button>
                      <Button 
                        variant="ghost" 
                        size="icon"
                        className="h-7 w-7 text-blue-600 hover:text-blue-700 hover:bg-blue-50"
                        onClick={() => {
                          window.open(`mailto:${lead.email}?subject=Your Warranty Quote`);
                          if (!lead.is_from_abandoned_cart) {
                            onLogActivity(lead.id, 'email', 'Sent quote email');
                          }
                        }}
                        title="Send quote"
                      >
                        <FileText className="h-3.5 w-3.5" />
                      </Button>
                    </div>
                  </TableCell>
                </TableRow>
                
                {/* Expanded row */}
                {expandedLead === lead.id && (
                  <TableRow>
                    <TableCell colSpan={14} className="bg-muted/30">
                      <div className="grid grid-cols-3 gap-4 p-4">
                        {/* Contact Details */}
                        <div>
                          <h4 className="font-medium mb-2">Contact Details</h4>
                          <div className="text-sm space-y-1">
                            <div><strong>Email:</strong> {lead.email}</div>
                            <div><strong>Phone:</strong> {lead.phone || '—'}</div>
                            <div><strong>Source:</strong> {lead.lead_source}</div>
                            <div><strong>Created:</strong> {format(new Date(lead.created_at), 'PPp')}</div>
                          </div>
                        </div>
                        
                        {/* Vehicle Details */}
                        <div>
                          <h4 className="font-medium mb-2">Vehicle Details</h4>
                          <div className="text-sm space-y-1">
                            <div><strong>Reg:</strong> {lead.vehicle_reg || '—'}</div>
                            <div><strong>Vehicle:</strong> {lead.vehicle_make} {lead.vehicle_model} ({lead.vehicle_year})</div>
                            <div><strong>Mileage:</strong> {lead.mileage || '—'}</div>
                            <div><strong>Type:</strong> {lead.vehicle_type || 'Standard'}</div>
                          </div>
                        </div>
                        
                        {/* Notes */}
                        <div>
                          <h4 className="font-medium mb-2">Notes</h4>
                          {editingNotes === lead.id ? (
                            <div className="space-y-2">
                              <Textarea
                                value={notesValue}
                                onChange={(e) => setNotesValue(e.target.value)}
                                className="text-sm"
                                rows={3}
                              />
                              <div className="flex gap-2">
                                <Button 
                                  size="sm"
                                  onClick={() => {
                                    onUpdateNotes(lead.id, notesValue);
                                    setEditingNotes(null);
                                  }}
                                >
                                  Save
                                </Button>
                                <Button 
                                  size="sm" 
                                  variant="outline"
                                  onClick={() => setEditingNotes(null)}
                                >
                                  Cancel
                                </Button>
                              </div>
                            </div>
                          ) : (
                            <div 
                              className="text-sm text-muted-foreground cursor-pointer p-2 rounded border hover:bg-muted"
                              onClick={() => {
                                setEditingNotes(lead.id);
                                setNotesValue(lead.notes || '');
                              }}
                            >
                              {lead.notes || 'Click to add notes...'}
                            </div>
                          )}
                        </div>
                      </div>
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
