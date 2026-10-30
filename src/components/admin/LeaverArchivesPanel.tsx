import React, { useCallback, useEffect, useState } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { toast } from 'sonner';
import { Archive, Download } from 'lucide-react';
import { StaffDepartureViewer } from './StaffDepartureViewer';

interface ArchiveRow { id: string; staff_name: string | null; staff_email: string | null; staff_role: string | null;
  trigger_reason: string; status: string; total_records: number; table_counts: Record<string, number>; created_at: string; created_by: string | null; }

const rpc = (name: string, args?: object) => (supabase.rpc as any)(name, args);

/** Copies every pending table into the archive and locks it. Throws on failure. */
export async function finishLeaverArchive(id: string): Promise<void> {
  const { data: tables, error } = await rpc('leaver_archive_pending_tables', { _archive_id: id });
  if (error) throw error;
  for (const t of (tables as string[]) ?? []) {
    const { error: e } = await rpc('leaver_archive_copy_table', { _archive_id: id, _table: t });
    if (e) throw new Error(`${t}: ${e.message}`);
  }
  const { error: f } = await rpc('leaver_archive_finish', { _archive_id: id });
  if (f) throw f;
}

/** Downloads the full archive as one file; saves nothing if any page fails. */
export async function downloadLeaverArchive(a: ArchiveRow): Promise<void> {
  const all: unknown[] = [];
  for (let from = 0; ; from += 1000) {
    const { data, error } = await (supabase.from as any)('staff_leaver_archive_items')
      .select('source_table,matched_column,row_data').eq('archive_id', a.id).order('id').range(from, from + 999);
    if (error) throw new Error('Download stopped; no incomplete file was saved.');
    all.push(...(data ?? []));
    if (!data || data.length < 1000) break;
  }
  const { data: departure, error: departureError } = await supabase.from('staff_crm_departures').select('*').eq('archive_id', a.id).maybeSingle();
  if (departureError) throw new Error('Departure record could not be included. Please retry.');
  const savedItems: unknown[] = [];
  for (let from = 0; departure; from += 1000) {
    const { data, error } = await supabase.from('staff_crm_departure_items').select('kind,source_id,record,created_at').eq('archive_id', a.id).order('id').range(from, from + 999);
    if (error) throw new Error('Download stopped; no incomplete file was saved.');
    savedItems.push(...(data ?? []));
    if (!data || data.length < 1000) break;
  }
  const blob = new Blob([JSON.stringify({ archive: a, records: all, departure, departureRecords: savedItems }, null, 1)], { type: 'application/json' });
  const link = document.createElement('a');
  link.href = URL.createObjectURL(blob);
  link.download = `leaver-archive-${(a.staff_name || a.staff_email || a.id).replace(/\W+/g, '-')}.json`;
  link.click();
  URL.revokeObjectURL(link.href);
}

/** After switching someone off: finish their newest archive, then download it. */
export async function finishAndDownloadLatestArchive(adminUserId: string): Promise<void> {
  let row: ArchiveRow | null = null;
  for (let i = 0; i < 5 && !row; i++) {
    const { data } = await (supabase.from as any)('staff_leaver_archives').select('*')
      .eq('admin_user_id', adminUserId).order('created_at', { ascending: false }).limit(1).maybeSingle();
    row = data ?? null;
    if (!row) await new Promise(r => setTimeout(r, 1000));
  }
  if (!row) throw new Error('No archive was found for this person.');
  if (row.status !== 'complete') await finishLeaverArchive(row.id);
  const { data: fresh } = await (supabase.from as any)('staff_leaver_archives').select('*').eq('id', row.id).maybeSingle();
  await downloadLeaverArchive((fresh as ArchiveRow) ?? row);
}

/** Admin/super-admin only: locked archive of everything recorded against each leaver. */
export const LeaverArchivesPanel: React.FC = () => {
  const [rows, setRows] = useState<ArchiveRow[]>([]);
  const [busy, setBusy] = useState<string | null>(null);
  const [selected, setSelected] = useState<ArchiveRow | null>(null);
  const [loadError, setLoadError] = useState(false);

  const load = useCallback(async () => {
    const { data, error } = await (supabase.from as any)('staff_leaver_archives').select('*').order('created_at', { ascending: false }).limit(100);
    setLoadError(!!error);
    setRows((data as ArchiveRow[]) ?? []);
  }, []);

  const build = useCallback(async (id: string) => {
    setBusy(id);
    try {
      await finishLeaverArchive(id);
      toast.success('Archive complete and locked');
    } catch (e: any) { toast.error(`Archive not finished: ${e.message}`); }
    setBusy(null); load();
  }, [load]);

  useEffect(() => { load(); }, [load]);

  const download = async (a: ArchiveRow) => {
    setBusy(a.id);
    try { await downloadLeaverArchive(a); } catch (e: any) { toast.error(e.message); }
    setBusy(null);
  };

  return (
    <Card id="leaver-archives">
      <CardHeader><CardTitle className="flex items-center gap-2"><Archive className="h-5 w-5" />Leaver archives</CardTitle></CardHeader>
      <CardContent className="space-y-2 text-sm">
        <p className="text-muted-foreground">Locked copies of recorded staff activity and available departure state. Missing past screens or unrecorded clicks cannot be recovered.</p>
        {loadError && <p role="alert" className="text-destructive">Unable to load archives. <Button variant="outline" size="sm" onClick={load}>Retry</Button></p>}
        {!loadError && rows.length === 0 && <p>No leaver archives yet.</p>}
        {rows.map(a => (
          <div key={a.id} className="flex flex-wrap items-center gap-2 border-t pt-2">
            <span className="font-medium">{a.staff_name || a.staff_email}</span>
            <span className="text-muted-foreground">{a.staff_role} · {a.trigger_reason} · {new Date(a.created_at).toLocaleString('en-GB')}</span>
            <Badge variant={a.status === 'complete' ? 'default' : 'destructive'}>{a.status === 'complete' ? `${a.total_records.toLocaleString()} records locked` : 'Needs finishing'}</Badge>
            <span className="ml-auto flex gap-2">
              <Button size="sm" variant="outline" onClick={() => setSelected(a)}>Open saved CRM</Button>
              {a.status !== 'complete' && <Button size="sm" disabled={!!busy} onClick={() => build(a.id)}>{busy === a.id ? 'Copying…' : 'Finish archive'}</Button>}
              {a.status === 'complete' && <Button size="sm" variant="outline" disabled={!!busy} onClick={() => download(a)}><Download className="h-3.5 w-3.5 mr-1" />{busy === a.id ? 'Preparing…' : 'Download'}</Button>}
            </span>
          </div>
        ))}
      </CardContent>
      {selected && <StaffDepartureViewer archiveId={selected.id} name={selected.staff_name || selected.staff_email || 'Staff member'} actor={selected.created_by} reason={selected.trigger_reason} onClose={() => setSelected(null)} />}
    </Card>
  );
};
