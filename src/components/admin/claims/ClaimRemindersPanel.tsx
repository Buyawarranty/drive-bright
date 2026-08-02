import React, { useMemo, useState } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { Badge } from '@/components/ui/badge';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import {
  Bell, BellOff, AlarmClock, Check, Trash2, Plus, Clock, RotateCcw, Volume2, VolumeX,
} from 'lucide-react';
import { format, formatDistanceToNowStrict, isPast } from 'date-fns';
import {
  useClaimReminders, LEAD_TIME_OPTIONS, KIND_LABELS, ReminderKind, isReminderShowing, ClaimReminder,
} from '@/hooks/useClaimReminders';
import { isAlertsMuted, muteAlertsFor, unmuteAlerts, subscribeAlertsMuted } from '@/lib/alertSoundPreference';
import { toast } from 'sonner';

interface ClaimOption {
  id: string;
  name?: string | null;
  vehicle_registration?: string | null;
}

interface Props {
  claims?: ClaimOption[];
}

const kindTone: Record<string, string> = {
  claim: 'bg-orange-100 text-orange-800 border-orange-300',
  mediation: 'bg-violet-100 text-violet-800 border-violet-300',
  appeal: 'bg-sky-100 text-sky-800 border-sky-300',
  other: 'bg-slate-100 text-slate-800 border-slate-300',
};

const labelFor = (c: ClaimOption) =>
  `${c.name || 'Unnamed'}${c.vehicle_registration ? ` · ${c.vehicle_registration}` : ''}`;

/** Local datetime string (yyyy-MM-ddTHH:mm) for the datetime-local input. */
const toLocalInput = (d: Date) => format(d, "yyyy-MM-dd'T'HH:mm");

export const ClaimRemindersPanel: React.FC<Props> = ({ claims = [] }) => {
  const {
    active, done, loading, create, snoozeOneDay, unsnooze, toggleMute, complete, reopen, remove,
  } = useClaimReminders();

  const [kind, setKind] = useState<ReminderKind>('claim');
  const [title, setTitle] = useState('');
  const [notes, setNotes] = useState('');
  const [claimId, setClaimId] = useState<string>('none');
  const [dueLocal, setDueLocal] = useState(() => {
    const d = new Date();
    d.setDate(d.getDate() + 1);
    d.setMinutes(0, 0, 0);
    return toLocalInput(d);
  });
  const [leadTime, setLeadTime] = useState(1440);
  const [saving, setSaving] = useState(false);
  const [soundMuted, setSoundMuted] = useState(isAlertsMuted());

  React.useEffect(() => subscribeAlertsMuted(() => setSoundMuted(isAlertsMuted())), []);

  const claimLabels = useMemo(() => {
    const map: Record<string, string> = {};
    claims.forEach(c => { map[c.id] = labelFor(c); });
    return map;
  }, [claims]);

  const handleSave = async () => {
    if (!title.trim()) { toast.error('Give the reminder a title'); return; }
    if (!dueLocal) { toast.error('Pick a date and time'); return; }
    setSaving(true);
    const ok = await create({
      reminder_kind: kind,
      title,
      notes,
      claim_id: claimId === 'none' ? null : claimId,
      due_at: new Date(dueLocal).toISOString(),
      lead_time_minutes: leadTime,
    });
    setSaving(false);
    if (ok) { setTitle(''); setNotes(''); setClaimId('none'); }
  };

  const renderRow = (r: ClaimReminder, isDone = false) => {
    const due = new Date(r.due_at);
    const overdue = !isDone && isPast(due);
    const showing = isReminderShowing(r);
    const snoozed = r.snoozed_until && new Date(r.snoozed_until).getTime() > Date.now();

    return (
      <div key={r.id} className="flex flex-wrap items-center gap-2 sm:gap-3 p-3 rounded-lg border bg-card">
        <Badge variant="outline" className={`${kindTone[r.reminder_kind] || kindTone.other} text-[11px] shrink-0`}>
          {KIND_LABELS[r.reminder_kind] ?? 'Reminder'}
        </Badge>

        <div className="min-w-0 flex-1">
          <p className={`text-sm font-semibold truncate ${isDone ? 'line-through text-muted-foreground' : ''}`}>
            {r.title}
          </p>
          <p className="text-xs text-muted-foreground flex flex-wrap items-center gap-1.5">
            <Clock className="h-3 w-3 shrink-0" />
            {format(due, 'EEE d MMM yyyy, HH:mm')}
            {!isDone && (
              <span className={overdue ? 'text-destructive font-medium' : ''}>
                ({overdue ? `${formatDistanceToNowStrict(due)} overdue` : `in ${formatDistanceToNowStrict(due)}`})
              </span>
            )}
            <span>· banner {LEAD_TIME_OPTIONS.find(o => o.value === r.lead_time_minutes)?.label ?? `${r.lead_time_minutes} min before`}</span>
            {r.claim_id && claimLabels[r.claim_id] && <span className="truncate">· {claimLabels[r.claim_id]}</span>}
          </p>
          {r.notes && <p className="text-xs text-muted-foreground mt-0.5 line-clamp-2">{r.notes}</p>}
        </div>

        <div className="flex items-center gap-1.5 shrink-0">
          {!isDone && showing && <Badge className="bg-orange-500 text-white">Showing now</Badge>}
          {!isDone && snoozed && (
            <Badge variant="outline" className="text-[11px]">
              Delayed to {format(new Date(r.snoozed_until!), 'd MMM HH:mm')}
            </Badge>
          )}
          {!isDone && (
            <>
              <Button variant="outline" size="sm" onClick={() => snoozeOneDay(r)}>
                <AlarmClock className="h-3.5 w-3.5 mr-1" /> Delay 1 day
              </Button>
              {snoozed && (
                <Button variant="ghost" size="sm" onClick={() => unsnooze(r)} title="Cancel the delay">
                  <RotateCcw className="h-3.5 w-3.5" />
                </Button>
              )}
              <Button
                variant="outline"
                size="sm"
                onClick={() => toggleMute(r)}
                title={r.is_muted ? 'Unmute this reminder' : 'Mute this reminder'}
              >
                {r.is_muted ? <BellOff className="h-3.5 w-3.5" /> : <Bell className="h-3.5 w-3.5" />}
              </Button>
              <Button size="sm" onClick={() => complete(r)}>
                <Check className="h-3.5 w-3.5 mr-1" /> Done
              </Button>
            </>
          )}
          {isDone && (
            <Button variant="outline" size="sm" onClick={() => reopen(r)}>
              <RotateCcw className="h-3.5 w-3.5 mr-1" /> Reopen
            </Button>
          )}
          <Button variant="ghost" size="sm" onClick={() => remove(r.id)} title="Delete reminder">
            <Trash2 className="h-3.5 w-3.5 text-destructive" />
          </Button>
        </div>
      </div>
    );
  };

  return (
    <div className="space-y-5">
      <Card>
        <CardHeader className="pb-3">
          <div className="flex flex-wrap items-center justify-between gap-2">
            <CardTitle className="text-base flex items-center gap-2">
              <Plus className="h-4 w-4 text-orange-600" /> Set a reminder
            </CardTitle>
            <Button
              variant="outline"
              size="sm"
              onClick={() => (soundMuted ? unmuteAlerts() : muteAlertsFor(Infinity))}
            >
              {soundMuted ? <VolumeX className="h-3.5 w-3.5 mr-1" /> : <Volume2 className="h-3.5 w-3.5 mr-1" />}
              {soundMuted ? 'Alert sounds off' : 'Alert sounds on'}
            </Button>
          </div>
          <p className="text-xs text-muted-foreground">
            Choose when it's due and how early the banner should appear at the top of the Claims tab.
            You can delay any reminder a day at a time or mute its sound.
          </p>
        </CardHeader>
        <CardContent className="space-y-3">
          <div className="grid grid-cols-1 md:grid-cols-4 gap-3">
            <div>
              <Label className="text-xs">What is it for?</Label>
              <Select value={kind} onValueChange={v => setKind(v as ReminderKind)}>
                <SelectTrigger><SelectValue /></SelectTrigger>
                <SelectContent>
                  {(Object.keys(KIND_LABELS) as ReminderKind[]).map(k => (
                    <SelectItem key={k} value={k}>{KIND_LABELS[k]}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div className="md:col-span-2">
              <Label className="text-xs" htmlFor="reminder-title">Reminder</Label>
              <Input
                id="reminder-title"
                value={title}
                onChange={e => setTitle(e.target.value)}
                placeholder="e.g. Chase garage for mediation paperwork"
              />
            </div>
            <div>
              <Label className="text-xs">Link to a claim (optional)</Label>
              <Select value={claimId} onValueChange={setClaimId}>
                <SelectTrigger><SelectValue placeholder="No claim" /></SelectTrigger>
                <SelectContent className="max-h-72">
                  <SelectItem value="none">No claim</SelectItem>
                  {claims.slice(0, 300).map(c => (
                    <SelectItem key={c.id} value={c.id}>{labelFor(c)}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-4 gap-3">
            <div>
              <Label className="text-xs" htmlFor="reminder-due">Due date &amp; time</Label>
              <Input
                id="reminder-due"
                type="datetime-local"
                value={dueLocal}
                onChange={e => setDueLocal(e.target.value)}
              />
            </div>
            <div>
              <Label className="text-xs">Remind me</Label>
              <Select value={String(leadTime)} onValueChange={v => setLeadTime(Number(v))}>
                <SelectTrigger><SelectValue /></SelectTrigger>
                <SelectContent>
                  {LEAD_TIME_OPTIONS.map(o => (
                    <SelectItem key={o.value} value={String(o.value)}>{o.label}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div className="md:col-span-2">
              <Label className="text-xs" htmlFor="reminder-notes">Notes (optional)</Label>
              <Textarea
                id="reminder-notes"
                rows={1}
                value={notes}
                onChange={e => setNotes(e.target.value)}
                placeholder="Anything the team should know"
              />
            </div>
          </div>

          <div className="flex justify-end">
            <Button onClick={handleSave} disabled={saving}>
              <Plus className="h-4 w-4 mr-1" /> {saving ? 'Saving…' : 'Set reminder'}
            </Button>
          </div>
        </CardContent>
      </Card>

      <Card>
        <CardHeader className="pb-3">
          <CardTitle className="text-base flex items-center gap-2">
            <Bell className="h-4 w-4 text-orange-600" /> Upcoming reminders
            <Badge variant="outline">{active.length}</Badge>
          </CardTitle>
        </CardHeader>
        <CardContent className="space-y-2">
          {loading ? (
            <p className="text-sm text-muted-foreground">Loading reminders…</p>
          ) : active.length === 0 ? (
            <p className="text-sm text-muted-foreground">No reminders set yet.</p>
          ) : (
            active.map(r => renderRow(r))
          )}
        </CardContent>
      </Card>

      {done.length > 0 && (
        <Card>
          <CardHeader className="pb-3">
            <CardTitle className="text-base flex items-center gap-2">
              <Check className="h-4 w-4 text-emerald-600" /> Completed
              <Badge variant="outline">{done.length}</Badge>
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-2">
            {done.slice(0, 25).map(r => renderRow(r, true))}
          </CardContent>
        </Card>
      )}
    </div>
  );
};

export default ClaimRemindersPanel;
