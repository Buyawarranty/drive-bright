import React, { useState } from 'react';
import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover';
import { Button } from '@/components/ui/button';
import { Textarea } from '@/components/ui/textarea';
import { Tooltip, TooltipContent, TooltipTrigger } from '@/components/ui/tooltip';
import { NotebookPen, PhoneOff, Voicemail, PhoneCall, AlertTriangle, Phone, Calendar, ChevronRight } from 'lucide-react';
import { cn } from '@/lib/utils';
import { toast } from 'sonner';
import { CallOutcome, useLeadCallTracking } from '@/hooks/useLeadCallTracking';
import { Lead } from '@/hooks/useLeads';
import { addSystemNote } from '@/utils/leadSystemNotes';


interface NotesQuickActionsPopoverProps {
  lead: Lead;
  noteCount: number;
  onOpenFullNotes: () => void;
  onUpdateCallCount: (increment: number) => void;
  onScheduleFollowUp: (actionType: string, actionDate: string) => void;
  onLogActivity: (type: string, description: string) => void;
  agentId?: string;
  agentName?: string;
}

const OUTCOMES: { value: CallOutcome; label: string; icon: React.ReactNode }[] = [
  { value: 'no_answer', label: 'No answer', icon: <PhoneOff className="h-4 w-4" /> },
  { value: 'voicemail', label: 'Voicemail', icon: <Voicemail className="h-4 w-4" /> },
  { value: 'connected', label: 'Connected', icon: <PhoneCall className="h-4 w-4" /> },
  { value: 'wrong_number', label: 'Wrong number', icon: <AlertTriangle className="h-4 w-4" /> },
  { value: 'busy', label: 'Busy', icon: <Phone className="h-4 w-4" /> },
  { value: 'callback_scheduled', label: 'Callback', icon: <Calendar className="h-4 w-4" /> },
];

export const NotesQuickActionsPopover: React.FC<NotesQuickActionsPopoverProps> = ({
  lead,
  noteCount,
  onOpenFullNotes,
  onUpdateCallCount,
  onScheduleFollowUp,
  onLogActivity,
  agentId,
  agentName,
}) => {
  const [open, setOpen] = useState(false);
  const [submitting, setSubmitting] = useState<CallOutcome | null>(null);
  const [quickNote, setQuickNote] = useState('');
  const { logCallAttempt } = useLeadCallTracking();
  const hasNotes = !!(lead.notes || noteCount > 0);
  const count = noteCount > 0 ? noteCount : lead.notes ? 1 : 0;

  const handleOutcome = async (outcome: CallOutcome) => {
    setSubmitting(outcome);
    try {
      const newAttempt = (lead.call_count || 0) + 1;
      const outcomeLabel =
        OUTCOMES.find((o) => o.value === outcome)?.label ??
        outcome.replace('_', ' ');
      const trimmedNote = quickNote.trim();
      const { success, nextFollowUpDate } = await logCallAttempt({
        leadId: lead.id,
        attemptNumber: newAttempt,
        outcome,
        notes: trimmedNote || null as unknown as string | undefined,
        agentId,
        agentName,
      });
      if (success) {
        onUpdateCallCount(1);
        // Write the outcome-specific system note so the exact selection
        // appears in the notes history (the generic "Call #N attempted"
        // note added by onUpdateCallCount doesn't say WHICH outcome).
        // Append the agent's typed quick-note verbatim so it shows in the
        // lead's notes timeline as well as on the call log row.
        const systemNoteText = trimmedNote
          ? `📞 Call #${newAttempt} — ${outcomeLabel}: ${trimmedNote}`
          : `📞 Call #${newAttempt} — ${outcomeLabel}`;
        void addSystemNote(lead.id, systemNoteText, agentId);
        onLogActivity(
          'call_attempt',
          trimmedNote
            ? `Call attempt #${newAttempt}: ${outcomeLabel} — ${trimmedNote}`
            : `Call attempt #${newAttempt}: ${outcomeLabel}`,
        );
        if (nextFollowUpDate && (outcome === 'no_answer' || outcome === 'voicemail' || outcome === 'busy')) {
          onScheduleFollowUp('call', nextFollowUpDate.toISOString());
        }
        toast.success(`Logged: ${outcomeLabel}${trimmedNote ? ' (with note)' : ''}`);
        setQuickNote('');
        setOpen(false);
      }
    } finally {
      setSubmitting(null);
    }
  };


  return (
    <Popover open={open} onOpenChange={setOpen}>
      <Tooltip delayDuration={100}>
        <TooltipTrigger asChild>
          <PopoverTrigger asChild>
            <Button
              variant="ghost"
              size="sm"
              className={cn(
                "h-7 px-2 gap-1 rounded-md border transition-colors",
                hasNotes
                  ? "text-amber-800 bg-gradient-to-b from-amber-50 to-amber-100 border-amber-300 hover:from-amber-100 hover:to-amber-200 shadow-sm"
                  : "text-muted-foreground border-dashed border-muted-foreground/30 hover:text-primary hover:border-primary/40 hover:bg-primary/5"
              )}
              aria-label="Notes and quick update"
            >
              <NotebookPen className="h-3.5 w-3.5" />
              {count > 0 ? (
                <span className="text-[11px] font-bold leading-none tabular-nums">{count}</span>
              ) : (
                <span className="text-[11px] font-medium leading-none">Notes</span>
              )}
            </Button>
          </PopoverTrigger>
        </TooltipTrigger>
        <TooltipContent side="top" className="text-xs">
          Quick update or open notes
        </TooltipContent>
      </Tooltip>

      <PopoverContent
        align="start"
        className="w-80 p-2"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="text-[11px] font-medium text-muted-foreground uppercase tracking-wide px-1 pb-1.5">
          Quick note (optional)
        </div>
        <Textarea
          value={quickNote}
          onChange={(e) => setQuickNote(e.target.value)}
          placeholder="Type a quick note — e.g. 'Left voicemail, mentioned quote'"
          rows={2}
          maxLength={500}
          className="text-xs mb-2 resize-none"
          onClick={(e) => e.stopPropagation()}
        />
        <div className="text-[11px] font-medium text-muted-foreground uppercase tracking-wide px-1 pb-1.5">
          Log outcome
        </div>
        <div className="grid grid-cols-2 gap-1.5">
          {OUTCOMES.map((o) => (
            <Button
              key={o.value}
              variant="outline"
              size="sm"
              disabled={submitting !== null}
              className={cn(
                "h-9 justify-start gap-1.5 px-2 text-xs",
                submitting === o.value && "opacity-60"
              )}
              onClick={() => handleOutcome(o.value)}
            >
              <span className="text-muted-foreground">{o.icon}</span>
              <span className="truncate">{o.label}</span>
            </Button>
          ))}
        </div>
        <div className="border-t mt-2 pt-2">
          <Button
            variant="ghost"
            size="sm"
            className="w-full justify-between h-8 px-2 text-xs"
            onClick={() => {
              setOpen(false);
              onOpenFullNotes();
            }}
          >
            <span className="flex items-center gap-1.5">
              <NotebookPen className="h-3.5 w-3.5" />
              Open full notes {count > 0 && `(${count})`}
            </span>
            <ChevronRight className="h-3.5 w-3.5" />
          </Button>
        </div>
      </PopoverContent>
    </Popover>
  );
};
