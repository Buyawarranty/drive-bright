import { Input } from '@/components/ui/input';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { LayoutGrid, Wand2 } from 'lucide-react';
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
  percentage?: number | null;
}

interface Props {
  teams: Team[];
  rules: SourceRule[];
  canEdit: boolean;
  routingEnabled: boolean;
  /** Set the percentage of a source that should be routed to a team (0-100). */
  onSetPercentage: (teamId: string, source: string, percentage: number) => void;
}

export const SourceRulesMatrix = ({ teams, rules, canEdit, routingEnabled, onSetPercentage }: Props) => {
  if (!teams.length) return null;

  const pctOf = (teamId: string, source: string) => {
    const r = rules.find(x => x.team_id === teamId && x.source === source);
    if (!r) return 0;
    // Back-compat: if percentage is missing but allowed was true, treat as 100.
    if (typeof r.percentage === 'number') return r.percentage;
    return r.allowed ? 100 : 0;
  };

  const rowTotal = (source: string) =>
    teams.reduce((sum, t) => sum + pctOf(t.id, source), 0);

  const evenSplit = (source: string) => {
    if (!teams.length) return;
    const each = Math.floor(100 / teams.length);
    const remainder = 100 - each * teams.length;
    teams.forEach((t, i) => {
      onSetPercentage(t.id, source, each + (i === 0 ? remainder : 0));
    });
  };

  const clearRow = (source: string) => {
    teams.forEach(t => onSetPercentage(t.id, source, 0));
  };

  return (
    <Card className="border-2">
      <CardHeader className="pb-2">
        <CardTitle className="text-sm flex items-center gap-2">
          <LayoutGrid className="h-4 w-4" />
          Source → Team split (%)
          {!routingEnabled && (
            <Badge variant="outline" className="text-[10px] border-amber-400 text-amber-700">
              Preview — master switch is OFF
            </Badge>
          )}
        </CardTitle>
        <p className="text-xs text-muted-foreground mt-1">
          Set what percentage of each source goes to each team. Row must total <strong>100%</strong> for the source to route fully via teams; any shortfall falls back to the live flow. Use <em>Even split</em> to divide equally.
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
              <th className="px-2 py-2 text-center text-xs text-muted-foreground">Total</th>
              <th className="px-2 py-2 text-right text-xs text-muted-foreground">Quick</th>
            </tr>
          </thead>
          <tbody>
            {LEAD_SOURCES.map(s => {
              const total = rowTotal(s.value);
              const totalClass =
                total === 0
                  ? 'bg-muted text-muted-foreground'
                  : total === 100
                  ? 'bg-emerald-100 text-emerald-700'
                  : total < 100
                  ? 'bg-amber-100 text-amber-700'
                  : 'bg-red-100 text-red-700';
              return (
                <tr key={s.value} className="border-t">
                  <td className="px-2 py-2 sticky left-0 bg-background">
                    <span className="inline-flex items-center gap-2">
                      <span className="text-base">{s.icon}</span>
                      <span className="font-medium">{s.label}</span>
                    </span>
                  </td>
                  {teams.map(t => {
                    const v = pctOf(t.id, s.value);
                    return (
                      <td key={t.id} className="px-2 py-2 text-center">
                        <div className="inline-flex items-center gap-1">
                          <Input
                            type="number"
                            min={0}
                            max={100}
                            step={5}
                            disabled={!canEdit}
                            value={v}
                            onChange={(e) => {
                              const next = Math.max(0, Math.min(100, parseInt(e.target.value || '0', 10) || 0));
                              onSetPercentage(t.id, s.value, next);
                            }}
                            className="w-16 h-8 text-center"
                          />
                          <span className="text-xs text-muted-foreground">%</span>
                        </div>
                      </td>
                    );
                  })}
                  <td className="px-2 py-2 text-center">
                    <span className={`inline-flex items-center justify-center min-w-[3rem] px-2 py-0.5 rounded-full text-xs font-semibold ${totalClass}`}>
                      {total}%
                    </span>
                  </td>
                  <td className="px-2 py-2 text-right whitespace-nowrap">
                    <Button size="sm" variant="outline" className="h-7 px-2 text-xs mr-1" disabled={!canEdit} onClick={() => evenSplit(s.value)}>
                      <Wand2 className="h-3 w-3 mr-1" /> Even
                    </Button>
                    <Button size="sm" variant="ghost" className="h-7 px-2 text-xs" disabled={!canEdit || total === 0} onClick={() => clearRow(s.value)}>
                      Clear
                    </Button>
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </CardContent>
    </Card>
  );
};
