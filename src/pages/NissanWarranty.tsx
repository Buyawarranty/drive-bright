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
import WebsiteFooter from '@/components/WebsiteFooter';
import { useIsMobile } from '@/hooks/use-mobile';
import { trackButtonClick } from '@/utils/analytics';
import trustpilotLogo from '@/assets/trustpilot-excellent-box.webp';
import whatsappIconNew from '@/assets/whatsapp-icon-new.png';
import nissanQashqaiImage from '@/assets/nissan-qashqai-warranty-cover.png';
import nissanJukeImage from '@/assets/nissan-juke-extended-warranty.png';

const NissanWarranty = () => {
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
    trackButtonClick('nissan_warranty_get_quote_cta');
    navigate('/');
    setTimeout(() => {
      const element = document.getElementById('quote-form');
      if (element) {
        element.scrollIntoView({ behavior: 'smooth' });
      }
    }, 100);
  };

  const nissanFAQs = [
    {
      question: "How much is an extended warranty on a Nissan?",
      answer: "Most drivers pay £320 to £980 per year. The price depends on the model, age, mileage and the level of plan selected."
    },
    {
      question: "What is included in the extended warranty?",
      answer: "Major mechanical and electrical components, including the engine, gearbox, cooling system, steering, suspension, fuel systems, electrics and multimedia units. Full details can be found on our coverage page."
    },
    {
      question: "Is it worth buying extended cover for a Nissan?",
      answer: "Yes. Nissan often faces issues with CVT transmissions, turbos, injectors and electrical modules. A single failure can cost more than the yearly warranty itself."
    },
    {
      question: "Can I buy extended cover after buying my Nissan?",
      answer: "Yes. You can start coverage at any time, even for used and privately purchased cars, as long as they meet eligibility criteria."
    },
    {
      question: "Do you cover electric Nissan models such as the Leaf?",
      answer: "Yes. We cover electric vehicles, including motors, inverters and key electronic systems. Battery warranty remains with the manufacturer."
    },
    {
      question: "Can I use a local garage for repairs?",
      answer: "Yes. You can visit any VAT-registered garage for authorised repairs. You are not tied to a Nissan main dealer."
    }
  ];

  return (
    <>
      <SEOHead
        title="Nissan Extended Warranty | Cover for Used and New Nissans"
        description="Protect your Nissan from costly repairs with comprehensive extended warranty cover. Includes engine, gearbox, electrics and more. Get an instant online quote today."
        keywords="nissan extended warranty, nissan warranty UK, used nissan warranty, nissan qashqai warranty, nissan juke warranty, nissan leaf warranty, nissan micra warranty, nissan x trail warranty"
        canonical="https://buyawarranty.co.uk/car-extended-warranty/nissan/"
      />
      
      <OrganizationSchema type="InsuranceAgency" />
      
      <WebPageSchema
        name="Nissan Extended Warranty - Buy A Warranty"
        description="Protect your Nissan from costly repairs with comprehensive extended warranty cover. Includes engine, gearbox, electrics and more. Get an instant online quote today."
        url="https://buyawarranty.co.uk/car-extended-warranty/nissan/"
        lastReviewed={new Date().toISOString()}
        specialty="Nissan Extended Warranty, Nissan Car Warranty, Used Nissan Warranty"
      />
      
      <ProductSchema
        name="Nissan Extended Warranty"
        description="Comprehensive extended warranty coverage for Nissan vehicles including engine, gearbox, electrical systems, CVT transmission, hybrid and EV components."
        price="350.00"
        brand="Buy A Warranty"
        category="Car Insurance & Warranty"
        image="https://buyawarranty.co.uk/lovable-uploads/53652a24-3961-4346-bf9d-6588ef727aeb.png"
        availability="https://schema.org/InStock"
        areaServed="United Kingdom"
      />
      
      <FAQSchema faqs={nissanFAQs} />
      
      <BreadcrumbSchema
        items={[
          { name: "Home", url: "https://buyawarranty.co.uk/" },
          { name: "Car Extended Warranty", url: "https://buyawarranty.co.uk/car-extended-warranty/" },
          { name: "Nissan Warranty", url: "https://buyawarranty.co.uk/car-extended-warranty/nissan/" }
        ]}
      />

      {/* Header */}
      <header className="bg-white shadow-sm py-1 sm:py-2 sticky top-0 z-50">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="flex items-center justify-between">
            <div className="flex items-center">
              <Link to="/" className="hover:opacity-80 transition-opacity">
                <img src="/lovable-uploads/53652a24-3961-4346-bf9d-6588ef727aeb.png" alt="Buy a Warranty Logo - Affordable Car Warranty UK" className="h-6 sm:h-8 w-auto" />
              </Link>
            </div>
            
            <nav className="hidden lg:flex items-center space-x-4 xl:space-x-6">
              <Link to="/what-is-covered/" className="relative text-gray-700 hover:text-gray-900 font-medium text-sm xl:text-base after:content-[''] after:absolute after:w-full after:scale-x-0 after:h-0.5 after:bottom-0 after:left-0 after:bg-orange-500 after:origin-bottom-right after:transition-transform after:duration-300 hover:after:scale-x-100 hover:after:origin-bottom-left">What's Covered</Link>
              <Link to="/make-a-claim/" className="relative text-gray-700 hover:text-gray-900 font-medium text-sm xl:text-base after:content-[''] after:absolute after:w-full after:scale-x-0 after:h-0.5 after:bottom-0 after:left-0 after:bg-orange-500 after:origin-bottom-right after:transition-transform after:duration-300 hover:after:scale-x-100 hover:after:origin-bottom-left">Make a Claim</Link>
              <Link to="/faq/" className="relative text-gray-700 hover:text-gray-900 font-medium text-sm xl:text-base after:content-[''] after:absolute after:w-full after:scale-x-0 after:h-0.5 after:bottom-0 after:left-0 after:bg-orange-500 after:origin-bottom-right after:transition-transform after:duration-300 hover:after:scale-x-100 hover:after:origin-bottom-left">FAQs</Link>
              <Link to="/contact-us/" className="relative text-gray-700 hover:text-gray-900 font-medium text-sm xl:text-base after:content-[''] after:absolute after:w-full after:scale-x-0 after:h-0.5 after:bottom-0 after:left-0 after:bg-orange-500 after:origin-bottom-right after:transition-transform after:duration-300 hover:after:scale-x-100 hover:after:origin-bottom-left">Contact Us</Link>
            </nav>

            <div className="hidden lg:flex items-center space-x-3">
              <a href="https://wa.me/message/SPQPJ6O3UBF5B1" target="_blank" rel="noopener noreferrer">
                <Button 
                  variant="outline" 
                  size="sm"
                  className="bg-[#00B67A] text-white border-[#00B67A] hover:bg-[#008C5A] hover:border-[#008C5A] px-3 text-sm"
                >
                  WhatsApp Us
                </Button>
              </a>
              <Button 
                size="sm"
                onClick={navigateToQuoteForm}
                className="bg-primary text-white hover:bg-primary/90 px-3 text-sm"
              >
                Get my quote
              </Button>
            </div>

            <Sheet open={isMobileMenuOpen} onOpenChange={setIsMobileMenuOpen}>
              <SheetTrigger asChild>
                <Button variant="ghost" size="lg" className="lg:hidden p-3 min-w-[48px] min-h-[48px]">
                  <Menu className="h-8 w-8" />
                </Button>
              </SheetTrigger>
              <SheetContent side="right" className="w-[300px] sm:w-[400px]">
                <nav className="flex flex-col space-y-6 mt-8">
                  <Link 
                    to="/what-is-covered/" 
                    className="text-gray-700 hover:text-primary text-xl font-medium"
                    onClick={() => setIsMobileMenuOpen(false)}
                  >
                    What's Covered
                  </Link>
                  <Link 
                    to="/make-a-claim/" 
                    className="text-gray-700 hover:text-primary text-xl font-medium"
                    onClick={() => setIsMobileMenuOpen(false)}
                  >
                    Make a Claim
                  </Link>
                  <Link 
                    to="/faq/" 
                    className="text-gray-700 hover:text-primary text-xl font-medium"
                    onClick={() => setIsMobileMenuOpen(false)}
                  >
                    FAQs
                  </Link>
                  <Link 
                    to="/contact-us/" 
                    className="text-gray-700 hover:text-primary text-xl font-medium"
                    onClick={() => setIsMobileMenuOpen(false)}
                  >
                    Contact Us
                  </Link>
                  <div className="pt-4 space-y-3">
                    <a href="https://wa.me/message/SPQPJ6O3UBF5B1" target="_blank" rel="noopener noreferrer">
                      <Button 
                        className="w-full bg-[#00B67A] text-white border-[#00B67A] hover:bg-[#008C5A]"
                        onClick={() => setIsMobileMenuOpen(false)}
                      >
                        WhatsApp Us
                      </Button>
                    </a>
                    <Button 
                      className="w-full bg-primary text-white hover:bg-primary/90"
                      onClick={() => {
                        setIsMobileMenuOpen(false);
                        navigateToQuoteForm();
                      }}
                    >
                      Get my quote
                    </Button>
                  </div>
                </nav>
              </SheetContent>
            </Sheet>
          </div>
        </div>
      </header>

      <TrustpilotHeader />

      {/* Main content */}
      <main className="bg-gradient-to-b from-white to-gray-50">
        {/* Hero Section */}
        <section className="py-8 sm:py-12 md:py-16">
          <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
            <div className="text-center mb-8 sm:mb-12">
              <h1 className="text-3xl sm:text-4xl md:text-5xl lg:text-6xl font-bold mb-4 sm:mb-6 text-gray-900">
                Nissan Extended Warranty
              </h1>
              <p className="text-base sm:text-lg md:text-xl text-gray-600 max-w-4xl mx-auto leading-relaxed">
                Protect your Nissan from rising repair costs with cover that works across the UK. Modern Nissans use advanced engines, sensors, electric modules and CVT gearboxes that can be expensive to repair. Our Nissan extended warranty gives you reliable protection whether you drive a Juke, Qashqai, Micra, X Trail or Leaf.
              </p>
              <p className="text-base sm:text-lg text-gray-600 max-w-4xl mx-auto mt-4 leading-relaxed">
                We are also one of the only warranty providers offering high mileage cover up to 150,000 miles. This makes our plans ideal for older and used Nissan vehicles.
              </p>
            </div>

            <div className="flex justify-center mb-8">
              <Button 
                size="lg"
                onClick={navigateToQuoteForm}
                className="bg-primary hover:bg-primary/90 text-white px-8 py-6 text-lg rounded-lg shadow-lg hover:shadow-xl transition-all"
              >
                Get Your Nissan Warranty Quote
              </Button>
            </div>

            <div className="flex justify-center">
              <img 
                src={nissanQashqaiImage}
                alt="Nissan Qashqai covered by extended warranty - comprehensive protection for engine, gearbox and electronics"
                className="w-full max-w-md object-contain"
                loading="eager"
              />
            </div>
          </div>
        </section>

        {/* What's Covered Section */}
        <section className="py-12 sm:py-16 bg-white">
          <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
            <h2 className="text-3xl md:text-4xl font-bold text-center mb-8 sm:mb-12 text-gray-900">
              What Our Nissan Car Extended Warranty Covers
            </h2>
            <p className="text-lg text-gray-600 max-w-4xl mx-auto text-center mb-8">
              A comprehensive warranty plan that pays for parts, labour and diagnostics whenever a covered component fails. It keeps repair costs predictable and gives you the freedom to use any VAT-registered garage across the UK.
            </p>
            
            <div className="grid md:grid-cols-2 gap-6 max-w-4xl mx-auto">
              <div className="flex items-start space-x-3 p-4 rounded-lg bg-gray-50">
                <CheckCircle2 className="h-6 w-6 text-[#00B67A] flex-shrink-0 mt-1" />
                <div>
                  <h3 className="font-semibold text-gray-900 mb-1">Engine and cooling system</h3>
                </div>
              </div>
              <div className="flex items-start space-x-3 p-4 rounded-lg bg-gray-50">
                <CheckCircle2 className="h-6 w-6 text-[#00B67A] flex-shrink-0 mt-1" />
                <div>
                  <h3 className="font-semibold text-gray-900 mb-1">Gearbox and drivetrain</h3>
                </div>
              </div>
              <div className="flex items-start space-x-3 p-4 rounded-lg bg-gray-50">
                <CheckCircle2 className="h-6 w-6 text-[#00B67A] flex-shrink-0 mt-1" />
                <div>
                  <h3 className="font-semibold text-gray-900 mb-1">Electrical control modules and sensors</h3>
                </div>
              </div>
              <div className="flex items-start space-x-3 p-4 rounded-lg bg-gray-50">
                <CheckCircle2 className="h-6 w-6 text-[#00B67A] flex-shrink-0 mt-1" />
                <div>
                  <h3 className="font-semibold text-gray-900 mb-1">Steering, suspension and braking systems</h3>
                </div>
              </div>
              <div className="flex items-start space-x-3 p-4 rounded-lg bg-gray-50">
                <CheckCircle2 className="h-6 w-6 text-[#00B67A] flex-shrink-0 mt-1" />
                <div>
                  <h3 className="font-semibold text-gray-900 mb-1">Air conditioning and multimedia units</h3>
                </div>
              </div>
            </div>

            <div className="text-center mt-8">
              <Link to="/what-is-covered/" className="text-primary hover:text-primary/80 font-semibold">
                View full coverage details →
              </Link>
            </div>
          </div>
        </section>

        {/* Why Choose Section */}
        <section className="py-12 sm:py-16 bg-gray-50">
          <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
            <h2 className="text-3xl md:text-4xl font-bold text-center mb-8 sm:mb-12 text-gray-900">
              Why Nissan Owners Buy Extended Warranty
            </h2>
            <div className="max-w-4xl mx-auto">
              <p className="text-lg text-gray-600 mb-6 leading-relaxed">
                Nissan models are well built, but common issues affect many petrol, diesel and electric models, including turbo failure, CVT gearbox faults, battery management system issues, injectors and electronic control modules. These repairs can range from £600 to over £2,600, depending on the model. A warranty protects you from sudden costs and keeps your Nissan on the road.
              </p>
              
              <div className="flex justify-center mt-8">
                <img 
                  src={nissanJukeImage}
                  alt="Nissan Juke extended warranty coverage - protect against CVT gearbox and turbo failures"
                  className="w-full max-w-sm object-contain"
                  loading="lazy"
                />
              </div>
            </div>
          </div>
        </section>

        {/* Models Covered Section */}
        <section className="py-12 sm:py-16 bg-white">
          <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
            <h2 className="text-3xl md:text-4xl font-bold text-center mb-8 sm:mb-12 text-gray-900">
              Nissan Models We Cover
            </h2>
            <p className="text-lg text-gray-600 max-w-4xl mx-auto text-center mb-8">
              Below is a helpful table showing common Nissan vehicles covered across our plans.
            </p>
            
            <div className="overflow-x-auto">
              <table className="w-full max-w-5xl mx-auto border-collapse bg-white shadow-lg rounded-lg overflow-hidden">
                <thead>
                  <tr className="bg-primary text-white">
                    <th className="py-4 px-6 text-left font-semibold">Nissan Model</th>
                    <th className="py-4 px-6 text-left font-semibold">Fuel Types Supported</th>
                    <th className="py-4 px-6 text-left font-semibold">Age Range Covered</th>
                  </tr>
                </thead>
                <tbody>
                  {[
                    { model: 'Nissan Qashqai', fuel: 'Petrol, Diesel, Hybrid', age: '3 to 12 years' },
                    { model: 'Nissan Juke', fuel: 'Petrol, Diesel', age: '3 to 12 years' },
                    { model: 'Nissan Leaf', fuel: 'Electric', age: '3 to 10 years' },
                    { model: 'Nissan Micra', fuel: 'Petrol', age: '3 to 12 years' },
                    { model: 'Nissan X Trail', fuel: 'Petrol, Diesel, Hybrid', age: '3 to 12 years' },
                    { model: 'Nissan Navara', fuel: 'Diesel', age: '3 to 12 years' },
                    { model: 'Nissan Note', fuel: 'Petrol, Diesel', age: '3 to 12 years' }
                  ].map((item, index) => (
                    <tr key={index} className={index % 2 === 0 ? 'bg-gray-50' : 'bg-white'}>
                      <td className="py-4 px-6 border-t border-gray-200">{item.model}</td>
                      <td className="py-4 px-6 border-t border-gray-200">{item.fuel}</td>
                      <td className="py-4 px-6 border-t border-gray-200">{item.age}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        </section>

        {/* Repair Costs Section */}
        <section className="py-12 sm:py-16 bg-gray-50">
          <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
            <h2 className="text-3xl md:text-4xl font-bold text-center mb-8 sm:mb-12 text-gray-900">
              Nissan Repair Costs Every Owner Should Know
            </h2>
            <p className="text-lg text-gray-600 max-w-4xl mx-auto text-center mb-8">
              One of the biggest reasons drivers choose warranty cover is the increasing cost of modern Nissan repairs. Below is a quick look at typical component averages.
            </p>
            
            <div className="overflow-x-auto">
              <table className="w-full max-w-4xl mx-auto border-collapse bg-white shadow-lg rounded-lg overflow-hidden">
                <thead>
                  <tr className="bg-primary text-white">
                    <th className="py-4 px-6 text-left font-semibold">Component</th>
                    <th className="py-4 px-6 text-left font-semibold">Avg Repair Cost</th>
                  </tr>
                </thead>
                <tbody>
                  {[
                    { component: 'CVT Gearbox', cost: '£1,600 to £2,700' },
                    { component: 'Turbocharger', cost: '£700 to £1,300' },
                    { component: 'Engine Control Module', cost: '£350 to £900' },
                    { component: 'Suspension Components', cost: '£220 to £400' },
                    { component: 'Fuel System Repairs', cost: '£250 to £500' },
                    { component: 'High Voltage EV Components', cost: '£600 to £1,600' }
                  ].map((item, index) => (
                    <tr key={index} className={index % 2 === 0 ? 'bg-gray-50' : 'bg-white'}>
                      <td className="py-4 px-6 border-t border-gray-200">{item.component}</td>
                      <td className="py-4 px-6 border-t border-gray-200 font-semibold text-primary">{item.cost}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>

            <p className="text-center text-gray-600 mt-6 max-w-3xl mx-auto">
              These costs vary by model, age and mileage. A single repair can exceed the price of an entire year of warranty cover.
            </p>
          </div>
        </section>

        {/* Pricing Section */}
        <section className="py-12 sm:py-16 bg-white">
          <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
            <h2 className="text-3xl md:text-4xl font-bold text-center mb-8 text-gray-900">
              How Much Does a Nissan Warranty Cost?
            </h2>
            <p className="text-lg text-gray-600 max-w-4xl mx-auto text-center mb-8">
              Costs vary by model, mileage and level of cover. Most Nissan drivers pay between £320 and £980 per year. Larger SUVs like the X Trail and performance models can be higher due to parts cost. You can choose your own VAT-registered garage for repairs.
            </p>
          </div>
        </section>

        {/* FAQs Section */}
        <section className="py-12 sm:py-16 bg-[#E8F5E9]">
          <div className="max-w-4xl mx-auto px-4 sm:px-6 lg:px-8">
            <h2 className="text-3xl md:text-4xl font-bold text-center mb-8 sm:mb-12 text-gray-900">
              FAQs
            </h2>
            <div className="space-y-6">
              {nissanFAQs.map((faq, index) => (
                <div key={index} className="bg-white rounded-lg p-6 shadow-sm">
                  <h3 className="text-xl font-semibold text-gray-900 mb-3">{faq.question}</h3>
                  <p className="text-gray-600 leading-relaxed">{faq.answer}</p>
                </div>
              ))}
            </div>
          </div>
        </section>

        {/* Final CTA Section */}
        <section className="py-12 sm:py-16 bg-gradient-to-r from-primary to-primary/90 text-white">
          <div className="max-w-4xl mx-auto px-4 sm:px-6 lg:px-8 text-center">
            <h2 className="text-3xl md:text-4xl font-bold mb-6">
              Get Your Nissan Warranty Quote
            </h2>
            <p className="text-xl mb-8 leading-relaxed">
              Keep your Nissan running smoothly without surprise repair costs. Activate protection online in minutes and get a clear, upfront price based on your model and mileage. No calls. No hassle. Just a simple cover that works when you need it.
            </p>
            <Button 
              size="lg"
              onClick={navigateToQuoteForm}
              className="bg-white text-primary hover:bg-gray-100 px-8 py-6 text-lg rounded-lg shadow-lg hover:shadow-xl transition-all"
            >
              Get my Nissan warranty quote →
            </Button>
          </div>
        </section>
      </main>

      <NewFooter />
      <WebsiteFooter />

      {/* Floating WhatsApp Button - Mobile Only */}
      {isMobile && (
        <a
          href="https://wa.me/message/SPQPJ6O3UBF5B1"
          target="_blank"
          rel="noopener noreferrer"
          className="fixed bottom-20 right-4 z-40 bg-[#25D366] rounded-full p-3 shadow-lg hover:shadow-xl transition-all hover:scale-110"
          aria-label="Contact us on WhatsApp"
        >
          <img src={whatsappIconNew} alt="WhatsApp" className="w-10 h-10" />
        </a>
      )}

      {/* Floating Phone Button - Mobile Only */}
      {isMobile && (
        <a
          href="tel:03302295040"
          className="fixed bottom-20 left-4 z-40 bg-primary rounded-full p-3 shadow-lg hover:shadow-xl transition-all hover:scale-110"
          aria-label="Call us on 0330 229 5040"
        >
          <Phone className="w-10 h-10 text-white" />
        </a>
      )}

      {/* Scroll to Top Button */}
      {showScrollTop && (
        <button
          onClick={scrollToTop}
          className="fixed bottom-4 right-4 z-40 bg-primary text-white p-3 rounded-full shadow-lg hover:shadow-xl transition-all hover:scale-110"
          aria-label="Scroll to top"
        >
          <svg
            className="w-6 h-6"
            fill="none"
            stroke="currentColor"
            viewBox="0 0 24 24"
          >
            <path
              strokeLinecap="round"
              strokeLinejoin="round"
              strokeWidth={2}
              d="M5 10l7-7m0 0l7 7m-7-7v18"
            />
          </svg>
        </button>
      )}
    </>
  );
};

export default NissanWarranty;
