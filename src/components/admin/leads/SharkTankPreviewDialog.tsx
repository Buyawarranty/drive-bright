import { useEffect, useState } from 'react';
import { CircleDot, Phone, Mail, Clock, Info, ChevronDown } from 'lucide-react';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription } from '@/components/ui/dialog';

interface Props {
  open: boolean;
  onOpenChange: (v: boolean) => void;
  holdSeconds: number;
  retryMinutes: number;
  chaseMinutes: number;
}

/**
 * Preview of the new inline Open Lead Pool flow.
 * Shows a compact one-row bar above a mock leads table. Clicking
 * "Take Next Lead" pins a mint-highlighted row with a quiet
 * countdown chip in the Activity column — no modal, no reveal step.
 */
export function SharkTankPreviewDialog({ open, onOpenChange, retryMinutes, chaseMinutes }: Props) {
  const [reserved, setReserved] = useState(false);
  const [remaining, setRemaining] = useState(120);

  useEffect(() => {
    if (!open) { setReserved(false); setRemaining(120); }
  }, [open]);

  useEffect(() => {
    if (!reserved) return;
    setRemaining(120);
    const t = setInterval(() => setRemaining((r) => (r <= 1 ? 0 : r - 1)), 1000);
    return () => clearInterval(t);
  }, [reserved]);

  const timerTone = remaining <= 15 ? 'text-amber-700' : 'text-slate-500';
  const timerLabel = remaining <= 15 ? `Releasing soon · ${remaining}s` : `Reserved to you · ${remaining}s`;

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-3xl">
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
            <div className="flex items-center gap-2 min-w-0">
              <CircleDot className="h-3.5 w-3.5 text-emerald-700" />
              <span className="text-sm font-semibold text-emerald-900">Open Lead Pool</span>
              <span className="text-xs text-slate-600">
                Leads are assigned one at a time.
              </span>
              {reserved ? (
                <span className={`inline-flex items-center gap-1 text-xs font-medium ${timerTone}`}>
                  <Clock className="h-3 w-3" /> {timerLabel}
                </span>
              ) : (
                <span className="text-xs text-slate-600">· 3 available</span>
              )}
            </div>
            <button
              type="button"
              onClick={() => setReserved(true)}
              disabled={reserved}
              className="inline-flex items-center gap-2 h-8 px-3 rounded-md text-sm font-semibold text-white bg-emerald-700 hover:bg-emerald-800 disabled:opacity-60"
            >
              {reserved ? 'Working a lead' : 'Take Next Lead'}
            </button>
          </div>

          {/* Mock leads table */}
          <div className="rounded-md border border-border overflow-hidden text-xs">
            <div className="grid grid-cols-[110px_60px_1fr_1fr_140px] bg-muted/40 px-3 py-2 text-[10px] uppercase tracking-wide text-muted-foreground font-semibold">
              <div>Status</div>
              <div>Calls</div>
              <div>Name</div>
              <div>Phone</div>
              <div>Activity</div>
            </div>
            {/* Pinned reserved row */}
            {reserved && (
              <div className="grid grid-cols-[110px_60px_1fr_1fr_140px] px-3 py-2 bg-emerald-50/70 shadow-[inset_4px_0_0_0_theme(colors.emerald.600)] items-center">
                <div>
                  <button type="button" className="inline-flex items-center gap-1 px-1.5 py-0.5 rounded bg-green-100 text-green-800 text-[10px] hover:bg-green-200 border border-green-200">
                    New <ChevronDown className="h-2.5 w-2.5" />
                  </button>
                </div>
                <div className="text-slate-700">0</div>
                <div className="font-medium text-slate-900">John Smith</div>
                <div className="inline-flex items-center gap-1 text-emerald-700 font-mono">
                  <Phone className="h-3 w-3" /> 07123 456 789
                </div>
                <div className={`inline-flex items-center gap-1 font-medium ${timerTone}`}>
                  <Clock className="h-3 w-3" /> {timerLabel}
                </div>
              </div>
            )}
            {/* Ordinary rows */}
            {[
              { name: 'Emma Wilson', phone: '07956 672 174', status: 'Contacted', tone: 'bg-yellow-100 text-yellow-800 border-yellow-200 hover:bg-yellow-200', act: '27 min ago' },
              { name: 'Ravi Patel',  phone: '07811 224 908', status: 'Follow-up', tone: 'bg-blue-100 text-blue-800 border-blue-200 hover:bg-blue-200',   act: '2 h ago' },
            ].map((r) => (
              <div key={r.name} className="grid grid-cols-[110px_60px_1fr_1fr_140px] px-3 py-2 border-t border-border items-center">
                <div>
                  <button type="button" className={`inline-flex items-center gap-1 px-1.5 py-0.5 rounded text-[10px] border ${r.tone}`}>
                    {r.status} <ChevronDown className="h-2.5 w-2.5" />
                  </button>
                </div>
                <div className="text-slate-700">0</div>
                <div className="font-medium text-slate-900">{r.name}</div>
                <div className="inline-flex items-center gap-1 text-slate-600 font-mono">
                  <Phone className="h-3 w-3" /> {r.phone}
                </div>
                <div className="text-slate-500">{r.act}</div>
              </div>
            ))}
          </div>
                <div className="text-slate-700">0</div>
                <div className="font-medium text-slate-900">John Smith</div>
                <div className="inline-flex items-center gap-1 text-emerald-700 font-mono">
                  <Phone className="h-3 w-3" /> 07123 456 789
                </div>
                <div className={`inline-flex items-center gap-1 font-medium ${timerTone}`}>
                  <Clock className="h-3 w-3" /> {timerLabel}
                </div>
              </div>
            )}
            {/* Ordinary rows */}
            {[
              { name: 'Emma Wilson', phone: '07956 672 174', status: 'Contacted', act: '27 min ago' },
              { name: 'Ravi Patel',  phone: '07811 224 908', status: 'Follow-up', act: '2 h ago' },
            ].map((r) => (
              <div key={r.name} className="grid grid-cols-[80px_60px_1fr_1fr_140px] px-3 py-2 border-t border-border items-center">
                <div><span className="inline-block px-1.5 py-0.5 rounded bg-yellow-100 text-yellow-800 text-[10px]">{r.status}</span></div>
                <div className="text-slate-700">0</div>
                <div className="font-medium text-slate-900">{r.name}</div>
                <div className="inline-flex items-center gap-1 text-slate-600 font-mono">
                  <Phone className="h-3 w-3" /> {r.phone}
                </div>
                <div className="text-slate-500">{r.act}</div>
              </div>
            ))}
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
