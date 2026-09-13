import { useCallback, useEffect, useMemo, useState } from 'react';
import { toast } from 'sonner';
import { supabase } from '@/integrations/supabase/client';

export interface WhatsAppTag {
  id: string;
  name: string;
  color: string;
  sort_order: number;
  is_active: boolean;
}

/** Colour classes per tag colour, all built from theme tokens where possible. */
export const tagChipClass = (color: string): string => {
  switch (color) {
    case 'red':
      return 'bg-destructive text-destructive-foreground border-transparent';
    case 'orange':
      return 'bg-primary text-primary-foreground border-transparent';
    case 'blue':
      return 'bg-sky-600 text-white border-transparent';
    case 'green':
      return 'bg-emerald-600 text-white border-transparent';
    case 'teal':
      return 'bg-teal-600 text-white border-transparent';
    case 'amber':
      return 'bg-amber-500 text-white border-transparent';
    case 'rose':
      return 'bg-rose-600 text-white border-transparent';
    case 'violet':
      return 'bg-violet-600 text-white border-transparent';
    default:
      return 'bg-muted text-foreground border-border';
  }
};

/** The master list of WhatsApp tags. */
export const useWhatsAppTagList = () => {
  const [tags, setTags] = useState<WhatsAppTag[]>([]);
  const [loading, setLoading] = useState(true);

  const load = useCallback(async () => {
    const { data, error } = await supabase
      .from('whatsapp_tags')
      .select('id, name, color, sort_order, is_active')
      .eq('is_active', true)
      .order('sort_order', { ascending: true });
    setLoading(false);
    if (!error) setTags((data || []) as WhatsAppTag[]);
  }, []);

  useEffect(() => {
    void load();
  }, [load]);

  return { tags, loading, reload: load };
};

/** Tags currently on one conversation, with add/remove. */
export const useConversationTags = (conversationId: string | null) => {
  const [tagIds, setTagIds] = useState<string[]>([]);
  const [saving, setSaving] = useState(false);

  const load = useCallback(async () => {
    if (!conversationId) {
      setTagIds([]);
      return;
    }
    const { data } = await supabase
      .from('whatsapp_conversation_tags')
      .select('tag_id')
      .eq('conversation_id', conversationId);
    setTagIds((data || []).map((r: { tag_id: string }) => r.tag_id));
  }, [conversationId]);

  useEffect(() => {
    void load();
  }, [load]);

  const toggleTag = useCallback(
    async (tagId: string) => {
      if (!conversationId) return;
      const isOn = tagIds.includes(tagId);
      setSaving(true);
      setTagIds((prev) => (isOn ? prev.filter((id) => id !== tagId) : [...prev, tagId]));

      const { data: authData } = await supabase.auth.getUser();
      const error = isOn
        ? (
            await supabase
              .from('whatsapp_conversation_tags')
              .delete()
              .eq('conversation_id', conversationId)
              .eq('tag_id', tagId)
          ).error
        : (
            await supabase.from('whatsapp_conversation_tags').insert({
              conversation_id: conversationId,
              tag_id: tagId,
              created_by: authData?.user?.id ?? null,
            })
          ).error;

      setSaving(false);
      if (error) {
        toast.error('That tag could not be saved.');
        void load();
      }
    },
    [conversationId, tagIds, load],
  );

  return { tagIds, toggleTag, saving, reload: load };
};

/** Tags for a set of conversations, so the list can show chips. */
export const useTagsByConversation = (conversationIds: string[]) => {
  const key = useMemo(() => [...conversationIds].sort().join(','), [conversationIds]);
  const [map, setMap] = useState<Record<string, string[]>>({});

  useEffect(() => {
    const ids = key ? key.split(',') : [];
    if (!ids.length) {
      setMap({});
      return;
    }
    let cancelled = false;
    void (async () => {
      const { data } = await supabase
        .from('whatsapp_conversation_tags')
        .select('conversation_id, tag_id')
        .in('conversation_id', ids.slice(0, 500));
      if (cancelled) return;
      const next: Record<string, string[]> = {};
      for (const row of (data || []) as { conversation_id: string; tag_id: string }[]) {
        next[row.conversation_id] = [...(next[row.conversation_id] || []), row.tag_id];
      }
      setMap(next);
    })();
    return () => {
      cancelled = true;
    };
  }, [key]);

  return map;
};
