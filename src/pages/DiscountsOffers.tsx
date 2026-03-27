import React, { useEffect, useState } from 'react';
import { Button } from '@/components/ui/button';
import { ArrowRight, Tag, Clock, Copy, Check, Shield, Star, Percent } from 'lucide-react';
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

  const formatDiscount = (type: string, value: number) => {
    if (type === 'percentage') return `${value}% OFF`;
    return `£${value} OFF`;
  };

  const structuredData = {
    "@context": "https://schema.org",
    "@type": "OfferCatalog",
    "name": "Buy A Warranty Discount Codes & Offers",
    "description": "Active discount codes and special offers for vehicle warranty plans from Buy A Warranty UK.",
    "url": "https://buyawarranty.co.uk/discounts-offers/",
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
      "eligibleRegion": { "@type": "Country", "name": "GB" }
    }))
  };

  return (
    <>
      <SEOHead
        title="Discount Codes & Offers - Save on Vehicle Warranties | Buy A Warranty"
        description="Find the latest Buy A Warranty discount codes and special offers. Save on car, van, EV and motorbike warranty plans with our active promo codes. Updated regularly."
        keywords="buy a warranty discount code, car warranty promo code, vehicle warranty offer, buy a warranty voucher, warranty discount UK, car warranty deal, buyawarranty promo code"
        canonical="https://buyawarranty.co.uk/discounts-offers/"
      />

      {/* JSON-LD Structured Data */}
      <script
        type="application/ld+json"
        dangerouslySetInnerHTML={{ __html: JSON.stringify(structuredData) }}
      />

      {/* Hero Section */}
      <section className="bg-gradient-to-br from-blue-50 via-white to-orange-50 py-12 md:py-20">
        <div className="container mx-auto px-4">
          <div className="grid md:grid-cols-2 gap-8 items-center">
            <div className="space-y-6">
              <div className="inline-block w-full max-w-xs">
                <TrustpilotMicroComboWidget />
              </div>

              <h1 className="text-3xl md:text-5xl font-bold leading-tight">
                Exclusive <span className="text-[#eb4b00]">Discount Codes</span> & Offers
              </h1>

              <p className="text-xl text-gray-700">
                Save on your vehicle warranty with our latest promo codes
              </p>

              <div className="space-y-3">
                <div className="flex items-center space-x-2">
                  <Check className="h-5 w-5 text-green-600 flex-shrink-0" />
                  <span className="text-gray-700">Copy the code below and apply at checkout</span>
                </div>
                <div className="flex items-center space-x-2">
                  <Check className="h-5 w-5 text-green-600 flex-shrink-0" />
                  <span className="text-gray-700">One code per purchase – automatically applied</span>
                </div>
                <div className="flex items-center space-x-2">
                  <Check className="h-5 w-5 text-green-600 flex-shrink-0" />
                  <span className="text-gray-700">Valid across all vehicle warranty plans</span>
                </div>
              </div>

              <Button
                onClick={navigateToQuoteForm}
                size="lg"
                className="bg-[#eb4b00] hover:bg-[#d44400] text-white text-lg px-8 py-6"
              >
                Get Your Warranty Quote
                <ArrowRight className="ml-2 h-5 w-5" />
              </Button>
            </div>

            <div className="relative">
              <img
                src={pandaCarWarranty}
                alt="Buy A Warranty discount codes and special offers"
                className="w-full h-auto"
              />
            </div>
          </div>
        </div>
      </section>

      {/* Active Promo Codes Section */}
      <section className="py-16 bg-white">
        <div className="container mx-auto px-4">
          <h2 className="text-3xl md:text-4xl font-bold text-center mb-4">
            Active <span className="text-[#1e40af]">Promo Codes</span>
          </h2>
          <p className="text-center text-gray-600 mb-12 max-w-2xl mx-auto">
            Grab one of our active codes below and use it at checkout to save on your warranty.
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
            <div className="grid md:grid-cols-2 lg:grid-cols-3 gap-6 max-w-5xl mx-auto">
              {codes.map((code) => {
                const isAlmostGone = code.usage_limit && (code.usage_limit - code.used_count) <= 10;
                return (
                  <div
                    key={code.id}
                    className="relative bg-gradient-to-br from-blue-50 to-white border-2 border-dashed border-[#1e40af]/30 rounded-xl p-6 hover:border-[#eb4b00]/50 transition-all hover:shadow-lg group"
                  >
                    {/* Discount badge */}
                    <div className="absolute -top-3 -right-3 bg-[#eb4b00] text-white text-sm font-bold px-3 py-1 rounded-full shadow-md">
                      {formatDiscount(code.type, code.value)}
                    </div>

                    {/* Code display */}
                    <div className="mb-4 mt-2">
                      <p className="text-xs text-gray-500 uppercase tracking-wider mb-1">Promo Code</p>
                      <div className="flex items-center gap-2">
                        <code className="text-2xl font-mono font-bold text-[#1e40af] tracking-widest">
                          {code.code}
                        </code>
                        <button
                          onClick={() => copyCode(code.code)}
                          className="p-2 rounded-lg bg-[#1e40af]/10 hover:bg-[#1e40af]/20 transition-colors"
                          title="Copy code"
                        >
                          {copiedCode === code.code ? (
                            <Check className="h-4 w-4 text-green-600" />
                          ) : (
                            <Copy className="h-4 w-4 text-[#1e40af]" />
                          )}
                        </button>
                      </div>
                    </div>

                    {/* Description */}
                    {code.public_description && (
                      <p className="text-gray-700 text-sm mb-4">{code.public_description}</p>
                    )}

                    {/* Expiry & scarcity */}
                    <div className="space-y-2 text-sm text-gray-500">
                      <div className="flex items-center gap-1.5">
                        <Clock className="h-3.5 w-3.5" />
                        <span>Valid until {format(new Date(code.valid_to), 'dd MMM yyyy')}</span>
                      </div>
                      {isAlmostGone && (
                        <div className="flex items-center gap-1.5 text-[#eb4b00] font-semibold">
                          <Tag className="h-3.5 w-3.5" />
                          <span>Only {code.usage_limit! - code.used_count} left!</span>
                        </div>
                      )}
                    </div>

                    {/* CTA */}
                    <Button
                      onClick={() => {
                        copyCode(code.code);
                        navigateToQuoteForm();
                      }}
                      className="w-full mt-4 bg-[#eb4b00] hover:bg-[#d44400] text-white group-hover:shadow-md transition-all"
                    >
                      Use Code & Get Quote
                      <ArrowRight className="ml-2 h-4 w-4" />
                    </Button>
                  </div>
                );
              })}
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
    </>
  );
};

export default DiscountsOffers;
