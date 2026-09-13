import { useCallback, useEffect, useMemo, useState } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { heatRank } from '@/lib/whatsappHeat';

export interface WhatsAppConversation {
  id: string;
  phone: string;
  phone_normalized: string;
  display_name: string | null;
  lead_id: string | null;
  customer_id: string | null;
  assigned_to: string | null;
  claimed_by: string | null;
  claimed_at: string | null;
  heat: string;
  heat_reason: string | null;
  pipeline_status: string;
  unread_count: number;
  last_message_at: string | null;
  last_message_preview: string | null;
  last_direction: string | null;
  last_agent_reply_at: string | null;
  first_response_seconds: number | null;
  next_follow_up_at: string | null;
  lead_source: string | null;
  is_open: boolean;
  opted_out_at: string | null;
  opt_out_reason: string | null;
  created_at: string;
}

const SELECT =
  'id, phone, phone_normalized, display_name, lead_id, customer_id, assigned_to, claimed_by, claimed_at, heat, heat_reason, pipeline_status, unread_count, last_message_at, last_message_preview, last_direction, last_agent_reply_at, first_response_seconds, next_follow_up_at, lead_source, is_open, opted_out_at, opt_out_reason, created_at';

/** Hottest first, then overdue follow-ups, then the newest customer reply. */
export function sortConversations(rows: WhatsAppConversation[]): WhatsAppConversation[] {
  const now = Date.now();
  return [...rows].sort((a, b) => {
    const aOverdue = a.next_follow_up_at && new Date(a.next_follow_up_at).getTime() < now ? 0 : 1;
    const bOverdue = b.next_follow_up_at && new Date(b.next_follow_up_at).getTime() < now ? 0 : 1;
    if (aOverdue !== bOverdue) return aOverdue - bOverdue;
    const heat = heatRank(a.heat) - heatRank(b.heat);
    if (heat !== 0) return heat;
    const at = a.last_message_at ? new Date(a.last_message_at).getTime() : 0;
    const bt = b.last_message_at ? new Date(b.last_message_at).getTime() : 0;
    return bt - at;
  });
}

/** Live list of WhatsApp conversations, updated over realtime with no refresh. */
export function useWhatsAppConversations() {
  const [rows, setRows] = useState<WhatsAppConversation[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const load = useCallback(async () => {
    const { data, error } = await supabase
      .from('whatsapp_conversations')
      .select(SELECT)
      .order('last_message_at', { ascending: false, nullsFirst: false })
      .limit(500);
    if (error) setError(error.message);
    else {
      setError(null);
      setRows((data || []) as WhatsAppConversation[]);
    }
    setLoading(false);
  }, []);

  useEffect(() => {
    void load();
    const channel = supabase
      .channel('whatsapp-conversations-live')
      .on('postgres_changes', { event: '*', schema: 'public', table: 'whatsapp_conversations' }, (payload) => {
        setRows((prev) => {
          const next = payload.new as WhatsAppConversation | null;
          if (payload.eventType === 'DELETE') {
            const oldId = (payload.old as { id?: string })?.id;
            return prev.filter((r) => r.id !== oldId);
          }
          if (!next?.id) return prev;
          const idx = prev.findIndex((r) => r.id === next.id);
          if (idx === -1) return [next, ...prev];
          const copy = [...prev];
          copy[idx] = { ...copy[idx], ...next };
          return copy;
        });
      })
      .subscribe();
    return () => {
      supabase.removeChannel(channel);
    };
  }, [load]);

  const sorted = useMemo(() => sortConversations(rows), [rows]);

  /** First click wins — the database refuses a second claim. */
  const claimLead = useCallback(
    async (conversationId: string, agentId: string) => {
      const { data, error } = await supabase.rpc('claim_whatsapp_conversation', {
        _conversation_id: conversationId,
        _agent_id: agentId,
      });
      if (error) return { ok: false as const, reason: error.message };
      if (!data) return { ok: false as const, reason: 'already_taken' };
      await load();
      return { ok: true as const };
    },
    [load],
  );

  const reassignLead = useCallback(
    async (conversationId: string, agentId: string) => {
      const { error } = await supabase.rpc('reassign_whatsapp_conversation', {
        _conversation_id: conversationId,
        _agent_id: agentId,
      });
      if (error) return { ok: false as const, reason: error.message };
      await load();
      return { ok: true as const };
    },
    [load],
  );

  const setPipelineStatus = useCallback(
    async (conversation: WhatsAppConversation, status: string, changedBy: string | null) => {
      const { error } = await supabase
        .from('whatsapp_conversations')
        .update({
          pipeline_status: status,
          is_open: status !== 'won' && status !== 'lost',
        })
        .eq('id', conversation.id);
      if (error) return { ok: false as const, reason: error.message };
      await supabase.from('whatsapp_status_events').insert({
        conversation_id: conversation.id,
        from_status: conversation.pipeline_status,
        to_status: status,
        changed_by: changedBy,
      });
      return { ok: true as const };
    },
    [],
  );

  const setFollowUp = useCallback(async (conversationId: string, whenIso: string | null) => {
    const { error } = await supabase
      .from('whatsapp_conversations')
      .update({ next_follow_up_at: whenIso })
      .eq('id', conversationId);
    return error ? { ok: false as const, reason: error.message } : { ok: true as const };
  }, []);

  const markRead = useCallback(async (conversationId: string) => {
    await supabase.from('whatsapp_conversations').update({ unread_count: 0 }).eq('id', conversationId);
  }, []);

  return {
    conversations: sorted,
    loading,
    error,
    reload: load,
    claimLead,
    reassignLead,
    setPipelineStatus,
    setFollowUp,
    markRead,
  };
}
