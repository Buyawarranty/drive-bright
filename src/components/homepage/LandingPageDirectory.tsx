import React, { useState, useEffect, useMemo } from 'react';
import { Link } from 'react-router-dom';
import { Search, Car, ArrowRight, Shield } from 'lucide-react';
import { Input } from '@/components/ui/input';
import { supabase } from '@/integrations/supabase/client';

interface LandingPage {
  id: string;
  slug: string;
  brand_name: string;
  h1_headline: string;
  meta_description: string;
  featured_image_url: string | null;
  status: string;
  is_indexable: boolean;
  show_on_homepage: boolean;
}

const LandingPageDirectory: React.FC = () => {
  const [pages, setPages] = useState<LandingPage[]>([]);
  const [searchTerm, setSearchTerm] = useState('');
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const fetchPages = async () => {
      try {
        const { data, error } = await supabase
          .from('landing_pages')
          .select('id, slug, brand_name, h1_headline, meta_description, featured_image_url, status, is_indexable, show_on_homepage')
          .eq('status', 'published')
          .eq('is_indexable', true)
          .eq('show_on_homepage', true)
          .order('brand_name', { ascending: true });

        if (error) throw error;
        setPages(data || []);
      } catch (error) {
        console.error('Error fetching landing pages:', error);
      } finally {
        setLoading(false);
      }
    };

    fetchPages();
  }, []);

  const filteredPages = useMemo(() => {
    if (!searchTerm.trim()) return pages;
    const term = searchTerm.toLowerCase();
    return pages.filter(page => 
      page.brand_name.toLowerCase().includes(term) ||
      page.h1_headline.toLowerCase().includes(term) ||
      page.meta_description?.toLowerCase().includes(term)
    );
  }, [pages, searchTerm]);

  // Don't render if no pages
  if (!loading && pages.length === 0) {
    return null;
  }

  return (
    <section 
      className="py-12 md:py-16 bg-gradient-to-b from-white to-gray-50"
      aria-labelledby="warranty-directory-heading"
    >
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
        {/* Section Header */}
        <div className="text-center mb-8 md:mb-12">
          <div className="flex items-center justify-center gap-2 mb-4">
            <Shield className="w-8 h-8 text-brand-orange" />
            <span className="text-brand-orange font-semibold uppercase tracking-wide text-sm">
              Browse By Manufacturer
            </span>
          </div>
          <h2 
            id="warranty-directory-heading"
            className="text-3xl md:text-4xl font-bold text-brand-deep-blue mb-4"
          >
            Extended Warranty by <span className="text-brand-orange">Car Brand</span>
          </h2>
          <p className="text-lg text-muted-foreground max-w-2xl mx-auto">
            Find the perfect extended warranty for your vehicle. Select your car manufacturer below 
            to see coverage options, pricing, and benefits tailored to your brand.
          </p>
        </div>

        {/* Search Bar */}
        <div className="max-w-md mx-auto mb-8">
          <div className="relative">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-5 h-5 text-muted-foreground" />
            <Input
              type="search"
              placeholder="Search for your car brand (e.g., BMW, Mercedes)..."
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              className="pl-10 pr-4 py-3 text-base border-2 border-gray-200 focus:border-brand-orange rounded-lg"
              aria-label="Search car brands for extended warranty"
            />
          </div>
        </div>

        {/* Loading State */}
        {loading && (
          <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-4 md:gap-6">
            {[...Array(8)].map((_, i) => (
              <div key={i} className="animate-pulse bg-gray-200 rounded-xl h-32" />
            ))}
          </div>
        )}

        {/* Directory Grid */}
        {!loading && filteredPages.length > 0 && (
          <nav aria-label="Car brand warranty directory">
            <ul className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-4 md:gap-6 list-none p-0">
              {filteredPages.map((page) => (
                <li key={page.id}>
                  <Link
                    to={`/${page.slug}/`}
                    className="group block bg-white rounded-xl border-2 border-gray-100 hover:border-brand-orange hover:shadow-lg transition-all duration-300 p-4 md:p-6 text-center"
                    title={`${page.brand_name} Extended Warranty - Get a Quote`}
                  >
                    {/* Brand Icon/Image */}
                    <div className="w-12 h-12 md:w-16 md:h-16 bg-gradient-to-br from-brand-orange/10 to-brand-deep-blue/10 rounded-full flex items-center justify-center mx-auto mb-3 group-hover:scale-110 transition-transform">
                      {page.featured_image_url ? (
                        <img 
                          src={page.featured_image_url} 
                          alt={`${page.brand_name} logo`}
                          className="w-8 h-8 md:w-10 md:h-10 object-contain"
                          loading="lazy"
                        />
                      ) : (
                        <Car className="w-6 h-6 md:w-8 md:h-8 text-brand-orange" />
                      )}
                    </div>
                    
                    {/* Brand Name - SEO Anchor Text */}
                    <h3 className="font-bold text-brand-deep-blue group-hover:text-brand-orange transition-colors text-sm md:text-base">
                      {page.brand_name} Extended Warranty
                    </h3>
                    
                    {/* Arrow indicator */}
                    <div className="mt-2 opacity-0 group-hover:opacity-100 transition-opacity">
                      <ArrowRight className="w-4 h-4 text-brand-orange mx-auto" />
                    </div>
                  </Link>
                </li>
              ))}
            </ul>
          </nav>
        )}

        {/* No Results */}
        {!loading && searchTerm && filteredPages.length === 0 && (
          <div className="text-center py-8">
            <Car className="w-12 h-12 text-muted-foreground mx-auto mb-4" />
            <p className="text-lg text-muted-foreground">
              No warranty pages found for "{searchTerm}".
            </p>
            <p className="text-sm text-muted-foreground mt-2">
              Try searching for a different brand, or{' '}
              <button 
                onClick={() => setSearchTerm('')}
                className="text-brand-orange hover:underline font-medium"
              >
                view all brands
              </button>
            </p>
          </div>
        )}

        {/* SEO-friendly footer text */}
        {!loading && pages.length > 0 && (
          <div className="mt-10 text-center">
            <p className="text-sm text-muted-foreground max-w-4xl mx-auto">
              We provide extended car warranties for all major vehicle manufacturers, including BMW, Mercedes-Benz, 
              Audi, Volkswagen, Ford, Toyota, Honda, Nissan, Land Rover, Jaguar, Kia, Hyundai, Peugeot, Citroën, 
              Volvo, and many more. Every warranty plan is specifically designed for your make and model, delivering 
              comprehensive protection for mechanical and electrical components. Whether you drive a hybrid saloon, 
              a family SUV, or an electric vehicle, our cover ensures peace of mind with UK-wide support and transparent pricing.
            </p>
          </div>
        )}
      </div>
    </section>
  );
};

export default LandingPageDirectory;
