import React, { useEffect, useState } from 'react';
import { Button } from '@/components/ui/button';
import { GraduationCap, Loader2 } from 'lucide-react';
import { supabase } from '@/integrations/supabase/client';
import { toast } from 'sonner';

/** Fetch the "in training" flag for a set of agents. */
export const fetchTrainingFlags = async (agentIds: string[]): Promise<Set<string>> => {
  if (!agentIds.length) return new Set();
  const { data } = await (supabase as any)
    .from('admin_users')
    .select('id, in_training')
    .in('id', agentIds);
  return new Set(((data || []) as any[]).filter(r => r.in_training).map(r => r.id));
};

interface Props {
  agentId: string;
  inTraining: boolean;
  onChanged: (next: boolean) => void;
}

/**
 * Management-only switch marking an agent as still in training.
 * Agents in training are shown on the scoreboard without a revenue target.
 */
export const TrainingModeToggle: React.FC<Props> = ({ agentId, inTraining, onChanged }) => {
  const [saving, setSaving] = useState(false);
  const [value, setValue] = useState(inTraining);
  useEffect(() => setValue(inTraining), [inTraining]);

  const toggle = async () => {
    setSaving(true);
    const next = !value;
    const { error } = await (supabase as any)
      .from('admin_users')
      .update({ in_training: next })
      .eq('id', agentId);
    setSaving(false);
    if (error) {
      toast.error('Could not update training status');
      return;
    }
    setValue(next);
    onChanged(next);
    toast.success(next ? 'Marked as in training — no target applies' : 'Training finished — target now applies');
  };

  return (
    <Button
      type="button"
      size="sm"
      variant={value ? 'default' : 'outline'}
      className="h-9 text-xs gap-1.5"
      onClick={toggle}
      disabled={saving}
      title="Agents in training are shown without a revenue target"
    >
      {saving ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <GraduationCap className="h-3.5 w-3.5" />}
      {value ? 'In training' : 'In training?'}
    </Button>
  );
};
