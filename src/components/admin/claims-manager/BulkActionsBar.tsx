import React, { useState } from 'react';
import { Users, X, Check, UserCircle2 } from 'lucide-react';
import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover';

export interface AssignableAgent {
  userId: string;
  name: string;
  role?: string;
}

interface BulkActionsBarProps {
  count: number;
  onClear: () => void;
  agents?: AssignableAgent[];
  currentUserId?: string | null;
  onAssign?: (userId: string | null) => Promise<void> | void;
  assigning?: boolean;
}

export const BulkActionsBar: React.FC<BulkActionsBarProps> = ({
  count,
  onClear,
  agents = [],
  currentUserId,
  onAssign,
  assigning = false,
}) => {
  const [open, setOpen] = useState(false);
  const meIsAgent = !!currentUserId && agents.some((a) => a.userId === currentUserId);

  const handleAssign = async (userId: string | null) => {
    if (!onAssign) return;
    await onAssign(userId);
    setOpen(false);
  };

  return (
    <div className="bg-blue-600 text-white rounded-lg px-4 py-2.5 flex flex-wrap items-center gap-3 shadow-sm">
      <div className="text-sm font-semibold flex-1 min-w-0">
        {count} claim{count === 1 ? '' : 's'} selected
      </div>
      <div className="flex flex-wrap items-center gap-2">
        {meIsAgent && (
          <button
            type="button"
            onClick={() => handleAssign(currentUserId!)}
            disabled={assigning}
            className="inline-flex items-center gap-1.5 h-8 px-3 rounded-md bg-white text-blue-700 hover:bg-blue-50 text-sm font-semibold transition-colors disabled:opacity-60"
          >
            <UserCircle2 className="h-3.5 w-3.5" />
            Assign to me
          </button>
        )}
        <Popover open={open} onOpenChange={setOpen}>
          <PopoverTrigger asChild>
            <button
              type="button"
              disabled={assigning || !onAssign}
              className="inline-flex items-center gap-1.5 h-8 px-3 rounded-md bg-white/15 hover:bg-white/25 text-white text-sm font-medium transition-colors disabled:opacity-60"
            >
              <Users className="h-3.5 w-3.5" />
              Assign To…
            </button>
          </PopoverTrigger>
          <PopoverContent align="end" className="w-64 p-1 max-h-80 overflow-auto">
            {agents.length === 0 ? (
              <div className="px-3 py-2 text-sm text-muted-foreground">No agents available</div>
            ) : (
              <>
                {agents.map((a) => (
                  <button
                    key={a.userId}
                    type="button"
                    onClick={() => handleAssign(a.userId)}
                    className="w-full flex items-center justify-between gap-2 px-3 py-2 text-sm rounded-md hover:bg-accent text-left"
                  >
                    <span className="truncate">
                      {a.name}
                      {a.userId === currentUserId && (
                        <span className="ml-1 text-xs text-muted-foreground">(me)</span>
                      )}
                    </span>
                    {a.role && (
                      <span className="text-[10px] uppercase tracking-wide text-muted-foreground shrink-0">
                        {a.role.replace('_', ' ')}
                      </span>
                    )}
                  </button>
                ))}
                <div className="my-1 border-t" />
                <button
                  type="button"
                  onClick={() => handleAssign(null)}
                  className="w-full flex items-center gap-2 px-3 py-2 text-sm rounded-md hover:bg-accent text-left text-muted-foreground"
                >
                  <Check className="h-3.5 w-3.5" /> Unassign
                </button>
              </>
            )}
          </PopoverContent>
        </Popover>
        <button
          type="button"
          onClick={onClear}
          aria-label="Clear selection"
          className="inline-flex items-center justify-center h-8 w-8 rounded-md bg-white/15 hover:bg-white/25 text-white transition-colors"
        >
          <X className="h-4 w-4" />
        </button>
      </div>
    </div>
  );
};
