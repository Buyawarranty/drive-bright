import React, { useEffect, useState } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Button } from '@/components/ui/button';
import { KeyRound } from 'lucide-react';
import { toast } from 'sonner';
import { gatewayRequest, GATEWAY_RECEIPT_KEY } from '@/lib/loginGateway';

export function GatewayPasswordSettings() {
  const [allowed, setAllowed] = useState(false);
  const [updatedAt, setUpdatedAt] = useState('');
  const [password, setPassword] = useState('');
  const [confirm, setConfirm] = useState('');
  const [busy, setBusy] = useState(false);
  useEffect(() => {
    let alive = true;
    gatewayRequest({ action: 'status' }).then(data => { if (alive) { setAllowed(data.can_manage === true); setUpdatedAt(data.updated_at); } }).catch(() => {});
    return () => { alive = false; };
  }, []);
  if (!allowed) return null;
  const save = async (event: React.FormEvent) => {
    event.preventDefault();
    if (password !== confirm) { toast.error('Passwords do not match'); return; }
    setBusy(true);
    try {
      const data = await gatewayRequest({ action: 'change', password });
      setUpdatedAt(data.updated_at); setPassword(''); setConfirm('');
      sessionStorage.removeItem(GATEWAY_RECEIPT_KEY);
      toast.success('Gateway password changed for both login pages');
    } catch (e) { toast.error(e instanceof Error ? e.message : 'Unable to change password'); }
    finally { setBusy(false); }
  };
  return <Card><CardHeader><CardTitle className="flex items-center gap-2"><KeyRound className="h-5 w-5" />Gateway password</CardTitle></CardHeader>
    <CardContent className="space-y-4">
      <p className="text-sm text-muted-foreground">Shared access password for /auth/ and /sales-login. Personal account passwords stay unchanged. Share the new password with your team; previous gateway unlocks expire when it changes.</p>
      {updatedAt && <p className="text-xs text-muted-foreground">Last changed: {new Date(updatedAt).toLocaleString('en-GB')}</p>}
      <form onSubmit={save} className="space-y-4 max-w-lg">
        <div><Label htmlFor="new-gateway-password">New gateway password</Label><Input id="new-gateway-password" type="password" autoComplete="new-password" minLength={12} maxLength={128} required value={password} onChange={e => setPassword(e.target.value)} /></div>
        <div><Label htmlFor="confirm-gateway-password">Confirm gateway password</Label><Input id="confirm-gateway-password" type="password" autoComplete="new-password" minLength={12} maxLength={128} required value={confirm} onChange={e => setConfirm(e.target.value)} /></div>
        <Button disabled={busy} type="submit"><KeyRound className="h-4 w-4 mr-2" />{busy ? 'Saving…' : 'Change gateway password'}</Button>
      </form>
    </CardContent></Card>;
}