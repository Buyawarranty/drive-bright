import React from 'react';
import { cn } from '@/lib/utils';
import { Checkbox } from '@/components/ui/checkbox';

interface LeadsTableControlBarProps {
  totalItems: number;
  pageSize: number;
  onPageSizeChange: (size: number) => void;
  selectedCount: number;
  totalVisible: number;
  allSelected: boolean;
  onSelectAll: () => void;
  pageSizeOptions?: number[];
}

export const LeadsTableControlBar: React.FC<LeadsTableControlBarProps> = ({
  totalItems,
  pageSize,
  onPageSizeChange,
  selectedCount,
  totalVisible,
  allSelected,
  onSelectAll,
  pageSizeOptions = [25, 50, 100, 200],
}) => {
  return (
    <div className="sticky top-0 z-20 bg-background border-b px-4 py-3 flex items-center justify-between gap-4">
      {/* Left side - Results summary and bulk selection */}
      <div className="flex items-center gap-4">
        {/* Bulk selection checkbox */}
        <div className="flex items-center gap-2">
          <Checkbox
            checked={allSelected && totalVisible > 0}
            onCheckedChange={onSelectAll}
            aria-label="Select all leads"
          />
          {selectedCount > 0 && (
            <span className="text-sm font-medium text-primary">
              {selectedCount} selected
            </span>
          )}
        </div>
        
        {/* Results summary */}
        <div className="text-sm text-muted-foreground">
          <span className="font-semibold text-foreground">{totalItems.toLocaleString()}</span>
          {' '}leads found
        </div>
      </div>

      {/* Right side - Page size control */}
      <div className="flex items-center gap-3">
        <span className="text-sm text-muted-foreground">Leads per page</span>
        <div className="inline-flex items-center rounded-lg border bg-muted/30 p-1">
          {pageSizeOptions.map((size) => (
            <button
              key={size}
              onClick={() => onPageSizeChange(size)}
              className={cn(
                "px-3 py-1.5 text-sm font-medium rounded-md transition-all",
                pageSize === size
                  ? "bg-primary text-primary-foreground shadow-sm"
                  : "text-muted-foreground hover:text-foreground hover:bg-muted"
              )}
            >
              {size}
            </button>
          ))}
        </div>
      </div>
    </div>
  );
};
