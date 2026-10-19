import { useEffect, useState } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { useIsManagement } from '@/hooks/useIsManagement';
import { Switch } from '@/components/ui/switch';
import { toast } from 'sonner';

export default function LiveChatMasterControl() {
  const { isManagement } = useIsManagement();
  const [enabled, setEnabled] = useState(false);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  useEffect(() => {
    let active = true;
    void supabase.functions.invoke('chat-agent-availability', { body: {} }).then(({ data, error }) => {
      if (!active) return;
      setEnabled(!error && data?.enabled === true);
      setLoading(false);
    });
    return () => { active = false; };
  }, []);
  const change = async (next: boolean) => {
    setSaving(true);
    const { data, error } = await supabase.functions.invoke('chat-agent-availability', { body: { action: 'set_enabled', enabled: next } });
    setSaving(false);
    if (error || data?.enabled !== next) { toast.error('Could not change live chat. Please try again.'); return; }
    setEnabled(next);
    toast.success(next ? 'Live chat enabled when a specialist is available' : 'Live chat off — callbacks and WhatsApp remain available');
  };
  return <div className="flex flex-wrap items-center gap-4 border-y border-border py-4">
    <div className="flex-1"><label htmlFor="live-chat-main" className="font-semibold">Speak to someone · live chat {enabled ? 'on' : 'off'}</label>
      <p className="text-sm text-muted-foreground">{enabled ? 'Live requests require an available specialist.' : 'Customers can request a callback, call during sales hours or WhatsApp us.'}</p></div>
    {isManagement && <Switch id="live-chat-main" checked={enabled} onCheckedChange={change} disabled={loading || saving} aria-label="Enable live-person chat" />}
  </div>;
}
