import React, { useState } from 'react';
import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover';
import { Command, CommandEmpty, CommandGroup, CommandInput, CommandItem, CommandList } from '@/components/ui/command';
import { Loader2, UserMinus, UserPlus, Check } from 'lucide-react';
import { useClaimsStaff } from '@/hooks/useClaimsStaff';
import { cn } from '@/lib/utils';

interface Props {
  /** Currently-assigned user_id, or null/undefined for unassigned (single mode). */
  currentAssigneeId?: string | null;
  /** Triggered when user picks a staff or clears. Receives `null` for unassign. */
  onAssign: (userId: string | null) => Promise<void> | void;
  trigger: React.ReactNode;
  align?: 'start' | 'center' | 'end';
  disabled?: boolean;
}

export const AssignMenu: React.FC<Props> = ({
  currentAssigneeId,
  onAssign,
  trigger,
  align = 'start',
  disabled,
}) => {
  const { staff, loading } = useClaimsStaff();
  const [open, setOpen] = useState(false);
  const [saving, setSaving] = useState(false);

  const handle = async (id: string | null) => {
    setSaving(true);
    try {
      await onAssign(id);
      setOpen(false);
    } finally {
      setSaving(false);
    }
  };

  return (
    <Popover open={open} onOpenChange={(v) => !disabled && setOpen(v)}>
      <PopoverTrigger asChild disabled={disabled}>
        <span className={cn(disabled && 'pointer-events-none opacity-60')}>{trigger}</span>
      </PopoverTrigger>
      <PopoverContent align={align} className="p-0 w-64" onClick={(e) => e.stopPropagation()}>
        <Command>
          <CommandInput placeholder="Search staff…" />
          <CommandList>
            {loading || saving ? (
              <div className="flex items-center justify-center py-6 text-xs text-muted-foreground">
                <Loader2 className="h-3.5 w-3.5 mr-2 animate-spin" />
                {saving ? 'Updating…' : 'Loading staff…'}
              </div>
            ) : (
              <>
                <CommandEmpty>No staff found.</CommandEmpty>
                <CommandGroup heading="Actions">
                  <CommandItem
                    value="__unassign"
                    onSelect={() => handle(null)}
                    className="text-red-600"
                  >
                    <UserMinus className="h-3.5 w-3.5 mr-2" />
                    Unassign
                  </CommandItem>
                </CommandGroup>
                <CommandGroup heading="Assign to">
                  {staff.map((s) => {
                    const active = currentAssigneeId === s.id;
                    return (
                      <CommandItem
                        key={s.id}
                        value={`${s.name} ${s.email}`}
                        onSelect={() => handle(s.id)}
                      >
                        <span className="h-5 w-5 mr-2 rounded-full bg-slate-200 text-slate-700 flex items-center justify-center text-[9px] font-semibold">
                          {s.initials}
                        </span>
                        <span className="flex-1 truncate">{s.name}</span>
                        {active && <Check className="h-3.5 w-3.5 text-primary" />}
                      </CommandItem>
                    );
                  })}
                </CommandGroup>
              </>
            )}
          </CommandList>
        </Command>
      </PopoverContent>
    </Popover>
  );
};

export const AssignTriggerButton: React.FC<{ label?: string; icon?: React.ReactNode }> = ({
  label = 'Assign',
  icon,
}) => (
  <button
    type="button"
    className="inline-flex items-center gap-1 px-2 py-1 rounded border border-border bg-card text-[11px] font-medium hover:bg-muted/50"
  >
    {icon ?? <UserPlus className="h-3 w-3" />}
    {label}
  </button>
);
