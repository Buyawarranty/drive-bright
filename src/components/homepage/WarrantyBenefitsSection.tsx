import React from 'react';
import { Check, ArrowRight, Settings, Cpu, Zap, Wrench, Lock } from 'lucide-react';
import TrustpilotSliderWidget from '@/components/TrustpilotSliderWidget';
import warrantyPandaMascot from '@/assets/warranty-panda-mascot.png';
import TrustpilotHeader from '@/components/TrustpilotHeader';
import TrustpilotMicroStarWidget from '@/components/TrustpilotMicroStarWidget';

interface WarrantyBenefitsSectionProps {
  headline?: string;
}

const WarrantyBenefitsSection: React.FC<WarrantyBenefitsSectionProps> = ({ 
  headline = "Complete Car Warranty." 
}) => {
  const scrollToTop = () => {
    window.scrollTo({ top: 0, behavior: 'smooth' });
  };

  const leftColumnCategories = [
    {
      icon: Settings,
      title: "Mechanical & Electrical",
      headerText: "Everything You Need, Covered:",
      items: ["Full Mechanical & Electrical Cover", "Engine, Gearbox, Clutch, Drivetrain & Turbo", "Brakes, Steering, Suspension, Fuel, Cooling, Emissions & Air-conditioning"],
      showMore: false
    },
    {
      icon: Wrench,
      title: "Plan Benefits",
      headerText: null,
      items: ["Labour & Diagnostics Included", "Generous Repair Limits", "Wear & Tear Protection", "Consequential Damage Cover", "Breakdown Recovery", "Vehicle Rental"],
      showMore: false
    }
  ];

  const rightColumnCategories = [
    {
      icon: Cpu,
      title: "Tech & Safety",
      items: ["Modern Tech & Safety – Sensors, Airbags, Multimedia, Cameras", "Electrical Systems – ECUs, Wiring, Lighting, Charging"],
      showMore: false
    },
    {
      icon: Zap,
      title: "EV & Hybrid",
      items: ["Hybrid & EV Components – Motors, Batteries, Inverters, Charging Units"],
      showMore: true
    }
  ];

  return (
    <section className="py-12 md:py-20 bg-gray-50">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
        {/* Trustpilot Slider Widget */}
        <TrustpilotSliderWidget className="mb-8" />
        
        {/* Main Content */}
        <div>
          <div>
            {/* Section Header */}
            <div className="mb-6">
              <div className="text-center lg:text-left">
                
                <p className="text-base md:text-lg text-gray-500">
                  Superior Protection. Affordable Prices. Instant Cover.
                </p>
              </div>
            </div>

            {/* Two Column Coverage Layout */}
            <div className="grid md:grid-cols-2 gap-6 mb-6">
              {/* Left Column - Mechanical & Electrical, Features */}
              <div className="space-y-4">
                {leftColumnCategories.map((category, idx) => (
                  <div key={idx} className="bg-gray-50 rounded-xl p-4 shadow-sm border border-gray-200 hover:shadow-md transition-shadow">
                    {category.headerText && (
                      <p className="text-center lg:text-left font-bold text-brand-dark-text mb-3">{category.headerText}</p>
                    )}
                    <div className="flex items-center gap-2 mb-3">
                      <div className="w-9 h-9 rounded-lg bg-brand-orange/10 flex items-center justify-center">
                        <category.icon className="w-5 h-5 text-brand-orange" />
                      </div>
                      <h3 className="font-bold text-brand-dark-text text-lg">{category.title}</h3>
                    </div>
                    <div className="space-y-2">
                      {category.items.map((item, itemIdx) => (
                        <div key={itemIdx} className="flex items-start gap-2">
                          <Check className="w-4 h-4 text-green-500 flex-shrink-0 mt-0.5" />
                          <p className="text-sm text-gray-700">{item}</p>
                        </div>
                      ))}
                    </div>
                  </div>
                ))}
              </div>

              {/* Right Column - Tech & Safety, EV & Hybrid */}
              <div className="space-y-4">
                {rightColumnCategories.map((category, idx) => (
                  <div key={idx} className="bg-gray-50 rounded-xl p-4 shadow-sm border border-gray-200 hover:shadow-md transition-shadow">
                    <div className="flex items-center gap-2 mb-3">
                      <div className="w-9 h-9 rounded-lg bg-brand-orange/10 flex items-center justify-center">
                        <category.icon className="w-5 h-5 text-brand-orange" />
                      </div>
                      <h3 className="font-bold text-brand-dark-text text-lg">{category.title}</h3>
                    </div>
                    <div className="space-y-2">
                      {category.items.map((item, itemIdx) => (
                        <div key={itemIdx} className="flex items-start gap-2">
                          <Check className="w-4 h-4 text-green-500 flex-shrink-0 mt-0.5" />
                          <p className="text-sm text-gray-700">{item}</p>
                        </div>
                      ))}
                    </div>
                  </div>
                ))}
                
                {/* Desktop CTAs - below EV & Hybrid box */}
                <div className="hidden lg:flex flex-row justify-between items-end mt-4">
                  {/* Panda - left side */}
                  <div className="flex justify-start">
                    <img 
                      src={warrantyPandaMascot} 
                      alt="Miles the Panda mascot with car" 
                      className="w-48 md:w-56 lg:w-64 h-auto object-contain"
                    />
                  </div>
                  
                  {/* CTA + Trustpilot - right side */}
                  <div className="flex flex-col items-end gap-4">
                    <button
                      onClick={scrollToTop}
                      className="flex items-center gap-3 bg-brand-orange hover:bg-orange-600 text-white font-bold px-6 py-4 text-lg rounded-lg shadow-lg transition-colors animate-cta-enhanced"
                    >
                      Get my quote
                      <ArrowRight className="w-6 h-6" />
                    </button>
                    
                    <TrustpilotMicroStarWidget className="max-w-[200px]" />
                  </div>
                </div>
              </div>
            </div>

            {/* Panda and CTA Section - Mobile only */}
            <div className="lg:hidden flex flex-col items-center gap-6">
              {/* Panda */}
              <div className="flex justify-center">
                <img 
                  src={warrantyPandaMascot} 
                  alt="Miles the Panda mascot with car" 
                  className="w-48 md:w-56 h-auto object-contain"
                />
              </div>
              
              {/* CTA Button + Trust - Below Panda */}
              <div className="flex flex-col items-center gap-4">
                <button
                  onClick={scrollToTop}
                  className="inline-flex items-center justify-center gap-3 bg-brand-orange hover:bg-orange-600 text-white font-bold px-8 py-4 text-lg rounded-lg shadow-lg transition-all animate-cta-enhanced"
                >
                  Get my quote
                  <ArrowRight className="w-7 h-7" />
                </button>
                
                <TrustpilotMicroStarWidget className="max-w-[200px]" />
              </div>
            </div>
          </div>
        </div>
      </div>
    </section>
  );
};

export default WarrantyBenefitsSection;
