import React, { useState } from 'react';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { Alert, AlertDescription } from '@/components/ui/alert';
import { RadioGroup, RadioGroupItem } from '@/components/ui/radio-group';
import { Badge } from '@/components/ui/badge';
import { Checkbox } from '@/components/ui/checkbox';
import { MailX, CheckCircle2, Ban, ShieldCheck, Mail, PhoneOff } from 'lucide-react';
import { useEmailUnsubscribes, type EmailFrequency } from '@/hooks/useEmailUnsubscribes';
import { useAuth } from '@/hooks/useAuth';
import { supabase } from '@/integrations/supabase/client';
import { toast } from 'sonner';
import { z } from 'zod';
import { format } from 'date-fns';

const emailSchema = z.string().trim().email('Please enter a valid email address').max(255);

export const UnsubscribeTab: React.FC = () => {
  const { user } = useAuth();
  const { setFrequency, unsubscribes, isBlocked } = useEmailUnsubscribes();
  const [email, setEmail] = useState('');
  const [reason, setReason] = useState('');
  const [frequency, setFrequencyState] = useState<EmailFrequency>('off');
  const [stopCalls, setStopCalls] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [lastUpdated, setLastUpdated] = useState<{ email: string; frequency: EmailFrequency; leadsUpdated: number } | null>(null);
  const [submitting, setSubmitting] = useState(false);

  const markLeadsDoNotContact = async (cleanEmail: string, note: string): Promise<number> => {
    const { data, error: updErr } = await supabase
      .from('sales_leads')
      .update({
        do_not_contact: true,
        do_not_contact_reason: note,
        do_not_contact_at: new Date().toISOString(),
        do_not_contact_by: user?.id ?? null,
        status: 'lost',
      })
      .ilike('email', cleanEmail)
      .select('id');
    if (updErr) {
      console.error('Failed to mark leads do-not-contact', updErr);
      toast.error('Could not update sales leads: ' + updErr.message);
      return 0;
    }
    return data?.length ?? 0;
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);

    const parsed = emailSchema.safeParse(email);
    if (!parsed.success) {
      setError(parsed.error.issues[0].message);
      return;
    }

    const cleanEmail = parsed.data.toLowerCase();
    const noteBase = reason.trim() || `Staff set frequency to "${frequency}" via admin dashboard`;

    setSubmitting(true);
    try {
      await new Promise<void>((resolve, reject) => {
        setFrequency.mutate(
          {
            email: cleanEmail,
            frequency,
            reason: noteBase,
            source: 'staff_unsubscribe',
            unsubscribedBy: user?.id,
            unsubscribedByName: user?.email ?? undefined,
          },
          { onSuccess: () => resolve(), onError: (err) => reject(err) }
        );
      });

      let leadsUpdated = 0;
      if (stopCalls) {
        leadsUpdated = await markLeadsDoNotContact(
          cleanEmail,
          reason.trim() || 'Customer asked not to be contacted by phone'
        );
        if (leadsUpdated > 0) {
          toast.success(`Removed ${leadsUpdated} lead${leadsUpdated === 1 ? '' : 's'} from calling lists`);
        }
      }

      setLastUpdated({ email: cleanEmail, frequency, leadsUpdated });
      setEmail('');
      setReason('');
    } catch (err) {
      // toast already shown by mutation
    } finally {
      setSubmitting(false);
    }
  };

  const recent = unsubscribes.slice(0, 10);

  const frequencyLabel = (f: EmailFrequency) =>
    f === 'off' ? 'No emails' : f === 'essentials' ? 'Essentials only' : 'All emails';

  return (
    <div className="space-y-6 max-w-3xl">
      <div>
        <h2 className="text-2xl font-bold flex items-center gap-2">
          <MailX className="h-6 w-6 text-destructive" />
          Email Preferences
        </h2>
        <p className="text-muted-foreground mt-1">
          Update what marketing emails a customer receives. Use this when a customer calls or
          messages and isn't able to manage their preferences themselves.
        </p>
      </div>

      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2 text-lg">
            <Mail className="h-5 w-5 text-orange-600" />
            Set a customer's email preference
          </CardTitle>
          <CardDescription>
            Changes take effect immediately across every future marketing send.
          </CardDescription>
        </CardHeader>
        <CardContent>
          <form onSubmit={handleSubmit} className="space-y-5">
            <div>
              <Label htmlFor="unsubscribe-email">Customer email address</Label>
              <Input
                id="unsubscribe-email"
                type="email"
                placeholder="customer@example.com"
                value={email}
                onChange={(e) => {
                  setEmail(e.target.value);
                  setError(null);
                  setLastUpdated(null);
                }}
                autoComplete="off"
                className="mt-1"
                required
              />
              {error && <p className="text-sm text-destructive mt-1">{error}</p>}
              {email && isBlocked(email) && (
                <p className="text-sm text-amber-600 mt-1 flex items-center gap-1">
                  <ShieldCheck className="h-4 w-4" />
                  This email is currently set to "No emails".
                </p>
              )}
            </div>

            <div>
              <Label>Email frequency</Label>
              <RadioGroup
                value={frequency}
                onValueChange={(v) => setFrequencyState(v as EmailFrequency)}
                className="mt-2 space-y-2"
              >
                <label
                  htmlFor="freq-all"
                  className="flex items-start gap-3 p-3 border rounded-lg cursor-pointer hover:bg-muted/50"
                >
                  <RadioGroupItem value="all" id="freq-all" className="mt-1" />
                  <div className="flex-1">
                    <div className="font-medium">All emails</div>
                    <div className="text-sm text-muted-foreground">
                      Renewal offers, member discounts, news and tips.
                    </div>
                  </div>
                </label>
                <label
                  htmlFor="freq-essentials"
                  className="flex items-start gap-3 p-3 border rounded-lg cursor-pointer hover:bg-muted/50"
                >
                  <RadioGroupItem value="essentials" id="freq-essentials" className="mt-1" />
                  <div className="flex-1">
                    <div className="font-medium">Just the essentials</div>
                    <div className="text-sm text-muted-foreground">
                      Only renewal reminders and the occasional claims/policy tip. About 3-4 emails a year.
                    </div>
                  </div>
                </label>
                <label
                  htmlFor="freq-off"
                  className="flex items-start gap-3 p-3 border rounded-lg cursor-pointer hover:bg-muted/50"
                >
                  <RadioGroupItem value="off" id="freq-off" className="mt-1" />
                  <div className="flex-1">
                    <div className="font-medium">No emails at all</div>
                    <div className="text-sm text-muted-foreground">
                      Stop every marketing email. Policy documents and claims updates still send.
                    </div>
                  </div>
                </label>
              </RadioGroup>
            </div>

            <div>
              <Label htmlFor="unsubscribe-reason">Reason (optional)</Label>
              <Textarea
                id="unsubscribe-reason"
                placeholder="e.g. Customer called and asked for fewer emails"
                value={reason}
                onChange={(e) => setReason(e.target.value)}
                className="mt-1"
                rows={2}
                maxLength={500}
              />
            </div>

            <Button
              type="submit"
              variant={frequency === 'off' ? 'destructive' : 'default'}
              disabled={setFrequency.isPending || !email.trim()}
              className="w-full sm:w-auto"
            >
              {frequency === 'off' ? <Ban className="h-4 w-4 mr-2" /> : <Mail className="h-4 w-4 mr-2" />}
              {setFrequency.isPending ? 'Saving…' : `Save preference: ${frequencyLabel(frequency)}`}
            </Button>
          </form>

          {lastUpdated && (
            <Alert className="mt-4 border-green-200 bg-green-50">
              <CheckCircle2 className="h-4 w-4 text-green-600" />
              <AlertDescription className="text-green-800">
                <strong>{lastUpdated.email}</strong> is now set to{' '}
                <strong>{frequencyLabel(lastUpdated.frequency)}</strong>.
              </AlertDescription>
            </Alert>
          )}
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle className="text-base">Recently unsubscribed</CardTitle>
          <CardDescription>
            {unsubscribes.length} customer{unsubscribes.length === 1 ? '' : 's'} currently opted out
          </CardDescription>
        </CardHeader>
        <CardContent>
          {recent.length === 0 ? (
            <p className="text-sm text-muted-foreground">No unsubscribes yet.</p>
          ) : (
            <ul className="divide-y">
              {recent.map((u) => (
                <li key={u.id} className="py-2 flex items-center justify-between text-sm">
                  <div>
                    <p className="font-medium">{u.email}</p>
                    {u.reason && <p className="text-xs text-muted-foreground">{u.reason}</p>}
                  </div>
                  <div className="flex items-center gap-2">
                    <Badge variant="outline" className="text-xs">
                      {frequencyLabel((u.frequency || 'off') as EmailFrequency)}
                    </Badge>
                    <span className="text-xs text-muted-foreground">
                      {format(new Date(u.created_at), 'dd MMM yyyy HH:mm')}
                    </span>
                  </div>
                </li>
              ))}
            </ul>
          )}
        </CardContent>
      </Card>
    </div>
  );
};

export default UnsubscribeTab;
