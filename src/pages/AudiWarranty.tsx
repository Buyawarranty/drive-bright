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
import audiHeroImage from '@/assets/audi-hero.png';
import audiCarImage from '@/assets/audi-car.png';

const AudiWarranty = () => {
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
    trackButtonClick('audi_warranty_get_quote_cta');
    navigate('/');
    setTimeout(() => {
      const element = document.getElementById('quote-form');
      if (element) {
        element.scrollIntoView({ behavior: 'smooth' });
      }
    }, 100);
  };

  const audiFAQs = [
    {
      question: "How much does an Audi extended warranty cost in the UK?",
      answer: "Pricing varies by model, mileage and cover level. Most Audi drivers pay £250–£900 per year, while high-performance S/RS and Q-series SUVs can be higher due to complex electrics, DSG/S tronic gearboxes and technology systems."
    },
    {
      question: "Is an extended warranty worth it for Audi?",
      answer: "Yes. Audi repairs commonly involve electronics, turbo systems, ECU faults and gearbox issues. A single repair can exceed £1,500–£4,000, often costing more than an annual warranty."
    },
    {
      question: "Can I buy an Audi extended warranty after purchase?",
      answer: "Yes. You can purchase cover even if your Audi was bought used, privately, or from an independent dealer. A manufacturer's warranty is not required."
    },
    {
      question: "How much is a 5-year extended warranty for Audi?",
      answer: "A combined 5-year protection stack (renewals included) typically ranges from £1,200 to £3,500, depending on the cover type and model."
    }
  ];

  return (
    <>
      <SEOHead
        title="Audi Car Extended Warranty | Used & New Audi Cover UK"
        description="Protect your Audi from costly repairs with an extended warranty. Covers engine, gearbox, electrics and more. Used & high-mileage Audis accepted. Get instant quotes."
        keywords="audi extended warranty, audi warranty UK, used audi warranty, audi a3 warranty, audi a4 warranty, audi q5 warranty"
        canonical="https://buyawarranty.co.uk/car-extended-warranty/audi/"
      />
      
      <OrganizationSchema type="InsuranceAgency" />
      
      <WebPageSchema
        name="Audi Extended Warranty - Buy A Warranty"
        description="Protect your Audi from costly repairs with an extended warranty. Covers engine, gearbox, electrics and more. Used & high-mileage Audis accepted. Get instant quotes."
        url="https://buyawarranty.co.uk/car-extended-warranty/audi/"
        lastReviewed={new Date().toISOString()}
        significantLink="https://buyawarranty.co.uk/"
        specialty="Audi Extended Warranties"
      />
      
      <ProductSchema
        name="Audi Extended Warranty"
        description="Comprehensive extended warranty coverage for Audi vehicles including engine, gearbox, electrical systems, ECU, hybrid and EV components."
        price="350.00"
        brand="Buy A Warranty"
        category="Car Insurance & Warranty"
        image="https://buyawarranty.co.uk/lovable-uploads/53652a24-3961-4346-bf9d-6588ef727aeb.png"
        availability="https://schema.org/InStock"
        areaServed="United Kingdom"
      />
      
      <FAQSchema faqs={audiFAQs} />
      
      <BreadcrumbSchema
        items={[
          { name: "Home", url: "https://buyawarranty.co.uk/" },
          { name: "Car Extended Warranty", url: "https://buyawarranty.co.uk/car-extended-warranty/" },
          { name: "Audi Warranty", url: "https://buyawarranty.co.uk/car-extended-warranty/audi/" }
        ]}
      />

      <div className="min-h-screen bg-gradient-to-b from-background to-muted/20">
        {/* Hero Section */}
        <section className="container mx-auto px-4 py-12 md:py-20">
          <div className="grid lg:grid-cols-2 gap-8 lg:gap-12 items-center">
            <div className="space-y-6 text-center lg:text-left">
              <h1 className="text-4xl md:text-5xl lg:text-6xl font-bold tracking-tight">
                Audi Extended Warranty - Protect Your Audi from Costly Repairs
              </h1>
              <p className="text-lg md:text-xl text-muted-foreground max-w-2xl mx-auto lg:mx-0">
                An Audi extended warranty protects your car from expensive mechanical and electrical repair bills after the original manufacturer's warranty expires. It includes cover for major components such as the engine, gearbox, electrics, and technology systems. You can buy extended warranty cover for new, used, or high-mileage Audi vehicles in the UK.
              </p>
              <div className="flex flex-col sm:flex-row gap-4 justify-center lg:justify-start">
                <Button onClick={navigateToQuoteForm} size="lg" className="text-lg px-8 py-6 bg-primary hover:bg-primary/90">
                  Get my Audi warranty quote →
                </Button>
              </div>
            </div>
            <div className="space-y-6">
              <img 
                src={audiHeroImage} 
                alt="Audi extended warranty quote on mobile" 
                className="w-full h-auto object-cover"
              />
              <div className="flex justify-center lg:justify-start">
                <TrustpilotHeader />
              </div>
            </div>
          </div>
        </section>

        {/* Why Audi Owners Choose Section */}
        <section className="bg-card py-16">
          <div className="container mx-auto px-4">
            <div className="max-w-4xl mx-auto text-center space-y-6">
              <h2 className="text-3xl md:text-4xl font-bold">
                Why Audi Owners Choose Our Extended Warranty
              </h2>
              <p className="text-lg text-muted-foreground">
                Whether you drive an Audi A3, A4, A6, Q3, Q5, or a performance RS model, our plans are built to keep running costs predictable and your Audi on the road.
              </p>
              <div className="grid md:grid-cols-2 gap-6 mt-8">
                {[
                  "Cover for new, used and high-mileage Audis",
                  "Fast claims approval",
                  "Flexible monthly or annual payment options",
                  "Repairs carried out at any VAT-registered UK garage",
                  "No hidden fees"
                ].map((item, index) => (
                  <div key={index} className="flex items-start gap-3">
                    <CheckCircle2 className="w-6 h-6 text-primary flex-shrink-0 mt-0.5" />
                    <span className="text-lg text-left">{item}</span>
                  </div>
                ))}
              </div>
              <p className="text-lg font-semibold text-primary mt-6">
                👉 We are the primary warranty provider offering protection up to 150,000 miles on selected plans.
              </p>
            </div>
          </div>
        </section>

        {/* Audi Car Image Section */}
        <section className="container mx-auto px-4 py-16">
          <div className="max-w-3xl mx-auto">
            <img 
              src={audiCarImage} 
              alt="Audi car with buyawarranty branding" 
              className="w-full h-auto object-cover rounded-lg"
            />
          </div>
        </section>

        {/* What's Covered */}
        <section className="bg-muted/30 py-16">
          <div className="container mx-auto px-4">
            <div className="max-w-4xl mx-auto space-y-8">
              <h2 className="text-3xl md:text-4xl font-bold text-center">
                What Does an Audi Extended Warranty Cover?
              </h2>
              <p className="text-lg text-center text-muted-foreground">
                Your plan protects key mechanical and electrical components, helping you avoid sudden repair bills such as:
              </p>
              <div className="bg-card p-8 rounded-lg">
                <h3 className="text-2xl font-bold mb-6">Core Component Protection</h3>
                <div className="overflow-x-auto">
                  <table className="w-full">
                    <thead>
                      <tr className="border-b">
                        <th className="text-left py-3 px-4">Component</th>
                        <th className="text-center py-3 px-4">Included</th>
                      </tr>
                    </thead>
                    <tbody>
                      {[
                        "Engine and turbocharger",
                        "Gearbox (manual and automatic)",
                        "Hybrid / electric system (e-trons & mild hybrids)",
                        "Fuel and injection systems",
                        "Cooling system and radiator",
                        "Electrical systems and ECU faults",
                        "Multimedia, sensors, infotainment, sat-nav",
                        "Air-conditioning and climate control",
                        "Labour and diagnostics"
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
                  Our warranty doesn't just list components. It is engineered around real-world Audi faults reported at UK garages, ensuring the parts most likely to fail are protected.
                </p>
                <p className="text-lg font-semibold mt-4">
                  👉 For the full breakdown of covered components, visit our <Link to="/what-is-covered" className="text-primary hover:underline">What's Covered</Link> page.
                </p>
              </div>
            </div>
          </div>
        </section>

        {/* Extend Protection Section */}
        <section className="container mx-auto px-4 py-16">
          <div className="max-w-4xl mx-auto space-y-6">
            <h2 className="text-3xl md:text-4xl font-bold text-center">
              Extend Protection After Audi's 4-Year Manufacturer Warranty Ends
            </h2>
            <p className="text-lg text-muted-foreground text-center">
              Audi manufacturer's warranty lasts 4 years (or up to 50,000 miles). After that, repairs are your responsibility.
            </p>
            <p className="text-lg font-semibold text-center">Typical Audi repairs include:</p>
            <div className="bg-card p-8 rounded-lg">
              <div className="overflow-x-auto">
                <table className="w-full">
                  <thead>
                    <tr className="border-b">
                      <th className="text-left py-3 px-4">Repair Area</th>
                      <th className="text-left py-3 px-4">Common Issue</th>
                      <th className="text-left py-3 px-4">Approx. Cost*</th>
                    </tr>
                  </thead>
                  <tbody>
                    {[
                      { area: "Engine", issue: "Timing chain, oil leaks", cost: "£1,800+" },
                      { area: "Gearbox / DSG", issue: "Mechatronics failure", cost: "£2,000+" },
                      { area: "Suspension", issue: "Air suspension faults (Q models)", cost: "£1,100+" },
                      { area: "ECU / Electrics", issue: "Sensor or module replacement", cost: "£900+" },
                      { area: "Multimedia", issue: "MMI / infotainment failure", cost: "£750-£1,200" }
                    ].map((item, index) => (
                      <tr key={index} className="border-b">
                        <td className="py-3 px-4 font-medium">{item.area}</td>
                        <td className="py-3 px-4">{item.issue}</td>
                        <td className="py-3 px-4 font-semibold">{item.cost}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
              <p className="text-sm text-muted-foreground mt-4">*Costs are indicative and vary by model. Prices change over time.</p>
              <p className="text-lg font-semibold mt-4">With an extended warranty, you're not paying these bills.</p>
            </div>
          </div>
        </section>

        {/* Used Audi Warranty Section */}
        <section className="bg-muted/30 py-16">
          <div className="container mx-auto px-4">
            <div className="max-w-4xl mx-auto space-y-6">
              <h2 className="text-3xl md:text-4xl font-bold text-center">
                Used Audi Warranty - Ideal for Older Vehicles
              </h2>
              <p className="text-lg text-center text-muted-foreground">
                Buying a used Audi? Repairs typically increase from year four onwards, particularly on high-cost systems like the gearbox, electronics and suspension.
              </p>
              <div className="bg-card p-8 rounded-lg">
                <ul className="space-y-4">
                  {[
                    "Audi A4 / A6 diesels (EGR, DPF, turbo issues)",
                    "S-Line and RS models (suspension and brake failures)",
                    "Audi Q5 / Q7 (electrics, gearbox, air suspension)"
                  ].map((item, index) => (
                    <li key={index} className="flex items-start gap-3">
                      <CheckCircle2 className="w-6 h-6 text-primary flex-shrink-0 mt-0.5" />
                      <span className="text-lg">{item}</span>
                    </li>
                  ))}
                </ul>
                <p className="text-lg font-semibold mt-6">
                  A warranty ensures you avoid unexpected downtime and keep control of costs.
                </p>
              </div>
            </div>
          </div>
        </section>

        {/* Audi Models We Cover */}
        <section className="container mx-auto px-4 py-16">
          <div className="max-w-4xl mx-auto space-y-6">
            <h2 className="text-3xl md:text-4xl font-bold text-center">
              Audi Models We Cover
            </h2>
            <div className="bg-card p-8 rounded-lg">
              <div className="overflow-x-auto">
                <table className="w-full">
                  <thead>
                    <tr className="border-b">
                      <th className="text-left py-3 px-4">Audi Range</th>
                      <th className="text-left py-3 px-4">Models Included</th>
                    </tr>
                  </thead>
                  <tbody>
                    {[
                      { range: "Hatchbacks", models: "A1, A3" },
                      { range: "Saloons / Estates", models: "A4, A6, A8, Allroad" },
                      { range: "Coupes / Sportback", models: "A5, A7, TT" },
                      { range: "SUVs", models: "Q2, Q3, Q5, Q7, Q8" },
                      { range: "Performance", models: "S models, RS models not covered" },
                      { range: "Electric & Hybrid", models: "Audi e-tron, Q4 e-tron, plug-in hybrid TFSI e" }
                    ].map((item, index) => (
                      <tr key={index} className="border-b">
                        <td className="py-3 px-4 font-medium">{item.range}</td>
                        <td className="py-3 px-4">{item.models}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
              <p className="text-lg font-semibold mt-6">
                All ages. All mileages (up to 150,000 miles on selected plans).
              </p>
            </div>
          </div>
        </section>

        {/* Cost Guide */}
        <section className="bg-muted/30 py-16">
          <div className="container mx-auto px-4">
            <div className="max-w-4xl mx-auto space-y-6">
              <h2 className="text-3xl md:text-4xl font-bold text-center">
                Audi Extended Warranty Cost Guide
              </h2>
              <div className="bg-card p-8 rounded-lg">
                <div className="overflow-x-auto">
                  <table className="w-full">
                    <thead>
                      <tr className="border-b">
                        <th className="text-left py-3 px-4">Audi Model</th>
                        <th className="text-left py-3 px-4">Typical Warranty Cost (from)</th>
                      </tr>
                    </thead>
                    <tbody>
                      {[
                        { model: "Audi A1 / A3", cost: "£250-£380 / year" },
                        { model: "Audi A4 / A5", cost: "£350-£550 / year" },
                        { model: "Audi A6 / Q5", cost: "£550-£770 / year" },
                        { model: "Audi Q7 / RS Models", cost: "£900+ / year" }
                      ].map((item, index) => (
                        <tr key={index} className="border-b">
                          <td className="py-3 px-4 font-medium">{item.model}</td>
                          <td className="py-3 px-4">{item.cost}</td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
                <p className="text-sm text-muted-foreground mt-4">Prices depend on mileage, model and claim limit selected.</p>
              </div>
            </div>
          </div>
        </section>

        {/* Comparison Table */}
        <section className="container mx-auto px-4 py-16">
          <div className="max-w-5xl mx-auto space-y-6">
            <h2 className="text-3xl md:text-4xl font-bold text-center">
              Why Our Warranty Is Better Than Audi's OEM Warranty
            </h2>
            <div className="bg-card p-8 rounded-lg overflow-x-auto">
              <table className="w-full">
                <thead>
                  <tr className="border-b">
                    <th className="text-left py-3 px-4">Feature</th>
                    <th className="text-center py-3 px-4">Our Warranty</th>
                    <th className="text-center py-3 px-4">Audi OEM Extended Warranty</th>
                  </tr>
                </thead>
                <tbody>
                  {[
                    { feature: "Covers used + older Audis", ours: true, oem: false },
                    { feature: "Covers up to 150,000 miles", ours: true, oem: false },
                    { feature: "Repair at any VAT-registered garage", ours: true, oem: "Must use Audi" },
                    { feature: "Flexible monthly payments", ours: true, oem: false },
                    { feature: "Covers multimedia & technology faults", ours: true, oem: "Limited" }
                  ].map((item, index) => (
                    <tr key={index} className="border-b">
                      <td className="py-3 px-4">{item.feature}</td>
                      <td className="text-center py-3 px-4">
                        {item.ours === true ? (
                          <CheckCircle2 className="w-6 h-6 text-primary inline-block" />
                        ) : (
                          <span className="text-red-600 font-bold">✗</span>
                        )}
                      </td>
                      <td className="text-center py-3 px-4">
                        {typeof item.oem === 'boolean' ? (
                          item.oem ? (
                            <CheckCircle2 className="w-6 h-6 text-primary inline-block" />
                          ) : (
                            <span className="text-red-600 font-bold">✗</span>
                          )
                        ) : (
                          <span className="text-sm">{item.oem}</span>
                        )}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        </section>

        {/* How It Works */}
        <section className="bg-muted/30 py-16">
          <div className="container mx-auto px-4">
            <div className="max-w-4xl mx-auto text-center space-y-8">
              <h2 className="text-3xl md:text-4xl font-bold">
                How It Works (Quick & Simple)
              </h2>
              <div className="grid md:grid-cols-3 gap-8">
                {[
                  { step: "1", title: "Enter your reg and mileage", icon: "📝" },
                  { step: "2", title: "Choose your cover level", icon: "✅" },
                  { step: "3", title: "Activate instantly", icon: "⚡" }
                ].map((item, index) => (
                  <div key={index} className="bg-card p-6 rounded-lg space-y-3">
                    <div className="text-4xl">{item.icon}</div>
                    <div className="text-2xl font-bold text-primary">{item.step}</div>
                    <div className="text-lg font-semibold">{item.title}</div>
                  </div>
                ))}
              </div>
              <div className="flex flex-col sm:flex-row gap-4 justify-center items-center mt-8">
                <div className="flex items-center gap-2">
                  <CheckCircle2 className="w-6 h-6 text-primary" />
                  <span className="font-medium">No waiting for approval</span>
                </div>
                <div className="flex items-center gap-2">
                  <CheckCircle2 className="w-6 h-6 text-primary" />
                  <span className="font-medium">No hidden admin fees</span>
                </div>
              </div>
            </div>
          </div>
        </section>

        {/* FAQs */}
        <section className="container mx-auto px-4 py-16">
          <div className="max-w-4xl mx-auto space-y-8">
            <h2 className="text-3xl md:text-4xl font-bold text-center">FAQs</h2>
            <div className="space-y-6">
              {audiFAQs.map((faq, index) => (
                <div key={index} className="bg-card p-6 rounded-lg">
                  <h3 className="text-xl font-bold mb-3">{faq.question}</h3>
                  <p className="text-muted-foreground">{faq.answer}</p>
                </div>
              ))}
            </div>
          </div>
        </section>

        {/* Final CTA */}
        <section className="bg-primary text-white py-16">
          <div className="container mx-auto px-4">
            <div className="max-w-3xl mx-auto text-center space-y-6">
              <h2 className="text-3xl md:text-4xl font-bold text-white">
                Ready to protect your Audi?
              </h2>
              <p className="text-xl text-white">
                Avoid unexpected repair bills and enjoy worry-free driving with a comprehensive Audi extended warranty.
              </p>
              <Button 
                onClick={navigateToQuoteForm}
                size="lg"
                className="bg-white text-black hover:bg-gray-100 text-lg px-8 py-6 font-semibold"
              >
                👉 Get my Audi warranty quote →
              </Button>
              <p className="text-sm text-white">Takes less than 60 seconds. No phone calls, no pressure - just instant pricing.</p>
            </div>
          </div>
        </section>

        {/* Floating Buttons */}
        {showScrollTop && (
          <button
            onClick={scrollToTop}
            className="fixed bottom-24 right-6 bg-primary text-white p-3 rounded-full shadow-lg hover:bg-primary/90 transition-all z-40"
            aria-label="Scroll to top"
          >
            ↑
          </button>
        )}

        <a
          href="tel:03302295040"
          className="fixed bottom-6 right-6 bg-blue-600 text-white p-4 rounded-full shadow-lg hover:bg-blue-700 transition-all z-40 flex items-center justify-center"
          aria-label="Call us"
        >
          <Phone className="h-6 w-6" />
        </a>

        <a
          href="https://wa.me/message/SPQPJ6O3UBF5B1"
          target="_blank"
          rel="noopener noreferrer"
          className="fixed bottom-24 left-6 z-40"
        >
          <img 
            src={whatsappIconNew} 
            alt="WhatsApp" 
            className="h-14 w-14 hover:scale-110 transition-transform"
          />
        </a>
      </div>

        <NewFooter />
    </>
  );
};

export default AudiWarranty;
