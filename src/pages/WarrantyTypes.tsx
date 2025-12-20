import React, { useState, useEffect } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { Helmet } from 'react-helmet-async';
import { Button } from '@/components/ui/button';
import { Car, Truck, Shield, ArrowRight, Phone, Menu, Battery, Bike, Award, ChevronRight } from 'lucide-react';
import { Sheet, SheetContent, SheetTrigger } from '@/components/ui/sheet';
import { useIsMobile } from '@/hooks/use-mobile';
import { supabase } from '@/integrations/supabase/client';
import Footer from '@/components/Footer';
import { OptimizedImage } from '@/components/OptimizedImage';
import trustpilotLogo from '@/assets/trustpilot-logo.webp';

interface DynamicLandingPage {
  id: string;
  slug: string;
  brand_name: string;
  brand_logo_url: string | null;
  meta_description: string | null;
  h1_headline: string;
  page_type: string | null;
}

// Default warranty categories when no dynamic pages exist
const defaultCategories = [
  {
    id: 'car-warranty',
    slug: 'car-extended-warranty',
    brand_name: 'Car Extended Warranty',
    icon: Car,
    description: 'Comprehensive protection for all car makes and models.',
  },
  {
    id: 'van-warranty',
    slug: 'van-warranty',
    brand_name: 'Van Warranty',
    icon: Truck,
    description: 'Tailored cover for commercial and personal vans.',
  },
  {
    id: 'electric-warranty',
    slug: 'ev-warranty',
    brand_name: 'Electric Vehicle Warranty',
    icon: Battery,
    description: 'Specialist protection for hybrid and electric vehicles.',
  },
  {
    id: 'motorcycle-warranty',
    slug: 'motorcycle-warranty',
    brand_name: 'Motorcycle Warranty',
    icon: Bike,
    description: 'Reliable cover for motorcycles and scooters.',
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

      <div className="min-h-screen bg-gradient-to-br from-orange-50 via-white to-gray-50">
        {/* Header */}
        <header className="sticky top-0 z-50 bg-white/95 backdrop-blur-sm shadow-sm">
          <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-4">
            <div className="flex justify-between items-center">
              <Link to="/" className="flex items-center gap-3">
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
                <a href="tel:0300456576" className="flex items-center gap-2 text-orange-500 font-semibold">
                  <Phone className="h-4 w-4" />
                  0300 456 576
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
                    <a href="tel:0300456576" className="flex items-center gap-2 text-lg font-medium text-orange-500 py-2">
                      <Phone className="h-5 w-5" />
                      0300 456 576
                    </a>
                  </nav>
                </SheetContent>
              </Sheet>
            </div>
          </div>
        </header>

        {/* Hero Section */}
        <section className="py-16 md:py-24 bg-gradient-to-br from-orange-500 via-orange-400 to-orange-600 text-white">
          <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 text-center">
            <div className="flex justify-center mb-6">
              <Shield className="h-16 w-16 text-white/90" />
            </div>
            <h1 className="text-4xl md:text-5xl lg:text-6xl font-bold mb-6">
              Warranty Types
            </h1>
            <h2 className="text-xl md:text-2xl font-medium text-white/90 mb-8 max-w-3xl mx-auto">
              Explore Our Vehicle Warranty Options
            </h2>
            <p className="text-lg text-white/80 max-w-2xl mx-auto mb-8">
              Welcome to our central hub for all warranty types. Whether you drive a car, van, or specific brand, 
              we have tailored protection plans designed for your vehicle's unique needs.
            </p>
            <Button 
              onClick={() => navigate('/')} 
              size="lg"
              className="bg-white text-orange-500 hover:bg-gray-100 font-semibold px-8 py-6 text-lg rounded-full shadow-lg hover:shadow-xl transition-all"
            >
              Get Your Quote <ArrowRight className="ml-2 h-5 w-5" />
            </Button>
          </div>
        </section>

        {/* Main Categories Grid */}
        <section className="py-16 md:py-20" aria-labelledby="main-categories">
          <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
            <div className="text-center mb-12">
              <h2 id="main-categories" className="text-3xl md:text-4xl font-bold text-gray-900 mb-4">
                Vehicle Warranty Categories
              </h2>
              <p className="text-gray-600 max-w-2xl mx-auto">
                Choose your vehicle type to explore our comprehensive warranty options
              </p>
            </div>
            
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
              {defaultCategories.map((category) => {
                const IconComponent = category.icon;
                return (
                  <Link 
                    key={category.id}
                    to={`/${category.slug}`}
                    className="group p-8 bg-white rounded-2xl shadow-md hover:shadow-xl transition-all duration-300 border border-gray-100 hover:border-orange-200 flex flex-col items-center text-center"
                  >
                    <div className="w-20 h-20 rounded-full bg-gradient-to-br from-orange-100 to-orange-50 flex items-center justify-center mb-6 group-hover:scale-110 transition-transform">
                      <IconComponent className="h-10 w-10 text-orange-500" />
                    </div>
                    <h3 className="text-xl font-bold text-gray-900 mb-3">{category.brand_name}</h3>
                    <p className="text-gray-600 mb-6 flex-grow">{category.description}</p>
                    <span className="inline-flex items-center text-orange-500 font-semibold group-hover:gap-2 transition-all">
                      View Options <ChevronRight className="h-4 w-4 ml-1" />
                    </span>
                  </Link>
                );
              })}
            </div>
          </div>
        </section>

        {/* Dynamic Brand Pages Grid */}
        {dynamicPages.length > 0 && (
          <section className="py-16 md:py-20 bg-gradient-to-br from-gray-50 to-white" aria-labelledby="brand-warranties">
            <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
              <div className="text-center mb-12">
                <h2 id="brand-warranties" className="text-3xl md:text-4xl font-bold text-gray-900 mb-4">
                  Brand-Specific Warranties
                </h2>
                <p className="text-gray-600 max-w-2xl mx-auto">
                  Tailored warranty plans for specific vehicle brands with expert coverage
                </p>
              </div>
              
              <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-6">
                {dynamicPages.map((page) => {
                  const IconComponent = getIconForPageType(page.page_type, page.brand_name);
                  return (
                    <Link 
                      key={page.id}
                      to={`/${page.slug}`}
                      className="group p-6 bg-white rounded-xl shadow-md hover:shadow-xl transition-all duration-300 border border-gray-100 hover:border-orange-200 flex flex-col items-center text-center"
                    >
                      {page.brand_logo_url ? (
                        <div className="w-20 h-20 rounded-full bg-gray-50 flex items-center justify-center mb-4 p-3 group-hover:scale-110 transition-transform">
                          <img 
                            src={page.brand_logo_url} 
                            alt={`${page.brand_name} logo`}
                            className="max-h-14 max-w-14 object-contain"
                            loading="lazy"
                          />
                        </div>
                      ) : (
                        <div className="w-20 h-20 rounded-full bg-gradient-to-br from-orange-100 to-orange-50 flex items-center justify-center mb-4 group-hover:scale-110 transition-transform">
                          <IconComponent className="h-10 w-10 text-orange-500" />
                        </div>
                      )}
                      <h3 className="text-lg font-bold text-gray-900 mb-2">{page.brand_name}</h3>
                      <p className="text-sm text-gray-600 mb-4 flex-grow line-clamp-2">
                        {page.meta_description || `Protect your ${page.brand_name} with a tailored warranty plan.`}
                      </p>
                      <span className="inline-flex items-center text-orange-500 font-semibold text-sm group-hover:gap-2 transition-all">
                        View {page.brand_name} Warranty <ChevronRight className="h-4 w-4 ml-1" />
                      </span>
                    </Link>
                  );
                })}
              </div>
            </div>
          </section>
        )}

        {/* Why Choose Us Section */}
        <section className="py-16 md:py-20 bg-white" aria-labelledby="why-choose">
          <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
            <div className="text-center mb-12">
              <h2 id="why-choose" className="text-3xl md:text-4xl font-bold text-gray-900 mb-4">
                Why Choose Buy A Warranty?
              </h2>
            </div>
            
            <div className="grid grid-cols-1 md:grid-cols-3 gap-8">
              <div className="text-center p-6">
                <div className="w-16 h-16 rounded-full bg-green-100 flex items-center justify-center mx-auto mb-4">
                  <Shield className="h-8 w-8 text-green-600" />
                </div>
                <h3 className="text-xl font-bold text-gray-900 mb-2">Comprehensive Cover</h3>
                <p className="text-gray-600">Protection for over 8,000 mechanical and electrical components</p>
              </div>
              <div className="text-center p-6">
                <div className="w-16 h-16 rounded-full bg-orange-100 flex items-center justify-center mx-auto mb-4">
                  <Award className="h-8 w-8 text-orange-600" />
                </div>
                <h3 className="text-xl font-bold text-gray-900 mb-2">Trusted Provider</h3>
                <p className="text-gray-600">Rated Excellent on Trustpilot with thousands of happy customers</p>
              </div>
              <div className="text-center p-6">
                <div className="w-16 h-16 rounded-full bg-blue-100 flex items-center justify-center mx-auto mb-4">
                  <Phone className="h-8 w-8 text-blue-600" />
                </div>
                <h3 className="text-xl font-bold text-gray-900 mb-2">UK-Based Support</h3>
                <p className="text-gray-600">Friendly, expert support from our UK team when you need it</p>
              </div>
            </div>
          </div>
        </section>

        {/* CTA Section */}
        <section className="py-16 md:py-20 bg-gradient-to-br from-gray-900 to-gray-800 text-white">
          <div className="max-w-4xl mx-auto px-4 sm:px-6 lg:px-8 text-center">
            <h2 className="text-3xl md:text-4xl font-bold mb-6">
              Ready to Protect Your Vehicle?
            </h2>
            <p className="text-lg text-gray-300 mb-8">
              Get an instant quote and find the perfect warranty for your vehicle today.
            </p>
            <div className="flex flex-col sm:flex-row gap-4 justify-center">
              <Button 
                onClick={() => navigate('/')} 
                size="lg"
                className="bg-orange-500 hover:bg-orange-600 text-white font-semibold px-8 py-6 text-lg rounded-full shadow-lg hover:shadow-xl transition-all"
              >
                Get Your Free Quote <ArrowRight className="ml-2 h-5 w-5" />
              </Button>
              <a 
                href="tel:0300456576"
                className="inline-flex items-center justify-center gap-2 bg-white/10 hover:bg-white/20 text-white font-semibold px-8 py-4 text-lg rounded-full transition-all border border-white/20"
              >
                <Phone className="h-5 w-5" />
                0300 456 576
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
                  className="h-8 w-auto"
                  loading="lazy"
                />
                <span className="text-gray-600 font-medium">Rated Excellent</span>
              </a>
            </div>
          </div>
        </section>

        <Footer />
      </div>
    </>
  );
};

export default WarrantyTypes;
