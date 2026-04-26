import React from 'react';
import { Users, RefreshCcw, FileQuestion, AlertOctagon, X } from 'lucide-react';

interface BulkActionsBarProps {
  count: number;
  onClear: () => void;
}

const Btn: React.FC<{ icon: React.ReactNode; label: string; onClick: () => void }> = ({ icon, label, onClick }) => (
  <button
    type="button"
    onClick={onClick}
    className="inline-flex items-center gap-1.5 h-8 px-3 rounded-md bg-white/15 hover:bg-white/25 text-white text-sm font-medium transition-colors"
  >
    {icon}
    {label}
  </button>
);

export const BulkActionsBar: React.FC<BulkActionsBarProps> = ({ count, onClear }) => {
  const fire = (label: string) => () => alert(`${label}: ${count} claim(s)`);
  return (
    <div className="bg-blue-600 text-white rounded-lg px-4 py-2.5 flex flex-wrap items-center gap-3 shadow-sm">
      <div className="text-sm font-semibold flex-1 min-w-0">
        {count} claim{count === 1 ? '' : 's'} selected
      </div>
      <div className="flex flex-wrap items-center gap-2">
        <Btn icon={<Users className="h-3.5 w-3.5" />} label="Assign To…" onClick={fire('Assign To')} />
        <Btn icon={<RefreshCcw className="h-3.5 w-3.5" />} label="Update Status" onClick={fire('Update Status')} />
        <Btn icon={<FileQuestion className="h-3.5 w-3.5" />} label="Request Evidence" onClick={fire('Request Evidence')} />
        <Btn icon={<AlertOctagon className="h-3.5 w-3.5" />} label="Escalate All" onClick={fire('Escalate All')} />
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
