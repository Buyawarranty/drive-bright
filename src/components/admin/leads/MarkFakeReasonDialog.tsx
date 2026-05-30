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
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { RadioGroup, RadioGroupItem } from '@/components/ui/radio-group';
import { AlertTriangle } from 'lucide-react';

export const FAKE_REASONS = [
  { value: 'wrong_number',     label: 'Wrong number — phone is disconnected or wrong person' },
  { value: 'no_intent',        label: 'No intent — answered but not a real enquiry' },
  { value: 'competitor_test',  label: 'Competitor / mystery shopper' },
  { value: 'spam_bot',         label: 'Spam / bot submission' },
  { value: 'duplicate_test',   label: 'Duplicate or test entry' },
  { value: 'unreachable',      label: 'Unreachable after multiple call attempts' },
  { value: 'other',            label: 'Other (please explain)' },
] as const;

export type FakeReasonValue = typeof FAKE_REASONS[number]['value'];

interface MarkFakeReasonDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  leadName?: string;
  leadPhone?: string | null;
  callCount?: number;
  onConfirm: (payload: { reason: FakeReasonValue; note: string }) => void | Promise<void>;
}

export const MarkFakeReasonDialog: React.FC<MarkFakeReasonDialogProps> = ({
  open,
  onOpenChange,
  leadName,
  leadPhone,
  callCount = 0,
  onConfirm,
}) => {
  const [reason, setReason] = useState<FakeReasonValue>('wrong_number');
  const [note, setNote] = useState('');
  const [submitting, setSubmitting] = useState(false);

  const requiresNote = reason === 'other';
  const canSubmit = !!reason && (!requiresNote || note.trim().length >= 3);

  const handleSubmit = async () => {
    if (!canSubmit) return;
    setSubmitting(true);
    try {
      await onConfirm({ reason, note: note.trim() });
      setReason('wrong_number');
      setNote('');
      onOpenChange(false);
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <Dialog open={open} onOpenChange={(o) => !submitting && onOpenChange(o)}>
      <DialogContent className="max-w-lg">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <AlertTriangle className="h-5 w-5 text-red-600" />
            Mark as Fake 404
          </DialogTitle>
          <DialogDescription>
            This will be audited. Please tell us why this lead is fake — managers review every fake mark weekly and monthly.
            {leadName && <><br /><strong>Lead:</strong> {leadName}{leadPhone ? ` — ${leadPhone}` : ''}</>}
            {callCount === 0 && (
              <span className="block mt-2 text-amber-700 bg-amber-50 border border-amber-200 rounded px-2 py-1 text-xs">
                ⚠️ No call attempts have been logged for this lead. Consider logging at least one call attempt before marking fake.
              </span>
            )}
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-4 py-2">
          <div>
            <Label className="text-sm font-semibold">Reason</Label>
            <RadioGroup
              value={reason}
              onValueChange={(v) => setReason(v as FakeReasonValue)}
              className="mt-2 space-y-1.5"
            >
              {FAKE_REASONS.map(r => (
                <div key={r.value} className="flex items-start gap-2">
                  <RadioGroupItem value={r.value} id={`fake-${r.value}`} className="mt-0.5" />
                  <Label htmlFor={`fake-${r.value}`} className="text-sm font-normal cursor-pointer leading-snug">
                    {r.label}
                  </Label>
                </div>
              ))}
            </RadioGroup>
          </div>

          <div>
            <Label htmlFor="fake-note" className="text-sm font-semibold">
              Note {requiresNote ? <span className="text-red-600">*</span> : <span className="text-muted-foreground font-normal">(optional)</span>}
            </Label>
            <Textarea
              id="fake-note"
              value={note}
              onChange={(e) => setNote(e.target.value)}
              placeholder={requiresNote ? 'Please explain why…' : 'Anything else the auditor should know?'}
              className="mt-1"
              rows={3}
            />
          </div>
        </div>

        <DialogFooter>
          <Button variant="outline" onClick={() => onOpenChange(false)} disabled={submitting}>
            Cancel
          </Button>
          <Button
            onClick={handleSubmit}
            disabled={!canSubmit || submitting}
            className="bg-red-600 hover:bg-red-700"
          >
            {submitting ? 'Marking…' : 'Mark as Fake 404'}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
};
