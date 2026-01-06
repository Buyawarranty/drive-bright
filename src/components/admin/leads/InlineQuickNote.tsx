import React, { useState, useRef, useEffect, useCallback } from 'react';
import { useLeadQuickNotes, QuickNote } from '@/hooks/useLeadQuickNotes';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Pin, PinOff, Trash2, Clock, User } from 'lucide-react';
import { formatDistanceToNow } from 'date-fns';
import { cn } from '@/lib/utils';

interface InlineQuickNoteProps {
  leadId: string;
}

export const InlineQuickNote: React.FC<InlineQuickNoteProps> = ({ leadId }) => {
  const { notes, loading, addNote, updateNote, togglePin, deleteNote } = useLeadQuickNotes(leadId);
  const [inputValue, setInputValue] = useState('');
  const [editingId, setEditingId] = useState<string | null>(null);
  const [editValue, setEditValue] = useState('');
  const inputRef = useRef<HTMLTextAreaElement>(null);
  const saveTimeoutRef = useRef<NodeJS.Timeout | null>(null);

  // Autosave for new notes
  const handleInputChange = (value: string) => {
    setInputValue(value);
    
    // Clear previous timeout
    if (saveTimeoutRef.current) {
      clearTimeout(saveTimeoutRef.current);
    }

    // Autosave after 1 second of no typing (only if there's content)
    if (value.trim()) {
      saveTimeoutRef.current = setTimeout(async () => {
        await addNote(value);
        setInputValue('');
      }, 1500);
    }
  };

  // Handle explicit save (Enter key)
  const handleKeyDown = async (e: React.KeyboardEvent) => {
    if (e.key === 'Enter' && !e.shiftKey && inputValue.trim()) {
      e.preventDefault();
      if (saveTimeoutRef.current) {
        clearTimeout(saveTimeoutRef.current);
      }
      await addNote(inputValue);
      setInputValue('');
    }
  };

  // Handle edit save
  const handleEditSave = async (noteId: string) => {
    if (editValue.trim()) {
      await updateNote(noteId, editValue);
    }
    setEditingId(null);
    setEditValue('');
  };

  // Auto-resize textarea
  const autoResize = useCallback((textarea: HTMLTextAreaElement | null) => {
    if (textarea) {
      textarea.style.height = 'auto';
      textarea.style.height = `${Math.min(textarea.scrollHeight, 120)}px`;
    }
  }, []);

  useEffect(() => {
    autoResize(inputRef.current);
  }, [inputValue, autoResize]);

  // Cleanup timeout on unmount
  useEffect(() => {
    return () => {
      if (saveTimeoutRef.current) {
        clearTimeout(saveTimeoutRef.current);
      }
    };
  }, []);

  const pinnedNote = notes.find(n => n.is_pinned);
  const otherNotes = notes.filter(n => !n.is_pinned);

  const getAuthorName = (note: QuickNote) => {
    if (!note.author) return 'Unknown';
    return note.author.first_name || note.author.email.split('@')[0];
  };

  return (
    <div className="space-y-3">
      {/* Quick note input */}
      <div className="relative">
        <textarea
          ref={inputRef}
          value={inputValue}
          onChange={(e) => {
            handleInputChange(e.target.value);
            autoResize(e.target);
          }}
          onKeyDown={handleKeyDown}
          placeholder="Add a quick note... (autosaves)"
          className="w-full min-h-[36px] max-h-[120px] px-3 py-2 text-sm border rounded-lg resize-none bg-background focus:outline-none focus:ring-2 focus:ring-primary/20 focus:border-primary/50 transition-all"
          rows={1}
        />
        {inputValue && (
          <span className="absolute bottom-1 right-2 text-[10px] text-muted-foreground">
            Press Enter or wait to save
          </span>
        )}
      </div>

      {/* Pinned note (if any) */}
      {pinnedNote && (
        <div className="p-3 rounded-lg bg-amber-50 border border-amber-200 dark:bg-amber-950/20 dark:border-amber-800">
          <div className="flex items-start gap-2">
            <Pin className="h-3.5 w-3.5 text-amber-600 mt-0.5 flex-shrink-0" />
            <div className="flex-1 min-w-0">
              {editingId === pinnedNote.id ? (
                <textarea
                  value={editValue}
                  onChange={(e) => setEditValue(e.target.value)}
                  onBlur={() => handleEditSave(pinnedNote.id)}
                  onKeyDown={(e) => {
                    if (e.key === 'Enter' && !e.shiftKey) {
                      e.preventDefault();
                      handleEditSave(pinnedNote.id);
                    }
                    if (e.key === 'Escape') {
                      setEditingId(null);
                      setEditValue('');
                    }
                  }}
                  className="w-full px-2 py-1 text-sm border rounded resize-none bg-white dark:bg-background"
                  autoFocus
                  rows={2}
                />
              ) : (
                <p 
                  className="text-sm text-foreground cursor-pointer hover:bg-amber-100 dark:hover:bg-amber-900/30 rounded px-1 -mx-1 transition-colors"
                  onClick={() => {
                    setEditingId(pinnedNote.id);
                    setEditValue(pinnedNote.note_text);
                  }}
                >
                  {pinnedNote.note_text}
                </p>
              )}
              <div className="flex items-center gap-2 mt-1.5 text-[10px] text-muted-foreground">
                <span className="flex items-center gap-1">
                  <User className="h-2.5 w-2.5" />
                  {getAuthorName(pinnedNote)}
                </span>
                <span>•</span>
                <span className="flex items-center gap-1">
                  <Clock className="h-2.5 w-2.5" />
                  {formatDistanceToNow(new Date(pinnedNote.created_at), { addSuffix: true })}
                </span>
              </div>
            </div>
            <div className="flex items-center gap-1">
              <Button
                variant="ghost"
                size="icon"
                className="h-6 w-6 text-amber-600 hover:text-amber-700"
                onClick={() => togglePin(pinnedNote.id, pinnedNote.is_pinned)}
                title="Unpin"
              >
                <PinOff className="h-3 w-3" />
              </Button>
              <Button
                variant="ghost"
                size="icon"
                className="h-6 w-6 text-destructive/70 hover:text-destructive"
                onClick={() => deleteNote(pinnedNote.id)}
                title="Delete"
              >
                <Trash2 className="h-3 w-3" />
              </Button>
            </div>
          </div>
        </div>
      )}

      {/* Other notes */}
      {otherNotes.length > 0 && (
        <div className="space-y-2">
          {otherNotes.slice(0, 3).map((note) => (
            <div 
              key={note.id}
              className="group p-2.5 rounded-lg bg-muted/50 border border-transparent hover:border-muted-foreground/20 transition-all"
            >
              <div className="flex items-start gap-2">
                <div className="flex-1 min-w-0">
                  {editingId === note.id ? (
                    <textarea
                      value={editValue}
                      onChange={(e) => setEditValue(e.target.value)}
                      onBlur={() => handleEditSave(note.id)}
                      onKeyDown={(e) => {
                        if (e.key === 'Enter' && !e.shiftKey) {
                          e.preventDefault();
                          handleEditSave(note.id);
                        }
                        if (e.key === 'Escape') {
                          setEditingId(null);
                          setEditValue('');
                        }
                      }}
                      className="w-full px-2 py-1 text-sm border rounded resize-none bg-background"
                      autoFocus
                      rows={2}
                    />
                  ) : (
                    <p 
                      className="text-sm text-foreground cursor-pointer hover:bg-muted rounded px-1 -mx-1 transition-colors"
                      onClick={() => {
                        setEditingId(note.id);
                        setEditValue(note.note_text);
                      }}
                    >
                      {note.note_text}
                    </p>
                  )}
                  <div className="flex items-center gap-2 mt-1 text-[10px] text-muted-foreground">
                    <span>{getAuthorName(note)}</span>
                    <span>•</span>
                    <span>{formatDistanceToNow(new Date(note.created_at), { addSuffix: true })}</span>
                  </div>
                </div>
                <div className="flex items-center gap-1 opacity-0 group-hover:opacity-100 transition-opacity">
                  <Button
                    variant="ghost"
                    size="icon"
                    className="h-6 w-6"
                    onClick={() => togglePin(note.id, note.is_pinned)}
                    title="Pin"
                  >
                    <Pin className="h-3 w-3" />
                  </Button>
                  <Button
                    variant="ghost"
                    size="icon"
                    className="h-6 w-6 text-destructive/70 hover:text-destructive"
                    onClick={() => deleteNote(note.id)}
                    title="Delete"
                  >
                    <Trash2 className="h-3 w-3" />
                  </Button>
                </div>
              </div>
            </div>
          ))
          }
          {otherNotes.length > 3 && (
            <p className="text-xs text-muted-foreground text-center py-1">
              +{otherNotes.length - 3} more notes
            </p>
          )}
        </div>
      )}

      {!loading && notes.length === 0 && !inputValue && (
        <p className="text-xs text-muted-foreground text-center py-2">
          No quick notes yet
        </p>
      )}
    </div>
  );
};
