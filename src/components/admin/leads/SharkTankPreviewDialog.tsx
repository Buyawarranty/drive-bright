import { useEffect, useState } from 'react';
import { CircleDot, Phone, Mail, Clock, Info } from 'lucide-react';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription } from '@/components/ui/dialog';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { cn } from '@/lib/utils';

interface Props {
  open: boolean;
  onOpenChange: (v: boolean) => void;
  holdSeconds: number;
  retryMinutes: number;
  chaseMinutes: number;
}

const STATUS_OPTIONS = [
  { value: 'new', label: 'New' },
  { value: 'contacted', label: 'Contacted' },
  { value: 'follow_up', label: 'Follow-up' },
  { value: 'qualified', label: 'Qualified' },
  { value: 'converted', label: 'Converted' },
  { value: 'lost', label: 'Lost' },
];

const statusTone: Record<string, string> = {
  new: 'bg-blue-100 text-blue-800 border-blue-200',
  contacted: 'bg-amber-100 text-amber-800 border-amber-200',
  follow_up: 'bg-sky-100 text-sky-800 border-sky-200',
  qualified: 'bg-violet-100 text-violet-800 border-violet-200',
  converted: 'bg-emerald-100 text-emerald-800 border-emerald-200',
  lost: 'bg-slate-100 text-slate-700 border-slate-200',
};

interface Row {
  id: string;
  name: string;
  email: string;
  phone: string;
  status: string;
  calls: number;
  activity: string;
  pinned?: boolean;
}

/**
 * Preview of the inline Open Lead Pool flow — mirrors the real Leads
 * table row controls (clickable phone/email, working status dropdown)
 * so agents see exactly what they'll get.
 */
export function SharkTankPreviewDialog({ open, onOpenChange, retryMinutes, chaseMinutes }: Props) {
  const [reserved, setReserved] = useState(false);
  const [remaining, setRemaining] = useState(120);
  const [rows, setRows] = useState<Row[]>([
    { id: 'e', name: 'Emma Wilson', email: 'emma@example.com', phone: '07956 672 174', status: 'contacted', calls: 0, activity: '27 min ago' },
    { id: 'r', name: 'Ravi Patel',  email: 'ravi@example.com', phone: '07811 224 908', status: 'follow_up', calls: 0, activity: '2 h ago' },
  ]);

  useEffect(() => {
    if (!open) {
      setReserved(false);
      setRemaining(120);
      setRows((rs) => rs.filter((r) => !r.pinned));
    }
  }, [open]);

  useEffect(() => {
    if (!reserved) return;
    setRemaining(120);
    const t = setInterval(() => setRemaining((r) => (r <= 1 ? 0 : r - 1)), 1000);
    return () => clearInterval(t);
  }, [reserved]);

  const timerTone = remaining <= 15 ? 'text-amber-700' : 'text-slate-500';
  const timerLabel = remaining <= 15 ? `Releasing soon · ${remaining}s` : `Reserved to you · ${remaining}s`;

  const takeNext = () => {
    setReserved(true);
    setRows((rs) => {
      if (rs.some((r) => r.pinned)) return rs;
      return [
        { id: 'pinned', name: 'John Smith', email: 'john@example.com', phone: '07123 456 789', status: 'new', calls: 0, activity: '', pinned: true },
        ...rs,
      ];
    });
  };

  const updateStatus = (id: string, status: string) => {
    setRows((rs) => rs.map((r) => (r.id === id ? { ...r, status } : r)));
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-4xl">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <CircleDot className="h-4 w-4 text-emerald-700" /> Agent view preview
          </DialogTitle>
          <DialogDescription>
            This is what agents see on the Leads page once Open Lead Pool is ON.
            No modal, no separate reveal step — the lead pins to the top of the table.
          </DialogDescription>
        </DialogHeader>

        <div className="rounded-md border-2 border-dashed border-primary/30 bg-primary/5 p-3 space-y-3">
          {/* Compact inline bar above the leads table */}
          <div className="flex items-center justify-between gap-3 rounded-md border border-emerald-200 bg-emerald-50/50 px-3 py-2">
            <div className="flex items-center gap-2 min-w-0 flex-wrap">
              <CircleDot className="h-3.5 w-3.5 text-emerald-700" />
              <span className="text-sm font-semibold text-emerald-900">Open Lead Pool</span>
              <span className="text-xs text-slate-600">Leads are assigned one at a time.</span>
              {reserved ? (
                <span className={cn('inline-flex items-center gap-1 text-xs font-medium', timerTone)}>
                  <Clock className="h-3 w-3" /> {timerLabel}
                </span>
              ) : (
                <span className="text-xs text-slate-600">· 3 available</span>
              )}
            </div>
            <Button
              type="button"
              size="sm"
              onClick={takeNext}
              disabled={reserved}
              className="bg-emerald-700 hover:bg-emerald-800 text-white"
            >
              {reserved ? 'Working a lead' : 'Take Next Lead'}
            </Button>
          </div>

          {/* Mock leads table — mirrors the real row controls */}
          <div className="rounded-md border border-border overflow-hidden bg-card">
            <div className="grid grid-cols-[130px_60px_1.2fr_1.4fr_1.4fr_140px] bg-muted/40 px-3 py-2 text-[10px] uppercase tracking-wide text-muted-foreground font-semibold">
              <div>Status</div>
              <div>Calls</div>
              <div>Name</div>
              <div>Phone</div>
              <div>Email</div>
              <div>Activity</div>
            </div>
            {rows.map((r, idx) => {
              const tone = statusTone[r.status] || 'bg-slate-100 text-slate-700 border-slate-200';
              return (
                <div
                  key={r.id}
                  className={cn(
                    'grid grid-cols-[130px_60px_1.2fr_1.4fr_1.4fr_140px] px-3 py-2 items-center text-xs',
                    idx > 0 && 'border-t border-border',
                    r.pinned && 'bg-emerald-50/70 shadow-[inset_4px_0_0_0_theme(colors.emerald.600)]',
                  )}
                >
                  <div>
                    <Select value={r.status} onValueChange={(v) => updateStatus(r.id, v)}>
                      <SelectTrigger
                        className={cn(
                          'h-7 px-2 py-0 text-[11px] font-semibold border w-[112px] gap-1',
                          tone,
                        )}
                      >
                        <SelectValue />
                      </SelectTrigger>
                      <SelectContent>
                        {STATUS_OPTIONS.map((o) => (
                          <SelectItem key={o.value} value={o.value} className="text-xs">
                            <Badge
                              variant="outline"
                              className={cn('text-[10px] font-semibold border', statusTone[o.value])}
                            >
                              {o.label}
                            </Badge>
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  </div>
                  <div className="text-slate-700">{r.calls}</div>
                  <div className="font-medium text-slate-900 truncate">{r.name}</div>
                  <div>
                    <a
                      href={`tel:${r.phone.replace(/\s/g, '')}`}
                      className="inline-flex items-center gap-1 text-primary hover:underline font-mono"
                    >
                      <Phone className="h-3 w-3" />
                      {r.phone}
                    </a>
                  </div>
                  <div>
                    <a
                      href={`mailto:${r.email}`}
                      className="inline-flex items-center gap-1 text-primary hover:underline"
                    >
                      <Mail className="h-3 w-3" />
                      <span className="truncate max-w-[180px]">{r.email}</span>
                    </a>
                  </div>
                  <div className={cn('inline-flex items-center gap-1', r.pinned ? cn('font-medium', timerTone) : 'text-slate-500')}>
                    {r.pinned ? (
                      <>
                        <Clock className="h-3 w-3" /> {timerLabel}
                      </>
                    ) : (
                      r.activity
                    )}
                  </div>
                </div>
              );
            })}
          </div>
        </div>

        <div className="text-xs text-slate-600 space-y-1 border-t pt-3">
          <div className="flex items-start gap-2">
            <Info className="h-3.5 w-3.5 mt-0.5 shrink-0" />
            <span>
              Agents use the existing row controls — phone, email, status dropdown,
              quote, reminder — no separate outcome form. The reservation locks or
              extends automatically on first meaningful action. If nothing happens,
              the lead quietly returns to the pool with a neutral toast.
            </span>
          </div>
          <div className="text-[11px] text-slate-500">
            Retry window: {retryMinutes} min &middot; Chase lock: {chaseMinutes} min.
            Timer text stays neutral grey; only the final 15 seconds shows a pale amber "Releasing soon" cue. No red.
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
}
