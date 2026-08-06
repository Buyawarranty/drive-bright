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

function CounterBox({
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

  return (
    <div
      className={cn(
        'relative py-4 px-3 rounded-lg border-2 text-center transition-all flex flex-col items-center justify-center min-h-[100px]',
        isExhausted
          ? 'border-red-200 bg-red-50/50'
          : isLow
            ? 'border-amber-200 bg-amber-50/50'
            : 'border-border bg-background hover:border-primary/50'
      )}
    >
      <div className="text-sm font-semibold text-foreground">{used} of {allow} used</div>
      <div className="text-xs text-muted-foreground mt-1">{remaining} remaining</div>
      <div className="text-xs text-muted-foreground mt-2 font-medium leading-tight">{label}</div>
      {isExhausted && onRequest && (
        <Button
          variant="outline"
          size="sm"
          className="mt-2 h-7 text-xs whitespace-nowrap"
          onClick={onRequest}
        >
          <Plus className="w-3 h-3 mr-1" />
          Request more
        </Button>
      )}
    </div>
  );
}

export function ConcessionAllowanceStrip({ adminUserId }: Props) {
  const {
    yearMonth,
    allow3mo,
    allow6mo,
    allow1mo,
    used3mo,
    used6mo,
    used1mo,
    remaining3mo,
    remaining6mo,
    remaining1mo,
    canUse3mo,
    canUse6mo,
    canUse1mo,
    loading,
  } = useConcessionAllowance(adminUserId);
  const { isManagement } = useIsManagement();
  const [showManager, setShowManager] = useState(false);
  const [requestType, setRequestType] = useState<'3mo' | '6mo' | '1mo' | null>(null);


  return (
    <div className="rounded-lg border bg-muted/30 p-3 mb-4">
      <div className="flex items-start justify-between gap-3">
        <div className="flex items-center gap-2">
          <Gift className="w-4 h-4 text-emerald-600" />
          <span className="text-sm font-semibold">
            Monthly concession allowance ({yearMonth})
            {loading && <span className="ml-1 font-normal text-muted-foreground">updating…</span>}
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

      <div className="mt-2 grid grid-cols-1 sm:grid-cols-3 gap-2">
        <CounterPill
          label="+1 month free per year"
          used={used1mo}
          remaining={remaining1mo}
          allow={allow1mo}
          onRequest={!isManagement ? () => setRequestType('1mo') : undefined}
        />
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

      {(isManagement && (!canUse3mo || !canUse6mo || !canUse1mo)) && (
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

      {!isManagement && (!canUse3mo || !canUse6mo || !canUse1mo) && (
        <div className="mt-2 text-xs text-muted-foreground flex items-center gap-1.5">
          <Lock className="w-3 h-3" />
          <span>
            At least one allowance has run out. Tap “Request more” to ask a manager for an extra
            concession.
          </span>
        </div>
      )}


      {isManagement && (
        <ConcessionAllowanceManager open={showManager} onOpenChange={setShowManager} />
      )}

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
