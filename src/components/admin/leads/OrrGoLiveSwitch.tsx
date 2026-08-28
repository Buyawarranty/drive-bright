import React from 'react';
import { supabase } from '@/integrations/supabase/client';
import { toast } from 'sonner';
import { Button } from '@/components/ui/button';
import { Rocket, ShieldAlert, Loader2 } from 'lucide-react';

/**
 * Open Round Robin go-live switch.
 * While off, ORR practice and monitoring are read-only and leads keep flowing
 * through the normal New Leads rotation. Turning it on routes real leads
 * through Open Round Robin.
 */
export const OrrGoLiveSwitch: React.FC<{
  live: boolean | null;
  canEdit: boolean;
  onChange: (live: boolean) => void;
}> = ({ live, canEdit, onChange }) => {
  const [saving, setSaving] = React.useState(false);

  const setLive = async (next: boolean) => {
    if (!canEdit) return;
    if (next && !window.confirm('Turn Open Round Robin LIVE? Real leads will start routing through it straight away.')) return;
    if (!next && !window.confirm('Switch Open Round Robin back to practice mode? Leads will go back to the normal New Leads rotation.')) return;
    setSaving(true);
    const { error } = await supabase
      .from('lead_distribution_settings')
      .update({ open_round_robin_enabled: next })
      .not('id', 'is', null);
    setSaving(false);
    if (error) {
      toast.error(`Could not change Open Round Robin: ${error.message}`);
      return;
    }
    onChange(next);
    toast.success(next ? 'Open Round Robin is LIVE — real leads now route through it' : 'Open Round Robin is back in practice mode');
  };

  const isLive = live === true;

  return (
    <div
      className={`rounded-md border p-4 flex flex-wrap items-start justify-between gap-3 ${
        isLive
          ? 'border-emerald-400 bg-emerald-50 dark:bg-emerald-950/30'
          : 'border-teal-300/60 bg-teal-50 dark:bg-teal-950/30'
      }`}
    >
      <div className="flex items-start gap-3">
        {isLive ? (
          <Rocket className="h-5 w-5 text-emerald-700 dark:text-emerald-300 mt-0.5 shrink-0" />
        ) : (
          <ShieldAlert className="h-5 w-5 text-teal-700 dark:text-teal-300 mt-0.5 shrink-0" />
        )}
        <div className="text-sm">
          <p className="font-semibold text-foreground">
            {live === null ? 'Checking Open Round Robin status…' : isLive ? 'Open Round Robin is LIVE' : 'Practice mode — Open Round Robin is off'}
          </p>
          <p className="text-muted-foreground mt-1 max-w-2xl">
            {isLive
              ? 'Real leads are being routed through Open Round Robin. Everything below is live — actions change real CRM assignments.'
              : 'Nothing below touches real leads: practice freely, watch the queues and the 120-second window. New enquiries keep flowing through the normal New Leads rotation until you turn it live.'}
          </p>
        </div>
      </div>
      <Button
        onClick={() => setLive(!isLive)}
        disabled={!canEdit || saving || live === null}
        variant={isLive ? 'outline' : 'default'}
        className="h-10"
      >
        {saving ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : <Rocket className="mr-2 h-4 w-4" />}
        {isLive ? 'Switch back to practice mode' : 'Turn Open Round Robin live'}
      </Button>
    </div>
  );
};

export default OrrGoLiveSwitch;
