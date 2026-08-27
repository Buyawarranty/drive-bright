import React, { useEffect, useState } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { Switch } from '@/components/ui/switch';
import { Badge } from '@/components/ui/badge';
import { Card } from '@/components/ui/card';
import { toast } from 'sonner';
import { Loader2, FlaskConical, Radio, Lock } from 'lucide-react';
import { invalidateFeatureFlagsCache } from '@/hooks/useFeatureFlags';

export const RENEWALS_ENGINE_FLAG = 'renewals_engine_live';

const MANAGEMENT_ROLES = ['admin', 'super_admin', 'sales_manager'];

interface Props {
  userRole?: string | null;
  onChange?: (live: boolean) => void;
}

/**
 * Big, unmissable master switch that decides whether the new renewals engine
 * is LIVE (renewal leads flow into New Leads) or in SANDBOX (nothing flows out).
 */
export const RenewalsEngineLiveSwitch: React.FC<Props> = ({ userRole, onChange }) => {
  const [live, setLive] = useState(false);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const canToggle = MANAGEMENT_ROLES.includes((userRole || '').toLowerCase());

  useEffect(() => {
    let mounted = true;
    (async () => {
      const { data } = await supabase
        .from('feature_flags')
        .select('enabled')
        .eq('key', RENEWALS_ENGINE_FLAG)
        .maybeSingle();
      if (!mounted) return;
      const enabled = !!(data as any)?.enabled;
      setLive(enabled);
      setLoading(false);
      onChange?.(enabled);
    })();
    return () => { mounted = false; };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const handleToggle = async (next: boolean) => {
    if (!canToggle) {
      toast.error('Management only', { description: 'Only admins and sales managers can switch the renewals engine live.' });
      return;
    }
    setSaving(true);
    const { data: { user } } = await supabase.auth.getUser();
    const { error } = await (supabase.from('feature_flags') as any)
      .update({ enabled: next, updated_by: user?.id ?? null })
      .eq('key', RENEWALS_ENGINE_FLAG);
    setSaving(false);
    if (error) {
      toast.error('Could not change the switch', { description: error.message });
      return;
    }
    setLive(next);
    invalidateFeatureFlagsCache();
    onChange?.(next);
    toast.success(next ? 'Renewals engine is LIVE' : 'Renewals engine back in sandbox', {
      description: next
        ? 'Renewal leads will now flow into the New Leads section.'
        : 'Nothing will flow into New Leads while this is off.',
    });
  };

  return (
    <Card
      className={`border-2 p-4 sm:p-5 ${live ? 'border-green-500 bg-green-50' : 'border-amber-400 bg-amber-50'}`}
    >
      <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
        <div className="flex items-start gap-3">
          <div
            className={`flex h-11 w-11 shrink-0 items-center justify-center rounded-full ${
              live ? 'bg-green-600 text-green-50' : 'bg-amber-500 text-amber-50'
            }`}
          >
            {live ? <Radio className="h-5 w-5" /> : <FlaskConical className="h-5 w-5" />}
          </div>
          <div>
            <div className="flex items-center gap-2">
              <h3 className="text-base font-semibold sm:text-lg">
                {live ? 'Renewals engine is LIVE' : 'Renewals engine is in SANDBOX'}
              </h3>
              <Badge
                variant="outline"
                className={live ? 'border-green-600 text-green-800' : 'border-amber-600 text-amber-800'}
              >
                {live ? 'ON' : 'OFF'}
              </Badge>
            </div>
            <p className="mt-1 max-w-xl text-sm text-muted-foreground">
              {live
                ? 'Renewal leads are being pushed into the New Leads section and distributed to agents.'
                : 'Safe mode — you can build, browse and test here. Nothing is pushed to New Leads and no agent is assigned anything.'}
            </p>
          </div>
        </div>

        <div className="flex items-center gap-3 sm:flex-col sm:items-end">
          <div className="flex items-center gap-3">
            <span className={`text-sm font-medium ${live ? 'text-green-800' : 'text-amber-800'}`}>
              {live ? 'Turn off (sandbox)' : 'Turn on (go live)'}
            </span>
            {loading || saving ? (
              <Loader2 className="h-5 w-5 animate-spin text-muted-foreground" />
            ) : (
              <Switch
                checked={live}
                onCheckedChange={handleToggle}
                disabled={!canToggle}
                aria-label="Turn the renewals engine live"
                className="scale-125 data-[state=checked]:bg-green-600"
              />
            )}
          </div>
          {!canToggle && (
            <span className="flex items-center gap-1 text-xs text-muted-foreground">
              <Lock className="h-3 w-3" /> Management only
            </span>
          )}
        </div>
      </div>
    </Card>
  );
};

export default RenewalsEngineLiveSwitch;
