 import React, { useState, useEffect, useRef, useMemo } from 'react';
 import { Button } from '@/components/ui/button';
 import { Input } from '@/components/ui/input';
 import { 
  MessageSquare, Pin, PinOff, Trash2, 
  Edit2, Check, X, Loader2, Save
 } from 'lucide-react';
 import { cn } from '@/lib/utils';
import { format } from 'date-fns';
 import { useLeadQuickNotes, QuickNote } from '@/hooks/useLeadQuickNotes';
 import { toast } from 'sonner';
 
 interface UnifiedNotesPanelProps {
   leadId: string;
   className?: string;
   compact?: boolean;
 }
 
 type SaveStatus = 'idle' | 'saving' | 'saved' | 'error';
 
 export const UnifiedNotesPanel: React.FC<UnifiedNotesPanelProps> = ({
   leadId,
   className,
   compact = false
 }) => {
   const { notes, loading, addNote, updateNote, togglePin, deleteNote, refetch, isAbandonedCart } = useLeadQuickNotes(leadId);
   
   // Quick note input state
   const [quickNoteValue, setQuickNoteValue] = useState('');
  const [isSaving, setIsSaving] = useState(false);
   
   // Edit state
   const [editingNoteId, setEditingNoteId] = useState<string | null>(null);
   const [editValue, setEditValue] = useState('');
   
   // Undo state
   const [deletedNote, setDeletedNote] = useState<QuickNote | null>(null);
   const undoTimeoutRef = useRef<NodeJS.Timeout | null>(null);
 
   // Reset state when lead changes
   useEffect(() => {
     setQuickNoteValue('');
    setIsSaving(false);
     setEditingNoteId(null);
   }, [leadId]);
 
   const handleSaveNote = async () => {
     const noteText = quickNoteValue.trim();
     if (!noteText) return;
    if (isSaving) return;
     
    setIsSaving(true);
     
     try {
       await addNote(noteText);
       setQuickNoteValue('');
      toast.success('Note saved');
     } catch (error: any) {
      toast.error('Failed to save note');
     } finally {
      setIsSaving(false);
     }
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
 
   // Filter out deleted notes
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
       {/* Notes List - Simple continuous format */}
       <div className="space-y-1">
         {visibleNotes.length === 0 ? (
           <p className="text-sm text-muted-foreground italic">No notes yet</p>
         ) : (
           visibleNotes.map((note) => {
             const isEditing = editingNoteId === note.id;
             const noteDate = new Date(note.created_at);
             const datePrefix = format(noteDate, 'dd/MM');
             
             return (
               <div
                 key={note.id}
                 className={cn(
                   "group flex items-start gap-2 py-1 px-2 -mx-2 rounded hover:bg-muted/50 transition-colors",
                   note.is_pinned && "bg-amber-50/50 dark:bg-amber-950/20"
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
                     {/* Note content - continuous format like "15/01 - NA VM" */}
                     <div className="flex-1 min-w-0">
                       <p className="text-sm">
                         {note.is_pinned && <Pin className="h-3 w-3 text-amber-600 inline mr-1" />}
                         <span className="text-muted-foreground">{datePrefix}</span>
                         <span className="text-muted-foreground mx-1">-</span>
                         <span>{note.note_text}</span>
                       </p>
                     </div>
                     
                     {/* Actions - show on hover */}
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
                   </>
                 )}
               </div>
             );
           })
         )}
       </div>
 
       {/* Quick Notes Input - Simple single line */}
       <div className="pt-2 border-t">
          <div className="mt-2 space-y-2">
           <Input
             value={quickNoteValue}
             onChange={(e) => setQuickNoteValue(e.target.value)}
              onKeyDown={(e) => e.key === 'Enter' && handleSaveNote()}
              placeholder="Add a note..."
              className="w-full h-8 text-sm"
              disabled={isSaving}
           />
            <Button 
              size="sm" 
              onClick={handleSaveNote} 
              disabled={!quickNoteValue.trim() || isSaving}
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