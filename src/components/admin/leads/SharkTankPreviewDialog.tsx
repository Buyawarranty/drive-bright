import { useEffect, useState } from 'react';
import { Fish, Phone, Clock, CheckCircle2, PhoneOff, Info } from 'lucide-react';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription } from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';

interface Props {
  open: boolean;
  onOpenChange: (v: boolean) => void;
  holdSeconds: number;
  retryMinutes: number;
  chaseMinutes: number;
}

type Stage = 'idle' | 'held' | 'answered' | 'no_answer' | 'retry' | 'claimed' | 'chase';

export function SharkTankPreviewDialog({ open, onOpenChange, holdSeconds, retryMinutes, chaseMinutes }: Props) {
  const [stage, setStage] = useState<Stage>('idle');
  const [remaining, setRemaining] = useState(holdSeconds);
  const [nextAction, setNextAction] = useState('');
  const [callRef, setCallRef] = useState('');

  useEffect(() => {
    if (!open) {
      setStage('idle');
      setRemaining(holdSeconds);
      setNextAction('');
      setCallRef('');
    }
  }, [open, holdSeconds]);

  useEffect(() => {
    if (stage !== 'held') return;
    setRemaining(holdSeconds);
    const t = setInterval(() => {
      setRemaining(r => {
        if (r <= 1) { clearInterval(t); return 0; }
        return r - 1;
      });
    }, 1000);
    return () => clearInterval(t);
  }, [stage, holdSeconds]);

  const pct = stage === 'held' ? (remaining / holdSeconds) * 100 : 100;

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-2xl">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <Fish className="h-5 w-5 text-primary" /> Agent view preview
          </DialogTitle>
          <DialogDescription>
            This is exactly what agents in a participating team will see above their leads list once you flip Open Lead Pool to ON. Nothing here is live — no leads are locked, no data is written.
          </DialogDescription>
        </DialogHeader>

        <div className="rounded-md border-2 border-dashed border-primary/40 bg-primary/5 p-2">
          <div className="text-[10px] uppercase tracking-wide text-primary font-semibold text-center mb-2">Mock preview — click through the flow</div>

          {/* Simulated agent tray */}
          <div className="rounded-lg border-2 border-green-600 bg-card shadow-sm p-4 space-y-3">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-2">
                <Fish className="h-4 w-4 text-green-700" />
                <span className="font-semibold text-sm">Open Lead Pool</span>
                <Badge className="bg-green-600 hover:bg-green-600">Live</Badge>
              </div>
              <div className="text-xs text-muted-foreground">3 leads waiting</div>
            </div>

            {stage === 'idle' && (
              <div className="flex flex-col items-center gap-2 py-4">
                <p className="text-xs text-muted-foreground">You have no active hold. Grab the next lead in the pool.</p>
                <Button size="lg" className="bg-green-600 hover:bg-green-700 text-white" onClick={() => setStage('held')}>
                  <Phone className="h-4 w-4 mr-2" /> Take Next Lead
                </Button>
                <p className="text-[11px] text-muted-foreground">Phone hidden until you take · one hold at a time</p>
              </div>
            )}

            {stage === 'held' && (
              <div className="space-y-3">
                <div className="rounded-md border border-border p-3 bg-muted/30">
                  <div className="text-[10px] uppercase text-muted-foreground">Lead revealed</div>
                  <div className="font-semibold">John Smith · 2019 Ford Focus</div>
                  <div className="text-sm font-mono text-primary">07123 456 789</div>
                </div>
                <div className="flex items-center gap-2">
                  <Clock className="h-4 w-4 text-red-600" />
                  <div className="flex-1 h-2 rounded-full bg-muted overflow-hidden">
                    <div className="h-full bg-red-500 transition-all" style={{ width: `${pct}%` }} />
                  </div>
                  <span className="text-sm font-mono font-bold text-red-600 w-10 text-right">{remaining}s</span>
                </div>
                <div className="text-xs text-muted-foreground">Log the outcome before the timer runs out or the lead returns to the pool.</div>
                <div className="flex gap-2">
                  <Button size="sm" className="flex-1 bg-green-600 hover:bg-green-700 text-white" onClick={() => setStage('answered')}>
                    <CheckCircle2 className="h-4 w-4 mr-1" /> Answered
                  </Button>
                  <Button size="sm" variant="outline" className="flex-1" onClick={() => setStage('no_answer')}>
                    <PhoneOff className="h-4 w-4 mr-1" /> No answer
                  </Button>
                </div>
              </div>
            )}

            {stage === 'answered' && (
              <div className="space-y-3">
                <div className="text-sm font-medium">Answered — log to claim ownership</div>
                <div>
                  <Label className="text-xs">Next action</Label>
                  <Input value={nextAction} onChange={e => setNextAction(e.target.value)} placeholder="e.g. Callback tomorrow 10am" />
                </div>
                <div>
                  <Label className="text-xs">Call recording reference</Label>
                  <Input value={callRef} onChange={e => setCallRef(e.target.value)} placeholder="e.g. CR-8842" />
                </div>
                <Button
                  size="sm"
                  className="w-full bg-green-600 hover:bg-green-700 text-white"
                  disabled={!nextAction || !callRef}
                  onClick={() => setStage('claimed')}
                >
                  Claim lead
                </Button>
                <p className="text-[11px] text-muted-foreground">Both fields required. Without them the lead returns to the pool.</p>
              </div>
            )}

            {stage === 'no_answer' && (
              <div className="space-y-3">
                <div className="rounded-md bg-amber-50 border border-amber-300 p-3 text-xs text-amber-900">
                  Marked no-answer. You have a protected {retryMinutes}-minute retry window — no other agent can grab this lead.
                </div>
                <Button size="sm" className="w-full" onClick={() => setStage('retry')}>Start retry</Button>
              </div>
            )}

            {stage === 'retry' && (
              <div className="space-y-3">
                <div className="rounded-md border border-border p-3 bg-muted/30">
                  <div className="text-[10px] uppercase text-muted-foreground">Retry (yours only)</div>
                  <div className="font-semibold">John Smith · 2019 Ford Focus</div>
                  <div className="text-sm font-mono text-primary">07123 456 789</div>
                </div>
                <div className="flex gap-2">
                  <Button size="sm" className="flex-1 bg-green-600 hover:bg-green-700 text-white" onClick={() => setStage('answered')}>
                    Answered
                  </Button>
                  <Button size="sm" variant="outline" className="flex-1" onClick={() => setStage('chase')}>
                    No answer again
                  </Button>
                </div>
              </div>
            )}

            {stage === 'chase' && (
              <div className="rounded-md bg-muted/40 border border-border p-3 text-xs space-y-2">
                <div className="font-semibold text-foreground">Chase lock ({chaseMinutes} min)</div>
                <p className="text-muted-foreground">Lead is locked to you for {chaseMinutes} minutes, then returns to the pool for anyone.</p>
                <Button size="sm" variant="ghost" onClick={() => setStage('idle')}>Reset preview</Button>
              </div>
            )}

            {stage === 'claimed' && (
              <div className="rounded-md bg-green-50 border border-green-300 p-3 text-xs space-y-2">
                <div className="flex items-center gap-1 font-semibold text-green-800"><CheckCircle2 className="h-4 w-4" /> Lead claimed</div>
                <p className="text-green-900">You now own this lead. It moves to your normal leads list.</p>
                <Button size="sm" variant="ghost" onClick={() => setStage('idle')}>Reset preview</Button>
              </div>
            )}
          </div>
        </div>

        <div className="flex items-start gap-2 text-xs text-muted-foreground border-t pt-3">
          <Info className="h-3.5 w-3.5 mt-0.5 shrink-0" />
          <span>Management still sees the full configuration panel. This preview only shows the agent-facing tray so you can judge the flow before enabling.</span>
        </div>
      </DialogContent>
    </Dialog>
  );
}
