import React, { useState } from 'react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Textarea } from '@/components/ui/textarea';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from '@/components/ui/dialog';
import { toast } from 'sonner';
import { supabase } from '@/integrations/supabase/client';
import { Mail, Copy, Send, Loader2 } from 'lucide-react';

interface FollowUpEmailDialogProps {
  cartId: string;
  customerEmail: string;
  customerName: string | null;
  vehicleReg: string | null;
  vehicleMake: string | null;
  vehicleModel: string | null;
  planName: string | null;
  totalPrice?: number;
  onEmailSent?: () => void;
}

const generateEmailTemplate = (
  customerName: string | null,
  vehicleReg: string | null,
  vehicleMake: string | null,
  vehicleModel: string | null,
  planName: string | null,
  totalPrice?: number
) => {
  const name = customerName?.split(' ')[0] || 'there';
  const vehicle = vehicleMake && vehicleModel 
    ? `${vehicleMake} ${vehicleModel}` 
    : vehicleReg || 'your vehicle';

  return `Hi ${name},

I noticed you were looking at protecting your ${vehicle} with our ${planName || 'warranty'} plan but didn't complete your purchase.

I wanted to reach out personally to see if you had any questions or if there's anything I can help with?

${totalPrice ? `Your quote was £${totalPrice.toFixed(2)} – this price is still available for you.` : ''}

Here's a quick reminder of what you'll get:
✓ Comprehensive mechanical & electrical cover
✓ Fast claims – 94% approved
✓ 14-day money-back guarantee
✓ No hidden fees

If you'd like to complete your purchase or have any questions, just reply to this email or give us a call on 0330 229 5040.

We're here to help!

Best regards,
Buy A Warranty Team
www.buyawarranty.co.uk`;
};

export const FollowUpEmailDialog: React.FC<FollowUpEmailDialogProps> = ({
  cartId,
  customerEmail,
  customerName,
  vehicleReg,
  vehicleMake,
  vehicleModel,
  planName,
  totalPrice,
  onEmailSent,
}) => {
  const [open, setOpen] = useState(false);
  const [toEmail, setToEmail] = useState(customerEmail);
  const [subject, setSubject] = useState(
    `Still interested in protecting your ${vehicleMake || 'vehicle'}? – Buy A Warranty`
  );
  const [content, setContent] = useState(
    generateEmailTemplate(customerName, vehicleReg, vehicleMake, vehicleModel, planName, totalPrice)
  );
  const [sending, setSending] = useState(false);

  const handleCopyTemplate = () => {
    navigator.clipboard.writeText(content);
    toast.success('Email template copied to clipboard');
  };

  const handleSendEmail = async () => {
    if (!toEmail) {
      toast.error('Please enter a recipient email');
      return;
    }

    setSending(true);
    try {
      const { data, error } = await supabase.functions.invoke('send-admin-quote', {
        body: {
          to: toEmail,
          subject: subject,
          content: content,
          vehicleData: {
            regNumber: vehicleReg || 'N/A',
            mileage: 'N/A',
            make: vehicleMake,
            model: vehicleModel,
          },
          quoteDetails: {
            plan: planName || 'Warranty Plan',
            paymentType: 'follow-up',
            price: totalPrice || 0,
            excessAmount: 'N/A',
            claimLimit: 'N/A',
          },
        },
      });

      if (error) throw error;

      // Log the admin follow-up email
      const { error: logError } = await supabase
        .from('abandoned_cart_emails')
        .insert({
          abandoned_cart_id: cartId,
          customer_email: toEmail,
          email_type: 'admin_followup',
          subject: subject,
          vehicle_reg: vehicleReg,
          plan_name: planName,
          price_amount: totalPrice,
        });

      if (logError) {
        console.error('Error logging follow-up email:', logError);
      }

      toast.success('Follow-up email sent successfully!');
      setOpen(false);
      onEmailSent?.();
    } catch (error) {
      console.error('Error sending email:', error);
      toast.error('Failed to send email. Please try again.');
    } finally {
      setSending(false);
    }
  };

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild>
        <Button size="sm" variant="outline" className="text-blue-600 border-blue-600">
          <Mail className="w-4 h-4 mr-2" />
          Follow-up Email
        </Button>
      </DialogTrigger>
      <DialogContent className="max-w-2xl max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle>Send Follow-up Email</DialogTitle>
        </DialogHeader>
        
        <div className="space-y-4 pt-4">
          {/* To Email */}
          <div className="space-y-2">
            <label className="text-sm font-medium">To:</label>
            <Input
              type="email"
              value={toEmail}
              onChange={(e) => setToEmail(e.target.value)}
              placeholder="Customer email"
            />
          </div>

          {/* Subject */}
          <div className="space-y-2">
            <label className="text-sm font-medium">Subject:</label>
            <Input
              value={subject}
              onChange={(e) => setSubject(e.target.value)}
              placeholder="Email subject"
            />
          </div>

          {/* Content */}
          <div className="space-y-2">
            <label className="text-sm font-medium">Message:</label>
            <Textarea
              value={content}
              onChange={(e) => setContent(e.target.value)}
              rows={12}
              className="font-mono text-sm"
            />
          </div>

          {/* Actions */}
          <div className="flex gap-2 justify-end pt-4 border-t">
            <Button
              variant="outline"
              onClick={handleCopyTemplate}
            >
              <Copy className="w-4 h-4 mr-2" />
              Copy Email Template
            </Button>
            <Button
              onClick={handleSendEmail}
              disabled={sending || !toEmail}
              className="bg-green-600 hover:bg-green-700"
            >
              {sending ? (
                <>
                  <Loader2 className="w-4 h-4 mr-2 animate-spin" />
                  Sending...
                </>
              ) : (
                <>
                  <Send className="w-4 h-4 mr-2" />
                  Send Email
                </>
              )}
            </Button>
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
};
