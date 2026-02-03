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

  const renderNoteRow = (note: QuickNote) => {
    const isEditing = editingNoteId === note.id;
    
    return (
      <div
        key={note.id}
        className={cn(
          "group relative p-3 rounded-lg border transition-all",
          note.is_pinned 
            ? "bg-amber-50/50 border-amber-200 dark:bg-amber-950/20" 
            : "bg-card border-border hover:bg-muted/50"
        )}
      >
        {isEditing ? (
          <div className="space-y-2">
            <Textarea
              value={editValue}
              onChange={(e) => setEditValue(e.target.value)}
              className="min-h-[60px] text-sm resize-none"
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
            <div className="flex items-center gap-2 justify-end">
              <Button
                variant="ghost"
                size="sm"
                className="h-7"
                onClick={handleCancelEdit}
              >
                <X className="h-3 w-3 mr-1" />
                Cancel
              </Button>
              <Button
                size="sm"
                className="h-7"
                onClick={handleSaveEdit}
              >
                <Check className="h-3 w-3 mr-1" />
                Save
              </Button>
            </div>
          </div>
        ) : (
          <>
            {/* Note content */}
            <div className="flex items-start gap-2">
              {note.is_pinned && (
                <Pin className="h-3.5 w-3.5 text-amber-600 mt-0.5 flex-shrink-0" />
              )}
              <p className={cn(
                "text-sm flex-1 whitespace-pre-wrap",
                note.note_text.length > 150 && "line-clamp-3"
              )}>
                {note.note_text}
              </p>
            </div>
            
            {/* Metadata row */}
            <div className="flex items-center gap-3 mt-2 text-[11px] text-muted-foreground">
              <span className="flex items-center gap-1">
                <User className="h-3 w-3" />
                {getAuthorName(note)}
              </span>
              <span className="flex items-center gap-1" title={format(new Date(note.created_at), 'PPpp')}>
                <Clock className="h-3 w-3" />
                {formatDistanceToNow(new Date(note.created_at), { addSuffix: true })}
              </span>
            </div>
            
            {/* Action buttons - visible on hover */}
            <div className="absolute top-2 right-2 flex items-center gap-1 opacity-0 group-hover:opacity-100 transition-opacity">
              <Button
                variant="ghost"
                size="sm"
                className="h-6 w-6 p-0"
                onClick={() => handleStartEdit(note)}
                title="Edit"
              >
                <Edit2 className="h-3 w-3" />
              </Button>
              {!isAbandonedCart && (
                <Button
                  variant="ghost"
                  size="sm"
                  className="h-6 w-6 p-0"
                  onClick={() => togglePin(note.id, note.is_pinned)}
                  title={note.is_pinned ? 'Unpin' : 'Pin'}
                >
                  {note.is_pinned ? <PinOff className="h-3 w-3" /> : <Pin className="h-3 w-3" />}
                </Button>
              )}
              <Button
                variant="ghost"
                size="sm"
                className="h-6 w-6 p-0 text-destructive hover:text-destructive"
                onClick={() => handleDelete(note)}
                title="Delete"
              >
                <Trash2 className="h-3 w-3" />
              </Button>
            </div>
          </>
        )}
      </div>
    );
  };

  const renderNoteGroup = (title: string, groupNotes: QuickNote[], groupKey: string) => {
    if (groupNotes.length === 0) return null;
    
    const isExpanded = expandedGroups[groupKey];
    
    return (
      <div key={groupKey} className="space-y-2">
        <button
          onClick={() => toggleGroup(groupKey)}
          className="flex items-center gap-2 text-xs font-medium text-muted-foreground uppercase tracking-wide hover:text-foreground transition-colors w-full"
        >
          {isExpanded ? <ChevronDown className="h-3 w-3" /> : <ChevronUp className="h-3 w-3" />}
          {title}
          <Badge variant="secondary" className="h-4 px-1.5 text-[10px]">
            {groupNotes.length}
          </Badge>
        </button>
        {isExpanded && (
          <div className="space-y-2">
            {groupNotes.map(renderNoteRow)}
          </div>
        )}
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
          <div className="space-y-4">
            {renderNoteGroup('Today', groupedNotes.today, 'today')}
            {renderNoteGroup('Yesterday', groupedNotes.yesterday, 'yesterday')}
            {renderNoteGroup('This Week', groupedNotes.thisWeek, 'thisWeek')}
            {renderNoteGroup('Older', groupedNotes.older, 'older')}
          </div>
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
