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
import mercedesHeroImage from '@/assets/mercedes-hero.png';
import mercedesVanImage from '@/assets/mercedes-van.png';

const MercedesWarranty = () => {
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
    trackButtonClick('mercedes_warranty_get_quote_cta');
    navigate('/');
    setTimeout(() => {
      const element = document.getElementById('quote-form');
      if (element) {
        element.scrollIntoView({ behavior: 'smooth' });
      }
    }, 100);
  };

  const mercedesFAQs = [
    {
      question: "How much does a Mercedes extended warranty cost in the UK?",
      answer: "Prices vary based on model, mileage and cover level. Most drivers pay £350 to £1,200 per year. AMG and larger SUVs (GLE, GLC, GLS) sit at the higher end due to complex electronics and higher labour rates."
    },
    {
      question: "Is a Mercedes extended warranty worth it?",
      answer: "Yes. Mercedes repairs are expensive, especially for automatic gearboxes, multimedia units, AdBlue systems, and electrical components. A single repair can cost £1,200–£3,000, making a warranty cost-effective for long-term ownership."
    },
    {
      question: "Can I buy a Mercedes extended warranty after purchase?",
      answer: "Yes. You can take out an extended warranty whether your Mercedes was purchased from a dealer, independent trader or privately. Cover can start immediately after inspection or policy validation."
    },
    {
      question: "How much does a 5-year Mercedes extended warranty cost?",
      answer: "A 5-year protection period (stacked renewals) usually ranges from £1,800 to £4,500, depending on cover level and model type. AMG and hybrid models typically cost more due to high repair labour time and part prices."
    },
    {
      question: "What is not covered under a Mercedes extended warranty?",
      answer: "Routine maintenance, wear-and-tear items (brake pads, tyres), cosmetic damage, and issues caused by modifications or missed servicing requirements are not covered. Full exclusions are listed within your policy documents."
    },
    {
      question: "Does an extended warranty cover used Mercedes cars?",
      answer: "Yes. Used Mercedes vehicles qualify as long as they meet mileage and age requirements. We also cover high-mileage Mercedes, including up to 150,000 miles - a limit most providers do not offer."
    }
  ];

  return (
    <>
      <SEOHead
        title="Mercedes-Benz Car Extended Warranty | Affordable Used Car Cover"
        description="Protect your Mercedes from costly repairs with our extended warranty. Covers new, used and high-mileage Mercedes up to 150,000 miles. Fast claims & wide garages."
        keywords="mercedes extended warranty, mercedes warranty UK, used mercedes warranty, mercedes c class warranty, mercedes e class warranty, mercedes amg warranty"
        canonical="https://buyawarranty.co.uk/car-extended-warranty/mercedes-benz/"
      />
      
      <OrganizationSchema type="InsuranceAgency" />
      
      <WebPageSchema
        name="Mercedes-Benz Extended Warranty - Buy A Warranty"
        description="Protect your Mercedes from costly repairs with our extended warranty. Covers new, used and high-mileage Mercedes up to 150,000 miles. Fast claims & wide garages."
        url="https://buyawarranty.co.uk/car-extended-warranty/mercedes-benz/"
        lastReviewed={new Date().toISOString()}
        significantLink="https://buyawarranty.co.uk/"
        specialty="Mercedes-Benz Extended Warranties"
      />
      
      <ProductSchema
        name="Mercedes-Benz Extended Warranty"
        description="Comprehensive extended warranty coverage for Mercedes-Benz vehicles including engine, gearbox, electrical systems, ECU, MBUX infotainment, hybrid and AMG models."
        price="600.00"
        brand="Buy A Warranty"
        category="Car Insurance & Warranty"
        image="https://buyawarranty.co.uk/lovable-uploads/53652a24-3961-4346-bf9d-6588ef727aeb.png"
        availability="https://schema.org/InStock"
        areaServed="United Kingdom"
      />
      
      <FAQSchema faqs={mercedesFAQs} />
      
      <BreadcrumbSchema
        items={[
          { name: 'Home', url: 'https://buyawarranty.co.uk/' },
          { name: 'Car Extended Warranty', url: 'https://buyawarranty.co.uk/car-extended-warranty/' },
          { name: 'Mercedes-Benz Warranty', url: 'https://buyawarranty.co.uk/car-extended-warranty/mercedes-benz/' }
        ]}
      />

      <div className="min-h-screen bg-background">
        <TrustpilotHeader />
        
        {/* Navigation */}
        <nav className="bg-white shadow-sm py-1 sm:py-2 sticky top-0 z-50">
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
        </nav>

        {/* Hero Section */}
        <section className="relative bg-gradient-to-br from-primary/5 via-background to-accent/5 py-12 md:py-20 overflow-hidden">
          <div className="container mx-auto px-4">
            <div className="grid lg:grid-cols-2 gap-8 items-center">
              <div className="space-y-6">
                <h1 className="text-4xl md:text-5xl lg:text-6xl font-bold leading-tight">
                  Mercedes-Benz Extended Warranty
                </h1>
                <p className="text-lg md:text-xl text-muted-foreground">
                  Drive with confidence. Protect your Mercedes from expensive repairs once the manufacturer's warranty expires.
                </p>
                <p className="text-base md:text-lg">
                  A Mercedes-Benz extended warranty protects you from unexpected mechanical or electrical repair bills once the original 3-year manufacturer warranty ends. It covers major systems such as the engine, gearbox, electrics, multimedia and drivetrain. You can buy cover for used, new and high-mileage Mercedes models in the UK.
                </p>
                <div className="flex flex-col sm:flex-row gap-4">
                  <Button size="lg" onClick={navigateToQuoteForm} className="text-lg px-8">
                    Get My Mercedes Quote →
                  </Button>
                  <a 
                    href="https://wa.me/447831592487" 
                    target="_blank" 
                    rel="noopener noreferrer"
                    className="inline-flex items-center justify-center gap-2 px-8 py-3 bg-[#25D366] hover:bg-[#20BD5A] text-white rounded-lg transition-colors"
                  >
                    <img src={whatsappIconNew} alt="WhatsApp" className="w-6 h-6" />
                    <span className="text-lg font-medium">WhatsApp Us</span>
                  </a>
                </div>
              </div>
              <div className="relative">
                <img 
                  src={mercedesHeroImage} 
                  alt="Mercedes-Benz Extended Warranty Coverage" 
                  className="w-full h-auto rounded-lg"
                />
              </div>
            </div>
          </div>
        </section>

        {/* Why Choose Section */}
        <section className="py-16 bg-background">
          <div className="container mx-auto px-4">
            <div className="max-w-4xl mx-auto">
              <h2 className="text-3xl md:text-4xl font-bold mb-8">Why Choose a Mercedes-Benz Extended Warranty?</h2>
              <p className="text-lg mb-6">
                Mercedes cars are built with advanced engineering, complex electronics and premium components. When something fails, the repair bills can be shockingly high.
              </p>
              <p className="text-lg mb-6">
                Instead of paying thousands in unexpected repair costs, an extended warranty gives you:
              </p>
              <div className="grid md:grid-cols-3 gap-6 mb-8">
                <div className="bg-card p-6 rounded-lg border">
                  <CheckCircle2 className="w-12 h-12 text-primary mb-4" />
                  <h3 className="text-xl font-semibold mb-2">Predictable running costs</h3>
                </div>
                <div className="bg-card p-6 rounded-lg border">
                  <Shield className="w-12 h-12 text-primary mb-4" />
                  <h3 className="text-xl font-semibold mb-2">Protection against unexpected failures</h3>
                </div>
                <div className="bg-card p-6 rounded-lg border">
                  <CheckCircle2 className="w-12 h-12 text-primary mb-4" />
                  <h3 className="text-xl font-semibold mb-2">Peace of mind with every journey</h3>
                </div>
              </div>
              <p className="text-lg mb-6">
                We provide cover for new, used and high-mileage Mercedes-Benz vehicles, including AMG and diesel engines, petrol, hybrid and plug-in models.
              </p>
              <div className="bg-primary/10 border-l-4 border-primary p-6 rounded-r-lg">
                <p className="text-lg font-semibold">
                  ✅ We are the only warranty provider offering high-mileage protection up to 150,000 miles.
                </p>
              </div>
            </div>
          </div>
        </section>

        {/* Coverage Section */}
        <section className="py-16 bg-muted/50">
          <div className="container mx-auto px-4">
            <div className="max-w-4xl mx-auto">
              <h2 className="text-3xl md:text-4xl font-bold mb-8">What Does Our Mercedes Extended Warranty Cover?</h2>
              <p className="text-lg mb-8">
                Our cover protects the most expensive components found in modern Mercedes-Benz vehicles:
              </p>
              
              <div className="space-y-8">
                <div className="bg-card p-6 rounded-lg border">
                  <h3 className="text-2xl font-semibold mb-4 flex items-center gap-2">
                    <CheckCircle2 className="text-primary" />
                    Mechanical & Electrical Systems
                  </h3>
                  <ul className="space-y-3 ml-8">
                    <li className="flex items-start gap-2">
                      <CheckCircle2 className="w-5 h-5 text-primary mt-1 flex-shrink-0" />
                      <span>Engine, timing gears and turbocharging units</span>
                    </li>
                    <li className="flex items-start gap-2">
                      <CheckCircle2 className="w-5 h-5 text-primary mt-1 flex-shrink-0" />
                      <span>Automatic & DSG gearboxes</span>
                    </li>
                    <li className="flex items-start gap-2">
                      <CheckCircle2 className="w-5 h-5 text-primary mt-1 flex-shrink-0" />
                      <span>Transmission and drivetrain</span>
                    </li>
                    <li className="flex items-start gap-2">
                      <CheckCircle2 className="w-5 h-5 text-primary mt-1 flex-shrink-0" />
                      <span>Fuel system & injection components</span>
                    </li>
                  </ul>
                </div>

                <div className="bg-card p-6 rounded-lg border">
                  <h3 className="text-2xl font-semibold mb-4 flex items-center gap-2">
                    <CheckCircle2 className="text-primary" />
                    Advanced Technology & Electrics
                  </h3>
                  <ul className="space-y-3 ml-8">
                    <li className="flex items-start gap-2">
                      <CheckCircle2 className="w-5 h-5 text-primary mt-1 flex-shrink-0" />
                      <span>ECU, infotainment, digital dashboard, multimedia units</span>
                    </li>
                    <li className="flex items-start gap-2">
                      <CheckCircle2 className="w-5 h-5 text-primary mt-1 flex-shrink-0" />
                      <span>MBUX screens and connected-tech control modules</span>
                    </li>
                    <li className="flex items-start gap-2">
                      <CheckCircle2 className="w-5 h-5 text-primary mt-1 flex-shrink-0" />
                      <span>Parking sensors, cameras and driver-assist tech</span>
                    </li>
                  </ul>
                </div>

                <div className="bg-card p-6 rounded-lg border">
                  <h3 className="text-2xl font-semibold mb-4 flex items-center gap-2">
                    <CheckCircle2 className="text-primary" />
                    Comfort & Convenience
                  </h3>
                  <ul className="space-y-3 ml-8">
                    <li className="flex items-start gap-2">
                      <CheckCircle2 className="w-5 h-5 text-primary mt-1 flex-shrink-0" />
                      <span>Air conditioning and climate control</span>
                    </li>
                    <li className="flex items-start gap-2">
                      <CheckCircle2 className="w-5 h-5 text-primary mt-1 flex-shrink-0" />
                      <span>Suspension (including air suspension)</span>
                    </li>
                    <li className="flex items-start gap-2">
                      <CheckCircle2 className="w-5 h-5 text-primary mt-1 flex-shrink-0" />
                      <span>Steering systems</span>
                    </li>
                  </ul>
                </div>
              </div>

              <p className="text-lg mt-8">
                If a covered component fails, we pay for labour, diagnostics and parts up to your claim limit. For full details of what is included, please see our <Link to="/what-we-cover" className="text-primary hover:underline">"What's Covered"</Link> page.
              </p>
            </div>
          </div>
        </section>

        {/* Repair Costs Table */}
        <section className="py-16 bg-background">
          <div className="container mx-auto px-4">
            <div className="max-w-4xl mx-auto">
              <h2 className="text-3xl md:text-4xl font-bold mb-8">Average Mercedes Repair Costs in the UK</h2>
              <div className="overflow-x-auto">
                <table className="w-full border-collapse bg-card rounded-lg overflow-hidden">
                  <thead>
                    <tr className="bg-primary text-primary-foreground">
                      <th className="p-4 text-left font-semibold">Mercedes Component Failure</th>
                      <th className="p-4 text-left font-semibold">Average Repair Cost</th>
                    </tr>
                  </thead>
                  <tbody>
                    <tr className="border-b">
                      <td className="p-4">Automatic gearbox fault</td>
                      <td className="p-4 font-semibold">£1,200 – £2,600</td>
                    </tr>
                    <tr className="border-b">
                      <td className="p-4">ECU / electronics failure</td>
                      <td className="p-4 font-semibold">£400 – £1,200</td>
                    </tr>
                    <tr className="border-b">
                      <td className="p-4">Air suspension failure (AIRMATIC)</td>
                      <td className="p-4 font-semibold">£900 – £2,400</td>
                    </tr>
                    <tr className="border-b">
                      <td className="p-4">Fuel injection pump</td>
                      <td className="p-4 font-semibold">£600 – £1,000</td>
                    </tr>
                    <tr>
                      <td className="p-4">MBUX infotainment/screen failure</td>
                      <td className="p-4 font-semibold">£800 – £1,850</td>
                    </tr>
                  </tbody>
                </table>
              </div>
              <p className="text-lg mt-6 font-semibold text-primary">
                A single repair can cost more than a full year of warranty cover.
              </p>
            </div>
          </div>
        </section>

        {/* Mercedes Van Image */}
        <section className="py-16 bg-muted/50">
          <div className="container mx-auto px-4">
            <div className="max-w-4xl mx-auto text-center">
              <img 
                src={mercedesVanImage} 
                alt="Mercedes-Benz Van Extended Warranty" 
                className="w-full max-w-[180px] mx-auto h-auto rounded-lg"
              />
            </div>
          </div>
        </section>

        {/* Models Covered */}
        <section className="py-16 bg-background">
          <div className="container mx-auto px-4">
            <div className="max-w-4xl mx-auto">
              <h2 className="text-3xl md:text-4xl font-bold mb-8">Mercedes Models We Cover</h2>
              <p className="text-lg mb-8">We cover every UK Mercedes-Benz model, including:</p>
              <div className="grid md:grid-cols-3 gap-4">
                <div className="bg-card p-4 rounded-lg border">
                  <ul className="space-y-2">
                    <li className="flex items-center gap-2"><CheckCircle2 className="w-5 h-5 text-primary flex-shrink-0" /> A-Class</li>
                    <li className="flex items-center gap-2"><CheckCircle2 className="w-5 h-5 text-primary flex-shrink-0" /> B-Class</li>
                    <li className="flex items-center gap-2"><CheckCircle2 className="w-5 h-5 text-primary flex-shrink-0" /> C-Class</li>
                    <li className="flex items-center gap-2"><CheckCircle2 className="w-5 h-5 text-primary flex-shrink-0" /> E-Class</li>
                    <li className="flex items-center gap-2"><CheckCircle2 className="w-5 h-5 text-primary flex-shrink-0" /> S-Class</li>
                  </ul>
                </div>
                <div className="bg-card p-4 rounded-lg border">
                  <ul className="space-y-2">
                    <li className="flex items-center gap-2"><CheckCircle2 className="w-5 h-5 text-primary flex-shrink-0" /> GLA</li>
                    <li className="flex items-center gap-2"><CheckCircle2 className="w-5 h-5 text-primary flex-shrink-0" /> GLB</li>
                    <li className="flex items-center gap-2"><CheckCircle2 className="w-5 h-5 text-primary flex-shrink-0" /> GLC</li>
                    <li className="flex items-center gap-2"><CheckCircle2 className="w-5 h-5 text-primary flex-shrink-0" /> GLE</li>
                    <li className="flex items-center gap-2"><CheckCircle2 className="w-5 h-5 text-primary flex-shrink-0" /> GLS</li>
                  </ul>
                </div>
                <div className="bg-card p-4 rounded-lg border">
                  <ul className="space-y-2">
                    <li className="flex items-center gap-2"><CheckCircle2 className="w-5 h-5 text-primary flex-shrink-0" /> CLA</li>
                    <li className="flex items-center gap-2"><CheckCircle2 className="w-5 h-5 text-primary flex-shrink-0" /> CLS</li>
                    <li className="flex items-center gap-2"><CheckCircle2 className="w-5 h-5 text-primary flex-shrink-0" /> SL</li>
                    <li className="flex items-center gap-2"><CheckCircle2 className="w-5 h-5 text-primary flex-shrink-0" /> SLC</li>
                    <li className="flex items-center gap-2"><CheckCircle2 className="w-5 h-5 text-primary flex-shrink-0" /> Maybach</li>
                  </ul>
                </div>
              </div>
              <div className="grid md:grid-cols-2 gap-4 mt-4">
                <div className="bg-card p-4 rounded-lg border">
                  <p className="font-semibold flex items-center gap-2">
                    <CheckCircle2 className="w-5 h-5 text-primary flex-shrink-0" />
                    AMG Models (A45, C63, E63, GT)
                  </p>
                </div>
                <div className="bg-card p-4 rounded-lg border">
                  <p className="font-semibold flex items-center gap-2">
                    <CheckCircle2 className="w-5 h-5 text-primary flex-shrink-0" />
                    Vans (Vito, Sprinter, V-Class)
                  </p>
                </div>
              </div>
            </div>
          </div>
        </section>

        {/* Warranty Plans */}
        <section className="py-16 bg-muted/50">
          <div className="container mx-auto px-4">
            <div className="max-w-4xl mx-auto">
              <h2 className="text-3xl md:text-4xl font-bold mb-8">Warranty Plans Available</h2>
              <div className="overflow-x-auto">
                <table className="w-full border-collapse bg-card rounded-lg overflow-hidden">
                  <thead>
                    <tr className="bg-primary text-primary-foreground">
                      <th className="p-4 text-left font-semibold">Plan Type</th>
                      <th className="p-4 text-left font-semibold">Best For</th>
                      <th className="p-4 text-left font-semibold">Coverage Includes</th>
                    </tr>
                  </thead>
                  <tbody>
                    <tr className="border-b">
                      <td className="p-4 font-semibold">New / Nearly New</td>
                      <td className="p-4">Cars under 4 years</td>
                      <td className="p-4">Full mechanical + electrical + multimedia</td>
                    </tr>
                    <tr className="border-b">
                      <td className="p-4 font-semibold">Used Mercedes Warranty</td>
                      <td className="p-4">Cars 4-10 years</td>
                      <td className="p-4">Engine, gearbox, electrics, MOT-related failures</td>
                    </tr>
                    <tr>
                      <td className="p-4 font-semibold">High-Mileage Warranty</td>
                      <td className="p-4">Cars up to 150,000 miles</td>
                      <td className="p-4">Listed part coverage + diagnostics</td>
                    </tr>
                  </tbody>
                </table>
              </div>
              <p className="text-lg mt-6 font-semibold">
                No inspection required. No dealership pricing.
              </p>
            </div>
          </div>
        </section>

        {/* Worth It Section */}
        <section className="py-16 bg-background">
          <div className="container mx-auto px-4">
            <div className="max-w-4xl mx-auto">
              <h2 className="text-3xl md:text-4xl font-bold mb-6">Is a Mercedes-Benz Extended Warranty Worth It?</h2>
              <p className="text-lg mb-4">Yes - especially because:</p>
              <ul className="space-y-3 ml-8 mb-6">
                <li className="flex items-start gap-2">
                  <CheckCircle2 className="w-5 h-5 text-primary mt-1 flex-shrink-0" />
                  <span>Mercedes repairs are costly due to high-tech engineering.</span>
                </li>
                <li className="flex items-start gap-2">
                  <CheckCircle2 className="w-5 h-5 text-primary mt-1 flex-shrink-0" />
                  <span>AMGs, diesels and hybrid models are known for expensive part failures.</span>
                </li>
                <li className="flex items-start gap-2">
                  <CheckCircle2 className="w-5 h-5 text-primary mt-1 flex-shrink-0" />
                  <span>One unexpected repair can exceed the cost of an entire warranty.</span>
                </li>
              </ul>
            </div>
          </div>
        </section>

        {/* Pricing Section */}
        <section className="py-16 bg-muted/50">
          <div className="container mx-auto px-4">
            <div className="max-w-4xl mx-auto">
              <h2 className="text-3xl md:text-4xl font-bold mb-6">Cost of Mercedes Extended Warranty (UK)</h2>
              <p className="text-lg">
                Mercedes extended warranty pricing depends primarily on your model, the vehicle's age and mileage, and the level of cover you choose (comprehensive or listed component). On average, plans range from £350 to £1,200 per year. Higher-performance and premium models, such as AMG, GLE, or GLC, typically fall at the upper end due to more advanced components and higher repair costs.
              </p>
            </div>
          </div>
        </section>

        {/* Claims Process */}
        <section className="py-16 bg-background">
          <div className="container mx-auto px-4">
            <div className="max-w-4xl mx-auto">
              <h2 className="text-3xl md:text-4xl font-bold mb-8">How Our Claims Process Works</h2>
              <div className="grid md:grid-cols-4 gap-6">
                <div className="text-center">
                  <div className="bg-primary/10 rounded-full w-16 h-16 flex items-center justify-center mx-auto mb-4">
                    <span className="text-2xl font-bold text-primary">1</span>
                  </div>
                  <p className="font-semibold">Visit any VAT-registered garage in the UK.</p>
                </div>
                <div className="text-center">
                  <div className="bg-primary/10 rounded-full w-16 h-16 flex items-center justify-center mx-auto mb-4">
                    <span className="text-2xl font-bold text-primary">2</span>
                  </div>
                  <p className="font-semibold">The garage diagnoses the issue.</p>
                </div>
                <div className="text-center">
                  <div className="bg-primary/10 rounded-full w-16 h-16 flex items-center justify-center mx-auto mb-4">
                    <span className="text-2xl font-bold text-primary">3</span>
                  </div>
                  <p className="font-semibold">We approve the repair and pay the garage directly.</p>
                </div>
                <div className="text-center">
                  <div className="bg-primary/10 rounded-full w-16 h-16 flex items-center justify-center mx-auto mb-4">
                    <CheckCircle2 className="w-8 h-8 text-primary" />
                  </div>
                  <p className="font-semibold">No upfront repair payments.</p>
                </div>
              </div>
            </div>
          </div>
        </section>

        {/* FAQs */}
        <section className="py-16 bg-muted/50">
          <div className="container mx-auto px-4">
            <div className="max-w-4xl mx-auto">
              <h2 className="text-3xl md:text-4xl font-bold mb-8">FAQs</h2>
              <div className="space-y-6">
                {mercedesFAQs.map((faq, index) => (
                  <div key={index} className="bg-card p-6 rounded-lg border">
                    <h3 className="text-xl font-semibold mb-3 faq-question">{faq.question}</h3>
                    <p className="text-muted-foreground">{faq.answer}</p>
                  </div>
                ))}
              </div>
            </div>
          </div>
        </section>

        {/* Final CTA */}
        <section className="py-16 bg-primary text-primary-foreground">
          <div className="container mx-auto px-4 text-center">
            <div className="max-w-3xl mx-auto">
              <h2 className="text-3xl md:text-4xl font-bold mb-6">Ready to Protect Your Mercedes?</h2>
              <p className="text-xl mb-8">
                Don't wait for a breakdown to happen. Check your price, choose your cover, and secure peace of mind today.
              </p>
              <Button 
                size="lg" 
                variant="secondary"
                onClick={navigateToQuoteForm}
                className="text-lg px-8"
              >
                Get my Mercedes warranty quote →
              </Button>
              <p className="text-sm mt-4 opacity-90">Takes less than 60 seconds. No phone calls, no pressure - just instant pricing.</p>
            </div>
          </div>
        </section>

        {/* Trustpilot Section */}
        <section className="py-16 bg-background">
          <div className="container mx-auto px-4">
            <div className="max-w-4xl mx-auto text-center">
              <img 
                src={trustpilotLogo} 
                alt="Trustpilot Excellent Rating" 
                className="h-24 mx-auto mb-6"
              />
              <p className="text-lg text-muted-foreground">
                Join thousands of satisfied Mercedes owners who trust us to protect their vehicles.
              </p>
            </div>
          </div>
        </section>

        {/* Scroll to Top Button */}
        {showScrollTop && (
          <button
            onClick={scrollToTop}
            className="fixed bottom-8 right-8 bg-primary text-primary-foreground p-4 rounded-full shadow-lg hover:bg-primary/90 transition-all z-50"
            aria-label="Scroll to top"
          >
            <svg xmlns="http://www.w3.org/2000/svg" className="h-6 w-6" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 10l7-7m0 0l7 7m-7-7v18" />
            </svg>
          </button>
        )}

        <NewFooter />
      </div>
    </>
  );
};

export default MercedesWarranty;
