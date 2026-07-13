import { useState } from 'react';
import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Send } from 'lucide-react';
import { supabase } from '@/integrations/supabase/client';
import { toast } from '@/hooks/use-toast';

interface Props {
  targetAdminId: string;
  targetName: string;
}

export function PushOpenPoolControl({ targetAdminId, targetName }: Props) {
  const [open, setOpen] = useState(false);
  const [count, setCount] = useState('3');
  const [windowMode, setWindowMode] = useState<'timer' | 'none'>('timer');
  const [minutes, setMinutes] = useState('30');
  const [busy, setBusy] = useState(false);

  const handlePush = async () => {
    const n = Math.max(1, Math.min(50, parseInt(count, 10) || 0));
    const w = windowMode === 'none'
      ? 0
      : Math.max(5, Math.min(240, parseInt(minutes, 10) || 30));
    if (!n) {
      toast({ title: 'Enter a number of leads', variant: 'destructive' });
      return;
    }
    setBusy(true);
    try {
      const { data, error } = await (supabase as any).rpc(
        'open_pool_bulk_assign_to_agent',
        { _target_admin_id: targetAdminId, _count: n, _window_minutes: w },
      );
      if (error) throw error;
      const row = Array.isArray(data) ? data[0] : data;
      const assigned = row?.assigned_count ?? 0;
      if (assigned === 0) {
        toast({
          title: 'No leads available',
          description: 'The Open Pool has no leads ready to assign right now.',
        });
      } else {
        toast({
          title: `Assigned ${assigned} lead${assigned === 1 ? '' : 's'} to ${targetName}`,
          description: windowMode === 'none'
            ? `Sitting in ${targetName}'s My Leads with no time limit.`
            : `In ${targetName}'s My Leads with a ${w}-minute call window.`,
        });
      }
      setOpen(false);
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
    <Popover open={open} onOpenChange={setOpen}>
      <PopoverTrigger asChild>
        <button
          type="button"
          className="inline-flex items-center gap-1 px-2 py-1 rounded-md border border-input bg-background hover:bg-muted text-xs font-medium text-foreground"
          title={`Push Open Pool leads to ${targetName}`}
        >
          <Send className="h-3 w-3" />
          Push
        </button>
      </PopoverTrigger>
      <PopoverContent align="end" className="w-80 p-3 space-y-3">
        <div>
          <div className="text-sm font-semibold">Push Open Pool leads</div>
          <div className="text-xs text-muted-foreground mt-0.5">
            Assign top-priority Open Pool leads to{' '}
            <span className="font-medium text-foreground">{targetName}</span>.
          </div>
        </div>
        <div className="grid grid-cols-2 gap-2">
          <label className="text-xs font-medium space-y-1">
            <span className="text-muted-foreground">How many</span>
            <Input
              type="number"
              min={1}
              max={50}
              value={count}
              onChange={(e) => setCount(e.target.value)}
              className="h-8"
            />
          </label>
          <label className="text-xs font-medium space-y-1">
            <span className="text-muted-foreground">Time limit</span>
            <Select value={windowMode} onValueChange={(v) => setWindowMode(v as 'timer' | 'none')}>
              <SelectTrigger className="h-8">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="timer">Call window</SelectItem>
                <SelectItem value="none">No limit</SelectItem>
              </SelectContent>
            </Select>
          </label>
        </div>
        {windowMode === 'timer' && (
          <label className="text-xs font-medium space-y-1 block">
            <span className="text-muted-foreground">Call window (minutes)</span>
            <Input
              type="number"
              min={5}
              max={240}
              value={minutes}
              onChange={(e) => setMinutes(e.target.value)}
              className="h-8"
            />
          </label>
        )}
        <p className="text-[11px] text-muted-foreground leading-snug">
          {windowMode === 'none'
            ? `Leads stay with ${targetName} until they log an outcome — no auto-return.`
            : `If ${targetName} doesn't log an outcome within the window, leads return to the Open Pool.`}
        </p>
        <div className="flex justify-end gap-2">
          <Button variant="ghost" size="sm" onClick={() => setOpen(false)} disabled={busy}>
            Cancel
          </Button>
          <Button size="sm" onClick={handlePush} disabled={busy}>
            {busy ? 'Assigning…' : 'Assign now'}
          </Button>
        </div>
      </PopoverContent>
    </Popover>
  );
}

export default PushOpenPoolControl;
