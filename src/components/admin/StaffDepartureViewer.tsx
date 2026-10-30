import React, { useEffect, useState } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { Button } from '@/components/ui/button';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Tabs, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { departureTime } from '@/lib/staffDepartureView';

interface Snapshot { captured_at: string; view_observed_at: string | null; tab: string | null; filters: Record<string, unknown>; permissions: Record<string, unknown>; scope_note: string }
interface Item { id: number; source_id: string; record: Record<string, unknown> }
const sections = { leads: 'Assigned leads', customers: 'Accessible customers', crm_attendance_sessions: 'CRM sessions', lead_access_events: 'Lead openings / copies', staff_work_locations: 'Recorded locations', admin_user_access_periods: 'Access history' };
export function StaffDepartureViewer({ archiveId, name, onClose }: { archiveId: string; name: string; onClose: () => void }) {
  const [snapshot, setSnapshot] = useState<Snapshot | null>(null);
  const [items, setItems] = useState<Item[]>([]);
  const [kind, setKind] = useState('leads');
  const [page, setPage] = useState(0);
  const [hasMore, setHasMore] = useState(false);
  const [busy, setBusy] = useState(true);
  const [error, setError] = useState('');
  const [loaded, setLoaded] = useState(false);
  useEffect(() => {
    let live = true;
    setBusy(true); setError(''); setItems([]);
    Promise.all([
      supabase.from('staff_crm_departures').select('*').eq('archive_id', archiveId).maybeSingle(),
      supabase.from('staff_crm_departure_items').select('id,source_id,record').eq('archive_id', archiveId).eq('kind', kind).order('id').range(page * 50, page * 50 + 50),
    ]).then(([meta, records]) => {
      if (!live) return;
      if (meta.error || records.error) { setError('Unable to load saved CRM. Please try again.'); return; }
      setSnapshot(meta.data as Snapshot | null); setLoaded(true);
      setItems((records.data ?? []).slice(0, 50) as Item[]); setHasMore((records.data?.length ?? 0) > 50);
    }).catch(() => { if (live) setError('Unable to load saved CRM.'); }).finally(() => { if (live) setBusy(false); });
    return () => { live = false; };
  }, [archiveId, kind, page]);
  return <Dialog open onOpenChange={open => { if (!open) onClose(); }}><DialogContent className="max-w-5xl max-h-[90vh] overflow-y-auto"><DialogHeader><DialogTitle>CRM at departure · {name}</DialogTitle></DialogHeader>
    {error && <p role="alert" className="text-destructive">{error}</p>}
    {busy && <p role="status">Loading saved records…</p>}
    {!busy && loaded && !snapshot && <p>Departure view unavailable. This archive predates departure-state recording; the existing history download remains available.</p>}
    {snapshot && <>
      <div className="space-y-2 border-b pb-4 text-sm"><p><strong>Captured:</strong> {departureTime(snapshot.captured_at)}</p><p><strong>Last recorded page:</strong> {snapshot.tab ?? 'Not recorded'} · {departureTime(snapshot.view_observed_at)}</p><p className="text-muted-foreground">{snapshot.scope_note} Recorded page context is not proof of the person using the account.</p><p><strong>Filters:</strong> {Object.entries(snapshot.filters).map(([k,v]) => `${k}: ${String(v)}`).join(' · ') || 'Not recorded'}</p>
      <details><summary className="cursor-pointer">Permissions at departure</summary><pre className="whitespace-pre-wrap break-words text-xs mt-2">{JSON.stringify(snapshot.permissions,null,2)}</pre></details></div>
      <Tabs value={kind} onValueChange={value => { setKind(value); setPage(0); }}><TabsList className="h-auto flex flex-wrap justify-start">{Object.entries(sections).map(([key,label]) => <TabsTrigger key={key} value={key}>{label}</TabsTrigger>)}</TabsList></Tabs>
      {!busy && !error && items.length === 0 && <p>No recorded entries in this section.</p>}
      <div className="divide-y">{items.map(item => <article key={item.id} className="py-3 text-sm"><h3 className="font-semibold">{String(item.record.name ?? [item.record.first_name,item.record.last_name].filter(Boolean).join(' ') || item.record.registration_plate || item.record.vehicle_reg || item.record.action || sections[kind as keyof typeof sections])}</h3><p className="text-xs text-muted-foreground">Source reference: {item.source_id}</p><dl className="grid grid-cols-1 sm:grid-cols-2 gap-x-6 gap-y-1 mt-2">{Object.entries(item.record).map(([key,value]) => <div key={key} className="min-w-0"><dt className="inline text-muted-foreground">{key.replaceAll('_',' ')}: </dt><dd className="inline break-words">{key.endsWith('_at') || key.endsWith('_date') ? departureTime(value) : value === null ? 'Not recorded' : String(value)}</dd></div>)}</dl></article>)}</div>
      <div className="flex items-center justify-between"><Button variant="outline" disabled={busy || page===0} onClick={() => setPage(p=>p-1)}>Previous</Button><span className="text-sm">Page {page+1}</span><Button variant="outline" disabled={busy || !hasMore} onClick={() => setPage(p=>p+1)}>Next</Button></div>
    </>}
  </DialogContent></Dialog>;
}