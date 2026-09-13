import React, { useEffect, useState } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Switch } from '@/components/ui/switch';
import { Textarea } from '@/components/ui/textarea';
import { Checkbox } from '@/components/ui/checkbox';
import { Loader2 } from 'lucide-react';
import { toast } from 'sonner';
import { supabase } from '@/integrations/supabase/client';

interface AwaySettings {
  id: string;
  away_reply_enabled: boolean;
  away_reply_text: string;
  office_open_time: string;
  office_close_time: string;
  away_weekends_closed: boolean;
}

const trimTime = (t: string) => (t || '').slice(0, 5);

/** Management tool: automatic WhatsApp reply when someone messages outside opening hours. */
const WhatsAppAwayReply: React.FC = () => {
  const [settings, setSettings] = useState<AwaySettings | null>(null);
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    void (async () => {
      const { data } = await supabase
        .from('whatsapp_auto_message_settings')
        .select('id, away_reply_enabled, away_reply_text, office_open_time, office_close_time, away_weekends_closed')
        .limit(1)
        .maybeSingle();
      if (data) {
        setSettings({
          ...(data as AwaySettings),
          office_open_time: trimTime((data as AwaySettings).office_open_time),
          office_close_time: trimTime((data as AwaySettings).office_close_time),
        });
      }
    })();
  }, []);

  const save = async (patch: Partial<AwaySettings>, message: string) => {
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
    setSettings({ ...settings, ...patch });
    toast.success(message);
  };

  if (!settings) return null;

  return (
    <Card>
      <CardHeader className="pb-3">
        <CardTitle className="text-base">Out-of-hours reply</CardTitle>
      </CardHeader>
      <CardContent className="space-y-4">
        <div className="flex items-center justify-between gap-3 rounded-md border p-3">
          <div>
            <p className="text-sm font-medium">Reply automatically when we're closed</p>
            <p className="text-xs text-muted-foreground">
              Each customer gets this once a day, so nobody is left without an answer.
            </p>
          </div>
          <div className="flex items-center gap-2">
            {saving && <Loader2 className="h-4 w-4 animate-spin text-muted-foreground" />}
            <Switch
              checked={settings.away_reply_enabled}
              onCheckedChange={(v) =>
                save(
                  { away_reply_enabled: v },
                  v ? 'Out-of-hours reply switched on.' : 'Out-of-hours reply switched off.',
                )
              }
            />
          </div>
        </div>

        <div className="grid gap-3 sm:grid-cols-2">
          <div className="space-y-1">
            <Label htmlFor="wa-open">We open at</Label>
            <Input
              id="wa-open"
              type="time"
              value={settings.office_open_time}
              onChange={(e) => setSettings({ ...settings, office_open_time: e.target.value })}
            />
          </div>
          <div className="space-y-1">
            <Label htmlFor="wa-close">We close at</Label>
            <Input
              id="wa-close"
              type="time"
              value={settings.office_close_time}
              onChange={(e) => setSettings({ ...settings, office_close_time: e.target.value })}
            />
          </div>
        </div>

        <label className="flex items-center gap-2 text-sm">
          <Checkbox
            checked={settings.away_weekends_closed}
            onCheckedChange={(v) => setSettings({ ...settings, away_weekends_closed: v === true })}
          />
          Treat Saturday and Sunday as closed
        </label>

        <div className="space-y-1">
          <Label htmlFor="wa-away-text">Message we send</Label>
          <Textarea
            id="wa-away-text"
            rows={3}
            maxLength={800}
            value={settings.away_reply_text}
            onChange={(e) => setSettings({ ...settings, away_reply_text: e.target.value })}
          />
        </div>

        <Button
          size="sm"
          disabled={saving || !settings.away_reply_text.trim()}
          onClick={() =>
            save(
              {
                away_reply_text: settings.away_reply_text.trim(),
                office_open_time: settings.office_open_time,
                office_close_time: settings.office_close_time,
                away_weekends_closed: settings.away_weekends_closed,
              },
              'Out-of-hours reply saved.',
            )
          }
        >
          Save
        </Button>
      </CardContent>
    </Card>
  );
};

export default WhatsAppAwayReply;
