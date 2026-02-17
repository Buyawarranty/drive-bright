import React, { useState } from 'react';
import { Link } from 'react-router-dom';
import { Phone, Shield, Clock, CheckCircle2, FileText, Wrench, Zap } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { SEOHead } from '@/components/SEOHead';
import { OrganizationSchema } from '@/components/schema/OrganizationSchema';
import { WebPageSchema } from '@/components/schema/WebPageSchema';
import { FAQSchema } from '@/components/schema/FAQSchema';
import { ProductSchema } from '@/components/schema/ProductSchema';
import { BreadcrumbSchema } from '@/components/schema/BreadcrumbSchema';
import TrustpilotHeader from '@/components/TrustpilotHeader';
import { getResponsiveImageProps } from '@/utils/imageOptimizer';
import QuoteFormInline from '@/components/QuoteFormInline';
import TrustCallbackPanel from '@/components/TrustCallbackPanel';
import WebsiteFooter from '@/components/WebsiteFooter';
import heroImg from '@/assets/land-rover-range-rover-sport-warranty.png';
import defenderImg from '@/assets/land-rover-defender-warranty.png';
import discoveryImg from '@/assets/land-rover-discovery-sport-warranty.png';

const LandRoverWarranty: React.FC = () => {
  const [showRegForm, setShowRegForm] = useState(false);

  const scrollToQuote = () => {
    window.location.href = '/#get-quote';
  };

  const faqItems = [
    {
      question: "How much does a Land Rover extended warranty cost?",
      answer: "Prices depend on your vehicle's age, mileage, and chosen cover level. Newer models cost less while older high-mileage vehicles cost slightly more. Enter your registration above to see your personalised instant quote."
    },
    {
      question: "Are Land Rover extended warranties worth it?",
      answer: "Yes. Land Rovers feature complex 4x4 systems, air suspension, and advanced electronics. A single major repair can cost thousands. An extended warranty protects you from unexpected bills and keeps your vehicle on the road."
    },
    {
      question: "Can I buy a Land Rover warranty after the manufacturer warranty expires?",
      answer: "Yes, you can buy cover at any time provided the vehicle has no active pre-existing faults. Earlier purchases usually offer lower premiums and broader cover options."
    },
    {
      question: "What Land Rover models do you cover?",
      answer: "We cover all Land Rover and Range Rover models from 2012 to 2026 including the Defender, Discovery, Discovery Sport, Range Rover, Range Rover Sport, Range Rover Evoque, and Range Rover Velar."
    },
    {
      question: "Can I use my own garage for repairs?",
      answer: "Yes. You can use any VAT-registered garage or one from our approved UK-wide network."
    },
    {
      question: "Is the warranty transferable if I sell my Land Rover?",
      answer: "Yes. Your warranty can be transferred to the new owner as an optional add-on, increasing the resale value of your vehicle."
    },
    {
      question: "What happens if my Land Rover breaks down?",
      answer: "Contact our claims team and we'll authorise the repair. Our plans include optional roadside assistance and recovery to get you moving quickly."
    },
    {
      question: "How fast can I get cover?",
      answer: "You can get an instant online quote and start your cover immediately upon payment. No inspections or delays."
    }
  ];

  const breadcrumbItems = [
    { name: 'Home', url: 'https://buyawarranty.co.uk/' },
    { name: 'Car Extended Warranty', url: 'https://buyawarranty.co.uk/car-extended-warranty/' },
    { name: 'Land Rover Warranty', url: 'https://buyawarranty.co.uk/car-extended-warranty/land-rover/' }
  ];

  const landRoverModels = [
    { model: 'Range Rover', years: '2012–2026', coverage: 'Full engine, gearbox, air suspension, and electrical systems' },
    { model: 'Range Rover Sport', years: '2012–2026', coverage: 'Complete drivetrain, adaptive dynamics, and Terrain Response' },
    { model: 'Range Rover Evoque', years: '2012–2026', coverage: 'Engine, transmission, cooling, and infotainment systems' },
    { model: 'Range Rover Velar', years: '2017–2026', coverage: 'Mechanical, electrical, and advanced driver-assist components' },
    { model: 'Defender 90', years: '2020–2026', coverage: 'Engine, 4x4 systems, suspension, and off-road electronics' },
    { model: 'Defender 110', years: '2020–2026', coverage: 'Full mechanical and electrical cover including wading systems' },
    { model: 'Defender 130', years: '2023–2026', coverage: 'Complete drivetrain, air suspension, and electronic systems' },
    { model: 'Discovery', years: '2012–2026', coverage: 'Engine, gearbox, transfer case, and climate control' },
    { model: 'Discovery Sport', years: '2015–2026', coverage: 'Powertrain, steering, brakes, and electrical components' },
    { model: 'Freelander 2', years: '2012–2014', coverage: 'Engine, transmission, suspension, and cooling systems' },
  ];

  return (
    <>
      <SEOHead
        title="Land Rover Extended Warranty UK | Cover All Models 2012–2026"
        description="Protect your Land Rover with an affordable extended warranty. Cover for Defender, Range Rover, Discovery & Evoque. Instant quotes, 150,000-mile limit, flexible UK plans from £20/month."
        keywords="Land Rover warranty, Range Rover warranty, Defender warranty, Discovery warranty, Land Rover extended warranty UK, Range Rover Sport warranty, Evoque warranty, Velar warranty, used Land Rover warranty, Land Rover car warranty"
        canonical="https://buyawarranty.co.uk/car-extended-warranty/land-rover/"
        ogTitle="Land Rover Extended Warranty UK | Defender, Range Rover & Discovery Cover"
        ogDescription="Affordable extended warranty for all Land Rover models 2012–2026. Instant quotes, flexible plans, 150,000-mile limit. Protect your Defender, Range Rover, Discovery or Evoque today."
        ogImage="https://buyawarranty.co.uk/lovable-uploads/53652a24-3961-4346-bf9d-6588ef727aeb.png"
        geoRegion="GB"
        geoPlacename="United Kingdom"
        geoPosition="54.5;-4.5"
        ICBM="54.5, -4.5"
      />
      <OrganizationSchema type="InsuranceAgency" />
      <WebPageSchema
        name="Land Rover Extended Warranty UK | All Models Covered"
        description="Comprehensive extended warranty for Land Rover and Range Rover vehicles in the UK. Protect your Defender, Discovery, Evoque, Velar, or Range Rover Sport from unexpected repair costs with flexible plans."
        url="https://buyawarranty.co.uk/car-extended-warranty/land-rover/"
        specialty="Land Rover Extended Warranty, Range Rover Warranty, Defender Warranty, Discovery Warranty"
      />
      <FAQSchema faqs={faqItems} />
      <ProductSchema
        name="Land Rover Extended Warranty Plans UK"
        description="Comprehensive Land Rover warranty covering mechanical and electrical failures for Defender, Range Rover, Discovery, Evoque and Velar models from 2012 to 2026."
        price="19.00"
        priceCurrency="GBP"
        brand="Buy A Warranty"
        category="Land Rover Extended Warranty & Vehicle Protection"
        image="https://buyawarranty.co.uk/lovable-uploads/53652a24-3961-4346-bf9d-6588ef727aeb.png"
        availability="InStock"
        areaServed="GB"
      />
      <BreadcrumbSchema items={breadcrumbItems} />

      <div className="min-h-screen bg-background">
        {/* Hero Section */}
        <section className="relative bg-gradient-to-br from-primary/5 via-background to-primary/5 pt-24 pb-16 overflow-hidden">
          <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
            <div className="grid lg:grid-cols-2 gap-12 items-center">
              <div>
                <h1 className="text-4xl md:text-5xl lg:text-6xl font-bold text-foreground mb-6 leading-tight">
                  Land Rover Extended Warranty for Every Model
                </h1>
                <p className="text-xl text-muted-foreground mb-8 leading-relaxed">
                  Protect your Land Rover from costly repairs with trusted UK warranty cover. Instant quotes, flexible plans, and protection for vehicles up to 150,000 miles.
                </p>
                <div className="flex flex-col sm:flex-row gap-4">
                  <Button
                    size="lg"
                    onClick={scrollToQuote}
                    className="text-lg px-8 py-6"
                  >
                    Get Your Land Rover Quote
                  </Button>
                  <Button
                    size="lg"
                    variant="outline"
                    onClick={() => window.location.href = 'tel:03302295040'}
                    className="text-lg px-8 py-6"
                  >
                    <Phone className="mr-2 h-5 w-5" />
                    Call: 0330 229 5040
                  </Button>
                </div>
              </div>
              <div className="relative">
                <img
                  {...getResponsiveImageProps({
                    src: heroImg,
                    alt: "Range Rover Sport with extended warranty coverage from Buy A Warranty UK",
                    width: 600,
                    height: 408,
                    loading: 'eager',
                    priority: true
                  })}
                  className="w-3/5 h-auto drop-shadow-2xl mx-auto"
                />
              </div>
            </div>
          </div>
        </section>

        {/* What is Section */}
        <section className="py-16 bg-card">
          <div className="max-w-4xl mx-auto px-4 sm:px-6 lg:px-8">
            <h2 className="text-3xl md:text-4xl font-bold text-center text-foreground mb-6">
              What is a Land Rover Extended Warranty?
            </h2>
            <p className="text-lg text-muted-foreground text-center leading-relaxed">
              A Land Rover extended warranty is a protection plan that covers the cost of repairing mechanical and electrical failures once the original manufacturer warranty expires. It includes parts, labour, and diagnostics for components like engines, gearboxes, air suspension, and advanced 4x4 systems. Cover is available for new and used Land Rover and Range Rover models from 2012 to 2026.
            </p>
          </div>
        </section>

        {/* Get Your Quote Section with QuoteFormInline */}
        <section className="py-16 bg-background" id="get-quote">
          <div className="max-w-5xl mx-auto px-4 sm:px-6 lg:px-8">
            <div className="text-center mb-8">
              <h2 className="text-3xl md:text-4xl font-bold text-foreground mb-4">
                Get Your Instant Land Rover Warranty Quote
              </h2>
              <p className="text-lg text-muted-foreground">
                From just 80p a day • Easy claims • Fast payouts<br />
                Unlimited claims • Complete Cover • No excess
              </p>
            </div>

            <div className="flex justify-center">
              <QuoteFormInline vehicleType="car" />
            </div>
            <TrustCallbackPanel />

            <div className="mt-6 text-center">
              <p className="text-sm text-muted-foreground">
                Protection for Land Rover vehicles up to 150,000 miles and 15 years old.
              </p>
            </div>
          </div>
        </section>

        {/* Why Choose Us */}
        <section className="py-16 bg-background">
          <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
            <div className="text-center mb-12">
              <h2 className="text-3xl md:text-4xl font-bold text-foreground mb-4">
                Why Consider a Land Rover Extended Warranty?
              </h2>
              <p className="text-xl text-muted-foreground max-w-3xl mx-auto">
                Land Rover repair bills can escalate quickly due to complex 4x4 systems, luxury electronics, and premium components. A warranty shields you from unpredictable costs and keeps your vehicle reliably on the road.
              </p>
            </div>

            <div className="grid md:grid-cols-2 lg:grid-cols-3 gap-8 mb-12">
              <div className="bg-card p-6 rounded-lg shadow-sm border border-border hover:shadow-md transition-shadow">
                <Shield className="h-12 w-12 text-primary mb-4" />
                <h3 className="text-xl font-semibold mb-3 text-foreground">Comprehensive Protection</h3>
                <p className="text-muted-foreground">Full cover for engine, gearbox, air suspension, Terrain Response, and electrical systems</p>
              </div>
              <div className="bg-card p-6 rounded-lg shadow-sm border border-border hover:shadow-md transition-shadow">
                <FileText className="h-12 w-12 text-primary mb-4" />
                <h3 className="text-xl font-semibold mb-3 text-foreground">Flexible Payment Options</h3>
                <p className="text-muted-foreground">Monthly or annual payments with no hidden fees</p>
              </div>
              <div className="bg-card p-6 rounded-lg shadow-sm border border-border hover:shadow-md transition-shadow">
                <Zap className="h-12 w-12 text-primary mb-4" />
                <h3 className="text-xl font-semibold mb-3 text-foreground">High Mileage Cover</h3>
                <p className="text-muted-foreground">Protection available for Land Rovers up to 150,000 miles</p>
              </div>
              <div className="bg-card p-6 rounded-lg shadow-sm border border-border hover:shadow-md transition-shadow">
                <Clock className="h-12 w-12 text-primary mb-4" />
                <h3 className="text-xl font-semibold mb-3 text-foreground">Fast Claims Process</h3>
                <p className="text-muted-foreground">UK-wide repair network with quick authorisation</p>
              </div>
              <div className="bg-card p-6 rounded-lg shadow-sm border border-border hover:shadow-md transition-shadow">
                <CheckCircle2 className="h-12 w-12 text-primary mb-4" />
                <h3 className="text-xl font-semibold mb-3 text-foreground">No Hidden Fees</h3>
                <p className="text-muted-foreground">Transparent pricing you can trust from day one</p>
              </div>
              <div className="bg-card p-6 rounded-lg shadow-sm border border-border hover:shadow-md transition-shadow">
                <Wrench className="h-12 w-12 text-primary mb-4" />
                <h3 className="text-xl font-semibold mb-3 text-foreground">Use Your Own Garage</h3>
                <p className="text-muted-foreground">Any VAT-registered garage or our approved UK network</p>
              </div>
            </div>
          </div>
        </section>

        {/* Trustpilot Badge */}
        <div className="py-8 flex justify-end container mx-auto px-4 sm:px-6 lg:px-8">
          <TrustpilotHeader />
        </div>

        {/* Coverage Section */}
        <section className="py-16 bg-card">
          <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
            <h2 className="text-3xl md:text-4xl font-bold text-center text-foreground mb-12">
              What Does Our Land Rover Warranty Cover?
            </h2>

            <div className="grid md:grid-cols-2 gap-12 items-center mb-12">
              <div>
                <p className="text-lg text-muted-foreground mb-8">
                  Our plans protect all major components that keep your Land Rover performing at its best — from rugged off-road capability to luxury on-road comfort.
                </p>

                <div className="space-y-4">
                  <h3 className="text-xl font-semibold text-foreground mb-4">Key components covered:</h3>
                  {[
                    'Engine, gearbox, and transfer case',
                    'Air suspension and adaptive damping',
                    'Terrain Response and 4x4 drivetrain',
                    'Cooling, turbocharger, and fuel systems',
                    'Electrical and electronic components',
                    'Steering, brakes, and differential'
                  ].map((item, i) => (
                    <div key={i} className="flex items-start gap-3">
                      <CheckCircle2 className="h-6 w-6 text-pricing-benefit flex-shrink-0 mt-1" />
                      <span className="text-foreground">{item}</span>
                    </div>
                  ))}
                </div>

                <div className="mt-8 space-y-4">
                  <h3 className="text-xl font-semibold text-foreground mb-4">Additional benefits:</h3>
                  {[
                    '24/7 breakdown recovery reclaim (optional add-on)',
                    'Fast claims authorisation usually 90 minutes after approval',
                    'Direct payments to approved garages'
                  ].map((item, i) => (
                    <div key={i} className="flex items-start gap-3">
                      <CheckCircle2 className="h-6 w-6 text-pricing-benefit flex-shrink-0 mt-1" />
                      <span className="text-foreground">{item}</span>
                    </div>
                  ))}
                </div>
              </div>

              <div className="flex justify-center">
                <img
                  {...getResponsiveImageProps({
                    src: defenderImg,
                    alt: "Land Rover Defender with comprehensive extended warranty protection UK",
                    width: 500,
                    height: 340,
                    loading: 'lazy'
                  })}
                  className="w-full max-w-sm h-auto drop-shadow-2xl object-contain"
                />
              </div>
            </div>
          </div>
        </section>

        {/* Models Table */}
        <section className="py-16 bg-background">
          <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
            <h2 className="text-3xl md:text-4xl font-bold text-center text-foreground mb-4">
              Land Rover Models We Cover (2012–2026)
            </h2>
            <p className="text-lg text-muted-foreground text-center mb-12 max-w-3xl mx-auto">
              We provide complete extended warranty protection for all Land Rover and Range Rover models available in the UK from 2012 to 2026.
            </p>

            <div className="overflow-x-auto">
              <table className="w-full bg-card rounded-lg shadow-sm border border-border">
                <thead className="bg-primary/5">
                  <tr>
                    <th className="px-6 py-4 text-left text-sm font-semibold text-foreground">Model</th>
                    <th className="px-6 py-4 text-left text-sm font-semibold text-foreground">Years Available</th>
                    <th className="px-6 py-4 text-left text-sm font-semibold text-foreground">Coverage Highlights</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-border">
                  {landRoverModels.map((row, index) => (
                    <tr key={index} className="hover:bg-muted/50 transition-colors">
                      <td className="px-6 py-4 text-sm font-medium text-foreground">{row.model}</td>
                      <td className="px-6 py-4 text-sm text-muted-foreground">{row.years}</td>
                      <td className="px-6 py-4 text-sm text-muted-foreground">{row.coverage}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>

            <p className="text-center text-muted-foreground mt-8 text-lg">
              Hybrid and plug-in hybrid Land Rover models are also covered under our specialist <Link to="/warranty-types/electric-car-warranty/" className="text-primary hover:underline">EV and hybrid warranty plans</Link>.
            </p>
          </div>
        </section>

        {/* Repair Costs */}
        <section className="py-16 bg-card">
          <div className="max-w-5xl mx-auto px-4 sm:px-6 lg:px-8">
            <h2 className="text-3xl md:text-4xl font-bold text-center text-foreground mb-4">
              Average Land Rover Repair Costs in the UK
            </h2>
            <p className="text-lg text-muted-foreground text-center mb-12 max-w-3xl mx-auto">
              Premium vehicles come with premium repair bills. A warranty absorbs these costs so you don't have to.
            </p>

            <div className="overflow-x-auto">
              <table className="w-full bg-background rounded-lg shadow-sm border border-border">
                <thead className="bg-primary/5">
                  <tr>
                    <th className="px-6 py-4 text-left text-sm font-semibold text-foreground">Component</th>
                    <th className="px-6 py-4 text-left text-sm font-semibold text-foreground">Average Repair Cost</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-border">
                  {[
                    { component: 'Engine', cost: '£2,200 – £5,800' },
                    { component: 'Automatic Gearbox', cost: '£1,800 – £4,000' },
                    { component: 'Air Suspension', cost: '£700 – £2,200' },
                    { component: 'Turbocharger', cost: '£900 – £2,100' },
                    { component: 'Electrical System', cost: '£250 – £1,100' },
                    { component: 'Cooling System', cost: '£350 – £900' },
                    { component: 'Transfer Case / 4x4', cost: '£600 – £1,800' },
                  ].map((row, i) => (
                    <tr key={i} className="hover:bg-muted/50 transition-colors">
                      <td className="px-6 py-4 text-sm font-medium text-foreground">{row.component}</td>
                      <td className="px-6 py-4 text-sm font-semibold text-foreground">{row.cost}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        </section>

        {/* Warranty Plans */}
        <section className="py-16 bg-background">
          <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
            <h2 className="text-3xl md:text-4xl font-bold text-center text-foreground mb-4">
              Choosing the Right Land Rover Warranty Plan
            </h2>
            <p className="text-lg text-muted-foreground text-center mb-12 max-w-3xl mx-auto">
              We offer flexible plans based on your Land Rover's age, mileage, and how you use it.
            </p>

            <div className="grid md:grid-cols-3 gap-8">
              <div className="bg-card p-8 rounded-lg border-2 border-border hover:border-primary transition-colors">
                <h3 className="text-2xl font-bold text-foreground mb-3">12-Month Plan</h3>
                <p className="text-lg text-muted-foreground mb-6">1 Year Land Rover Warranty</p>
                <p className="text-muted-foreground mb-6">Ideal for short-term protection or if you plan to upgrade your vehicle soon.</p>
                <Button onClick={scrollToQuote} className="w-full">Get 1 Year Cover</Button>
              </div>

              <div className="bg-primary/5 p-8 rounded-lg border-2 border-primary relative">
                <div className="absolute -top-4 left-1/2 transform -translate-x-1/2 bg-primary text-primary-foreground px-4 py-1 rounded-full text-sm font-semibold">
                  Most Popular
                </div>
                <h3 className="text-2xl font-bold text-foreground mb-3">24-Month Plan</h3>
                <p className="text-lg text-muted-foreground mb-6">2 Year Land Rover Warranty</p>
                <p className="text-muted-foreground mb-6">Our most popular choice — two years of cover and excellent value for money.</p>
                <Button onClick={scrollToQuote} className="w-full">Get 2 Year Cover</Button>
              </div>

              <div className="bg-card p-8 rounded-lg border-2 border-border hover:border-primary transition-colors">
                <h3 className="text-2xl font-bold text-foreground mb-3">36-Month Plan</h3>
                <p className="text-lg text-muted-foreground mb-6">3 Year Land Rover Warranty</p>
                <p className="text-muted-foreground mb-6">Maximum protection for total peace of mind. Best value per year of cover.</p>
                <Button onClick={scrollToQuote} className="w-full">Get 3 Year Cover</Button>
              </div>
            </div>

            <p className="text-center text-muted-foreground mt-8 text-lg">
              All plans include the option to add breakdown cover, hire car support, and onward travel protection.
            </p>
          </div>
        </section>

        {/* Trustpilot Badge */}
        <div className="py-8 flex justify-end container mx-auto px-4 sm:px-6 lg:px-8">
          <TrustpilotHeader />
        </div>

        {/* How to Get */}
        <section className="py-16 bg-card">
          <div className="max-w-5xl mx-auto px-4 sm:px-6 lg:px-8">
            <h2 className="text-3xl md:text-4xl font-bold text-center text-foreground mb-12">
              How to Get a Land Rover Warranty Online
            </h2>

            {!showRegForm ? (
              <div className="max-w-md mx-auto mb-12">
                <Button
                  size="lg"
                  onClick={() => setShowRegForm(true)}
                  className="w-full text-lg px-8 py-6"
                >
                  Start Your Land Rover Quote Now
                </Button>
              </div>
            ) : (
              <div className="flex justify-center mb-12">
                <QuoteFormInline vehicleType="car" />
              </div>
            )}

            <div className="grid md:grid-cols-4 gap-8 mb-12">
              {[
                { step: '1', title: 'Enter Registration', desc: "We'll identify your Land Rover and confirm eligibility" },
                { step: '2', title: 'Choose Cover', desc: 'Pick a plan that fits your needs and budget' },
                { step: '3', title: 'Select Payment', desc: 'Monthly interest free or annual payments available' },
                { step: '4', title: 'Get Protected', desc: 'Cover starts from day one' },
              ].map((s) => (
                <div key={s.step} className="text-center">
                  <div className="bg-primary/10 w-16 h-16 rounded-full flex items-center justify-center mx-auto mb-4">
                    <span className="text-2xl font-bold text-primary">{s.step}</span>
                  </div>
                  <h3 className="font-semibold text-foreground mb-2">{s.title}</h3>
                  <p className="text-sm text-muted-foreground">{s.desc}</p>
                </div>
              ))}
            </div>

            <p className="text-center text-lg text-muted-foreground">
              No inspections, no delays — just simple Land Rover protection.
            </p>
          </div>
        </section>

        {/* Trustpilot Badge */}
        <div className="py-8 flex justify-end container mx-auto px-4 sm:px-6 lg:px-8">
          <TrustpilotHeader />
        </div>

        {/* Flexible Terms */}
        <section className="py-16 bg-background">
          <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
            <div className="grid lg:grid-cols-2 gap-12 items-center">
              <div>
                <h2 className="text-3xl md:text-4xl font-bold text-foreground mb-6">
                  Flexible Terms and Affordable Land Rover Cover
                </h2>
                <p className="text-lg text-muted-foreground mb-6 leading-relaxed">
                  Every Land Rover is different, which is why our warranty plans are designed around your specific model. Choose short-term or multi-year protection, add optional upgrades, and pay the way that suits you best.
                </p>
                <p className="text-xl font-semibold text-foreground mb-6">
                  We are one of the only UK warranty providers offering cover for Land Rovers up to 150,000 miles at the start of the policy.
                </p>
                <p className="text-lg text-muted-foreground">
                  That means even high-mileage Land Rovers can stay protected with the same confidence, reliability, and level of service.
                </p>
              </div>
              <div className="flex justify-center lg:justify-end">
                <img
                  {...getResponsiveImageProps({
                    src: discoveryImg,
                    alt: "Land Rover Discovery Sport with affordable extended warranty UK",
                    width: 500,
                    height: 340,
                    loading: 'lazy'
                  })}
                  className="w-full max-w-xs h-auto"
                />
              </div>
            </div>
          </div>
        </section>

        {/* FAQ Section */}
        <section className="py-16 bg-card">
          <div className="max-w-4xl mx-auto px-4 sm:px-6 lg:px-8">
            <h2 className="text-3xl md:text-4xl font-bold text-center text-foreground mb-12">
              Land Rover Warranty — Frequently Asked Questions
            </h2>
            <div className="space-y-6">
              {faqItems.map((faq, index) => (
                <div key={index} className="bg-primary p-6 rounded-lg shadow-sm">
                  <h3 className="text-lg font-semibold text-primary-foreground mb-3">{faq.question}</h3>
                  <p className="text-primary-foreground/90">{faq.answer}</p>
                </div>
              ))}
            </div>
          </div>
        </section>

        {/* Final CTA */}
        <section className="py-20 bg-primary text-primary-foreground">
          <div className="max-w-4xl mx-auto px-4 sm:px-6 lg:px-8 text-center">
            <h2 className="text-3xl md:text-4xl font-bold mb-6">
              Get Your Land Rover Warranty Quote Today
            </h2>
            <p className="text-xl mb-8 opacity-90">
              Activate your extended cover in minutes and prevent costly surprises. Get a personalised price based on your model, age, and mileage — and drive with confidence knowing your Land Rover is protected.
            </p>
            <div className="flex flex-col sm:flex-row gap-4 justify-center">
              <Button
                size="lg"
                variant="secondary"
                onClick={scrollToQuote}
                className="text-lg px-8 py-6"
              >
                Get Instant Quote
              </Button>
              <Button
                size="lg"
                variant="outline"
                onClick={() => window.location.href = 'tel:03302295040'}
                className="text-lg px-8 py-6 bg-white/10 hover:bg-white/20 border-white/30 text-white"
              >
                <Phone className="mr-2 h-5 w-5" />
                0330 229 5040
              </Button>
            </div>
            <p className="text-sm mt-4 opacity-80">Takes less than 60 seconds. No phone calls, no pressure — just instant pricing.</p>
          </div>
        </section>
      </div>

      <WebsiteFooter />
    </>
  );
};

export default LandRoverWarranty;
