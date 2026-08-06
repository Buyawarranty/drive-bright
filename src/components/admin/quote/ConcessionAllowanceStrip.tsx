import { useState } from 'react';
import { useConcessionAllowance } from '@/hooks/useConcessionAllowance';
import { useIsManagement } from '@/hooks/useIsManagement';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Gift, HelpCircle, Settings, AlertCircle, Lock, Plus } from 'lucide-react';
import { cn } from '@/lib/utils';
import { ConcessionAllowanceManager } from './ConcessionAllowanceManager';
import { ConcessionAuthRequestDialog } from './ConcessionAuthRequestDialog';

interface Props {
  adminUserId: string | null;
}

function CounterPill({
  label,
  used,
  remaining,
  allow,
  onRequest,
}: {
  label: string;
  used: number;
  remaining: number;
  allow: number;
  onRequest?: () => void;
}) {
  const isExhausted = remaining <= 0;
  const isLow = remaining > 0 && remaining <= 2;
  const percent = allow > 0 ? Math.round((used / allow) * 100) : 0;

  return (
    <div
      className={cn(
        'rounded-md border px-3 py-2',
        isExhausted
          ? 'bg-red-50/60 border-red-200'
          : isLow
            ? 'bg-amber-50/60 border-amber-200'
            : 'bg-emerald-50/40 border-emerald-100'
      )}
    >
      <div className="flex items-center justify-between gap-3">
        <div>
          <div className="text-xs font-medium text-foreground/80">{label}</div>
          <div className="text-sm font-semibold">
            {used} of {allow} used
          </div>
        </div>
        <div className="flex items-center gap-2">
          <Badge
            variant={isExhausted ? 'destructive' : isLow ? 'secondary' : 'outline'}
            className="text-xs whitespace-nowrap"
          >
            {remaining} remaining
          </Badge>
          {isExhausted && onRequest && (
            <Button
              variant="outline"
              size="sm"
              className="h-7 text-xs whitespace-nowrap"
              onClick={onRequest}
            >
              <Plus className="w-3 h-3 mr-1" />
              Request more
            </Button>
          )}
        </div>
      </div>
      <div className="mt-1.5 h-1.5 w-full overflow-hidden rounded-full bg-muted">
        <div
          className={cn(
            'h-full transition-all',
            isExhausted ? 'bg-red-500' : isLow ? 'bg-amber-500' : 'bg-emerald-500'
          )}
          style={{ width: `${Math.min(100, percent)}%` }}
        />
      </div>
    </div>
  );
}

export function ConcessionAllowanceStrip({ adminUserId }: Props) {
  const {
    yearMonth,
    allow3mo,
    allow6mo,
    used3mo,
    used6mo,
    remaining3mo,
    remaining6mo,
    canUse3mo,
    canUse6mo,
    loading,
  } = useConcessionAllowance(adminUserId);
  const { isManagement } = useIsManagement();
  const [showManager, setShowManager] = useState(false);
  const [requestType, setRequestType] = useState<'3mo' | '6mo' | null>(null);

  if (loading) {
    return (
      <div className="text-xs text-muted-foreground">Loading monthly concession allowance…</div>
    );
  }

  return (
    <div className="rounded-lg border bg-muted/30 p-3 mb-4">
      <div className="flex items-start justify-between gap-3">
        <div className="flex items-center gap-2">
          <Gift className="w-4 h-4 text-emerald-600" />
          <span className="text-sm font-semibold">
            Monthly concession allowance ({yearMonth})
          </span>
        </div>
        <div className="flex items-center gap-1">
          {isManagement && (
            <Button
              variant="ghost"
              size="icon"
              className="h-7 w-7"
              onClick={() => setShowManager(true)}
              title="Manage allowances"
            >
              <Settings className="w-4 h-4" />
            </Button>
          )}
          <div className="group relative">
            <HelpCircle className="w-4 h-4 text-muted-foreground cursor-help" />
            <div className="absolute right-0 top-full z-20 mt-1 hidden w-72 rounded-md border bg-popover p-2.5 text-xs text-popover-foreground shadow-md group-hover:block">
              Free cover is an expensive concession. Use it last, not first: reassure on cover,
              offer a small discount, then +3 months, then +6 months only as a rescue. Your
              allowance resets on the 1st of each month.
            </div>
          </div>
        </div>
      </div>

      <div className="mt-2 grid grid-cols-1 sm:grid-cols-2 gap-2">
        <CounterPill
          label="+3 months free"
          used={used3mo}
          remaining={remaining3mo}
          allow={allow3mo}
          onRequest={!isManagement ? () => setRequestType('3mo') : undefined}
        />
        <CounterPill
          label="+6 months free"
          used={used6mo}
          remaining={remaining6mo}
          allow={allow6mo}
          onRequest={!isManagement ? () => setRequestType('6mo') : undefined}
        />
      </div>

      {(isManagement && (!canUse3mo || !canUse6mo)) && (
        <div className="mt-2 text-xs text-amber-700 flex items-center gap-1.5">
          <AlertCircle className="w-3 h-3" />
          <span>
            You have management override — exhausted concession buttons remain enabled for you.
          </span>
        </div>
      )}

      {!isManagement && (
        <div className="mt-2 rounded-md border border-emerald-100 bg-emerald-50/40 p-2 text-xs text-foreground/80">
          <span className="font-medium">Guidance:</span> free cover is expensive — use it last, not
          first. Reassure on cover, then offer a small discount, then +3 months, and +6 months only
          as a rescue. Your allowance resets on the 1st of each month.
        </div>
      )}

      {!isManagement && (!canUse3mo || !canUse6mo) && (
        <div className="mt-2 text-xs text-muted-foreground flex items-center gap-1.5">
          <Lock className="w-3 h-3" />
          <span>
            At least one allowance has run out. Tap “Request more” to ask a manager for an extra
            concession.
          </span>
        </div>
      )}


      <ConcessionAllowanceManager open={showManager} onOpenChange={setShowManager} />
      <ConcessionAuthRequestDialog
        open={requestType !== null}
        type={requestType}
        onOpenChange={(open) => !open && setRequestType(null)}
        adminUserId={adminUserId}
        yearMonth={yearMonth}
      />
    </div>
  );
}
