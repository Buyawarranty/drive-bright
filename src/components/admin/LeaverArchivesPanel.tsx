import React, { useCallback, useEffect, useState } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { toast } from 'sonner';
import { Archive, Download } from 'lucide-react';

interface ArchiveRow { id: string; staff_name: string | null; staff_email: string | null; staff_role: string | null;
  trigger_reason: string; status: string; total_records: number; table_counts: Record<string, number>; created_at: string; }

const rpc = (name: string, args?: object) => (supabase.rpc as any)(name, args);

/** Admin/super-admin only: locked archive of everything recorded against each leaver. */
export const LeaverArchivesPanel: React.FC = () => {
  const [rows, setRows] = useState<ArchiveRow[]>([]);
  const [busy, setBusy] = useState<string | null>(null);

  const load = useCallback(async () => {
    const { data } = await (supabase.from as any)('staff_leaver_archives').select('*').order('created_at', { ascending: false }).limit(100);
    setRows((data as ArchiveRow[]) ?? []);
  }, []);

  const build = useCallback(async (id: string) => {
    setBusy(id);
    try {
      const { data: tables, error } = await rpc('leaver_archive_pending_tables', { _archive_id: id });
      if (error) throw error;
      for (const t of (tables as string[]) ?? []) {
        const { error: e } = await rpc('leaver_archive_copy_table', { _archive_id: id, _table: t });
        if (e) throw new Error(`${t}: ${e.message}`);
      }
      const { error: f } = await rpc('leaver_archive_finish', { _archive_id: id });
      if (f) throw f;
      toast.success('Archive complete and locked');
    } catch (e: any) { toast.error(`Archive not finished: ${e.message}`); }
    setBusy(null); load();
  }, [load]);

  useEffect(() => { load(); }, [load]);

  const download = async (a: ArchiveRow) => {
    setBusy(a.id);
    const all: unknown[] = [];
    for (let from = 0; ; from += 1000) {
      const { data, error } = await (supabase.from as any)('staff_leaver_archive_items')
        .select('source_table,matched_column,row_data').eq('archive_id', a.id).order('id').range(from, from + 999);
      if (error) { toast.error(error.message); break; }
      all.push(...(data ?? []));
      if (!data || data.length < 1000) break;
    }
    const blob = new Blob([JSON.stringify({ archive: a, records: all }, null, 1)], { type: 'application/json' });
    const link = document.createElement('a');
    link.href = URL.createObjectURL(blob);
    link.download = `leaver-archive-${(a.staff_name || a.staff_email || a.id).replace(/\W+/g, '-')}.json`;
    link.click();
    setBusy(null);
  };

  return (
    <Card id="leaver-archives">
      <CardHeader><CardTitle className="flex items-center gap-2"><Archive className="h-5 w-5" />Leaver archives</CardTitle></CardHeader>
      <CardContent className="space-y-2 text-sm">
        <p className="text-muted-foreground">Created automatically when a staff member is switched off, archived, blocked or removed. Each holds a locked copy of every record linked to them: calls, notes, lead openings, clicks, sign-ins, attendance, sales and changes. Nobody can edit or delete it.</p>
        {rows.length === 0 && <p>No leaver archives yet.</p>}
        {rows.map(a => (
          <div key={a.id} className="flex flex-wrap items-center gap-2 border-t pt-2">
            <span className="font-medium">{a.staff_name || a.staff_email}</span>
            <span className="text-muted-foreground">{a.staff_role} · {a.trigger_reason} · {new Date(a.created_at).toLocaleString('en-GB')}</span>
            <Badge variant={a.status === 'complete' ? 'default' : 'destructive'}>{a.status === 'complete' ? `${a.total_records.toLocaleString()} records locked` : 'Needs finishing'}</Badge>
            <span className="ml-auto flex gap-2">
              {a.status !== 'complete' && <Button size="sm" disabled={!!busy} onClick={() => build(a.id)}>{busy === a.id ? 'Copying…' : 'Finish archive'}</Button>}
              {a.status === 'complete' && <Button size="sm" variant="outline" disabled={!!busy} onClick={() => download(a)}><Download className="h-3.5 w-3.5 mr-1" />{busy === a.id ? 'Preparing…' : 'Download'}</Button>}
            </span>
          </div>
        ))}
      </CardContent>
    </Card>
  );
};
