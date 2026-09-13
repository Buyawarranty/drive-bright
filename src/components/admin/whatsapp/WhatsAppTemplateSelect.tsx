import React, { useEffect, useState } from 'react';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { supabase } from '@/integrations/supabase/client';

export interface WatiTemplate {
  name: string;
  language: string;
  status: string;
  body: string;
}

interface Props {
  value: string;
  onChange: (name: string) => void;
  label?: string;
  id?: string;
}

/** Dropdown of the approved WATI templates, with a typed fallback if WATI is unreachable. */
const WhatsAppTemplateSelect: React.FC<Props> = ({
  value,
  onChange,
  label = 'WhatsApp message template',
  id = 'wa-template-select',
}) => {
  const [templates, setTemplates] = useState<WatiTemplate[]>([]);
  const [loading, setLoading] = useState(true);
  const [failed, setFailed] = useState(false);

  useEffect(() => {
    void (async () => {
      const { data, error } = await supabase.functions.invoke('wati-templates', { body: {} });
      setLoading(false);
      if (error || !data?.ok || !Array.isArray(data.templates) || data.templates.length === 0) {
        setFailed(true);
        return;
      }
      const approved = (data.templates as WatiTemplate[]).filter(
        (t) => t.status === 'APPROVED' || t.status === 'UNKNOWN',
      );
      setTemplates(approved.length ? approved : (data.templates as WatiTemplate[]));
    })();
  }, []);

  const chosen = templates.find((t) => t.name === value);

  if (failed) {
    return (
      <div className="space-y-1">
        <Label htmlFor={id}>{label}</Label>
        <Input id={id} value={value} onChange={(e) => onChange(e.target.value)} placeholder="james_hi" />
        <p className="text-xs text-muted-foreground">
          Your template list could not be loaded, so type the template name exactly as it appears in
          WhatsApp.
        </p>
      </div>
    );
  }

  return (
    <div className="space-y-1">
      <Label htmlFor={id}>{label}</Label>
      <Select value={value} onValueChange={onChange} disabled={loading}>
        <SelectTrigger id={id}>
          <SelectValue placeholder={loading ? 'Loading your templates...' : 'Choose a template'} />
        </SelectTrigger>
        <SelectContent className="max-h-72">
          {templates.map((t) => (
            <SelectItem key={t.name} value={t.name}>
              {t.name}
            </SelectItem>
          ))}
        </SelectContent>
      </Select>
      {chosen?.body && (
        <p className="line-clamp-2 text-xs text-muted-foreground">{chosen.body}</p>
      )}
    </div>
  );
};

export default WhatsAppTemplateSelect;
