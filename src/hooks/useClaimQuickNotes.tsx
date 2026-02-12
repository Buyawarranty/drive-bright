import { useState, useCallback, useEffect, useRef } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { toast } from 'sonner';

let cachedAdminUser: { id: string; first_name: string | null; last_name: string | null; email: string } | null = null;
let cacheExpiry = 0;

export interface ClaimNote {
  id: string;
  claim_id: string;
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

export const useClaimQuickNotes = (claimId: string) => {
  const [notes, setNotes] = useState<ClaimNote[]>([]);
  const [loading, setLoading] = useState(true);
  const notesRef = useRef<ClaimNote[]>([]);

  const updateNotes = useCallback((newNotesOrUpdater: ClaimNote[] | ((prev: ClaimNote[]) => ClaimNote[])) => {
    if (typeof newNotesOrUpdater === 'function') {
      setNotes(prev => {
        const result = newNotesOrUpdater(prev);
        notesRef.current = result;
        return result;
      });
    } else {
      notesRef.current = newNotesOrUpdater;
      setNotes(newNotesOrUpdater);
    }
  }, []);

  const fetchNotes = useCallback(async (isRefetch = false) => {
    if (!claimId) { setLoading(false); updateNotes([]); return; }
    if (!isRefetch) setLoading(true);

    try {
      const { data, error } = await supabase
        .from('claim_quick_notes')
        .select('*')
        .eq('claim_id', claimId)
        .order('is_pinned', { ascending: false })
        .order('created_at', { ascending: false });

      if (error) throw error;

      const authorIds = [...new Set((data || []).filter(n => n.created_by).map(n => n.created_by))];
      let authorsMap: Record<string, { first_name: string | null; last_name: string | null; email: string }> = {};
      if (authorIds.length > 0) {
        const { data: authorsData } = await supabase
          .from('admin_users')
          .select('id, first_name, last_name, email')
          .in('id', authorIds);
        if (authorsData) {
          authorsMap = authorsData.reduce((acc, a) => { acc[a.id] = { first_name: a.first_name, last_name: a.last_name, email: a.email }; return acc; }, {} as any);
        }
      }

      updateNotes((data || []).map(n => ({ ...n, author: n.created_by ? authorsMap[n.created_by] || null : null })));
    } catch (error) {
      console.error('[fetchClaimNotes] Error:', error);
      if (notesRef.current.length === 0) updateNotes([]);
    } finally {
      setLoading(false);
    }
  }, [claimId, updateNotes]);

  useEffect(() => { fetchNotes(false); }, [fetchNotes]);

  const getAuthenticatedAdmin = async () => {
    const now = Date.now();
    if (cachedAdminUser && now < cacheExpiry) return cachedAdminUser;

    const { data: { user } } = await supabase.auth.getUser();
    if (!user) {
      const { data: refreshData } = await supabase.auth.refreshSession();
      if (!refreshData.session?.user) { toast.error('Session expired'); throw new Error('Session expired'); }
    }
    const userId = user?.id || (await supabase.auth.getUser()).data.user?.id;
    if (!userId) { toast.error('Session expired'); throw new Error('Session expired'); }

    const { data: adminData, error } = await supabase.from('admin_users').select('id, first_name, last_name, email').eq('user_id', userId).maybeSingle();
    if (error || !adminData) throw new Error('Admin user not found');

    cachedAdminUser = adminData;
    cacheExpiry = now + 5 * 60 * 1000;
    return adminData;
  };

  const addNote = async (noteText: string) => {
    const adminUser = await getAuthenticatedAdmin();
    const { data, error } = await supabase
      .from('claim_quick_notes')
      .insert({ claim_id: claimId, note_text: noteText.trim(), created_by: adminUser.id })
      .select()
      .maybeSingle();
    if (error) throw error;

    const newNote: ClaimNote = { ...data!, author: { first_name: adminUser.first_name, last_name: adminUser.last_name, email: adminUser.email } };
    updateNotes(prev => [newNote, ...prev]);
    fetchNotes(true).catch(() => {});
    return data;
  };

  const updateNote = async (noteId: string, noteText: string) => {
    const { error } = await supabase.from('claim_quick_notes').update({ note_text: noteText.trim() }).eq('id', noteId);
    if (error) throw error;
    updateNotes(prev => prev.map(n => n.id === noteId ? { ...n, note_text: noteText.trim(), updated_at: new Date().toISOString() } : n));
    fetchNotes(true).catch(() => {});
  };

  const togglePin = async (noteId: string, isPinned: boolean) => {
    if (!isPinned) {
      await supabase.from('claim_quick_notes').update({ is_pinned: false }).eq('claim_id', claimId);
    }
    const { error } = await supabase.from('claim_quick_notes').update({ is_pinned: !isPinned }).eq('id', noteId);
    if (error) throw error;
    updateNotes(prev => prev.map(n => ({ ...n, is_pinned: n.id === noteId ? !isPinned : (isPinned ? n.is_pinned : false) })));
    fetchNotes(true).catch(() => {});
  };

  const deleteNote = async (noteId: string) => {
    const { error } = await supabase.from('claim_quick_notes').delete().eq('id', noteId);
    if (error) throw error;
    updateNotes(prev => prev.filter(n => n.id !== noteId));
    fetchNotes(true).catch(() => {});
    toast.success('Note deleted');
  };

  return { notes, loading, addNote, updateNote, togglePin, deleteNote, refetch: () => fetchNotes(true) };
};
