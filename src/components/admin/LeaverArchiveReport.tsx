import React, { useEffect, useMemo, useState } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Bar, BarChart, CartesianGrid, Cell, Pie, PieChart, ResponsiveContainer, Tooltip, XAxis, YAxis } from 'recharts';
import { Printer } from 'lucide-react';

interface Archive { id: string; staff_name: string | null; staff_email: string | null; staff_role: string | null; trigger_reason: string; status: string; total_records: number; table_counts: Record<string, number>; created_at: string; }
interface Report { by_month: { month: string; count: number }[]; by_hour: { hour: number; count: number }[]; by_weekday: { dow: number; count: number }[];
  call_outcomes: { outcome: string; count: number }[]; calls_contact_made: number; first_at: string | null; last_at: string | null; }

const TABLE_LABELS: Record<string, string> = {
  lead_call_logs: 'Calls made', lead_quick_notes: 'Lead notes', lead_activities: 'Lead activity', lead_access_events: 'Leads opened / numbers copied',
  lead_view_receipts: 'Leads viewed', sales_leads: 'Leads owned', customers: 'Customers / sales', lead_reminders: 'Reminders', admin_ui_events: 'CRM clicks & screens',
  staff_work_locations: 'Sign-in locations', crm_attendance_sessions: 'CRM sessions', lead_assignment_audit: 'Lead moves', email_logs: 'Emails sent', customer_notes: 'Customer notes',
};
const label = (t: string) => TABLE_LABELS[t] ?? t.replace(/_/g, ' ').replace(/^\w/, c => c.toUpperCase());
const DAYS = ['', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat', 'Sun'];
const COLORS = ['hsl(var(--primary))', 'hsl(var(--destructive))', 'hsl(var(--accent-foreground))', 'hsl(var(--muted-foreground))', 'hsl(var(--secondary-foreground))'];
const HIDE = /(^id$|_id$|^updated_at$|normalized$)/;
const fmtVal = (k: string, v: unknown) => {
  if (v === null || v === undefined || v === '') return null;
  if (typeof v === 'string' && /^\d{4}-\d{2}-\d{2}T/.test(v)) return new Date(v).toLocaleString('en-GB', { timeZone: 'Europe/London' });
  if (typeof v === 'boolean') return v ? 'Yes' : 'No';
  if (typeof v === 'object') return JSON.stringify(v);
  return String(v).replace(/_/g, ' ');
};
const fieldName = (k: string) => k.replace(/_/g, ' ').replace(/^\w/, c => c.toUpperCase());
const ukDate = (s: string | null) => (s ? new Date(s).toLocaleDateString('en-GB', { timeZone: 'Europe/London' }) : '—');

/** Readable, chart-based view of a locked leaver archive. Read-only. */
export const LeaverArchiveReport: React.FC<{ archive: Archive; onClose: () => void }> = ({ archive, onClose }) => {
  const [report, setReport] = useState<Report | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [table, setTable] = useState<string | null>(null);
  const [page, setPage] = useState(0);
  const [rows, setRows] = useState<Record<string, unknown>[]>([]);

  useEffect(() => {
    (supabase.rpc as any)('leaver_archive_report', { _archive_id: archive.id }).then(({ data, error }: any) => {
      if (error) setError(error.message); else setReport(data);
    });
  }, [archive.id]);

  useEffect(() => {
    if (!table) return;
    (supabase.from as any)('staff_leaver_archive_items').select('row_data').eq('archive_id', archive.id).eq('source_table', table)
      .order('id').range(page * 25, page * 25 + 24).then(({ data }: any) => setRows((data ?? []).map((d: any) => d.row_data)));
  }, [table, page, archive.id]);

  const byType = useMemo(() => Object.entries(archive.table_counts || {}).map(([t, c]) => ({ name: label(t), table: t, count: c })).sort((a, b) => b.count - a.count), [archive]);
  const calls = archive.table_counts?.lead_call_logs ?? 0;
  const columns = useMemo(() => {
    const keys = new Set<string>();
    rows.forEach(r => Object.entries(r).forEach(([k, v]) => { if (!HIDE.test(k) && v !== null && v !== '') keys.add(k); }));
    return [...keys].sort((a, b) => (a === 'created_at' ? -1 : b === 'created_at' ? 1 : 0)).slice(0, 8);
  }, [rows]);

  return (
    <Dialog open onOpenChange={o => !o && onClose()}>
      <DialogContent className="max-w-6xl max-h-[92vh] overflow-y-auto print:max-h-none print:overflow-visible">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-3">
            Leaver report: {archive.staff_name || archive.staff_email}
            <Button size="sm" variant="outline" className="ml-auto mr-6 print:hidden" onClick={() => window.print()}><Printer className="h-4 w-4 mr-1" />Print / save as PDF</Button>
          </DialogTitle>
        </DialogHeader>
        <p className="text-sm text-muted-foreground">{archive.staff_role} · archive started {new Date(archive.created_at).toLocaleString('en-GB', { timeZone: 'Europe/London' })} (UK time) · reason: {archive.trigger_reason}. Records show what this account did; they do not prove who was at the keyboard.</p>

        <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
          {[['Total records', archive.total_records.toLocaleString()], ['Calls made', calls.toLocaleString()],
            ['Calls answered', report ? report.calls_contact_made.toLocaleString() : '…'], ['Activity period', report ? `${ukDate(report.first_at)} – ${ukDate(report.last_at)}` : '…']]
            .map(([k, v]) => <Card key={k}><CardContent className="p-4"><div className="text-xs text-muted-foreground">{k}</div><div className="text-xl font-semibold">{v}</div></CardContent></Card>)}
        </div>
        {error && <p role="alert" className="text-destructive text-sm">Charts could not load: {error}</p>}

        <div className="grid md:grid-cols-2 gap-4">
          <Card><CardHeader><CardTitle className="text-base">What they did (click a bar to read the records)</CardTitle></CardHeader><CardContent className="h-72">
            <ResponsiveContainer><BarChart data={byType.slice(0, 12)} layout="vertical" margin={{ left: 40 }}>
              <CartesianGrid strokeDasharray="3 3" /><XAxis type="number" /><YAxis type="category" dataKey="name" width={150} tick={{ fontSize: 11 }} /><Tooltip />
              <Bar dataKey="count" name="Records" fill="hsl(var(--primary))" cursor="pointer" onClick={(d: any) => { setTable(d.table); setPage(0); }} />
            </BarChart></ResponsiveContainer></CardContent></Card>
          <Card><CardHeader><CardTitle className="text-base">Activity by month</CardTitle></CardHeader><CardContent className="h-72">
            <ResponsiveContainer><BarChart data={report?.by_month ?? []}><CartesianGrid strokeDasharray="3 3" /><XAxis dataKey="month" tick={{ fontSize: 11 }} /><YAxis /><Tooltip />
              <Bar dataKey="count" name="Records" fill="hsl(var(--primary))" /></BarChart></ResponsiveContainer></CardContent></Card>
          <Card><CardHeader><CardTitle className="text-base">Time of day (UK)</CardTitle></CardHeader><CardContent className="h-64">
            <ResponsiveContainer><BarChart data={(report?.by_hour ?? []).map(h => ({ ...h, label: `${String(h.hour).padStart(2, '0')}:00` }))}><CartesianGrid strokeDasharray="3 3" /><XAxis dataKey="label" tick={{ fontSize: 10 }} /><YAxis /><Tooltip />
              <Bar dataKey="count" name="Records" fill="hsl(var(--primary))" /></BarChart></ResponsiveContainer></CardContent></Card>
          <Card><CardHeader><CardTitle className="text-base">Day of week</CardTitle></CardHeader><CardContent className="h-64">
            <ResponsiveContainer><BarChart data={(report?.by_weekday ?? []).map(w => ({ ...w, day: DAYS[w.dow] }))}><CartesianGrid strokeDasharray="3 3" /><XAxis dataKey="day" /><YAxis /><Tooltip />
              <Bar dataKey="count" name="Records" fill="hsl(var(--primary))" /></BarChart></ResponsiveContainer></CardContent></Card>
          {!!report?.call_outcomes.length && <Card className="md:col-span-2"><CardHeader><CardTitle className="text-base">Call results</CardTitle></CardHeader><CardContent className="h-72 flex">
            <ResponsiveContainer width="50%"><PieChart><Pie data={report.call_outcomes.map(o => ({ ...o, outcome: o.outcome.replace(/_/g, ' ') }))} dataKey="count" nameKey="outcome" outerRadius={100}>
              {report.call_outcomes.map((_, i) => <Cell key={i} fill={COLORS[i % COLORS.length]} />)}</Pie><Tooltip /></PieChart></ResponsiveContainer>
            <ul className="text-sm space-y-1 self-center">{report.call_outcomes.map((o, i) => <li key={o.outcome} className="flex items-center gap-2"><span className="h-3 w-3 rounded-sm" style={{ background: COLORS[i % COLORS.length] }} />{o.outcome.replace(/_/g, ' ')}: <b>{o.count.toLocaleString()}</b></li>)}</ul>
          </CardContent></Card>}
        </div>

        <Card><CardHeader><CardTitle className="text-base">Read the records</CardTitle></CardHeader><CardContent className="space-y-3">
          <div className="flex flex-wrap gap-2 print:hidden">{byType.map(t => <Button key={t.table} size="sm" variant={table === t.table ? 'default' : 'outline'} onClick={() => { setTable(t.table); setPage(0); }}>{t.name} ({t.count.toLocaleString()})</Button>)}</div>
          {!table && <p className="text-sm text-muted-foreground">Pick a type above to see its records as a table.</p>}
          {table && <>
            <div className="overflow-x-auto"><table className="w-full text-sm border">
              <thead className="bg-muted"><tr>{columns.map(c => <th key={c} className="text-left p-2 border-b">{c === 'created_at' ? 'When (UK)' : fieldName(c)}</th>)}</tr></thead>
              <tbody>{rows.map((r, i) => <tr key={i} className="border-b align-top">{columns.map(c => <td key={c} className="p-2 max-w-xs break-words">{fmtVal(c, r[c]) ?? '—'}</td>)}</tr>)}</tbody>
            </table></div>
            <div className="flex items-center gap-2 print:hidden">
              <Button size="sm" variant="outline" disabled={page === 0} onClick={() => setPage(p => p - 1)}>Previous</Button>
              <span className="text-sm">Page {page + 1} of {Math.max(1, Math.ceil((archive.table_counts[table] ?? 0) / 25))}</span>
              <Button size="sm" variant="outline" disabled={rows.length < 25} onClick={() => setPage(p => p + 1)}>Next</Button>
            </div>
          </>}
        </CardContent></Card>
      </DialogContent>
    </Dialog>
  );
};
