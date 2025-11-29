import React from 'react';
import { Check, ExternalLink } from 'lucide-react';

const WarrantyBenefitsSection: React.FC = () => {
  return (
    <section className="py-12 md:py-20 bg-white">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
        {/* Section Header */}
        <div className="text-center mb-12 md:mb-16">
          <h2 className="text-2xl md:text-4xl font-bold text-brand-dark-text mb-4">
            Why Choose <span className="text-brand-orange">Our Warranty Plans?</span>
          </h2>
          <p className="text-base md:text-lg text-gray-700 max-w-3xl mx-auto">
            Get complete peace of mind with industry-leading protection for your vehicle. Every plan includes:
          </p>
        </div>

        {/* What's Included in Your Cover */}
        <div className="mb-8">
          <h3 className="text-xl md:text-2xl font-bold text-brand-dark-text mb-6 text-center">
            What's Included in Your Cover
          </h3>
          
          <div className="grid md:grid-cols-2 gap-3 md:gap-4 max-w-4xl mx-auto">
            <div className="flex items-center gap-3">
              <Check className="w-5 h-5 text-green-500 flex-shrink-0" />
              <p className="text-sm md:text-base text-brand-dark-text">Full Mechanical & Electrical Cover</p>
            </div>
            
            <div className="flex items-center gap-3">
              <Check className="w-5 h-5 text-green-500 flex-shrink-0" />
              <p className="text-sm md:text-base text-brand-dark-text">Labour & Diagnostics Included</p>
            </div>
            
            <div className="flex items-center gap-3">
              <Check className="w-5 h-5 text-green-500 flex-shrink-0" />
              <p className="text-sm md:text-base text-brand-dark-text">Generous Repair Limits</p>
            </div>
            
            <div className="flex items-center gap-3">
              <Check className="w-5 h-5 text-green-500 flex-shrink-0" />
              <p className="text-sm md:text-base text-brand-dark-text">Wear & Tear Protection</p>
            </div>
            
            <div className="flex items-center gap-3">
              <Check className="w-5 h-5 text-green-500 flex-shrink-0" />
              <p className="text-sm md:text-base text-brand-dark-text">Consequential Damage Cover</p>
            </div>
            
            <div className="flex items-center gap-3">
              <Check className="w-5 h-5 text-green-500 flex-shrink-0" />
              <p className="text-sm md:text-base text-brand-dark-text">MOT Fee Cover</p>
            </div>
            
            <div className="flex items-center gap-3">
              <Check className="w-5 h-5 text-green-500 flex-shrink-0" />
              <p className="text-sm md:text-base text-brand-dark-text">Breakdown Recovery</p>
            </div>
            
            <div className="flex items-center gap-3">
              <Check className="w-5 h-5 text-green-500 flex-shrink-0" />
              <p className="text-sm md:text-base text-brand-dark-text">Vehicle Rental</p>
            </div>
          </div>
        </div>

        {/* Your warranty covers everything that matters */}
        <div className="mb-8">
          <p className="text-base md:text-lg text-gray-700 mb-6 font-medium text-center">
            Your warranty covers everything that matters:
          </p>
          
          <div className="grid md:grid-cols-2 gap-3 md:gap-4 max-w-4xl mx-auto">
            <div className="flex items-center gap-3">
              <Check className="w-5 h-5 text-green-500 flex-shrink-0" />
              <p className="text-sm md:text-base text-brand-dark-text">Engine, Gearbox, Clutch, Drivetrain & Turbo</p>
            </div>
            
            <div className="flex items-center gap-3">
              <Check className="w-5 h-5 text-green-500 flex-shrink-0" />
              <p className="text-sm md:text-base text-brand-dark-text">Brakes, Steering, Suspension, Fuel, Cooling & Emissions</p>
            </div>
            
            <div className="flex items-center gap-3">
              <Check className="w-5 h-5 text-green-500 flex-shrink-0" />
              <p className="text-sm md:text-base text-brand-dark-text">Modern Tech & Safety – Sensors, Airbags, Multimedia, Cameras</p>
            </div>
            
            <div className="flex items-center gap-3">
              <Check className="w-5 h-5 text-green-500 flex-shrink-0" />
              <p className="text-sm md:text-base text-brand-dark-text">Electrical Systems – ECUs, Wiring, Lighting, Charging</p>
            </div>
            
            <div className="flex items-center gap-3">
              <Check className="w-5 h-5 text-green-500 flex-shrink-0" />
              <p className="text-sm md:text-base text-brand-dark-text">Hybrid & EV Components – Motors, Batteries, Inverters, Charging Units</p>
            </div>
            
            <div className="flex items-center gap-3 md:col-span-2">
              <Check className="w-5 h-5 text-green-500 flex-shrink-0" />
              <p className="text-sm md:text-base text-brand-dark-text font-semibold">And so much more….</p>
            </div>
          </div>
        </div>

        {/* CTA Button */}
        <div className="mt-10 text-center">
          <a
            href="https://buyawarranty.co.uk/what-is-covered/"
            target="_blank"
            rel="noopener noreferrer"
            className="inline-flex items-center gap-2 bg-brand-deep-blue hover:bg-blue-800 text-white font-bold px-8 py-4 text-base md:text-lg rounded-lg shadow-lg transition-colors"
          >
            <Check className="w-5 h-5" />
            View Complete Coverage
            <ExternalLink className="w-5 h-5" />
          </a>
        </div>
      </div>
    </section>
  );
};

export default WarrantyBenefitsSection;
