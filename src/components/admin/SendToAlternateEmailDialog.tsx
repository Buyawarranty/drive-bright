import React, { useState } from 'react';
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
import { Checkbox } from '@/components/ui/checkbox';
import { supabase } from '@/integrations/supabase/client';
import { toast } from 'sonner';
import { Mail, Loader2, AlertCircle } from 'lucide-react';
import { Alert, AlertDescription } from '@/components/ui/alert';

interface SendToAlternateEmailDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  policyId: string;
  customerId: string;
  customerEmail: string;
  customerName: string;
  policyNumber: string;
  onEmailSent?: () => void;
}

export const SendToAlternateEmailDialog: React.FC<SendToAlternateEmailDialogProps> = ({
  open,
  onOpenChange,
  policyId,
  customerId,
  customerEmail,
  customerName,
  policyNumber,
  onEmailSent,
}) => {
  const [alternateEmail, setAlternateEmail] = useState('');
  const [sendWelcomeEmail, setSendWelcomeEmail] = useState(true);
  const [sendCredentials, setSendCredentials] = useState(true);
  const [isSending, setIsSending] = useState(false);
  const [alsoSendToOriginal, setAlsoSendToOriginal] = useState(false);

  const validateEmail = (email: string) => {
    return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email);
  };

  const handleSend = async () => {
    if (!alternateEmail.trim()) {
      toast.error('Please enter an email address');
      return;
    }

    if (!validateEmail(alternateEmail.trim())) {
      toast.error('Please enter a valid email address');
      return;
    }

    if (!sendWelcomeEmail && !sendCredentials) {
      toast.error('Please select at least one type of email to send');
      return;
    }

    setIsSending(true);

    try {
      const emailsToSend = [alternateEmail.trim().toLowerCase()];
      if (alsoSendToOriginal && customerEmail) {
        emailsToSend.push(customerEmail.toLowerCase());
      }

      for (const targetEmail of emailsToSend) {
        // Send welcome email with policy documents
        if (sendWelcomeEmail) {
          const { error: welcomeError } = await supabase.functions.invoke('send-welcome-email-alternate', {
            body: {
              policyId,
              customerId,
              alternateEmail: targetEmail,
              customerName,
            }
          });

          if (welcomeError) {
            console.error('Welcome email error:', welcomeError);
            throw new Error(`Failed to send welcome email to ${targetEmail}`);
          }
        }

        // Send login credentials
        if (sendCredentials) {
          const { error: credentialsError } = await supabase.functions.invoke('resend-customer-credentials-alternate', {
            body: {
              originalEmail: customerEmail,
              alternateEmail: targetEmail,
            }
          });

          if (credentialsError) {
            console.error('Credentials email error:', credentialsError);
            throw new Error(`Failed to send credentials to ${targetEmail}`);
          }
        }
      }

      toast.success(`Email(s) sent successfully to ${emailsToSend.join(' and ')}`);
      
      // Log the activity
      await supabase.from('email_logs').insert({
        recipient_email: alternateEmail.trim().toLowerCase(),
        subject: `Policy confirmation resent - ${policyNumber}`,
        status: 'sent',
        metadata: {
          original_email: customerEmail,
          policy_id: policyId,
          customer_id: customerId,
          sent_welcome: sendWelcomeEmail,
          sent_credentials: sendCredentials,
          also_sent_to_original: alsoSendToOriginal,
        }
      });

      onEmailSent?.();
      onOpenChange(false);
      setAlternateEmail('');
      setSendWelcomeEmail(true);
      setSendCredentials(true);
      setAlsoSendToOriginal(false);
    } catch (error) {
      console.error('Error sending emails:', error);
      toast.error(error instanceof Error ? error.message : 'Failed to send emails');
    } finally {
      setIsSending(false);
    }
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <Mail className="h-5 w-5" />
            Send to Alternate Email
          </DialogTitle>
          <DialogDescription>
            Send order confirmation and login details to a different email address.
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-4 py-4">
          <Alert>
            <AlertCircle className="h-4 w-4" />
            <AlertDescription>
              Original email: <strong>{customerEmail}</strong>
            </AlertDescription>
          </Alert>

          <div className="space-y-2">
            <Label htmlFor="alternateEmail">Alternate Email Address</Label>
            <Input
              id="alternateEmail"
              type="email"
              placeholder="customer@example.com"
              value={alternateEmail}
              onChange={(e) => setAlternateEmail(e.target.value)}
              disabled={isSending}
            />
          </div>

          <div className="space-y-3">
            <Label>What to send:</Label>
            
            <div className="flex items-center space-x-2">
              <Checkbox
                id="sendWelcome"
                checked={sendWelcomeEmail}
                onCheckedChange={(checked) => setSendWelcomeEmail(checked === true)}
                disabled={isSending}
              />
              <label htmlFor="sendWelcome" className="text-sm cursor-pointer">
                Welcome email with policy documents
              </label>
            </div>

            <div className="flex items-center space-x-2">
              <Checkbox
                id="sendCredentials"
                checked={sendCredentials}
                onCheckedChange={(checked) => setSendCredentials(checked === true)}
                disabled={isSending}
              />
              <label htmlFor="sendCredentials" className="text-sm cursor-pointer">
                Login credentials for customer dashboard
              </label>
            </div>

            <div className="flex items-center space-x-2 pt-2 border-t">
              <Checkbox
                id="alsoSendOriginal"
                checked={alsoSendToOriginal}
                onCheckedChange={(checked) => setAlsoSendToOriginal(checked === true)}
                disabled={isSending}
              />
              <label htmlFor="alsoSendOriginal" className="text-sm cursor-pointer">
                Also resend to original email ({customerEmail})
              </label>
            </div>
          </div>
        </div>

        <DialogFooter>
          <Button
            variant="outline"
            onClick={() => onOpenChange(false)}
            disabled={isSending}
          >
            Cancel
          </Button>
          <Button onClick={handleSend} disabled={isSending}>
            {isSending ? (
              <>
                <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                Sending...
              </>
            ) : (
              <>
                <Mail className="mr-2 h-4 w-4" />
                Send Email
              </>
            )}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
};
