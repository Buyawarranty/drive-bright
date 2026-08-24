/**
 * FINAL-STAGE APPEAL
 * ---------------------------------------------------------------------------
 * Used after a complaint has been through the process and the outcome still
 * stands. The claims team:
 *   1. picks the customer / claim
 *   2. drafts the grounds for appeal
 *   3. chooses whether the customer has agreed to an INDEPENDENT REVIEW
 *      (optional — an appeal can be made with no inspection and nothing to pay)
 *   4. generates the customer's APPEAL FORM link, and — if a review is agreed —
 *      the inspection form + payment page (£140 paid to the inspection company)
 *   5. PREVIEWS the exact email the customer will receive
 *   6. sends the email, stores the appeal, moves the claim to "appeal" and
 *      posts a notification in the customer's profile
 */

import React, { useEffect, useMemo, useState } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { Button } from '@/components/ui/button';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { Badge } from '@/components/ui/badge';
import { Card, CardContent } from '@/components/ui/card';
import { Checkbox } from '@/components/ui/checkbox';
import { useToast } from '@/hooks/use-toast';
import {
  Loader2, Search, Gavel, ExternalLink, Send, ArrowLeft, CheckCircle2, Copy, Eye, Mail,
} from 'lucide-react';
import {
  buildAppealEmailHtml,
  buildAppealEmailSubject,
} from '@/lib/appealEmailTemplate';
import { Worldpay140LinkButton } from '@/components/admin/Worldpay140LinkButton';

export const INDEPENDENT_REVIEWERS = [
  {
    id: 'either',
    name: 'Scotia or ACE — whichever is available',
    url: 'http://scotiavehicleinspection.com/',
    blurb: 'Whichever independent inspector is available will be booked.',
  },
  {
    id: 'scotia',
    name: 'Scotia Vehicle Inspection',
    url: 'http://scotiavehicleinspection.com/',
    blurb: 'Independent engineer report, UK-wide coverage.',
  },
  {
    id: 'ace',
    name: 'ACE (ace-uk.org)',
    url: 'https://ace-uk.org',
    blurb: 'Independent vehicle assessment and engineer opinion.',
  },
] as const;

const DEFAULT_APPEAL_FEE = 140;

const DEFAULT_INTRO =
  'Thank you for coming back to us. We have opened a final appeal on your claim and it will be ' +
  'reviewed by our claims manager. Below is a summary of what we have recorded, along with the ' +
  'form we need you to complete.';

interface ClaimRow {
  id: string;
  name: string | null;
  email: string | null;
  phone?: string | null;
  status: string | null;
  vehicle_registration?: string | null;
  created_at: string;
}

interface ClaimAppealDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  claim?: ClaimRow | null;
  onSent?: () => void;
}

export const ClaimAppealDialog: React.FC<ClaimAppealDialogProps> = ({
  open,
  onOpenChange,
  claim = null,
  onSent,
}) => {
  const { toast } = useToast();
  const [search, setSearch] = useState('');
  const [searching, setSearching] = useState(false);
  const [results, setResults] = useState<ClaimRow[]>([]);
  const [selected, setSelected] = useState<ClaimRow | null>(claim);

  const [reason, setReason] = useState('');
  const [newEvidence, setNewEvidence] = useState('');
  const [withReview, setWithReview] = useState(true);
  const [reviewerId, setReviewerId] = useState<string>('either');
  const [appealFee, setAppealFee] = useState(String(DEFAULT_APPEAL_FEE));
  const [paymentLink, setPaymentLink] = useState('');
  const [formLink, setFormLink] = useState('');
  const [subject, setSubject] = useState('');
  const [intro, setIntro] = useState(DEFAULT_INTRO);
  const [notifyCustomer, setNotifyCustomer] = useState(true);
  const [reviewing, setReviewing] = useState(false);
  const [sending, setSending] = useState(false);
  const [generatingLink, setGeneratingLink] = useState(false);
  const [generatingForm, setGeneratingForm] = useState(false);

  useEffect(() => {
    if (open) setSelected(claim);
  }, [open, claim]);

  useEffect(() => {
    if (!open) {
      setSearch('');
      setResults([]);
      setReason('');
      setNewEvidence('');
      setWithReview(true);
      setReviewerId('either');
      setAppealFee(String(DEFAULT_APPEAL_FEE));
      setPaymentLink('');
      setFormLink('');
      setIntro(DEFAULT_INTRO);
      setNotifyCustomer(true);
      setReviewing(false);
      setGeneratingLink(false);
      setGeneratingForm(false);
    }
  }, [open]);

  useEffect(() => {
    setSubject(buildAppealEmailSubject(selected?.vehicle_registration));
  }, [selected?.vehicle_registration]);

  const reviewer = useMemo(
    () => INDEPENDENT_REVIEWERS.find((r) => r.id === reviewerId) || null,
    [reviewerId]
  );

  const feeNumber = Number(String(appealFee).replace(/[^0-9.]/g, '')) || 0;

  const emailHtml = useMemo(
    () =>
      buildAppealEmailHtml({
        customerName: selected?.name,
        registration: selected?.vehicle_registration,
        intro,
        grounds: reason || '—',
        newEvidence,
        withIndependentReview: withReview,
        reviewerName: reviewer?.name,
        reviewerUrl: reviewer?.url,
        fee: feeNumber || DEFAULT_APPEAL_FEE,
        paymentLink,
        appealFormLink: formLink,
      }),
    [selected, intro, reason, newEvidence, withReview, reviewer, feeNumber, paymentLink, formLink]
  );

  /** Real payable page: inspection form + card payment to the inspection company. */
  const generatePaymentLink = async () => {
    if (!selected) return;
    setGeneratingLink(true);
    try {
      const { data, error } = await supabase.functions.invoke('send-inspection-request', {
        body: {
          claimId: selected.id,
          recipientEmail: selected.email,
          inspectionCompany: reviewerId === 'scotia' ? 'Scotia' : 'ACE',
          feeAmount: feeNumber || DEFAULT_APPEAL_FEE,
          sendEmail: false,
        },
      });
      if (error) throw error;
      if (!data?.link) throw new Error(data?.error || 'No link returned');
      setPaymentLink(data.link);
      toast({ title: 'Inspection payment page created' });
    } catch (e: any) {
      toast({ title: 'Could not create payment link', description: e.message, variant: 'destructive' });
    } finally {
      setGeneratingLink(false);
    }
  };

  /** Customer-facing appeal form (their statement, invoices, photos). */
  const generateFormLink = async () => {
    if (!selected?.email) {
      toast({ title: 'This claim has no email address', variant: 'destructive' });
      return;
    }
    setGeneratingForm(true);
    try {
      const { data, error } = await supabase.functions.invoke('create-appeal-form-link', {
        body: { claimId: selected.id, recipientEmail: selected.email },
      });
      if (error) throw error;
      if (!data?.link) throw new Error(data?.error || 'No link returned');
      setFormLink(data.link);
      toast({ title: 'Appeal form created', description: 'Open it to see exactly what the customer fills in.' });
    } catch (e: any) {
      toast({ title: 'Could not create appeal form', description: e.message, variant: 'destructive' });
    } finally {
      setGeneratingForm(false);
    }
  };

  const runSearch = async () => {
    const term = search.trim();
    if (term.length < 2) return;
    setSearching(true);
    try {
      const like = `%${term}%`;
      const { data, error } = await supabase
        .from('claims_submissions')
        .select('id, name, email, phone, status, vehicle_registration, created_at')
        .or(`name.ilike.${like},email.ilike.${like},vehicle_registration.ilike.${like}`)
        .order('created_at', { ascending: false })
        .limit(15);
      if (error) throw error;
      setResults((data || []) as ClaimRow[]);
      if (!data?.length) {
        toast({ title: 'No claims found', description: 'Try a registration, email or name.' });
      }
    } catch (e: any) {
      toast({ title: 'Search failed', description: e.message, variant: 'destructive' });
    } finally {
      setSearching(false);
    }
  };

  const canReview =
    !!selected &&
    !!selected.email &&
    reason.trim().length > 10 &&
    !!formLink.trim() &&
    (!withReview || (!!reviewer && !!paymentLink.trim()));

  const handleSend = async () => {
    if (!selected) return;
    setSending(true);
    try {
      const { data: userRes } = await supabase.auth.getUser();
      const fee = withReview ? feeNumber : 0;

      // 1. Email the customer the appeal, the form link and (if agreed) the payment page.
      const { data: emailRes, error: emailErr } = await supabase.functions.invoke('send-appeal-email', {
        body: {
          to: selected.email,
          subject: subject.trim() || buildAppealEmailSubject(selected.vehicle_registration),
          html: emailHtml,
          claimId: selected.id,
          registration: selected.vehicle_registration,
        },
      });
      if (emailErr) throw emailErr;
      if (emailRes?.error) throw new Error(emailRes.error);

      // 2. Store the appeal.
      const { error: appealError } = await supabase.from('claim_appeals').insert({
        claim_id: selected.id,
        reason: reason.trim(),
        new_evidence: newEvidence.trim() || null,
        status: 'submitted',
        independent_reviewer: withReview ? reviewer?.name : 'No independent review (internal appeal)',
        reviewer_url: withReview ? reviewer?.url : null,
        appeal_fee: fee,
        payment_link: withReview ? paymentLink.trim() : formLink.trim(),
        sent_at: new Date().toISOString(),
        customer_email: selected.email,
        customer_notified: false,
        created_by: userRes?.user?.id ?? null,
      } as any);
      if (appealError) throw appealError;

      // 3. Claim moves to the appeal stage.
      const { error: statusError } = await supabase
        .from('claims_submissions')
        .update({ status: 'appeal', updated_at: new Date().toISOString() })
        .eq('id', selected.id);
      if (statusError) throw statusError;

      // 4. Portal notification.
      let notified = false;
      if (notifyCustomer && selected.email) {
        const { data: customer } = await supabase
          .from('customers')
          .select('id')
          .ilike('email', selected.email)
          .order('created_at', { ascending: false })
          .limit(1)
          .maybeSingle();
        if (customer?.id) {
          const { error: notifyError } = await supabase.from('customer_notifications').insert({
            customer_id: customer.id,
            is_important: true,
            created_by: userRes?.user?.id ?? null,
            message:
              `Your claim appeal has been opened${selected.vehicle_registration ? ` for ${selected.vehicle_registration}` : ''}. ` +
              `Complete your appeal form here: ${formLink.trim()}. ` +
              (withReview
                ? `You have asked for an independent review — the £${fee} inspection fee is paid to the independent inspection company, not to Buy a Warranty. Complete the inspection form and pay here: ${paymentLink.trim()}. `
                : `You have chosen to appeal without an independent inspection, so there is nothing to pay. `) +
              `We will post every update on this appeal here in your profile.`,
          });
          notified = !notifyError;
          if (!notifyError) {
            await supabase
              .from('claim_appeals')
              .update({ customer_notified: true })
              .eq('claim_id', selected.id)
              .is('customer_notified', false);
          }
        }
      }

      await supabase.from('claim_audit_log').insert({
        claim_id: selected.id,
        action: 'appeal_submitted',
        field: 'status',
        old_value: selected.status || null,
        new_value: 'appeal',
        reason: reason.trim().slice(0, 500),
        actor_id: userRes?.user?.id ?? null,
      } as any);

      toast({
        title: 'Appeal email sent',
        description: notified
          ? 'Claim set to appeal and the customer has been notified in their profile.'
          : 'Claim set to appeal. No matching customer profile found for a notification.',
      });
      onSent?.();
      onOpenChange(false);
    } catch (e: any) {
      toast({ title: 'Could not send appeal', description: e.message, variant: 'destructive' });
    } finally {
      setSending(false);
    }
  };

  const copy = (value: string, label: string) => {
    navigator.clipboard?.writeText(value);
    toast({ title: `${label} copied` });
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-3xl max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <Gavel className="h-5 w-5" />
            {reviewing ? 'Preview the email before sending' : 'Final appeal'}
          </DialogTitle>
          <DialogDescription>
            {reviewing
              ? 'This is exactly what the customer receives. Go back to edit anything.'
              : 'The final stage once a complaint has not changed the outcome. Sends the customer their appeal form, and — only if they agree — an independent review with the inspection payment page.'}
          </DialogDescription>
        </DialogHeader>

        {!reviewing ? (
          <div className="space-y-5">
            {/* Customer / claim selection */}
            <div className="space-y-2">
              <Label>Select customer / claim *</Label>
              {selected ? (
                <Card>
                  <CardContent className="flex items-center justify-between gap-3 py-3">
                    <div className="text-sm">
                      <p className="font-semibold">{selected.name || 'Unnamed'}</p>
                      <p className="text-muted-foreground">{selected.email || 'No email on this claim'}</p>
                      <p className="text-muted-foreground">
                        {selected.vehicle_registration || 'No reg'} ·{' '}
                        <Badge variant="outline">{selected.status}</Badge>
                      </p>
                    </div>
                    <Button variant="ghost" size="sm" onClick={() => setSelected(null)}>
                      Change
                    </Button>
                  </CardContent>
                </Card>
              ) : (
                <>
                  <div className="flex gap-2">
                    <Input
                      value={search}
                      onChange={(e) => setSearch(e.target.value)}
                      onKeyDown={(e) => e.key === 'Enter' && runSearch()}
                      placeholder="Search by registration, email or name"
                    />
                    <Button onClick={runSearch} disabled={searching} variant="outline">
                      {searching ? <Loader2 className="h-4 w-4 animate-spin" /> : <Search className="h-4 w-4" />}
                    </Button>
                  </div>
                  {results.length > 0 && (
                    <div className="max-h-52 overflow-y-auto rounded-md border divide-y">
                      {results.map((r) => (
                        <button
                          key={r.id}
                          type="button"
                          onClick={() => setSelected(r)}
                          className="w-full text-left px-3 py-2 text-sm hover:bg-muted"
                        >
                          <span className="font-medium">{r.name || 'Unnamed'}</span>{' '}
                          <span className="text-muted-foreground">
                            · {r.vehicle_registration || 'no reg'} · {r.email} · {r.status}
                          </span>
                        </button>
                      ))}
                    </div>
                  )}
                </>
              )}
            </div>

            <div className="space-y-2">
              <Label>Grounds for appeal *</Label>
              <Textarea
                rows={4}
                value={reason}
                onChange={(e) => setReason(e.target.value)}
                placeholder="Why the decision is being appealed — reference the policy terms, the engineer's findings and the complaint outcome."
              />
            </div>

            <div className="space-y-2">
              <Label>New evidence supplied</Label>
              <Textarea
                rows={3}
                value={newEvidence}
                onChange={(e) => setNewEvidence(e.target.value)}
                placeholder="Garage reports, invoices, photos, service history — anything not seen at the original decision."
              />
            </div>

            {/* Appeal form the customer fills in */}
            <div className="space-y-2 rounded-lg border p-3">
              <Label>Customer's appeal form *</Label>
              <p className="text-xs text-muted-foreground">
                A secure page where the customer gives their account of the fault and uploads
                invoices, photos and service history. This link goes in the email.
              </p>
              <div className="flex gap-2">
                <Input value={formLink} readOnly placeholder="Generate the customer's appeal form" />
                <Button type="button" variant="outline" onClick={generateFormLink} disabled={!selected || generatingForm}>
                  {generatingForm ? <Loader2 className="h-4 w-4 animate-spin" /> : 'Generate'}
                </Button>
                {formLink && (
                  <>
                    <Button type="button" variant="ghost" onClick={() => window.open(formLink, '_blank')} title="Preview the form">
                      <Eye className="h-4 w-4" />
                    </Button>
                    <Button type="button" variant="ghost" onClick={() => copy(formLink, 'Appeal form link')}>
                      <Copy className="h-4 w-4" />
                    </Button>
                  </>
                )}
              </div>
            </div>

            {/* Independent review — optional */}
            <div className="space-y-3 rounded-lg border p-3">
              <label className="flex items-start gap-2 text-sm font-medium">
                <Checkbox
                  checked={withReview}
                  onCheckedChange={(v) => setWithReview(v === true)}
                  className="mt-0.5"
                />
                <span>
                  The customer agrees to an independent review (Scotia / ACE)
                  <span className="block text-xs font-normal text-muted-foreground">
                    Leave this unticked to submit the appeal without an inspection — there is then
                    nothing for the customer to pay and our claims manager reviews it internally.
                  </span>
                </span>
              </label>

              {withReview && (
                <>
                  <p className="text-xs text-muted-foreground">
                    Whichever inspector is available will be booked. The £{feeNumber} inspection fee is
                    paid to the independent inspection company — it is not a Buy a Warranty charge and
                    we keep none of it.
                  </p>
                  <div className="grid gap-3 sm:grid-cols-3">
                    {INDEPENDENT_REVIEWERS.map((r) => (
                      <Card
                        key={r.id}
                        onClick={() => setReviewerId(r.id)}
                        className={`cursor-pointer transition-colors ${
                          reviewerId === r.id ? 'border-primary ring-2 ring-primary/25' : 'hover:border-muted-foreground/40'
                        }`}
                      >
                        <CardContent className="py-3 space-y-1">
                          <div className="flex items-center justify-between">
                            <p className="font-semibold text-sm">{r.name}</p>
                            {reviewerId === r.id && <CheckCircle2 className="h-4 w-4 text-primary" />}
                          </div>
                          <p className="text-xs text-muted-foreground">{r.blurb}</p>
                          <a
                            href={r.url}
                            target="_blank"
                            rel="noopener noreferrer"
                            onClick={(e) => e.stopPropagation()}
                            className="inline-flex items-center gap-1 text-xs text-primary underline"
                          >
                            Visit website <ExternalLink className="h-3 w-3" />
                          </a>
                        </CardContent>
                      </Card>
                    ))}
                  </div>

                  <div className="grid gap-4 sm:grid-cols-2">
                    <div className="space-y-2">
                      <Label>Inspection fee (£) — payable to the inspection company</Label>
                      <Input
                        type="number"
                        min="0"
                        step="1"
                        value={appealFee}
                        onChange={(e) => setAppealFee(e.target.value)}
                      />
                    </div>
                    <div className="space-y-2">
                      <Label>Inspection payment link *</Label>
                      <div className="flex gap-2">
                        <Input value={paymentLink} readOnly placeholder="Generate the customer's secure payment page" />
                        <Button
                          type="button"
                          variant="outline"
                          onClick={generatePaymentLink}
                          disabled={!selected || generatingLink}
                        >
                          {generatingLink ? <Loader2 className="h-4 w-4 animate-spin" /> : 'Generate'}
                        </Button>
                        {paymentLink && (
                          <>
                            <Button type="button" variant="ghost" onClick={() => window.open(paymentLink, '_blank')} title="Preview the page">
                              <Eye className="h-4 w-4" />
                            </Button>
                            <Button type="button" variant="ghost" onClick={() => copy(paymentLink, 'Payment link')}>
                              <Copy className="h-4 w-4" />
                            </Button>
                          </>
                        )}
                      </div>
                      <p className="text-xs text-muted-foreground">
                        Creates a real, working page where the customer completes the inspection form
                        and pays £{feeNumber} to the independent inspection company.
                      </p>
                    </div>
                  </div>

                  <div className="rounded-md border border-dashed border-border bg-muted/20 p-3">
                    <p className="text-xs text-muted-foreground mb-2">
                      Alternatively, generate a standalone Worldpay £140 pay-by-link that you can copy
                      and send to the customer by email, SMS or WhatsApp.
                    </p>
                    <Worldpay140LinkButton
                      label="Generate Worldpay £140 link"
                      className="bg-background hover:bg-muted"
                    />
                  </div>
                </>
              )}
            </div>

            {/* Email */}
            <div className="space-y-3 rounded-lg border p-3">
              <div className="flex items-center gap-2 text-sm font-medium">
                <Mail className="h-4 w-4" /> Email to the customer
              </div>
              <div className="space-y-2">
                <Label>Subject</Label>
                <Input value={subject} onChange={(e) => setSubject(e.target.value)} />
              </div>
              <div className="space-y-2">
                <Label>Opening message</Label>
                <Textarea rows={3} value={intro} onChange={(e) => setIntro(e.target.value)} />
              </div>
            </div>

            <label className="flex items-center gap-2 text-sm">
              <Checkbox
                checked={notifyCustomer}
                onCheckedChange={(v) => setNotifyCustomer(v === true)}
              />
              Post an update notification in the customer's profile
            </label>
          </div>
        ) : (
          /* ── Email preview step ── */
          <div className="space-y-3 text-sm">
            <div className="rounded-md border bg-muted/40 p-3">
              <p><span className="text-muted-foreground">To:</span> {selected?.email}</p>
              <p><span className="text-muted-foreground">Subject:</span> {subject}</p>
              <p className="text-muted-foreground">
                {withReview
                  ? `Independent review agreed — ${reviewer?.name} · £${feeNumber} paid to the inspection company`
                  : 'No independent review — nothing for the customer to pay'}
              </p>
            </div>
            <iframe
              title="Appeal email preview"
              srcDoc={emailHtml}
              className="w-full h-[420px] rounded-md border bg-background"
            />
            <div className="flex flex-wrap gap-2">
              <Button variant="outline" size="sm" onClick={() => window.open(formLink, '_blank')} disabled={!formLink}>
                <Eye className="h-4 w-4 mr-1" /> Preview appeal form
              </Button>
              {withReview && (
                <Button variant="outline" size="sm" onClick={() => window.open(paymentLink, '_blank')} disabled={!paymentLink}>
                  <Eye className="h-4 w-4 mr-1" /> Preview payment page
                </Button>
              )}
            </div>
            <p className="text-muted-foreground">
              Sending will email the customer, store the appeal, set the claim to{' '}
              <Badge>appeal</Badge>{' '}
              {notifyCustomer ? 'and post an update in their profile.' : 'without a profile notification.'}
            </p>
          </div>
        )}

        <DialogFooter className="gap-2">
          {reviewing ? (
            <>
              <Button variant="outline" onClick={() => setReviewing(false)} disabled={sending}>
                <ArrowLeft className="h-4 w-4 mr-1" /> Back to edit
              </Button>
              <Button onClick={handleSend} disabled={sending}>
                {sending ? <Loader2 className="h-4 w-4 mr-1 animate-spin" /> : <Send className="h-4 w-4 mr-1" />}
                Send email &amp; open appeal
              </Button>
            </>
          ) : (
            <>
              <Button variant="outline" onClick={() => onOpenChange(false)}>
                Cancel
              </Button>
              <Button onClick={() => setReviewing(true)} disabled={!canReview}>
                <Eye className="h-4 w-4 mr-1" /> Preview email
              </Button>
            </>
          )}
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
};

export default ClaimAppealDialog;
