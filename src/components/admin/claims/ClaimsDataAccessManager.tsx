import { useEffect, useState } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/hooks/useAuth';
import { Switch } from '@/components/ui/switch';
import { Input } from '@/components/ui/input';
import { ShieldCheck } from 'lucide-react';
import { useToast } from '@/hooks/use-toast';

export const CLAIMS_DATA_OWNERS = ['support@buyawarranty.co.uk', 'info@buyawarranty.co.uk'];

export const isClaimsDataOwnerEmail = (email?: string | null) =>
  CLAIMS_DATA_OWNERS.includes((email || '').toLowerCase());

/** Claims data + Vehicle intelligence: support@/info@ always, others only if granted by them. */
export const useClaimsDataAccess = () => {
  const { user } = useAuth();
  const [allowed, setAllowed] = useState<boolean | null>(null);
  useEffect(() => {
    if (!user) { setAllowed(false); return; }
    if (isClaimsDataOwnerEmail(user.email)) { setAllowed(true); return; }
    (supabase as any).rpc('has_claims_data_access').then(({ data }: any) => setAllowed(!!data));
  }, [user?.id, user?.email]);
  return { allowed: !!allowed, loading: allowed === null, isOwner: isClaimsDataOwnerEmail(user?.email) };
};

type Staff = { user_id: string; email: string; first_name?: string | null; last_name?: string | null };

export const ClaimsDataAccessManager = () => {
  const { user } = useAuth();
  const { toast } = useToast();
  const [staff, setStaff] = useState<Staff[]>([]);
  const [granted, setGranted] = useState<Set<string>>(new Set());
  const [q, setQ] = useState('');
  const isOwner = isClaimsDataOwnerEmail(user?.email);

  useEffect(() => {
    if (!isOwner) return;
    (async () => {
      const [{ data: s }, { data: g }] = await Promise.all([
        supabase.from('admin_users').select('user_id,email,first_name,last_name').eq('is_active', true).not('user_id', 'is', null).order('email'),
        (supabase as any).from('claims_data_access').select('user_id'),
      ]);
      setStaff(((s as any[]) || []).filter((r) => !isClaimsDataOwnerEmail(r.email)));
      setGranted(new Set(((g as any[]) || []).map((r) => r.user_id)));
    })();
  }, [isOwner]);

  if (!isOwner) return null;

  const toggle = async (uid: string, allow: boolean) => {
    const { error } = await (supabase as any).rpc('set_claims_data_access', { p_user_id: uid, p_allow: allow });
    if (error) { toast({ title: 'Could not update access', description: error.message, variant: 'destructive' }); return; }
    setGranted((prev) => { const n = new Set(prev); allow ? n.add(uid) : n.delete(uid); return n; });
  };

  const list = staff.filter((s) => `${s.email} ${s.first_name ?? ''} ${s.last_name ?? ''}`.toLowerCase().includes(q.toLowerCase()));

  return (
    <div className="rounded-lg border bg-card p-4 space-y-3">
      <div className="flex items-center gap-2">
        <ShieldCheck className="h-4 w-4 text-primary" />
        <h3 className="font-semibold">Claims data access</h3>
      </div>
      <p className="text-sm text-muted-foreground">
        Support@ and info@ always see Claims data and Vehicle intelligence, and are the only people who can give access to anyone else.
      </p>
      <Input placeholder="Search staff" value={q} onChange={(e) => setQ(e.target.value)} className="max-w-xs" />
      <div className="max-h-64 overflow-y-auto divide-y border rounded">
        {list.map((s) => (
          <div key={s.user_id} className="flex items-center justify-between px-3 py-2 text-sm">
            <span>{[s.first_name, s.last_name].filter(Boolean).join(' ') || s.email} <span className="text-muted-foreground">· {s.email}</span></span>
            <Switch checked={granted.has(s.user_id)} onCheckedChange={(v) => toggle(s.user_id, v)} />
          </div>
        ))}
      </div>
    </div>
  );
};
