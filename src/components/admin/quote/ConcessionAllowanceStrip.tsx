import { useState } from 'react';
import { useConcessionAllowance } from '@/hooks/useConcessionAllowance';
import { useIsManagement } from '@/hooks/useIsManagement';
import { Button } from '@/components/ui/button';
import { CalendarDays, HelpCircle, Settings, AlertCircle, Lock, Plus } from 'lucide-react';
import { cn } from '@/lib/utils';
import { ConcessionAllowanceManager } from './ConcessionAllowanceManager';
import { ConcessionAuthRequestDialog } from './ConcessionAuthRequestDialog';

interface Props {
  adminUserId: string | null;
}

function formatMonthLabel(yearMonth: string) {
  const [y, m] = (yearMonth || '').split('-').map(Number);
  if (!y || !m) return yearMonth;
  return new Date(y, m - 1, 1).toLocaleDateString('en-GB', { month: 'long', year: 'numeric' });
}

function CounterBox({
  badge,
  label,
  used,
  remaining,
  allow,
  onRequest,
}: {
  badge: string;
  label: string;
  used: number;
  remaining: number;
  allow: number;
  onRequest?: () => void;
}) {
  const isExhausted = remaining <= 0;
  const isLow = remaining > 0 && remaining <= 2;
  const pct = allow > 0 ? Math.min(100, Math.round((used / allow) * 100)) : 0;

  return (
    <div className="flex items-center gap-3 px-4 py-3">
      <div
        className={cn(
          'w-11 h-11 shrink-0 rounded-full flex items-center justify-center text-sm font-bold',
          isExhausted
            ? 'bg-red-100 text-red-700'
            : isLow
              ? 'bg-amber-100 text-amber-700'
              : 'bg-emerald-100 text-emerald-700'
        )}
      >
        {badge}
      </div>
      <div className="min-w-0 flex-1">
        <div className="text-xs text-muted-foreground">{label}</div>
        <div className="text-base font-bold text-foreground">
          {used} of {allow} used
        </div>
        <div className="mt-1.5 h-1.5 w-full rounded-full bg-muted overflow-hidden">
          <div
            className={cn(
              'h-full rounded-full transition-all',
              isExhausted ? 'bg-red-400' : isLow ? 'bg-amber-400' : 'bg-emerald-500'
            )}
            style={{ width: `${pct}%` }}
          />
        </div>
        <div className="mt-1 flex items-center gap-2 flex-wrap">
          <span className="text-xs text-muted-foreground">{remaining} remaining</span>
          {isExhausted && onRequest && (
            <Button
              variant="outline"
              size="sm"
              className="h-6 text-[11px] px-2 whitespace-nowrap"
              onClick={onRequest}
            >
              <Plus className="w-3 h-3 mr-1" />
              Request more
            </Button>
          )}
        </div>
      </div>
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
    <div className="rounded-xl border bg-background/80 p-4">
      <div className="flex items-start justify-between gap-3">
        <div className="flex items-center gap-2">
          <CalendarDays className="w-4 h-4 text-emerald-600" />
          <span className="text-base font-semibold">
            Your Monthly Concession Allowance ({formatMonthLabel(yearMonth)})
            {loading && <span className="ml-1 text-sm font-normal text-muted-foreground">updating…</span>}
          </span>
        </div>
        <div className="flex items-center gap-1">
          <div className="group relative">
            <span className="flex items-center gap-1 text-xs text-muted-foreground underline cursor-help">
              <HelpCircle className="w-4 h-4" />
              Learn more
            </span>
            <div className="absolute right-0 top-full z-20 mt-1 hidden w-72 rounded-md border bg-popover p-2.5 text-xs text-popover-foreground shadow-md group-hover:block">
              Free cover is an expensive concession. Use it last, not first: reassure on cover,
              offer a small discount, then +1 month per year, then +3 months, and +6 months only as
              a rescue. Your allowance resets on the 1st of each month.
            </div>
          </div>
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
        </div>
      </div>

      <div className="mt-3 rounded-lg border bg-background divide-y sm:divide-y-0 sm:divide-x grid grid-cols-1 sm:grid-cols-3">
        <CounterBox
          badge="+1"
          label="+1 Month per Year"
          used={used1mo}
          remaining={remaining1mo}
          allow={allow1mo}
          onRequest={!isManagement ? () => setRequestType('1mo') : undefined}
        />
        <CounterBox
          badge="+3"
          label="+3 Months Free"
          used={used3mo}
          remaining={remaining3mo}
          allow={allow3mo}
          onRequest={!isManagement ? () => setRequestType('3mo') : undefined}
        />
        <CounterBox
          badge="+6"
          label="+6 Months Free"
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
