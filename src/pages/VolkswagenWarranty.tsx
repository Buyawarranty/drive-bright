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
import vwGolfImage from '@/assets/volkswagen-golf-gti-extended-warranty-uk.png';

const VolkswagenWarranty = () => {
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
    trackButtonClick('volkswagen_warranty_get_quote_cta');
    navigate('/');
    setTimeout(() => {
      const element = document.getElementById('quote-form');
      if (element) {
        element.scrollIntoView({ behavior: 'smooth' });
      }
    }, 100);
  };

  const vwFAQs = [
    {
      question: "How much does it cost to extend a Volkswagen warranty?",
      answer: "Volkswagen extended warranty costs vary based on the model, age and mileage of your vehicle. Most drivers pay between £350 and £1,100 per year, while higher-spec models like the Tiguan, Transporter or Touareg can be more. Prices depend on claim limit, plan level and excess."
    },
    {
      question: "Is a Volkswagen extended warranty worth it?",
      answer: "Yes, especially for DSG gearboxes, timing issues, turbo failures and electrical faults, which are common on used VW models. One repair can cost £700–£2,500+, often more than the price of the warranty itself."
    },
    {
      question: "Can I buy a VW extended warranty after purchase?",
      answer: "Absolutely. You can purchase an extended warranty at any time - even if your Volkswagen was bought privately, from an auction or an independent dealer."
    },
    {
      question: "What is covered by a VW extended warranty?",
      answer: "Cover typically includes mechanical and electrical components such as the engine, gearbox, turbocharger, ECU, infotainment and electrical systems. Diagnostics, labour and parts are included when the component is covered."
    },
    {
      question: "Do extended warranties allow me to choose my own garage?",
      answer: "Yes. You are not restricted to VW dealers. You can use any VAT-registered garage in the UK, giving you flexibility and potentially lower labour rates."
    },
    {
      question: "Does a VW warranty cover electric and hybrid Volkswagen models?",
      answer: "Yes. Certain plans include cover for electric drive units, inverter systems and hybrid components. Battery packs are covered where specified in your chosen plan."
    }
  ];

  return (
    <>
      <SEOHead
        title="Volkswagen Extended Warranty | Affordable VW Car Cover UK"
        description="Protect your Volkswagen from costly repair bills with our extended warranty. Engine, gearbox, electrics and more covered. Get an instant online quote for any VW."
        keywords="volkswagen extended warranty, vw warranty UK, volkswagen warranty cost, vw golf warranty, vw tiguan warranty, vw passat warranty, vw transporter warranty"
        canonical="https://buyawarranty.co.uk/car-extended-warranty/volkswagen/"
      />
      
      <OrganizationSchema type="InsuranceAgency" />
      
      <WebPageSchema
        name="Volkswagen Extended Warranty - Buy A Warranty"
        description="Protect your Volkswagen from costly repair bills with our extended warranty. Engine, gearbox, electrics and more covered. Get an instant online quote for any VW."
        url="https://buyawarranty.co.uk/car-extended-warranty/volkswagen/"
        lastReviewed={new Date().toISOString()}
        significantLink="https://buyawarranty.co.uk/"
        specialty="Volkswagen Extended Warranties"
      />
      
      <ProductSchema
        name="Volkswagen Extended Warranty"
        description="Comprehensive extended warranty coverage for Volkswagen vehicles including engine, DSG gearbox, electrical systems, turbocharger, hybrid and EV components."
        price="350.00"
        brand="Buy A Warranty"
        category="Car Insurance & Warranty"
        image="https://buyawarranty.co.uk/lovable-uploads/53652a24-3961-4346-bf9d-6588ef727aeb.png"
        availability="https://schema.org/InStock"
        areaServed="United Kingdom"
      />
      
      <FAQSchema faqs={vwFAQs} />
      
      <BreadcrumbSchema
        items={[
          { name: "Home", url: "https://buyawarranty.co.uk/" },
          { name: "Car Extended Warranty", url: "https://buyawarranty.co.uk/car-extended-warranty/" },
          { name: "Volkswagen Warranty", url: "https://buyawarranty.co.uk/car-extended-warranty/volkswagen/" }
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
              <SheetContent side="right" className="w-[300px] sm:w-[400px] overflow-y-auto">
                <div className="flex flex-col h-full max-h-screen">
                  <div className="flex items-center justify-between pb-4 flex-shrink-0">
                    <Link to="/" className="hover:opacity-80 transition-opacity">
                      <img 
                        src="/lovable-uploads/53652a24-3961-4346-bf9d-6588ef727aeb.png" 
                        alt="Buy a Warranty Logo"
                        className="h-8 w-auto"
                      />
                    </Link>
                  </div>

                  <nav className="flex flex-col space-y-4 flex-1 overflow-y-auto pb-4">
                    <Link 
                      to="/what-is-covered/" 
                      className="text-gray-700 hover:text-gray-900 font-medium text-base py-3 border-b border-gray-200 min-h-[48px] flex items-center"
                      onClick={() => setIsMobileMenuOpen(false)}
                    >
                      What's Covered
                    </Link>
                    <Link 
                      to="/make-a-claim/" 
                      className="text-gray-700 hover:text-gray-900 font-medium text-base py-3 border-b border-gray-200 min-h-[48px] flex items-center"
                      onClick={() => setIsMobileMenuOpen(false)}
                    >
                      Make a Claim
                    </Link>
                    <Link 
                      to="/faq/" 
                      className="text-gray-700 hover:text-gray-900 font-medium text-base py-3 border-b border-gray-200 min-h-[48px] flex items-center"
                      onClick={() => setIsMobileMenuOpen(false)}
                    >
                      FAQs
                    </Link>
                    <Link 
                      to="/contact-us/" 
                      className="text-gray-700 hover:text-gray-900 font-medium text-base py-3 border-b border-gray-200 min-h-[48px] flex items-center"
                      onClick={() => setIsMobileMenuOpen(false)}
                    >
                      Contact Us
                    </Link>
                  </nav>

                  <div className="space-y-4 pt-4 mt-auto flex-shrink-0">
                    <a href="https://wa.me/message/SPQPJ6O3UBF5B1" target="_blank" rel="noopener noreferrer" className="block">
                      <Button 
                        variant="outline" 
                        className="w-full bg-[#00B67A] text-white border-[#00B67A] hover:bg-[#008C5A] hover:border-[#008C5A] text-base py-4 min-h-[48px] flex items-center justify-center gap-3"
                        onClick={() => setIsMobileMenuOpen(false)}
                      >
                        WhatsApp Us
                      </Button>
                    </a>
                    <Button 
                      className="w-full bg-primary text-white hover:bg-primary/90 text-base py-4 min-h-[48px]" 
                      onClick={() => { setIsMobileMenuOpen(false); navigateToQuoteForm(); }}
                    >
                      Get my quote
                    </Button>
                  </div>
                </div>
              </SheetContent>
            </Sheet>
          </div>
        </div>
      </header>
      
      <div className="min-h-screen bg-gradient-to-b from-background to-muted/20">
        {/* Hero Section */}
        <section className="container mx-auto px-4 py-12 md:py-20">
          <div className="grid lg:grid-cols-2 gap-8 lg:gap-12 items-center">
            <div className="space-y-6 text-center lg:text-left">
              <h1 className="text-4xl md:text-5xl lg:text-6xl font-bold tracking-tight">
                Volkswagen Extended Warranty
              </h1>
              <p className="text-xl md:text-2xl font-semibold text-primary">
                Cover for New, Used and High-Mileage VW Cars
              </p>
              <p className="text-lg md:text-xl text-muted-foreground max-w-2xl mx-auto lg:mx-0">
                A Volkswagen is built for reliability, but modern VWs are packed with advanced tech that drives repair costs up - especially DSG gearboxes, turbochargers, injectors, hybrid battery systems and electrical control modules. One fault can lead to a four-figure bill.
              </p>
              <p className="text-lg text-muted-foreground max-w-2xl mx-auto lg:mx-0">
                Our Volkswagen extended warranty protects you from unexpected mechanical and electrical repair costs once the original VW warranty ends. Labour, diagnostics and major components are covered, so your VW stays on the road without financial stress.
              </p>
              <p className="text-lg text-muted-foreground max-w-2xl mx-auto lg:mx-0">
                Whether you drive a VW Golf, Polo, Tiguan, Passat, Transporter or an ID. electric model, our plans prioritise owners over dealerships: transparent cover, fast claims and freedom to use any VAT-registered garage across the UK.
              </p>
              <div className="flex flex-col sm:flex-row gap-4 justify-center lg:justify-start">
                <Button onClick={navigateToQuoteForm} size="lg" className="text-lg px-8 py-6 bg-primary hover:bg-primary/90">
                  Get my Volkswagen warranty quote →
                </Button>
              </div>
            </div>
            <div className="space-y-6">
              <div className="bg-white/50 backdrop-blur-sm rounded-2xl p-6 shadow-lg">
                <img 
                  src={vwGolfImage} 
                  alt="Volkswagen Golf GTI extended warranty UK - buyawarranty coverage for VW vehicles" 
                  className="w-full max-w-md mx-auto h-auto object-contain"
                  loading="eager"
                />
              </div>
              <div className="flex justify-center lg:justify-start">
                <TrustpilotHeader />
              </div>
            </div>
          </div>
        </section>

        {/* Volkswagen Extended Warranty Cost Section */}
        <section className="bg-card py-16">
          <div className="container mx-auto px-4">
            <div className="max-w-4xl mx-auto space-y-6">
              <h2 className="text-3xl md:text-4xl font-bold text-center">
                Volkswagen Extended Warranty Cost
              </h2>
              <p className="text-lg text-muted-foreground text-center">
                Volkswagen extended warranty pricing varies depending on model, mileage and the level of cover you choose. Most drivers pay between £350 and £1,100 per year, although larger models such as the Tiguan, Transporter and Touareg may sit at the higher end due to higher parts and labour costs. You are not restricted to Volkswagen franchised workshops - you can use any VAT-registered garage of your choice.
              </p>
            </div>
          </div>
        </section>

        {/* Why VW Owners Choose Section */}
        <section className="bg-muted/30 py-16">
          <div className="container mx-auto px-4">
            <div className="max-w-4xl mx-auto text-center space-y-6">
              <h2 className="text-3xl md:text-4xl font-bold">
                Why VW Owners Choose Our Extended Warranty
              </h2>
              <div className="grid md:grid-cols-2 gap-6 mt-8">
                {[
                  "Covers mechanical and electrical faults",
                  "Diagnostics, labour and parts included",
                  "No long claim forms - we deal directly with the garage",
                  "Choose any VAT-registered garage in the UK",
                  "Covers petrol, diesel, hybrid and full-electric Volkswagen models"
                ].map((item, index) => (
                  <div key={index} className="flex items-start gap-3">
                    <CheckCircle2 className="w-6 h-6 text-primary flex-shrink-0 mt-0.5" />
                    <span className="text-lg text-left">{item}</span>
                  </div>
                ))}
              </div>
              <p className="text-lg font-semibold text-primary mt-6">
                👉 We are the only warranty provider offering mileage cover up to 150,000 miles on selected plans.
              </p>
            </div>
          </div>
        </section>

        {/* What's Covered */}
        <section className="bg-card py-16">
          <div className="container mx-auto px-4">
            <div className="max-w-4xl mx-auto space-y-8">
              <h2 className="text-3xl md:text-4xl font-bold text-center">
                What Our Volkswagen Extended Warranty Covers
              </h2>
              <p className="text-lg text-center text-muted-foreground">
                A clear alternative to restrictive named-component cover.
              </p>
              <div className="bg-white p-8 rounded-lg shadow-sm">
                <div className="overflow-x-auto">
                  <table className="w-full">
                    <thead>
                      <tr className="border-b">
                        <th className="text-left py-3 px-4">System / Component Group</th>
                        <th className="text-center py-3 px-4">Covered</th>
                      </tr>
                    </thead>
                    <tbody>
                      {[
                        "Engine and turbocharger",
                        "Automatic / DSG gearbox",
                        "Electrical and electronic parts",
                        "Multimedia/navigation systems",
                        "Fuel and injection systems",
                        "Steering and braking",
                        "Cooling and air conditioning",
                        "Hybrid and EV drive components",
                        "Diagnostics and labour"
                      ].map((item, index) => (
                        <tr key={index} className="border-b">
                          <td className="py-3 px-4">{item}</td>
                          <td className="text-center py-3 px-4">
                            <CheckCircle2 className="w-6 h-6 text-primary inline-block" />
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
                <p className="text-lg mt-6">
                  If a covered part fails, we pay for parts, labour and diagnostics up to your claim limit. For a detailed list of what's included, please visit our <Link to="/what-is-covered" className="text-primary hover:underline font-semibold">What's Covered</Link> page.
                </p>
              </div>
            </div>
          </div>
        </section>

        {/* VW Models We Cover */}
        <section className="bg-muted/30 py-16">
          <div className="container mx-auto px-4">
            <div className="max-w-5xl mx-auto space-y-8">
              <h2 className="text-3xl md:text-4xl font-bold text-center">
                VW Models We Cover in the UK
              </h2>
              <div className="bg-card p-8 rounded-lg">
                <div className="overflow-x-auto">
                  <table className="w-full">
                    <thead>
                      <tr className="border-b-2 border-gray-200">
                        <th className="text-left py-3 px-4 font-bold">Hatchback & Compact</th>
                        <th className="text-left py-3 px-4 font-bold">Saloon & Estate</th>
                        <th className="text-left py-3 px-4 font-bold">SUV / MPV</th>
                        <th className="text-left py-3 px-4 font-bold">Van / Commercial</th>
                      </tr>
                    </thead>
                    <tbody>
                      {[
                        { col1: "Polo", col2: "Passat", col3: "T-Cross", col4: "Transporter T6" },
                        { col1: "Golf / Golf GTI / R", col2: "Arteon", col3: "T-Roc", col4: "Caddy Range" },
                        { col1: "ID.3 (electric)", col2: "Jetta (imported)", col3: "Tiguan", col4: "Crafter" },
                        { col1: "Up!", col2: "", col3: "Touareg", col4: "Caravelle / California" },
                        { col1: "Beetle", col2: "", col3: "Touran", col4: "Multivan" },
                        { col1: "Scirocco", col2: "", col3: "ID.4 / ID.5 EV", col4: "" }
                      ].map((row, index) => (
                        <tr key={index} className="border-b">
                          <td className="py-3 px-4">{row.col1}</td>
                          <td className="py-3 px-4">{row.col2}</td>
                          <td className="py-3 px-4">{row.col3}</td>
                          <td className="py-3 px-4">{row.col4}</td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
                <div className="mt-8 space-y-3">
                  <p className="text-lg font-semibold">Used Volkswagen extended warranty and high mileage VW cover available for:</p>
                  <ul className="list-disc list-inside space-y-2 text-muted-foreground">
                    <li>Golf diesel DSG (common mechatronic faults)</li>
                    <li>Tiguan, Touareg and Passat (turbo and injector repairs)</li>
                    <li>Transporter vans (high labour cost)</li>
                  </ul>
                </div>
              </div>
            </div>
          </div>
        </section>

        {/* Volkswagen Repair Costs */}
        <section className="bg-card py-16">
          <div className="container mx-auto px-4">
            <div className="max-w-4xl mx-auto space-y-8">
              <h2 className="text-3xl md:text-4xl font-bold text-center">
                Volkswagen Repair Costs in the UK
              </h2>
              <p className="text-lg text-center text-muted-foreground font-semibold">
                The reason warranties exist.
              </p>
              <div className="bg-white p-8 rounded-lg shadow-sm">
                <div className="overflow-x-auto">
                  <table className="w-full">
                    <thead>
                      <tr className="border-b-2">
                        <th className="text-left py-3 px-4">Repair Type</th>
                        <th className="text-left py-3 px-4">Average Cost</th>
                      </tr>
                    </thead>
                    <tbody>
                      {[
                        { repair: "DSG gearbox failure", cost: "£1,500 - £3,200" },
                        { repair: "Turbo replacement", cost: "£900 - £1,800" },
                        { repair: "Injector failure", cost: "£420 - £800" },
                        { repair: "Infotainment screen", cost: "£900 - £1,300" },
                        { repair: "NOX or sensors", cost: "£300 - £600" }
                      ].map((item, index) => (
                        <tr key={index} className="border-b">
                          <td className="py-3 px-4 font-medium">{item.repair}</td>
                          <td className="py-3 px-4 text-primary font-semibold">{item.cost}</td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
                <p className="text-lg font-semibold text-center mt-6 text-primary">
                  A single repair often costs more than a full year of warranty cover.
                </p>
              </div>
            </div>
          </div>
        </section>

        {/* How It Works */}
        <section className="bg-muted/30 py-16">
          <div className="container mx-auto px-4">
            <div className="max-w-4xl mx-auto space-y-8">
              <h2 className="text-3xl md:text-4xl font-bold text-center">
                How It Works (Simple)
              </h2>
              <div className="grid md:grid-cols-3 gap-8">
                {[
                  {
                    step: "1",
                    title: "Get your instant quote online",
                    icon: <Clock className="w-12 h-12 text-primary" />
                  },
                  {
                    step: "2",
                    title: "Choose your cover level (Comprehensive / Listed Component)",
                    icon: <Shield className="w-12 h-12 text-primary" />
                  },
                  {
                    step: "3",
                    title: "Activate cover - start driving with confidence",
                    icon: <CheckCircle2 className="w-12 h-12 text-primary" />
                  }
                ].map((item, index) => (
                  <div key={index} className="bg-card p-6 rounded-lg text-center space-y-4">
                    <div className="flex justify-center">{item.icon}</div>
                    <div className="text-2xl font-bold text-primary">Step {item.step}</div>
                    <p className="text-lg">{item.title}</p>
                  </div>
                ))}
              </div>
              <p className="text-lg text-center font-semibold mt-8">
                No inspections. No paperwork delays.
              </p>
            </div>
          </div>
        </section>

        {/* FAQs */}
        <section className="bg-card py-16">
          <div className="container mx-auto px-4">
            <div className="max-w-4xl mx-auto space-y-8">
              <h2 className="text-3xl md:text-4xl font-bold text-center">
                FAQs
              </h2>
              <div className="space-y-6">
                {vwFAQs.map((faq, index) => (
                  <div key={index} className="bg-white p-6 rounded-lg shadow-sm">
                    <h3 className="text-xl font-bold mb-3">{faq.question}</h3>
                    <p className="text-muted-foreground">{faq.answer}</p>
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
                Get Covered Before a Breakdown Happens
              </h2>
              <p className="text-xl">
                Stop worrying about expensive repair bills. Protect your Volkswagen today.
              </p>
              <p className="text-lg">
                Get your price in seconds - no sales calls, no paperwork, no waiting.
              </p>
              <Button 
                onClick={navigateToQuoteForm} 
                size="lg" 
                className="text-lg px-8 py-6 bg-white text-primary hover:bg-gray-100"
              >
                Get my Volkswagen warranty quote →
              </Button>
            </div>
          </div>
        </section>

        {/* Scroll to Top Button */}
        {showScrollTop && (
          <button
            onClick={scrollToTop}
            className="fixed bottom-24 right-6 bg-primary text-white p-3 rounded-full shadow-lg hover:bg-primary/90 transition-all z-40"
            aria-label="Scroll to top"
          >
            <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 10l7-7m0 0l7 7m-7-7v18" />
            </svg>
          </button>
        )}

        <NewFooter />
      </div>
    </>
  );
};

export default VolkswagenWarranty;
