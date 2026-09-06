import React, { useState } from 'react';
import { ChevronDown, Info, RotateCcw, ShieldCheck, Sliders, Users } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Switch } from '@/components/ui/switch';
import { Badge } from '@/components/ui/badge';
import { cn } from '@/lib/utils';

/**
 * Every timing / frequency variable behind Open Round Robin, in one place so
 * managers can change the rules of the practice run without touching code.
 */
export interface OrrCadenceConfig {
  /** Seconds an agent has to start the first call before the lead moves on. */
  claimWindowSeconds: number;
  /** Calling windows on day one (24h clock). */
  morningStart: number;
  morningEnd: number;
  lunchStart: number;
  lunchEnd: number;
  eveningStart: number;
  eveningEnd: number;
  /** Max dials on day one when the lead arrives before midday. */
  maxDialsFullDay: number;
  /** Max dials when the lead arrives after midday. */
  maxDialsAfterMidday: number;
  /** Hour the lead hands over to Team Green once the day's attempts are used. */
  greenTeamHandoverHour: number;
  /** Days the lead is chased after day one. */
  followUpDays: number;
  /** Max dials a day during the follow-up chase. */
  followUpDailyDials: number;
  /** Unanswered attempts before the lead goes dormant. */
  maxAttempts: number;
  /** When everyone is busy: queue the lead, or keep offering it round the rotation. */
  whenAllBusy: 'queue' | 'keep_offering';
  /** Agents may claim a waiting lead for themselves (manager permission). */
  allowSelfAssign: boolean;
}

export const DEFAULT_ORR_CADENCE: OrrCadenceConfig = {
  claimWindowSeconds: 120,
  morningStart: 9,
  morningEnd: 11,
  lunchStart: 12,
  lunchEnd: 14,
  eveningStart: 17,
  eveningEnd: 18,
  maxDialsFullDay: 3,
  maxDialsAfterMidday: 2,
  greenTeamHandoverHour: 18,
  followUpDays: 7,
  followUpDailyDials: 2,
  maxAttempts: 7,
  whenAllBusy: 'queue',
  allowSelfAssign: false,
};

const NumberField = ({
  label,
  hint,
  value,
  min = 0,
  max = 24,
  onChange,
}: {
  label: string;
  hint?: string;
  value: number;
  min?: number;
  max?: number;
  onChange: (n: number) => void;
}) => (
  <div className="space-y-1">
    <Label className="text-[11px] font-semibold text-foreground">{label}</Label>
    <Input
      type="number"
      className="h-8 text-sm"
      value={value}
      min={min}
      max={max}
      onChange={(e) => {
        const next = Number(e.target.value);
        if (Number.isFinite(next)) onChange(Math.max(min, Math.min(max, next)));
      }}
    />
    {hint && <p className="text-[10px] text-muted-foreground leading-snug">{hint}</p>}
  </div>
);

interface Props {
  config: OrrCadenceConfig;
  onChange: (next: OrrCadenceConfig) => void;
  teamLabel?: string;
}

export const OrrLogicExplainer: React.FC<Props> = ({ config, onChange, teamLabel = 'Team Green' }) => {
  const [open, setOpen] = useState(false);
  const set = <K extends keyof OrrCadenceConfig>(key: K, value: OrrCadenceConfig[K]) =>
    onChange({ ...config, [key]: value });

  return (
    <section className="rounded-xl border border-border bg-card shadow-sm overflow-hidden">
      <button
        type="button"
        onClick={() => setOpen((o) => !o)}
        className="w-full flex items-center justify-between gap-3 px-5 py-4 text-left hover:bg-muted/40 transition-colors"
      >
        <div className="flex items-start gap-3">
          <span className="h-9 w-9 rounded-lg bg-indigo-100 flex items-center justify-center shrink-0">
            <Sliders className="h-4 w-4 text-indigo-600" />
          </span>
          <div>
            <h4 className="text-base font-semibold text-foreground">
              How Open Round Robin works — timing, frequency and who gets the lead
            </h4>
            <p className="text-xs text-muted-foreground">
              Full explanation of the current rules, plus every timing variable you can change for {teamLabel}.
            </p>
          </div>
        </div>
        <ChevronDown className={cn('h-4 w-4 text-muted-foreground shrink-0 transition-transform', open && 'rotate-180')} />
      </button>

      {open && (
        <div className="px-5 pb-5 space-y-5 border-t border-border pt-4">
          {/* Current logic */}
          <div className="rounded-lg border border-blue-200 bg-blue-50/60 p-4 space-y-2">
            <div className="flex items-center gap-2">
              <Info className="h-4 w-4 text-blue-700" />
              <span className="text-sm font-semibold text-blue-900">The current logic, step by step</span>
            </div>
            <ul className="list-disc pl-4 space-y-1.5 text-xs text-blue-900/90 leading-relaxed">
              <li>A new enquiry is offered to the next {teamLabel} agent in the rotation.</li>
              <li>One lead per agent at a time — never a free-for-all.</li>
              <li>The agent has <strong>{config.claimWindowSeconds} seconds</strong> to start the first call. The lead shows as “Held for you”.</li>
              <li>Log a dial inside the window and the lead stays with that agent until an outcome is recorded.</li>
              <li>No dial in the window and the lead passes to the next agent in rotation.</li>
              <li>The rotation never restarts at the top, so nobody gets two in a row while someone waits.</li>
              <li>
                <strong>If every agent is busy</strong> the lead is{' '}
                {config.whenAllBusy === 'queue' ? (
                  <>
                    parked in the open pool queue, oldest first, and released when the first agent frees up.
                  </>
                ) : (
                  <>
                    kept circulating round the rotation until someone frees up.
                  </>
                )}
              </li>
              <li>After <strong>{config.maxAttempts} unanswered offers</strong> the lead keeps cycling through ORR and a manager alert is raised so a human can reassign it.</li>
              <li>At <strong>{String(config.greenTeamHandoverHour).padStart(2, '0')}:00</strong> unworked day-one leads move to Team Green, then chased for <strong>{config.followUpDays} days</strong> with up to <strong>{config.followUpDailyDials} dials a day</strong>.</li>
            </ul>
          </div>

          {/* Self-assign rule */}
          <div className="rounded-lg border border-amber-200 bg-amber-50/60 p-4 space-y-2">
            <div className="flex items-center gap-2 flex-wrap">
              <ShieldCheck className="h-4 w-4 text-amber-700" />
              <span className="text-sm font-semibold text-amber-900">Nobody assigns a lead to themselves</span>
              <Badge variant="outline" className="text-[10px] border-amber-300 text-amber-800">
                {config.allowSelfAssign ? 'Manager permission granted' : 'Blocked by default'}
              </Badge>
            </div>
            <ul className="text-xs text-amber-900/90 leading-relaxed list-disc pl-4 space-y-1">
              <li>An agent can only work a lead the rotation offers to them.</li>
              <li>Agents cannot take a waiting lead for themselves, including leads waiting while everyone is busy.</li>
              <li>Self-claiming is blocked unless a manager switches the permission on, keeping the rotation fair.</li>
            </ul>
            <div className="flex items-center gap-3 pt-1">
              <Switch
                checked={config.allowSelfAssign}
                onCheckedChange={(v) => set('allowSelfAssign', v)}
                id="orr-self-assign"
              />
              <Label htmlFor="orr-self-assign" className="text-xs font-medium text-amber-900">
                Allow agents to claim a waiting lead themselves (manager permission)
              </Label>
            </div>
          </div>

          {/* Variables */}
          <div className="space-y-3">
            <div className="flex items-center justify-between gap-3 flex-wrap">
              <div className="flex items-center gap-2">
                <Users className="h-4 w-4 text-muted-foreground" />
                <span className="text-sm font-semibold text-foreground">Timing &amp; frequency variables</span>
              </div>
              <Button size="sm" variant="outline" onClick={() => onChange(DEFAULT_ORR_CADENCE)}>
                <RotateCcw className="h-3.5 w-3.5 mr-1.5" /> Reset to defaults
              </Button>
            </div>

            <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
              <NumberField
                label="First-call window (seconds)"
                hint="How long a lead is held before it passes on"
                value={config.claimWindowSeconds}
                min={15}
                max={1800}
                onChange={(n) => set('claimWindowSeconds', n)}
              />
              <NumberField label="Morning window starts" value={config.morningStart} onChange={(n) => set('morningStart', n)} />
              <NumberField label="Morning window ends" value={config.morningEnd} onChange={(n) => set('morningEnd', n)} />
              <NumberField label="Lunchtime window starts" value={config.lunchStart} onChange={(n) => set('lunchStart', n)} />
              <NumberField label="Lunchtime window ends" value={config.lunchEnd} onChange={(n) => set('lunchEnd', n)} />
              <NumberField label="End-of-day window starts" value={config.eveningStart} onChange={(n) => set('eveningStart', n)} />
              <NumberField label="End-of-day window ends" value={config.eveningEnd} onChange={(n) => set('eveningEnd', n)} />
              <NumberField
                label="Team Green handover hour"
                hint="When the day's unworked lead moves to Team Green"
                value={config.greenTeamHandoverHour}
                onChange={(n) => set('greenTeamHandoverHour', n)}
              />
              <NumberField
                label="Max dials — lead before midday"
                value={config.maxDialsFullDay}
                min={1}
                max={12}
                onChange={(n) => set('maxDialsFullDay', n)}
              />
              <NumberField
                label="Max dials — lead after midday"
                value={config.maxDialsAfterMidday}
                min={1}
                max={12}
                onChange={(n) => set('maxDialsAfterMidday', n)}
              />
              <NumberField
                label="Follow-up chase (days)"
                value={config.followUpDays}
                min={0}
                max={30}
                onChange={(n) => set('followUpDays', n)}
              />
              <NumberField
                label="Follow-up dials a day"
                value={config.followUpDailyDials}
                min={1}
                max={10}
                onChange={(n) => set('followUpDailyDials', n)}
              />
              <NumberField
                label="Offers before dormant"
                hint="Unanswered offers before the lead stops circulating"
                value={config.maxAttempts}
                min={1}
                max={20}
                onChange={(n) => set('maxAttempts', n)}
              />
            </div>

            <div className="rounded-lg border border-border bg-muted/40 p-3 space-y-2">
              <span className="text-xs font-semibold text-foreground">When every agent is busy</span>
              <div className="flex flex-wrap gap-2">
                {([
                  { key: 'queue' as const, label: 'Park in the queue (oldest first)' },
                  { key: 'keep_offering' as const, label: 'Keep offering round the rotation' },
                ]).map((option) => (
                  <button
                    key={option.key}
                    type="button"
                    onClick={() => set('whenAllBusy', option.key)}
                    className={cn(
                      'rounded-full border px-3 py-1.5 text-xs font-medium transition-colors',
                      config.whenAllBusy === option.key
                        ? 'bg-primary text-primary-foreground border-primary'
                        : 'bg-background text-muted-foreground border-border hover:bg-muted',
                    )}
                  >
                    {option.label}
                  </button>
                ))}
              </div>
            </div>

            <p className="text-[11px] text-muted-foreground">
              Changes apply to this practice run only — no live lead, agent figure or customer is affected.
            </p>
          </div>
        </div>
      )}
    </section>
  );
};

export default OrrLogicExplainer;
