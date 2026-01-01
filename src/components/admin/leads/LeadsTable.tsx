import React, { useState } from 'react';
import { Lead, LeadStatus, LeadPriority, LeadTag, AdminUser } from '@/hooks/useLeads';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover';
import { Calendar } from '@/components/ui/calendar';
import { Input } from '@/components/ui/input';
import { Textarea } from '@/components/ui/textarea';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from '@/components/ui/dialog';
import { 
  Phone, Mail, MessageSquare, Calendar as CalendarIcon, 
  Tag, MoreVertical, User, Clock, AlertTriangle,
  CheckCircle, XCircle, ChevronDown, Copy
} from 'lucide-react';
import { toast } from 'sonner';
import { format, formatDistanceToNow, isPast } from 'date-fns';
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

const priorityColors: Record<LeadPriority, string> = {
  low: 'bg-gray-100 text-gray-700',
  medium: 'bg-blue-100 text-blue-700',
  high: 'bg-orange-100 text-orange-700',
  urgent: 'bg-red-100 text-red-700'
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

  const getFullName = (lead: Lead) => {
    if (lead.first_name || lead.last_name) {
      return `${lead.first_name || ''} ${lead.last_name || ''}`.trim();
    }
    return lead.email.split('@')[0];
  };

  const isOverdue = (lead: Lead) => {
    return lead.next_action_date && isPast(new Date(lead.next_action_date)) && lead.follow_up_status === 'pending';
  };

  return (
    <div className="rounded-md border">
      <Table>
        <TableHeader>
          <TableRow>
            <TableHead>Date</TableHead>
            <TableHead>Name</TableHead>
            <TableHead>Phone</TableHead>
            <TableHead>Email</TableHead>
            <TableHead>Reg Plate</TableHead>
            <TableHead>Mileage</TableHead>
            <TableHead>Plan</TableHead>
            <TableHead>Status</TableHead>
            <TableHead>Assigned To</TableHead>
            <TableHead>Next Action</TableHead>
            <TableHead>Last Activity</TableHead>
            <TableHead>Tag</TableHead>
          </TableRow>
        </TableHeader>
        <TableBody>
          {leads.map((lead) => (
            <React.Fragment key={lead.id}>
              <TableRow 
                className={cn(
                  "cursor-pointer hover:bg-muted/50",
                  isOverdue(lead) && "bg-red-50",
                  lead.is_from_abandoned_cart && "bg-amber-50/50"
                )}
                onClick={() => setExpandedLead(expandedLead === lead.id ? null : lead.id)}
              >
                {/* Date */}
                <TableCell>
                  <div className="text-sm">
                    {format(new Date(lead.created_at), 'dd/MM/yyyy')}
                  </div>
                  <div className="text-xs text-muted-foreground">
                    {format(new Date(lead.created_at), 'HH:mm')}
                  </div>
                </TableCell>
                {/* Name */}
                <TableCell>
                  <div className="flex items-center gap-2">
                    {isOverdue(lead) && <AlertTriangle className="h-4 w-4 text-red-500" />}
                    <div className="font-medium">{getFullName(lead)}</div>
                    {lead.is_from_abandoned_cart && (
                      <Badge variant="outline" className="text-xs bg-amber-100 text-amber-800 border-amber-300">
                        Cart
                      </Badge>
                    )}
                  </div>
                </TableCell>
                {/* Phone */}
                <TableCell onClick={(e) => e.stopPropagation()}>
                  {lead.phone ? (
                    <div className="flex items-center gap-1">
                      <span 
                        className="text-sm font-medium cursor-pointer hover:text-primary select-all"
                        onClick={() => {
                          navigator.clipboard.writeText(lead.phone || '');
                          toast.success('Phone copied');
                        }}
                      >
                        {lead.phone}
                      </span>
                      <Button 
                        variant="ghost" 
                        size="icon"
                        className="h-6 w-6"
                        onClick={() => {
                          navigator.clipboard.writeText(lead.phone || '');
                          toast.success('Phone copied');
                        }}
                        title="Copy phone"
                      >
                        <Copy className="h-3 w-3" />
                      </Button>
                      <Button 
                        variant="ghost" 
                        size="icon"
                        className="h-6 w-6"
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
                        className="h-6 w-6"
                        onClick={() => {
                          window.open(`https://wa.me/${lead.phone?.replace(/\D/g, '')}`);
                        }}
                        title="WhatsApp"
                      >
                        <MessageSquare className="h-3 w-3" />
                      </Button>
                    </div>
                  ) : (
                    <span className="text-muted-foreground text-xs">—</span>
                  )}
                </TableCell>
                {/* Email */}
                <TableCell onClick={(e) => e.stopPropagation()}>
                  <div className="flex items-center gap-1">
                    <span 
                      className="text-sm cursor-pointer hover:text-primary select-all truncate max-w-[150px]"
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
                      title="Copy email"
                    >
                      <Copy className="h-3 w-3" />
                    </Button>
                    <Button 
                      variant="ghost" 
                      size="icon"
                      className="h-6 w-6 flex-shrink-0"
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
                {/* Mileage */}
                <TableCell>
                  {lead.mileage ? (
                    <span className="text-sm">{lead.mileage}</span>
                  ) : (
                    <span className="text-muted-foreground text-xs">—</span>
                  )}
                </TableCell>
                {/* Plan Details */}
                <TableCell>
                  {lead.plan_name || lead.plan_interest ? (
                    <div className="text-sm">
                      <div className="font-medium">{lead.plan_name || lead.plan_interest}</div>
                      {lead.payment_type && (
                        <div className="text-xs text-muted-foreground capitalize">{lead.payment_type}</div>
                      )}
                    </div>
                  ) : (
                    <span className="text-muted-foreground text-xs">—</span>
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
                    <SelectTrigger className={cn("w-[120px] h-7", statusColors[lead.status])}>
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
                    <SelectTrigger className="w-[130px] h-7">
                      <SelectValue placeholder="Unassigned">
                        {lead.assigned_user 
                          ? `${lead.assigned_user.first_name || ''} ${lead.assigned_user.last_name || ''}`.trim() || lead.assigned_user.email
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
                {/* Next Action */}
                <TableCell onClick={(e) => e.stopPropagation()}>
                  {lead.next_action_date ? (
                    <div className={cn(
                      "text-xs",
                      isOverdue(lead) && "text-red-600 font-medium"
                    )}>
                      <div className="flex items-center gap-1">
                        {lead.next_action_type === 'call' && <Phone className="h-3 w-3" />}
                        {lead.next_action_type === 'email' && <Mail className="h-3 w-3" />}
                        {lead.next_action_type === 'meeting' && <User className="h-3 w-3" />}
                        {format(new Date(lead.next_action_date), 'MMM d, HH:mm')}
                      </div>
                      {isOverdue(lead) && <span className="text-red-600">Overdue!</span>}
                    </div>
                  ) : (
                    <Popover>
                      <PopoverTrigger asChild>
                        <Button variant="ghost" size="sm" className="h-6 text-xs">
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
                              <SelectItem value="meeting">👤 Meeting</SelectItem>
                              <SelectItem value="sms">💬 SMS</SelectItem>
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
                {/* Last Activity */}
                <TableCell>
                  <div className="text-xs text-muted-foreground">
                    {formatDistanceToNow(new Date(lead.last_activity_date), { addSuffix: true })}
                  </div>
                </TableCell>
                {/* Tag */}
                <TableCell onClick={(e) => e.stopPropagation()}>
                  <div className="flex flex-wrap gap-1 max-w-[120px]">
                    {lead.tags?.slice(0, 2).map((tag) => (
                      <Badge 
                        key={tag.id} 
                        style={{ backgroundColor: tag.color, color: 'white' }}
                        className="text-xs cursor-pointer"
                        onClick={() => onRemoveTag(lead.id, tag.id)}
                      >
                        {tag.name}
                      </Badge>
                    ))}
                    {(lead.tags?.length || 0) > 2 && (
                      <Badge variant="outline" className="text-xs">
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
              </TableRow>
              
              {/* Expanded row */}
              {expandedLead === lead.id && (
                <TableRow>
                  <TableCell colSpan={12} className="bg-muted/30">
                    <div className="grid grid-cols-3 gap-4 p-4">
                      {/* Contact Details */}
                      <div>
                        <h4 className="font-medium mb-2">Contact Details</h4>
                        <div className="text-sm space-y-1">
                          <div><strong>Email:</strong> {lead.email}</div>
                          <div><strong>Phone:</strong> {lead.phone || '-'}</div>
                          <div><strong>Source:</strong> {lead.lead_source}</div>
                          <div><strong>Created:</strong> {format(new Date(lead.created_at), 'PPp')}</div>
                        </div>
                      </div>
                      
                      {/* Vehicle Details */}
                      <div>
                        <h4 className="font-medium mb-2">Vehicle Details</h4>
                        <div className="text-sm space-y-1">
                          <div><strong>Reg:</strong> {lead.vehicle_reg || '-'}</div>
                          <div><strong>Vehicle:</strong> {lead.vehicle_make} {lead.vehicle_model} ({lead.vehicle_year})</div>
                          <div><strong>Mileage:</strong> {lead.mileage || '-'}</div>
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
          ))}
          
          {leads.length === 0 && (
            <TableRow>
              <TableCell colSpan={11} className="text-center py-8 text-muted-foreground">
                No leads found
              </TableCell>
            </TableRow>
          )}
        </TableBody>
      </Table>
    </div>
  );
};
