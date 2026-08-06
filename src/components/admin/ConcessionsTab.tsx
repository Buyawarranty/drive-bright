import { useCurrentAdminId } from '@/hooks/useCurrentAdminId';
import { useConcessionAllowance } from '@/hooks/useConcessionAllowance';
import { useIsManagement } from '@/hooks/useIsManagement';
import { ConcessionAllowanceManager } from './quote/ConcessionAllowanceManager';
import { ConcessionAuthRequestDialog } from './quote/ConcessionAuthRequestDialog';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Progress } from '@/components/ui/progress';
import { Gift, HelpCircle, Plus, AlertCircle } from 'lucide-react';
import { useState } from 'react';

export function ConcessionsTab() {
  const adminUserId = useCurrentAdminId();
  const { isManagement } = useIsManagement();
  const [requestType, setRequestType] = useState<'3mo' | '6mo' | '1mo' | null>(null);

  if (isManagement) {
    return <ConcessionAllowanceManager standalone />;
  }

  return <AgentConcessionView adminUserId={adminUserId} />;
}

function AgentConcessionView({ adminUserId }: { adminUserId: string | null }) {
  const [requestType, setRequestType] = useState<'3mo' | '6mo' | '1mo' | null>(null);
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

  return (
    <div className="max-w-5xl mx-auto p-6">
      <div className="mb-6">
        <h1 className="text-2xl font-semibold flex items-center gap-2">
          <Gift className="w-6 h-6 text-emerald-600" />
          Optional Extended Cover Allowance
        </h1>
        <p className="text-muted-foreground mt-1">
          Your monthly allowance for +1 month per year, +3 month and +6 month free extensions. Month: {yearMonth}.
        </p>
      </div>

      <Card className="mb-6">
        <CardHeader>
          <CardTitle className="flex items-center gap-2 text-lg">
            Monthly Limits
            <div className="group relative">
              <HelpCircle className="w-4 h-4 text-muted-foreground cursor-help" />
              <div className="absolute left-0 top-full z-20 mt-1 hidden w-72 rounded-md border bg-popover p-2.5 text-xs text-popover-foreground shadow-md group-hover:block">
                Free cover is an expensive concession. Use it last, not first: reassure on cover,
                offer a small discount, then +1 month per year, then +3 months, then +6 months only as a rescue. Your
                allowance resets on the 1st of each month.
              </div>
            </div>
          </CardTitle>
          <CardDescription>
            Once you have used your allowance, the free-month buttons in Quotes & Orders will be
            disabled and you can request a manager authorisation.
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          {loading ? (
            <div className="text-sm text-muted-foreground">Loading your allowance…</div>
          ) : (
            <>
              <ConcessionCounter
                label="+1 month free per year of cover"
                used={used1mo}
                allow={allow1mo}
                remaining={remaining1mo}
                available={canUse1mo}
                onRequest={() => setRequestType('1mo')}
              />
              <ConcessionCounter
                label="+3 months free"
                used={used3mo}
                allow={allow3mo}
                remaining={remaining3mo}
                available={canUse3mo}
                onRequest={() => setRequestType('3mo')}
              />
              <ConcessionCounter
                label="+6 months free"
                used={used6mo}
                allow={allow6mo}
                remaining={remaining6mo}
                available={canUse6mo}
                onRequest={() => setRequestType('6mo')}
              />

              {!canUse3mo && !canUse6mo && !canUse1mo && (
                <div className="flex items-start gap-2 rounded-md bg-amber-50 border border-amber-200 p-3 text-sm text-amber-800">
                  <AlertCircle className="w-4 h-4 mt-0.5 flex-shrink-0" />
                  <span>
                    Both allowances are exhausted this month. Tap “Request more” to ask a manager
                    for an extra concession.
                  </span>
                </div>
              )}
            </>
          )}
        </CardContent>
      </Card>

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

function ConcessionCounter({
  label,
  used,
  allow,
  remaining,
  available,
  onRequest,
}: {
  label: string;
  used: number;
  allow: number;
  remaining: number;
  available: boolean;
  onRequest: () => void;
}) {
  const percent = allow > 0 ? Math.min(100, Math.round((used / allow) * 100)) : 0;
  return (
    <div className="border rounded-lg p-4">
      <div className="flex items-center justify-between mb-2">
        <div className="font-medium">{label}</div>
        {available ? (
          <Badge variant="outline" className="text-emerald-700 border-emerald-200 bg-emerald-50">
            {remaining} remaining
          </Badge>
        ) : (
          <Badge variant="destructive">Exhausted</Badge>
        )}
      </div>
      <div className="text-sm text-muted-foreground mb-2">
        {used} of {allow} used this month
      </div>
      <Progress value={percent} className="h-2 mb-3" />
      {!available && (
        <Button variant="outline" size="sm" onClick={onRequest}>
          <Plus className="w-4 h-4 mr-1" />
          Request more
        </Button>
      )}
    </div>
  );
}

export default ConcessionsTab;
