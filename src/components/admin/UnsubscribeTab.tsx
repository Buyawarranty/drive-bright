import React, { useEffect, useState } from 'react';
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
  Ban,
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
  const [listSearch, setListSearch] = useState('');
  const [quickSearch, setQuickSearch] = useState('');
  const [quickMatches, setQuickMatches] = useState<LeadData[]>([]);
  const [quickSearching, setQuickSearching] = useState(false);
  const [showSuggestions, setShowSuggestions] = useState(false);
  const [comboSaving, setComboSaving] = useState(false);
  const [lastComboUpdate, setLastComboUpdate] = useState<{ email: string; count: number } | null>(null);




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

  const handleQuickSearch = async () => {
    const term = quickSearch.trim();
    if (!term) return;
    setError(null);
    setQuickSearching(true);
    try {
      const like = `%${term}%`;
      const compact = term.replace(/\s+/g, '').toUpperCase();
      const regVariants = new Set<string>([term]);
      if (compact.length >= 5) {
        regVariants.add(compact);
        regVariants.add(`${compact.slice(0, -3)} ${compact.slice(-3)}`);
      }
      const regClauses = Array.from(regVariants).map((v) => `vehicle_reg.ilike.%${v}%`).join(',');

      const [slRes, cartRes] = await Promise.all([
        supabase
          .from('sales_leads')
          .select('id, first_name, last_name, email, phone, vehicle_reg, vehicle_make, vehicle_model, vehicle_year, mileage, plan_interest')
          .or(`email.ilike.${like},first_name.ilike.${like},last_name.ilike.${like},phone.ilike.${like},${regClauses}`)
          .eq('is_paid', false)
          .order('created_at', { ascending: false })
          .limit(25),
        supabase
          .from('abandoned_carts')
          .select('id, full_name, email, phone, vehicle_reg, vehicle_make, vehicle_model, vehicle_year, mileage, plan_name, updated_at')
          .or(`email.ilike.${like},full_name.ilike.${like},phone.ilike.${like},${regClauses}`)
          .eq('is_converted', false)
          .order('updated_at', { ascending: false })
          .limit(25),
      ]);

      const merged: LeadData[] = [...((slRes.data as any[]) || [])];
      const seen = new Set(
        merged.map((l) => `${(l.email || '').toLowerCase()}|${(l.vehicle_reg || '').replace(/\s/g, '').toUpperCase()}`)
      );
      for (const c of (cartRes.data as any[]) || []) {
        const key = `${(c.email || '').toLowerCase()}|${(c.vehicle_reg || '').replace(/\s/g, '').toUpperCase()}`;
        if (seen.has(key)) continue;
        seen.add(key);
        const parts = (c.full_name || '').trim().split(/\s+/);
        merged.push({
          id: `cart:${c.id}`,
          first_name: parts[0] || null,
          last_name: parts.slice(1).join(' ') || null,
          email: c.email,
          phone: c.phone,
          vehicle_reg: c.vehicle_reg,
          vehicle_make: c.vehicle_make,
          vehicle_model: c.vehicle_model,
          vehicle_year: c.vehicle_year,
          mileage: c.mileage != null ? String(c.mileage) : null,
          plan_interest: c.plan_name || null,
        });
      }
      setQuickMatches(merged);
    } catch (err: any) {
      console.error('Quick search failed', err);
    } finally {
      setQuickSearching(false);
    }
  };

  // Type-ahead: search automatically as the user types (min 2 characters).
  useEffect(() => {
    const term = quickSearch.trim();
    if (term.length < 2) {
      setQuickMatches([]);
      return;
    }
    const t = setTimeout(() => {
      handleQuickSearch();
    }, 300);
    return () => clearTimeout(t);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [quickSearch]);



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

  // Main action: most people who ask to stop emails also want the calls to stop.
  const handleStopEverything = async () => {
    setError(null);
    setLastEmailUpdate(null);
    setLastCallsUpdate(null);
    setLastComboUpdate(null);

    const cleanEmail = email.trim().toLowerCase();
    const cleanPhone = normalizePhone(phone);
    if (!cleanEmail && !cleanPhone) {
      setError('Find a customer first — enter an email or phone number.');
      return;
    }
    if (cleanEmail) {
      const parsed = emailSchema.safeParse(cleanEmail);
      if (!parsed.success) {
        setError(parsed.error.issues[0].message);
        return;
      }
    }

    const note = reason.trim() || 'Customer asked us to stop all emails and calls';
    setComboSaving(true);
    try {
      if (cleanEmail) {
        await new Promise<void>((resolve, reject) => {
          setFrequency.mutate(
            {
              email: cleanEmail,
              frequency: 'off',
              reason: note,
              source: 'staff_unsubscribe',
              unsubscribedBy: user?.id,
              unsubscribedByName: user?.email ?? undefined,
            },
            { onSuccess: () => resolve(), onError: (err) => reject(err) }
          );
        });
      }
      const count = await markLeadsDoNotContact(note);
      setFrequencyState('off');
      setLastComboUpdate({ email: cleanEmail, count });
      toast.success(
        `Stopped all contact${cleanEmail ? ` for ${cleanEmail}` : ''} · ${count} lead${count === 1 ? '' : 's'} removed from calling lists`
      );
    } catch {
      // toast already shown
    } finally {
      setComboSaving(false);
    }
  };



  const filteredUnsubscribes = unsubscribes.filter((u) => {
    const term = listSearch.trim().toLowerCase();
    if (!term) return true;
    const haystack = [
      u.email,
      u.customer_name,
      u.vehicle_reg,
      u.reason,
      u.source,
      u.unsubscribed_by_name,
    ]
      .filter(Boolean)
      .join(' ')
      .toLowerCase();
    return haystack.includes(term);
  });


  return (
    <div className="space-y-6 max-w-3xl">
      <div>
        <h2 className="text-2xl font-bold flex items-center gap-2">
          <MailX className="h-6 w-6 text-destructive" />
          Unsubscribe & Do Not Contact
        </h2>
        <p className="text-muted-foreground mt-1">
          Start typing a name or email to find someone, then stop everything in one click — or
          fine-tune emails and calls separately below.
        </p>
      </div>

      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2 text-lg">
            <Search className="h-5 w-5 text-orange-600" />
            Find the customer
          </CardTitle>
          <CardDescription>
            Type the first few letters of a name, email, phone or reg — suggestions appear as you type.
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="relative">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
            <Input
              placeholder="Start typing a name, email, phone or reg…"
              value={quickSearch}
              onChange={(e) => {
                setQuickSearch(e.target.value);
                setShowSuggestions(true);
              }}
              onFocus={() => setShowSuggestions(true)}
              onBlur={() => setTimeout(() => setShowSuggestions(false), 150)}
              autoComplete="off"
              className="pl-9 h-11"
            />
            {quickSearching && (
              <Loader2 className="absolute right-3 top-1/2 -translate-y-1/2 h-4 w-4 animate-spin text-muted-foreground" />
            )}

            {showSuggestions && quickSearch.trim().length >= 2 && (
              <div className="absolute z-50 mt-1 w-full rounded-lg border bg-popover shadow-lg max-h-72 overflow-y-auto">
                {quickMatches.length === 0 ? (
                  <div className="p-3 text-sm text-muted-foreground">
                    {quickSearching ? 'Searching…' : 'No matches yet — keep typing.'}
                  </div>
                ) : (
                  quickMatches.map((lead) => (
                    <button
                      key={lead.id}
                      type="button"
                      className="w-full text-left px-3 py-2 hover:bg-muted/70 border-b last:border-b-0"
                      onMouseDown={(e) => e.preventDefault()}
                      onClick={() => {
                        setEmail(lead.email || '');
                        setPhone(lead.phone || '');
                        setError(null);
                        setLastEmailUpdate(null);
                        setLastCallsUpdate(null);
                        setLastComboUpdate(null);
                        setQuickSearch(
                          [lead.first_name, lead.last_name].filter(Boolean).join(' ') ||
                            lead.email ||
                            ''
                        );
                        setShowSuggestions(false);
                      }}
                    >
                      <div className="text-sm font-medium">
                        {[lead.first_name, lead.last_name].filter(Boolean).join(' ') || '(no name)'}
                      </div>
                      <div className="text-xs text-muted-foreground">
                        {lead.email || '—'} · {lead.phone || '—'}
                        {lead.vehicle_reg ? ` · ${lead.vehicle_reg}` : ''}
                      </div>
                    </button>
                  ))
                )}
              </div>
            )}
          </div>


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

      <Card className="border-destructive/40">
        <CardHeader>
          <CardTitle className="flex items-center gap-2 text-lg">
            <Ban className="h-5 w-5 text-destructive" />
            Stop all contact
          </CardTitle>
          <CardDescription>
            Most people who ask to stop emails also want the calls to stop. This does both in one
            click: no marketing emails, and every matching lead removed from calling lists.
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-3">
          <Button
            onClick={handleStopEverything}
            disabled={comboSaving || (!email.trim() && !phone.trim())}
            variant="destructive"
            size="lg"
            className="w-full"
          >
            {comboSaving ? (
              <Loader2 className="h-4 w-4 mr-2 animate-spin" />
            ) : (
              <Ban className="h-4 w-4 mr-2" />
            )}
            {comboSaving ? 'Stopping…' : 'Stop emails and calls'}
          </Button>
          <p className="text-xs text-muted-foreground text-center">
            Policy documents and claims updates still send.
          </p>

          {lastComboUpdate && (
            <Alert className="border-green-200 bg-green-50">
              <CheckCircle2 className="h-4 w-4 text-green-600" />
              <AlertDescription className="text-green-800">
                All contact stopped{lastComboUpdate.email && <> for <strong>{lastComboUpdate.email}</strong></>} ·{' '}
                <strong>{lastComboUpdate.count}</strong> lead{lastComboUpdate.count === 1 ? '' : 's'} removed from calling lists.
              </AlertDescription>
            </Alert>
          )}
        </CardContent>
      </Card>

      <div className="text-sm font-medium text-muted-foreground">Or change just one thing</div>

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
          <div className="flex flex-col sm:flex-row sm:items-start sm:justify-between gap-4">
            <div>
              <CardTitle className="text-base">Recently unsubscribed</CardTitle>
              <CardDescription>
                {filteredUnsubscribes.length} customer{filteredUnsubscribes.length === 1 ? '' : 's'} currently opted out
              </CardDescription>
            </div>
            <div className="relative w-full sm:w-72">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
              <Input
                placeholder="Search by name, email, reg, reason..."
                value={listSearch}
                onChange={(e) => setListSearch(e.target.value)}
                className="pl-9"
              />
            </div>
          </div>
        </CardHeader>
        <CardContent>
          {filteredUnsubscribes.length === 0 ? (
            <p className="text-sm text-muted-foreground">
              {listSearch ? 'No matches for your search.' : 'No unsubscribes yet.'}
            </p>
          ) : (
            <div className="max-h-[500px] overflow-y-auto">
              <ul className="divide-y">
                {filteredUnsubscribes.map((u) => (
                  <li key={u.id} className="py-2 flex items-center justify-between text-sm">
                    <div>
                      <p className="font-medium">{u.email}</p>
                      {u.customer_name && (
                        <p className="text-xs text-muted-foreground">{u.customer_name}</p>
                      )}
                      {u.reason && <p className="text-xs text-muted-foreground">{u.reason}</p>}
                    </div>
                    <div className="flex flex-col items-end gap-1">
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
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  );
};


export default UnsubscribeTab;
