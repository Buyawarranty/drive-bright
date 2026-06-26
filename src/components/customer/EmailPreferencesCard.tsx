import React, { useEffect, useState } from 'react';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Label } from '@/components/ui/label';
import { RadioGroup, RadioGroupItem } from '@/components/ui/radio-group';
import { Alert, AlertDescription } from '@/components/ui/alert';
import { Mail, CheckCircle2 } from 'lucide-react';
import { supabase } from '@/integrations/supabase/client';
import { useEmailUnsubscribes, type EmailFrequency } from '@/hooks/useEmailUnsubscribes';
import { toast } from 'sonner';

interface Props {
  email: string | null | undefined;
}

/**
 * Customer-facing email frequency picker.
 * Shown in the customer dashboard so customers can self-manage cadence.
 */
export const EmailPreferencesCard: React.FC<Props> = ({ email }) => {
  const [frequency, setFrequency] = useState<EmailFrequency>('all');
  const [initial, setInitial] = useState<EmailFrequency>('all');
  const [loading, setLoading] = useState(true);
  const [saved, setSaved] = useState(false);
  const { setFrequency: setFrequencyMutation } = useEmailUnsubscribes();

  useEffect(() => {
    if (!email) {
      setLoading(false);
      return;
    }
    const load = async () => {
      const clean = email.trim().toLowerCase();
      const { data } = await supabase
        .from('marketing_audience')
        .select('frequency, is_subscribed')
        .eq('email', clean)
        .maybeSingle();

      let current: EmailFrequency = 'all';
      if (data) {
        current = (data.frequency as EmailFrequency) || (data.is_subscribed ? 'all' : 'off');
      }
      setFrequency(current);
      setInitial(current);
      setLoading(false);
    };
    load();
  }, [email]);

  const dirty = frequency !== initial;

  const handleSave = () => {
    if (!email) return;
    setFrequencyMutation.mutate(
      {
        email,
        frequency,
        reason: 'Customer updated preferences from their dashboard',
        source: 'customer_dashboard',
      },
      {
        onSuccess: () => {
          setInitial(frequency);
          setSaved(true);
          toast.success('Email preferences updated');
          setTimeout(() => setSaved(false), 4000);
        },
      }
    );
  };

  return (
    <Card>
      <CardHeader>
        <CardTitle className="flex items-center gap-2">
          <Mail className="h-5 w-5 text-orange-600" />
          Email preferences
        </CardTitle>
        <CardDescription>
          Choose how often you'd like to hear from us. You can change this any time. Policy
          documents and claims updates always come through - this only controls our marketing
          emails.
        </CardDescription>
      </CardHeader>
      <CardContent className="space-y-4">
        {loading ? (
          <p className="text-sm text-muted-foreground">Loading your preferences…</p>
        ) : (
          <>
            <RadioGroup
              value={frequency}
              onValueChange={(v) => setFrequency(v as EmailFrequency)}
              className="space-y-2"
            >
              <label
                htmlFor="c-freq-all"
                className="flex items-start gap-3 p-3 border rounded-lg cursor-pointer hover:bg-muted/50"
              >
                <RadioGroupItem value="all" id="c-freq-all" className="mt-1" />
                <div className="flex-1">
                  <div className="font-medium">All updates</div>
                  <div className="text-sm text-muted-foreground">
                    Renewal offers, member discounts, news and tips.
                  </div>
                </div>
              </label>
              <label
                htmlFor="c-freq-essentials"
                className="flex items-start gap-3 p-3 border rounded-lg cursor-pointer hover:bg-muted/50"
              >
                <RadioGroupItem value="essentials" id="c-freq-essentials" className="mt-1" />
                <div className="flex-1">
                  <div className="font-medium">Just the essentials</div>
                  <div className="text-sm text-muted-foreground">
                    Only renewal reminders when your warranty is ending, and the occasional
                    claims/policy tip. About 3-4 emails a year.
                  </div>
                </div>
              </label>
              <label
                htmlFor="c-freq-off"
                className="flex items-start gap-3 p-3 border rounded-lg cursor-pointer hover:bg-muted/50"
              >
                <RadioGroupItem value="off" id="c-freq-off" className="mt-1" />
                <div className="flex-1">
                  <div className="font-medium">No marketing emails</div>
                  <div className="text-sm text-muted-foreground">
                    Stop all marketing. We'll still send service emails (policy documents, claims
                    updates, renewal paperwork).
                  </div>
                </div>
              </label>
            </RadioGroup>

            <Button
              onClick={handleSave}
              disabled={!dirty || setFrequencyMutation.isPending || !email}
              className="bg-orange-600 hover:bg-orange-700"
            >
              {setFrequencyMutation.isPending ? 'Saving…' : 'Save preferences'}
            </Button>

            {saved && (
              <Alert className="border-green-200 bg-green-50">
                <CheckCircle2 className="h-4 w-4 text-green-600" />
                <AlertDescription className="text-green-800">
                  Your email preferences have been updated. Thanks!
                </AlertDescription>
              </Alert>
            )}
          </>
        )}
      </CardContent>
    </Card>
  );
};

export default EmailPreferencesCard;
