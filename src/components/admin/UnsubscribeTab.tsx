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
import {
  MailX,
  CheckCircle2,
  Ban,
  ShieldCheck,
  Mail,
  PhoneOff,
  Search,
  Loader2,
  AlertCircle,
} from 'lucide-react';
import { useEmailUnsubscribes, type EmailFrequency } from '@/hooks/useEmailUnsubscribes';
import { useAuth } from '@/hooks/useAuth';
import { supabase } from '@/integrations/supabase/client';
import { toast } from 'sonner';
import { z } from 'zod';
import { format } from 'date-fns';

const emailSchema = z.string().trim().email('Please enter a valid email address').max(255);

type LeadMatch = {
  id: string;
  customer_name: string | null;
  email: string | null;
  phone: string | null;
  status: string | null;
  do_not_contact: boolean | null;
  created_at: string;
};

const normalizePhone = (raw: string) => raw.replace(/[\s\-().]/g, '');

export const UnsubscribeTab: React.FC = () => {
  const { user } = useAuth();
  const { setFrequency, unsubscribes, isBlocked } = useEmailUnsubscribes();

  const [email, setEmail] = useState('');
  const [phone, setPhone] = useState('');
  const [reason, setReason] = useState('');
  const [frequency, setFrequencyState] = useState<EmailFrequency>('off');
  const [stopCalls, setStopCalls] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [submitting, setSubmitting] = useState(false);
  const [searching, setSearching] = useState(false);
  const [matches, setMatches] = useState<LeadMatch[] | null>(null);
  const [lastUpdated, setLastUpdated] = useState<
    { email: string | null; phone: string | null; frequency: EmailFrequency | null; leadsUpdated: number } | null
  >(null);

  const frequencyLabel = (f: EmailFrequency) =>
    f === 'off' ? 'No emails' : f === 'essentials' ? 'Essentials only' : 'All emails';

  const handleSearch = async () => {
    setError(null);
    setMatches(null);
    const cleanEmail = email.trim().toLowerCase();
    const cleanPhone = normalizePhone(phone);
    if (!cleanEmail && !cleanPhone) {
      setError('Enter an email or phone number to search.');
      return;
    }

    setSearching(true);
    try {
      let query = supabase
        .from('sales_leads')
        .select('id, customer_name, email, phone, status, do_not_contact, created_at')
        .order('created_at', { ascending: false })
        .limit(25);

      const filters: string[] = [];
      if (cleanEmail) filters.push(`email.ilike.${cleanEmail}`);
      if (cleanPhone) {
        // match the last 9 digits to ignore +44/0 prefix differences
        const tail = cleanPhone.replace(/\D/g, '').slice(-9);
        if (tail) filters.push(`phone.ilike.%${tail}%`);
      }
      if (filters.length) query = query.or(filters.join(','));

      const { data, error: searchErr } = await query;
      if (searchErr) throw searchErr;
      setMatches((data ?? []) as LeadMatch[]);
      if (!data || data.length === 0) {
        toast.info('No matching leads found');
      }
    } catch (err: any) {
      console.error('Lead search failed', err);
      toast.error('Search failed: ' + (err?.message ?? 'unknown error'));
    } finally {
      setSearching(false);
    }
  };

  const markLeadsDoNotContact = async (note: string): Promise<number> => {
    const cleanEmail = email.trim().toLowerCase();
    const cleanPhone = normalizePhone(phone);
    const tail = cleanPhone.replace(/\D/g, '').slice(-9);

    let query = supabase
      .from('sales_leads')
      .update({
        do_not_contact: true,
        do_not_contact_reason: note,
        do_not_contact_at: new Date().toISOString(),
        do_not_contact_by: user?.id ?? null,
        status: 'lost',
      });

    const filters: string[] = [];
    if (cleanEmail) filters.push(`email.ilike.${cleanEmail}`);
    if (tail) filters.push(`phone.ilike.%${tail}%`);
    if (!filters.length) return 0;
    query = query.or(filters.join(','));

    const { data, error: updErr } = await query.select('id');
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

    const cleanEmail = email.trim().toLowerCase();
    const cleanPhone = normalizePhone(phone);

    if (!cleanEmail && !cleanPhone) {
      setError('Enter an email or phone number.');
      return;
    }

    if (cleanEmail) {
      const parsed = emailSchema.safeParse(cleanEmail);
      if (!parsed.success) {
        setError(parsed.error.issues[0].message);
        return;
      }
    }

    const wantsEmailChange = !!cleanEmail;
    const wantsCallStop = stopCalls && (cleanEmail || cleanPhone);

    if (!wantsEmailChange && !wantsCallStop) {
      setError('Nothing to do — provide an email to set a preference, or tick "stop calls" with a phone/email.');
      return;
    }

    const noteBase =
      reason.trim() ||
      (wantsEmailChange
        ? `Staff set frequency to "${frequency}" via admin dashboard`
        : 'Customer asked not to be contacted by phone');

    setSubmitting(true);
    try {
      if (wantsEmailChange) {
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
      }

      let leadsUpdated = 0;
      if (wantsCallStop) {
        leadsUpdated = await markLeadsDoNotContact(noteBase);
        if (leadsUpdated > 0) {
          toast.success(`Removed ${leadsUpdated} lead${leadsUpdated === 1 ? '' : 's'} from calling lists`);
        } else if (!wantsEmailChange) {
          toast.info('No matching leads found to update');
        }
      }

      setLastUpdated({
        email: wantsEmailChange ? cleanEmail : null,
        phone: cleanPhone || null,
        frequency: wantsEmailChange ? frequency : null,
        leadsUpdated,
      });
      setEmail('');
      setPhone('');
      setReason('');
      setMatches(null);
    } catch (err) {
      // toast already shown
    } finally {
      setSubmitting(false);
    }
  };

  const recent = unsubscribes.slice(0, 10);

  return (
    <div className="space-y-6 max-w-3xl">
      <div>
        <h2 className="text-2xl font-bold flex items-center gap-2">
          <MailX className="h-6 w-6 text-destructive" />
          Unsubscribe & Do Not Contact
        </h2>
        <p className="text-muted-foreground mt-1">
          Stop marketing emails and/or phone calls for a customer. Search by email or phone to
          preview matches before saving.
        </p>
      </div>

      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2 text-lg">
            <Mail className="h-5 w-5 text-orange-600" />
            Find the customer
          </CardTitle>
          <CardDescription>
            Enter either an email, a phone number, or both. Phone numbers are matched on the last 9 digits.
          </CardDescription>
        </CardHeader>
        <CardContent>
          <form onSubmit={handleSubmit} className="space-y-5">
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
              <div>
                <Label htmlFor="unsubscribe-email">Email address</Label>
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
                />
                {email && isBlocked(email) && (
                  <p className="text-sm text-amber-600 mt-1 flex items-center gap-1">
                    <ShieldCheck className="h-4 w-4" />
                    Already set to "No emails".
                  </p>
                )}
              </div>
              <div>
                <Label htmlFor="unsubscribe-phone">Phone number</Label>
                <Input
                  id="unsubscribe-phone"
                  type="tel"
                  placeholder="07123 456 789"
                  value={phone}
                  onChange={(e) => {
                    setPhone(e.target.value);
                    setError(null);
                    setLastUpdated(null);
                  }}
                  autoComplete="off"
                  className="mt-1"
                />
              </div>
            </div>

            {error && (
              <Alert variant="destructive">
                <AlertCircle className="h-4 w-4" />
                <AlertDescription>{error}</AlertDescription>
              </Alert>
            )}

            <div>
              <Button
                type="button"
                variant="outline"
                onClick={handleSearch}
                disabled={searching || (!email.trim() && !phone.trim())}
              >
                {searching ? (
                  <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                ) : (
                  <Search className="h-4 w-4 mr-2" />
                )}
                Search matching leads
              </Button>
            </div>

            {matches && matches.length > 0 && (
              <div className="border rounded-lg divide-y bg-muted/30">
                <div className="p-2 text-xs text-muted-foreground font-medium">
                  {matches.length} matching lead{matches.length === 1 ? '' : 's'}
                </div>
                {matches.map((m) => (
                  <div key={m.id} className="p-3 text-sm flex items-start justify-between gap-3">
                    <div>
                      <div className="font-medium">{m.customer_name || '(no name)'}</div>
                      <div className="text-xs text-muted-foreground">
                        {m.email || '—'} · {m.phone || '—'}
                      </div>
                    </div>
                    <div className="flex flex-col items-end gap-1">
                      <Badge variant="outline" className="text-xs">
                        {m.status || 'new'}
                      </Badge>
                      {m.do_not_contact && (
                        <Badge variant="destructive" className="text-xs">
                          DNC
                        </Badge>
                      )}
                    </div>
                  </div>
                ))}
              </div>
            )}

            <div>
              <Label>Email frequency {!email.trim() && <span className="text-xs text-muted-foreground">(requires email)</span>}</Label>
              <RadioGroup
                value={frequency}
                onValueChange={(v) => setFrequencyState(v as EmailFrequency)}
                className="mt-2 space-y-2"
              >
                <label htmlFor="freq-all" className="flex items-start gap-3 p-3 border rounded-lg cursor-pointer hover:bg-muted/50">
                  <RadioGroupItem value="all" id="freq-all" className="mt-1" />
                  <div className="flex-1">
                    <div className="font-medium">All emails</div>
                    <div className="text-sm text-muted-foreground">Renewal offers, member discounts, news and tips.</div>
                  </div>
                </label>
                <label htmlFor="freq-essentials" className="flex items-start gap-3 p-3 border rounded-lg cursor-pointer hover:bg-muted/50">
                  <RadioGroupItem value="essentials" id="freq-essentials" className="mt-1" />
                  <div className="flex-1">
                    <div className="font-medium">Just the essentials</div>
                    <div className="text-sm text-muted-foreground">
                      Only renewal reminders and the occasional claims/policy tip. About 3-4 emails a year.
                    </div>
                  </div>
                </label>
                <label htmlFor="freq-off" className="flex items-start gap-3 p-3 border rounded-lg cursor-pointer hover:bg-muted/50">
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

            <div className="flex items-start gap-3 p-3 border rounded-lg bg-amber-50/40">
              <Checkbox
                id="stop-calls"
                checked={stopCalls}
                onCheckedChange={(v) => setStopCalls(v === true)}
                className="mt-1"
              />
              <label htmlFor="stop-calls" className="flex-1 cursor-pointer">
                <div className="font-medium flex items-center gap-2">
                  <PhoneOff className="h-4 w-4 text-amber-700" />
                  Remove from New Leads (stop phone calls)
                </div>
                <div className="text-sm text-muted-foreground">
                  Marks every matching sales lead (by email or phone) as Do Not Contact and moves
                  them to Lost so agents won't call this customer again.
                </div>
              </label>
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
              variant={frequency === 'off' || stopCalls ? 'destructive' : 'default'}
              disabled={submitting || setFrequency.isPending || (!email.trim() && !phone.trim())}
              className="w-full sm:w-auto"
            >
              {submitting || setFrequency.isPending ? (
                <Loader2 className="h-4 w-4 mr-2 animate-spin" />
              ) : frequency === 'off' || stopCalls ? (
                <Ban className="h-4 w-4 mr-2" />
              ) : (
                <Mail className="h-4 w-4 mr-2" />
              )}
              {submitting || setFrequency.isPending
                ? 'Saving…'
                : email.trim()
                ? `Save: ${frequencyLabel(frequency)}${stopCalls ? ' + stop calls' : ''}`
                : 'Stop calls (Do Not Contact)'}
            </Button>
          </form>

          {lastUpdated && (
            <Alert className="mt-4 border-green-200 bg-green-50">
              <CheckCircle2 className="h-4 w-4 text-green-600" />
              <AlertDescription className="text-green-800">
                {lastUpdated.email && lastUpdated.frequency && (
                  <>
                    <strong>{lastUpdated.email}</strong> is now set to{' '}
                    <strong>{frequencyLabel(lastUpdated.frequency)}</strong>.{' '}
                  </>
                )}
                {lastUpdated.leadsUpdated > 0 && (
                  <>
                    Removed from <strong>{lastUpdated.leadsUpdated}</strong> sales lead
                    {lastUpdated.leadsUpdated === 1 ? '' : 's'}
                    {lastUpdated.phone && !lastUpdated.email && (
                      <> matching <strong>{lastUpdated.phone}</strong></>
                    )}
                    .
                  </>
                )}
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
