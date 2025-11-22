import React, { useState, useEffect } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { Button } from '@/components/ui/button';
import { Textarea } from '@/components/ui/textarea';
import { Badge } from '@/components/ui/badge';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from '@/components/ui/dialog';
import { toast } from 'sonner';
import { Plus, Pin, Search, Edit, Trash2, Save, X, Clock, User } from 'lucide-react';
import { formatDistanceToNow } from 'date-fns';

interface CustomerNote {
  id: string;
  note_text: string;
  is_pinned: boolean;
  created_by: string;
  created_at: string;
  updated_at: string;
  admin_users?: {
    email: string;
    first_name?: string;
    last_name?: string;
  } | null;
  tags: NoteTag[];
}

interface NoteTag {
  id: string;
  name: string;
  color: string;
  description?: string;
}

interface CustomerNotesSectionProps {
  customerId: string;
  onNotesChange?: (noteCount: number) => void;
}

const TAG_COLORS = {
  '#ef4444': 'bg-red-500 text-white hover:bg-red-600',
  '#f59e0b': 'bg-amber-500 text-white hover:bg-amber-600',
  '#10b981': 'bg-emerald-500 text-white hover:bg-emerald-600',
  '#3b82f6': 'bg-blue-500 text-white hover:bg-blue-600',
  '#8b5cf6': 'bg-purple-500 text-white hover:bg-purple-600',
  '#f97316': 'bg-orange-500 text-white hover:bg-orange-600',
  '#22c55e': 'bg-green-500 text-white hover:bg-green-600',
  '#dc2626': 'bg-red-600 text-white hover:bg-red-700',
  '#059669': 'bg-teal-600 text-white hover:bg-teal-700',
  '#d97706': 'bg-yellow-600 text-white hover:bg-yellow-700',
  '#7c3aed': 'bg-violet-600 text-white hover:bg-violet-700',
  '#374151': 'bg-gray-700 text-white hover:bg-gray-800',
  '#6b7280': 'bg-gray-500 text-white hover:bg-gray-600',
};

export const CustomerNotesSection = ({ customerId, onNotesChange }: CustomerNotesSectionProps) => {
  const [notes, setNotes] = useState<CustomerNote[]>([]);
  const [tags, setTags] = useState<NoteTag[]>([]);
  const [loading, setLoading] = useState(true);
  const [newNote, setNewNote] = useState('');
  const [selectedTags, setSelectedTags] = useState<string[]>([]);
  const [searchTerm, setSearchTerm] = useState('');
  const [filterTags, setFilterTags] = useState<string[]>([]);
  const [editingNote, setEditingNote] = useState<string | null>(null);
  const [editingText, setEditingText] = useState('');
  const [isAddingNote, setIsAddingNote] = useState(false);
  const [currentUser, setCurrentUser] = useState<any>(null);

  useEffect(() => {
    fetchNotes();
    fetchTags();
    getCurrentUser();
    checkAndCreateBonusNote();
  }, [customerId]);

  const checkAndCreateBonusNote = async () => {
    try {
      // Check if customer has seasonal bonus
      const { data: policies } = await supabase
        .from('customer_policies')
        .select('seasonal_bonus_months, policy_end_date, plan_type')
        .eq('customer_id', customerId)
        .order('created_at', { ascending: false })
        .limit(1);

      if (policies && policies.length > 0 && policies[0].seasonal_bonus_months && policies[0].seasonal_bonus_months > 0) {
        const bonusMonths = policies[0].seasonal_bonus_months;
        const endDate = new Date(policies[0].policy_end_date);
        endDate.setMonth(endDate.getMonth() + bonusMonths);
        
        // Check if note already exists
        const { data: existingNotes } = await supabase
          .from('customer_notes')
          .select('id')
          .eq('customer_id', customerId)
          .ilike('note_text', `%${bonusMonths} months FREE bonus%`)
          .limit(1);

        // Only create note if it doesn't exist
        if (!existingNotes || existingNotes.length === 0) {
          const { data: { user } } = await supabase.auth.getUser();
          if (user) {
            await supabase
              .from('customer_notes')
              .insert({
                customer_id: customerId,
                note_text: `🎉 PROMOTIONAL DISCOUNT APPLIED: Customer received ${bonusMonths} months FREE bonus warranty extension. Extended warranty end date: ${endDate.toLocaleDateString('en-GB')}`,
                created_by: user.id,
                is_pinned: true
              });
          }
        }
      }
    } catch (error) {
      console.error('Error checking/creating bonus note:', error);
    }
  };

  const getCurrentUser = async () => {
    const { data: { user } } = await supabase.auth.getUser();
    setCurrentUser(user);
  };

  const fetchNotes = async () => {
    try {
      // First get the notes
      const { data: notesData, error: notesError } = await supabase
        .from('customer_notes')
        .select(`
          id,
          note_text,
          is_pinned,
          created_by,
          created_at,
          updated_at
        `)
        .eq('customer_id', customerId)
        .order('is_pinned', { ascending: false })
        .order('created_at', { ascending: false });

      if (notesError) throw notesError;

      if (!notesData || notesData.length === 0) {
        setNotes([]);
        onNotesChange?.(0);
        return;
      }

      // Get admin users for the notes
      const createdByIds = [...new Set(notesData.map(note => note.created_by))];
      const { data: adminUsers } = await supabase
        .from('admin_users')
        .select('user_id, email, first_name, last_name')
        .in('user_id', createdByIds);

      // Get note tags
      const noteIds = notesData.map(note => note.id);
      const { data: noteTags } = await supabase
        .from('customer_note_tags')
        .select(`
          note_id,
          note_tags(
            id,
            name,
            color,
            description
          )
        `)
        .in('note_id', noteIds);

      // Process the notes with admin users and tags
      const processedNotes = notesData.map(note => {
        const adminUser = adminUsers?.find(admin => admin.user_id === note.created_by);
        const noteTagsForNote = noteTags?.filter(nt => nt.note_id === note.id) || [];
        
        return {
          ...note,
          admin_users: adminUser ? {
            email: adminUser.email,
            first_name: adminUser.first_name,
            last_name: adminUser.last_name
          } : null,
          tags: noteTagsForNote.map((nt: any) => nt.note_tags).filter(Boolean)
        };
      });

      setNotes(processedNotes);
      onNotesChange?.(processedNotes.length);
    } catch (error) {
      console.error('Error fetching notes:', error);
      toast.error('Failed to load notes');
    } finally {
      setLoading(false);
    }
  };

  const fetchTags = async () => {
    try {
      const { data, error } = await supabase
        .from('note_tags')
        .select('*')
        .eq('is_active', true)
        .order('name');

      if (error) throw error;
      setTags(data || []);
    } catch (error) {
      console.error('Error fetching tags:', error);
    }
  };

  const addNote = async () => {
    if (!newNote.trim() || !currentUser) return;

    try {
      const { data: noteData, error: noteError } = await supabase
        .from('customer_notes')
        .insert({
          customer_id: customerId,
          note_text: newNote.trim(),
          created_by: currentUser.id,
        })
        .select()
        .single();

      if (noteError) throw noteError;

      // Add tags to the note
      if (selectedTags.length > 0) {
        const tagRelations = selectedTags.map(tagId => ({
          note_id: noteData.id,
          tag_id: tagId,
        }));

        const { error: tagsError } = await supabase
          .from('customer_note_tags')
          .insert(tagRelations);

        if (tagsError) throw tagsError;
      }

      setNewNote('');
      setSelectedTags([]);
      setIsAddingNote(false);
      fetchNotes();
      toast.success('Note added successfully');
    } catch (error) {
      console.error('Error adding note:', error);
      toast.error('Failed to add note');
    }
  };

  const updateNote = async (noteId: string, newText: string) => {
    try {
      const { error } = await supabase
        .from('customer_notes')
        .update({ note_text: newText.trim() })
        .eq('id', noteId);

      if (error) throw error;

      setEditingNote(null);
      setEditingText('');
      fetchNotes();
      toast.success('Note updated successfully');
    } catch (error) {
      console.error('Error updating note:', error);
      toast.error('Failed to update note');
    }
  };

  const togglePin = async (noteId: string, isPinned: boolean) => {
    try {
      const { error } = await supabase
        .from('customer_notes')
        .update({ is_pinned: !isPinned })
        .eq('id', noteId);

      if (error) throw error;
      fetchNotes();
      toast.success(isPinned ? 'Note unpinned' : 'Note pinned');
    } catch (error) {
      console.error('Error toggling pin:', error);
      toast.error('Failed to update note');
    }
  };

  const deleteNote = async (noteId: string) => {
    try {
      const { error } = await supabase
        .from('customer_notes')
        .delete()
        .eq('id', noteId);

      if (error) throw error;
      fetchNotes();
      toast.success('Note deleted successfully');
    } catch (error) {
      console.error('Error deleting note:', error);
      toast.error('Failed to delete note');
    }
  };

  const getAuthorName = (note: CustomerNote) => {
    const admin = note.admin_users;
    if (admin?.first_name && admin?.last_name) {
      return `${admin.first_name} ${admin.last_name}`;
    }
    return admin?.email || 'Unknown User';
  };

  const getTagClassName = (color: string) => {
    return TAG_COLORS[color as keyof typeof TAG_COLORS] || 'bg-gray-500 text-white hover:bg-gray-600';
  };

  const filteredNotes = notes.filter(note => {
    const matchesSearch = !searchTerm || 
      note.note_text.toLowerCase().includes(searchTerm.toLowerCase()) ||
      getAuthorName(note).toLowerCase().includes(searchTerm.toLowerCase());
      
    const matchesTags = filterTags.length === 0 || 
      filterTags.some(tagId => note.tags.some(tag => tag.id === tagId));
      
    return matchesSearch && matchesTags;
  });

  if (loading) {
    return (
      <div className="p-4 bg-card rounded-lg border">
        <div className="animate-pulse space-y-4">
          <div className="h-4 bg-muted rounded w-1/4"></div>
          <div className="space-y-2">
            <div className="h-12 bg-muted rounded"></div>
            <div className="h-12 bg-muted rounded"></div>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-4">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-2">
          <h3 className="text-lg font-semibold">Customer Notes</h3>
          <Badge variant="secondary">{notes.length}</Badge>
        </div>
        <Button 
          onClick={() => setIsAddingNote(true)} 
          size="sm"
          className="gap-2"
        >
          <Plus className="h-4 w-4" />
          Add Note
        </Button>
      </div>

      {/* Search and Filter */}
      <div className="space-y-3">
        <div className="relative">
          <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 h-4 w-4 text-muted-foreground" />
          <Input
            placeholder="Search notes..."
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
            className="pl-10"
          />
        </div>
        
        <div className="flex flex-wrap gap-2">
          <Label className="text-sm text-muted-foreground">Filter by tags:</Label>
          {tags.map(tag => (
            <Badge
              key={tag.id}
              variant={filterTags.includes(tag.id) ? "default" : "outline"}
              className={`cursor-pointer transition-colors ${filterTags.includes(tag.id) ? getTagClassName(tag.color) : ''}`}
              onClick={() => {
                setFilterTags(prev => 
                  prev.includes(tag.id) 
                    ? prev.filter(id => id !== tag.id)
                    : [...prev, tag.id]
                );
              }}
            >
              {tag.name}
            </Badge>
          ))}
          {filterTags.length > 0 && (
            <Button
              variant="ghost"
              size="sm"
              onClick={() => setFilterTags([])}
              className="h-6 text-xs"
            >
              Clear
            </Button>
          )}
        </div>
      </div>

      {/* Add Note Dialog */}
      <Dialog open={isAddingNote} onOpenChange={setIsAddingNote}>
        <DialogContent className="max-w-2xl">
          <DialogHeader>
            <DialogTitle>Add Customer Note</DialogTitle>
          </DialogHeader>
          <div className="space-y-4">
            <div>
              <Label htmlFor="note-text">Note</Label>
              <Textarea
                id="note-text"
                value={newNote}
                onChange={(e) => setNewNote(e.target.value)}
                placeholder="Enter your note here..."
                rows={4}
              />
            </div>
            
            <div>
              <Label>Tags (optional)</Label>
              <div className="flex flex-wrap gap-2 mt-2">
                {tags.map(tag => (
                  <Badge
                    key={tag.id}
                    variant={selectedTags.includes(tag.id) ? "default" : "outline"}
                    className={`cursor-pointer transition-colors ${
                      selectedTags.includes(tag.id) ? getTagClassName(tag.color) : ''
                    }`}
                    onClick={() => {
                      setSelectedTags(prev => 
                        prev.includes(tag.id)
                          ? prev.filter(id => id !== tag.id)
                          : [...prev, tag.id]
                      );
                    }}
                  >
                    {tag.name}
                  </Badge>
                ))}
              </div>
            </div>

            <div className="flex justify-end gap-2">
              <Button variant="outline" onClick={() => setIsAddingNote(false)}>
                Cancel
              </Button>
              <Button onClick={addNote} disabled={!newNote.trim()}>
                Add Note
              </Button>
            </div>
          </div>
        </DialogContent>
      </Dialog>

      {/* Notes List */}
      <div className="space-y-3 max-h-96 overflow-y-auto">
        {filteredNotes.length === 0 ? (
          <div className="text-center text-muted-foreground py-8">
            {notes.length === 0 ? 'No notes yet. Add the first note!' : 'No notes match your search.'}
          </div>
        ) : (
          filteredNotes.map(note => (
            <div
              key={note.id}
              className={`p-4 border rounded-lg space-y-3 ${
                note.is_pinned ? 'bg-amber-50 border-amber-200' : 'bg-card'
              }`}
            >
              {/* Note Header */}
              <div className="flex items-start justify-between">
                <div className="flex items-center gap-2">
                  {note.is_pinned && (
                    <Pin className="h-4 w-4 text-amber-600" />
                  )}
                  <div className="flex items-center gap-2 text-sm text-muted-foreground">
                    <User className="h-3 w-3" />
                    <span>{getAuthorName(note)}</span>
                    <Clock className="h-3 w-3" />
                    <span>{formatDistanceToNow(new Date(note.created_at), { addSuffix: true })}</span>
                  </div>
                </div>
                
                <div className="flex items-center gap-1">
                  <Button
                    variant="ghost"
                    size="sm"
                    onClick={() => togglePin(note.id, note.is_pinned)}
                    className="h-8 w-8 p-0"
                  >
                    <Pin className={`h-3 w-3 ${note.is_pinned ? 'text-amber-600' : 'text-muted-foreground'}`} />
                  </Button>
                  <Button
                    variant="ghost"
                    size="sm"
                    onClick={() => {
                      setEditingNote(note.id);
                      setEditingText(note.note_text);
                    }}
                    className="h-8 w-8 p-0"
                  >
                    <Edit className="h-3 w-3" />
                  </Button>
                  <Button
                    variant="ghost"
                    size="sm"
                    onClick={() => deleteNote(note.id)}
                    className="h-8 w-8 p-0 text-destructive hover:text-destructive"
                  >
                    <Trash2 className="h-3 w-3" />
                  </Button>
                </div>
              </div>

              {/* Note Content */}
              {editingNote === note.id ? (
                <div className="space-y-2">
                  <Textarea
                    value={editingText}
                    onChange={(e) => setEditingText(e.target.value)}
                    rows={3}
                  />
                  <div className="flex justify-end gap-2">
                    <Button
                      variant="outline"
                      size="sm"
                      onClick={() => {
                        setEditingNote(null);
                        setEditingText('');
                      }}
                    >
                      <X className="h-3 w-3 mr-1" />
                      Cancel
                    </Button>
                    <Button
                      size="sm"
                      onClick={() => updateNote(note.id, editingText)}
                      disabled={!editingText.trim()}
                    >
                      <Save className="h-3 w-3 mr-1" />
                      Save
                    </Button>
                  </div>
                </div>
              ) : (
                <div className="text-sm whitespace-pre-wrap">{note.note_text}</div>
              )}

              {/* Tags */}
              {note.tags.length > 0 && (
                <div className="flex flex-wrap gap-1">
                  {note.tags.map(tag => (
                    <Badge
                      key={tag.id}
                      className={`text-xs ${getTagClassName(tag.color)}`}
                    >
                      {tag.name}
                    </Badge>
                  ))}
                </div>
              )}
            </div>
          ))
        )}
      </div>
    </div>
  );
};