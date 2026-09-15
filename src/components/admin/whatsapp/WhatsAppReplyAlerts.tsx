import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { MessageCircle, X } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { supabase } from '@/integrations/supabase/client';
import { useRealAdminId } from '@/hooks/useCurrentAdminId';

interface ReplyAlert {
  message_id: string;
  conversation_id: string;
  lead_id: string | null;
  customer_name: string;
  phone: string;
  message_preview: string;
  replied_at: string;
}

const POLL_MS = 15000;

export const WhatsAppReplyAlerts = () => {
  const adminId = useRealAdminId();
  const [replies, setReplies] = useState<ReplyAlert[]>([]);
  const dismissedRef = useRef<Set<string>>(new Set());
  const storageKey = adminId ? `whatsapp_reply_notifications_seen:${adminId}` : null;

  useEffect(() => {
    if (!storageKey) return;
    try {
      const saved = JSON.parse(localStorage.getItem(storageKey) || '[]');
      dismissedRef.current = new Set(Array.isArray(saved) ? saved : []);
    } catch {
      dismissedRef.current = new Set();
    }
  }, [storageKey]);

  const load = useCallback(async () => {
    if (!adminId || document.hidden) return;
    const since = new Date(Date.now() - 24 * 60 * 60 * 1000).toISOString();
    const { data, error } = await supabase.rpc('get_whatsapp_reply_notifications', {
      _since: since,
    });
    if (error) {
      console.error('Could not load WhatsApp reply notifications:', error.message);
      return;
    }
    const visible = ((data || []) as ReplyAlert[]).filter(
      (reply) => !dismissedRef.current.has(reply.message_id),
    );
    setReplies(visible);
  }, [adminId]);

  useEffect(() => {
    if (!adminId) return;
    void load();
    const timer = window.setInterval(() => void load(), POLL_MS);
    const onVisible = () => {
      if (!document.hidden) void load();
    };
    document.addEventListener('visibilitychange', onVisible);
    return () => {
      window.clearInterval(timer);
      document.removeEventListener('visibilitychange', onVisible);
    };
  }, [adminId, load]);

  const visible = useMemo(() => replies.slice(0, 3), [replies]);
  const [opened, setOpened] = useState<Set<string>>(new Set());

  const markOpened = (messageId: string) => {
    setOpened((current) => {
      if (current.has(messageId)) return current;
      const next = new Set(current);
      next.add(messageId);
      return next;
    });
  };

  const dismiss = (messageId: string) => {
    dismissedRef.current.add(messageId);
    const recent = [...dismissedRef.current].slice(-500);
    dismissedRef.current = new Set(recent);
    if (storageKey) localStorage.setItem(storageKey, JSON.stringify(recent));
    setReplies((current) => current.filter((reply) => reply.message_id !== messageId));
  };

  const openLead = (reply: ReplyAlert) => {
    markOpened(reply.message_id);
    dismiss(reply.message_id);
    const query = encodeURIComponent(reply.phone || reply.customer_name);
    window.location.href = `/admin-dashboard/?tab=new-leads&q=${query}`;
  };

  if (!adminId || visible.length === 0) return null;

  const unreadNumbers = new Map<string, number>();
  visible.forEach((reply) => {
    if (!opened.has(reply.message_id)) {
      unreadNumbers.set(reply.message_id, unreadNumbers.size + 1);
    }
  });

  return (
    <section aria-label="WhatsApp reply notifications" className="space-y-2">
        {visible.map((reply) => (
          <div
            key={reply.message_id}
            onClick={() => markOpened(reply.message_id)}
            className={`relative rounded-lg border-2 bg-whatsapp p-3 text-whatsapp-foreground shadow-sm ${
              opened.has(reply.message_id) ? 'border-whatsapp-foreground/25' : 'border-destructive'
            }`}
          >
            {!opened.has(reply.message_id) && (
              <Badge
                aria-label={`Unread WhatsApp reply ${unreadNumbers.get(reply.message_id)}`}
                className="absolute -right-2 -top-2 flex h-6 min-w-6 items-center justify-center rounded-full border-2 border-background bg-destructive px-1.5 text-xs font-bold text-destructive-foreground shadow-sm"
              >
                {unreadNumbers.get(reply.message_id)}
              </Badge>
            )}
            <div className="flex items-start gap-2">
              <MessageCircle className="mt-0.5 h-4 w-4 shrink-0" />
              <div className="min-w-0 flex-1">
                <p className="text-sm font-bold text-whatsapp-foreground">
                  New WhatsApp reply from {reply.customer_name || reply.phone}
                </p>
                <p className="mt-1 line-clamp-3 text-xs text-whatsapp-foreground/90">
                  {reply.message_preview}
                </p>
                <p className="mt-1 text-[11px] text-whatsapp-foreground/75">
                  {new Date(reply.replied_at).toLocaleTimeString('en-GB', {
                    hour: '2-digit',
                    minute: '2-digit',
                  })}
                </p>
              </div>
              <Button
                type="button"
                variant="ghost"
                size="icon"
                aria-label="Dismiss WhatsApp reply"
                onClick={() => dismiss(reply.message_id)}
                className="mr-2 h-7 w-7 shrink-0 text-whatsapp-foreground hover:bg-whatsapp-foreground/15 hover:text-whatsapp-foreground"
              >
                <X className="h-4 w-4" />
              </Button>
            </div>
            <Button
              size="sm"
              variant="secondary"
              className="mt-2 h-8 w-full text-xs font-semibold"
              onClick={() => openLead(reply)}
            >
              Open lead and reply
            </Button>
          </div>
        ))}
    </section>
  );
};

export default WhatsAppReplyAlerts;