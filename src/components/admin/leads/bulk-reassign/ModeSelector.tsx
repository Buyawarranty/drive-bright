import React from 'react';
import { UserRoundCog, Percent, Hash, ListChecks } from 'lucide-react';

export type ReassignMode = 'all' | 'percentage' | 'count' | 'cherry_pick';

interface ModeSelectorProps {
  mode: ReassignMode;
  onSelect: (mode: ReassignMode) => void;
}

const modes: { value: ReassignMode; label: string; icon: React.ReactNode }[] = [
  { value: 'all', label: 'Reassign All', icon: <UserRoundCog className="h-4 w-4" /> },
  { value: 'percentage', label: 'Split by %', icon: <Percent className="h-4 w-4" /> },
  { value: 'count', label: 'Exact count', icon: <Hash className="h-4 w-4" /> },
  { value: 'cherry_pick', label: 'Pick leads', icon: <ListChecks className="h-4 w-4" /> },
];

export const ModeSelector: React.FC<ModeSelectorProps> = ({ mode, onSelect }) => (
  <div className="space-y-2">
    <label className="text-sm font-medium text-muted-foreground">Redistribution mode</label>
    <div className="grid grid-cols-4 gap-2">
      {modes.map((m) => (
        <button
          key={m.value}
          onClick={() => onSelect(m.value)}
          className={`flex flex-col items-center gap-1.5 p-2.5 rounded-lg border-2 text-center transition-colors ${
            mode === m.value
              ? 'border-primary bg-primary/5'
              : 'border-border hover:border-muted-foreground/30 hover:bg-muted/30'
          }`}
        >
          <span className={mode === m.value ? 'text-primary' : 'text-muted-foreground'}>{m.icon}</span>
          <span className="text-[11px] font-medium leading-tight">{m.label}</span>
        </button>
      ))}
    </div>
  </div>
);
