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
} from '@/hooks/useOpenLeadPoolReservation';

const NOTE_DRAFT_STORAGE_KEY_PREFIX = 'lead-quick-note-draft:';

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

  const QUICK_ACTIONS: {
    label: string;
    text: string;
    tone: string;
    prominent?: boolean;
    hint?: string;
    outcome?: PoolOutcome;
    releases?: boolean;
    needsReason?: boolean;
  }[] = [
    {
      label: 'No answer',
      text: '📞 No answer',
      tone: 'bg-orange-100 text-orange-800 border-orange-300 hover:bg-orange-200 hover:border-orange-400',
      prominent: true,
      hint: 'Releases the lead back to the open pool',
      outcome: 'no_answer',
      releases: true,
    },
    { label: 'Left voicemail', text: '📞 Left voicemail', tone: 'bg-sky-50 text-sky-800 border-sky-200 hover:bg-sky-100', outcome: 'voicemail_left', releases: true, hint: 'Releases the lead — retry in 2h' },
    { label: 'Callback requested', text: '📞 Callback requested', tone: 'bg-violet-50 text-violet-800 border-violet-200 hover:bg-violet-100', outcome: 'callback_requested', hint: 'Keeps the lead assigned to you' },
    { label: 'Not interested', text: '🚫 Not interested', tone: 'bg-rose-50 text-rose-800 border-rose-200 hover:bg-rose-100', outcome: 'not_interested', releases: true, needsReason: true, hint: 'Closes the lead — asks for reason' },
    { label: 'Wrong number', text: '❌ Wrong number', tone: 'bg-red-50 text-red-800 border-red-200 hover:bg-red-100', outcome: 'wrong_number', releases: true, needsReason: true, hint: 'Marks invalid — asks for reason' },
    { label: 'Emailed quote', text: '✉️ Emailed quote', tone: 'bg-blue-50 text-blue-800 border-blue-200 hover:bg-blue-100', outcome: 'quote_sent', hint: 'Keeps the lead assigned to you' },
    { label: 'Sent WhatsApp', text: '💬 Sent WhatsApp', tone: 'bg-emerald-50 text-emerald-800 border-emerald-200 hover:bg-emerald-100', outcome: 'spoke_to_customer', hint: 'Keeps the lead assigned to you' },
    { label: 'Thinking about it', text: '🤔 Thinking about it', tone: 'bg-amber-50 text-amber-800 border-amber-200 hover:bg-amber-100', outcome: 'spoke_to_customer', hint: 'Keeps the lead assigned to you' },
  ];

  const handleQuickAction = async (
    action: (typeof QUICK_ACTIONS)[number]
  ) => {
    if (isSaving || hookIsSaving) return;

    // Always log the note so history is preserved
    await commitNote(action.text);

    if (!action.outcome) return;

    try {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) return;

      // Only invoke the pool state machine when this lead is the one the
      // agent currently holds via the Open Lead Pool bar.
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
        toast.success(`Lead kept: ${action.label}`);
      }
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

  return (
    <div className={cn("rounded-lg border border-border bg-card shadow-sm", className)}>
      {/* Quick action chips */}
      <div className="px-4 pt-4 pb-3 border-b border-border">
        <p className="text-[11px] font-semibold uppercase tracking-wide text-muted-foreground mb-2">
          Quick log
        </p>
        <div className="flex flex-wrap gap-1.5 items-center">
          {QUICK_ACTIONS.map((action) => (
            <button
              key={action.label}
              type="button"
              onClick={() => handleQuickAction(action)}
              disabled={isSaving || hookIsSaving}
              title={action.hint}
              className={cn(
                "px-2.5 py-1 text-xs font-medium rounded-full border transition-colors disabled:opacity-50 disabled:cursor-not-allowed",
                action.tone,
                action.prominent && "px-3 py-1.5 text-sm font-semibold shadow-sm ring-1 ring-orange-300/60"
              )}
            >
              {action.label}
              {action.prominent && (
                <span className="ml-1.5 text-[10px] font-medium text-orange-700/80">
                  ↩ releases lead
                </span>
              )}
            </button>
          ))}
        </div>
      </div>

      {/* Notes List */}
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
