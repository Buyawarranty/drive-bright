import { useCallback, useEffect, useState } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { toast } from 'sonner';

export interface ClaimNote {
  id: string;
  claim_id: string;
  note: string;
  created_by: string | null;
  created_by_name: string | null;
  created_at: string;
}

interface UseClaimNotesResult {
  notes: ClaimNote[];
  loading: boolean;
  saving: boolean;
  addNote: (text: string) => Promise<boolean>;
  deleteNote: (id: string) => Promise<void>;
  refetch: () => Promise<void>;
}

export const useClaimNotes = (claimId?: string | null): UseClaimNotesResult => {
  const [notes, setNotes] = useState<ClaimNote[]>([]);
  const [loading, setLoading] = useState(false);
  const [saving, setSaving] = useState(false);

  const fetchNotes = useCallback(async () => {
    if (!claimId) {
      setNotes([]);
      return;
    }
    setLoading(true);
    try {
      const { data, error } = await (supabase
        .from('claim_notes' as any)
        .select('*')
        .eq('claim_id', claimId)
        .order('created_at', { ascending: false }) as any);
      if (error) throw error;
      setNotes((data || []) as ClaimNote[]);
    } catch (err) {
      console.error('useClaimNotes fetch error', err);
      setNotes([]);
    } finally {
      setLoading(false);
    }
  }, [claimId]);

  useEffect(() => {
    fetchNotes();
  }, [fetchNotes]);

  const addNote = useCallback(async (text: string): Promise<boolean> => {
    const trimmed = text.trim();
    if (!trimmed || !claimId) return false;
    setSaving(true);
    try {
      const { data: userData } = await supabase.auth.getUser();
      const uid = userData.user?.id || null;

      let displayName: string | null = null;
      if (uid) {
        const { data: adminUser } = await supabase
          .from('admin_users')
          .select('first_name, last_name, email')
          .eq('user_id', uid)
          .maybeSingle();
        if (adminUser) {
          displayName =
            [adminUser.first_name, adminUser.last_name].filter(Boolean).join(' ').trim() ||
            adminUser.email ||
            null;
        }
      }

      const { error } = await (supabase
        .from('claim_notes' as any)
        .insert({
          claim_id: claimId,
          note: trimmed,
          created_by: uid,
          created_by_name: displayName,
        }) as any);
      if (error) throw error;

      toast.success('Note saved');
      await fetchNotes();
      return true;
    } catch (err: any) {
      console.error('addNote error', err);
      toast.error(err?.message || 'Failed to save note');
      return false;
    } finally {
      setSaving(false);
    }
  }, [claimId, fetchNotes]);

  const deleteNote = useCallback(async (id: string) => {
    try {
      const { error } = await (supabase
        .from('claim_notes' as any)
        .delete()
        .eq('id', id) as any);
      if (error) throw error;
      toast.success('Note deleted');
      await fetchNotes();
    } catch (err: any) {
      console.error('deleteNote error', err);
      toast.error(err?.message || 'Failed to delete note');
    }
  }, [fetchNotes]);

  return { notes, loading, saving, addNote, deleteNote, refetch: fetchNotes };
};
