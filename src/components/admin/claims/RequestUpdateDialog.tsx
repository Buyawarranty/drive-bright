import React, { useState } from 'react';
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle, DialogFooter } from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Textarea } from '@/components/ui/textarea';
import { Label } from '@/components/ui/label';
import { Badge } from '@/components/ui/badge';
import { Send, ExternalLink, X, Loader2 } from 'lucide-react';
import { supabase } from '@/integrations/supabase/client';
import { useToast } from '@/hooks/use-toast';

interface RequestUpdateDialogProps {
  claims: Array<{
    id: string;
    name: string;
    vehicle_registration?: string;
    claim_reason?: string;
  }>;
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onSent: () => void;
}

export const RequestUpdateDialog: React.FC<RequestUpdateDialogProps> = ({
  claims,
  open,
  onOpenChange,
  onSent,
}) => {
  const { toast } = useToast();
  const [recipientEmail, setRecipientEmail] = useState('');
  const [message, setMessage] = useState('');
  const [sending, setSending] = useState(false);
  const [selectedClaims, setSelectedClaims] = useState<typeof claims>(claims);

  React.useEffect(() => {
    setSelectedClaims(claims);
  }, [claims]);

  const removeClaim = (id: string) => {
    setSelectedClaims(prev => prev.filter(c => c.id !== id));
  };

  const handleSend = async () => {
    if (!recipientEmail.trim() || selectedClaims.length === 0) {
      toast({ title: "Error", description: "Please enter a recipient email and select at least one claim", variant: "destructive" });
      return;
    }

    setSending(true);
    try {
      const { error } = await supabase.functions.invoke('send-claim-update-request', {
        body: {
          claimIds: selectedClaims.map(c => c.id),
          recipientEmail: recipientEmail.trim(),
          message: message.trim() || undefined,
        },
      });

      if (error) throw error;

      toast({
        title: "Update Request Sent",
        description: `Request sent to ${recipientEmail} for ${selectedClaims.length} claim(s)`,
      });

      onSent();
      onOpenChange(false);
      setRecipientEmail('');
      setMessage('');
    } catch (error) {
      console.error('Error:', error);
      toast({ title: "Error", description: "Failed to send update request", variant: "destructive" });
    } finally {
      setSending(false);
    }
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-xl">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <ExternalLink className="h-5 w-5" />
            Request Claim Update
          </DialogTitle>
          <DialogDescription>
            Send a form link to an external party to provide updates on these claims
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-4">
          {/* Selected claims */}
          <div className="space-y-2">
            <Label>Claims ({selectedClaims.length})</Label>
            <div className="flex flex-wrap gap-2 max-h-32 overflow-y-auto p-2 bg-muted/30 rounded-lg border">
              {selectedClaims.map((claim) => (
                <Badge key={claim.id} variant="secondary" className="flex items-center gap-1.5 py-1.5 px-3">
                  <span className="bg-yellow-400 border border-black px-1.5 py-0.5 rounded text-[10px] font-black tracking-wide" style={{ fontFamily: "'Arial Black', Arial, sans-serif" }}>
                    {claim.vehicle_registration?.toUpperCase() || 'N/A'}
                  </span>
                  <span className="text-xs">{claim.name}</span>
                  {selectedClaims.length > 1 && (
                    <button onClick={() => removeClaim(claim.id)} className="ml-1 hover:text-destructive">
                      <X className="h-3 w-3" />
                    </button>
                  )}
                </Badge>
              ))}
            </div>
          </div>

          {/* Recipient */}
          <div className="space-y-1.5">
            <Label>Recipient Email <span className="text-red-500">*</span></Label>
            <Input
              type="email"
              value={recipientEmail}
              onChange={(e) => setRecipientEmail(e.target.value)}
              placeholder="e.g. sachin@claimscompany.com"
            />
          </div>

          {/* Optional message */}
          <div className="space-y-1.5">
            <Label>Additional Message <span className="text-muted-foreground text-xs">(optional)</span></Label>
            <Textarea
              value={message}
              onChange={(e) => setMessage(e.target.value)}
              placeholder="Any specific instructions or context..."
              rows={3}
            />
          </div>

          <div className="bg-blue-50 border border-blue-200 rounded-lg p-3 text-xs text-blue-700">
            <strong>How it works:</strong> The recipient will receive an email with a link for each claim. They can fill in the status, notes, invoice details, and upload documents. You'll be notified when they respond.
          </div>
        </div>

        <DialogFooter>
          <Button variant="outline" onClick={() => onOpenChange(false)}>Cancel</Button>
          <Button onClick={handleSend} disabled={sending || !recipientEmail.trim() || selectedClaims.length === 0}>
            {sending ? <><Loader2 className="h-4 w-4 mr-2 animate-spin" /> Sending...</> : <><Send className="h-4 w-4 mr-2" /> Send Request</>}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
};
