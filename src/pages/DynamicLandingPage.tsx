import React, { useState, useEffect } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { Button } from '@/components/ui/button';
import { Check, ArrowRight, ChevronDown, ChevronUp } from 'lucide-react';
import { SEOHead } from '@/components/SEOHead';
import { OrganizationSchema } from '@/components/schema/OrganizationSchema';
import { ReviewSchema } from '@/components/schema/ReviewSchema';
import { WebPageSchema } from '@/components/schema/WebPageSchema';
import { FAQSchema } from '@/components/schema/FAQSchema';
import { ProductSchema } from '@/components/schema/ProductSchema';
import { BreadcrumbSchema } from '@/components/schema/BreadcrumbSchema';
import { LocalBusinessSchema } from '@/components/schema/LocalBusinessSchema';
import TrustpilotHeader from '@/components/TrustpilotHeader';
import { trackButtonClick } from '@/utils/analytics';
import { supabase } from '@/integrations/supabase/client';
import NotFound from './NotFound';

interface LandingPageData {
  id: string;
  slug: string;
  brand_name: string;
  h1_headline: string;
  meta_title: string;
  meta_description: string;
  focus_keyword: string;
  og_title: string;
  og_description: string;
  og_image_url: string;
  featured_image_url: string;
  brand_logo_url: string;
  hero_content: {
    subheadline?: string;
    description?: string;
    benefits?: string[];
  };
  faqs: Array<{ question: string; answer: string }>;
  internal_links: Array<{ text: string; url: string }>;
  include_organization_schema: boolean;
  include_local_business_schema: boolean;
  include_product_schema: boolean;
  include_faq_schema: boolean;
  include_review_schema: boolean;
  include_breadcrumb_schema: boolean;
  is_indexable: boolean;
  robots_directive: string;
  local_business_name: string;
  local_business_phone: string;
  local_business_email: string;
  local_business_address: any;
  local_business_geo: any;
  status: string;
}

const DynamicLandingPage: React.FC = () => {
  const { slug } = useParams<{ slug: string }>();
  const navigate = useNavigate();
  const [page, setPage] = useState<LandingPageData | null>(null);
  const [loading, setLoading] = useState(true);
  const [openFaqId, setOpenFaqId] = useState<number | null>(null);

  useEffect(() => {
    const loadPage = async () => {
      if (!slug) {
        setLoading(false);
        return;
      }

      try {
        const { data, error } = await supabase
          .from('landing_pages')
          .select('*')
          .eq('slug', slug)
          .eq('status', 'published')
          .single();

        if (error || !data) {
          setPage(null);
        } else {
          setPage(data as any);
          // Increment view count
          supabase
            .from('landing_pages')
            .update({ view_count: (data.view_count || 0) + 1 })
            .eq('id', data.id)
            .then();
        }
      } catch (error) {
        console.error('Error loading landing page:', error);
        setPage(null);
      } finally {
        setLoading(false);
      }
    };

    loadPage();
  }, [slug]);

  const toggleFaq = (index: number) => {
    setOpenFaqId(openFaqId === index ? null : index);
  };

  const navigateToQuoteForm = () => {
    trackButtonClick(`${page?.brand_name.toLowerCase()}_warranty_get_quote`);
    navigate('/#quote-form');
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center min-h-screen">
        <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary"></div>
      </div>
    );
  }

  if (!page) {
    return <NotFound />;
  }

  const heroContent = page.hero_content || {};
  const canonicalUrl = `https://buyawarranty.co.uk/${page.slug}/`;

  return (
    <>
      {/* SEO Head with unique OG tags */}
      <SEOHead
        title={page.meta_title}
        description={page.meta_description}
        keywords={page.focus_keyword}
        ogTitle={page.og_title || page.meta_title}
        ogDescription={page.og_description || page.meta_description}
        ogImage={page.og_image_url || 'https://buyawarranty.co.uk/lovable-uploads/53652a24-3961-4346-bf9d-6588ef727aeb.png'}
        canonical={canonicalUrl}
        geoRegion="GB"
        geoPlacename="United Kingdom"
      />

      {/* Schema Markup */}
      {page.include_organization_schema && <OrganizationSchema />}
      {page.include_review_schema && <ReviewSchema />}
      {page.include_local_business_schema && (
        <LocalBusinessSchema
          name={page.local_business_name}
          telephone={page.local_business_phone}
          email={page.local_business_email}
          address={page.local_business_address}
          geo={page.local_business_geo}
        />
      )}
      <WebPageSchema 
        name={page.h1_headline}
        description={page.meta_description}
        url={canonicalUrl}
      />
      {page.include_faq_schema && page.faqs?.length > 0 && (
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

      {/* Hero Section - Homepage Design Template */}
      <section className="bg-gradient-to-br from-primary/5 via-white to-secondary/5 py-16 md:py-24">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="grid lg:grid-cols-2 gap-12 items-center">
            <div>
              {page.brand_logo_url && (
                <div className="flex items-center gap-4 mb-6">
                  <img 
                    src={page.brand_logo_url} 
                    alt={`${page.brand_name} Logo`} 
                    className="h-16 w-auto object-contain"
                  />
                </div>
              )}
              <h1 className="text-4xl md:text-5xl font-bold text-gray-900 mb-3">
                {page.h1_headline}
              </h1>
              {heroContent.subheadline && (
                <h2 className="text-2xl md:text-3xl font-semibold text-gray-700 mb-6">
                  {heroContent.subheadline}
                </h2>
              )}

              {heroContent.description && (
                <p className="text-xl text-gray-700 mb-8">
                  {heroContent.description}
                </p>
              )}
              
              {heroContent.benefits && heroContent.benefits.length > 0 && (
                <div className="space-y-3 mb-8">
                  {heroContent.benefits.map((benefit, index) => (
                    <div key={index} className="flex items-start gap-3">
                      <Check className="h-6 w-6 text-green-600 flex-shrink-0 mt-0.5" />
                      <span className="text-gray-700">{benefit}</span>
                    </div>
                  ))}
                </div>
              )}

              <p className="text-lg font-semibold text-primary mb-6">
                We are the only warranty provider offering high mileage cover up to 150,000 miles.
              </p>

              <Button 
                size="lg" 
                onClick={navigateToQuoteForm}
                className="w-full sm:w-auto"
              >
                Get my instant quote <ArrowRight className="ml-2 h-5 w-5" />
              </Button>
            </div>

            <div className="lg:pl-12">
              {page.featured_image_url && (
                <div className="mb-8">
                  <img
                    src={page.featured_image_url}
                    alt={`${page.brand_name} extended warranty`}
                    className="w-full h-auto rounded-lg shadow-lg object-cover"
                  />
                </div>
              )}
              <TrustpilotHeader className="mb-8" />
            </div>
          </div>
        </div>
      </section>

      {/* Why Choose Us Section */}
      <section className="py-16 bg-gray-50">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <h2 className="text-3xl md:text-4xl font-bold text-center mb-4">
            Why {page.brand_name} Owners Choose Us
          </h2>
          <p className="text-center text-lg text-gray-600 mb-12">
            Built for premium vehicles. Trusted by {page.brand_name} drivers across the UK.
          </p>

          <div className="overflow-x-auto">
            <table className="w-full border-collapse">
              <thead>
                <tr className="bg-primary/5">
                  <th className="border border-gray-300 p-4 text-left font-bold">Benefit</th>
                  <th className="border border-gray-300 p-4 text-left font-bold">What it means for you</th>
                </tr>
              </thead>
              <tbody>
                <tr>
                  <td className="border border-gray-300 p-4 font-semibold">Full mechanical + electrical protection</td>
                  <td className="border border-gray-300 p-4">Engine, gearbox, ECU, sensors, fuel system, suspension and more</td>
                </tr>
                <tr className="bg-gray-50">
                  <td className="border border-gray-300 p-4 font-semibold">Used {page.brand_name} extended warranty</td>
                  <td className="border border-gray-300 p-4">Coverage continues after manufacturer warranty expires</td>
                </tr>
                <tr>
                  <td className="border border-gray-300 p-4 font-semibold">Flexible payment options</td>
                  <td className="border border-gray-300 p-4">Pay monthly or annually, no hidden fees</td>
                </tr>
                <tr className="bg-gray-50">
                  <td className="border border-gray-300 p-4 font-semibold">UK-wide garage network</td>
                  <td className="border border-gray-300 p-4">Repairs carried out at approved repair centres</td>
                </tr>
                <tr>
                  <td className="border border-gray-300 p-4 font-semibold">Fast claims approval</td>
                  <td className="border border-gray-300 p-4">We get you back on the road faster</td>
                </tr>
              </tbody>
            </table>
          </div>
        </div>
      </section>

      {/* Coverage Section */}
      <section className="py-16 bg-gradient-to-br from-blue-50 via-white to-orange-50">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <h2 className="text-3xl md:text-4xl font-bold text-center mb-12">
            What Does a {page.brand_name} Extended Warranty Cover?
          </h2>

          <div className="grid md:grid-cols-3 gap-8">
            <div className="bg-white p-6 rounded-lg shadow-md">
              <h3 className="text-xl font-bold mb-4 flex items-center gap-2">
                <Check className="h-6 w-6 text-green-600" />
                Mechanical Components
              </h3>
              <ul className="space-y-3">
                <li className="flex items-start gap-2">
                  <Check className="h-5 w-5 text-green-600 flex-shrink-0 mt-0.5" />
                  <span>Engine and internal components</span>
                </li>
                <li className="flex items-start gap-2">
                  <Check className="h-5 w-5 text-green-600 flex-shrink-0 mt-0.5" />
                  <span>Gearbox and torque converter</span>
                </li>
                <li className="flex items-start gap-2">
                  <Check className="h-5 w-5 text-green-600 flex-shrink-0 mt-0.5" />
                  <span>Differential and drive shafts</span>
                </li>
              </ul>
            </div>

            <div className="bg-white p-6 rounded-lg shadow-md">
              <h3 className="text-xl font-bold mb-4 flex items-center gap-2">
                <Check className="h-6 w-6 text-green-600" />
                Electrical & ECU Systems
              </h3>
              <ul className="space-y-3">
                <li className="flex items-start gap-2">
                  <Check className="h-5 w-5 text-green-600 flex-shrink-0 mt-0.5" />
                  <span>ECU and electronic control units</span>
                </li>
                <li className="flex items-start gap-2">
                  <Check className="h-5 w-5 text-green-600 flex-shrink-0 mt-0.5" />
                  <span>Sensors, wiring and modules</span>
                </li>
                <li className="flex items-start gap-2">
                  <Check className="h-5 w-5 text-green-600 flex-shrink-0 mt-0.5" />
                  <span>Digital instrument clusters</span>
                </li>
              </ul>
            </div>

            <div className="bg-white p-6 rounded-lg shadow-md">
              <h3 className="text-xl font-bold mb-4 flex items-center gap-2">
                <Check className="h-6 w-6 text-green-600" />
                Cooling & Fuel Systems
              </h3>
              <ul className="space-y-3">
                <li className="flex items-start gap-2">
                  <Check className="h-5 w-5 text-green-600 flex-shrink-0 mt-0.5" />
                  <span>Radiators and cooling pumps</span>
                </li>
                <li className="flex items-start gap-2">
                  <Check className="h-5 w-5 text-green-600 flex-shrink-0 mt-0.5" />
                  <span>Fuel injectors and pumps</span>
                </li>
                <li className="flex items-start gap-2">
                  <Check className="h-5 w-5 text-green-600 flex-shrink-0 mt-0.5" />
                  <span>Air conditioning systems</span>
                </li>
              </ul>
            </div>
          </div>

          <p className="text-center text-lg text-gray-700 mt-8">
            Labour and diagnostics included up to your claim limit.
          </p>
        </div>
      </section>

      {/* FAQ Section */}
      {page.faqs && page.faqs.length > 0 && (
        <section className="py-16 bg-white">
          <div className="max-w-4xl mx-auto px-4 sm:px-6 lg:px-8">
            <h2 className="text-3xl md:text-4xl font-bold text-center mb-12">
              Frequently Asked Questions
            </h2>

            <div className="space-y-4">
              {page.faqs.map((faq, index) => (
                <div 
                  key={index}
                  className="border rounded-lg overflow-hidden"
                >
                  <button
                    className="w-full flex items-center justify-between p-4 text-left hover:bg-gray-50 transition-colors"
                    onClick={() => toggleFaq(index)}
                  >
                    <span className="font-semibold text-gray-900">{faq.question}</span>
                    {openFaqId === index ? (
                      <ChevronUp className="h-5 w-5 text-gray-500 flex-shrink-0" />
                    ) : (
                      <ChevronDown className="h-5 w-5 text-gray-500 flex-shrink-0" />
                    )}
                  </button>
                  {openFaqId === index && (
                    <div className="p-4 pt-0 text-gray-600 border-t bg-gray-50">
                      {faq.answer}
                    </div>
                  )}
                </div>
              ))}
            </div>
          </div>
        </section>
      )}

      {/* Internal Links Section */}
      {page.internal_links && page.internal_links.length > 0 && (
        <section className="py-8 bg-gray-50">
          <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
            <div className="flex flex-wrap justify-center gap-4">
              {page.internal_links.map((link, index) => (
                <a
                  key={index}
                  href={link.url}
                  className="text-primary hover:underline"
                >
                  {link.text}
                </a>
              ))}
            </div>
          </div>
        </section>
      )}

      {/* CTA Section */}
      <section className="py-16 bg-primary">
        <div className="max-w-4xl mx-auto px-4 sm:px-6 lg:px-8 text-center">
          <h2 className="text-3xl font-bold text-white mb-4">
            Ready to Protect Your {page.brand_name}?
          </h2>
          <p className="text-white/90 text-lg mb-8">
            Get an instant quote in under 60 seconds. No obligation, no hidden fees.
          </p>
          <Button 
            size="lg" 
            variant="secondary"
            onClick={navigateToQuoteForm}
            className="bg-white text-primary hover:bg-gray-100"
          >
            Get my instant quote <ArrowRight className="ml-2 h-5 w-5" />
          </Button>
        </div>
      </section>
    </>
  );
};

export default DynamicLandingPage;
