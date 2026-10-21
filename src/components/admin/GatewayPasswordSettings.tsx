import React, { useEffect, useState } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Button } from '@/components/ui/button';
import { KeyRound } from 'lucide-react';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { toast } from 'sonner';
import { gatewayRequest, GATEWAY_RECEIPT_KEY } from '@/lib/loginGateway';

export function GatewayPasswordSettings() {
  const [allowed, setAllowed] = useState(false);
  const [updatedAt, setUpdatedAt] = useState('');
  const [dueAt, setDueAt] = useState('');
  const [reason, setReason] = useState<'scheduled' | 'departure'>('scheduled');
  const [password, setPassword] = useState('');
  const [confirm, setConfirm] = useState('');
  const [busy, setBusy] = useState(false);
  useEffect(() => {
    let alive = true;
    gatewayRequest({ action: 'status' }).then(data => { if (alive) { setAllowed(data.can_manage === true); setUpdatedAt(data.updated_at); setDueAt(data.due_at); } }).catch(() => {});
    return () => { alive = false; };
  }, []);
  if (!allowed) return null;
  const save = async (event: React.FormEvent) => {
    event.preventDefault();
    if (password !== confirm) { toast.error('Passwords do not match'); return; }
    if (!window.confirm('Change the gateway for both login pages and email every active staff member? Previous gateway unlocks will expire. Personal passwords stay unchanged.')) return;
    setBusy(true);
    try {
      const data = await gatewayRequest({ action: 'change', password, reason });
      setUpdatedAt(data.updated_at); setDueAt(data.due_at); setPassword(''); setConfirm('');
      window.dispatchEvent(new Event('gateway-password-changed'));
      sessionStorage.removeItem(GATEWAY_RECEIPT_KEY);
      toast.success('Gateway password changed for both login pages');
      if (data.notice || data.notices?.failed) toast.warning('Gateway changed, but some email notices failed. Please resend reminders.');
      else toast.success(`Email notices sent to ${data.notices?.sent ?? 0} active staff`);
    } catch (e) { toast.error(e instanceof Error ? e.message : 'Unable to change password'); }
    finally { setBusy(false); }
  };
  const remind = async () => {
    if (!window.confirm('Email a password renewal reminder to every active staff member? No passwords will be included.')) return;
    setBusy(true);
    try { const data = await gatewayRequest({ action: 'remind' }); data.failed ? toast.warning(`${data.sent} notices sent; ${data.failed} failed`) : toast.success(`${data.sent} staff reminders sent`); }
    catch { toast.error('Unable to send staff reminders'); }
    finally { setBusy(false); }
  };
  return <Card><CardHeader><CardTitle className="flex items-center gap-2"><KeyRound className="h-5 w-5" />Gateway password — admin and staff login</CardTitle></CardHeader>
    <CardContent className="space-y-4">
      <p className="text-sm text-muted-foreground">One shared gateway for https://buyawarranty.co.uk/auth and https://buyawarranty.co.uk/sales-login. Admins choose a new gateway password every three months. Changing it emails all active staff to contact their manager; passwords are not emailed.</p>
      {updatedAt && <p className="text-xs text-muted-foreground">Last changed: {new Date(updatedAt).toLocaleString('en-GB')}</p>}
      {dueAt && <p className="text-sm font-medium">Next gateway renewal: {new Date(dueAt).toLocaleDateString('en-GB')}{Date.parse(dueAt) <= Date.now() ? ' — overdue' : ''}</p>}
      <p className="text-sm text-muted-foreground">Staff personal passwords are separate and require renewal every three months. For a leaver, deactivate their account first, then change the shared gateway below if needed.</p>
      <form onSubmit={save} className="space-y-4 max-w-lg">
        <div><Label>Reason for gateway change</Label><Select value={reason} onValueChange={value => setReason(value as 'scheduled' | 'departure')}><SelectTrigger><SelectValue /></SelectTrigger><SelectContent><SelectItem value="scheduled">Regular three-month renewal</SelectItem><SelectItem value="departure">Staff member has left</SelectItem></SelectContent></Select></div>
        <div><Label htmlFor="new-gateway-password">New gateway password</Label><Input id="new-gateway-password" type="password" autoComplete="new-password" minLength={12} maxLength={128} required value={password} onChange={e => setPassword(e.target.value)} /></div>
        <div><Label htmlFor="confirm-gateway-password">Confirm gateway password</Label><Input id="confirm-gateway-password" type="password" autoComplete="new-password" minLength={12} maxLength={128} required value={confirm} onChange={e => setConfirm(e.target.value)} /></div>
        <Button disabled={busy} type="submit"><KeyRound className="h-4 w-4 mr-2" />{busy ? 'Saving…' : 'Change gateway password'}</Button>
      </form>
      <Button type="button" variant="outline" disabled={busy} onClick={remind}>Email reminder to all active staff</Button>
    </CardContent></Card>;
}