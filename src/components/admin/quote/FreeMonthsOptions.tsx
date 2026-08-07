import { Gift, CheckCircle2 } from 'lucide-react';
import { cn } from '@/lib/utils';
import { useConcessionAllowance } from '@/hooks/useConcessionAllowance';
import { useIsManagement } from '@/hooks/useIsManagement';
import { toast } from '@/hooks/use-toast';

export type FreeCoverOption = 'none' | 'peryear' | '3months' | '6months';

export function bonusMonthsForOption(option: FreeCoverOption, coverYears: number): number {
  switch (option) {
    case 'peryear':
      return Math.max(1, coverYears);
    case '3months':
      return 3;
    case '6months':
      return 6;
    default:
      return 0;
  }
}

interface Props {
  value: FreeCoverOption;
  onChange: (value: FreeCoverOption) => void;
  /** Cover length in years (1/2/3) — drives "+1 month per year" total. */
  coverYears: number;
  /** Admin user whose monthly allowance is shown. */
  adminUserId: string | null;
  className?: string;
  /** Hide the small heading (when the parent already has a label). */
  hideHeader?: boolean;
}

/**
 * Shared "Optional Extended Cover" picker — same options, allowance counters and
 * customer-facing note used on Quotes & Orders, Confirm External Payment and the
 * Customer Management edit dialog.
 */
export default function FreeMonthsOptions({
  value,
  onChange,
  coverYears,
  adminUserId,
  className,
  hideHeader,
}: Props) {
  const {
    allow1mo, allow3mo, allow6mo,
    used1mo, used3mo, used6mo,
    remaining1mo, remaining3mo, remaining6mo,
    canUse1mo, canUse3mo, canUse6mo,
  } = useConcessionAllowance(adminUserId);
  const { isManagement } = useIsManagement();

  const selectedBonusMonths = bonusMonthsForOption(value, coverYears);

  const pillTone = (remaining: number, warm = false) =>
    remaining <= 0
      ? 'bg-red-100 text-red-700'
      : remaining <= 2
        ? 'bg-amber-100 text-amber-700'
        : warm
          ? 'bg-orange-100 text-orange-700'
          : 'bg-emerald-100 text-emerald-700';

  const pick = (key: FreeCoverOption, allowed: boolean, used: number, allow: number, label: string) => {
    if (value === key) { onChange('none'); return; }
    if (!isManagement && !allowed) {
      toast({
        title: `${label} allowance used`,
        description: `You have used ${used} of ${allow} ${label} concessions this month. Request a manager authorisation.`,
        variant: 'destructive',
      });
      return;
    }
    onChange(key);
  };

  const tiles = [
    { key: 'none' as const, title: 'None', subtitle: 'No free months', pill: null as string | null, tone: '', chip: null as string | null, exhausted: false, onSelect: () => onChange('none') },
    {
      key: 'peryear' as const,
      title: '+1 Month per Year',
      subtitle: `adds ${Math.max(1, coverYears)} month${coverYears === 1 ? '' : 's'} total`,
      pill: `${remaining1mo} remaining`,
      tone: pillTone(remaining1mo),
      chip: 'Recommended',
      exhausted: !isManagement && !canUse1mo,
      onSelect: () => pick('peryear', canUse1mo, used1mo, allow1mo, '+1 month per year'),
    },
    {
      key: '3months' as const,
      title: '+3 Months Free',
      subtitle: 'Balanced option',
      pill: `${remaining3mo} remaining`,
      tone: pillTone(remaining3mo),
      chip: null,
      exhausted: !isManagement && !canUse3mo,
      onSelect: () => pick('3months', canUse3mo, used3mo, allow3mo, '+3 months free'),
    },
    {
      key: '6months' as const,
      title: '+6 Months Free',
      subtitle: 'Use as a last resort',
      pill: `${remaining6mo} remaining`,
      tone: pillTone(remaining6mo, true),
      chip: null,
      exhausted: !isManagement && !canUse6mo,
      onSelect: () => pick('6months', canUse6mo, used6mo, allow6mo, '+6 months free'),
    },
  ];

  return (
    <div className={cn('rounded-xl border p-3', value !== 'none' ? 'border-emerald-400 bg-emerald-50/30' : 'border-dashed border-gray-300 bg-gray-50/40', className)}>
      {!hideHeader && (
        <div className="flex items-center gap-2 mb-2">
          <div className={cn('w-7 h-7 shrink-0 rounded-lg flex items-center justify-center', value !== 'none' ? 'bg-emerald-600 text-white' : 'bg-emerald-100 text-emerald-700')}>
            <Gift className="w-4 h-4" />
          </div>
          <div>
            <div className="text-sm font-bold text-gray-900">Optional Extended Cover</div>
            <p className="text-xs text-muted-foreground">Use free months as a last resort, not a first offer.</p>
          </div>
        </div>
      )}

      <div className="space-y-1.5">
        {tiles.map((tile) => {
          const selected = value === tile.key;
          const disabled = !selected && tile.exhausted;
          return (
            <button
              key={tile.key}
              type="button"
              onClick={tile.onSelect}
              disabled={disabled}
              title={disabled ? 'Allowance exhausted this month' : undefined}
              className={cn(
                'w-full relative flex items-center justify-between rounded-lg border bg-white px-3 py-2 text-left transition-all',
                selected ? 'border-emerald-500 bg-emerald-50/70 shadow-sm' : 'border-gray-200 hover:border-emerald-400 hover:bg-emerald-50/30',
                disabled && 'opacity-60 cursor-not-allowed'
              )}
            >
              <div className="flex items-center gap-3">
                <div className={cn('w-4 h-4 rounded-full border-2 flex items-center justify-center flex-shrink-0', selected ? 'border-emerald-600' : 'border-gray-300')}>
                  {selected && <div className="w-2 h-2 rounded-full bg-emerald-600" />}
                </div>
                <div>
                  <div className="flex items-center gap-2">
                    <span className="text-sm font-bold text-gray-900">{tile.title}</span>
                    {tile.chip && (
                      <span className="rounded bg-emerald-100 px-1.5 py-0 text-[10px] font-bold text-emerald-700">{tile.chip}</span>
                    )}
                  </div>
                  <div className="text-xs text-muted-foreground">{tile.subtitle}</div>
                </div>
              </div>
              {tile.pill && (
                <span className={cn('rounded px-2 py-0.5 text-[11px] font-semibold', tile.tone)}>{tile.pill}</span>
              )}
            </button>
          );
        })}
      </div>

      {value !== 'none' && (
        <div className="mt-2 px-3 py-2 bg-emerald-100/70 rounded border border-emerald-300 text-xs text-emerald-900 flex items-start gap-2">
          <CheckCircle2 className="w-4 h-4 text-emerald-700 flex-shrink-0 mt-0.5" />
          <div>
            <div className="font-semibold">Customer will see +{selectedBonusMonths} FREE months</div>
            <div className="text-[11px] text-emerald-800/80">This will appear on their quote page, welcome email and customer dashboard.</div>
          </div>
        </div>
      )}
    </div>
  );
}
