import { useEffect, useState } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { useViewAs } from '@/contexts/ViewAsContext';
import { Button } from '@/components/ui/button';

type Entry = { id: string; actor_id: string; action: string; source: string; occurred_at: string };
export function LeadAccessHistory({ leadId }: { leadId: string }) {
  const { effectiveRole } = useViewAs();
  const allowed = effectiveRole === 'admin' || effectiveRole === 'super_admin';
  const [rows, setRows] = useState<Entry[]>([]);
  const [names, setNames] = useState<Record<string,string>>({});
  const [page, setPage] = useState(0);
  const [failed, setFailed] = useState(false);
  const [refresh, setRefresh] = useState(0);
  useEffect(() => { setPage(0); }, [leadId]);
  useEffect(() => {
    if (!allowed) return;
    let cancelled = false;
    setRows([]);
    void (async () => {
      const { data, error } = await supabase.from('lead_access_events').select('id, actor_id, action, source, occurred_at')
        .eq('lead_id',leadId).order('occurred_at',{ ascending:false }).order('id',{ ascending:false }).range(page*50,page*50+49);
      const ids = [...new Set((data || []).map(row => row.actor_id))];
      const staff = ids.length ? await supabase.from('admin_users').select('id, first_name, last_name, email').in('id',ids) : { data:[] };
      if (cancelled) return;
      setFailed(!!error);
      setRows(data || []);
      setNames(Object.fromEntries((staff.data || []).map(person => [person.id,[person.first_name,person.last_name].filter(Boolean).join(' ') || person.email])));
    })();
    return () => { cancelled = true; };
  }, [allowed,leadId,page,refresh]);
  if (!allowed) return null;
  return <section className="border-t border-border mt-4 pt-4">
    <div className="flex items-center justify-between"><h3 className="font-semibold">Lead access history</h3>
      <Button variant="outline" size="sm" onClick={() => setRefresh(value => value+1)}>Refresh</Button></div>
    {failed ? <p className="text-destructive">History could not be loaded.</p> : <>
      <div className="overflow-x-auto"><table className="w-full text-sm mt-2"><thead><tr className="text-left"><th>Agent</th><th>Action</th><th>Time (GMT)</th><th>Source</th></tr></thead>
      <tbody>{rows.map(row => <tr key={row.id} className="border-t border-border"><td className="py-2">{names[row.actor_id] || row.actor_id}</td><td>{row.action === 'lead_open' ? 'Opened lead' : 'Copied phone'}</td><td className="whitespace-nowrap">{new Date(row.occurred_at).toLocaleString('en-GB',{ timeZone:'UTC',hour12:false })}</td><td>{row.source.replace(/_/g,' ')}</td></tr>)}</tbody></table></div>
      {!rows.length && <p className="text-muted-foreground py-2">No recorded access.</p>}
      <div className="flex gap-2 mt-2"><Button variant="outline" size="sm" disabled={page===0} onClick={() => setPage(value => value-1)}>Previous</Button><Button variant="outline" size="sm" disabled={rows.length<50} onClick={() => setPage(value => value+1)}>Next</Button></div>
    </>}
  </section>;
}