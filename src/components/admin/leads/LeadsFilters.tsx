import React, { useState, useMemo } from 'react';
import { Tabs, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Input } from '@/components/ui/input';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover';
import { Calendar } from '@/components/ui/calendar';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Search, RefreshCw, Upload, Download, CalendarIcon, X, Filter, ArrowUpDown, History } from 'lucide-react';
import { LeadStatus } from '@/hooks/useLeads';
import { format, subDays, startOfDay, endOfDay, startOfMonth, endOfMonth, startOfYear, endOfYear, subMonths, subYears } from 'date-fns';
import { DateRange } from 'react-day-picker';

export type AssignmentFilter = 'all' | 'total' | 'awaiting_contact' | 'assigned';
export type SortOption = 'newest' | 'oldest' | 'contacted' | 'follow_up' | 'quote_sent';

interface LeadsFiltersProps {
  filter: LeadStatus | 'all' | 'high_priority' | 'fake' | 'quote_sent' | 'urgent_callback';
  onFilterChange: (filter: LeadStatus | 'all' | 'high_priority' | 'fake' | 'quote_sent' | 'urgent_callback') => void;
  searchTerm: string;
  onSearchChange: (term: string) => void;
  onRefresh: () => void;
  onMigrate: () => void;
  onExport: (format: 'csv' | 'xlsx') => void;
  leadCounts: {
    all: number;
    new: number;
    contacted: number;
    follow_up: number;
    quote_sent: number;
    urgent_callback: number;
    paid: number;
    lost: number;
    high_priority: number;
    fake: number;
  };
  dateRange?: { from: Date | undefined; to: Date | undefined };
  onDateRangeChange?: (range: { from: Date | undefined; to: Date | undefined }) => void;
  assignmentFilter?: AssignmentFilter;
  onAssignmentFilterChange?: (filter: AssignmentFilter) => void;
  assignmentCounts?: {
    total: number;
    awaiting_contact: number;
    assigned: number;
  };
  sortOption?: SortOption;
  onSortChange?: (sort: SortOption) => void;
}

export const LeadsFilters: React.FC<LeadsFiltersProps> = ({
  filter,
  onFilterChange,
  searchTerm,
  onSearchChange,
  onRefresh,
  onMigrate,
  onExport,
  leadCounts,
  dateRange,
  onDateRangeChange,
  assignmentFilter = 'all',
  onAssignmentFilterChange,
  assignmentCounts,
  sortOption = 'newest',
  onSortChange
}) => {
  const [isCalendarOpen, setIsCalendarOpen] = useState(false);

  // Generate month options for the past 24 months
  const monthOptions = useMemo(() => {
    const options = [];
    for (let i = 0; i < 24; i++) {
      const date = subMonths(new Date(), i);
      options.push({
        label: format(date, 'MMMM yyyy'),
        value: `month_${i}`,
        from: startOfMonth(date),
        to: endOfMonth(date)
      });
    }
    return options;
  }, []);

  // Generate year options (last 5 years)
  const yearOptions = useMemo(() => {
    const currentYear = new Date().getFullYear();
    const options = [];
    for (let i = 0; i <= 5; i++) {
      const year = currentYear - i;
      const yearDate = new Date(year, 0, 1);
      options.push({
        label: year.toString(),
        value: `year_${year}`,
        from: startOfYear(yearDate),
        to: i === 0 ? endOfDay(new Date()) : endOfYear(yearDate)
      });
    }
    return options;
  }, []);

  const handleDateSelect = (range: DateRange | undefined) => {
    if (onDateRangeChange) {
      onDateRangeChange({
        from: range?.from,
        to: range?.to
      });
    }
  };

  const handleQuickFilter = (days: number) => {
    if (onDateRangeChange) {
      const to = endOfDay(new Date());
      const from = startOfDay(subDays(new Date(), days));
      onDateRangeChange({ from, to });
      setIsCalendarOpen(false);
    }
  };

  const handleAllTime = () => {
    if (onDateRangeChange) {
      // Set from to a very old date (e.g., 2020) to capture all leads
      onDateRangeChange({ 
        from: new Date(2020, 0, 1), 
        to: endOfDay(new Date()) 
      });
      setIsCalendarOpen(false);
    }
  };

  const handleMonthSelect = (monthIndex: number) => {
    if (onDateRangeChange) {
      const date = subMonths(new Date(), monthIndex);
      onDateRangeChange({ 
        from: startOfMonth(date), 
        to: endOfMonth(date) 
      });
      setIsCalendarOpen(false);
    }
  };

  const handleYearSelect = (year: number) => {
    if (onDateRangeChange) {
      const yearDate = new Date(year, 0, 1);
      const isCurrentYear = year === new Date().getFullYear();
      onDateRangeChange({ 
        from: startOfYear(yearDate), 
        to: isCurrentYear ? endOfDay(new Date()) : endOfYear(yearDate)
      });
      setIsCalendarOpen(false);
    }
  };

  const clearDateRange = () => {
    if (onDateRangeChange) {
      onDateRangeChange({ from: undefined, to: undefined });
    }
  };

  const hasDateFilter = dateRange?.from || dateRange?.to;

  // Get a readable label for the current date filter
  const getDateFilterLabel = () => {
    if (!hasDateFilter) return 'Date Range';
    
    // Check if it matches "All Time"
    if (dateRange?.from && dateRange.from.getFullYear() === 2020 && dateRange.from.getMonth() === 0) {
      return 'All Time';
    }
    
    // Check if it's a full year
    if (dateRange?.from && dateRange?.to) {
      const fromStart = startOfYear(dateRange.from);
      const toEnd = endOfYear(dateRange.to);
      if (dateRange.from.getTime() === fromStart.getTime() && 
          (dateRange.to.getTime() === toEnd.getTime() || 
           dateRange.to.toDateString() === new Date().toDateString())) {
        return format(dateRange.from, 'yyyy');
      }
      
      // Check if it's a full month
      const monthStart = startOfMonth(dateRange.from);
      const monthEnd = endOfMonth(dateRange.from);
      if (dateRange.from.getTime() === monthStart.getTime() && 
          dateRange.to.getTime() === monthEnd.getTime()) {
        return format(dateRange.from, 'MMM yyyy');
      }
    }
    
    // Default to date range format
    return `${dateRange?.from ? format(dateRange.from, 'dd MMM') : ''} ${dateRange?.to ? `- ${format(dateRange.to, 'dd MMM')}` : ''}`;
  };

  // Track if awaiting contact filter is active (separate from status tabs)
  const isAwaitingActive = assignmentFilter === 'awaiting_contact';

  const handleTabChange = (value: string) => {
    // If clicking Awaiting, set assignment filter instead
    if (value === 'awaiting_contact') {
      onAssignmentFilterChange?.('awaiting_contact');
      return;
    }
    // For other tabs, reset assignment filter and set status filter
    if (isAwaitingActive) {
      onAssignmentFilterChange?.('all');
    }
    onFilterChange(value as LeadStatus | 'all' | 'high_priority' | 'fake' | 'quote_sent' | 'urgent_callback');
  };

  // Determine effective tab value - if awaiting is active, show it as selected
  const effectiveTabValue = isAwaitingActive ? 'awaiting_contact' : filter;

  return (
    <div className="space-y-4">
      {/* Tabs for status filter */}
      <Tabs value={effectiveTabValue} onValueChange={handleTabChange}>
        <TabsList className="grid w-full grid-cols-11">
          <TabsTrigger value="all" className="relative">
            All
            <Badge variant="secondary" className="ml-1 h-5 px-1.5">{leadCounts.all}</Badge>
          </TabsTrigger>
          <TabsTrigger value="urgent_callback" className="relative">
            <span className="flex items-center gap-1">
              🔔 Urgent
            </span>
            <Badge variant="secondary" className="ml-1 h-5 px-1.5 bg-red-500 text-white">{leadCounts.urgent_callback}</Badge>
          </TabsTrigger>
          <TabsTrigger value="new" className="relative">
            New
            <Badge variant="secondary" className="ml-1 h-5 px-1.5 bg-blue-100">{leadCounts.new}</Badge>
          </TabsTrigger>
          <TabsTrigger value="awaiting_contact" className="relative">
            Awaiting
            {assignmentCounts && (
              <Badge variant="secondary" className="ml-1 h-5 px-1.5 bg-amber-100">{assignmentCounts.awaiting_contact}</Badge>
            )}
          </TabsTrigger>
          <TabsTrigger value="contacted">
            Contacted
            <Badge variant="secondary" className="ml-1 h-5 px-1.5 bg-yellow-100">{leadCounts.contacted}</Badge>
          </TabsTrigger>
          <TabsTrigger value="follow_up">
            Follow-up
            <Badge variant="secondary" className="ml-1 h-5 px-1.5 bg-purple-100">{leadCounts.follow_up}</Badge>
          </TabsTrigger>
          <TabsTrigger value="quote_sent">
            Quote Sent
            <Badge variant="secondary" className="ml-1 h-5 px-1.5 bg-indigo-100">{leadCounts.quote_sent}</Badge>
          </TabsTrigger>
          <TabsTrigger value="paid">
            Paid
            <Badge variant="secondary" className="ml-1 h-5 px-1.5 bg-green-100">{leadCounts.paid}</Badge>
          </TabsTrigger>
          <TabsTrigger value="lost">
            Lost
            <Badge variant="secondary" className="ml-1 h-5 px-1.5 bg-gray-100">{leadCounts.lost}</Badge>
          </TabsTrigger>
          <TabsTrigger value="high_priority">
            🔥 Priority
            <Badge variant="secondary" className="ml-1 h-5 px-1.5 bg-red-100">{leadCounts.high_priority}</Badge>
          </TabsTrigger>
          <TabsTrigger value="fake">
            Fake
            <Badge variant="secondary" className="ml-1 h-5 px-1.5 bg-orange-100">{leadCounts.fake}</Badge>
          </TabsTrigger>
        </TabsList>
      </Tabs>

      {/* Search and actions */}
      <div className="flex items-center justify-between gap-4">
        <div className="flex items-center gap-2 flex-1">
          <div className="relative flex-1 max-w-md">
            <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
            <Input
              placeholder="Search leads by name, email, phone, reg..."
              value={searchTerm}
              onChange={(e) => onSearchChange(e.target.value)}
              className="pl-9"
            />
          </div>
          
          {/* Assignment Status Filter */}
          {onAssignmentFilterChange && (
            <Select value={assignmentFilter} onValueChange={(v) => onAssignmentFilterChange(v as AssignmentFilter)}>
              <SelectTrigger className="w-[180px] h-9">
                <Filter className="h-4 w-4 mr-2 text-muted-foreground" />
                <SelectValue placeholder="Filter by assignment" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">
                  <span className="flex items-center justify-between w-full">
                    All Leads
                    {assignmentCounts && (
                      <Badge variant="secondary" className="ml-2 h-5 px-1.5">{leadCounts.all}</Badge>
                    )}
                  </span>
                </SelectItem>
                <SelectItem value="total">
                  <span className="flex items-center justify-between w-full">
                    Total Leads
                    {assignmentCounts && (
                      <Badge variant="secondary" className="ml-2 h-5 px-1.5">{assignmentCounts.total}</Badge>
                    )}
                  </span>
                </SelectItem>
                <SelectItem value="awaiting_contact">
                  <span className="flex items-center justify-between w-full">
                    Awaiting Contact
                    {assignmentCounts && (
                      <Badge variant="secondary" className="ml-2 h-5 px-1.5 bg-amber-100">{assignmentCounts.awaiting_contact}</Badge>
                    )}
                  </span>
                </SelectItem>
                <SelectItem value="assigned">
                  <span className="flex items-center justify-between w-full">
                    Assigned
                    {assignmentCounts && (
                      <Badge variant="secondary" className="ml-2 h-5 px-1.5 bg-green-100">{assignmentCounts.assigned}</Badge>
                    )}
                  </span>
                </SelectItem>
              </SelectContent>
            </Select>
          )}

          {/* Date Range Filter */}
          <Popover open={isCalendarOpen} onOpenChange={setIsCalendarOpen}>
            <PopoverTrigger asChild>
              <Button 
                variant={hasDateFilter ? "default" : "outline"} 
                size="sm" 
                className="gap-2 min-w-[140px]"
              >
                <CalendarIcon className="h-4 w-4" />
                <span className="text-xs">{getDateFilterLabel()}</span>
              </Button>
            </PopoverTrigger>
            <PopoverContent className="w-auto p-0" align="start">
              {/* Quick Filters Row */}
              <div className="p-3 border-b space-y-2">
                <div className="text-sm font-medium">Quick filters</div>
                <div className="flex flex-wrap gap-1">
                  <Button 
                    variant="outline" 
                    size="sm" 
                    onClick={handleAllTime}
                    className="bg-primary/10 hover:bg-primary/20"
                  >
                    <History className="h-3 w-3 mr-1" />
                    All Time
                  </Button>
                  <Button variant="outline" size="sm" onClick={() => handleQuickFilter(7)}>Last 7 days</Button>
                  <Button variant="outline" size="sm" onClick={() => handleQuickFilter(30)}>Last 30 days</Button>
                  <Button variant="outline" size="sm" onClick={() => handleQuickFilter(90)}>Last 90 days</Button>
                </div>
              </div>
              
              {/* Month & Year Selectors */}
              <div className="p-3 border-b space-y-3">
                <div className="flex gap-3">
                  {/* Month Selector */}
                  <div className="flex-1">
                    <div className="text-xs font-medium text-muted-foreground mb-1.5">By Month</div>
                    <Select onValueChange={(v) => handleMonthSelect(parseInt(v.replace('month_', '')))}>
                      <SelectTrigger className="w-full h-8 text-xs">
                        <SelectValue placeholder="Select month" />
                      </SelectTrigger>
                      <SelectContent className="max-h-[200px]">
                        {monthOptions.map((opt, idx) => (
                          <SelectItem key={opt.value} value={opt.value} className="text-xs">
                            {opt.label}
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  </div>
                  
                  {/* Year Selector */}
                  <div className="flex-1">
                    <div className="text-xs font-medium text-muted-foreground mb-1.5">By Year</div>
                    <Select onValueChange={(v) => handleYearSelect(parseInt(v.replace('year_', '')))}>
                      <SelectTrigger className="w-full h-8 text-xs">
                        <SelectValue placeholder="Select year" />
                      </SelectTrigger>
                      <SelectContent>
                        {yearOptions.map((opt) => (
                          <SelectItem key={opt.value} value={opt.value} className="text-xs">
                            {opt.label}
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  </div>
                </div>
              </div>
              
              {/* Calendar for Custom Range */}
              <div className="p-3 border-b">
                <div className="text-xs font-medium text-muted-foreground mb-2">Custom Range</div>
                <Calendar
                  mode="range"
                  defaultMonth={dateRange?.from}
                  selected={{ from: dateRange?.from, to: dateRange?.to }}
                  onSelect={handleDateSelect}
                  numberOfMonths={2}
                  className="pointer-events-auto"
                />
              </div>
              
              {/* Clear button */}
              {hasDateFilter && (
                <div className="p-2 border-t flex justify-end">
                  <Button 
                    variant="ghost" 
                    size="sm" 
                    onClick={() => {
                      clearDateRange();
                      setIsCalendarOpen(false);
                    }}
                    className="text-xs"
                  >
                    <X className="h-3 w-3 mr-1" />
                    Clear Filter
                  </Button>
                </div>
              )}
            </PopoverContent>
          </Popover>

          {/* Sort Dropdown */}
          {onSortChange && (
            <Select value={sortOption} onValueChange={(v) => onSortChange(v as SortOption)}>
              <SelectTrigger className="w-[150px] h-9">
                <ArrowUpDown className="h-4 w-4 mr-2 text-muted-foreground" />
                <SelectValue placeholder="Sort by" />
              </SelectTrigger>
              <SelectContent className="bg-popover border shadow-lg z-50">
                <SelectItem value="newest">Newest first</SelectItem>
                <SelectItem value="oldest">Oldest first</SelectItem>
                <SelectItem value="contacted">Contacted</SelectItem>
                <SelectItem value="follow_up">Follow-up</SelectItem>
                <SelectItem value="quote_sent">Quote Sent</SelectItem>
              </SelectContent>
            </Select>
          )}
        </div>
        
        <div className="flex items-center gap-2">
          <Button variant="outline" size="sm" onClick={onRefresh}>
            <RefreshCw className="h-4 w-4 mr-1" />
            Refresh
          </Button>
          <Button variant="outline" size="sm" onClick={onMigrate}>
            <Upload className="h-4 w-4 mr-1" />
            Import from Carts
          </Button>
          <Button variant="outline" size="sm" onClick={() => onExport('csv')}>
            <Download className="h-4 w-4 mr-1" />
            Export CSV
          </Button>
        </div>
      </div>
    </div>
  );
};
