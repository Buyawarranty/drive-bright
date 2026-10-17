import { useQuery } from '@tanstack/react-query';
import { Bar, BarChart, CartesianGrid, Cell, LabelList, ResponsiveContainer, Tooltip, XAxis, YAxis } from 'recharts';
import { Download } from 'lucide-react';
import { supabase } from '@/integrations/supabase/client';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { LEAD_ACTIVITIES, QUALITY_SOURCES, qualityCategories, qualityCount, qualityTotal, type QualityReport } from '@/lib/leadQualityReport';

export function LeadQualityPanel({ from, to }: { from: string; to: string }) {
  const { data, isLoading, error } = useQuery({ queryKey: ['lead-quality-report', from, to], queryFn: async () => {
    const { data, error } = await supabase.rpc('get_lead_quality_report', {p_from:from,p_to:to});
    if (error) throw error;
    return data as unknown as QualityReport;
  }, staleTime: 60_000 });
  const rows = data?.rows ?? [];
  const total = qualityTotal(rows);
  const categories = qualityCategories(rows);
  const chart = categories.map(([key,label]) => ({key,label,count:qualityCount(rows,key)}));
  const fmt = (n:number) => n.toLocaleString('en-GB');
  const percentage = (n:number) => total ? `${(n / total * 100).toFixed(1)}%` : '0.0%';
  const exportCsv = () => {
    const lines = [['Category','Type','Total','Share',...QUALITY_SOURCES.map(([,label])=>label)], ...[...categories.map(([key,label])=>({key,label,activity:false})), ...LEAD_ACTIVITIES.map(([key,label])=>({key,label,activity:true}))].map(({key,label,activity})=>[label,activity?'Overlapping activity':'Current status',qualityCount(rows,key,activity),percentage(qualityCount(rows,key,activity)),...QUALITY_SOURCES.map(([source])=>qualityCount(rows.filter(r=>r.source===source),key,activity))])];
    const csv = lines.map(line=>line.map(value=>`"${String(value).replaceAll('"','""')}"`).join(',')).join('\r\n');
    const url=URL.createObjectURL(new Blob([csv],{type:'text/csv;charset=utf-8;'}));
    const a=document.createElement('a'); a.href=url; a.download=`lead-quality-${from}-${to}.csv`; a.click(); URL.revokeObjectURL(url);
  };
  const renderTable = (items: readonly (readonly [string,string])[], activity=false) => <div className="overflow-x-auto"><table className="w-full text-sm"><thead><tr className="text-left text-muted-foreground">{['Category','Total','% of leads',...QUALITY_SOURCES.map(([,label])=>label)].map(label=><th key={label} className="py-3 pr-4 whitespace-nowrap">{label}</th>)}</tr></thead><tbody>{items.map(([key,label])=><tr key={key} className="border-t"><th className="py-2 pr-4 text-left font-medium whitespace-nowrap">{label}</th><td className="pr-4 font-semibold tabular-nums">{fmt(qualityCount(rows,key,activity))}</td><td className="pr-4 tabular-nums">{percentage(qualityCount(rows,key,activity))}</td>{QUALITY_SOURCES.map(([source])=><td key={source} className="pr-4 tabular-nums">{fmt(qualityCount(rows.filter(r=>r.source===source),key,activity))}</td>)}</tr>)}</tbody></table></div>;
  return <section className="space-y-4" aria-label="Detailed lead quality">
    <div className="flex flex-wrap items-center justify-between gap-3"><h3 className="text-xl font-semibold">Detailed lead quality</h3><Button variant="outline" size="sm" onClick={exportCsv} disabled={!data || !!error}><Download className="mr-2 h-4 w-4"/>Download CSV</Button></div>
    {isLoading ? <p role="status">Loading lead quality…</p> : error ? <p role="alert">Lead quality could not load. Try again or check your Lead count access.</p> : <>
      <p className="text-sm text-muted-foreground">Current outcomes for unique leads created or returning between {from} and {to}. This is separate from the locked daily counts above. {data?.as_of && `Updated ${new Date(data.as_of).toLocaleString('en-GB')}.`}</p>
      <div className="flex flex-wrap gap-x-8 gap-y-3"><p><strong className="text-2xl tabular-nums">{fmt(total)}</strong> unique leads</p><p><strong>{fmt(qualityCount(rows,'callback_booked'))}</strong> callbacks booked</p><p><strong>{fmt(qualityCount(rows,'converted'))}</strong> won</p><p><strong>{percentage(qualityCount(rows,'fake_lead'))}</strong> fake</p></div>
      {total === 0 ? <p>No leads in this period.</p> : <Card><CardHeader><CardTitle>Agent-set lead outcomes</CardTitle><CardDescription>One current status per lead. Counts and percentages include all leads, including fake and dead.</CardDescription></CardHeader><CardContent><ResponsiveContainer width="100%" height={chart.length * 34 + 40}><BarChart data={chart} layout="vertical" margin={{left:0,right:48,top:8,bottom:8}}><CartesianGrid stroke="hsl(var(--border))" strokeDasharray="3 3" horizontal={false}/><XAxis type="number" allowDecimals={false}/><YAxis type="category" dataKey="label" width={132} tick={{fontSize:11}} interval={0}/><Tooltip/><Bar dataKey="count" name="Leads" isAnimationActive={false}>{chart.map((r,i)=><Cell key={r.key} fill={`hsl(var(--lead-chart-${i % 6 + 1}))`}/>)}<LabelList dataKey="count" position="right" fill="hsl(var(--foreground))"/></Bar></BarChart></ResponsiveContainer>{renderTable(categories)}</CardContent></Card>}
      <Card><CardHeader><CardTitle>Callbacks, payments and activity</CardTitle><CardDescription>These categories overlap the statuses above; their totals should not be added together. Paid is a recorded payment flag, not revenue. Reminders are currently pending or snoozed.</CardDescription></CardHeader><CardContent>{renderTable(LEAD_ACTIVITIES,true)}</CardContent></Card>
    </>}
  </section>;
}