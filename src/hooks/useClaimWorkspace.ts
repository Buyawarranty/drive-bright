import { useCallback, useEffect, useState } from 'react';
import { supabase } from '@/integrations/supabase/client';

export interface Settlement {
  id?: string;
  claim_id: string;
  approved_amount: number | null;
  excess_deducted: number | null;
  final_paid_amount: number | null;
  payment_date: string | null;
  payment_method: string | null;
  paid_to: string | null;
  invoice_reference: string | null;
  notes: string | null;
}

export interface CallLog {
  id: string;
  claim_id: string;
  called_party: string;
  direction: string | null;
  outcome: string | null;
  summary: string | null;
  follow_up_required: boolean;
  follow_up_date: string | null;
  logged_by_name: string | null;
  created_at: string;
}

export interface ClaimDocument {
  id: string;
  claim_id: string;
  file_url: string;
  file_name: string;
  file_size: number | null;
  file_type: string | null;
  label: string | null;
  visibility: string;
  uploaded_by_name: string | null;
  uploaded_by_role: string | null;
  notes: string | null;
  created_at: string;
}

export interface Appeal {
  id: string;
  claim_id: string;
  reason?: string | null;
  new_evidence: string | null;
  status: string;
  outcome: string | null;
  created_at: string;
  closed_at: string | null;
}

export interface AuditEntry {
  id: string;
  claim_id: string;
  actor_name: string | null;
  action: string;
  field: string | null;
  old_value: string | null;
  new_value: string | null;
  reason?: string | null;
  created_at: string;
}

export async function logClaimAudit(entry: Omit<AuditEntry, 'id' | 'created_at'> & { actor_id?: string | null }) {
  try {
    const { data: userRes } = await supabase.auth.getUser();
    const uid = userRes?.user?.id ?? null;
    let name = entry.actor_name;
    if (!name && uid) {
      const { data: admin } = await supabase
        .from('admin_users')
        .select('first_name,last_name,email')
        .eq('user_id', uid)
        .maybeSingle();
      if (admin) name = [admin.first_name, admin.last_name].filter(Boolean).join(' ').trim() || admin.email;
    }
    await supabase.from('claim_audit_log').insert({
      claim_id: entry.claim_id,
      actor_id: uid,
      actor_name: name,
      action: entry.action,
      field: entry.field,
      old_value: entry.old_value,
      new_value: entry.new_value,
      reason: entry.reason,
    });
  } catch (e) {
    console.error('audit log failed', e);
  }
}

export function useSettlement(claimId: string) {
  const [data, setData] = useState<Settlement | null>(null);
  const [loading, setLoading] = useState(true);
  const load = useCallback(async () => {
    setLoading(true);
    const { data: row } = await supabase.from('claim_settlements').select('*').eq('claim_id', claimId).maybeSingle();
    setData(row as any);
    setLoading(false);
  }, [claimId]);
  useEffect(() => { load(); }, [load]);
  const save = async (partial: Partial<Settlement>, reason?: string) => {
    const { data: userRes } = await supabase.auth.getUser();
    const payload: any = { ...partial, claim_id: claimId, created_by: userRes?.user?.id ?? null };
    const { data: existing } = await supabase.from('claim_settlements').select('id').eq('claim_id', claimId).maybeSingle();
    if (existing?.id) {
      await supabase.from('claim_settlements').update(payload).eq('id', existing.id);
    } else {
      await supabase.from('claim_settlements').insert(payload);
    }
    await logClaimAudit({
      claim_id: claimId,
      actor_name: null,
      action: 'settlement_updated',
      field: Object.keys(partial).join(','),
      old_value: data ? JSON.stringify({
        approved: data.approved_amount, excess: data.excess_deducted, final: data.final_paid_amount,
      }) : null,
      new_value: JSON.stringify(partial),
      reason: reason ?? null,
    });
    await load();
  };
  return { settlement: data, loading, save, refetch: load };
}

export function useClaimCallLogs(claimId: string) {
  const [logs, setLogs] = useState<CallLog[]>([]);
  const [loading, setLoading] = useState(true);
  const load = useCallback(async () => {
    setLoading(true);
    const { data } = await supabase.from('claim_call_logs').select('*').eq('claim_id', claimId).order('created_at', { ascending: false });
    setLogs((data || []) as any);
    setLoading(false);
  }, [claimId]);
  useEffect(() => { load(); }, [load]);
  const add = async (entry: Omit<CallLog, 'id' | 'created_at' | 'claim_id' | 'logged_by_name'>) => {
    const { data: userRes } = await supabase.auth.getUser();
    let name: string | null = null;
    if (userRes?.user?.id) {
      const { data: admin } = await supabase.from('admin_users').select('first_name,last_name,email').eq('user_id', userRes.user.id).maybeSingle();
      if (admin) name = [admin.first_name, admin.last_name].filter(Boolean).join(' ').trim() || admin.email;
    }
    await supabase.from('claim_call_logs').insert({ ...entry, claim_id: claimId, logged_by: userRes?.user?.id ?? null, logged_by_name: name });
    await logClaimAudit({ claim_id: claimId, actor_name: name, action: 'call_logged', field: 'call', old_value: null, new_value: entry.called_party });
    await load();
  };
  return { logs, loading, add, refetch: load };
}

export function useClaimDocuments(claimId: string) {
  const [docs, setDocs] = useState<ClaimDocument[]>([]);
  const [loading, setLoading] = useState(true);
  const load = useCallback(async () => {
    setLoading(true);
    const { data } = await supabase.from('claim_documents').select('*').eq('claim_id', claimId).order('created_at', { ascending: false });
    setDocs((data || []) as any);
    setLoading(false);
  }, [claimId]);
  useEffect(() => { load(); }, [load]);
  const add = async (entry: Omit<ClaimDocument, 'id' | 'created_at' | 'claim_id' | 'uploaded_by_name' | 'uploaded_by_role'>) => {
    const { data: userRes } = await supabase.auth.getUser();
    let name: string | null = null;
    if (userRes?.user?.id) {
      const { data: admin } = await supabase.from('admin_users').select('first_name,last_name,email').eq('user_id', userRes.user.id).maybeSingle();
      if (admin) name = [admin.first_name, admin.last_name].filter(Boolean).join(' ').trim() || admin.email;
    }
    await supabase.from('claim_documents').insert({ ...entry, claim_id: claimId, uploaded_by: userRes?.user?.id ?? null, uploaded_by_name: name, uploaded_by_role: 'agent' });
    await logClaimAudit({ claim_id: claimId, actor_name: name, action: 'document_uploaded', field: 'documents', old_value: null, new_value: entry.file_name });
    await load();
  };
  const remove = async (id: string) => {
    const doc = docs.find(d => d.id === id);
    await supabase.from('claim_documents').delete().eq('id', id);
    await logClaimAudit({ claim_id: claimId, actor_name: null, action: 'document_deleted', field: 'documents', old_value: doc?.file_name || null, new_value: null });
    await load();
  };
  return { docs, loading, add, remove, refetch: load };
}

export function useClaimAppeal(claimId: string) {
  const [appeal, setAppeal] = useState<Appeal | null>(null);
  const [loading, setLoading] = useState(true);
  const load = useCallback(async () => {
    setLoading(true);
    const { data } = await supabase.from('claim_appeals').select('*').eq('claim_id', claimId).order('created_at', { ascending: false }).limit(1).maybeSingle();
    setAppeal((data as any) || null);
    setLoading(false);
  }, [claimId]);
  useEffect(() => { load(); }, [load]);
  const upsert = async (partial: Partial<Appeal>) => {
    const { data: userRes } = await supabase.auth.getUser();
    if (appeal?.id) {
      await supabase.from('claim_appeals').update(partial as any).eq('id', appeal.id);
    } else {
      await supabase.from('claim_appeals').insert({ ...partial, claim_id: claimId, created_by: userRes?.user?.id ?? null } as any);
    }
    await logClaimAudit({ claim_id: claimId, actor_name: null, action: 'appeal_updated', field: 'appeal', old_value: appeal?.status ?? null, new_value: (partial.status as string) ?? null });
    await load();
  };
  return { appeal, loading, upsert, refetch: load };
}

export function useClaimAudit(claimId: string) {
  const [entries, setEntries] = useState<AuditEntry[]>([]);
  const [loading, setLoading] = useState(true);
  const load = useCallback(async () => {
    setLoading(true);
    const { data } = await supabase.from('claim_audit_log').select('*').eq('claim_id', claimId).order('created_at', { ascending: false }).limit(200);
    setEntries((data || []) as any);
    setLoading(false);
  }, [claimId]);
  useEffect(() => { load(); }, [load]);
  return { entries, loading, refetch: load };
}

export async function updateClaimField(
  claimId: string,
  field: string,
  newValue: any,
  oldValue: any,
  reason?: string,
) {
  const { error } = await supabase.from('claims_submissions').update({ [field]: newValue, updated_at: new Date().toISOString() }).eq('id', claimId);
  if (error) throw error;
  await logClaimAudit({
    claim_id: claimId,
    actor_name: null,
    action: 'field_updated',
    field,
    old_value: oldValue == null ? null : String(oldValue),
    new_value: newValue == null ? null : String(newValue),
    reason: reason ?? null,
  });
}
