import React, { useEffect, useRef, useState } from 'react';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Bell, BellOff, Clock, Check, AlarmClock, ChevronDown, ChevronUp, Volume2, VolumeX } from 'lucide-react';
import { format, formatDistanceToNowStrict, isPast } from 'date-fns';
import {
  ClaimReminder,
  KIND_LABELS,
  useClaimReminders,
} from '@/hooks/useClaimReminders';
import { isAlertsMuted, muteAlertsFor, unmuteAlerts, subscribeAlertsMuted } from '@/lib/alertSoundPreference';

/** Short, gentle two-tone chime. */
const playChime = () => {
  try {
    const Ctx = (window as any).AudioContext || (window as any).webkitAudioContext;
    if (!Ctx) return;
    const ctx = new Ctx();
    [880, 1180].forEach((freq, i) => {
      const osc = ctx.createOscillator();
      const gain = ctx.createGain();
      osc.type = 'sine';
      osc.frequency.value = freq;
      gain.gain.setValueAtTime(0.0001, ctx.currentTime + i * 0.18);
      gain.gain.exponentialRampToValueAtTime(0.12, ctx.currentTime + i * 0.18 + 0.02);
      gain.gain.exponentialRampToValueAtTime(0.0001, ctx.currentTime + i * 0.18 + 0.16);
      osc.connect(gain).connect(ctx.destination);
      osc.start(ctx.currentTime + i * 0.18);
      osc.stop(ctx.currentTime + i * 0.18 + 0.18);
    });
    setTimeout(() => ctx.close().catch(() => {}), 800);
  } catch {
    /* audio not available */
  }
};

const kindTone: Record<string, string> = {
  claim: 'bg-orange-100 text-orange-800 border-orange-300',
  mediation: 'bg-violet-100 text-violet-800 border-violet-300',
  appeal: 'bg-sky-100 text-sky-800 border-sky-300',
  other: 'bg-slate-100 text-slate-800 border-slate-300',
};

interface RowProps {
  reminder: ClaimReminder;
  onSnooze: (r: ClaimReminder) => void;
  onMute: (r: ClaimReminder) => void;
  onDone: (r: ClaimReminder) => void;
  onOpenClaim?: (claimId: string) => void;
}

const ReminderRow: React.FC<RowProps> = ({ reminder, onSnooze, onMute, onDone, onOpenClaim }) => {
  const due = new Date(reminder.due_at);
  const overdue = isPast(due);

  return (
    <div className="flex flex-wrap items-center gap-2 sm:gap-3 px-3 py-2.5 rounded-lg bg-background/70 border">
      <Badge variant="outline" className={`${kindTone[reminder.reminder_kind] || kindTone.other} text-[11px] shrink-0`}>
        {KIND_LABELS[reminder.reminder_kind] ?? 'Reminder'}
      </Badge>

      <div className="min-w-0 flex-1">
        <p className="text-sm font-semibold truncate">{reminder.title}</p>
        <p className="text-xs text-muted-foreground flex items-center gap-1.5 flex-wrap">
          <Clock className="h-3 w-3 shrink-0" />
          {overdue ? 'Was due' : 'Due'} {format(due, 'EEE d MMM, HH:mm')}
          <span className={overdue ? 'text-destructive font-medium' : 'font-medium'}>
            ({overdue ? `${formatDistanceToNowStrict(due)} ago` : `in ${formatDistanceToNowStrict(due)}`})
          </span>
          {reminder.notes && <span className="truncate">· {reminder.notes}</span>}
        </p>
      </div>

      <div className="flex items-center gap-1.5 shrink-0">
        {reminder.claim_id && onOpenClaim && (
          <Button variant="ghost" size="sm" onClick={() => onOpenClaim(reminder.claim_id!)}>
            Open claim
          </Button>
        )}
        <Button variant="outline" size="sm" onClick={() => onSnooze(reminder)} title="Delay by one day">
          <AlarmClock className="h-3.5 w-3.5 mr-1" /> Delay 1 day
        </Button>
        <Button
          variant="outline"
          size="sm"
          onClick={() => onMute(reminder)}
          title={reminder.is_muted ? 'Unmute this reminder' : 'Mute this reminder'}
        >
          {reminder.is_muted ? <BellOff className="h-3.5 w-3.5" /> : <Bell className="h-3.5 w-3.5" />}
        </Button>
        <Button size="sm" onClick={() => onDone(reminder)}>
          <Check className="h-3.5 w-3.5 mr-1" /> Done
        </Button>
      </div>
    </div>
  );
};

interface Props {
  onOpenClaim?: (claimId: string) => void;
  onManage?: () => void;
}

/**
 * Sticky banner at the top of the Claims tab listing every reminder that has
 * entered its lead-time window. Each reminder can be delayed a day at a time,
 * muted individually, or marked done. One global control mutes all alert sounds.
 */
export const ClaimRemindersBanner: React.FC<Props> = ({ onOpenClaim, onManage }) => {
  const { showing, snoozeOneDay, toggleMute, complete } = useClaimReminders();
  const [collapsed, setCollapsed] = useState(false);
  const [soundMuted, setSoundMuted] = useState(isAlertsMuted());
  const chimedRef = useRef<Set<string>>(new Set());

  useEffect(() => subscribeAlertsMuted(() => setSoundMuted(isAlertsMuted())), []);

  // Chime once per reminder as it appears (respects both mute levels).
  useEffect(() => {
    const fresh = showing.filter(r => !chimedRef.current.has(r.id) && !r.is_muted);
    showing.forEach(r => chimedRef.current.add(r.id));
    if (fresh.length > 0 && !isAlertsMuted()) playChime();
  }, [showing]);

  if (showing.length === 0) return null;

  return (
    <div className="sticky top-0 z-30 rounded-xl border-2 border-orange-300 bg-orange-50/95 backdrop-blur shadow-sm">
      <div className="flex flex-wrap items-center gap-2 px-3 py-2 border-b border-orange-200">
        <span className="flex items-center gap-2 text-sm font-bold text-orange-900">
          <Bell className="h-4 w-4" />
          {showing.length} claim reminder{showing.length === 1 ? '' : 's'} due
        </span>
        <div className="ml-auto flex items-center gap-1.5">
          <Button
            variant="outline"
            size="sm"
            onClick={() => (soundMuted ? unmuteAlerts() : muteAlertsFor(Infinity))}
            title={soundMuted ? 'Turn alert sounds back on' : 'Mute all alert sounds'}
          >
            {soundMuted ? <VolumeX className="h-3.5 w-3.5 mr-1" /> : <Volume2 className="h-3.5 w-3.5 mr-1" />}
            {soundMuted ? 'Sound off' : 'Sound on'}
          </Button>
          {onManage && (
            <Button variant="ghost" size="sm" onClick={onManage}>Manage reminders</Button>
          )}
          <Button variant="ghost" size="sm" onClick={() => setCollapsed(c => !c)}>
            {collapsed ? <ChevronDown className="h-4 w-4" /> : <ChevronUp className="h-4 w-4" />}
          </Button>
        </div>
      </div>

      {!collapsed && (
        <div className="p-2 space-y-2 max-h-72 overflow-y-auto">
          {showing.map(r => (
            <ReminderRow
              key={r.id}
              reminder={r}
              onSnooze={snoozeOneDay}
              onMute={toggleMute}
              onDone={complete}
              onOpenClaim={onOpenClaim}
            />
          ))}
        </div>
      )}
    </div>
  );
};

export default ClaimRemindersBanner;
