import { useEffect, useMemo, useState } from 'react';
import { AlertTriangle, Laptop, MapPin } from 'lucide-react';
import { supabase } from '@/integrations/supabase/client';
import { Badge } from '@/components/ui/badge';
import { withTimeout } from '@/lib/withTimeout';
import { formatCrmAuditTime, type CrmAuditZone } from '@/lib/crmAuditTime';
import { computerCount, networkCount, offlineGaps, travelFlags, type DayLocation, type DaySession } from '@/lib/staffDayReport';

type Staff = { id: string; email: string; first_name: string | null; last_name: string | null };
const name = (s: Staff) => `${s.first_name || ''} ${s.last_name || ''}`.trim() || s.email;
const browser = (ua: string | null) => {
  if (!ua) return 'Unknown computer';
  const os = /Mac OS X/.test(ua) ? 'Mac' : /Windows/.test(ua) ? 'Windows PC' : /Android/.test(ua) ? 'Android' : /iPhone|iPad/.test(ua) ? 'iPhone/iPad' : /Linux/.test(ua) ? 'Linux' : 'Computer';
  const b = /Edg\//.test(ua) ? 'Edge' : /Chrome\/(\d+)/.exec(ua)?.[0].replace('/', ' ') || (/Firefox/.test(ua) ? 'Firefox' : /Safari/.test(ua) ? 'Safari' : 'browser');
  return `${os} · ${b}`;
};

export default function StaffDayReportPanel({ staff, sessions, from, to, zone }: { staff: Staff[]; sessions: DaySession[]; from: string; to: string; zone: CrmAuditZone }) {
  const [locations, setLocations] = useState<DayLocation[]>([]);
  const [failed, setFailed] = useState(false);
  const t = (iso: string | null | undefined) => formatCrmAuditTime(iso, zone);
  useEffect(() => {
    let cancelled = false;
    (async () => {
      try {
        const all: DayLocation[] = [];
        for (let offset = 0; offset < 5000; offset += 500) {
          const { data, error } = await withTimeout(supabase.from('staff_work_locations').select('id, admin_user_id, first_seen_at, last_seen_at, city, country, country_code, isp, ip_address, is_vpn, device_type, user_agent, latitude, longitude').gte('session_date', from).lte('session_date', to).order('first_seen_at').order('id').range(offset, offset + 499), 12000, 'Sign-in places');
          if (error) throw error;
          all.push(...((data || []) as DayLocation[]));
          if ((data?.length || 0) < 500) break;
        }
        if (!cancelled) { setLocations(all); setFailed(false); }
      } catch { if (!cancelled) setFailed(true); }
    })();
    return () => { cancelled = true; };
  }, [from, to]);

  const rows = useMemo(() => staff.map(s => {
    const locs = locations.filter(l => l.admin_user_id === s.id);
    const sess = sessions.filter(x => x.admin_user_id === s.id).sort((a, b) => a.started_at.localeCompare(b.started_at));
    return { s, locs, sess, flags: travelFlags(locs), gaps: offlineGaps(sess), computers: computerCount(locs), networks: networkCount(locs) };
  }).filter(r => r.locs.length || r.sess.length).sort((a, b) => b.flags.length - a.flags.length), [staff, locations, sessions]);

  const staffName = (id: string) => { const s = staff.find(x => x.id === id); return s ? name(s) : 'Former or unknown staff'; };
  const countries = useMemo(() => {
    const map = new Map<string, DayLocation[]>();
    for (const l of locations) { const k = l.country || 'Unknown country'; map.set(k, [...(map.get(k) || []), l]); }
    return [...map.entries()].map(([country, locs]) => ({ country, locs, people: [...new Set(locs.map(l => staffName(l.admin_user_id)))] }))
      .sort((a, b) => b.locs.length - a.locs.length);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [locations, staff]);
  return <section className="space-y-4 border-t pt-5">
    <div>
      <h2 className="font-semibold flex items-center gap-2"><MapPin className="h-4 w-4" />Daily sign-in report</h2>
      <p className="text-sm text-muted-foreground">Each person's sign-ins, sign-outs, time away, places, internet providers and computers. A red warning means two far-apart places at once or travel faster than a plane, which usually points to a VPN, a borrowed UK address or a shared login. "Not a VPN" only rules out well-known VPN companies. Identical computers with the same browser count as one.</p>
    </div>
    {failed && <p role="alert" className="text-sm text-destructive">Sign-in places could not load. Sessions are still shown.</p>}
    {countries.length > 0 && <div className="rounded-md border p-3 space-y-2">
      <h3 className="font-medium">Countries signed in from ({countries.length})</h3>
      {countries.map(c => <details key={c.country} className="rounded border p-2">
        <summary className="cursor-pointer flex flex-wrap items-center gap-2 text-sm">
          <span className="font-medium">{c.country}</span>
          <Badge variant="secondary">{c.people.length} {c.people.length === 1 ? 'person' : 'people'}</Badge>
          <Badge variant="secondary">{c.locs.length} sign-in record{c.locs.length === 1 ? '' : 's'}</Badge>
          <span className="text-muted-foreground">{c.people.join(', ')}</span>
        </summary>
        <div className="overflow-x-auto mt-2"><table className="w-full min-w-[640px] text-sm"><thead><tr className="text-left text-muted-foreground">{['Person', 'Place', 'First seen', 'Last seen', 'Internet provider'].map(h => <th key={h} className="py-1 font-medium">{h}</th>)}</tr></thead>
          <tbody>{c.locs.map(l => <tr key={l.id} className="border-t"><td className="py-1">{staffName(l.admin_user_id)}</td><td>{l.city || 'Unknown'}</td><td className="tabular-nums">{t(l.first_seen_at)}</td><td className="tabular-nums">{t(l.last_seen_at)}</td><td>{l.isp || '—'}</td></tr>)}</tbody></table></div>
      </details>)}
    </div>}
    {!rows.length && <p className="text-sm text-muted-foreground">No sign-ins in this period.</p>}
    {rows.map(r => <details key={r.s.id} open={r.flags.length > 0} className="rounded-md border p-3">
      <summary className="cursor-pointer flex flex-wrap items-center gap-2">
        <span className="font-medium">{name(r.s)}</span>
        <Badge variant="secondary"><Laptop className="mr-1 h-3 w-3" />{r.computers} computer{r.computers === 1 ? '' : 's'}</Badge>
        <Badge variant="secondary">{r.networks} internet connection{r.networks === 1 ? '' : 's'}</Badge>
        <Badge variant="secondary">{r.sess.length} session{r.sess.length === 1 ? '' : 's'}</Badge>
        {r.flags.length > 0 && <Badge variant="destructive"><AlertTriangle className="mr-1 h-3 w-3" />{r.flags.length} location warning{r.flags.length === 1 ? '' : 's'}</Badge>}
      </summary>
      <div className="mt-3 space-y-3 text-sm">
        {r.flags.map((f, i) => <p key={i} role="alert" className="rounded bg-destructive text-destructive-foreground p-2">
          {f.kind === 'same_time' ? 'Two places at once: ' : 'Impossible travel: '}
          {f.a.city || '?'}, {f.a.country || '?'} (until {t(f.a.last_seen_at || f.a.first_seen_at)}) → {f.b.city || '?'}, {f.b.country || '?'} (from {t(f.b.first_seen_at)}) · {f.km.toLocaleString()} km{f.kind === 'impossible_travel' ? ` in ${Math.round(f.hours * 60)} min` : ''}
        </p>)}
        {r.locs.length > 0 && <div className="overflow-x-auto"><table className="w-full min-w-[760px]"><thead><tr className="text-left text-muted-foreground">{['First seen', 'Last seen', 'Place', 'Internet provider', 'Address', 'VPN check', 'Computer'].map(h => <th key={h} className="py-1 font-medium">{h}</th>)}</tr></thead>
          <tbody>{r.locs.map(l => <tr key={l.id} className="border-t"><td className="py-2 tabular-nums">{t(l.first_seen_at)}</td><td className="tabular-nums">{t(l.last_seen_at)}</td><td>{[l.city, l.country].filter(Boolean).join(', ') || 'Unknown'}</td><td>{l.isp || '—'}</td><td className="tabular-nums">{l.ip_address || '—'}</td><td>{l.is_vpn ? <Badge variant="destructive">VPN found</Badge> : 'None found'}</td><td>{browser(l.user_agent)}</td></tr>)}</tbody></table></div>}
        {r.sess.length > 0 && <div className="overflow-x-auto"><table className="w-full min-w-[560px]"><thead><tr className="text-left text-muted-foreground">{['Signed in', 'Signed out / last seen', 'How it ended'].map(h => <th key={h} className="py-1 font-medium">{h}</th>)}</tr></thead>
          <tbody>{r.sess.map(x => <tr key={x.id} className="border-t"><td className="py-2 tabular-nums">{t(x.started_at)}</td><td className="tabular-nums">{t(x.ended_at || x.last_seen_at)}</td><td>{x.end_reason === 'logout' ? 'Signed out' : x.ended_at ? 'Left CRM' : 'Still connected or connection dropped'}</td></tr>)}</tbody></table></div>}
        {r.gaps.length > 0 && <p className="text-muted-foreground">Not signed in: {r.gaps.map(g => `${t(g.from)} – ${t(g.to)} (${g.minutes} min)`).join(' · ')}</p>}
      </div>
    </details>)}
  </section>;
}
