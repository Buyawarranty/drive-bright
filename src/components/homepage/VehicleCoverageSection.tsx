import React from 'react';
import { Shield } from 'lucide-react';
import PartsListContent from '@/components/step3/PartsListContent';

interface VehicleCoverageSectionProps {
  headingPrefix?: string;
}

const VehicleCoverageSection: React.FC<VehicleCoverageSectionProps> = ({ headingPrefix = '' }) => {
  return (
    <section className="pt-2 md:pt-4 pb-6 md:pb-8 bg-white">
      <div className="max-w-5xl mx-auto px-4 sm:px-6 lg:px-8">
        {/* Section Header */}
        <div className="text-center mb-8">
          <div className="inline-flex items-center gap-2 bg-green-50 border border-green-200 rounded-full px-4 py-2 mb-4">
            <Shield className="w-5 h-5 text-green-600" />
            <span className="text-sm font-semibold text-green-700">Full Coverage Details</span>
          </div>
          <h2 className="text-2xl md:text-3xl font-bold text-brand-dark-text mb-3">
            *Every {headingPrefix && `${headingPrefix} `}Part Covered.<br />
            <span className="text-brand-orange">*Drive Worry-Free</span>
          </h2>
          <p className="text-base md:text-lg text-gray-600 max-w-2xl mx-auto">
            *From engine to electrics, see exactly what's protected
          </p>
        </div>

        <PartsListContent />
      </div>
    </section>
  );
};

export default VehicleCoverageSection;
