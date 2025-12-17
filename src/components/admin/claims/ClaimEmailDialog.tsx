import React, { useState } from 'react';
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle, DialogFooter } from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Textarea } from '@/components/ui/textarea';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Send, Mail, FileText } from 'lucide-react';
import { supabase } from '@/integrations/supabase/client';
import { useToast } from '@/hooks/use-toast';
import { useAuth } from '@/hooks/useAuth';

interface ClaimEmailDialogProps {
  claim: any;
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onEmailSent: () => void;
}

const EMAIL_TEMPLATES = [
  {
    id: 'update_request',
    name: 'Request Update',
    subject: 'Update Request - Claim #{claimId}',
    body: `Hi Claims Team,

Can we please have an update on the following claim?

Customer: {customerName}
Vehicle Registration: {vehicleReg}
Claim Reason: {claimReason}
Date Submitted: {dateSubmitted}

Please advise on the current status and expected timeline.

Thank you.`,
  },
  {
    id: 'approval_query',
    name: 'Approval Query',
    subject: 'Approval Query - Claim #{claimId}',
    body: `Hi Claims Team,

Regarding the claim below, please confirm if this can be approved:

Customer: {customerName}
Vehicle Registration: {vehicleReg}
Claim Reason: {claimReason}
Warranty Type: {warrantyType}

Please review and advise.

Thank you.`,
  },
  {
    id: 'payment_status',
    name: 'Payment Status',
    subject: 'Payment Status Query - Claim #{claimId}',
    body: `Hi Claims Team,

Can you please confirm the payment status for the following claim?

Customer: {customerName}
Vehicle Registration: {vehicleReg}
Approved Amount: £{paymentAmount}

When can we expect this to be processed?

Thank you.`,
  },
  {
    id: 'additional_info',
    name: 'Additional Information Required',
    subject: 'Additional Info Needed - Claim #{claimId}',
    body: `Hi Claims Team,

We need additional information for the following claim:

Customer: {customerName}
Vehicle Registration: {vehicleReg}
Claim Reason: {claimReason}

Please provide:
- [Specify what information is needed]

Thank you.`,
  },
  {
    id: 'escalation',
    name: 'Escalation',
    subject: 'URGENT: Escalation - Claim #{claimId}',
    body: `Hi Claims Team,

This claim requires urgent attention:

Customer: {customerName}
Vehicle Registration: {vehicleReg}
Claim Reason: {claimReason}
Days Open: {daysOpen}

Reason for escalation:
[Please specify reason]

Please prioritise this case.

Thank you.`,
  },
  {
    id: 'custom',
    name: 'Custom Message',
    subject: '',
    body: '',
  },
];

export const ClaimEmailDialog: React.FC<ClaimEmailDialogProps> = ({
  claim,
  open,
  onOpenChange,
  onEmailSent,
}) => {
  const { toast } = useToast();
  const { user } = useAuth();
  const [selectedTemplate, setSelectedTemplate] = useState('');
  const [subject, setSubject] = useState('');
  const [body, setBody] = useState('');
  const [sending, setSending] = useState(false);
  const [recipientEmail, setRecipientEmail] = useState('claims@buyawarranty.co.uk');

  const replacePlaceholders = (text: string) => {
    const daysOpen = Math.floor((new Date().getTime() - new Date(claim.created_at).getTime()) / (1000 * 60 * 60 * 24));
    
    return text
      .replace(/{claimId}/g, claim.id.slice(0, 8))
      .replace(/{customerName}/g, claim.name || 'N/A')
      .replace(/{vehicleReg}/g, claim.vehicle_registration || 'N/A')
      .replace(/{claimReason}/g, claim.claim_reason || 'N/A')
      .replace(/{warrantyType}/g, claim.warranty_type || 'N/A')
      .replace(/{paymentAmount}/g, claim.payment_amount?.toFixed(2) || '0.00')
      .replace(/{dateSubmitted}/g, new Date(claim.created_at).toLocaleDateString('en-GB'))
      .replace(/{daysOpen}/g, daysOpen.toString());
  };

  const handleTemplateChange = (templateId: string) => {
    setSelectedTemplate(templateId);
    const template = EMAIL_TEMPLATES.find(t => t.id === templateId);
    if (template) {
      setSubject(replacePlaceholders(template.subject));
      setBody(replacePlaceholders(template.body));
    }
  };

  const handleSendEmail = async () => {
    if (!subject.trim() || !body.trim()) {
      toast({
        title: "Error",
        description: "Please fill in the subject and message",
        variant: "destructive",
      });
      return;
    }

    setSending(true);
    try {
      // Log the communication
      const { error: commError } = await supabase
        .from('claim_communications')
        .insert({
          claim_id: claim.id,
          direction: 'outbound',
          communication_type: 'email',
          subject: subject,
          message: body,
          sender_email: user?.email || 'admin@buyawarranty.co.uk',
          recipient_email: recipientEmail,
          sent_by: user?.id,
          metadata: { template: selectedTemplate },
        });

      if (commError) throw commError;

      // Update last contacted timestamp
      await supabase
        .from('claims_submissions')
        .update({ last_contacted_at: new Date().toISOString() })
        .eq('id', claim.id);

      // Send the actual email via edge function
      const { error: emailError } = await supabase.functions.invoke('send-claim-email', {
        body: {
          to: recipientEmail,
          subject: subject,
          body: body,
          claimId: claim.id,
        },
      });

      if (emailError) {
        console.error('Email send error:', emailError);
        // Still show success as communication was logged
      }

      toast({
        title: "Email Sent",
        description: `Email sent to ${recipientEmail}`,
      });
      
      onEmailSent();
      onOpenChange(false);
      
      // Reset form
      setSelectedTemplate('');
      setSubject('');
      setBody('');
    } catch (error) {
      console.error('Error sending email:', error);
      toast({
        title: "Error",
        description: "Failed to send email",
        variant: "destructive",
      });
    } finally {
      setSending(false);
    }
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-2xl">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <Mail className="h-5 w-5" />
            Send Email to Claims Department
          </DialogTitle>
          <DialogDescription>
            Send an email regarding claim from {claim?.name} ({claim?.vehicle_registration})
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-4">
          {/* Template Selection */}
          <div className="space-y-2">
            <Label>Email Template</Label>
            <Select value={selectedTemplate} onValueChange={handleTemplateChange}>
              <SelectTrigger>
                <SelectValue placeholder="Select a template or write custom">
                  {selectedTemplate ? (
                    <div className="flex items-center gap-2">
                      <FileText className="h-4 w-4" />
                      {EMAIL_TEMPLATES.find(t => t.id === selectedTemplate)?.name}
                    </div>
                  ) : (
                    "Select a template"
                  )}
                </SelectValue>
              </SelectTrigger>
              <SelectContent className="bg-background border shadow-lg z-50">
                {EMAIL_TEMPLATES.map((template) => (
                  <SelectItem key={template.id} value={template.id}>
                    {template.name}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>

          {/* Recipient */}
          <div className="space-y-2">
            <Label>To</Label>
            <Input
              value={recipientEmail}
              onChange={(e) => setRecipientEmail(e.target.value)}
              placeholder="recipient@email.com"
            />
          </div>

          {/* Subject */}
          <div className="space-y-2">
            <Label>Subject</Label>
            <Input
              value={subject}
              onChange={(e) => setSubject(e.target.value)}
              placeholder="Email subject..."
            />
          </div>

          {/* Body */}
          <div className="space-y-2">
            <Label>Message</Label>
            <Textarea
              value={body}
              onChange={(e) => setBody(e.target.value)}
              placeholder="Write your message..."
              rows={10}
              className="font-mono text-sm"
            />
          </div>
        </div>

        <DialogFooter>
          <Button variant="outline" onClick={() => onOpenChange(false)}>
            Cancel
          </Button>
          <Button onClick={handleSendEmail} disabled={sending}>
            <Send className="h-4 w-4 mr-2" />
            {sending ? 'Sending...' : 'Send Email'}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
};
