import React from 'react';
import { Check, ExternalLink, ArrowUp, Settings, Cpu, Zap, Car, Wrench, Shield, Star } from 'lucide-react';
import warrantyPhoneCar from '@/assets/warranty-phone-car.png';

const WarrantyBenefitsSection: React.FC = () => {
  const scrollToTop = () => {
    window.scrollTo({ top: 0, behavior: 'smooth' });
  };

  const coverageCategories = [
    {
      icon: Settings,
      title: "Mechanical",
      items: [
        "Full Mechanical & Electrical Cover",
        "Engine, Gearbox, Clutch, Drivetrain & Turbo",
        "Brakes, Steering, Suspension, Fuel, Cooling & Emissions"
      ]
    },
    {
      icon: Cpu,
      title: "Tech & Safety",
      items: [
        "Modern Tech & Safety – Sensors, Airbags, Multimedia, Cameras",
        "Electrical Systems – ECUs, Wiring, Lighting, Charging"
      ]
    },
    {
      icon: Zap,
      title: "EV & Hybrid",
      items: [
        "Hybrid & EV Components – Motors, Batteries, Inverters, Charging Units"
      ]
    },
    {
      icon: Wrench,
      title: "Extras",
      items: [
        "Labour & Diagnostics Included",
        "Generous Repair Limits",
        "Wear & Tear Protection",
        "Consequential Damage Cover",
        "MOT Fee Cover",
        "Breakdown Recovery",
        "Vehicle Rental"
      ]
    }
  ];

  return (
    <section className="py-12 md:py-20 bg-gray-50">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
        {/* Main Content Grid */}
        <div className="grid lg:grid-cols-4 gap-8 items-start">
          {/* Left Content - 3/4 width */}
          <div className="lg:col-span-3">
            {/* Section Header */}
            <div className="text-center lg:text-left mb-8">
              <h2 className="text-2xl md:text-4xl font-bold text-brand-dark-text mb-3">
                Complete Car Warranty. Zero Worries.
              </h2>
              <p className="text-lg md:text-xl text-green-600 font-semibold mb-2">
                Warranty that works when your car doesn't!
              </p>
              <p className="text-base md:text-lg text-gray-700">
                <span className="text-brand-orange font-semibold">Superior Protection.</span>{' '}
                <span className="text-brand-deep-blue font-semibold">Affordable Prices.</span>{' '}
                <span className="text-green-600 font-semibold">Instant Cover.</span>
              </p>
            </div>

            {/* Trust Signal */}
            <div className="flex items-center gap-2 mb-6 justify-center lg:justify-start">
              <div className="flex items-center gap-1 bg-white px-3 py-1.5 rounded-full shadow-sm border border-gray-200">
                <Star className="w-4 h-4 text-green-500 fill-green-500" />
                <span className="text-sm font-semibold text-gray-800">Rated Excellent</span>
                <span className="text-xs text-gray-500">on Trustpilot</span>
              </div>
            </div>

            {/* Coverage Categories */}
            <div className="grid md:grid-cols-2 gap-4 mb-8">
              {coverageCategories.map((category, idx) => (
                <div key={idx} className="bg-white rounded-xl p-4 shadow-sm border border-gray-100">
                  <div className="flex items-center gap-2 mb-3">
                    <div className="w-8 h-8 rounded-lg bg-brand-orange/10 flex items-center justify-center">
                      <category.icon className="w-4 h-4 text-brand-orange" />
                    </div>
                    <h3 className="font-bold text-brand-dark-text">{category.title}</h3>
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

            {/* And so much more */}
            <p className="text-center lg:text-left text-gray-600 font-medium mb-6">
              And so much more….
            </p>

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
              src={warrantyPhoneCar} 
              alt="Buy a Warranty app on phone with car" 
              className="w-full max-w-[200px] lg:max-w-none lg:w-full h-auto object-contain"
            />
          </div>
        </div>
      </div>
    </section>
  );
};

export default WarrantyBenefitsSection;
