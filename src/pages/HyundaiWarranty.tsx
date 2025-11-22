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
import hyundaiHeroImage from '@/assets/kona-kia-extended-used-car-warranty.png';

const HyundaiWarranty = () => {
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
    trackButtonClick('hyundai_warranty_get_quote_cta');
    navigate('/');
    setTimeout(() => {
      const element = document.getElementById('quote-form');
      if (element) {
        element.scrollIntoView({ behavior: 'smooth' });
      }
    }, 100);
  };

  const hyundaiFAQs = [
    {
      question: "Can I buy a Hyundai extended warranty after I've already purchased the car?",
      answer: "Yes. You do not need to buy a warranty at the point of sale. You can take out extended cover any time, even if: You bought the Hyundai privately, It was purchased from an independent dealer, The original Hyundai 5-year manufacturer's warranty has expired. All we need is your reg and mileage."
    },
    {
      question: "Is a Hyundai extended warranty worth it?",
      answer: "Yes, especially once the 5-year Hyundai manufacturer warranty expires. Hyundai repairs can be costly because many parts are electronic modules, not simple mechanical repairs. For example: Gearbox repairs on a Hyundai i30 can exceed £1,800. High-voltage inverter failures on Ioniq Electric or Kona EV can cost £3,000–£7,000. One major repair can cost more than a full year of cover."
    },
    {
      question: "Is a clutch covered under a Hyundai extended warranty?",
      answer: "Yes, if the failure is due to a mechanical or electrical fault. Clutch wear from driving habits (slipping, riding the clutch) is not covered under any warranty in the UK, including manufacturer warranties."
    },
    {
      question: "Can I get a warranty on a used Hyundai with high mileage?",
      answer: "Yes. We are one of the only UK warranty providers offering cover up to 150,000 miles, including: Hyundai Tucson, Hyundai Santa Fe, Hyundai i30 / i40, Kona Electric / Ioniq EV. Most warranty companies stop at 100,000 miles. We go further."
    },
    {
      question: "Are hybrid and electric Hyundai models included? (Ioniq / Kona / Ioniq 5 / Ioniq 6)",
      answer: "Yes. We cover: Hybrid drivetrain components, EV powertrain and charging systems, Battery management and inverter units. Battery degradation due to natural ageing is not covered by any extended warranty provider."
    }
  ];

  return (
    <>
      <SEOHead
        title="Hyundai Extended Warranty | Used Hyundai Cover & Instant Quotes"
        description="Extend your Hyundai warranty and protect against expensive repairs. Get instant quotes for used Hyundai cover, including high-mileage cars up to 150,000 miles."
        keywords="hyundai extended warranty, hyundai warranty UK, used hyundai warranty, hyundai ioniq warranty, hyundai tucson warranty, hyundai kona warranty"
        canonical="https://buyawarranty.co.uk/car-extended-warranty/hyundai/"
      />
      
      <OrganizationSchema type="InsuranceAgency" />
      
      <WebPageSchema
        name="Hyundai Extended Warranty - Buy A Warranty"
        description="Extend your Hyundai warranty and protect against expensive repairs. Get instant quotes for used Hyundai cover, including high-mileage cars up to 150,000 miles."
        url="https://buyawarranty.co.uk/car-extended-warranty/hyundai/"
        lastReviewed={new Date().toISOString()}
        significantLink="https://buyawarranty.co.uk/"
        specialty="Hyundai Extended Warranties"
      />
      
      <ProductSchema
        name="Hyundai Extended Warranty"
        description="Comprehensive extended warranty coverage for Hyundai vehicles including engine, gearbox, electrical systems, ECU, hybrid and EV components."
        price="300.00"
        brand="Buy A Warranty"
        category="Car Insurance & Warranty"
        image="https://buyawarranty.co.uk/lovable-uploads/53652a24-3961-4346-bf9d-6588ef727aeb.png"
        availability="https://schema.org/InStock"
        areaServed="United Kingdom"
      />
      
      <FAQSchema faqs={hyundaiFAQs} />
      
      <BreadcrumbSchema
        items={[
          { name: "Home", url: "https://buyawarranty.co.uk/" },
          { name: "Car Extended Warranty", url: "https://buyawarranty.co.uk/car-extended-warranty/" },
          { name: "Hyundai Warranty", url: "https://buyawarranty.co.uk/car-extended-warranty/hyundai/" }
        ]}
      />

      <div className="min-h-screen bg-gradient-to-b from-background to-muted/20">
        {/* Hero Section */}
        <section className="container mx-auto px-4 py-12 md:py-20">
          <div className="grid lg:grid-cols-2 gap-8 lg:gap-12 items-center">
            <div className="space-y-6 text-center lg:text-left">
              <h1 className="text-4xl md:text-5xl lg:text-6xl font-bold tracking-tight">
                Hyundai Extended Warranty
              </h1>
              <p className="text-xl md:text-2xl font-bold text-primary">
                Extend Protection After Hyundai's 5-Year Warranty Ends
              </p>
              <p className="text-lg md:text-xl text-muted-foreground max-w-2xl mx-auto lg:mx-0">
                A Hyundai extended warranty protects you from costly repairs after the original manufacturer's warranty expires. Modern Hyundais rely on advanced electrical and ECU systems, and when they fail, the repair bill is yours.
              </p>
              <div className="flex flex-col sm:flex-row gap-4 justify-center lg:justify-start">
                <Button onClick={navigateToQuoteForm} size="lg" className="text-lg px-8 py-6 bg-primary hover:bg-primary/90">
                  Get Instant Hyundai Warranty Quote
                </Button>
              </div>
            </div>
            <div className="space-y-6">
              <img 
                src={hyundaiHeroImage} 
                alt="Hyundai Kona extended used car warranty" 
                className="w-full h-auto object-cover"
              />
              <div className="flex justify-center lg:justify-start">
                <TrustpilotHeader />
              </div>
            </div>
          </div>
        </section>

        {/* Drive Confidently Section */}
        <section className="bg-card py-16">
          <div className="container mx-auto px-4">
            <div className="max-w-4xl mx-auto text-center space-y-6">
              <h2 className="text-3xl md:text-4xl font-bold">
                Drive Confidently With Hyundai Warranty Protection
              </h2>
              <p className="text-lg text-muted-foreground">
                Hyundai cars are engineered for reliability, but even the most dependable vehicles can face unexpected repairs. An extended Hyundai warranty shields you from sudden costs while keeping you on the road without interruption.
              </p>
              <p className="text-lg text-muted-foreground">
                Whether you drive a Hyundai i10, Tucson, Ioniq, or Santa Fe, our plans offer flexible protection designed around real-life ownership, not generic terms.
              </p>
              <div className="grid md:grid-cols-2 gap-6 mt-8">
                {[
                  "Cover for new and used Hyundai cars",
                  "Instant online quotes - no paperwork",
                  "No hidden fees, no confusing jargon"
                ].map((item, index) => (
                  <div key={index} className="flex items-start gap-3">
                    <CheckCircle2 className="w-6 h-6 text-primary flex-shrink-0 mt-0.5" />
                    <span className="text-lg text-left">{item}</span>
                  </div>
                ))}
              </div>
              <p className="text-lg font-semibold text-primary mt-6">
                We are the only UK warranty provider offering high-mileage cover up to 150,000 miles.
              </p>
            </div>
          </div>
        </section>

        {/* Cost Section */}
        <section className="container mx-auto px-4 py-16">
          <div className="max-w-4xl mx-auto space-y-6">
            <h2 className="text-3xl md:text-4xl font-bold text-center">
              How Much Does A Hyundai Extended Warranty Cost?
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
            <p className="text-lg text-muted-foreground text-center">
              The cost depends on the model, age and mileage of your Hyundai. On average, extended warranty prices range between £300 and £800 per year for used Hyundais (i10, i20, i30). Larger SUVs, such as the Tucson or Santa Fe, and hybrid/EV models (Kona Electric, Ioniq, and Ioniq 5) may cost more due to advanced systems and higher repair costs.
            </p>
            <p className="text-lg text-center font-semibold">
              You can receive an exact price in seconds by entering your registration.
            </p>
          </div>
        </section>

        {/* What's Covered */}
        <section className="bg-muted/30 py-16">
          <div className="container mx-auto px-4">
            <div className="max-w-4xl mx-auto space-y-8">
              <h2 className="text-3xl md:text-4xl font-bold text-center">
                What Does Our Hyundai Extended Warranty Cover?
              </h2>
              <p className="text-lg text-center text-muted-foreground">
                Our Hyundai warranty plans include protection for major mechanical and electrical components that are costly to fix.
              </p>
              <div className="bg-card p-8 rounded-lg">
                <h3 className="text-2xl font-bold mb-6">Key Components Covered:</h3>
                <ul className="space-y-4">
                  {[
                    "Engine and gearbox",
                    "Automatic and manual transmission",
                    "Clutch and drivetrain",
                    "Suspension and steering systems",
                    "Braking and ABS systems",
                    "Electrical and electronic components",
                    "In-car multimedia/infotainment"
                  ].map((item, index) => (
                    <li key={index} className="flex items-start gap-3">
                      <CheckCircle2 className="w-6 h-6 text-primary flex-shrink-0 mt-0.5" />
                      <span className="text-lg">{item}</span>
                    </li>
                  ))}
                </ul>
                <p className="text-lg font-semibold mt-6">
                  If a covered part fails, the warranty pays for parts, labour, and diagnostics.
                </p>
              </div>

              <div className="bg-card p-8 rounded-lg border-2 border-red-200">
                <h3 className="text-2xl font-bold mb-4">What Is Not Covered?</h3>
                <p className="text-muted-foreground mb-4">To be clear and transparent, the warranty does not cover:</p>
                <ul className="space-y-3">
                  {[
                    "Routine servicing",
                    "Wear and tear consumables (tyres, brake pads, etc.)",
                    "Accident or impact damage",
                    "Modifications not approved by Hyundai"
                  ].map((item, index) => (
                    <li key={index} className="flex items-start gap-3">
                      <span className="text-red-600 font-bold">✗</span>
                      <span>{item}</span>
                    </li>
                  ))}
                </ul>
              </div>
            </div>
          </div>
        </section>

        {/* Coverage Comparison Table */}
        <section className="container mx-auto px-4 py-16">
          <div className="max-w-5xl mx-auto">
            <h2 className="text-3xl md:text-4xl font-bold text-center mb-12">
              Hyundai Warranty Coverage Comparison
            </h2>
            <div className="bg-card rounded-lg border overflow-hidden">
              <div className="overflow-x-auto">
                <table className="w-full">
                  <thead className="bg-primary text-white">
                    <tr>
                      <th className="px-6 py-4 text-left">Coverage Type</th>
                      <th className="px-6 py-4 text-center">Manufacturer (5yr)</th>
                      <th className="px-6 py-4 text-center">Dealer Used-Car</th>
                      <th className="px-6 py-4 text-center">Our Extended</th>
                    </tr>
                  </thead>
                  <tbody>
                    {[
                      { name: "Engine & Gearbox", manufacturer: "✔", dealer: "Partial", ours: "✔" },
                      { name: "Electronics", manufacturer: "✔", dealer: "Limited", ours: "✔" },
                      { name: "Multimedia", manufacturer: "Limited", dealer: "✗", ours: "✔" },
                      { name: "Diagnostics", manufacturer: "✗", dealer: "✗", ours: "✔" },
                      { name: "Breakdown Assistance", manufacturer: "✗", dealer: "✗", ours: "Optional" }
                    ].map((row, index) => (
                      <tr key={index} className={index % 2 === 0 ? 'bg-background' : 'bg-muted/20'}>
                        <td className="px-6 py-4 font-semibold">{row.name}</td>
                        <td className="px-6 py-4 text-center">{row.manufacturer}</td>
                        <td className="px-6 py-4 text-center">{row.dealer}</td>
                        <td className="px-6 py-4 text-center font-bold text-primary">{row.ours}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>
          </div>
        </section>

        {/* How It Works */}
        <section className="bg-card py-16">
          <div className="container mx-auto px-4">
            <div className="max-w-4xl mx-auto text-center space-y-12">
              <div>
                <h2 className="text-3xl md:text-4xl font-bold mb-4">
                  How It Works
                </h2>
              </div>
              <div className="grid md:grid-cols-3 gap-6">
                {[
                  { num: "1", text: "Enter your Hyundai registration" },
                  { num: "2", text: "Choose your cover level" },
                  { num: "3", text: "Get protected instantly" }
                ].map((step, index) => (
                  <div key={index} className="bg-background p-6 rounded-lg border">
                    <div className="text-4xl font-bold text-primary mb-4">{step.num}</div>
                    <p className="text-lg">{step.text}</p>
                  </div>
                ))}
              </div>
              <p className="text-lg">You can spread the cost monthly or pay annually for additional savings.</p>
              <Button onClick={navigateToQuoteForm} size="lg" className="text-lg px-8 py-6">
                Get Instant Hyundai Warranty Quote
              </Button>
            </div>
          </div>
        </section>

        {/* Used Hyundai Warranty */}
        <section className="container mx-auto px-4 py-16">
          <div className="max-w-4xl mx-auto space-y-6">
            <h2 className="text-3xl md:text-4xl font-bold text-center">
              Used Hyundai Warranty - Ideal For Older Vehicles
            </h2>
            <p className="text-lg text-muted-foreground text-center">
              Bought a used Hyundai or planning to extend coverage beyond the original 5-year term?
            </p>
            <p className="text-lg text-center">
              A used Hyundai extended warranty is one of the best ways to avoid sudden repair bills, such as:
            </p>
            <div className="bg-card rounded-lg border p-8">
              <ul className="space-y-4">
                {[
                  "Timing chain failures",
                  "Gearbox repairs",
                  "Electrical and ECU faults"
                ].map((item, index) => (
                  <li key={index} className="flex items-start gap-3">
                    <CheckCircle2 className="w-6 h-6 text-primary flex-shrink-0 mt-0.5" />
                    <span className="text-lg">{item}</span>
                  </li>
                ))}
              </ul>
              <p className="text-lg font-semibold mt-6">
                These repairs can range from £800 to £2,000+.
              </p>
              <p className="text-lg mt-4">
                With our warranty, you stay protected and avoid unexpected downtime.
              </p>
            </div>
          </div>
        </section>

        {/* Hyundai Models Covered */}
        <section className="bg-muted/30 py-16">
          <div className="container mx-auto px-4">
            <div className="max-w-6xl mx-auto">
              <h2 className="text-3xl md:text-4xl font-bold text-center mb-8">
                Hyundai Models We Cover
              </h2>
              <p className="text-lg text-muted-foreground text-center mb-12">
                We provide cover for all Hyundai vehicles - including used and high-mileage up to 150,000 miles.
              </p>
              <div className="bg-card rounded-lg border overflow-hidden">
                <div className="overflow-x-auto">
                  <table className="w-full">
                    <thead className="bg-primary text-white">
                      <tr>
                        <th className="px-4 py-3 text-left">Model</th>
                        <th className="px-4 py-3 text-left">Type</th>
                        <th className="px-4 py-3 text-left">Typical Repair</th>
                        <th className="px-4 py-3 text-right">Cost Without Warranty</th>
                      </tr>
                    </thead>
                    <tbody className="text-sm">
                      {[
                        { model: "i10", type: "Petrol / Automatic", repair: "Gearbox, electrics", cost: "£350 – £900" },
                        { model: "i20", type: "Petrol / Hybrid", repair: "Clutch, ECU, alternator", cost: "£450 – £1,200" },
                        { model: "i30 / i30 N", type: "Petrol / Performance", repair: "Turbo, gearbox, suspension", cost: "£600 – £2,000" },
                        { model: "i40", type: "Diesel / Estate", repair: "Engine & DPF repairs", cost: "£800 – £2,500" },
                        { model: "ix20", type: "Petrol / Diesel", repair: "Electrical faults", cost: "£500 – £1,400" },
                        { model: "ix35", type: "SUV", repair: "Clutch, steering rack, DPF", cost: "£500 – £1,900" },
                        { model: "Tucson", type: "Petrol / Hybrid / PHEV", repair: "Gearbox, turbo, electronics", cost: "£700 – £2,500" },
                        { model: "Santa Fe", type: "Petrol / Diesel / Hybrid", repair: "Suspension, drivetrain", cost: "£900 – £3,200" },
                        { model: "Bayon", type: "Petrol", repair: "Electrical modules", cost: "£350 – £1,100" },
                        { model: "Kona", type: "Hybrid / Electric", repair: "Battery management & inverter", cost: "£1,500 – £6,000" },
                        { model: "Ioniq Hybrid", type: "Hybrid", repair: "Hybrid system faults", cost: "£800 – £2,000" },
                        { model: "Ioniq Plug-In", type: "PHEV", repair: "Charging & inverter faults", cost: "£1,200 – £3,800" },
                        { model: "Ioniq Electric", type: "Electric", repair: "Battery cooling + drivetrain", cost: "£2,000 – £7,500" },
                        { model: "Ioniq 5", type: "EV", repair: "High-voltage components", cost: "£2,500 – £8,000" },
                        { model: "Ioniq 6", type: "EV", repair: "Motor + electronics", cost: "£3,000 – £8,500" }
                      ].map((row, index) => (
                        <tr key={index} className={index % 2 === 0 ? 'bg-background' : 'bg-muted/20'}>
                          <td className="px-4 py-3 font-semibold">{row.model}</td>
                          <td className="px-4 py-3">{row.type}</td>
                          <td className="px-4 py-3">{row.repair}</td>
                          <td className="px-4 py-3 text-right font-semibold">{row.cost}</td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              </div>
              <p className="text-center text-muted-foreground mt-6">
                If your model is not listed, don't worry - we cover all Hyundai models.
              </p>
            </div>
          </div>
        </section>

        {/* Why Choose Us */}
        <section className="container mx-auto px-4 py-16">
          <div className="max-w-4xl mx-auto">
            <h2 className="text-3xl md:text-4xl font-bold text-center mb-6">
              Why Hyundai Owners Choose Us
            </h2>
            <div className="flex justify-center mb-8">
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
            <div className="grid md:grid-cols-2 gap-6">
              {[
                "UK-based customer support",
                "Specialist warranty plans tailored for Hyundai vehicles",
                "Fast claims approval and quick payments to the repairer",
                "Use your preferred VAT-registered garage"
              ].map((item, index) => (
                <div key={index} className="bg-card p-6 rounded-lg border flex items-start gap-3">
                  <CheckCircle2 className="w-6 h-6 text-primary flex-shrink-0 mt-0.5" />
                  <span className="text-lg">{item}</span>
                </div>
              ))}
            </div>
            <p className="text-center text-lg mt-8">
              No stress. No confusing terms. Just clear, reliable protection.
            </p>
          </div>
        </section>

        {/* FAQs */}
        <section className="bg-card py-16">
          <div className="container mx-auto px-4">
            <div className="max-w-4xl mx-auto">
              <h2 className="text-3xl md:text-4xl font-bold text-center mb-12">Frequently Asked Questions</h2>
              <div className="space-y-6">
                {hyundaiFAQs.map((faq, index) => (
                  <div key={index} className="bg-background p-6 rounded-lg border">
                    <h3 className="text-xl font-bold mb-3">{faq.question}</h3>
                    <p className="text-muted-foreground">{faq.answer}</p>
                  </div>
                ))}
              </div>
            </div>
          </div>
        </section>

        {/* Final CTA */}
        <section className="container mx-auto px-4 py-16">
          <div className="max-w-4xl mx-auto text-center space-y-6 bg-primary/5 rounded-lg p-12">
            <h2 className="text-3xl md:text-4xl font-bold">
              Ready To Protect Your Hyundai?
            </h2>
            <ul className="space-y-2 text-lg">
              <li>✔ Cover for new, used and high-mileage Hyundai cars</li>
              <li>✔ Instant quotes in under 60 seconds</li>
              <li>✔ No hidden fees</li>
            </ul>
            <Button onClick={navigateToQuoteForm} size="lg" className="text-lg px-8 py-6">
              Get Instant Hyundai Warranty Quote
            </Button>
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

export default HyundaiWarranty;
