import { useEffect, useState } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { withTimeout } from '@/lib/withTimeout';
import { formatCrmAuditTime, type CrmAuditZone } from '@/lib/crmAuditTime';
import { Button } from '@/components/ui/button';
import { RefreshCw } from 'lucide-react';

interface AuditEvent { id: string; created_at: string; event: string; ip_address: string | null; email: string; name: string; is_active: boolean }
const labels: Record<string, string> = { login: 'Signed in', logout: 'Signed out', user_updated_password: 'Password changed', user_recovery_requested: 'Password recovery requested' };

export default function StaffSigninAudit({ from, to, zone }: { from: string; to: string; zone: CrmAuditZone }) {
  const [events, setEvents] = useState<AuditEvent[]>([]);
  const [offset, setOffset] = useState(0);
  const [more, setMore] = useState(false);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const [refresh, setRefresh] = useState(0);
  useEffect(() => { setOffset(0); }, [from, to]);
  useEffect(() => {
    let cancelled = false;
    setLoading(true);
    setEvents([]);
    void (async () => {
      try {
        const { data, error: requestError } = await withTimeout(supabase.functions.invoke('crm-attendance', { body: { action: 'audit', from, to, offset } }), 12000, 'Sign-in history');
        if (requestError || data?.error) throw new Error('Unavailable');
        if (!cancelled) { setEvents((data?.events || []).slice(0, 200)); setMore(data?.has_more === true); setError(''); }
      } catch { if (!cancelled) setError('Sign-in history unavailable or access denied.'); }
      finally { if (!cancelled) setLoading(false); }
    })();
    return () => { cancelled = true; };
  }, [from, to, offset, refresh]);
  return <section className="space-y-4">
    <header className="flex flex-wrap items-center justify-between gap-3"><h2 className="text-lg font-semibold">Staff sign-in history</h2><Button size="sm" variant="outline" disabled={loading} onClick={() => setRefresh(value => value + 1)}><RefreshCw className="mr-2 h-4 w-4" />Refresh</Button></header>
    <p className="text-sm text-muted-foreground">Recorded authentication events · active and inactive staff · {zone === 'UTC' ? 'GMT / UTC' : 'UK local time (GMT / BST)'}</p>
    <p className="text-sm text-muted-foreground">Shared logins identify the account, not the individual. Failed or anonymous attempts are not included in this historical feed; an IP address or successful sign-in alone does not establish unauthorised access.</p>
    {error && <p role="alert" className="text-destructive">{error}</p>}
    <div className="overflow-x-auto"><table className="w-full min-w-[700px] text-sm"><thead><tr className="border-b text-left text-muted-foreground">{['Time', 'Staff account', 'Event', 'IP address', 'Current access'].map(label => <th key={label} className="p-3 font-medium">{label}</th>)}</tr></thead><tbody>{events.map(event => <tr key={event.id} className="border-b"><td className="p-3 whitespace-nowrap">{formatCrmAuditTime(event.created_at, zone)}</td><td className="p-3"><div>{event.name || event.email}</div><div className="text-xs text-muted-foreground">{event.email}</div></td><td className="p-3">{labels[event.event] || event.event}</td><td className="p-3 font-mono">{event.ip_address || 'Not recorded'}</td><td className="p-3">{event.is_active ? 'Enabled' : 'Disabled'}</td></tr>)}{!events.length && <tr><td colSpan={5} className="p-8 text-center text-muted-foreground">{loading ? 'Loading sign-in history…' : error ? 'History unavailable.' : 'No recorded staff sign-ins in this period.'}</td></tr>}</tbody></table></div>
    <div className="flex justify-end gap-2"><Button variant="outline" size="sm" disabled={loading || offset === 0} onClick={() => setOffset(value => Math.max(0, value - 200))}>Previous</Button><Button variant="outline" size="sm" disabled={loading || !more} onClick={() => setOffset(value => value + 200)}>Next</Button></div>
  </section>;
}