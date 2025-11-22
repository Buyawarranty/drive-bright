import { useState } from 'react';
import { Button } from '@/components/ui/button';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from '@/components/ui/dialog';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { Switch } from '@/components/ui/switch';
import { supabase } from '@/integrations/supabase/client';
import { useToast } from '@/hooks/use-toast';
import { Bell } from 'lucide-react';

interface SendNotificationDialogProps {
  customerId: string;
  customerName: string;
  customerEmail: string;
  trigger?: React.ReactNode;
}

export const SendNotificationDialog = ({
  customerId,
  customerName,
  customerEmail,
  trigger,
}: SendNotificationDialogProps) => {
  const [open, setOpen] = useState(false);
  const [message, setMessage] = useState('');
  const [isImportant, setIsImportant] = useState(false);
  const [loading, setLoading] = useState(false);
  const { toast } = useToast();

  const handleSend = async () => {
    if (!message.trim()) {
      toast({
        title: 'Error',
        description: 'Please enter a message',
        variant: 'destructive',
      });
      return;
    }

    setLoading(true);
    try {
      const { data: { user } } = await supabase.auth.getUser();

      const { error } = await supabase
        .from('customer_notifications')
        .insert({
          customer_id: customerId,
          message: message.trim(),
          is_important: isImportant,
          created_by: user?.id,
        });

      if (error) throw error;

      // Send email notification using direct content
      const emailSubject = isImportant 
        ? '🔔 Important Update from Buy A Warranty'
        : 'Update from Buy A Warranty';

      const htmlContent = `
        <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto; padding: 20px;">
          <h2 style="color: #1e3a8a;">Hi ${customerName},</h2>
          <p style="color: #333; font-size: 16px;">We wanted to let you know:</p>
          <div style="background-color: #f5f5f5; padding: 20px; border-left: 4px solid ${isImportant ? '#ef4444' : '#3b82f6'}; margin: 20px 0; border-radius: 4px;">
            <p style="color: #333; font-size: 16px; margin: 0; white-space: pre-wrap;">${message.trim()}</p>
          </div>
          <p style="color: #333; font-size: 16px;">
            You can view more details by <a href="${window.location.origin}/customer-dashboard" style="color: #3b82f6; text-decoration: none;">logging into your dashboard</a>.
          </p>
          <p style="color: #333; font-size: 16px;">If you have any questions, please don't hesitate to contact us.</p>
          <p style="color: #333; font-size: 16px; margin-top: 30px;">
            Best regards,<br>
            <strong>Buy A Warranty Team</strong>
          </p>
        </div>
      `;

      const { error: emailError } = await supabase.functions.invoke('send-email', {
        body: {
          recipientEmail: customerEmail,
          customerId: customerId,
          subject: emailSubject,
          html: htmlContent,
        },
      });

      if (emailError) {
        console.error('Error sending email:', emailError);
        toast({
          title: 'Partial success',
          description: 'Notification saved to dashboard, but email failed to send',
          variant: 'destructive',
        });
      } else {
        toast({
          title: 'Update sent successfully',
          description: `Message sent to ${customerName} via dashboard and email`,
        });
      }

      setMessage('');
      setIsImportant(false);
      setOpen(false);
    } catch (error) {
      console.error('Error sending notification:', error);
      toast({
        title: 'Error',
        description: 'Failed to send notification',
        variant: 'destructive',
      });
    } finally {
      setLoading(false);
    }
  };

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild>
        {trigger || (
          <Button variant="outline" size="sm">
            <Bell className="h-4 w-4 mr-2" />
            Send Update
          </Button>
        )}
      </DialogTrigger>
      <DialogContent className="sm:max-w-[500px]">
        <DialogHeader>
          <DialogTitle>Send Update to Customer</DialogTitle>
          <DialogDescription>
            Send an update to {customerName} via dashboard notification and email ({customerEmail}).
          </DialogDescription>
        </DialogHeader>
        <div className="space-y-4 py-4">
          <div className="space-y-2">
            <Label htmlFor="message">Message</Label>
            <Textarea
              id="message"
              placeholder="e.g., Your claim has been increased to £2,000"
              value={message}
              onChange={(e) => setMessage(e.target.value)}
              rows={4}
              className="resize-none"
            />
          </div>
          <div className="flex items-center space-x-2">
            <Switch
              id="important"
              checked={isImportant}
              onCheckedChange={setIsImportant}
            />
            <Label htmlFor="important" className="cursor-pointer">
              Mark as important
            </Label>
          </div>
        </div>
        <DialogFooter>
          <Button variant="outline" onClick={() => setOpen(false)} disabled={loading}>
            Cancel
          </Button>
          <Button onClick={handleSend} disabled={loading}>
            {loading ? 'Sending...' : 'Send Notification'}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
};
