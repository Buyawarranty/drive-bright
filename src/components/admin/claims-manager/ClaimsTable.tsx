import React from 'react';
import { Check, Pencil, Phone, AlertTriangle, ChevronDown, Circle, Gauge, ArrowUpDown, ArrowDown, ArrowUp, Ban } from 'lucide-react';
import type { Claim } from '@/types/claim';
import { supabase } from '@/integrations/supabase/client';
import { useToast } from '@/hooks/use-toast';

interface ClaimsTableProps {
  claims: Claim[];
  onRowClick?: (claim: Claim) => void;
  selectedId?: string | null;
  selectedIds?: Set<string>;
  onToggleOne?: (id: string) => void;
  onToggleAll?: (checked: boolean) => void;
  onApprove?: (claim: Claim) => void;
  onCall?: (claim: Claim) => void;
  onUpdated?: () => void | Promise<void>;
  renderExpanded?: (claim: Claim) => React.ReactNode;
  columnCount?: number;
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

const STATUS_OPTIONS: { value: Claim['status']; label: string; cls: string }[] = [
  { value: 'open', label: 'Open', cls: 'bg-gray-100 text-gray-700 border-gray-300' },
  { value: 'evidence', label: 'Evidence Needed', cls: 'bg-amber-100 text-amber-700 border-amber-300' },
  { value: 'review', label: 'In Review', cls: 'bg-blue-100 text-blue-700 border-blue-300' },
  { value: 'approved', label: 'Approved', cls: 'bg-green-100 text-green-700 border-green-300' },
  { value: 'overdue', label: 'Overdue', cls: 'bg-red-100 text-red-700 border-red-300' },
  { value: 'closed', label: 'Closed', cls: 'bg-gray-100 text-gray-600 border-gray-300' },
];

// Map our simplified UI status -> raw DB status the schema expects
const UI_TO_DB_STATUS: Record<Claim['status'], string> = {
  open: 'new',
  evidence: 'awaiting_info',
  review: 'in_review',
  approved: 'approved',
  overdue: 'in_review',
  closed: 'closed',
};

const StatusSelect: React.FC<{
  claim: Claim;
  onUpdated?: () => void | Promise<void>;
}> = ({ claim, onUpdated }) => {
  const { toast } = useToast();
  const [busy, setBusy] = React.useState(false);
  const opt = STATUS_OPTIONS.find((o) => o.value === claim.status) ?? STATUS_OPTIONS[0];

  const handleChange = async (e: React.ChangeEvent<HTMLSelectElement>) => {
    const next = e.target.value as Claim['status'];
    if (next === claim.status) return;
    const nextLabel = STATUS_OPTIONS.find((o) => o.value === next)?.label;
    const ok = typeof window === 'undefined'
      ? true
      : window.confirm(
          `Change status for ${claim.customerName} (${claim.reg}) to "${nextLabel}"?\n\nThis updates the claim immediately. No email is sent.`,
        );
    if (!ok) {
      // Revert the visible <select> back to the previous value
      e.target.value = claim.status;
      return;
    }
    setBusy(true);
    try {
      const dbStatus = UI_TO_DB_STATUS[next];
      const patch: Record<string, any> = { status: dbStatus, updated_at: new Date().toISOString() };
      if (next === 'approved') patch.approved_at = new Date().toISOString();
      const { error } = await supabase.from('claims_submissions').update(patch).eq('id', claim.id);
      if (error) throw error;
      toast({ title: 'Status updated', description: `Set to ${nextLabel}` });
      await onUpdated?.();
    } catch (err: any) {
      console.error('Status update failed', err);
      toast({ title: 'Update failed', description: err?.message || 'Could not update status', variant: 'destructive' });
    } finally {
      setBusy(false);
    }
  };

  return (
    <div className="relative inline-block" onClick={(e) => e.stopPropagation()}>
      <select
        value={claim.status}
        onChange={handleChange}
        disabled={busy}
        aria-label="Update claim status"
        className={`appearance-none pl-2 pr-6 py-0.5 rounded text-[11px] font-semibold border cursor-pointer focus:outline-none focus:ring-2 focus:ring-ring disabled:opacity-50 ${opt.cls}`}
      >
        {STATUS_OPTIONS.map((o) => (
          <option key={o.value} value={o.value} className="bg-card text-foreground">
            {o.label}
          </option>
        ))}
      </select>
      <ChevronDown className="pointer-events-none absolute right-1 top-1/2 -translate-y-1/2 h-3 w-3 opacity-70" />
    </div>
  );
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

const DaysOnRiskCell: React.FC<{ days: number | null | undefined }> = ({ days }) => {
  if (days == null) return <span className="text-xs text-muted-foreground">—</span>;
  // ≤30 days: red, ≤60 days: yellow, otherwise neutral
  const color =
    days <= 30 ? 'text-red-600 fill-red-600' : days <= 60 ? 'text-amber-500 fill-amber-500' : 'text-muted-foreground fill-transparent';
  return (
    <div className="inline-flex items-center gap-1.5 whitespace-nowrap">
      <Circle className={`h-2.5 w-2.5 ${color}`} strokeWidth={2} />
      <span className="text-xs font-semibold text-foreground">{days}d</span>
    </div>
  );
};

const MileageSinceCoverCell: React.FC<{
  purchase: number | null | undefined;
  current: number | null | undefined;
}> = ({ purchase, current }) => {
  if (purchase == null && current == null) {
    return <span className="text-xs text-muted-foreground">—</span>;
  }
  const diff = purchase != null && current != null ? current - purchase : null;
  const sign = diff != null ? (diff > 0 ? '+' : diff < 0 ? '−' : '') : '';
  const diffColor = diff == null ? 'text-foreground' : diff < 0 ? 'text-red-600' : 'text-foreground';
  return (
    <div className="inline-flex items-center gap-1.5 whitespace-nowrap" title={`Mileage at warranty purchase: ${purchase?.toLocaleString() ?? '—'} mi\nMileage on claim form: ${current?.toLocaleString() ?? '—'} mi`}>
      <Gauge className="h-3.5 w-3.5 text-muted-foreground" />
      <div className="text-xs leading-tight">
        {diff != null ? (
          <div className={`font-semibold ${diffColor}`}>{sign}{Math.abs(diff).toLocaleString()} mi</div>
        ) : (
          <div className="font-semibold text-foreground">{(current ?? purchase)?.toLocaleString()} mi</div>
        )}
        <div className="text-[10px] text-muted-foreground">
          {purchase != null ? `${purchase.toLocaleString()}` : '—'} → {current != null ? `${current.toLocaleString()}` : '—'}
        </div>
      </div>
    </div>
  );
};

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
  onApprove,
  onCall,
  onUpdated,
  renderExpanded,
}) => {
  const [risksSort, setRisksSort] = React.useState<'none' | 'desc' | 'asc'>('none');
  // Date sort: 'desc' = newest first (default), 'asc' = oldest first
  const [dateSort, setDateSort] = React.useState<'desc' | 'asc'>('desc');
  const sortedClaims = React.useMemo(() => {
    const arr = [...claims];
    if (risksSort !== 'none') {
      arr.sort((a, b) => {
        const av = a.daysOnRisk ?? -Infinity;
        const bv = b.daysOnRisk ?? -Infinity;
        return risksSort === 'desc' ? bv - av : av - bv;
      });
      return arr;
    }
    // Default: sort by claim date. Smaller ageInDays = newer.
    arr.sort((a, b) => {
      const av = a.ageInDays ?? 0;
      const bv = b.ageInDays ?? 0;
      return dateSort === 'desc' ? av - bv : bv - av;
    });
    return arr;
  }, [claims, risksSort, dateSort]);
  const cycleRisksSort = () =>
    setRisksSort((s) => (s === 'none' ? 'desc' : s === 'desc' ? 'asc' : 'none'));
  const toggleDateSort = () => {
    setRisksSort('none');
    setDateSort((s) => (s === 'desc' ? 'asc' : 'desc'));
  };
  const RisksSortIcon =
    risksSort === 'desc' ? ArrowDown : risksSort === 'asc' ? ArrowUp : ArrowUpDown;
  const DateSortIcon = dateSort === 'desc' ? ArrowDown : ArrowUp;

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
              <th className="px-3 py-2 font-semibold whitespace-nowrap">
                <button
                  type="button"
                  onClick={toggleDateSort}
                  className={`inline-flex items-center gap-1 hover:text-foreground transition-colors ${risksSort === 'none' ? 'text-foreground' : ''}`}
                  title={dateSort === 'desc' ? 'Newest first. Click for oldest first.' : 'Oldest first. Click for newest first.'}
                  aria-label="Sort by claim date"
                >
                  Claim date
                  <DateSortIcon className="h-3.5 w-3.5 text-orange-500" />
                </button>
              </th>
              <th className="px-3 py-2 font-semibold">Reg</th>
              <th className="px-3 py-2 font-semibold">Customer</th>
              <th className="px-3 py-2 font-semibold">Issue</th>
              <th className="px-3 py-2 font-semibold">Age</th>
              <th className="px-3 py-2 font-semibold">Status</th>
              <th className="px-3 py-2 font-semibold">Assignee</th>
              <th className="px-3 py-2 font-semibold">
                <button
                  type="button"
                  onClick={cycleRisksSort}
                  className={`inline-flex items-center gap-1 hover:text-foreground transition-colors ${risksSort !== 'none' ? 'text-foreground' : ''}`}
                  title={
                    risksSort === 'none'
                      ? 'Sort: longest days on risk first'
                      : risksSort === 'desc'
                      ? 'Sorted longest → shortest. Click for shortest first.'
                      : 'Sorted shortest → longest. Click to clear sort.'
                  }
                  aria-label="Sort by days on risk"
                >
                  Days on risk
                  <RisksSortIcon className="h-3.5 w-3.5 text-orange-500" />
                </button>
              </th>
              <th className="px-3 py-2 font-semibold">Mileage SC</th>
              <th className="px-3 py-2 font-semibold text-right">Amount</th>
              <th className="px-3 py-2 font-semibold text-right">Actions</th>
            </tr>
          </thead>
          <tbody>
            {sortedClaims.map((c) => {
              const isCritical = c.priority === 'critical';
              const isUnassigned = c.assignee === 'unassigned';
              const amountHigh = c.amount >= 1500;
              const isSelected = selectedId === c.id;
              return (
                <React.Fragment key={c.id}>
                <tr
                  onClick={() => onRowClick?.(c)}
                  className={`border-t border-border cursor-pointer hover:bg-muted/40 ${
                    isCritical ? 'bg-red-50/60' : ''
                  } ${isSelected ? 'bg-blue-50/60' : ''}`}
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
                  <td className="px-3 align-middle h-[52px] whitespace-nowrap">
                    <div className="inline-flex items-center gap-1.5">
                      <NumberPlate reg={c.reg} />
                      {c.hasCancellation && (
                        <span
                          title="This customer's warranty has been cancelled or refunded"
                          className="inline-flex items-center gap-1 px-1.5 py-0.5 rounded text-[10px] font-semibold bg-red-100 text-red-700 border border-red-200"
                        >
                          <Ban className="h-3 w-3" /> Cancelled
                        </span>
                      )}
                    </div>
                  </td>
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
                  <td className="px-3 align-middle h-[52px]"><StatusSelect claim={c} onUpdated={onUpdated} /></td>
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
                  <td className="px-3 align-middle h-[52px]">
                    <DaysOnRiskCell days={c.daysOnRisk} />
                  </td>
                  <td className="px-3 align-middle h-[52px]">
                    <MileageSinceCoverCell purchase={c.purchaseMileage} current={c.claimMileage} />
                  </td>
                  <td className={`px-3 align-middle h-[52px] text-right font-mono ${amountHigh ? 'text-red-600 font-semibold' : 'text-foreground'}`}>
                    £{c.amount.toLocaleString()}
                  </td>
                  <td className="px-3 align-middle h-[52px]">
                    <div className="flex items-center justify-end gap-1">
                      {/* Approve button removed — use the Status dropdown to set "Approved" */}
                      <IconBtn
                        label={isSelected ? 'Collapse claim details' : 'Open claim details — view customer info, attachments, notes, and full actions'}
                        className="hover:text-blue-600 hover:border-blue-300"
                        onClick={() => onRowClick?.(c)}
                      >
                        <ChevronDown className={`h-3.5 w-3.5 transition-transform ${isSelected ? 'rotate-180' : ''}`} />
                      </IconBtn>
                      <IconBtn
                        label={c.phone ? `Call customer on ${c.phone} — opens your phone/dialer app` : 'No phone number on file for this customer'}
                        className="hover:text-blue-600 hover:border-blue-300"
                        disabled={!c.phone}
                        onClick={() => onCall?.(c)}
                      >
                        <Phone className="h-3.5 w-3.5" />
                      </IconBtn>
                    </div>
                  </td>
                </tr>
                {isSelected && renderExpanded && (
                  <tr className="bg-muted/20 border-t border-blue-200">
                    <td colSpan={13} className="p-0">
                      <div className="p-3">{renderExpanded(c)}</div>
                    </td>
                  </tr>
                )}
                </React.Fragment>
              );
            })}
          </tbody>
        </table>
      </div>
    </div>
  );
};
