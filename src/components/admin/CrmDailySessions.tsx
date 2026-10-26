import { useMemo, useState } from 'react';
import { Button } from '@/components/ui/button';
import { Tabs, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { formatCrmAuditTime, type CrmAuditZone } from '@/lib/crmAuditTime';
import { sessionOutcome, type CrmSession } from '@/lib/crmSessionTimeline';
import { activityDuration, dailyStaffActivity, groupActivityByAgent, observedIdleSpans, type ActivityDay, type StaffActivityDay } from '@/lib/crmDailyActivity';

interface Staff { id: string; email: string; first_name: string | null; last_name: string | null }
const ROWS_PER_PAGE = 30;
const AGENTS_PER_PAGE = 8;

export default function CrmDailySessions({ staff, sessions, days = [], from, to, now, zone }: { staff: Staff[]; sessions: CrmSession[]; days?: ActivityDay[]; from: string; to: string; now: number; zone: CrmAuditZone }) {
  const [page, setPage] = useState(0);
  const [agentPage, setAgentPage] = useState(0);
  const [focus, setFocus] = useState<string | null>(null);
  const [view, setView] = useState('totals');
  const [grouping, setGrouping] = useState<'agent' | 'day'>('agent');
  const groups = useMemo(() => dailyStaffActivity(staff.map(person => person.id), sessions, days, from, to, now, zone), [staff, sessions, days, from, to, now, zone]);
  const agents = useMemo(() => groupActivityByAgent(groups), [groups]);
  const safePage = Math.min(page, Math.max(0, Math.ceil(groups.length / ROWS_PER_PAGE) - 1));
  const safeAgentPage = Math.min(agentPage, Math.max(0, Math.ceil(agents.length / AGENTS_PER_PAGE) - 1));
  const selected = groups.find(row => row.key === focus);
  const name = (id: string) => { const person = staff.find(item => item.id === id); return person ? `${person.first_name || ''} ${person.last_name || ''}`.trim() || person.email : 'Staff account'; };
  const time = (value: number) => formatCrmAuditTime(new Date(value).toISOString(), zone);
  const clock = (value: number) => new Intl.DateTimeFormat('en-GB', { timeZone: zone, hour: '2-digit', minute: '2-digit', second: '2-digit', hourCycle: 'h23' }).format(value);
  const maxSeconds = Math.max(3600, ...groups.map(row => row.activeSeconds + row.idleSeconds));
  const position = (start: number, end: number, dayStart: number, dayEnd: number) => ({ left: `${100 * (start - dayStart) / (dayEnd - dayStart)}%`, width: `${100 * (end - start) / (dayEnd - dayStart)}%` });
  const bar = (row: StaffActivityDay) => <div className="relative min-h-9 rounded-sm bg-secondary" role="img" aria-label={`${name(row.staffId)} ${row.day}: active ${activityDuration(row.activeSeconds)}, available idle ${activityDuration(row.idleSeconds)}`}>
    {view === 'totals' ? <div className="absolute inset-0 flex items-center"><span className="h-7 bg-success" style={{ width: `${100 * row.activeSeconds / maxSeconds}%` }} /><span className="h-7 bg-primary" style={{ width: `${100 * row.idleSeconds / maxSeconds}%` }} /></div> : <>
      {row.sessions.map(entry => <Button key={entry.session.id} variant="ghost" className="absolute top-1 h-7 min-h-0 min-w-0 rounded-sm p-0 bg-muted-foreground/30 hover:bg-muted-foreground/50" style={position(entry.start, entry.end, entry.dayStart, entry.dayEnd)} title={`${time(entry.start)} – ${time(entry.end)} · ${sessionOutcome(entry.session, now)}`} aria-label={`Session ${time(entry.start)} to ${time(entry.end)}`} onClick={() => setFocus(row.key)} />)}
      {row.idle.map((span, i) => { const entry = row.sessions[0]; return entry ? <span key={i} className="absolute top-1 h-7 bg-primary pointer-events-none" style={position(span.start, span.end, entry.dayStart, entry.dayEnd)} /> : null; })}
    </>}
  </div>;
  const figures = (row: StaffActivityDay) => <div className="text-xs tabular-nums"><span className="block font-semibold">Active {activityDuration(row.activeSeconds)}</span><span className="block">Idle evidence {activityDuration(row.idleSeconds)}</span><span className="block text-muted-foreground">{row.sessions.length ? `${clock(row.sessions[0].start)} – ${clock(Math.max(...row.sessions.map(entry => entry.end)))}` : 'No recorded sessions'}</span></div>;
  return <section className="space-y-4 border-t pt-5">
    <header className="flex flex-wrap items-start justify-between gap-3"><div><h2 className="text-lg font-semibold">Daily staff activity</h2><span className="text-sm text-muted-foreground">{agents.length} staff · {groups.length} staff-day entries · {zone === 'UTC' ? 'GMT / UTC' : 'UK local time'}</span></div><div className="flex flex-wrap gap-3"><Tabs value={grouping} onValueChange={value => setGrouping(value as 'agent' | 'day')}><TabsList><TabsTrigger value="agent">Each agent</TabsTrigger><TabsTrigger value="day">By day</TabsTrigger></TabsList></Tabs><Tabs value={view} onValueChange={setView}><TabsList><TabsTrigger value="totals">Daily totals</TabsTrigger><TabsTrigger value="timeline">Session timeline</TabsTrigger></TabsList></Tabs></div></header>
    <div className="flex flex-wrap gap-4 text-xs text-muted-foreground"><span className="flex items-center gap-2"><span className="h-3 w-5 bg-success" />Recorded active total</span><span className="flex items-center gap-2"><span className="h-3 w-5 bg-primary" />Available idle evidence</span><span className="flex items-center gap-2"><span className="h-3 w-5 bg-muted-foreground/30" />Recorded connection · activity detail unavailable</span></div>
    <p className="text-xs text-muted-foreground">Active totals use UK calendar days. Historical records retain only first and last interactions: orange marks connected time after the final interaction plus 60 seconds, not the full day's idle time. Blank time has no recorded connection; it is not confirmed sign-out.</p>
    <div className="overflow-x-auto"><div className="min-w-[800px]">
      <div className="grid grid-cols-[220px_1fr_220px] gap-3 border-b pb-2 text-xs text-muted-foreground"><span>{grouping === 'agent' ? 'Agent · day' : 'Staff / day'}</span><div className="flex justify-between">{view === 'timeline' ? <><span>00:00</span><span>06:00</span><span>12:00</span><span>18:00</span><span>24:00</span></> : <><span>0h</span><span>{activityDuration(maxSeconds)} · common scale</span></>}</div><span>Active / available idle</span></div>
      {grouping === 'agent' ? agents.slice(safeAgentPage * AGENTS_PER_PAGE, (safeAgentPage + 1) * AGENTS_PER_PAGE).map(agent => <div key={agent.staffId} className="border-b py-3">
        <div className="flex flex-wrap items-baseline justify-between gap-2 pb-2"><span className="font-semibold">{name(agent.staffId)}</span><span className="text-xs text-muted-foreground tabular-nums">{agent.days.length} days · {agent.sessionCount} sessions · Active {activityDuration(agent.activeSeconds)} · Idle evidence {activityDuration(agent.idleSeconds)}</span></div>
        {agent.days.map(row => <div key={row.key} className="grid grid-cols-[220px_1fr_220px] gap-3 items-center border-t py-2">
          <Button variant="ghost" className="h-auto justify-start text-left" onClick={() => setFocus(focus === row.key ? null : row.key)} aria-expanded={focus === row.key}><span className="block font-semibold">{row.day}</span><span className="block text-xs text-muted-foreground">{row.sessions.length} sessions</span></Button>
          {bar(row)}
          {figures(row)}
        </div>)}
      </div>) : groups.slice(safePage * ROWS_PER_PAGE, (safePage + 1) * ROWS_PER_PAGE).map(row => <div key={row.key} className="grid grid-cols-[220px_1fr_220px] gap-3 items-center border-b py-3">
        <Button variant="ghost" className="h-auto justify-start text-left whitespace-normal" onClick={() => setFocus(focus === row.key ? null : row.key)} aria-expanded={focus === row.key}><span><span className="block font-semibold">{name(row.staffId)}</span><span className="block text-xs text-muted-foreground">{row.day} · {row.sessions.length} sessions</span></span></Button>
        {bar(row)}
        {figures(row)}
      </div>)}
      {!groups.length && <p className="py-8 text-center text-muted-foreground">No staff match these filters.</p>}
    </div></div>
    {grouping === 'agent' ? agents.length > AGENTS_PER_PAGE && <div className="flex justify-end items-center gap-3"><Button variant="outline" size="sm" disabled={!safeAgentPage} onClick={() => setAgentPage(safeAgentPage - 1)}>Previous</Button><span className="text-sm">{safeAgentPage + 1} / {Math.ceil(agents.length / AGENTS_PER_PAGE)}</span><Button variant="outline" size="sm" disabled={(safeAgentPage + 1) * AGENTS_PER_PAGE >= agents.length} onClick={() => setAgentPage(safeAgentPage + 1)}>Next</Button></div> : groups.length > ROWS_PER_PAGE && <div className="flex justify-end items-center gap-3"><Button variant="outline" size="sm" disabled={!safePage} onClick={() => setPage(safePage - 1)}>Previous</Button><span className="text-sm">{safePage + 1} / {Math.ceil(groups.length / ROWS_PER_PAGE)}</span><Button variant="outline" size="sm" disabled={(safePage + 1) * ROWS_PER_PAGE >= groups.length} onClick={() => setPage(safePage + 1)}>Next</Button></div>}
    {selected && <div className="overflow-x-auto"><h3 className="font-semibold mb-3">{name(selected.staffId)} · {selected.day}</h3>{!selected.sessions.length ? <p className="text-sm text-muted-foreground">No recorded sessions for this staff member on this day.</p> : <table className="w-full min-w-[1100px] text-sm"><thead><tr className="border-b text-left text-muted-foreground">{['CRM opened / resumed', 'First interaction', 'Last interaction', 'Available idle window', 'Last recorded connection', 'Session outcome'].map(label => <th key={label} className="p-3 font-medium">{label}</th>)}</tr></thead><tbody>{selected.sessions.map(row => { const idle = observedIdleSpans([row]); return <tr key={row.session.id} className="border-b"><td className="p-3">{time(row.start)}{row.continued && <span className="block text-xs text-muted-foreground">Continued from {formatCrmAuditTime(row.session.started_at, zone)}</span>}</td><td className="p-3">{formatCrmAuditTime(row.session.first_activity_at, zone)}</td><td className="p-3">{formatCrmAuditTime(row.session.last_activity_at, zone)}</td><td className="p-3">{idle.length ? <>{clock(idle[0].start)} – {clock(idle[0].end)}<span className="block text-xs text-muted-foreground">{activityDuration((idle[0].end - idle[0].start) / 1000)} · session evidence</span></> : 'Not available'}</td><td className="p-3">{time(row.end)}</td><td className="p-3">{row.end === row.dayEnd ? 'Continued into next day' : sessionOutcome(row.session, now)}</td></tr>; })}</tbody></table>}</div>}
  </section>;
}
