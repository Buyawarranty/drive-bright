import React, { useState, useEffect } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { Helmet } from 'react-helmet-async';
import { Button } from '@/components/ui/button';
import { Car, Truck, Shield, ArrowRight, Phone, Menu, Battery, Bike, Award, ChevronRight, Check, Star, MessageCircle } from 'lucide-react';
import { Sheet, SheetContent, SheetTrigger } from '@/components/ui/sheet';
import { useIsMobile } from '@/hooks/use-mobile';
import { supabase } from '@/integrations/supabase/client';
// WebsiteFooter removed - rendered globally via App.tsx ConditionalFooter
import TrustpilotHeader from '@/components/TrustpilotHeader';
import { OptimizedImage } from '@/components/OptimizedImage';
import trustpilotLogo from '@/assets/trustpilot-logo.webp';
import ukVehiclesImg from '@/assets/warranty-types-uk-vehicles.jpg';
import carImg from '@/assets/warranty-types-car.jpg';
import vanImg from '@/assets/warranty-types-van.jpg';
import evImg from '@/assets/warranty-types-ev.jpg';
import motorcycleImg from '@/assets/warranty-types-motorcycle.jpg';

interface DynamicLandingPage {
  id: string;
  slug: string;
  brand_name: string;
  brand_logo_url: string | null;
  meta_description: string | null;
  h1_headline: string;
  page_type: string | null;
}

// Default warranty categories
const defaultCategories = [
  {
    id: 'car-warranty',
    slug: 'car-extended-warranty',
    brand_name: 'Car Extended Warranty',
    icon: Car,
    image: carImg,
    description: 'Comprehensive protection for all car makes and models. From hatchbacks to luxury vehicles.',
  },
  {
    id: 'van-warranty',
    slug: 'van-warranty',
    brand_name: 'Van Warranty',
    icon: Truck,
    image: vanImg,
    description: 'Tailored cover for commercial and personal vans. Keep your business moving.',
  },
  {
    id: 'electric-warranty',
    slug: 'ev-warranty',
    brand_name: 'Electric Vehicle Warranty',
    icon: Battery,
    image: evImg,
    description: 'Specialist protection for hybrid and electric vehicles including battery cover.',
  },
  {
    id: 'motorcycle-warranty',
    slug: 'motorcycle-warranty',
    brand_name: 'Motorcycle Warranty',
    icon: Bike,
    image: motorcycleImg,
    description: 'Reliable cover for motorcycles and scooters of all engine sizes.',
  },
];

const WarrantyTypes: React.FC = () => {
  const isMobile = useIsMobile();
  const navigate = useNavigate();
  const [isMobileMenuOpen, setIsMobileMenuOpen] = useState(false);
  const [dynamicPages, setDynamicPages] = useState<DynamicLandingPage[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const fetchDynamicPages = async () => {
      const { data, error } = await supabase
        .from('landing_pages')
        .select('id, slug, brand_name, brand_logo_url, meta_description, h1_headline, page_type')
        .eq('status', 'published')
        .eq('is_indexable', true)
        .order('brand_name');
      
      if (!error && data) {
        setDynamicPages(data);
      }
      setLoading(false);
    };
    fetchDynamicPages();
  }, []);

  const getIconForPageType = (pageType: string | null, brandName: string) => {
    const lowerBrand = brandName.toLowerCase();
    if (lowerBrand.includes('van') || lowerBrand.includes('commercial')) return Truck;
    if (lowerBrand.includes('electric') || lowerBrand.includes('ev') || lowerBrand.includes('hybrid')) return Battery;
    if (lowerBrand.includes('motorcycle') || lowerBrand.includes('bike')) return Bike;
    return Car;
  };

  // Generate schema markup for the page
  const schemaMarkup = {
    "@context": "https://schema.org",
    "@type": "ItemList",
    "name": "Vehicle Warranty Types",
    "description": "Explore all vehicle warranty options from Buy A Warranty",
    "numberOfItems": dynamicPages.length + defaultCategories.length,
    "itemListElement": [
      ...defaultCategories.map((cat, index) => ({
        "@type": "ListItem",
        "position": index + 1,
        "name": cat.brand_name,
        "url": `https://buyawarranty.co.uk/${cat.slug}`
      })),
      ...dynamicPages.map((page, index) => ({
        "@type": "ListItem",
        "position": defaultCategories.length + index + 1,
        "name": page.brand_name,
        "url": `https://buyawarranty.co.uk/${page.slug}`
      }))
    ]
  };

  return (
    <>
      <Helmet>
        <title>Warranty Types | Vehicle Warranty Options | Buy A Warranty</title>
        <meta name="description" content="Discover all our warranty types in one place. From BMW to vans, find tailored cover for your vehicle. Explore car, van, electric and brand-specific warranties." />
        <meta name="keywords" content="warranty types, car warranty, van warranty, BMW warranty, Audi warranty, Mercedes warranty, vehicle warranty, extended warranty" />
        <link rel="canonical" href="https://buyawarranty.co.uk/warranty-types" />
        <meta property="og:title" content="Warranty Types | All Vehicle Warranty Options" />
        <meta property="og:description" content="Discover all our warranty types in one place. From BMW to vans, find tailored cover for your vehicle." />
        <meta property="og:type" content="website" />
        <script type="application/ld+json">
          {JSON.stringify(schemaMarkup)}
        </script>
      </Helmet>

      <div className="min-h-screen bg-white">
        {/* Header */}
        <header className="sticky top-0 z-50 bg-white/95 backdrop-blur-sm shadow-sm">
          <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-4">
            <div className="flex justify-between items-center">
              <Link to="/" className="flex items-center">
                <img 
                  src="/lovable-uploads/4a0ed2f0-8030-4be3-9a3e-126452284495.png" 
                  alt="Buy A Warranty Logo" 
                  className="h-10 md:h-12 w-auto"
                />
              </Link>
              
              {/* Desktop Navigation */}
              <nav className="hidden md:flex items-center gap-8">
                <Link to="/" className="text-gray-700 hover:text-orange-500 transition-colors font-medium">
                  Home
                </Link>
                <Link to="/car-extended-warranty" className="text-gray-700 hover:text-orange-500 transition-colors font-medium">
                  Car Warranty
                </Link>
                <Link to="/warranty-types" className="text-orange-500 font-semibold">
                  Warranty Types
                </Link>
                <Link to="/claims" className="text-gray-700 hover:text-orange-500 transition-colors font-medium">
                  Claims
                </Link>
                <a href="tel:03302295040" className="flex items-center gap-2 text-orange-500 font-semibold">
                  <Phone className="h-4 w-4" />
                  0330 229 5040
                </a>
              </nav>
              
              {/* Mobile Menu */}
              <Sheet open={isMobileMenuOpen} onOpenChange={setIsMobileMenuOpen}>
                <SheetTrigger asChild className="md:hidden">
                  <Button variant="ghost" size="icon">
                    <Menu className="h-6 w-6" />
                  </Button>
                </SheetTrigger>
                <SheetContent side="right" className="w-[300px] bg-white">
                  <nav className="flex flex-col gap-4 mt-8">
                    <Link to="/" className="text-lg font-medium text-gray-700 hover:text-orange-500 py-2">
                      Home
                    </Link>
                    <Link to="/car-extended-warranty" className="text-lg font-medium text-gray-700 hover:text-orange-500 py-2">
                      Car Warranty
                    </Link>
                    <Link to="/warranty-types" className="text-lg font-medium text-orange-500 py-2">
                      Warranty Types
                    </Link>
                    <Link to="/claims" className="text-lg font-medium text-gray-700 hover:text-orange-500 py-2">
                      Claims
                    </Link>
                    <a href="tel:03302295040" className="flex items-center gap-2 text-lg font-medium text-orange-500 py-2">
                      <Phone className="h-5 w-5" />
                      0330 229 5040
                    </a>
                  </nav>
                </SheetContent>
              </Sheet>
            </div>
          </div>
        </header>


        {/* Hero Section - Matching CarExtendedWarranty style */}
        <section className="bg-gradient-to-br from-blue-50 via-white to-orange-50 py-12 md:py-20">
          <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
            <div className="grid lg:grid-cols-2 gap-8 lg:gap-12 items-center">
              {/* Left Content */}
              <div className="space-y-6">
                <div className="inline-flex items-center gap-2 bg-orange-100 text-orange-700 px-4 py-2 rounded-full text-sm font-medium">
                  <Shield className="h-4 w-4" />
                  Complete Vehicle Protection
                </div>
                
                <h1 className="text-3xl sm:text-4xl md:text-5xl lg:text-6xl font-black text-gray-900 leading-tight">
                  Find the Perfect <span className="text-brand-orange">Warranty</span> for Your Vehicle
                </h1>
                
                <p className="text-lg md:text-xl text-gray-600 max-w-xl">
                  Whether you drive a car, van, electric vehicle or motorcycle - we have tailored protection plans designed for your vehicle's unique needs.
                </p>

                <div className="space-y-3">
                  <div className="flex items-center gap-3">
                    <Check className="h-5 w-5 text-green-500 flex-shrink-0" />
                    <span className="text-gray-700 font-medium">From just 80p a day • Unlimited claims</span>
                  </div>
                  <div className="flex items-center gap-3">
                    <Check className="h-5 w-5 text-green-500 flex-shrink-0" />
                    <span className="text-gray-700 font-medium">8,000+ components covered • Fast payouts</span>
                  </div>
                  <div className="flex items-center gap-3">
                    <Check className="h-5 w-5 text-green-500 flex-shrink-0" />
                    <span className="text-gray-700 font-medium">Use any VAT-registered garage • UK support</span>
                  </div>
                </div>

                <div className="flex flex-col sm:flex-row gap-4 pt-4">
                  <Button 
                    onClick={() => navigate('/')} 
                    size="lg"
                    className="bg-brand-orange hover:bg-brand-orange/90 text-white font-bold px-8 py-6 text-lg rounded-lg shadow-lg animate-cta-enhanced"
                  >
                    Get Your Free Quote <ArrowRight className="ml-2 h-5 w-5" />
                  </Button>
                  <Button 
                    size="lg"
                    variant="outline"
                    onClick={() => window.location.href = 'tel:03302295040'}
                    className="border-primary text-primary hover:bg-primary hover:text-white font-semibold px-8 py-6 text-lg"
                  >
                    <Phone className="mr-2 h-5 w-5" /> Call 0330 229 5040
                  </Button>
                </div>
              </div>

              {/* Right Content - Hero Image */}
              <div className="relative hidden lg:block">
                <OptimizedImage 
                  src="/extended_warranty_uk-car-trustworthy-reviews.png"
                  alt="Extended warranty UK - Car trustworthy reviews - Panda mascot with vehicle collection" 
                  className="w-full h-auto"
                  priority={true}
                  width={651}
                  height={434}
                  sizes="(max-width: 768px) 100vw, 651px"
                />
                {/* Vehicle Types */}
                <div className="mt-6 flex items-center justify-center gap-6 flex-wrap">
                  <div className="flex items-center space-x-1.5">
                    <Car className="w-5 h-5 text-green-500 flex-shrink-0" />
                    <span className="font-medium text-gray-700 text-base">Cars</span>
                  </div>
                  <div className="flex items-center space-x-1.5">
                    <Truck className="w-5 h-5 text-green-500 flex-shrink-0" />
                    <span className="font-medium text-gray-700 text-base">Vans</span>
                  </div>
                  <div className="flex items-center space-x-1.5">
                    <Battery className="w-5 h-5 text-green-500 flex-shrink-0" />
                    <span className="font-medium text-gray-700 text-base">EVs</span>
                  </div>
                  <div className="flex items-center space-x-1.5">
                    <Bike className="w-5 h-5 text-green-500 flex-shrink-0" />
                    <span className="font-medium text-gray-700 text-base">Motorcycles</span>
                  </div>
                </div>
                {/* Trustpilot below vehicle types */}
                <div className="mt-4 flex justify-center">
                  <TrustpilotHeader />
                </div>
              </div>
            </div>

            {/* Mobile Vehicle Types */}
            <div className="lg:hidden mt-8">
              <div className="flex items-center justify-center gap-4 flex-wrap">
                <div className="flex items-center space-x-1">
                  <Car className="w-4 h-4 text-green-500 flex-shrink-0" />
                  <span className="font-medium text-gray-700 text-sm">Cars</span>
                </div>
                <div className="flex items-center space-x-1">
                  <Truck className="w-4 h-4 text-green-500 flex-shrink-0" />
                  <span className="font-medium text-gray-700 text-sm">Vans</span>
                </div>
                <div className="flex items-center space-x-1">
                  <Battery className="w-4 h-4 text-green-500 flex-shrink-0" />
                  <span className="font-medium text-gray-700 text-sm">EVs</span>
                </div>
                <div className="flex items-center space-x-1">
                  <Bike className="w-4 h-4 text-green-500 flex-shrink-0" />
                  <span className="font-medium text-gray-700 text-sm">Motorcycles</span>
                </div>
              </div>
            </div>
          </div>
        </section>

        {/* Main Categories Grid - With Images */}
        <section className="py-16 md:py-20 bg-white" aria-labelledby="main-categories">
          <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
            <div className="text-center mb-12">
              <h2 id="main-categories" className="text-3xl md:text-4xl font-bold text-gray-900 mb-4">
                Vehicle Warranty Categories
              </h2>
              <p className="text-gray-600 max-w-2xl mx-auto text-lg">
                Choose your vehicle type to explore our comprehensive warranty options
              </p>
            </div>
            
            <div className="grid grid-cols-1 md:grid-cols-2 gap-8">
              {defaultCategories.map((category) => {
                const IconComponent = category.icon;
                return (
                  <Link 
                    key={category.id}
                    to={`/${category.slug}`}
                    className="group bg-white rounded-2xl shadow-md hover:shadow-xl transition-all duration-300 border border-gray-100 hover:border-orange-200 overflow-hidden"
                  >
                    <div className="grid md:grid-cols-[30%_1fr] items-center">
                      {/* Image - Max 30% */}
                      <div className="h-48 md:h-full overflow-hidden">
                        <img 
                          src={category.image} 
                          alt={category.brand_name}
                          className="w-full h-full object-cover border-r-2 border-gray-100 group-hover:scale-105 transition-transform duration-300"
                          loading="lazy"
                        />
                      </div>
                      {/* Content */}
                      <div className="p-6 md:p-8">
                        <div className="flex items-center gap-3 mb-4">
                          <div className="w-12 h-12 rounded-full bg-gradient-to-br from-orange-100 to-orange-50 flex items-center justify-center group-hover:scale-110 transition-transform">
                            <IconComponent className="h-6 w-6 text-orange-500" />
                          </div>
                          <h3 className="text-xl md:text-2xl font-bold text-gray-900">{category.brand_name}</h3>
                        </div>
                        <p className="text-gray-600 mb-6">{category.description}</p>
                        <div className="flex items-center justify-between">
                          <span className="inline-flex items-center text-orange-500 font-semibold group-hover:gap-2 transition-all">
                            View Options <ChevronRight className="h-5 w-5 ml-1" />
                          </span>
                          <div className="flex items-center gap-1 text-green-600 text-sm">
                            <Check className="h-4 w-4" />
                            <span>Instant Quote</span>
                          </div>
                        </div>
                      </div>
                    </div>
                  </Link>
                );
              })}
            </div>
          </div>
        </section>

        {/* Why Choose Us Section */}
        <section className="py-16 md:py-20 bg-gradient-to-br from-gray-50 to-white" aria-labelledby="why-choose">
          <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
            <div className="text-center mb-12">
              <h2 id="why-choose" className="text-3xl md:text-4xl font-bold text-gray-900 mb-4">
                Why Choose Buy A Warranty?
              </h2>
              <p className="text-gray-600 max-w-2xl mx-auto">
                Trusted by thousands of UK drivers with comprehensive protection and fast claims
              </p>
            </div>
            
            <div className="grid grid-cols-1 md:grid-cols-3 gap-8">
              <div className="bg-white rounded-xl p-8 shadow-md border border-gray-100">
                <div className="w-16 h-16 rounded-full bg-green-100 flex items-center justify-center mb-6">
                  <Shield className="h-8 w-8 text-green-600" />
                </div>
                <h3 className="text-xl font-bold text-gray-900 mb-3">Comprehensive Cover</h3>
                <p className="text-gray-600">Protection for over 8,000 mechanical and electrical components across all vehicle types.</p>
              </div>
              <div className="bg-white rounded-xl p-8 shadow-md border border-gray-100">
                <div className="w-16 h-16 rounded-full bg-orange-100 flex items-center justify-center mb-6">
                  <Award className="h-8 w-8 text-orange-600" />
                </div>
                <h3 className="text-xl font-bold text-gray-900 mb-3">Trusted Provider</h3>
                <p className="text-gray-600">Rated Excellent on Trustpilot with thousands of happy customers across the UK.</p>
              </div>
              <div className="bg-white rounded-xl p-8 shadow-md border border-gray-100">
                <div className="w-16 h-16 rounded-full bg-blue-100 flex items-center justify-center mb-6">
                  <MessageCircle className="h-8 w-8 text-blue-600" />
                </div>
                <h3 className="text-xl font-bold text-gray-900 mb-3">UK-Based Support</h3>
                <p className="text-gray-600">Friendly, expert support from our UK team when you need it most.</p>
              </div>
            </div>
          </div>
        </section>

        {/* Brand-Specific Warranties Section - Always show with BMW & Mercedes */}
        <section className="py-16 md:py-20 bg-white" aria-labelledby="brand-warranties">
          <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
            <div className="text-center mb-12">
              <h2 id="brand-warranties" className="text-3xl md:text-4xl font-bold text-gray-900 mb-4">
                Brand-Specific Warranties
              </h2>
              <p className="text-gray-600 max-w-2xl mx-auto">
                Tailored warranty plans for specific vehicle brands with expert coverage
              </p>
            </div>
            
            <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-4 xl:grid-cols-5 gap-4 md:gap-6">
              {/* BMW Brand Card */}
              <Link 
                to="/warranty-types/bmw"
                className="group p-4 md:p-6 bg-white rounded-xl shadow-md hover:shadow-xl transition-all duration-300 border border-gray-100 hover:border-orange-200 flex flex-col items-center text-center"
              >
                <div className="w-16 h-16 rounded-full bg-gray-50 flex items-center justify-center mb-3 p-2 group-hover:scale-110 transition-transform border-2 border-gray-100">
                  <img 
                    src="https://upload.wikimedia.org/wikipedia/commons/thumb/4/44/BMW.svg/800px-BMW.svg.png" 
                    alt="BMW logo"
                    className="max-h-12 max-w-12 object-contain"
                    loading="lazy"
                  />
                </div>
                <h3 className="text-sm md:text-base font-bold text-gray-900 mb-1">BMW</h3>
                <span className="inline-flex items-center text-orange-500 font-medium text-xs md:text-sm group-hover:gap-1 transition-all">
                  View <ChevronRight className="h-3 w-3 ml-0.5" />
                </span>
              </Link>

              {/* Mercedes Brand Card */}
              <Link 
                to="/warranty-types/mercedes"
                className="group p-4 md:p-6 bg-white rounded-xl shadow-md hover:shadow-xl transition-all duration-300 border border-gray-100 hover:border-orange-200 flex flex-col items-center text-center"
              >
                <div className="w-16 h-16 rounded-full bg-gray-50 flex items-center justify-center mb-3 p-2 group-hover:scale-110 transition-transform border-2 border-gray-100">
                  <img 
                    src="https://upload.wikimedia.org/wikipedia/commons/thumb/9/90/Mercedes-Logo.svg/800px-Mercedes-Logo.svg.png" 
                    alt="Mercedes-Benz logo"
                    className="max-h-12 max-w-12 object-contain"
                    loading="lazy"
                  />
                </div>
                <h3 className="text-sm md:text-base font-bold text-gray-900 mb-1">Mercedes-Benz</h3>
                <span className="inline-flex items-center text-orange-500 font-medium text-xs md:text-sm group-hover:gap-1 transition-all">
                  View <ChevronRight className="h-3 w-3 ml-0.5" />
                </span>
              </Link>

              {/* Vans Brand Card */}
              <Link 
                to="/warranty-types/vans"
                className="group p-4 md:p-6 bg-white rounded-xl shadow-md hover:shadow-xl transition-all duration-300 border border-gray-100 hover:border-orange-200 flex flex-col items-center text-center"
              >
                <div className="w-16 h-16 rounded-full bg-gradient-to-br from-orange-100 to-orange-50 flex items-center justify-center mb-3 group-hover:scale-110 transition-transform border-2 border-orange-100">
                  <Truck className="h-8 w-8 text-orange-500" />
                </div>
                <h3 className="text-sm md:text-base font-bold text-gray-900 mb-1">Commercial Vans</h3>
                <span className="inline-flex items-center text-orange-500 font-medium text-xs md:text-sm group-hover:gap-1 transition-all">
                  View <ChevronRight className="h-3 w-3 ml-0.5" />
                </span>
              </Link>

              {/* Honda Brand Card */}
              <Link 
                to="/warranty-types/honda"
                className="group p-4 md:p-6 bg-white rounded-xl shadow-md hover:shadow-xl transition-all duration-300 border border-gray-100 hover:border-orange-200 flex flex-col items-center text-center"
              >
                <div className="w-16 h-16 rounded-full bg-gray-50 flex items-center justify-center mb-3 p-2 group-hover:scale-110 transition-transform border-2 border-gray-100">
                  <img 
                    src="https://upload.wikimedia.org/wikipedia/commons/thumb/3/38/Honda.svg/800px-Honda.svg.png" 
                    alt="Honda logo"
                    className="max-h-12 max-w-12 object-contain"
                    loading="lazy"
                  />
                </div>
                <h3 className="text-sm md:text-base font-bold text-gray-900 mb-1">Honda</h3>
                <span className="inline-flex items-center text-orange-500 font-medium text-xs md:text-sm group-hover:gap-1 transition-all">
                  View <ChevronRight className="h-3 w-3 ml-0.5" />
                </span>
              </Link>

              {/* Toyota Brand Card */}
              <Link 
                to="/warranty-types/toyota"
                className="group p-4 md:p-6 bg-white rounded-xl shadow-md hover:shadow-xl transition-all duration-300 border border-gray-100 hover:border-orange-200 flex flex-col items-center text-center"
              >
                <div className="w-16 h-16 rounded-full bg-gray-50 flex items-center justify-center mb-3 p-2 group-hover:scale-110 transition-transform border-2 border-gray-100">
                  <img 
                    src="https://upload.wikimedia.org/wikipedia/commons/thumb/e/e7/Toyota.svg/800px-Toyota.svg.png" 
                    alt="Toyota logo"
                    className="max-h-12 max-w-12 object-contain"
                    loading="lazy"
                  />
                </div>
                <h3 className="text-sm md:text-base font-bold text-gray-900 mb-1">Toyota</h3>
                <span className="inline-flex items-center text-orange-500 font-medium text-xs md:text-sm group-hover:gap-1 transition-all">
                  View <ChevronRight className="h-3 w-3 ml-0.5" />
                </span>
              </Link>

              {/* Ford Brand Card */}
              <Link 
                to="/warranty-types/ford"
                className="group p-4 md:p-6 bg-white rounded-xl shadow-md hover:shadow-xl transition-all duration-300 border border-gray-100 hover:border-orange-200 flex flex-col items-center text-center"
              >
                <div className="w-16 h-16 rounded-full bg-gray-50 flex items-center justify-center mb-3 p-2 group-hover:scale-110 transition-transform border-2 border-gray-100">
                  <img 
                    src="https://upload.wikimedia.org/wikipedia/commons/thumb/a/a0/Ford_Motor_Company_Logo.svg/800px-Ford_Motor_Company_Logo.svg.png" 
                    alt="Ford logo"
                    className="max-h-12 max-w-12 object-contain"
                    loading="lazy"
                  />
                </div>
                <h3 className="text-sm md:text-base font-bold text-gray-900 mb-1">Ford</h3>
                <span className="inline-flex items-center text-orange-500 font-medium text-xs md:text-sm group-hover:gap-1 transition-all">
                  View <ChevronRight className="h-3 w-3 ml-0.5" />
                </span>
              </Link>

              {/* Motorbike Warranty Card */}
              <Link 
                to="/warranty-types/motorbike-motorcycle-warranty"
                className="group p-4 md:p-6 bg-white rounded-xl shadow-md hover:shadow-xl transition-all duration-300 border border-gray-100 hover:border-orange-200 flex flex-col items-center text-center"
              >
                <div className="w-16 h-16 rounded-full bg-gradient-to-br from-orange-100 to-orange-50 flex items-center justify-center mb-3 group-hover:scale-110 transition-transform border-2 border-orange-100">
                  <Bike className="h-8 w-8 text-orange-500" />
                </div>
                <h3 className="text-sm md:text-base font-bold text-gray-900 mb-1">Motorcycles</h3>
                <span className="inline-flex items-center text-orange-500 font-medium text-xs md:text-sm group-hover:gap-1 transition-all">
                  View <ChevronRight className="h-3 w-3 ml-0.5" />
                </span>
              </Link>

              {/* Dynamic Pages from Database - exclude hardcoded brands */}
              {dynamicPages
                .filter((page) => page.brand_name.toLowerCase() !== 'bmw' && page.brand_name.toLowerCase() !== 'mercedes-benz' && page.brand_name.toLowerCase() !== 'mercedes' && page.brand_name.toLowerCase() !== 'honda' && page.brand_name.toLowerCase() !== 'toyota' && page.brand_name.toLowerCase() !== 'ford')
                .map((page) => {
                const IconComponent = getIconForPageType(page.page_type, page.brand_name);
                return (
                  <Link 
                    key={page.id}
                    to={`/${page.slug}`}
                    className="group p-4 md:p-6 bg-white rounded-xl shadow-md hover:shadow-xl transition-all duration-300 border border-gray-100 hover:border-orange-200 flex flex-col items-center text-center"
                  >
                    {page.brand_logo_url ? (
                      <div className="w-16 h-16 rounded-full bg-gray-50 flex items-center justify-center mb-3 p-2 group-hover:scale-110 transition-transform border-2 border-gray-100">
                        <img 
                          src={page.brand_logo_url} 
                          alt={`${page.brand_name} logo`}
                          className="max-h-12 max-w-12 object-contain"
                          loading="lazy"
                        />
                      </div>
                    ) : (
                      <div className="w-16 h-16 rounded-full bg-gradient-to-br from-orange-100 to-orange-50 flex items-center justify-center mb-3 group-hover:scale-110 transition-transform border-2 border-orange-100">
                        <IconComponent className="h-8 w-8 text-orange-500" />
                      </div>
                    )}
                    <h3 className="text-sm md:text-base font-bold text-gray-900 mb-1">{page.brand_name}</h3>
                    <span className="inline-flex items-center text-orange-500 font-medium text-xs md:text-sm group-hover:gap-1 transition-all">
                      View <ChevronRight className="h-3 w-3 ml-0.5" />
                    </span>
                  </Link>
                );
              })}
            </div>
          </div>
        </section>

        {/* Coverage Table */}
        <section className="py-16 bg-gradient-to-br from-blue-50 via-white to-orange-50" aria-labelledby="coverage-comparison">
          <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
            <div className="max-w-5xl mx-auto">
              <h2 id="coverage-comparison" className="text-3xl md:text-4xl font-bold text-center mb-8">
                What's Covered Across All Plans?
              </h2>
              
              <div className="overflow-x-auto mb-8">
                <table className="w-full border-collapse bg-white rounded-lg overflow-hidden shadow-md border-2 border-gray-200">
                  <thead>
                    <tr className="bg-primary text-white">
                      <th className="p-4 text-left border-2 border-gray-300">Component Category</th>
                      <th className="p-4 text-center border-2 border-gray-300">Covered</th>
                      <th className="p-4 text-left border-2 border-gray-300">Examples</th>
                    </tr>
                  </thead>
                  <tbody>
                    <tr className="border-b-2 border-gray-200">
                      <td className="p-4 font-semibold border-2 border-gray-200">Engine</td>
                      <td className="p-4 text-center text-green-600 font-bold border-2 border-gray-200">✓</td>
                      <td className="p-4 border-2 border-gray-200">Pistons, valves, timing chains, oil pumps</td>
                    </tr>
                    <tr className="border-b-2 border-gray-200 bg-gray-50">
                      <td className="p-4 font-semibold border-2 border-gray-200">Gearbox</td>
                      <td className="p-4 text-center text-green-600 font-bold border-2 border-gray-200">✓</td>
                      <td className="p-4 border-2 border-gray-200">Gears, bearings, syncros, shafts</td>
                    </tr>
                    <tr className="border-b-2 border-gray-200">
                      <td className="p-4 font-semibold border-2 border-gray-200">Electrical</td>
                      <td className="p-4 text-center text-green-600 font-bold border-2 border-gray-200">✓</td>
                      <td className="p-4 border-2 border-gray-200">Alternator, starter motor, ECU, sensors</td>
                    </tr>
                    <tr className="border-b-2 border-gray-200 bg-gray-50">
                      <td className="p-4 font-semibold border-2 border-gray-200">Fuel System</td>
                      <td className="p-4 text-center text-green-600 font-bold border-2 border-gray-200">✓</td>
                      <td className="p-4 border-2 border-gray-200">Fuel pump, injectors, fuel rail</td>
                    </tr>
                    <tr>
                      <td className="p-4 font-semibold border-2 border-gray-200">Cooling System</td>
                      <td className="p-4 text-center text-green-600 font-bold border-2 border-gray-200">✓</td>
                      <td className="p-4 border-2 border-gray-200">Water pump, thermostat, radiator</td>
                    </tr>
                  </tbody>
                </table>
              </div>

              <p className="text-center text-gray-700">
                <strong>See the full list:</strong>{' '}
                <Link to="/what-is-covered/" className="text-primary underline hover:text-primary/80 font-medium">
                  View all 8,000+ covered components
                </Link>
              </p>
            </div>
          </div>
        </section>

        {/* CTA Section */}
        <section className="py-16 md:py-20 bg-gradient-to-br from-gray-900 to-gray-800 text-white">
          <div className="max-w-4xl mx-auto px-4 sm:px-6 lg:px-8 text-center">
            <h2 className="text-3xl md:text-4xl font-bold mb-6 text-white">
              Ready to Protect Your Vehicle?
            </h2>
            <p className="text-lg text-white mb-8">
              Get an instant quote in under 60 seconds and find the perfect warranty for your vehicle.
            </p>
            <div className="flex flex-col sm:flex-row gap-4 justify-center">
              <Button 
                onClick={() => navigate('/')} 
                size="lg"
                className="bg-orange-500 hover:bg-orange-600 text-white font-bold px-8 py-6 text-lg rounded-lg shadow-lg hover:shadow-xl transition-all animate-cta-enhanced"
              >
                Get Your Free Quote <ArrowRight className="ml-2 h-5 w-5" />
              </Button>
              <a 
                href="tel:03302295040"
                className="inline-flex items-center justify-center gap-2 bg-white/10 hover:bg-white/20 text-white font-semibold px-8 py-4 text-lg rounded-lg transition-all border border-white/20"
              >
                <Phone className="h-5 w-5" />
                0330 229 5040
              </a>
            </div>
          </div>
        </section>

        {/* Trustpilot Section */}
        <section className="py-12 bg-white">
          <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
            <div className="flex justify-center">
              <a 
                href="https://uk.trustpilot.com/review/buyawarranty.co.uk" 
                target="_blank" 
                rel="noopener noreferrer"
                className="flex items-center gap-4 hover:opacity-80 transition-opacity"
              >
                <OptimizedImage
                  src={trustpilotLogo}
                  alt="Trustpilot Reviews"
                  className="h-10 md:h-12 w-auto"
                  priority={false}
                  width={200}
                  height={50}
                />
                <div className="flex items-center gap-1">
                  {[...Array(5)].map((_, i) => (
                    <Star key={i} className="h-5 w-5 fill-green-500 text-green-500" />
                  ))}
                </div>
                <span className="text-gray-600 font-medium">Rated Excellent</span>
              </a>
            </div>
          </div>
        </section>

        {/* Footer is rendered globally in App.tsx via ConditionalFooter */}
      </div>
    </>
  );
};

export default WarrantyTypes;