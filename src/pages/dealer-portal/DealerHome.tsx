import React from 'react';
import { Link } from 'react-router-dom';
import { Button } from '@/components/ui/button';
import { Card, CardContent } from '@/components/ui/card';
import { SEOHead } from '@/components/SEOHead';
import { OptimizedImage } from '@/components/OptimizedImage';
import { DealerPublicHeader } from '@/components/dealer/DealerPublicHeader';
import { DealerRegHero } from '@/components/dealer/DealerRegHero';
import { Check, Zap, TrendingUp, LayoutDashboard, UserPlus, FileText, Shield, Car, Truck, Battery, Bike } from 'lucide-react';

const DealerHome = () => {
  return (
    <div className="min-h-screen bg-gray-950 overflow-x-hidden">
      <SEOHead
        title="Dealer Warranty Solutions | BuyAWarranty"
        description="Create quotes and manage warranties in seconds. Partner with BuyAWarranty for fast dealer warranty solutions."
        keywords="dealer warranty, warranty quotes, dealer portal"
      />

      <DealerPublicHeader />

      {/* Hero Section */}
      <section className="bg-gray-950 pt-3 sm:pt-8 lg:pt-16 pb-6 sm:pb-8 lg:pb-12 px-3 sm:px-0">
        <div className="max-w-7xl mx-auto px-2 sm:px-4 md:px-6 lg:px-8">
          <div className="grid lg:grid-cols-2 gap-4 sm:gap-6 lg:gap-8 items-center">
            {/* Left Content */}
            <div className="space-y-3 sm:space-y-4 px-0 flex flex-col justify-center">

              <div className="space-y-2 mb-2 sm:mb-4">
                <span className="inline-block text-xs font-semibold text-orange-500 bg-orange-500/10 px-3 py-1 rounded-full mb-2">DEALER PORTAL</span>
                <h1 className="text-2xl sm:text-4xl lg:text-5xl font-black leading-tight">
                  <span className="text-white">Dealer warranties </span>
                  <span className="text-orange-500">made simple!</span>
                </h1>
              </div>

              {/* Benefits */}
              <div className="mb-3 sm:mb-6 text-gray-300 text-xs sm:text-sm md:text-base space-y-1 sm:space-y-2">
                <div className="flex items-center">
                  <Check className="w-4 h-4 sm:w-5 sm:h-5 text-green-400 mr-2 sm:mr-3 flex-shrink-0" />
                  <span className="font-medium">Create quotes in 60 seconds • Increase your revenue</span>
                </div>
                <div className="flex items-center">
                  <Check className="w-4 h-4 sm:w-5 sm:h-5 text-green-400 mr-2 sm:mr-3 flex-shrink-0" />
                  <span className="font-medium">Simple dashboard • Track conversions • Manage warranties</span>
                </div>
                <div className="flex items-center">
                  <Check className="w-4 h-4 sm:w-5 sm:h-5 text-green-400 mr-2 sm:mr-3 flex-shrink-0" />
                  <span className="font-medium">Cars • Vans • Hybrid • EV • Motorbikes</span>
                </div>
              </div>

              {/* Reg plate hero CTA */}
              <div className="space-y-3 w-full max-w-md mx-auto lg:mx-0">
                <DealerRegHero />

                {/* Trust block */}
                <div className="mt-3 sm:mt-5 bg-gray-900 border border-gray-800 rounded-xl shadow-sm px-5 py-4 text-center">
                  <h2 className="text-sm sm:text-[17px] font-bold text-white">
                    Trusted by UK dealers. Fast setup. No surprises.
                  </h2>
                  <div className="flex flex-wrap items-center justify-center gap-x-1.5 gap-y-1 text-xs sm:text-[15px] mt-1.5">
                    <span className="text-gray-400">Speak to the team:</span>
                    <a
                      href="tel:03302295040"
                      className="font-semibold text-orange-400 hover:underline"
                    >
                      0330 229 5040
                    </a>
                  </div>
                </div>
              </div>
            </div>

            {/* Right Content - Hero Image */}
            <div className="relative flex flex-col">
              <OptimizedImage
                src="/extended_warranty_uk-car-trustworthy-reviews.png"
                alt="Dealer warranty solutions - BuyAWarranty partner portal"
                className="w-full h-auto"
                priority={true}
                width={651}
                height={434}
                sizes="(max-width: 768px) 100vw, 651px"
              />

              {/* Vehicle Types — desktop */}
              <div className="hidden lg:block w-full mt-4">
                <div className="flex flex-col items-center gap-4">
                  <div className="flex items-center justify-center gap-4 lg:gap-6 flex-wrap">
                    {[
                      { icon: Car, label: 'Cars' },
                      { icon: Truck, label: 'Vans' },
                      { icon: Zap, label: 'Hybrid' },
                      { icon: Battery, label: 'EV' },
                      { icon: Bike, label: 'Motorbikes' },
                    ].map((v) => (
                      <div key={v.label} className="flex items-center space-x-1.5">
                        <v.icon className="w-5 h-5 text-green-400 flex-shrink-0" />
                        <span className="font-medium text-gray-300 text-base">{v.label}</span>
                      </div>
                    ))}
                  </div>
                </div>
              </div>

              {/* Mobile vehicle types */}
              <div className="lg:hidden w-full mt-3">
                <div className="flex items-center justify-center gap-3 flex-wrap text-xs sm:text-sm">
                  {['Cars', 'Vans', 'Hybrid', 'EV', 'Motorbikes'].map((type) => (
                    <span key={type} className="flex items-center gap-1">
                      <Check className="w-3.5 h-3.5 text-green-400" />
                      <span className="font-medium text-gray-300">{type}</span>
                    </span>
                  ))}
                </div>
              </div>
            </div>
          </div>
        </div>
      </section>

      {/* Benefits Section */}
      <section className="py-12 lg:py-20 bg-gray-900">
        <div className="max-w-6xl mx-auto px-4">
          <h2 className="text-2xl sm:text-3xl lg:text-4xl font-bold text-center mb-10 text-white">
            Why Dealers Choose BuyAWarranty
          </h2>
          <div className="grid grid-cols-1 md:grid-cols-3 gap-6 lg:gap-8">
            {[
              { icon: Zap, title: 'Fast Quotes', desc: 'Generate accurate warranty quotes in under 60 seconds. No complex paperwork required.' },
              { icon: TrendingUp, title: 'Increase Revenue', desc: 'Add warranty sales to every vehicle transaction and boost your bottom line effortlessly.' },
              { icon: LayoutDashboard, title: 'Simple Dashboard', desc: 'Track all your quotes, warranties and conversions from one clean, easy-to-use interface.' },
            ].map((b) => (
              <Card key={b.title} className="bg-gray-800 border-gray-700 hover:border-gray-600 transition-colors">
                <CardContent className="p-6 sm:p-8 text-center">
                  <div className="inline-flex p-4 bg-orange-500/10 rounded-full mb-4">
                    <b.icon className="h-8 w-8 text-orange-500" />
                  </div>
                  <h3 className="text-xl font-bold mb-2 text-white">{b.title}</h3>
                  <p className="text-gray-400">{b.desc}</p>
                </CardContent>
              </Card>
            ))}
          </div>
        </div>
      </section>

      {/* How It Works */}
      <section className="py-12 lg:py-20 bg-gray-950">
        <div className="max-w-6xl mx-auto px-4">
          <h2 className="text-2xl sm:text-3xl lg:text-4xl font-bold text-center mb-10 text-white">
            How It Works
          </h2>
          <div className="grid grid-cols-1 md:grid-cols-3 gap-8">
            {[
              { step: '1', icon: UserPlus, title: 'Sign Up', desc: 'Create your dealer account in seconds. No approval wait times needed.' },
              { step: '2', icon: FileText, title: 'Create Quote', desc: 'Enter the vehicle details and get an instant warranty price for your customer.' },
              { step: '3', icon: Shield, title: 'Convert to Warranty', desc: 'Convert your quote into a live warranty with one click. Done.' },
            ].map((s) => (
              <div key={s.step} className="text-center">
                <div className="inline-flex items-center justify-center w-16 h-16 bg-orange-500 text-white rounded-full text-2xl font-bold mb-4">
                  {s.step}
                </div>
                <h3 className="text-xl font-bold mb-2 text-white">{s.title}</h3>
                <p className="text-gray-400">{s.desc}</p>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* CTA Banner */}
      <section className="bg-orange-500 py-12 lg:py-16">
        <div className="max-w-4xl mx-auto px-4 text-center">
          <h2 className="text-2xl sm:text-3xl lg:text-4xl font-bold text-white mb-4">
            Ready to Get Started?
          </h2>
          <p className="text-orange-100 text-base sm:text-lg mb-8">
            Join hundreds of dealers already using BuyAWarranty to grow their warranty sales.
          </p>
          <Link to="/dealer-portal/signup">
            <Button size="lg" className="bg-gray-950 text-white hover:bg-gray-900 text-base sm:text-lg px-8 py-6 font-bold">
              Create Your Free Account
            </Button>
          </Link>
        </div>
      </section>
    </div>
  );
};

export default DealerHome;
