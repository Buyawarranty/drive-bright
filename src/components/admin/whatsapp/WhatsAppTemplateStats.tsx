import React, { useCallback, useEffect, useState } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Loader2, RefreshCw } from 'lucide-react';
import { supabase } from '@/integrations/supabase/client';
import { toast } from 'sonner';

interface Row {
  template_name: string;
  queued: number;
  sent: number;
  delivered: number;
  read_count: number;
  failed: number;
  skipped: number;
  replied: number;
  last_sent_at: string | null;
}

const RANGES = [
  { key: '7', label: 'Last 7 days' },
  { key: '30', label: 'Last 30 days' },
  { key: 'all', label: 'All time' },
] as const;

const pct = (part: number, whole: number) => (whole > 0 ? `${Math.round((part / whole) * 100)}%` : '—');

/** Management report: how each WhatsApp template performs. */
const WhatsAppTemplateStats: React.FC = () => {
  const [rows, setRows] = useState<Row[]>([]);
  const [loading, setLoading] = useState(true);
  const [range, setRange] = useState<string>('30');

  const load = useCallback(async () => {
    setLoading(true);
    const from =
      range === 'all' ? null : new Date(Date.now() - Number(range) * 24 * 60 * 60 * 1000).toISOString();
    const { data, error } = await supabase.rpc('get_whatsapp_template_stats', {
      _from: from,
      _to: null,
    });
    setLoading(false);
    if (error) {
      toast.error('Could not load the WhatsApp message report.');
      return;
    }
    setRows((data || []) as Row[]);
  }, [range]);

  useEffect(() => {
    void load();
  }, [load]);

  return (
    <Card>
      <CardHeader className="flex flex-row items-center justify-between gap-2 space-y-0">
        <CardTitle className="text-base">Message performance by template</CardTitle>
        <div className="flex items-center gap-1">
          {RANGES.map((r) => (
            <Button
              key={r.key}
              size="sm"
              variant={range === r.key ? 'default' : 'outline'}
              onClick={() => setRange(r.key)}
            >
              {r.label}
            </Button>
          ))}
          <Button size="sm" variant="ghost" onClick={() => void load()} disabled={loading}>
            {loading ? <Loader2 className="h-4 w-4 animate-spin" /> : <RefreshCw className="h-4 w-4" />}
          </Button>
        </div>
      </CardHeader>
      <CardContent>
        {rows.length === 0 ? (
          <p className="text-sm text-muted-foreground">
            {loading ? 'Loading…' : 'No WhatsApp messages have been sent in this period yet.'}
          </p>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b border-border text-left text-xs uppercase text-muted-foreground">
                  <th className="py-2 pr-3">Template</th>
                  <th className="py-2 pr-3">Sent</th>
                  <th className="py-2 pr-3">Delivered</th>
                  <th className="py-2 pr-3">Read</th>
                  <th className="py-2 pr-3">Replied</th>
                  <th className="py-2 pr-3">Waiting</th>
                  <th className="py-2 pr-3">Not delivered</th>
                  <th className="py-2 pr-3">Skipped</th>
                  <th className="py-2">Last sent</th>
                </tr>
              </thead>
              <tbody>
                {rows.map((r) => (
                  <tr key={r.template_name} className="border-b border-border/50">
                    <td className="py-2 pr-3 font-medium">{r.template_name}</td>
                    <td className="py-2 pr-3">{r.sent}</td>
                    <td className="py-2 pr-3">
                      {r.delivered}{' '}
                      <span className="text-xs text-muted-foreground">{pct(r.delivered, r.sent)}</span>
                    </td>
                    <td className="py-2 pr-3">
                      {r.read_count}{' '}
                      <span className="text-xs text-muted-foreground">{pct(r.read_count, r.sent)}</span>
                    </td>
                    <td className="py-2 pr-3">
                      {r.replied}{' '}
                      <span className="text-xs text-muted-foreground">{pct(r.replied, r.sent)}</span>
                    </td>
                    <td className="py-2 pr-3">{r.queued}</td>
                    <td className="py-2 pr-3">{r.failed}</td>
                    <td className="py-2 pr-3">{r.skipped}</td>
                    <td className="py-2 text-xs text-muted-foreground">
                      {r.last_sent_at
                        ? new Date(r.last_sent_at).toLocaleString('en-GB', {
                            day: '2-digit',
                            month: 'short',
                            hour: '2-digit',
                            minute: '2-digit',
                          })
                        : '—'}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </CardContent>
    </Card>
  );
};

export default WhatsAppTemplateStats;
