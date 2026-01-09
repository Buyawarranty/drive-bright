import { useState, useCallback, useEffect } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { toast } from 'sonner';

export interface QuickNote {
  id: string;
  lead_id: string;
  note_text: string;
  is_pinned: boolean;
  created_by: string;
  created_at: string;
  updated_at: string;
  author?: {
    first_name: string | null;
    last_name: string | null;
    email: string;
  } | null;
}

export const useLeadQuickNotes = (leadId: string) => {
  const [notes, setNotes] = useState<QuickNote[]>([]);
  const [loading, setLoading] = useState(false);

  const fetchNotes = useCallback(async () => {
    if (!leadId) return;
    
    try {
      setLoading(true);
      const { data, error } = await supabase
        .from('lead_quick_notes')
        .select('*')
        .eq('lead_id', leadId)
        .order('is_pinned', { ascending: false })
        .order('created_at', { ascending: false });

      if (error) throw error;

      // Fetch author info for each note
      const notesWithAuthors = await Promise.all(
        (data || []).map(async (note: any) => {
          if (note.created_by) {
            const { data: authorData } = await supabase
              .from('admin_users')
              .select('first_name, last_name, email')
              .eq('id', note.created_by)
              .single();
            return { ...note, author: authorData };
          }
          return note;
        })
      );

      setNotes(notesWithAuthors as QuickNote[]);
    } catch (error) {
      console.error('Error fetching quick notes:', error);
    } finally {
      setLoading(false);
    }
  }, [leadId]);

  useEffect(() => {
    fetchNotes();
  }, [fetchNotes]);

  const addNote = async (noteText: string) => {
    const { data: userData, error: userError } = await supabase.auth.getUser();
    
    if (userError || !userData.user) {
      console.error('Error getting user:', userError);
      toast.error('Please sign in to add notes');
      throw new Error('User not authenticated');
    }

    const { data: adminUser, error: adminError } = await supabase
      .from('admin_users')
      .select('id')
      .eq('user_id', userData.user.id)
      .single();

    if (adminError || !adminUser) {
      console.error('Error finding admin user:', adminError);
      toast.error('Could not identify your admin account');
      throw new Error('Admin user not found');
    }

    const { data, error } = await supabase
      .from('lead_quick_notes')
      .insert({
        lead_id: leadId,
        note_text: noteText.trim(),
        created_by: adminUser.id
      })
      .select()
      .single();

    if (error) {
      console.error('Error adding quick note:', error);
      toast.error('Failed to add note');
      throw error;
    }

    await fetchNotes();
    return data;
  };

  const updateNote = async (noteId: string, noteText: string) => {
    try {
      const { error } = await supabase
        .from('lead_quick_notes')
        .update({ note_text: noteText.trim() })
        .eq('id', noteId);

      if (error) throw error;
      await fetchNotes();
    } catch (error) {
      console.error('Error updating quick note:', error);
      toast.error('Failed to update note');
    }
  };

  const togglePin = async (noteId: string, isPinned: boolean) => {
    try {
      // If pinning, unpin all others first
      if (!isPinned) {
        await supabase
          .from('lead_quick_notes')
          .update({ is_pinned: false })
          .eq('lead_id', leadId);
      }

      const { error } = await supabase
        .from('lead_quick_notes')
        .update({ is_pinned: !isPinned })
        .eq('id', noteId);

      if (error) throw error;
      await fetchNotes();
    } catch (error) {
      console.error('Error toggling pin:', error);
      toast.error('Failed to update note');
    }
  };

  const deleteNote = async (noteId: string) => {
    try {
      const { error } = await supabase
        .from('lead_quick_notes')
        .delete()
        .eq('id', noteId);

      if (error) throw error;
      await fetchNotes();
      toast.success('Note deleted');
    } catch (error) {
      console.error('Error deleting quick note:', error);
      toast.error('Failed to delete note');
    }
  };

  return {
    notes,
    loading,
    addNote,
    updateNote,
    togglePin,
    deleteNote,
    refetch: fetchNotes
  };
};
