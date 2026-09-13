import React, { useMemo, useRef, useState } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { Badge } from '@/components/ui/badge';
import { Loader2, Upload } from 'lucide-react';
import { toast } from 'sonner';
import { supabase } from '@/integrations/supabase/client';

interface ParsedRow {
  name: string;
  phone: string;
  email: string;
  reg: string;
  valid: boolean;
}

interface ImportResult {
  batchLabel: string;
  imported: number;
  received: number;
  skipped: { row: number; name: string; phone: string; reason: string }[];
}

const splitCells = (line: string): string[] => {
  const separator = line.includes('\t') ? '\t' : line.includes(';') ? ';' : ',';
  return line.split(separator).map((c) => c.trim().replace(/^"|"$/g, ''));
};

const isUkMobile = (raw: string): boolean => {
  let digits = raw.replace(/[^\d]/g, '');
  if (digits.startsWith('0044')) digits = digits.slice(2);
  if (digits.startsWith('44')) digits = `0${digits.slice(2)}`;
  if (digits.startsWith('7') && digits.length === 10) digits = `0${digits}`;
  return /^07\d{9}$/.test(digits);
};

/** Reads pasted or uploaded rows of name + mobile number into a clean list. */
const parseText = (text: string): ParsedRow[] => {
  const lines = text
    .split(/\r?\n/)
    .map((l) => l.trim())
    .filter(Boolean);
  if (!lines.length) return [];

  let index = { name: 0, phone: 1, email: 2, reg: 3 };
  const headerCells = splitCells(lines[0]).map((c) => c.toLowerCase());
  const looksLikeHeader = headerCells.some((c) =>
    ['name', 'phone', 'mobile', 'number', 'email', 'reg', 'registration'].includes(c),
  );

  let body = lines;
  if (looksLikeHeader) {
    body = lines.slice(1);
    const find = (...keys: string[]) => headerCells.findIndex((c) => keys.includes(c));
    index = {
      name: find('name', 'full name', 'customer', 'first name'),
      phone: find('phone', 'mobile', 'number', 'phone number', 'mobile number', 'whatsapp'),
      email: find('email', 'email address'),
      reg: find('reg', 'registration', 'vehicle reg', 'plate'),
    };
  }

  return body.map((line) => {
    const cells = splitCells(line);
    const pick = (i: number) => (i >= 0 && cells[i] ? cells[i] : '');
    let phone = pick(index.phone);
    let name = pick(index.name);
    // Single-column lists of numbers, or a name/number pair in either order.
    if (!phone && cells.length === 1) phone = cells[0];
    if (phone && !isUkMobile(phone) && isUkMobile(name)) {
      const swap = phone;
      phone = name;
      name = swap;
    }
    return {
      name,
      phone,
      email: pick(index.email),
      reg: pick(index.reg),
      valid: isUkMobile(phone),
    };
  });
};

interface Props {
  defaultTemplate?: string;
  onImported?: () => void;
}

/** Management tool: import a batch of leads and send them the default WhatsApp message. */
const WhatsAppLeadImport: React.FC<Props> = ({ defaultTemplate, onImported }) => {
  const [text, setText] = useState('');
  const [template, setTemplate] = useState(defaultTemplate ?? '');
  const [label, setLabel] = useState('');
  const [busy, setBusy] = useState(false);
  const [result, setResult] = useState<ImportResult | null>(null);
  const fileRef = useRef<HTMLInputElement>(null);

  const rows = useMemo(() => parseText(text), [text]);
  const ready = rows.filter((r) => r.valid);
  const unusable = rows.filter((r) => !r.valid);

  const handleFile = async (file: File) => {
    const content = await file.text();
    setText(content);
    setResult(null);
    if (!label) setLabel(file.name.replace(/\.[^.]+$/, ''));
  };

  const handleImport = async () => {
    if (!ready.length) return;
    setBusy(true);
    setResult(null);
    const { data, error } = await supabase.functions.invoke('wati-import-leads', {
      body: {
        rows: ready.map(({ name, phone, email, reg }) => ({ name, phone, email, reg })),
        templateName: template.trim() || undefined,
        batchLabel: label.trim() || undefined,
      },
    });
    setBusy(false);

    if (error || !data?.ok) {
      const reason = (data as any)?.error;
      toast.error(
        reason === 'forbidden'
          ? 'Only managers can import leads.'
          : reason === 'template_required'
            ? 'Add the WhatsApp template name first.'
            : 'The import could not be completed. Nothing was sent.',
      );
      return;
    }

    setResult(data as ImportResult);
    setText('');
    if (fileRef.current) fileRef.current.value = '';
    toast.success(
      `${data.imported} lead${data.imported === 1 ? '' : 's'} imported and being messaged.`,
    );
    onImported?.();
  };

  return (
    <Card>
      <CardHeader className="pb-3">
        <CardTitle className="text-base">Import a batch of leads and message them</CardTitle>
      </CardHeader>
      <CardContent className="space-y-4">
        <p className="text-sm text-muted-foreground">
          Paste rows or upload a CSV with a name and mobile number (email and registration are
          optional). Each new number gets the WhatsApp message straight away and appears in New
          Leads and here as a conversation. Numbers already on file are left alone.
        </p>

        <div className="flex flex-col gap-2 sm:flex-row sm:items-end">
          <div className="flex-1 space-y-1">
            <Label htmlFor="wa-import-template">WhatsApp template name</Label>
            <Input
              id="wa-import-template"
              value={template}
              onChange={(e) => setTemplate(e.target.value)}
              placeholder={defaultTemplate || 'james_hi'}
            />
          </div>
          <div className="flex-1 space-y-1">
            <Label htmlFor="wa-import-label">Batch name (optional)</Label>
            <Input
              id="wa-import-label"
              value={label}
              onChange={(e) => setLabel(e.target.value)}
              placeholder="September car show list"
            />
          </div>
        </div>

        <div className="space-y-1">
          <Label htmlFor="wa-import-rows">Leads</Label>
          <Textarea
            id="wa-import-rows"
            value={text}
            onChange={(e) => {
              setText(e.target.value);
              setResult(null);
            }}
            rows={6}
            placeholder={'Name, Mobile, Email, Reg\nJane Smith, 07700 900123, jane@example.com, AB12CDE'}
          />
        </div>

        <div className="flex flex-wrap items-center gap-2">
          <input
            ref={fileRef}
            type="file"
            accept=".csv,.txt,text/csv,text/plain"
            className="hidden"
            onChange={(e) => {
              const file = e.target.files?.[0];
              if (file) void handleFile(file);
            }}
          />
          <Button variant="outline" onClick={() => fileRef.current?.click()} disabled={busy}>
            <Upload className="mr-2 h-4 w-4" /> Upload CSV
          </Button>
          <Button onClick={() => void handleImport()} disabled={busy || !ready.length}>
            {busy && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
            Import and message {ready.length > 0 ? `${ready.length}` : ''}
          </Button>
          {rows.length > 0 && (
            <>
              <Badge variant="secondary">Ready to message: {ready.length}</Badge>
              {unusable.length > 0 && (
                <Badge variant="destructive">Unusable numbers: {unusable.length}</Badge>
              )}
            </>
          )}
        </div>

        {unusable.length > 0 && (
          <p className="text-sm text-muted-foreground">
            These rows have no UK mobile number and will be left out:{' '}
            {unusable
              .slice(0, 5)
              .map((r) => `${r.name || 'no name'} (${r.phone || 'blank'})`)
              .join(', ')}
            {unusable.length > 5 ? ` and ${unusable.length - 5} more` : ''}.
          </p>
        )}

        {result && (
          <div className="space-y-2 rounded-md border border-border bg-muted/40 p-3 text-sm">
            <p className="font-medium">
              {result.batchLabel}: {result.imported} of {result.received} imported and being
              messaged.
            </p>
            {result.skipped.length > 0 && (
              <div className="max-h-40 space-y-1 overflow-y-auto">
                {result.skipped.map((s) => (
                  <p key={`${s.row}-${s.phone}`} className="text-muted-foreground">
                    Row {s.row} {s.name ? `- ${s.name} ` : ''}({s.phone || 'no number'}): {s.reason}
                  </p>
                ))}
              </div>
            )}
          </div>
        )}
      </CardContent>
    </Card>
  );
};

export default WhatsAppLeadImport;
