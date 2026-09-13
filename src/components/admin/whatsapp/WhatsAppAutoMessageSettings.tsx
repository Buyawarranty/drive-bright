import React, { useEffect, useState } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Switch } from '@/components/ui/switch';
import { Input } from '@/components/ui/input';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Label } from '@/components/ui/label';
import { toast } from 'sonner';
import { supabase } from '@/integrations/supabase/client';

interface Settings {
  id: string;
  is_enabled: boolean;
  template_name: string;
  template_language: string;
}

interface Counts {
  pending: number;
  sent: number;
  failed: number;
}

/** Management control for the automatic first WhatsApp message sent to new leads. */
const WhatsAppAutoMessageSettings: React.FC = () => {
  const [settings, setSettings] = useState<Settings | null>(null);
  const [template, setTemplate] = useState('');
  const [counts, setCounts] = useState<Counts>({ pending: 0, sent: 0, failed: 0 });
  const [saving, setSaving] = useState(false);
  const [lastError, setLastError] = useState<string | null>(null);

  const load = async () => {
    const { data } = await supabase
      .from('whatsapp_auto_message_settings')
      .select('id, is_enabled, template_name, template_language')
      .limit(1)
      .maybeSingle();
    if (data) {
      setSettings(data as Settings);
      setTemplate(data.template_name);
    }

    const { data: rows } = await supabase
      .from('whatsapp_auto_message_queue')
      .select('status, last_error')
      .order('created_at', { ascending: false })
      .limit(500);

    if (rows) {
      setCounts({
        pending: rows.filter((r) => r.status === 'pending').length,
        sent: rows.filter((r) => r.status === 'sent').length,
        failed: rows.filter((r) => r.status === 'failed').length,
      });
      setLastError(rows.find((r) => r.status === 'failed' && r.last_error)?.last_error ?? null);
    }
  };

  useEffect(() => {
    void load();
  }, []);

  const save = async (patch: Partial<Settings>) => {
    if (!settings) return;
    setSaving(true);
    const { error } = await supabase
      .from('whatsapp_auto_message_settings')
      .update(patch)
      .eq('id', settings.id);
    setSaving(false);
    if (error) {
      toast.error('Could not save that change.');
      return;
    }
    setSettings({ ...settings, ...patch } as Settings);
    toast.success('Saved');
    void load();
  };

  if (!settings) return null;

  return (
    <Card>
      <CardHeader className="pb-3">
        <CardTitle className="text-base">Automatic WhatsApp message to new leads</CardTitle>
      </CardHeader>
      <CardContent className="space-y-4">
        <div className="flex items-center justify-between gap-4">
          <Label htmlFor="wa-auto-toggle" className="font-medium">
            Message every new lead with a mobile number
          </Label>
          <Switch
            id="wa-auto-toggle"
            checked={settings.is_enabled}
            disabled={saving}
            onCheckedChange={(v) => void save({ is_enabled: v })}
          />
        </div>

        <div className="flex flex-col gap-2 sm:flex-row sm:items-end">
          <div className="flex-1 space-y-1">
            <Label htmlFor="wa-template">WhatsApp template name</Label>
            <Input
              id="wa-template"
              value={template}
              onChange={(e) => setTemplate(e.target.value)}
              placeholder="james_hi"
            />
          </div>
          <Button
            variant="outline"
            disabled={saving || !template.trim() || template.trim() === settings.template_name}
            onClick={() => void save({ template_name: template.trim() })}
          >
            Update template
          </Button>
        </div>

        <div className="flex flex-wrap items-center gap-2">
          <Badge variant="secondary">Waiting to send: {counts.pending}</Badge>
          <Badge variant="secondary">Sent: {counts.sent}</Badge>
          <Badge variant={counts.failed ? 'destructive' : 'secondary'}>
            Not delivered: {counts.failed}
          </Badge>
        </div>

        {lastError && (
          <p className="text-sm text-muted-foreground">Last problem reported: {lastError}</p>
        )}
      </CardContent>
    </Card>
  );
};

export default WhatsAppAutoMessageSettings;
