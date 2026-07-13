import { useEffect, useMemo, useState } from 'react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Send, Users } from 'lucide-react';
import { supabase } from '@/integrations/supabase/client';
import { toast } from '@/hooks/use-toast';

interface AdminLite {
  id: string;
  first_name: string | null;
  last_name: string | null;
  email: string;
  role: string;
  is_active: boolean;
}

/**
 * Prominent manager card for assigning Open Pool leads directly to a chosen
 * agent (bulk). Shown at the top of the allocation section so it's easy to
 * find when you just want to hand a batch of unassigned leads to someone.
 */
export const AssignOpenPoolCard = () => {
  const [agents, setAgents] = useState<AdminLite[]>([]);
  const [targetId, setTargetId] = useState<string>('');
  const [count, setCount] = useState('5');
  const [minutes, setMinutes] = useState('30');
  const [busy, setBusy] = useState(false);

  useEffect(() => {
    (async () => {
      const { data } = await supabase
        .from('admin_users')
        .select('id, first_name, last_name, email, role, is_active')
        .eq('is_active', true)
        .in('role', ['sales', 'sales_agent', 'sales_lead', 'lead_gen'])
        .order('first_name', { ascending: true });
      setAgents((data as AdminLite[]) || []);
    })();
  }, []);

  const displayName = (a: AdminLite) =>
    `${a.first_name || ''} ${a.last_name || ''}`.trim() || a.email;

  const target = useMemo(() => agents.find((a) => a.id === targetId), [agents, targetId]);

  const handleAssign = async () => {
    if (!target) {
      toast({ title: 'Pick an agent first', variant: 'destructive' });
      return;
    }
    const n = Math.max(1, Math.min(50, parseInt(count, 10) || 0));
    const w = Math.max(5, Math.min(240, parseInt(minutes, 10) || 30));
    setBusy(true);
    try {
      const { data, error } = await (supabase as any).rpc(
        'open_pool_bulk_assign_to_agent',
        { _target_admin_id: target.id, _count: n, _window_minutes: w },
      );
      if (error) throw error;
      const row = Array.isArray(data) ? data[0] : data;
      const assigned = row?.assigned_count ?? 0;
      if (assigned === 0) {
        toast({
          title: 'No Open Pool leads available',
          description: 'The Open Pool is empty or every lead is already locked.',
        });
      } else {
        toast({
          title: `Assigned ${assigned} lead${assigned === 1 ? '' : 's'} to ${displayName(target)}`,
          description: `They'll appear in ${displayName(target)}'s My Leads with a ${w}-minute call window. Unworked leads auto-return to Open Pool.`,
        });
      }
    } catch (e: any) {
      toast({
        title: 'Could not assign leads',
        description: e?.message ?? 'Unknown error',
        variant: 'destructive',
      });
    } finally {
      setBusy(false);
    }
  };

  return (
    <section className="rounded-lg border-2 border-primary/30 bg-primary/5 shadow-sm">
      <div className="px-5 py-4 flex items-start gap-2">
        <Users className="h-4 w-4 text-primary shrink-0 mt-0.5" />
        <div className="min-w-0">
          <h3 className="text-base font-semibold text-foreground">Assign Open Pool Leads</h3>
          <p className="text-sm text-muted-foreground mt-0.5">
            Hand a batch of unassigned Open Pool leads straight to a specific agent — useful when
            an agent is quiet and you don't want them waiting for round-robin distribution.
          </p>
        </div>
      </div>
      <div className="px-5 pb-4 grid grid-cols-1 md:grid-cols-[1fr,120px,140px,auto] gap-3 items-end">
        <label className="text-xs font-medium space-y-1">
          <span className="text-muted-foreground">Agent</span>
          <Select value={targetId} onValueChange={setTargetId}>
            <SelectTrigger className="h-9 bg-background">
              <SelectValue placeholder="Choose an agent…" />
            </SelectTrigger>
            <SelectContent className="max-h-72">
              {agents.map((a) => (
                <SelectItem key={a.id} value={a.id}>
                  {displayName(a)} <span className="text-muted-foreground">· {a.role}</span>
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </label>
        <label className="text-xs font-medium space-y-1">
          <span className="text-muted-foreground">How many</span>
          <Input
            type="number"
            min={1}
            max={50}
            value={count}
            onChange={(e) => setCount(e.target.value)}
            className="h-9 bg-background"
          />
        </label>
        <label className="text-xs font-medium space-y-1">
          <span className="text-muted-foreground">Call window (min)</span>
          <Input
            type="number"
            min={5}
            max={240}
            value={minutes}
            onChange={(e) => setMinutes(e.target.value)}
            className="h-9 bg-background"
          />
        </label>
        <Button onClick={handleAssign} disabled={busy || !targetId} className="gap-1.5 h-9">
          <Send className="h-3.5 w-3.5" />
          {busy ? 'Assigning…' : 'Assign now'}
        </Button>
      </div>
      <p className="px-5 pb-4 text-[11px] text-muted-foreground leading-snug">
        Tip: each agent row below also has a <strong>Push</strong> button that does the same thing
        for that specific agent. To keep leads on round-robin instead, leave them in the Open Pool
        and they'll flow out automatically based on each agent's share %.
      </p>
    </section>
  );
};

export default AssignOpenPoolCard;
