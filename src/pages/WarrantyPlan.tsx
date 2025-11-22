import React, { useState, useEffect } from 'react';
import { ChevronDown, Download, ExternalLink, Check, Menu, Shield, Car, Zap, Wrench, Crown } from 'lucide-react';
import { Link, useNavigate } from 'react-router-dom';
import { SEOHead } from '@/components/SEOHead';
import { Button } from '@/components/ui/button';
import { Accordion, AccordionContent, AccordionItem, AccordionTrigger } from '@/components/ui/accordion';
import { Sheet, SheetContent, SheetTrigger } from '@/components/ui/sheet';
import { Card, CardContent } from '@/components/ui/card';
import { supabase } from '@/integrations/supabase/client';

// Import panda images
import pandaEvWarranty from '@/assets/panda-ev-warranty-hero.png';
import pandaMotorcycle from '@/assets/panda-motorcycle-warranty.png';
import pandaGarage from '@/assets/panda-garage-warranty.png';
import pandaVehicleCollection from '@/assets/panda-vehicle-collection.png';
import pandaCelebrating from '@/assets/panda-celebrating.png';

const WarrantyPlan = () => {
  const [isMobileMenuOpen, setIsMobileMenuOpen] = useState(false);
  const [platinumDocUrl, setPlatinumDocUrl] = useState<string>('');
  const navigate = useNavigate();
  
  useEffect(() => {
    const fetchPlatinumDoc = async () => {
      const { data, error } = await supabase
        .from('customer_documents')
        .select('file_url')
        .eq('plan_type', 'platinum')
        .order('created_at', { ascending: false })
        .limit(1)
        .single();
      
      if (data && !error) {
        setPlatinumDocUrl(data.file_url);
      }
    };
    
    fetchPlatinumDoc();
  }, []);
  
  const navigateToQuoteForm = () => {
    navigate('/');
    setTimeout(() => {
      const element = document.getElementById('quote-form');
      if (element) {
        element.scrollIntoView({ behavior: 'smooth' });
      }
    }, 100);
  };

  const vehicleTypes = [
    {
      id: "petrol-diesel",
      title: "1. Petrol & Diesel (Combustion) Vehicles",
      subtitle: "Car, Van and SUV cover",
      description: "Traditional combustion engines"
    },
    {
      id: "hybrid-phev", 
      title: "2. Hybrid and PHEV Vehicles",
      subtitle: "Car, Van and SUV cover",
      description: "Petrol and diesel engines with an electric motor"
    },
    {
      id: "electric-evs",
      title: "3. Electric Vehicles (EVs)", 
      subtitle: "Car, Van and SUV cover",
      description: "Fully electric vehicles powered only by battery"
    },
    {
      id: "motorbikes",
      title: "4. Motorbikes",
      subtitle: "Petrol, EV and hybrid motorcycle cover", 
      description: "Petrol, diesel, hybrid and EV motorcycles"
    }
  ];

  return (
    <>
      <SEOHead
        title="Platinum Warranty Plan - Buy a Warranty"
        description="Comprehensive Platinum warranty coverage for Cars, Vans, SUVs and Motorcycles. Mechanical & electrical breakdown protection with unlimited claims."
        keywords="platinum warranty plan, car warranty, vehicle warranty, mechanical breakdown, electrical coverage"
      />
      
      {/* Header */}
      <header className="bg-white shadow-sm sticky top-0 z-50">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="flex items-center justify-between h-16 sm:h-20">
            {/* Logo */}
            <div className="flex items-center">
              <Link to="/" className="hover:opacity-80 transition-opacity">
                <img src="/lovable-uploads/53652a24-3961-4346-bf9d-6588ef727aeb.png" alt="Buy a Warranty" className="h-6 sm:h-8 w-auto" />
              </Link>
            </div>
            
            {/* Navigation - Hidden on mobile, visible on lg+ */}
            <nav className="hidden lg:flex items-center space-x-4 xl:space-x-6">
              
              <Link to="/what-is-covered" className="text-gray-700 hover:text-gray-900 font-medium text-sm xl:text-base">What's Covered</Link>
              <Link to="/business-warranties" className="text-gray-700 hover:text-gray-900 font-medium text-sm xl:text-base">Business Warranties</Link>
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
                className="bg-orange-500 text-white hover:bg-orange-600 px-3 text-sm"
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
                  <Menu className="h-12 w-12" />
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
                      to="/business-warranties"
                      className="text-gray-700 hover:text-gray-900 font-medium text-sm py-2 border-b border-gray-200"
                      onClick={() => setIsMobileMenuOpen(false)}
                    >
                      Business Warranties
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
                      className="w-full bg-orange-500 text-white hover:bg-orange-600 text-lg py-3"
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

      <div className="min-h-screen bg-background">
        {/* Hero Section */}
        <section className="bg-gradient-to-br from-primary to-orange-600 py-20 lg:py-32">
          <div className="container mx-auto px-4">
            <div className="grid lg:grid-cols-2 gap-12 items-center">
              <div className="text-white space-y-8">
                <div className="space-y-4">
                  <h1 className="text-4xl lg:text-6xl font-bold leading-tight">
                    Platinum Warranty Plan
                  </h1>
                  <p className="text-xl lg:text-2xl opacity-90">
                    We've got you covered!
                  </p>
                  <p className="text-lg lg:text-xl leading-relaxed opacity-80">
                    When you join Buy-a-Warranty, you get our Platinum Plan as standard - giving you top-level protection
                  </p>
                </div>
                
                <div className="flex flex-col sm:flex-row gap-4">
                  <Button 
                    size="lg"
                    className="bg-white text-primary hover:bg-muted px-8 py-4 text-lg font-semibold"
                    onClick={() => document.getElementById('coverage-details')?.scrollIntoView({ behavior: 'smooth' })}
                  >
                    View Coverage Details
                  </Button>
                  {platinumDocUrl ? (
                    <Button 
                      variant="outline"
                      size="lg"
                      className="border-white text-white hover:bg-white hover:text-primary px-8 py-4 text-lg font-semibold bg-transparent"
                      asChild
                    >
                      <a 
                        href={platinumDocUrl} 
                        target="_blank" 
                        rel="noopener noreferrer"
                        className="flex items-center gap-2 text-white hover:text-primary"
                      >
                        <Download className="w-5 h-5" />
                        Download PDF
                        <ExternalLink className="w-4 h-4" />
                      </a>
                    </Button>
                  ) : (
                    <Button 
                      variant="outline"
                      size="lg"
                      className="border-white text-white px-8 py-4 text-lg font-semibold bg-transparent cursor-not-allowed opacity-50"
                      disabled
                    >
                      <Download className="w-5 h-5" />
                      Loading PDF...
                    </Button>
                  )}
                </div>
              </div>

              <div className="flex justify-center">
                <img 
                  src={pandaEvWarranty} 
                  alt="Panda with electric vehicle warranty protection" 
                  className="w-full max-w-lg h-auto drop-shadow-2xl"
                />
              </div>
            </div>
          </div>
        </section>

        {/* Key Benefits Section */}
        <section className="py-20 bg-background">
          <div className="container mx-auto px-4">
            <div className="text-center mb-16">
              <h2 className="text-3xl lg:text-4xl font-bold text-foreground mb-6">
                Key Benefits of Our Platinum Plan
              </h2>
              <p className="text-xl text-muted-foreground max-w-3xl mx-auto">
                If it breaks, we'll fix it! Your journey matters - we're with you all the way.
              </p>
            </div>
            
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-8 mb-16">
              <Card className="text-center p-6 hover:shadow-lg transition-shadow">
                <CardContent className="space-y-4">
                  <div className="w-16 h-16 bg-green-100 rounded-full flex items-center justify-center mx-auto">
                    <Shield className="w-8 h-8 text-green-600" />
                  </div>
                  <h3 className="font-bold text-lg">All Parts Covered</h3>
                  <p className="text-muted-foreground">Mechanical & electrical parts covered with labour costs included</p>
                </CardContent>
              </Card>

              <Card className="text-center p-6 hover:shadow-lg transition-shadow">
                <CardContent className="space-y-4">
                  <div className="w-16 h-16 bg-blue-100 rounded-full flex items-center justify-center mx-auto">
                    <Wrench className="w-8 h-8 text-blue-600" />
                  </div>
                  <h3 className="font-bold text-lg">Fault Diagnostics</h3>
                  <p className="text-muted-foreground">Complete fault diagnostics and consequential damage cover included</p>
                </CardContent>
              </Card>

              <Card className="text-center p-6 hover:shadow-lg transition-shadow">
                <CardContent className="space-y-4">
                  <div className="w-16 h-16 bg-orange-100 rounded-full flex items-center justify-center mx-auto">
                    <Car className="w-8 h-8 text-orange-600" />
                  </div>
                  <h3 className="font-bold text-lg">Simple Claims</h3>
                  <p className="text-muted-foreground">Straightforward processing with minimal paperwork and quick turnaround</p>
                </CardContent>
              </Card>

              <Card className="text-center p-6 hover:shadow-lg transition-shadow">
                <CardContent className="space-y-4">
                  <div className="w-16 h-16 bg-purple-100 rounded-full flex items-center justify-center mx-auto">
                    <Zap className="w-8 h-8 text-purple-600" />
                  </div>
                  <h3 className="font-bold text-lg">Fast Support</h3>
                  <p className="text-muted-foreground">Timely assistance when mechanical and electrical issues arise</p>
                </CardContent>
              </Card>
            </div>
            
            <Card className="bg-muted p-8 text-center">
              <CardContent className="space-y-6">
                <h3 className="text-2xl font-bold text-foreground">Need Help? We're Here for You</h3>
                <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                  <div className="space-y-2">
                    <p className="font-semibold text-foreground">Customer Service</p>
                    <p className="text-2xl font-bold text-primary">0330 229 5040</p>
                  </div>
                  <div className="space-y-2">
                    <p className="font-semibold text-foreground">Claims Line</p>
                    <p className="text-2xl font-bold text-primary">0330 229 5045</p>
                  </div>
                </div>
              </CardContent>
            </Card>
          </div>
        </section>

        {/* Vehicle Types Section */}
        <section className="py-20 bg-muted/30" id="coverage-details">
          <div className="container mx-auto px-4">
            <div className="text-center mb-16">
              <h2 className="text-3xl lg:text-4xl font-bold text-foreground mb-6">
                Comprehensive Coverage for All Vehicle Types
              </h2>
              <p className="text-xl text-muted-foreground">
                From electric cars to motorcycles - we've got you covered
              </p>
            </div>
            
            <div className="grid lg:grid-cols-2 gap-16 items-center mb-20">
              <div className="space-y-8">
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-6">
                  {vehicleTypes.map((type, index) => (
                    <Card key={type.id} className="p-6 hover:shadow-lg transition-shadow">
                      <CardContent className="space-y-4">
                        <div className="w-12 h-12 bg-primary/10 rounded-lg flex items-center justify-center">
                          <span className="text-2xl font-bold text-primary">{index + 1}</span>
                        </div>
                        <h3 className="font-bold text-lg text-foreground">
                          {type.title.split('.')[1].trim()}
                        </h3>
                        <p className="text-sm text-muted-foreground font-medium">{type.subtitle}</p>
                        <p className="text-sm text-muted-foreground">{type.description}</p>
                      </CardContent>
                    </Card>
                  ))}
                </div>
              </div>

              <div className="flex justify-center">
                <img 
                  src={pandaVehicleCollection} 
                  alt="Panda with various vehicles covered by warranty" 
                  className="w-full max-w-lg h-auto"
                />
              </div>
            </div>
          </div>
        </section>

        {/* Enhanced Coverage Overview */}
        <section className="py-20 bg-background">
          <div className="container mx-auto px-4">
            <div className="grid lg:grid-cols-2 gap-16 items-center">
              <div className="flex justify-center order-2 lg:order-1">
                <img 
                  src={pandaGarage} 
                  alt="Panda and mechanic providing professional service" 
                  className="w-full max-w-lg h-auto"
                />
              </div>

              <div className="space-y-8 order-1 lg:order-2">
                <div className="space-y-4">
                  <h2 className="text-3xl lg:text-4xl font-bold text-foreground">
                    Understanding Your Warranty Coverage
                  </h2>
                  <p className="text-xl text-muted-foreground">
                    Comprehensive protection designed for your peace of mind
                  </p>
                </div>
                
                <div className="space-y-6">
                  <Card className="p-6">
                    <CardContent className="space-y-3">
                      <h3 className="text-xl font-bold text-foreground">Enhanced Protection</h3>
                      <p className="text-muted-foreground">
                        Our platinum package covers components against Mechanical and Electrical Breakdown. 
                        Enjoy discounts on three-year plans with competitive pricing and long-term protection.
                      </p>
                    </CardContent>
                  </Card>
                  
                  <Card className="p-6">
                    <CardContent className="space-y-3">
                      <h3 className="text-xl font-bold text-foreground">Generous Coverage</h3>
                      <p className="text-muted-foreground">
                        Suitable for Cars, SUVs, Vans, and Motorcycles. Labour covered up to £100 per hour - 
                        more generous than industry standards.
                      </p>
                    </CardContent>
                  </Card>
                  
                  <Card className="p-6">
                    <CardContent className="space-y-3">
                      <h3 className="text-xl font-bold text-foreground">Unlimited Claims</h3>
                      <p className="text-muted-foreground">
                        Make unlimited claims throughout your warranty period. Each approved repair 
                        is covered up to your claim limit with no hidden restrictions.
                      </p>
                    </CardContent>
                  </Card>
                </div>
              </div>
            </div>
          </div>
        </section>

        {/* Additional Benefits */}
        <section className="py-20 bg-muted/30">
          <div className="container mx-auto px-4">
            <div className="grid lg:grid-cols-2 gap-16 items-center">
              <div className="space-y-8">
                <div className="space-y-4">
                  <h2 className="text-3xl lg:text-4xl font-bold text-foreground">
                    Additional Benefits & Services
                  </h2>
                  <p className="text-xl text-muted-foreground">
                    More than just warranty coverage
                  </p>
                </div>
                
                <div className="space-y-6">
                  <Card className="p-6">
                    <CardContent className="space-y-3">
                      <h3 className="text-xl font-bold text-foreground">Free MOT Coverage</h3>
                      <p className="text-muted-foreground">
                        Free Halfords MOT test fee coverage when your MOT is due for renewal with select packages.
                      </p>
                    </CardContent>
                  </Card>
                  
                  <Card className="p-6">
                    <CardContent className="space-y-3">
                      <h3 className="text-xl font-bold text-foreground">Vehicle Hire & Recovery</h3>
                      <p className="text-muted-foreground">
                        Vehicle hire, recovery services, and additional coverage within the EU for complete peace of mind.
                      </p>
                    </CardContent>
                  </Card>
                </div>
              </div>

              <div className="flex justify-center">
                <img 
                  src={pandaMotorcycle} 
                  alt="Panda on motorcycle showcasing motorcycle warranty coverage" 
                  className="w-full max-w-lg h-auto"
                />
              </div>
            </div>
          </div>
        </section>

        {/* Get Started Section */}
        <section className="py-20 bg-background">
          <div className="container mx-auto px-4">
            <div className="grid lg:grid-cols-2 gap-16 items-center">
              <div className="space-y-8">
                <div className="space-y-4">
                  <h2 className="text-3xl lg:text-4xl font-bold text-foreground">
                    Ready to Protect Your Vehicle?
                  </h2>
                  <p className="text-xl text-muted-foreground">
                    Join thousands of satisfied customers who trust us with their vehicle protection
                  </p>
                </div>
                
                <div className="space-y-6">
                  <div className="flex items-center space-x-4">
                    <div className="w-8 h-8 bg-green-100 rounded-full flex items-center justify-center">
                      <Check className="w-5 h-5 text-green-600" />
                    </div>
                    <p className="text-lg">Get an instant quote in under 2 minutes</p>
                  </div>
                  
                  <div className="flex items-center space-x-4">
                    <div className="w-8 h-8 bg-green-100 rounded-full flex items-center justify-center">
                      <Check className="w-5 h-5 text-green-600" />
                    </div>
                    <p className="text-lg">Choose from flexible payment options</p>
                  </div>
                  
                  <div className="flex items-center space-x-4">
                    <div className="w-8 h-8 bg-green-100 rounded-full flex items-center justify-center">
                      <Check className="w-5 h-5 text-green-600" />
                    </div>
                    <p className="text-lg">Comprehensive coverage starts immediately</p>
                  </div>
                </div>

                <div className="space-y-4">
                  <Button size="lg" className="bg-primary hover:bg-primary-hover text-white px-8 py-4 text-lg">
                    Get Your Quote Now
                  </Button>
                  <p className="text-sm text-muted-foreground">
                    No hidden fees • Cancel anytime • 30-day money back guarantee
                  </p>
                </div>
              </div>

              <div className="flex justify-center">
                <img 
                  src={pandaCelebrating} 
                  alt="Happy panda celebrating warranty protection" 
                  className="w-full max-w-lg h-auto"
                />
              </div>
            </div>
          </div>
        </section>

        {/* Detailed Coverage by Vehicle Type */}
        <section className="py-20 bg-muted/30">
          <div className="container mx-auto px-4">
            <div className="text-center mb-16">
              <h2 className="text-3xl lg:text-4xl font-bold text-foreground mb-6">
                Detailed Coverage by Vehicle Type
              </h2>
              <p className="text-xl text-muted-foreground">
                Comprehensive breakdown of what's covered for each vehicle type
              </p>
            </div>
            
            <Accordion type="single" collapsible className="space-y-4">
              {/* Petrol & Diesel */}
              <AccordionItem value="petrol-diesel" className="bg-card rounded-lg border shadow-sm">
                <AccordionTrigger className="px-6 py-4 text-left hover:no-underline">
                  <div>
                    <h3 className="text-xl font-bold text-foreground">1. Petrol & Diesel (Combustion) Vehicles</h3>
                    <p className="text-muted-foreground">Car, Van and SUV cover</p>
                  </div>
                </AccordionTrigger>
                <AccordionContent className="px-6 pb-6">
                  <div className="space-y-8">
                    {/* Engine & Turbo Unit */}
                    <div>
                      <h4 className="text-lg font-bold text-gray-900 mb-4">Engine & Turbo Unit</h4>
                      <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                        <div>
                          <h5 className="font-semibold text-gray-900 mb-2">Engine</h5>
                          <p className="text-gray-600 mb-2">All components within the cylinder block and head, including:</p>
                          <ul className="space-y-1 text-gray-600">
                            <li>• Pistons and rings</li>
                            <li>• Crankshaft</li>
                            <li>• Big end bearings</li>
                            <li>• Timing chains and gears</li>
                            <li>• Rocker assembly</li>
                          </ul>
                        </div>
                        <div>
                          <h5 className="font-semibold text-gray-900 mb-2">Turbo Unit</h5>
                          <ul className="space-y-1 text-gray-600">
                            <li>• Inlet and exhaust turbine shafts</li>
                            <li>• Wastegate devices</li>
                            <li>• Manifolds</li>
                            <li>• Bearings and bushes</li>
                          </ul>
                          <p className="text-sm text-orange-500 mt-2">Turbo cover ceases at 7 years or 80,000 miles, whichever comes first</p>
                        </div>
                      </div>
                      <p className="text-sm text-red-600 mt-4">Excludes: Dual mass flywheel</p>
                    </div>

                    {/* Transmission Systems */}
                    <div>
                      <h4 className="text-lg font-bold text-gray-900 mb-4">Transmission Systems</h4>
                      <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
                        <div>
                          <h5 className="font-semibold text-gray-900 mb-2">Gearbox</h5>
                          <p className="text-gray-600 mb-2">All components within manual or automatic transmissions, including:</p>
                          <ul className="space-y-1 text-gray-600">
                            <li>• Gears</li>
                            <li>• Bearings</li>
                            <li>• Clutches</li>
                          </ul>
                        </div>
                        <div>
                          <h5 className="font-semibold text-gray-900 mb-2">Clutch</h5>
                          <p className="text-gray-600 mb-2">All components, including:</p>
                          <ul className="space-y-1 text-gray-600">
                            <li>• Clutch plate</li>
                            <li>• Clutch cover</li>
                            <li>• Thrust/release bearing</li>
                          </ul>
                          <p className="text-sm text-orange-500 mt-2">Note: Limited to one clutch repair during the warranty period</p>
                        </div>
                        <div>
                          <h5 className="font-semibold text-gray-900 mb-2">Differential</h5>
                          <p className="text-gray-600 mb-2">All components, including:</p>
                          <ul className="space-y-1 text-gray-600">
                            <li>• Gears</li>
                            <li>• Pinions</li>
                            <li>• Bearings</li>
                            <li>• Shafts</li>
                          </ul>
                        </div>
                      </div>
                    </div>

                    {/* Drive & Braking Systems */}
                    <div>
                      <h4 className="text-lg font-bold text-gray-900 mb-4">Drive & Braking Systems</h4>
                      <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                        <div>
                          <h5 className="font-semibold text-gray-900 mb-2">Drive Shafts</h5>
                          <p className="text-gray-600 mb-2">All components, including:</p>
                          <ul className="space-y-1 text-gray-600">
                            <li>• Propshafts</li>
                            <li>• Drive shafts</li>
                            <li>• Constant velocity (C.V.) joints</li>
                            <li>• Couplings</li>
                          </ul>
                        </div>
                        <div>
                          <h5 className="font-semibold text-gray-900 mb-2">Brakes</h5>
                          <p className="text-gray-600 mb-2">All components, including:</p>
                          <ul className="space-y-1 text-gray-600">
                            <li>• Servo units</li>
                            <li>• Cylinders</li>
                            <li>• Valves</li>
                          </ul>
                        </div>
                      </div>
                    </div>

                    {/* Steering & Suspension */}
                    <div>
                      <h4 className="text-lg font-bold text-gray-900 mb-4">Steering & Suspension</h4>
                      <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
                        <div>
                          <h5 className="font-semibold text-gray-900 mb-2">Steering</h5>
                          <p className="text-gray-600 mb-2">All components, including:</p>
                          <ul className="space-y-1 text-gray-600">
                            <li>• Power steering units</li>
                            <li>• Rams</li>
                            <li>• Pumps</li>
                            <li>• Reservoirs</li>
                          </ul>
                        </div>
                        <div>
                          <h5 className="font-semibold text-gray-900 mb-2">Suspension</h5>
                          <p className="text-gray-600 mb-2">All components, including:</p>
                          <ul className="space-y-1 text-gray-600">
                            <li>• Control arms</li>
                            <li>• Bushings</li>
                            <li>• Ball joints</li>
                            <li>• Pins</li>
                          </ul>
                        </div>
                        <div>
                          <h5 className="font-semibold text-gray-900 mb-2">Bearings</h5>
                          <p className="text-gray-600 mb-2">All components, including:</p>
                          <ul className="space-y-1 text-gray-600">
                            <li>• Wheel bearings</li>
                            <li>• Seals</li>
                            <li>• Hubs</li>
                            <li>• Flanges</li>
                          </ul>
                        </div>
                      </div>
                      <p className="text-sm text-gray-600 mt-4">Where mechanical breakdown has caused sudden stoppage of function</p>
                    </div>

                    {/* Climate & Cooling Systems */}
                    <div>
                      <h4 className="text-lg font-bold text-gray-900 mb-4">Climate & Cooling Systems</h4>
                      <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
                        <div>
                          <h5 className="font-semibold text-gray-900 mb-2">Air Conditioning</h5>
                          <ul className="space-y-1 text-gray-600">
                            <li>• Compressors</li>
                            <li>• Pumps</li>
                            <li>• Reservoirs</li>
                          </ul>
                        </div>
                        <div>
                          <h5 className="font-semibold text-gray-900 mb-2">Cooling System</h5>
                          <ul className="space-y-1 text-gray-600">
                            <li>• Radiator (excluding external damage)</li>
                            <li>• Matrix</li>
                            <li>• Water pump</li>
                            <li>• Head gasket</li>
                            <li>• Thermostat</li>
                          </ul>
                        </div>
                        <div>
                          <h5 className="font-semibold text-gray-900 mb-2">Ventilation</h5>
                          <ul className="space-y-1 text-gray-600">
                            <li>• Heater assembly</li>
                            <li>• Vents</li>
                            <li>• Tubes</li>
                            <li>• Controls</li>
                          </ul>
                        </div>
                      </div>
                    </div>

                    {/* Electrical & Fuel Systems */}
                    <div>
                      <h4 className="text-lg font-bold text-gray-900 mb-4">Electrical & Fuel Systems</h4>
                      <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
                        <div>
                          <h5 className="font-semibold text-gray-900 mb-2">E.C.U.</h5>
                          <p className="text-gray-600 mb-2">All components, including:</p>
                          <ul className="space-y-1 text-gray-600">
                            <li>• Solid state control units</li>
                            <li>• Triggering units</li>
                            <li>• Distributor</li>
                            <li>• Coil</li>
                          </ul>
                        </div>
                        <div>
                          <h5 className="font-semibold text-gray-900 mb-2">Electrics</h5>
                          <p className="text-gray-600 mb-2">All components, including:</p>
                          <ul className="space-y-1 text-gray-600">
                            <li>• Motors</li>
                            <li>• Solenoids</li>
                            <li>• Relays</li>
                            <li>• Alternator</li>
                            <li>• Starter motor</li>
                            <li>• Switches</li>
                            <li>• Computers</li>
                          </ul>
                        </div>
                        <div>
                          <h5 className="font-semibold text-gray-900 mb-2">Fuel System</h5>
                          <p className="text-gray-600 mb-2">All components, including:</p>
                          <ul className="space-y-1 text-gray-600">
                            <li>• Fuel pump</li>
                            <li>• Sender units</li>
                            <li>• Gauges</li>
                            <li>• Air flow meters</li>
                          </ul>
                        </div>
                      </div>
                    </div>

                    {/* Additional Covered Components */}
                    <div>
                      <h4 className="text-lg font-bold text-gray-900 mb-4">Additional Covered Components</h4>
                      <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
                        <div>
                          <h5 className="font-semibold text-gray-900 mb-2">Locks</h5>
                          <p className="text-gray-600 mb-2">All components, including:</p>
                          <ul className="space-y-1 text-gray-600">
                            <li>• Regulators</li>
                            <li>• Handles</li>
                            <li>• Locks</li>
                            <li>• Catches</li>
                          </ul>
                        </div>
                        <div>
                          <h5 className="font-semibold text-gray-900 mb-2">Seals</h5>
                          <p className="text-gray-600">All major oil seals and gaskets</p>
                        </div>
                        <div>
                          <h5 className="font-semibold text-gray-900 mb-2">Convertible powerhood</h5>
                          <ul className="space-y-1 text-gray-600">
                            <li>• Motors that move the roof</li>
                            <li>• Hydraulic parts (if your roof uses fluid pressure)</li>
                            <li>• Buttons, switches and wiring</li>
                            <li>• Sensors and control units</li>
                            <li>• Covered if damaged by any of the listed parts</li>
                          </ul>
                        </div>
                      </div>
                      <div className="mt-6 p-4 bg-red-50 rounded-lg">
                        <h6 className="font-semibold text-red-800 mb-2">Excludes:</h6>
                        <p className="text-red-700 mb-2">Accidental damage</p>
                        <h6 className="font-semibold text-red-800 mb-2">What's Not Covered:</h6>
                        <ul className="space-y-1 text-red-700">
                          <li>• Damage from forcing the roof open or closed</li>
                          <li>• Wear and tear on the roof fabric</li>
                          <li>• Problems caused by custom modifications</li>
                          <li>• Leaks due to poor maintenance or accidents</li>
                        </ul>
                      </div>
                    </div>

                    {/* Exclusions */}
                    <div className="p-6 bg-red-50 rounded-lg">
                      <h4 className="text-lg font-bold text-red-800 mb-4">Exclusions</h4>
                      <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
                        <div>
                          <h5 className="font-semibold text-red-800 mb-2">Vehicle Components</h5>
                          <ul className="space-y-1 text-red-700">
                            <li>• Cylinder head cracks and porosity</li>
                            <li>• Dual mass flywheel systems</li>
                            <li>• Wiring harnesses and looms</li>
                            <li>• General extension components to excluded items</li>
                          </ul>
                        </div>
                        <div>
                          <h5 className="font-semibold text-red-800 mb-2">Damage & Maintenance</h5>
                          <ul className="space-y-1 text-red-700">
                            <li>• Damage caused by: Frost, Overheating</li>
                            <li>• Lack of anti-freeze</li>
                            <li>• Normal maintenance items</li>
                            <li>• Periodic replacement parts</li>
                            <li>• Normal wear items</li>
                          </ul>
                        </div>
                        <div>
                          <h5 className="font-semibold text-red-800 mb-2">Additional Systems</h5>
                          <ul className="space-y-1 text-red-700">
                            <li>• Alarms and immobilisers</li>
                            <li>• Non manufacturer approved parts</li>
                            <li>• Customised parts</li>
                          </ul>
                        </div>
                      </div>
                    </div>
                  </div>
                </AccordionContent>
              </AccordionItem>

              {/* Hybrid and PHEV */}
              <AccordionItem value="hybrid-phev" className="bg-white rounded-lg border">
                <AccordionTrigger className="px-6 py-4 text-left hover:no-underline">
                  <div>
                    <h3 className="text-xl font-bold text-gray-900">2. Hybrid and PHEV Vehicles</h3>
                    <p className="text-gray-600">Car, Van and SUV cover</p>
                  </div>
                </AccordionTrigger>
                <AccordionContent className="px-6 pb-6">
                  <div className="space-y-8">
                    <p className="text-gray-600 mb-6">Alongside the parts shared with petrol and diesel engines, you're also covered for the following:</p>
                    
                    {/* Engine & Transmission Coverage */}
                    <div>
                      <h4 className="text-lg font-bold text-gray-900 mb-4">Engine & Transmission Coverage</h4>
                      <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                        <div>
                          <h5 className="font-semibold text-gray-900 mb-2">Engine</h5>
                          <p className="text-gray-600">All Components contained within the cylinder block and head (excluding cracks and porosity).</p>
                        </div>
                        <div>
                          <h5 className="font-semibold text-gray-900 mb-2">Transmission</h5>
                          <p className="text-gray-600">All components contained within the transmission assembly.</p>
                        </div>
                      </div>
                    </div>

                    {/* Drive & Fuel Systems */}
                    <div>
                      <h4 className="text-lg font-bold text-gray-900 mb-4">Drive & Fuel Systems</h4>
                      <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                        <div>
                          <h5 className="font-semibold text-gray-900 mb-2">Final drive</h5>
                          <p className="text-gray-600">All components including differential assembly and driveshafts.</p>
                        </div>
                        <div>
                          <h5 className="font-semibold text-gray-900 mb-2">Fuel system</h5>
                          <p className="text-gray-600">All components including fuel pump, tanks sender unit and injectors, excludes filters and damage caused as a result of poor quality and/or contaminated fuel.</p>
                        </div>
                      </div>
                    </div>

                    {/* Electric Motor Components */}
                    <div>
                      <h4 className="text-lg font-bold text-gray-900 mb-4">Electric Motor Components</h4>
                      <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
                        <div>
                          <h5 className="font-semibold text-gray-900 mb-2">Motor(s)</h5>
                          <p className="text-gray-600 mb-2">All components contained within the motor assembly including rotor, bearings, stator and brushes (excluding wear).</p>
                          <p className="text-gray-600">All components including power control units for electric drive and communicators.</p>
                        </div>
                        <div>
                          <h5 className="font-semibold text-gray-900 mb-2">Motor power supply</h5>
                          <p className="text-gray-600">All components including slip rings and high voltage connector.</p>
                        </div>
                        <div>
                          <h5 className="font-semibold text-gray-900 mb-2">Motor control</h5>
                          <p className="text-gray-600">All components including slip rings and high voltage connector.</p>
                        </div>
                      </div>
                    </div>

                    {/* Battery System Coverage */}
                    <div>
                      <h4 className="text-lg font-bold text-gray-900 mb-4">Battery System Coverage</h4>
                      <div className="p-4 bg-blue-50 rounded-lg">
                        <h5 className="font-semibold text-gray-900 mb-2">Battery system*</h5>
                        <p className="text-gray-600 mb-2">All components including battery charger and control unit. Excludes failure due to degradation or degradation of battery cells up to 80,000 miles or vehicle age of 10 years excluding batteries not related to the vehicles drive system; such as normal car batteries and auxiliary batteries.</p>
                        <p className="text-sm text-orange-500">*Limited only to the replacement of individual battery cells up to a value of the claim limit</p>
                      </div>
                    </div>

                    {/* Electrical & Steering Systems */}
                    <div>
                      <h4 className="text-lg font-bold text-gray-900 mb-4">Electrical & Steering Systems</h4>
                      <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                        <div>
                          <h5 className="font-semibold text-gray-900 mb-2">Ancillary electrics</h5>
                          <p className="text-gray-600">All components including control units, motors, switches.</p>
                        </div>
                        <div>
                          <h5 className="font-semibold text-gray-900 mb-2">Steering</h5>
                          <p className="text-gray-600">All components including rack, column motor assembly and hydraulic units.</p>
                        </div>
                      </div>
                    </div>

                    {/* Braking & Suspension */}
                    <div>
                      <h4 className="text-lg font-bold text-gray-900 mb-4">Braking & Suspension</h4>
                      <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                        <div>
                          <h5 className="font-semibold text-gray-900 mb-2">Braking system</h5>
                          <p className="text-gray-600">All components including sensors, switches, control units, hydraulics and any energy harvesting system. Excludes brake discs and pads.</p>
                        </div>
                        <div>
                          <h5 className="font-semibold text-gray-900 mb-2">Suspension</h5>
                          <p className="text-gray-600">All components including springs, torsion bars, ball joints and arms.</p>
                        </div>
                      </div>
                    </div>

                    {/* Cooling & Climate Control */}
                    <div>
                      <h4 className="text-lg font-bold text-gray-900 mb-4">Cooling & Climate Control</h4>
                      <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                        <div>
                          <h5 className="font-semibold text-gray-900 mb-2">Battery/Motor Cooling system</h5>
                          <p className="text-gray-600">All components including radiators and coolant tanks. Excludes hoses and pipes.</p>
                        </div>
                        <div>
                          <h5 className="font-semibold text-gray-900 mb-2">Climate control/heating</h5>
                          <p className="text-gray-600">All components including heat pump and air conditioning systems.</p>
                        </div>
                      </div>
                    </div>

                    {/* Locks & Security */}
                    <div>
                      <h4 className="text-lg font-bold text-gray-900 mb-4">Locks & Security</h4>
                      <div>
                        <h5 className="font-semibold text-gray-900 mb-2">Locks</h5>
                        <p className="text-gray-600">All major locks. Excludes accidental or malicious damage.</p>
                      </div>
                    </div>

                    {/* Exclusions */}
                    <div className="p-6 bg-red-50 rounded-lg">
                      <h4 className="text-lg font-bold text-red-800 mb-4">Exclusions</h4>
                      <p className="text-red-700">Damage to batteries caused due to environmental conditions, Battery degradation, discharge/fast acting/charge related damage, normal maintenance items such as; but not limited to; brake discs, pads and tyres, conventional car batteries and auxiliary batteries.</p>
                    </div>
                  </div>
                </AccordionContent>
              </AccordionItem>

              {/* Electric Vehicles (EVs) */}
              <AccordionItem value="electric-evs" className="bg-white rounded-lg border">
                <AccordionTrigger className="px-6 py-4 text-left hover:no-underline">
                  <div>
                    <h3 className="text-xl font-bold text-gray-900">3. Electric Vehicles (EVs)</h3>
                    <p className="text-gray-600">Car, Van and SUV cover</p>
                  </div>
                </AccordionTrigger>
                <AccordionContent className="px-6 pb-6">
                  <div className="space-y-8">
                    <p className="text-gray-600 mb-6">Alongside the parts shared with petrol and diesel engines, you're also covered for the following:</p>
                    
                    {/* What's covered? */}
                    <div>
                      <h4 className="text-lg font-bold text-gray-900 mb-4">What's covered?</h4>
                      
                      {/* Motors and related components */}
                      <div className="mb-6">
                        <h5 className="text-lg font-semibold text-gray-900 mb-4">Motors and related components</h5>
                        <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
                          <div>
                            <h6 className="font-semibold text-gray-900 mb-2">Motor(s)</h6>
                            <p className="text-gray-600">All components contained within the motor assembly including rotor, bearings, stator and brushes (excluding wear).</p>
                          </div>
                          <div>
                            <h6 className="font-semibold text-gray-900 mb-2">Motor power supply</h6>
                            <p className="text-gray-600">All components including slip rings and high voltage connector.</p>
                          </div>
                          <div>
                            <h6 className="font-semibold text-gray-900 mb-2">Motor control</h6>
                            <p className="text-gray-600">All components including power control units for electric drive and communicators.</p>
                          </div>
                        </div>
                      </div>

                      {/* Battery and Related Components */}
                      <div className="mb-6">
                        <h5 className="text-lg font-semibold text-gray-900 mb-4">Battery and Related Components</h5>
                        <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
                          <div>
                            <h6 className="font-semibold text-gray-900 mb-2">Battery system*</h6>
                            <p className="text-gray-600 mb-2">All components including battery charger and control unit, for up to 8 years/100,000 miles.</p>
                            <p className="text-gray-600">Excludes failure due to degradation or degradation of battery cells and batteries not related to the vehicle's drive system (such as normal car batteries and auxiliary batteries).</p>
                          </div>
                          <div>
                            <h6 className="font-semibold text-gray-900 mb-2">Battery/ Motor Cooling system</h6>
                            <p className="text-gray-600">All components including radiators and coolant tanks. Excludes hoses and pipes.</p>
                          </div>
                          <div>
                            <h6 className="font-semibold text-gray-900 mb-2">Climate control/ heating</h6>
                            <p className="text-gray-600">All components including heat pump and air conditioner.</p>
                          </div>
                        </div>
                      </div>

                      {/* Ancillary Electrics */}
                      <div className="mb-6">
                        <h5 className="text-lg font-semibold text-gray-900 mb-4">Ancillary Electrics</h5>
                        <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
                          <div>
                            <h6 className="font-semibold text-gray-900 mb-2">Steering</h6>
                            <p className="text-gray-600">All components including control units, motors, switches.</p>
                          </div>
                          <div>
                            <h6 className="font-semibold text-gray-900 mb-2">Braking system</h6>
                            <p className="text-gray-600">All components including sensors, switches, control units, hydraulics and any energy harvesting system. Excludes brake discs and pads.</p>
                          </div>
                          <div>
                            <h6 className="font-semibold text-gray-900 mb-2">Suspension</h6>
                            <p className="text-gray-600">All components including springs, torsion bars, ball joints and arms.</p>
                          </div>
                        </div>
                      </div>
                    </div>

                    {/* Additional Coverage & Exclusions */}
                    <div>
                      <h4 className="text-lg font-bold text-gray-900 mb-4">Additional Coverage & Exclusions</h4>
                      <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
                        <div>
                          <h5 className="font-semibold text-gray-900 mb-2">Locks</h5>
                          <p className="text-gray-600">All major locks are covered, excluding accidental or malicious damage.</p>
                        </div>
                        <div>
                          <h5 className="font-semibold text-red-800 mb-2">Battery Exclusions</h5>
                          <p className="text-red-700">Excludes damage to batteries caused by environmental conditions, battery degradation, and discharge/fast charge related damage.</p>
                        </div>
                        <div>
                          <h5 className="font-semibold text-red-800 mb-2">Maintenance Exclusions</h5>
                          <p className="text-red-700">Excludes normal maintenance items such as; but not limited to; brake discs, pads and tyres, conventional car batteries and auxiliary batteries.</p>
                        </div>
                      </div>
                    </div>
                  </div>
                </AccordionContent>
              </AccordionItem>

              {/* Motorbikes */}
              <AccordionItem value="motorbikes" className="bg-white rounded-lg border">
                <AccordionTrigger className="px-6 py-4 text-left hover:no-underline">
                  <div>
                    <h3 className="text-xl font-bold text-gray-900">4. Motorbikes</h3>
                    <p className="text-gray-600">Petrol, EV and hybrid motorcycle cover</p>
                  </div>
                </AccordionTrigger>
                <AccordionContent className="px-6 pb-6">
                  <div className="space-y-8">
                    {/* Engine Coverage */}
                    <div>
                      <h4 className="text-lg font-bold text-gray-900 mb-4">Engine Coverage</h4>
                      <p className="text-gray-600">Cylinder head (excluding cracks), all internal bushes, camshafts and followers, cylinder bores, crankshaft and bearings, cylinder block or barrels crankcase assembly, cylinder head gasket, push rods, gudgeon pins, connecting rods and bearings, flywheel, oil pump, tappet gear, pistons and rings, timing gears, chain and belts (breakage only), valves and guides, excluding burnt out valves, decarbonising and reseating.</p>
                    </div>

                    {/* Transmission & Cooling Systems */}
                    <div>
                      <h4 className="text-lg font-bold text-gray-900 mb-4">Transmission & Cooling Systems</h4>
                      <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                        <div>
                          <h5 className="font-semibold text-gray-900 mb-2">1. Gearbox</h5>
                          <p className="text-gray-600">Manual and automatic internal breakdown of any mechanical parts, including gears, selector shafts and forks, bearings and bushes, excluding all external linkages and kickstart.</p>
                        </div>
                        <div>
                          <h5 className="font-semibold text-gray-900 mb-2">2. Cooling System</h5>
                          <p className="text-gray-600">Water pump, thermostat, thermostat housing, radiator, oil cooler, fan, (excluding belts, all ancillaries and damage caused by impact or frost).</p>
                        </div>
                      </div>
                    </div>

                    {/* Mechanical Components */}
                    <div>
                      <h4 className="text-lg font-bold text-gray-900 mb-4">Mechanical Components</h4>
                      <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
                        <div>
                          <h5 className="font-semibold text-gray-900 mb-2">Swinging Arm Unit</h5>
                          <p className="text-gray-600">All bushes and components within the swinging arm unit (excluding dampers).</p>
                        </div>
                        <div>
                          <h5 className="font-semibold text-gray-900 mb-2">Clutch</h5>
                          <p className="text-gray-600">Mechanical breakdown, excluding wear and tear.</p>
                        </div>
                        <div>
                          <h5 className="font-semibold text-gray-900 mb-2">Instruments</h5>
                          <p className="text-gray-600">Speedometer head. (Mechanical failure only)</p>
                        </div>
                      </div>
                    </div>

                    {/* Electrical & Drive Systems */}
                    <div>
                      <h4 className="text-lg font-bold text-gray-900 mb-4">Electrical & Drive Systems</h4>
                      <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
                        <div>
                          <h5 className="font-semibold text-gray-900 mb-2">Electrical</h5>
                          <p className="text-gray-600">Starter motor, alternator/generator, rectifier. Excluding external wires and terminals.</p>
                        </div>
                        <div>
                          <h5 className="font-semibold text-gray-900 mb-2">Ignition</h5>
                          <p className="text-gray-600">C.D.I. unit.</p>
                        </div>
                        <div>
                          <h5 className="font-semibold text-gray-900 mb-2">Final Drive Unit</h5>
                          <p className="text-gray-600">Driveshaft, universal joint, bearings and gears, (excluding chains, belts sprockets and rubber couplings).</p>
                        </div>
                      </div>
                    </div>

                    {/* Suspension & Braking Systems */}
                    <div>
                      <h4 className="text-lg font-bold text-gray-900 mb-4">Suspension & Braking Systems</h4>
                      <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                        <div>
                          <h5 className="font-semibold text-gray-900 mb-2">Suspension</h5>
                          <p className="text-gray-600 mb-2">Rear suspension unit, loss of fluid, pressure or mechanical breakdown of the suspension joint.</p>
                          <p className="text-gray-600"><strong>Front Telescopic Forks:</strong> Loss of fluid, pressure or mechanical breakdown of the suspension spring.</p>
                        </div>
                        <div>
                          <h5 className="font-semibold text-gray-900 mb-2">Brakes</h5>
                          <p className="text-gray-600 mb-2">Brake master cylinder and calipers including internal components, pistons, seals (excluding corrosion or wear and tear).</p>
                          <p className="text-gray-600"><strong>Casings:</strong> Covered if they have been damaged by the breakdown of one of the parts covered.</p>
                        </div>
                      </div>
                    </div>

                    {/* Additional Coverage Areas */}
                    <div>
                      <h4 className="text-lg font-bold text-gray-900 mb-4">Additional Coverage Areas</h4>
                      <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                        <div>
                          <h5 className="font-semibold text-gray-900 mb-2">Frame/Exhaust System</h5>
                          <p className="text-gray-600">Failure of structural members, excluding that caused by impact or corrosion.</p>
                        </div>
                        <div>
                          <h5 className="font-semibold text-gray-900 mb-2">Oil Leaks</h5>
                          <p className="text-gray-600">Leaks that require the removal of the engine, gearbox or final drive in order to effect a repair.</p>
                        </div>
                      </div>
                    </div>

                    {/* Motorbikes and Scooters Covered */}
                    <div>
                      <h4 className="text-lg font-bold text-gray-900 mb-4">Motorbikes and Scooters Covered</h4>
                      <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                        <div className="space-y-4">
                          <div>
                            <h5 className="font-semibold text-gray-900">Standard Motorbikes</h5>
                            <p className="text-gray-600">Road-legal motorcycles used for personal or commuting purposes</p>
                          </div>
                          <div>
                            <h5 className="font-semibold text-gray-900">Scooters (Petrol/Electric)</h5>
                            <p className="text-gray-600">Small-capacity scooters (typically up to 125cc or equivalent electric models)</p>
                          </div>
                          <div>
                            <h5 className="font-semibold text-gray-900">Touring Bikes</h5>
                            <p className="text-gray-600">Motorbikes designed for long-distance travel</p>
                          </div>
                        </div>
                        <div className="space-y-4">
                          <div>
                            <h5 className="font-semibold text-gray-900">Cruisers</h5>
                            <p className="text-gray-600">e.g. Harley-Davidson-style bikes intended for standard road use</p>
                          </div>
                          <div>
                            <h5 className="font-semibold text-gray-900">Commuter Bikes</h5>
                            <p className="text-gray-600">Lightweight, commonly used daily road bikes</p>
                          </div>
                          <div>
                            <h5 className="font-semibold text-gray-900">*Electric Motorbikes/Scooters</h5>
                            <p className="text-gray-600">*Please see our EV vehicle plans</p>
                          </div>
                        </div>
                      </div>
                      
                      <div className="mt-6 p-4 bg-blue-50 rounded-lg">
                        <h5 className="font-semibold text-blue-800 mb-2">Eligibility Criteria:</h5>
                        <ul className="space-y-1 text-blue-700">
                          <li>• Mileage under 60,000 miles at the start of the warranty</li>
                          <li>• Vehicle age under 15 years at the start of the warranty</li>
                        </ul>
                      </div>
                    </div>

                    {/* Motorbikes and Scooters Excluded */}
                    <div className="p-6 bg-red-50 rounded-lg">
                      <h4 className="text-lg font-bold text-red-800 mb-4">Motorbikes and Scooters Excluded</h4>
                      <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                        <div className="space-y-4">
                          <div>
                            <h5 className="font-semibold text-red-800">Off-road / Motocross Bikes</h5>
                            <p className="text-red-700">Not designed for road use</p>
                          </div>
                          <div>
                            <h5 className="font-semibold text-red-800">Quad Bikes / ATVs</h5>
                            <p className="text-red-700">Not classified as motorbikes or scooters for warranty purposes</p>
                          </div>
                          <div>
                            <h5 className="font-semibold text-red-800">Track / Racing Bikes</h5>
                            <p className="text-red-700">High-performance vehicles not intended for standard road use</p>
                          </div>
                        </div>
                        <div className="space-y-4">
                          <div>
                            <h5 className="font-semibold text-red-800">Custom Builds / Modified Bikes</h5>
                            <p className="text-red-700">Non-standard specifications</p>
                          </div>
                          <div>
                            <h5 className="font-semibold text-red-800">Bikes used for Hire or Reward</h5>
                            <p className="text-red-700">Includes delivery services (e.g. Uber Eats, courier use)</p>
                          </div>
                        </div>
                      </div>
                      
                      <div className="mt-6">
                        <h5 className="font-semibold text-red-800 mb-2">Additional Requirements:</h5>
                        <ul className="space-y-1 text-red-700">
                          <li>• Must be UK registered</li>
                          <li>• Must be road legal</li>
                          <li>• Must be in regular use</li>
                        </ul>
                      </div>
                    </div>
                  </div>
                </AccordionContent>
              </AccordionItem>
            </Accordion>
          </div>
        </section>

        {/* High Performance Vehicles Not Eligible */}
        <section className="py-16 lg:py-24 px-4 bg-blue-50">
          <div className="max-w-6xl mx-auto">
            <h2 className="text-3xl lg:text-4xl font-bold text-foreground text-center mb-12">
              High Performance Vehicles Not Eligible for Our Warranty Cover
            </h2>
            
            <Accordion type="single" collapsible className="space-y-4">
              <AccordionItem value="high-performance-vehicles" className="bg-white rounded-lg border">
                <AccordionTrigger className="px-6 py-4 text-left hover:no-underline">
                  <h3 className="text-xl font-bold text-foreground">Read more</h3>
                </AccordionTrigger>
                <AccordionContent className="px-6 pb-6">
                  <div className="space-y-8">
                    {/* Disclaimer */}
                    <div className="bg-blue-50 border-l-4 border-blue-400 p-6 rounded-lg flex items-start gap-4">
                      <Crown className="h-6 w-6 text-blue-600 flex-shrink-0 mt-1" />
                      <p className="text-muted-foreground leading-relaxed">
                        We're not able to offer warranty cover for high-performance, high-end or luxury vehicles, including those with similar specifications or servicing requirements to the models listed above, as well as newer versions of the same makes and models.
                      </p>
                    </div>

                    {/* BMW Models by Series */}
                    <div className="space-y-6">
                      <h4 className="text-2xl font-bold text-foreground">BMW Models</h4>
                      
                      {/* 1 Series */}
                      <div>
                        <h5 className="text-lg font-bold text-foreground mb-3">1 Series</h5>
                        <ul className="space-y-2 text-muted-foreground ml-4">
                          <li>• BMW M135i xDrive</li>
                        </ul>
                      </div>

                      {/* 2 Series */}
                      <div>
                        <h5 className="text-lg font-bold text-foreground mb-3">2 Series</h5>
                        <ul className="space-y-2 text-muted-foreground ml-4">
                          <li>• BMW M240i Coupé</li>
                          <li>• BMW M235i xDrive Gran Coupé</li>
                          <li>• BMW M2 Coupé</li>
                          <li>• BMW M2 CS</li>
                        </ul>
                      </div>

                      {/* 3 Series */}
                      <div>
                        <h5 className="text-lg font-bold text-foreground mb-3">3 Series</h5>
                        <ul className="space-y-2 text-muted-foreground ml-4">
                          <li>• BMW M340i xDrive Sedan</li>
                          <li>• BMW M340d xDrive Sedan</li>
                          <li>• BMW M340i xDrive Touring</li>
                          <li>• BMW M340d xDrive Touring</li>
                          <li>• BMW M3 Sedan</li>
                          <li>• BMW M3 Competition Sedan</li>
                          <li>• BMW M3 CS</li>
                          <li>• BMW M3 Competition Touring</li>
                        </ul>
                      </div>

                      {/* 4 Series */}
                      <div>
                        <h5 className="text-lg font-bold text-foreground mb-3">4 Series</h5>
                        <ul className="space-y-2 text-muted-foreground ml-4">
                          <li>• BMW M440i xDrive Coupé</li>
                          <li>• BMW M440d xDrive Coupé</li>
                          <li>• BMW M440i xDrive Convertible</li>
                          <li>• BMW M440d xDrive Convertible</li>
                          <li>• BMW M440i xDrive Gran Coupé</li>
                          <li>• BMW M4 Coupé</li>
                          <li>• BMW M4 Competition Coupé</li>
                          <li>• BMW M4 CS</li>
                          <li>• BMW M4 Competition Convertible</li>
                          <li>• BMW M4 CS Edition VR46</li>
                        </ul>
                      </div>

                      {/* 5 Series */}
                      <div>
                        <h5 className="text-lg font-bold text-foreground mb-3">5 Series</h5>
                        <ul className="space-y-2 text-muted-foreground ml-4">
                          <li>• BMW M550i xDrive Sedan</li>
                          <li>• BMW M5 Sedan</li>
                          <li>• BMW M5 Competition</li>
                          <li>• BMW M5 CS</li>
                          <li>• BMW M5 Touring</li>
                        </ul>
                      </div>

                      {/* 7 Series */}
                      <div>
                        <h5 className="text-lg font-bold text-foreground mb-3">7 Series</h5>
                        <ul className="space-y-2 text-muted-foreground ml-4">
                          <li>• BMW M760e xDrive (Plug-in Hybrid)</li>
                          <li>• BMW M760Li xDrive (Petrol)</li>
                        </ul>
                      </div>

                      {/* 8 Series */}
                      <div>
                        <h5 className="text-lg font-bold text-foreground mb-3">8 Series</h5>
                        <ul className="space-y-2 text-muted-foreground ml-4">
                          <li>• BMW M850i xDrive Coupé</li>
                          <li>• BMW M850i xDrive Convertible</li>
                          <li>• BMW M850i xDrive Gran Coupé</li>
                          <li>• BMW M8 Coupé</li>
                          <li>• BMW M8 Competition Coupé</li>
                          <li>• BMW M8 Convertible</li>
                          <li>• BMW M8 Competition Convertible</li>
                          <li>• BMW M8 Gran Coupé</li>
                          <li>• BMW M8 Competition Gran Coupé</li>
                          <li>• BMW M850i Edition M Heritage</li>
                        </ul>
                      </div>

                      {/* i Series (Electric) */}
                      <div>
                        <h5 className="text-lg font-bold text-foreground mb-3">i Series (Electric)</h5>
                        <ul className="space-y-2 text-muted-foreground ml-4">
                          <li>• BMW i4 M60 xDrive</li>
                          <li>• BMW i5 M60 Sedan</li>
                          <li>• BMW i5 M60 Touring</li>
                          <li>• BMW i7 M70</li>
                          <li>• BMW iX M70</li>
                        </ul>
                      </div>

                      {/* X Series (SUVs) */}
                      <div>
                        <h5 className="text-lg font-bold text-foreground mb-3">X Series (SUVs)</h5>
                        <ul className="space-y-2 text-muted-foreground ml-4">
                          <li>• BMW X1 M35i</li>
                          <li>• BMW X2 M35i</li>
                          <li>• BMW X3 M40i / M40d</li>
                          <li>• BMW X3 M / X3 M Competition</li>
                          <li>• BMW X4 M40i / M40d</li>
                          <li>• BMW X4 M / X4 M Competition</li>
                          <li>• BMW X5 M60i</li>
                          <li>• BMW X5 M / X5 M Competition</li>
                          <li>• BMW X6 M60i</li>
                          <li>• BMW X6 M / X6 M Competition</li>
                          <li>• BMW X7 M60i</li>
                        </ul>
                      </div>

                      {/* XM Series */}
                      <div>
                        <h5 className="text-lg font-bold text-foreground mb-3">XM Series</h5>
                        <ul className="space-y-2 text-muted-foreground ml-4">
                          <li>• BMW XM</li>
                          <li>• BMW XM Label</li>
                          <li>• BMW XM 50e</li>
                          <li>• BMW XM by Kith</li>
                        </ul>
                      </div>

                      {/* Z Series (Roadster) */}
                      <div>
                        <h5 className="text-lg font-bold text-foreground mb-3">Z Series (Roadster)</h5>
                        <ul className="space-y-2 text-muted-foreground ml-4">
                          <li>• BMW Z4 M40i</li>
                        </ul>
                      </div>
                    </div>

                    {/* Audi Models */}
                    <div className="space-y-6">
                      <h4 className="text-2xl font-bold text-foreground">Audi Models</h4>
                      
                      <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                        <div>
                          <h5 className="text-lg font-bold text-foreground mb-3">RS Performance Models</h5>
                          <ul className="space-y-2 text-muted-foreground ml-4">
                            <li>• Audi RS 3 Sportback</li>
                            <li>• Audi RS 3 Sedan</li>
                            <li>• Audi RS 4 Avant</li>
                            <li>• Audi RS 5 Coupé</li>
                            <li>• Audi RS 5 Sportback</li>
                            <li>• Audi RS 6 Avant</li>
                            <li>• Audi RS 6 Avant Performance</li>
                            <li>• Audi RS 7 Sportback</li>
                          </ul>
                        </div>
                        <div>
                          <h5 className="text-lg font-bold text-foreground mb-3">RS SUVs & Sports Cars</h5>
                          <ul className="space-y-2 text-muted-foreground ml-4">
                            <li>• Audi RS Q3</li>
                            <li>• Audi RS Q3 Sportback</li>
                            <li>• Audi RS Q5</li>
                            <li>• Audi RS Q8</li>
                            <li>• Audi RS e-tron GT</li>
                            <li>• Audi TT RS Coupé</li>
                            <li>• Audi TT RS Roadster</li>
                            <li>• Audi R8 Coupé</li>
                            <li>• Audi R8 Spyder</li>
                          </ul>
                        </div>
                      </div>
                    </div>

                    {/* Mercedes-AMG Models */}
                    <div className="space-y-6">
                      <h4 className="text-2xl font-bold text-foreground">Mercedes-AMG Models</h4>
                      
                      <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                        <div>
                          <h5 className="text-lg font-bold text-foreground mb-3">Compact & Mid-Size AMG</h5>
                          <ul className="space-y-2 text-muted-foreground ml-4">
                            <li>• Mercedes-AMG A 35</li>
                            <li>• Mercedes-AMG A 45 S</li>
                            <li>• Mercedes-AMG CLA 35</li>
                            <li>• Mercedes-AMG CLA 45 S</li>
                            <li>• Mercedes-AMG C 43</li>
                            <li>• Mercedes-AMG C 63 S</li>
                            <li>• Mercedes-AMG C 43 Estate</li>
                            <li>• Mercedes-AMG C 63 S Estate</li>
                            <li>• Mercedes-AMG C 43 Coupé</li>
                            <li>• Mercedes-AMG C 63 S Coupé</li>
                          </ul>
                        </div>
                        <div>
                          <h5 className="text-lg font-bold text-foreground mb-3">Executive AMG</h5>
                          <ul className="space-y-2 text-muted-foreground ml-4">
                            <li>• Mercedes-AMG E 53</li>
                            <li>• Mercedes-AMG E 63 S</li>
                            <li>• Mercedes-AMG E 53 Estate</li>
                            <li>• Mercedes-AMG E 63 S Estate</li>
                            <li>• Mercedes-AMG E 53 Coupé</li>
                            <li>• Mercedes-AMG S 63</li>
                            <li>• Mercedes-AMG CLE 53</li>
                            <li>• Mercedes-AMG CLE 63</li>
                          </ul>
                        </div>
                      </div>

                      <div className="grid grid-cols-1 md:grid-cols-2 gap-6 mt-4">
                        <div>
                          <h5 className="text-lg font-bold text-foreground mb-3">GT & Sports Cars</h5>
                          <ul className="space-y-2 text-muted-foreground ml-4">
                            <li>• Mercedes-AMG GT 43 4-Door</li>
                            <li>• Mercedes-AMG GT 53 4-Door</li>
                            <li>• Mercedes-AMG GT 63 4-Door</li>
                            <li>• Mercedes-AMG GT Coupé</li>
                            <li>• Mercedes-AMG SL 43</li>
                            <li>• Mercedes-AMG SL 55</li>
                            <li>• Mercedes-AMG SL 63</li>
                            <li>• Mercedes-AMG One</li>
                          </ul>
                        </div>
                        <div>
                          <h5 className="text-lg font-bold text-foreground mb-3">AMG SUVs</h5>
                          <ul className="space-y-2 text-muted-foreground ml-4">
                            <li>• Mercedes-AMG GLA 35</li>
                            <li>• Mercedes-AMG GLA 45</li>
                            <li>• Mercedes-AMG GLB 35</li>
                            <li>• Mercedes-AMG GLC 43</li>
                            <li>• Mercedes-AMG GLC 63</li>
                            <li>• Mercedes-AMG GLC 43 Coupé</li>
                            <li>• Mercedes-AMG GLC 63 Coupé</li>
                            <li>• Mercedes-AMG GLE 53</li>
                            <li>• Mercedes-AMG GLE 63</li>
                            <li>• Mercedes-AMG GLE 53 Coupé</li>
                            <li>• Mercedes-AMG GLE 63 Coupé</li>
                            <li>• Mercedes-AMG GLS 63</li>
                            <li>• Mercedes-AMG G 63</li>
                          </ul>
                        </div>
                      </div>

                      <div>
                        <h5 className="text-lg font-bold text-foreground mb-3">Electric AMG</h5>
                        <ul className="space-y-2 text-muted-foreground ml-4">
                          <li>• Mercedes-AMG EQE</li>
                          <li>• Mercedes-AMG EQE SUV</li>
                          <li>• Mercedes-AMG EQS SUV</li>
                        </ul>
                      </div>
                    </div>

                    {/* Ford Performance Models */}
                    <div className="space-y-6">
                      <h4 className="text-2xl font-bold text-foreground">Ford Performance Models</h4>
                      
                      <ul className="space-y-2 text-muted-foreground ml-4">
                        <li>• Ford Fiesta ST</li>
                        <li>• Ford Focus ST</li>
                        <li>• Ford Focus RS</li>
                        <li>• Ford Puma ST</li>
                        <li>• Ford Mustang GT</li>
                        <li>• Ford Mustang Mach 1</li>
                        <li>• Ford Mustang Mach-E GT</li>
                        <li>• Ford GT</li>
                        <li>• Ford Ranger Raptor</li>
                      </ul>
                    </div>

                    {/* Vauxhall Performance Models */}
                    <div className="space-y-6">
                      <h4 className="text-2xl font-bold text-foreground">Vauxhall Performance Models</h4>
                      
                      <ul className="space-y-2 text-muted-foreground ml-4">
                        <li>• Vauxhall Corsa VXR</li>
                        <li>• Vauxhall Astra VXR</li>
                        <li>• Vauxhall Astra GTC VXR</li>
                        <li>• Vauxhall Insignia VXR</li>
                        <li>• Vauxhall Vectra VXR</li>
                        <li>• Vauxhall Zafira VXR</li>
                        <li>• Vauxhall Meriva VXR</li>
                        <li>• Vauxhall VX220 VXR</li>
                        <li>• Vauxhall Monaro VXR</li>
                        <li>• Vauxhall VXR8</li>
                        <li>• Vauxhall GSi</li>
                      </ul>
                    </div>

                    {/* MINI Performance Models */}
                    <div className="space-y-6">
                      <h4 className="text-2xl font-bold text-foreground">MINI John Cooper Works (JCW) Models</h4>
                      
                      <ul className="space-y-2 text-muted-foreground ml-4">
                        <li>• MINI JCW 3-Door Hatch</li>
                        <li>• MINI JCW Convertible</li>
                        <li>• MINI JCW Clubman</li>
                        <li>• MINI JCW Countryman</li>
                        <li>• MINI JCW Electric</li>
                      </ul>
                    </div>

                    {/* Land Rover Performance Models */}
                    <div className="space-y-6">
                      <h4 className="text-2xl font-bold text-foreground">Land Rover Performance Models</h4>
                      
                      <ul className="space-y-2 text-muted-foreground ml-4">
                        <li>• Range Rover Sport SVR</li>
                        <li>• Range Rover Sport SV</li>
                        <li>• Range Rover SVAutobiography Dynamic</li>
                        <li>• Defender V8</li>
                        <li>• Defender V8 Carpathian Edition</li>
                        <li>• Range Rover Velar SVAutobiography Dynamic Edition</li>
                        <li>• Range Rover SV Black</li>
                        <li>• Range Rover SV Carbon</li>
                      </ul>
                    </div>

                    {/* Other Vehicles Disclaimer */}
                    <div className="mt-8 bg-muted p-6 rounded-lg">
                      <h5 className="text-lg font-bold text-foreground mb-3">Other Vehicles:</h5>
                      <p className="text-muted-foreground leading-relaxed">
                        We're unable to offer cover for vehicles with similar specifications or servicing requirements to those listed above, including newer versions of the same makes and models.
                      </p>
                    </div>
                  </div>
                </AccordionContent>
              </AccordionItem>
            </Accordion>
          </div>
        </section>

        {/* Consequential Damage Cover */}
        <section className="py-16 lg:py-24 px-4 bg-white">
          <div className="max-w-4xl mx-auto">
            <h2 className="text-3xl lg:text-4xl font-bold text-gray-900 text-center mb-12">
              Consequential Damage Cover
            </h2>
            
            <div className="space-y-8">
              <div>
                <h3 className="text-2xl font-bold text-gray-900 mb-4">What Consequential Damage Means</h3>
                <p className="text-gray-600 text-lg leading-relaxed">
                  Consequential damage is when one covered part fails and causes damage to another part of your vehicle. It's the "knock-on" effect that can quickly turn a minor issue into a much larger, more expensive repair.
                </p>
              </div>
              
              <div>
                <h3 className="text-2xl font-bold text-gray-900 mb-4">How It Protects You</h3>
                <p className="text-gray-600 text-lg leading-relaxed">
                  Imagine a small, covered part unexpectedly stops working. If this failure then directly causes a different, healthy part to break or get damaged, that secondary damage is what we call "consequential damage". Our Consequential Damage Cover is designed to shield you from these escalating repair costs. If a covered part fails and, as a direct result, damages another part, both the initial failed part and the subsequent damage are covered. This means greater peace of mind, knowing that a single component failure won't lead to an entirely new, expensive problem out of your pocket.
                </p>
              </div>
              
              <div>
                <h3 className="text-2xl font-bold text-gray-900 mb-4">Common Examples</h3>
                <div className="bg-orange-50 p-6 rounded-lg">
                  <h4 className="font-semibold text-gray-900 mb-2">Water Pump Failure:</h4>
                  <p className="text-gray-600">If your water pump (a covered component) fails, it can cause your engine to overheat. Without this crucial coverage, you might only be covered for the water pump, leaving you to pay for the extensive engine damage caused by the overheating.</p>
                </div>
                <p className="text-gray-600 text-lg mt-4">
                  This coverage ensures that a small problem doesn't escalate into a massive financial burden, providing you with greater peace of mind.
                </p>
              </div>
            </div>
          </div>
        </section>

        {/* Add-On Options */}
        <section className="py-16 lg:py-24 px-4 bg-gray-50">
          <div className="max-w-6xl mx-auto">
            <h2 className="text-3xl lg:text-4xl font-bold text-gray-900 text-center mb-8">
              Explore optional extras
            </h2>
            <p className="text-lg text-gray-600 text-center mb-12">
              Add-on options designed to enhance your journey
            </p>
            
            <Accordion type="single" collapsible className="space-y-4">
              {/* Main Add-On Options */}
              <AccordionItem value="main-addons" className="bg-white rounded-lg border">
                <AccordionTrigger className="px-6 py-4 text-left hover:no-underline">
                  <h3 className="text-xl font-bold text-gray-900">Add-On options</h3>
                </AccordionTrigger>
                <AccordionContent className="px-6 pb-6">
                  <p className="text-gray-600 mb-6">Enhance Your Protection Package with our reliable add-ons. Available to add on the pricing page during checkout</p>
                  
                  <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
                    <div className="space-y-4">
                      <h4 className="font-bold text-gray-900">Vehicle Hire Coverage</h4>
                      <p className="text-gray-600 text-sm leading-relaxed">
                        Stay on the move even if your vehicle is undergoing repairs. Enjoy the convenience of a replacement vehicle with up to £45 per day towards rental costs, ensuring minimal disruption to your daily life. Applicable if manufacturer's repair time exceeds 8 working hours, with prior approval from Buy a Warranty.
                      </p>
                    </div>
                    <div className="space-y-4">
                      <h4 className="font-bold text-gray-900">Breakdown Recovery Service</h4>
                      <p className="text-gray-600 text-sm leading-relaxed">
                        Experience true peace of mind knowing that help is always at hand. Our breakdown recovery service provides up to £60 per claim for roadside assistance, ensuring you're never stranded. Simply make a claim in the usual way for quick support.
                      </p>
                    </div>
                    <div className="space-y-4">
                      <h4 className="font-bold text-gray-900">European Travel Protection</h4>
                      <p className="text-gray-600 text-sm leading-relaxed">
                        Venture across Europe with confidence! Your coverage extends to key European countries for up to 60 days in any 12-month period. Explore the Schengen Area countries and more, including Belgium, France, Germany, Liechtenstein, Luxembourg, Monaco, Netherlands, Switzerland, Spain, Italy, Portugal, Austria and Norway, knowing you're protected.
                      </p>
                    </div>
                  </div>
                </AccordionContent>
              </AccordionItem>

              {/* Wear & Tear Protection */}
              <AccordionItem value="wear-tear" className="bg-white rounded-lg border">
                <AccordionTrigger className="px-6 py-4 text-left hover:no-underline">
                  <h3 className="text-xl font-bold text-gray-900">Wear & Tear Protection add-on</h3>
                </AccordionTrigger>
                <AccordionContent className="px-6 pb-6">
                  <p className="text-gray-600 mb-6">
                    Safeguard your vehicle against the inevitable effects of time and use. Our Wear & Tear Protection Package goes beyond standard warranties, offering comprehensive coverage for crucial components as they age, ensuring your vehicle remains reliable and your finances protected.
                  </p>
                  
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                    <div>
                      <h4 className="font-bold text-green-800 mb-4">What's Included</h4>
                      <ul className="space-y-2 text-gray-600">
                        <li><strong>Core Mechanical Parts:</strong> Protection for essential engine, gearbox, differential, and drivetrain components not classified as consumables.</li>
                        <li><strong>Unexpected Failures:</strong> Coverage for mechanical breakdowns not caused by routine wear or scheduled servicing.</li>
                        <li><strong>Premature Part Failure:</strong> Guards against parts breaking down before their expected lifespan, saving you from costly surprises.</li>
                        <li><strong>Critical Electrical Components:</strong> Covers non-replaceable electrical parts like ECUs, sensors, and alternators.</li>
                        <li><strong>Factory-Fitted Systems:</strong> Protection for original systems that fail unexpectedly, beyond routine maintenance.</li>
                      </ul>
                    </div>
                    <div>
                      <h4 className="font-bold text-red-800 mb-4">What's Not Included</h4>
                      <ul className="space-y-2 text-gray-600">
                        <li><strong>Consumable Items:</strong> Parts with a naturally finite life expectancy, such as brake pads, discs, clutch friction, tyres, and wiper blades.</li>
                        <li><strong>Routine Service Items:</strong> Parts requiring periodic maintenance like oil, filters, spark plugs, and timing belts (unless premature failure).</li>
                        <li><strong>Maintenance-Related Issues:</strong> Items identified for replacement during routine servicing or inspections.</li>
                        <li><strong>Neglect or Misuse:</strong> Failures resulting from a lack of maintenance, misuse, or neglect of the vehicle.</li>
                      </ul>
                    </div>
                  </div>
                </AccordionContent>
              </AccordionItem>

              {/* Comprehensive Tyre Protection */}
              <AccordionItem value="tyre-protection" className="bg-white rounded-lg border">
                <AccordionTrigger className="px-6 py-4 text-left hover:no-underline">
                  <h3 className="text-xl font-bold text-gray-900">Comprehensive tyre protection add-on</h3>
                </AccordionTrigger>
                <AccordionContent className="px-6 pb-6">
                  <p className="text-gray-600 mb-6">
                    Don't let unexpected tyre damage deflate your day or your wallet. Our comprehensive Tyre Protection plan offers unparalleled peace of mind, safeguarding you against the common hazards of the road. Drive confidently, knowing that from accidental punctures to malicious damage, your tyres are fully covered, keeping you and your vehicle moving.
                  </p>
                  
                  <div className="space-y-6">
                    <div>
                      <h4 className="text-xl font-bold text-gray-900 mb-4">Your Tyre Cover</h4>
                      
                      <div className="grid grid-cols-1 md:grid-cols-3 gap-6 mb-6">
                        <div>
                          <h5 className="font-bold text-gray-900 mb-2">Generous Tyre Coverage</h5>
                          <p className="text-gray-600 text-sm">Receive up to £150 per tyre for each tyre that needs repairing or replacing. This generous limit ensures significant savings on unexpected costs.</p>
                        </div>
                        <div>
                          <h5 className="font-bold text-gray-900 mb-2">Accidental Damage Protection</h5>
                          <p className="text-gray-600 text-sm">If your tyre is accidentally damaged, we'll cover the cost of repair or replacement, up to your claim limit. We've got you covered for those unforeseen bumps in the road.</p>
                        </div>
                        <div>
                          <h5 className="font-bold text-gray-900 mb-2">Malicious Damage Security</h5>
                          <p className="text-gray-600 text-sm">Even if someone damages your tyre on purpose, you're covered. We'll take care of the repair or replacement cost, up to your claim limit. (A police report and crime reference number are required for this type of claim.)</p>
                        </div>
                      </div>
                      
                      <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                        <div>
                          <h5 className="font-bold text-gray-900 mb-2">Puncture Repair Benefits</h5>
                          <p className="text-gray-600">We'll cover puncture repairs up to £50 per repair. You can claim for up to five puncture repairs and four tyre replacements per policy year, keeping you on track.</p>
                        </div>
                        <div>
                          <h5 className="font-bold text-gray-900 mb-2">Roadside Assistance Contribution</h5>
                          <p className="text-gray-600">If you need roadside help for any of the above covered incidents, we'll contribute up to £30 towards the cost, within your claim limit, so you're never stranded.</p>
                        </div>
                      </div>
                    </div>
                  </div>
                </AccordionContent>
              </AccordionItem>

              {/* Transfer of Warranty */}
              <AccordionItem value="transfer-warranty" className="bg-white rounded-lg border">
                <AccordionTrigger className="px-6 py-4 text-left hover:no-underline">
                  <h3 className="text-xl font-bold text-gray-900">Transfer of Warranty add-on</h3>
                </AccordionTrigger>
                <AccordionContent className="px-6 pb-6">
                  <p className="text-gray-600 mb-6">
                    This warranty is transferable should the vehicle be sold privately or you change your vehicle, subject to the approval of Buy A Warranty.
                  </p>
                  
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                    <div>
                      <h4 className="font-bold text-gray-900 mb-4">Email Request</h4>
                      <p className="text-gray-600 mb-2">Email us to make a transfer:</p>
                      <p className="font-medium text-orange-500">support@buyawarranty.co.uk</p>
                      <p className="text-gray-600 mt-2">Subject: Transfer of ownership</p>
                      
                      <h5 className="font-bold text-gray-900 mt-4 mb-2">Transfer fee</h5>
                      <p className="text-gray-600">Transfer fee as per selected option during checkout or bought during the warranty cover period.</p>
                    </div>
                    <div>
                      <h4 className="font-bold text-gray-900 mb-4">Vehicle Details</h4>
                      <p className="text-gray-600 mb-4">
                        Full vehicle details including mileage at the time of sale will be needed and full name and address of the new owner. There is no additional charge for vehicles of the same category. If the vehicle is of a different category for example the new owner has a premium vehicle, there may be an extra fee.
                      </p>
                      <p className="text-gray-600">
                        For assistance please email: 
                        <span className="font-medium text-orange-500 ml-1">support@buyawarranty.co.uk</span> with transfer details.
                      </p>
                    </div>
                  </div>
                </AccordionContent>
              </AccordionItem>
            </Accordion>
          </div>
        </section>

        {/* Claims Process */}
        <section className="py-16 lg:py-24 px-4 bg-white">
          <div className="max-w-4xl mx-auto">
            <h2 className="text-3xl lg:text-4xl font-bold text-gray-900 text-center mb-8">
              Making a claim made easy
            </h2>
            <p className="text-lg text-gray-600 text-center mb-12">
              No jargon, no hassle - just straightforward help when you need it.
            </p>
            
            <div className="space-y-8">
              {/* Claims without complications */}
              <div>
                <h3 className="text-2xl font-bold text-gray-900 text-center mb-8">Claims without complications</h3>
                
                <div className="grid grid-cols-1 md:grid-cols-3 gap-8 mb-12">
                  <div className="text-center">
                    <div className="bg-orange-500 text-white rounded-full w-12 h-12 flex items-center justify-center font-bold text-xl mx-auto mb-4">1</div>
                    <h4 className="font-bold text-gray-900 mb-4">Vehicle Diagnosis</h4>
                    <p className="text-gray-600 mb-4">Book your vehicle with a local independent repair agent for a complete diagnosis of the issue.</p>
                    <h5 className="font-semibold text-gray-900 mb-2">Contact Before Repairs</h5>
                    <p className="text-gray-600 mb-4">Once diagnosis is complete, but before any repairs begin, your repairer must contact our team for authorisation on our claims line or via email claims@buyawarranty.co.uk.</p>
                    <h5 className="font-semibold text-gray-900 mb-2">Visit Our Claims Section</h5>
                    <p className="text-gray-600">Begin the process by visiting our dedicated claims section online at www.buyawarranty.co.uk/make-a-claim.</p>
                  </div>
                  
                  <div className="text-center">
                    <div className="bg-orange-500 text-white rounded-full w-12 h-12 flex items-center justify-center font-bold text-xl mx-auto mb-4">2</div>
                    <h4 className="font-bold text-gray-900 mb-4">Claim Review & Authorisation</h4>
                    <ul className="text-gray-600 space-y-2 text-left">
                      <li>• Our team speaks directly with your repairer.</li>
                      <li>• We gather repair details and confirm estimated costs.</li>
                      <li>• Most claims reviewed within 90 minutes during working hours.</li>
                      <li>• Costs beyond authorised amount are your responsibility.</li>
                    </ul>
                    <p className="text-orange-500 font-semibold mt-4">Important: No repairs should begin without our explicit authorisation.</p>
                  </div>
                  
                  <div className="text-center">
                    <div className="bg-orange-500 text-white rounded-full w-12 h-12 flex items-center justify-center font-bold text-xl mx-auto mb-4">3</div>
                    <h4 className="font-bold text-gray-900 mb-4">Authorisation & Payment</h4>
                    <ul className="text-gray-600 space-y-2 text-left">
                      <li>• Approval sent via email to repairer.</li>
                      <li>• Secure link provided for invoice and payment details.</li>
                      <li>• Payment typically processed within 24 hours of receiving invoice.</li>
                    </ul>
                  </div>
                </div>
              </div>
            </div>
          </div>
        </section>

        {/* Why Choose Section */}
        <section className="py-16 lg:py-24 px-4 bg-gray-50">
          <div className="max-w-4xl mx-auto text-center">
            <h2 className="text-3xl lg:text-4xl font-bold text-gray-900 mb-8">
              Why Choose a Vehicle Warranty?
            </h2>
            <p className="text-lg text-gray-600 mb-12">
              Not just protection - peace of mind, personal service, and perks that go the extra mile.
            </p>
            
            <div className="grid grid-cols-1 md:grid-cols-3 gap-8">
              <div className="text-center">
                <h3 className="text-xl font-bold text-gray-900 mb-4">Rapid Response</h3>
                <p className="text-gray-600">Most claims reviewed within 90 minutes during business hours, with payments typically processed within 24 hours of invoice receipt.</p>
              </div>
              <div className="text-center">
                <h3 className="text-xl font-bold text-gray-900 mb-4">Comprehensive Coverage</h3>
                <p className="text-gray-600">Protection for crucial mechanical components including engine, transmission, differential and essential electrical systems.</p>
              </div>
              <div className="text-center">
                <h3 className="text-xl font-bold text-gray-900 mb-4">Direct Communication</h3>
                <p className="text-gray-600">Our team works directly with your repairer, creating a hassle-free experience when you need it most.</p>
              </div>
            </div>
          </div>
        </section>

        {/* Thank You Section */}
        <section className="py-16 lg:py-24 px-4 bg-blue-600 text-white">
          <div className="max-w-4xl mx-auto text-center">
            <h2 className="text-3xl lg:text-4xl font-bold mb-8">
              Thank you for choosing Buy A Warranty!
            </h2>
            
            <div className="space-y-6 mb-12">
              <p className="text-lg">Thank you for reading your terms and conditions document.</p>
              <p className="text-lg">Please keep it in a safe place.</p>
              <p className="text-lg">We're here to provide reliable support when you need it most.</p>
            </div>
            
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6 mb-12">
              <div className="bg-white/10 backdrop-blur-sm rounded-lg p-6">
                <p className="font-medium mb-2">Email:</p>
                <p className="text-blue-200">claims@buyawarranty.co.uk</p>
              </div>
              <div className="bg-white/10 backdrop-blur-sm rounded-lg p-6">
                <p className="font-medium mb-2">Customer service:</p>
                <p className="text-blue-200">0330 229 5040</p>
              </div>
              <div className="bg-white/10 backdrop-blur-sm rounded-lg p-6">
                <p className="font-medium mb-2">Claims line:</p>
                <p className="text-blue-200">0330 229 5045</p>
              </div>
              <div className="bg-white/10 backdrop-blur-sm rounded-lg p-6">
                <p className="font-medium mb-2">Website:</p>
                <p className="text-blue-200">www.buyawarranty.co.uk</p>
              </div>
            </div>
            
          </div>
        </section>
      </div>
    </>
  );
};

export default WarrantyPlan;