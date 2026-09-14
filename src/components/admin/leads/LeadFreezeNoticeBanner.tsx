import React from 'react';
import { supabase } from '@/integrations/supabase/client';
import { format } from 'date-fns';
import { Snowflake, X } from 'lucide-react';

interface Props {
  adminUserId?: string | null;
}

/**
 * Notice shown at the top of New leads when the signed-in agent's lead
 * allocation is currently switched off (automatically or by a manager).
 */
export const LeadFreezeNoticeBanner: React.FC<Props> = ({ adminUserId }) => {
  const [state, setState] = React.useState<{
    paused: boolean;
    source: string | null;
    reason: string | null;
    until: string | null;
  } | null>(null);
  const [dismissed, setDismissed] = React.useState(false);

  React.useEffect(() => {
    if (!adminUserId) return;
    let cancelled = false;
    const load = async () => {
      const { data } = await supabase
        .from('agent_distribution_caps')
        .select('paused, freeze_source, freeze_reason, frozen_until')
        .eq('admin_user_id', adminUserId)
        .maybeSingle();
      if (cancelled || !data) return;
      setState({
        paused: (data as any).paused === true,
        source: (data as any).freeze_source ?? null,
        reason: (data as any).freeze_reason ?? null,
        until: (data as any).frozen_until ?? null,
      });
    };
    load();
    const t = setInterval(() => { if (shouldSkipPoll()) return; load(); }, 120000);
    return () => {
      cancelled = true;
      clearInterval(t);
    };
  }, [adminUserId]);

  if (!state?.paused || dismissed) return null;

  const isAuto = state.source === 'auto';

  return (
    <div className="rounded-lg border-2 border-sky-500/70 bg-sky-50 dark:bg-sky-950/30 px-4 py-3 flex items-start gap-3">
      <Snowflake className="h-5 w-5 text-sky-600 shrink-0 mt-0.5" />
      <div className="min-w-0 flex-1">
        <div className="text-sm font-semibold text-foreground">
          {isAuto ? 'New leads are paused on your account' : 'A manager has paused your new leads'}
        </div>
        <div className="text-xs text-muted-foreground mt-0.5">
          {state.reason || 'Lead allocation is currently switched off.'}
          {isAuto && state.until && ` Leads resume on ${format(new Date(state.until), 'EEE d MMM')}.`}
        </div>
        <div className="text-xs text-muted-foreground mt-1">
          Keep working your existing leads and callbacks — they are unaffected. Hitting your monthly target pro-rata
          lifts the automatic pause. Speak to your manager if you think this is wrong.
        </div>
      </div>
      <button
        type="button"
        onClick={() => setDismissed(true)}
        aria-label="Dismiss notice"
        className="text-muted-foreground hover:text-foreground shrink-0"
      >
        <X className="h-4 w-4" />
      </button>
    </div>
  );
};

export default LeadFreezeNoticeBanner;
