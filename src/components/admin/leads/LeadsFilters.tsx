import React, { useState, useMemo } from 'react';
import { Tabs, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Input } from '@/components/ui/input';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover';
import { Calendar } from '@/components/ui/calendar';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Search, RefreshCw, Upload, Download, CalendarIcon, X, Filter, ArrowUpDown, History, Users, ChevronLeft, ChevronRight } from 'lucide-react';
import { LeadStatus } from '@/hooks/useLeads';
import { format, subDays, addDays, startOfDay, endOfDay, startOfMonth, endOfMonth, startOfYear, endOfYear, subMonths, subYears } from 'date-fns';
import { DateRange } from 'react-day-picker';
import { cn } from '@/lib/utils';

export type AssignmentFilter = 'all' | 'all_leads' | 'total' | 'awaiting_contact' | 'assigned';
export type SortOption = 'newest' | 'oldest' | 'latest_submitted' | 'contacted' | 'follow_up' | 'quote_sent';

interface SalesUser {
  id: string;
  first_name: string | null;
  last_name: string | null;
  email: string;
  role?: string;
}

interface LeadsFiltersProps {
  filter: LeadStatus | 'all' | 'all_leads' | 'live' | 'high_priority' | 'fake' | 'quote_sent' | 'urgent_callback' | 'converted';
  onFilterChange: (filter: LeadStatus | 'all' | 'all_leads' | 'live' | 'high_priority' | 'fake' | 'quote_sent' | 'urgent_callback' | 'converted') => void;
  searchTerm: string;
  onSearchChange: (term: string) => void;
  onRefresh: () => void;
  onMigrate: () => void;
  onExport: (format: 'csv' | 'xlsx') => void;
  leadCounts: {
    all_leads: number;
    all: number;
    live: number;
    total: number;
    new: number;
    contacted: number;
    follow_up: number;
    quote_sent: number;
    urgent_callback: number;
    paid: number;
    lost: number;
    converted: number;
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
  salesUsers?: SalesUser[];
  agentFilter?: string;
  onAgentFilterChange?: (agentId: string) => void;
  agentLeadCounts?: Record<string, number>;
}

// Status pill configuration — compact, color-coded for instant recognition
const STATUS_PILLS: { 
  value: string; 
  label: string; 
  icon?: string;
  colorClass: string;
  countKey: keyof LeadsFiltersProps['leadCounts'];
  isAssignment?: boolean;
}[] = [
  { value: 'all_leads', label: 'All Leads', colorClass: 'data-[state=active]:bg-foreground data-[state=active]:text-background', countKey: 'all_leads' },
  { value: 'live', label: 'Live', icon: '🟢', colorClass: 'data-[state=active]:bg-emerald-700 data-[state=active]:text-white', countKey: 'live' },
  { value: 'urgent_callback', label: 'Urgent', icon: '🔔', colorClass: 'data-[state=active]:bg-red-600 data-[state=active]:text-white', countKey: 'urgent_callback' },
  { value: 'new', label: 'New', colorClass: 'data-[state=active]:bg-blue-600 data-[state=active]:text-white', countKey: 'new' },
  { value: 'awaiting_contact', label: 'Awaiting', colorClass: 'data-[state=active]:bg-amber-500 data-[state=active]:text-white', countKey: 'all_leads', isAssignment: true },
  { value: 'contacted', label: 'Contacted', colorClass: 'data-[state=active]:bg-yellow-500 data-[state=active]:text-white', countKey: 'contacted' },
  { value: 'follow_up', label: 'Follow-up', colorClass: 'data-[state=active]:bg-purple-600 data-[state=active]:text-white', countKey: 'follow_up' },
  { value: 'quote_sent', label: 'Quoted', colorClass: 'data-[state=active]:bg-indigo-600 data-[state=active]:text-white', countKey: 'quote_sent' },
  { value: 'paid', label: 'Paid', colorClass: 'data-[state=active]:bg-emerald-600 data-[state=active]:text-white', countKey: 'paid' },
  { value: 'converted', label: 'Won', icon: '✅', colorClass: 'data-[state=active]:bg-green-600 data-[state=active]:text-white', countKey: 'converted' },
  { value: 'high_priority', label: 'Hot', icon: '🔥', colorClass: 'data-[state=active]:bg-orange-600 data-[state=active]:text-white', countKey: 'high_priority' },
  { value: 'fake', label: 'Fake', icon: '🚫', colorClass: 'data-[state=active]:bg-red-900 data-[state=active]:text-white', countKey: 'fake' },
];

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
  onSortChange,
  salesUsers,
  agentFilter = 'all',
  onAgentFilterChange,
  agentLeadCounts,
}) => {
  const [isCalendarOpen, setIsCalendarOpen] = useState(false);

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
      onDateRangeChange({ from: range?.from, to: range?.to });
    }
  };

  const handleQuickFilter = (days: number, exactDay = false) => {
    if (onDateRangeChange) {
      if (exactDay) {
        const targetDay = subDays(new Date(), days);
        onDateRangeChange({ from: startOfDay(targetDay), to: endOfDay(targetDay) });
      } else {
        onDateRangeChange({ from: startOfDay(subDays(new Date(), days)), to: endOfDay(new Date()) });
      }
      setIsCalendarOpen(false);
    }
  };

  const handleDayNav = (direction: 'prev' | 'next') => {
    if (!onDateRangeChange) return;
    const baseDate = dateRange?.from ?? new Date();
    const newDate = direction === 'prev' ? subDays(baseDate, 1) : addDays(baseDate, 1);
    if (startOfDay(newDate) > startOfDay(new Date())) return;
    onDateRangeChange({ from: startOfDay(newDate), to: endOfDay(newDate) });
  };

  const handleAllTime = () => {
    if (onDateRangeChange) {
      onDateRangeChange({ from: new Date(2020, 0, 1), to: endOfDay(new Date()) });
      setIsCalendarOpen(false);
    }
  };

  const handleMonthSelect = (monthIndex: number) => {
    if (onDateRangeChange) {
      const date = subMonths(new Date(), monthIndex);
      onDateRangeChange({ from: startOfMonth(date), to: endOfMonth(date) });
      setIsCalendarOpen(false);
    }
  };

  const handleYearSelect = (year: number) => {
    if (onDateRangeChange) {
      const yearDate = new Date(year, 0, 1);
      const isCurrentYear = year === new Date().getFullYear();
      onDateRangeChange({ from: startOfYear(yearDate), to: isCurrentYear ? endOfDay(new Date()) : endOfYear(yearDate) });
      setIsCalendarOpen(false);
    }
  };

  const clearDateRange = () => {
    if (onDateRangeChange) onDateRangeChange({ from: undefined, to: undefined });
  };

  const hasDateFilter = dateRange?.from || dateRange?.to;

  const getDateFilterLabel = () => {
    if (!hasDateFilter) return 'Date Range';
    if (dateRange?.from && dateRange.from.getFullYear() === 2020 && dateRange.from.getMonth() === 0) return 'All Time';
    if (dateRange?.from && dateRange?.to) {
      const fromStart = startOfYear(dateRange.from);
      const toEnd = endOfYear(dateRange.to);
      if (dateRange.from.getTime() === fromStart.getTime() && 
          (dateRange.to.getTime() === toEnd.getTime() || dateRange.to.toDateString() === new Date().toDateString())) {
        return format(dateRange.from, 'yyyy');
      }
      const monthStart = startOfMonth(dateRange.from);
      const monthEnd = endOfMonth(dateRange.from);
      if (dateRange.from.getTime() === monthStart.getTime() && dateRange.to.getTime() === monthEnd.getTime()) {
        return format(dateRange.from, 'MMM yyyy');
      }
    }
    return `${dateRange?.from ? format(dateRange.from, 'dd MMM') : ''} ${dateRange?.to ? `- ${format(dateRange.to, 'dd MMM')}` : ''}`;
  };

  const isAwaitingActive = assignmentFilter === 'awaiting_contact';

  const handleTabChange = (value: string) => {
    if (value === 'awaiting_contact') {
      onAssignmentFilterChange?.('awaiting_contact');
      return;
    }
    if (isAwaitingActive) onAssignmentFilterChange?.('all');
    onFilterChange(value as LeadStatus | 'all' | 'all_leads' | 'live' | 'high_priority' | 'fake' | 'quote_sent' | 'urgent_callback' | 'converted');
  };

  const effectiveTabValue = isAwaitingActive ? 'awaiting_contact' : filter;

  const getCount = (pill: typeof STATUS_PILLS[0]) => {
    if (pill.isAssignment) return assignmentCounts?.awaiting_contact ?? 0;
    return leadCounts[pill.countKey] ?? 0;
  };

  return (
    <div className="space-y-3">
      {/* Row 1: Status pills — compact, color-coded, scannable */}
      <Tabs value={effectiveTabValue} onValueChange={handleTabChange}>
        <TabsList className="h-auto p-1 bg-muted/50 border-2 border-border rounded-xl flex flex-wrap gap-0.5">
          {STATUS_PILLS.map(pill => {
            const count = getCount(pill);
            const isActive = effectiveTabValue === pill.value;
            return (
              <TabsTrigger 
                key={pill.value} 
                value={pill.value}
                className={cn(
                  "h-8 px-3 rounded-lg text-xs font-semibold transition-all duration-150 gap-1.5",
                  "data-[state=inactive]:text-muted-foreground data-[state=inactive]:hover:text-foreground data-[state=inactive]:hover:bg-muted/80",
                  pill.colorClass
                )}
              >
                {pill.icon && <span className="text-[11px]">{pill.icon}</span>}
                <span>{pill.label}</span>
                <span className={cn(
                  "inline-flex items-center justify-center h-5 min-w-[20px] px-1 rounded-full text-[10px] font-bold tabular-nums",
                  isActive 
                    ? "bg-white/25 text-inherit" 
                    : count > 0 
                      ? "bg-muted text-muted-foreground" 
                      : "bg-muted/50 text-muted-foreground/60"
                )}>
                  {count}
                </span>
              </TabsTrigger>
            );
          })}
        </TabsList>
      </Tabs>

      {/* Row 2: Search + Filters + Actions — single compact row */}
      <div className="flex items-center gap-2">
        {/* Search — wider, with clear button */}
        <div className="relative flex-1">
          <Search className="absolute left-2.5 top-1/2 h-3.5 w-3.5 -translate-y-1/2 text-muted-foreground" />
          <Input
            placeholder="Name, email, phone, reg..."
            value={searchTerm}
            onChange={(e) => onSearchChange(e.target.value)}
            className="h-8 pl-8 pr-8 text-sm bg-background border-2 border-border rounded-lg"
          />
          {searchTerm && (
            <button 
              onClick={() => onSearchChange('')}
              className="absolute right-2 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-foreground"
            >
              <X className="h-3.5 w-3.5" />
            </button>
          )}
        </div>

        {/* Assignment filter */}
        {onAssignmentFilterChange && (
          <Select value={assignmentFilter} onValueChange={(v) => onAssignmentFilterChange(v as AssignmentFilter)}>
            <SelectTrigger className="w-[150px] h-8 text-xs rounded-lg border-2 border-border">
              <Filter className="h-3 w-3 mr-1.5 text-muted-foreground" />
              <SelectValue placeholder="All Leads" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all">
                All Leads <Badge variant="secondary" className="ml-1.5 h-4 px-1 text-[10px]">{leadCounts.all_leads}</Badge>
              </SelectItem>
              <SelectItem value="total">
                Live <Badge variant="secondary" className="ml-1.5 h-4 px-1 text-[10px] bg-green-100">{leadCounts.live}</Badge>
              </SelectItem>
              <SelectItem value="awaiting_contact">
                Unassigned <Badge variant="secondary" className="ml-1.5 h-4 px-1 text-[10px] bg-amber-100">{assignmentCounts?.awaiting_contact}</Badge>
              </SelectItem>
              <SelectItem value="assigned">
                Assigned <Badge variant="secondary" className="ml-1.5 h-4 px-1 text-[10px] bg-green-100">{assignmentCounts?.assigned}</Badge>
              </SelectItem>
            </SelectContent>
          </Select>
        )}

        {/* Agent filter */}
        {onAgentFilterChange && salesUsers && salesUsers.length > 0 && (
          <Select value={agentFilter} onValueChange={(v) => onAgentFilterChange(v)}>
            <SelectTrigger className="w-[160px] h-8 text-xs rounded-lg border-2 border-border">
              <Users className="h-3 w-3 mr-1.5 text-muted-foreground" />
              <SelectValue placeholder="All Agents" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all">All Agents</SelectItem>
              <SelectItem value="unassigned">
                Unassigned <Badge variant="secondary" className="ml-1.5 h-4 px-1 text-[10px]">{agentLeadCounts?.['unassigned'] || 0}</Badge>
              </SelectItem>
              {salesUsers.map(user => (
                <SelectItem key={user.id} value={user.id}>
                  {user.first_name} {user.last_name}
                  <Badge variant="secondary" className="ml-1.5 h-4 px-1 text-[10px]">{agentLeadCounts?.[user.id] || 0}</Badge>
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        )}

        {/* Separator */}
        <div className="h-5 w-px bg-border" />

        {/* Quick date buttons */}
        <div className="flex items-center gap-0.5">
          <Button
            variant={dateRange?.from && dateRange?.to && 
              dateRange.from.toDateString() === startOfDay(new Date()).toDateString() && 
              dateRange.to.toDateString() === endOfDay(new Date()).toDateString() ? "default" : "ghost"}
            size="sm"
            onClick={() => handleQuickFilter(0)}
            className="h-7 px-2.5 text-[11px] font-medium rounded-md"
          >
            Today
          </Button>
          <Button
            variant={dateRange?.from && dateRange?.to && 
              dateRange.from.toDateString() === startOfDay(subDays(new Date(), 1)).toDateString() && 
              dateRange.to.toDateString() === endOfDay(subDays(new Date(), 1)).toDateString() ? "default" : "ghost"}
            size="sm"
            onClick={() => handleQuickFilter(1, true)}
            className="h-7 px-2.5 text-[11px] font-medium rounded-md"
          >
            Yesterday
          </Button>
        </div>

        {/* Date range with nav arrows */}
        <div className="flex items-center gap-0">
          <Button variant="ghost" size="sm" onClick={() => handleDayNav('prev')} className="h-7 w-7 p-0 rounded-md">
            <ChevronLeft className="h-3.5 w-3.5" />
          </Button>
          <Popover open={isCalendarOpen} onOpenChange={setIsCalendarOpen}>
            <PopoverTrigger asChild>
              <Button 
                variant={hasDateFilter ? "default" : "outline"} 
                size="sm" 
                className="h-7 gap-1.5 text-[11px] font-medium rounded-md min-w-[100px]"
              >
                <CalendarIcon className="h-3 w-3" />
                {getDateFilterLabel()}
              </Button>
            </PopoverTrigger>
            <PopoverContent className="w-auto p-0" align="start">
              <div className="p-3 border-b space-y-2">
                <div className="text-sm font-medium">Quick filters</div>
                <div className="flex flex-wrap gap-1">
                  <Button variant="outline" size="sm" onClick={handleAllTime} className="bg-primary/10 hover:bg-primary/20">
                    <History className="h-3 w-3 mr-1" />All Time
                  </Button>
                  <Button variant="outline" size="sm" onClick={() => handleQuickFilter(0)}>Today</Button>
                  <Button variant="outline" size="sm" onClick={() => handleQuickFilter(1, true)}>Yesterday</Button>
                  <Button variant="outline" size="sm" onClick={() => handleQuickFilter(7)}>Last 7 days</Button>
                  <Button variant="outline" size="sm" onClick={() => handleQuickFilter(30)}>Last 30 days</Button>
                  <Button variant="outline" size="sm" onClick={() => handleQuickFilter(90)}>Last 90 days</Button>
                </div>
              </div>
              <div className="p-3 border-b space-y-3">
                <div className="flex gap-3">
                  <div className="flex-1">
                    <div className="text-xs font-medium text-muted-foreground mb-1.5">By Month</div>
                    <Select onValueChange={(v) => handleMonthSelect(parseInt(v.replace('month_', '')))}>
                      <SelectTrigger className="w-full h-8 text-xs"><SelectValue placeholder="Select month" /></SelectTrigger>
                      <SelectContent className="max-h-[200px]">
                        {monthOptions.map((opt) => (
                          <SelectItem key={opt.value} value={opt.value} className="text-xs">{opt.label}</SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  </div>
                  <div className="flex-1">
                    <div className="text-xs font-medium text-muted-foreground mb-1.5">By Year</div>
                    <Select onValueChange={(v) => handleYearSelect(parseInt(v.replace('year_', '')))}>
                      <SelectTrigger className="w-full h-8 text-xs"><SelectValue placeholder="Select year" /></SelectTrigger>
                      <SelectContent>
                        {yearOptions.map((opt) => (
                          <SelectItem key={opt.value} value={opt.value} className="text-xs">{opt.label}</SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  </div>
                </div>
              </div>
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
              {hasDateFilter && (
                <div className="p-2 border-t flex justify-end">
                  <Button variant="ghost" size="sm" onClick={() => { clearDateRange(); setIsCalendarOpen(false); }} className="text-xs">
                    <X className="h-3 w-3 mr-1" />Clear Filter
                  </Button>
                </div>
              )}
            </PopoverContent>
          </Popover>
          <Button
            variant="ghost" size="sm"
            onClick={() => handleDayNav('next')}
            className="h-7 w-7 p-0 rounded-md"
            disabled={dateRange?.from && startOfDay(dateRange.from) >= startOfDay(new Date())}
          >
            <ChevronRight className="h-3.5 w-3.5" />
          </Button>
        </div>

        {/* Separator */}
        <div className="h-5 w-px bg-border/60" />

        {/* Sort */}
        {onSortChange && (
          <Select value={sortOption} onValueChange={(v) => onSortChange(v as SortOption)}>
            <SelectTrigger className="w-[130px] h-8 text-xs rounded-lg border-border/60">
              <ArrowUpDown className="h-3 w-3 mr-1.5 text-muted-foreground" />
              <SelectValue placeholder="Sort" />
            </SelectTrigger>
            <SelectContent className="bg-popover border shadow-lg z-50">
              <SelectItem value="newest">Newest first</SelectItem>
              <SelectItem value="latest_submitted">Latest Submitted</SelectItem>
              <SelectItem value="oldest">Oldest first</SelectItem>
              <SelectItem value="contacted">Contacted</SelectItem>
              <SelectItem value="follow_up">Follow-up</SelectItem>
              <SelectItem value="quote_sent">Quote Sent</SelectItem>
            </SelectContent>
          </Select>
        )}

        {/* Spacer */}
        <div className="flex-1" />

        {/* Action buttons — minimal, icon-forward */}
        <Button variant="ghost" size="sm" onClick={onRefresh} className="h-7 px-2 text-[11px] gap-1 rounded-md">
          <RefreshCw className="h-3 w-3" /> Refresh
        </Button>
        <Button variant="ghost" size="sm" onClick={onMigrate} className="h-7 px-2 text-[11px] gap-1 rounded-md">
          <Upload className="h-3 w-3" /> Import
        </Button>
        <Button variant="ghost" size="sm" onClick={() => onExport('csv')} className="h-7 px-2 text-[11px] gap-1 rounded-md">
          <Download className="h-3 w-3" /> CSV
        </Button>
      </div>
    </div>
  );
};
