import React, { useState } from 'react';
import { ShieldCheck, PackagePlus, ChevronDown, Check } from 'lucide-react';
import { Collapsible, CollapsibleContent, CollapsibleTrigger } from '@/components/ui/collapsible';
import PartsListContent from './PartsListContent';

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

type OpenId = 'features' | 'parts' | null;

const WARRANTY_FEATURES = [
  'Mechanical & electrical parts covered',
  'Labour & diagnostics included',
  'Unlimited claims',
  'Vehicle rental contribution',
  'Breakdown recovery included',
  'European cover included',
  'Cover up to your vehicle value',
  'Use any VAT-registered garage',
  'Fast claims & direct garage payments',
  '14-day money-back guarantee',
];

const SeeWhatsIncludedCard: React.FC<Props> = ({ variant = 'desktop' }) => {
  const isMobile = variant === 'mobile';
  const [openId, setOpenId] = useState<OpenId>(null);

  const toggle = (id: 'features' | 'parts') => setOpenId(prev => (prev === id ? null : id));

  const Trigger: React.FC<{
    id: 'features' | 'parts';
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

  return (
    <div
      className={
        'rounded-xl border border-border bg-white space-y-2 ' +
        (isMobile ? 'p-3' : 'p-4')
      }
    >

      <Collapsible open={openId === 'features'} onOpenChange={() => toggle('features')}>
        <Trigger
          id="features"
          icon={<ShieldCheck className="w-4 h-4 text-[#3F8A5C]" />}
          label="See what's covered"
        />
        <CollapsibleContent className="overflow-hidden data-[state=closed]:animate-accordion-up data-[state=open]:animate-accordion-down">
          <div className="mt-2 rounded-lg border border-[#D8E9DD] bg-white p-3 sm:p-4">
            <ul className="space-y-2">
              {WARRANTY_FEATURES.map((item) => (
                <li key={item} className="flex items-start gap-2 text-sm text-foreground">
                  <span className="mt-0.5 inline-flex h-5 w-5 flex-shrink-0 items-center justify-center rounded-full bg-[#E6F4EB]">
                    <Check className="h-3.5 w-3.5 text-[#3F8A5C]" />
                  </span>
                  <span>{item}</span>
                </li>
              ))}
            </ul>
            <div className="mt-4 pt-3 border-t border-[#D8E9DD] flex flex-col sm:flex-row sm:items-center gap-2 sm:gap-4 text-sm">
              <a
                href="https://mzlpuxzwyrcyrgrongeb.supabase.co/storage/v1/object/public/policy-documents/platinum/platinum-warranty-plan-v3.4-2026-06-02.pdf"
                target="_blank"
                rel="noopener noreferrer"
                className="text-[#3F8A5C] font-semibold underline underline-offset-2 hover:text-[#2f6b46]"
              >
                See your platinum plan
              </a>
              <a
                href="https://mzlpuxzwyrcyrgrongeb.supabase.co/storage/v1/object/public/policy-documents/terms/terms-and-conditions-v3.4-2026-06-02.pdf"
                target="_blank"
                rel="noopener noreferrer"
                className="text-[#3F8A5C] font-semibold underline underline-offset-2 hover:text-[#2f6b46]"
              >
                Terms and conditions
              </a>
            </div>
          </div>
        </CollapsibleContent>
      </Collapsible>

      <Collapsible open={openId === 'parts'} onOpenChange={() => toggle('parts')}>
        <Trigger
          id="parts"
          icon={<PackagePlus className="w-4 h-4 text-[#3F8A5C]" />}
          label="View parts list"
        />
        <CollapsibleContent className="overflow-hidden data-[state=closed]:animate-accordion-up data-[state=open]:animate-accordion-down">
          <div className="mt-2 rounded-lg border border-[#D8E9DD] bg-white p-3 sm:p-4">
            <PartsListContent />
          </div>
        </CollapsibleContent>
      </Collapsible>
    </div>
  );
};

export default SeeWhatsIncludedCard;
