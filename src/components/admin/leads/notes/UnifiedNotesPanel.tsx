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
    setIsSaving(true);

    try {
      await addNoteRef.current(pending);
      quickNoteRef.current = '';
      setQuickNoteValue('');
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
      setIsSaving(false);
    }
  }, [hookIsSaving, queuePendingNote, persistDraft, clearQueuedPendingNote]);

  const flushPendingNote = useCallback(async () => {
    await commitNote(quickNoteRef.current, { silent: true });
  }, [commitNote]);

  // Auto-save unsaved note on unmount (e.g. collapsing the panel)
  useEffect(() => {
    return () => {
      void flushPendingNote();
    };
  }, [leadId, flushPendingNote]);

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

    return () => {
      document.removeEventListener('visibilitychange', handleVisibilityChange);
      window.removeEventListener('pagehide', handlePageHide);
    };
  }, [flushPendingNote]);

  // Reset state when lead changes
  useEffect(() => {
    const savedDraft = typeof window !== 'undefined'
      ? window.sessionStorage.getItem(draftStorageKey) || ''
      : '';

    setQuickNoteValue(savedDraft);
    setIsSaving(false);
    setEditingNoteId(null);
    if (savingTimerRef.current) clearTimeout(savingTimerRef.current);
  }, [draftStorageKey, leadId]);

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

  return (
    <div className={cn("space-y-3", className)}>
      {/* Notes List - stacked newest on top */}
      <div className="space-y-1.5 max-h-[300px] overflow-y-auto">
        {visibleNotes.length === 0 ? (
          <p className="text-sm text-muted-foreground italic">No notes yet</p>
        ) : (
          visibleNotes.map((note) => {
            const isEditing = editingNoteId === note.id;
            const isOptimistic = note.id.startsWith('temp_');
            const noteDate = new Date(note.created_at);
            const datePrefix = format(noteDate, 'dd/MM');
            const timeStr = format(noteDate, 'HH:mm');
            
            return (
              <div
                key={note.id}
                className={cn(
                  "group flex items-start gap-2 py-1.5 px-2 -mx-2 rounded border-l-2 transition-colors",
                  note.is_pinned 
                    ? "bg-amber-50/50 dark:bg-amber-950/20 border-l-amber-400" 
                    : "hover:bg-muted/50 border-l-transparent hover:border-l-muted-foreground/30",
                  isOptimistic && "opacity-60"
                )}
              >
                {isEditing ? (
                  <div className="flex-1 flex items-center gap-2">
                    <Input
                      value={editValue}
                      onChange={(e) => setEditValue(e.target.value)}
                      className="h-7 text-sm flex-1"
                      autoFocus
                      onKeyDown={(e) => {
                        if (e.key === 'Enter') {
                          e.preventDefault();
                          handleSaveEdit();
                        }
                        if (e.key === 'Escape') {
                          handleCancelEdit();
                        }
                      }}
                    />
                    <Button size="icon" variant="ghost" className="h-6 w-6" onClick={handleSaveEdit}>
                      <Check className="h-3 w-3 text-primary" />
                    </Button>
                    <Button size="icon" variant="ghost" className="h-6 w-6" onClick={handleCancelEdit}>
                      <X className="h-3 w-3" />
                    </Button>
                  </div>
                ) : (
                  <>
                    <div className="flex-1 min-w-0">
                      <p className="text-sm leading-relaxed">
                        {note.is_pinned && <Pin className="h-3 w-3 text-amber-600 inline mr-1" />}
                        {isOptimistic && <Loader2 className="h-3 w-3 animate-spin inline mr-1" />}
                        <span className="text-muted-foreground text-xs font-mono">{datePrefix} {timeStr}</span>
                        <span className="text-muted-foreground mx-1">—</span>
                        <span>{note.note_text}</span>
                      </p>
                    </div>
                    
                    {!isOptimistic && (
                      <div className="flex items-center gap-0.5 opacity-0 group-hover:opacity-100 transition-opacity flex-shrink-0">
                        <button
                          onClick={() => handleStartEdit(note)}
                          className="p-1 hover:bg-muted rounded"
                          title="Edit"
                        >
                          <Edit2 className="h-3 w-3 text-muted-foreground" />
                        </button>
                        {!isAbandonedCart && (
                          <button
                            onClick={() => togglePin(note.id, note.is_pinned)}
                            className="p-1 hover:bg-muted rounded"
                            title={note.is_pinned ? 'Unpin' : 'Pin'}
                          >
                            {note.is_pinned ? (
                              <PinOff className="h-3 w-3 text-muted-foreground" />
                            ) : (
                              <Pin className="h-3 w-3 text-muted-foreground" />
                            )}
                          </button>
                        )}
                        <button
                          onClick={() => handleDelete(note)}
                          className="p-1 hover:bg-muted rounded"
                          title="Delete"
                        >
                          <Trash2 className="h-3 w-3 text-destructive" />
                        </button>
                      </div>
                    )}
                  </>
                )}
              </div>
            );
          })
        )}
      </div>

      {/* Quick Notes Input */}
      <div className="pt-2 border-t">
        <div className="mt-2 space-y-2">
          <Input
            value={quickNoteValue}
            onChange={(e) => setQuickNoteValue(e.target.value)}
            onKeyDown={(e) => {
              if (e.key === 'Enter') {
                e.preventDefault();
                handleSaveNote();
              }
            }}
             onBlur={() => {
               if (quickNoteValue.trim()) {
                 void flushPendingNote();
               }
             }}
            placeholder="Add a note..."
            className="w-full h-8 text-sm"
             disabled={isSaving || hookIsSaving}
          />
          <Button 
            size="sm" 
            onClick={handleSaveNote} 
             disabled={!quickNoteValue.trim() || isSaving || hookIsSaving}
            className="h-8 w-full"
          >
            <Save className="h-4 w-4 mr-1" />
            Save
          </Button>
        </div>
      </div>
    </div>
  );
};
