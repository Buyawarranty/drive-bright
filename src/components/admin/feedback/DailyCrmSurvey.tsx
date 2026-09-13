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
import '@fontsource/sora/600.css';
import '@fontsource/sora/700.css';
import '@fontsource/manrope/400.css';
import '@fontsource/manrope/600.css';

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
/** Day the daily survey went live (UK date). Nothing before this is shown or expected. */
export const SURVEY_START_DATE = '2026-09-09';
/** Admin dashboard tab where agents read their own answers and managers see everyone. */
export const SURVEY_RESULTS_TAB = 'staff-system-reports';

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
  const completedRequired = [ordersIssues.length > 0, leadsIssues.length > 0, rating !== null].filter(Boolean).length;
  const progress = Math.round((completedRequired / 3) * 100);

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
    <div className="space-y-3 rounded-md border bg-card p-4 shadow-sm">
      <Label className="font-crm-heading text-sm font-semibold">{title}</Label>
      <div className="grid gap-2 sm:grid-cols-2">
        {options.map((opt) => {
          const id = `${idPrefix}-${opt}`;
          return (
            <label
              key={opt}
              htmlFor={id}
              className={cn(
                'flex min-h-11 items-center gap-2 rounded-md border px-3 py-2 text-sm font-medium cursor-pointer transition-colors',
                value.includes(opt)
                  ? 'border-primary bg-primary text-primary-foreground shadow-sm'
                  : 'border-border bg-background hover:border-primary/50 hover:bg-primary/5',
              )}
            >
              <Checkbox
                id={id}
                checked={value.includes(opt)}
                onCheckedChange={() => onChange(toggleIn(value, opt))}
                className={cn('shrink-0', value.includes(opt) && 'border-primary-foreground data-[state=checked]:bg-primary-foreground data-[state=checked]:text-primary')}
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
    <div className="crm-survey-theme space-y-5 font-crm-body">
      <div className="rounded-md border border-primary/20 bg-primary/5 px-4 py-3">
        <div className="mb-2 flex items-center justify-between gap-3">
          <span className="font-crm-heading text-sm font-semibold">Today’s check-in</span>
          <span className="text-xs font-semibold text-primary">{completedRequired} of 3 required sections</span>
        </div>
        <div className="h-2 overflow-hidden rounded-full bg-primary/10" role="progressbar" aria-valuemin={0} aria-valuemax={100} aria-valuenow={progress}>
          <div className="h-full rounded-full bg-primary transition-all duration-300" style={{ width: `${progress}%` }} />
        </div>
      </div>
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

      <div className="space-y-3 rounded-md border bg-card p-4 shadow-sm">
        <Label className="font-crm-heading text-sm font-semibold">How would you rate the CRM's overall performance today?</Label>
        <div className="grid grid-cols-5 gap-2">
          {[1, 2, 3, 4, 5].map((n) => (
            <Button
              key={n}
              type="button"
              size="sm"
              variant={rating === n ? 'default' : 'outline'}
              onClick={() => setRating(n)}
              className={cn('h-auto min-h-14 flex-col gap-0.5 px-1', rating === n && 'ring-2 ring-primary/20 ring-offset-2')}
            >
              <span className="text-base font-bold">{n}</span>
              <span className="hidden text-[10px] font-medium sm:block">{CRM_RATING_LABELS[n]}</span>
            </Button>
          ))}
        </div>
      </div>

      <div className="space-y-2 rounded-md border bg-card p-4 shadow-sm">
        <Label className="text-sm font-semibold">
          Please describe the biggest CRM issue you experienced today.{' '}
          <span className="font-normal text-muted-foreground">(optional)</span>
        </Label>
        <Textarea value={biggest} maxLength={MAX_TEXT} onChange={(e) => setBiggest(e.target.value)} rows={3} />
      </div>

      <div className="space-y-2 rounded-md border bg-card p-4 shadow-sm">
        <Label className="text-sm font-semibold">
          Is there anything else you would like us to know about the CRM today?{' '}
          <span className="font-normal text-muted-foreground">(optional)</span>
        </Label>
        <Textarea value={other} maxLength={MAX_TEXT} onChange={(e) => setOther(e.target.value)} rows={3} />
      </div>

      <div className="sticky bottom-0 -mx-1 border-t bg-background/95 px-1 pt-4 backdrop-blur">
      <Button onClick={() => void submit()} disabled={!canSubmit || submitting} className="h-12 w-full text-sm font-semibold shadow-md">
        {submitting ? <Loader2 className="h-4 w-4 mr-2 animate-spin" /> : <Send className="h-4 w-4 mr-2" />}
        Send today's survey
      </Button>
      {!canSubmit && <p className="mt-2 text-center text-xs text-muted-foreground">Complete the two issue sections and today’s rating to send.</p>}
      </div>
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
  if (snoozedFor === now.date) return null;

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
      <div className={cn('crm-survey-theme flex flex-wrap items-center gap-3 rounded-md border-2 px-4 py-3 font-crm-body shadow-sm', tone)}>
        {phase === 'before' ? <Clock className="h-5 w-5 shrink-0" /> : <ClipboardList className="h-5 w-5 shrink-0" />}
        <div className="min-w-0 flex-1">
          <p className="font-crm-heading text-sm font-semibold leading-tight">{headline}</p>
          <p className="text-xs opacity-80">{sub}</p>
        </div>
        <Button size="sm" variant={phase === 'before' ? 'outline' : 'default'} onClick={() => setOpen(true)}>
          {phase === 'before' ? 'Fill in early' : 'Fill in now'}
        </Button>
        <Button
          size="icon"
          variant="ghost"
          className="h-7 w-7"
          aria-label="Hide for today"
          title="Hide for today"
          onClick={() => setSnoozedFor(now.date)}
        >
          <X className="h-4 w-4" />
        </Button>
      </div>

      <Dialog open={open} onOpenChange={setOpen}>
        <DialogContent className="crm-survey-theme max-w-2xl max-h-[90vh] overflow-y-auto font-crm-body">
          <DialogHeader>
            <DialogTitle className="font-crm-heading flex items-center gap-2">
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

const promptKey = (adminUserId: string, date: string) => `crm-survey-prompt:${adminUserId}:${date}`;

/**
 * Daily pop-up for sales agents, shown on whichever dashboard tab they are on
 * once the survey window opens (and again if they are late). Silent — no sound.
 * Dismissing it hides it for the rest of that day; it comes back the next day
 * and disappears for good once the survey is sent.
 */
export const DailyCrmSurveyPrompt: React.FC<{
  adminUserId: string | null;
  userRole: string | null;
  onOpenResults?: () => void;
}> = ({ adminUserId, userRole, onOpenResults }) => {
  const isAgent = userRole === 'sales' || userRole === 'sales_lead';
  const [now, setNow] = useState(() => ukNow());
  const [doneToday, setDoneToday] = useState<boolean | null>(null);
  const [dismissedFor, setDismissedFor] = useState<string | null>(null);
  const [formOpen, setFormOpen] = useState(false);

  useEffect(() => {
    const t = window.setInterval(() => setNow(ukNow()), 30_000);
    return () => window.clearInterval(t);
  }, []);

  useEffect(() => {
    if (!adminUserId) return;
    try {
      setDismissedFor(localStorage.getItem(promptKey(adminUserId, now.date)) ? now.date : null);
    } catch {
      setDismissedFor(null);
    }
  }, [adminUserId, now.date]);

  const phase = surveyPhase(now.minutes);
  const active = isAgent && !!adminUserId && phase !== 'before' && now.date >= SURVEY_START_DATE;

  const checkDone = useCallback(async () => {
    if (!adminUserId || !active) return;
    const { data } = await (supabase as any)
      .from('staff_system_reports')
      .select('id')
      .eq('admin_user_id', adminUserId)
      .eq('report_kind', 'daily_survey')
      .eq('survey_date', now.date)
      .limit(1);
    setDoneToday(Array.isArray(data) && data.length > 0);
  }, [adminUserId, now.date, active]);

  useEffect(() => {
    void checkDone();
  }, [checkDone]);

  if (!active || doneToday !== false || dismissedFor === now.date) return null;

  const dismiss = () => {
    if (adminUserId) {
      try {
        localStorage.setItem(promptKey(adminUserId, now.date), '1');
      } catch {
        /* ignore */
      }
    }
    setDismissedFor(now.date);
  };

  const resultsHref = `/admin-dashboard/?tab=${SURVEY_RESULTS_TAB}`;

  return (
    <>
      <Dialog open={!formOpen} onOpenChange={(o) => !o && dismiss()}>
        <DialogContent className="crm-survey-theme max-w-md overflow-hidden border-primary/20 p-0 font-crm-body" largeCloseButton>
          <div className="h-2 bg-accent" />
          <div className="space-y-5 p-6">
          <DialogHeader>
            <div className="mb-2 flex h-11 w-11 items-center justify-center rounded-md bg-primary text-primary-foreground"><ClipboardList className="h-5 w-5" /></div>
            <DialogTitle className="font-crm-heading text-xl">
              Please fill in your CRM feedback survey
            </DialogTitle>
            <DialogDescription>
              {phase === 'late'
                ? `Today's survey is overdue — it only takes a minute.`
                : `It takes about a minute. Please send it by ${fmtTime(SURVEY_DEADLINE)} today.`}
            </DialogDescription>
          </DialogHeader>
          <p className="text-sm text-muted-foreground">
            Tell us what went wrong on the Orders and New Leads pages today so it can be fixed. You can read your previous answers on{' '}
            <a
              href={resultsHref}
              className="text-primary underline underline-offset-2"
              onClick={(e) => {
                if (onOpenResults) {
                  e.preventDefault();
                  dismiss();
                  onOpenResults();
                }
              }}
            >
              your CRM feedback page
            </a>
            .
          </p>
          <div className="flex flex-wrap justify-end gap-2 pt-1">
            <Button variant="outline" onClick={dismiss}>Later today</Button>
            <Button onClick={() => setFormOpen(true)}>Fill in now</Button>
          </div>
          </div>
        </DialogContent>
      </Dialog>

      <Dialog open={formOpen} onOpenChange={setFormOpen}>
        <DialogContent className="crm-survey-theme max-w-2xl max-h-[90vh] overflow-y-auto font-crm-body">
          <DialogHeader>
            <DialogTitle className="font-crm-heading flex items-center gap-2">
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
              setFormOpen(false);
              setDoneToday(true);
            }}
          />
        </DialogContent>
      </Dialog>
    </>
  );
};

export default DailyCrmSurveyBanner;
