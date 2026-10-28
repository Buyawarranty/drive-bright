import { useCallback, useEffect, useState } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Badge } from '@/components/ui/badge';
import { AlertTriangle, Check, RefreshCw, ShieldCheck, X } from 'lucide-react';
import { formatCrmAuditTime, type CrmAuditZone } from '@/lib/crmAuditTime';
import { withTimeout } from '@/lib/withTimeout';
import { toast } from 'sonner';

interface Device { id: string; email: string; device_label: string; status: string; requested_at: string; approved_at: string | null; last_seen_at: string | null }
interface Attempt { id: string; attempted_email: string; outcome: string; ip_address: string | null; city: string | null; country: string | null; device_label: string | null; account_online: boolean; created_at: string }
interface Report { enabled: boolean; devices: Device[]; attempts: Attempt[]; alerts: Attempt[] }
const outcomes: Record<string, string> = { signin_allowed: 'Sign-in allowed', device_blocked: 'Device blocked', invalid_credentials: 'Wrong credentials', inactive_account: 'Inactive account blocked' };

export default function StaffDeviceSecurityPanel({ from, to, zone = 'UTC', alertsOnly = false }: { from: string; to: string; zone?: CrmAuditZone; alertsOnly?: boolean }) {
  const [report, setReport] = useState<Report>();
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);
  const [query, setQuery] = useState('');
  const [offset, setOffset] = useState(0);
  const load = useCallback(async () => {
    if (document.hidden) return;
    setLoading(true);
    try {
      const { data, error: requestError } = await withTimeout(supabase.functions.invoke('staff-device-access', { body: { action: 'report', from, to, offset } }), 12000, 'Staff security log');
      if (requestError || data?.error) throw new Error('Unavailable');
      setReport(data); setError('');
    } catch { setError('Staff security log unavailable.'); }
    finally { setLoading(false); }
  }, [from, to, offset]);
  useEffect(() => { setOffset(0); }, [from, to]);
  useEffect(() => { void load(); const timer = setInterval(() => void load(), 30000); return () => clearInterval(timer); }, [load]);
  const action = async (body: Record<string, unknown>) => {
    const { error: requestError, data } = await supabase.functions.invoke('staff-device-access', { body });
    if (requestError || data?.error) { toast.error('Unable to update staff security record.'); return; }
    toast.success('Staff security record updated'); void load();
  };
  if (alertsOnly) return report?.alerts.length ? <section role="alert" className="border border-destructive bg-destructive/10 p-4 space-y-3"><h2 className="font-semibold flex items-center gap-2"><AlertTriangle className="h-5 w-5 text-destructive" />Staff sign-in alerts</h2>{report.alerts.slice(0, 3).map(attempt => <div className="flex flex-wrap justify-between gap-2" key={attempt.id}><p className="text-sm"><strong>{attempt.attempted_email}</strong> · {outcomes[attempt.outcome]} · {formatCrmAuditTime(attempt.created_at, zone)} GMT · {attempt.ip_address || 'IP not recorded'} · Account {attempt.account_online ? 'was online' : 'had no recent CRM connection'}</p><Button size="sm" variant="outline" onClick={() => void action({ action: 'acknowledge', attempt: attempt.id })}>Acknowledge</Button></div>)}</section> : null;
  const matches = (value: string) => value.toLowerCase().includes(query.toLowerCase());
  const attempts = (report?.attempts || []).slice(0, 200).filter(attempt => matches(`${attempt.attempted_email} ${attempt.ip_address} ${attempt.city} ${attempt.country}`));
  return <section className="space-y-6">
    <header className="flex flex-wrap justify-between gap-3"><h2 className="text-lg font-semibold flex items-center gap-2"><ShieldCheck className="h-5 w-5" />Devices & sign-in attempts</h2><Button variant="outline" size="sm" disabled={loading} onClick={() => void load()}><RefreshCw className="mr-2 h-4 w-4" />Refresh</Button></header>
    <p className="text-sm border-l-4 border-primary pl-3">{report?.enabled ? 'Approved-device restriction is active.' : 'One login per staff account is active: a new sign-in signs out that account everywhere else. Approved-device restriction is still being prepared and is not active yet.'}</p>
    {error && <p role="alert" className="text-destructive">{error}</p>}
    <Input aria-label="Search access attempts" placeholder="Search staff account, IP or location" value={query} onChange={event => setQuery(event.target.value)} className="max-w-sm" />
    <section className="space-y-3"><h3 className="font-semibold">Device approval requests</h3><p className="text-sm text-muted-foreground">Verify the staff member and device through a separate trusted contact before approving. Browser labels are supplied by the requester; approval trusts this browser credential, not a physical computer.</p><div className="overflow-x-auto"><table className="w-full min-w-[650px] text-sm"><thead><tr className="border-b text-left text-muted-foreground">{['Account', 'Browser / device label', 'Requested', 'Status', 'Decision'].map(label => <th className="p-3 font-medium" key={label}>{label}</th>)}</tr></thead><tbody>{report?.devices.filter(device => matches(`${device.email} ${device.device_label}`)).map(device => <tr className="border-b" key={device.id}><td className="p-3">{device.email}</td><td className="p-3">{device.device_label}</td><td className="p-3 whitespace-nowrap">{formatCrmAuditTime(device.requested_at, zone)}</td><td className="p-3"><Badge variant="outline">{device.status}</Badge></td><td className="p-3"><div className="flex gap-2">{device.status !== 'approved' && <Button size="sm" variant="outline" onClick={() => { if (window.confirm(`Approve this browser for ${device.email}? Verify its owner first.`)) void action({ action: 'decide', device: device.id, approve: true }); }}><Check className="mr-1 h-4 w-4" />Approve</Button>}{device.status !== 'revoked' && <Button size="sm" variant="outline" onClick={() => { if (window.confirm(`Revoke this browser for ${device.email}?`)) void action({ action: 'decide', device: device.id, approve: false }); }}><X className="mr-1 h-4 w-4" />Revoke</Button>}</div></td></tr>)}</tbody></table></div></section>
    <section className="space-y-3"><h3 className="font-semibold">Sign-in attempt log</h3><p className="text-sm text-muted-foreground">{zone === 'UTC' ? 'GMT / UTC' : 'UK local time'} · online state is measured from recent CRM connections, not proof of who attempted the login. New IP locations show “Not recorded” unless already known.</p><div className="overflow-x-auto"><table className="w-full min-w-[900px] text-sm"><thead><tr className="border-b text-left text-muted-foreground">{['Time', 'Account attempted', 'Result', 'Account at that time', 'IP / approximate location', 'Device'].map(label => <th className="p-3 font-medium" key={label}>{label}</th>)}</tr></thead><tbody>{attempts.map(attempt => <tr key={attempt.id} className="border-b"><td className="p-3 whitespace-nowrap">{formatCrmAuditTime(attempt.created_at, zone)}</td><td className="p-3">{attempt.attempted_email}</td><td className="p-3">{outcomes[attempt.outcome] || attempt.outcome}</td><td className="p-3">{attempt.account_online ? 'Online' : 'No recent CRM connection'}</td><td className="p-3"><div className="font-mono text-xs">{attempt.ip_address || 'Not recorded'}</div><div>{[attempt.city, attempt.country].filter(Boolean).join(', ') || 'Location not recorded'}</div></td><td className="p-3">{attempt.device_label || 'Not recorded'}</td></tr>)}{!attempts.length && <tr><td colSpan={6} className="p-8 text-center text-muted-foreground">{loading ? 'Loading attempts…' : 'No attempts recorded for this period.'}</td></tr>}</tbody></table></div><div className="flex justify-end gap-2"><Button size="sm" variant="outline" disabled={loading || offset === 0} onClick={() => setOffset(value => Math.max(0, value - 200))}>Previous</Button><Button size="sm" variant="outline" disabled={loading || (report?.attempts.length || 0) <= 200} onClick={() => setOffset(value => value + 200)}>Next</Button></div></section>
  </section>;
}