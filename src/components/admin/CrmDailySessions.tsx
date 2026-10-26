import { useMemo, useState } from 'react';
import { Button } from '@/components/ui/button';
import { formatCrmAuditTime, type CrmAuditZone } from '@/lib/crmAuditTime';
import { sessionOutcome, splitDailySessions, type CrmSession } from '@/lib/crmSessionTimeline';

interface Staff { id: string; email: string; first_name: string | null; last_name: string | null }
export default function CrmDailySessions({ staff, sessions, from, to, now, zone }: { staff: Staff[]; sessions: CrmSession[]; from: string; to: string; now: number; zone: CrmAuditZone }) {
  const [page, setPage] = useState(0);
  const [focus, setFocus] = useState<string | null>(null);
  const daily = useMemo(() => splitDailySessions(sessions.filter(session => staff.some(person => person.id === session.admin_user_id)), from, to, now, zone), [staff, sessions, from, to, now, zone]);
  const groups = useMemo(() => {
    const map = new Map<string, typeof daily>();
    for (const row of daily) { const key = `${row.day}:${row.session.admin_user_id}`; map.set(key, [...(map.get(key) || []), row]); }
    return [...map.entries()];
  }, [daily]);
  const safePage = Math.min(page, Math.max(0, Math.ceil(groups.length / 30) - 1));
  const details = focus ? daily.filter(row => `${row.day}:${row.session.admin_user_id}` === focus) : [];
  const name = (id: string) => { const person = staff.find(item => item.id === id); return person ? `${person.first_name || ''} ${person.last_name || ''}`.trim() || person.email : 'Staff account'; };
  const time = (value: number) => formatCrmAuditTime(new Date(value).toISOString(), zone);
  return <section className="space-y-4 border-t pt-5">
    <header className="flex flex-wrap justify-between gap-3"><h2 className="text-lg font-semibold">Daily session timeline</h2><span className="text-sm text-muted-foreground">{daily.length} daily session entries · {zone === 'UTC' ? 'GMT / UTC' : 'UK local time'}</span></header>
    <div className="flex flex-wrap gap-4 text-xs text-muted-foreground"><span className="flex items-center gap-2"><span className="h-2 w-5 bg-primary" />Recorded connection</span><span>Blank intervals: no recorded connection</span></div>
    <div className="overflow-x-auto"><div className="min-w-[700px]">
      <div className="grid grid-cols-[220px_1fr] border-b pb-2 text-xs text-muted-foreground"><span>Staff / day</span><div className="flex justify-between"><span>00:00</span><span>06:00</span><span>12:00</span><span>18:00</span><span>24:00</span></div></div>
      {groups.slice(safePage * 30, (safePage + 1) * 30).map(([key, entries]) => <div key={key} className="grid grid-cols-[220px_1fr] items-center border-b py-3 gap-1">
        <Button variant="ghost" className="h-auto justify-start text-left whitespace-normal" onClick={() => setFocus(focus === key ? null : key)} aria-expanded={focus === key}><span><span className="block font-semibold">{name(entries[0].session.admin_user_id)}</span><span className="block text-xs text-muted-foreground">{entries[0].day} · {entries.length} sessions</span></span></Button>
        <div className="relative min-h-9 bg-muted/50 rounded-sm" aria-label={`${name(entries[0].session.admin_user_id)} ${entries[0].day} timeline`}>
          {entries.map(row => <Button key={row.session.id} variant="default" className="absolute top-1 h-7 min-w-1 rounded-sm p-0" style={{ left: `${100 * (row.start - row.dayStart) / (row.dayEnd - row.dayStart)}%`, width: `${Math.max(0.3, 100 * (row.end - row.start) / (row.dayEnd - row.dayStart))}%`, maxWidth: `${100 - 100 * (row.start - row.dayStart) / (row.dayEnd - row.dayStart)}%` }} title={`${time(row.start)} – ${time(row.end)} · ${sessionOutcome(row.session, now)}`} aria-label={`Session ${time(row.start)} to ${time(row.end)}`} onClick={() => setFocus(key)} />)}
        </div>
      </div>)}
      {!groups.length && <p className="py-8 text-center text-muted-foreground">No recorded sessions for these staff and dates.</p>}
    </div></div>
    {groups.length > 30 && <div className="flex justify-end items-center gap-3"><Button variant="outline" size="sm" disabled={!safePage} onClick={() => setPage(safePage - 1)}>Previous</Button><span className="text-sm">{safePage + 1} / {Math.ceil(groups.length / 30)}</span><Button variant="outline" size="sm" disabled={(safePage + 1) * 30 >= groups.length} onClick={() => setPage(safePage + 1)}>Next</Button></div>}
    {!!details.length && <div className="overflow-x-auto"><h3 className="font-semibold mb-3">{name(details[0].session.admin_user_id)} · {details[0].day}</h3><table className="w-full min-w-[800px] text-sm"><thead><tr className="border-b text-left text-muted-foreground">{['CRM opened / resumed', 'Last recorded connection', 'Session outcome', 'Last section'].map(label => <th key={label} className="p-3 font-medium">{label}</th>)}</tr></thead><tbody>{details.map(row => <tr key={row.session.id} className="border-b"><td className="p-3">{time(row.start)}{row.continued && <span className="block text-xs text-muted-foreground">Continued from {formatCrmAuditTime(row.session.started_at, zone)}</span>}</td><td className="p-3">{time(row.end)}</td><td className="p-3">{row.end === row.dayEnd ? 'Continued into next day' : sessionOutcome(row.session, now)}</td><td className="p-3 capitalize">{row.session.current_tab?.replaceAll('-', ' ') || '—'}</td></tr>)}</tbody></table></div>}
  </section>;
}