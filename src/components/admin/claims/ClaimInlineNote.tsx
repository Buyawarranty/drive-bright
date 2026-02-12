import React, { useState, useRef } from 'react';
import { useClaimQuickNotes, ClaimNote } from '@/hooks/useClaimQuickNotes';
import { Button } from '@/components/ui/button';
import { Pin, PinOff, Trash2, Clock, User, StickyNote } from 'lucide-react';
import { formatDistanceToNow } from 'date-fns';
import { cn } from '@/lib/utils';
import { toast } from 'sonner';
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from '@/components/ui/popover';

interface ClaimInlineNoteProps {
  claimId: string;
}

export const ClaimInlineNote: React.FC<ClaimInlineNoteProps> = ({ claimId }) => {
  const { notes, loading, addNote, updateNote, togglePin, deleteNote } = useClaimQuickNotes(claimId);
  const [isEditing, setIsEditing] = useState(false);
  const [editValue, setEditValue] = useState('');
  const [editingNoteId, setEditingNoteId] = useState<string | null>(null);
  const [open, setOpen] = useState(false);
  const inputRef = useRef<HTMLTextAreaElement>(null);

  const pinnedNote = notes.find(n => n.is_pinned);
  const latestNote = notes.length > 0 ? notes[0] : null;
  const displayNote = pinnedNote || latestNote;

  const handleAddNew = () => {
    setEditingNoteId(null);
    setEditValue('');
    setIsEditing(true);
    setTimeout(() => inputRef.current?.focus(), 50);
  };

  const handleEditExisting = (note: ClaimNote) => {
    setEditingNoteId(note.id);
    setEditValue(note.note_text);
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
    } catch {
      toast.error('Failed to save note');
    }
    setIsEditing(false);
    setEditValue('');
    setEditingNoteId(null);
  };

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === 'Enter' && !e.shiftKey) { e.preventDefault(); handleSave(); }
    if (e.key === 'Escape') { setIsEditing(false); setEditValue(''); setEditingNoteId(null); }
  };

  const getAuthorName = (note: ClaimNote) => {
    if (!note.author) return 'Unknown';
    return note.author.first_name || note.author.email.split('@')[0];
  };

  const hasNotes = notes.length > 0;

  return (
    <Popover open={open} onOpenChange={setOpen}>
      <PopoverTrigger asChild>
        <Button
          variant="ghost"
          size="sm"
          className={cn('h-7 w-7 p-0 relative', hasNotes && 'text-amber-600')}
          title={hasNotes ? `${notes.length} note(s)` : 'Add note'}
        >
          <StickyNote className="h-3.5 w-3.5" />
          {hasNotes && (
            <span className="absolute -top-1 -right-1 h-3.5 w-3.5 bg-amber-500 text-white text-[9px] rounded-full flex items-center justify-center font-bold">
              {notes.length}
            </span>
          )}
        </Button>
      </PopoverTrigger>
      <PopoverContent className="w-80 p-3" align="end">
        <div className="space-y-2">
          <div className="flex items-center justify-between">
            <h4 className="text-sm font-semibold">Claim Notes</h4>
            <Button variant="outline" size="sm" className="h-6 text-xs" onClick={handleAddNew}>
              + Add
            </Button>
          </div>

          {isEditing && (
            <div className="space-y-1">
              <textarea
                ref={inputRef}
                value={editValue}
                onChange={(e) => setEditValue(e.target.value)}
                onBlur={handleSave}
                onKeyDown={handleKeyDown}
                placeholder="Type your note..."
                className="w-full min-h-[60px] p-2 text-sm border rounded bg-white dark:bg-background resize-none focus:outline-none focus:ring-2 focus:ring-amber-400"
                autoFocus
              />
            </div>
          )}

          {loading ? (
            <p className="text-xs text-muted-foreground">Loading...</p>
          ) : notes.length === 0 && !isEditing ? (
            <p className="text-xs text-muted-foreground italic text-center py-2">No notes yet</p>
          ) : (
            <div className="space-y-2 max-h-[250px] overflow-y-auto">
              {notes.map(note => (
                <div
                  key={note.id}
                  className={cn(
                    'p-2 rounded border text-xs space-y-1',
                    note.is_pinned ? 'bg-amber-50 border-amber-300 dark:bg-amber-950/30' : 'bg-muted/30 border-border'
                  )}
                >
                  <div className="flex items-start gap-1.5">
                    {note.is_pinned && <Pin className="h-2.5 w-2.5 text-amber-600 mt-0.5 flex-shrink-0" />}
                    <p className="flex-1 text-foreground">{note.note_text}</p>
                  </div>
                  <div className="flex items-center gap-1.5 text-[10px] text-muted-foreground">
                    <span className="flex items-center gap-0.5">
                      <User className="h-2 w-2" />
                      {getAuthorName(note)}
                    </span>
                    <span>•</span>
                    <span className="flex items-center gap-0.5">
                      <Clock className="h-2 w-2" />
                      {formatDistanceToNow(new Date(note.created_at), { addSuffix: true })}
                    </span>
                  </div>
                  <div className="flex items-center gap-0.5 justify-end">
                    <Button variant="ghost" size="sm" className="h-5 px-1.5 text-[10px]" onClick={() => handleEditExisting(note)}>
                      Edit
                    </Button>
                    <Button variant="ghost" size="sm" className="h-5 px-1.5 text-[10px]" onClick={() => togglePin(note.id, note.is_pinned)}>
                      {note.is_pinned ? <PinOff className="h-2.5 w-2.5" /> : <Pin className="h-2.5 w-2.5" />}
                    </Button>
                    <Button variant="ghost" size="sm" className="h-5 px-1.5 text-[10px] text-destructive" onClick={() => deleteNote(note.id)}>
                      <Trash2 className="h-2.5 w-2.5" />
                    </Button>
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
      </PopoverContent>
    </Popover>
  );
};
