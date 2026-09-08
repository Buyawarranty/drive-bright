import React, { useCallback, useEffect, useMemo, useState } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/hooks/useAuth';
import { toast } from 'sonner';
import { Button } from '@/components/ui/button';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { Checkbox } from '@/components/ui/checkbox';
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { CheckCircle2, ClipboardList, Clock, Loader2, Send, X } from 'lucide-react';
import { cn } from '@/lib/utils';
import { captureSystemEnvironment } from '@/lib/systemEnvironment';

/**
 * Daily CRM issues survey for the sales team.
 *
 * Every working day each agent is prompted (banner at the top of New Leads)
 * to say what went wrong on the Orders page and the New Leads page, rate the
 * CRM overall and describe the biggest problem. One answer per agent per day.
 *
 * Fixed daily window (UK time): the prompt opens at SURVEY_OPEN and the
 * deadline is SURVEY_DEADLINE. Late answers are still accepted so nothing is
 * lost, but the banner turns red once the deadline has passed.
 */

export const SURVEY_OPEN = { hour: 16, minute: 30 };
export const SURVEY_DEADLINE = { hour: 17, minute: 30 };

export const ORDERS_ISSUE_OPTIONS = [
  'No issues',
  'Very little issues - did not affect my work much',
  'Importing a lead',
  'Giving / creating a quote',
  'Sending a quote',
  'Page not loading',
  'Page loading slowly',
  'Other',
] as const;

export const LEADS_ISSUE_OPTIONS = [
  'No issues',
  'Very little issues - did not affect my work much',
  'Loading / viewing leads',
  'Adding notes',
  'Updating a lead',
  'Page not loading',
  'Page loading slowly',
  'Other',
] as const;

export const CRM_RATING_LABELS: Record<number, string> = {
  1: 'Very poor',
  2: 'Poor',
  3: 'Okay',
  4: 'Good',
  5: 'Very good',
};

const MAX_TEXT = 1000;

/** UK calendar date (YYYY-MM-DD) and minutes since midnight in London. */
export const ukNow = (d = new Date()) => {
  const parts = new Intl.DateTimeFormat('en-GB', {
    timeZone: 'Europe/London',
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
    hour: '2-digit',
    minute: '2-digit',
    hour12: false,
  }).formatToParts(d);
  const get = (t: string) => parts.find((p) => p.type === t)?.value ?? '00';
  const hour = Number(get('hour')) % 24;
  return {
    date: `${get('year')}-${get('month')}-${get('day')}`,
    minutes: hour * 60 + Number(get('minute')),
  };
};

const fmtTime = (t: { hour: number; minute: number }) =>
  `${String(t.hour).padStart(2, '0')}:${String(t.minute).padStart(2, '0')}`;

export const surveyWindowLabel = () => `${fmtTime(SURVEY_OPEN)}–${fmtTime(SURVEY_DEADLINE)}`;

/** 'before' | 'open' | 'late' for the current UK time. */
export const surveyPhase = (minutes: number) => {
  const open = SURVEY_OPEN.hour * 60 + SURVEY_OPEN.minute;
  const deadline = SURVEY_DEADLINE.hour * 60 + SURVEY_DEADLINE.minute;
  if (minutes < open) return 'before' as const;
  if (minutes <= deadline) return 'open' as const;
  return 'late' as const;
};

const toggleIn = (list: string[], value: string) => {
  // "No issues" / "Very little issues" are exclusive of real issues.
  const softOptions = ['No issues', 'Very little issues - did not affect my work much'];
  if (list.includes(value)) return list.filter((v) => v !== value);
  if (softOptions.includes(value)) return [value];
  return [...list.filter((v) => !softOptions.includes(v)), value];
};

type Props = {
  adminUserId: string | null;
  surveyDate: string;
  onSubmitted?: () => void;
};

export const DailyCrmSurveyForm: React.FC<Props> = ({ adminUserId, surveyDate, onSubmitted }) => {
  const { session } = useAuth();
  const [adminName, setAdminName] = useState<string | null>(null);
  const [adminRole, setAdminRole] = useState<string | null>(null);
  const [ordersIssues, setOrdersIssues] = useState<string[]>([]);
  const [ordersOther, setOrdersOther] = useState('');
  const [leadsIssues, setLeadsIssues] = useState<string[]>([]);
  const [leadsOther, setLeadsOther] = useState('');
  const [rating, setRating] = useState<number | null>(null);
  const [biggest, setBiggest] = useState('');
  const [other, setOther] = useState('');
  const [submitting, setSubmitting] = useState(false);

  useEffect(() => {
    if (!adminUserId) return;
    supabase
      .from('admin_users')
      .select('first_name, last_name, email, role')
      .eq('id', adminUserId)
      .maybeSingle()
      .then(({ data }) => {
        if (!data) return;
        setAdminName([data.first_name, data.last_name].filter(Boolean).join(' ') || data.email);
        setAdminRole(data.role);
      });
  }, [adminUserId]);

  const canSubmit =
    ordersIssues.length > 0 &&
    leadsIssues.length > 0 &&
    rating !== null &&
    (!ordersIssues.includes('Other') || ordersOther.trim().length > 0) &&
    (!leadsIssues.includes('Other') || leadsOther.trim().length > 0);

  const submit = async () => {
    if (!canSubmit || rating === null) return;
    setSubmitting(true);
    try {
      const { error } = await (supabase as any).from('staff_system_reports').insert({
        report_kind: 'daily_survey',
        survey_date: surveyDate,
        admin_user_id: adminUserId,
        admin_email: session?.user?.email ?? null,
        admin_name: adminName,
        role: adminRole,
        speed_rating: rating,
        screen: 'Daily CRM survey',
        problem_type: null,
        orders_issues: ordersIssues,
        orders_other: ordersOther.trim().slice(0, MAX_TEXT) || null,
        leads_issues: leadsIssues,
        leads_other: leadsOther.trim().slice(0, MAX_TEXT) || null,
        biggest_issue: biggest.trim().slice(0, MAX_TEXT) || null,
        other_comments: other.trim().slice(0, MAX_TEXT) || null,
        description: biggest.trim().slice(0, MAX_TEXT) || null,
        ...captureSystemEnvironment(),
      });
      if (error) {
        if (String(error.code) === '23505') {
          toast.info("You've already sent today's survey — thank you.");
          onSubmitted?.();
          return;
        }
        throw error;
      }
      toast.success("Thanks — today's CRM survey has been sent to the managers.");
      onSubmitted?.();
    } catch (e: any) {
      console.error('[DailyCrmSurvey] submit failed', e);
      toast.error('Could not send the survey. Please try again in a moment.');
    } finally {
      setSubmitting(false);
    }
  };

  const checkboxGroup = (
    title: string,
    options: readonly string[],
    value: string[],
    onChange: (v: string[]) => void,
    otherText: string,
    onOther: (v: string) => void,
    idPrefix: string,
  ) => (
    <div className="space-y-2">
      <Label className="text-sm font-semibold">{title}</Label>
      <div className="grid gap-1.5 sm:grid-cols-2">
        {options.map((opt) => {
          const id = `${idPrefix}-${opt}`;
          return (
            <label
              key={opt}
              htmlFor={id}
              className={cn(
                'flex items-start gap-2 rounded-md border px-2.5 py-2 text-sm cursor-pointer',
                value.includes(opt) ? 'border-primary bg-primary/5' : 'border-border hover:bg-muted/50',
              )}
            >
              <Checkbox
                id={id}
                checked={value.includes(opt)}
                onCheckedChange={() => onChange(toggleIn(value, opt))}
                className="mt-0.5"
              />
              <span>{opt}</span>
            </label>
          );
        })}
      </div>
      {value.includes('Other') && (
        <Textarea
          value={otherText}
          maxLength={MAX_TEXT}
          onChange={(e) => onOther(e.target.value)}
          placeholder="Please describe the issue."
          rows={2}
        />
      )}
    </div>
  );

  return (
    <div className="space-y-5">
      {checkboxGroup(
        'What issue(s) did you experience on the Orders page today?',
        ORDERS_ISSUE_OPTIONS,
        ordersIssues,
        setOrdersIssues,
        ordersOther,
        setOrdersOther,
        'orders',
      )}

      {checkboxGroup(
        'What issue(s) did you experience on the New Leads page today?',
        LEADS_ISSUE_OPTIONS,
        leadsIssues,
        setLeadsIssues,
        leadsOther,
        setLeadsOther,
        'leads',
      )}

      <div className="space-y-2">
        <Label className="text-sm font-semibold">How would you rate the CRM's overall performance today?</Label>
        <div className="flex flex-wrap gap-2">
          {[1, 2, 3, 4, 5].map((n) => (
            <Button
              key={n}
              type="button"
              size="sm"
              variant={rating === n ? 'default' : 'outline'}
              onClick={() => setRating(n)}
            >
              {n} · {CRM_RATING_LABELS[n]}
            </Button>
          ))}
        </div>
      </div>

      <div className="space-y-2">
        <Label className="text-sm font-semibold">
          Please describe the biggest CRM issue you experienced today.{' '}
          <span className="font-normal text-muted-foreground">(optional)</span>
        </Label>
        <Textarea value={biggest} maxLength={MAX_TEXT} onChange={(e) => setBiggest(e.target.value)} rows={3} />
      </div>

      <div className="space-y-2">
        <Label className="text-sm font-semibold">
          Is there anything else you would like us to know about the CRM today?{' '}
          <span className="font-normal text-muted-foreground">(optional)</span>
        </Label>
        <Textarea value={other} maxLength={MAX_TEXT} onChange={(e) => setOther(e.target.value)} rows={3} />
      </div>

      <Button onClick={() => void submit()} disabled={!canSubmit || submitting} className="w-full sm:w-auto">
        {submitting ? <Loader2 className="h-4 w-4 mr-2 animate-spin" /> : <Send className="h-4 w-4 mr-2" />}
        Send today's survey
      </Button>
    </div>
  );
};

/**
 * Banner shown at the top of New Leads for sales agents until today's survey
 * is sent. Grey before the window opens, orange while open, red once late.
 */
export const DailyCrmSurveyBanner: React.FC<{ adminUserId: string | null }> = ({ adminUserId }) => {
  const [now, setNow] = useState(() => ukNow());
  const [doneToday, setDoneToday] = useState<boolean | null>(null);
  const [open, setOpen] = useState(false);
  const [snoozedFor, setSnoozedFor] = useState<string | null>(null);

  useEffect(() => {
    const t = window.setInterval(() => setNow(ukNow()), 30_000);
    return () => window.clearInterval(t);
  }, []);

  const checkDone = useCallback(async () => {
    if (!adminUserId) return;
    const { data } = await (supabase as any)
      .from('staff_system_reports')
      .select('id')
      .eq('admin_user_id', adminUserId)
      .eq('report_kind', 'daily_survey')
      .eq('survey_date', now.date)
      .limit(1);
    setDoneToday(Array.isArray(data) && data.length > 0);
  }, [adminUserId, now.date]);

  useEffect(() => {
    void checkDone();
  }, [checkDone]);

  const phase = useMemo(() => surveyPhase(now.minutes), [now.minutes]);

  if (!adminUserId || doneToday === null) return null;
  if (doneToday) return null;
  // Only allow hiding the "opens later" reminder; once open it stays until sent.
  if (phase === 'before' && snoozedFor === now.date) return null;

  const tone =
    phase === 'before'
      ? 'border-border bg-muted/40 text-foreground'
      : phase === 'open'
        ? 'border-amber-400 bg-amber-50 text-amber-950 dark:bg-amber-950/30 dark:text-amber-100'
        : 'border-red-400 bg-red-50 text-red-950 dark:bg-red-950/30 dark:text-red-100';

  const headline =
    phase === 'before'
      ? `Today's CRM survey opens at ${fmtTime(SURVEY_OPEN)}`
      : phase === 'open'
        ? `Please fill in today's CRM survey by ${fmtTime(SURVEY_DEADLINE)}`
        : `Today's CRM survey is overdue — please fill it in now`;

  const sub =
    phase === 'before'
      ? `Takes about a minute. Fill it in between ${surveyWindowLabel()} every working day.`
      : 'Tell us what went wrong on Orders and New Leads today so it can be fixed.';

  return (
    <>
      <div className={cn('flex flex-wrap items-center gap-3 rounded-lg border-2 px-4 py-2.5', tone)}>
        {phase === 'before' ? <Clock className="h-5 w-5 shrink-0" /> : <ClipboardList className="h-5 w-5 shrink-0" />}
        <div className="min-w-0 flex-1">
          <p className="text-sm font-semibold leading-tight">{headline}</p>
          <p className="text-xs opacity-80">{sub}</p>
        </div>
        <Button size="sm" variant={phase === 'before' ? 'outline' : 'default'} onClick={() => setOpen(true)}>
          {phase === 'before' ? 'Fill in early' : 'Fill in now'}
        </Button>
        {phase === 'before' && (
          <Button
            size="icon"
            variant="ghost"
            className="h-7 w-7"
            aria-label="Hide until it opens"
            onClick={() => setSnoozedFor(now.date)}
          >
            <X className="h-4 w-4" />
          </Button>
        )}
      </div>

      <Dialog open={open} onOpenChange={setOpen}>
        <DialogContent className="max-w-2xl max-h-[90vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <ClipboardList className="h-5 w-5" />
              Daily CRM survey —{' '}
              {new Date(`${now.date}T12:00:00Z`).toLocaleDateString('en-GB', {
                weekday: 'long',
                day: 'numeric',
                month: 'long',
                year: 'numeric',
              })}
            </DialogTitle>
            <DialogDescription>
              One a day, at the end of your shift ({surveyWindowLabel()} UK time). Your answers go straight to the managers.
            </DialogDescription>
          </DialogHeader>
          <DailyCrmSurveyForm
            adminUserId={adminUserId}
            surveyDate={now.date}
            onSubmitted={() => {
              setOpen(false);
              setDoneToday(true);
            }}
          />
        </DialogContent>
      </Dialog>
    </>
  );
};

/** Small confirmation chip, handy for showing "sent" state elsewhere. */
export const SurveySentChip: React.FC = () => (
  <span className="inline-flex items-center gap-1 text-xs text-emerald-700">
    <CheckCircle2 className="h-3.5 w-3.5" /> Sent
  </span>
);

export default DailyCrmSurveyBanner;
