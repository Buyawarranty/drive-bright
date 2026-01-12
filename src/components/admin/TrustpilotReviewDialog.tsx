import { useState, useEffect } from 'react';
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
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { supabase } from '@/integrations/supabase/client';
import { useToast } from '@/hooks/use-toast';
import { Star, Send, Eye, Loader2, Check, Mail } from 'lucide-react';
import { ScrollArea } from '@/components/ui/scroll-area';

interface TrustpilotReviewDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  customerId: string;
  customerName: string;
  customerEmail: string;
  customerFirstName?: string;
  alreadyRequested?: boolean;
  requestedAt?: string;
}

export const TrustpilotReviewDialog = ({
  open,
  onOpenChange,
  customerId,
  customerName,
  customerEmail,
  customerFirstName,
  alreadyRequested = false,
  requestedAt,
}: TrustpilotReviewDialogProps) => {
  const [subject, setSubject] = useState('How was your warranty purchase experience?');
  const [loading, setLoading] = useState(false);
  const [previewLoading, setPreviewLoading] = useState(false);
  const [previewHtml, setPreviewHtml] = useState<string | null>(null);
  const [activeTab, setActiveTab] = useState<string>('edit');
  const [sent, setSent] = useState(false);
  const { toast } = useToast();

  // Derive first name from props or customer name
  const firstName = customerFirstName || customerName?.split(' ')[0] || 'there';

  // Reset state when dialog opens
  useEffect(() => {
    if (open) {
      setSubject('How was your warranty purchase experience?');
      setPreviewHtml(null);
      setActiveTab('edit');
      setSent(false);
    }
  }, [open]);

  const handlePreview = async () => {
    setPreviewLoading(true);
    try {
      const { data, error } = await supabase.functions.invoke('send-trustpilot-review-request', {
        body: {
          customerId,
          customerEmail,
          customerFirstName: firstName,
          subject,
          previewOnly: true,
        },
      });

      if (error) throw error;

      if (data?.html) {
        setPreviewHtml(data.html);
        setActiveTab('preview');
      }
    } catch (error: any) {
      console.error('Preview error:', error);
      toast({
        title: 'Preview Failed',
        description: error.message || 'Could not generate preview',
        variant: 'destructive',
      });
    } finally {
      setPreviewLoading(false);
    }
  };

  const handleSend = async () => {
    setLoading(true);
    try {
      const { data, error } = await supabase.functions.invoke('send-trustpilot-review-request', {
        body: {
          customerId,
          customerEmail,
          customerFirstName: firstName,
          subject,
          previewOnly: false,
        },
      });

      if (error) throw error;

      setSent(true);
      toast({
        title: '✅ Review Request Sent',
        description: `Trustpilot review email sent to ${customerEmail}`,
      });

      // Close dialog after a short delay
      setTimeout(() => {
        onOpenChange(false);
      }, 1500);
    } catch (error: any) {
      console.error('Send error:', error);
      toast({
        title: 'Failed to Send',
        description: error.message || 'Could not send review request',
        variant: 'destructive',
      });
    } finally {
      setLoading(false);
    }
  };

  const formatDate = (dateString: string) => {
    return new Date(dateString).toLocaleDateString('en-GB', {
      day: 'numeric',
      month: 'short',
      year: 'numeric',
      hour: '2-digit',
      minute: '2-digit',
    });
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-[700px] max-h-[90vh] overflow-hidden flex flex-col">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <div className="p-2 rounded-full bg-[#00b67a]/10">
              <Star className="h-5 w-5 text-[#00b67a] fill-[#00b67a]" />
            </div>
            Request Trustpilot Review
          </DialogTitle>
          <DialogDescription>
            Send a review request email to {customerName} ({customerEmail})
          </DialogDescription>
        </DialogHeader>

        {alreadyRequested && requestedAt && (
          <div className="bg-amber-50 border border-amber-200 rounded-lg p-3 flex items-center gap-2 text-sm text-amber-800">
            <Mail className="h-4 w-4 flex-shrink-0" />
            <span>
              Review already requested on <strong>{formatDate(requestedAt)}</strong>. Sending again will update the timestamp.
            </span>
          </div>
        )}

        {sent ? (
          <div className="flex flex-col items-center justify-center py-12">
            <div className="w-16 h-16 rounded-full bg-[#00b67a]/10 flex items-center justify-center mb-4">
              <Check className="h-8 w-8 text-[#00b67a]" />
            </div>
            <h3 className="text-lg font-semibold text-foreground mb-2">Email Sent Successfully!</h3>
            <p className="text-muted-foreground text-center">
              Review request has been sent to {customerEmail}
            </p>
          </div>
        ) : (
          <Tabs value={activeTab} onValueChange={setActiveTab} className="flex-1 flex flex-col overflow-hidden">
            <TabsList className="grid w-full grid-cols-2">
              <TabsTrigger value="edit" className="flex items-center gap-2">
                <Mail className="h-4 w-4" />
                Edit Email
              </TabsTrigger>
              <TabsTrigger value="preview" className="flex items-center gap-2" disabled={!previewHtml}>
                <Eye className="h-4 w-4" />
                Preview
              </TabsTrigger>
            </TabsList>

            <TabsContent value="edit" className="flex-1 space-y-4 mt-4">
              <div className="space-y-2">
                <Label htmlFor="subject">Email Subject</Label>
                <Input
                  id="subject"
                  value={subject}
                  onChange={(e) => setSubject(e.target.value)}
                  placeholder="Enter email subject"
                />
              </div>

              <div className="space-y-2">
                <Label>Recipient</Label>
                <div className="p-3 bg-muted rounded-md">
                  <p className="font-medium">{customerName}</p>
                  <p className="text-sm text-muted-foreground">{customerEmail}</p>
                </div>
              </div>

              <div className="space-y-2">
                <Label>Email Template Preview</Label>
                <div className="p-4 bg-muted/50 rounded-md text-sm space-y-3 border">
                  <p><strong>Hi {firstName},</strong></p>
                  <p>We hope you're getting on well since purchasing your warranty with Buy A Warranty.</p>
                  <p>We wanted to check in and hear about your experience buying your warranty with us.</p>
                  <p>If you have a spare moment, we'd really appreciate your honest feedback on Trustpilot...</p>
                  <div className="py-2">
                    <span className="inline-block px-4 py-2 bg-[#00b67a] text-white rounded text-sm font-medium">
                      👉 Leave a quick review on Trustpilot
                    </span>
                  </div>
                  <p className="text-muted-foreground italic">It takes around 60 seconds...</p>
                </div>
              </div>
            </TabsContent>

            <TabsContent value="preview" className="flex-1 overflow-hidden mt-4">
              <ScrollArea className="h-[400px] border rounded-lg">
                {previewHtml && (
                  <iframe
                    srcDoc={previewHtml}
                    title="Email Preview"
                    className="w-full h-[600px] border-0"
                    sandbox="allow-same-origin"
                  />
                )}
              </ScrollArea>
            </TabsContent>
          </Tabs>
        )}

        {!sent && (
          <DialogFooter className="flex-shrink-0 gap-2 sm:gap-0">
            <Button
              variant="outline"
              onClick={handlePreview}
              disabled={previewLoading || loading}
            >
              {previewLoading ? (
                <>
                  <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                  Loading...
                </>
              ) : (
                <>
                  <Eye className="h-4 w-4 mr-2" />
                  Preview Email
                </>
              )}
            </Button>
            <Button
              onClick={handleSend}
              disabled={loading}
              className="bg-[#00b67a] hover:bg-[#00a870] text-white"
            >
              {loading ? (
                <>
                  <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                  Sending...
                </>
              ) : (
                <>
                  <Send className="h-4 w-4 mr-2" />
                  Send Review Request
                </>
              )}
            </Button>
          </DialogFooter>
        )}
      </DialogContent>
    </Dialog>
  );
};
