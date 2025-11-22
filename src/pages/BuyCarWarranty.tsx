import React, { useState } from 'react';
import { Button } from '@/components/ui/button';
import { Check, ArrowRight, Star, Shield, Clock, Car, Phone, Menu, X, MessageCircle } from 'lucide-react';
import { Sheet, SheetContent, SheetTrigger } from '@/components/ui/sheet';
import { Link, useNavigate } from 'react-router-dom';
import { SEOHead } from '@/components/SEOHead';
import TrustpilotHeader from '@/components/TrustpilotHeader';
import HomepageFAQ from '@/components/HomepageFAQ';
import WebsiteFooter from '@/components/WebsiteFooter';
import { useIsMobile } from '@/hooks/use-mobile';
import { trackButtonClick } from '@/utils/analytics';
import carWarrantyHero from '@/assets/car-warranty-uk-diesel-car-warranty.png';
import pandaCarWarranty from '@/assets/car-warranty-uk-suv-warranty.png';
import pandaFastService from '@/assets/car-warranty-uk-affordable-warranty.png';
import trustpilotLogo from '@/assets/trustpilot-excellent-box.webp';
import whatsappIconNew from '@/assets/whatsapp-icon-new.png';
import companyRegistration from '@/assets/company-registration-footer.png';

const BuyCarWarranty: React.FC = () => {
  const isMobile = useIsMobile();
  const navigate = useNavigate();
  const [isMobileMenuOpen, setIsMobileMenuOpen] = useState(false);

  const navigateToQuoteForm = () => {
    trackButtonClick('buy_car_warranty_get_quote');
    navigate('/');
    setTimeout(() => {
      const element = document.getElementById('quote-form');
      if (element) {
        element.scrollIntoView({ behavior: 'smooth' });
      }
    }, 100);
  };

  return (
    <>
      <SEOHead
        title="Buy a Car Warranty Online - Trusted UK Cover for All Budgets | Buy A Warranty"
        description="Compare car warranty quotes and get extended cover for your vehicle. Best car warranty UK options for used cars, low monthly costs, and trusted protection. Get a quote today."
        keywords="buy a car warranty online, car warranty UK, extended car warranty, used car warranty, best car warranty provider, affordable car warranty UK, car warranty quotes, car warranty cover, cheap car warranty, car warranty cost, vehicle warranty UK"
        canonical="https://buyawarranty.co.uk/buy-a-warranty-for-my-car-uk-warranties"
      />

      {/* Hero Section */}
      <section className="bg-gradient-to-br from-blue-50 via-white to-orange-50 py-12 md:py-20">
        <div className="container mx-auto px-4">
          <div className="grid md:grid-cols-2 gap-8 items-center">
            <div className="space-y-6">
              <div className="inline-block">
                <TrustpilotHeader />
              </div>
              
              <h1 className="text-3xl md:text-5xl font-bold leading-tight">
                Protect Your Vehicle with <span className="text-[#1e40af]">Trusted UK Warranty Cover</span>
              </h1>
              
              <p className="text-xl text-gray-700">
                Affordable protection for your car, whatever your budget
              </p>

              <div className="space-y-3">
                <div className="flex items-center space-x-2">
                  <Check className="h-5 w-5 text-green-600 flex-shrink-0" />
                  <span className="text-gray-700">Comprehensive cover for used and new cars</span>
                </div>
                <div className="flex items-center space-x-2">
                  <Check className="h-5 w-5 text-green-600 flex-shrink-0" />
                  <span className="text-gray-700">Flexible payment plans from £20 per month</span>
                </div>
                <div className="flex items-center space-x-2">
                  <Check className="h-5 w-5 text-green-600 flex-shrink-0" />
                  <span className="text-gray-700">Get instant quotes online in minutes</span>
                </div>
                <div className="flex items-center space-x-2">
                  <Check className="h-5 w-5 text-green-600 flex-shrink-0" />
                  <span className="text-gray-700">Clear pricing with no surprises</span>
                </div>
              </div>

              <div className="flex flex-col sm:flex-row gap-4">
                <Button 
                  onClick={navigateToQuoteForm}
                  size="lg"
                  className="bg-[#eb4b00] hover:bg-[#d44400] text-white text-lg px-8 py-6"
                >
                  Get Your Warranty Quote
                  <ArrowRight className="ml-2 h-5 w-5" />
                </Button>
                <Button 
                  asChild
                  variant="outline"
                  size="lg"
                  className="text-lg px-8 py-6"
                >
                  <Link to="/contact-us">
                    Contact Us
                  </Link>
                </Button>
              </div>
            </div>

            <div className="relative">
              <img 
                src={carWarrantyHero} 
                alt="Buy a car warranty online UK - trusted vehicle protection"
                className="w-full h-auto"
              />
            </div>
          </div>
        </div>
      </section>

      {/* Why Choose Section */}
      <section className="py-16 bg-white">
        <div className="container mx-auto px-4">
          <h2 className="text-3xl md:text-4xl font-bold text-center mb-12">
            Why choose <span className="text-[#1e40af]">Buy A Warranty</span>?
          </h2>

          <div className="grid md:grid-cols-2 lg:grid-cols-3 gap-8">
            <div className="bg-blue-50 p-6 rounded-lg">
              <Shield className="h-12 w-12 text-[#1e40af] mb-4" />
              <h3 className="text-xl font-bold mb-2">Comprehensive Protection</h3>
              <p className="text-gray-700">
                Full mechanical and electrical cover for both used and brand new vehicles
              </p>
            </div>

            <div className="bg-orange-50 p-6 rounded-lg">
              <Clock className="h-12 w-12 text-[#eb4b00] mb-4" />
              <h3 className="text-xl font-bold mb-2">Flexible Terms</h3>
              <p className="text-gray-700">
                Choose from short or long-term plans with affordable monthly payments
              </p>
            </div>

            <div className="bg-blue-50 p-6 rounded-lg">
              <Star className="h-12 w-12 text-[#1e40af] mb-4" />
              <h3 className="text-xl font-bold mb-2">Quick Quotes</h3>
              <p className="text-gray-700">
                Get multiple quotes in minutes and compare prices easily online
              </p>
            </div>

            <div className="bg-orange-50 p-6 rounded-lg">
              <Check className="h-12 w-12 text-[#eb4b00] mb-4" />
              <h3 className="text-xl font-bold mb-2">Highly Rated</h3>
              <p className="text-gray-700">
                Independent provider with excellent reviews from thousands of customers
              </p>
            </div>

            <div className="bg-blue-50 p-6 rounded-lg">
              <Car className="h-12 w-12 text-[#1e40af] mb-4" />
              <h3 className="text-xl font-bold mb-2">All Fuel Types</h3>
              <p className="text-gray-700">
                Protection available for petrol, diesel, hybrid and electric vehicles
              </p>
            </div>

            <div className="bg-orange-50 p-6 rounded-lg">
              <Shield className="h-12 w-12 text-[#eb4b00] mb-4" />
              <h3 className="text-xl font-bold mb-2">No Hidden Costs</h3>
              <p className="text-gray-700">
                Straightforward pricing that's easy to understand from the start
              </p>
            </div>
          </div>
        </div>
      </section>

      {/* What's Included Section */}
      <section className="py-16 bg-gradient-to-br from-blue-50 to-white">
        <div className="container mx-auto px-4">
          <div className="grid md:grid-cols-2 gap-12 items-center">
            <div>
              <img 
                src={pandaFastService} 
                alt="Car warranty cover includes comprehensive protection"
                className="w-full max-w-md mx-auto h-auto"
              />
            </div>

            <div className="space-y-6">
              <h2 className="text-3xl md:text-4xl font-bold">
                What's included in your <span className="text-[#1e40af]">car warranty</span>
              </h2>
              
              <p className="text-lg text-gray-700">
                Our warranties cover key mechanical and electrical components, including:
              </p>

              <div className="space-y-3">
                <div className="flex items-start space-x-3">
                  <Check className="h-6 w-6 text-green-600 flex-shrink-0 mt-1" />
                  <span className="text-gray-700">Engine, gearbox, clutch and drivetrain</span>
                </div>
                <div className="flex items-start space-x-3">
                  <Check className="h-6 w-6 text-green-600 flex-shrink-0 mt-1" />
                  <span className="text-gray-700">Suspension, steering and braking systems</span>
                </div>
                <div className="flex items-start space-x-3">
                  <Check className="h-6 w-6 text-green-600 flex-shrink-0 mt-1" />
                  <span className="text-gray-700">Air conditioning and cooling systems</span>
                </div>
                <div className="flex items-start space-x-3">
                  <Check className="h-6 w-6 text-green-600 flex-shrink-0 mt-1" />
                  <span className="text-gray-700">Electrical components and infotainment</span>
                </div>
                <div className="flex items-start space-x-3">
                  <Check className="h-6 w-6 text-green-600 flex-shrink-0 mt-1" />
                  <span className="text-gray-700">Labour and parts up to your selected claim limit</span>
                </div>
              </div>

              <Button 
                asChild
                variant="outline"
                size="lg"
                className="mt-4"
              >
                <Link to="/warranty-plan">
                  See What's Covered
                  <ArrowRight className="ml-2 h-5 w-5" />
                </Link>
              </Button>
            </div>
          </div>
        </div>
      </section>

      {/* Is It Worth It Section */}
      <section className="py-16 bg-white">
        <div className="container mx-auto px-4">
          <div className="max-w-4xl mx-auto text-center space-y-6">
            <h2 className="text-3xl md:text-4xl font-bold">
              Is a Car Warranty <span className="text-[#eb4b00]">Worth the Investment?</span>
            </h2>
            
            <p className="text-xl text-gray-700 leading-relaxed">
              Absolutely. Modern vehicles are packed with complex technology, and repair bills can quickly run into thousands of pounds. Whether you've just bought a used car or want to extend your manufacturer's cover, having a warranty gives you financial protection and complete peace of mind on the road.
            </p>

            <div className="bg-blue-50 p-8 rounded-lg mt-8">
              <h3 className="text-2xl font-bold mb-4">Nationwide Cover Across the UK</h3>
              <p className="text-lg text-gray-700">
                We protect drivers throughout England, Scotland, Wales and Northern Ireland. Get an instant quote online and choose the level of cover that matches your vehicle and driving needs.
              </p>
            </div>
          </div>
        </div>
      </section>

      {/* Flexible Payment Options */}
      <section className="py-16 bg-gradient-to-br from-orange-50 to-white">
        <div className="container mx-auto px-4">
          <div className="grid md:grid-cols-2 gap-12 items-center">
            <div className="space-y-6">
              <h2 className="text-3xl md:text-4xl font-bold">
                Flexible <span className="text-[#eb4b00]">payment options</span>
              </h2>
              
              <p className="text-lg text-gray-700">
                Choose the payment plan that works best for you:
              </p>

              <div className="space-y-4">
                <div className="bg-white p-4 rounded-lg shadow-sm">
                  <h4 className="font-bold text-lg mb-2">Pay Monthly</h4>
                  <p className="text-gray-700">Low-cost car warranty with affordable monthly payments</p>
                </div>

                <div className="bg-white p-4 rounded-lg shadow-sm">
                  <h4 className="font-bold text-lg mb-2">One-Off Payment</h4>
                  <p className="text-gray-700">Pay upfront and save with exclusive discounts</p>
                </div>

                <div className="bg-white p-4 rounded-lg shadow-sm">
                  <h4 className="font-bold text-lg mb-2">Flexible Terms</h4>
                  <p className="text-gray-700">Short-term and long-term cover (6, 12, 24 or 36 months)</p>
                </div>
              </div>

              <Button 
                onClick={navigateToQuoteForm}
                size="lg"
                className="bg-[#eb4b00] hover:bg-[#d44400] text-white"
              >
                Compare Plans
                <ArrowRight className="ml-2 h-5 w-5" />
              </Button>
            </div>

            <div>
              <img 
                src={pandaCarWarranty} 
                alt="Affordable car warranty UK with flexible payment options"
                className="w-full max-w-md mx-auto h-auto"
              />
            </div>
          </div>
        </div>
      </section>

      {/* Compare Providers Section */}
      <section className="py-16 bg-white">
        <div className="container mx-auto px-4">
          <div className="max-w-4xl mx-auto">
            <h2 className="text-3xl md:text-4xl font-bold text-center mb-8">
              Why Drivers Choose Us Over Other Providers
            </h2>

            <p className="text-xl text-center text-gray-700 mb-12">
              We're proud to be a highly-rated independent warranty provider in the UK. Our customers choose us as a trusted alternative to household names like Warrantywise, RAC and AA because we offer transparent pricing, genuine care, and comprehensive protection without the corporate overhead.
            </p>

            <div className="grid md:grid-cols-2 gap-6">
              <div className="flex items-start space-x-3 bg-blue-50 p-6 rounded-lg">
                <Check className="h-6 w-6 text-green-600 flex-shrink-0 mt-1" />
                <div>
                  <h4 className="font-bold text-lg mb-1">Best UK warranty provider</h4>
                  <p className="text-gray-700">Highly rated vehicle warranty with transparent vehicle warranty plans</p>
                </div>
              </div>

              <div className="flex items-start space-x-3 bg-orange-50 p-6 rounded-lg">
                <Check className="h-6 w-6 text-green-600 flex-shrink-0 mt-1" />
                <div>
                  <h4 className="font-bold text-lg mb-1">UK warranty experts</h4>
                  <p className="text-gray-700">Vehicle warranty specialists providing expert car warranty advice</p>
                </div>
              </div>

              <div className="flex items-start space-x-3 bg-blue-50 p-6 rounded-lg">
                <Check className="h-6 w-6 text-green-600 flex-shrink-0 mt-1" />
                <div>
                  <h4 className="font-bold text-lg mb-1">Best customer service warranty UK</h4>
                  <p className="text-gray-700">Customer rated car warranty with verified car warranty UK reviews</p>
                </div>
              </div>

              <div className="flex items-start space-x-3 bg-orange-50 p-6 rounded-lg">
                <Check className="h-6 w-6 text-green-600 flex-shrink-0 mt-1" />
                <div>
                  <h4 className="font-bold text-lg mb-1">Reputable car warranty UK</h4>
                  <p className="text-gray-700">Trustworthy warranty provider with trusted vehicle protection UK</p>
                </div>
              </div>
            </div>

            <div className="mt-12 text-center">
              <img 
                src={trustpilotLogo} 
                alt="Trustpilot excellent reviews for car warranty UK"
                className="h-16 mx-auto mb-4"
              />
              <p className="text-gray-600">Rated Excellent by our customers</p>
            </div>
          </div>
        </div>
      </section>

      {/* Vehicle Types Coverage */}
      <section className="py-16 bg-gradient-to-br from-blue-50 to-white">
        <div className="container mx-auto px-4">
          <h2 className="text-3xl md:text-4xl font-bold text-center mb-12">
            Car warranty UK for all vehicle types
          </h2>
          
          <p className="text-xl text-center text-gray-700 mb-12 max-w-3xl mx-auto">
            Whether you need suv warranty uk, hatchback warranty uk, luxury car warranty uk, electric car warranty uk, hybrid car warranty uk, diesel car warranty uk, petrol car warranty uk, estate car warranty uk, small car warranty uk, mpv car warranty uk, performance car warranty, 4x4 warranty uk, ev warranty cover, crossover car warranty, or saloon car warranty - we have you covered.
          </p>

          <div className="grid md:grid-cols-3 lg:grid-cols-4 gap-4 max-w-6xl mx-auto">
            {[
              'SUV Warranty UK',
              'Hatchback Warranty',
              'Luxury Car Cover',
              'Electric Car Warranty',
              'Hybrid Car Warranty',
              'Diesel Car Warranty',
              'Petrol Car Warranty',
              'Estate Car Warranty',
              'Small Car Warranty',
              'MPV Car Warranty',
              'Performance Car Warranty',
              '4x4 Warranty UK',
              'EV Warranty Cover',
              'Crossover Car Warranty',
              'Saloon Car Warranty',
              'Classic Car Warranty UK'
            ].map((type, index) => (
              <div key={index} className="bg-white p-4 rounded-lg shadow-sm text-center">
                <Check className="h-6 w-6 text-green-600 mx-auto mb-2" />
                <p className="font-medium text-sm">{type}</p>
              </div>
            ))}
          </div>

          <p className="text-center text-gray-700 mt-8">
            We also cover vintage vehicle warranty, modified car warranty, and sports car extended warranty.
          </p>
        </div>
      </section>

      {/* Used Car Warranty Section */}
      <section className="py-16 bg-white">
        <div className="container mx-auto px-4 max-w-6xl">
          <h2 className="text-3xl md:text-4xl font-bold text-center mb-12">
            Buy used car warranty - second hand car warranty specialists
          </h2>

          <div className="grid md:grid-cols-2 gap-8 mb-12">
            <div className="bg-blue-50 p-8 rounded-lg">
              <h3 className="text-2xl font-bold mb-4">Used car extended warranty</h3>
              <p className="text-gray-700 mb-6">
                Looking for the best warranty for used cars? Our used vehicle protection uk plans offer comprehensive second hand car warranty cover. Whether you need warranty for pre owned vehicles, used car breakdown cover, or warranty for older used cars, we provide best extended warranty for used vehicles options.
              </p>
              <ul className="space-y-3">
                {[
                  'Warranty after buying used car',
                  'Used car warranty company UK specialists',
                  'Warranty for high mileage used car',
                  'Second owner car warranty options',
                  'Post sale car warranty protection',
                  'Used car mechanical insurance',
                  'Used car engine warranty',
                  'Used car coverage plans',
                  'Used car warranty insurance'
                ].map((item, index) => (
                  <li key={index} className="flex items-start gap-2">
                    <Check className="w-5 h-5 text-green-600 mt-0.5 flex-shrink-0" />
                    <span>{item}</span>
                  </li>
                ))}
              </ul>
            </div>

            <div className="bg-orange-50 p-8 rounded-lg">
              <h3 className="text-2xl font-bold mb-4">Where to buy car warranty UK</h3>
              <p className="text-gray-700 mb-6">
                How to get car warranty UK? It is simple. As the best place to get car warranty, we make buying warranty after car purchase easy. You can buy extended car warranty online in minutes.
              </p>
              <ul className="space-y-3">
                {[
                  'What does car warranty cover? Engine, gearbox, electrical and more',
                  'Is car warranty worth it UK? Absolutely - protects against costly repairs',
                  'How much is car warranty? Get instant quotes online',
                  'Can I get car warranty anytime? Yes, even years after purchase',
                  'Do I need car warranty? Highly recommended for peace of mind',
                  'Can I extend my car warranty? Yes, flexible extension options',
                  'Buying car warranty for second hand car is our specialty',
                  'Apply for car warranty online today',
                  'Do I need warranty on used car? We strongly recommend it',
                  'Getting warranty after dealer cover ends',
                  'Questions to ask car warranty provider - we answer them all'
                ].map((item, index) => (
                  <li key={index} className="flex items-start gap-2">
                    <Check className="w-5 h-5 text-green-600 mt-0.5 flex-shrink-0" />
                    <span className="text-sm">{item}</span>
                  </li>
                ))}
              </ul>
            </div>
          </div>
        </div>
      </section>

      {/* Warranty Duration Options */}
      <section className="py-16 bg-gradient-to-br from-orange-50 to-white">
        <div className="container mx-auto px-4 max-w-6xl">
          <h2 className="text-3xl md:text-4xl font-bold text-center mb-12">
            Choose your warranty term: 12 month, 24 month or 36 month car warranty
          </h2>

          <p className="text-xl text-center text-gray-700 mb-12 max-w-3xl mx-auto">
            We offer flexible duration warranty uk including short term car warranty, long term car warranty, monthly vehicle warranty, and yearly car warranty uk options. Need 3 year car warranty uk or car warranty after 3 years of dealer cover? We have you sorted.
          </p>

          <div className="grid md:grid-cols-3 gap-6 mb-12">
            <div className="bg-white p-8 rounded-lg shadow-sm">
              <div className="text-4xl font-bold text-[#1e40af] mb-4">12</div>
              <h3 className="text-2xl font-bold mb-3">12 month car warranty</h3>
              <p className="text-gray-700 mb-4">Perfect for short term car warranty needs. Great if you are planning to upgrade soon or want to test our service first.</p>
              <Button onClick={navigateToQuoteForm} variant="outline" className="w-full">Get 12 Month Quote</Button>
            </div>

            <div className="bg-white p-8 rounded-lg shadow-sm border-2 border-[#eb4b00]">
              <div className="text-4xl font-bold text-[#eb4b00] mb-4">24</div>
              <h3 className="text-2xl font-bold mb-3">24 month car warranty</h3>
              <p className="text-gray-700 mb-4">Most popular option. Excellent value for money with two years of comprehensive protection and peace of mind.</p>
              <Button onClick={navigateToQuoteForm} className="w-full bg-[#eb4b00] hover:bg-[#d44400]">Get 24 Month Quote</Button>
            </div>

            <div className="bg-white p-8 rounded-lg shadow-sm">
              <div className="text-4xl font-bold text-[#1e40af] mb-4">36</div>
              <h3 className="text-2xl font-bold mb-3">36 month car warranty</h3>
              <p className="text-gray-700 mb-4">Maximum protection with our 3 year car warranty UK plan. Best long term car warranty for complete peace of mind.</p>
              <Button onClick={navigateToQuoteForm} variant="outline" className="w-full">Get 36 Month Quote</Button>
            </div>
          </div>

          <div className="bg-blue-50 p-8 rounded-lg text-center">
            <h3 className="text-2xl font-bold mb-4">Warranty post manufacturer and beyond</h3>
            <p className="text-lg text-gray-700 mb-4">
              Looking for lifetime vehicle warranty UK? While we do not offer truly lifetime cover, our plans can be renewed. We specialize in warranty post manufacturer expiry, post warranty car protection, and vehicle warranty after expiry.
            </p>
            <p className="text-gray-700">
              Need to extend expired car warranty? We can help with warranty after new car cover ends, warranty after 60000 miles, warranty after 100000 miles, and long coverage warranty plan options. Just contact us for annual car warranty UK plans.
            </p>
          </div>
        </div>
      </section>

      {/* Price & Value Section */}
      <section className="py-16 bg-white">
        <div className="container mx-auto px-4 max-w-6xl">
          <h2 className="text-3xl md:text-4xl font-bold text-center mb-12">
            Car warranty prices UK - affordable car warranty for all budgets
          </h2>

          <div className="grid md:grid-cols-2 gap-8">
            <div className="space-y-4">
              <h3 className="text-2xl font-bold">Cheap car warranty UK without compromising quality</h3>
              <p className="text-gray-700">
                Looking for cheap car warranty uk, affordable car warranty uk, or budget car warranty uk? We offer best value car warranty and low cost car warranty uk options. Our cheap vehicle warranty uk plans include pay monthly car warranty for all budgets, ensuring cost effective car warranty and value for money car warranty.
              </p>
              <ul className="space-y-2">
                {[
                  'Low cost extended warranty',
                  'Cheapest vehicle warranty plans',
                  'Extended warranty with low premiums',
                  'Budget friendly car protection',
                  'Discounted car warranty',
                  'Affordable extended vehicle coverage'
                ].map((item, index) => (
                  <li key={index} className="flex items-start gap-2">
                    <Check className="w-5 h-5 text-green-600 mt-0.5 flex-shrink-0" />
                    <span>{item}</span>
                  </li>
                ))}
              </ul>
            </div>

            <div className="space-y-4">
              <h3 className="text-2xl font-bold">Compare car warranty UK - get the best car warranty quote</h3>
              <p className="text-gray-700">
                Use our car warranty comparison site to compare car warranty uk options. Get a car warranty quote, find car warranty uk options, compare extended car warranties, and get extended car warranty quote. We provide vehicle warranty quote uk, cheapest car warranty quotes, and best car warranty quote uk.
              </p>
              <ul className="space-y-2">
                {[
                  'Car protection plan UK',
                  'Vehicle protection quotes',
                  'Get used car warranty quote',
                  'Extended warranty quote online',
                  'Compare vehicle warranty providers',
                  'Warranty quote for old cars',
                  'Warranty plans comparison uk',
                  'Find best car warranty',
                  'Car warranty monthly cost calculator'
                ].map((item, index) => (
                  <li key={index} className="flex items-start gap-2">
                    <Check className="w-5 h-5 text-green-600 mt-0.5 flex-shrink-0" />
                    <span>{item}</span>
                  </li>
                ))}
              </ul>
            </div>
          </div>

          <div className="mt-12 bg-orange-50 p-8 rounded-lg text-center">
            <h3 className="text-2xl font-bold mb-4">Private car warranty UK and extended warranty cost uk</h3>
            <p className="text-lg text-gray-700">
              As one of the best car warranty providers and extended car warranty providers in the UK, we offer competitive car warranty prices and extended warranty cost uk. Compare our car warranty plans, car warranty cover, and car warranties uk options. We are a leading car warranty company offering uk car warranty and online car warranty services. Get your car warranty reviews uk and car protection plan uk today.
            </p>
          </div>
        </div>
      </section>

      {/* Warrantywise Alternative Section */}
      <section className="py-16 bg-gradient-to-br from-blue-50 to-white">
        <div className="container mx-auto px-4 max-w-6xl">
          <h2 className="text-3xl md:text-4xl font-bold text-center mb-8">
            Warrantywise alternative - better than Warrantywise
          </h2>

          <p className="text-xl text-center text-gray-700 mb-12 max-w-3xl mx-auto">
            Comparing Warrantywise vs us? See why customers choose us as a Warrantywise alternative and Warrantywise competitors. We are often considered cheaper than Warrantywise and better than Warrantywise with superior Warrantywise customer service.
          </p>

          <div className="grid md:grid-cols-3 gap-6">
            <div className="bg-white p-6 rounded-lg shadow-sm">
              <h3 className="text-xl font-bold mb-3">Compare Warrantywise</h3>
              <p className="text-gray-700 mb-4">
                Get a Warrantywise quote comparison. Read Warrantywise reviews and see who is better than Warrantywise. Compare Warrantywise prices with ours.
              </p>
              <p className="text-sm text-gray-600">Warrantywise vs RAC, Warrantywise vs AA - we compete with them all.</p>
            </div>

            <div className="bg-white p-6 rounded-lg shadow-sm border-2 border-[#eb4b00]">
              <h3 className="text-xl font-bold mb-3">Is Warrantywise any good?</h3>
              <p className="text-gray-700 mb-4">
                While Warrantywise UK and Warrantywise extended warranty are popular, many customers prefer our Warrantywise used car warranty alternative and Warrantywise vehicle protection comparison.
              </p>
              <p className="text-sm text-gray-600">Warrantywise breakdown cover vs our comprehensive plans.</p>
            </div>

            <div className="bg-white p-6 rounded-lg shadow-sm">
              <h3 className="text-xl font-bold mb-3">Warrantywise Comparison</h3>
              <p className="text-gray-700 mb-4">
                Do a full Warrantywise comparison and see why we are rated as a top car warranty provider UK and vehicle warranty providers choice.
              </p>
              <p className="text-sm text-gray-600">Auto warranty providers trust and extended warranty providers expertise.</p>
            </div>
          </div>
        </div>
      </section>

      {/* Dealer Alternative Section */}
      <section className="py-16 bg-white">
        <div className="container mx-auto px-4 max-w-4xl text-center">
          <h2 className="text-3xl md:text-4xl font-bold mb-8">
            RAC car warranty alternative - AA car warranty UK alternative
          </h2>

          <p className="text-xl text-gray-700 mb-8">
            Looking for best non dealer car warranty? We offer independent warranty vs dealer options with third party car warranty uk expertise. Compare manufacturer warranty vs extended options and explore aftermarket warranty uk choices.
          </p>

          <div className="bg-blue-50 p-8 rounded-lg">
            <h3 className="text-2xl font-bold mb-4">Extended warranty not from dealer</h3>
            <p className="text-lg text-gray-700 mb-4">
              Our car warranty comparison vs dealer shows significant savings. We are a VGS car warranty alternative providing trusted warranty outside dealership and car warranty coverage without dealer restrictions. Compare vehicle protection plans uk, RAC vs AA warranty, and find the best independent warranty company UK.
            </p>
            <p className="text-gray-700">
              Get car warranty insurance, extended warranty insurance, and car warranty providers uk expertise all in one place.
            </p>
          </div>
        </div>
      </section>

      {/* Final CTA Section */}
      <section className="py-16 bg-[#284185] text-white">
        <div className="container mx-auto px-4 text-center">
          <h2 className="text-3xl md:text-5xl font-bold mb-6">
            Ready to buy a car warranty online?
          </h2>
          
          <p className="text-xl mb-8 max-w-3xl mx-auto">
            Get started in minutes. Just enter your reg, choose your cover, and get protected.
          </p>

          <Button 
            onClick={navigateToQuoteForm}
            size="lg"
            className="bg-[#eb4b00] hover:bg-[#d44400] text-white text-xl px-12 py-8"
          >
            Get Your Car Warranty Quote Now
            <ArrowRight className="ml-2 h-6 w-6" />
          </Button>

          <div className="mt-8 flex flex-col sm:flex-row items-center justify-center gap-4 text-sm">
            <div className="flex items-center space-x-2">
              <Check className="h-5 w-5" />
              <span>Instant quotes</span>
            </div>
            <div className="flex items-center space-x-2">
              <Check className="h-5 w-5" />
              <span>No obligation</span>
            </div>
            <div className="flex items-center space-x-2">
              <Check className="h-5 w-5" />
              <span>UK-wide cover</span>
            </div>
          </div>
        </div>
      </section>

      {/* FAQ Section */}
      <section className="py-16 bg-white">
        <div className="container mx-auto px-4">
          <h2 className="text-3xl md:text-4xl font-bold text-center mb-12">
            Frequently Asked Questions
          </h2>
          <HomepageFAQ />
        </div>
      </section>

      {/* Company Registration Footer */}
      <div className="bg-gray-50 py-8">
        <div className="container mx-auto px-4">
          <div className="flex justify-center">
            <img 
              src={companyRegistration} 
              alt="Buy A Warranty company registration - FCA regulated"
              className="h-16 opacity-70"
            />
          </div>
        </div>
      </div>

      <WebsiteFooter />

      {/* Mobile Floating Buttons */}
      {isMobile && (
        <div className="fixed bottom-4 right-4 z-50 flex flex-col gap-3">
          <a
            href="https://wa.me/447828324388"
            target="_blank"
            rel="noopener noreferrer"
            className="bg-[#25D366] hover:bg-[#20BA5A] text-white p-4 rounded-full shadow-lg transition-all duration-300 hover:scale-110 flex items-center justify-center"
            onClick={() => trackButtonClick('whatsapp_float_buy_car_warranty')}
          >
            <img src={whatsappIconNew} alt="WhatsApp" className="h-6 w-6" />
          </a>
          
          <a
            href="tel:+447828324388"
            className="bg-[#1e40af] hover:bg-[#1e3a8a] text-white p-4 rounded-full shadow-lg transition-all duration-300 hover:scale-110 flex items-center justify-center"
            onClick={() => trackButtonClick('phone_float_buy_car_warranty')}
          >
            <Phone className="h-6 w-6" />
          </a>
        </div>
      )}
    </>
  );
};

export default BuyCarWarranty;
