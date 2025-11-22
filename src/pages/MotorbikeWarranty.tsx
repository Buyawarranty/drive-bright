import { useState, useEffect } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { Button } from '@/components/ui/button';
import { CheckCircle2, Shield, Clock, Phone, AlertCircle, Menu } from 'lucide-react';
import { Sheet, SheetContent, SheetTrigger } from '@/components/ui/sheet';
import { SEOHead } from '@/components/SEOHead';
import TrustpilotHeader from '@/components/TrustpilotHeader';
import NewFooter from '@/components/NewFooter';
import WebsiteFooter from '@/components/WebsiteFooter';
import { useIsMobile } from '@/hooks/use-mobile';
import { trackButtonClick } from '@/utils/analytics';
import motorcycleSavings from '@/assets/motorcycle-warranty-uk-savings.png';
import motorbikeQuotes from '@/assets/motorbike-warranty-uk-quotes.png';
import motorbikeRepair from '@/assets/motorbike-warranty-uk-repair-cover.png';
import trustpilotLogo from '@/assets/trustpilot-excellent-box.webp';
import whatsappIconNew from '@/assets/whatsapp-icon-new.png';
import companyRegistration from '@/assets/company-registration-footer.png';

const MotorbikeWarranty = () => {
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
    trackButtonClick('motorbike_warranty_get_quote_cta');
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
        title="Motorbike Warranty UK | Best Motorcycle Repair Cover & Electric Car Warranty Provider"
        description="Best motorbike warranty UK with comprehensive motorcycle repair cover. What's included in motorbike warranty: engine, gearbox, electrical systems. Also offering best electric car warranty provider services with extended electric car warranties UK, USA, Canada."
        keywords="motorbike warranty UK, motorbike warranty UK best, whats included in motorbike warranty, motorcycle warranty, buy motorbike warranty online, motorcycle repair warranty UK, extended motorbike warranty, best electric car warranty provider, extended electric car warranty providers, electric car warranty insurance, used electric car warranty, best electric car warranty, extended electric cars warranties UK, extended electric cars warranties USA, best electric cars warranties UK"
        canonical="https://buyawarranty.co.uk/motorbike-repair-warranty-uk-warranties"
      />

      {/* Header */}
      <header className="bg-white shadow-sm sticky top-0 z-50">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="flex items-center justify-between h-16 sm:h-20">
            {/* Logo */}
            <div className="flex items-center">
              <Link to="/">
                <img src="/lovable-uploads/53652a24-3961-4346-bf9d-6588ef727aeb.png" alt="Buy a Warranty" className="h-6 sm:h-8 w-auto" />
              </Link>
            </div>
            
            {/* Navigation - Hidden on mobile, visible on lg+ */}
            <nav className="hidden lg:flex items-center space-x-4 xl:space-x-6">
              <Link to="/what-is-covered" className="text-gray-700 hover:text-gray-900 font-medium text-sm xl:text-base">What's Covered</Link>
              <Link to="/make-a-claim" className="text-gray-700 hover:text-gray-900 font-medium text-sm xl:text-base">Make a Claim</Link>
              <Link to="/faq" className="text-gray-700 hover:text-gray-900 font-medium text-sm xl:text-base">FAQs</Link>
              <Link to="/contact-us" className="text-gray-700 hover:text-gray-900 font-medium text-sm xl:text-base">Contact Us</Link>
            </nav>

            {/* Desktop CTA Buttons - Show on desktop */}
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

            {/* Mobile Menu Button */}
            <Sheet open={isMobileMenuOpen} onOpenChange={setIsMobileMenuOpen}>
              <SheetTrigger asChild>
                <Button
                  variant="ghost"
                  size="sm"
                  className="lg:hidden p-2"
                >
                  <Menu className="h-8 w-8" />
                </Button>
              </SheetTrigger>
              <SheetContent side="right" className="w-[300px] sm:w-[400px]">
                <div className="flex flex-col h-full">
                  {/* Header with logo */}
                  <div className="flex items-center justify-between pb-6">
                    <Link to="/" className="hover:opacity-80 transition-opacity">
                      <img 
                        src="/lovable-uploads/53652a24-3961-4346-bf9d-6588ef727aeb.png" 
                        alt="Buy a Warranty" 
                        className="h-8 w-auto"
                      />
                    </Link>
                  </div>

                  {/* Navigation Links */}
                  <nav className="flex flex-col space-y-6 flex-1">
                    <Link 
                      to="/what-is-covered" 
                      className="text-gray-700 hover:text-gray-900 font-medium text-sm py-2 border-b border-gray-200"
                      onClick={() => setIsMobileMenuOpen(false)}
                    >
                      What's Covered
                    </Link>
                    <Link 
                      to="/make-a-claim" 
                      className="text-gray-700 hover:text-gray-900 font-medium text-sm py-2 border-b border-gray-200"
                      onClick={() => setIsMobileMenuOpen(false)}
                    >
                      Make a Claim
                    </Link>
                    <Link 
                      to="/faq" 
                      className="text-gray-700 hover:text-gray-900 font-medium text-sm py-2 border-b border-gray-200"
                      onClick={() => setIsMobileMenuOpen(false)}
                    >
                       FAQs
                    </Link>
                    <Link 
                      to="/contact-us" 
                      className="text-gray-700 hover:text-gray-900 font-medium text-sm py-2 border-b border-gray-200"
                      onClick={() => setIsMobileMenuOpen(false)}
                    >
                      Contact Us
                    </Link>
                  </nav>

                  {/* CTA Buttons */}
                  <div className="space-y-4 pt-6 mt-auto">
                    <a href="https://wa.me/message/SPQPJ6O3UBF5B1" target="_blank" rel="noopener noreferrer">
                      <Button 
                        variant="outline" 
                        className="w-full bg-green-500 text-white border-green-500 hover:bg-green-600 hover:border-green-600 text-lg py-3"
                        onClick={() => setIsMobileMenuOpen(false)}
                      >
                        WhatsApp Us
                      </Button>
                    </a>
                    <Button 
                      className="w-full bg-primary text-white hover:bg-primary/90 text-lg py-3"
                      onClick={() => {
                        setIsMobileMenuOpen(false);
                        navigateToQuoteForm();
                      }}
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
        <TrustpilotHeader />
        
        {/* Hero Section */}
        <section className="container mx-auto px-4 py-12 md:py-20">
          <div className="grid lg:grid-cols-2 gap-8 lg:gap-12 items-center">
            <div className="space-y-6 text-center lg:text-left">
              <h1 className="text-4xl md:text-5xl lg:text-6xl font-bold tracking-tight">
                Motorcycle Warranty Protection
                <span className="block text-primary mt-2">Keep Your Bike on the Road</span>
              </h1>
              <p className="text-lg md:text-xl text-muted-foreground max-w-2xl mx-auto lg:mx-0">
                Comprehensive mechanical cover for motorcycles and scooters across the UK. Get instant quotes online with flexible payment plans designed to fit your budget.
              </p>
              <div className="flex flex-col sm:flex-row gap-4 justify-center lg:justify-start">
                <Button 
                  onClick={navigateToQuoteForm}
                  size="lg"
                  className="text-lg px-8 py-6 bg-primary hover:bg-primary/90"
                >
                  Get Your Motorbike Warranty Quote
                </Button>
                <Button 
                  onClick={navigateToQuoteForm}
                  variant="outline"
                  size="lg"
                  className="text-lg px-8 py-6"
                >
                  Compare Motorcycle Plans
                </Button>
              </div>
              <div className="flex items-center justify-center lg:justify-start gap-2">
                <img 
                  src={trustpilotLogo} 
                  alt="Trustpilot Excellent Rating" 
                  className="h-8 md:h-10"
                />
              </div>
            </div>
            <div className="relative">
              <img 
                src={motorcycleSavings} 
                alt="Motorcycle Warranty UK - Affordable Motorbike Protection and Savings"
                className="w-full h-auto"
              />
            </div>
          </div>
        </section>

        {/* Important Notice */}
        <section className="container mx-auto px-4 pb-8">
          <div className="max-w-4xl mx-auto bg-amber-50 dark:bg-amber-950/20 border border-amber-200 dark:border-amber-800 rounded-lg p-6">
            <div className="flex items-start gap-3">
              <AlertCircle className="w-6 h-6 text-amber-600 dark:text-amber-500 flex-shrink-0 mt-0.5" />
              <div>
                <h3 className="font-semibold text-amber-900 dark:text-amber-200 mb-2">
                  Important: Electric Bikes Not Covered
                </h3>
                <p className="text-amber-800 dark:text-amber-300">
                  Please note: Our motorbike warranty covers motorcycles and motorised bikes only. We do not provide cover for standard electric bicycles (e-bikes) or pedal-assisted bikes.
                </p>
              </div>
            </div>
          </div>
        </section>

        {/* Why Choose Us Section */}
        <section className="bg-card py-16">
          <div className="container mx-auto px-4">
            <div className="text-center mb-12">
              <h2 className="text-3xl md:text-4xl font-bold mb-4">
                Why Motorcycle Owners Choose Buy A Warranty
              </h2>
              <p className="text-lg text-muted-foreground max-w-3xl mx-auto">
                The best motorbike warranty UK riders trust for comprehensive protection
              </p>
            </div>
            <div className="grid md:grid-cols-2 lg:grid-cols-3 gap-6 max-w-6xl mx-auto">
              {[
                { icon: Shield, title: "Comprehensive Cover", desc: "Full mechanical and electrical protection for your bike" },
                { icon: CheckCircle2, title: "Instant Quotes", desc: "Get prices online in minutes with no hassle" },
                { icon: Clock, title: "Used Bikes Welcome", desc: "Protection available for pre-owned motorcycles" },
                { icon: Shield, title: "Monthly Payments", desc: "Affordable plans with flexible payment options" },
                { icon: CheckCircle2, title: "Nationwide Support", desc: "Reliable service for riders across the UK" },
                { icon: Shield, title: "All Bike Styles", desc: "Coverage for sport, cruiser, touring and more" }
              ].map((item, index) => (
                <div key={index} className="bg-background p-6 rounded-lg border border-border hover:shadow-lg transition-shadow">
                  <item.icon className="w-12 h-12 text-primary mb-4" />
                  <h3 className="text-xl font-semibold mb-2">{item.title}</h3>
                  <p className="text-muted-foreground">{item.desc}</p>
                </div>
              ))}
            </div>
          </div>
        </section>

        {/* What's Included Section */}
        <section className="container mx-auto px-4 py-16">
          <div className="grid lg:grid-cols-2 gap-12 items-center">
            <div className="order-2 lg:order-1">
              <img 
                src={motorbikeRepair} 
                alt="Motorbike Warranty UK Repair Cover - Motorcycle Mechanical Protection"
                className="w-full h-auto"
              />
            </div>
            <div className="order-1 lg:order-2 space-y-6">
              <h2 className="text-3xl md:text-4xl font-bold">
                What's Included in Your Motorcycle Warranty Cover?
              </h2>
              <p className="text-lg text-muted-foreground">
                Our motorbike warranty UK plans protect essential motorcycle components:
              </p>
              <ul className="space-y-4">
                {[
                  "Engine, gearbox and clutch systems",
                  "Transmission and drivetrain components",
                  "Electrical systems and starter motors",
                  "Fuel injection and carburettor systems",
                  "Cooling systems and radiators",
                  "Suspension and steering components",
                  "Braking systems (front and rear)",
                  "Labour and parts up to your claim limit"
                ].map((item, index) => (
                  <li key={index} className="flex items-start gap-3">
                    <CheckCircle2 className="w-6 h-6 text-primary flex-shrink-0 mt-0.5" />
                    <span className="text-lg">{item}</span>
                  </li>
                ))}
              </ul>
              <Button onClick={navigateToQuoteForm} size="lg" className="mt-6">
                Get Your Motorcycle Quote Now
              </Button>
            </div>
          </div>
        </section>

        {/* Is Motorbike Warranty Worth It Section */}
        <section className="bg-muted/30 py-16">
          <div className="container mx-auto px-4">
            <div className="max-w-4xl mx-auto text-center space-y-6">
              <h2 className="text-3xl md:text-4xl font-bold">
                Is a Motorcycle Warranty Worth the Investment?
              </h2>
              <p className="text-lg text-muted-foreground">
                Absolutely. Modern motorcycles feature sophisticated technology, and repairs can quickly become expensive. A comprehensive warranty protects you from unexpected bills and gives you confidence to ride worry-free — whether you've bought new, used, or simply want extended cover when your manufacturer's protection runs out.
              </p>
              <div className="grid md:grid-cols-3 gap-6 mt-8">
                <div className="bg-card p-6 rounded-lg border">
                  <div className="text-4xl font-bold text-primary mb-2">£1,500+</div>
                  <p className="text-muted-foreground">Average motorcycle repair cost without warranty</p>
                </div>
                <div className="bg-card p-6 rounded-lg border">
                  <div className="text-4xl font-bold text-primary mb-2">24/7</div>
                  <p className="text-muted-foreground">UK-wide breakdown assistance available</p>
                </div>
                <div className="bg-card p-6 rounded-lg border">
                  <div className="text-4xl font-bold text-primary mb-2">100s</div>
                  <p className="text-muted-foreground">Of approved motorcycle garages nationwide</p>
                </div>
              </div>
            </div>
          </div>
        </section>

        {/* Flexible Payment Section */}
        <section className="container mx-auto px-4 py-16">
          <div className="grid lg:grid-cols-2 gap-12 items-center">
            <div className="space-y-6">
              <h2 className="text-3xl md:text-4xl font-bold">
                Flexible Payment Options for Your Motorbike Warranty
              </h2>
              <p className="text-lg text-muted-foreground">
                Choose the payment plan that works for your budget:
              </p>
              <ul className="space-y-4">
                {[
                  "Pay monthly motorbike warranty plans with low deposits",
                  "One-off annual payments with discounts",
                  "Short-term and long-term cover (6, 12, 24 or 36 months)",
                  "Flexible upgrade options as your bike needs change",
                  "No hidden fees or surprise charges"
                ].map((item, index) => (
                  <li key={index} className="flex items-start gap-3">
                    <CheckCircle2 className="w-6 h-6 text-primary flex-shrink-0 mt-0.5" />
                    <span className="text-lg">{item}</span>
                  </li>
                ))}
              </ul>
              <Button onClick={navigateToQuoteForm} size="lg">
                Compare Motorbike Warranty Plans
              </Button>
            </div>
            <div>
              <img 
                src={motorbikeQuotes} 
                alt="Motorbike Warranty UK Quotes - Motorcycle Warranty Payment Options"
                className="w-full h-auto"
              />
            </div>
          </div>
        </section>

        {/* Bike Types Covered */}
        <section className="bg-card py-16">
          <div className="container mx-auto px-4">
            <div className="max-w-4xl mx-auto space-y-8">
              <h2 className="text-3xl md:text-4xl font-bold text-center">
                Motorcycle Types We Cover
              </h2>
              <p className="text-lg text-muted-foreground text-center">
                Our extended motorbike warranty covers a wide range of motorcycle types across the UK:
              </p>
              <div className="space-y-4">
                {[
                  { 
                    title: "Standard Motorbikes", 
                    desc: "Road-legal motorcycles used for personal or commuting purposes" 
                  },
                  { 
                    title: "Scooters (Petrol/Electric)", 
                    desc: "Small-capacity scooters (typically up to 125cc or equivalent electric models)" 
                  },
                  { 
                    title: "Touring Bikes", 
                    desc: "Motorbikes designed for long-distance travel" 
                  },
                  { 
                    title: "Cruisers", 
                    desc: "e.g. Harley-Davidson-style bikes intended for standard road use" 
                  },
                  { 
                    title: "Commuter Bikes", 
                    desc: "Lightweight, commonly used daily road bikes" 
                  },
                  { 
                    title: "*Electric Motorbikes/Scooters", 
                    desc: "*Please see our EV vehicle plans" 
                  }
                ].map((type, index) => (
                  <div key={index} className="bg-background p-6 rounded-lg border flex items-start gap-4">
                    <CheckCircle2 className="w-6 h-6 text-primary flex-shrink-0 mt-0.5" />
                    <div>
                      <p className="font-semibold text-lg mb-1">{type.title}</p>
                      <p className="text-muted-foreground">{type.desc}</p>
                    </div>
                  </div>
                ))}
              </div>
              <p className="text-sm text-muted-foreground italic text-center">
                * Standard electric bicycles and pedal-assisted e-bikes are not covered
              </p>
            </div>
          </div>
        </section>

        {/* Compare Providers Section */}
        <section className="container mx-auto px-4 py-16">
          <div className="max-w-4xl mx-auto">
            <div className="text-center mb-12">
              <h2 className="text-3xl md:text-4xl font-bold mb-4">
                What Makes Our Motorcycle Cover Stand Out
              </h2>
              <p className="text-lg text-muted-foreground">
                We've earned a strong reputation among motorcycle riders across the UK by offering genuine protection and exceptional service. Our plans are designed specifically for bikes, and here's what our customers value most:
              </p>
            </div>
            <div className="grid md:grid-cols-2 gap-6">
              {[
                { title: "Specialist Motorcycle Cover", desc: "Expert knowledge of bike mechanics and common issues" },
                { title: "Fast Claims Handling", desc: "Quick turnaround to get you back on the road" },
                { title: "Transparent Pricing", desc: "Clear motorbike warranty quotes with no hidden costs" },
                { title: "UK-Based Support", desc: "Friendly customer service team who understand riders" },
                { title: "Flexible Terms", desc: "Cover options tailored to your bike and riding style" },
                { title: "No Pressure Sales", desc: "Honest advice without pushy tactics" }
              ].map((item, index) => (
                <div key={index} className="bg-card p-6 rounded-lg border">
                  <div className="flex items-start gap-3">
                    <CheckCircle2 className="w-6 h-6 text-primary flex-shrink-0 mt-0.5" />
                    <div>
                      <h3 className="text-lg font-semibold mb-2">{item.title}</h3>
                      <p className="text-muted-foreground">{item.desc}</p>
                    </div>
                  </div>
                </div>
              ))}
            </div>
          </div>
        </section>

        {/* Extended Coverage - Cars Section */}
        <section className="bg-card py-16">
          <div className="container mx-auto px-4 max-w-6xl">
            <div className="text-center mb-12">
              <h2 className="text-3xl md:text-4xl font-bold mb-4">
                Extended Electric Car Warranties in the UK
              </h2>
              <p className="text-lg text-muted-foreground max-w-3xl mx-auto">
                If you're looking to extend the warranty on your electric car in the UK, we offer tailored protection plans designed for EVs and hybrids. Whether your vehicle is new or used, our extended electric car warranties provide peace of mind with flexible cover options.
              </p>
            </div>

            <div className="grid md:grid-cols-2 gap-8">
              <div className="bg-background p-8 rounded-lg border">
                <h3 className="text-2xl font-bold mb-4">What's Included</h3>
                <ul className="space-y-3">
                  {[
                    'Comprehensive protection for electric and hybrid vehicles',
                    'Cover for key components including battery systems',
                    'Flexible terms to suit your driving habits and budget',
                    'Options for used electric cars and pre-owned EVs',
                    'Insurance-backed warranties for added security'
                  ].map((item, index) => (
                    <li key={index} className="flex items-start gap-2">
                      <CheckCircle2 className="w-5 h-5 text-primary mt-0.5 flex-shrink-0" />
                      <span className="text-sm">{item}</span>
                    </li>
                  ))}
                </ul>
              </div>

              <div className="bg-background p-8 rounded-lg border">
                <h3 className="text-2xl font-bold mb-4">Why Choose Us</h3>
                <p className="text-muted-foreground mb-4">
                  As one of the UK's trusted electric car warranty providers, we specialise in extended cover that goes beyond manufacturer warranties. Our plans are designed to support EV owners with reliable, cost-effective protection.
                </p>
              </div>
            </div>

            <div className="mt-8 bg-muted/30 p-8 rounded-lg">
              <h3 className="text-2xl font-bold mb-4 text-center">Popular Features</h3>
              <ul className="space-y-3 max-w-3xl mx-auto">
                {[
                  'Extended electric car warranty for UK drivers',
                  'Battery and drivetrain cover included',
                  'Used EV warranty options for all major brands',
                  'Monthly and annual payment plans available',
                  'No dealership required, buy online with ease'
                ].map((item, index) => (
                  <li key={index} className="flex items-start gap-2">
                    <CheckCircle2 className="w-5 h-5 text-primary mt-0.5 flex-shrink-0" />
                    <span>{item}</span>
                  </li>
                ))}
              </ul>
            </div>

            <div className="mt-8 bg-amber-50 dark:bg-amber-950/20 border border-amber-200 dark:border-amber-800 p-6 rounded-lg text-center">
              <p className="text-lg">
                <strong>Note:</strong> While we offer both motorbike warranty UK and electric car warranty services, please remember that standard electric bicycles and pedal-assisted e-bikes are not covered under our motorbike warranty plans.
              </p>
            </div>
          </div>
        </section>

        {/* FAQ Section */}
        <section className="bg-muted/30 py-16">
          <div className="container mx-auto px-4">
            <div className="max-w-4xl mx-auto">
              <h2 className="text-3xl md:text-4xl font-bold text-center mb-12">
                Motorbike Warranty FAQs
              </h2>
              <div className="space-y-6">
                {[
                  {
                    q: "Can I buy motorbike warranty online?",
                    a: "Yes! You can get an instant motorcycle warranty quote and buy your motorbike warranty online in just a few minutes. Cover starts immediately upon payment."
                  },
                  {
                    q: "Do you cover used motorcycles?",
                    a: "Absolutely. We specialise in used motorcycle warranty cover for bikes of various ages and mileages. Our extended motorbike warranty plans are perfect for older bikes."
                  },
                  {
                    q: "What's not covered by a motorcycle warranty?",
                    a: "Standard wear and tear items (tyres, brake pads, chains), cosmetic damage, and modifications are typically excluded. Standard electric bicycles and pedal-assisted e-bikes are also not covered."
                  },
                  {
                    q: "How quickly can I make a claim?",
                    a: "Claims can be submitted 24/7. Once approved, you can take your bike to any approved garage in our UK-wide network for repairs."
                  },
                  {
                    q: "What makes you the best motorbike warranty provider UK?",
                    a: "Our specialist knowledge of motorcycles, transparent pricing, flexible payment plans, and excellent customer service make us a trusted choice for thousands of UK riders."
                  },
                  {
                    q: "Can I pay monthly for motorcycle warranty?",
                    a: "Yes! We offer flexible pay monthly motorcycle warranty plans with low deposits, making it easy to budget for your bike protection."
                  }
                ].map((faq, index) => (
                  <div key={index} className="bg-card p-6 rounded-lg border">
                    <h3 className="text-xl font-semibold mb-3">{faq.q}</h3>
                    <p className="text-muted-foreground">{faq.a}</p>
                  </div>
                ))}
              </div>
            </div>
          </div>
        </section>

        {/* Final CTA Section */}
        <section className="bg-primary text-primary-foreground py-16">
          <div className="container mx-auto px-4 text-center">
            <h2 className="text-3xl md:text-4xl font-bold mb-6">
              Ready to Buy Your Motorbike Warranty Online?
            </h2>
            <p className="text-xl mb-8 max-w-2xl mx-auto opacity-90">
              Get started in minutes. Enter your registration, choose your motorcycle warranty cover, and protect your bike today.
            </p>
            <Button 
              onClick={navigateToQuoteForm}
              size="lg"
              variant="secondary"
              className="text-lg px-8 py-6"
            >
              Get Your Motorcycle Warranty Quote Now
            </Button>
          </div>
        </section>

        <NewFooter />
        <WebsiteFooter />

        {/* Floating Contact Buttons */}
        {!isMobile && (
          <>
            <a
              href="https://wa.me/447481339708"
              target="_blank"
              rel="noopener noreferrer"
              className="fixed bottom-6 right-6 z-50 bg-[#25D366] hover:bg-[#20BA5A] text-white p-4 rounded-full shadow-lg transition-all duration-300 hover:scale-110"
              onClick={() => trackButtonClick('motorbike_whatsapp_float')}
            >
              <img src={whatsappIconNew} alt="WhatsApp" className="w-8 h-8" />
            </a>
            <a
              href="tel:02033228888"
              className="fixed bottom-24 right-6 z-50 bg-primary hover:bg-primary/90 text-primary-foreground p-4 rounded-full shadow-lg transition-all duration-300 hover:scale-110"
              onClick={() => trackButtonClick('motorbike_phone_float')}
            >
              <Phone className="w-8 h-8" />
            </a>
          </>
        )}

        {showScrollTop && (
          <button
            onClick={scrollToTop}
            className="fixed bottom-6 left-6 z-50 bg-card border border-border hover:bg-accent text-foreground p-3 rounded-full shadow-lg transition-all duration-300 hover:scale-110"
            aria-label="Scroll to top"
          >
            <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 10l7-7m0 0l7 7m-7-7v18" />
            </svg>
          </button>
        )}

        {/* Company Registration Footer */}
        <div className="bg-muted/30 py-6">
          <div className="container mx-auto px-4">
            <img 
              src={companyRegistration} 
              alt="Buy A Warranty Company Registration" 
              className="mx-auto h-12 opacity-60"
            />
          </div>
        </div>
      </div>
    </>
  );
};

export default MotorbikeWarranty;
