import React from 'react';
import { supabase } from '@/integrations/supabase/client';
import { Users, Loader2 } from 'lucide-react';
import { cn } from '@/lib/utils';

export interface OrrTeamOption {
  id: string;
  name: string;
}

/**
 * Team picker for Open Round Robin. At least one team must be selected
 * before the go-live switch can be turned on — the go-live writes
 * lead_distribution_settings rows for the selected teams only.
 */
export const OrrTeamSelectionPanel: React.FC<{
  selectedTeamIds: string[];
  onChange: (ids: string[]) => void;
  disabled?: boolean;
}> = ({ selectedTeamIds, onChange, disabled }) => {
  const [teams, setTeams] = React.useState<OrrTeamOption[] | null>(null);

  React.useEffect(() => {
    let cancelled = false;
    (async () => {
      const { data } = await supabase.from('lead_teams').select('id, name').order('name');
      if (!cancelled) setTeams((data as OrrTeamOption[]) || []);
    })();
    return () => { cancelled = true; };
  }, []);

  const toggle = (id: string) => {
    if (disabled) return;
    onChange(
      selectedTeamIds.includes(id)
        ? selectedTeamIds.filter(t => t !== id)
        : [...selectedTeamIds, id],
    );
  };

  return (
    <div className="rounded-md border border-border bg-card p-4 space-y-3">
      <div className="flex items-center gap-2">
        <Users className="h-4 w-4 text-primary" />
        <p className="text-sm font-semibold text-foreground">Teams on Open Round Robin</p>
        {selectedTeamIds.length === 0 && (
          <span className="text-[10px] font-semibold uppercase tracking-wide rounded-md bg-destructive/10 text-destructive px-2 py-0.5">
            Required before go-live
          </span>
        )}
      </div>
      <p className="text-xs text-muted-foreground">
        Choose which team or teams Open Round Robin will hand leads to. You must pick at least one
        team before you can turn it live — Round Robin agents in other teams are unaffected.
      </p>
      {teams === null ? (
        <div className="flex items-center gap-2 text-xs text-muted-foreground">
          <Loader2 className="h-3.5 w-3.5 animate-spin" /> Loading teams…
        </div>
      ) : (
        <div className="flex flex-wrap gap-2">
          {teams.map(team => {
            const active = selectedTeamIds.includes(team.id);
            return (
              <button
                key={team.id}
                type="button"
                disabled={disabled}
                onClick={() => toggle(team.id)}
                aria-pressed={active}
                className={cn(
                  'inline-flex items-center gap-2 rounded-full border px-4 py-2 text-sm font-medium transition-colors',
                  active
                    ? 'border-primary bg-primary/10 text-primary'
                    : 'border-input bg-background text-muted-foreground hover:bg-muted',
                  disabled && 'opacity-60 cursor-not-allowed',
                )}
              >
                <span
                  className={cn(
                    'h-2.5 w-2.5 rounded-full border',
                    active ? 'bg-primary border-primary' : 'bg-transparent border-muted-foreground',
                  )}
                />
                {team.name}
              </button>
            );
          })}
        </div>
      )}
    </div>
  );
};

export default OrrTeamSelectionPanel;
