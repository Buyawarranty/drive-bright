import React, { useState } from 'react';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Badge } from '@/components/ui/badge';
import { Award, ShieldCheck } from 'lucide-react';
import { CLAIM_REASONS, EVIDENCE_TYPES, useCommissionClaims } from '@/hooks/useCommissionClaims';

interface CommissionClaimDialogProps {
  customerId: string;
  leadId?: string;
  agentId: string;
  customerName?: string;
  dealValue?: number;
  trigger?: React.ReactNode;
}

export const CommissionClaimDialog: React.FC<CommissionClaimDialogProps> = ({
  customerId,
  leadId,
  agentId,
  customerName,
  dealValue,
  trigger,
}) => {
  const [open, setOpen] = useState(false);
  const [claimReason, setClaimReason] = useState('');
  const [claimNotes, setClaimNotes] = useState('');
  const [evidenceType, setEvidenceType] = useState('');
  const { submitClaim, loading } = useCommissionClaims();

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!claimReason || !claimNotes.trim()) return;

    const success = await submitClaim({
      customer_id: customerId,
      lead_id: leadId,
      agent_id: agentId,
      claim_reason: claimReason,
      claim_notes: claimNotes.trim(),
      evidence_type: evidenceType || undefined,
      deal_value: dealValue,
    });

    if (success) {
      setClaimReason('');
      setClaimNotes('');
      setEvidenceType('');
      setOpen(false);
    }
  };

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild>
        {trigger || (
          <Button variant="outline" size="sm" className="h-7 text-xs gap-1 text-amber-700 border-amber-300 hover:bg-amber-50">
            <Award className="h-3.5 w-3.5" />
            Claim Sale
          </Button>
        )}
      </DialogTrigger>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <ShieldCheck className="h-5 w-5 text-amber-600" />
            Claim Commission
          </DialogTitle>
        </DialogHeader>

        {customerName && (
          <div className="text-sm text-muted-foreground">
            Claiming credit for <span className="font-medium text-foreground">{customerName}</span>
            {dealValue ? <> — <Badge variant="outline" className="ml-1">£{dealValue.toLocaleString()}</Badge></> : null}
          </div>
        )}

        <form onSubmit={handleSubmit} className="space-y-4 mt-2">
          <div>
            <Label>How did you close this sale? <span className="text-destructive">*</span></Label>
            <Select value={claimReason} onValueChange={setClaimReason}>
              <SelectTrigger>
                <SelectValue placeholder="Select reason..." />
              </SelectTrigger>
              <SelectContent>
                {CLAIM_REASONS.map(r => (
                  <SelectItem key={r.value} value={r.value}>{r.label}</SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>

          <div>
            <Label>Evidence type</Label>
            <Select value={evidenceType} onValueChange={setEvidenceType}>
              <SelectTrigger>
                <SelectValue placeholder="Optional — select evidence type" />
              </SelectTrigger>
              <SelectContent>
                {EVIDENCE_TYPES.map(e => (
                  <SelectItem key={e.value} value={e.value}>{e.label}</SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>

          <div>
            <Label>Explain how you influenced this sale <span className="text-destructive">*</span></Label>
            <Textarea
              value={claimNotes}
              onChange={(e) => setClaimNotes(e.target.value)}
              placeholder="e.g. Called the customer on 28 Feb, discussed the Gold plan, they said they'd buy online..."
              rows={3}
              required
            />
          </div>

          <div className="bg-amber-50 border border-amber-200 rounded-lg p-3 text-xs text-amber-800">
            <strong>Note:</strong> This claim will be sent to an admin for review. Commission will only be paid once approved.
          </div>

          <Button type="submit" disabled={loading || !claimReason || !claimNotes.trim()} className="w-full">
            {loading ? 'Submitting...' : 'Submit Claim for Review'}
          </Button>
        </form>
      </DialogContent>
    </Dialog>
  );
};
