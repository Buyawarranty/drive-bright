import React, { useState, useCallback } from 'react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { 
  Table, TableBody, TableCell, TableHead, 
  TableHeader, TableRow 
} from '@/components/ui/table';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { Lead, LeadTag, LeadStatus } from '@/hooks/useLeads';
import { 
  Phone, Mail, FileText, 
  Clock, AlertTriangle, Search, Users, Minus, Plus, ChevronDown, ChevronUp
} from 'lucide-react';
import { format, isToday, isPast, formatDistanceToNow } from 'date-fns';
import { LeadDetailsPanel } from '../leads/LeadDetailsPanel';

interface LeadHandlers {
  updateLeadStatus: (leadId: string, status: LeadStatus) => Promise<void>;
  scheduleFollowUp: (leadId: string, date: string, actionType: string) => Promise<void>;
  updateLeadNotes: (leadId: string, notes: string, replaceAll?: boolean) => Promise<void>;
  markContactedAt: (leadId: string) => Promise<void>;
  logActivity: (leadId: string, activityType: string, description: string) => Promise<void>;
  updateCallCount?: (leadId: string, increment: number) => Promise<void>;
}

interface SalesAgentLeadsTableProps {
  leads: Lead[];
  tags: LeadTag[];
  currentUserId: string;
  handlers: LeadHandlers;
  onSendQuote: (lead: Lead) => void;
  onRefresh?: () => void;
}

export const SalesAgentLeadsTable: React.FC<SalesAgentLeadsTableProps> = ({
  leads,
  tags,
  currentUserId,
  handlers,
  onSendQuote,
  onRefresh
}) => {
  const [searchTerm, setSearchTerm] = useState('');
  const [statusFilter, setStatusFilter] = useState<string>('all');
  const [expandedLead, setExpandedLead] = useState<string | null>(null);

  const filteredLeads = leads.filter(lead => {
    const matchesSearch = !searchTerm || 
      lead.email.toLowerCase().includes(searchTerm.toLowerCase()) ||
      lead.first_name?.toLowerCase().includes(searchTerm.toLowerCase()) ||
      lead.last_name?.toLowerCase().includes(searchTerm.toLowerCase()) ||
      lead.phone?.toLowerCase().includes(searchTerm.toLowerCase()) ||
      lead.vehicle_reg?.toLowerCase().includes(searchTerm.toLowerCase());
    
    const matchesStatus = statusFilter === 'all' || lead.status === statusFilter;
    
    return matchesSearch && matchesStatus;
  });

  const handleToggleExpand = useCallback((leadId: string) => {
    setExpandedLead(prev => prev === leadId ? null : leadId);
  }, []);

  const getUrgencyBadge = (lead: Lead) => {
    if (!lead.next_action_date) return null;
    
    const actionDate = new Date(lead.next_action_date);
    if (isPast(actionDate) && lead.follow_up_status === 'pending') {
      return <Badge variant="destructive" className="gap-1"><AlertTriangle className="h-3 w-3" /> Overdue</Badge>;
    }
    if (isToday(actionDate)) {
      return <Badge variant="secondary" className="bg-yellow-100 text-yellow-800 gap-1"><Clock className="h-3 w-3" /> Due Today</Badge>;
    }
    return <Badge variant="outline" className="gap-1"><Clock className="h-3 w-3" /> {formatDistanceToNow(actionDate)}</Badge>;
  };

  const getStatusBadge = (status: string) => {
    const variants: Record<string, string> = {
      new: 'bg-blue-100 text-blue-800',
      contacted: 'bg-yellow-100 text-yellow-800',
      follow_up: 'bg-purple-100 text-purple-800',
      quoted: 'bg-indigo-100 text-indigo-800',
      converted: 'bg-green-100 text-green-800',
      lost: 'bg-gray-100 text-gray-800',
    };
    return <Badge className={variants[status] || 'bg-gray-100'}>{status.replace('_', ' ')}</Badge>;
  };

  if (leads.length === 0) {
    return (
      <Card>
        <CardContent className="py-12 text-center">
          <Users className="h-12 w-12 mx-auto mb-3 opacity-50" />
          <p className="font-medium">No leads assigned to you</p>
          <p className="text-sm text-muted-foreground mt-1">
            Contact your manager to get leads assigned
          </p>
        </CardContent>
      </Card>
    );
  }

  return (
    <Card>
      <CardHeader>
        <CardTitle>My Leads ({leads.length})</CardTitle>
        <CardDescription>Leads assigned to you - work through these to close sales</CardDescription>
      </CardHeader>
      <CardContent className="space-y-4">
        {/* Filters */}
        <div className="flex gap-3">
          <div className="relative flex-1">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
            <Input
              placeholder="Search by name, email, phone, or vehicle..."
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              className="pl-10"
            />
          </div>
          <Select value={statusFilter} onValueChange={setStatusFilter}>
            <SelectTrigger className="w-[150px]">
              <SelectValue placeholder="All Statuses" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all">All Statuses</SelectItem>
              <SelectItem value="new">New</SelectItem>
              <SelectItem value="contacted">Contacted</SelectItem>
              <SelectItem value="follow_up">Follow Up</SelectItem>
              <SelectItem value="quoted">Quoted</SelectItem>
              <SelectItem value="converted">Converted</SelectItem>
              <SelectItem value="lost">Lost</SelectItem>
            </SelectContent>
          </Select>
        </div>

        {/* Table - With expandable rows for notes */}
        <div className="rounded-md border overflow-hidden">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead className="w-[40px]"></TableHead>
                <TableHead>Customer</TableHead>
                <TableHead>Contact</TableHead>
                <TableHead>Vehicle</TableHead>
                <TableHead className="text-center">Calls</TableHead>
                <TableHead>Status</TableHead>
                <TableHead>Actions</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {filteredLeads.map((lead) => (
                <React.Fragment key={lead.id}>
                  <TableRow 
                    className={expandedLead === lead.id ? 'bg-muted/50' : 'cursor-pointer hover:bg-muted/30'}
                    onClick={() => handleToggleExpand(lead.id)}
                  >
                    <TableCell>
                      <Button
                        size="icon"
                        variant="ghost"
                        className="h-6 w-6"
                        onClick={(e) => {
                          e.stopPropagation();
                          handleToggleExpand(lead.id);
                        }}
                      >
                        {expandedLead === lead.id ? (
                          <ChevronUp className="h-4 w-4" />
                        ) : (
                          <ChevronDown className="h-4 w-4" />
                        )}
                      </Button>
                    </TableCell>
                    <TableCell>
                      <div>
                        <p className="font-medium">
                          {lead.first_name || 'Unknown'} {lead.last_name || ''}
                        </p>
                        <p className="text-xs text-muted-foreground">
                          {lead.plan_interest || 'No plan specified'}
                        </p>
                      </div>
                    </TableCell>
                    <TableCell>
                      <div className="space-y-1">
                        <p className="text-sm">{lead.email}</p>
                        {lead.phone && (
                          <p className="text-xs text-muted-foreground">{lead.phone}</p>
                        )}
                      </div>
                    </TableCell>
                    <TableCell>
                      {lead.vehicle_reg ? (
                        <div>
                          <p className="font-mono text-sm">{lead.vehicle_reg}</p>
                          <p className="text-xs text-muted-foreground">
                            {lead.vehicle_make} {lead.vehicle_model}
                          </p>
                        </div>
                      ) : (
                        <span className="text-muted-foreground">-</span>
                      )}
                    </TableCell>
                    <TableCell onClick={(e) => e.stopPropagation()}>
                      <div className="flex items-center justify-center gap-1">
                        <Button
                          size="icon"
                          variant="ghost"
                          className="h-6 w-6"
                          onClick={() => handlers.updateCallCount?.(lead.id, -1)}
                          disabled={!lead.call_count || lead.call_count <= 0}
                        >
                          <Minus className="h-3 w-3" />
                        </Button>
                        <span className="w-6 text-center font-medium text-sm">
                          {lead.call_count || 0}
                        </span>
                        <Button
                          size="icon"
                          variant="ghost"
                          className="h-6 w-6 text-green-600 hover:text-green-700 hover:bg-green-50"
                          onClick={() => handlers.updateCallCount?.(lead.id, 1)}
                        >
                          <Plus className="h-3 w-3" />
                        </Button>
                      </div>
                    </TableCell>
                    <TableCell onClick={(e) => e.stopPropagation()}>
                      <Select 
                        value={lead.status} 
                        onValueChange={(value) => handlers.updateLeadStatus(lead.id, value as LeadStatus)}
                      >
                        <SelectTrigger className="w-[130px] h-8">
                          <SelectValue />
                        </SelectTrigger>
                        <SelectContent>
                          <SelectItem value="new">New</SelectItem>
                          <SelectItem value="contacted">Contacted</SelectItem>
                          <SelectItem value="follow_up">Follow Up</SelectItem>
                          <SelectItem value="quoted">Quoted</SelectItem>
                          <SelectItem value="converted">Converted</SelectItem>
                          <SelectItem value="lost">Lost</SelectItem>
                        </SelectContent>
                      </Select>
                    </TableCell>
                    <TableCell onClick={(e) => e.stopPropagation()}>
                      <div className="flex items-center gap-1">
                        <Button 
                          size="icon" 
                          variant="ghost" 
                          className="h-8 w-8"
                          onClick={() => {
                            if (lead.phone) window.open(`tel:${lead.phone}`);
                          }}
                          disabled={!lead.phone}
                          title="Call"
                        >
                          <Phone className="h-4 w-4" />
                        </Button>
                        <Button 
                          size="icon" 
                          variant="ghost" 
                          className="h-8 w-8"
                          onClick={() => window.open(`mailto:${lead.email}`)}
                          title="Email"
                        >
                          <Mail className="h-4 w-4" />
                        </Button>
                        <Button 
                          size="sm" 
                          variant="outline"
                          className="h-8 gap-1"
                          onClick={() => onSendQuote(lead)}
                        >
                          <FileText className="h-3 w-3" />
                          Quote
                        </Button>
                      </div>
                    </TableCell>
                  </TableRow>
                  
                  {/* Expanded row with LeadDetailsPanel */}
                  {expandedLead === lead.id && (
                    <TableRow>
                      <TableCell colSpan={7} className="p-0 bg-muted/20">
                        <LeadDetailsPanel
                          lead={lead}
                          onUpdateNotes={handlers.updateLeadNotes}
                          onLogActivity={handlers.logActivity}
                          onRefresh={onRefresh}
                          onNavigateToQuote={() => onSendQuote(lead)}
                        />
                      </TableCell>
                    </TableRow>
                  )}
                </React.Fragment>
              ))}
            </TableBody>
          </Table>
        </div>
      </CardContent>
    </Card>
  );
};