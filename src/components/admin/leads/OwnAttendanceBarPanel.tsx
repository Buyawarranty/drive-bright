import { useQuery, useQueryClient } from '@tanstack/react-query';
import { useState } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { Switch } from '@/components/ui/switch';
import { CalendarDays } from 'lucide-react';
import { toast } from 'sonner';

export function OwnAttendanceBarPanel() {
  const cache = useQueryClient();
  const [saving, setSaving] = useState<string | null>(null);
  const { data: agents = [], isLoading, error } = useQuery({
    queryKey: ['attendance-bar-settings'],
    queryFn: async () => {
      const [staff, settings] = await Promise.all([
        supabase.from('admin_users').select('id, first_name, last_name, email')
          .in('role', ['sales', 'sales_lead']).eq('is_active', true).is('archived_at', null).order('first_name'),
        supabase.from('lead_team_members').select('id, admin_user_id, show_own_attendance_bar'),
      ]);
      if (staff.error) throw staff.error;
      if (settings.error) throw settings.error;
      return (staff.data ?? []).map(agent => ({ ...agent,
        setting: settings.data?.find(row => row.admin_user_id === agent.id),
      }));
    },
  });

  const toggle = async (agent: typeof agents[number], checked: boolean) => {
    if (!agent.setting) return;
    setSaving(agent.id);
    try {
      const { data, error } = await supabase.from('lead_team_members')
        .update({ show_own_attendance_bar: checked }).eq('id', agent.setting.id).select('id').single();
      if (error || !data) throw error ?? new Error('Setting was not saved');
      await Promise.all([
        cache.invalidateQueries({ queryKey: ['attendance-bar-settings'] }),
        cache.invalidateQueries({ queryKey: ['own-attendance-bar', agent.id] }),
      ]);
      toast.success(checked ? 'Own attendance bar on' : 'Own attendance bar off');
    } catch { toast.error('Could not save attendance bar setting'); }
    finally { setSaving(null); }
  };

  return (
    <section id="own-attendance-bar" className="scroll-mt-24 space-y-3">
      <h3 className="flex items-center gap-2 text-base font-semibold text-foreground">
        <CalendarDays className="h-4 w-4" /> Own attendance bar
      </h3>
      {isLoading ? <p className="text-sm text-muted-foreground">Loading agents…</p>
        : error ? <p className="text-sm text-destructive">Unable to load attendance settings.</p>
        : agents.map(agent => {
          const name = [agent.first_name, agent.last_name].filter(Boolean).join(' ') || agent.email;
          return (
            <div key={agent.id} className="flex items-center justify-between gap-3 border-b border-border py-3">
              <div className="min-w-0">
                <p className="text-sm font-medium text-foreground">{name}</p>
                <p className="text-xs text-muted-foreground">
                  {!agent.setting ? 'Assign to a team first' : agent.setting.show_own_attendance_bar ? 'Own attendance bar on' : 'Off (default)'}
                </p>
              </div>
              <Switch aria-label={`Own attendance bar for ${name}`}
                checked={agent.setting?.show_own_attendance_bar === true}
                disabled={saving !== null || !agent.setting}
                onCheckedChange={checked => void toggle(agent, checked)} />
            </div>
          );
        })}
    </section>
  );
}