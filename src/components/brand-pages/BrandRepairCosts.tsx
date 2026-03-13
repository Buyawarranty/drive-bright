import React from 'react';
import { Button } from '@/components/ui/button';
import { Wrench, Zap, Car, Shield, ArrowRight } from 'lucide-react';

type RepairItem = {
  name: string;
  cost: string;
  icon: 'Wrench' | 'Zap' | 'Car' | 'Shield';
  severity: 'medium' | 'high' | 'critical';
};

interface BrandRepairCostsProps {
  brandName: string;
  monthlyPrice: string;
  typicalRepairCost?: string;
  repairs: RepairItem[];
  onGetQuote: () => void;
}

const iconMap = { Wrench, Zap, Car, Shield };

const severityColors = {
  medium: { bg: 'bg-white', border: 'border-gray-200', text: 'text-gray-900' },
  high: { bg: 'bg-orange-50', border: 'border-orange-200', text: 'text-brand-orange' },
  critical: { bg: 'bg-red-50', border: 'border-red-200', text: 'text-red-600' },
};

const BrandRepairCosts: React.FC<BrandRepairCostsProps> = ({ brandName, monthlyPrice, typicalRepairCost = '£2,200', repairs, onGetQuote }) => {
  return (
    <section className="py-10 md:py-16 bg-white">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
        <div className="text-center mb-8 md:mb-12">
          <div className="inline-flex items-center gap-2 bg-red-50 px-3 md:px-4 py-1.5 md:py-2 rounded-full mb-3 md:mb-4">
            <Wrench className="w-4 h-4 md:w-5 md:h-5 text-red-600" />
            <span className="text-xs md:text-sm font-semibold text-red-700">Without warranty, you pay the full bill</span>
          </div>
          <h2 className="text-2xl sm:text-3xl md:text-4xl font-bold text-gray-900 mb-3 md:mb-4">
            What {brandName} repairs actually cost
          </h2>
          <p className="text-base md:text-lg text-gray-600 max-w-2xl mx-auto">
            One breakdown could cost more than years of warranty cover. Here's what {brandName} owners pay without protection.
          </p>
        </div>

        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4 md:gap-6">
          {repairs.map((repair, index) => {
            const Icon = iconMap[repair.icon];
            const colors = severityColors[repair.severity];
            return (
              <div key={index} className={`${colors.bg} rounded-xl p-4 md:p-5 border ${colors.border} flex items-start gap-3`}>
                <div className={`w-10 h-10 rounded-lg ${colors.bg} flex items-center justify-center flex-shrink-0`}>
                  <Icon className={`w-5 h-5 ${colors.text}`} />
                </div>
                <div>
                  <h3 className="font-bold text-gray-900 text-sm md:text-base">{repair.name}</h3>
                  <p className={`font-bold text-base md:text-lg ${colors.text}`}>{repair.cost}</p>
                </div>
              </div>
            );
          })}
        </div>

        <div className="mt-8 md:mt-12 text-center">
          <div className="bg-brand-deep-blue rounded-2xl p-5 sm:p-8 md:p-12 max-w-3xl mx-auto">
            <div className="flex flex-col sm:flex-row items-center justify-center gap-3 sm:gap-4 md:gap-8 mb-4">
              <div className="text-center">
                <p className="text-xs md:text-sm font-semibold text-white/60 uppercase tracking-wider mb-1">Typical repair</p>
                <p className="text-2xl md:text-4xl font-bold text-red-400 line-through decoration-2">{typicalRepairCost}</p>
              </div>
              <span className="text-lg md:text-xl font-bold text-white/50">vs</span>
              <div className="text-center">
                <p className="text-xs md:text-sm font-semibold text-white/60 uppercase tracking-wider mb-1">Platinum plan</p>
                <p className="text-2xl md:text-4xl font-bold text-emerald-400">from {monthlyPrice}/mo</p>
              </div>
            </div>
            <p className="text-white/70 mb-6 text-sm md:text-base">
              That's less than a single diagnostic fee — and it covers all of the above.
            </p>
            <Button
              onClick={onGetQuote}
              className="bg-brand-orange hover:bg-brand-orange/90 text-white font-bold py-4 md:py-5 px-6 md:px-8 text-base md:text-lg rounded-xl shadow-lg animate-breathing"
            >
              <span className="flex items-center gap-2">
                Get my instant quote
                <ArrowRight className="w-5 h-5" />
              </span>
            </Button>
          </div>
        </div>
      </div>
    </section>
  );
};

export default BrandRepairCosts;
