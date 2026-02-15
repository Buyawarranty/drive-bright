import React from 'react';
import { Wrench } from 'lucide-react';

const repairCosts = [
  { name: 'Engine repair', cost: '£1,500 – £3,000' },
  { name: 'Gearbox repair', cost: '£900 – £2,500' },
  { name: 'Turbo failure', cost: '£700 – £2,000' },
];

interface RepairCostsSectionProps {
  onTalkToTechnician: () => void;
}

const RepairCostsSection: React.FC<RepairCostsSectionProps> = ({ onTalkToTechnician }) => {
  return (
    <section className="py-16 md:py-20 bg-muted">
      <div className="max-w-3xl mx-auto px-4 sm:px-6 lg:px-8">
        <div className="text-center mb-8">
          <h2 className="text-2xl md:text-3xl font-bold text-foreground mb-3">
            Typical repair costs
          </h2>
          <p className="text-muted-foreground">
            A quick look at what drivers are usually protected from.
          </p>
        </div>

        <div className="space-y-3 mb-6">
          {repairCosts.map((item, i) => (
            <div
              key={i}
              className="flex items-center justify-between bg-white border border-border rounded-xl px-5 py-4 shadow-sm"
            >
              <div className="flex items-center gap-3">
                <Wrench className="w-5 h-5 text-destructive" />
                <span className="font-medium text-foreground">{item.name}</span>
              </div>
              <span className="font-bold text-destructive text-sm">{item.cost}</span>
            </div>
          ))}
        </div>

        <div className="bg-green-50 border border-green-200 rounded-xl p-4 text-center mb-4">
          <p className="text-sm font-medium text-green-700">
            Good to know — our £3,000 claim limit covers most repairs shown here.
          </p>
        </div>

        <div className="text-center">
          <button
            onClick={onTalkToTechnician}
            className="text-primary hover:underline text-sm font-medium"
          >
            Talk to an expert about my car →
          </button>
        </div>
      </div>
    </section>
  );
};

export default RepairCostsSection;
