import React, { useState } from 'react';
import { Button } from '@/components/ui/button';
import { Check, ArrowRight, Star, Shield, Phone, Menu, ChevronDown, ChevronUp } from 'lucide-react';
import { Sheet, SheetContent, SheetTrigger } from '@/components/ui/sheet';
import { Link, useNavigate } from 'react-router-dom';
import { SEOHead } from '@/components/SEOHead';
import { OrganizationSchema } from '@/components/schema/OrganizationSchema';
import { ReviewSchema } from '@/components/schema/ReviewSchema';
import { WebPageSchema } from '@/components/schema/WebPageSchema';
import { FAQSchema } from '@/components/schema/FAQSchema';
import { ProductSchema } from '@/components/schema/ProductSchema';
import { BreadcrumbSchema } from '@/components/schema/BreadcrumbSchema';
import TrustpilotHeader from '@/components/TrustpilotHeader';
import { useIsMobile } from '@/hooks/use-mobile';
import { trackButtonClick } from '@/utils/analytics';
import { OptimizedImage } from '@/components/OptimizedImage';
import bmwLogo from '@/assets/logos/bmw.webp';
import bmwHeroImage from '@/assets/Bmw-extended-used-car-warranty.png';
import buyawarrantyLogo from '@/assets/buyawarranty-logo.webp';
import trustpilotLogo from '@/assets/trustpilot-excellent-box.webp';

const BMWWarranty: React.FC = () => {
  const isMobile = useIsMobile();
  const navigate = useNavigate();
  const [isMobileMenuOpen, setIsMobileMenuOpen] = useState(false);
  const [openFaqId, setOpenFaqId] = useState<number | null>(null);

  const toggleFaq = (index: number) => {
    setOpenFaqId(openFaqId === index ? null : index);
  };

  const navigateToQuoteForm = () => {
    trackButtonClick('bmw_warranty_get_quote');
    navigate('/#quote-form');
  };

  const bmwFAQs = [
    {
      question: "Is a BMW extended warranty worth it in the UK?",
      answer: "Yes, BMW repairs are some of the most expensive in the UK due to advanced electronics and complex powertrains. An extended warranty protects key components like the engine, gearbox, fuel injectors and ECUs, preventing sudden repair bills that can reach £6,000 to £9,000 on premium BMW models."
    },
    {
      question: "How much does a BMW extended warranty cost in the UK?",
      answer: "Extended BMW warranty prices typically start from £35 to £95 per month, depending on your BMW model, mileage, and chosen claim limit. High-performance or M-Sport models are not covered."
    },
    {
      question: "Can I purchase an extended warranty directly from BMW?",
      answer: "Yes, BMW UK offers extended warranty cover, but it usually requires servicing at BMW-approved workshops and has limits on electrical component cover. Independent warranty providers provide broader coverage, lower prices, and more flexible repair options."
    },
    {
      question: "Can I buy a BMW extended warranty after my original warranty has expired?",
      answer: "Yes, you can buy cover even if your BMW is outside its original 3-year manufacturer warranty, or if you purchased it used. Mileage and vehicle condition will determine which plan fits best."
    },
    {
      question: "Can I negotiate the price of a BMW extended warranty?",
      answer: "Yes, prices for extended warranties are often negotiable, especially with independent providers. You can request discounts, annual payment savings, or remove optional add-ons to reduce cost."
    },
    {
      question: "How much is a 5-year BMW extended warranty?",
      answer: "A 5-year extended warranty usually ranges between £1,200 and £2,800 total, depending on model, mileage, and coverage level. High-performance models like the BMW M3 or X5 can cost more due to costly engine and gearbox repairs."
    },
    {
      question: "Is a used BMW warranty worth it?",
      answer: "Yes. Used BMWs, especially 3 Series, 5 Series, X5 and M models, are more likely to need repairs after 50,000 miles. A used BMW warranty stabilises ownership costs and reduces financial risk."
    },
    {
      question: "Can I use my own garage for BMW warranty repairs?",
      answer: "Yes, with most independent warranties. You can choose any VAT-registered garage instead of being restricted to BMW dealers."
    },
    {
      question: "Does an extended BMW warranty cover hybrids and electric models?",
      answer: "Yes, as long as battery and drivetrain systems are included in the policy. Coverage varies between providers, so always confirm EV inclusions."
    }
  ];

  return (
    <>
      <SEOHead
        title="BMW Car Extended Warranty | Used BMW Cover & Instant Quotes"
        description="Protect your BMW from costly repairs with an extended BMW warranty. Instant quotes, UK garages, flexible payment plans, and cover for used BMWs up to 150,000 miles."
        keywords="BMW warranty, BMW extended warranty, used BMW warranty, BMW car warranty UK, BMW warranty cost, BMW mechanical warranty"
        canonical="https://buyawarranty.co.uk/car-extended-warranty/bmw/"
        geoRegion="GB"
        geoPlacename="United Kingdom"
      />

      <OrganizationSchema />
      <ReviewSchema />
      <WebPageSchema 
        name="BMW Extended Warranty - Affordable Cover with Fast Claims"
        description="Comprehensive BMW warranty coverage for all models. Protect your BMW from expensive repairs with our extended warranty plans."
        url="https://buyawarranty.co.uk/car-extended-warranty/bmw/"
      />
      <FAQSchema faqs={bmwFAQs} />
      <ProductSchema
        name="BMW Extended Warranty"
        description="Comprehensive warranty coverage for BMW vehicles"
        price="35"
        brand="Buy A Warranty"
        category="Vehicle Warranty"
        image="https://buyawarranty.co.uk/logo.png"
        availability="https://schema.org/InStock"
        areaServed="GB"
      />
      <BreadcrumbSchema 
        items={[
          { name: "Home", url: "https://buyawarranty.co.uk/" },
          { name: "Car Extended Warranty", url: "https://buyawarranty.co.uk/car-extended-warranty/" },
          { name: "BMW Warranty", url: "https://buyawarranty.co.uk/car-extended-warranty/bmw/" }
        ]}
      />

      {/* Hero Section */}
      <section className="bg-gradient-to-br from-primary/5 via-white to-secondary/5 py-16 md:py-24">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="grid lg:grid-cols-2 gap-12 items-center">
            <div>
              <div className="flex items-center gap-4 mb-6">
                <OptimizedImage 
                  src={bmwLogo} 
                  alt="BMW Logo" 
                  className="h-16 w-auto object-contain"
                  priority={true}
                  width={120}
                  height={64}
                />
              </div>
              <h1 className="text-4xl md:text-5xl font-bold text-gray-900 mb-3">
                Reliable BMW Extended Warranty
              </h1>
              <h2 className="text-2xl md:text-3xl font-semibold text-gray-700 mb-6">
                Affordable Cover with Fast Claims
              </h2>

              <p className="text-xl text-gray-700 mb-8">
                Protect Your BMW. Avoid Costly Repairs. Drive With Confidence.
              </p>
              <p className="text-lg text-gray-600 mb-8">
                Owning a BMW is about performance, luxury and engineering excellence. But when repairs happen, they can be expensive. An extended BMW warranty protects you from unexpected repair bills once your manufacturer's warranty ends.
              </p>
              
              <div className="space-y-3 mb-8">
                <div className="flex items-start gap-3">
                  <Check className="h-6 w-6 text-green-600 flex-shrink-0 mt-0.5" />
                  <span className="text-gray-700">Fully mechanical and electrical cover</span>
                </div>
                <div className="flex items-start gap-3">
                  <Check className="h-6 w-6 text-green-600 flex-shrink-0 mt-0.5" />
                  <span className="text-gray-700">Used and older BMWs welcome</span>
                </div>
                <div className="flex items-start gap-3">
                  <Check className="h-6 w-6 text-green-600 flex-shrink-0 mt-0.5" />
                  <span className="text-gray-700">Instant online quotes</span>
                </div>
                <div className="flex items-start gap-3">
                  <Check className="h-6 w-6 text-green-600 flex-shrink-0 mt-0.5" />
                  <span className="text-gray-700">Flexible monthly plans</span>
                </div>
              </div>

              <p className="text-lg font-semibold text-primary mb-6">
                We are the only warranty provider offering high mileage cover up to 150,000 miles, ideal for older or used BMWs.
              </p>

              <Button 
                size="lg" 
                onClick={navigateToQuoteForm}
                className="w-full sm:w-auto"
              >
                Get my instant quote <ArrowRight className="ml-2 h-5 w-5" />
              </Button>
            </div>

            <div className="lg:pl-12">
              {/* BMW Hero Image */}
              <div className="mb-8">
                <OptimizedImage
                  src={bmwHeroImage}
                  alt="BMW extended used car warranty - white BMW 3 series"
                  className="w-full h-auto rounded-lg shadow-lg object-cover"
                  width={1200}
                  height={675}
                />
              </div>
              <TrustpilotHeader className="mb-8" />
            </div>
          </div>
        </div>
      </section>

      {/* Why BMW Owners Choose Us */}
      <section className="py-16 bg-gray-50">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <h2 className="text-3xl md:text-4xl font-bold text-center mb-4">
            Why BMW Owners Choose Us
          </h2>
          <p className="text-center text-lg text-gray-600 mb-12">
            Built for premium vehicles. Trusted by BMW drivers across the UK who want smarter cover than the dealership offers.
          </p>

          <div className="overflow-x-auto">
            <table className="w-full border-collapse">
              <thead>
                <tr className="bg-primary/5">
                  <th className="border border-gray-300 p-4 text-left font-bold">Benefit</th>
                  <th className="border border-gray-300 p-4 text-left font-bold">What it means for you</th>
                </tr>
              </thead>
              <tbody>
                <tr>
                  <td className="border border-gray-300 p-4 font-semibold">Full BMW mechanical + electrical protection</td>
                  <td className="border border-gray-300 p-4">Engine, gearbox, ECU, sensors, fuel system, suspension and more</td>
                </tr>
                <tr className="bg-gray-50">
                  <td className="border border-gray-300 p-4 font-semibold">Used BMW extended warranty</td>
                  <td className="border border-gray-300 p-4">Coverage continues after BMW's initial 3-year warranty expires</td>
                </tr>
                <tr>
                  <td className="border border-gray-300 p-4 font-semibold">Flexible payment options</td>
                  <td className="border border-gray-300 p-4">Pay monthly or annually, no hidden fees</td>
                </tr>
                <tr className="bg-gray-50">
                  <td className="border border-gray-300 p-4 font-semibold">UK-wide garage network</td>
                  <td className="border border-gray-300 p-4">Repairs carried out at approved repair centres</td>
                </tr>
                <tr>
                  <td className="border border-gray-300 p-4 font-semibold">Fast claims approval</td>
                  <td className="border border-gray-300 p-4">We get you back on the road faster</td>
                </tr>
              </tbody>
            </table>
          </div>
        </div>
      </section>

      {/* What Does a BMW Extended Warranty Cover? */}
      <section className="py-16 bg-gradient-to-br from-blue-50 via-white to-orange-50">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <h2 className="text-3xl md:text-4xl font-bold text-center mb-12">
            What Does a BMW Extended Warranty Cover?
          </h2>
          <p className="text-center text-lg text-gray-600 mb-12">
            Our plans are structured to protect the components that fail most on BMW models:
          </p>

          <div className="grid md:grid-cols-3 gap-8">
            <div className="bg-white p-6 rounded-lg shadow-md">
              <h3 className="text-xl font-bold mb-4 flex items-center gap-2">
                <Check className="h-6 w-6 text-green-600" />
                Mechanical Components
              </h3>
              <ul className="space-y-3">
                <li className="flex items-start gap-2">
                  <Check className="h-5 w-5 text-green-600 flex-shrink-0 mt-0.5" />
                  <span>Engine and internal components</span>
                </li>
                <li className="flex items-start gap-2">
                  <Check className="h-5 w-5 text-green-600 flex-shrink-0 mt-0.5" />
                  <span>Gearbox and torque converter</span>
                </li>
                <li className="flex items-start gap-2">
                  <Check className="h-5 w-5 text-green-600 flex-shrink-0 mt-0.5" />
                  <span>Differential and drive shafts</span>
                </li>
              </ul>
            </div>

            <div className="bg-white p-6 rounded-lg shadow-md">
              <h3 className="text-xl font-bold mb-4 flex items-center gap-2">
                <Check className="h-6 w-6 text-green-600" />
                Electrical & ECU Systems
              </h3>
              <ul className="space-y-3">
                <li className="flex items-start gap-2">
                  <Check className="h-5 w-5 text-green-600 flex-shrink-0 mt-0.5" />
                  <span>ECU and electronic control units</span>
                </li>
                <li className="flex items-start gap-2">
                  <Check className="h-5 w-5 text-green-600 flex-shrink-0 mt-0.5" />
                  <span>Sensors, wiring and modules</span>
                </li>
                <li className="flex items-start gap-2">
                  <Check className="h-5 w-5 text-green-600 flex-shrink-0 mt-0.5" />
                  <span>Digital instrument clusters</span>
                </li>
                <li className="flex items-start gap-2">
                  <Check className="h-5 w-5 text-green-600 flex-shrink-0 mt-0.5" />
                  <span>Infotainment systems</span>
                </li>
              </ul>
            </div>

            <div className="bg-white p-6 rounded-lg shadow-md">
              <h3 className="text-xl font-bold mb-4 flex items-center gap-2">
                <Check className="h-6 w-6 text-green-600" />
                Cooling & Fuel Systems
              </h3>
              <ul className="space-y-3">
                <li className="flex items-start gap-2">
                  <Check className="h-5 w-5 text-green-600 flex-shrink-0 mt-0.5" />
                  <span>Radiators and cooling pumps</span>
                </li>
                <li className="flex items-start gap-2">
                  <Check className="h-5 w-5 text-green-600 flex-shrink-0 mt-0.5" />
                  <span>Fuel injectors and pumps</span>
                </li>
              </ul>
              <h3 className="text-xl font-bold mt-6 mb-4 flex items-center gap-2">
                <Check className="h-6 w-6 text-green-600" />
                Heating, Climate & Comfort
              </h3>
              <ul className="space-y-3">
                <li className="flex items-start gap-2">
                  <Check className="h-5 w-5 text-green-600 flex-shrink-0 mt-0.5" />
                  <span>Air conditioning systems</span>
                </li>
                <li className="flex items-start gap-2">
                  <Check className="h-5 w-5 text-green-600 flex-shrink-0 mt-0.5" />
                  <span>Central locking and mirrors</span>
                </li>
              </ul>
            </div>
          </div>

          <p className="text-center text-lg text-gray-700 mt-8">
            You also receive labour and diagnostics included up to your claim limit.
          </p>
        </div>
      </section>

      {/* BMW Warranty Coverage by Model */}
      <section className="py-16 bg-gray-50">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <h2 className="text-3xl md:text-4xl font-bold text-center mb-4">
            BMW Warranty Coverage by Model
          </h2>
          <p className="text-center text-lg text-gray-600 mb-12">
            We cover nearly all BMW petrol, diesel, hybrid and electric cars registered in the UK:
          </p>

          <div className="overflow-x-auto">
            <table className="w-full border-collapse">
              <thead>
                <tr className="bg-primary/5">
                  <th className="border border-gray-300 p-4 text-left font-bold">BMW Model Range</th>
                  <th className="border border-gray-300 p-4 text-left font-bold">Popular Models Covered</th>
                  <th className="border border-gray-300 p-4 text-left font-bold">Avg. Repair Costs (From)</th>
                </tr>
              </thead>
              <tbody>
                <tr>
                  <td className="border border-gray-300 p-4 font-semibold">BMW 1 Series</td>
                  <td className="border border-gray-300 p-4">116i / 118i / 120d / M135i</td>
                  <td className="border border-gray-300 p-4">£900 – £2,000+</td>
                </tr>
                <tr className="bg-gray-50">
                  <td className="border border-gray-300 p-4 font-semibold">BMW 2 Series</td>
                  <td className="border border-gray-300 p-4">218i / 220d / M235i / Gran Coupé</td>
                  <td className="border border-gray-300 p-4">£1,200 – £2,500+</td>
                </tr>
                <tr>
                  <td className="border border-gray-300 p-4 font-semibold">BMW 3 Series</td>
                  <td className="border border-gray-300 p-4">320d / 330e / 335d / M3</td>
                  <td className="border border-gray-300 p-4">£1,500 – £4,000+</td>
                </tr>
                <tr className="bg-gray-50">
                  <td className="border border-gray-300 p-4 font-semibold">BMW 4 Series</td>
                  <td className="border border-gray-300 p-4">420d / 430i / 440i / M4</td>
                  <td className="border border-gray-300 p-4">£1,800 – £4,500+</td>
                </tr>
                <tr>
                  <td className="border border-gray-300 p-4 font-semibold">BMW 5 Series</td>
                  <td className="border border-gray-300 p-4">520d / 530e / 540i / M5</td>
                  <td className="border border-gray-300 p-4">£2,000 – £6,000+</td>
                </tr>
                <tr className="bg-gray-50">
                  <td className="border border-gray-300 p-4 font-semibold">BMW 6 Series</td>
                  <td className="border border-gray-300 p-4">630i / 640d / Gran Turismo</td>
                  <td className="border border-gray-300 p-4">£2,200 – £5,500+</td>
                </tr>
                <tr>
                  <td className="border border-gray-300 p-4 font-semibold">BMW 7 Series</td>
                  <td className="border border-gray-300 p-4">730d / 740i / 750Li</td>
                  <td className="border border-gray-300 p-4">£2,800 – £7,000+</td>
                </tr>
                <tr className="bg-gray-50">
                  <td className="border border-gray-300 p-4 font-semibold">BMW X Series (SUV)</td>
                  <td className="border border-gray-300 p-4">X1 / X3 / X4 / X5 / X6 / X7</td>
                  <td className="border border-gray-300 p-4">£1,700 – £9,000+</td>
                </tr>
                <tr>
                  <td className="border border-gray-300 p-4 font-semibold">BMW i-Series (Electric / Hybrid)</td>
                  <td className="border border-gray-300 p-4">i3 / i4 / i5 / i7 / i8</td>
                  <td className="border border-gray-300 p-4">£1,200 – £11,000+</td>
                </tr>
                <tr className="bg-gray-50">
                  <td className="border border-gray-300 p-4 font-semibold">BMW M Series (Performance)</td>
                  <td className="border border-gray-300 p-4">M2 / M3 / M4 / M5 / M8 / X5M / X6M</td>
                  <td className="border border-gray-300 p-4">£2,500 – £12,000+</td>
                </tr>
              </tbody>
            </table>
          </div>

          <div className="mt-8 p-6 bg-yellow-50 border-l-4 border-yellow-500 rounded-r-lg">
            <p className="font-semibold text-gray-900">
              Note: We are unable to cover 'M' Series BMW's
            </p>
          </div>

          <p className="text-center text-lg text-gray-700 mt-8">
            All models are eligible for our used, new and high-mileage BMW extended warranty plans (up to 150,000 miles).
          </p>
        </div>
      </section>

      {/* How It Works */}
      <section className="py-16 bg-gradient-to-br from-blue-50 via-white to-orange-50">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <h2 className="text-3xl md:text-4xl font-bold text-center mb-12">
            How It Works
          </h2>
          <p className="text-center text-lg text-gray-600 mb-12">
            Getting covered is as simple as:
          </p>

          <div className="grid md:grid-cols-3 gap-8 mb-12">
            <div className="bg-white p-6 rounded-lg shadow-md text-center">
              <div className="bg-primary text-white w-12 h-12 rounded-full flex items-center justify-center text-xl font-bold mx-auto mb-4">1</div>
              <h3 className="font-bold text-lg mb-2">Enter your reg</h3>
              <p className="text-gray-600">Quick vehicle lookup with your registration number</p>
            </div>
            <div className="bg-white p-6 rounded-lg shadow-md text-center">
              <div className="bg-primary text-white w-12 h-12 rounded-full flex items-center justify-center text-xl font-bold mx-auto mb-4">2</div>
              <h3 className="font-bold text-lg mb-2">Pick your cover level</h3>
              <p className="text-gray-600">Choose the plan that suits your BMW</p>
            </div>
            <div className="bg-white p-6 rounded-lg shadow-md text-center">
              <div className="bg-primary text-white w-12 h-12 rounded-full flex items-center justify-center text-xl font-bold mx-auto mb-4">3</div>
              <h3 className="font-bold text-lg mb-2">Protect your BMW immediately</h3>
              <p className="text-gray-600">Instant cover with no waiting period</p>
            </div>
          </div>

          <p className="text-center text-lg font-semibold text-gray-700">
            No inspections. No hidden fees.
          </p>
        </div>
      </section>

      {/* Used BMW Warranty */}
      <section className="py-16 bg-gray-50">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <h2 className="text-3xl md:text-4xl font-bold text-center mb-4">
            Used BMW Warranty - Ideal for Older & High-Mileage Cars
          </h2>
          <div className="flex justify-center mb-6">
            <a 
              href="https://uk.trustpilot.com/review/buyawarranty.co.uk" 
              target="_blank" 
              rel="noopener noreferrer"
              className="transition-opacity hover:opacity-80"
            >
              <img 
                src={trustpilotLogo} 
                alt="Trustpilot 5 stars" 
                className="h-auto w-32 object-contain"
              />
            </a>
          </div>
          <p className="text-center text-lg text-gray-600 mb-12">
            Bought a used BMW or planning to extend cover beyond year 3?
          </p>

          <div className="max-w-3xl mx-auto">
            <p className="text-lg text-gray-700 mb-6">
              A used BMW extended warranty helps prevent expensive repair surprises such as:
            </p>

            <ul className="space-y-3 mb-8">
              <li className="flex items-start gap-3">
                <Check className="h-6 w-6 text-green-600 flex-shrink-0 mt-0.5" />
                <span className="text-gray-700">Timing chain failure</span>
              </li>
              <li className="flex items-start gap-3">
                <Check className="h-6 w-6 text-green-600 flex-shrink-0 mt-0.5" />
                <span className="text-gray-700">Turbo/intercooler faults</span>
              </li>
              <li className="flex items-start gap-3">
                <Check className="h-6 w-6 text-green-600 flex-shrink-0 mt-0.5" />
                <span className="text-gray-700">Gearbox and transmission issues</span>
              </li>
            </ul>

            <p className="text-lg font-semibold text-primary text-center">
              Repairs can cost £1,500 to £9,000+, depending on the model.
            </p>
          </div>
        </div>
      </section>

      {/* FAQs */}
      <section className="py-16 bg-gradient-to-br from-blue-50 via-white to-orange-50">
        <div className="max-w-4xl mx-auto px-4 sm:px-6 lg:px-8">
          <h2 className="text-3xl md:text-4xl font-bold text-center mb-12">
            Frequently Asked Questions
          </h2>

          <div className="space-y-4">
            {bmwFAQs.map((faq, index) => (
              <div key={index} className="bg-gradient-to-r from-orange-500 to-orange-600 rounded-lg shadow-lg overflow-hidden">
                <button
                  onClick={() => toggleFaq(index)}
                  className="w-full px-6 py-5 text-left flex items-center justify-between hover:bg-orange-600/20 transition-colors"
                >
                  <span className="font-semibold text-lg text-white pr-4">
                    {faq.question}
                  </span>
                  {openFaqId === index ? (
                    <ChevronUp className="h-6 w-6 text-white flex-shrink-0" />
                  ) : (
                    <ChevronDown className="h-6 w-6 text-white flex-shrink-0" />
                  )}
                </button>
                {openFaqId === index && (
                  <div className="px-6 py-5 bg-white">
                    <p className="text-gray-700 leading-relaxed">{faq.answer}</p>
                  </div>
                )}
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* Final CTA */}
      <section className="py-16 bg-primary text-white">
        <div className="max-w-4xl mx-auto px-4 sm:px-6 lg:px-8 text-center">
          <h2 className="text-3xl md:text-4xl font-bold mb-6 text-white">
            Before You Leave - Secure Your BMW's Protection
          </h2>
          <div className="flex justify-center mb-6">
            <a 
              href="https://uk.trustpilot.com/review/buyawarranty.co.uk" 
              target="_blank" 
              rel="noopener noreferrer"
              className="transition-opacity hover:opacity-80"
            >
              <img 
                src={trustpilotLogo} 
                alt="Trustpilot 5 stars" 
                className="h-auto w-32 object-contain"
              />
            </a>
          </div>
          <p className="text-xl mb-8 text-white">
            Average repairs on BMWs can exceed £1,500+. A warranty gives you financial peace of mind, fast claims handling, and flexible monthly cover.
          </p>
          <p className="text-lg mb-8 text-white">
            Just enter your reg and mileage.
          </p>
          <Button 
            size="lg" 
            onClick={navigateToQuoteForm}
            className="bg-white text-primary hover:bg-gray-100"
          >
            Get my BMW warranty quote <ArrowRight className="ml-2 h-5 w-5" />
          </Button>
        </div>
      </section>
    </>
  );
};

export default BMWWarranty;
