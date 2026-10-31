import React, { useState } from 'react';
import { ChevronDown, Clock, Info, RotateCcw, ShieldCheck, Sliders, Users } from 'lucide-react';
import {
  DEFAULT_RELEASE_DAYS,
  DEFAULT_RELEASE_TIMES,
  describeReleaseTimes,
  maxReleases,
  sanitiseReleaseTimes,
} from '@/lib/orrPractice/releaseSchedule';
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
  /** Unanswered attempts before a manager alert is raised. */
  maxAttempts: number;
  /** When everyone is busy: queue the lead, or keep offering it round the rotation. */
  whenAllBusy: 'queue' | 'keep_offering';
  /** Agents may claim a waiting lead for themselves (manager permission). */
  allowSelfAssign: boolean;
  /** Uncontacted-lead release times, "HH:MM" UK time. */
  releaseTimes: string[];
  /** Contact days the release schedule runs for. */
  releaseDays: number;
  /** Staff a manager has blocked from Open Round Robin. */
  blockedAgentIds: string[];
  /** Hold agents out of new ORR leads after sale-free working days. */
  noSaleBlockEnabled: boolean;
  /** Calendar days a new starter is exempt from the no-sale block. */
  newStarterGraceDays: number;
  /** Cap on the no-sale block ladder (1 day out per sale-free day, up to this). */
  maxNoSaleBlockDays: number;
  /** Minutes of break before unworked claimed leads return to the queue (no penalty). */
  breakGraceMinutes: number;
  /** Verified inactivity events in 5 days that flag a manager review. */
  inactivityReviewThreshold: number;
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
  followUpDays: DEFAULT_RELEASE_DAYS,
  followUpDailyDials: DEFAULT_RELEASE_TIMES.length,
  maxAttempts: 7,
  whenAllBusy: 'queue',
  allowSelfAssign: false,
  releaseTimes: DEFAULT_RELEASE_TIMES,
  releaseDays: DEFAULT_RELEASE_DAYS,
  blockedAgentIds: [],
  noSaleBlockEnabled: true,
  newStarterGraceDays: 14,
  maxNoSaleBlockDays: 3,
  breakGraceMinutes: 60,
  inactivityReviewThreshold: 3,
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
  staff?: { id: string; name: string }[];
}

export const OrrLogicExplainer: React.FC<Props> = ({ config, onChange, teamLabel = 'Team Green', staff = [] }) => {
  const [open, setOpen] = useState(false);
  const [timesDraft, setTimesDraft] = useState(config.releaseTimes.join(', '));
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
              <li>An uncontacted lead is released at <strong>{describeReleaseTimes(config)}</strong> UK time for <strong>{config.releaseDays} days</strong> — at most <strong>{maxReleases(config)} releases</strong>. A release is a chance to allocate, not permission to call.</li>
              <li>
                <strong>No-sale block:</strong> an agent with no confirmed sale for 1 working day is held out of new leads for 1 day, 2 days = 2 out, 3 days = 3 out. The block never grows past <strong>{config.maxNoSaleBlockDays} days</strong> — at that point the agent is flagged for a management review instead. Any confirmed sale resets the count to zero, and new starters are exempt for their first <strong>{config.newStarterGraceDays} days</strong>. Sundays and recorded days off never count.
              </li>
            </ul>
          </div>

          {/* Release schedule — manager editable */}
          <div className="rounded-lg border border-border bg-muted/40 p-4 space-y-3">
            <div className="flex items-center gap-2 flex-wrap">
              <Clock className="h-4 w-4 text-primary" />
              <span className="text-sm font-semibold text-foreground">Uncontacted lead release schedule</span>
              <Badge variant="outline" className="text-[10px]">{maxReleases(config)} releases maximum</Badge>
            </div>
            <ul className="text-xs text-muted-foreground list-disc pl-4 space-y-1">
              <li>Chasing stops at once after a genuine two-way conversation; the lead stays with that salesperson for normal follow-up.</li>
              <li>Voicemail, no answer, engaged or a failed dial is not contact. A refusal or do-not-call request stops chasing straight away.</li>
              <li>Before each release the lead must still be uncontacted, unconverted, eligible and legally callable. Call counts across all staff are never reset.</li>
            </ul>
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
              <div className="space-y-1">
                <Label className="text-[11px] font-semibold text-foreground">Release times (UK, comma separated)</Label>
                <Input
                  className="h-8 text-sm"
                  value={timesDraft}
                  onChange={(e) => setTimesDraft(e.target.value)}
                  onBlur={() => {
                    const next = sanitiseReleaseTimes(timesDraft.split(','));
                    const times = next.length ? next : config.releaseTimes;
                    setTimesDraft(times.join(', '));
                    set('releaseTimes', times);
                  }}
                />
                <p className="text-[10px] text-muted-foreground">For example 09:00, 12:00, 14:30, 17:00</p>
              </div>
              <NumberField
                label="Release days"
                value={config.releaseDays}
                min={1}
                max={30}
                onChange={(n) => set('releaseDays', n)}
              />
            </div>
          </div>

          {/* Staff allowed in ORR */}
          {staff.length > 0 && (
            <div className="rounded-lg border border-border bg-card p-4 space-y-2">
              <div className="flex items-center gap-2">
                <Users className="h-4 w-4 text-primary" />
                <span className="text-sm font-semibold text-foreground">Staff allowed to use Open Round Robin</span>
              </div>
              <p className="text-xs text-muted-foreground">Switch someone off to block them; they are skipped by the rotation until switched back on.</p>
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
                {staff.map((s) => {
                  const allowed = !config.blockedAgentIds.includes(s.id);
                  return (
                    <label key={s.id} className="flex items-center justify-between gap-2 rounded-md border border-border px-3 py-1.5 text-xs">
                      <span className="text-foreground">{s.name}</span>
                      <span className="flex items-center gap-2">
                        <span className={allowed ? 'text-foreground' : 'text-destructive'}>{allowed ? 'Allowed' : 'Blocked'}</span>
                        <Switch
                          checked={allowed}
                          onCheckedChange={(v) =>
                            set(
                              'blockedAgentIds',
                              v ? config.blockedAgentIds.filter((id) => id !== s.id) : [...config.blockedAgentIds, s.id],
                            )
                          }
                        />
                      </span>
                    </label>
                  );
                })}
              </div>
            </div>
          )}

          {/* No-sale block ladder */}
          <div className="rounded-lg border border-border bg-muted/40 p-4 space-y-3">
            <div className="flex items-center gap-2 flex-wrap">
              <ShieldCheck className="h-4 w-4 text-primary" />
              <span className="text-sm font-semibold text-foreground">No-sale block ladder</span>
              <Badge variant="outline" className="text-[10px]">
                {config.noSaleBlockEnabled ? `On — capped at ${config.maxNoSaleBlockDays} days` : 'Off'}
              </Badge>
            </div>
            <ul className="text-xs text-muted-foreground list-disc pl-4 space-y-1">
              <li>1 sale-free working day = 1 day out of new leads, 2 = 2, 3 = 3. The block never grows past the cap — the agent is flagged for a management review instead.</li>
              <li>Any confirmed sale resets the count to zero and releases the agent immediately.</li>
              <li>Only working days count (Monday to Saturday). Sundays, holidays and recorded days off never count as sale-free.</li>
            </ul>
            <div className="flex items-center gap-3">
              <Switch
                id="orr-no-sale-block"
                checked={config.noSaleBlockEnabled}
                onCheckedChange={(v) => set('noSaleBlockEnabled', v)}
              />
              <Label htmlFor="orr-no-sale-block" className="text-xs font-medium text-foreground">
                Hold agents out of new leads after sale-free days
              </Label>
            </div>
            {config.noSaleBlockEnabled && (
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                <NumberField
                  label="Block cap (days)"
                  hint="Longest an agent can be held out before a management review"
                  value={config.maxNoSaleBlockDays}
                  min={1}
                  max={7}
                  onChange={(n) => set('maxNoSaleBlockDays', n)}
                />
                <NumberField
                  label="New-starter grace (days)"
                  hint="How long a new starter is exempt from the block"
                  value={config.newStarterGraceDays}
                  min={0}
                  max={60}
                  onChange={(n) => set('newStarterGraceDays', n)}
                />
              </div>
            )}
          </div>

          {/* Availability & inactivity rules */}
          <div className="rounded-lg border border-border bg-muted/40 p-4 space-y-3">
            <div className="flex items-center gap-2 flex-wrap">
              <Clock className="h-4 w-4 text-primary" />
              <span className="text-sm font-semibold text-foreground">Availability &amp; inactivity rules</span>
              <Badge variant="outline" className="text-[10px]">No penalties for not claiming</Badge>
            </div>
            <ul className="text-xs text-muted-foreground list-disc pl-4 space-y-1">
              <li>Claiming is voluntary — an agent who does not click Claim never receives an inactivity strike.</li>
              <li>When the phone system shows an active call, the agent is set to Busy: no new leads offered, claim timers pause, no strikes. Their previous status returns when the call ends, unless they chose Break or Offline.</li>
              <li>On Break: no claim opportunities and no allocations. Unworked claimed leads return to the queue after the grace period below — with no penalty. Ownership and scheduled callbacks are preserved.</li>
              <li>An inactivity event is only recorded when the agent deliberately claimed the lead, was available, did nothing in the allowed period, and was not on a call, break, legitimate exception or hit by a technical failure.</li>
              <li>One event recycles the lead — never an automatic block. Repeated verified neglect flags a manager review and can restrict new claims.</li>
              <li>When real phone status is unavailable, nobody is assumed idle — a manual Busy status and manager corrections are allowed.</li>
            </ul>
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
              <NumberField
                label="Break grace (minutes)"
                hint="Break length before unworked claimed leads return to the queue"
                value={config.breakGraceMinutes}
                min={5}
                max={480}
                onChange={(n) => set('breakGraceMinutes', n)}
              />
              <NumberField
                label="Events before manager review"
                hint="Verified inactivity events in 5 days that flag a review"
                value={config.inactivityReviewThreshold}
                min={2}
                max={20}
                onChange={(n) => set('inactivityReviewThreshold', n)}
              />
            </div>
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
                label="Offers before manager alert"
                hint="Unanswered offers before a manager alert is raised"
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
