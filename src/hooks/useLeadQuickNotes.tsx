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
  const [loading, setLoading] = useState(true); // Start as true since we'll fetch on mount

  // Check if this is an abandoned cart lead (ID starts with 'cart_')
  const isAbandonedCart = leadId?.startsWith('cart_');
  const actualId = isAbandonedCart ? leadId.replace('cart_', '') : leadId;

  const fetchNotes = useCallback(async () => {
    if (!leadId) {
      setLoading(false);
      return;
    }
    
    try {
      setLoading(true);
      setLoading(true);
      
      if (isAbandonedCart) {
        // For abandoned carts, fetch from abandoned_carts.contact_notes
        // We'll parse it as a single note if it exists
        const { data: cartData, error: cartError } = await supabase
          .from('abandoned_carts')
          .select('contact_notes, updated_at')
          .eq('id', actualId)
          .maybeSingle();

        if (cartError) throw cartError;

        if (cartData?.contact_notes) {
          // Create a synthetic note from the contact_notes field
          const syntheticNote: QuickNote = {
            id: `cart_note_${actualId}`,
            lead_id: leadId,
            note_text: cartData.contact_notes,
            is_pinned: true,
            created_by: '',
            created_at: cartData.updated_at || new Date().toISOString(),
            updated_at: cartData.updated_at || new Date().toISOString(),
            author: null
          };
          setNotes([syntheticNote]);
        } else {
          setNotes([]);
        }
      } else {
        // For sales leads, use the lead_quick_notes table AND legacy notes from sales_leads.notes
        const [quickNotesResult, leadResult] = await Promise.all([
          supabase
            .from('lead_quick_notes')
            .select('*')
            .eq('lead_id', leadId)
            .order('is_pinned', { ascending: false })
            .order('created_at', { ascending: false }),
          supabase
            .from('sales_leads')
            .select('notes, updated_at')
            .eq('id', leadId)
            .maybeSingle()
        ]);

        if (quickNotesResult.error) throw quickNotesResult.error;

        // Fetch author info for each note
        const notesWithAuthors = await Promise.all(
          (quickNotesResult.data || []).map(async (note: any) => {
            if (note.created_by) {
              const { data: authorData } = await supabase
                .from('admin_users')
                .select('first_name, last_name, email')
                .eq('id', note.created_by)
                .maybeSingle();
              return { ...note, author: authorData };
            }
            return note;
          })
        );

        // Also include legacy notes from sales_leads.notes field if it exists
        // This ensures older notes are still visible
        let allNotes = notesWithAuthors as QuickNote[];
        
        if (leadResult.data?.notes && leadResult.data.notes.trim()) {
          // Create a synthetic note from the legacy notes field
          const legacyNote: QuickNote = {
            id: `legacy_${leadId}`,
            lead_id: leadId,
            note_text: leadResult.data.notes,
            is_pinned: true, // Pin legacy notes so they're always visible at top
            created_by: '',
            created_at: leadResult.data.updated_at || new Date().toISOString(),
            updated_at: leadResult.data.updated_at || new Date().toISOString(),
            author: { first_name: 'Previous', last_name: 'Notes', email: 'legacy@system' }
          };
          
          // Add legacy note first (pinned) if there are no quick notes OR if legacy has content
          // Check if we already have any notes - if not, always show legacy
          // If we have notes, only show legacy if it has different content
          const hasQuickNotes = allNotes.length > 0;
          if (!hasQuickNotes || !allNotes.some(n => n.note_text === legacyNote.note_text)) {
            allNotes = [legacyNote, ...allNotes];
          }
        }

        setNotes(allNotes);
      }
    } catch (error) {
      console.error('Error fetching quick notes:', error);
    } finally {
      setLoading(false);
    }
  }, [leadId, isAbandonedCart, actualId]);

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
      .select('id, first_name, last_name, email')
      .eq('user_id', userData.user.id)
      .maybeSingle();

    if (adminError || !adminUser) {
      console.error('Error finding admin user:', adminError);
      toast.error('Could not identify your admin account');
      throw new Error('Admin user not found');
    }

    if (isAbandonedCart) {
      // For abandoned carts, append to contact_notes field
      const existingNotes = notes.length > 0 ? notes[0].note_text : '';
      const timestamp = new Date().toLocaleString('en-GB', { 
        day: '2-digit', 
        month: 'short', 
        year: 'numeric', 
        hour: '2-digit', 
        minute: '2-digit' 
      });
      const authorName = adminUser.first_name || adminUser.email.split('@')[0];
      const newNoteEntry = `[${timestamp} - ${authorName}] ${noteText.trim()}`;
      const updatedNotes = existingNotes 
        ? `${existingNotes}\n\n${newNoteEntry}` 
        : newNoteEntry;

      const { error } = await supabase
        .from('abandoned_carts')
        .update({ 
          contact_notes: updatedNotes,
          updated_at: new Date().toISOString()
        })
        .eq('id', actualId);

      if (error) {
        console.error('Error adding note to abandoned cart:', error);
        toast.error('Failed to add note');
        throw error;
      }

      await fetchNotes();
      return { id: `cart_note_${actualId}`, note_text: updatedNotes };
    } else {
      // For sales leads, use the lead_quick_notes table
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
    }
  };

  const updateNote = async (noteId: string, noteText: string) => {
    try {
      if (isAbandonedCart) {
        // For abandoned carts, replace the entire contact_notes
        const { error } = await supabase
          .from('abandoned_carts')
          .update({ 
            contact_notes: noteText.trim(),
            updated_at: new Date().toISOString()
          })
          .eq('id', actualId);

        if (error) throw error;
      } else {
        const { error } = await supabase
          .from('lead_quick_notes')
          .update({ note_text: noteText.trim() })
          .eq('id', noteId);

        if (error) throw error;
      }
      await fetchNotes();
    } catch (error) {
      console.error('Error updating quick note:', error);
      toast.error('Failed to update note');
    }
  };

  const togglePin = async (noteId: string, isPinned: boolean) => {
    // Pinning not supported for abandoned carts (they only have one note field)
    if (isAbandonedCart) {
      toast.info('Pinning is not available for this lead type');
      return;
    }

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
      if (isAbandonedCart) {
        // For abandoned carts, clear the contact_notes field
        const { error } = await supabase
          .from('abandoned_carts')
          .update({ 
            contact_notes: null,
            updated_at: new Date().toISOString()
          })
          .eq('id', actualId);

        if (error) throw error;
        setNotes([]);
        toast.success('Note cleared');
      } else {
        const { error } = await supabase
          .from('lead_quick_notes')
          .delete()
          .eq('id', noteId);

        if (error) throw error;
        await fetchNotes();
        toast.success('Note deleted');
      }
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
    refetch: fetchNotes,
    isAbandonedCart
  };
};
