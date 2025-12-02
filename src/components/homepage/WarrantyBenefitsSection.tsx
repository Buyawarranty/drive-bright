import React from 'react';
import { Check, ExternalLink, ArrowUp, Settings, Cpu, Zap, Car, Wrench, Shield, Lock } from 'lucide-react';
import warrantyPandaMascot from '@/assets/warranty-panda-mascot.png';
import TrustpilotHeader from '@/components/TrustpilotHeader';

const WarrantyBenefitsSection: React.FC = () => {
  const scrollToTop = () => {
    window.scrollTo({ top: 0, behavior: 'smooth' });
  };

  const leftColumnCategories = [
    {
      icon: Settings,
      title: "Mechanical",
      items: ["Full Mechanical & Electrical Cover", "Engine, Gearbox, Clutch, Drivetrain & Turbo", "Brakes, Steering, Suspension, Fuel, Cooling & Emissions"]
    },
    {
      icon: Cpu,
      title: "Tech & Safety",
      items: ["Modern Tech & Safety – Sensors, Airbags, Multimedia, Cameras", "Electrical Systems – ECUs, Wiring, Lighting, Charging"]
    },
    {
      icon: Zap,
      title: "EV & Hybrid",
      items: ["Hybrid & EV Components – Motors, Batteries, Inverters, Charging Units"]
    }
  ];

  const extrasItems = [
    "Labour & Diagnostics Included",
    "Generous Repair Limits",
    "Wear & Tear Protection",
    "Consequential Damage Cover",
    "MOT Fee Cover",
    "Breakdown Recovery",
    "Vehicle Rental"
  ];

  return (
    <section className="py-12 md:py-20 bg-gray-50">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
        {/* Main Content Grid */}
        <div className="grid lg:grid-cols-4 gap-8 items-start">
          {/* Left Content - 3/4 width */}
          <div className="lg:col-span-3">
            {/* Section Header */}
            <div className="text-center lg:text-left mb-6">
              <h2 className="text-2xl md:text-4xl font-bold text-brand-dark-text mb-3 flex items-center justify-center lg:justify-start gap-2">
                Complete Car Warranty. Zero Worries. <span className="text-2xl md:text-3xl">🐼</span>
              </h2>
              <p className="text-lg md:text-xl font-bold mb-2">
                <span className="text-green-600">Warranty that works when your car doesn't!</span>
              </p>
              <p className="text-base md:text-lg">
                <span className="text-brand-orange font-bold">Superior Protection.</span>{' '}
                <span className="text-brand-deep-blue font-bold">Affordable Prices.</span>{' '}
                <span className="text-green-600 font-bold">Instant Cover.</span>
              </p>
            </div>

            {/* Trust & Reassurance */}
            <div className="flex flex-col sm:flex-row items-center gap-3 mb-6 justify-center lg:justify-start">
              <TrustpilotHeader className="flex-shrink-0" />
              <div className="flex items-center gap-2 text-sm text-gray-600">
                <Lock className="w-4 h-4 text-green-600" />
                <span>Your details are encrypted and safe.</span>
              </div>
            </div>

            {/* Two Column Coverage Layout */}
            <div className="grid md:grid-cols-2 gap-6 mb-6">
              {/* Left Column - Mechanical, Tech & Safety, EV & Hybrid */}
              <div className="space-y-4">
                {leftColumnCategories.map((category, idx) => (
                  <div key={idx} className="bg-white rounded-xl p-4 shadow-sm border border-gray-100 hover:shadow-md transition-shadow">
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

              {/* Right Column - Extras */}
              <div className="bg-white rounded-xl p-4 shadow-sm border border-gray-100 hover:shadow-md transition-shadow h-fit">
                <div className="flex items-center gap-2 mb-3">
                  <div className="w-9 h-9 rounded-lg bg-brand-orange/10 flex items-center justify-center">
                    <Wrench className="w-5 h-5 text-brand-orange" />
                  </div>
                  <h3 className="font-bold text-brand-dark-text text-lg">Extras</h3>
                </div>
                <div className="space-y-2">
                  {extrasItems.map((item, idx) => (
                    <div key={idx} className="flex items-start gap-2">
                      <Check className="w-4 h-4 text-green-500 flex-shrink-0 mt-0.5" />
                      <p className="text-sm text-gray-700">{item}</p>
                    </div>
                  ))}
                </div>
                <p className="text-gray-600 font-medium mt-4 flex items-center gap-2">
                  And so much more…. <span className="text-lg">🐼</span>
                </p>
              </div>
            </div>

            {/* CTA Buttons */}
            <div className="flex flex-col sm:flex-row gap-4 justify-center lg:justify-start">
              <a
                href="https://buyawarranty.co.uk/what-is-covered/"
                target="_blank"
                rel="noopener noreferrer"
                className="inline-flex items-center justify-center gap-2 bg-brand-orange hover:bg-orange-600 text-white font-bold px-6 py-3 text-base rounded-lg shadow-lg transition-all animate-[breathing_3s_ease-in-out_infinite]"
              >
                <Shield className="w-5 h-5" />
                See what's covered
                <ExternalLink className="w-4 h-4" />
              </a>
              
              <button
                onClick={scrollToTop}
                className="inline-flex items-center justify-center gap-2 bg-brand-orange hover:bg-orange-600 text-white font-bold px-6 py-3 text-base rounded-lg shadow-lg transition-all animate-[breathing_3s_ease-in-out_infinite]"
              >
                <Car className="w-5 h-5" />
                Get my instant quote
                <ArrowUp className="w-4 h-4" />
              </button>
            </div>
          </div>

          {/* Right Image - 1/4 width */}
          <div className="lg:col-span-1 flex justify-center lg:justify-end">
            <img 
              src={warrantyPandaMascot} 
              alt="Miles the Panda mascot with car" 
              className="w-full max-w-[280px] lg:max-w-none lg:w-full h-auto object-contain"
            />
          </div>
        </div>
      </div>
    </section>
  );
};

export default WarrantyBenefitsSection;
