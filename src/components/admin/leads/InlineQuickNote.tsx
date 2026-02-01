import React, { useState, useRef } from 'react';
import { useLeadQuickNotes, QuickNote } from '@/hooks/useLeadQuickNotes';
import { Button } from '@/components/ui/button';
import { Pin, PinOff, Trash2, Clock, User } from 'lucide-react';
import { formatDistanceToNow } from 'date-fns';
import { cn } from '@/lib/utils';
import { toast } from 'sonner';

interface InlineQuickNoteProps {
  leadId: string;
}

export const InlineQuickNote: React.FC<InlineQuickNoteProps> = ({ leadId }) => {
  const { notes, loading, addNote, updateNote, togglePin, deleteNote } = useLeadQuickNotes(leadId);
  const [isEditing, setIsEditing] = useState(false);
  const [editValue, setEditValue] = useState('');
  const [editingNoteId, setEditingNoteId] = useState<string | null>(null);
  const inputRef = useRef<HTMLTextAreaElement>(null);

  const pinnedNote = notes.find(n => n.is_pinned);
  const latestNote = notes.length > 0 ? notes[0] : null;
  const displayNote = pinnedNote || latestNote;

  const handleDoubleClick = () => {
    if (displayNote) {
      setEditingNoteId(displayNote.id);
      setEditValue(displayNote.note_text);
    } else {
      setEditingNoteId(null);
      setEditValue('');
    }
    setIsEditing(true);
    setTimeout(() => inputRef.current?.focus(), 50);
  };

  const handleSave = async () => {
    if (!editValue.trim()) {
      setIsEditing(false);
      setEditValue('');
      setEditingNoteId(null);
      return;
    }

    try {
      if (editingNoteId) {
        await updateNote(editingNoteId, editValue);
        toast.success('Note updated');
      } else {
        await addNote(editValue);
        toast.success('Note added');
      }
    } catch (error) {
      toast.error('Failed to save note');
    }
    
    setIsEditing(false);
    setEditValue('');
    setEditingNoteId(null);
  };

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault();
      handleSave();
    }
    if (e.key === 'Escape') {
      setIsEditing(false);
      setEditValue('');
      setEditingNoteId(null);
    }
  };

  const getAuthorName = (note: QuickNote) => {
    if (!note.author) return 'Unknown';
    return note.author.first_name || note.author.email.split('@')[0];
  };

  if (loading) {
    return <div className="text-xs text-muted-foreground">Loading...</div>;
  }

  return (
    <div className="space-y-2">
      {/* Orange note box - double click to edit */}
      <div
        onDoubleClick={handleDoubleClick}
        className={cn(
          "p-3 rounded-lg border-2 border-dashed cursor-pointer transition-all min-h-[60px]",
          displayNote 
            ? "bg-amber-50 border-amber-300 dark:bg-amber-950/30 dark:border-amber-700" 
            : "bg-amber-50/50 border-amber-200 dark:bg-amber-950/20 dark:border-amber-800",
          "hover:border-amber-400 hover:bg-amber-100/50 dark:hover:bg-amber-900/30"
        )}
        title="Double-click to add/edit note"
      >
        {isEditing ? (
          <textarea
            ref={inputRef}
            value={editValue}
            onChange={(e) => setEditValue(e.target.value)}
            onBlur={handleSave}
            onKeyDown={handleKeyDown}
            placeholder="Type your note here..."
            className="w-full min-h-[60px] p-2 text-sm border rounded bg-white dark:bg-background resize-none focus:outline-none focus:ring-2 focus:ring-amber-400"
            autoFocus
          />
        ) : displayNote ? (
          <div className="space-y-1">
            <div className="flex items-start gap-2">
              {displayNote.is_pinned && (
                <Pin className="h-3 w-3 text-amber-600 mt-0.5 flex-shrink-0" />
              )}
              <p className="text-sm text-foreground flex-1">{displayNote.note_text}</p>
            </div>
            <div className="flex items-center gap-2 text-[10px] text-muted-foreground">
              <span className="flex items-center gap-1">
                <User className="h-2.5 w-2.5" />
                {getAuthorName(displayNote)}
              </span>
              <span>•</span>
              <span className="flex items-center gap-1">
                <Clock className="h-2.5 w-2.5" />
                {formatDistanceToNow(new Date(displayNote.created_at), { addSuffix: true })}
              </span>
            </div>
          </div>
        ) : (
          <p className="text-sm text-muted-foreground italic text-center py-2">
            Double-click to add a note
          </p>
        )}
      </div>

      {/* Quick actions for the displayed note */}
      {displayNote && !isEditing && (
        <div className="flex items-center gap-1 justify-end">
          <Button
            variant="ghost"
            size="sm"
            className="h-6 px-2 text-xs"
            onClick={() => togglePin(displayNote.id, displayNote.is_pinned)}
          >
            {displayNote.is_pinned ? (
              <>
                <PinOff className="h-3 w-3 mr-1" />
                Unpin
              </>
            ) : (
              <>
                <Pin className="h-3 w-3 mr-1" />
                Pin
              </>
            )}
          </Button>
          <Button
            variant="ghost"
            size="sm"
            className="h-6 px-2 text-xs text-destructive hover:text-destructive"
            onClick={() => deleteNote(displayNote.id)}
          >
            <Trash2 className="h-3 w-3 mr-1" />
            Delete
          </Button>
        </div>
      )}

      {/* Show note count if there are more notes */}
      {notes.length > 1 && (
        <p className="text-[10px] text-muted-foreground text-center">
          +{notes.length - 1} more note{notes.length > 2 ? 's' : ''}
        </p>
      )}
    </div>
  );
};
