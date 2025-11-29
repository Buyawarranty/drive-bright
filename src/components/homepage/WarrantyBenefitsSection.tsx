import React from 'react';
import { Check, ExternalLink, ArrowUp } from 'lucide-react';

const WarrantyBenefitsSection: React.FC = () => {
  const scrollToTop = () => {
    window.scrollTo({ top: 0, behavior: 'smooth' });
  };

  return (
    <section className="py-12 md:py-20 bg-gray-50">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
        {/* Section Header */}
        <div className="text-center mb-8">
          <h2 className="text-2xl md:text-4xl font-bold text-brand-dark-text mb-4">
            The UK's Complete <span className="text-brand-orange">Car Warranty</span>
          </h2>
          <p className="text-base md:text-lg text-gray-700 max-w-3xl mx-auto">
            <span className="text-brand-deep-blue font-semibold">Drive Worry-Free:</span> <span className="text-green-600 font-bold">Superior Protection. Affordable Prices. Instant Cover</span>
          </p>
        </div>

        {/* Combined Coverage List */}
        <div className="mb-8">
          <p className="text-base md:text-lg text-gray-700 mb-6 font-medium text-center">
            ✅ Your warranty covers everything that matters:
          </p>
          
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
            
            <div className="flex items-center gap-3">
              <Check className="w-5 h-5 text-green-500 flex-shrink-0" />
              <p className="text-sm md:text-base text-brand-dark-text">And so much more….</p>
            </div>
          </div>
        </div>

        {/* CTA Buttons */}
        <div className="mt-10 flex flex-col sm:flex-row gap-6 justify-center items-center">
          <a
            href="https://buyawarranty.co.uk/what-is-covered/"
            target="_blank"
            rel="noopener noreferrer"
            className="inline-flex items-center gap-2 bg-transparent border-2 border-brand-orange text-brand-orange hover:bg-brand-orange hover:text-white font-bold px-8 py-4 text-base md:text-lg rounded-lg shadow-lg transition-all animate-[breathing_3s_ease-in-out_infinite]"
          >
            What's covered
            <ExternalLink className="w-5 h-5" />
          </a>
          
          <button
            onClick={scrollToTop}
            className="inline-flex items-center gap-2 bg-brand-orange hover:bg-orange-600 text-white font-bold px-8 py-4 text-base md:text-lg rounded-lg shadow-lg transition-all animate-[breathing_3s_ease-in-out_infinite]"
          >
            <ArrowUp className="w-5 h-5" />
            Get my quote
          </button>
        </div>
      </div>
    </section>
  );
};

export default WarrantyBenefitsSection;
