import React from 'react';
import { Check, Pencil, Phone, AlertTriangle } from 'lucide-react';
import type { Claim } from '@/types/claim';

interface ClaimsTableProps {
  claims: Claim[];
  onRowClick?: (claim: Claim) => void;
  selectedId?: string | null;
  selectedIds?: Set<string>;
  onToggleOne?: (id: string) => void;
  onToggleAll?: (checked: boolean) => void;
  onApprove?: (claim: Claim) => void;
  onCall?: (claim: Claim) => void;
}

const initials = (name: string) =>
  name.split(' ').filter(Boolean).slice(0, 2).map((p) => p[0]?.toUpperCase()).join('');

const PriorityBadge: React.FC<{ priority: Claim['priority'] }> = ({ priority }) => {
  const map: Record<Claim['priority'], string> = {
    critical: 'bg-red-100 text-red-700 border-red-200',
    high: 'bg-amber-100 text-amber-700 border-amber-200',
    normal: 'bg-blue-100 text-blue-700 border-blue-200',
    low: 'bg-gray-100 text-gray-700 border-gray-200',
  };
  return (
    <span className={`inline-flex px-2 py-0.5 rounded text-[11px] font-semibold border capitalize ${map[priority]}`}>
      {priority}
    </span>
  );
};

const StatusBadge: React.FC<{ status: Claim['status'] }> = ({ status }) => {
  const map: Record<Claim['status'], { label: string; cls: string }> = {
    overdue: { label: 'Overdue', cls: 'bg-red-100 text-red-700 border-red-200' },
    evidence: { label: 'Evidence Needed', cls: 'bg-amber-100 text-amber-700 border-amber-200' },
    review: { label: 'In Review', cls: 'bg-blue-100 text-blue-700 border-blue-200' },
    approved: { label: 'Approved', cls: 'bg-green-100 text-green-700 border-green-200' },
    open: { label: 'Open', cls: 'bg-gray-100 text-gray-700 border-gray-200' },
    closed: { label: 'Closed', cls: 'bg-gray-100 text-gray-600 border-gray-200' },
  };
  const { label, cls } = map[status];
  return <span className={`inline-flex px-2 py-0.5 rounded text-[11px] font-semibold border ${cls}`}>{label}</span>;
};

const AgePill: React.FC<{ days: number }> = ({ days }) => {
  const cls =
    days >= 10
      ? 'bg-red-100 text-red-700 border-red-200'
      : days >= 5
      ? 'bg-amber-100 text-amber-700 border-amber-200'
      : 'bg-gray-100 text-gray-700 border-gray-200';
  return <span className={`inline-flex px-2 py-0.5 rounded-full text-[11px] font-semibold border ${cls}`}>{days}d</span>;
};

const NumberPlate: React.FC<{ reg: string }> = ({ reg }) => (
  <span className="inline-block px-2 py-0.5 rounded bg-yellow-300 border-2 border-slate-800 text-slate-900 font-mono font-bold text-xs tracking-wider">
    {reg}
  </span>
);

const IconBtn: React.FC<{
  label: string;
  children: React.ReactNode;
  className?: string;
  onClick?: (e: React.MouseEvent) => void;
  disabled?: boolean;
}> = ({ label, children, className = '', onClick, disabled }) => (
  <button
    type="button"
    title={label}
    aria-label={label}
    disabled={disabled}
    onClick={(e) => {
      e.stopPropagation();
      onClick?.(e);
    }}
    className={`inline-flex items-center justify-center h-7 w-7 rounded border border-border bg-card hover:bg-muted text-muted-foreground hover:text-foreground transition-colors disabled:opacity-40 disabled:cursor-not-allowed ${className}`}
  >
    {children}
  </button>
);

export const ClaimsTable: React.FC<ClaimsTableProps> = ({
  claims,
  onRowClick,
  selectedId,
  selectedIds,
  onToggleOne,
  onToggleAll,
}) => {
  const allChecked = claims.length > 0 && claims.every((c) => selectedIds?.has(c.id));
  const someChecked = !allChecked && claims.some((c) => selectedIds?.has(c.id));
  const headerRef = React.useRef<HTMLInputElement>(null);
  React.useEffect(() => {
    if (headerRef.current) headerRef.current.indeterminate = someChecked;
  }, [someChecked]);
  return (
    <div className="bg-card border border-border rounded-lg overflow-hidden shadow-sm">
      <div className="overflow-x-auto">
        <table className="w-full text-sm">
          <thead className="bg-muted/50 text-muted-foreground">
            <tr className="text-left">
              <th className="px-3 py-2 w-8" onClick={(e) => e.stopPropagation()}>
                <input
                  ref={headerRef}
                  type="checkbox"
                  className="h-4 w-4 rounded border-border"
                  checked={allChecked}
                  onChange={(e) => onToggleAll?.(e.target.checked)}
                  aria-label="Select all visible claims"
                />
              </th>
              <th className="px-3 py-2 font-semibold">Priority</th>
              <th className="px-3 py-2 font-semibold">Date</th>
              <th className="px-3 py-2 font-semibold">Reg</th>
              <th className="px-3 py-2 font-semibold">Customer</th>
              <th className="px-3 py-2 font-semibold">Issue</th>
              <th className="px-3 py-2 font-semibold">Age</th>
              <th className="px-3 py-2 font-semibold">Status</th>
              <th className="px-3 py-2 font-semibold">Assignee</th>
              <th className="px-3 py-2 font-semibold text-right">Amount</th>
              <th className="px-3 py-2 font-semibold text-right">Actions</th>
            </tr>
          </thead>
          <tbody>
            {claims.map((c) => {
              const isCritical = c.priority === 'critical';
              const isUnassigned = c.assignee === 'unassigned';
              const amountHigh = c.amount >= 1500;
              const isSelected = selectedId === c.id;
              return (
                <tr
                  key={c.id}
                  onClick={() => onRowClick?.(c)}
                  className={`border-t border-border cursor-pointer hover:bg-muted/40 ${
                    isCritical ? 'bg-red-50/60' : ''
                  } ${isSelected ? 'ring-2 ring-inset ring-blue-400' : ''}`}
                >
                  <td className="px-3 align-middle h-[52px]" onClick={(e) => e.stopPropagation()}>
                    <input
                      type="checkbox"
                      className="h-4 w-4 rounded border-border"
                      checked={selectedIds?.has(c.id) ?? false}
                      onChange={() => onToggleOne?.(c.id)}
                      aria-label={`Select claim ${c.id}`}
                    />
                  </td>
                  <td className="px-3 align-middle h-[52px]"><PriorityBadge priority={c.priority} /></td>
                  <td className="px-3 align-middle h-[52px] text-xs text-muted-foreground whitespace-nowrap">{c.date}</td>
                  <td className="px-3 align-middle h-[52px] whitespace-nowrap"><NumberPlate reg={c.reg} /></td>
                  <td className="px-3 align-middle h-[52px]">
                    <div className="flex items-center gap-2 min-w-0">
                      <div className="shrink-0 h-8 w-8 rounded-full bg-slate-200 text-slate-700 flex items-center justify-center text-xs font-semibold">
                        {initials(c.customerName)}
                      </div>
                      <div className="min-w-0">
                        <div className="font-medium text-foreground truncate">{c.customerName}</div>
                        <div className="text-xs text-muted-foreground truncate">{c.email}</div>
                      </div>
                    </div>
                  </td>
                  <td className="px-3 align-middle h-[52px]">
                    <div className="truncate max-w-[120px]" title={c.issue}>{c.issue}</div>
                  </td>
                  <td className="px-3 align-middle h-[52px]"><AgePill days={c.ageInDays} /></td>
                  <td className="px-3 align-middle h-[52px]"><StatusBadge status={c.status} /></td>
                  <td className="px-3 align-middle h-[52px] whitespace-nowrap">
                    {isUnassigned ? (
                      <span className="inline-flex items-center gap-1 text-red-600 font-bold text-xs">
                        <AlertTriangle className="h-3.5 w-3.5" />
                        Unassigned
                      </span>
                    ) : (
                      <span className="text-xs text-muted-foreground">{c.assignee}</span>
                    )}
                  </td>
                  <td className={`px-3 align-middle h-[52px] text-right font-mono ${amountHigh ? 'text-red-600 font-semibold' : 'text-foreground'}`}>
                    £{c.amount.toLocaleString()}
                  </td>
                  <td className="px-3 align-middle h-[52px]">
                    <div className="flex items-center justify-end gap-1">
                      <IconBtn label="Approve" className="hover:text-green-600"><Check className="h-3.5 w-3.5" /></IconBtn>
                      <IconBtn label="Add note" className="hover:text-blue-600"><Pencil className="h-3.5 w-3.5" /></IconBtn>
                      <IconBtn label="Call customer" className="hover:text-blue-600"><Phone className="h-3.5 w-3.5" /></IconBtn>
                    </div>
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>
    </div>
  );
};
