import React, { useEffect, useMemo, useRef, useState } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { useToast } from '@/hooks/use-toast';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { Checkbox } from '@/components/ui/checkbox';
import { Tabs, TabsList, TabsTrigger, TabsContent } from '@/components/ui/tabs';
import { Loader2, Send, Mail, Monitor, Smartphone, Code2, Eye, Maximize2 } from 'lucide-react';

interface PendingChange {
  claimId: string;
  status: string;
  subjectOverride?: string;
  headingOverride?: string;
  bodyOverride?: string;
  onSent?: () => void | Promise<void>;
  skipEmail?: boolean;
  label?: string;
}

interface Props {
  pending: PendingChange | null;
  onClose: () => void;
}

interface PreviewData {
  recipient: string;
  defaultRecipient?: string;
  subject: string;
  heading: string;
  body: string;
  html: string;
  reference: string;
}

const isValidEmail = (e: string) => /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(e.trim());

export const ClaimStatusEmailPreviewDialog: React.FC<Props> = ({ pending, onClose }) => {
  const { toast } = useToast();
  const [loading, setLoading] = useState(false);
  const [sending, setSending] = useState(false);
  const [preview, setPreview] = useState<PreviewData | null>(null);
  const [subject, setSubject] = useState('');
  const [body, setBody] = useState('');
  const [skipped, setSkipped] = useState(false);
  const [sendEmail, setSendEmail] = useState(false);
  const [device, setDevice] = useState<'desktop' | 'mobile'>('desktop');
  const [useAltRecipient, setUseAltRecipient] = useState(false);
  const [altRecipient, setAltRecipient] = useState('');
  const [rerendering, setRerendering] = useState(false);
  const [renderedHtml, setRenderedHtml] = useState<string>('');
  const [bodyExpanded, setBodyExpanded] = useState(false);
  const [decisionNote, setDecisionNote] = useState('');
  const rerenderTimer = useRef<number | null>(null);

  const decisionStatus = pending?.status === 'approved'
    ? 'approved'
    : pending?.status === 'partially_approved'
      ? 'partially_approved'
      : pending?.status === 'declined' || pending?.status === 'rejected'
        ? 'declined'
        : null;
  // Only approvals require an internal decision note (per product spec).
  // Rejections can be changed with just a status switch; the agent can add
  // context via the normal notes UI if they want to.
  const requiresNote = decisionStatus === 'approved' || decisionStatus === 'partially_approved';
  const noteValid = !requiresNote || decisionNote.trim().length >= 5;

  const open = !!pending;

  useEffect(() => {
    if (!pending) {
      setPreview(null);
      setSubject('');
      setBody('');
      setSkipped(false);
      setSendEmail(false);
      setUseAltRecipient(false);
      setAltRecipient('');
      setDevice('desktop');
      setRenderedHtml('');
      setDecisionNote('');
      return;
    }
    if (pending.skipEmail) {
      setSkipped(true);
      return;
    }
    let cancelled = false;
    (async () => {
      setLoading(true);
      try {
        const { data, error } = await supabase.functions.invoke('send-claim-status-email', {
          body: {
            claimId: pending.claimId,
            status: pending.status,
            dryRun: true,
            subjectOverride: pending.subjectOverride,
            headingOverride: pending.headingOverride,
            bodyOverride: pending.bodyOverride,
          },
        });
        if (cancelled) return;
        if (error) throw error;
        if (data?.skipped) {
          setSkipped(true);
        } else if (data?.preview) {
          const p: PreviewData = {
            recipient: data.recipient,
            defaultRecipient: data.defaultRecipient || data.recipient,
            subject: data.subject,
            heading: data.heading,
            body: data.body,
            html: data.html,
            reference: data.reference,
          };
          setPreview(p);
          setSubject(p.subject);
          setBody(p.body);
          setRenderedHtml(p.html);
        }
      } catch (e: any) {
        toast({
          title: 'Could not load email preview',
          description: e?.message || 'Please try again.',
          variant: 'destructive',
        });
      } finally {
        if (!cancelled) setLoading(false);
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [pending, toast]);

  // Debounced re-render on subject/body edits so preview stays in sync
  useEffect(() => {
    if (!pending || !preview) return;
    if (subject === preview.subject && body === preview.body) return;
    if (rerenderTimer.current) window.clearTimeout(rerenderTimer.current);
    rerenderTimer.current = window.setTimeout(async () => {
      setRerendering(true);
      try {
        const { data, error } = await supabase.functions.invoke('send-claim-status-email', {
          body: {
            claimId: pending.claimId,
            status: pending.status,
            dryRun: true,
            subjectOverride: subject,
            headingOverride: pending.headingOverride,
            bodyOverride: body,
          },
        });
        if (!error && data?.html) setRenderedHtml(data.html);
      } finally {
        setRerendering(false);
      }
    }, 500);
    return () => {
      if (rerenderTimer.current) window.clearTimeout(rerenderTimer.current);
    };
  }, [subject, body, pending, preview]);

  const altValid = !useAltRecipient || isValidEmail(altRecipient);
  const effectiveRecipient = useAltRecipient && altValid ? altRecipient.trim() : preview?.recipient || '';

  const iframeSrcDoc = useMemo(() => renderedHtml || preview?.html || '', [renderedHtml, preview]);

  const handleSend = async () => {
    if (!pending) return;

    if (requiresNote && !noteValid) {
      toast({
        title: 'Decision note required',
        description: 'Add a short internal note explaining this decision (min. 5 chars).',
        variant: 'destructive',
      });
      return;
    }

    const persistDecisionNote = async () => {
      if (!requiresNote) return;
      const label = decisionStatus === 'approved'
        ? '[Decision ✅ Approved]'
        : '[Decision 🟡 Partially approved]';
      try {
        const { data: auth } = await supabase.auth.getUser();
        const uid = auth?.user?.id;
        if (!uid) return;
        // claim_quick_notes.created_by references admin_users.id, not auth.users.id
        const { data: adminRow } = await supabase
          .from('admin_users')
          .select('id')
          .eq('user_id', uid)
          .maybeSingle();
        const createdBy = adminRow?.id;
        if (!createdBy) return;
        await supabase.from('claim_quick_notes').insert({
          claim_id: pending.claimId,
          note_text: `${label} ${decisionNote.trim()}`,
          created_by: createdBy,
        });
      } catch {}
    };

    if (skipped || !sendEmail) {
      try {
        await persistDecisionNote();
        await pending.onSent?.();
        toast({
          title: 'Status updated',
          description: sendEmail ? 'No email was sent for this status.' : 'Status applied without sending an email.',
        });
      } finally {
        onClose();
      }
      return;
    }

    if (!preview) return;
    if (useAltRecipient && !altValid) {
      toast({ title: 'Invalid email', description: 'Enter a valid alternate recipient email.', variant: 'destructive' });
      return;
    }
    setSending(true);
    try {
      const { data, error } = await supabase.functions.invoke('send-claim-status-email', {
        body: {
          claimId: pending.claimId,
          status: pending.status,
          subjectOverride: subject,
          headingOverride: pending.headingOverride,
          bodyOverride: body,
          recipientOverride: useAltRecipient ? altRecipient.trim() : undefined,
        },
      });
      // Prefer the real error message from the function response body
      let errMsg: string | null = null;
      if (error) {
        try {
          const j = await (error as any)?.context?.json?.();
          errMsg = j?.error || j?.message || null;
        } catch {}
        if (!errMsg) {
          try {
            const t = await (error as any)?.context?.text?.();
            if (t) errMsg = t;
          } catch {}
        }
        if (!errMsg) errMsg = (error as any)?.message || 'Send failed';
      } else if (data?.success === false) {
        errMsg = data?.error || 'Send failed';
      }
      if (errMsg) throw new Error(errMsg);

      toast({
        title: 'Email sent',
        description: `Sent to ${effectiveRecipient}`,
      });

      try {
        await persistDecisionNote();
        await pending.onSent?.();
      } catch (e: any) {
        toast({
          title: 'Status update failed after email',
          description: e?.message || 'The email was sent but the status change failed to save.',
          variant: 'destructive',
        });
      }
      onClose();
    } catch (e: any) {
      toast({
        title: 'Email failed',
        description: e?.message || 'Could not send the email.',
        variant: 'destructive',
      });
    } finally {
      setSending(false);
    }
  };

  return (
    <Dialog open={open} onOpenChange={(o) => { if (!o && !sending) onClose(); }}>
      <DialogContent className="max-w-5xl w-[96vw] p-0 gap-0 max-h-[92vh] overflow-hidden flex flex-col">
        <DialogHeader className="px-6 pt-5 pb-3 border-b">
          <DialogTitle className="flex items-center gap-2 text-lg">
            <Mail className="h-5 w-5 text-primary" />
            Review claim email before sending
          </DialogTitle>
          <DialogDescription>
            {pending?.label
              ? `This will set the claim to "${pending.label}" and (optionally) email the customer.`
              : 'Preview, edit and send the branded customer email for this status change.'}
          </DialogDescription>
        </DialogHeader>

        {requiresNote && (
          <div className="px-6 pt-4">
            <div className={`rounded-md border-2 p-3 ${
              decisionStatus === 'approved'
                ? 'border-emerald-300 bg-emerald-50'
                : decisionStatus === 'partially_approved'
                  ? 'border-lime-300 bg-lime-50'
                  : 'border-rose-300 bg-rose-50'
            }`}>
              <Label htmlFor="decision-note" className="text-xs font-bold uppercase tracking-wider">
                {decisionStatus === 'approved' && 'Why is this claim approved? (required internal note)'}
                {decisionStatus === 'partially_approved' && 'Which items are covered / not covered? (required internal note)'}
                
              </Label>
              <Textarea
                id="decision-note"
                value={decisionNote}
                onChange={(e) => setDecisionNote(e.target.value)}
                disabled={sending}
                rows={3}
                placeholder="Add a short explanation of your decision. This is saved to the claim notes timeline and is visible to your team (not to the customer)."
                className={`mt-1.5 text-sm bg-white ${!noteValid ? 'border-rose-400' : ''}`}
              />
              <p className="mt-1 text-[11px] text-muted-foreground">
                Internal only — added to the claim notes timeline. Minimum 5 characters.
              </p>
            </div>
          </div>
        )}


        {loading && (
          <div className="flex items-center justify-center py-16 text-sm text-muted-foreground">
            <Loader2 className="h-4 w-4 animate-spin mr-2" /> Loading preview…
          </div>
        )}

        {!loading && skipped && (
          <div className="px-6 py-6">
            <div className="rounded-md border border-amber-200 bg-amber-50 p-4 text-sm text-amber-900">
              This status doesn't send a customer email. You can still apply the status change.
            </div>
          </div>
        )}

        {!loading && preview && !skipped && (
          <div className="grid md:grid-cols-[380px,1fr] gap-0 flex-1 overflow-hidden">
            {/* LEFT: Editor */}
            <div className="border-r bg-muted/20 p-5 space-y-4 overflow-y-auto">
              <div>
                <Label className="text-xs font-semibold">Recipient</Label>
                <Input value={preview.defaultRecipient || preview.recipient} disabled className="bg-background mt-1 text-sm" />
                <div className="mt-2 flex items-start gap-2 rounded-md border p-2 bg-background">
                  <Checkbox
                    id="alt-recipient"
                    checked={useAltRecipient}
                    onCheckedChange={(c) => setUseAltRecipient(c === true)}
                    disabled={sending}
                  />
                  <div className="flex-1 space-y-1.5">
                    <label htmlFor="alt-recipient" className="text-xs font-medium cursor-pointer">
                      Send to a different email instead
                    </label>
                    {useAltRecipient && (
                      <Input
                        type="email"
                        placeholder="alternate@example.com"
                        value={altRecipient}
                        onChange={(e) => setAltRecipient(e.target.value)}
                        disabled={sending}
                        className={`h-8 text-xs ${!altValid ? 'border-rose-400' : ''}`}
                      />
                    )}
                  </div>
                </div>
              </div>

              <div>
                <Label className="text-xs font-semibold">Subject</Label>
                <Input
                  value={subject}
                  onChange={(e) => setSubject(e.target.value)}
                  disabled={sending}
                  className="mt-1 text-sm"
                />
              </div>

              <div>
                <div className="flex items-center justify-between">
                  <Label className="text-xs font-semibold">Message body</Label>
                  <button
                    type="button"
                    onClick={() => setBodyExpanded(true)}
                    disabled={sending}
                    className="inline-flex items-center gap-1 text-[11px] font-medium text-primary hover:underline"
                    aria-label="Expand message body editor"
                  >
                    <Maximize2 className="h-3 w-3" /> Expand editor
                  </button>
                </div>
                <Textarea
                  value={body}
                  onChange={(e) => setBody(e.target.value)}
                  rows={14}
                  disabled={sending}
                  className="mt-1 text-xs font-mono leading-relaxed"
                />
                <p className="mt-1 text-[11px] text-muted-foreground">
                  Paragraph breaks preserved. Click <strong>Expand editor</strong> for a larger writing area.
                </p>
              </div>

              <div className="text-[11px] text-muted-foreground bg-background rounded border px-2 py-1.5">
                Ref: <strong>{preview.reference}</strong>
              </div>

              <div className="flex items-start gap-2 rounded-md border-2 border-amber-300 bg-amber-50 p-3">
                <Checkbox
                  id="send-claim-email"
                  checked={sendEmail}
                  onCheckedChange={(c) => setSendEmail(c === true)}
                  disabled={sending}
                  className="mt-0.5"
                />
                <div className="space-y-0.5">
                  <label htmlFor="send-claim-email" className="text-sm font-semibold cursor-pointer text-amber-900">
                    Tick to actually email the customer
                  </label>
                  <p className="text-[11px] text-amber-800 leading-snug">
                    Unticked = status changes silently, no email sent.
                  </p>
                </div>
              </div>
            </div>

            {/* RIGHT: Live preview */}
            <div className="flex flex-col bg-slate-100 overflow-hidden">
              <div className="flex items-center justify-between px-4 py-2 border-b bg-white">
                <div className="text-xs font-medium text-muted-foreground flex items-center gap-2">
                  <Eye className="h-3.5 w-3.5" />
                  Live preview
                  {rerendering && <Loader2 className="h-3 w-3 animate-spin" />}
                </div>
                <Tabs value={device} onValueChange={(v) => setDevice(v as any)}>
                  <TabsList className="h-8">
                    <TabsTrigger value="desktop" className="h-6 px-2 text-xs">
                      <Monitor className="h-3.5 w-3.5 mr-1" /> Desktop
                    </TabsTrigger>
                    <TabsTrigger value="mobile" className="h-6 px-2 text-xs">
                      <Smartphone className="h-3.5 w-3.5 mr-1" /> Mobile
                    </TabsTrigger>
                  </TabsList>
                </Tabs>
              </div>
              <div className="flex-1 overflow-auto p-4 flex justify-center items-start">
                <iframe
                  title="Email preview"
                  srcDoc={iframeSrcDoc}
                  sandbox=""
                  style={{
                    width: device === 'mobile' ? 380 : '100%',
                    maxWidth: device === 'mobile' ? 380 : 720,
                    height: '100%',
                    minHeight: 520,
                    border: '1px solid #e2e8f0',
                    borderRadius: 8,
                    background: '#fff',
                    boxShadow: '0 4px 18px rgba(15,23,42,0.08)',
                  }}
                />
              </div>
            </div>
          </div>
        )}

        <DialogFooter className="px-6 py-3 border-t bg-background gap-2">
          <div className="mr-auto text-xs text-muted-foreground truncate">
            {!skipped && preview && sendEmail && (
              <>Will send to <strong>{effectiveRecipient || '—'}</strong></>
            )}
          </div>
          <Button variant="outline" onClick={onClose} disabled={sending}>
            Cancel
          </Button>
          <Button onClick={handleSend} disabled={sending || loading || (sendEmail && useAltRecipient && !altValid) || (requiresNote && !noteValid)} className="bg-primary">
            {sending ? (
              <Loader2 className="h-4 w-4 mr-2 animate-spin" />
            ) : (
              <Send className="h-4 w-4 mr-2" />
            )}
            {skipped || !sendEmail
              ? 'Apply status without email'
              : sending
              ? 'Sending…'
              : 'Send email & apply'}
          </Button>
        </DialogFooter>
      </DialogContent>

      {/* Fullscreen body editor */}
      <Dialog open={bodyExpanded} onOpenChange={setBodyExpanded}>
        <DialogContent className="max-w-4xl w-[92vw] h-[80vh] flex flex-col p-0">
          <DialogHeader className="px-5 pt-4 pb-2 border-b">
            <DialogTitle className="text-base">Edit message body</DialogTitle>
            <DialogDescription className="text-xs">
              Larger writing space. Changes apply to the email preview immediately.
            </DialogDescription>
          </DialogHeader>
          <div className="flex-1 p-4 overflow-hidden">
            <Textarea
              value={body}
              onChange={(e) => setBody(e.target.value)}
              className="w-full h-full text-sm font-mono leading-relaxed resize-none"
              autoFocus
            />
          </div>
          <DialogFooter className="px-5 py-3 border-t">
            <Button onClick={() => setBodyExpanded(false)}>Done</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </Dialog>
  );
};

export type { PendingChange as PendingClaimStatusChange };
