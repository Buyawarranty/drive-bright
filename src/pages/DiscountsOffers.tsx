import React, { useEffect, useState, useRef } from 'react';
import { Button } from '@/components/ui/button';
import { ArrowRight, Tag, Clock, Copy, Check, Shield, Star, Percent, ChevronDown, X } from 'lucide-react';
import { Link, useNavigate } from 'react-router-dom';
import { SEOHead } from '@/components/SEOHead';
import TrustpilotMicroComboWidget from '@/components/TrustpilotMicroComboWidget';
import HomepageFAQ from '@/components/HomepageFAQ';
import { useIsMobile } from '@/hooks/use-mobile';
import { supabase } from '@/integrations/supabase/client';
import { format } from 'date-fns';
import { toast } from 'sonner';
import pandaCarWarranty from '@/assets/car-warranty-uk-suv-warranty.png';

interface PublicDiscountCode {
  id: string;
  code: string;
  type: string;
  value: number;
  valid_to: string;
  public_description: string | null;
  usage_limit: number | null;
  used_count: number;
}

const DiscountsOffers: React.FC = () => {
  const isMobile = useIsMobile();
  const navigate = useNavigate();
  const [codes, setCodes] = useState<PublicDiscountCode[]>([]);
  const [loading, setLoading] = useState(true);
  const [copiedCode, setCopiedCode] = useState<string | null>(null);
  const [showSelectModal, setShowSelectModal] = useState(false);
  const codesRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const fetchCodes = async () => {
      const { data, error } = await supabase
        .from('discount_codes')
        .select('id, code, type, value, valid_to, public_description, usage_limit, used_count')
        .eq('active', true)
        .eq('archived', false)
        .eq('is_public', true)
        .gt('valid_to', new Date().toISOString())
        .order('value', { ascending: false });

      if (!error && data) {
        setCodes(data as PublicDiscountCode[]);
      }
      setLoading(false);
    };
    fetchCodes();
  }, []);

  const copyCode = (code: string) => {
    navigator.clipboard.writeText(code);
    setCopiedCode(code);
    toast.success(`Code "${code}" copied to clipboard!`);
    setTimeout(() => setCopiedCode(null), 3000);
  };

  const navigateToQuoteForm = () => {
    navigate('/');
    setTimeout(() => {
      const element = document.getElementById('quote-form');
      if (element) element.scrollIntoView({ behavior: 'smooth' });
    }, 100);
  };

  const scrollToCodes = () => {
    codesRef.current?.scrollIntoView({ behavior: 'smooth' });
  };

  const applyCodeAndNavigate = (code: PublicDiscountCode) => {
    // Store the selected code so the homepage can auto-apply it
    localStorage.setItem('baw_promo_code', code.code);
    toast.success(`"${code.code}" selected! Redirecting to get your quote...`, {
      description: formatDiscountShort(code.type, code.value, code.code),
    });
    setShowSelectModal(false);
    setTimeout(() => {
      navigate('/');
      setTimeout(() => {
        const element = document.getElementById('quote-form');
        if (element) element.scrollIntoView({ behavior: 'smooth' });
      }, 100);
    }, 600);
  };

  const formatDiscount = (type: string, value: number) => {
    if (type === 'percentage') return `${value}% OFF`;
    return `£${value} OFF`;
  };

  const formatDiscountShort = (type: string, value: number, code?: string) => {
    if (type === 'percentage') return `${value}% off your warranty`;
    if (code === 'BUS') return `£${value} off your warranty`;
    return `£${value} off your warranty`;
  };

  // OfferCatalog schema
  const offerCatalogSchema = {
    "@context": "https://schema.org",
    "@type": "OfferCatalog",
    "name": "Buy A Warranty Discount Codes & Offers 2026",
    "description": "Active discount codes, promo codes and special offers for vehicle warranty plans from Buy A Warranty UK. Save on car, van, EV and motorbike warranties.",
    "url": "https://buyawarranty.co.uk/discount-promo-offers/",
    "provider": {
      "@type": "Organization",
      "name": "Buy A Warranty",
      "url": "https://buyawarranty.co.uk"
    },
    "itemListElement": codes.map((code, i) => ({
      "@type": "Offer",
      "position": i + 1,
      "name": `${code.code} - ${formatDiscount(code.type, code.value)}`,
      "description": code.public_description || `Save ${formatDiscount(code.type, code.value)} on your vehicle warranty`,
      "validThrough": code.valid_to,
      "priceCurrency": "GBP",
      "eligibleRegion": { "@type": "Country", "name": "GB" }
    }))
  };

  // LocalBusiness schema
  const localBusinessSchema = {
    "@context": "https://schema.org",
    "@type": "LocalBusiness",
    "name": "Buy A Warranty",
    "alternateName": "Buyawarranty",
    "url": "https://buyawarranty.co.uk",
    "logo": "https://buyawarranty.co.uk/lovable-uploads/buyawarranty-logo.webp",
    "image": "https://buyawarranty.co.uk/lovable-uploads/buyawarranty-logo.webp",
    "description": "UK's trusted vehicle warranty provider offering comprehensive mechanical and electrical protection for cars, vans, EVs and motorbikes. Discount codes and special offers available.",
    "telephone": "+443302295040",
    "email": "support@buyawarranty.co.uk",
    "address": {
      "@type": "PostalAddress",
      "streetAddress": "Warranty House, 62 Berkhamsted Ave",
      "addressLocality": "Wembley",
      "addressRegion": "Greater London",
      "postalCode": "HA9 6DT",
      "addressCountry": "GB"
    },
    "geo": {
      "@type": "GeoCoordinates",
      "latitude": "51.5565",
      "longitude": "-0.2958"
    },
    "openingHoursSpecification": [
      {
        "@type": "OpeningHoursSpecification",
        "dayOfWeek": ["Monday", "Tuesday", "Wednesday", "Thursday", "Friday"],
        "opens": "09:00",
        "closes": "18:00"
      },
      {
        "@type": "OpeningHoursSpecification",
        "dayOfWeek": "Saturday",
        "opens": "10:00",
        "closes": "16:00"
      }
    ],
    "priceRange": "From £19/month",
    "areaServed": {
      "@type": "Country",
      "name": "United Kingdom"
    },
    "sameAs": [
      "https://www.trustpilot.com/review/buyawarranty.co.uk"
    ]
  };

  // WebPage schema for AI/search discoverability
  const webPageSchema = {
    "@context": "https://schema.org",
    "@type": "WebPage",
    "name": "Buy A Warranty Discount Codes & Promo Offers 2026",
    "description": "Find active Buy A Warranty discount codes and promo offers. Save on car, van, EV and motorbike warranty plans. Codes updated regularly.",
    "url": "https://buyawarranty.co.uk/discount-promo-offers/",
    "isPartOf": {
      "@type": "WebSite",
      "name": "Buy A Warranty",
      "url": "https://buyawarranty.co.uk"
    },
    "about": {
      "@type": "Thing",
      "name": "Vehicle Warranty Discount Codes"
    },
    "mainEntity": {
      "@type": "ItemList",
      "numberOfItems": codes.length,
      "itemListElement": codes.map((code, i) => ({
        "@type": "ListItem",
        "position": i + 1,
        "name": `${code.code} — ${formatDiscountShort(code.type, code.value)}`
      }))
    },
    "breadcrumb": {
      "@type": "BreadcrumbList",
      "itemListElement": [
        { "@type": "ListItem", "position": 1, "name": "Home", "item": "https://buyawarranty.co.uk/" },
        { "@type": "ListItem", "position": 2, "name": "Discount & Promo Offers", "item": "https://buyawarranty.co.uk/discount-promo-offers/" }
      ]
    }
  };

  return (
    <>
      <SEOHead
        title="Buy A Warranty Discount Codes & Promo Codes 2026 | Save on Car Warranties UK"
        description="Active Buy A Warranty promo codes & discount codes for 2026. Save up to £50 on car, van, EV & motorbike warranties. Copy a promo code and apply at checkout — limited availability."
        keywords="buy a warranty discount code, buyawarranty promo code, car warranty promo code UK, buy a warranty voucher code, vehicle warranty discount code, warranty coupon code, buy a warranty offers, car warranty deal UK, buyawarranty discount, warranty promo code 2026, car warranty discount, promo code car warranty"
        canonical="https://buyawarranty.co.uk/discount-promo-offers/"
      />

      {/* JSON-LD Structured Data */}
      <script type="application/ld+json" dangerouslySetInnerHTML={{ __html: JSON.stringify(offerCatalogSchema) }} />
      <script type="application/ld+json" dangerouslySetInnerHTML={{ __html: JSON.stringify(localBusinessSchema) }} />
      <script type="application/ld+json" dangerouslySetInnerHTML={{ __html: JSON.stringify(webPageSchema) }} />

      {/* Hero Section */}
      <section className="bg-gradient-to-br from-blue-50 via-white to-orange-50 py-12 md:py-20">
        <div className="container mx-auto px-4">
          <div className="grid md:grid-cols-2 gap-8 items-center">
            <div className="space-y-6">
              <div className="inline-block w-full max-w-xs">
                <TrustpilotMicroComboWidget />
              </div>

              <h1 className="text-3xl md:text-5xl font-bold leading-tight">
                Buy A Warranty <span className="text-[#eb4b00]">Discount Codes</span> & Promo Offers
              </h1>

              <p className="text-xl text-gray-700">
                Save on your vehicle warranty with our latest promo codes — copy, paste & save at checkout.
              </p>

              <div className="space-y-3">
                <div className="flex items-center space-x-2">
                  <Check className="h-5 w-5 text-green-600 flex-shrink-0" />
                  <span className="text-gray-700">Copy the code below and apply at checkout</span>
                </div>
                <div className="flex items-center space-x-2">
                  <Check className="h-5 w-5 text-green-600 flex-shrink-0" />
                  <span className="text-gray-700">One code per purchase — automatically applied</span>
                </div>
                <div className="flex items-center space-x-2">
                  <Check className="h-5 w-5 text-green-600 flex-shrink-0" />
                  <span className="text-gray-700">Valid across all vehicle warranty plans</span>
                </div>
              </div>

              <div className="flex flex-col sm:flex-row gap-3">
                <Button
                  onClick={navigateToQuoteForm}
                  size="lg"
                  className="bg-[#eb4b00] hover:bg-[#d44400] text-white text-lg px-8 py-6"
                >
                  Get Your Warranty Quote
                  <ArrowRight className="ml-2 h-5 w-5" />
                </Button>
                <Button
                  onClick={scrollToCodes}
                  size="lg"
                  variant="outline"
                  className="border-2 border-[#1e40af] text-[#1e40af] hover:bg-[#1e40af] hover:text-white text-lg px-8 py-6"
                >
                  See Promo Codes
                  <ChevronDown className="ml-2 h-5 w-5" />
                </Button>
              </div>
            </div>

            <div className="relative">
              <img
                src={pandaCarWarranty}
                alt="Buy A Warranty discount codes — save on car, van and EV warranties in the UK"
                className="w-full h-auto"
                loading="eager"
              />
            </div>
          </div>
        </div>
      </section>

      {/* Active Promo Codes Section */}
      <section className="py-16 bg-white" id="codes" ref={codesRef}>
        <div className="container mx-auto px-4">
          <h2 className="text-3xl md:text-4xl font-bold text-center mb-4">
            Active <span className="text-[#1e40af]">Promo Codes</span>
          </h2>
          <p className="text-center text-gray-600 mb-12 max-w-2xl mx-auto">
            Copy a code below and paste it at checkout to save on your warranty.
          </p>

          {loading ? (
            <div className="text-center py-12">
              <div className="animate-spin rounded-full h-10 w-10 border-b-2 border-[#eb4b00] mx-auto"></div>
              <p className="mt-4 text-gray-500">Loading offers...</p>
            </div>
          ) : codes.length === 0 ? (
            <div className="text-center py-12 bg-blue-50 rounded-xl max-w-xl mx-auto">
              <Tag className="h-12 w-12 text-[#1e40af] mx-auto mb-4" />
              <h3 className="text-xl font-bold mb-2">No active codes right now</h3>
              <p className="text-gray-600 mb-6">Check back soon – we regularly release new discount codes and special offers.</p>
              <Button onClick={navigateToQuoteForm} className="bg-[#eb4b00] hover:bg-[#d44400] text-white">
                Get a Quote Anyway
              </Button>
            </div>
          ) : (
            <div className="max-w-3xl mx-auto">
              {/* Promo code table */}
              <div className="border-2 border-gray-200 rounded-xl overflow-hidden shadow-sm">
                {/* Table header */}
                <div className="grid grid-cols-[1fr_auto_auto] md:grid-cols-[1fr_1fr_auto] bg-gray-50 border-b border-gray-200 px-4 md:px-6 py-3">
                  <span className="text-xs font-semibold uppercase tracking-wider text-gray-500">Code</span>
                  <span className="text-xs font-semibold uppercase tracking-wider text-gray-500 hidden md:block">Offer</span>
                  <span className="text-xs font-semibold uppercase tracking-wider text-gray-500 text-right">Action</span>
                </div>

                {/* Code rows */}
                {codes.map((code, idx) => (
                  <div
                    key={code.id}
                    className={`grid grid-cols-[1fr_auto] md:grid-cols-[1fr_1fr_auto] items-center px-4 md:px-6 py-4 gap-3 ${
                      idx < codes.length - 1 ? 'border-b border-gray-100' : ''
                    } hover:bg-blue-50/40 transition-colors`}
                  >
                    {/* Code + offer (mobile: stacked) */}
                    <div className="space-y-1">
                      <code className="text-lg md:text-xl font-mono font-bold text-[#1e40af] tracking-wider select-all">
                        {code.code}
                      </code>
                      <p className="text-sm text-gray-600 md:hidden">
                        {formatDiscountShort(code.type, code.value, code.code)}
                      </p>
                    </div>

                    {/* Offer description (desktop) */}
                    <div className="hidden md:block">
                      <span className="inline-flex items-center gap-1.5 text-sm font-medium text-gray-700">
                        <Tag className="h-3.5 w-3.5 text-[#eb4b00]" />
                        {formatDiscountShort(code.type, code.value, code.code)}
                      </span>
                    </div>

                    {/* Copy button */}
                    <button
                      onClick={() => copyCode(code.code)}
                      className={`inline-flex items-center gap-2 px-4 py-2 rounded-lg text-sm font-semibold transition-all whitespace-nowrap ${
                        copiedCode === code.code
                          ? 'bg-green-100 text-green-700 border border-green-300'
                          : 'bg-[#1e40af] text-white hover:bg-[#1a3590] shadow-sm hover:shadow-md'
                      }`}
                      aria-label={`Copy code ${code.code}`}
                    >
                      {copiedCode === code.code ? (
                        <>
                          <Check className="h-4 w-4" />
                          Copied!
                        </>
                      ) : (
                        <>
                          <Copy className="h-4 w-4" />
                          Copy
                        </>
                      )}
                    </button>
                  </div>
                ))}
              </div>

              {/* CTA below table */}
              <div className="text-center mt-8">
                <Button
                  onClick={() => setShowSelectModal(true)}
                  size="lg"
                  className="bg-[#eb4b00] hover:bg-[#d44400] text-white text-lg px-8 py-6"
                >
                  Get Your Quote & Apply Code
                  <ArrowRight className="ml-2 h-5 w-5" />
                </Button>
                <p className="text-xs text-gray-400 mt-3">One promo code per transaction. Cannot be combined with other offers.</p>
              </div>
            </div>
          )}
        </div>
      </section>

      {/* How it Works */}
      <section className="py-16 bg-gradient-to-br from-blue-50 to-white">
        <div className="container mx-auto px-4">
          <h2 className="text-3xl md:text-4xl font-bold text-center mb-12">
            How to use a <span className="text-[#1e40af]">discount code</span>
          </h2>

          <div className="grid md:grid-cols-3 gap-8 max-w-4xl mx-auto">
            <div className="text-center space-y-4">
              <div className="w-16 h-16 rounded-full bg-[#eb4b00] text-white flex items-center justify-center text-2xl font-bold mx-auto">1</div>
              <h3 className="text-xl font-bold">Copy the Code</h3>
              <p className="text-gray-600">Click the copy button next to your chosen promo code above</p>
            </div>
            <div className="text-center space-y-4">
              <div className="w-16 h-16 rounded-full bg-[#1e40af] text-white flex items-center justify-center text-2xl font-bold mx-auto">2</div>
              <h3 className="text-xl font-bold">Get Your Quote</h3>
              <p className="text-gray-600">Enter your vehicle registration and choose your warranty plan</p>
            </div>
            <div className="text-center space-y-4">
              <div className="w-16 h-16 rounded-full bg-[#eb4b00] text-white flex items-center justify-center text-2xl font-bold mx-auto">3</div>
              <h3 className="text-xl font-bold">Apply at Checkout</h3>
              <p className="text-gray-600">Paste the code in the promo box at checkout and save instantly</p>
            </div>
          </div>
        </div>
      </section>

      {/* Why Buy A Warranty */}
      <section className="py-16 bg-white">
        <div className="container mx-auto px-4">
          <h2 className="text-3xl md:text-4xl font-bold text-center mb-12">
            Why choose <span className="text-[#1e40af]">Buy A Warranty</span>?
          </h2>

          <div className="grid md:grid-cols-2 lg:grid-cols-3 gap-8">
            <div className="bg-blue-50 p-6 rounded-lg">
              <Shield className="h-12 w-12 text-[#1e40af] mb-4" />
              <h3 className="text-xl font-bold mb-2">Comprehensive Cover</h3>
              <p className="text-gray-700">Mechanical & electrical protection for cars, vans, EVs and motorbikes</p>
            </div>
            <div className="bg-orange-50 p-6 rounded-lg">
              <Percent className="h-12 w-12 text-[#eb4b00] mb-4" />
              <h3 className="text-xl font-bold mb-2">Regular Offers</h3>
              <p className="text-gray-700">We frequently release new discount codes and seasonal promotions</p>
            </div>
            <div className="bg-blue-50 p-6 rounded-lg">
              <Star className="h-12 w-12 text-[#1e40af] mb-4" />
              <h3 className="text-xl font-bold mb-2">Excellent on Trustpilot</h3>
              <p className="text-gray-700">Rated excellent by thousands of customers across the UK</p>
            </div>
          </div>
        </div>
      </section>

      {/* FAQ */}
      <HomepageFAQ />

      {/* Select Offer Modal */}
      {showSelectModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/50 backdrop-blur-sm" onClick={() => setShowSelectModal(false)}>
          <div
            className="bg-white rounded-2xl shadow-2xl w-full max-w-md mx-auto overflow-hidden animate-in fade-in zoom-in-95 duration-200"
            onClick={(e) => e.stopPropagation()}
          >
            {/* Modal header */}
            <div className="flex items-center justify-between px-6 py-4 border-b border-gray-100 bg-gradient-to-r from-blue-50 to-orange-50">
              <div>
                <h3 className="text-lg font-bold text-gray-900">Select an Offer</h3>
                <p className="text-sm text-gray-500">Choose a code to auto-apply to your quote</p>
              </div>
              <button
                onClick={() => setShowSelectModal(false)}
                className="p-1.5 rounded-full hover:bg-gray-200 transition-colors"
                aria-label="Close"
              >
                <X className="h-5 w-5 text-gray-500" />
              </button>
            </div>

            {/* Offer cards */}
            <div className="p-4 space-y-3 max-h-[60vh] overflow-y-auto">
              {codes.map((code) => (
                <button
                  key={code.id}
                  onClick={() => applyCodeAndNavigate(code)}
                  className="w-full text-left p-4 rounded-xl border-2 border-gray-200 hover:border-[#eb4b00] hover:bg-orange-50/50 transition-all group"
                >
                  <div className="flex items-center justify-between">
                    <div>
                      <code className="text-lg font-mono font-bold text-[#1e40af] tracking-wider">{code.code}</code>
                      <p className="text-sm text-gray-600 mt-0.5">{formatDiscountShort(code.type, code.value)}</p>
                    </div>
                    <div className="bg-[#eb4b00] text-white px-3 py-1.5 rounded-lg text-sm font-bold opacity-0 group-hover:opacity-100 transition-opacity">
                      Apply →
                    </div>
                  </div>
                </button>
              ))}
            </div>

            {/* Modal footer */}
            <div className="px-6 py-4 border-t border-gray-100 bg-gray-50">
              <button
                onClick={() => { setShowSelectModal(false); navigateToQuoteForm(); }}
                className="w-full text-center text-sm text-gray-500 hover:text-[#1e40af] transition-colors"
              >
                Skip — get a quote without a code
              </button>
            </div>
          </div>
        </div>
      )}
    </>
  );
};

export default DiscountsOffers;
