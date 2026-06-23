import { useCallback, useEffect, useState } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { toast } from 'sonner';

export type ClaimNoteType =
  | 'general'
  | 'call_log'
  | 'customer_update'
  | 'garage_update'
  | 'manager_review'
  | 'complaint_risk';

export const NOTE_TYPE_META: Record<
  ClaimNoteType,
  { label: string; cls: string; dot: string }
> = {
  general:         { label: 'General',         cls: 'bg-slate-100 text-slate-700 border-slate-200',  dot: 'bg-slate-400' },
  call_log:        { label: 'Call log',        cls: 'bg-blue-100 text-blue-800 border-blue-200',     dot: 'bg-blue-500' },
  customer_update: { label: 'Customer update', cls: 'bg-emerald-100 text-emerald-800 border-emerald-200', dot: 'bg-emerald-500' },
  garage_update:   { label: 'Garage update',   cls: 'bg-indigo-100 text-indigo-800 border-indigo-200', dot: 'bg-indigo-500' },
  manager_review:  { label: 'Manager review',  cls: 'bg-purple-100 text-purple-800 border-purple-200', dot: 'bg-purple-500' },
  complaint_risk:  { label: 'Complaint risk',  cls: 'bg-rose-100 text-rose-800 border-rose-200',     dot: 'bg-rose-500' },
};

export interface ClaimNote {
  id: string;
  claim_id: string;
  note: string;
  note_type: ClaimNoteType;
  created_by: string | null;
  created_by_name: string | null;
  created_at: string;
}

interface UseClaimNotesResult {
  notes: ClaimNote[];
  loading: boolean;
  saving: boolean;
  addNote: (text: string, type?: ClaimNoteType) => Promise<boolean>;
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
      const rows = (data || []).map((r: any) => ({
        ...r,
        note_type: (r.note_type as ClaimNoteType) || 'general',
      })) as ClaimNote[];
      setNotes(rows);
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

  const addNote = useCallback(
    async (text: string, type: ClaimNoteType = 'general'): Promise<boolean> => {
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
            note_type: type,
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
    },
    [claimId, fetchNotes],
  );

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
