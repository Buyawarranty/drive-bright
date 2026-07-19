import React, { useEffect, useMemo, useState } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Sparkles, KeyRound, Users, X } from 'lucide-react';
import { toast } from 'sonner';

interface Props {
  userRole: string | null | undefined;
}

interface AdminUserRow {
  id: string;
  first_name: string | null;
  last_name: string | null;
  email: string;
  role: string;
  permissions: Record<string, boolean> | any;
  is_active: boolean;
}

/**
 * Newly-added admin sections that management often needs to hand out access to
 * quickly, without opening the User Permissions tab and drilling into each user.
 *
 * Add entries here whenever a new section ships so it appears in this shortcut.
 */
const QUICK_SECTIONS: { id: string; label: string; permKey: string }[] = [
  { id: 'overview', label: 'Live Calls Data', permKey: 'tab_overview' },
  { id: 'call-tracking', label: 'Call rail', permKey: 'tab_call-tracking' },
  
];

const DISMISS_KEY = 'quick_grant_bar_dismissed_v1';

export const QuickGrantAccessBar: React.FC<Props> = ({ userRole }) => {
  const canUse = userRole === 'admin' || userRole === 'super_admin';
  const [users, setUsers] = useState<AdminUserRow[]>([]);
  const [sectionId, setSectionId] = useState<string>(QUICK_SECTIONS[0].id);
  const [userId, setUserId] = useState<string>('');
  const [applying, setApplying] = useState(false);
  const [dismissed, setDismissed] = useState<boolean>(() => {
    try { return sessionStorage.getItem(DISMISS_KEY) === '1'; } catch { return false; }
  });

  useEffect(() => {
    if (!canUse) return;
    (async () => {
      const { data, error } = await supabase
        .from('admin_users')
        .select('id, first_name, last_name, email, role, permissions, is_active')
        .eq('is_active', true)
        .order('first_name', { ascending: true });
      if (error) return;
      setUsers((data as AdminUserRow[]) || []);
    })();
  }, [canUse]);

  const selectedSection = useMemo(
    () => QUICK_SECTIONS.find(s => s.id === sectionId) ?? QUICK_SECTIONS[0],
    [sectionId],
  );

  const alreadyGranted = useMemo(() => {
    const u = users.find(x => x.id === userId);
    if (!u) return false;
    return u.permissions?.[selectedSection.permKey] === true;
  }, [users, userId, selectedSection]);

  if (!canUse || dismissed) return null;

  const dismiss = () => {
    try { sessionStorage.setItem(DISMISS_KEY, '1'); } catch {}
    setDismissed(true);
  };

  const grantAll = async () => {
    if (!confirm(`Grant "${selectedSection.label}" access to ALL ${users.length} active users?`)) return;
    setApplying(true);
    try {
      const updates = users.map(u => ({
        id: u.id,
        permissions: { ...(u.permissions || {}), [selectedSection.permKey]: true },
      }));
      const results = await Promise.allSettled(
        updates.map(u => supabase.from('admin_users').update({ permissions: u.permissions }).eq('id', u.id)),
      );
      const failed = results.filter(r => r.status === 'rejected').length;
      if (failed) toast.error(`${failed} user(s) failed to update`);
      else toast.success(`Granted ${selectedSection.label} to ${users.length} user(s)`);
      const map = new Map(updates.map(u => [u.id, u.permissions]));
      setUsers(prev => prev.map(u => map.has(u.id) ? { ...u, permissions: map.get(u.id)! } : u));
    } finally {
      setApplying(false);
    }
  };

  const grantOne = async () => {
    if (!userId) {
      toast.error('Pick a user first');
      return;
    }
    const user = users.find(u => u.id === userId);
    if (!user) return;
    setApplying(true);
    try {
      const nextPerms = { ...(user.permissions || {}), [selectedSection.permKey]: true };
      const { error } = await supabase.from('admin_users').update({ permissions: nextPerms }).eq('id', user.id);
      if (error) throw error;
      toast.success(`${selectedSection.label} granted to ${user.first_name || user.email}`);
      setUsers(prev => prev.map(u => u.id === user.id ? { ...u, permissions: nextPerms } : u));
    } catch (e: any) {
      toast.error(e.message || 'Grant failed');
    } finally {
      setApplying(false);
    }
  };

  const userLabel = (u: AdminUserRow) => {
    const name = [u.first_name, u.last_name].filter(Boolean).join(' ').trim() || u.email;
    const has = u.permissions?.[selectedSection.permKey] === true ? ' ✓' : '';
    return `${name} · ${u.role}${has}`;
  };

  return (
    <div className="border-b bg-indigo-50 dark:bg-indigo-950/40">
      <div className="flex flex-wrap items-center gap-2 px-3 lg:px-6 py-2">
        <Badge variant="secondary" className="gap-1">
          <Sparkles className="h-3 w-3" /> Quick grant
        </Badge>
        <span className="text-xs text-muted-foreground hidden md:inline">
          New sections — grant instantly without opening User Permissions
        </span>

        <div className="flex items-center gap-2 ml-auto flex-wrap">
          <Select value={sectionId} onValueChange={setSectionId}>
            <SelectTrigger className="h-8 w-[170px] bg-background">
              <SelectValue placeholder="Section" />
            </SelectTrigger>
            <SelectContent>
              {QUICK_SECTIONS.map(s => (
                <SelectItem key={s.id} value={s.id}>{s.label}</SelectItem>
              ))}
            </SelectContent>
          </Select>

          <Select value={userId} onValueChange={setUserId}>
            <SelectTrigger className="h-8 w-[240px] bg-background">
              <SelectValue placeholder="Select user…" />
            </SelectTrigger>
            <SelectContent className="max-h-72">
              {users.map(u => (
                <SelectItem key={u.id} value={u.id}>{userLabel(u)}</SelectItem>
              ))}
            </SelectContent>
          </Select>

          <Button
            size="sm"
            onClick={grantOne}
            disabled={applying || !userId || alreadyGranted}
            className="h-8"
          >
            <KeyRound className="h-3.5 w-3.5 mr-1" />
            {alreadyGranted ? 'Already granted' : 'Grant'}
          </Button>

          <Button
            size="sm"
            variant="outline"
            onClick={grantAll}
            disabled={applying || users.length === 0}
            className="h-8"
          >
            <Users className="h-3.5 w-3.5 mr-1" />
            Grant to all
          </Button>

          <button
            type="button"
            onClick={dismiss}
            className="p-1 rounded text-muted-foreground hover:text-foreground hover:bg-muted"
            aria-label="Hide quick-grant bar"
            title="Hide until next login"
          >
            <X className="h-3.5 w-3.5" />
          </button>
        </div>
      </div>
    </div>
  );
};

export default QuickGrantAccessBar;
