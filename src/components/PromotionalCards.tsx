import React from 'react';
import { ArrowRight } from 'lucide-react';

const PromotionalCards = () => {
  return (
    <section className="py-12 md:py-20 bg-gray-50">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
        <div className="grid md:grid-cols-2 gap-6 max-w-4xl mx-auto">
          {/* Car Finance Card */}
          <div className="promotional-card group relative overflow-hidden rounded-2xl bg-white shadow-lg hover:shadow-2xl transform hover:scale-105 transition-all duration-300 ease-out cursor-pointer">
            <div className="aspect-[4/3] bg-gradient-to-br from-green-400 to-cyan-400 relative overflow-hidden">
              {/* Decorative stars */}
              <div className="absolute inset-0 opacity-80">
                <div className="absolute top-4 left-6 text-white text-2xl">✨</div>
                <div className="absolute top-8 right-8 text-white text-xl">✨</div>
                <div className="absolute bottom-12 left-4 text-white text-lg">✨</div>
                <div className="absolute bottom-6 right-12 text-white text-xl">✨</div>
                <div className="absolute top-1/2 left-1/2 transform -translate-x-1/2 -translate-y-1/2 text-white text-3xl">✨</div>
              </div>
              
              {/* Woman with car image */}
              <div className="absolute bottom-0 left-1/2 transform -translate-x-1/2 w-full h-4/5">
                <div className="relative w-full h-full flex items-end justify-center">
                  {/* Woman figure */}
                  <div className="w-20 h-32 bg-white/20 rounded-t-3xl relative mr-4 group-hover:scale-110 transition-transform duration-300">
                    <div className="absolute top-2 left-1/2 transform -translate-x-1/2 w-6 h-6 bg-yellow-200 rounded-full"></div>
                    <div className="absolute top-8 w-full h-8 bg-white/30 rounded-t-lg"></div>
                    <div className="absolute top-16 w-full h-16 bg-blue-200 rounded-t-lg"></div>
                    {/* Arms raised */}
                    <div className="absolute top-10 -left-2 w-8 h-3 bg-yellow-200 rounded-full rotate-45"></div>
                    <div className="absolute top-10 -right-2 w-8 h-3 bg-yellow-200 rounded-full -rotate-45"></div>
                  </div>
                  
                  {/* Car */}
                  <div className="w-32 h-16 bg-white rounded-lg relative group-hover:scale-110 transition-transform duration-300">
                    <div className="absolute top-1 left-1 right-1 bottom-1 bg-gray-100 rounded-lg"></div>
                    <div className="absolute top-2 left-4 w-6 h-6 bg-black rounded-full"></div>
                    <div className="absolute top-2 right-4 w-6 h-6 bg-black rounded-full"></div>
                    <div className="absolute top-6 left-2 right-2 h-4 bg-blue-300 rounded"></div>
                  </div>
                </div>
              </div>
            </div>
            
            <div className="p-6 bg-gradient-to-r from-pink-500 to-red-500 text-white group-hover:from-pink-600 group-hover:to-red-600 transition-all duration-300">
              <h3 className="text-xl font-bold flex items-center justify-center gap-2 group-hover:gap-3 transition-all duration-300">
                Compare Cheap Car Finance
                <ArrowRight className="w-5 h-5 group-hover:translate-x-1 transition-transform duration-300" />
              </h3>
            </div>
          </div>

          {/* Online Surveys Card */}
          <div className="promotional-card group relative overflow-hidden rounded-2xl bg-white shadow-lg hover:shadow-2xl transform hover:scale-105 transition-all duration-300 ease-out cursor-pointer">
            <div className="aspect-[4/3] bg-gradient-to-br from-cyan-400 to-blue-400 relative overflow-hidden">
              {/* Decorative stars */}
              <div className="absolute inset-0 opacity-80">
                <div className="absolute top-4 left-6 text-white text-2xl">✨</div>
                <div className="absolute top-8 right-8 text-white text-xl">✨</div>
                <div className="absolute bottom-12 left-4 text-white text-lg">✨</div>
                <div className="absolute bottom-6 right-12 text-white text-xl">✨</div>
                <div className="absolute top-1/2 left-1/2 transform -translate-x-1/2 -translate-y-1/2 text-white text-3xl">✨</div>
              </div>
              
              {/* Man with money and gifts */}
              <div className="absolute bottom-0 left-1/2 transform -translate-x-1/2 w-full h-4/5">
                <div className="relative w-full h-full flex items-end justify-center">
                  {/* Money notes floating */}
                  <div className="absolute top-4 left-8 w-8 h-5 bg-green-200 rounded transform rotate-12 group-hover:rotate-24 transition-transform duration-300"></div>
                  <div className="absolute top-8 right-6 w-8 h-5 bg-green-200 rounded transform -rotate-12 group-hover:-rotate-24 transition-transform duration-300"></div>
                  <div className="absolute top-12 left-1/2 w-8 h-5 bg-green-200 rounded transform rotate-6 group-hover:rotate-12 transition-transform duration-300"></div>
                  
                  {/* Gift boxes */}
                  <div className="absolute top-6 left-12 w-6 h-6 bg-red-400 rounded transform rotate-12 group-hover:rotate-24 transition-transform duration-300">
                    <div className="absolute top-1/2 left-0 right-0 h-1 bg-yellow-300"></div>
                    <div className="absolute top-0 bottom-0 left-1/2 w-1 bg-yellow-300"></div>
                  </div>
                  <div className="absolute top-8 right-10 w-6 h-6 bg-blue-400 rounded transform -rotate-12 group-hover:-rotate-24 transition-transform duration-300">
                    <div className="absolute top-1/2 left-0 right-0 h-1 bg-yellow-300"></div>
                    <div className="absolute top-0 bottom-0 left-1/2 w-1 bg-yellow-300"></div>
                  </div>
                  
                  {/* Man figure */}
                  <div className="w-20 h-32 bg-white/20 rounded-t-3xl relative group-hover:scale-110 transition-transform duration-300">
                    <div className="absolute top-2 left-1/2 transform -translate-x-1/2 w-6 h-6 bg-yellow-200 rounded-full"></div>
                    <div className="absolute top-8 w-full h-8 bg-white/30 rounded-t-lg"></div>
                    <div className="absolute top-16 w-full h-16 bg-gray-300 rounded-t-lg"></div>
                    {/* Glasses */}
                    <div className="absolute top-4 left-1/2 transform -translate-x-1/2 w-4 h-2 border border-black rounded-full"></div>
                    {/* Phone in hand */}
                    <div className="absolute top-20 left-1/2 transform -translate-x-1/2 w-3 h-5 bg-black rounded"></div>
                  </div>
                </div>
              </div>
            </div>
            
            <div className="p-6 bg-gradient-to-r from-pink-500 to-red-500 text-white group-hover:from-pink-600 group-hover:to-red-600 transition-all duration-300">
              <h3 className="text-xl font-bold flex items-center justify-center gap-2 group-hover:gap-3 transition-all duration-300">
                Earn Extra Cash With Online Surveys
                <ArrowRight className="w-5 h-5 group-hover:translate-x-1 transition-transform duration-300" />
              </h3>
            </div>
          </div>
        </div>
      </div>
    </section>
  );
};

export default PromotionalCards;