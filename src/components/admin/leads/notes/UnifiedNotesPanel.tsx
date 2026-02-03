import React, { useState, useEffect, useRef, useCallback, useMemo } from 'react';
import { Button } from '@/components/ui/button';
import { Textarea } from '@/components/ui/textarea';
import { Badge } from '@/components/ui/badge';
import { Input } from '@/components/ui/input';
import { ScrollArea } from '@/components/ui/scroll-area';
import { 
  MessageSquare, Search, Clock, User, Pin, PinOff, Trash2, 
  Edit2, Check, X, Loader2, WifiOff, Undo2, Filter,
  ChevronDown, ChevronUp
} from 'lucide-react';
import { cn } from '@/lib/utils';
import { format, isToday, isYesterday, isThisWeek, formatDistanceToNow } from 'date-fns';
import { useLeadQuickNotes, QuickNote } from '@/hooks/useLeadQuickNotes';
import { toast } from 'sonner';

interface UnifiedNotesPanelProps {
  leadId: string;
  className?: string;
  compact?: boolean;
}

type SaveStatus = 'idle' | 'saving' | 'saved' | 'offline' | 'error';
type NoteFilter = 'all' | 'mine' | 'pinned';

interface GroupedNotes {
  today: QuickNote[];
  yesterday: QuickNote[];
  thisWeek: QuickNote[];
  older: QuickNote[];
}

export const UnifiedNotesPanel: React.FC<UnifiedNotesPanelProps> = ({
  leadId,
  className,
  compact = false
}) => {
  const { notes, loading, addNote, updateNote, togglePin, deleteNote, refetch, isAbandonedCart } = useLeadQuickNotes(leadId);
  
  // Composer state
  const [composerValue, setComposerValue] = useState('');
  const [saveStatus, setSaveStatus] = useState<SaveStatus>('idle');
  const [lastSavedTime, setLastSavedTime] = useState<Date | null>(null);
  
  // History state
  const [searchQuery, setSearchQuery] = useState('');
  const [activeFilter, setActiveFilter] = useState<NoteFilter>('all');
  const [editingNoteId, setEditingNoteId] = useState<string | null>(null);
  const [editValue, setEditValue] = useState('');
  const [expandedGroups, setExpandedGroups] = useState<Record<string, boolean>>({
    today: true,
    yesterday: true,
    thisWeek: false,
    older: false
  });
  const [showAllNotes, setShowAllNotes] = useState(!compact);
  
  // Undo state
  const [deletedNote, setDeletedNote] = useState<QuickNote | null>(null);
  const undoTimeoutRef = useRef<NodeJS.Timeout | null>(null);
  
  // Autosave refs
  const saveTimeoutRef = useRef<NodeJS.Timeout | null>(null);
  const composerRef = useRef<HTMLTextAreaElement>(null);

  // Reset state when lead changes
  useEffect(() => {
    setComposerValue('');
    setSaveStatus('idle');
    setLastSavedTime(null);
    setSearchQuery('');
    setActiveFilter('all');
    setEditingNoteId(null);
    setShowAllNotes(!compact);
  }, [leadId, compact]);

  // Autosave logic - 1 second debounce
  useEffect(() => {
    if (!composerValue.trim()) {
      setSaveStatus('idle');
      return;
    }

    setSaveStatus('idle'); // Clear previous status when typing
    
    if (saveTimeoutRef.current) {
      clearTimeout(saveTimeoutRef.current);
    }

    saveTimeoutRef.current = setTimeout(async () => {
      setSaveStatus('saving');
      try {
        await addNote(composerValue.trim());
        setSaveStatus('saved');
        setLastSavedTime(new Date());
        setComposerValue(''); // Clear after successful save
        
        // Reset to idle after 3 seconds
        setTimeout(() => {
          setSaveStatus('idle');
        }, 3000);
      } catch (error) {
        setSaveStatus('error');
      }
    }, 1000);

    return () => {
      if (saveTimeoutRef.current) {
        clearTimeout(saveTimeoutRef.current);
      }
    };
  }, [composerValue, addNote]);

  // Handle Enter to save, Shift+Enter for newline
  const handleKeyDown = (e: React.KeyboardEvent<HTMLTextAreaElement>) => {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault();
      handleImmediateSave();
    }
    if (e.key === 'Escape') {
      setComposerValue('');
      composerRef.current?.blur();
    }
  };

  const handleImmediateSave = async () => {
    if (!composerValue.trim()) return;
    
    if (saveTimeoutRef.current) {
      clearTimeout(saveTimeoutRef.current);
    }
    
    setSaveStatus('saving');
    try {
      await addNote(composerValue.trim());
      setSaveStatus('saved');
      setLastSavedTime(new Date());
      setComposerValue('');
      
      setTimeout(() => setSaveStatus('idle'), 3000);
    } catch (error) {
      setSaveStatus('error');
    }
  };

  // Inline edit handlers
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

  // Delete with undo
  const handleDelete = async (note: QuickNote) => {
    setDeletedNote(note);
    
    // Clear any existing undo timeout
    if (undoTimeoutRef.current) {
      clearTimeout(undoTimeoutRef.current);
    }
    
    // Show undo toast
    toast.success('Note deleted', {
      duration: 10000,
      action: {
        label: 'Undo',
        onClick: () => handleUndo(note)
      }
    });
    
    // Actually delete after 10 seconds
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

  // Group notes by date
  const groupedNotes = useMemo((): GroupedNotes => {
    let filteredNotes = notes.filter(note => {
      // Filter out deleted note if pending deletion
      if (deletedNote && note.id === deletedNote.id) return false;
      
      // Search filter
      if (searchQuery) {
        const query = searchQuery.toLowerCase();
        const matchesText = note.note_text.toLowerCase().includes(query);
        const matchesAuthor = note.author?.first_name?.toLowerCase().includes(query) ||
          note.author?.email.toLowerCase().includes(query);
        if (!matchesText && !matchesAuthor) return false;
      }
      
      // Type filter
      if (activeFilter === 'pinned' && !note.is_pinned) return false;
      
      return true;
    });

    const groups: GroupedNotes = {
      today: [],
      yesterday: [],
      thisWeek: [],
      older: []
    };

    filteredNotes.forEach(note => {
      const noteDate = new Date(note.created_at);
      if (isToday(noteDate)) {
        groups.today.push(note);
      } else if (isYesterday(noteDate)) {
        groups.yesterday.push(note);
      } else if (isThisWeek(noteDate)) {
        groups.thisWeek.push(note);
      } else {
        groups.older.push(note);
      }
    });

    return groups;
  }, [notes, searchQuery, activeFilter, deletedNote]);

  const todayNoteCount = groupedNotes.today.length;
  const totalNoteCount = notes.length - (deletedNote ? 1 : 0);

  // Get status display
  const getStatusDisplay = () => {
    switch (saveStatus) {
      case 'saving':
        return (
          <span className="flex items-center gap-1.5 text-xs text-muted-foreground animate-pulse">
            <Loader2 className="h-3 w-3 animate-spin" />
            Saving...
          </span>
        );
      case 'saved':
        return (
          <span className="flex items-center gap-1.5 text-xs text-green-600">
            <Check className="h-3 w-3" />
            Saved {lastSavedTime ? formatDistanceToNow(lastSavedTime, { addSuffix: true }) : 'just now'}
          </span>
        );
      case 'offline':
        return (
          <span className="flex items-center gap-1.5 text-xs text-amber-600">
            <WifiOff className="h-3 w-3" />
            Offline. Will retry
          </span>
        );
      case 'error':
        return (
          <span className="flex items-center gap-1.5 text-xs text-destructive">
            <X className="h-3 w-3" />
            Couldn't save. Try again
          </span>
        );
      default:
        return null;
    }
  };

  const getAuthorName = (note: QuickNote) => {
    if (!note.author) return 'System';
    return note.author.first_name || note.author.email.split('@')[0];
  };

  const toggleGroup = (group: string) => {
    setExpandedGroups(prev => ({ ...prev, [group]: !prev[group] }));
  };

  const renderNoteRow = (note: QuickNote, isLast: boolean) => {
    const isEditing = editingNoteId === note.id;
    
    return (
      <div
        key={note.id}
        className={cn(
          "group flex items-start gap-2 py-1.5 px-2 hover:bg-muted/50 transition-colors",
          !isLast && "border-b border-dashed border-border/50",
          note.is_pinned && "bg-amber-50/30 dark:bg-amber-950/10"
        )}
      >
        {isEditing ? (
          <div className="flex-1 space-y-1.5">
            <Textarea
              value={editValue}
              onChange={(e) => setEditValue(e.target.value)}
              className="min-h-[40px] text-xs resize-none py-1"
              autoFocus
              onKeyDown={(e) => {
                if (e.key === 'Enter' && !e.shiftKey) {
                  e.preventDefault();
                  handleSaveEdit();
                }
                if (e.key === 'Escape') {
                  handleCancelEdit();
                }
              }}
            />
            <div className="flex items-center gap-1 justify-end">
              <Button variant="ghost" size="sm" className="h-5 px-2 text-[10px]" onClick={handleCancelEdit}>
                Cancel
              </Button>
              <Button size="sm" className="h-5 px-2 text-[10px]" onClick={handleSaveEdit}>
                Save
              </Button>
            </div>
          </div>
        ) : (
          <>
            {/* Actions - compact inline */}
            <div className="flex items-center gap-0.5 flex-shrink-0 opacity-60 hover:opacity-100">
              <button
                onClick={() => handleStartEdit(note)}
                className="p-1 hover:bg-muted rounded"
                title="Edit"
              >
                <Edit2 className="h-3 w-3" />
              </button>
              {!isAbandonedCart && (
                <button
                  onClick={() => togglePin(note.id, note.is_pinned)}
                  className="p-1 hover:bg-muted rounded"
                  title={note.is_pinned ? 'Unpin' : 'Pin'}
                >
                  {note.is_pinned ? <PinOff className="h-3 w-3" /> : <Pin className="h-3 w-3" />}
                </button>
              )}
              <button
                onClick={() => handleDelete(note)}
                className="p-1 hover:bg-muted rounded text-destructive"
                title="Delete"
              >
                <Trash2 className="h-3 w-3" />
              </button>
            </div>
            
            {/* Note content - compact inline */}
            <div className="flex-1 min-w-0 flex items-baseline gap-2">
              {note.is_pinned && <Pin className="h-2.5 w-2.5 text-amber-600 flex-shrink-0" />}
              <span className="text-xs truncate flex-1">{note.note_text}</span>
              <span className="text-[10px] text-muted-foreground flex-shrink-0 whitespace-nowrap">
                {getAuthorName(note)} · {formatDistanceToNow(new Date(note.created_at), { addSuffix: true })}
              </span>
            </div>
          </>
        )}
      </div>
    );
  };

  // Flat list rendering - all notes in one box
  const renderAllNotes = () => {
    const allNotes = [
      ...groupedNotes.today,
      ...groupedNotes.yesterday,
      ...groupedNotes.thisWeek,
      ...groupedNotes.older
    ];

    if (allNotes.length === 0) {
      return (
        <div className="text-xs text-muted-foreground text-center py-4">
          No notes yet. Add the first one above.
        </div>
      );
    }

    return (
      <div className="divide-y-0">
        {allNotes.map((note, idx) => renderNoteRow(note, idx === allNotes.length - 1))}
      </div>
    );
  };

  return (
    <div className={cn("rounded-lg border bg-card overflow-hidden", className)}>
      {/* Header */}
      <div className="flex items-center justify-between p-3 border-b bg-muted/30">
        <div className="flex items-center gap-2">
          <MessageSquare className="h-4 w-4 text-primary" />
          <h3 className="font-semibold text-sm">Notes</h3>
          {todayNoteCount > 0 && (
            <Badge variant="secondary" className="h-5 px-1.5 text-xs">
              {todayNoteCount} today
            </Badge>
          )}
        </div>
        {getStatusDisplay()}
      </div>

      {/* Composer - always visible at top */}
      <div className="p-3 border-b bg-background">
        <Textarea
          ref={composerRef}
          value={composerValue}
          onChange={(e) => setComposerValue(e.target.value)}
          onKeyDown={handleKeyDown}
          placeholder="Type a note… it autosaves."
          className={cn(
            "min-h-[44px] text-sm resize-none transition-all",
            "focus:ring-2 focus:ring-primary/20",
            composerValue && "min-h-[80px]"
          )}
          disabled={saveStatus === 'saving'}
        />
        <div className="flex items-center justify-between mt-2 text-[11px] text-muted-foreground">
          <span>Enter to save • Shift+Enter for newline</span>
          {composerValue && (
            <span>{composerValue.length} chars</span>
          )}
        </div>
      </div>

      {/* Filters & Search */}
      {totalNoteCount > 0 && (
        <div className="p-2 border-b flex items-center gap-2 flex-wrap">
          <div className="relative flex-1 min-w-[120px] max-w-[200px]">
            <Search className="absolute left-2 top-1/2 -translate-y-1/2 h-3 w-3 text-muted-foreground" />
            <Input
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              placeholder="Search notes..."
              className="h-7 text-xs pl-7 pr-2"
            />
          </div>
          <div className="flex items-center gap-1">
            {(['all', 'pinned'] as NoteFilter[]).map((filter) => (
              <Button
                key={filter}
                variant={activeFilter === filter ? 'default' : 'ghost'}
                size="sm"
                className="h-6 px-2 text-xs capitalize"
                onClick={() => setActiveFilter(filter)}
              >
                {filter === 'pinned' && <Pin className="h-3 w-3 mr-1" />}
                {filter}
              </Button>
            ))}
          </div>
        </div>
      )}

      {/* Notes History Stream */}
      <ScrollArea className={cn("p-3", compact && !showAllNotes ? "max-h-[200px]" : "max-h-[400px]")}>
        {loading ? (
          <div className="flex items-center justify-center py-8 text-muted-foreground">
            <Loader2 className="h-5 w-5 animate-spin mr-2" />
            Loading notes...
          </div>
        ) : totalNoteCount === 0 ? (
          <div className="text-center py-8 text-muted-foreground">
            <MessageSquare className="h-8 w-8 mx-auto mb-2 opacity-50" />
            <p className="text-sm">No notes yet. Add the first one.</p>
          </div>
        ) : (
          renderAllNotes()
        )}
      </ScrollArea>

      {/* Show more toggle for compact mode */}
      {compact && totalNoteCount > 3 && (
        <div className="p-2 border-t text-center">
          <Button
            variant="ghost"
            size="sm"
            className="text-xs"
            onClick={() => setShowAllNotes(!showAllNotes)}
          >
            {showAllNotes ? 'Show less' : `Show all ${totalNoteCount} notes`}
          </Button>
        </div>
      )}
    </div>
  );
};
