import { useState, useEffect } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { Button } from '@/components/ui/button';
import { CheckCircle2, Shield, Clock, Phone } from 'lucide-react';
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
import jaguarHeroImage from '@/assets/jaguar-hero.png';
import jaguarFPaceImage from '@/assets/jaguar-fpace.png';
import jaguarXEImage from '@/assets/jaguar-xe.png';
import jaguarFTypeImage from '@/assets/jaguar-ftype.png';
import jaguarIPaceImage from '@/assets/jaguar-ipace.png';
import StickyNavigation from '@/components/StickyNavigation';

const JaguarWarranty = () => {
  const navigate = useNavigate();
  const isMobile = useIsMobile();
  const [showScrollTop, setShowScrollTop] = useState(false);

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
    trackButtonClick('jaguar_warranty_get_quote_cta');
    navigate('/');
    setTimeout(() => {
      const element = document.getElementById('quote-form');
      if (element) {
        element.scrollIntoView({ behavior: 'smooth' });
      }
    }, 100);
  };

  const jaguarFAQs = [
    {
      question: "Is it worth getting a Jaguar extended warranty?",
      answer: "Yes. Jaguars are luxurious and performance-focused, which makes repairs expensive. A Jaguar extended warranty helps protect you from high bills for engines, electrics, transmissions, infotainment and more."
    },
    {
      question: "How much does a Jaguar extended warranty cost?",
      answer: "Cost depends on model, mileage, age and chosen plan. Prices are generally lower for XE and XF models and slightly higher for F-Type, F-Pace and electrified models. You will receive a tailored quote based on your registration."
    },
    {
      question: "Does Jaguar sell an extended warranty?",
      answer: "Jaguar does offer its own extended warranty, but many drivers prefer independent providers due to broader component coverage, competitive pricing and flexible repair options."
    },
    {
      question: "Who provides the Jaguar extended warranty?",
      answer: "You can choose independent warranty specialists like Buy A Warranty, who offer comprehensive protection for mechanical and electrical failures and allow repairs at any VAT-registered garage nationwide. This gives you flexible, reliable cover beyond Jaguar's original manufacturer warranty."
    }
  ];

  return (
    <>
      <SEOHead
        title="Jaguar Car Extended Warranty | Cover for New & Used Models"
        description="Protect your Jaguar with comprehensive extended warranty cover for new and used models. Get instant online quotes, flexible plans and protection from costly repairs."
        keywords="jaguar extended warranty, jaguar warranty UK, used jaguar warranty, jaguar xe warranty, jaguar xf warranty, jaguar f-pace warranty, jaguar i-pace warranty"
        canonical="https://buyawarranty.co.uk/car-extended-warranty/jaguar/"
      />
      
      <OrganizationSchema type="InsuranceAgency" />
      
      <WebPageSchema
        name="Jaguar Extended Warranty - Buy A Warranty"
        description="Protect your Jaguar with comprehensive extended warranty cover for new and used models. Get instant online quotes, flexible plans and protection from costly repairs."
        url="https://buyawarranty.co.uk/car-extended-warranty/jaguar/"
        lastReviewed={new Date().toISOString()}
        significantLink="https://buyawarranty.co.uk/what-is-covered/"
        specialty="Jaguar Extended Warranty Insurance"
      />

      <ProductSchema
        name="Jaguar Extended Warranty"
        description="Comprehensive extended warranty cover for Jaguar vehicles including F-Type, F-Pace, XE, XF, and I-Pace models"
        price="From £30"
        brand="Buy A Warranty"
        category="Car Warranty"
        image={jaguarHeroImage}
        availability="InStock"
        areaServed="United Kingdom"
      />

      <FAQSchema faqs={jaguarFAQs} />

      <BreadcrumbSchema
        items={[
          { name: "Home", url: "https://buyawarranty.co.uk/" },
          { name: "Car Extended Warranty", url: "https://buyawarranty.co.uk/car-extended-warranty/" },
          { name: "Jaguar Warranty", url: "https://buyawarranty.co.uk/car-extended-warranty/jaguar/" }
        ]}
      />

      <div className="min-h-screen flex flex-col">
        <StickyNavigation />
        
        <main className="flex-grow">
          <TrustpilotHeader />

          {/* Hero Section */}
          <section className="relative bg-gradient-to-b from-primary/5 to-background py-16 md:py-24">
            <div className="container mx-auto px-4">
              <div className="grid md:grid-cols-2 gap-12 items-center">
                <div className="space-y-6">
                  <h1 className="text-4xl md:text-5xl lg:text-6xl font-bold leading-tight">
                    Jaguar Extended Warranty - Reliable Cover for Luxury Performance
                  </h1>
                  <p className="text-lg md:text-xl text-muted-foreground">
                    A Jaguar extended warranty protects your vehicle once the original manufacturer's cover expires. It pays for parts, labour and diagnostics when eligible mechanical or electrical components fail, helping owners avoid sudden and costly repair bills.
                  </p>
                  <div className="flex flex-col sm:flex-row gap-4">
                    <Button 
                      size="lg" 
                      className="text-lg px-8"
                      onClick={navigateToQuoteForm}
                    >
                      Get My Jaguar Warranty Quote
                    </Button>
                    <Button 
                      size="lg" 
                      variant="outline"
                      className="text-lg px-8"
                      asChild
                    >
                      <Link to="/what-is-covered">What's Covered</Link>
                    </Button>
                  </div>
                  <div className="flex items-center gap-4 pt-4">
                    <img 
                      src={trustpilotLogo} 
                      alt="Trustpilot Excellent Rating" 
                      className="h-12 w-auto"
                    />
                    <div className="text-sm text-muted-foreground">
                      <p className="font-semibold">Rated Excellent</p>
                      <p>Based on verified reviews</p>
                    </div>
                  </div>
                </div>
                <div className="relative">
                  <img 
                    src={jaguarHeroImage}
                    alt="Jaguar luxury vehicle covered by extended warranty protection"
                    className="w-full max-w-md mx-auto h-auto object-contain"
                    loading="eager"
                  />
                </div>
              </div>
            </div>
          </section>

          {/* Introduction Section */}
          <section className="container mx-auto px-4 py-16">
            <div className="max-w-4xl mx-auto space-y-6 text-lg">
              <p>
                Jaguar remains one of the most iconic British car makers, known for refined engineering, luxury interiors and advanced technology. This sophistication also means repairs can be expensive as the vehicle ages, especially when dealing with electrics, emissions systems, turbos and suspension components. A well-structured warranty helps safeguard both your vehicle and your budget.
              </p>
              <p>
                Whether you own a Jaguar F-Type, F-Pace, XE, XF or the fully electric I-Pace, extended cover ensures long-term peace of mind. It delivers confidence long after the initial 3-year manufacturer warranty ends and keeps your Jaguar performing at the standard the brand is known for.
              </p>
            </div>
          </section>

          {/* Why Choose Us Section */}
          <section className="bg-muted/50 py-16">
            <div className="container mx-auto px-4">
              <h2 className="text-3xl md:text-4xl font-bold text-center mb-12">
                Why Choose Our Jaguar Extended Warranty?
              </h2>
              <div className="grid md:grid-cols-3 gap-8 max-w-5xl mx-auto">
                <div className="bg-card p-6 rounded-lg shadow-sm">
                  <Shield className="w-12 h-12 text-primary mb-4" />
                  <h3 className="text-xl font-semibold mb-3">Comprehensive Coverage</h3>
                  <p className="text-muted-foreground">
                    Full mechanical and electrical protection for all major components including engine, gearbox, electronics, hybrid and electric systems.
                  </p>
                </div>
                <div className="bg-card p-6 rounded-lg shadow-sm">
                  <Clock className="w-12 h-12 text-primary mb-4" />
                  <h3 className="text-xl font-semibold mb-3">Fast Claims Process</h3>
                  <p className="text-muted-foreground">
                    Quick approval and payment direct to your chosen VAT-registered garage anywhere in the UK. No waiting for reimbursement.
                  </p>
                </div>
                <div className="bg-card p-6 rounded-lg shadow-sm">
                  <CheckCircle2 className="w-12 h-12 text-primary mb-4" />
                  <h3 className="text-xl font-semibold mb-3">High Mileage Accepted</h3>
                  <p className="text-muted-foreground">
                    We cover vehicles up to 150,000 miles - perfect for older Jaguars still delivering luxury performance.
                  </p>
                </div>
              </div>
            </div>
          </section>

          {/* What's Covered Section */}
          <section className="container mx-auto px-4 py-16">
            <div className="max-w-4xl mx-auto">
              <h2 className="text-3xl md:text-4xl font-bold text-center mb-8">
                What Does an Extended Warranty For Jaguar Cover?
              </h2>
              <p className="text-lg text-center mb-8 text-muted-foreground">
                A warranty pays for parts, labour and diagnostics when covered components suffer mechanical or electrical failure. You can use any VAT-registered garage, which means you are not limited to Jaguar dealerships.
              </p>
              <div className="grid md:grid-cols-2 gap-6 mb-8">
                <div className="relative">
                  <img 
                    src={jaguarFPaceImage}
                    alt="Jaguar F-Pace SUV covered under extended warranty"
                    className="w-full max-w-sm mx-auto h-auto object-contain"
                    loading="lazy"
                  />
                </div>
                <div className="space-y-4">
                  <h3 className="text-2xl font-semibold mb-4">Core Systems Typically Covered</h3>
                  <div className="bg-card p-6 rounded-lg">
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
                            "Engine and powertrain",
                            "Gearbox and transmission",
                            "Turbocharger and supercharger",
                            "Electrical and electronic modules",
                            "Cooling and heating systems",
                            "Steering and suspension",
                            "Fuel and injection systems",
                            "Air conditioning systems",
                            "Multimedia, navigation and infotainment"
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
                      Our warranty is engineered around real-world Jaguar faults reported at UK garages, ensuring the parts most likely to fail are protected.
                    </p>
                    <p className="text-lg font-semibold mt-4">
                      👉 For detailed component-level information, visit our <Link to="/what-is-covered" className="text-primary hover:underline">coverage page</Link>.
                    </p>
                  </div>
                </div>
              </div>
            </div>
          </section>

          {/* Models Covered Section */}
          <section className="bg-muted/50 py-16">
            <div className="container mx-auto px-4">
              <div className="max-w-4xl mx-auto">
                <h2 className="text-3xl md:text-4xl font-bold text-center mb-8">
                  Jaguar Models We Cover
                </h2>
                <p className="text-lg text-center mb-8 text-muted-foreground">
                  We offer extended warranty cover for all major Jaguar models sold in the UK
                </p>
                <div className="grid md:grid-cols-2 gap-6 mb-8">
                  <div className="relative">
                    <img 
                      src={jaguarXEImage}
                      alt="Jaguar XE sedan with extended warranty coverage"
                      className="w-full max-w-sm mx-auto h-auto object-contain"
                      loading="lazy"
                    />
                  </div>
                  <div className="relative">
                    <img 
                      src={jaguarFTypeImage}
                      alt="Jaguar F-Type sports car with warranty protection"
                      className="w-full max-w-sm mx-auto h-auto object-contain"
                      loading="lazy"
                    />
                  </div>
                </div>
                <div className="bg-card p-8 rounded-lg">
                  <div className="grid md:grid-cols-2 gap-6">
                    <div className="space-y-4">
                      <h3 className="text-xl font-semibold mb-3">Current Models</h3>
                      <ul className="space-y-2">
                        {[
                          "Jaguar XE",
                          "Jaguar XF",
                          "Jaguar XJ",
                          "Jaguar F-Type",
                          "Jaguar F-Pace",
                          "Jaguar E-Pace",
                          "Jaguar I-Pace"
                        ].map((model, index) => (
                          <li key={index} className="flex items-center gap-2">
                            <CheckCircle2 className="w-5 h-5 text-primary flex-shrink-0" />
                            <span>{model}</span>
                          </li>
                        ))}
                      </ul>
                    </div>
                    <div className="space-y-4">
                      <h3 className="text-xl font-semibold mb-3">Previous Models</h3>
                      <ul className="space-y-2">
                        {[
                          "S-Type",
                          "X-Type",
                          "XK"
                        ].map((model, index) => (
                          <li key={index} className="flex items-center gap-2">
                            <CheckCircle2 className="w-5 h-5 text-primary flex-shrink-0" />
                            <span>{model} (subject to age and mileage)</span>
                          </li>
                        ))}
                      </ul>
                      <p className="text-sm text-muted-foreground mt-4">
                        This includes new, used and Approved-like Jaguars that are no longer under manufacturer protection.
                      </p>
                    </div>
                  </div>
                </div>
              </div>
            </div>
          </section>

          {/* Used Jaguar Warranty Section */}
          <section className="container mx-auto px-4 py-16">
            <div className="max-w-4xl mx-auto">
              <h2 className="text-3xl md:text-4xl font-bold text-center mb-8">
                Used Jaguar Extended Warranty - Ideal for Older or High-Mileage Cars
              </h2>
              <div className="space-y-6 text-lg">
                <p>
                  Used Jaguars can experience common failures as mileage increases. Our warranty plans are crafted to support reliable motoring, whether your Jaguar has a full history or is approaching higher miles.
                </p>
                <div className="bg-primary/10 p-6 rounded-lg border-l-4 border-primary">
                  <p className="text-lg font-semibold">
                    ⭐ We offer flexible cover for vehicles up to 150,000 miles, which is significantly higher than many traditional warranty providers. This ensures older Jaguars still receive meaningful protection.
                  </p>
                </div>
              </div>
            </div>
          </section>

          {/* Cost Guide Section */}
          <section className="bg-muted/50 py-16">
            <div className="container mx-auto px-4">
              <div className="max-w-4xl mx-auto">
                <h2 className="text-3xl md:text-4xl font-bold text-center mb-8">
                  Jaguar Warranty Cost and What Affects It
                </h2>
                <p className="text-lg text-center mb-8 text-muted-foreground">
                  Jaguar extended warranty cost varies depending on several vehicle-specific factors
                </p>
                <div className="grid md:grid-cols-2 gap-6 mb-8">
                  <div className="bg-card p-6 rounded-lg">
                    <h3 className="text-xl font-semibold mb-4">Pricing Factors</h3>
                    <ul className="space-y-3">
                      {[
                        "Model and specification",
                        "Age and current mileage",
                        "Engine type",
                        "Previous repair history",
                        "Plan level and claims limit",
                        "Labour rate selection",
                        "Inclusion of wear-related components"
                      ].map((factor, index) => (
                        <li key={index} className="flex items-center gap-2">
                          <CheckCircle2 className="w-5 h-5 text-primary flex-shrink-0" />
                          <span>{factor}</span>
                        </li>
                      ))}
                    </ul>
                  </div>
                  <div className="bg-card p-6 rounded-lg">
                    <p className="text-muted-foreground">
                      Jaguars with larger engines, performance variants or historic oil leak issues may attract higher premiums. Electric models like the Jaguar I-Pace may have different pricing due to battery-related components and advanced electronics.
                    </p>
                    <div className="mt-6 relative">
                      <img 
                        src={jaguarIPaceImage}
                        alt="Jaguar I-Pace electric vehicle warranty coverage"
                        className="w-full max-w-xs mx-auto h-auto object-contain"
                        loading="lazy"
                      />
                    </div>
                  </div>
                </div>
              </div>
            </div>
          </section>

          {/* Common Repairs Section */}
          <section className="container mx-auto px-4 py-16">
            <div className="max-w-4xl mx-auto">
              <h2 className="text-3xl md:text-4xl font-bold text-center mb-8">
                Common Jaguar Repairs and Typical Costs
              </h2>
              <p className="text-lg text-center mb-8 text-muted-foreground">
                Luxury engineering and advanced systems mean Jaguars can face high repair bills. An extended warranty helps absorb these costs.
              </p>
              <div className="bg-card p-8 rounded-lg">
                <div className="overflow-x-auto">
                  <table className="w-full">
                    <thead>
                      <tr className="border-b">
                        <th className="text-left py-3 px-4">Component</th>
                        <th className="text-left py-3 px-4">Cost Without Warranty</th>
                        <th className="text-left py-3 px-4">Frequency in Ageing Jaguars</th>
                      </tr>
                    </thead>
                    <tbody>
                      {[
                        { component: "Automatic gearbox", cost: "£1,500 to £4,800", frequency: "Moderate" },
                        { component: "Turbocharger", cost: "£900 to £2,200", frequency: "High on diesel models" },
                        { component: "Electric parking brake", cost: "£500 to £850", frequency: "Moderate" },
                        { component: "Engine oil pump", cost: "£1,800 to £3,000", frequency: "Medium to high" },
                        { component: "Infotainment display/module", cost: "£650 to £1,400", frequency: "Common on older XE, XF" },
                        { component: "DPF systems", cost: "£900 to £2,500", frequency: "High on diesel Jaguars" },
                        { component: "Air suspension components", cost: "£700 to £1,500", frequency: "Common on XJ and F-Pace" }
                      ].map((item, index) => (
                        <tr key={index} className="border-b">
                          <td className="py-3 px-4 font-medium">{item.component}</td>
                          <td className="py-3 px-4 font-semibold">{item.cost}</td>
                          <td className="py-3 px-4">{item.frequency}</td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
                <p className="text-sm text-muted-foreground mt-4">
                  These costs highlight why extended warranty protection is highly beneficial, especially for drivers wanting predictable ownership costs.
                </p>
              </div>
            </div>
          </section>

          {/* Warranty Plans Section */}
          <section className="bg-muted/50 py-16">
            <div className="container mx-auto px-4">
              <div className="max-w-4xl mx-auto">
                <h2 className="text-3xl md:text-4xl font-bold text-center mb-8">
                  Jaguar Warranty Plans: Flexible Options for Every Driver
                </h2>
                <div className="bg-card p-8 rounded-lg space-y-6">
                  <p className="text-lg">
                    Our Jaguar extended warranty plans cater to every owner, from low-mileage commuters to drivers of ageing or luxury Jaguar models.
                  </p>
                  <h3 className="text-xl font-semibold">Key Advantages:</h3>
                  <div className="grid md:grid-cols-2 gap-4">
                    {[
                      "Full mechanical and electrical cover",
                      "Diagnostics included within the claim",
                      "Choice of claims limits to suit your budget",
                      "Nationwide repair network across the UK",
                      "Fast claims process",
                      "Cover for hybrids and electric systems on I-Pace",
                      "Cover for high-mileage vehicles up to 150,000 miles"
                    ].map((advantage, index) => (
                      <div key={index} className="flex items-start gap-2">
                        <CheckCircle2 className="w-5 h-5 text-primary flex-shrink-0 mt-1" />
                        <span>{advantage}</span>
                      </div>
                    ))}
                  </div>
                  <p className="text-lg mt-6">
                    Each plan is designed to deliver maximum value without overselling unnecessary features.
                  </p>
                </div>
              </div>
            </div>
          </section>

          {/* Is It Worth It Section */}
          <section className="container mx-auto px-4 py-16">
            <div className="max-w-4xl mx-auto">
              <h2 className="text-3xl md:text-4xl font-bold text-center mb-8">
                Is a Jaguar Extended Warranty Worth It?
              </h2>
              <div className="space-y-6 text-lg">
                <p>
                  For many drivers, yes. Jaguars are premium vehicles with advanced parts, so when a component fails, repair costs can escalate quickly.
                </p>
                <div className="bg-card p-8 rounded-lg">
                  <h3 className="text-xl font-semibold mb-4">A Jaguar extended warranty is worth considering if:</h3>
                  <ul className="space-y-3">
                    {[
                      "Your car is over 3 years old",
                      "You want fixed, predictable ownership costs",
                      "You own a diesel Jaguar with DPF risks",
                      "Your Jaguar has performance engines prone to high repair bills",
                      "You plan to keep your car beyond 100,000 miles",
                      "You drive a hybrid or electric Jaguar with sensitive electronics"
                    ].map((reason, index) => (
                      <li key={index} className="flex items-center gap-2">
                        <CheckCircle2 className="w-5 h-5 text-primary flex-shrink-0" />
                        <span>{reason}</span>
                      </li>
                    ))}
                  </ul>
                  <p className="mt-6 text-muted-foreground">
                    A warranty also adds resale confidence, as buyers value protected cars.
                  </p>
                </div>
              </div>
            </div>
          </section>

          {/* Protecting Components Section */}
          <section className="bg-muted/50 py-16">
            <div className="container mx-auto px-4">
              <div className="max-w-4xl mx-auto">
                <h2 className="text-3xl md:text-4xl font-bold text-center mb-8">
                  Protecting Your Jaguar Electric, Hybrid and Luxury Components
                </h2>
                <div className="space-y-6 text-lg">
                  <p>Modern Jaguars feature complex systems such as:</p>
                  <div className="grid md:grid-cols-2 gap-6">
                    <div className="bg-card p-6 rounded-lg">
                      <ul className="space-y-3">
                        {[
                          "InControl infotainment units",
                          "High-voltage batteries",
                          "Electric drive motors",
                          "Adaptive suspension",
                          "Smart braking and ADAS sensors",
                          "Supercharged and turbocharged engines"
                        ].map((system, index) => (
                          <li key={index} className="flex items-center gap-2">
                            <CheckCircle2 className="w-5 h-5 text-primary flex-shrink-0" />
                            <span>{system}</span>
                          </li>
                        ))}
                      </ul>
                    </div>
                    <div className="bg-card p-6 rounded-lg flex items-center justify-center">
                      <p className="text-muted-foreground">
                        These components are expensive to repair, which is why extended protection is increasingly important for long-term ownership.
                      </p>
                    </div>
                  </div>
                </div>
              </div>
            </div>
          </section>

          {/* FAQs Section */}
          <section className="container mx-auto px-4 py-16">
            <div className="max-w-4xl mx-auto">
              <h2 className="text-3xl md:text-4xl font-bold text-center mb-12">
                Frequently Asked Questions
              </h2>
              <div className="space-y-6">
                {jaguarFAQs.map((faq, index) => (
                  <div key={index} className="bg-[#e8f5e9] p-6 rounded-lg border border-[#81c784]">
                    <h3 className="text-xl font-semibold mb-3 text-[#2e7d32]">{faq.question}</h3>
                    <p className="text-[#1b5e20]">{faq.answer}</p>
                  </div>
                ))}
              </div>
            </div>
          </section>

          {/* Final CTA Section */}
          <section className="bg-primary text-primary-foreground py-16">
            <div className="container mx-auto px-4 text-center">
              <h2 className="text-3xl md:text-4xl font-bold mb-6">
                Get Your Jaguar Warranty Quote
              </h2>
              <p className="text-xl mb-8 max-w-3xl mx-auto">
                Keep your Jaguar protected from rising repair bills with trusted mechanical and electrical cover. Enjoy smooth, worry-free driving with flexible plans built around your Jaguar's model, age and mileage.
              </p>
              <Button 
                size="lg" 
                variant="secondary"
                className="text-lg px-8"
                onClick={navigateToQuoteForm}
              >
                Get my Jaguar warranty quote →
              </Button>
            </div>
          </section>
        </main>

        <NewFooter />
        <WebsiteFooter />

        {/* Floating Action Buttons */}
        {!isMobile && (
          <div className="fixed bottom-8 right-8 flex flex-col gap-4 z-50">
            <a
              href="tel:03302295040"
              className="bg-primary text-primary-foreground p-4 rounded-full shadow-lg hover:bg-primary/90 transition-all hover:scale-110"
              aria-label="Call us"
            >
              <Phone className="w-6 h-6" />
            </a>
            <a
              href="https://wa.me/443302295040"
              target="_blank"
              rel="noopener noreferrer"
              className="bg-[#25D366] p-4 rounded-full shadow-lg hover:bg-[#128C7E] transition-all hover:scale-110"
              aria-label="WhatsApp us"
            >
              <img src={whatsappIconNew} alt="WhatsApp" className="w-6 h-6" />
            </a>
            {showScrollTop && (
              <button
                onClick={scrollToTop}
                className="bg-secondary text-secondary-foreground p-4 rounded-full shadow-lg hover:bg-secondary/90 transition-all hover:scale-110"
                aria-label="Scroll to top"
              >
                ↑
              </button>
            )}
          </div>
        )}
      </div>
    </>
  );
};

export default JaguarWarranty;
