import React, { useState, useEffect } from 'react';
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
import { Badge } from '@/components/ui/badge';
import { Phone, PhoneOff, Voicemail, PhoneCall, AlertTriangle, Calendar } from 'lucide-react';
import { CallOutcome } from '@/hooks/useLeadCallTracking';
import { format, addHours } from 'date-fns';
import { cn } from '@/lib/utils';

interface CallAttemptDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  leadName: string;
  currentCallCount: number;
  maxCallAttempts: number;
  followUpIntervals: Record<string, number>;
  onSubmit: (outcome: CallOutcome, notes: string) => Promise<void>;
}

const OUTCOME_OPTIONS: { value: CallOutcome; label: string; icon: React.ReactNode; description: string }[] = [
  { value: 'no_answer', label: 'No Answer', icon: <PhoneOff className="h-4 w-4" />, description: 'No one picked up' },
  { value: 'voicemail', label: 'Voicemail', icon: <Voicemail className="h-4 w-4" />, description: 'Left a voicemail' },
  { value: 'connected', label: 'Connected', icon: <PhoneCall className="h-4 w-4" />, description: 'Spoke with lead' },
  { value: 'wrong_number', label: 'Wrong Number', icon: <AlertTriangle className="h-4 w-4" />, description: 'Invalid contact' },
  { value: 'busy', label: 'Busy', icon: <Phone className="h-4 w-4" />, description: 'Line was busy' },
  { value: 'callback_scheduled', label: 'Callback Scheduled', icon: <Calendar className="h-4 w-4" />, description: 'Arranged callback' },
];

export const CallAttemptDialog: React.FC<CallAttemptDialogProps> = ({
  open,
  onOpenChange,
  leadName,
  currentCallCount,
  maxCallAttempts,
  followUpIntervals,
  onSubmit
}) => {
  const [outcome, setOutcome] = useState<CallOutcome>('no_answer');
  const [notes, setNotes] = useState('');
  const [isSubmitting, setIsSubmitting] = useState(false);

  const newAttemptNumber = currentCallCount + 1;
  const isMaxReached = newAttemptNumber >= maxCallAttempts;

  // Calculate suggested next follow-up
  const getNextFollowUp = () => {
    if (outcome === 'connected' || outcome === 'wrong_number' || outcome === 'callback_scheduled') {
      return null;
    }
    const hours = followUpIntervals[String(newAttemptNumber)] || 24;
    return addHours(new Date(), hours);
  };

  const nextFollowUp = getNextFollowUp();

  // Reset form when dialog opens
  useEffect(() => {
    if (open) {
      setOutcome('no_answer');
      setNotes('');
    }
  }, [open]);

  const handleSubmit = async () => {
    setIsSubmitting(true);
    try {
      await onSubmit(outcome, notes);
      onOpenChange(false);
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-[425px]">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <Phone className="h-5 w-5 text-primary" />
            Log Call Attempt #{newAttemptNumber}
          </DialogTitle>
          <DialogDescription>
            Recording call to <span className="font-medium text-foreground">{leadName || 'Lead'}</span>
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-4 py-4">
          {/* Max attempts warning */}
          {isMaxReached && (
            <div className="flex items-center gap-2 p-3 bg-amber-50 border border-amber-200 rounded-lg">
              <AlertTriangle className="h-4 w-4 text-amber-600 flex-shrink-0" />
              <p className="text-sm text-amber-800">
                This is attempt #{newAttemptNumber} of {maxCallAttempts}. Consider moving to nurture if no response.
              </p>
            </div>
          )}

          {/* Outcome selection */}
          <div className="space-y-2">
            <Label>Call Outcome</Label>
            <RadioGroup
              value={outcome}
              onValueChange={(value) => setOutcome(value as CallOutcome)}
              className="grid grid-cols-2 gap-2"
            >
              {OUTCOME_OPTIONS.map((option) => (
                <div key={option.value}>
                  <RadioGroupItem
                    value={option.value}
                    id={option.value}
                    className="peer sr-only"
                  />
                  <Label
                    htmlFor={option.value}
                    className={cn(
                      "flex flex-col items-center justify-center rounded-lg border-2 border-muted bg-popover p-3 hover:bg-accent hover:text-accent-foreground cursor-pointer transition-all",
                      "peer-data-[state=checked]:border-primary peer-data-[state=checked]:bg-primary/5"
                    )}
                  >
                    <span className={cn(
                      "mb-1",
                      outcome === option.value ? "text-primary" : "text-muted-foreground"
                    )}>
                      {option.icon}
                    </span>
                    <span className="text-xs font-medium">{option.label}</span>
                  </Label>
                </div>
              ))}
            </RadioGroup>
          </div>

          {/* Notes */}
          <div className="space-y-2">
            <Label htmlFor="notes">Notes (optional)</Label>
            <Textarea
              id="notes"
              placeholder="Add any notes about this call..."
              value={notes}
              onChange={(e) => setNotes(e.target.value.slice(0, 200))}
              className="resize-none h-20"
              maxLength={200}
            />
            <p className="text-xs text-muted-foreground text-right">{notes.length}/200</p>
          </div>

          {/* Next follow-up suggestion */}
          {nextFollowUp && (
            <div className="flex items-center gap-2 p-3 bg-blue-50 border border-blue-200 rounded-lg">
              <Calendar className="h-4 w-4 text-blue-600 flex-shrink-0" />
              <div className="text-sm">
                <span className="text-blue-800">Suggested next call: </span>
                <Badge variant="outline" className="ml-1 bg-white">
                  {format(nextFollowUp, 'MMM d, h:mm a')}
                </Badge>
              </div>
            </div>
          )}
        </div>

        <DialogFooter className="gap-2 sm:gap-0">
          <Button variant="outline" onClick={() => onOpenChange(false)} disabled={isSubmitting}>
            Cancel
          </Button>
          <Button onClick={handleSubmit} disabled={isSubmitting}>
            {isSubmitting ? 'Logging...' : 'Log Call Attempt'}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
};
