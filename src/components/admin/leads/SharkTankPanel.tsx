import { useState } from 'react';
import { AlertTriangle, CheckCircle2, Eye, CircleDot, Power, PlayCircle, Loader2 } from 'lucide-react';
import { SharkTankPreviewDialog } from './SharkTankPreviewDialog';

import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { useSharkTankSettings, useSharkTankCounts } from '@/hooks/useSharkTank';
import { useAgentTeams } from '@/hooks/useAgentTeams';
import { supabase } from '@/integrations/supabase/client';
import { toast } from 'sonner';

export function SharkTankPanel() {
  const { settings, loading, save } = useSharkTankSettings();
  const { allTeams } = useAgentTeams();
  const counts = useSharkTankCounts();
  const [holdS, setHoldS] = useState<number | null>(null);
  const [retryM, setRetryM] = useState<number | null>(null);
  const [chaseM, setChaseM] = useState<number | null>(null);
  const [previewOpen, setPreviewOpen] = useState(false);
  const [selfTestRunning, setSelfTestRunning] = useState(false);
  const [selfTestResult, setSelfTestResult] = useState<null | { ok: boolean; checks: Array<{ name: string; ok: boolean; detail?: string }> }>(null);

  const runSelfTest = async () => {
    setSelfTestRunning(true);
    setSelfTestResult(null);
    try {
      const { data, error } = await supabase.functions.invoke('shark-tank-selftest');
      if (error) throw error;
      setSelfTestResult(data);
      if (data?.ok) toast.success('Open Lead Pool self-check passed');
      else toast.error('Open Lead Pool self-check found issues');
    } catch (e: any) {
      toast.error(`Self-check failed: ${e.message ?? e}`);
      setSelfTestResult({ ok: false, checks: [{ name: 'invoke', ok: false, detail: String(e.message ?? e) }] });
    } finally {
      setSelfTestRunning(false);
    }
  };

  // Access to the pool is now controlled per-agent (in the allocation matrix below).
  // We keep team_ids populated with every team so the server-side gate is a no-op —
  // whether an agent actually gets pool leads is decided by their Round Robin / Open Pool
  // toggle on their row.
  const handleEnableToggle = () => {
    const nextEnabled = !settings.enabled;
    const patch: any = { enabled: nextEnabled };
    if (nextEnabled) patch.team_ids = allTeams.map(t => t.id);
    save(patch);
  };

  const enabled = settings.enabled;

  return (
    <section className={`rounded-lg border-2 bg-card shadow-sm transition-colors ${enabled ? 'border-green-500' : 'border-border'}`}>
      {/* Header with prominent on/off */}
      <div className="flex items-start justify-between gap-4 px-5 py-4 border-b border-border">
        <div className="flex items-start gap-2 min-w-0">
          <CircleDot className="h-4 w-4 text-emerald-700 shrink-0 mt-1" />
          <div className="min-w-0">
            <div className="flex items-center gap-2 flex-wrap">
              <h2 className="text-base font-semibold text-foreground">Open Lead Pool</h2>
              <Badge variant="outline" className="text-[10px] uppercase tracking-wide">Experimental</Badge>
              {/* Single state pill — replaces the old Active + Dry-run badges */}
              {enabled ? (
                settings.dry_run ? (
                  <Badge variant="outline" className="border-amber-400 text-amber-700">
                    On · Dry run
                  </Badge>
                ) : (
                  <span className="inline-flex items-center gap-1 text-green-700 text-xs font-semibold">
                    <CheckCircle2 className="h-4 w-4" /> On · Live
                  </span>
                )
              ) : (
                <Badge variant="outline" className="text-muted-foreground">Off</Badge>
              )}
            </div>
            <p className="text-sm text-muted-foreground mt-0.5">
              First-come-first-serve open lead pool. Not round robin. Agents click Take Next Lead; the system locks a lead, reveals the phone, and requires them to log the outcome.
            </p>
          </div>
        </div>

        <div className="flex items-center gap-2 shrink-0">
          <button
            type="button"
            onClick={() => setPreviewOpen(true)}
            className="inline-flex items-center gap-2 h-11 px-4 rounded-md font-medium text-sm border-2 border-primary/40 text-primary bg-primary/5 hover:bg-primary/10 transition-colors"
          >
            <Eye className="h-4 w-4" />
            Preview agent view
          </button>
          {/* Big clear ON/OFF button */}
          <button
            type="button"
            disabled={loading}
            onClick={handleEnableToggle}
            className={`inline-flex items-center gap-2 h-11 px-5 rounded-md font-semibold text-sm border-2 transition-colors ${
              enabled
                ? 'bg-green-600 text-white border-green-700 hover:bg-green-700'
                : 'bg-muted text-foreground border-border hover:bg-muted/70'
            } disabled:opacity-60`}
            aria-pressed={enabled}
          >
            <Power className="h-4 w-4" />
            {enabled ? 'ON' : 'OFF'}
          </button>
        </div>
      </div>


      <div className="px-5 pb-5 pt-4 space-y-5">
        <div className="flex items-start gap-2 px-3 py-2 rounded-md bg-amber-50 dark:bg-amber-950/30 border border-amber-300 text-amber-900 dark:text-amber-200">
          <AlertTriangle className="h-4 w-4 mt-0.5 shrink-0" />
          <p className="text-xs">
            This changes how leads are distributed. Ships <b>OFF by default</b>. Turn on Dry run for one team first — the pool populates and audits, but round robin keeps assigning leads normally. Only flip Live once you have compared time-to-first-call for a week.
          </p>
        </div>

        {/* Mode chooser — only meaningful when ON. Replaces the old peer Dry-run switch
            so operators can't be simultaneously "Active" and "Dry run" in a confusing way. */}
        <div className="rounded-md border border-border px-4 py-3">
          <div className="flex items-center justify-between gap-3 flex-wrap">
            <div>
              <div className="text-sm font-medium">Mode</div>
              <div className="text-xs text-muted-foreground">
                {!enabled
                  ? 'Turn the pool ON to choose a mode.'
                  : settings.dry_run
                    ? 'Dry run — pool + audit populate, round robin still assigns real leads.'
                    : 'Live — Take Next actually removes the lead from round robin.'}
              </div>
            </div>
            <div
              role="group"
              aria-label="Pool mode"
              className={`inline-flex rounded-md border border-input bg-background p-0.5 text-xs font-medium ${!enabled ? 'opacity-50' : ''}`}
            >
              <button
                type="button"
                disabled={loading || !enabled}
                onClick={() => save({ dry_run: true })}
                className={`px-3 py-1.5 rounded-sm transition-colors ${
                  settings.dry_run
                    ? 'bg-amber-500 text-white'
                    : 'text-muted-foreground hover:text-foreground'
                } disabled:cursor-not-allowed`}
              >
                Dry run
              </button>
              <button
                type="button"
                disabled={loading || !enabled}
                onClick={() => save({ dry_run: false })}
                className={`px-3 py-1.5 rounded-sm transition-colors ${
                  !settings.dry_run
                    ? 'bg-green-600 text-white'
                    : 'text-muted-foreground hover:text-foreground'
                } disabled:cursor-not-allowed`}
              >
                Live
              </button>
            </div>
          </div>
        </div>

        {/* Self-check — runs the end-to-end test edge function */}
        <div className="rounded-md border border-border px-4 py-3">
          <div className="flex items-center justify-between gap-3 flex-wrap">
            <div>
              <div className="text-sm font-medium">Run self-check</div>
              <div className="text-xs text-muted-foreground">
                Seeds a test lead and verifies Off → Dry run → Live behaviour end-to-end. Safe to run any time; cleans up after itself.
              </div>
            </div>
            <Button
              size="sm"
              variant="secondary"
              onClick={runSelfTest}
              disabled={selfTestRunning}
              className="gap-2"
            >
              {selfTestRunning ? <Loader2 className="h-4 w-4 animate-spin" /> : <PlayCircle className="h-4 w-4" />}
              {selfTestRunning ? 'Running…' : 'Run self-check'}
            </Button>
          </div>
          {selfTestResult && (
            <div className="mt-3 space-y-1">
              <div className={`text-xs font-semibold ${selfTestResult.ok ? 'text-green-700' : 'text-red-700'}`}>
                {selfTestResult.ok ? 'All checks passed' : 'Some checks failed'}
              </div>
              <ul className="text-xs space-y-0.5">
                {selfTestResult.checks.map((c, i) => (
                  <li key={i} className={c.ok ? 'text-green-700' : 'text-red-700'}>
                    {c.ok ? '✓' : '✗'} {c.name}{c.detail ? ` — ${c.detail}` : ''}
                  </li>
                ))}
              </ul>
            </div>
          )}
        </div>

        {/* Per-agent participation notice — replaces the old per-team pills */}
        <div className="rounded-md border border-border bg-muted/30 px-4 py-3">
          <div className="text-sm font-medium">Who joins the pool</div>
          <p className="text-xs text-muted-foreground mt-1">
            Access is set <strong>per agent</strong>, not per team. In the "Who gets the leads?" section below,
            flip each agent's mode to <em>Open Pool</em> to let them self-claim from here, or leave them on
            <em> Round Robin</em> for the classic auto-assignment. You can mix modes across a team.
          </p>
        </div>

        {/* Timers */}
        <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
          {(() => {
            const HOLD_OPTIONS = [30, 60, 90, 120, 180, 240, 300];
            const holdVal = holdS ?? settings.hold_seconds;
            const holdDirty = holdS != null && holdS !== settings.hold_seconds;
            return (
              <div className="space-y-1.5">
                <Label htmlFor="hold_seconds" className="text-xs font-semibold">Call-start timer</Label>
                <div className="flex gap-2">
                  <Select value={String(holdVal)} onValueChange={(v) => setHoldS(Number(v))}>
                    <SelectTrigger id="hold_seconds" className="flex-1">
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      {HOLD_OPTIONS.map(s => (
                        <SelectItem key={s} value={String(s)}>{s < 60 ? `${s} sec` : `${s / 60} min`}</SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                  <Button size="sm" variant={holdDirty ? 'default' : 'secondary'} disabled={!holdDirty}
                    onClick={async () => { if (await save({ hold_seconds: holdS! })) setHoldS(null); }}>
                    Save
                  </Button>
                </div>
                <p className="text-[11px] text-muted-foreground leading-snug">
                  How long an agent has to click <strong>Call</strong> after reserving a lead.
                  If they don't start the call in this time, the lead auto-releases back to the Open Pool for anyone else to take.
                </p>
              </div>
            );
          })()}
          {(() => {
            const RETRY_OPTIONS = [5, 10, 15, 20, 30, 45, 60, 90, 120];
            const retryVal = retryM ?? settings.retry_minutes;
            const retryDirty = retryM != null && retryM !== settings.retry_minutes;
            return (
              <div className="space-y-1.5">
                <Label htmlFor="retry_minutes" className="text-xs font-semibold">Protected retry window (No answer)</Label>
                <div className="flex gap-2">
                  <Select value={String(retryVal)} onValueChange={(v) => setRetryM(Number(v))}>
                    <SelectTrigger id="retry_minutes" className="flex-1">
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      {RETRY_OPTIONS.map(m => (
                        <SelectItem key={m} value={String(m)}>{m} min</SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                  <Button size="sm" variant={retryDirty ? 'default' : 'secondary'} disabled={!retryDirty}
                    onClick={async () => { if (await save({ retry_minutes: retryM! })) setRetryM(null); }}>
                    Save
                  </Button>
                </div>
                <p className="text-[11px] text-muted-foreground leading-snug">
                  After you log <strong>No answer</strong>, the lead is <strong>locked to you</strong> for this long.
                  Only you can call it again during this window. If you don't retry in time, the lead converts to a chase lock (see below) and then returns to the Open Pool for anyone.
                </p>
              </div>
            );
          })()}
          {(() => {
            const CHASE_OPTIONS = [15, 30, 60, 120, 240, 480, 1440];
            const chaseVal = chaseM ?? settings.chase_minutes;
            const chaseDirty = chaseM != null && chaseM !== settings.chase_minutes;
            return (
              <div className="space-y-1.5">
                <Label htmlFor="chase_minutes" className="text-xs font-semibold">Chase lock (Spoken to)</Label>
                <div className="flex gap-2">
                  <Select value={String(chaseVal)} onValueChange={(v) => setChaseM(Number(v))}>
                    <SelectTrigger id="chase_minutes" className="flex-1">
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      {CHASE_OPTIONS.map(m => (
                        <SelectItem key={m} value={String(m)}>{m < 60 ? `${m} min` : m === 1440 ? '24 hours' : `${m / 60} hr`}</SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                  <Button size="sm" variant={chaseDirty ? 'default' : 'secondary'} disabled={!chaseDirty}
                    onClick={async () => { if (await save({ chase_minutes: chaseM! })) setChaseM(null); }}>
                    Save
                  </Button>
                </div>
                <p className="text-[11px] text-muted-foreground leading-snug">
                  After you <strong>Spoke to</strong> the customer and logged a next action (callback, quote sent, appointment), the lead becomes <strong>yours</strong> for this long.
                  No one else can take it. When the lock ends without a further update, it recycles back to the Open Pool.
                </p>
              </div>
            );
          })()}
        </div>


        {/* Live counters */}
        <div>
          <div className="text-sm font-medium mb-2">Live pool status</div>
          <div className="grid grid-cols-2 sm:grid-cols-5 gap-2">
            {(['queued','held','retry_hold','chase_hold','claimed'] as const).map(k => (
              <div key={k} className="rounded-md border border-border bg-muted/40 px-3 py-2 text-center">
                <div className="text-lg font-bold">{counts[k]}</div>
                <div className="text-[10px] uppercase tracking-wide text-muted-foreground">{k.replace('_',' ')}</div>
              </div>
            ))}
          </div>
        </div>

        <div className="text-[11px] text-muted-foreground border-t border-border pt-3">
          Rules: one active hold per agent · phone hidden until Take · no-answer gets one protected {settings.retry_minutes}-min retry, then locked {settings.chase_minutes} min · ownership only after answered + logged next action + call recording reference · every action written to <code>OPEN-POOL_audit</code>. Terminal leads (lost, converted, fake) never enter the pool.
        </div>
      </div>
      <SharkTankPreviewDialog
        open={previewOpen}
        onOpenChange={setPreviewOpen}
        holdSeconds={settings.hold_seconds}
        retryMinutes={settings.retry_minutes}
        chaseMinutes={settings.chase_minutes}
      />
    </section>
  );

}
