import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { RotateCcw, Percent, Info } from 'lucide-react';
import { useLeadDistribution } from '@/hooks/useLeadDistribution';

type Mode = 'round_robin' | 'percentage';

interface Props {
  canEdit: boolean;
}

/**
 * Compact card that exposes the global distribution mode
 * (round-robin vs percentage). Writes to `lead_distribution_settings`
 * via useLeadDistribution.updateSettings — same call the old
 * New Leads controls used, so lead flow is unaffected.
 */
export const DistributionModeCard = ({ canEdit }: Props) => {
  const { settings, updateSettings, loading } = useLeadDistribution();
  const mode: Mode = (settings?.distribution_mode as Mode) || 'round_robin';

  const set = async (next: Mode) => {
    if (!canEdit || next === mode) return;
    await updateSettings({ distribution_mode: next });
  };

  return (
    <section className="rounded-lg border border-border bg-card shadow-sm">
      <div className="px-5 py-4 flex items-center justify-between gap-4 flex-wrap">
        <div className="min-w-0">
          <h2 className="text-base font-semibold text-foreground">Distribution mode</h2>
          <p className="text-sm text-muted-foreground mt-0.5">
            How new leads are shared out between the agents you set below.
          </p>
        </div>
        <div className="flex items-center gap-2">
          <Button
            variant={mode === 'round_robin' ? 'default' : 'outline'}
            size="sm"
            onClick={() => set('round_robin')}
            disabled={!canEdit || loading}
            className="gap-2"
          >
            <RotateCcw className="h-4 w-4" />
            Round robin
            {mode === 'round_robin' && <Badge variant="secondary" className="ml-1 text-[10px]">Active</Badge>}
          </Button>
          <Button
            variant={mode === 'percentage' ? 'default' : 'outline'}
            size="sm"
            onClick={() => set('percentage')}
            disabled={!canEdit || loading}
            className="gap-2"
          >
            <Percent className="h-4 w-4" />
            Percentage split
            {mode === 'percentage' && <Badge variant="secondary" className="ml-1 text-[10px]">Active</Badge>}
          </Button>
        </div>
      </div>
      <div className="px-5 pb-4 -mt-1">
        <div className="flex items-start gap-2 px-3 py-2 rounded-md bg-blue-50 text-blue-900 border border-blue-100">
          <Info className="h-4 w-4 mt-0.5 shrink-0" />
          <p className="text-xs">
            <strong>Round robin</strong> rotates each new lead evenly across active agents. <strong>Percentage split</strong> uses each agent's lead share below.
          </p>
        </div>
      </div>
    </section>
  );
};

export default DistributionModeCard;
