import React from 'react';
import { CheckCircle } from 'lucide-react';
import pandaSavingsVehicles from '@/assets/panda-savings-vehicles.png';

const points = [
  'Clear claim limits to match your needs',
  'Approved claims paid directly to the garage',
  'UK-based support when you need it',
];

interface PandaReassuranceProps {
  onSeeHowCoverWorks: () => void;
}

const PandaReassurance: React.FC<PandaReassuranceProps> = ({ onSeeHowCoverWorks }) => {
  return (
    <section className="py-16 md:py-20 bg-white">
      <div className="max-w-5xl mx-auto px-4 sm:px-6 lg:px-8">
        <div className="grid md:grid-cols-2 gap-10 items-center">
          <div>
            <h2 className="text-2xl md:text-3xl font-bold text-foreground mb-6">
              Why choose Buyawarranty
            </h2>
            <div className="space-y-4 mb-8">
              {points.map((point, i) => (
                <div key={i} className="flex items-start gap-3">
                  <CheckCircle className="w-5 h-5 text-green-500 mt-0.5 flex-shrink-0" />
                  <span className="text-base text-foreground">{point}</span>
                </div>
              ))}
            </div>
            <button
              onClick={onSeeHowCoverWorks}
              className="text-primary font-semibold hover:underline text-sm"
            >
              I want to avoid costly repairs →
            </button>
          </div>
          <div className="flex justify-center">
            <img
              src={pandaSavingsVehicles}
              alt="Miles the panda mascot with vehicles and savings jar"
              className="w-56 md:w-72 h-auto object-contain"
              loading="lazy"
            />
          </div>
        </div>
      </div>
    </section>
  );
};

export default PandaReassurance;
