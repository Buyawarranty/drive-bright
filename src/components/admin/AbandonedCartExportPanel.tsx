import React, { useState, useEffect, useMemo } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Checkbox } from '@/components/ui/checkbox';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Badge } from '@/components/ui/badge';
import { toast } from 'sonner';
import { Download, FileSpreadsheet, History, Calendar } from 'lucide-react';
import { format, startOfDay, endOfDay, subDays, startOfWeek, endOfWeek, startOfMonth, endOfMonth, subMonths } from 'date-fns';

type Platform = 'google' | 'google_offline' | 'facebook';
type DatePreset = 'today' | 'yesterday' | 'last7' | 'last30' | 'this_week' | 'this_month' | 'last_month' | 'last90' | 'custom';
type SourceFilter = 'all' | 'google_ad' | 'social_ad' | 'organic';

interface AbandonedCart {
  id: string;
  full_name: string | null;
  email: string;
  phone: string | null;
  created_at: string;
  cart_metadata?: any;
}

// Mirror of public.derive_lead_source SQL function - keeps client/server in sync
export function classifyCartSource(c: { cart_metadata?: any }): 'google_ad' | 'social_ad' | 'organic' {
  const m = c.cart_metadata || {};
  if (m.gclid && String(m.gclid).trim()) return 'google_ad';
  if (m.fbclid && String(m.fbclid).trim()) return 'social_ad';
  return 'organic';
}

const SOURCE_LABELS: Record<Exclude<SourceFilter, 'all'>, string> = {
  google_ad: 'Google Ads',
  social_ad: 'Facebook / Social Ads',
  organic: 'Organic / Direct',
};


interface ExportLog {
  id: string;
  platform: string;
  date_from: string;
  date_to: string;
  cart_count: number;
  exported_by_email: string | null;
  created_at: string;
}

function getPresetRange(preset: DatePreset): { from: Date; to: Date } {
  const now = new Date();
  switch (preset) {
    case 'today': return { from: startOfDay(now), to: endOfDay(now) };
    case 'yesterday': return { from: startOfDay(subDays(now, 1)), to: endOfDay(subDays(now, 1)) };
    case 'last7': return { from: startOfDay(subDays(now, 7)), to: endOfDay(now) };
    case 'last30': return { from: startOfDay(subDays(now, 30)), to: endOfDay(now) };
    case 'last90': return { from: startOfDay(subDays(now, 90)), to: endOfDay(now) };
    case 'this_week': return { from: startOfWeek(now, { weekStartsOn: 1 }), to: endOfWeek(now, { weekStartsOn: 1 }) };
    case 'this_month': return { from: startOfMonth(now), to: endOfMonth(now) };
    case 'last_month': { const lm = subMonths(now, 1); return { from: startOfMonth(lm), to: endOfMonth(lm) }; }
    default: return { from: startOfDay(subDays(now, 7)), to: endOfDay(now) };
  }
}

// Split UK-style full_name into first/last
function splitName(full: string | null): { first: string; last: string } {
  if (!full) return { first: '', last: '' };
  const parts = full.trim().split(/\s+/);
  if (parts.length === 1) return { first: parts[0], last: '' };
  return { first: parts[0], last: parts.slice(1).join(' ') };
}

// Normalise UK phone to E.164 (+44...)
function normalisePhone(p: string | null): string {
  if (!p) return '';
  const digits = p.replace(/[^\d+]/g, '');
  if (digits.startsWith('+')) return digits;
  if (digits.startsWith('44')) return '+' + digits;
  if (digits.startsWith('0')) return '+44' + digits.slice(1);
  return digits ? '+44' + digits : '';
}

function csvEscape(v: string): string {
  if (v == null) return '';
  const s = String(v);
  if (s.includes(',') || s.includes('"') || s.includes('\n')) {
    return '"' + s.replace(/"/g, '""') + '"';
  }
  return s;
}

// Force Excel/Sheets to treat a value as text (prevents +447... → 4.47E+11)
function csvText(v: string): string {
  if (!v) return '';
  // ="value" with internal quotes doubled — Excel parses the formula and stores the literal string
  return '="' + String(v).replace(/"/g, '""') + '"';
}


export function buildAbandonedCartCsv(
  carts: AbandonedCart[],
  platform: Platform,
  options?: { conversionName?: string; defaultValue?: number; timeZone?: string }
): string {
  if (platform === 'google_offline') {
    // Google Ads Offline Conversion Import (gclid-based)
    // https://support.google.com/google-ads/answer/7014069
    const tz = options?.timeZone || 'Europe/London';
    const conversionName = options?.conversionName || 'Abandoned Cart';
    const defaultValue = options?.defaultValue ?? 1;
    const lines: string[] = [];
    lines.push(`Parameters:TimeZone=${tz}`);
    lines.push(['Google Click ID', 'Conversion Name', 'Conversion Time', 'Conversion Value', 'Conversion Currency', 'Ad User Data', 'Ad Personalization'].join(','));
    for (const c of carts) {
      const gclid = c.cart_metadata?.gclid ? String(c.cart_metadata.gclid).trim() : '';
      if (!gclid) continue;
      const d = new Date(c.created_at);
      // Format: YYYY-MM-DD HH:MM:SS+HH:MM (use +00:00; TimeZone parameter handles offset)
      const pad = (n: number) => String(n).padStart(2, '0');
      const convTime = `${d.getUTCFullYear()}-${pad(d.getUTCMonth() + 1)}-${pad(d.getUTCDate())} ${pad(d.getUTCHours())}:${pad(d.getUTCMinutes())}:${pad(d.getUTCSeconds())}+00:00`;
      const value = Number(c.cart_metadata?.total_price) || defaultValue;
      lines.push([
        csvEscape(gclid),
        csvEscape(conversionName),
        csvEscape(convTime),
        csvEscape(String(value)),
        csvEscape('GBP'),
        csvEscape('GRANTED'),
        csvEscape('GRANTED'),
      ].join(','));
    }
    return lines.join('\n');
  }
  // Helper: UK-formatted date + time (e.g. "19/06/2026 20:34")
  const formatAbandonedAt = (iso: string) => {
    if (!iso) return '';
    const d = new Date(iso);
    if (isNaN(d.getTime())) return '';
    const pad = (n: number) => String(n).padStart(2, '0');
    return `${pad(d.getDate())}/${pad(d.getMonth() + 1)}/${d.getFullYear()} ${pad(d.getHours())}:${pad(d.getMinutes())}`;
  };

  if (platform === 'google') {
    // Google Customer Match CSV format (+ trailing Abandoned At column for admin reference)
    const header = ['Email', 'Phone', 'First Name', 'Last Name', 'Country', 'Zip', 'Abandoned At'];
    const rows = carts.map(c => {
      const { first, last } = splitName(c.full_name);
      const zip = c.cart_metadata?.address?.postcode || '';
      const phone = normalisePhone(c.phone);
      return [
        csvEscape((c.email || '').trim().toLowerCase()),
        csvText(phone), // forces Excel to keep +44... as text
        csvEscape(first),
        csvEscape(last),
        csvEscape('GB'),
        csvEscape(zip),
        csvEscape(formatAbandonedAt(c.created_at)),
      ].join(',');
    });
    return [header.join(','), ...rows].join('\n');
  }
  // Facebook Custom Audience CSV format (+ trailing abandoned_at column for admin reference)
  const header = ['email', 'phone', 'fn', 'ln', 'country', 'zip', 'abandoned_at'];
  const rows = carts.map(c => {
    const { first, last } = splitName(c.full_name);
    const zip = c.cart_metadata?.address?.postcode || '';
    const phone = normalisePhone(c.phone);
    return [
      csvEscape((c.email || '').trim().toLowerCase()),
      csvText(phone),
      csvEscape(first.toLowerCase()),
      csvEscape(last.toLowerCase()),
      csvEscape('gb'),
      csvEscape(zip.toLowerCase().replace(/\s+/g, '')),
      csvEscape(formatAbandonedAt(c.created_at)),
    ].join(',');
  });
  return [header.join(','), ...rows].join('\n');
}


export function downloadAbandonedCartCsv(content: string, filename: string) {
  const blob = new Blob([content], { type: 'text/csv;charset=utf-8;' });
  const url = URL.createObjectURL(blob);
  const link = document.createElement('a');
  link.href = url;
  link.download = filename;
  document.body.appendChild(link);
  link.click();
  document.body.removeChild(link);
  URL.revokeObjectURL(url);
}

interface Props {
  // Carts already filtered to "remarketable" (non-converted) - used as the candidate pool
  candidateCarts: AbandonedCart[];
}

export const AbandonedCartExportPanel: React.FC<Props> = ({ candidateCarts }) => {
  const [platform, setPlatform] = useState<Platform>('google');
  const [preset, setPreset] = useState<DatePreset>('last7');
  const [sourceFilter, setSourceFilter] = useState<SourceFilter>('all');
  const [customFrom, setCustomFrom] = useState(format(startOfDay(subDays(new Date(), 7)), 'yyyy-MM-dd'));
  const [customTo, setCustomTo] = useState(format(new Date(), 'yyyy-MM-dd'));
  const [conversionName, setConversionName] = useState('Abandoned Cart');

  const [excludePrevious, setExcludePrevious] = useState(true);
  const [exporting, setExporting] = useState(false);
  const [exportLogs, setExportLogs] = useState<ExportLog[]>([]);
  const [previousIds, setPreviousIds] = useState<Set<string>>(new Set());

  const { from, to } = useMemo(() => {
    if (preset === 'custom') {
      return {
        from: startOfDay(new Date(`${customFrom}T00:00:00`)),
        to: endOfDay(new Date(`${customTo}T00:00:00`)),
      };
    }
    return getPresetRange(preset);
  }, [preset, customFrom, customTo]);

  useEffect(() => {
    void loadLogs();
    void loadPreviouslyExportedIds(platform);
  }, [platform]);

  const loadLogs = async () => {
    const { data } = await supabase
      .from('abandoned_cart_exports')
      .select('*')
      .order('created_at', { ascending: false })
      .limit(50);
    setExportLogs((data || []) as ExportLog[]);
  };

  const loadPreviouslyExportedIds = async (p: Platform) => {
    const ids = new Set<string>();
    let offset = 0;
    const pageSize = 1000;
    // Paginate to bypass 1000-row limit
    while (true) {
      const { data, error } = await supabase
        .from('abandoned_cart_export_items')
        .select('abandoned_cart_id')
        .eq('platform', p)
        .range(offset, offset + pageSize - 1);
      if (error) break;
      const rows = (data || []) as { abandoned_cart_id: string }[];
      rows.forEach(r => ids.add(r.abandoned_cart_id));
      if (rows.length < pageSize) break;
      offset += pageSize;
    }
    setPreviousIds(ids);
  };

  // Per-source counts for the chosen date range (before source filter)
  const sourceCounts = useMemo(() => {
    const fromMs = from.getTime();
    const toMs = to.getTime();
    const counts = { google_ad: 0, social_ad: 0, organic: 0, all: 0 };
    for (const c of candidateCarts) {
      if (!c.email) continue;
      const t = new Date(c.created_at).getTime();
      if (t < fromMs || t > toMs) continue;
      const s = classifyCartSource(c);
      counts[s] += 1;
      counts.all += 1;
    }
    return counts;
  }, [candidateCarts, from, to]);

  // Filter candidates: in date range, with email, source match, optionally exclude previously-exported
  const filtered = useMemo(() => {
    const fromMs = from.getTime();
    const toMs = to.getTime();
    return candidateCarts.filter(c => {
      if (!c.email) return false;
      const t = new Date(c.created_at).getTime();
      if (t < fromMs || t > toMs) return false;
      if (excludePrevious && previousIds.has(c.id)) return false;
      if (sourceFilter !== 'all' && classifyCartSource(c) !== sourceFilter) return false;
      return true;
    });
  }, [candidateCarts, from, to, excludePrevious, previousIds, sourceFilter]);


  // Deduplicate within the export. For Google Offline Conversions we dedupe by gclid
  // (and require one to exist); for other formats we dedupe by email.
  const uniqueByEmail = useMemo(() => {
    const seen = new Set<string>();
    const out: AbandonedCart[] = [];
    for (const c of filtered) {
      if (platform === 'google_offline') {
        const gclid = c.cart_metadata?.gclid ? String(c.cart_metadata.gclid).trim() : '';
        if (!gclid || seen.has(gclid)) continue;
        seen.add(gclid);
        out.push(c);
        continue;
      }
      const key = (c.email || '').trim().toLowerCase();
      if (!key || seen.has(key)) continue;
      seen.add(key);
      out.push(c);
    }
    return out;
  }, [filtered, platform]);

  const handleExport = async () => {
    if (uniqueByEmail.length === 0) {
      toast.error('No carts to export in this date range');
      return;
    }
    setExporting(true);
    try {
      const csv = buildAbandonedCartCsv(uniqueByEmail, platform, {
        conversionName,
        timeZone: 'Europe/London',
      });
      const fname = `abandoned-carts-${platform}-${sourceFilter}-${format(from, 'yyyyMMdd')}-${format(to, 'yyyyMMdd')}.csv`;
      downloadAbandonedCartCsv(csv, fname);


      // Log the export
      const { data: auth } = await supabase.auth.getUser();
      const userId = auth?.user?.id;
      const userEmail = auth?.user?.email || null;

      const { data: exportRow, error: exportErr } = await supabase
        .from('abandoned_cart_exports')
        .insert({
          platform,
          date_from: from.toISOString(),
          date_to: to.toISOString(),
          cart_count: uniqueByEmail.length,
          exported_by: userId,
          exported_by_email: userEmail,
        })
        .select()
        .single();

      if (exportErr) throw exportErr;

      // Insert items in chunks of 500
      const items = uniqueByEmail.map(c => ({
        export_id: exportRow.id,
        abandoned_cart_id: c.id,
        platform,
        email: (c.email || '').trim().toLowerCase(),
      }));
      for (let i = 0; i < items.length; i += 500) {
        const chunk = items.slice(i, i + 500);
        await supabase.from('abandoned_cart_export_items').insert(chunk);
      }

      toast.success(`Exported ${uniqueByEmail.length} carts for ${platform === 'google' ? 'Google' : 'Facebook'} and logged.`);
      await loadLogs();
      await loadPreviouslyExportedIds(platform);
    } catch (e: any) {
      console.error(e);
      toast.error('Export failed: ' + (e.message || 'unknown error'));
    } finally {
      setExporting(false);
    }
  };

  return (
    <Card className="border-primary/20">
      <CardHeader>
        <CardTitle className="flex items-center gap-2">
          <FileSpreadsheet className="w-5 h-5" />
          Remarketing Export (Google / Facebook)
        </CardTitle>
        <p className="text-sm text-muted-foreground">
          Export abandoned carts as a CSV ready to upload to Google Customer Match, Google Ads Offline Conversions, or Facebook Custom Audience.
          Customers who have already purchased are automatically excluded.
        </p>
      </CardHeader>
      <CardContent className="space-y-4">
        <div className="grid grid-cols-1 md:grid-cols-4 gap-3">
          <div>
            <Label className="text-xs">Platform</Label>
            <Select value={platform} onValueChange={(v) => setPlatform(v as Platform)}>
              <SelectTrigger><SelectValue /></SelectTrigger>
              <SelectContent>
                <SelectItem value="google">Google Customer Match (audience)</SelectItem>
                <SelectItem value="google_offline">Google Offline Conversions (gclid)</SelectItem>
                <SelectItem value="facebook">Facebook Custom Audience</SelectItem>
              </SelectContent>
            </Select>
          </div>
          <div>
            <Label className="text-xs">Traffic Source</Label>
            <Select value={sourceFilter} onValueChange={(v) => setSourceFilter(v as SourceFilter)}>
              <SelectTrigger><SelectValue /></SelectTrigger>
              <SelectContent>
                <SelectItem value="all">All sources ({sourceCounts.all})</SelectItem>
                <SelectItem value="google_ad">Google Ads ({sourceCounts.google_ad})</SelectItem>
                <SelectItem value="social_ad">Facebook / Social ({sourceCounts.social_ad})</SelectItem>
                <SelectItem value="organic">Organic / Direct ({sourceCounts.organic})</SelectItem>
              </SelectContent>
            </Select>
          </div>
          <div>
            <Label className="text-xs">Date Range</Label>
            <Select value={preset} onValueChange={(v) => setPreset(v as DatePreset)}>
              <SelectTrigger><SelectValue /></SelectTrigger>
              <SelectContent>
                <SelectItem value="today">Today</SelectItem>
                <SelectItem value="yesterday">Yesterday</SelectItem>
                <SelectItem value="last7">Last 7 days (weekly)</SelectItem>
                <SelectItem value="this_week">This week</SelectItem>
                <SelectItem value="last30">Last 30 days (monthly)</SelectItem>
                <SelectItem value="this_month">This month</SelectItem>
                <SelectItem value="last_month">Last month</SelectItem>
                <SelectItem value="last90">Last 90 days</SelectItem>
                <SelectItem value="custom">Custom dates</SelectItem>
              </SelectContent>
            </Select>
          </div>
          <div className="flex items-end">
            <Button onClick={handleExport} disabled={exporting || uniqueByEmail.length === 0} className="w-full">
              <Download className="w-4 h-4 mr-2" />
              {exporting ? 'Exporting...' : `Export ${uniqueByEmail.length} carts`}
            </Button>
          </div>
        </div>

        {/* Per-source breakdown chips */}
        <div className="flex flex-wrap gap-2 text-xs">
          <Badge variant="outline">Google Ads: {sourceCounts.google_ad}</Badge>
          <Badge variant="outline">Facebook / Social: {sourceCounts.social_ad}</Badge>
          <Badge variant="outline">Organic / Direct: {sourceCounts.organic}</Badge>
          <Badge variant="secondary">Total in range: {sourceCounts.all}</Badge>
        </div>


        {preset === 'custom' && (
          <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
            <div>
              <Label className="text-xs">From</Label>
              <Input type="date" value={customFrom} onChange={(e) => setCustomFrom(e.target.value)} />
            </div>
            <div>
              <Label className="text-xs">To</Label>
              <Input type="date" value={customTo} onChange={(e) => setCustomTo(e.target.value)} />
            </div>
          </div>
        )}

        {platform === 'google_offline' && (
          <div className="rounded-md border border-primary/20 bg-primary/5 p-3 space-y-2">
            <div>
              <Label className="text-xs">Conversion Name (must match a conversion action in Google Ads)</Label>
              <Input
                value={conversionName}
                onChange={(e) => setConversionName(e.target.value)}
                placeholder="Abandoned Cart"
              />
            </div>
            <p className="text-xs text-muted-foreground">
              Only carts that arrived via a Google ad click (have a stored <code>gclid</code>) will be included.
              Conversion value uses each cart's total price when available, otherwise £1. Time zone: Europe/London.
              Upload at: Google Ads → Tools → Conversions → Uploads.
            </p>
          </div>
        )}

        <div className="flex items-center gap-4 text-sm">
          <div className="flex items-center gap-2">
            <Calendar className="w-4 h-4 text-muted-foreground" />
            <span className="text-muted-foreground">
              {format(from, 'd MMM yyyy')} – {format(to, 'd MMM yyyy')}
            </span>
          </div>
          <label className="flex items-center gap-2 cursor-pointer">
            <Checkbox checked={excludePrevious} onCheckedChange={(v) => setExcludePrevious(!!v)} />
            <span>Exclude carts already uploaded to {platform === 'google' ? 'Google' : 'Facebook'} ({previousIds.size} on file)</span>
          </label>
        </div>

        {exportLogs.length > 0 && (
          <div>
            <div className="flex items-center gap-2 mb-2">
              <History className="w-4 h-4" />
              <h4 className="font-medium text-sm">Recent exports</h4>
            </div>
            <div className="space-y-1 max-h-48 overflow-y-auto border rounded-md p-2">
              {exportLogs.map(log => (
                <div key={log.id} className="flex items-center justify-between text-xs py-1 border-b last:border-0">
                  <div className="flex items-center gap-2">
                    <Badge variant={log.platform === 'google' ? 'default' : 'secondary'}>
                      {log.platform === 'google' ? 'Google' : 'Facebook'}
                    </Badge>
                    <span>{format(new Date(log.date_from), 'd MMM')} – {format(new Date(log.date_to), 'd MMM yyyy')}</span>
                    <span className="text-muted-foreground">· {log.cart_count} carts</span>
                  </div>
                  <div className="text-muted-foreground">
                    {format(new Date(log.created_at), 'd MMM HH:mm')}
                    {log.exported_by_email ? ` · ${log.exported_by_email}` : ''}
                  </div>
                </div>
              ))}
            </div>
          </div>
        )}
      </CardContent>
    </Card>
  );
};
