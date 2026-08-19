/**
 * FINAL-STAGE APPEAL FORM
 * ---------------------------------------------------------------------------
 * Used after a complaint has been through the process and the outcome still
 * stands. The claims team picks the customer, drafts the appeal, chooses an
 * independent inspection route, attaches the appeal payment link, REVIEWS the
 * whole thing, and only then sends it:
 *   - the appeal is stored against the claim (claim_appeals)
 *   - the claim status moves to "appeal"
 *   - the customer gets a notification in their portal profile
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
import { Loader2, Search, Gavel, ExternalLink, Send, ArrowLeft, CheckCircle2 } from 'lucide-react';

export const INDEPENDENT_REVIEWERS = [
  {
    id: 'scotia',
    name: 'Scotia Vehicle Inspections',
    url: 'https://scotiavehicleinspections.com',
    blurb: 'Independent engineer report, UK-wide coverage.',
  },
  {
    id: 'ace',
    name: 'ACE Inspection Services',
    url: 'https://www.aceinspections.co.uk',
    blurb: 'Independent vehicle assessment and engineer opinion.',
  },
] as const;

const DEFAULT_APPEAL_FEE = 99;
const DEFAULT_PAYMENT_LINK = 'https://buyawarranty.co.uk/appeal-payment';

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
  /** Optional pre-selected claim (e.g. opened from a claim row). */
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
  const [reviewerId, setReviewerId] = useState<string>('');
  const [appealFee, setAppealFee] = useState(String(DEFAULT_APPEAL_FEE));
  const [paymentLink, setPaymentLink] = useState(DEFAULT_PAYMENT_LINK);
  const [notifyCustomer, setNotifyCustomer] = useState(true);
  const [reviewing, setReviewing] = useState(false);
  const [sending, setSending] = useState(false);

  useEffect(() => {
    if (open) setSelected(claim);
  }, [open, claim]);

  useEffect(() => {
    if (!open) {
      setSearch('');
      setResults([]);
      setReason('');
      setNewEvidence('');
      setReviewerId('');
      setAppealFee(String(DEFAULT_APPEAL_FEE));
      setPaymentLink(DEFAULT_PAYMENT_LINK);
      setNotifyCustomer(true);
      setReviewing(false);
    }
  }, [open]);

  const reviewer = useMemo(
    () => INDEPENDENT_REVIEWERS.find((r) => r.id === reviewerId) || null,
    [reviewerId]
  );

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

  const canReview = !!selected && reason.trim().length > 10 && !!reviewer && !!paymentLink.trim();

  const handleSend = async () => {
    if (!selected || !reviewer) return;
    setSending(true);
    try {
      const { data: userRes } = await supabase.auth.getUser();
      const fee = Number(String(appealFee).replace(/[^0-9.]/g, '')) || 0;

      const { error: appealError } = await supabase.from('claim_appeals').insert({
        claim_id: selected.id,
        reason: reason.trim(),
        new_evidence: newEvidence.trim() || null,
        status: 'submitted',
        independent_reviewer: reviewer.name,
        reviewer_url: reviewer.url,
        appeal_fee: fee,
        payment_link: paymentLink.trim(),
        sent_at: new Date().toISOString(),
        customer_email: selected.email,
        customer_notified: false,
        created_by: userRes?.user?.id ?? null,
      } as any);
      if (appealError) throw appealError;

      // Claim moves to the appeal stage.
      const { error: statusError } = await supabase
        .from('claims_submissions')
        .update({ status: 'appeal', updated_at: new Date().toISOString() })
        .eq('id', selected.id);
      if (statusError) throw statusError;

      // Portal notification so the customer sees the appeal and its updates.
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
              `Appeal fee: £${fee}. Pay here: ${paymentLink.trim()} — ` +
              `you can also request an independent review by ${reviewer.name} (${reviewer.url}). ` +
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
        title: 'Appeal sent',
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

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-3xl max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <Gavel className="h-5 w-5" />
            {reviewing ? 'Review appeal before sending' : 'Final appeal'}
          </DialogTitle>
          <DialogDescription>
            The final stage once a complaint has not changed the outcome. Includes the appeal
            payment link and the option of an independent review.
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
                      <p className="text-muted-foreground">{selected.email}</p>
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

            {/* Independent review */}
            <div className="space-y-2">
              <Label>Independent review *</Label>
              <div className="grid gap-3 sm:grid-cols-2">
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
            </div>

            {/* Payment */}
            <div className="grid gap-4 sm:grid-cols-2">
              <div className="space-y-2">
                <Label>Appeal fee (£)</Label>
                <Input
                  type="number"
                  min="0"
                  step="1"
                  value={appealFee}
                  onChange={(e) => setAppealFee(e.target.value)}
                />
              </div>
              <div className="space-y-2">
                <Label>Appeal payment link *</Label>
                <Input
                  value={paymentLink}
                  onChange={(e) => setPaymentLink(e.target.value)}
                  placeholder="https://..."
                />
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
          /* ── Review step ── */
          <div className="space-y-4 text-sm">
            <Card>
              <CardContent className="py-3 space-y-1">
                <p className="font-semibold">{selected?.name}</p>
                <p className="text-muted-foreground">{selected?.email}</p>
                <p className="text-muted-foreground">
                  {selected?.vehicle_registration || 'No reg'} · status will change to{' '}
                  <Badge>appeal</Badge>
                </p>
              </CardContent>
            </Card>
            <div>
              <p className="font-semibold">Grounds for appeal</p>
              <p className="whitespace-pre-wrap text-muted-foreground">{reason}</p>
            </div>
            {newEvidence.trim() && (
              <div>
                <p className="font-semibold">New evidence</p>
                <p className="whitespace-pre-wrap text-muted-foreground">{newEvidence}</p>
              </div>
            )}
            <div>
              <p className="font-semibold">Independent review</p>
              <p className="text-muted-foreground">
                {reviewer?.name} — {reviewer?.url}
              </p>
            </div>
            <div>
              <p className="font-semibold">Appeal payment</p>
              <p className="text-muted-foreground">
                £{Number(String(appealFee).replace(/[^0-9.]/g, '')) || 0} · {paymentLink}
              </p>
            </div>
            <p className="text-muted-foreground">
              {notifyCustomer
                ? 'The customer will see this appeal and every future update in their portal profile.'
                : 'No customer notification will be posted.'}
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
                Send appeal
              </Button>
            </>
          ) : (
            <>
              <Button variant="outline" onClick={() => onOpenChange(false)}>
                Cancel
              </Button>
              <Button onClick={() => setReviewing(true)} disabled={!canReview}>
                Review appeal
              </Button>
            </>
          )}
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
};

export default ClaimAppealDialog;
