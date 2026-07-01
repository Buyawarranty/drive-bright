import { useEffect, useMemo, useState } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Badge } from '@/components/ui/badge';
import { Switch } from '@/components/ui/switch';
import { Phone, Loader2 } from 'lucide-react';
import { toast } from 'sonner';

interface Tracker {
  id: string;
  callrail_tracker_id: string;
  phone_e164: string | null;
  label: string | null;
  assigned_admin_user_id: string | null;
  active: boolean;
}

interface AdminUser {
  id: string;
  first_name: string | null;
  last_name: string | null;
  email: string;
  role: string;
}

const UNASSIGNED = '__unassigned__';

export const CallRailTrackerAssignments = () => {
  const [trackers, setTrackers] = useState<Tracker[]>([]);
  const [agents, setAgents] = useState<AdminUser[]>([]);
  const [loading, setLoading] = useState(true);
  const [savingId, setSavingId] = useState<string | null>(null);

  const load = async () => {
    setLoading(true);
    const [{ data: t, error: tErr }, { data: a, error: aErr }] = await Promise.all([
      supabase
        .from('callrail_tracking_numbers')
        .select('id, callrail_tracker_id, phone_e164, label, assigned_admin_user_id, active')
        .order('label', { ascending: true, nullsFirst: false }),
      supabase
        .from('admin_users')
        .select('id, first_name, last_name, email, role')
        .eq('is_active', true)
        .order('first_name', { ascending: true }),
    ]);
    if (tErr) toast.error('Failed to load CallRail trackers');
    if (aErr) toast.error('Failed to load agents');
    setTrackers((t as Tracker[]) || []);
    setAgents((a as AdminUser[]) || []);
    setLoading(false);
  };

  useEffect(() => {
    load();
  }, []);

  const agentLabel = (u: AdminUser) => {
    const name = [u.first_name, u.last_name].filter(Boolean).join(' ').trim();
    return name ? `${name} · ${u.role}` : `${u.email} · ${u.role}`;
  };

  const sortedAgents = useMemo(
    () => [...agents].sort((x, y) => agentLabel(x).localeCompare(agentLabel(y))),
    [agents],
  );

  const updateTracker = async (id: string, patch: Partial<Tracker>) => {
    setSavingId(id);
    const { error } = await supabase.from('callrail_tracking_numbers').update(patch).eq('id', id);
    if (error) {
      toast.error(`Update failed: ${error.message}`);
    } else {
      setTrackers((prev) => prev.map((t) => (t.id === id ? { ...t, ...patch } : t)));
      toast.success('Tracker updated');
    }
    setSavingId(null);
  };

  return (
    <Card className="mb-4">
      <CardHeader className="pb-3">
        <CardTitle className="text-base flex items-center gap-2">
          <Phone className="h-4 w-4 text-primary" />
          CallRail Tracker Assignments
          <Badge variant="secondary" className="ml-2 text-[10px]">Management & Lead Gen</Badge>
        </CardTitle>
        <p className="text-xs text-muted-foreground">
          Route each CallRail tracking number to the agent who should receive incoming call banners and missed-call alerts.
        </p>
      </CardHeader>
      <CardContent>
        {loading ? (
          <div className="flex items-center gap-2 text-sm text-muted-foreground py-6">
            <Loader2 className="h-4 w-4 animate-spin" /> Loading trackers…
          </div>
        ) : trackers.length === 0 ? (
          <div className="text-sm text-muted-foreground border border-dashed rounded-md p-4">
            No tracking numbers found yet. They will appear here automatically after the first CallRail webhook is received, or once you sync from CallRail.
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="text-left text-xs text-muted-foreground border-b">
                  <th className="py-2 pr-3 font-medium">Label</th>
                  <th className="py-2 pr-3 font-medium">Number</th>
                  <th className="py-2 pr-3 font-medium">Tracker ID</th>
                  <th className="py-2 pr-3 font-medium">Assigned agent</th>
                  <th className="py-2 pr-3 font-medium">Active</th>
                </tr>
              </thead>
              <tbody>
                {trackers.map((t) => (
                  <tr key={t.id} className="border-b last:border-0">
                    <td className="py-2 pr-3">{t.label || <span className="text-muted-foreground">—</span>}</td>
                    <td className="py-2 pr-3 font-mono text-xs">{t.phone_e164 || '—'}</td>
                    <td className="py-2 pr-3 font-mono text-[11px] text-muted-foreground">{t.callrail_tracker_id}</td>
                    <td className="py-2 pr-3 min-w-[220px]">
                      <Select
                        value={t.assigned_admin_user_id ?? UNASSIGNED}
                        disabled={savingId === t.id}
                        onValueChange={(v) =>
                          updateTracker(t.id, {
                            assigned_admin_user_id: v === UNASSIGNED ? null : v,
                          })
                        }
                      >
                        <SelectTrigger className="h-8">
                          <SelectValue placeholder="Unassigned" />
                        </SelectTrigger>
                        <SelectContent className="max-h-72">
                          <SelectItem value={UNASSIGNED}>Unassigned</SelectItem>
                          {sortedAgents.map((a) => (
                            <SelectItem key={a.id} value={a.id}>
                              {agentLabel(a)}
                            </SelectItem>
                          ))}
                        </SelectContent>
                      </Select>
                    </td>
                    <td className="py-2 pr-3">
                      <Switch
                        checked={t.active}
                        disabled={savingId === t.id}
                        onCheckedChange={(v) => updateTracker(t.id, { active: v })}
                      />
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </CardContent>
    </Card>
  );
};
