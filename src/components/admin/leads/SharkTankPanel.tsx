import { useState } from 'react';
import { AlertTriangle, ChevronDown, ChevronUp, Fish } from 'lucide-react';
import { Switch } from '@/components/ui/switch';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { useSharkTankSettings, useSharkTankCounts } from '@/hooks/useSharkTank';
import { useAgentTeams } from '@/hooks/useAgentTeams';

export function SharkTankPanel() {
  const { settings, loading, save } = useSharkTankSettings();
  const { allTeams } = useAgentTeams();
  const counts = useSharkTankCounts();
  const [open, setOpen] = useState(false);
  const [holdS, setHoldS] = useState<number | null>(null);
  const [retryM, setRetryM] = useState<number | null>(null);
  const [chaseM, setChaseM] = useState<number | null>(null);

  const toggleTeam = (id: string) => {
    const has = settings.team_ids.includes(id);
    save({ team_ids: has ? settings.team_ids.filter(t => t !== id) : [...settings.team_ids, id] });
  };

  return (
    <section className="rounded-lg border border-border bg-card shadow-sm">
      <button
        type="button"
        onClick={() => setOpen(o => !o)}
        className="w-full flex items-center justify-between gap-3 px-5 py-4 text-left"
      >
        <div className="flex items-center gap-2 min-w-0">
          <Fish className="h-4 w-4 text-muted-foreground shrink-0" />
          <div className="min-w-0">
            <div className="flex items-center gap-2 flex-wrap">
              <h2 className="text-base font-semibold text-foreground">Shark Tank</h2>
              <Badge variant="outline" className="text-[10px] uppercase tracking-wide">Experimental</Badge>
              {settings.enabled
                ? <Badge className="bg-green-600 hover:bg-green-600">Live</Badge>
                : <Badge variant="secondary">Off</Badge>}
              {settings.enabled && settings.dry_run && (
                <Badge variant="outline" className="border-amber-400 text-amber-700">Dry run</Badge>
              )}
            </div>
            <p className="text-sm text-muted-foreground mt-0.5">
              First-come-first-serve claim pool. Not round robin. Agents click Take Next Lead; the system locks a lead, reveals the phone, and requires them to log the outcome.
            </p>
          </div>
        </div>
        {open ? <ChevronUp className="h-5 w-5 text-muted-foreground shrink-0" /> : <ChevronDown className="h-5 w-5 text-muted-foreground shrink-0" />}
      </button>

      {open && (
        <div className="px-5 pb-5 border-t border-border pt-4 space-y-5">
          <div className="flex items-start gap-2 px-3 py-2 rounded-md bg-amber-50 dark:bg-amber-950/30 border border-amber-300 text-amber-900 dark:text-amber-200">
            <AlertTriangle className="h-4 w-4 mt-0.5 shrink-0" />
            <p className="text-xs">
              This changes how leads are distributed. Ships <b>OFF by default</b>. Turn on Dry run for one team first — the pool populates and audits, but round robin keeps assigning leads normally. Only flip Live once you have compared time-to-first-call for a week.
            </p>
          </div>

          {/* Master switches */}
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <div className="flex items-center justify-between rounded-md border border-border px-4 py-3">
              <div>
                <div className="text-sm font-medium">Master switch</div>
                <div className="text-xs text-muted-foreground">Off = system does nothing at all.</div>
              </div>
              <Switch disabled={loading} checked={settings.enabled} onCheckedChange={v => save({ enabled: v })} />
            </div>
            <div className="flex items-center justify-between rounded-md border border-border px-4 py-3">
              <div>
                <div className="text-sm font-medium">Dry run mode</div>
                <div className="text-xs text-muted-foreground">Pool + audit populate, round robin still runs.</div>
              </div>
              <Switch disabled={loading || !settings.enabled} checked={settings.dry_run} onCheckedChange={v => save({ dry_run: v })} />
            </div>
          </div>

          {/* Teams opted in */}
          <div>
            <div className="text-sm font-medium mb-2">Teams participating</div>
            <div className="flex flex-wrap gap-2">
              {allTeams.length === 0 && <div className="text-xs text-muted-foreground">No teams configured yet.</div>}
              {allTeams.map(t => {
                const on = settings.team_ids.includes(t.id);
                return (
                  <button
                    key={t.id}
                    type="button"
                    onClick={() => toggleTeam(t.id)}
                    className={`px-3 py-1.5 rounded-full text-xs font-medium border transition-colors ${
                      on
                        ? 'bg-primary text-primary-foreground border-primary'
                        : 'bg-background text-foreground border-border hover:bg-muted'
                    }`}
                  >
                    {t.name}
                  </button>
                );
              })}
            </div>
          </div>

          {/* Timers */}
          <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
            <div>
              <Label htmlFor="hold_seconds" className="text-xs">Call-start timer (seconds)</Label>
              <div className="flex gap-2 mt-1">
                <Input id="hold_seconds" type="number" min={15} max={300}
                  value={holdS ?? settings.hold_seconds}
                  onChange={e => setHoldS(Number(e.target.value))}/>
                <Button size="sm" variant="secondary" onClick={() => holdS != null && save({ hold_seconds: holdS })}>Save</Button>
              </div>
            </div>
            <div>
              <Label htmlFor="retry_minutes" className="text-xs">Protected retry window (min)</Label>
              <div className="flex gap-2 mt-1">
                <Input id="retry_minutes" type="number" min={1} max={120}
                  value={retryM ?? settings.retry_minutes}
                  onChange={e => setRetryM(Number(e.target.value))}/>
                <Button size="sm" variant="secondary" onClick={() => retryM != null && save({ retry_minutes: retryM })}>Save</Button>
              </div>
            </div>
            <div>
              <Label htmlFor="chase_minutes" className="text-xs">Chase lock before pool (min)</Label>
              <div className="flex gap-2 mt-1">
                <Input id="chase_minutes" type="number" min={5} max={1440}
                  value={chaseM ?? settings.chase_minutes}
                  onChange={e => setChaseM(Number(e.target.value))}/>
                <Button size="sm" variant="secondary" onClick={() => chaseM != null && save({ chase_minutes: chaseM })}>Save</Button>
              </div>
            </div>
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
            Rules: one active hold per agent · phone hidden until Take · no-answer gets one protected {settings.retry_minutes}-min retry, then locked {settings.chase_minutes} min · ownership only after answered + logged next action + call recording reference · every action written to <code>shark_tank_audit</code>. Terminal leads (lost, converted, fake) never enter the pool.
          </div>
        </div>
      )}
    </section>
  );
}
