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
import trustpilotLogo from '@/assets/trustpilot-excellent-box.webp';
import whatsappIconNew from '@/assets/whatsapp-icon-new.png';

const SkodaWarranty = () => {
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
    trackButtonClick('skoda_warranty_get_quote_cta');
    navigate('/');
    setTimeout(() => {
      const element = document.getElementById('quote-form');
      if (element) {
        element.scrollIntoView({ behavior: 'smooth' });
      }
    }, 100);
  };

  const skodaFAQs = [
    {
      question: "How much does a Škoda extended warranty cost?",
      answer: "Most drivers pay between £280 and £900 per year, depending on the model, age, mileage and chosen plan level."
    },
    {
      question: "Is a Škoda extended warranty worth it?",
      answer: "Yes. Škoda engines, DSG gearboxes, hybrid systems and electronics can be expensive to repair. One major failure can exceed the cost of a full year of warranty cover."
    },
    {
      question: "Does Škoda offer extended warranties?",
      answer: "The manufacturer offers its own plans, but many drivers choose independent specialists like Buy A Warranty for broader cover, flexible pricing and the ability to use any VAT-registered garage."
    },
    {
      question: "How much should I expect to pay for an extended warranty?",
      answer: "Expect a typical range of £25 to £65 per month, depending on your Škoda model, mileage and claim limits."
    },
    {
      question: "Does the warranty cover electric and hybrid Škoda models?",
      answer: "Yes. Enyaq iV and plug-in hybrid components can be included, such as drive units, controllers and electrical modules."
    },
    {
      question: "Can I get a warranty for a used Škoda?",
      answer: "Absolutely. You can take out cover at any time, even for used or privately purchased Škoda models."
    }
  ];

  return (
    <>
      <SEOHead
        title="Škoda Car Extended Warranty | Cover for New & Used Models"
        description="Protect your Škoda with comprehensive extended warranty cover for new and used models. Get instant quotes, flexible plans and protection from costly repairs."
        keywords="skoda extended warranty, skoda warranty UK, used skoda warranty, skoda octavia warranty, skoda superb warranty, skoda kodiaq warranty"
        canonical="https://buyawarranty.co.uk/car-extended-warranty/skoda/"
        ogTitle="Škoda Extended Warranty for New and Used Models"
        ogDescription="Get reliable Škoda extended warranty cover for mechanical and electrical failures. Fast online quotes and flexible plans for all Škoda models."
      />
      
      <OrganizationSchema type="InsuranceAgency" />
      
      <WebPageSchema
        name="Škoda Extended Warranty - Buy A Warranty"
        description="Protect your Škoda with comprehensive extended warranty cover for new and used models. Get instant quotes, flexible plans and protection from costly repairs."
        url="https://buyawarranty.co.uk/car-extended-warranty/skoda/"
        lastReviewed={new Date().toISOString()}
        significantLink="https://buyawarranty.co.uk/"
        specialty="Škoda Extended Warranties"
      />
      
      <ProductSchema
        name="Škoda Extended Warranty"
        description="Comprehensive extended warranty coverage for Škoda vehicles including engine, gearbox, electrical systems, ECU, hybrid and EV components."
        price="380.00"
        brand="Buy A Warranty"
        category="Car Insurance & Warranty"
        image="https://buyawarranty.co.uk/lovable-uploads/53652a24-3961-4346-bf9d-6588ef727aeb.png"
        availability="https://schema.org/InStock"
        areaServed="United Kingdom"
      />
      
      <FAQSchema faqs={skodaFAQs} />
      
      <BreadcrumbSchema
        items={[
          { name: "Home", url: "https://buyawarranty.co.uk/" },
          { name: "Car Extended Warranty", url: "https://buyawarranty.co.uk/car-extended-warranty/" },
          { name: "Škoda Warranty", url: "https://buyawarranty.co.uk/car-extended-warranty/skoda/" }
        ]}
      />

      <div className="min-h-screen bg-gradient-to-b from-background to-muted/20">
        {/* Hero Section */}
        <section className="container mx-auto px-4 py-12 md:py-20">
          <div className="grid lg:grid-cols-2 gap-8 lg:gap-12 items-center">
            <div className="space-y-6 text-center lg:text-left">
              <h1 className="text-4xl md:text-5xl lg:text-6xl font-bold tracking-tight">
                Škoda Extended Warranty - Protect Your Car Beyond the Factory Cover
              </h1>
              <p className="text-lg md:text-xl text-muted-foreground max-w-2xl mx-auto lg:mx-0">
                A Škoda extended warranty protects your car once the factory warranty ends. It covers mechanical and electrical failures, pays for parts, labour and diagnostics, and helps you avoid costly repair bills. You can choose flexible cover for new, used and high-mileage Škoda models, matched to your car's age and mileage.
              </p>
              <p className="text-lg md:text-xl text-muted-foreground max-w-2xl mx-auto lg:mx-0">
                Škoda vehicles are known for reliability, yet modern engines, electronics and hybrid systems can still be expensive to repair. Whether you drive an Octavia, Superb, Kodiaq, Karoq, Fabia, Scala, Enyaq iV or Kamiq, extended cover gives long-term peace of mind. Buy A Warranty also protects high-mileage cars with cover available up to 150,000 miles.
              </p>
              <div className="flex flex-col sm:flex-row gap-4 justify-center lg:justify-start">
                <Button onClick={navigateToQuoteForm} size="lg" className="text-lg px-8 py-6 bg-primary hover:bg-primary/90">
                  Get my Škoda warranty quote →
                </Button>
              </div>
            </div>
            <div className="space-y-6">
              <div className="flex justify-center lg:justify-start">
                <TrustpilotHeader />
              </div>
            </div>
          </div>
        </section>

        {/* What's Covered */}
        <section className="bg-muted/30 py-16">
          <div className="container mx-auto px-4">
            <div className="max-w-4xl mx-auto space-y-8">
              <h2 className="text-3xl md:text-4xl font-bold text-center">
                What Does an Extended Warranty For Škoda Include?
              </h2>
              <p className="text-lg text-center text-muted-foreground">
                A comprehensive plan pays for mechanical and electrical failures across major systems. Coverage can include:
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
                        "Engine and turbo components",
                        "DSG gearbox, manual gearbox and clutch",
                        "Electric and hybrid drive systems",
                        "Steering and suspension",
                        "Fuel and injection systems",
                        "Air conditioning",
                        "ECU, sensors and electrical modules",
                        "Infotainment and multimedia units"
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
                  You can also use any VAT-registered garage, so you are not restricted to Škoda dealerships.
                </p>
                <p className="text-lg font-semibold mt-4">
                  👉 For full component-level details, please visit our <Link to="/what-is-covered" className="text-primary hover:underline">coverage page</Link>.
                </p>
              </div>
            </div>
          </div>
        </section>

        {/* Pricing Section */}
        <section className="container mx-auto px-4 py-16">
          <div className="max-w-4xl mx-auto space-y-6">
            <h2 className="text-3xl md:text-4xl font-bold text-center">
              Škoda Warranty Pricing and What Affects It
            </h2>
            <p className="text-lg text-muted-foreground text-center">
              Škoda extended warranty costs vary by model, age, mileage and the level of cover selected. Typical drivers pay £280 to £900 per year, depending on:
            </p>
            <div className="bg-card p-8 rounded-lg">
              <ul className="space-y-4">
                {[
                  "Model type (Fabia vs. Kodiaq vs. Enyaq iV)",
                  "Engine size and complexity",
                  "Mileage and age brackets",
                  "Plan level (listed component or full comprehensive)",
                  "Hybrid or electric systems require advanced parts"
                ].map((item, index) => (
                  <li key={index} className="flex items-start gap-3">
                    <CheckCircle2 className="w-6 h-6 text-primary flex-shrink-0 mt-0.5" />
                    <span className="text-lg">{item}</span>
                  </li>
                ))}
              </ul>
              <p className="text-lg mt-6">
                Larger SUVs and plug-in hybrids sit at the higher end due to parts and labour costs.
              </p>
              <p className="text-lg font-semibold mt-4">
                You can choose your own claim limit and excess to control pricing.
              </p>
            </div>
          </div>
        </section>

        {/* Repair Costs Table */}
        <section className="bg-muted/30 py-16">
          <div className="container mx-auto px-4">
            <div className="max-w-4xl mx-auto space-y-6">
              <h2 className="text-3xl md:text-4xl font-bold text-center">
                Škoda Component Repair Costs
              </h2>
              <p className="text-lg text-center text-muted-foreground">
                Modern Škoda vehicles share technology with Volkswagen Group models, which means some parts are advanced and expensive to replace. Here are some average repair costs to understand why extended cover matters.
              </p>
              <div className="bg-card p-8 rounded-lg">
                <div className="overflow-x-auto">
                  <table className="w-full">
                    <thead>
                      <tr className="border-b">
                        <th className="text-left py-3 px-4">Component / System</th>
                        <th className="text-left py-3 px-4">Avg. Repair Cost</th>
                      </tr>
                    </thead>
                    <tbody>
                      {[
                        { component: "DSG Mechatronics", cost: "£1,150 – £1,950" },
                        { component: "Turbocharger", cost: "£800 – £1,500" },
                        { component: "Timing Chain", cost: "£950 – £1,600" },
                        { component: "Infotainment Unit", cost: "£600 – £1,200" },
                        { component: "Suspension Arms", cost: "£250 – £480" },
                        { component: "Electric Drive Components (Enyaq)", cost: "£850 – £2,400" },
                        { component: "EGR Valve", cost: "£400 – £750" },
                        { component: "Water Pump", cost: "£380 – £600" }
                      ].map((item, index) => (
                        <tr key={index} className="border-b">
                          <td className="py-3 px-4 font-medium">{item.component}</td>
                          <td className="py-3 px-4 font-semibold">{item.cost}</td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
                <p className="text-sm text-muted-foreground mt-4">These costs include labour and diagnostics and highlight the value of added protection.</p>
              </div>
            </div>
          </div>
        </section>

        {/* Models Covered */}
        <section className="container mx-auto px-4 py-16">
          <div className="max-w-4xl mx-auto space-y-6">
            <h2 className="text-3xl md:text-4xl font-bold text-center">
              Škoda Models Covered
            </h2>
            <p className="text-lg text-center text-muted-foreground">
              All Škoda passenger cars sold in the UK can be protected, including:
            </p>
            <div className="bg-card p-8 rounded-lg">
              <div className="overflow-x-auto">
                <table className="w-full">
                  <thead>
                    <tr className="border-b">
                      <th className="text-left py-3 px-4">Hatchbacks</th>
                      <th className="text-left py-3 px-4">Estates</th>
                      <th className="text-left py-3 px-4">SUVs</th>
                      <th className="text-left py-3 px-4">Electric</th>
                    </tr>
                  </thead>
                  <tbody>
                    <tr className="border-b">
                      <td className="py-3 px-4">Fabia</td>
                      <td className="py-3 px-4">Octavia Estate</td>
                      <td className="py-3 px-4">Kamiq</td>
                      <td className="py-3 px-4">Enyaq iV</td>
                    </tr>
                    <tr className="border-b">
                      <td className="py-3 px-4">Scala</td>
                      <td className="py-3 px-4">Superb Estate</td>
                      <td className="py-3 px-4">Karoq</td>
                      <td className="py-3 px-4">Enyaq Coupé iV</td>
                    </tr>
                    <tr className="border-b">
                      <td className="py-3 px-4">Octavia</td>
                      <td className="py-3 px-4"></td>
                      <td className="py-3 px-4">Kodiaq</td>
                      <td className="py-3 px-4"></td>
                    </tr>
                    <tr>
                      <td className="py-3 px-4">Superb</td>
                      <td className="py-3 px-4"></td>
                      <td className="py-3 px-4"></td>
                      <td className="py-3 px-4"></td>
                    </tr>
                  </tbody>
                </table>
              </div>
              <p className="text-lg font-semibold mt-6">
                We also cover used Škoda models, approved-used vehicles and high-mileage cars up to 150,000 miles.
              </p>
            </div>
          </div>
        </section>

        {/* Why Choose Our Warranty */}
        <section className="bg-muted/30 py-16">
          <div className="container mx-auto px-4">
            <div className="max-w-4xl mx-auto space-y-6">
              <h2 className="text-3xl md:text-4xl font-bold text-center">
                What Makes Our Škoda Warranty Different
              </h2>
              <p className="text-lg text-center text-muted-foreground">
                Škoda owners choose us because we offer flexibility, specialist cover and simple claims:
              </p>
              <div className="bg-card p-8 rounded-lg">
                <ul className="space-y-4">
                  {[
                    "Use any VAT-registered garage",
                    "Fast approval process",
                    "Direct payment to repairers",
                    "Cover up to 150,000 miles",
                    "Mechanical and electrical protection",
                    "EV and hybrid component cover",
                    "No hidden fees"
                  ].map((item, index) => (
                    <li key={index} className="flex items-start gap-3">
                      <CheckCircle2 className="w-6 h-6 text-primary flex-shrink-0 mt-0.5" />
                      <span className="text-lg">{item}</span>
                    </li>
                  ))}
                </ul>
                <p className="text-lg font-semibold mt-6">
                  It is designed to give drivers confidence while keeping costs predictable.
                </p>
              </div>
            </div>
          </div>
        </section>

        {/* FAQs */}
        <section className="container mx-auto px-4 py-16">
          <div className="max-w-4xl mx-auto space-y-8">
            <h2 className="text-3xl md:text-4xl font-bold text-center">
              FAQs
            </h2>
            <div className="space-y-6">
              {skodaFAQs.map((faq, index) => (
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
            <div className="max-w-4xl mx-auto text-center space-y-6">
              <h2 className="text-3xl md:text-4xl font-bold">
                Ready to Protect Your Škoda
              </h2>
              <p className="text-lg md:text-xl">
                Keep your Škoda running smoothly without worrying about unexpected repair bills. Choose a flexible mechanical and electrical cover, activate your plan online and enjoy confident driving.
              </p>
              <Button 
                onClick={navigateToQuoteForm} 
                size="lg" 
                className="bg-white text-primary hover:bg-gray-100 text-lg px-8 py-6"
              >
                Get My Škoda Quote Now →
              </Button>
            </div>
          </div>
        </section>
      </div>

      {/* Scroll to top button */}
      {showScrollTop && (
        <Button
          onClick={scrollToTop}
          className="fixed bottom-24 right-4 z-50 rounded-full w-12 h-12 p-0 shadow-lg"
          size="icon"
          aria-label="Scroll to top"
        >
          ↑
        </Button>
      )}

      {/* Mobile floating action buttons */}
      {isMobile && (
        <div className="fixed bottom-4 right-4 z-50 flex flex-col gap-3">
          <a
            href="https://wa.me/447441428810"
            target="_blank"
            rel="noopener noreferrer"
            className="w-14 h-14 rounded-full shadow-lg flex items-center justify-center bg-[#25D366] hover:bg-[#20BA59] transition-colors"
            aria-label="Contact us on WhatsApp"
          >
            <img 
              src={whatsappIconNew} 
              alt="WhatsApp" 
              className="w-8 h-8"
            />
          </a>
          <a
            href="tel:03302295040"
            className="w-14 h-14 rounded-full bg-primary shadow-lg flex items-center justify-center hover:bg-primary/90 transition-colors"
            aria-label="Call us"
          >
            <Phone className="w-6 h-6 text-white" />
          </a>
        </div>
      )}

      <NewFooter />
    </>
  );
};

export default SkodaWarranty;
