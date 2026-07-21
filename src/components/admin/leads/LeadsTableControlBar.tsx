import React from 'react';
import { cn } from '@/lib/utils';
import { Checkbox } from '@/components/ui/checkbox';
import { Button } from '@/components/ui/button';
import { 
  DropdownMenu, 
  DropdownMenuContent, 
  DropdownMenuItem, 
  DropdownMenuTrigger,
  DropdownMenuSeparator
} from '@/components/ui/dropdown-menu';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Avatar, AvatarFallback } from '@/components/ui/avatar';
import { UserPlus, ChevronDown, X, Zap, Ban, XCircle, RotateCcw } from 'lucide-react';
import { AdminUser } from '@/hooks/useLeads';

interface LeadsTableControlBarProps {
  totalItems: number;
  pageSize: number;
  onPageSizeChange: (size: number) => void;
  selectedCount: number;
  totalVisible: number;
  allSelected: boolean;
  onSelectAll: () => void;
  pageSizeOptions?: number[];
  salesUsers?: AdminUser[];
  onBulkAssign?: (userId: string | null) => void;
  onBulkAutoAssign?: () => void;
  onBulkMarkFake?: () => void;
  onBulkMarkLost?: () => void;
  onBulkRestore?: () => void;
}

export const LeadsTableControlBar: React.FC<LeadsTableControlBarProps> = ({
  totalItems,
  pageSize,
  onPageSizeChange,
  selectedCount,
  totalVisible,
  allSelected,
  onSelectAll,
  pageSizeOptions = [25, 50, 100, 200, 250],
  salesUsers = [],
  onBulkAssign,
  onBulkAutoAssign,
  onBulkMarkFake,
  onBulkMarkLost,
  onBulkRestore,
}) => {
  const getInitials = (user: AdminUser) => {
    if (user.first_name || user.last_name) {
      return `${user.first_name?.[0] || ''}${user.last_name?.[0] || ''}`.toUpperCase();
    }
    return user.email[0].toUpperCase();
  };

  const getDisplayName = (user: AdminUser) => {
    if (user.first_name || user.last_name) {
      return `${user.first_name || ''} ${user.last_name || ''}`.trim();
    }
    return user.email;
  };

  return (
    <div className="sticky top-0 z-20 bg-background border-b px-3 py-1.5 flex items-center justify-between gap-3">
      {/* Left side */}
      <div className="flex items-center gap-3">
        <div className="flex items-center gap-1.5">
          <Checkbox
            checked={allSelected && totalVisible > 0}
            onCheckedChange={onSelectAll}
            aria-label="Select all leads"
            className="h-3.5 w-3.5"
          />
          {selectedCount > 0 && (
            <span className="text-[11px] font-medium text-primary">
              {selectedCount} selected
            </span>
          )}
        </div>
        
        <div className="text-[11px] text-muted-foreground">
          <span className="font-semibold text-foreground">{totalItems.toLocaleString()}</span>
          {' '}leads
        </div>

        {/* Bulk actions - only when leads are selected */}
        {selectedCount > 0 && (
          <div className="flex items-center gap-1.5">
            {/* Assign dropdown */}
            {onBulkAssign && salesUsers.length > 0 && (
              <DropdownMenu>
                <DropdownMenuTrigger asChild>
                  <Button variant="outline" size="sm" className="h-7 text-xs gap-1.5">
                    <UserPlus className="h-3.5 w-3.5" />
                    Assign to
                    <ChevronDown className="h-3 w-3 opacity-60" />
                  </Button>
                </DropdownMenuTrigger>
                <DropdownMenuContent align="start" className="w-56 max-h-80 overflow-y-auto">
                  <DropdownMenuItem onClick={() => onBulkAssign(null)} className="gap-2">
                    <X className="h-4 w-4 text-muted-foreground" />
                    <span>Remove assignment</span>
                  </DropdownMenuItem>
                  {onBulkAutoAssign && (
                    <DropdownMenuItem onClick={onBulkAutoAssign} className="gap-2 text-green-600">
                      <Zap className="h-4 w-4" />
                      <span>Auto-assign (next available)</span>
                    </DropdownMenuItem>
                  )}
                  <DropdownMenuSeparator />
                  {salesUsers.map((user) => (
                    <DropdownMenuItem
                      key={user.id}
                      onClick={() => onBulkAssign(user.id)}
                      className="gap-2"
                    >
                      <Avatar className="h-6 w-6">
                        <AvatarFallback className="text-xs bg-primary/10 text-primary">
                          {getInitials(user)}
                        </AvatarFallback>
                      </Avatar>
                      <span className="truncate">{getDisplayName(user)}</span>
                    </DropdownMenuItem>
                  ))}
                </DropdownMenuContent>
              </DropdownMenu>
            )}

            {/* Mark as Fake - instant, no popup */}
            {onBulkMarkFake && (
              <Button variant="outline" size="sm" className="h-7 text-xs gap-1.5 border-destructive/40 text-destructive hover:bg-destructive/10" onClick={onBulkMarkFake}>
                <Ban className="h-3.5 w-3.5" />
                Fake 404
              </Button>
            )}

            {/* Mark as Lost - instant, no popup */}
            {onBulkMarkLost && (
              <Button variant="outline" size="sm" className="h-7 text-xs gap-1.5 text-muted-foreground hover:bg-muted" onClick={onBulkMarkLost}>
                <XCircle className="h-3.5 w-3.5" />
                Lost
              </Button>
            )}

            {/* Restore - instant, no popup */}
            {onBulkRestore && (
              <Button variant="outline" size="sm" className="h-7 text-xs gap-1.5 text-green-700 border-green-300 hover:bg-green-50" onClick={onBulkRestore}>
                <RotateCcw className="h-3.5 w-3.5" />
                Restore
              </Button>
            )}
          </div>
        )}
      </div>

      {/* Right side */}
      <div className="flex items-center gap-1.5">
        <span className="text-[10px] text-muted-foreground">Per page</span>
        <Select value={String(pageSize)} onValueChange={(v) => onPageSizeChange(Number(v))}>
          <SelectTrigger className="h-6 w-[64px] text-[10px] px-2 py-0 rounded-md">
            <SelectValue />
          </SelectTrigger>
          <SelectContent align="end" className="min-w-[64px]">
            {pageSizeOptions.map((size) => (
              <SelectItem key={size} value={String(size)} className="text-[11px] py-1">
                {size}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
      </div>
    </div>
  );
};
