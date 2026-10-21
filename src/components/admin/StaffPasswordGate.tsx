import { useCallback, useEffect, useState } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { KeyRound } from 'lucide-react';
import { toast } from 'sonner';

export function StaffPasswordGate({ children }: { children: React.ReactNode }) {
  const [state, setState] = useState<'loading' | 'ready' | 'expired' | 'error'>('loading');
  const [currentPassword, setCurrentPassword] = useState('');
  const [password, setPassword] = useState('');
  const [confirm, setConfirm] = useState('');
  const [busy, setBusy] = useState(false);
  const check = useCallback(async () => {
    const { data: sessionData } = await supabase.auth.getSession();
    if (!sessionData.session) { setState('ready'); return; }
    const { data, error } = await supabase.functions.invoke('staff-password', { body: { action: 'status' } });
    setState(error || data?.error ? 'error' : data?.must_change ? 'expired' : 'ready');
  }, []);
  useEffect(() => {
    void check();
    const timer = window.setInterval(check, 60000);
    window.addEventListener('focus', check);
    return () => { window.clearInterval(timer); window.removeEventListener('focus', check); };
  }, [check]);
  if (state === 'ready') return <>{children}</>;
  const save = async (event: React.FormEvent) => {
    event.preventDefault();
    if (password !== confirm) { toast.error('Passwords do not match'); return; }
    setBusy(true);
    const { data, error } = await supabase.functions.invoke('staff-password', { body: { action: 'change', currentPassword, password } });
    setBusy(false);
    if (error || data?.error) { toast.error(data?.error || 'Unable to change password. Check your current password.'); return; }
    setCurrentPassword(''); setPassword(''); setConfirm('');
    toast.success('Password renewed for three months');
    window.location.reload();
  };
  return <main className="min-h-screen bg-background text-foreground flex items-center justify-center p-6">
    <section className="w-full max-w-md space-y-5">
      <KeyRound className="h-8 w-8 text-primary" />
      <h1 className="text-2xl font-semibold">{state === 'expired' ? 'Renew your staff password' : state === 'error' ? 'Password check unavailable' : 'Checking staff access…'}</h1>
      {state === 'expired' && <><p className="text-muted-foreground">Your personal password needs updating every three months. Your gateway password is separate.</p>
        <form onSubmit={save} className="space-y-4">
          <div><Label htmlFor="renew-current">Current personal password</Label><Input id="renew-current" type="password" autoComplete="current-password" required value={currentPassword} onChange={e => setCurrentPassword(e.target.value)} /></div>
          <div><Label htmlFor="renew-new">New personal password</Label><Input id="renew-new" type="password" autoComplete="new-password" minLength={12} maxLength={128} required value={password} onChange={e => setPassword(e.target.value)} /></div>
          <div><Label htmlFor="renew-confirm">Confirm new password</Label><Input id="renew-confirm" type="password" autoComplete="new-password" minLength={12} maxLength={128} required value={confirm} onChange={e => setConfirm(e.target.value)} /></div>
          <Button type="submit" disabled={busy}>{busy ? 'Saving…' : 'Save new password'}</Button>
        </form></>}
      {state === 'error' && <Button onClick={check}>Retry access check</Button>}
      <Button variant="outline" onClick={async () => { await supabase.auth.signOut(); window.location.assign('/auth'); }}>Sign out</Button>
    </section>
  </main>;
}