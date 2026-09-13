import { useCallback, useEffect, useState } from 'react';
import { supabase } from '@/integrations/supabase/client';

export interface WhatsAppMessage {
  id: string;
  conversation_id: string;
  wati_message_id: string | null;
  direction: string;
  body: string | null;
  media_url: string | null;
  media_type: string | null;
  status: string | null;
  sent_by_admin_id: string | null;
  wati_timestamp: string | null;
  created_at: string;
}

/** Live message thread for one conversation, plus sending a reply via WATI. */
export function useWhatsAppMessages(conversationId: string | null) {
  const [messages, setMessages] = useState<WhatsAppMessage[]>([]);
  const [loading, setLoading] = useState(false);
  const [sending, setSending] = useState(false);

  const load = useCallback(async () => {
    if (!conversationId) {
      setMessages([]);
      return;
    }
    setLoading(true);
    const { data } = await supabase
      .from('whatsapp_messages')
      .select('id, conversation_id, wati_message_id, direction, body, media_url, media_type, status, sent_by_admin_id, wati_timestamp, created_at')
      .eq('conversation_id', conversationId)
      .order('created_at', { ascending: true })
      .limit(500);
    setMessages((data || []) as WhatsAppMessage[]);
    setLoading(false);
  }, [conversationId]);

  useEffect(() => {
    void load();
    if (!conversationId) return;
    const channel = supabase
      .channel(`whatsapp-messages-${conversationId}`)
      .on(
        'postgres_changes',
        { event: '*', schema: 'public', table: 'whatsapp_messages', filter: `conversation_id=eq.${conversationId}` },
        (payload) => {
          const row = payload.new as WhatsAppMessage | null;
          if (!row?.id) return;
          setMessages((prev) => {
            const idx = prev.findIndex((m) => m.id === row.id);
            if (idx === -1) return [...prev, row];
            const copy = [...prev];
            copy[idx] = { ...copy[idx], ...row };
            return copy;
          });
        },
      )
      .subscribe();
    return () => {
      supabase.removeChannel(channel);
    };
  }, [conversationId, load]);

  const sendMessage = useCallback(
    async (text: string) => {
      if (!conversationId || !text.trim()) return { ok: false as const, reason: 'empty' };
      setSending(true);
      try {
        const { data, error } = await supabase.functions.invoke('wati-send-message', {
          body: { conversationId, message: text.trim() },
        });
        if (error) {
          let details = error.message;
          const ctx = (error as { context?: { text?: () => Promise<string> } }).context;
          if (ctx?.text) {
            try {
              details = await ctx.text();
            } catch {
              /* keep the original message */
            }
          }
          console.error('wati-send-message failed:', details);
          return { ok: false as const, reason: details };
        }
        await load();
        return { ok: true as const, data };
      } finally {
        setSending(false);
      }
    },
    [conversationId, load],
  );

  return { messages, loading, sending, sendMessage, reload: load };
}
