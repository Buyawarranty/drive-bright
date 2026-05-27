import React, { useState } from 'react';
import { ShieldCheck, PackagePlus, ChevronDown } from 'lucide-react';
import { Collapsible, CollapsibleContent, CollapsibleTrigger } from '@/components/ui/collapsible';
import PartsListContent from './PartsListContent';
import ExtrasSelector from './ExtrasSelector';

interface VehicleData {
  regNumber: string;
  make?: string;
  model?: string;
  year?: string;
  mileage?: string;
  fuelType?: string;
  vehicleType?: string;
  transmission?: string;
  firstName?: string;
  lastName?: string;
}

interface SelectedPlan {
  monthlyPrice: number;
  paymentType: '12months' | '24months' | '36months' | null;
  claimLimit: number | null;
  labourRate: number;
  voluntaryExcess: number | null;
}

interface Props {
  variant?: 'desktop' | 'mobile';
  vehicleData: VehicleData;
  selectedPlan: SelectedPlan;
  selectedAddOns?: { [key: string]: boolean };
  onAddOnChange?: (key: string, selected: boolean) => void;
}

type OpenId = 'covered' | 'extras' | null;

const SeeWhatsIncludedCard: React.FC<Props> = ({
  variant = 'desktop',
  selectedPlan,
  selectedAddOns,
  onAddOnChange,
}) => {
  const isMobile = variant === 'mobile';
  const [openId, setOpenId] = useState<OpenId>(null);

  const toggle = (id: 'covered' | 'extras') => setOpenId(prev => (prev === id ? null : id));

  const Trigger: React.FC<{
    id: 'covered' | 'extras';
    icon: React.ReactNode;
    label: string;
  }> = ({ id, icon, label }) => {
    const open = openId === id;
    return (
      <CollapsibleTrigger asChild>
        <button
          type="button"
          className="w-full inline-flex items-center justify-between gap-2 rounded-lg border border-[#D8E9DD] bg-white hover:bg-[#F3FAF5] text-foreground text-sm font-semibold px-4 py-3 transition-colors"
        >
          <span className="inline-flex items-center gap-2">
            {icon}
            {label}
          </span>
          <ChevronDown className={'w-4 h-4 transition-transform ' + (open ? 'rotate-180' : '')} />
        </button>
      </CollapsibleTrigger>
    );
  };

  const showExtras = !!onAddOnChange && !!selectedAddOns && !!selectedPlan.paymentType;

  return (
    <div
      className={
        'rounded-xl border border-[#D8E9DD] bg-[#F6FBF8] space-y-2 ' +
        (isMobile ? 'p-3' : 'p-4')
      }
    >
      <Collapsible open={openId === 'covered'} onOpenChange={() => toggle('covered')}>
        <Trigger
          id="covered"
          icon={<ShieldCheck className="w-4 h-4 text-[#3F8A5C]" />}
          label="See what's covered"
        />
        <CollapsibleContent className="overflow-hidden data-[state=closed]:animate-accordion-up data-[state=open]:animate-accordion-down">
          <div className="mt-2 rounded-lg border border-[#D8E9DD] bg-white p-3 sm:p-4">
            <PartsListContent />
          </div>
        </CollapsibleContent>
      </Collapsible>

      {showExtras && (
        <Collapsible open={openId === 'extras'} onOpenChange={() => toggle('extras')}>
          <Trigger
            id="extras"
            icon={<PackagePlus className="w-4 h-4 text-[#3F8A5C]" />}
            label="Optional extras"
          />
          <CollapsibleContent className="overflow-hidden data-[state=closed]:animate-accordion-up data-[state=open]:animate-accordion-down">
            <div className="mt-2 rounded-lg border border-[#D8E9DD] bg-white">
              <ExtrasSelector
                selectedAddOns={selectedAddOns!}
                onAddOnChange={onAddOnChange!}
                paymentType={selectedPlan.paymentType!}
                currentMonthlyPrice={selectedPlan.monthlyPrice}
              />
            </div>
          </CollapsibleContent>
        </Collapsible>
      )}
    </div>
  );
};

export default SeeWhatsIncludedCard;
