import { useCallback, useEffect, useMemo, useState } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { RefreshCw, MousePointerClick, AlertTriangle, Timer, LayoutDashboard } from 'lucide-react';

type EventRow = {
  id: string;
  created_at: string;
  admin_email: string | null;
  event_type: string;
  tab: string | null;
  path: string | null;
  label: string | null;
  duration_ms: number | null;
  detail: any;
};

const FILTERS = [
  { id: 'all', label: 'Everything' },
  { id: 'crash', label: 'Crashes' },
  { id: 'js_error', label: 'Errors' },
  { id: 'slow_load', label: 'Slow loads' },
  { id: 'cta_click', label: 'Button clicks' },
  { id: 'page_load', label: 'Page loads' },
  { id: 'tab_view', label: 'Tab opens' },
] as const;

const typeStyles: Record<string, { icon: JSX.Element; tone: string; label: string }> = {
  crash: { icon: <AlertTriangle className="h-3.5 w-3.5" />, tone: 'bg-destructive/10 text-destructive border-destructive/30', label: 'Crash' },
  js_error: { icon: <AlertTriangle className="h-3.5 w-3.5" />, tone: 'bg-destructive/10 text-destructive border-destructive/30', label: 'Error' },
  slow_load: { icon: <Timer className="h-3.5 w-3.5" />, tone: 'bg-amber-100 text-amber-800 border-amber-300', label: 'Slow' },
  cta_click: { icon: <MousePointerClick className="h-3.5 w-3.5" />, tone: 'bg-muted text-muted-foreground border-border', label: 'Click' },
  page_load: { icon: <LayoutDashboard className="h-3.5 w-3.5" />, tone: 'bg-muted text-muted-foreground border-border', label: 'Load' },
  tab_view: { icon: <LayoutDashboard className="h-3.5 w-3.5" />, tone: 'bg-muted text-muted-foreground border-border', label: 'Tab' },
};

/**
 * Read-only view of the dashboard activity log: which buttons staff pressed,
 * how long pages took, and every crash or error their browser hit.
 */
export const AdminUiEventLogPanel = () => {
  const [rows, setRows] = useState<EventRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [filter, setFilter] = useState<string>('crash');

  const load = useCallback(async () => {
    setLoading(true);
    try {
      let query = supabase
        .from('admin_ui_events')
        .select('id, created_at, admin_email, event_type, tab, path, label, duration_ms, detail')
        .order('created_at', { ascending: false })
        .limit(200);
      if (filter !== 'all') query = query.eq('event_type', filter);
      const { data, error } = await query;
      if (error) throw error;
      setRows((data as EventRow[]) || []);
    } catch (e) {
      console.warn('[AdminUiEventLogPanel] load failed', e);
      setRows([]);
    } finally {
      setLoading(false);
    }
  }, [filter]);

  useEffect(() => {
    void load();
  }, [load]);

  const problemCount = useMemo(
    () => rows.filter((r) => r.event_type === 'crash' || r.event_type === 'js_error').length,
    [rows],
  );

  return (
    <Card>
      <CardHeader className="pb-3">
        <div className="flex flex-wrap items-center justify-between gap-2">
          <div>
            <CardTitle className="text-base">Error logs &amp; dashboard activity</CardTitle>
            <CardDescription>
              Button presses, page load times, and any crash or error staff hit in the CRM.
              {problemCount > 0 && filter !== 'all' ? ` ${problemCount} problem${problemCount === 1 ? '' : 's'} in view.` : ''}
            </CardDescription>
          </div>
          <Button variant="outline" size="sm" onClick={() => void load()} disabled={loading}>
            <RefreshCw className={`h-4 w-4 mr-1.5 ${loading ? 'animate-spin' : ''}`} />
            Refresh
          </Button>
        </div>
        <div className="flex flex-wrap gap-1.5 pt-2">
          {FILTERS.map((f) => (
            <Button
              key={f.id}
              size="sm"
              variant={filter === f.id ? 'default' : 'outline'}
              className="h-7 text-xs"
              onClick={() => setFilter(f.id)}
            >
              {f.label}
            </Button>
          ))}
        </div>
      </CardHeader>
      <CardContent>
        {loading ? (
          <p className="text-sm text-muted-foreground py-6 text-center">Loading the log…</p>
        ) : rows.length === 0 ? (
          <p className="text-sm text-muted-foreground py-6 text-center">
            Nothing logged for this filter yet.
          </p>
        ) : (
          <div className="max-h-[480px] overflow-auto rounded-md border divide-y">
            {rows.map((r) => {
              const style = typeStyles[r.event_type] || typeStyles.cta_click;
              return (
                <div key={r.id} className="px-3 py-2 text-xs flex flex-wrap items-start gap-2">
                  <Badge variant="outline" className={`gap-1 ${style.tone}`}>
                    {style.icon}
                    {style.label}
                  </Badge>
                  <span className="text-muted-foreground whitespace-nowrap">
                    {new Date(r.created_at).toLocaleString('en-GB')}
                  </span>
                  <span className="font-medium">{r.admin_email || 'Unknown user'}</span>
                  {r.tab && <span className="text-muted-foreground">· {r.tab}</span>}
                  <span className="flex-1 min-w-[12rem] break-words">{r.label || '—'}</span>
                  {typeof r.duration_ms === 'number' && (
                    <span className="text-muted-foreground whitespace-nowrap">
                      {(r.duration_ms / 1000).toFixed(1)}s
                    </span>
                  )}
                </div>
              );
            })}
          </div>
        )}
      </CardContent>
    </Card>
  );
};

export default AdminUiEventLogPanel;
