import React, { useState } from 'react';
import { Tabs, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Input } from '@/components/ui/input';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover';
import { Calendar } from '@/components/ui/calendar';
import { Search, RefreshCw, Upload, Download, CalendarIcon, X } from 'lucide-react';
import { LeadStatus } from '@/hooks/useLeads';
import { format, subDays, startOfDay, endOfDay } from 'date-fns';
import { DateRange } from 'react-day-picker';

interface LeadsFiltersProps {
  filter: LeadStatus | 'all' | 'high_priority';
  onFilterChange: (filter: LeadStatus | 'all' | 'high_priority') => void;
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
    paid: number;
    lost: number;
    high_priority: number;
  };
  dateRange?: { from: Date | undefined; to: Date | undefined };
  onDateRangeChange?: (range: { from: Date | undefined; to: Date | undefined }) => void;
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
  onDateRangeChange
}) => {
  const [isCalendarOpen, setIsCalendarOpen] = useState(false);

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

  const clearDateRange = () => {
    if (onDateRangeChange) {
      onDateRangeChange({ from: undefined, to: undefined });
    }
  };

  const hasDateFilter = dateRange?.from || dateRange?.to;

  return (
    <div className="space-y-4">
      {/* Tabs for status filter */}
      <Tabs value={filter} onValueChange={(v) => onFilterChange(v as LeadStatus | 'all' | 'high_priority')}>
        <TabsList className="grid w-full grid-cols-7">
          <TabsTrigger value="all" className="relative">
            All
            <Badge variant="secondary" className="ml-1 h-5 px-1.5">{leadCounts.all}</Badge>
          </TabsTrigger>
          <TabsTrigger value="new" className="relative">
            New
            <Badge variant="secondary" className="ml-1 h-5 px-1.5 bg-blue-100">{leadCounts.new}</Badge>
          </TabsTrigger>
          <TabsTrigger value="contacted">
            Contacted
            <Badge variant="secondary" className="ml-1 h-5 px-1.5 bg-yellow-100">{leadCounts.contacted}</Badge>
          </TabsTrigger>
          <TabsTrigger value="follow_up">
            Follow-up
            <Badge variant="secondary" className="ml-1 h-5 px-1.5 bg-purple-100">{leadCounts.follow_up}</Badge>
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
            🔥 High Priority
            <Badge variant="secondary" className="ml-1 h-5 px-1.5 bg-red-100">{leadCounts.high_priority}</Badge>
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
          
          {/* Date Range Filter */}
          <Popover open={isCalendarOpen} onOpenChange={setIsCalendarOpen}>
            <PopoverTrigger asChild>
              <Button 
                variant={hasDateFilter ? "default" : "outline"} 
                size="sm" 
                className="gap-2 min-w-[140px]"
              >
                <CalendarIcon className="h-4 w-4" />
                {hasDateFilter ? (
                  <span className="text-xs">
                    {dateRange?.from ? format(dateRange.from, 'dd MMM') : ''} 
                    {dateRange?.to ? ` - ${format(dateRange.to, 'dd MMM')}` : ''}
                  </span>
                ) : (
                  'Date Range'
                )}
              </Button>
            </PopoverTrigger>
            <PopoverContent className="w-auto p-0" align="start">
              <div className="p-3 border-b space-y-2">
                <div className="text-sm font-medium">Quick filters</div>
                <div className="flex flex-wrap gap-1">
                  <Button variant="outline" size="sm" onClick={() => handleQuickFilter(7)}>Last 7 days</Button>
                  <Button variant="outline" size="sm" onClick={() => handleQuickFilter(14)}>Last 14 days</Button>
                  <Button variant="outline" size="sm" onClick={() => handleQuickFilter(30)}>Last 30 days</Button>
                  <Button variant="outline" size="sm" onClick={() => handleQuickFilter(90)}>Last 90 days</Button>
                </div>
              </div>
              <Calendar
                mode="range"
                defaultMonth={dateRange?.from}
                selected={{ from: dateRange?.from, to: dateRange?.to }}
                onSelect={handleDateSelect}
                numberOfMonths={2}
                className="p-3 pointer-events-auto"
              />
            </PopoverContent>
          </Popover>
          
          {hasDateFilter && (
            <Button variant="ghost" size="sm" onClick={clearDateRange} className="h-8 px-2">
              <X className="h-4 w-4" />
            </Button>
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
