import React, { useCallback, useEffect, useState } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/hooks/useAuth';
import { toast } from 'sonner';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Gauge, Loader2, Send } from 'lucide-react';
import { captureSystemEnvironment, describeEnvironment } from '@/lib/systemEnvironment';

/**
 * Short "how is the dashboard running on your machine?" form for sales staff.
 *
 * They rate the speed, say what went wrong and on which screen; their browser,
 * computer and connection details are attached automatically so managers can
 * spot whether a problem follows a person, a screen or a particular laptop.
 */

export const SCREEN_OPTIONS = [
  'New Leads',
  'Quotes & Orders',
  'Customers',
  'Sales Scoreboard',
  'Recontact Leads',
  'Timesheets',
  'Claims',
  'Other screen',
] as const;

export const PROBLEM_OPTIONS = [
  { value: 'none', label: 'Nothing broke — just rating the speed' },
  { value: 'slow', label: 'Very slow to load' },
  { value: 'froze', label: 'Froze / stopped responding' },
  { value: 'crashed', label: 'Crashed or logged me out' },
  { value: 'blank', label: 'Blank white screen' },
  { value: 'not_saving', label: 'Would not save my work' },
  { value: 'other', label: 'Something else' },
] as const;

export const LOAD_OPTIONS = [
  { value: 'under_3s', label: 'Under 3 seconds' },
  { value: '3_8s', label: '3 to 8 seconds' },
  { value: '8_20s', label: '8 to 20 seconds' },
  { value: 'over_20s', label: 'Over 20 seconds' },
  { value: 'never', label: 'It never finished loading' },
] as const;

export const RATING_LABELS: Record<number, string> = {
  1: 'Very slow',
  2: 'Slow',
  3: 'Okay',
  4: 'Fast',
  5: 'Very fast',
};

const MAX_DESCRIPTION = 1000;

type OwnReport = {
  id: string;
  created_at: string;
  speed_rating: number;
  screen: string | null;
  problem_type: string | null;
  description: string | null;
};

const problemLabel = (value: string | null) =>
  PROBLEM_OPTIONS.find((p) => p.value === value)?.label || 'Not stated';

export const SystemCheckInFormBody: React.FC<{ onSubmitted?: () => void }> = ({ onSubmitted }) => {
  const { session } = useAuth();
  const [adminUserId, setAdminUserId] = useState<string | null>(null);
  const [adminName, setAdminName] = useState<string | null>(null);
  const [adminRole, setAdminRole] = useState<string | null>(null);
  const [rating, setRating] = useState<number>(3);
  const [screen, setScreen] = useState<string>('New Leads');
  const [problem, setProblem] = useState<string>('none');
  const [loadBucket, setLoadBucket] = useState<string>('3_8s');
  const [description, setDescription] = useState('');
  const [submitting, setSubmitting] = useState(false);
  const [mine, setMine] = useState<OwnReport[]>([]);

  useEffect(() => {
    if (!session?.user?.id) return;
    supabase
      .from('admin_users')
      .select('id, name, email, role')
      .eq('user_id', session.user.id)
      .maybeSingle()
      .then(({ data }) => {
        if (!data) return;
        setAdminUserId(data.id);
        setAdminName(data.name || data.email);
        setAdminRole(data.role);
      });
  }, [session?.user?.id]);

  const loadMine = useCallback(async () => {
    if (!adminUserId) return;
    const { data } = await (supabase as any)
      .from('staff_system_reports')
      .select('id, created_at, speed_rating, screen, problem_type, description')
      .eq('admin_user_id', adminUserId)
      .order('created_at', { ascending: false })
      .limit(5);
    setMine((data || []) as OwnReport[]);
  }, [adminUserId]);

  useEffect(() => {
    void loadMine();
  }, [loadMine]);

  const env = React.useMemo(() => captureSystemEnvironment(), []);

  const submit = async () => {
    setSubmitting(true);
    try {
      const { error } = await (supabase as any).from('staff_system_reports').insert({
        admin_user_id: adminUserId,
        admin_email: session?.user?.email ?? null,
        admin_name: adminName,
        role: adminRole,
        speed_rating: rating,
        screen,
        problem_type: problem,
        load_bucket: loadBucket,
        description: description.trim().slice(0, MAX_DESCRIPTION) || null,
        ...captureSystemEnvironment(),
      });
      if (error) throw error;
      toast.success('Thanks — your report has been sent to the managers.');
      setDescription('');
      setProblem('none');
      await loadMine();
      onSubmitted?.();
    } catch (e: any) {
      console.error('[SystemCheckInForm] submit failed', e);
      toast.error('Could not send your report. Please try again in a moment.');
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <div className="space-y-5">
      <div className="space-y-2">
        <Label>How fast did the dashboard feel?</Label>
        <div className="flex flex-wrap gap-2">
          {[1, 2, 3, 4, 5].map((n) => (
            <Button
              key={n}
              type="button"
              size="sm"
              variant={rating === n ? 'default' : 'outline'}
              onClick={() => setRating(n)}
            >
              {n} · {RATING_LABELS[n]}
            </Button>
          ))}
        </div>
      </div>

      <div className="grid gap-4 sm:grid-cols-2">
        <div className="space-y-2">
          <Label>Which screen were you on?</Label>
          <Select value={screen} onValueChange={setScreen}>
            <SelectTrigger>
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              {SCREEN_OPTIONS.map((s) => (
                <SelectItem key={s} value={s}>
                  {s}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>

        <div className="space-y-2">
          <Label>How long did it take to load?</Label>
          <Select value={loadBucket} onValueChange={setLoadBucket}>
            <SelectTrigger>
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              {LOAD_OPTIONS.map((o) => (
                <SelectItem key={o.value} value={o.value}>
                  {o.label}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>
      </div>

      <div className="space-y-2">
        <Label>What happened?</Label>
        <Select value={problem} onValueChange={setProblem}>
          <SelectTrigger>
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            {PROBLEM_OPTIONS.map((o) => (
              <SelectItem key={o.value} value={o.value}>
                {o.label}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
      </div>

      <div className="space-y-2">
        <Label>
          Anything else worth knowing? <span className="text-muted-foreground">(optional)</span>
        </Label>
        <Textarea
          value={description}
          maxLength={MAX_DESCRIPTION}
          onChange={(e) => setDescription(e.target.value)}
          placeholder="For example: the leads list took ages after I opened a customer, then went blank."
          rows={4}
        />
        <p className="text-xs text-muted-foreground">
          {description.length}/{MAX_DESCRIPTION}
        </p>
      </div>

      <div className="rounded-md border bg-muted/40 p-3 text-xs text-muted-foreground">
        Sent automatically with your report: {describeEnvironment(env)}
        {env.page_load_ms ? ` · this page took ${(env.page_load_ms / 1000).toFixed(1)}s to open` : ''}
      </div>

      <Button onClick={() => void submit()} disabled={submitting} className="w-full sm:w-auto">
        {submitting ? <Loader2 className="h-4 w-4 mr-2 animate-spin" /> : <Send className="h-4 w-4 mr-2" />}
        Send report
      </Button>

      {mine.length > 0 && (
        <div className="space-y-2">
          <Label>Your recent reports</Label>
          <div className="rounded-md border divide-y">
            {mine.map((r) => (
              <div key={r.id} className="p-2.5 text-sm flex flex-wrap items-center gap-2">
                <Badge variant="outline">{RATING_LABELS[r.speed_rating] || r.speed_rating}</Badge>
                <span className="font-medium">{r.screen || 'Screen not stated'}</span>
                <span className="text-xs text-muted-foreground">{problemLabel(r.problem_type)}</span>
                <span className="text-xs text-muted-foreground ml-auto">
                  {new Date(r.created_at).toLocaleString('en-GB', { timeZone: 'Europe/London' })}
                </span>
                {r.description && <p className="w-full text-xs text-muted-foreground">{r.description}</p>}
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  );
};

/** Card version, shown inside the Agent Feedback tab. */
export const SystemCheckInCard: React.FC = () => (
  <Card>
    <CardHeader>
      <CardTitle className="text-lg flex items-center gap-2">
        <Gauge className="h-4 w-4" />
        How is the dashboard running on your computer?
      </CardTitle>
      <CardDescription>
        Rate the speed and tell us anything that went wrong. Managers use this to fix slow screens and bad setups.
      </CardDescription>
    </CardHeader>
    <CardContent>
      <SystemCheckInFormBody />
    </CardContent>
  </Card>
);

/** Small always-available button, for the dashboard header. */
export const SystemCheckInButton: React.FC<{ className?: string }> = ({ className }) => {
  const [open, setOpen] = useState(false);
  return (
    <>
      <Button variant="outline" size="sm" className={className} onClick={() => setOpen(true)}>
        <Gauge className="h-4 w-4 mr-1.5" />
        Report speed
      </Button>
      <Dialog open={open} onOpenChange={setOpen}>
        <DialogContent className="max-w-xl max-h-[85vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle>How is the dashboard running on your computer?</DialogTitle>
            <DialogDescription>
              Takes under a minute. Your browser and connection details are attached automatically.
            </DialogDescription>
          </DialogHeader>
          <SystemCheckInFormBody onSubmitted={() => setOpen(false)} />
        </DialogContent>
      </Dialog>
    </>
  );
};

export default SystemCheckInCard;
