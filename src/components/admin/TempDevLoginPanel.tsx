import React, { useEffect, useState } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Badge } from '@/components/ui/badge';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Clock, Copy, Check, Timer, Trash2, UserPlus } from 'lucide-react';
import { supabase } from '@/integrations/supabase/client';
import { toast } from 'sonner';

interface TempLoginRow {
  id: string;
  email: string;
  first_name: string | null;
  last_name: string | null;
  role: string;
  is_active: boolean;
  access_expires_at: string | null;
}

const randomPassword = () => {
  const chars = 'ABCDEFGHJKLMNPQRSTUVWXYZabcdefghijkmnopqrstuvwxyz23456789';
  let out = '';
  for (let i = 0; i < 12; i++) out += chars[Math.floor(Math.random() * chars.length)];
  return `${out}!7`;
};

const tempLoginUrlForRole = (role: string) =>
  ['admin', 'super_admin', 'dev_tester'].includes(role)
    ? 'https://buyawarranty.co.uk/auth'
    : 'https://buyawarranty.co.uk/sales-login';

interface Props {
  /** All dashboard section ids (blocked ones are filtered server-side). */
  allTabIds: string[];
}

export const TempDevLoginPanel: React.FC<Props> = ({ allTabIds }) => {
  const [email, setEmail] = useState('tempdev1@baw.dev');
  const [firstName, setFirstName] = useState('Temp');
  const [lastName, setLastName] = useState('Developer');
  const [days, setDays] = useState('2');
  const [role, setRole] = useState('admin');
  const [password, setPassword] = useState(randomPassword());
  const [saving, setSaving] = useState(false);
  const [copied, setCopied] = useState(false);
  const [rows, setRows] = useState<TempLoginRow[]>([]);

  const load = async () => {
    const { data } = await supabase
      .from('admin_users')
      .select('id, email, first_name, last_name, role, is_active, access_expires_at')
      .or('is_temp_access.eq.true,access_expires_at.not.is.null')
      .order('access_expires_at', { ascending: false });
    setRows((data as any as TempLoginRow[]) || []);
  };

  useEffect(() => { load(); }, []);

  const create = async () => {
    if (password.trim().length < 8) {
      toast.error('Password must be at least 8 characters.');
      return;
    }
    setSaving(true);
    try {
      const { data, error } = await supabase.functions.invoke('provision-temp-login', {
        body: {
          email: email.trim().toLowerCase(),
          password: password.trim(),
          firstName: firstName.trim(),
          lastName: lastName.trim(),
          days: Number(days),
          role,
          tabIds: allTabIds,
        },
      });
      if (error) throw error;
      if ((data as any)?.error) throw new Error((data as any).error);
      toast.success(`Temp login live for ${email} — expires ${new Date((data as any).expiresAt).toLocaleString('en-GB')}`);
      await copyBlock();
      load();
    } catch (e: any) {
      toast.error(e?.message || 'Could not create the temporary login.');
    } finally {
      setSaving(false);
    }
  };

  const copyBlock = async () => {
    const loginUrl = tempLoginUrlForRole(role);
    const block = `Temporary dashboard login\n\nStep 1 — Gateway / firewall\nURL: ${loginUrl}\nPassword: SmashSales2026!!\n\nStep 2 — Supabase Auth login\nUsername: ${email.trim().toLowerCase()}\nPassword: ${password.trim()}\n\nExpires in: ${days} day(s)`;
    await navigator.clipboard.writeText(block).catch(() => {});
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  const revoke = async (row: TempLoginRow) => {
    if (!confirm(`Revoke access for ${row.email} now?`)) return;
    const { error } = await supabase
      .from('admin_users')
      .update({ is_active: false, access_expires_at: new Date().toISOString() } as any)
      .eq('id', row.id);
    if (error) { toast.error(error.message); return; }
    toast.success('Access revoked.');
    load();
  };

  const extend = async (row: TempLoginRow, extraDays: number) => {
    const base = row.access_expires_at && new Date(row.access_expires_at).getTime() > Date.now()
      ? new Date(row.access_expires_at).getTime()
      : Date.now();
    const next = new Date(base + extraDays * 86400000).toISOString();
    const { error } = await supabase
      .from('admin_users')
      .update({ is_active: true, access_expires_at: next } as any)
      .eq('id', row.id);
    if (error) { toast.error(error.message); return; }
    toast.success(`Extended to ${new Date(next).toLocaleString('en-GB')}`);
    load();
  };

  const remaining = (iso: string | null) => {
    if (!iso) return '—';
    const ms = new Date(iso).getTime() - Date.now();
    if (ms <= 0) return 'Expired';
    const hrs = Math.round(ms / 3600000);
    return hrs >= 24 ? `${Math.floor(hrs / 24)}d ${hrs % 24}h left` : `${hrs}h left`;
  };

  return (
    <Card className="border-blue-300 bg-blue-50/40">
      <CardHeader>
        <CardTitle className="flex items-center gap-2">
          <Timer className="h-5 w-5 text-blue-600" />
          Temporary developer logins
          <Badge variant="outline" className="ml-2 text-xs bg-blue-100 text-blue-700 border-blue-300">Super Admin Only</Badge>
        </CardTitle>
      </CardHeader>
      <CardContent className="space-y-4">
        <p className="text-sm text-muted-foreground">
          Creates a working dashboard login straight away — no real mailbox needed, so a made-up address
          such as <code className="font-mono">tempdev1@baw.dev</code> is fine. Access switches itself off
          on the expiry date, and you can revoke or extend at any time. Admin temporary logins use the
          two-step <code className="font-mono">/auth</code> firewall first, then the Supabase Auth login.
        </p>

        <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
          <div>
            <Label className="text-xs">Login username (email format)</Label>
            <Input value={email} onChange={e => setEmail(e.target.value)} className="font-mono text-sm" />
          </div>
          <div>
            <Label className="text-xs">First name</Label>
            <Input value={firstName} onChange={e => setFirstName(e.target.value)} />
          </div>
          <div>
            <Label className="text-xs">Last name</Label>
            <Input value={lastName} onChange={e => setLastName(e.target.value)} />
          </div>
          <div>
            <Label className="text-xs">Password</Label>
            <div className="flex gap-2">
              <Input value={password} onChange={e => setPassword(e.target.value)} className="font-mono text-sm" />
              <Button type="button" variant="outline" onClick={() => setPassword(randomPassword())}>New</Button>
            </div>
          </div>
          <div>
            <Label className="text-xs">Expires after</Label>
            <Select value={days} onValueChange={setDays}>
              <SelectTrigger><SelectValue /></SelectTrigger>
              <SelectContent>
                {['1', '2', '3', '7', '14'].map(d => (
                  <SelectItem key={d} value={d}>{d} day{d === '1' ? '' : 's'}</SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
          <div>
            <Label className="text-xs">Role</Label>
            <Select value={role} onValueChange={setRole}>
              <SelectTrigger><SelectValue /></SelectTrigger>
              <SelectContent>
                <SelectItem value="admin">Admin (full build access)</SelectItem>
                <SelectItem value="dev_tester">Dev tester (limited)</SelectItem>
              </SelectContent>
            </Select>
          </div>
        </div>

        <div className="flex flex-wrap gap-2">
          <Button onClick={create} disabled={saving} className="bg-blue-600 hover:bg-blue-700 text-white">
            <UserPlus className="h-4 w-4 mr-1" />
            {saving ? 'Creating…' : 'Create / refresh temp login'}
          </Button>
          <Button variant="outline" onClick={copyBlock}>
            {copied ? <Check className="h-4 w-4 mr-1 text-green-600" /> : <Copy className="h-4 w-4 mr-1" />}
            Copy login details
          </Button>
        </div>

        {rows.length > 0 && (
          <div className="rounded-lg border bg-background divide-y">
            {rows.map(r => (
              <div key={r.id} className="flex flex-wrap items-center gap-3 p-3 text-sm">
                <code className="font-mono text-xs bg-muted px-2 py-1 rounded">{r.email}</code>
                <Badge variant={r.is_active ? 'default' : 'secondary'} className="text-xs">
                  {r.is_active ? 'Active' : 'Inactive'}
                </Badge>
                <span className="flex items-center gap-1 text-xs text-muted-foreground">
                  <Clock className="h-3 w-3" />
                  {remaining(r.access_expires_at)}
                </span>
                <div className="ml-auto flex gap-2">
                  <Button size="sm" variant="outline" className="text-xs" onClick={() => extend(r, 1)}>+1 day</Button>
                  <Button size="sm" variant="outline" className="text-xs" onClick={() => extend(r, 7)}>+7 days</Button>
                  <Button size="sm" variant="destructive" className="text-xs" onClick={() => revoke(r)}>
                    <Trash2 className="h-3 w-3 mr-1" />Revoke
                  </Button>
                </div>
              </div>
            ))}
          </div>
        )}
      </CardContent>
    </Card>
  );
};

export default TempDevLoginPanel;
