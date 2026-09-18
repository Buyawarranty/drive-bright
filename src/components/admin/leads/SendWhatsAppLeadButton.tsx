import React, { useEffect, useState } from 'react';
import { Button } from '@/components/ui/button';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { Input } from '@/components/ui/input';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { Tooltip, TooltipContent, TooltipTrigger } from '@/components/ui/tooltip';
import { Loader2, Send } from 'lucide-react';
import { toast } from 'sonner';
import { supabase } from '@/integrations/supabase/client';

interface WatiTemplate {
  name: string;
  language: string;
  status: string;
  body: string;
}

interface Props {
  leadId: string;
  phone: string | null;
  firstName?: string | null;
  disabled?: boolean;
  onSent?: (templateName: string) => void;
}

const isUkMobile = (phone: string | null): boolean => {
  let digits = (phone || '').replace(/[^\d]/g, '');
  if (digits.startsWith('0044')) digits = digits.slice(2);
  if (digits.startsWith('44')) digits = `0${digits.slice(2)}`;
  if (digits.startsWith('7') && digits.length === 10) digits = `0${digits}`;
  return /^07\d{9}$/.test(digits);
};

/** Fills the friendly bits of a template so the agent sees the real wording. */
const fillTemplate = (body: string, firstName?: string | null): string =>
  body
    .replace(/\{\{\s*(name|1)\s*\}\}/gi, (firstName || 'there').trim() || 'there')
    .replace(/\{\{\s*[^}]+\s*\}\}/g, '')
    .replace(/[ \t]{2,}/g, ' ')
    .trim();

/**
 * WhatsApp button on a lead row: pick one of the approved templates, read the
 * message, tweak the wording, then send it on the same WATI channel the
 * WhatsApp section of the CRM uses.
 */
export const SendWhatsAppLeadButton: React.FC<Props> = ({
  leadId,
  phone,
  firstName,
  disabled,
  onSent,
}) => {
  const [open, setOpen] = useState(false);
  const [templates, setTemplates] = useState<WatiTemplate[]>([]);
  const [loading, setLoading] = useState(false);
  const [failed, setFailed] = useState(false);
  const [templateName, setTemplateName] = useState('');
  const [message, setMessage] = useState('');
  const [sending, setSending] = useState(false);

  useEffect(() => {
    if (!open || templates.length || failed) return;
    setLoading(true);
    void (async () => {
      const { data, error } = await supabase.functions.invoke('wati-templates', { body: {} });
      setLoading(false);
      if (error || !data?.ok || !Array.isArray(data.templates) || data.templates.length === 0) {
        setFailed(true);
        return;
      }
      const all = data.templates as WatiTemplate[];
      const approved = all.filter((t) => t.status === 'APPROVED' || t.status === 'UNKNOWN');
      const list = approved.length ? approved : all;
      setTemplates(list);
      const first = list[0];
      if (first) {
        setTemplateName(first.name);
        setMessage(fillTemplate(first.body, firstName));
      }
    })();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [open, failed]);

  const chooseTemplate = (name: string) => {
    setTemplateName(name);
    const found = templates.find((t) => t.name === name);
    if (found) setMessage(fillTemplate(found.body, firstName));
  };

  const send = async () => {
    if (!message.trim()) return;
    setSending(true);
    const { data, error } = await supabase.functions.invoke('wati-send-lead-message', {
      body: { leadId, templateName, message: message.trim() },
    });
    setSending(false);

    const code = (data as any)?.error;
    if (error || !data?.ok) {
      if (code === 'opted_out') toast.error('This customer asked to stop WhatsApp messages.');
      else if (code === 'blocked_status') toast.error('This lead is marked do not contact.');
      else if (code === 'no_uk_mobile') toast.error('This lead has no UK mobile number.');
      else if (code === 'template_required')
        toast.error('Choose a template — the customer has not messaged in the last 24 hours.');
      else if (code === 'wati_not_configured') toast.error('WhatsApp sending is not switched on.');
      else toast.error('The message could not be sent.');
      return;
    }

    if (data.mode === 'template') {
      toast.success(
        `Sent as the approved "${data.templateName}" wording — WhatsApp only allows templates when a customer has not messaged in 24 hours.`,
      );
    } else {
      toast.success('WhatsApp message sent.');
    }
    onSent?.(templateName || 'WhatsApp message');
    setOpen(false);
  };

  if (!isUkMobile(phone)) return null;

  return (
    <>
      <Tooltip delayDuration={100}>
        <TooltipTrigger asChild>
          <Button
            size="sm"
            disabled={disabled}
            className="h-6 border border-green-500 bg-white px-1.5 text-[11px] font-semibold text-green-600 shadow-sm hover:bg-green-50 hover:text-green-700"
            onClick={() => setOpen(true)}
          >
            WhatsApp
          </Button>
        </TooltipTrigger>
        <TooltipContent side="top" className="text-xs">
          Send a WhatsApp message
        </TooltipContent>
      </Tooltip>

      <Dialog open={open} onOpenChange={setOpen}>
        <DialogContent className="sm:!max-w-xl">
          <DialogHeader>
            <DialogTitle>Send a WhatsApp message</DialogTitle>
          </DialogHeader>

          <div className="space-y-3">
            <div className="space-y-1">
              <Label htmlFor="wa-lead-template">Message template</Label>
              {failed ? (
                <Input
                  id="wa-lead-template"
                  value={templateName}
                  onChange={(e) => setTemplateName(e.target.value)}
                  placeholder="james_hi"
                />
              ) : (
                <Select value={templateName} onValueChange={chooseTemplate} disabled={loading}>
                  <SelectTrigger id="wa-lead-template">
                    <SelectValue
                      placeholder={loading ? 'Loading your templates...' : 'Choose a template'}
                    />
                  </SelectTrigger>
                  <SelectContent className="max-h-72">
                    {templates.map((t) => (
                      <SelectItem key={t.name} value={t.name}>
                        {t.name}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              )}
            </div>

            <div className="space-y-1">
              <Label htmlFor="wa-lead-message">Message</Label>
              <Textarea
                id="wa-lead-message"
                rows={6}
                value={message}
                onChange={(e) => setMessage(e.target.value)}
                placeholder="Your message to the customer"
              />
              <p className="text-xs text-muted-foreground">
                Edit the wording as you like. If this customer has not messaged in the last 24
                hours, WhatsApp only allows the approved template wording, and that is what will go
                out.
              </p>
            </div>

            <div className="flex justify-end gap-2">
              <Button variant="outline" onClick={() => setOpen(false)} disabled={sending}>
                Cancel
              </Button>
              <Button onClick={() => void send()} disabled={sending || !message.trim()}>
                {sending ? (
                  <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                ) : (
                  <Send className="h-4 w-4 mr-2" />
                )}
                Send on WhatsApp
              </Button>
            </div>
          </div>
        </DialogContent>
      </Dialog>
    </>
  );
};

export default SendWhatsAppLeadButton;
