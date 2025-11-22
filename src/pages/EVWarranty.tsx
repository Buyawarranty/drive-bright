import { useState, useEffect } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { Button } from '@/components/ui/button';
import { CheckCircle2, Shield, Clock, Phone, Menu, Star, Award } from 'lucide-react';
import { Sheet, SheetContent, SheetTrigger } from '@/components/ui/sheet';
import { SEOHead } from '@/components/SEOHead';
import TrustpilotHeader from '@/components/TrustpilotHeader';
import NewFooter from '@/components/NewFooter';
import { useIsMobile } from '@/hooks/use-mobile';
import { trackButtonClick } from '@/utils/analytics';
import { OptimizedImage } from '@/components/OptimizedImage';
import { BreadcrumbSchema } from '@/components/schema/BreadcrumbSchema';
import VehicleDetailsStep from '@/components/VehicleDetailsStep';
import evHeroImage from '@/assets/ev-hero-car.png';
import evActiveImage from '@/assets/ev-warranty-active.png';
import trustpilotLogo from '@/assets/trustpilot-excellent-box.webp';
import whatsappIconNew from '@/assets/whatsapp-icon-new.png';
import alfaRomeoLogo from '@/assets/logos/alfa-romeo.webp';
import bmwLogo from '@/assets/logos/bmw.webp';
import daciaLogo from '@/assets/logos/dacia.png';
import nissanLogo from '@/assets/logos/nissan.png';
import renaultLogo from '@/assets/logos/renault.png';
import seatLogo from '@/assets/logos/seat.webp';
import skodaLogo from '@/assets/logos/skoda.webp';
import ssangyongLogo from '@/assets/logos/ssangyong.png';

const EVWarranty = () => {
  const navigate = useNavigate();
  const isMobile = useIsMobile();
  const [showScrollTop, setShowScrollTop] = useState(false);

  const handleVehicleNext = (data: any) => {
    // Navigate to step 2 with vehicle data
    const params = new URLSearchParams({
      step: '2',
      reg: data.regNumber,
      mileage: data.mileage,
      referrer: '/ev-warranty/'
    });
    
    // Add optional vehicle details if available
    if (data.make) params.set('make', data.make);
    if (data.model) params.set('model', data.model);
    if (data.fuelType) params.set('fuelType', data.fuelType);
    if (data.year) params.set('year', data.year);
    if (data.vehicleType) params.set('vehicleType', data.vehicleType);
    
    navigate(`/?${params.toString()}`);
  };

  useEffect(() => {
    // Add Organization + Product Schema
    const organizationSchema = {
      "@context": "https://schema.org",
      "@type": "Organization",
      "name": "Buy A Warranty",
      "url": "https://buyawarranty.co.uk",
      "logo": "https://buyawarranty.co.uk/lovable-uploads/53652a24-3961-4346-bf9d-6588ef727aeb.png",
      "contactPoint": {
        "@type": "ContactPoint",
        "telephone": "+44-20-XXXX-XXXX",
        "contactType": "Customer Service",
        "areaServed": "GB"
      }
    };

    const productSchema = {
      "@context": "https://schema.org",
      "@type": "Product",
      "name": "Electric Vehicle Extended Warranty",
      "description": "Comprehensive extended warranty for electric, hybrid and PHEV vehicles with flexible payment options",
      "brand": {
        "@type": "Brand",
        "name": "Buy A Warranty"
      },
      "offers": {
        "@type": "AggregateOffer",
        "priceCurrency": "GBP",
        "lowPrice": "39",
        "highPrice": "199",
        "offerCount": "3"
      }
    };

    const faqSchema = {
      "@context": "https://schema.org",
      "@type": "FAQPage",
      "mainEntity": [
        {
          "@type": "Question",
          "name": "Do you cover electric vehicles and hybrids?",
          "acceptedAnswer": {
            "@type": "Answer",
            "text": "Yes. We provide comprehensive warranty cover for pure electric vehicles (EVs), plug-in hybrids (PHEVs), and self-charging hybrids across the UK. Our plans are tailored to protect the specialist technology that powers modern electric and hybrid cars."
          }
        },
        {
          "@type": "Question",
          "name": "Is the battery cover included?",
          "acceptedAnswer": {
            "@type": "Answer",
            "text": "Yes. Our EV warranty includes protection for the battery management system and electric drivetrain components. While natural battery degradation from age or mileage isn't covered, mechanical or electrical failure of covered components is included."
          }
        },
        {
          "@type": "Question",
          "name": "Can I get a warranty for a used electric car?",
          "acceptedAnswer": {
            "@type": "Answer",
            "text": "Yes, you can. We provide specialist warranty cover for used electric and hybrid vehicles, regardless of their age or mileage. Whether you've bought your EV from a dealer or through a private sale, our plans help protect you from unexpected mechanical and electrical repair costs."
          }
        }
      ]
    };

    const schemaScript1 = document.createElement('script');
    schemaScript1.type = 'application/ld+json';
    schemaScript1.text = JSON.stringify(organizationSchema);
    document.head.appendChild(schemaScript1);

    const schemaScript2 = document.createElement('script');
    schemaScript2.type = 'application/ld+json';
    schemaScript2.text = JSON.stringify(productSchema);
    document.head.appendChild(schemaScript2);

    const schemaScript3 = document.createElement('script');
    schemaScript3.type = 'application/ld+json';
    schemaScript3.text = JSON.stringify(faqSchema);
    document.head.appendChild(schemaScript3);

    const handleScroll = () => {
      setShowScrollTop(window.scrollY > 400);
    };
    window.addEventListener('scroll', handleScroll);

    return () => {
      document.head.removeChild(schemaScript1);
      document.head.removeChild(schemaScript2);
      document.head.removeChild(schemaScript3);
      window.removeEventListener('scroll', handleScroll);
    };
  }, []);

  const scrollToTop = () => {
    window.scrollTo({ top: 0, behavior: 'smooth' });
  };

  const navigateToQuoteForm = () => {
    trackButtonClick('ev_warranty_get_quote_cta');
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
        title="EV Extended Warranty UK | Electric & Hybrid Car Cover | Buy A Warranty"
        description="Protect your electric or hybrid car from costly repairs with affordable UK EV extended warranty plans. Cover for battery systems, motors & electronics. Get instant quotes online."
        keywords="EV warranty UK, electric car warranty, hybrid warranty UK, PHEV warranty, electric vehicle extended warranty, used EV warranty, EV battery warranty, affordable EV cover, electric car insurance UK"
        canonical="https://buyawarranty.co.uk/ev-warranty/"
        ogTitle="EV Extended Warranty UK | Electric & Hybrid Car Cover"
        ogDescription="Protect your electric or hybrid car from costly repairs with affordable UK EV extended warranty plans. Cover for battery systems, motors & electronics."
        ogImage="https://buyawarranty.co.uk/ev-warranty-og.jpg"
        geoRegion="GB"
        geoPlacename="United Kingdom"
        geoPosition="54.5;-4.5"
        ICBM="54.5, -4.5"
      />

      <BreadcrumbSchema 
        items={[
          { name: "Home", url: "https://buyawarranty.co.uk/" },
          { name: "EV Warranty", url: "https://buyawarranty.co.uk/ev-warranty/" }
        ]}
      />

      <main className="min-h-screen bg-background">
        <TrustpilotHeader />
        
        {/* Hero Section */}
        <section className="container mx-auto px-4 sm:px-6 lg:px-8 py-12 md:py-20">
          <div className="grid lg:grid-cols-2 gap-8 lg:gap-12 items-center">
            <div className="space-y-6 text-center lg:text-left">
              <h1 className="text-4xl md:text-5xl lg:text-6xl font-bold tracking-tight">
                Electric, Hybrid and PHEV Vehicle Extended Warranty
              </h1>
              <p className="text-2xl md:text-3xl font-bold text-primary">
                Protect Your Electric Vehicle with Specialist UK Cover
              </p>
              <p className="text-lg md:text-xl text-muted-foreground max-w-2xl mx-auto lg:mx-0">
                Buy A Warranty provides comprehensive electric and hybrid car warranty cover for UK drivers. Protect your EV or hybrid from costly repairs to batteries, motors, and drivetrains with flexible, affordable plans.
              </p>
              <div className="flex flex-col sm:flex-row gap-4 justify-center lg:justify-start">
                <Button 
                  onClick={navigateToQuoteForm}
                  size="lg"
                  className="text-lg px-8 py-6"
                >
                  Get Your EV Warranty Quote
                </Button>
                <Button 
                  onClick={navigateToQuoteForm}
                  variant="outline"
                  size="lg"
                  className="text-lg px-8 py-6"
                >
                  Compare Plans
                </Button>
              </div>
              <div className="flex items-center justify-center lg:justify-start gap-2">
                <OptimizedImage 
                  src={trustpilotLogo} 
                  alt="Trustpilot Excellent Rating" 
                  className="h-8 md:h-10"
                  priority
                />
              </div>
            </div>
            <div className="relative flex justify-center">
              <OptimizedImage 
                src={evHeroImage} 
                alt="Electric Vehicle Warranty UK - EV and Hybrid Protection"
                className="w-2/3 h-auto"
                priority
              />
            </div>
          </div>
        </section>

        {/* Trustpilot Badge */}
        <div className="py-8 flex justify-end container mx-auto px-4 sm:px-6 lg:px-8">
          <TrustpilotHeader />
        </div>

        {/* Specialist Protection Section */}
        <section className="bg-muted/30 py-16">
          <div className="container mx-auto px-4 sm:px-6 lg:px-8">
            <div className="max-w-4xl mx-auto text-center space-y-6 mb-12">
              <h2 className="text-3xl md:text-4xl font-bold">
                Specialist Protection for Electric & Hybrid Vehicles
              </h2>
              <p className="text-lg text-muted-foreground">
                Electric and hybrid vehicles are powered by advanced technology - and repairing that technology can be expensive. Our specialist EV warranty ensures that if key components fail, you're covered for parts, labour, and diagnostics at approved garages across the UK.
              </p>
            </div>
            <div className="grid md:grid-cols-2 lg:grid-cols-3 gap-6 max-w-6xl mx-auto">
              {[
                { icon: Shield, title: "Cover for electric and hybrid components, including drive batteries" },
                { icon: Clock, title: "Flexible payment plans with low monthly options" },
                { icon: CheckCircle2, title: "Instant online quotes and easy policy setup" },
                { icon: Award, title: "Nationwide network of approved repairers" },
                { icon: Star, title: "Transparent terms with no hidden charges" }
              ].map((item, index) => (
                <div key={index} className="bg-card p-6 rounded-lg border hover:shadow-lg transition-shadow">
                  <item.icon className="w-12 h-12 text-primary mb-4" />
                  <p className="text-base">{item.title}</p>
                </div>
              ))}
            </div>
          </div>
        </section>

        {/* Trustpilot Badge */}
        <div className="py-8 flex justify-end container mx-auto px-4 sm:px-6 lg:px-8">
          <TrustpilotHeader />
        </div>

        {/* Why Choose Us Section */}
        <section className="container mx-auto px-4 sm:px-6 lg:px-8 py-16">
          <div className="text-center mb-12">
            <h2 className="text-3xl md:text-4xl font-bold mb-4">
              Why Choose Buy A Warranty for EV Cover
            </h2>
          </div>
          <div className="grid md:grid-cols-2 lg:grid-cols-4 gap-8 max-w-6xl mx-auto">
            <div className="text-center space-y-4">
              <div className="bg-primary/10 w-16 h-16 rounded-full flex items-center justify-center mx-auto">
                <Shield className="w-8 h-8 text-primary" />
              </div>
              <h3 className="text-xl font-semibold">1. Expert EV Protection</h3>
              <p className="text-muted-foreground">
                Our policies are designed exclusively for electric, hybrid, and plug-in hybrid vehicles. From battery systems to regenerative braking and charging infrastructure, every plan is designed with EV technology in mind.
              </p>
            </div>
            <div className="text-center space-y-4">
              <div className="bg-primary/10 w-16 h-16 rounded-full flex items-center justify-center mx-auto">
                <CheckCircle2 className="w-8 h-8 text-primary" />
              </div>
              <h3 className="text-xl font-semibold">2. Used EVs, Hybrids and PHEVs Welcome</h3>
              <p className="text-muted-foreground">
                Whether you've bought a brand-new model or a used electric car, we provide cover for vehicles of all ages and mileages - perfect for post-manufacturer protection.
              </p>
            </div>
            <div className="text-center space-y-4">
              <div className="bg-primary/10 w-16 h-16 rounded-full flex items-center justify-center mx-auto">
                <Clock className="w-8 h-8 text-primary" />
              </div>
              <h3 className="text-xl font-semibold">3. Affordable & Flexible Plans</h3>
              <p className="text-muted-foreground">
                Choose between monthly, annual, or multi-year cover. You can upgrade anytime, adjust claim limits, and spread payments to suit your budget.
              </p>
            </div>
            <div className="text-center space-y-4">
              <div className="bg-primary/10 w-16 h-16 rounded-full flex items-center justify-center mx-auto">
                <Star className="w-8 h-8 text-primary" />
              </div>
              <h3 className="text-xl font-semibold">4. Trusted by UK Drivers</h3>
              <p className="text-muted-foreground">
                Thousands of UK motorists rely on us for transparent service, quick claims, and real support when it matters most.
              </p>
            </div>
          </div>
        </section>

        {/* Get Your EV Quote Section */}
        <section className="py-16 bg-background">
          <div className="max-w-5xl mx-auto px-4 sm:px-6 lg:px-8">
            <div className="text-center mb-8">
              <h2 className="text-3xl md:text-4xl font-bold text-foreground mb-4">
                Get Your Instant EV Warranty Quote
              </h2>
              <p className="text-lg text-muted-foreground">
                From just 80p a day • Easy claims • Fast payouts<br />
                Unlimited claims • Complete Cover • No excess
              </p>
            </div>
            
            <div className="bg-card rounded-lg shadow-lg p-6 md:p-8 border border-border">
              <VehicleDetailsStep 
                onNext={handleVehicleNext}
              />
            </div>
            
            <div className="mt-6 text-center">
              <p className="text-sm text-muted-foreground">
                Protection for vehicles up to 150,000 miles and 15 years.
              </p>
            </div>
          </div>
        </section>

        {/* What's Covered Section */}
        <section className="bg-card py-16">
          <div className="container mx-auto px-4 sm:px-6 lg:px-8">
            <div className="grid lg:grid-cols-2 gap-12 items-center">
              <div className="space-y-6">
                <h2 className="text-3xl md:text-4xl font-bold">
                  What's Covered in Your EV Warranty
                </h2>
                <p className="text-lg text-muted-foreground">
                  Our electric and hybrid car warranty protects the systems that keep your vehicle running efficiently and safely.
                </p>
                <h3 className="text-xl font-semibold">Key Components Covered:</h3>
                <ul className="space-y-3">
                  {[
                    "Drive battery and battery management system",
                    "Electric motor and drivetrain",
                    "Inverter and charging system",
                    "Regenerative braking components",
                    "Cooling and thermal management systems",
                    "Suspension, steering, and braking systems",
                    "Air conditioning and climate control",
                    "Infotainment and electronic modules",
                    "Labour and diagnostics up to your claim limit"
                  ].map((item, index) => (
                    <li key={index} className="flex items-start gap-3">
                      <CheckCircle2 className="w-5 h-5 text-primary flex-shrink-0 mt-0.5" />
                      <span>{item}</span>
                    </li>
                  ))}
                </ul>
                <Button onClick={navigateToQuoteForm} size="lg">
                  Get Your Quote Now
                </Button>
              </div>
              <div className="flex justify-center">
                <OptimizedImage 
                  src={evActiveImage} 
                  alt="EV Warranty Active - Electric Vehicle Coverage"
                  className="w-[70%] h-auto"
                />
              </div>
            </div>
          </div>
        </section>

        {/* Trustpilot Badge */}
        <div className="py-8 flex justify-end container mx-auto px-4 sm:px-6 lg:px-8">
          <TrustpilotHeader />
        </div>

        {/* Why Worth It Section */}
        <section className="container mx-auto px-4 sm:px-6 lg:px-8 py-16">
          <div className="max-w-4xl mx-auto text-center space-y-6">
            <h2 className="text-3xl md:text-4xl font-bold">
              Why an Electric Vehicle Warranty is Worth It
            </h2>
            <p className="text-lg text-muted-foreground">
              Electric vehicles are reliable but not immune to failure. Specialist parts like power inverters, cooling systems, and battery packs are expensive to replace - often exceeding £1500 for a single repair.
            </p>
            <p className="text-lg text-muted-foreground">
              An EV warranty helps you avoid large, unexpected bills and ensures expert repairs using approved parts. It's a smart way to protect your investment and maintain confidence on every journey.
            </p>
            <div className="grid md:grid-cols-2 gap-6 mt-8">
              <div className="bg-card p-6 rounded-lg border">
                <div className="text-4xl font-bold text-primary mb-2">£1500+</div>
                <p className="text-muted-foreground">Average EV repair cost without warranty</p>
              </div>
              <div className="bg-card p-6 rounded-lg border">
                <div className="text-4xl font-bold text-primary mb-2">from £39</div>
                <p className="text-muted-foreground">Average Buy A Warranty monthly plan</p>
              </div>
            </div>
          </div>
        </section>

        {/* EV Warranty Plans Section */}
        <section className="bg-muted/30 py-16">
          <div className="container mx-auto px-4 sm:px-6 lg:px-8">
            <div className="text-center mb-12">
              <h2 className="text-3xl md:text-4xl font-bold mb-4">
                EV Warranty Plans & Payment Options
              </h2>
              <p className="text-lg text-muted-foreground">
                Find the perfect plan for your vehicle and budget
              </p>
            </div>
            <div className="max-w-5xl mx-auto overflow-x-auto">
              <table className="w-full bg-card rounded-lg border">
                <thead>
                  <tr className="border-b">
                    <th className="text-left p-4 font-semibold">Plan Type</th>
                    <th className="text-left p-4 font-semibold">Duration</th>
                    <th className="text-left p-4 font-semibold">Best For</th>
                    <th className="text-left p-4 font-semibold">Payment Options</th>
                  </tr>
                </thead>
                <tbody>
                  <tr className="border-b">
                    <td className="p-4 font-medium">Essential EV Cover</td>
                    <td className="p-4">12 months</td>
                    <td className="p-4">1 year basic protection for key electric car systems; electrical and mechanical</td>
                    <td className="p-4">Pay monthly or annually</td>
                  </tr>
                  <tr className="border-b">
                    <td className="p-4 font-medium">Comprehensive EV Cover</td>
                    <td className="p-4">24 months</td>
                    <td className="p-4">2 year full mechanical & electrical protection</td>
                    <td className="p-4">Pay monthly with discount for annual</td>
                  </tr>
                  <tr>
                    <td className="p-4 font-medium">Premium EV Cover</td>
                    <td className="p-4">36 months</td>
                    <td className="p-4">3 years maximum peace of mind with battery cover</td>
                    <td className="p-4">Flexible terms and renewals and further discount</td>
                  </tr>
                </tbody>
              </table>
            </div>
            <div className="text-center mt-8">
              <Button onClick={navigateToQuoteForm} size="lg">
                Get an Instant Quote Online
              </Button>
            </div>
          </div>
        </section>

        {/* Coverage for Used EVs Section */}
        <section className="container mx-auto px-4 sm:px-6 lg:px-8 py-16">
          <div className="max-w-4xl mx-auto">
            <h2 className="text-3xl md:text-4xl font-bold mb-6 text-center">
              Coverage for Used & High-Mileage EVs
            </h2>
            <p className="text-lg text-muted-foreground mb-8 text-center">
              Our policies aren't just for new cars. If you've purchased a second-hand EV or hybrid, you can still protect it against unexpected breakdowns.
            </p>
            <ul className="space-y-4 max-w-2xl mx-auto">
              {[
                "Accepted for vehicles up to 15 years old and 150,000 miles",
                "Cover available after private sale or dealer purchase",
                "Immediate protection, no lengthy inspections",
                "Transferable to new owners if you sell your car"
              ].map((item, index) => (
                <li key={index} className="flex items-start gap-3">
                  <CheckCircle2 className="w-6 h-6 text-primary flex-shrink-0 mt-0.5" />
                  <span className="text-lg">{item}</span>
                </li>
              ))}
            </ul>
            <p className="text-center text-muted-foreground mt-6">
              Keep your used EV covered long after the manufacturer's warranty ends.
            </p>
          </div>
        </section>

        {/* Easy Claims Section */}
        <section className="bg-card py-16">
          <div className="container mx-auto px-4 sm:px-6 lg:px-8">
            <div className="max-w-4xl mx-auto">
              <h2 className="text-3xl md:text-4xl font-bold mb-8 text-center">
                Easy Claims, Fast Repairs
              </h2>
              <p className="text-lg text-muted-foreground mb-8 text-center">
                Making a claim is simple:
              </p>
              <div className="grid md:grid-cols-4 gap-6">
                <div className="text-center space-y-3">
                  <div className="bg-primary text-primary-foreground w-12 h-12 rounded-full flex items-center justify-center mx-auto text-xl font-bold">1</div>
                  <p className="font-medium">Contact us or log in to your account</p>
                </div>
                <div className="text-center space-y-3">
                  <div className="bg-primary text-primary-foreground w-12 h-12 rounded-full flex items-center justify-center mx-auto text-xl font-bold">2</div>
                  <p className="font-medium">Authorisation is issued directly to your chosen garage</p>
                </div>
                <div className="text-center space-y-3">
                  <div className="bg-primary text-primary-foreground w-12 h-12 rounded-full flex items-center justify-center mx-auto text-xl font-bold">3</div>
                  <p className="font-medium">Repairs are carried out quickly using approved parts</p>
                </div>
                <div className="text-center space-y-3">
                  <div className="bg-primary text-primary-foreground w-12 h-12 rounded-full flex items-center justify-center mx-auto text-xl font-bold">4</div>
                  <p className="font-medium">We pay the garage directly</p>
                </div>
              </div>
              <p className="text-center text-muted-foreground mt-8">
                No delays, no paperwork, and no unexpected costs.
              </p>
            </div>
          </div>
        </section>

        {/* Why UK Drivers Trust Section */}
        <section className="container mx-auto px-4 sm:px-6 lg:px-8 py-16">
          <div className="text-center mb-12">
            <h2 className="text-3xl md:text-4xl font-bold mb-4">
              Why UK Drivers Trust Buy A Warranty
            </h2>
          </div>
          <div className="grid md:grid-cols-2 lg:grid-cols-4 gap-6 max-w-6xl mx-auto">
            {[
              { icon: Award, title: "Over 3,000 approved garages nationwide" },
              { icon: Phone, title: "UK-based support team ready to assist" },
              { icon: Star, title: "Excellent customer satisfaction ratings" },
              { icon: CheckCircle2, title: "Clear online tracking for all claims" }
            ].map((item, index) => (
              <div key={index} className="bg-card p-6 rounded-lg border text-center hover:shadow-lg transition-shadow">
                <item.icon className="w-12 h-12 text-primary mb-4 mx-auto" />
                <p className="font-medium">{item.title}</p>
              </div>
            ))}
          </div>
          <p className="text-center text-muted-foreground mt-8 text-lg">
            Trusted by EV and hybrid drivers across the UK - from first-time owners to long-term EV enthusiasts.
          </p>
        </section>

        {/* Manufacturers Covered */}
        <section className="py-16 bg-white" aria-labelledby="manufacturers-covered">
          <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
            <div className="max-w-6xl mx-auto">
              <h2 id="manufacturers-covered" className="text-3xl md:text-4xl font-bold text-center mb-12">
                Manufacturers Covered Under Our Warranty Plans
              </h2>
              
              <div className="grid grid-cols-2 md:grid-cols-4 lg:grid-cols-6 gap-6 text-center">
                {[
                  { name: 'Jaguar', logo: 'https://logo.clearbit.com/jaguar.com' },
                  { name: 'Land Rover', logo: 'https://logo.clearbit.com/landrover.com' },
                  { name: 'MG', logo: 'https://logo.clearbit.com/mgmotor.eu' },
                  { name: 'Mini', logo: 'https://logo.clearbit.com/mini.com' },
                  { name: 'Alfa Romeo', logo: alfaRomeoLogo },
                  { name: 'Audi', logo: 'https://logo.clearbit.com/audi.com' },
                  { name: 'BMW', logo: bmwLogo },
                  { name: 'Chevrolet', logo: 'https://logo.clearbit.com/chevrolet.com' },
                  { name: 'Chrysler', logo: 'https://logo.clearbit.com/chrysler.com' },
                  { name: 'Citroën', logo: 'https://logo.clearbit.com/citroen.com' },
                  { name: 'Dacia', logo: daciaLogo },
                  { name: 'Daewoo', logo: 'https://logo.clearbit.com/daewoo.com' },
                  { name: 'Daihatsu', logo: 'https://logo.clearbit.com/daihatsu.com' },
                  { name: 'Fiat', logo: 'https://logo.clearbit.com/fiat.com' },
                  { name: 'Ford', logo: 'https://logo.clearbit.com/ford.com' },
                  { name: 'Honda', logo: 'https://logo.clearbit.com/honda.com' },
                  { name: 'Hyundai', logo: 'https://logo.clearbit.com/hyundai.com' },
                  { name: 'Infiniti', logo: 'https://logo.clearbit.com/infiniti.com' },
                  { name: 'Isuzu', logo: 'https://logo.clearbit.com/isuzu.com' },
                  { name: 'Iveco', logo: 'https://logo.clearbit.com/iveco.com' },
                  { name: 'Jeep', logo: 'https://logo.clearbit.com/jeep.com' },
                  { name: 'Kia', logo: 'https://logo.clearbit.com/kia.com' },
                  { name: 'Lexus', logo: 'https://logo.clearbit.com/lexus.com' },
                  { name: 'Mazda', logo: 'https://logo.clearbit.com/mazda.com' },
                  { name: 'Mercedes-Benz', logo: 'https://logo.clearbit.com/mercedes-benz.com' },
                  { name: 'Mitsubishi', logo: 'https://logo.clearbit.com/mitsubishi-motors.com' },
                  { name: 'Nissan', logo: nissanLogo },
                  { name: 'Peugeot', logo: 'https://logo.clearbit.com/peugeot.com' },
                  { name: 'Renault', logo: renaultLogo },
                  { name: 'SEAT', logo: seatLogo },
                  { name: 'Škoda', logo: skodaLogo },
                  { name: 'Smart', logo: 'https://logo.clearbit.com/smart.com' },
                  { name: 'SsangYong', logo: ssangyongLogo },
                  { name: 'Subaru', logo: 'https://logo.clearbit.com/subaru.com' },
                  { name: 'Suzuki', logo: 'https://logo.clearbit.com/suzuki.com' },
                  { name: 'Tesla', logo: 'https://logo.clearbit.com/tesla.com' },
                  { name: 'Toyota', logo: 'https://logo.clearbit.com/toyota.com' },
                  { name: 'Volkswagen', logo: 'https://logo.clearbit.com/volkswagen.com' },
                  { name: 'Volvo', logo: 'https://logo.clearbit.com/volvo.com' },
                  { name: 'Yamaha', logo: 'https://logo.clearbit.com/yamaha-motor.com' }
                ].map((brand) => (
                   <div key={brand.name} className="p-4 bg-gray-50 rounded-lg hover:bg-gray-100 transition-colors flex flex-col items-center gap-3">
                     <img 
                       src={brand.logo} 
                       alt={`${brand.name} EV warranty coverage - UK extended warranty available`} 
                       className="h-10 w-auto object-contain"
                       loading="lazy"
                       width="80"
                       height="40"
                       onError={(e) => {
                         e.currentTarget.style.display = 'none';
                       }}
                     />
                     <p className="font-semibold text-gray-800">{brand.name}</p>
                   </div>
                ))}
              </div>
            </div>
          </div>
        </section>

        {/* FAQs Section */}
        <section className="bg-muted/30 py-16">
          <div className="container mx-auto px-4 sm:px-6 lg:px-8">
            <h2 className="text-3xl md:text-4xl font-bold mb-12 text-center">
              Frequently Asked Questions
            </h2>
            <div className="max-w-4xl mx-auto space-y-6">
              {[
                {
                  q: "Do you cover electric vehicles and hybrids?",
                  a: "Yes. We provide comprehensive warranty cover for pure electric vehicles (EVs), plug-in hybrids (PHEVs), and self-charging hybrids across the UK. Our plans are tailored to protect the specialist technology that powers modern electric and hybrid cars."
                },
                {
                  q: "Is the battery cover included?",
                  a: "Yes. Our EV warranty includes protection for the battery management system and electric drivetrain components. While natural battery degradation from age or mileage isn't covered, mechanical or electrical failure of covered components is included."
                },
                {
                  q: "Can I get a warranty for a used electric car?",
                  a: "Yes, you can. We provide specialist warranty cover for used electric and hybrid vehicles, regardless of their age or mileage. Whether you've bought your EV from a dealer or through a private sale, our plans help protect you from unexpected mechanical and electrical repair costs. It's an easy way to keep your used electric car on the road with complete peace of mind."
                },
                {
                  q: "How quickly can I buy an EV warranty online?",
                  a: "It takes only a few minutes to get started. Simply enter your registration number to receive an instant online quote, choose your plan, and complete your purchase. Your cover begins immediately upon payment, giving you protection without delay."
                },
                {
                  q: "What makes Buy A Warranty one of the best EV warranty providers in the UK?",
                  a: "We're specialists in electric and hybrid vehicle protection, offering transparent pricing, flexible payment plans, and dedicated customer support. Thousands of satisfied UK drivers trust us for our clear terms, quick claims process, and genuine understanding of EV technology."
                },
                {
                  q: "How long does the warranty last?",
                  a: "You can choose between 12, 24, or 36 months of cover for hybrid, EV or PHEV cars and vans. All plans are renewable and can be upgraded anytime."
                },
                {
                  q: "Do you cover Tesla and premium EV brands?",
                  a: "Yes, we provide coverage for a wide range of makes and models, including Tesla, BMW i Series, Mercedes EQ, Nissan Leaf, Audi e-tron, Kia EV6, Hyundai Ioniq, Toyota hybrids, and more. Your quote will be customised to match your vehicle's make and mileage."
                },
                {
                  q: "Does the warranty cover battery degradation or range loss?",
                  a: "No warranty covers natural battery degradation or normal range reduction over time. However, our cover includes mechanical or electrical failure of the battery or its control modules."
                },
                {
                  q: "Can I extend my manufacturer's EV warranty with Buy A Warranty?",
                  a: "Yes, you can extend coverage once your manufacturer warranty expires. Our plans act as post-manufacturer protection, covering all major systems and giving you continued peace of mind beyond the initial dealer cover."
                }
              ].map((faq, index) => (
                <div key={index} className="bg-primary p-6 rounded-lg shadow-sm">
                  <h3 className="text-xl font-semibold text-primary-foreground mb-3">{faq.q}</h3>
                  <p className="text-primary-foreground/90">{faq.a}</p>
                </div>
              ))}
            </div>
          </div>
        </section>

        {/* Final CTA Section */}
        <section className="container mx-auto px-4 sm:px-6 lg:px-8 py-16">
          <div className="max-w-4xl mx-auto text-center space-y-6 bg-primary/5 p-8 md:p-12 rounded-lg border-2 border-primary/20">
            <h2 className="text-3xl md:text-4xl font-bold">
              Get Your Electric Car Warranty Quote
            </h2>
            <p className="text-lg text-muted-foreground">
              Protect your EV or hybrid vehicle today with expert UK warranty cover.
            </p>
            <ul className="space-y-3 max-w-md mx-auto text-left">
              {[
                "Instant online quotes",
                "No-obligation price check",
                "Transparent plans and low-cost payments"
              ].map((item, index) => (
                <li key={index} className="flex items-center gap-3">
                  <CheckCircle2 className="w-5 h-5 text-primary flex-shrink-0" />
                  <span>{item}</span>
                </li>
              ))}
            </ul>
            <Button onClick={navigateToQuoteForm} size="lg" className="text-lg px-10 py-6">
              Get Your EV Warranty Quote Now
            </Button>
            <p className="text-sm text-muted-foreground italic">
              Buy A Warranty - protecting the future of UK driving with smarter, affordable cover for electric and hybrid vehicles.
            </p>
          </div>
        </section>

        <NewFooter />
      </main>

      {/* Floating Contact Buttons */}
      {!isMobile && (
        <div className="fixed right-6 bottom-6 z-40 flex flex-col gap-3">
          <a 
            href="https://wa.me/message/SPQPJ6O3UBF5B1" 
            target="_blank" 
            rel="noopener noreferrer"
            className="bg-green-500 hover:bg-green-600 text-white rounded-full p-4 shadow-lg transition-all hover:scale-110"
          >
            <OptimizedImage src={whatsappIconNew} alt="WhatsApp" className="w-8 h-8" />
          </a>
          <a 
            href="tel:+442045380742"
            className="bg-primary hover:bg-primary/90 text-primary-foreground rounded-full p-4 shadow-lg transition-all hover:scale-110"
          >
            <Phone className="w-8 h-8" />
          </a>
        </div>
      )}

      {/* Scroll to Top Button */}
      {showScrollTop && (
        <button
          onClick={scrollToTop}
          className="fixed left-6 bottom-6 z-40 bg-card border-2 border-primary text-primary rounded-full p-4 shadow-lg hover:bg-primary hover:text-primary-foreground transition-all hover:scale-110"
        >
          <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 10l7-7m0 0l7 7m-7-7v18" />
          </svg>
        </button>
      )}
    </>
  );
};

export default EVWarranty;
