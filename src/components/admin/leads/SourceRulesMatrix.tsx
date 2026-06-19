import { Switch } from '@/components/ui/switch';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { LayoutGrid } from 'lucide-react';
import { LEAD_SOURCES } from './LeadRoutingDialog';

interface Team {
  id: string;
  name: string;
  color: string;
  emoji: string | null;
}

interface SourceRule {
  id: string;
  team_id: string;
  source: string;
  allowed: boolean;
}

interface Props {
  teams: Team[];
  rules: SourceRule[];
  canEdit: boolean;
  routingEnabled: boolean;
  onToggle: (teamId: string, source: string, allowed: boolean) => void;
}

export const SourceRulesMatrix = ({ teams, rules, canEdit, routingEnabled, onToggle }: Props) => {
  if (!teams.length) return null;

  const isOn = (teamId: string, source: string) =>
    rules.find(r => r.team_id === teamId && r.source === source)?.allowed === true;

  return (
    <Card className="border-2">
      <CardHeader className="pb-2">
        <CardTitle className="text-sm flex items-center gap-2">
          <LayoutGrid className="h-4 w-4" />
          Source → Team levers
          {!routingEnabled && (
            <Badge variant="outline" className="text-[10px] border-amber-400 text-amber-700">
              Preview — master switch is OFF
            </Badge>
          )}
        </CardTitle>
        <p className="text-xs text-muted-foreground mt-1">
          Toggle which teams receive which lead sources. One switch per team per source — no scrolling, no nested clicks.
          Once the master switch above is ARMED, any source switched ON for a team will divert there.
        </p>
      </CardHeader>
      <CardContent className="overflow-x-auto">
        <table className="w-full text-sm border-collapse">
          <thead>
            <tr>
              <th className="text-left font-medium text-xs text-muted-foreground px-2 py-2 sticky left-0 bg-background">
                Source
              </th>
              {teams.map(t => (
                <th key={t.id} className="px-2 py-2 text-center">
                  <span
                    className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-xs font-medium text-white"
                    style={{ backgroundColor: t.color }}
                  >
                    {t.emoji} {t.name}
                  </span>
                </th>
              ))}
            </tr>
          </thead>
          <tbody>
            {LEAD_SOURCES.map(s => (
              <tr key={s.value} className="border-t">
                <td className="px-2 py-2 sticky left-0 bg-background">
                  <span className="inline-flex items-center gap-2">
                    <span className="text-base">{s.icon}</span>
                    <span className="font-medium">{s.label}</span>
                  </span>
                </td>
                {teams.map(t => {
                  const on = isOn(t.id, s.value);
                  return (
                    <td key={t.id} className="px-2 py-2 text-center">
                      <div className="inline-flex flex-col items-center gap-0.5">
                        <Switch
                          checked={on}
                          disabled={!canEdit}
                          onCheckedChange={(v) => onToggle(t.id, s.value, v)}
                        />
                        <span className={`text-[10px] font-semibold ${on ? 'text-emerald-700' : 'text-muted-foreground'}`}>
                          {on ? 'On' : 'Off'}
                        </span>
                      </div>
                    </td>
                  );
                })}
              </tr>
            ))}
          </tbody>
        </table>
      </CardContent>
    </Card>
  );
};
