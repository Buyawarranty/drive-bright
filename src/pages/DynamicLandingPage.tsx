import React, { useState, useEffect } from 'react';
import { useParams, useNavigate, useSearchParams } from 'react-router-dom';
import { SEOHead } from '@/components/SEOHead';
import { OrganizationSchema } from '@/components/schema/OrganizationSchema';
import { ReviewSchema } from '@/components/schema/ReviewSchema';
import { WebPageSchema } from '@/components/schema/WebPageSchema';
import { FAQSchema } from '@/components/schema/FAQSchema';
import { ProductSchema } from '@/components/schema/ProductSchema';
import { BreadcrumbSchema } from '@/components/schema/BreadcrumbSchema';
import { LocalBusinessSchema } from '@/components/schema/LocalBusinessSchema';
import { supabase } from '@/integrations/supabase/client';
import { saveWithTimestamp } from '@/utils/localStorage';
import NotFound from './NotFound';
import BrandLandingPage from '@/components/BrandLandingPage';

interface LandingPageData {
  id: string;
  slug: string;
  brand_name: string;
  h1_headline: string;
  meta_title: string;
  meta_description: string;
  focus_keyword: string | null;
  secondary_keywords: string[] | null;
  og_title: string | null;
  og_description: string | null;
  og_image_url: string | null;
  featured_image_url: string | null;
  brand_logo_url: string | null;
  hero_content: {
    subheadline?: string;
    description?: string;
    benefits?: string[];
    ctaText?: string;
  } | null;
  features_content: {
    title?: string;
    items?: Array<{ icon?: string; title: string; description: string }>;
  } | null;
  coverage_content: {
    title?: string;
    sections?: Array<{ title: string; items: string[] }>;
  } | null;
  pricing_content: {
    title?: string;
    subtitle?: string;
  } | null;
  testimonials_content: {
    title?: string;
    items?: Array<{ name: string; text: string; rating: number }>;
  } | null;
  faqs: Array<{ question: string; answer: string }> | null;
  internal_links: Array<{ text: string; url: string }> | null;
  supporting_images: Array<{ url: string; alt: string; caption?: string }> | null;
  include_organization_schema: boolean | null;
  include_local_business_schema: boolean | null;
  include_product_schema: boolean | null;
  include_faq_schema: boolean | null;
  include_review_schema: boolean | null;
  include_breadcrumb_schema: boolean | null;
  is_indexable: boolean | null;
  robots_directive: string | null;
  local_business_name: string | null;
  local_business_phone: string | null;
  local_business_email: string | null;
  local_business_address: {
    streetAddress?: string;
    addressLocality?: string;
    addressRegion?: string;
    postalCode?: string;
    addressCountry?: string;
  } | null;
  local_business_geo: {
    latitude?: number;
    longitude?: number;
  } | null;
  status: string;
  show_in_main_nav: boolean | null;
  show_in_footer: boolean | null;
  show_on_homepage: boolean | null;
}

const DynamicLandingPage: React.FC = () => {
  const { slug, brand } = useParams<{ slug?: string; brand?: string }>();
  const navigate = useNavigate();
  const [searchParams] = useSearchParams();
  const [page, setPage] = useState<LandingPageData | null>(null);
  const [loading, setLoading] = useState(true);
  const [notFound, setNotFound] = useState(false);

  useEffect(() => {
    const loadPage = async () => {
      // Build the full slug - handle both /warranty-types/:brand and /:slug patterns
      let fullSlug = '';
      if (brand) {
        fullSlug = `warranty-types/${brand}`;
      } else if (slug) {
        fullSlug = slug;
      }
      
      if (!fullSlug) {
        setNotFound(true);
        setLoading(false);
        return;
      }

      // Skip known routes that shouldn't be treated as landing pages
      const knownRoutes = [
        'faq', 'thank-you', 'payment-fallback', 'cart', 'widget', 'auth', 
        'admin', 'admin-dashboard', 'customer-dashboard', 'forgot-password',
        'reset-password', 'password-reset', 'quick-reset', 'setup-admin',
        'update-admin', 'admin-conversion-fire', 'terms', 'cookies', 'privacy',
        'what-is-covered', 'claims', 'make-a-claim', 'cancel-warranty',
        'contact-us', 'complaints', 'thewarrantyhub', 'warranty-plan',
        'buy-a-used-car-warranty-reliable-warranties', 'van-warranty',
        'ev-warranty', 'motorbike-repair-warranty-uk-warranties',
        'motorcycle-warranty', 'car-extended-warranty', 'used-car-warranty-uk',
        'discounts-offers', 'discount-promo-offers',
        'home', 'warranty-types/bmw-warranty', 'warranty-types/mercedes-warranty', 'warranty-types/honda-warranty', 'warranty-types/toyota-warranty', 'warranty-types/ford-warranty', 'warranty-types/kia-warranty', 'warranty-types/hyundai-warranty', 'warranty-types/ev-warranty', 'warranty-types/vans-warranty', 'warranty-types/mg-warranty', 'warranty-types/skoda-warranty', 'warranty-types/audi-warranty', 'warranty-types/nissan-warranty', 'warranty-types/peugeot-warranty', 'warranty-types/vauxhall-warranty', 'warranty-types/volvo-warranty', 'warranty-types/hybrid-warranty', 'warranty-types/phev-warranty', 'warranty-types/volkswagen-warranty', 'warranty-types/citroen-warranty', 'warranty-types/smart-warranty', 'warranty-types/porsche-warranty', 'warranty-types/alfa-romeo-warranty', 'warranty-types/lexus-warranty', 'warranty-types/dacia-warranty', 'warranty-types/jeep-warranty', 'warranty-types/subaru-warranty', 'warranty-types/ssangyong-warranty', 'warranty-types/mini-warranty', 'warranty-types/dodge-warranty', 'warranty-types/chevrolet-warranty', 'warranty-types/byd-warranty', 'warranty-types/chrysler-warranty', 'warranty-types/suzuki-warranty', 'warranty-types/infiniti-warranty', 'warranty-types/mitsubishi-warranty', 'warranty-types/cadillac-warranty'
      ];

      // Clean slug for comparison
      const cleanSlug = fullSlug.replace(/\/$/, '');
      
      if (knownRoutes.includes(cleanSlug)) {
        setNotFound(true);
        setLoading(false);
        return;
      }

      try {
        const { data, error } = await supabase
          .from('landing_pages')
          .select('*')
          .eq('slug', cleanSlug)
          .eq('status', 'published')
          .single();

        if (error || !data) {
          console.log('Landing page not found for slug:', cleanSlug);
          setNotFound(true);
        } else {
          // Type cast the JSON fields properly
          const pageData: LandingPageData = {
            ...data,
            hero_content: data.hero_content as LandingPageData['hero_content'],
            features_content: data.features_content as LandingPageData['features_content'],
            coverage_content: data.coverage_content as LandingPageData['coverage_content'],
            pricing_content: data.pricing_content as LandingPageData['pricing_content'],
            testimonials_content: data.testimonials_content as LandingPageData['testimonials_content'],
            faqs: data.faqs as unknown as LandingPageData['faqs'],
            internal_links: data.internal_links as unknown as LandingPageData['internal_links'],
            supporting_images: data.supporting_images as LandingPageData['supporting_images'],
            local_business_address: data.local_business_address as LandingPageData['local_business_address'],
            local_business_geo: data.local_business_geo as LandingPageData['local_business_geo'],
          };
          
          setPage(pageData);
          
          // Increment view count asynchronously
          supabase
            .from('landing_pages')
            .update({ view_count: (data.view_count || 0) + 1 })
            .eq('id', data.id)
            .then();
        }
      } catch (error) {
        console.error('Error loading landing page:', error);
        setNotFound(true);
      } finally {
        setLoading(false);
      }
    };

    loadPage();
  }, [slug]);

  // Show loading state
  if (loading) {
    return (
      <div className="flex items-center justify-center min-h-screen">
        <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary"></div>
      </div>
    );
  }

  // Return NotFound for non-existent pages
  if (notFound || !page) {
    return <NotFound />;
  }

  const canonicalUrl = `https://buyawarranty.co.uk/${page.slug}/`;

  // Handle registration form submission - navigate to homepage step 2
  // Uses saveWithTimestamp to match Index.tsx state restoration logic
  const handleRegistrationSubmit = (vehicleData: any) => {
    console.log('🚀 Landing page registration submit:', vehicleData);
    
    // Save vehicle data to localStorage with timestamps (matches Index.tsx format)
    saveWithTimestamp('buyawarranty_vehicleData', JSON.stringify(vehicleData));
    saveWithTimestamp('buyawarranty_formData', JSON.stringify(vehicleData));
    saveWithTimestamp('buyawarranty_currentStep', '2');
    
    // Also save the warranty journey state for full compatibility
    const journeyState = {
      vehicleData,
      formData: vehicleData,
      currentStep: 2,
      selectedPlan: null
    };
    saveWithTimestamp('warrantyJourneyState', JSON.stringify(journeyState));
    
    // Store landing page referrer so back button returns here
    sessionStorage.setItem('buyawarranty_landing_referrer', window.location.pathname);
    // Navigate to homepage with step 2
    navigate('/?step=2');
    window.scrollTo({ top: 0, behavior: 'smooth' });
  };

  return (
    <>
      {/* SEO Head with unique OG tags - fully customizable */}
      <SEOHead
        title={page.meta_title}
        description={page.meta_description}
        keywords={page.focus_keyword || undefined}
        ogTitle={page.og_title || page.meta_title}
        ogDescription={page.og_description || page.meta_description}
        ogImage={page.og_image_url || 'https://buyawarranty.co.uk/lovable-uploads/53652a24-3961-4346-bf9d-6588ef727aeb.png'}
        canonical={canonicalUrl}
        geoRegion="GB"
        geoPlacename="United Kingdom"
      />

      {/* Indexing control */}
      {!page.is_indexable && (
        <meta name="robots" content="noindex, nofollow" />
      )}

      {/* Schema Markup - all configurable */}
      {page.include_organization_schema && <OrganizationSchema />}
      {page.include_review_schema && <ReviewSchema />}
      {page.include_local_business_schema && (
        <LocalBusinessSchema
          name={page.local_business_name || 'Buy A Warranty'}
          telephone={page.local_business_phone || '0330 229 5040'}
          email={page.local_business_email || 'support@buyawarranty.co.uk'}
          address={page.local_business_address || {
            streetAddress: '71-75 Shelton Street',
            addressLocality: 'London',
            addressRegion: 'Greater London',
            postalCode: 'WC2H 9JQ',
            addressCountry: 'GB'
          }}
          geo={page.local_business_geo || {
            latitude: 51.5142,
            longitude: -0.1267
          }}
        />
      )}
      <WebPageSchema 
        name={page.h1_headline}
        description={page.meta_description}
        url={canonicalUrl}
      />
      {page.include_faq_schema && page.faqs && page.faqs.length > 0 && (
        <FAQSchema faqs={page.faqs} />
      )}
      {page.include_product_schema && (
        <ProductSchema
          name={`${page.brand_name} Extended Warranty`}
          description={page.meta_description}
          price="35"
          brand="Buy A Warranty"
          category="Vehicle Warranty"
          image="https://buyawarranty.co.uk/logo.png"
          availability="https://schema.org/InStock"
          areaServed="GB"
        />
      )}
      {page.include_breadcrumb_schema && (
        <BreadcrumbSchema 
          items={[
            { name: "Home", url: "https://buyawarranty.co.uk/" },
            { name: `${page.brand_name} Warranty`, url: canonicalUrl }
          ]}
        />
      )}

      {/* Full homepage clone with brand-specific customization */}
      <BrandLandingPage
        brandName={page.brand_name}
        h1Override={page.h1_headline}
        brandLogo={page.brand_logo_url || undefined}
        metaTitle={page.meta_title}
        metaDescription={page.meta_description}
        canonicalUrl={canonicalUrl}
      />
    </>
  );
};

export default DynamicLandingPage;
