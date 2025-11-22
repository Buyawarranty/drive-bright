import { useState, useEffect } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { Button } from '@/components/ui/button';
import { CheckCircle2, Shield, Clock, Phone, Menu, X, Mail, ChevronDown } from 'lucide-react';
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
import motorcycleHero from '@/assets/motorcycle-hero.png';
import motorcycleCoverage from '@/assets/motorcycle-coverage.png';
import motorcyclePanda from '@/assets/motorcycle-panda.png';
import trustpilotLogo from '@/assets/trustpilot-excellent-box.webp';
import whatsappIconNew from '@/assets/whatsapp-icon-new.png';
import companyRegistration from '@/assets/company-registration-footer.png';

const MotorcycleWarranty = () => {
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
    trackButtonClick('motorcycle_warranty_get_quote_cta');
    navigate('/');
    setTimeout(() => {
      const element = document.getElementById('quote-form');
      if (element) {
        element.scrollIntoView({ behavior: 'smooth' });
      }
    }, 100);
  };

  const motorcycleFAQs = [
    {
      question: "Are extended warranties on motorcycles worth it?",
      answer: "Yes. Modern bikes have complex electrical systems, ECUs and fuel injection that can fail without warning. A single repair can cost £800 to £1,800. An extended motorcycle warranty protects you from major bills and gives cost certainty, especially for used or high-mileage bikes."
    },
    {
      question: "What is the best extended warranty for a motorcycle?",
      answer: "The best motorcycle warranty includes mechanical and electrical cover, labour costs, diagnostic fees, and access to any VAT-registered garage. Plans that pay the garage directly (so you are not out of pocket) and offer flexible monthly payments provide the highest value."
    },
    {
      question: "How much does a motorcycle extended warranty cost?",
      answer: "Prices vary based on bike age, mileage and cover level. On average in the UK, extended motorcycle warranty plans start from £20 to £45 per month, or £250 to £450 per year, depending on your bike and selected claim limit."
    },
    {
      question: "Should I get a warranty on a used motorcycle?",
      answer: "Yes. Used motorcycles are more likely to require repairs such as clutch failures, alternator issues, starter motor faults, or ECU problems. A used motorcycle warranty prevents surprise bills and protects your budget."
    },
    {
      question: "What motorcycle has the least problems?",
      answer: "Honda, Yamaha and Suzuki typically have the best reliability records in the UK. European brands like Ducati and Aprilia are more performance-driven but may have higher repair costs."
    }
  ];

  return (
    <>
      <SEOHead
        title="Motorcycle Extended Warranty | Protect Used & Older Motorbikes"
        description="Cover repair costs on used or older motorcycles with our extended warranty. Full protection, flexible plans and instant online quotes. Keep your bike on the road."
        keywords="motorcycle extended warranty, motorcycle warranty UK, motorbike warranty, used motorcycle warranty, motorcycle repair cover, bike warranty, motorcycle protection plan"
        canonical="https://buyawarranty.co.uk/motorcycle-warranty/"
      />
      
      {/* Schema.org Structured Data for GEO/AI Search Optimization */}
      <OrganizationSchema type="InsuranceAgency" />
      
      <WebPageSchema
        name="Motorcycle Extended Warranty - Buy A Warranty"
        description="Comprehensive extended warranty coverage for motorcycles in the UK. Protect your bike from expensive mechanical and electrical failures with flexible plans starting from £20/month."
        url="https://buyawarranty.co.uk/motorcycle-warranty/"
        lastReviewed={new Date().toISOString()}
        significantLink="https://buyawarranty.co.uk/"
        specialty="Motorcycle Extended Warranties"
      />
      
      <ProductSchema
        name="Motorcycle Extended Warranty"
        description="Comprehensive extended warranty coverage for motorcycles including engine, gearbox, electrical systems, ECU, fuel injection, braking, suspension and more. Available for used bikes up to 150,000 miles."
        price="20.00"
        brand="Buy A Warranty"
        category="Motorcycle Insurance & Warranty"
        image="https://buyawarranty.co.uk/lovable-uploads/53652a24-3961-4346-bf9d-6588ef727aeb.png"
        availability="https://schema.org/InStock"
        areaServed="United Kingdom"
      />
      
      <FAQSchema faqs={motorcycleFAQs} />
      
      <BreadcrumbSchema
        items={[
          { name: "Home", url: "https://buyawarranty.co.uk/" },
          { name: "Motorcycle Warranty", url: "https://buyawarranty.co.uk/motorcycle-warranty/" }
        ]}
      />

      {/* Header */}
      <header className="bg-white shadow-sm sticky top-0 z-50">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="flex items-center justify-between h-16 sm:h-20">
            <div className="flex items-center">
              <Link to="/">
                <img src="/lovable-uploads/53652a24-3961-4346-bf9d-6588ef727aeb.png" alt="Buy a Warranty" className="h-6 sm:h-8 w-auto" />
              </Link>
            </div>
            
            <nav className="hidden lg:flex items-center space-x-4 xl:space-x-6">
              <Link to="/what-is-covered" className="text-gray-700 hover:text-gray-900 font-medium text-sm xl:text-base">What's Covered</Link>
              <Link to="/make-a-claim" className="text-gray-700 hover:text-gray-900 font-medium text-sm xl:text-base">Make a Claim</Link>
              <Link to="/faq" className="text-gray-700 hover:text-gray-900 font-medium text-sm xl:text-base">FAQs</Link>
              <Link to="/contact-us" className="text-gray-700 hover:text-gray-900 font-medium text-sm xl:text-base">Contact Us</Link>
            </nav>

            <div className="hidden lg:flex items-center space-x-3">
              <a href="https://wa.me/message/SPQPJ6O3UBF5B1" target="_blank" rel="noopener noreferrer">
                <Button 
                  variant="outline" 
                  size="sm"
                  className="bg-green-500 text-white border-green-500 hover:bg-green-600 hover:border-green-600 px-3 text-sm"
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
                <Button variant="ghost" size="sm" className="lg:hidden p-2">
                  <Menu className="h-8 w-8" />
                </Button>
              </SheetTrigger>
              <SheetContent side="right" className="w-[300px] sm:w-[400px]">
                <div className="flex flex-col h-full">
                  <div className="flex items-center justify-between pb-6">
                    <Link to="/" className="hover:opacity-80 transition-opacity">
                      <img 
                        src="/lovable-uploads/53652a24-3961-4346-bf9d-6588ef727aeb.png" 
                        alt="Buy a Warranty" 
                        className="h-8 w-auto"
                      />
                    </Link>
                  </div>

                  <nav className="flex flex-col space-y-6 flex-1">
                    <Link to="/what-is-covered" className="text-gray-700 hover:text-gray-900 font-medium text-sm py-2 border-b border-gray-200" onClick={() => setIsMobileMenuOpen(false)}>
                      What's Covered
                    </Link>
                    <Link to="/make-a-claim" className="text-gray-700 hover:text-gray-900 font-medium text-sm py-2 border-b border-gray-200" onClick={() => setIsMobileMenuOpen(false)}>
                      Make a Claim
                    </Link>
                    <Link to="/faq" className="text-gray-700 hover:text-gray-900 font-medium text-sm py-2 border-b border-gray-200" onClick={() => setIsMobileMenuOpen(false)}>
                      FAQs
                    </Link>
                    <Link to="/contact-us" className="text-gray-700 hover:text-gray-900 font-medium text-sm py-2 border-b border-gray-200" onClick={() => setIsMobileMenuOpen(false)}>
                      Contact Us
                    </Link>
                  </nav>

                  <div className="space-y-4 pt-6 mt-auto">
                    <a href="https://wa.me/message/SPQPJ6O3UBF5B1" target="_blank" rel="noopener noreferrer">
                      <Button variant="outline" className="w-full bg-green-500 text-white border-green-500 hover:bg-green-600 hover:border-green-600 text-lg py-3" onClick={() => setIsMobileMenuOpen(false)}>
                        WhatsApp Us
                      </Button>
                    </a>
                    <Button className="w-full bg-primary text-white hover:bg-primary/90 text-lg py-3" onClick={() => { setIsMobileMenuOpen(false); navigateToQuoteForm(); }}>
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
        <section className="container mx-auto px-4 sm:px-6 lg:px-8 py-12 md:py-20">
          <div className="grid lg:grid-cols-2 gap-8 lg:gap-12 items-center">
            <div className="space-y-6 text-center lg:text-left">
              <h1 className="text-4xl md:text-5xl lg:text-6xl font-bold tracking-tight">
                Motorcycle Extended Warranty
              </h1>
              <p className="text-xl md:text-2xl font-bold text-primary">
                Ride With Confidence, Avoid Unexpected Repair Bills
              </p>
              <p className="text-lg md:text-xl text-muted-foreground max-w-2xl mx-auto lg:mx-0">
                A motorcycle extended warranty protects you when expensive mechanical or electrical faults occur after the original warranty ends. Modern bikes have complex electronics, fuel systems and ECU modules, which means even a small issue can cost hundreds to repair.
              </p>
              <div className="flex flex-col sm:flex-row gap-4 justify-center lg:justify-start">
                <Button onClick={navigateToQuoteForm} size="lg" className="text-lg px-8 py-6 bg-primary hover:bg-primary/90">
                  Get Your Motorcycle Warranty Quote
                </Button>
              </div>
              <div className="flex justify-center lg:justify-start mt-6">
                <TrustpilotHeader />
              </div>
            </div>
            <div className="relative flex justify-center">
              <img src={motorcycleHero} alt="Motorcycle Extended Warranty UK - Protect Your Bike" className="w-full h-auto" />
            </div>
          </div>
        </section>

        {/* Why Choose Us Section */}
        <section className="bg-card py-16">
          <div className="container mx-auto px-4 sm:px-6 lg:px-8">
            <div className="text-center mb-12">
              <h2 className="text-3xl md:text-4xl font-bold mb-4">
                Why Riders Choose Buy A Warranty
              </h2>
            </div>
            <div className="grid md:grid-cols-2 lg:grid-cols-3 gap-6 max-w-6xl mx-auto">
              {[
                { icon: Shield, title: "Comprehensive cover for essential motorcycle components", desc: "" },
                { icon: CheckCircle2, title: "Instant quotes online in minutes", desc: "" },
                { icon: Clock, title: "Cover available for used bikes and older motorcycles", desc: "" },
                { icon: Shield, title: "Petrol motorcycles and electric motorbikes covered", desc: "" },
                { icon: CheckCircle2, title: "UK-wide support and approved garages", desc: "" },
                { icon: Shield, title: "Monthly and annual plans available", desc: "" }
              ].map((item, index) => (
                <div key={index} className="bg-background p-6 rounded-lg border border-border hover:shadow-lg transition-shadow">
                  <CheckCircle2 className="w-12 h-12 text-primary mb-4" />
                  <h3 className="text-lg font-semibold">{item.title}</h3>
                </div>
              ))}
            </div>
            <div className="text-center mt-8">
              <p className="text-lg font-semibold text-primary">
                We are the only motorcycle warranty provider offering cover for high-mileage bikes up to 150,000 miles.
              </p>
            </div>
          </div>
        </section>

        {/* What Your Warranty Covers */}
        <section className="container mx-auto px-4 sm:px-6 lg:px-8 py-16">
          <div className="grid lg:grid-cols-2 gap-12 items-center">
            <div className="space-y-6">
              <h2 className="text-3xl md:text-4xl font-bold">
                What Your Motorcycle Warranty Covers
              </h2>
              <p className="text-lg text-muted-foreground">
                Our plans protect key mechanical and electrical components, including:
              </p>
              <ul className="space-y-4">
                {[
                  "Engine and gearbox",
                  "Transmission and drivetrain",
                  "Fuel system (injection, carburettor, pumps)",
                  "Electrical systems, ECU, starter motors",
                  "Cooling systems and radiators",
                  "Suspension and steering",
                  "Front and rear braking components",
                  "Parts and labour are covered up to your claim limit"
                ].map((item, index) => (
                  <li key={index} className="flex items-start gap-3">
                    <CheckCircle2 className="w-6 h-6 text-primary flex-shrink-0 mt-0.5" />
                    <span className="text-lg">{item}</span>
                  </li>
                ))}
              </ul>
              <p className="text-lg font-semibold">No hidden fees. No complicated exclusions.</p>
            </div>
            <div className="relative flex justify-center">
              <img src={motorcycleCoverage} alt="Motorcycle Warranty Coverage UK" className="w-3/4 h-auto" />
            </div>
          </div>
        </section>

        {/* Comparison Table */}
        <section className="bg-muted/30 py-16">
          <div className="container mx-auto px-4 sm:px-6 lg:px-8">
            <div className="max-w-4xl mx-auto">
              <h2 className="text-3xl md:text-4xl font-bold text-center mb-12">
                Motorcycle Warranty Comparison Table
              </h2>
              <div className="bg-card rounded-lg border overflow-hidden">
                <div className="overflow-x-auto">
                  <table className="w-full">
                    <thead className="bg-primary text-white">
                      <tr>
                        <th className="px-6 py-4 text-left">Component / System</th>
                        <th className="px-6 py-4 text-center">Included?</th>
                      </tr>
                    </thead>
                    <tbody>
                      {[
                        { name: "Engine and gearbox", included: true },
                        { name: "Clutch and drivetrain", included: true },
                        { name: "Electrical systems and ECU", included: true },
                        { name: "Fuel system and injectors", included: true },
                        { name: "Cooling and radiator", included: true },
                        { name: "Braking systems", included: true },
                        { name: "Suspension and steering", included: true },
                        { name: "Wear and tear items (pads, chain, tyres)", included: false, optional: true },
                        { name: "Accidental damage", included: false }
                      ].map((row, index) => (
                        <tr key={index} className={index % 2 === 0 ? 'bg-background' : 'bg-muted/20'}>
                          <td className="px-6 py-4">{row.name}</td>
                          <td className="px-6 py-4 text-center">
                            {row.included ? (
                              <span className="text-green-600 font-bold text-xl">✅ Yes</span>
                            ) : row.optional ? (
                              <span className="text-orange-600 font-bold text-xl">Optional</span>
                            ) : (
                              <span className="text-red-600 font-bold text-xl">❌ Not included</span>
                            )}
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              </div>
            </div>
          </div>
        </section>

        {/* How It Works */}
        <section className="container mx-auto px-4 sm:px-6 lg:px-8 py-16">
          <div className="max-w-4xl mx-auto text-center space-y-12">
            <div>
              <h2 className="text-3xl md:text-4xl font-bold mb-4">
                How It Works (Simple 4 Step Claim Process)
              </h2>
            </div>
            <div className="grid md:grid-cols-4 gap-6">
              {[
                { num: "1", text: "Start your claim online or call us." },
                { num: "2", text: "Approval given before any work begins." },
                { num: "3", text: "Take your bike to any approved garage." },
                { num: "4", text: "We pay the garage directly for approved repairs." }
              ].map((step, index) => (
                <div key={index} className="bg-card p-6 rounded-lg border">
                  <div className="text-4xl font-bold text-primary mb-4">{step.num}</div>
                  <p className="text-lg">{step.text}</p>
                </div>
              ))}
            </div>
            <p className="text-xl font-semibold">You do not pay and claim back. We handle the payment.</p>
          </div>
        </section>

        {/* Motorcycle Types We Cover */}
        <section className="bg-card py-16">
          <div className="container mx-auto px-4 sm:px-6 lg:px-8">
            <div className="max-w-4xl mx-auto">
              <h2 className="text-3xl md:text-4xl font-bold text-center mb-8">
                Motorcycle Types We Cover
              </h2>
              <div className="grid md:grid-cols-2 gap-6">
                {[
                  "Standard petrol motorcycles",
                  "Touring and adventure bikes",
                  "Cruisers and choppers",
                  "Sports and performance models",
                  "Scooters (petrol and electric motorbikes)",
                  "Commuter bikes (including 125cc and A2 licence bikes)"
                ].map((type, index) => (
                  <div key={index} className="flex items-start gap-3">
                    <CheckCircle2 className="w-6 h-6 text-primary flex-shrink-0 mt-0.5" />
                    <span className="text-lg">{type}</span>
                  </div>
                ))}
              </div>
              <p className="text-muted-foreground mt-6 text-center">
                We do not cover pedal-assisted electric bicycles (e-bikes).
              </p>
            </div>
          </div>
        </section>

        {/* Brands We Cover */}
        <section className="container mx-auto px-4 sm:px-6 lg:px-8 py-16">
          <div className="max-w-6xl mx-auto">
            <h2 className="text-3xl md:text-4xl font-bold text-center mb-8">
              Motorcycle Brands We Cover in the UK
            </h2>
            <p className="text-lg text-muted-foreground text-center mb-12">
              We provide extended warranty cover for new, nearly new and used motorcycles from leading UK-market brands. If your bike is road legal and registered in the UK, we can protect it.
            </p>
            <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-8">
              {[
                { name: "Honda", color: "text-red-600" },
                { name: "Yamaha", color: "text-blue-600" },
                { name: "Suzuki", color: "text-blue-700" },
                { name: "BMW Motorrad", color: "text-blue-500" },
                { name: "Kawasaki", color: "text-green-600" },
                { name: "Triumph", color: "text-gray-900" },
                { name: "Royal Enfield", color: "text-amber-700" },
                { name: "Harley-Davidson", color: "text-orange-600" },
                { name: "KTM", color: "text-orange-500" },
                { name: "Ducati", color: "text-red-600" },
                { name: "Aprilia", color: "text-red-700" },
                { name: "Moto Guzzi", color: "text-red-800" }
              ].map((brand, index) => (
                <div key={index} className="bg-white p-6 rounded-lg border-2 border-gray-200 hover:border-primary transition-colors shadow-sm hover:shadow-md flex items-center justify-center">
                  <span className={`text-2xl font-bold ${brand.color}`}>
                    {brand.name}
                  </span>
                </div>
              ))}
            </div>
          </div>
        </section>

        {/* Is It Worth It */}
        <section className="bg-muted/30 py-16">
          <div className="container mx-auto px-4 sm:px-6 lg:px-8">
            <div className="max-w-4xl mx-auto space-y-8">
              <h2 className="text-3xl md:text-4xl font-bold text-center">
                Is a Motorcycle Warranty Worth It?
              </h2>
              <p className="text-lg text-center">
                Yes. Modern motorcycles have electronic control systems and advanced injection technology. The cost of repairs can escalate quickly:
              </p>
              <div className="bg-card rounded-lg border overflow-hidden">
                <table className="w-full">
                  <thead className="bg-primary text-white">
                    <tr>
                      <th className="px-6 py-4 text-left">Repair Type</th>
                      <th className="px-6 py-4 text-right">Cost (Average)</th>
                    </tr>
                  </thead>
                  <tbody>
                    {[
                      { type: "ECU / electrical fault", cost: "£750 to £1,200" },
                      { type: "Gearbox repair", cost: "£1,000 to £1,800" },
                      { type: "Fuel injection/pump issue", cost: "£500 to £900" },
                      { type: "Radiator/cooling system repair", cost: "£450 to £850" }
                    ].map((row, index) => (
                      <tr key={index} className={index % 2 === 0 ? 'bg-background' : 'bg-muted/20'}>
                        <td className="px-6 py-4">{row.type}</td>
                        <td className="px-6 py-4 text-right font-semibold">{row.cost}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
              <p className="text-xl font-semibold text-center text-primary">
                A single fault can cost more than a full year of warranty cover.
              </p>
            </div>
          </div>
        </section>

        {/* Flexible Payment */}
        <section className="container mx-auto px-4 sm:px-6 lg:px-8 py-16">
          <div className="grid lg:grid-cols-2 gap-12 items-center">
            <div className="relative flex justify-center">
              <img src={motorcyclePanda} alt="Motorcycle Warranty Payment Options" className="w-1/2 h-auto" />
            </div>
            <div className="space-y-6">
              <h2 className="text-3xl md:text-4xl font-bold">
                Flexible Payment Options
              </h2>
              <p className="text-lg text-muted-foreground">
                Choose the plan that fits your riding needs:
              </p>
              <ul className="space-y-4">
                {[
                  "Pay monthly (low deposit)",
                  "One-off annual payment (discount applied)",
                  "6, 12, 24 or 36-month cover available"
                ].map((item, index) => (
                  <li key={index} className="flex items-start gap-3">
                    <CheckCircle2 className="w-6 h-6 text-primary flex-shrink-0 mt-0.5" />
                    <span className="text-lg">{item}</span>
                  </li>
                ))}
              </ul>
              <p className="text-lg">No forced inspection or dealer-only repairs.</p>
            </div>
          </div>
        </section>

        {/* FAQs */}
        <section className="bg-card py-16">
          <div className="container mx-auto px-4 sm:px-6 lg:px-8">
            <div className="max-w-4xl mx-auto">
              <h2 className="text-3xl md:text-4xl font-bold text-center mb-12">Frequently Asked Questions</h2>
              <div className="space-y-4">
                {motorcycleFAQs.map((faq, index) => (
                  <div key={index} className="bg-gradient-to-r from-orange-500 to-orange-600 rounded-lg shadow-lg overflow-hidden">
                    <button
                      onClick={() => {
                        const button = document.getElementById(`faq-${index}`);
                        const content = document.getElementById(`faq-content-${index}`);
                        if (button && content) {
                          const isOpen = content.style.maxHeight && content.style.maxHeight !== '0px';
                          content.style.maxHeight = isOpen ? '0px' : content.scrollHeight + 'px';
                          button.querySelector('svg')?.classList.toggle('rotate-180');
                        }
                      }}
                      id={`faq-${index}`}
                      className="w-full px-6 py-5 text-left flex items-center justify-between hover:bg-orange-600/20 transition-colors"
                    >
                      <span className="font-semibold text-lg text-white pr-4">
                        {faq.question}
                      </span>
                      <ChevronDown 
                        className="w-6 h-6 flex-shrink-0 text-white transition-transform duration-300"
                      />
                    </button>
                    
                    <div 
                      id={`faq-content-${index}`}
                      className="overflow-hidden transition-all duration-200 ease-out"
                      style={{ maxHeight: '0px' }}
                    >
                      <div className="px-6 pb-5 bg-white border-t border-orange-200">
                        <div className="pt-4">
                          <p className="text-brand-dark-text leading-relaxed whitespace-pre-line">
                            {faq.answer}
                          </p>
                        </div>
                      </div>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          </div>
        </section>

        {/* Help Section - Orange Strip */}
        <section className="bg-gradient-to-r from-orange-500 to-orange-600 py-12">
          <div className="container mx-auto px-4 sm:px-6 lg:px-8">
            <div className="max-w-4xl mx-auto text-center space-y-6 text-white">
              <h2 className="text-3xl md:text-4xl font-bold text-white">
                Need help? Our team of warranty experts are here to help.
              </h2>
              <div className="flex flex-col sm:flex-row items-center justify-center gap-6 text-lg">
                <a href="tel:03302295040" className="flex items-center gap-2 hover:opacity-80 transition-opacity text-white">
                  <Phone className="w-5 h-5 text-white" />
                  <span className="font-semibold text-white">Call us: 0330 229 5040</span>
                </a>
                <span className="hidden sm:inline text-white">|</span>
                <a href="mailto:support@buyawarranty.co.uk" className="flex items-center gap-2 hover:opacity-80 transition-opacity text-white">
                  <Mail className="w-5 h-5 text-white" />
                  <span className="font-semibold text-white">Email us: support@buyawarranty.co.uk</span>
                </a>
              </div>
              <p className="text-xl font-bold mt-4 text-white">Drive Smarter</p>
            </div>
          </div>
        </section>

        {/* Final CTA */}
        <section className="container mx-auto px-4 sm:px-6 lg:px-8 py-16">
          <div className="max-w-4xl mx-auto text-center space-y-6 bg-primary/5 rounded-lg p-12">
            <h2 className="text-3xl md:text-4xl font-bold">
              Start Your Motorcycle Warranty
            </h2>
            <p className="text-lg text-muted-foreground">
              Get a fast quote online in less than 60 seconds.
            </p>
            <div className="flex flex-col sm:flex-row gap-4 justify-center">
              <Button onClick={navigateToQuoteForm} size="lg" className="text-lg px-8 py-6">
                Get Your Motorcycle Warranty Quote
              </Button>
            </div>
          </div>
        </section>

        <NewFooter />

        {/* Floating Contact Buttons */}
        {isMobile && (
          <>
            <a
              href="https://wa.me/message/SPQPJ6O3UBF5B1"
              target="_blank"
              rel="noopener noreferrer"
              className="fixed bottom-24 right-4 z-40 bg-green-500 text-white p-4 rounded-full shadow-lg hover:bg-green-600 transition-all duration-300 flex items-center justify-center"
            >
              <img src={whatsappIconNew} alt="WhatsApp" className="w-6 h-6" />
            </a>
            <a
              href="tel:03302295040"
              className="fixed bottom-36 right-4 z-40 bg-primary text-white p-4 rounded-full shadow-lg hover:bg-primary/90 transition-all duration-300"
            >
              <Phone className="w-6 h-6" />
            </a>
          </>
        )}

        {/* Scroll to Top */}
        {showScrollTop && (
          <button
            onClick={scrollToTop}
            className="fixed bottom-4 right-4 z-50 bg-primary text-white p-3 rounded-full shadow-lg hover:bg-primary/90 transition-all duration-300"
          >
            ↑
          </button>
        )}

      </div>
    </>
  );
};

export default MotorcycleWarranty;
