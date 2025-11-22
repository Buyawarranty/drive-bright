import React, { useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { Phone, Shield, Clock, CheckCircle2, FileText, Wrench, Zap } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { SEOHead } from '@/components/SEOHead';
import { OrganizationSchema } from '@/components/schema/OrganizationSchema';
import { WebPageSchema } from '@/components/schema/WebPageSchema';
import { FAQSchema } from '@/components/schema/FAQSchema';
import { ProductSchema } from '@/components/schema/ProductSchema';
import { BreadcrumbSchema } from '@/components/schema/BreadcrumbSchema';
import TrustpilotHeader from '@/components/TrustpilotHeader';
import { OptimizedImage } from '@/components/OptimizedImage';
import { getResponsiveImageProps } from '@/utils/imageOptimizer';
import VehicleDetailsStep from '@/components/VehicleDetailsStep';
import vanHero from '@/assets/van-warranty-hero.png';
import vanFast from '@/assets/van-warranty-fast.png';
import vanCoverage from '@/assets/van-warranty-coverage.png';

const VanWarrantyNew = () => {
  const navigate = useNavigate();
  const [showRegForm, setShowRegForm] = useState(false);
  
  const scrollToQuote = () => {
    window.location.href = '/#get-quote';
  };
  
  const handleVehicleNext = (data: any) => {
    // Navigate to step 2 with vehicle data
    const params = new URLSearchParams({
      step: '2',
      reg: data.regNumber,
      mileage: data.mileage,
      referrer: '/van-warranty/'
    });
    
    // Add optional vehicle details if available
    if (data.make) params.set('make', data.make);
    if (data.model) params.set('model', data.model);
    if (data.fuelType) params.set('fuelType', data.fuelType);
    if (data.year) params.set('year', data.year);
    if (data.vehicleType) params.set('vehicleType', data.vehicleType);
    
    navigate(`/?${params.toString()}`);
  };

  const vanWarrantyFAQs = [
    {
      question: "What does a van extended warranty cover?",
      answer: "It covers mechanical and electrical breakdowns, including the engine, gearbox, brakes, clutch, and key electrical components."
    },
    {
      question: "Is a van warranty worth it?",
      answer: "Yes. Repair costs can be very expensive and leave you out of pocket or even in debt. A warranty provides financial protection and peace of mind, especially for business or used vans."
    },
    {
      question: "Can I get a warranty for a used van?",
      answer: "Absolutely. Our plans cover used vans of all ages and mileages, keeping them protected long after manufacturer cover ends."
    },
    {
      question: "Do you cover high-mileage vans?",
      answer: "Yes. We're the leading UK provider offering plans for vans with up to 150,000 miles at policy start."
    },
    {
      question: "Can I use my own garage for repairs?",
      answer: "Yes. You can use any VAT-registered garage, or one from our approved UK-wide network."
    },
    {
      question: "Can I transfer my van warranty if I sell my van?",
      answer: "Yes. Your warranty can be transferred to a new owner, adding resale value to your vehicle as an optional extra."
    },
    {
      question: "What happens if my van breaks down?",
      answer: "Our plans include optional roadside assistance and recovery, getting you back on the road quickly."
    },
    {
      question: "How fast can I get cover?",
      answer: "You can get an instant online quote and start your cover immediately upon payment."
    }
  ];

  const breadcrumbItems = [
    { name: 'Home', url: 'https://buyawarranty.co.uk/' },
    { name: 'Van Warranty', url: 'https://buyawarranty.co.uk/van-warranty/' }
  ];

  return (
    <>
      <SEOHead
        title="Van Extended Warranty | Used Van Cover up to 150,000 Miles"
        description="Get a trusted extended warranty for vans up to 150,000 miles. Protect new or used vans from costly repairs with flexible, affordable UK warranty plans."
        keywords="van warranty UK, van extended warranty, used van warranty, commercial van warranty, high mileage van warranty, van breakdown cover, UK van warranty, new van warranty, van warranty companies"
        canonical="https://buyawarranty.co.uk/van-warranty/"
        ogTitle="Van Extended Warranty | Used Van Cover up to 150,000 Miles"
        ogDescription="Get a trusted extended warranty for vans up to 150,000 miles. Protect new or used vans from costly repairs with flexible, affordable UK warranty plans."
        ogImage="https://buyawarranty.co.uk/van-warranty-og.jpg"
        geoRegion="GB"
        geoPlacename="United Kingdom"
        geoPosition="54.5;-4.5"
        ICBM="54.5, -4.5"
      />
      <OrganizationSchema />
      <WebPageSchema
        name="Van Extended Warranty UK | Trusted Van Cover"
        description="Get a trusted extended warranty for vans up to 150,000 miles. Protect new or used commercial vans from costly repairs with flexible, affordable UK warranty plans. Instant quotes available."
        url="https://buyawarranty.co.uk/van-warranty/"
        specialty="Van Warranty & Commercial Vehicle Protection"
      />
      <FAQSchema faqs={vanWarrantyFAQs} />
      <ProductSchema
        name="Van Extended Warranty UK"
        description="Comprehensive extended warranty for new and used vans up to 150,000 miles. Covers mechanical and electrical breakdowns with flexible UK-wide protection."
        price="69"
        priceCurrency="GBP"
        brand="Buy A Warranty"
        category="Van Warranty & Commercial Vehicle Insurance"
        image="https://buyawarranty.co.uk/van-warranty-product.jpg"
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
                  Protect Your Van with Trusted Extended Warranty Plans
                </h1>
                <p className="text-xl text-muted-foreground mb-8 leading-relaxed">
                  Keep your van on the road with affordable extended warranty cover. Instant quotes, no hidden fees, and UK-wide protection for peace of mind.
                </p>
                <div className="flex flex-col sm:flex-row gap-4">
                  <Button 
                    size="lg" 
                    onClick={scrollToQuote}
                    className="text-lg px-8 py-6"
                  >
                    Get Your Van Quote Now
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
                    src: vanHero,
                    alt: "Mercedes van with comprehensive extended warranty protection",
                    width: 600,
                    height: 600,
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
              What is a Van Extended Warranty?
            </h2>
            <p className="text-lg text-muted-foreground text-center leading-relaxed">
              A van extended warranty is a contract that covers mechanical or electrical breakdowns after the manufacturer's warranty expires. It protects against repair costs for parts like the engine, gearbox, and electrical systems. Cover is available for new and used vans, with flexible plans, high-mileage options, and UK-wide support.
            </p>
          </div>
        </section>

        {/* Get Your Van Quote Section */}
        <section className="py-16 bg-background">
          <div className="max-w-5xl mx-auto px-4 sm:px-6 lg:px-8">
            <div className="text-center mb-8">
              <h2 className="text-3xl md:text-4xl font-bold text-foreground mb-4">
                Get Your Instant Van Warranty Quote
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

        {/* Why Choose Us */}
        <section className="py-16 bg-background">
          <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
            <div className="text-center mb-12">
              <h2 className="text-3xl md:text-4xl font-bold text-foreground mb-4">
                Reliable Van Extended Warranty for UK Drivers
              </h2>
              <p className="text-xl text-muted-foreground max-w-3xl mx-auto">
                Your van is your livelihood. Whether you use it for business deliveries, trade work, or personal transport, unexpected repair costs can disrupt your income. Our van extended warranty protects you from expensive mechanical and electrical failures.
              </p>
            </div>

            <div className="grid md:grid-cols-2 lg:grid-cols-3 gap-8 mb-12">
              <div className="bg-card p-6 rounded-lg shadow-sm border border-border hover:shadow-md transition-shadow">
                <Shield className="h-12 w-12 text-primary mb-4" />
                <h3 className="text-xl font-semibold mb-3 text-foreground">Comprehensive Protection</h3>
                <p className="text-muted-foreground">Complete cover for new and used vans with transparent pricing</p>
              </div>
              <div className="bg-card p-6 rounded-lg shadow-sm border border-border hover:shadow-md transition-shadow">
                <FileText className="h-12 w-12 text-primary mb-4" />
                <h3 className="text-xl font-semibold mb-3 text-foreground">Flexible Payment Options</h3>
                <p className="text-muted-foreground">Monthly or annual payments with no hidden fees</p>
              </div>
              <div className="bg-card p-6 rounded-lg shadow-sm border border-border hover:shadow-md transition-shadow">
                <Zap className="h-12 w-12 text-primary mb-4" />
                <h3 className="text-xl font-semibold mb-3 text-foreground">High Mileage Cover</h3>
                <p className="text-muted-foreground">Protection available for vans up to 150,000 miles</p>
              </div>
              <div className="bg-card p-6 rounded-lg shadow-sm border border-border hover:shadow-md transition-shadow">
                <Clock className="h-12 w-12 text-primary mb-4" />
                <h3 className="text-xl font-semibold mb-3 text-foreground">Fast Claims Process</h3>
                <p className="text-muted-foreground">UK-wide repair network with quick authorisation</p>
              </div>
              <div className="bg-card p-6 rounded-lg shadow-sm border border-border hover:shadow-md transition-shadow">
                <CheckCircle2 className="h-12 w-12 text-primary mb-4" />
                <h3 className="text-xl font-semibold mb-3 text-foreground">No Hidden Fees</h3>
                <p className="text-muted-foreground">Transparent pricing you can trust</p>
              </div>
              <div className="bg-card p-6 rounded-lg shadow-sm border border-border hover:shadow-md transition-shadow">
                <Wrench className="h-12 w-12 text-primary mb-4" />
                <h3 className="text-xl font-semibold mb-3 text-foreground">UK-Wide Support</h3>
                <p className="text-muted-foreground">Trusted repair network across the country</p>
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
              What Does Our Van Warranty Cover?
            </h2>
            
            <div className="grid md:grid-cols-2 gap-12 items-center mb-12">
              <div>
                <p className="text-lg text-muted-foreground mb-8">
                  Our plans protect all major components that keep your van on the road - whether for business, deliveries, or daily use.
                </p>
                
                <div className="space-y-4">
                  <h3 className="text-xl font-semibold text-foreground mb-4">Key components typically covered:</h3>
                  <div className="flex items-start gap-3">
                    <CheckCircle2 className="h-6 w-6 text-pricing-benefit flex-shrink-0 mt-1" />
                    <span className="text-foreground">Engine, gearbox, and clutch</span>
                  </div>
                  <div className="flex items-start gap-3">
                    <CheckCircle2 className="h-6 w-6 text-pricing-benefit flex-shrink-0 mt-1" />
                    <span className="text-foreground">Steering, suspension, and braking systems</span>
                  </div>
                  <div className="flex items-start gap-3">
                    <CheckCircle2 className="h-6 w-6 text-pricing-benefit flex-shrink-0 mt-1" />
                    <span className="text-foreground">Cooling and air conditioning</span>
                  </div>
                  <div className="flex items-start gap-3">
                    <CheckCircle2 className="h-6 w-6 text-pricing-benefit flex-shrink-0 mt-1" />
                    <span className="text-foreground">Electrical and electronic components</span>
                  </div>
                  <div className="flex items-start gap-3">
                    <CheckCircle2 className="h-6 w-6 text-pricing-benefit flex-shrink-0 mt-1" />
                    <span className="text-foreground">Fuel and ignition systems</span>
                  </div>
                  <div className="flex items-start gap-3">
                    <CheckCircle2 className="h-6 w-6 text-pricing-benefit flex-shrink-0 mt-1" />
                    <span className="text-foreground">Transmission, differential, and drive shafts</span>
                  </div>
                </div>

                <div className="mt-8 space-y-4">
                  <h3 className="text-xl font-semibold text-foreground mb-4">Additional benefits:</h3>
                  <div className="flex items-start gap-3">
                    <CheckCircle2 className="h-6 w-6 text-pricing-benefit flex-shrink-0 mt-1" />
                    <span className="text-foreground">24/7 breakdown recovery reclaim (optional add-on)</span>
                  </div>
                  <div className="flex items-start gap-3">
                    <CheckCircle2 className="h-6 w-6 text-pricing-benefit flex-shrink-0 mt-1" />
                    <span className="text-foreground">Fast claims authorisation usually 90 minutes after approval</span>
                  </div>
                  <div className="flex items-start gap-3">
                    <CheckCircle2 className="h-6 w-6 text-pricing-benefit flex-shrink-0 mt-1" />
                    <span className="text-foreground">Direct payments to approved garages</span>
                  </div>
                </div>
              </div>

              <div className="flex justify-center">
                <img
                  {...getResponsiveImageProps({
                    src: vanCoverage,
                    alt: "Comprehensive van warranty coverage for all vehicle types",
                    width: 500,
                    height: 500,
                    loading: 'lazy'
                  })}
                  className="w-full max-w-md h-auto drop-shadow-2xl object-contain"
                />
              </div>
            </div>
          </div>
        </section>

        {/* Manufacturers Table */}
        <section className="py-16 bg-background">
          <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
            <h2 className="text-3xl md:text-4xl font-bold text-center text-foreground mb-4">
              Manufacturers Covered Under Our Warranty Plans
            </h2>
            <p className="text-lg text-muted-foreground text-center mb-12 max-w-3xl mx-auto">
              We provide complete protection for all major van manufacturers across the UK. From light commercial vehicles to heavy-duty work vans, our cover ensures your van stays in service when you need it most.
            </p>

            <div className="overflow-x-auto">
              <table className="w-full bg-card rounded-lg shadow-sm border border-border">
                <thead className="bg-primary/5">
                  <tr>
                    <th className="px-6 py-4 text-left text-sm font-semibold text-foreground">Manufacturer</th>
                    <th className="px-6 py-4 text-left text-sm font-semibold text-foreground">Popular Models</th>
                    <th className="px-6 py-4 text-left text-sm font-semibold text-foreground">Coverage Highlights</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-border">
                  {[
                    { manufacturer: 'Ford', models: 'Transit, Transit Custom, Ranger', coverage: 'Complete cover for engine, gearbox, clutch, and electrics' },
                    { manufacturer: 'Mercedes-Benz', models: 'Sprinter, Vito, Citan', coverage: 'Protection tailored to high-mileage and commercial use' },
                    { manufacturer: 'Vauxhall', models: 'Vivaro, Movano, Combo', coverage: 'Full mechanical and electrical fault protection' },
                    { manufacturer: 'Volkswagen', models: 'Transporter, Crafter, Caddy', coverage: 'Flexible plans for tradesmen and delivery drivers' },
                    { manufacturer: 'Peugeot', models: 'Expert, Partner, Boxer', coverage: 'Coverage for air conditioning, suspension, and electronics' },
                    { manufacturer: 'Citroën', models: 'Relay, Dispatch, Berlingo', coverage: 'Complete cover with optional add-ons for business users' },
                    { manufacturer: 'Renault', models: 'Trafic, Master, Kangoo', coverage: 'Affordable protection ideal for trade professionals' },
                    { manufacturer: 'Nissan', models: 'NV200, Primastar, Interstar', coverage: 'Cover for drivetrain, clutch, and electrical systems' },
                    { manufacturer: 'Toyota', models: 'Proace, Hilux, Dyna', coverage: 'Reliable protection for hybrid and diesel vans' },
                    { manufacturer: 'Fiat', models: 'Ducato, Scudo, Doblo Cargo', coverage: 'Trusted cover for small and large business fleets' },
                    { manufacturer: 'MAN', models: 'TGE', coverage: 'Designed for high-capacity commercial vehicles' },
                    { manufacturer: 'Iveco', models: 'Daily', coverage: 'Heavy-duty protection for long-distance work vans' }
                  ].map((row, index) => (
                    <tr key={index} className="hover:bg-muted/50 transition-colors">
                      <td className="px-6 py-4 text-sm font-medium text-foreground">{row.manufacturer}</td>
                      <td className="px-6 py-4 text-sm text-muted-foreground">{row.models}</td>
                      <td className="px-6 py-4 text-sm text-muted-foreground">{row.coverage}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>

            <p className="text-center text-muted-foreground mt-8 text-lg">
              Electric and hybrid vans are also covered under our specialist EV and hybrid vehicle warranty plans.
            </p>
          </div>
        </section>

        {/* Warranty Plans */}
        <section className="py-16 bg-card">
          <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
            <h2 className="text-3xl md:text-4xl font-bold text-center text-foreground mb-4">
              Choosing the Right Van Warranty Plan
            </h2>
            <p className="text-lg text-muted-foreground text-center mb-12 max-w-3xl mx-auto">
              We offer flexible plans based on your van's age, mileage, and how you use it.
            </p>

            <div className="grid md:grid-cols-3 gap-8">
              <div className="bg-background p-8 rounded-lg border-2 border-border hover:border-primary transition-colors">
                <h3 className="text-2xl font-bold text-foreground mb-3">12-Month Plan</h3>
                <p className="text-lg text-muted-foreground mb-6">1 Year Van Warranty</p>
                <p className="text-muted-foreground mb-6">Ideal for short-term protection or if you plan to upgrade soon.</p>
                <Button onClick={scrollToQuote} className="w-full">Get 1 Year Cover</Button>
              </div>

              <div className="bg-primary/5 p-8 rounded-lg border-2 border-primary relative">
                <div className="absolute -top-4 left-1/2 transform -translate-x-1/2 bg-primary text-primary-foreground px-4 py-1 rounded-full text-sm font-semibold">
                  Most Popular
                </div>
                <h3 className="text-2xl font-bold text-foreground mb-3">24-Month Plan</h3>
                <p className="text-lg text-muted-foreground mb-6">2 Year Van Warranty</p>
                <p className="text-muted-foreground mb-6">Our most popular choice - two years of cover and excellent value.</p>
                <Button onClick={scrollToQuote} className="w-full">Get 2 Year Cover</Button>
              </div>

              <div className="bg-background p-8 rounded-lg border-2 border-border hover:border-primary transition-colors">
                <h3 className="text-2xl font-bold text-foreground mb-3">36-Month Plan</h3>
                <p className="text-lg text-muted-foreground mb-6">3 Year Van Warranty</p>
                <p className="text-muted-foreground mb-6">Maximum protection for total peace of mind. Perfect for business owners and fleet users.</p>
                <Button onClick={scrollToQuote} className="w-full">Get 3 Year Cover</Button>
              </div>
            </div>

            <p className="text-center text-muted-foreground mt-8 text-lg">
              All plans include the option to add breakdown cover, hire van support, and onward travel protection.
            </p>
          </div>
        </section>

        {/* Trustpilot Badge */}
        <div className="py-8 flex justify-end container mx-auto px-4 sm:px-6 lg:px-8">
          <TrustpilotHeader />
        </div>

        {/* Used Van Warranty */}
        <section className="py-16 bg-background">
          <div className="max-w-5xl mx-auto px-4 sm:px-6 lg:px-8">
            <h2 className="text-3xl md:text-4xl font-bold text-center text-foreground mb-6">
              Used Van Warranty - Protecting Older Vehicles
            </h2>
            <p className="text-lg text-muted-foreground text-center mb-8 leading-relaxed">
              Buying a used van can be a smart move, but repairs can be costly. Our used van warranty gives you complete protection after the dealer or manufacturer cover ends.
            </p>

            <div className="grid md:grid-cols-2 gap-6 mb-8">
              <div className="flex items-start gap-3">
                <CheckCircle2 className="h-6 w-6 text-pricing-benefit flex-shrink-0 mt-1" />
                <span className="text-foreground">Available for privately bought or dealer-purchased vans</span>
              </div>
              <div className="flex items-start gap-3">
                <CheckCircle2 className="h-6 w-6 text-pricing-benefit flex-shrink-0 mt-1" />
                <span className="text-foreground">Suitable for older and high-mileage vehicles</span>
              </div>
              <div className="flex items-start gap-3">
                <CheckCircle2 className="h-6 w-6 text-pricing-benefit flex-shrink-0 mt-1" />
                <span className="text-foreground">Extend or renew cover anytime</span>
              </div>
              <div className="flex items-start gap-3">
                <CheckCircle2 className="h-6 w-6 text-pricing-benefit flex-shrink-0 mt-1" />
                <span className="text-foreground">Transferable policies that add resale value</span>
              </div>
            </div>
          </div>
        </section>

        {/* How to Get */}
        <section className="py-16 bg-card">
          <div className="max-w-5xl mx-auto px-4 sm:px-6 lg:px-8">
            <h2 className="text-3xl md:text-4xl font-bold text-center text-foreground mb-12">
              How to Get a Van Warranty Online
            </h2>

            {/* Registration Form */}
            {!showRegForm ? (
              <div className="max-w-md mx-auto mb-12">
                <Button 
                  size="lg" 
                  onClick={() => setShowRegForm(true)}
                  className="w-full text-lg px-8 py-6"
                >
                  Start Your Van Quote Now
                </Button>
              </div>
            ) : (
              <div className="max-w-2xl mx-auto mb-12 bg-background p-6 rounded-lg shadow-lg">
                <VehicleDetailsStep 
                  onNext={handleVehicleNext}
                  onFormDataUpdate={() => {}}
                />
              </div>
            )}

            <div className="grid md:grid-cols-4 gap-8 mb-12">
              <div className="text-center">
                <div className="bg-primary/10 w-16 h-16 rounded-full flex items-center justify-center mx-auto mb-4">
                  <span className="text-2xl font-bold text-primary">1</span>
                </div>
                <h3 className="font-semibold text-foreground mb-2">Enter Registration</h3>
                <p className="text-sm text-muted-foreground">We'll identify your van and confirm eligibility</p>
              </div>
              <div className="text-center">
                <div className="bg-primary/10 w-16 h-16 rounded-full flex items-center justify-center mx-auto mb-4">
                  <span className="text-2xl font-bold text-primary">2</span>
                </div>
                <h3 className="font-semibold text-foreground mb-2">Choose Cover</h3>
                <p className="text-sm text-muted-foreground">Pick a plan that fits your needs and budget</p>
              </div>
              <div className="text-center">
                <div className="bg-primary/10 w-16 h-16 rounded-full flex items-center justify-center mx-auto mb-4">
                  <span className="text-2xl font-bold text-primary">3</span>
                </div>
                <h3 className="font-semibold text-foreground mb-2">Select Payment</h3>
                <p className="text-sm text-muted-foreground">Monthly interest free or annual payments available</p>
              </div>
              <div className="text-center">
                <div className="bg-primary/10 w-16 h-16 rounded-full flex items-center justify-center mx-auto mb-4">
                  <span className="text-2xl font-bold text-primary">4</span>
                </div>
                <h3 className="font-semibold text-foreground mb-2">Get Protected</h3>
                <p className="text-sm text-muted-foreground">Cover starts from day one</p>
              </div>
            </div>

            <p className="text-center text-lg text-muted-foreground">
              No inspections, no delays - just simple protection.
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
                  Flexible Terms and Affordable Cover
                </h2>
                <p className="text-lg text-muted-foreground mb-6 leading-relaxed">
                  Every van is different, which is why our warranty plans are designed around your needs. Choose short-term or multi-year protection, add optional upgrades, and pay the way that suits you best.
                </p>
                <p className="text-xl font-semibold text-foreground mb-6">
                  We are the only UK warranty provider offering cover for vans up to 150,000 miles at the start of the policy.
                </p>
                <p className="text-lg text-muted-foreground">
                  That means even high-mileage vans can stay protected with the same confidence, reliability, and level of service.
                </p>
              </div>
              <div className="flex justify-center lg:justify-end">
                <img
                  {...getResponsiveImageProps({
                    src: vanFast,
                    alt: "Fast van warranty claims processing with expert support",
                    width: 500,
                    height: 500,
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
              Frequently Asked Questions
            </h2>
            <div className="space-y-6">
              {vanWarrantyFAQs.map((faq, index) => (
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
              Get Your Van Warranty Quote Today
            </h2>
            <p className="text-xl mb-8 opacity-90">
              Keep your van protected from expensive repair bills and unwanted downtime. Whether it's for work, trade, or personal use, our warranty ensures your van is always ready for the road.
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
          </div>
        </section>
      </div>
    </>
  );
};

export default VanWarrantyNew;
