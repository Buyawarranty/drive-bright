import React, { useState } from 'react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Button } from '@/components/ui/button';
import { Label } from '@/components/ui/label';
import { Lock, Eye, EyeOff } from 'lucide-react';
import { gatewayRequest, GATEWAY_RECEIPT_KEY } from '@/lib/loginGateway';

export function LoginGateway({ onUnlock }: { onUnlock: () => void }) {
  const [password, setPassword] = useState('');
  const [visible, setVisible] = useState(false);
  const [error, setError] = useState('');
  const [busy, setBusy] = useState(false);
  const submit = async (event: React.FormEvent) => {
    event.preventDefault(); setBusy(true); setError('');
    try {
      const data = await gatewayRequest({ action: 'verify', password });
      if (data.valid && typeof data.token === 'string') {
        sessionStorage.setItem(GATEWAY_RECEIPT_KEY, data.token);
        setPassword(''); onUnlock();
      } else {
        setError(data.retry_after_seconds ? `Too many attempts. Try again in ${Math.ceil(data.retry_after_seconds / 60)} minutes.` : 'Incorrect password');
        setPassword('');
      }
    } catch (e) { setError(e instanceof Error ? e.message : 'Unable to check gateway access'); }
    finally { setBusy(false); }
  };
  return <div className="min-h-screen bg-background flex items-center justify-center p-4">
    <Card className="w-full max-w-md">
      <CardHeader className="text-center">
        <Lock className="h-8 w-8 text-primary mx-auto mb-4" />
        <CardTitle>Protected area</CardTitle><CardDescription>This page requires a password to access</CardDescription>
      </CardHeader>
      <CardContent><p role="note" className="mb-4 text-sm text-muted-foreground">If the gateway password has been updated, please contact your manager for the current password.</p><form onSubmit={submit} className="space-y-4">
        <div><Label htmlFor="gateway-password">Gateway password</Label><div className="relative">
          <Input id="gateway-password" type={visible ? 'text' : 'password'} value={password} onChange={e => { setPassword(e.target.value); setError(''); }} required maxLength={128} autoComplete="current-password" className="pr-12" />
          <Button type="button" variant="ghost" size="icon" className="absolute right-1 top-1/2 -translate-y-1/2" aria-label={visible ? 'Hide password' : 'Show password'} onClick={() => setVisible(!visible)}>{visible ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}</Button>
        </div></div>
        {error && <p role="alert" className="text-sm text-destructive">{error}</p>}
        <Button type="submit" className="w-full" disabled={busy}>{busy ? 'Checking…' : 'Unlock'}</Button>
      </form><div className="mt-6 text-center"><a href="/" className="text-sm text-muted-foreground">← Back to homepage</a></div></CardContent>
    </Card>
  </div>;
}