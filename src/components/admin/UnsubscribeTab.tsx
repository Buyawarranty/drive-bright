import React, { useState } from 'react';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { Alert, AlertDescription } from '@/components/ui/alert';
import { RadioGroup, RadioGroupItem } from '@/components/ui/radio-group';
import { Badge } from '@/components/ui/badge';
import {
  MailX,
  CheckCircle2,
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
import { LeadSearchPopover, type LeadData } from '@/components/admin/LeadSearchPopover';

const emailSchema = z.string().trim().email('Please enter a valid email address').max(255);

type LeadMatch = {
  id: string;
  first_name: string | null;
  last_name: string | null;
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
  const [error, setError] = useState<string | null>(null);
  const [searching, setSearching] = useState(false);
  const [matches, setMatches] = useState<LeadMatch[] | null>(null);

  const [emailSaving, setEmailSaving] = useState(false);
  const [callsSaving, setCallsSaving] = useState(false);
  const [lastEmailUpdate, setLastEmailUpdate] = useState<{ email: string; frequency: EmailFrequency } | null>(null);
  const [lastCallsUpdate, setLastCallsUpdate] = useState<{ count: number; phone: string | null } | null>(null);

  const frequencyLabel = (f: EmailFrequency) =>
    f === 'off' ? 'No emails' : f === 'essentials' ? 'Essentials only' : 'All emails';

  const handleSearch = async () => {
    setError(null);
    setMatches(null);
    setLastEmailUpdate(null);
    setLastCallsUpdate(null);
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
        .select('id, first_name, last_name, email, phone, status, do_not_contact, created_at')
        .order('created_at', { ascending: false })
        .limit(25);

      const filters: string[] = [];
      if (cleanEmail) filters.push(`email.ilike.${cleanEmail}`);
      if (cleanPhone) {
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

  const handleUpdateEmail = async () => {
    setError(null);
    setLastEmailUpdate(null);
    setLastCallsUpdate(null);

    const cleanEmail = email.trim().toLowerCase();
    if (!cleanEmail) {
      setError('Enter an email address to update email preferences.');
      return;
    }
    const parsed = emailSchema.safeParse(cleanEmail);
    if (!parsed.success) {
      setError(parsed.error.issues[0].message);
      return;
    }

    const note = reason.trim() || `Staff set frequency to "${frequency}" via admin dashboard`;
    setEmailSaving(true);
    try {
      await new Promise<void>((resolve, reject) => {
        setFrequency.mutate(
          {
            email: cleanEmail,
            frequency,
            reason: note,
            source: 'staff_unsubscribe',
            unsubscribedBy: user?.id,
            unsubscribedByName: user?.email ?? undefined,
          },
          { onSuccess: () => resolve(), onError: (err) => reject(err) }
        );
      });
      setLastEmailUpdate({ email: cleanEmail, frequency });
    } catch {
      // toast already shown
    } finally {
      setEmailSaving(false);
    }
  };

  const handleStopCalls = async () => {
    setError(null);
    setLastEmailUpdate(null);
    setLastCallsUpdate(null);

    const cleanEmail = email.trim().toLowerCase();
    const cleanPhone = normalizePhone(phone);
    if (!cleanEmail && !cleanPhone) {
      setError('Enter an email or phone number to remove from leads.');
      return;
    }

    const note = reason.trim() || 'Customer asked not to be contacted by phone';
    setCallsSaving(true);
    try {
      const count = await markLeadsDoNotContact(note);
      setLastCallsUpdate({ count, phone: cleanPhone || null });
      if (count > 0) {
        toast.success(`Removed ${count} lead${count === 1 ? '' : 's'} from calling lists`);
      } else {
        toast.info('No matching leads found to update');
      }
    } catch {
      // toast already shown
    } finally {
      setCallsSaving(false);
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
          Search for a customer below, then choose whether to update their email preference,
          remove them from lead calling lists, or both.
        </p>
      </div>

      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2 text-lg">
            <Search className="h-5 w-5 text-orange-600" />
            Find the customer
          </CardTitle>
          <CardDescription>
            Enter either an email, a phone number, or both. Phone numbers are matched on the last 9 digits.
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
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
                  setLastEmailUpdate(null);
                  setLastCallsUpdate(null);
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
                  setLastEmailUpdate(null);
                  setLastCallsUpdate(null);
                }}
                autoComplete="off"
                className="mt-1"
              />
            </div>
          </div>

          <div className="flex flex-wrap items-center gap-2">
            <Button
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

            <LeadSearchPopover
              className="h-10 px-4 text-sm"
              onSelectLead={(lead: LeadData) => {
                setEmail(lead.email || '');
                setPhone(lead.phone || '');
                setError(null);
                setLastEmailUpdate(null);
                setLastCallsUpdate(null);
                toast.success(`Imported ${lead.email || lead.phone || 'lead'}`);
              }}
            />
          </div>

          {error && (
            <Alert variant="destructive">
              <AlertCircle className="h-4 w-4" />
              <AlertDescription>{error}</AlertDescription>
            </Alert>
          )}

          {matches && matches.length > 0 && (
            <div className="border rounded-lg divide-y bg-muted/30">
              <div className="p-2 text-xs text-muted-foreground font-medium">
                {matches.length} matching lead{matches.length === 1 ? '' : 's'}
              </div>
              {matches.map((m) => (
                <div key={m.id} className="p-3 text-sm flex items-start justify-between gap-3">
                  <div>
                    <div className="font-medium">{[m.first_name, m.last_name].filter(Boolean).join(' ') || '(no name)'}</div>
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
        </CardContent>
      </Card>

      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2 text-base">
              <Mail className="h-5 w-5 text-orange-600" />
              Email preference
            </CardTitle>
            <CardDescription>Update how many marketing emails this customer receives.</CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            <RadioGroup
              value={frequency}
              onValueChange={(v) => setFrequencyState(v as EmailFrequency)}
              className="space-y-2"
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

            <Button
              onClick={handleUpdateEmail}
              disabled={emailSaving || setFrequency.isPending || !email.trim()}
              className="w-full"
            >
              {emailSaving || setFrequency.isPending ? (
                <Loader2 className="h-4 w-4 mr-2 animate-spin" />
              ) : (
                <Mail className="h-4 w-4 mr-2" />
              )}
              {emailSaving || setFrequency.isPending ? 'Saving…' : `Update email preference`}
            </Button>

            {lastEmailUpdate && (
              <Alert className="border-green-200 bg-green-50">
                <CheckCircle2 className="h-4 w-4 text-green-600" />
                <AlertDescription className="text-green-800">
                  <strong>{lastEmailUpdate.email}</strong> is now set to{' '}
                  <strong>{frequencyLabel(lastEmailUpdate.frequency)}</strong>.
                </AlertDescription>
              </Alert>
            )}
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2 text-base">
              <PhoneOff className="h-5 w-5 text-amber-700" />
              Stop phone calls
            </CardTitle>
            <CardDescription>Remove matching leads from new-lead calling lists.</CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="p-4 border rounded-lg bg-amber-50/40 text-sm space-y-2">
              <p className="font-medium">What this does</p>
              <ul className="list-disc list-inside text-muted-foreground space-y-1">
                <li>Marks every matching sales lead as <strong>Do Not Contact</strong></li>
                <li>Moves them to <strong>Lost</strong> status</li>
                <li>Agents will no longer see them in calling lists</li>
              </ul>
            </div>

            <Button
              onClick={handleStopCalls}
              disabled={callsSaving || (!email.trim() && !phone.trim())}
              variant="destructive"
              className="w-full"
            >
              {callsSaving ? (
                <Loader2 className="h-4 w-4 mr-2 animate-spin" />
              ) : (
                <PhoneOff className="h-4 w-4 mr-2" />
              )}
              {callsSaving ? 'Saving…' : 'Remove from New Leads'}
            </Button>

            {lastCallsUpdate && (
              <Alert className="border-green-200 bg-green-50">
                <CheckCircle2 className="h-4 w-4 text-green-600" />
                <AlertDescription className="text-green-800">
                  {lastCallsUpdate.count > 0 ? (
                    <>
                      Removed <strong>{lastCallsUpdate.count}</strong> lead{lastCallsUpdate.count === 1 ? '' : 's'} from calling lists
                      {lastCallsUpdate.phone && <> matching <strong>{lastCallsUpdate.phone}</strong></>}.
                    </>
                  ) : (
                    <>No matching leads found to update.</>
                  )}
                </AlertDescription>
              </Alert>
            )}
          </CardContent>
        </Card>
      </div>

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
