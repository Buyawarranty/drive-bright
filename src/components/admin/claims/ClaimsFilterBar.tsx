import React from 'react';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Search, X } from 'lucide-react';

interface ClaimsFilterBarProps {
  searchQuery: string;
  onSearchChange: (val: string) => void;
  statusFilter: string;
  onStatusChange: (val: string) => void;
  priorityFilter: string;
  onPriorityChange: (val: string) => void;
  readinessFilter: string;
  onReadinessChange: (val: string) => void;
  warrantyFilter: string;
  onWarrantyChange: (val: string) => void;
  costRange: string;
  onCostRangeChange: (val: string) => void;
  dateFrom: string;
  dateTo: string;
  onDateFromChange: (val: string) => void;
  onDateToChange: (val: string) => void;
  onClearAll: () => void;
  hasActiveFilters: boolean;
  uniqueWarrantyTypes: string[];
}

export const getReadinessState = (claim: {
  status: string;
  file_url?: string;
  priority?: string;
}) => {
  if (claim.status === 'fake_test') return 'Fake/Test';
  if (claim.status === 'approved' || claim.status === 'paid') return 'Approved';
  if (claim.status === 'rejected') return 'Rejected';
  if (claim.status === 'awaiting_info') return 'Waiting for Evidence';
  if (!claim.file_url && claim.status !== 'resolved') return 'Evidence Needed';
  if (claim.status === 'new') return 'Ready for Review';
  if (claim.status === 'in_progress') return 'Under Review';
  if (claim.status === 'resolved') return 'Resolved';
  return 'Ready for Review';
};

export const readinessColor = (state: string) => {
  switch (state) {
    case 'Ready for Review': return 'bg-green-100 text-green-800 border-green-200';
    case 'Under Review': return 'bg-blue-100 text-blue-800 border-blue-200';
    case 'Waiting for Evidence': return 'bg-amber-100 text-amber-800 border-amber-200';
    case 'Evidence Needed': return 'bg-orange-100 text-orange-800 border-orange-200';
    case 'Approved': return 'bg-emerald-100 text-emerald-800 border-emerald-200';
    case 'Rejected': return 'bg-red-100 text-red-800 border-red-200';
    case 'Resolved': return 'bg-slate-100 text-slate-800 border-slate-200';
    case 'Fake/Test': return 'bg-gray-200 text-gray-500 border-gray-300 line-through';
    default: return 'bg-gray-100 text-gray-800 border-gray-200';
  }
};

export const ClaimsFilterBar: React.FC<ClaimsFilterBarProps> = ({
  searchQuery, onSearchChange,
  statusFilter, onStatusChange,
  priorityFilter, onPriorityChange,
  readinessFilter, onReadinessChange,
  warrantyFilter, onWarrantyChange,
  costRange, onCostRangeChange,
  dateFrom, dateTo, onDateFromChange, onDateToChange,
  onClearAll, hasActiveFilters,
  uniqueWarrantyTypes,
}) => {
  return (
    <div className="space-y-3">
      {/* Filter chips row */}
      <div className="flex flex-wrap gap-2 items-center">
        <Select value={statusFilter} onValueChange={onStatusChange}>
          <SelectTrigger className="w-[120px] h-8 text-xs">
            <SelectValue placeholder="Status" />
          </SelectTrigger>
          <SelectContent className="bg-background border shadow-lg z-50">
            <SelectItem value="all">All Statuses</SelectItem>
            <SelectItem value="new">New</SelectItem>
            <SelectItem value="in_progress">In Progress</SelectItem>
            <SelectItem value="awaiting_info">Awaiting Info</SelectItem>
            <SelectItem value="approved">Approved</SelectItem>
            <SelectItem value="paid">Paid</SelectItem>
            <SelectItem value="rejected">Rejected</SelectItem>
            <SelectItem value="resolved">Resolved</SelectItem>
            <SelectItem value="fake_test">Fake/Test</SelectItem>
          </SelectContent>
        </Select>

        <Select value={priorityFilter} onValueChange={onPriorityChange}>
          <SelectTrigger className="w-[110px] h-8 text-xs">
            <SelectValue placeholder="Priority" />
          </SelectTrigger>
          <SelectContent className="bg-background border shadow-lg z-50">
            <SelectItem value="all">All Priority</SelectItem>
            <SelectItem value="urgent">Urgent</SelectItem>
            <SelectItem value="high">High</SelectItem>
            <SelectItem value="normal">Normal</SelectItem>
            <SelectItem value="low">Low</SelectItem>
          </SelectContent>
        </Select>

        <Select value={readinessFilter} onValueChange={onReadinessChange}>
          <SelectTrigger className="w-[150px] h-8 text-xs">
            <SelectValue placeholder="Readiness" />
          </SelectTrigger>
          <SelectContent className="bg-background border shadow-lg z-50">
            <SelectItem value="all">All Readiness</SelectItem>
            <SelectItem value="Ready for Review">Ready for Review</SelectItem>
            <SelectItem value="Under Review">Under Review</SelectItem>
            <SelectItem value="Waiting for Evidence">Waiting for Evidence</SelectItem>
            <SelectItem value="Evidence Needed">Evidence Needed</SelectItem>
            <SelectItem value="Approved">Approved</SelectItem>
            <SelectItem value="Rejected">Rejected</SelectItem>
          </SelectContent>
        </Select>

        <Select value={warrantyFilter} onValueChange={onWarrantyChange}>
          <SelectTrigger className="w-[140px] h-8 text-xs">
            <SelectValue placeholder="Warranty Tier" />
          </SelectTrigger>
          <SelectContent className="bg-background border shadow-lg z-50">
            <SelectItem value="all">All Tiers</SelectItem>
            {uniqueWarrantyTypes.map(t => (
              <SelectItem key={t} value={t}>{t}</SelectItem>
            ))}
          </SelectContent>
        </Select>

        <Select value={costRange} onValueChange={onCostRangeChange}>
          <SelectTrigger className="w-[120px] h-8 text-xs">
            <SelectValue placeholder="Cost Range" />
          </SelectTrigger>
          <SelectContent className="bg-background border shadow-lg z-50">
            <SelectItem value="all">All Costs</SelectItem>
            <SelectItem value="0-100">£0 – £100</SelectItem>
            <SelectItem value="100-500">£100 – £500</SelectItem>
            <SelectItem value="500-1000">£500 – £1,000</SelectItem>
            <SelectItem value="1000+">£1,000+</SelectItem>
          </SelectContent>
        </Select>

        <Input
          type="date"
          value={dateFrom}
          onChange={(e) => onDateFromChange(e.target.value)}
          className="w-[130px] h-8 text-xs"
        />
        <Input
          type="date"
          value={dateTo}
          onChange={(e) => onDateToChange(e.target.value)}
          className="w-[130px] h-8 text-xs"
        />

        {hasActiveFilters && (
          <Button variant="ghost" size="sm" onClick={onClearAll} className="h-8 text-xs gap-1">
            <X className="h-3 w-3" /> Clear
          </Button>
        )}
      </div>

      {/* Search */}
      <div className="relative max-w-md">
        <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 h-4 w-4 text-muted-foreground" />
        <Input
          placeholder="Search name, email, vehicle reg..."
          value={searchQuery}
          onChange={(e) => onSearchChange(e.target.value)}
          className="pl-10 h-9 bg-yellow-50 border-yellow-300 focus-visible:ring-yellow-400"
        />
      </div>
    </div>
  );
};
