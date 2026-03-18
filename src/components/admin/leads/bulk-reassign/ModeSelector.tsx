import React from 'react';
import { UserRoundCog, Percent, Hash } from 'lucide-react';

export type ReassignMode = 'all' | 'percentage' | 'count';

interface ModeSelectorProps {
  mode: ReassignMode;
  onSelect: (mode: ReassignMode) => void;
}

const modes: { value: ReassignMode; label: string; description: string; icon: React.ReactNode }[] = [
  { value: 'all', label: 'Reassign All', description: 'Move all leads & customers to another agent', icon: <UserRoundCog className="h-4 w-4" /> },
  { value: 'percentage', label: 'Split by %', description: 'Move a percentage of leads (newest first)', icon: <Percent className="h-4 w-4" /> },
  { value: 'count', label: 'Move exact count', description: 'Move a specific number of leads (newest first)', icon: <Hash className="h-4 w-4" /> },
];

export const ModeSelector: React.FC<ModeSelectorProps> = ({ mode, onSelect }) => (
  <div className="space-y-2">
    <label className="text-sm font-medium text-muted-foreground">Redistribution mode</label>
    <div className="grid grid-cols-3 gap-2">
      {modes.map((m) => (
        <button
          key={m.value}
          onClick={() => onSelect(m.value)}
          className={`flex flex-col items-center gap-1.5 p-3 rounded-lg border-2 text-center transition-colors ${
            mode === m.value
              ? 'border-primary bg-primary/5'
              : 'border-border hover:border-muted-foreground/30 hover:bg-muted/30'
          }`}
        >
          <span className={mode === m.value ? 'text-primary' : 'text-muted-foreground'}>{m.icon}</span>
          <span className="text-xs font-medium">{m.label}</span>
        </button>
      ))}
    </div>
  </div>
);
