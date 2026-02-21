import React from 'react';
import { Truck, Globe, Key, ArrowRightLeft, SlidersHorizontal, ShieldPlus } from 'lucide-react';

const AdditionalCoverSection: React.FC = () => {
  return (
    <section className="py-12 md:py-20 bg-gray-50">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 text-center">
        <div className="space-y-6 md:space-y-8">
          <h2 className="text-3xl md:text-5xl font-bold text-brand-deep-blue">
            Additional Cover <span className="text-brand-orange">Options</span>
          </h2>
          
          <div className="grid md:grid-cols-2 lg:grid-cols-3 gap-6 md:gap-8 mt-12 max-w-6xl mx-auto">
            <div className="space-y-4 text-left">
              <div className="flex items-center space-x-3">
                <div className="w-12 h-12 bg-brand-orange rounded-full flex items-center justify-center flex-shrink-0">
                  <Truck className="w-6 h-6 text-white" />
                </div>
                <div>
                  <h3 className="text-lg font-bold text-brand-dark-text">24/7 Vehicle Recovery</h3>
                  <p className="text-brand-dark-text">Help whenever you need it.</p>
                </div>
              </div>
            </div>

            <div className="space-y-4 text-left">
              <div className="flex items-center space-x-3">
                <div className="w-12 h-12 bg-brand-orange rounded-full flex items-center justify-center flex-shrink-0">
                  <Globe className="w-6 h-6 text-white" />
                </div>
                <div>
                  <h3 className="text-lg font-bold text-brand-dark-text">Europe Cover</h3>
                  <p className="text-brand-dark-text">Drive with confidence across Europe.</p>
                </div>
              </div>
            </div>

            <div className="space-y-4 text-left">
              <div className="flex items-center space-x-3">
                <div className="w-12 h-12 bg-brand-orange rounded-full flex items-center justify-center flex-shrink-0">
                  <Key className="w-6 h-6 text-white" />
                </div>
                <div>
                  <h3 className="text-lg font-bold text-brand-dark-text">Vehicle Rental</h3>
                  <p className="text-brand-dark-text">Replacement vehicle when yours is off the road.</p>
                </div>
              </div>
            </div>

            <div className="space-y-4 text-left">
              <div className="flex items-center space-x-3">
                <div className="w-12 h-12 bg-brand-orange rounded-full flex items-center justify-center flex-shrink-0">
                  <ArrowRightLeft className="w-6 h-6 text-white" />
                </div>
                <div>
                  <h3 className="text-lg font-bold text-brand-dark-text">Transfer Cover</h3>
                  <p className="text-brand-dark-text">Coverage continues when you change ownership.</p>
                </div>
              </div>
            </div>

            <div className="space-y-4 text-left">
              <div className="flex items-center space-x-3">
                <div className="w-12 h-12 bg-brand-orange rounded-full flex items-center justify-center flex-shrink-0">
                  <SlidersHorizontal className="w-6 h-6 text-white" />
                </div>
                <div>
                  <h3 className="text-lg font-bold text-brand-dark-text">Bespoke Warranty</h3>
                  <p className="text-brand-dark-text">Tailored cover for your specific needs.</p>
                </div>
              </div>
            </div>

            <div className="space-y-4 text-left">
              <div className="flex items-center space-x-3">
                <div className="w-12 h-12 bg-brand-orange rounded-full flex items-center justify-center flex-shrink-0">
                  <ShieldPlus className="w-6 h-6 text-white" />
                </div>
                <div>
                  <h3 className="text-lg font-bold text-brand-dark-text">Tyre Cover</h3>
                  <p className="text-brand-dark-text">Protection against unexpected tyre damage.</p>
                </div>
              </div>
            </div>
          </div>
        </div>
      </div>
    </section>
  );
};

export default AdditionalCoverSection;
