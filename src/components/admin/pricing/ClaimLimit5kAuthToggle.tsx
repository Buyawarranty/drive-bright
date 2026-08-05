import React from 'react';
import { Switch } from '@/components/ui/switch';
import { Check, ShieldCheck } from 'lucide-react';
import { toast } from 'sonner';
import { useClaimLimit5kAuthRequired } from '@/hooks/useClaimLimit5kAuthRequired';

/**
 * Management switch on the Price updates page controlling whether agents need
 * manager authorisation before quoting the £5,000 AutoCare Premium claim limit
 * on Quotes & Orders. Off = agents can sell it freely.
 */
export default function ClaimLimit5kAuthToggle() {
  const { required, loading, setRequired } = useClaimLimit5kAuthRequired();

  return (
    <div className="rounded-lg border-2 border-amber-300 bg-amber-50/60 p-4 flex flex-wrap items-center justify-between gap-4">
      <div className="space-y-1">
        <div className="flex items-center gap-2 text-base font-semibold">
          <ShieldCheck className="h-5 w-5 text-amber-700" />
          £5,000 claim limit needs manager authorisation
        </div>
        <p className="text-sm text-muted-foreground max-w-2xl">
          When on, agents must request approval per registration before they can quote, send or take
          payment on £5,000 cover — unapproved quotes fall back to £3,000. When off, agents can
          select £5,000 themselves.
        </p>
      </div>
      <div className="flex items-center gap-3">
        <span
          className={`inline-flex items-center gap-1 text-sm font-semibold ${
            required ? 'text-emerald-700' : 'text-muted-foreground'
          }`}
        >
          {required && <Check className="h-4 w-4" />}
          {required ? 'Authorisation required' : 'Authorisation off'}
        </span>
        <Switch
          checked={required}
          disabled={loading}
          onCheckedChange={async (next) => {
            const ok = await setRequired(next);
            toast[ok ? 'success' : 'error'](
              ok
                ? next
                  ? '£5,000 cover now needs manager authorisation'
                  : '£5,000 cover can now be sold without authorisation'
                : 'Could not update the setting'
            );
          }}
          className="data-[state=checked]:bg-emerald-600 scale-125"
        />
      </div>
    </div>
  );
}
