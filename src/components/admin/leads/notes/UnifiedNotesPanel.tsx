import React, { useState, useEffect, useRef, useMemo, useCallback } from 'react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { 
 Pin, PinOff, Trash2, 
 Edit2, Check, X, Loader2, Save
} from 'lucide-react';
import { cn } from '@/lib/utils';
import { format } from 'date-fns';
import { useLeadQuickNotes, QuickNote, readPendingQueuedNotes, writePendingQueuedNotes } from '@/hooks/useLeadQuickNotes';
import { toast } from 'sonner';
import { supabase } from '@/integrations/supabase/client';
import {
  clearOpenPoolReservation,
  getOpenPoolReservation,
  useOpenPoolReservation,
  useReservationCountdown,
} from '@/hooks/useOpenLeadPoolReservation';
import { Clock } from 'lucide-react';

const NOTE_DRAFT_STORAGE_KEY_PREFIX = 'lead-quick-note-draft:';

/**
 * Reservation countdown badge shown inside the Quick Log Outcome header.
 * Defaults visually to 2:00 when a reservation exists so agents always see
 * the timer next to the outcome buttons without needing to look elsewhere.
 */
const ReservationTimerBadge: React.FC<{ leadId: string }> = ({ leadId }) => {
  const reservation = useOpenPoolReservation();
  const remaining = useReservationCountdown(reservation);
  if (!reservation || reservation.lead.id !== leadId) return null;

  if (reservation.phase === 'calling') {
    return (
      <span className="inline-flex items-center gap-1 rounded-full border border-emerald-300 bg-emerald-50 px-2 py-0.5 text-[11px] font-semibold text-emerald-800">
        <Clock className="h-3 w-3" />
        On call — take your time
      </span>
    );
  }

  const shown = remaining > 0 ? remaining : reservation.holdSeconds;
  const mm = Math.floor(shown / 60);
  const ss = String(shown % 60).padStart(2, '0');
  const warn = remaining > 0 && remaining <= 30;
  return (
    <span
      className={cn(
        'inline-flex items-center gap-1 rounded-full border px-2 py-0.5 text-[11px] font-semibold tabular-nums',
        warn
          ? 'border-amber-400 bg-amber-50 text-amber-900'
          : 'border-emerald-300 bg-emerald-50 text-emerald-800',
      )}
      title="Time left to start the call before the lead is released"
    >
      <Clock className="h-3 w-3" />
      Reserved · {mm}:{ss}
    </span>
  );
};

interface UnifiedNotesPanelProps {
  leadId: string;
  className?: string;
  compact?: boolean;
}

export const UnifiedNotesPanel: React.FC<UnifiedNotesPanelProps> = ({
  leadId,
  className,
  compact = false
}) => {
  const { notes, loading, addNote, updateNote, togglePin, deleteNote, refetch, isAbandonedCart, isSaving: hookIsSaving } = useLeadQuickNotes(leadId);
  const draftStorageKey = `${NOTE_DRAFT_STORAGE_KEY_PREFIX}${leadId}`;
  
  // Quick note input state
  const [quickNoteValue, setQuickNoteValue] = useState('');
  const [isSaving, setIsSaving] = useState(false);
  const savingTimerRef = useRef<NodeJS.Timeout | null>(null);
  
  // Edit state
  const [editingNoteId, setEditingNoteId] = useState<string | null>(null);
  const [editValue, setEditValue] = useState('');
  
  // Undo state
  const [deletedNote, setDeletedNote] = useState<QuickNote | null>(null);
  const [outcomeStep, setOutcomeStep] = useState<'choose' | 'spoken' | 'no_answer'>('choose');
  const [keptStatus, setKeptStatus] = useState<{ label: string } | null>(null);
  const undoTimeoutRef = useRef<NodeJS.Timeout | null>(null);

  // Track latest values in refs for cleanup
  const quickNoteRef = useRef(quickNoteValue);
  const addNoteRef = useRef(addNote);
  const isSavingRef = useRef(isSaving);
  const pendingDraftIdRef = useRef<string | null>(null);
  quickNoteRef.current = quickNoteValue;
  addNoteRef.current = addNote;
  isSavingRef.current = isSaving;

  const queuePendingNote = useCallback((noteText: string) => {
    const trimmed = noteText.trim();
    if (!trimmed) return null;

    const queueId = pendingDraftIdRef.current || `${leadId}:${Date.now()}`;
    pendingDraftIdRef.current = queueId;

    const nextQueue = [
      ...readPendingQueuedNotes().filter(note => note.id !== queueId),
      {
        id: queueId,
        leadId,
        noteText: trimmed,
        createdAt: new Date().toISOString(),
      },
    ];

    writePendingQueuedNotes(nextQueue);
    return queueId;
  }, [leadId]);

  const clearQueuedPendingNote = useCallback((queueId: string | null) => {
    if (!queueId) return;

    writePendingQueuedNotes(readPendingQueuedNotes().filter(note => note.id !== queueId));
    if (pendingDraftIdRef.current === queueId) {
      pendingDraftIdRef.current = null;
    }
  }, []);

  const handleQuickNoteChange = useCallback((value: string) => {
    setQuickNoteValue(value);
    quickNoteRef.current = value;

    if (value.trim()) {
      queuePendingNote(value);
    } else {
      clearQueuedPendingNote(pendingDraftIdRef.current);
    }
  }, [queuePendingNote, clearQueuedPendingNote]);

  const flushPendingNoteRef = useRef<() => Promise<void>>(async () => {});

  const persistDraft = useCallback((value: string) => {
    if (typeof window === 'undefined') return;

    const trimmed = value.trim();
    if (trimmed) {
      window.sessionStorage.setItem(draftStorageKey, value);
    } else {
      window.sessionStorage.removeItem(draftStorageKey);
    }
  }, [draftStorageKey]);

  const commitNote = useCallback(async (noteText: string, options?: { silent?: boolean }) => {
    const pending = noteText.trim();
    if (!pending || isSavingRef.current || hookIsSaving) return false;

    const queueId = queuePendingNote(pending);
    isSavingRef.current = true;
    setIsSaving(true);

    try {
      await addNoteRef.current(pending);
      quickNoteRef.current = '';
      handleQuickNoteChange('');
      persistDraft('');
      clearQueuedPendingNote(queueId);
      if (!options?.silent) {
        toast.success('Note saved');
      }
      return true;
    } catch (error: any) {
      if (!options?.silent) {
        toast.error(error?.message === 'Session expired' ? 'Session expired — please log in again' : 'Failed to save note');
      }
      return false;
    } finally {
      isSavingRef.current = false;
      setIsSaving(false);
    }
  }, [hookIsSaving, queuePendingNote, persistDraft, clearQueuedPendingNote, handleQuickNoteChange]);

  const flushPendingNote = useCallback(async () => {
    await commitNote(quickNoteRef.current, { silent: true });
  }, [commitNote]);

  flushPendingNoteRef.current = flushPendingNote;

  // Auto-save unsaved note on unmount (e.g. collapsing the panel)
  useEffect(() => {
    return () => {
      void flushPendingNoteRef.current();
    };
  }, [leadId]);

  useEffect(() => {
    const handleVisibilityChange = () => {
      if (document.visibilityState === 'hidden') {
        void flushPendingNote();
      }
    };

    const handlePageHide = () => {
      void flushPendingNote();
    };

    document.addEventListener('visibilitychange', handleVisibilityChange);
    window.addEventListener('pagehide', handlePageHide);
    window.addEventListener('beforeunload', handlePageHide);

    return () => {
      document.removeEventListener('visibilitychange', handleVisibilityChange);
      window.removeEventListener('pagehide', handlePageHide);
      window.removeEventListener('beforeunload', handlePageHide);
    };
  }, [flushPendingNote]);

  // Reset state when lead changes
  useEffect(() => {
    const savedDraft = typeof window !== 'undefined'
      ? window.sessionStorage.getItem(draftStorageKey) || ''
      : '';

    handleQuickNoteChange(savedDraft);
    setIsSaving(false);
    setEditingNoteId(null);
    if (savingTimerRef.current) clearTimeout(savingTimerRef.current);
  }, [draftStorageKey, leadId, handleQuickNoteChange]);

  useEffect(() => {
    persistDraft(quickNoteValue);
  }, [quickNoteValue, persistDraft]);

  useEffect(() => {
    const pendingQueueItem = readPendingQueuedNotes().find(note => note.leadId === leadId);
    if (!pendingQueueItem) return;

    pendingDraftIdRef.current = pendingQueueItem.id;
    setQuickNoteValue(prev => prev || pendingQueueItem.noteText);
    void commitNote(pendingQueueItem.noteText, { silent: true });
  }, [leadId, commitNote]);

  // Safety reset: if isSaving is stuck for >10s, auto-reset
  useEffect(() => {
    if (isSaving) {
      savingTimerRef.current = setTimeout(() => {
        setIsSaving(false);
        setIsSaving(false);
      }, 10000);
    } else {
      if (savingTimerRef.current) {
        clearTimeout(savingTimerRef.current);
        savingTimerRef.current = null;
      }
    }
    return () => {
      if (savingTimerRef.current) clearTimeout(savingTimerRef.current);
    };
  }, [isSaving]);

  const handleSaveNote = async () => {
    if (isSaving || hookIsSaving) return;
    await commitNote(quickNoteValue);
  };

  const handleStartEdit = (note: QuickNote) => {
    setEditingNoteId(note.id);
    setEditValue(note.note_text);
  };

  const handleSaveEdit = async () => {
    if (!editingNoteId || !editValue.trim()) {
      setEditingNoteId(null);
      setEditValue('');
      return;
    }
    
    try {
      await updateNote(editingNoteId, editValue.trim());
      toast.success('Note updated');
    } catch (error) {
      toast.error('Failed to update note');
    }
    
    setEditingNoteId(null);
    setEditValue('');
  };

  const handleCancelEdit = () => {
    setEditingNoteId(null);
    setEditValue('');
  };

  const handleDelete = async (note: QuickNote) => {
    setDeletedNote(note);
    
    if (undoTimeoutRef.current) {
      clearTimeout(undoTimeoutRef.current);
    }
    
    toast.success('Note deleted', {
      duration: 10000,
      action: {
        label: 'Undo',
        onClick: () => handleUndo(note)
      }
    });
    
    undoTimeoutRef.current = setTimeout(async () => {
      try {
        await deleteNote(note.id);
        setDeletedNote(null);
      } catch (error) {
        toast.error('Failed to delete note');
      }
    }, 10000);
  };

  const handleUndo = async (note: QuickNote) => {
    if (undoTimeoutRef.current) {
      clearTimeout(undoTimeoutRef.current);
    }
    setDeletedNote(null);
    toast.success('Note restored');
    await refetch();
  };

  // Combine real notes + optimistic notes, filter out deleted
  const visibleNotes = useMemo(() => {
    return notes.filter(note => !(deletedNote && note.id === deletedNote.id));
  }, [notes, deletedNote]);

  if (loading) {
    return (
      <div className={cn("space-y-3", className)}>
        <div className="flex items-center gap-2 text-sm text-muted-foreground">
          <Loader2 className="h-4 w-4 animate-spin" />
          Loading notes...
        </div>
      </div>
    );
  }

  type PoolOutcome =
    | 'no_answer'
    | 'voicemail_left'
    | 'callback_requested'
    | 'not_interested'
    | 'wrong_number'
    | 'quote_sent'
    | 'spoke_to_customer';

  type SubOutcome = {
    label: string;
    text: string;
    tone: string;
    outcome: PoolOutcome;
    releases?: boolean;
    needsReason?: boolean;
    hint?: string;
  };

  // All non-releasing outcomes here KEEP the lead assigned to the current agent
  // (green confirmation banner shown after selection).
  const SPOKEN_SUB_OUTCOMES: SubOutcome[] = [
    { label: 'Callback scheduled', text: '📞 Callback scheduled', tone: 'bg-violet-50 text-violet-800 border-violet-200 hover:bg-violet-100', outcome: 'callback_requested', hint: 'Lead becomes yours — pick a date/time to call them back' },
    { label: 'Quote sent', text: '✉️ Quote sent', tone: 'bg-blue-50 text-blue-800 border-blue-200 hover:bg-blue-100', outcome: 'quote_sent', hint: 'Lead becomes yours — emailed the quote, follow up later' },
    { label: 'Sale closed', text: '✅ Sale closed', tone: 'bg-emerald-50 text-emerald-800 border-emerald-200 hover:bg-emerald-100', outcome: 'spoke_to_customer', hint: 'Lead becomes yours — customer paid / policy activated' },
    { label: 'Not interested', text: '🚫 Not interested', tone: 'bg-rose-50 text-rose-800 border-rose-200 hover:bg-rose-100', outcome: 'not_interested', releases: true, needsReason: true, hint: 'Closes the lead and releases it — asks for reason' },
    { label: 'Do not contact', text: '🔕 Do not contact', tone: 'bg-slate-100 text-slate-800 border-slate-300 hover:bg-slate-200', outcome: 'not_interested', releases: true, needsReason: true, hint: 'Opt-out request — closes and releases the lead' },
  ];

  // NOTE: "releases: true" here means the reservation slot is freed so you can
  // take another lead — the LEAD itself stays locked to you for the protected
  // retry window (default 15 min, configurable in Lead Teams → Open Lead Pool).
  // No other agent can grab it during that window. If you don't retry in time,
  // it converts to a chase lock and then recycles back into the pool.
  const NO_ANSWER_SUB_OUTCOMES: SubOutcome[] = [
    { label: 'Voicemail left', text: '📞 Left voicemail', tone: 'bg-sky-50 text-sky-800 border-sky-200 hover:bg-sky-100', outcome: 'voicemail_left', releases: true, hint: 'No answer — lead locked to you for 15 min. Retry within that window, or it recycles to the pool.' },
    { label: 'Busy', text: '📞 Line busy', tone: 'bg-orange-50 text-orange-800 border-orange-200 hover:bg-orange-100', outcome: 'no_answer', releases: true, hint: 'No answer — lead locked to you for 15 min. Retry within that window, or it recycles to the pool.' },
    { label: 'No answer', text: '⏱ No answer — retry later', tone: 'bg-amber-50 text-amber-800 border-amber-200 hover:bg-amber-100', outcome: 'no_answer', releases: true, hint: 'Lead locked to you for 15 min. You must retry within that window; after that it recycles to the pool.' },
    { label: 'Wrong number', text: '❌ Wrong number', tone: 'bg-red-50 text-red-800 border-red-200 hover:bg-red-100', outcome: 'wrong_number', releases: true, needsReason: true, hint: 'Marks the number invalid and closes the lead — asks for a reason.' },
  ];

  const handleQuickAction = async (action: SubOutcome) => {
    if (isSaving || hookIsSaving) return;

    // Always log the note so history is preserved
    await commitNote(action.text);

    if (!action.outcome) return;

    try {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) return;

      const reservation = getOpenPoolReservation();
      if (!reservation || reservation.lead.id !== leadId) return;

      let reason: string | undefined;
      if (action.needsReason) {
        const input = window.prompt(`Reason for "${action.label}"?`);
        if (!input || !input.trim()) {
          toast.error('Reason required — outcome not logged');
          return;
        }
        reason = input.trim();
      }

      let nextActionAt: string | undefined;
      if (action.outcome === 'callback_requested') {
        const when = window.prompt(
          'Callback date/time (YYYY-MM-DD HH:MM)?',
          format(new Date(Date.now() + 60 * 60 * 1000), 'yyyy-MM-dd HH:mm')
        );
        if (!when) return;
        const parsed = new Date(when.replace(' ', 'T'));
        if (isNaN(parsed.getTime())) {
          toast.error('Invalid date — outcome not logged');
          return;
        }
        nextActionAt = parsed.toISOString();
      }

      const { error } = await supabase.rpc('open_pool_log_outcome', {
        _lead_id: leadId,
        _agent: user.id,
        _outcome: action.outcome,
        _reason: reason,
        _next_action_at: nextActionAt,
      });

      if (error) {
        console.error('open_pool_log_outcome failed:', error);
        toast.error(`Could not update pool: ${error.message}`);
        return;
      }

      if (action.releases) {
        clearOpenPoolReservation();
        toast.success('Lead released — take the next one', {
          description: action.label,
        });
      } else {
        clearOpenPoolReservation();
        setKeptStatus({ label: action.label });
        toast.success(`✅ This lead is now yours — ${action.label}`, {
          description: 'Logged. It stays assigned to you.',
        });
      }
      setOutcomeStep('choose');
    } catch (err) {
      console.error('Quick outcome error:', err);
    }
  };

  // Sort: pinned first, then newest
  const sortedNotes = useMemo(() => {
    return [...visibleNotes].sort((a, b) => {
      if (a.is_pinned && !b.is_pinned) return -1;
      if (!a.is_pinned && b.is_pinned) return 1;
      return new Date(b.created_at).getTime() - new Date(a.created_at).getTime();
    });
  }, [visibleNotes]);

  // Reset the outcome chooser whenever we switch leads.
  useEffect(() => { setOutcomeStep('choose'); setKeptStatus(null); }, [leadId]);

  const activeSubOutcomes =
    outcomeStep === 'spoken' ? SPOKEN_SUB_OUTCOMES :
    outcomeStep === 'no_answer' ? NO_ANSWER_SUB_OUTCOMES : [];

  // Track whether this lead has ever been reserved by the current agent while
  // the panel was mounted. If the reservation later disappears, we know it was
  // auto-released back to the Open Pool and outcome logging is no longer valid.
  const liveReservation = useOpenPoolReservation();
  const wasReservedRef = useRef(false);
  useEffect(() => {
    if (liveReservation && liveReservation.lead.id === leadId) {
      wasReservedRef.current = true;
    }
  }, [liveReservation?.lead.id, leadId]);
  const isReleasedFromPool =
    wasReservedRef.current &&
    (!liveReservation || liveReservation.lead.id !== leadId);

  return (
    <div className={cn("rounded-lg border border-border bg-card shadow-sm", className)}>
      {/* Quick log — two-step chooser */}
      <div className="px-4 pt-4 pb-3 border-b border-border">
        <div className="flex items-center justify-between mb-2 gap-2">
          <p className="text-[11px] font-semibold uppercase tracking-wide text-muted-foreground">
            Quick log outcome
          </p>
          <div className="flex items-center gap-2">
            <ReservationTimerBadge leadId={leadId} />
            {!isReleasedFromPool && outcomeStep !== 'choose' && (
              <button
                type="button"
                onClick={() => setOutcomeStep('choose')}
                className="text-[11px] font-medium text-slate-500 hover:text-slate-700 underline"
              >
                ← Change
              </button>
            )}
          </div>
        </div>

        {isReleasedFromPool ? (
          <div className="rounded-md border border-amber-300 bg-amber-50 px-3 py-2.5 text-[12px] text-amber-900">
            <div className="font-semibold mb-0.5">Lead released back to the Open Pool</div>
            <div className="text-amber-800/90">
              You can no longer log an outcome for this lead. Reserve it again from the pool if you still need to work it.
            </div>
          </div>
        ) : outcomeStep === 'choose' ? (
          <div className="grid grid-cols-2 gap-2">
            <button
              type="button"
              onClick={() => setOutcomeStep('spoken')}
              disabled={isSaving || hookIsSaving}
              className="flex flex-col items-center justify-center gap-1 rounded-md border border-emerald-600 bg-emerald-600 text-white px-4 py-3 shadow-sm hover:bg-emerald-700 hover:border-emerald-700 transition-colors disabled:opacity-60 disabled:cursor-not-allowed"
            >
              <span className="text-sm font-semibold">📞 Spoken to</span>
              <span className="text-[11px] text-emerald-50/90">Connected and spoke with the customer</span>
            </button>
            <button
              type="button"
              onClick={() => setOutcomeStep('no_answer')}
              disabled={isSaving || hookIsSaving}
              className="flex flex-col items-center justify-center gap-1 rounded-md border border-orange-600 bg-orange-600 text-white px-4 py-3 shadow-sm hover:bg-orange-700 hover:border-orange-700 transition-colors disabled:opacity-60 disabled:cursor-not-allowed"
            >
              <span className="text-sm font-semibold">📵 No answer</span>
              <span className="text-[11px] text-orange-50/90">No one answered the call</span>
            </button>
          </div>
        ) : (
          <div className="space-y-2">
            {outcomeStep === 'no_answer' && (
              <div className="rounded-md border border-amber-200 bg-amber-50 px-2.5 py-2 text-[11px] leading-snug text-amber-900">
                <div className="font-semibold mb-0.5">No answer — you have a 15-minute protected retry window</div>
                <ul className="list-disc pl-3.5 space-y-0.5">
                  <li>Only you can call this lead during the 15 minutes.</li>
                  <li>If you retry within 15 min and speak to them, the lead becomes yours.</li>
                  <li>If you retry within 15 min and still get no answer, it moves to a chase lock and then recycles to the pool.</li>
                  <li>If you don't retry within 15 min, it also recycles to the pool after a chase lock.</li>
                </ul>
                <div className="mt-1">Your reservation slot is freed so you can take another lead in the meantime.</div>
              </div>
            )}
            {outcomeStep === 'spoken' && (
              <div className="rounded-md border border-emerald-200 bg-emerald-50 px-2.5 py-2 text-[11px] leading-snug text-emerald-900">
                <span className="font-semibold">Spoken to → the lead becomes yours</span> for the chase window (see Lead Teams → Open Lead Pool). Pick the next action below.
              </div>
            )}
            <div className="flex flex-wrap gap-1.5 items-center">
              {activeSubOutcomes.map((action) => (
                <button
                  key={action.label}
                  type="button"
                  onClick={() => handleQuickAction(action)}
                  disabled={isSaving || hookIsSaving}
                  title={action.hint}
                  className={cn(
                    "px-2.5 py-1 text-xs font-medium rounded-full border transition-colors disabled:opacity-50 disabled:cursor-not-allowed",
                    action.tone
                  )}
                >
                  {action.label}
                </button>
              ))}
            </div>
          </div>
        )}
      </div>



      <div className="px-4 py-3 max-h-[320px] overflow-y-auto">
        {sortedNotes.length === 0 ? (
          <p className="text-sm text-muted-foreground italic py-2">No notes yet — use a quick log above or type below.</p>
        ) : (
          <div className="space-y-1.5">
            {sortedNotes.map((note) => {
              const isEditing = editingNoteId === note.id;
              const isOptimistic = note.id.startsWith('temp_');
              const noteDate = new Date(note.created_at);
              const datePrefix = format(noteDate, 'dd/MM');
              const timeStr = format(noteDate, 'HH:mm');

              return (
                <div
                  key={note.id}
                  className={cn(
                    "group flex items-start gap-2 py-2 px-2.5 rounded-md border transition-colors",
                    note.is_pinned
                      ? "bg-amber-50 dark:bg-amber-950/30 border-amber-300 dark:border-amber-700"
                      : "bg-background border-transparent hover:bg-muted/50 hover:border-border",
                    isOptimistic && "opacity-60"
                  )}
                >
                  {isEditing ? (
                    <div className="flex-1 flex items-center gap-2">
                      <Input
                        value={editValue}
                        onChange={(e) => setEditValue(e.target.value)}
                        className="h-8 text-sm flex-1"
                        autoFocus
                        onKeyDown={(e) => {
                          if (e.key === 'Enter') { e.preventDefault(); handleSaveEdit(); }
                          if (e.key === 'Escape') { handleCancelEdit(); }
                        }}
                      />
                      <Button size="icon" variant="ghost" className="h-7 w-7" onClick={handleSaveEdit}>
                        <Check className="h-3.5 w-3.5 text-primary" />
                      </Button>
                      <Button size="icon" variant="ghost" className="h-7 w-7" onClick={handleCancelEdit}>
                        <X className="h-3.5 w-3.5" />
                      </Button>
                    </div>
                  ) : (
                    <>
                      <div className="flex-1 min-w-0">
                        <div className="flex items-center gap-1.5 mb-0.5">
                          {note.is_pinned && (
                            <span className="inline-flex items-center gap-0.5 px-1.5 py-0.5 rounded-full bg-amber-200 dark:bg-amber-900 text-amber-900 dark:text-amber-100 text-[10px] font-semibold">
                              <Pin className="h-2.5 w-2.5" />
                              PINNED
                            </span>
                          )}
                          {isOptimistic && <Loader2 className="h-3 w-3 animate-spin text-muted-foreground" />}
                          <span className="text-muted-foreground text-[11px] font-mono tabular-nums">
                            {datePrefix} · {timeStr}
                          </span>
                        </div>
                        <p className="text-sm leading-relaxed break-words">{note.note_text}</p>
                      </div>

                      {!isOptimistic && (
                        <div className="flex items-center gap-0.5 opacity-0 group-hover:opacity-100 focus-within:opacity-100 transition-opacity flex-shrink-0">
                          {!isAbandonedCart && (
                            <button
                              onClick={() => togglePin(note.id, note.is_pinned)}
                              className={cn(
                                "p-1.5 rounded hover:bg-background",
                                note.is_pinned && "opacity-100 text-amber-600"
                              )}
                              title={note.is_pinned ? 'Unpin' : 'Pin this note'}
                            >
                              {note.is_pinned ? (
                                <PinOff className="h-3.5 w-3.5" />
                              ) : (
                                <Pin className="h-3.5 w-3.5 text-muted-foreground" />
                              )}
                            </button>
                          )}
                          <button
                            onClick={() => handleStartEdit(note)}
                            className="p-1.5 hover:bg-background rounded"
                            title="Edit"
                          >
                            <Edit2 className="h-3.5 w-3.5 text-muted-foreground" />
                          </button>
                          <button
                            onClick={() => handleDelete(note)}
                            className="p-1.5 hover:bg-background rounded"
                            title="Delete"
                          >
                            <Trash2 className="h-3.5 w-3.5 text-destructive" />
                          </button>
                        </div>
                      )}
                    </>
                  )}
                </div>
              );
            })}
          </div>
        )}
      </div>

      {/* Add note input */}
      <div className="px-4 py-3 border-t border-border bg-muted/30 rounded-b-lg">
        <div className="flex gap-2">
          <Input
            value={quickNoteValue}
            onChange={(e) => handleQuickNoteChange(e.target.value)}
            onKeyDown={(e) => {
              if (e.key === 'Enter') { e.preventDefault(); handleSaveNote(); }
            }}
            onBlur={() => { if (quickNoteValue.trim()) void flushPendingNote(); }}
            placeholder="Add a note…"
            className="flex-1 h-9 text-sm bg-background"
            disabled={isSaving || hookIsSaving}
          />
          <Button
            size="sm"
            onClick={handleSaveNote}
            disabled={!quickNoteValue.trim() || isSaving || hookIsSaving}
            className="h-9 px-4"
          >
            <Save className="h-4 w-4 mr-1.5" />
            Save
          </Button>
        </div>
      </div>
    </div>
  );
};
