import { useState, useCallback, useEffect, useRef } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { toast } from 'sonner';

const quickNotesCache = new Map<string, QuickNote[]>();
export const PENDING_NOTE_QUEUE_STORAGE_KEY = 'lead-quick-note-pending-queue';

export interface PendingQueuedNote {
  id: string;
  leadId: string;
  noteText: string;
  createdAt: string;
}

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

export const readPendingQueuedNotes = (): PendingQueuedNote[] => {
  if (typeof window === 'undefined') return [];

  try {
    const raw = window.localStorage.getItem(PENDING_NOTE_QUEUE_STORAGE_KEY);
    return raw ? JSON.parse(raw) : [];
  } catch {
    return [];
  }
};

export const writePendingQueuedNotes = (notes: PendingQueuedNote[]) => {
  if (typeof window === 'undefined') return;

  try {
    window.localStorage.setItem(PENDING_NOTE_QUEUE_STORAGE_KEY, JSON.stringify(notes));
  } catch {
    // Ignore storage failures
  }
};

const isAbandonedCartLeadId = (leadId: string) => leadId.startsWith('cart_');
const getActualLeadId = (leadId: string) => isAbandonedCartLeadId(leadId) ? leadId.replace('cart_', '') : leadId;

// Cache admin user to avoid repeated lookups
let cachedAdminUser: { id: string; first_name: string | null; last_name: string | null; email: string } | null = null;
let cacheExpiry = 0;

export const useLeadQuickNotes = (leadId: string) => {
  const [notes, setNotes] = useState<QuickNote[]>([]);
  const [loading, setLoading] = useState(true);
  const hasFetchedRef = useRef(false);
  const notesRef = useRef<QuickNote[]>([]);
  const isSavingRef = useRef(false);
  
  // Keep ref in sync - supports both direct value and updater function
  const updateNotes = useCallback((newNotesOrUpdater: QuickNote[] | ((prev: QuickNote[]) => QuickNote[])) => {
    if (typeof newNotesOrUpdater === 'function') {
      setNotes(prev => {
        const result = newNotesOrUpdater(prev);
        notesRef.current = result;
        if (leadId) quickNotesCache.set(leadId, result);
        return result;
      });
    } else {
      notesRef.current = newNotesOrUpdater;
      if (leadId) quickNotesCache.set(leadId, newNotesOrUpdater);
      setNotes(newNotesOrUpdater);
    }
  }, [leadId]);

  const isAbandonedCart = leadId?.startsWith('cart_');
  const actualId = isAbandonedCart ? leadId.replace('cart_', '') : leadId;

  // Reset when lead changes
  useEffect(() => {
    if (!leadId) {
      hasFetchedRef.current = false;
      setLoading(false);
      updateNotes([]);
      return;
    }

    const cachedNotes = quickNotesCache.get(leadId);
    const hasCachedNotes = quickNotesCache.has(leadId);

    hasFetchedRef.current = hasCachedNotes;
    setLoading(!hasCachedNotes);
    updateNotes(cachedNotes || []);
  }, [leadId, updateNotes]);

  // Session validation removed — RLS policies handle authorization, and
  // getAuthenticatedAdmin() validates auth before write operations.

  const fetchNotes = useCallback(async (isRefetch = false) => {
    if (!leadId) {
      setLoading(false);
      updateNotes([]);
      return;
    }
    
    // Only show loading spinner when nothing is cached yet for this lead
    if (!isRefetch && !quickNotesCache.has(leadId)) {
      setLoading(true);
    }
    
    const timeoutId = setTimeout(() => {
      setLoading(false);
    }, 5000);
    
    try {
      // Skip session check on refetch to avoid latency — RLS will gate access
      if (isAbandonedCart) {
        const { data: cartData, error: cartError } = await supabase
          .from('abandoned_carts')
          .select('contact_notes, updated_at')
          .eq('id', actualId)
          .maybeSingle();

        if (cartError) throw cartError;

        if (cartData?.contact_notes) {
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
          updateNotes([syntheticNote]);
        } else {
          updateNotes([]);
        }
      } else {
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

        const quickNotes = quickNotesResult.data || [];
        
        // Batch fetch author info
        const authorIds = [...new Set(quickNotes.filter((n: any) => n.created_by).map((n: any) => n.created_by))];
        let authorsMap: Record<string, { first_name: string | null; last_name: string | null; email: string }> = {};
        
        if (authorIds.length > 0) {
          const { data: authorsData } = await supabase
            .from('admin_users')
            .select('id, first_name, last_name, email')
            .in('id', authorIds);
          
          if (authorsData) {
            authorsMap = authorsData.reduce((acc, author) => {
              acc[author.id] = { first_name: author.first_name, last_name: author.last_name, email: author.email };
              return acc;
            }, {} as Record<string, { first_name: string | null; last_name: string | null; email: string }>);
          }
        }
        
        const notesWithAuthors = quickNotes.map((note: any) => ({
          ...note,
          author: note.created_by ? authorsMap[note.created_by] || null : null
        }));

        let allNotes = notesWithAuthors as QuickNote[];
        
        if (leadResult.data?.notes && leadResult.data.notes.trim()) {
          const legacyNote: QuickNote = {
            id: `legacy_${leadId}`,
            lead_id: leadId,
            note_text: leadResult.data.notes,
            is_pinned: true,
            created_by: '',
            created_at: leadResult.data.updated_at || new Date().toISOString(),
            updated_at: leadResult.data.updated_at || new Date().toISOString(),
            author: { first_name: 'Previous', last_name: 'Notes', email: 'legacy@system' }
          };
          
          const hasQuickNotes = allNotes.length > 0;
          if (!hasQuickNotes || !allNotes.some(n => n.note_text === legacyNote.note_text)) {
            allNotes = [legacyNote, ...allNotes];
          }
        }

        updateNotes(allNotes);
      }
      
      hasFetchedRef.current = true;
    } catch (error) {
      console.error('[fetchNotes] Error:', error);
      // CRITICAL: Do NOT clear notes on error if we already had notes loaded
      if (!hasFetchedRef.current && notesRef.current.length === 0) {
        updateNotes([]);
      }
    } finally {
      clearTimeout(timeoutId);
      setLoading(false);
    }
  }, [leadId, isAbandonedCart, actualId, updateNotes]);

  useEffect(() => {
    fetchNotes(false); // initial load
  }, [fetchNotes]);

  useEffect(() => {
    let cancelled = false;

    void flushAllPendingQuickNotes().then((flushedLeadIds) => {
      if (!cancelled && flushedLeadIds.includes(leadId)) {
        void fetchNotes(true);
      }
    });

    return () => {
      cancelled = true;
    };
  }, [leadId, fetchNotes]);

  const getAuthenticatedAdmin = async () => {
    const now = Date.now();
    
    // Use cache if valid (short-circuit, no network call)
    if (cachedAdminUser && now < cacheExpiry) {
      return cachedAdminUser;
    }

    // Single getUser() call — validates server-side
    const { data: { user } } = await supabase.auth.getUser();
    
    if (!user) {
      // Try refresh once
      const { data: refreshData } = await supabase.auth.refreshSession();
      if (!refreshData.session?.user) {
        toast.error('Session expired — please log in again.');
        throw new Error('Session expired');
      }
    }

    const userId = user?.id || (await supabase.auth.getSession()).data.session?.user?.id;
    if (!userId) {
      toast.error('Session expired — please log in again.');
      throw new Error('Session expired');
    }

    const { data: adminData, error: adminError } = await supabase
      .from('admin_users')
      .select('id, first_name, last_name, email')
      .eq('user_id', userId)
      .maybeSingle();

    if (adminError || !adminData) {
      throw new Error('Admin user not found');
    }

    cachedAdminUser = adminData;
    cacheExpiry = now + 10 * 60 * 1000; // Cache for 10 minutes instead of 5
    return adminData;
  };

  const flushAllPendingQuickNotes = async () => {
    const pendingNotes = readPendingQueuedNotes().sort(
      (a, b) => new Date(a.createdAt).getTime() - new Date(b.createdAt).getTime()
    );

    if (pendingNotes.length === 0) return [] as string[];

    try {
      const adminUser = await getAuthenticatedAdmin();
      const remainingNotes: PendingQueuedNote[] = [];
      const flushedLeadIds = new Set<string>();

      for (const queuedNote of pendingNotes) {
        try {
          const queuedLeadId = queuedNote.leadId;
          const queuedActualId = getActualLeadId(queuedLeadId);
          const nowIso = new Date().toISOString();

          if (isAbandonedCartLeadId(queuedLeadId)) {
            const { data: cartData, error: cartError } = await supabase
              .from('abandoned_carts')
              .select('contact_notes')
              .eq('id', queuedActualId)
              .maybeSingle();

            if (cartError) throw cartError;

            const timestamp = new Date().toLocaleString('en-GB', {
              day: '2-digit',
              month: 'short',
              year: 'numeric',
              hour: '2-digit',
              minute: '2-digit'
            });
            const authorName = adminUser.first_name || adminUser.email.split('@')[0];
            const newNoteEntry = `[${timestamp} - ${authorName}] ${queuedNote.noteText.trim()}`;
            const updatedNotes = cartData?.contact_notes
              ? `${cartData.contact_notes}\n\n${newNoteEntry}`
              : newNoteEntry;

            const { error: updateError } = await supabase
              .from('abandoned_carts')
              .update({ contact_notes: updatedNotes, updated_at: nowIso })
              .eq('id', queuedActualId);

            if (updateError) throw updateError;
          } else {
            const { error: insertError } = await supabase
              .from('lead_quick_notes')
              .insert({
                lead_id: queuedLeadId,
                note_text: queuedNote.noteText.trim(),
                created_by: adminUser.id
              });

            if (insertError) throw insertError;
          }

          flushedLeadIds.add(queuedLeadId);
        } catch (error) {
          console.warn('[useLeadQuickNotes] Failed to flush queued note, will retry later:', error);
          remainingNotes.push(queuedNote);
        }
      }

      writePendingQueuedNotes(remainingNotes);
      return Array.from(flushedLeadIds);
    } catch (error) {
      console.warn('[useLeadQuickNotes] Unable to flush queued notes yet:', error);
      return [] as string[];
    }
  };

  const addNote = async (noteText: string) => {
    try {
      isSavingRef.current = true;
      const adminUser = await getAuthenticatedAdmin();
      
      if (isAbandonedCart) {
        const existingNotes = notes.length > 0 ? notes[0].note_text : '';
        const timestamp = new Date().toLocaleString('en-GB', { 
          day: '2-digit', month: 'short', year: 'numeric', 
          hour: '2-digit', minute: '2-digit' 
        });
        const authorName = adminUser.first_name || adminUser.email.split('@')[0];
        const newNoteEntry = `[${timestamp} - ${authorName}] ${noteText.trim()}`;
        const updatedNotes = existingNotes 
          ? `${existingNotes}\n\n${newNoteEntry}` 
          : newNoteEntry;

        const { error } = await supabase
          .from('abandoned_carts')
          .update({ contact_notes: updatedNotes, updated_at: new Date().toISOString() })
          .eq('id', actualId);

        if (error) throw error;

        // Update local state immediately
        const syntheticNote: QuickNote = {
          id: `cart_note_${actualId}`,
          lead_id: leadId,
          note_text: updatedNotes,
          is_pinned: true,
          created_by: '',
          created_at: new Date().toISOString(),
          updated_at: new Date().toISOString(),
          author: null
        };
        updateNotes([syntheticNote]);
        
        // Background refetch (fire-and-forget with error handling)
        fetchNotes(true).catch(e => console.warn('[addNote] Background refetch error:', e));
        return { id: `cart_note_${actualId}`, note_text: updatedNotes };
      } else {
        const { data, error } = await supabase
          .from('lead_quick_notes')
          .insert({
            lead_id: leadId,
            note_text: noteText.trim(),
            created_by: adminUser.id
          })
          .select()
          .maybeSingle();

        if (error) throw error;

        // CRITICAL: Update local state immediately with the new note
        // This ensures the note appears instantly without waiting for refetch
        const newNote: QuickNote = {
          ...data,
          author: {
            first_name: adminUser.first_name,
            last_name: adminUser.last_name,
            email: adminUser.email
          }
        };
        updateNotes(prev => {
          const pinned = prev.filter(n => n.is_pinned);
          const unpinned = prev.filter(n => !n.is_pinned);
          return [...pinned, newNote, ...unpinned];
        });
        
        // Background refetch to sync with server (fire-and-forget with error handling)
        fetchNotes(true).catch(e => console.warn('[addNote] Background refetch error:', e));
        return data;
      }
    } catch (error: any) {
      console.error('[addNote] Error:', error?.message || error);
      throw error;
    } finally {
      isSavingRef.current = false;
    }
  };

  const updateNote = async (noteId: string, noteText: string) => {
    try {
      isSavingRef.current = true;
      if (isAbandonedCart) {
        const { error } = await supabase
          .from('abandoned_carts')
          .update({ contact_notes: noteText.trim(), updated_at: new Date().toISOString() })
          .eq('id', actualId);
        if (error) throw error;
      } else {
        const { error } = await supabase
          .from('lead_quick_notes')
          .update({ note_text: noteText.trim() })
          .eq('id', noteId);
        if (error) throw error;
      }
      
      // Update local state immediately
      updateNotes(prev => prev.map(n => 
        n.id === noteId ? { ...n, note_text: noteText.trim(), updated_at: new Date().toISOString() } : n
      ));
      
      fetchNotes(true).catch(e => console.warn('[updateNote] Background refetch error:', e));
    } catch (error) {
      console.error('Error updating quick note:', error);
      toast.error('Failed to update note');
    } finally {
      isSavingRef.current = false;
    }
  };

  const togglePin = async (noteId: string, isPinned: boolean) => {
    if (isAbandonedCart) {
      toast.info('Pinning is not available for this lead type');
      return;
    }

    try {
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
      
      // Update local state
      updateNotes(prev => prev.map(n => ({
        ...n,
        is_pinned: n.id === noteId ? !isPinned : (isPinned ? n.is_pinned : false)
      })));
      
      fetchNotes(true).catch(e => console.warn('[togglePin] Background refetch error:', e));
    } catch (error) {
      console.error('Error toggling pin:', error);
      toast.error('Failed to update note');
    }
  };

  const deleteNote = async (noteId: string) => {
    try {
      isSavingRef.current = true;
      if (isAbandonedCart) {
        const { error } = await supabase
          .from('abandoned_carts')
          .update({ contact_notes: null, updated_at: new Date().toISOString() })
          .eq('id', actualId);
        if (error) throw error;
        updateNotes([]);
        toast.success('Note cleared');
      } else {
        const { error } = await supabase
          .from('lead_quick_notes')
          .delete()
          .eq('id', noteId);
        if (error) throw error;
        
        // Remove from local state immediately
        updateNotes(prev => prev.filter(n => n.id !== noteId));
        
        fetchNotes(true).catch(e => console.warn('[deleteNote] Background refetch error:', e));
        toast.success('Note deleted');
      }
    } catch (error) {
      console.error('Error deleting quick note:', error);
      toast.error('Failed to delete note');
    } finally {
      isSavingRef.current = false;
    }
  };

  return {
    notes,
    loading,
    addNote,
    updateNote,
    togglePin,
    deleteNote,
    refetch: () => fetchNotes(true),
    isAbandonedCart,
    isSaving: isSavingRef.current,
    flushPendingQuickNotes: flushAllPendingQuickNotes
  };
};
