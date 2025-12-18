import { useState, useEffect } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Monitor, Tablet, Smartphone, Code, Eye, ExternalLink } from 'lucide-react';
import { supabase } from '@/integrations/supabase/client';
import { toast } from 'sonner';

interface LandingPagePreviewProps {
  pageId: string;
}

export const LandingPagePreview = ({ pageId }: LandingPagePreviewProps) => {
  const [page, setPage] = useState<any>(null);
  const [loading, setLoading] = useState(true);
  const [device, setDevice] = useState<'desktop' | 'tablet' | 'mobile'>('desktop');
  const [viewMode, setViewMode] = useState<'preview' | 'schema'>('preview');

  useEffect(() => {
    loadPage();
  }, [pageId]);

  const loadPage = async () => {
    try {
      const { data, error } = await supabase
        .from('landing_pages')
        .select('*')
        .eq('id', pageId)
        .single();

      if (error) throw error;
      setPage(data);
    } catch (error: any) {
      console.error('Error loading page:', error);
      toast.error('Failed to load page preview');
    } finally {
      setLoading(false);
    }
  };

  if (loading) {
    return <div className="text-center py-8">Loading preview...</div>;
  }

  if (!page) {
    return <div className="text-center py-8 text-red-500">Page not found</div>;
  }

  const deviceWidths = {
    desktop: '100%',
    tablet: '768px',
    mobile: '375px'
  };

  // Generate schema JSON for preview
  const generateSchemas = () => {
    const schemas: any[] = [];

    if (page.include_organization_schema) {
      schemas.push({
        "@context": "https://schema.org",
        "@type": "Organization",
        "name": "Buy A Warranty",
        "url": "https://buyawarranty.co.uk",
        "logo": "https://buyawarranty.co.uk/logo.png",
        "telephone": page.local_business_phone,
        "email": page.local_business_email
      });
    }

    if (page.include_local_business_schema) {
      schemas.push({
        "@context": "https://schema.org",
        "@type": "LocalBusiness",
        "name": page.local_business_name,
        "telephone": page.local_business_phone,
        "email": page.local_business_email,
        "address": {
          "@type": "PostalAddress",
          "addressCountry": "GB",
          "addressRegion": "United Kingdom"
        },
        "geo": {
          "@type": "GeoCoordinates",
          "latitude": 51.5074,
          "longitude": -0.1278
        },
        "areaServed": "GB",
        "priceRange": "££"
      });
    }

    if (page.include_faq_schema && page.faqs?.length > 0) {
      schemas.push({
        "@context": "https://schema.org",
        "@type": "FAQPage",
        "mainEntity": page.faqs.map((faq: any) => ({
          "@type": "Question",
          "name": faq.question,
          "acceptedAnswer": {
            "@type": "Answer",
            "text": faq.answer
          }
        }))
      });
    }

    if (page.include_product_schema) {
      schemas.push({
        "@context": "https://schema.org",
        "@type": "Product",
        "name": `${page.brand_name} Extended Warranty`,
        "description": page.meta_description,
        "brand": { "@type": "Brand", "name": "Buy A Warranty" },
        "offers": {
          "@type": "Offer",
          "priceCurrency": "GBP",
          "price": "35",
          "availability": "https://schema.org/InStock"
        }
      });
    }

    if (page.include_breadcrumb_schema) {
      schemas.push({
        "@context": "https://schema.org",
        "@type": "BreadcrumbList",
        "itemListElement": [
          { "@type": "ListItem", "position": 1, "name": "Home", "item": "https://buyawarranty.co.uk/" },
          { "@type": "ListItem", "position": 2, "name": `${page.brand_name} Warranty`, "item": `https://buyawarranty.co.uk/${page.slug}/` }
        ]
      });
    }

    return schemas;
  };

  const heroContent = page.hero_content || {};

  return (
    <div className="space-y-6">
      <Card>
        <CardHeader>
          <div className="flex items-center justify-between">
            <CardTitle>Preview: {page.brand_name} Landing Page</CardTitle>
            <div className="flex items-center gap-2">
              <Badge variant={page.status === 'published' ? 'default' : 'secondary'}>
                {page.status}
              </Badge>
              {page.status === 'published' && (
                <Button size="sm" variant="outline" onClick={() => window.open(`/${page.slug}/`, '_blank')}>
                  <ExternalLink className="w-4 h-4 mr-2" />
                  View Live
                </Button>
              )}
            </div>
          </div>
        </CardHeader>
        <CardContent>
          <Tabs value={viewMode} onValueChange={(v) => setViewMode(v as any)}>
            <div className="flex items-center justify-between mb-4">
              <TabsList>
                <TabsTrigger value="preview">
                  <Eye className="w-4 h-4 mr-2" />
                  Visual Preview
                </TabsTrigger>
                <TabsTrigger value="schema">
                  <Code className="w-4 h-4 mr-2" />
                  Schema JSON
                </TabsTrigger>
              </TabsList>
              
              {viewMode === 'preview' && (
                <div className="flex items-center gap-2">
                  <Button
                    variant={device === 'desktop' ? 'default' : 'outline'}
                    size="sm"
                    onClick={() => setDevice('desktop')}
                  >
                    <Monitor className="w-4 h-4" />
                  </Button>
                  <Button
                    variant={device === 'tablet' ? 'default' : 'outline'}
                    size="sm"
                    onClick={() => setDevice('tablet')}
                  >
                    <Tablet className="w-4 h-4" />
                  </Button>
                  <Button
                    variant={device === 'mobile' ? 'default' : 'outline'}
                    size="sm"
                    onClick={() => setDevice('mobile')}
                  >
                    <Smartphone className="w-4 h-4" />
                  </Button>
                </div>
              )}
            </div>

            <TabsContent value="preview">
              <div 
                className="border rounded-lg overflow-hidden mx-auto transition-all duration-300"
                style={{ maxWidth: deviceWidths[device] }}
              >
                {/* Hero Section Preview */}
                <div className="bg-gradient-to-br from-primary/5 via-white to-secondary/5 p-8">
                  {page.brand_logo_url && (
                    <img 
                      src={page.brand_logo_url} 
                      alt={`${page.brand_name} logo`}
                      className="h-12 w-auto mb-4"
                    />
                  )}
                  <h1 className="text-3xl font-bold text-gray-900 mb-2">
                    {page.h1_headline}
                  </h1>
                  {heroContent.subheadline && (
                    <h2 className="text-xl text-gray-700 mb-4">
                      {heroContent.subheadline}
                    </h2>
                  )}
                  {heroContent.description && (
                    <p className="text-gray-600 mb-6">
                      {heroContent.description}
                    </p>
                  )}
                  {heroContent.benefits?.length > 0 && (
                    <ul className="space-y-2 mb-6">
                      {heroContent.benefits.map((benefit: string, i: number) => (
                        <li key={i} className="flex items-center gap-2 text-gray-700">
                          <span className="text-green-600">✓</span>
                          {benefit}
                        </li>
                      ))}
                    </ul>
                  )}
                  <button className="bg-primary text-white px-6 py-3 rounded-lg font-semibold">
                    Get my instant quote →
                  </button>
                </div>

                {/* Featured Image */}
                {page.featured_image_url && (
                  <div className="p-4">
                    <img 
                      src={page.featured_image_url} 
                      alt={`${page.brand_name} warranty`}
                      className="w-full rounded-lg"
                    />
                  </div>
                )}

                {/* FAQ Section Preview */}
                {page.faqs?.length > 0 && (
                  <div className="p-8 bg-gray-50">
                    <h2 className="text-2xl font-bold mb-6">Frequently Asked Questions</h2>
                    <div className="space-y-4">
                      {page.faqs.slice(0, 3).map((faq: any, i: number) => (
                        <div key={i} className="bg-white p-4 rounded-lg">
                          <h3 className="font-semibold text-gray-900">{faq.question}</h3>
                          <p className="text-gray-600 mt-2 text-sm">{faq.answer}</p>
                        </div>
                      ))}
                    </div>
                  </div>
                )}
              </div>

              {/* SEO Preview */}
              <div className="mt-6 space-y-4">
                <h3 className="font-semibold">SEO Preview</h3>
                
                {/* Google Preview */}
                <div className="p-4 bg-white border rounded-lg">
                  <h4 className="text-xs text-gray-500 mb-2">Google Search Preview</h4>
                  <p className="text-blue-600 text-lg hover:underline cursor-pointer">
                    {page.meta_title}
                  </p>
                  <p className="text-green-700 text-sm">
                    buyawarranty.co.uk/{page.slug}/
                  </p>
                  <p className="text-gray-600 text-sm">
                    {page.meta_description}
                  </p>
                </div>

                {/* Social Preview */}
                <div className="p-4 bg-white border rounded-lg">
                  <h4 className="text-xs text-gray-500 mb-2">Social Media Preview (Facebook/LinkedIn)</h4>
                  <div className="border rounded overflow-hidden max-w-md">
                    {page.og_image_url ? (
                      <img src={page.og_image_url} alt="OG Preview" className="w-full h-40 object-cover" />
                    ) : (
                      <div className="w-full h-40 bg-gray-200 flex items-center justify-center">
                        No OG image set
                      </div>
                    )}
                    <div className="p-3">
                      <p className="text-xs text-gray-500 uppercase">buyawarranty.co.uk</p>
                      <p className="font-semibold">{page.og_title || page.meta_title}</p>
                      <p className="text-gray-600 text-sm line-clamp-2">
                        {page.og_description || page.meta_description}
                      </p>
                    </div>
                  </div>
                </div>
              </div>
            </TabsContent>

            <TabsContent value="schema">
              <div className="space-y-4">
                <p className="text-sm text-gray-600">
                  Schema markup that will be injected into this landing page for SEO and AI discoverability:
                </p>
                {generateSchemas().map((schema, index) => (
                  <div key={index} className="bg-gray-900 text-green-400 p-4 rounded-lg overflow-x-auto">
                    <pre className="text-xs">
                      {JSON.stringify(schema, null, 2)}
                    </pre>
                  </div>
                ))}
                {generateSchemas().length === 0 && (
                  <p className="text-gray-500 text-center py-4">
                    No schemas enabled for this page. Enable schemas in the editor.
                  </p>
                )}
              </div>
            </TabsContent>
          </Tabs>
        </CardContent>
      </Card>
    </div>
  );
};
