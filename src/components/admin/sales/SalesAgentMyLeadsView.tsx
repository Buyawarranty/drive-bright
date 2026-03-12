import React, { useState, useMemo, useCallback } from 'react';
import { Card, CardContent } from '@/components/ui/card';
import { Tabs, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Input } from '@/components/ui/input';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover';
import { Calendar } from '@/components/ui/calendar';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { 
  Search, RefreshCw, CalendarIcon, X, ArrowUpDown,
  Bell, Users, Clock, AlertTriangle
} from 'lucide-react';
import { Lead, LeadTag, LeadStatus } from '@/hooks/useLeads';
import { LeadsTable } from '../leads/LeadsTable';
import { LeadsTableFooter } from '../leads/LeadsTableFooter';
import { useDebounce } from '@/hooks/useDebounce';
import { usePagination } from '@/hooks/usePagination';
import { format, subDays, startOfDay, endOfDay, isToday, isPast } from 'date-fns';
import { DateRange } from 'react-day-picker';

type SortOption = 'newest' | 'oldest' | 'contacted' | 'follow_up' | 'quote_sent';

interface SalesAgentMyLeadsViewProps {
  leads: Lead[];
  tags: LeadTag[];
  currentUserId: string;
  handlers: {
    updateLeadStatus: (leadId: string, status: LeadStatus) => Promise<void>;
    scheduleFollowUp: (leadId: string, date: string, actionType: string) => Promise<void>;
    updateLeadNotes: (leadId: string, notes: string, replaceAll?: boolean) => Promise<void>;
    markContactedAt: (leadId: string) => Promise<void>;
    logActivity: (leadId: string, activityType: string, description: string) => Promise<void>;
    updateCallCount?: (leadId: string, increment: number) => Promise<void>;
    addTagToLead?: (leadId: string, tagId: string) => Promise<void>;
    removeTagFromLead?: (leadId: string, tagId: string) => Promise<void>;
    updateLeadPriority?: (leadId: string, priority: string) => Promise<void>;
  };
  onSendQuote: (lead: Lead) => void;
  onRefresh?: () => void;
  hideAssignedColumn?: boolean;
}

export const SalesAgentMyLeadsView: React.FC<SalesAgentMyLeadsViewProps> = ({
  leads,
  tags,
  currentUserId,
  handlers,
  onSendQuote,
  onRefresh,
  hideAssignedColumn
}) => {
  // Default to 'new' instead of 'all' since we removed the All tab
  const [filter, setFilter] = useState<LeadStatus | 'all' | 'high_priority' | 'paid'>('new');
  const [searchTerm, setSearchTerm] = useState('');
  const [selectedLeads, setSelectedLeads] = useState<Set<string>>(new Set());
  const [dateRange, setDateRange] = useState<{ from: Date | undefined; to: Date | undefined }>({ from: undefined, to: undefined });
  const [sortOption, setSortOption] = useState<SortOption>('newest');
  const [isCalendarOpen, setIsCalendarOpen] = useState(false);

  const debouncedSearchTerm = useDebounce(searchTerm, 300);

  // Filter leads to only show those assigned to current user - exclude fake_lead
  const myLeads = useMemo(() => {
    return leads.filter(l => l.assigned_to === currentUserId && l.status !== 'fake_lead');
  }, [currentUserId, leads]);

  // Calculate counts for tabs
  const leadCounts = useMemo(() => ({
    all: myLeads.length,
    new: myLeads.filter(l => l.status === 'new').length,
    contacted: myLeads.filter(l => l.status === 'contacted').length,
    follow_up: myLeads.filter(l => l.status === 'follow_up').length,
    quote_sent: myLeads.filter(l => l.status === 'quote_sent').length,
    urgent_callback: myLeads.filter(l => l.status === 'urgent_callback').length,
    paid: myLeads.filter(l => l.is_paid === true).length,
    lost: myLeads.filter(l => l.status === 'lost').length,
    high_priority: myLeads.filter(l => l.priority === 'high' || l.priority === 'urgent').length,
  }), [myLeads]);

  // Today's follow-ups count for urgency indicator
  const todayFollowUps = useMemo(() => 
    myLeads.filter(l => l.next_action_date && isToday(new Date(l.next_action_date))),
    [myLeads]
  );

  const overdueFollowUps = useMemo(() =>
    myLeads.filter(l =>
      l.next_action_date && 
      isPast(new Date(l.next_action_date)) && 
      l.follow_up_status === 'pending'
    ),
    [myLeads]
  );

  // Apply filters
  const filteredLeads = useMemo(() => {
    let result = myLeads;

    // Apply status filter
    if (filter !== 'all') {
      if (filter === 'high_priority') {
        result = result.filter(l => l.priority === 'high' || l.priority === 'urgent');
      } else if (filter === 'paid') {
        result = result.filter(l => l.is_paid === true);
      } else {
        result = result.filter(l => l.status === filter);
      }
    }

    // Apply date range filter
    if (dateRange.from || dateRange.to) {
      result = result.filter(lead => {
        const leadDate = new Date(lead.created_at);
        if (dateRange.from) {
          const fromStart = new Date(dateRange.from);
          fromStart.setHours(0, 0, 0, 0);
          if (leadDate < fromStart) return false;
        }
        if (dateRange.to) {
          const toEnd = new Date(dateRange.to);
          toEnd.setHours(23, 59, 59, 999);
          if (leadDate > toEnd) return false;
        }
        return true;
      });
    }

    // Apply search filter
    if (debouncedSearchTerm) {
      const term = debouncedSearchTerm.toLowerCase();
      result = result.filter(lead => 
        lead.email.toLowerCase().includes(term) ||
        (lead.first_name?.toLowerCase().includes(term)) ||
        (lead.last_name?.toLowerCase().includes(term)) ||
        (lead.phone?.toLowerCase().includes(term)) ||
        (lead.vehicle_reg?.toLowerCase().includes(term)) ||
        (lead.plan_interest?.toLowerCase().includes(term))
      );
    }

    // Apply sorting
    result = [...result].sort((a, b) => {
      switch (sortOption) {
        case 'newest':
          return new Date(b.created_at).getTime() - new Date(a.created_at).getTime();
        case 'oldest':
          return new Date(a.created_at).getTime() - new Date(b.created_at).getTime();
        case 'contacted':
          if (a.status === 'contacted' && b.status !== 'contacted') return -1;
          if (a.status !== 'contacted' && b.status === 'contacted') return 1;
          return new Date(b.created_at).getTime() - new Date(a.created_at).getTime();
        case 'follow_up':
          if (a.status === 'follow_up' && b.status !== 'follow_up') return -1;
          if (a.status !== 'follow_up' && b.status === 'follow_up') return 1;
          return new Date(b.created_at).getTime() - new Date(a.created_at).getTime();
        case 'quote_sent':
          if (a.status === 'quote_sent' && b.status !== 'quote_sent') return -1;
          if (a.status !== 'quote_sent' && b.status === 'quote_sent') return 1;
          return new Date(b.created_at).getTime() - new Date(a.created_at).getTime();
        default:
          return new Date(b.created_at).getTime() - new Date(a.created_at).getTime();
      }
    });

    return result;
  }, [myLeads, filter, dateRange, debouncedSearchTerm, sortOption]);

  // Pagination
  const pagination = usePagination(filteredLeads, { initialPageSize: 50 });

  // Handlers
  const handleSelectLead = useCallback((leadId: string) => {
    setSelectedLeads(prev => {
      const newSelected = new Set(prev);
      if (newSelected.has(leadId)) {
        newSelected.delete(leadId);
      } else {
        newSelected.add(leadId);
      }
      return newSelected;
    });
  }, []);

  const handleSelectAll = useCallback(() => {
    setSelectedLeads(prev => {
      if (prev.size === filteredLeads.length) {
        return new Set();
      } else {
        return new Set(filteredLeads.map(l => l.id));
      }
    });
  }, [filteredLeads]);

  const handleDateSelect = (range: DateRange | undefined) => {
    setDateRange({
      from: range?.from,
      to: range?.to
    });
  };

  const handleQuickFilter = (days: number) => {
    const to = endOfDay(new Date());
    const from = startOfDay(subDays(new Date(), days));
    setDateRange({ from, to });
    setIsCalendarOpen(false);
  };

  const clearDateRange = () => {
    setDateRange({ from: undefined, to: undefined });
  };

  const hasDateFilter = dateRange?.from || dateRange?.to;

  // Empty state
  if (myLeads.length === 0) {
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
    <div className="space-y-4">
      {/* Urgency Alerts */}
      {(overdueFollowUps.length > 0 || todayFollowUps.length > 0) && (
        <div className="flex flex-wrap gap-3">
          {overdueFollowUps.length > 0 && (
            <div className="flex items-center gap-2 px-3 py-2 bg-red-50 border border-red-200 rounded-lg text-red-700">
              <AlertTriangle className="h-4 w-4" />
              <span className="text-sm font-medium">{overdueFollowUps.length} overdue follow-up{overdueFollowUps.length > 1 ? 's' : ''}</span>
            </div>
          )}
          {todayFollowUps.length > 0 && (
            <div className="flex items-center gap-2 px-3 py-2 bg-yellow-50 border border-yellow-200 rounded-lg text-yellow-700">
              <Clock className="h-4 w-4" />
              <span className="text-sm font-medium">{todayFollowUps.length} due today</span>
            </div>
          )}
        </div>
      )}

      {/* Status Tabs - No "All" tab for sales agents, they only see their assigned leads */}
      <Tabs value={filter} onValueChange={(v) => setFilter(v as typeof filter)}>
        <TabsList className="flex flex-wrap h-auto gap-1 p-1 bg-muted/50 border-2 border-border rounded-xl">
          {leadCounts.urgent_callback > 0 && (
            <TabsTrigger value="urgent_callback" className="relative data-[state=active]:bg-white">
              <Bell className="h-3.5 w-3.5 mr-1 text-orange-500" />
              Urgent <Badge className="ml-1.5 h-5 px-1.5 text-xs bg-orange-500">{leadCounts.urgent_callback}</Badge>
            </TabsTrigger>
          )}
          <TabsTrigger value="new" className="relative data-[state=active]:bg-white">
            New <Badge variant="secondary" className="ml-1.5 h-5 px-1.5 text-xs">{leadCounts.new}</Badge>
          </TabsTrigger>
          <TabsTrigger value="contacted" className="relative data-[state=active]:bg-white">
            Contacted <Badge variant="secondary" className="ml-1.5 h-5 px-1.5 text-xs">{leadCounts.contacted}</Badge>
          </TabsTrigger>
          <TabsTrigger value="follow_up" className="relative data-[state=active]:bg-white">
            Follow-up <Badge variant="secondary" className="ml-1.5 h-5 px-1.5 text-xs">{leadCounts.follow_up}</Badge>
          </TabsTrigger>
          <TabsTrigger value="quote_sent" className="relative data-[state=active]:bg-white">
            Quote Sent <Badge variant="secondary" className="ml-1.5 h-5 px-1.5 text-xs">{leadCounts.quote_sent}</Badge>
          </TabsTrigger>
          <TabsTrigger value="paid" className="relative data-[state=active]:bg-white">
            Paid <Badge variant="secondary" className="ml-1.5 h-5 px-1.5 text-xs bg-green-100 text-green-800">{leadCounts.paid}</Badge>
          </TabsTrigger>
          <TabsTrigger value="lost" className="relative data-[state=active]:bg-white">
            Lost <Badge variant="secondary" className="ml-1.5 h-5 px-1.5 text-xs">{leadCounts.lost}</Badge>
          </TabsTrigger>
          {leadCounts.high_priority > 0 && (
            <TabsTrigger value="high_priority" className="relative data-[state=active]:bg-white">
              <span className="text-orange-500">🔥</span> Priority <Badge variant="secondary" className="ml-1.5 h-5 px-1.5 text-xs text-orange-600">{leadCounts.high_priority}</Badge>
            </TabsTrigger>
          )}
        </TabsList>
      </Tabs>

      {/* Filters Row */}
      <div className="flex flex-wrap items-center gap-3">
        {/* Search */}
        <div className="relative flex-1 min-w-[200px] max-w-md">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
          <Input
            placeholder="Search leads by name, email, phone, reg..."
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
            className="pl-10"
          />
        </div>

        {/* Date Range */}
        <Popover open={isCalendarOpen} onOpenChange={setIsCalendarOpen}>
          <PopoverTrigger asChild>
            <Button variant="outline" size="sm" className="gap-2">
              <CalendarIcon className="h-4 w-4" />
              <span className="hidden sm:inline">
                {hasDateFilter 
                  ? `${dateRange.from ? format(dateRange.from, 'MMM d') : ''} - ${dateRange.to ? format(dateRange.to, 'MMM d') : ''}`
                  : 'Date Range'
                }
              </span>
            </Button>
          </PopoverTrigger>
          <PopoverContent className="w-auto p-0" align="start">
            <div className="p-3 border-b">
              <div className="flex flex-wrap gap-2">
                <Button size="sm" variant="outline" onClick={() => handleQuickFilter(0)}>Today</Button>
                <Button size="sm" variant="outline" onClick={() => handleQuickFilter(7)}>Last 7 Days</Button>
                <Button size="sm" variant="outline" onClick={() => handleQuickFilter(30)}>This Month</Button>
                <Button size="sm" variant="outline" onClick={() => handleQuickFilter(365)}>This Year</Button>
              </div>
            </div>
            <Calendar
              mode="range"
              selected={{ from: dateRange.from, to: dateRange.to }}
              onSelect={handleDateSelect}
              numberOfMonths={2}
              initialFocus
            />
            {hasDateFilter && (
              <div className="p-3 border-t">
                <Button size="sm" variant="ghost" onClick={clearDateRange} className="w-full gap-2">
                  <X className="h-4 w-4" />
                  Clear Date Filter
                </Button>
              </div>
            )}
          </PopoverContent>
        </Popover>

        {/* Sort */}
        <Select value={sortOption} onValueChange={(v) => setSortOption(v as SortOption)}>
          <SelectTrigger className="w-[150px]">
            <ArrowUpDown className="h-4 w-4 mr-2" />
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="newest">Newest first</SelectItem>
            <SelectItem value="oldest">Oldest first</SelectItem>
            <SelectItem value="contacted">Contacted</SelectItem>
            <SelectItem value="follow_up">Follow-up</SelectItem>
            <SelectItem value="quote_sent">Quote Sent</SelectItem>
          </SelectContent>
        </Select>

        {/* Refresh */}
        <Button variant="outline" size="sm" onClick={onRefresh} className="gap-2">
          <RefreshCw className="h-4 w-4" />
          <span className="hidden sm:inline">Refresh</span>
        </Button>
      </div>

      {/* Leads Table */}
      <Card className="overflow-hidden border-2 border-border">
        <CardContent className="p-0">
          {/* Control Bar - Simplified for sales agents (no bulk actions) */}
          <div className="sticky top-0 z-20 bg-background border-b px-4 py-3 flex items-center justify-between gap-4">
            <div className="text-sm text-muted-foreground">
              <span className="font-semibold text-foreground">{pagination.totalItems.toLocaleString()}</span>
              {' '}leads found
            </div>
            <div className="flex items-center gap-3">
              <span className="text-sm text-muted-foreground">Leads per page</span>
              <div className="inline-flex items-center rounded-lg border bg-muted/30 p-1">
                {[25, 50, 100, 200].map((size) => (
                  <button
                    key={size}
                    onClick={() => pagination.setPageSize(size)}
                    className={`px-3 py-1.5 text-sm font-medium rounded-md transition-all ${
                      pagination.pageSize === size
                        ? "bg-primary text-primary-foreground shadow-sm"
                        : "text-muted-foreground hover:text-foreground hover:bg-muted"
                    }`}
                  >
                    {size}
                  </button>
                ))}
              </div>
            </div>
          </div>
          
          {/* Main Table - Reusing admin LeadsTable */}
          <LeadsTable
            leads={pagination.paginatedData}
            tags={tags}
            salesUsers={[]}
            selectedLeads={selectedLeads}
            onSelectLead={handleSelectLead}
            onSelectAll={handleSelectAll}
            onUpdateStatus={handlers.updateLeadStatus}
            onAssign={async () => {}} // Agents can't reassign
            onAutoAssign={async () => {}} // Agents can't auto-assign
            onUpdatePriority={handlers.updateLeadPriority || (async () => {})}
            onScheduleFollowUp={handlers.scheduleFollowUp}
            onAddTag={handlers.addTagToLead || (async () => {})}
            onRemoveTag={handlers.removeTagFromLead || (async () => {})}
            onUpdateNotes={handlers.updateLeadNotes}
            onMarkContacted={handlers.markContactedAt}
            onLogActivity={handlers.logActivity}
            onUpdateCallCount={handlers.updateCallCount || (async () => {})}
            onRefresh={onRefresh || (() => {})}
            onSendQuote={onSendQuote}
            hideAssignedColumn={hideAssignedColumn}
          />
          
          {/* Footer Pagination */}
          <LeadsTableFooter
            currentPage={pagination.currentPage}
            totalPages={pagination.totalPages}
            totalItems={pagination.totalItems}
            startIndex={pagination.startIndex}
            endIndex={pagination.endIndex}
            onPageChange={pagination.goToPage}
            canGoNext={pagination.canGoNext}
            canGoPrev={pagination.canGoPrev}
          />
        </CardContent>
      </Card>
    </div>
  );
};
