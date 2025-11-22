import { useState, useEffect } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { Button } from '@/components/ui/button';
import { CheckCircle2, Shield, Clock, Phone, Menu, X } from 'lucide-react';
import { Sheet, SheetContent, SheetTrigger } from '@/components/ui/sheet';
import { SEOHead } from '@/components/SEOHead';
import { OrganizationSchema } from '@/components/schema/OrganizationSchema';
import { WebPageSchema } from '@/components/schema/WebPageSchema';
import { ProductSchema } from '@/components/schema/ProductSchema';
import { FAQSchema } from '@/components/schema/FAQSchema';
import { BreadcrumbSchema } from '@/components/schema/BreadcrumbSchema';
import TrustpilotHeader from '@/components/TrustpilotHeader';
import NewFooter from '@/components/NewFooter';
import { useIsMobile } from '@/hooks/use-mobile';
import { trackButtonClick } from '@/utils/analytics';
import fordFocusImage from '@/assets/ford-focus-transparent.png';
import fordPumaImage from '@/assets/ford-puma-transparent.png';

const FordWarranty = () => {
  const navigate = useNavigate();
  const isMobile = useIsMobile();
  const [showScrollTop, setShowScrollTop] = useState(false);
  const [isMobileMenuOpen, setIsMobileMenuOpen] = useState(false);

  useEffect(() => {
    const handleScroll = () => {
      setShowScrollTop(window.scrollY > 400);
    };
    window.addEventListener('scroll', handleScroll);
    return () => window.removeEventListener('scroll', handleScroll);
  }, []);

  const scrollToTop = () => {
    window.scrollTo({ top: 0, behavior: 'smooth' });
  };

  const navigateToQuoteForm = () => {
    trackButtonClick('ford_warranty_get_quote_cta');
    navigate('/');
    setTimeout(() => {
      const element = document.getElementById('quote-form');
      if (element) {
        element.scrollIntoView({ behavior: 'smooth' });
      }
    }, 100);
  };

  const fordFAQs = [
    {
      question: "How much does a Ford extended warranty cost?",
      answer: "Most drivers pay £320-£980 per year, depending on the model, mileage and plan level. Performance models and vans like the Ford Ranger and Transit can be higher due to repair costs."
    },
    {
      question: "Is a Ford extended warranty worth it?",
      answer: "Yes - Ford models commonly face issues with turbos, injectors, DPFs and electrical modules. One major repair can cost more than an entire year of warranty coverage."
    },
    {
      question: "Can I buy an extended warranty after purchase?",
      answer: "Yes. You can start covering anytime, even for used cars or if your Ford came from a private seller."
    },
    {
      question: "Does the extended warranty cover electrical issues?",
      answer: "Yes. ECUs, sensors, multimedia systems and electrics are covered in our comprehensive plan."
    },
    {
      question: "Which Ford models benefit most from an extended warranty?",
      answer: "Fiesta, Focus, Puma, Kuga and Transit vans see the highest number of repairs due to turbos, injectors and electrical modules."
    }
  ];

  return (
    <>
      <SEOHead
        title="Ford Car Extended Warranty | New, Used & High-Mileage Cover"
        description="Used Ford extended warranty with nationwide approved repairs. Covers major components and diagnostics. Get a quick online quote and drive with confidence."
        keywords="ford extended warranty, ford warranty UK, used ford warranty, ford fiesta warranty, ford focus warranty, ford puma warranty, ford kuga warranty, ford transit warranty"
        canonical="https://buyawarranty.co.uk/car-extended-warranty/ford/"
      />
      
      <OrganizationSchema type="InsuranceAgency" />
      
      <WebPageSchema
        name="Ford Extended Warranty - Buy A Warranty"
        description="Used Ford extended warranty with nationwide approved repairs. Covers major components and diagnostics. Get a quick online quote and drive with confidence."
        url="https://buyawarranty.co.uk/car-extended-warranty/ford/"
        lastReviewed={new Date().toISOString()}
        significantLink="https://buyawarranty.co.uk/"
        specialty="Ford Extended Warranties"
      />
      
      <ProductSchema
        name="Ford Extended Warranty"
        description="Comprehensive extended warranty coverage for Ford vehicles including engine, gearbox, turbo, electrical systems, ECU, and fuel injection systems."
        price="550.00"
        brand="Buy A Warranty"
        category="Car Insurance & Warranty"
        image="https://buyawarranty.co.uk/lovable-uploads/53652a24-3961-4346-bf9d-6588ef727aeb.png"
        availability="https://schema.org/InStock"
        areaServed="United Kingdom"
      />
      
      <FAQSchema faqs={fordFAQs} />
      
      <BreadcrumbSchema
        items={[
          { name: "Home", url: "https://buyawarranty.co.uk/" },
          { name: "Car Extended Warranty", url: "https://buyawarranty.co.uk/car-extended-warranty/" },
          { name: "Ford Warranty", url: "https://buyawarranty.co.uk/car-extended-warranty/ford/" }
        ]}
      />

      <div className="min-h-screen bg-gradient-to-b from-background to-muted/20">
      {/* Hero Section */}
      <section className="container mx-auto px-4 pt-6 md:pt-8 pb-12 md:pb-16">
        <div className="grid lg:grid-cols-2 gap-6 lg:gap-10 items-center">
          <div className="space-y-6 text-center lg:text-left">
            <h1 className="text-4xl md:text-5xl lg:text-6xl font-bold tracking-tight">
              Ford Extended Warranty
            </h1>
            <p className="text-lg md:text-xl text-muted-foreground max-w-2xl mx-auto lg:mx-0">
              Protect your Ford from expensive repair bills once the original manufacturer's warranty ends. Modern Fords feature turbocharged engines, ECUs, injectors and advanced electrical systems that are costly to repair. Our Ford car extended warranty gives you affordable protection and keeps your Ford where it belongs - on the road.
            </p>
            <p className="text-lg text-muted-foreground max-w-2xl mx-auto lg:mx-0">
              Whether you drive a Ford Fiesta, Focus, Kuga, Puma, Ranger, Transit or Mustang, we offer cover that prioritises owners, not dealerships.
            </p>
            <div className="flex flex-col sm:flex-row gap-4 justify-center lg:justify-start">
              <Button onClick={navigateToQuoteForm} size="lg" className="text-lg px-8 py-6 bg-primary hover:bg-primary/90">
                Get my Ford warranty quote →
              </Button>
            </div>
          </div>
          <div className="space-y-4">
            <div className="max-w-md mx-auto">
              <img 
                src={fordFocusImage} 
                alt="Ford Focus - extended warranty coverage available" 
                className="w-full h-auto object-contain"
                loading="eager"
              />
            </div>
            <div className="flex justify-center lg:justify-start">
              <TrustpilotHeader />
            </div>
          </div>
        </div>
      </section>

        {/* What's Covered in Ford Extended Warranty */}
        <section className="bg-card py-16">
          <div className="container mx-auto px-4">
            <div className="max-w-4xl mx-auto space-y-6">
              <h2 className="text-3xl md:text-4xl font-bold text-center">
                What's Covered in Our Ford Extended Warranty
              </h2>
              <p className="text-lg text-center text-muted-foreground">
                Our extended warranty for Ford includes protection for major mechanical and electrical components:
              </p>
              <div className="grid md:grid-cols-2 gap-4 mt-8">
                {[
                  "Engine",
                  "Gearbox (manual & automatic)",
                  "Turbo & supercharger units",
                  "Cooling and heating systems",
                  "ECU and electrical modules",
                  "Infotainment and multimedia systems",
                  "Fuel system and injectors",
                  "Air-conditioning and climate controls"
                ].map((item, index) => (
                  <div key={index} className="flex items-start gap-3">
                    <CheckCircle2 className="w-6 h-6 text-primary flex-shrink-0 mt-0.5" />
                    <span className="text-lg text-left">{item}</span>
                  </div>
                ))}
              </div>
              <p className="text-lg mt-6">
                Coverage applies to both used and new Ford warranty plans. If a covered part fails, we pay for labour, diagnostics and replacement parts up to your claim limit. For full component details, visit our <Link to="/what-is-covered/" className="text-primary hover:underline">What's Covered</Link> page.
              </p>
            </div>
          </div>
        </section>

        {/* Ford Puma Image Section */}
        <section className="container mx-auto px-4 py-8">
          <div className="max-w-2xl mx-auto -mt-4">
            <img 
              src={fordPumaImage} 
              alt="Ford Puma SUV - comprehensive warranty protection" 
              className="w-full h-auto object-contain"
              loading="lazy"
            />
          </div>
        </section>

        {/* Why Choose Our Ford Extended Warranty */}
        <section className="bg-muted/30 py-16">
          <div className="container mx-auto px-4">
            <div className="max-w-4xl mx-auto space-y-8">
              <h2 className="text-3xl md:text-4xl font-bold text-center">
                Why Choose Our Ford Car Extended Warranty?
              </h2>
              <p className="text-lg text-center text-muted-foreground">
                Unlike manufacturer programmes, you are not tied to Ford dealerships. We pay the cost of parts, labour and diagnostics directly to your chosen VAT-registered garage.
              </p>
              <div className="grid md:grid-cols-2 gap-6 mt-8">
                {[
                  "Use any VAT-registered UK garage (no forced Ford workshops)",
                  "Quick claims approval",
                  "Includes diagnostics and labour costs",
                  "Flexible claim limits up to your vehicle's value"
                ].map((item, index) => (
                  <div key={index} className="flex items-start gap-3">
                    <CheckCircle2 className="w-6 h-6 text-primary flex-shrink-0 mt-0.5" />
                    <span className="text-lg text-left">{item}</span>
                  </div>
                ))}
              </div>
              <p className="text-lg font-semibold text-primary text-center mt-6">
                👉 We are also the only warranty provider offering cover on vehicles up to 150,000 miles.
              </p>
            </div>
          </div>
        </section>

        {/* Ford Extended Warranty Cost */}
        <section className="bg-card py-16">
          <div className="container mx-auto px-4">
            <div className="max-w-4xl mx-auto space-y-8">
              <h2 className="text-3xl md:text-4xl font-bold text-center">
                Ford Extended Warranty Cost
              </h2>
              <p className="text-lg text-center text-muted-foreground">
                Ford extended warranty pricing varies by model, age, mileage and plan level. Most drivers pay between £320 and £980 per year, with commercial vans (Transit, Ranger) sitting towards the higher end due to repair costs.
              </p>
              
              <div className="bg-white p-8 rounded-lg shadow-sm mt-8">
                <h3 className="text-2xl font-bold mb-6 text-center">How Much Do Ford Repairs Cost on Average?</h3>
                <div className="overflow-x-auto">
                  <table className="w-full">
                    <thead>
                      <tr className="border-b-2 border-gray-200">
                        <th className="text-left py-3 px-4 font-semibold">Ford Component</th>
                        <th className="text-left py-3 px-4 font-semibold">Repair Cost</th>
                      </tr>
                    </thead>
                    <tbody>
                      {[
                        { component: "Engine repair / rebuild", cost: "£1,200 - £3,200+" },
                        { component: "Automatic gearbox", cost: "£1,200 - £2,500+" },
                        { component: "Turbocharger", cost: "£700 - £1,400" },
                        { component: "Air-conditioning compressor", cost: "£450 - £1,000" },
                        { component: "ECU / electrical module", cost: "£350 - £1,200" },
                        { component: "DPF replacement", cost: "£900 - £2,000" }
                      ].map((item, index) => (
                        <tr key={index} className="border-b border-gray-100">
                          <td className="py-3 px-4">{item.component}</td>
                          <td className="py-3 px-4 font-semibold text-primary">{item.cost}</td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
                <p className="text-lg font-semibold text-center mt-6 text-primary">
                  A single repair can cost more than an entire year of warranty coverage.
                </p>
              </div>
            </div>
          </div>
        </section>

        {/* Ford Models We Cover */}
        <section className="bg-muted/30 py-16">
          <div className="container mx-auto px-4">
            <div className="max-w-5xl mx-auto space-y-8">
              <h2 className="text-3xl md:text-4xl font-bold text-center">
                Ford Models We Cover in the UK
              </h2>
              <p className="text-lg text-center text-muted-foreground">
                We cover new, used and high-mileage Ford cars and vans, including:
              </p>
              
              <div className="bg-white p-8 rounded-lg shadow-sm">
                <div className="overflow-x-auto">
                  <table className="w-full">
                    <thead>
                      <tr className="border-b-2 border-gray-200">
                        <th className="text-left py-3 px-4 font-semibold">Category</th>
                        <th className="text-left py-3 px-4 font-semibold">Ford Models Covered</th>
                      </tr>
                    </thead>
                    <tbody>
                      <tr className="border-b border-gray-100">
                        <td className="py-3 px-4 font-semibold">Ford Cars (Petrol, Diesel, Hybrid)</td>
                        <td className="py-3 px-4">Fiesta, Focus, Focus ST, Puma, Kuga, Mondeo, Fusion, S-MAX, Galaxy</td>
                      </tr>
                      <tr className="border-b border-gray-100">
                        <td className="py-3 px-4 font-semibold">Ford Performance</td>
                        <td className="py-3 px-4">Mustang, Fiesta ST, Focus RS</td>
                      </tr>
                      <tr className="border-b border-gray-100">
                        <td className="py-3 px-4 font-semibold">Ford Vans / Commercial</td>
                        <td className="py-3 px-4">Transit, Transit Custom, Ranger, Tourneo</td>
                      </tr>
                    </tbody>
                  </table>
                </div>
              </div>
            </div>
          </div>
        </section>

        {/* Ford Extended Warranty Plans */}
        <section className="bg-card py-16">
          <div className="container mx-auto px-4">
            <div className="max-w-5xl mx-auto space-y-8">
              <h2 className="text-3xl md:text-4xl font-bold text-center">
                Ford Extended Warranty Plans
              </h2>
              
              <div className="bg-white p-8 rounded-lg shadow-sm">
                <div className="overflow-x-auto">
                  <table className="w-full">
                    <thead>
                      <tr className="border-b-2 border-gray-200">
                        <th className="text-left py-3 px-4 font-semibold">Plan Type</th>
                        <th className="text-left py-3 px-4 font-semibold">Ideal For</th>
                        <th className="text-left py-3 px-4 font-semibold">Highlights</th>
                      </tr>
                    </thead>
                    <tbody>
                      <tr className="border-b border-gray-100">
                        <td className="py-3 px-4 font-semibold">Comprehensive All-Component</td>
                        <td className="py-3 px-4">Cars under 8 years</td>
                        <td className="py-3 px-4">Covers almost every mechanical & electrical part</td>
                      </tr>
                      <tr className="border-b border-gray-100">
                        <td className="py-3 px-4 font-semibold">Listed Component (Essential)</td>
                        <td className="py-3 px-4">Older cars 8+ years</td>
                        <td className="py-3 px-4">Covers core systems such as engine, gearbox, and ECU</td>
                      </tr>
                      <tr className="border-b border-gray-100">
                        <td className="py-3 px-4 font-semibold">High-Mileage Plan</td>
                        <td className="py-3 px-4">Cars & vans up to 150,000 miles</td>
                        <td className="py-3 px-4">Designed for commercial vehicles and motorway users</td>
                      </tr>
                    </tbody>
                  </table>
                </div>
              </div>
            </div>
          </div>
        </section>

        {/* FAQs */}
        <section className="bg-muted/30 py-16">
          <div className="container mx-auto px-4">
            <div className="max-w-4xl mx-auto space-y-8">
              <h2 className="text-3xl md:text-4xl font-bold text-center">
                FAQs
              </h2>
              
              <div className="space-y-4">
                {fordFAQs.map((faq, index) => (
                  <div key={index} className="bg-gradient-to-r from-orange-500 to-orange-600 rounded-lg shadow-lg overflow-hidden">
                    <div className="px-6 py-5">
                      <h3 className="text-xl font-bold mb-3 text-white">{faq.question}</h3>
                      <p className="text-lg text-white leading-relaxed">{faq.answer}</p>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          </div>
        </section>

        {/* Final CTA */}
        <section className="bg-primary text-white py-16">
          <div className="container mx-auto px-4">
            <div className="max-w-4xl mx-auto text-center space-y-6">
              <h2 className="text-3xl md:text-4xl font-bold">
                👉 Protect Your Ford. Avoid Unexpected Repair Bills.
              </h2>
              <p className="text-lg md:text-xl">
                Keep your Ford on the road, not in the garage. Get instant warranty cover that takes care of unexpected breakdowns and lets you book repairs at your preferred VAT-registered garage. No phone queues. No complicated forms. Just a quick cover and peace of mind.
              </p>
              <Button 
                onClick={navigateToQuoteForm}
                size="lg" 
                className="text-lg px-8 py-6 bg-white text-primary hover:bg-gray-100"
              >
                Get my Ford warranty quote →
              </Button>
            </div>
          </div>
        </section>
      </div>

      <NewFooter />

      {/* Scroll to top button */}
      {showScrollTop && (
        <Button
          onClick={scrollToTop}
          className="fixed bottom-24 right-4 z-50 rounded-full w-12 h-12 shadow-lg"
          size="icon"
        >
          ↑
        </Button>
      )}

      {/* WhatsApp Floating Button */}
      {!isMobile && (
        <a
          href="https://wa.me/message/SPQPJ6O3UBF5B1"
          target="_blank"
          rel="noopener noreferrer"
          className="fixed bottom-4 right-4 z-50 bg-[#25D366] hover:bg-[#1da851] text-white rounded-full p-3 shadow-lg transition-all duration-300 hover:scale-110 flex items-center justify-center"
          aria-label="Contact us on WhatsApp"
        >
          <svg viewBox="0 0 24 24" className="w-8 h-8" fill="currentColor">
            <path d="M17.472 14.382c-.297-.149-1.758-.867-2.03-.967-.273-.099-.471-.148-.67.15-.197.297-.767.966-.94 1.164-.173.199-.347.223-.644.075-.297-.15-1.255-.463-2.39-1.475-.883-.788-1.48-1.761-1.653-2.059-.173-.297-.018-.458.13-.606.134-.133.298-.347.446-.52.149-.174.198-.298.298-.497.099-.198.05-.371-.025-.52-.075-.149-.669-1.612-.916-2.207-.242-.579-.487-.5-.669-.51-.173-.008-.371-.01-.57-.01-.198 0-.52.074-.792.372-.272.297-1.04 1.016-1.04 2.479 0 1.462 1.065 2.875 1.213 3.074.149.198 2.096 3.2 5.077 4.487.709.306 1.262.489 1.694.625.712.227 1.36.195 1.871.118.571-.085 1.758-.719 2.006-1.413.248-.694.248-1.289.173-1.413-.074-.124-.272-.198-.57-.347m-5.421 7.403h-.004a9.87 9.87 0 01-5.031-1.378l-.361-.214-3.741.982.998-3.648-.235-.374a9.86 9.86 0 01-1.51-5.26c.001-5.45 4.436-9.884 9.888-9.884 2.64 0 5.122 1.03 6.988 2.898a9.825 9.825 0 012.893 6.994c-.003 5.45-4.437 9.884-9.885 9.884m8.413-18.297A11.815 11.815 0 0012.05 0C5.495 0 .16 5.335.157 11.892c0 2.096.547 4.142 1.588 5.945L.057 24l6.305-1.654a11.882 11.882 0 005.683 1.448h.005c6.554 0 11.89-5.335 11.893-11.893a11.821 11.821 0 00-3.48-8.413z"/>
          </svg>
        </a>
      )}

      {/* Mobile CTA Bar */}
      {isMobile && (
        <div className="fixed bottom-0 left-0 right-0 bg-white border-t border-gray-200 p-4 z-40 shadow-lg">
          <Button 
            onClick={navigateToQuoteForm}
            className="w-full bg-primary text-white hover:bg-primary/90 text-base py-6 font-semibold"
          >
            Get My Ford Quote Now →
          </Button>
        </div>
      )}
    </>
  );
};

export default FordWarranty;
