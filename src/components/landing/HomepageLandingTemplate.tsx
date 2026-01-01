import React, { useState, lazy, Suspense } from 'react';
import { Button } from '@/components/ui/button';
import { Check, ArrowRight, Star, Shield, Clock, Zap, ChevronDown, ChevronUp, Phone } from 'lucide-react';
import { useIsMobile } from '@/hooks/use-mobile';
import TrustpilotHeader from '@/components/TrustpilotHeader';
import MileageQuickSelect from '@/components/MileageQuickSelect';
import { useToast } from '@/hooks/use-toast';
import { supabase } from '@/integrations/supabase/client';
import { trackButtonClick, trackQuoteRequest } from '@/utils/analytics';
import buyawarrantyLogo from '@/assets/buyawarranty-logo.webp';

// Lazy load heavy sections
const HomepageFAQ = lazy(() => import('@/components/HomepageFAQ'));
const VideoSection = lazy(() => import('@/components/homepage/VideoSection'));
const WarrantyBenefitsSection = lazy(() => import('@/components/homepage/WarrantyBenefitsSection'));
const CoverClaritySection = lazy(() => import('@/components/homepage/CoverClaritySection'));

interface VehicleData {
  regNumber: string;
  mileage: string;
  make?: string;
  model?: string;
  fuelType?: string;
  transmission?: string;
  year?: string;
  vehicleType?: string;
  blocked?: boolean;
  blockReason?: string;
  manufactureDate?: string;
}

interface HomepageLandingTemplateProps {
  brandName: string;
  h1Headline: string;
  heroContent?: {
    subheadline?: string;
    description?: string;
    benefits?: string[];
    ctaText?: string;
  } | null;
  featuresContent?: {
    title?: string;
    items?: Array<{ icon?: string; title: string; description: string }>;
  } | null;
  coverageContent?: {
    title?: string;
    sections?: Array<{ title: string; items: string[] }>;
  } | null;
  pricingContent?: {
    title?: string;
    subtitle?: string;
  } | null;
  testimonialsContent?: {
    title?: string;
    items?: Array<{ name: string; text: string; rating: number }>;
  } | null;
  faqs?: Array<{ question: string; answer: string }> | null;
  internalLinks?: Array<{ text: string; url: string }> | null;
  featuredImageUrl?: string | null;
  brandLogoUrl?: string | null;
  supportingImages?: Array<{ url: string; alt: string; caption?: string }> | null;
  onRegistrationSubmit: (vehicleData: VehicleData) => void;
}

const HomepageLandingTemplate: React.FC<HomepageLandingTemplateProps> = ({
  brandName,
  h1Headline,
  heroContent,
  featuresContent,
  coverageContent,
  pricingContent,
  testimonialsContent,
  faqs,
  internalLinks,
  featuredImageUrl,
  brandLogoUrl,
  supportingImages,
  onRegistrationSubmit,
}) => {
  const { toast } = useToast();
  const isMobile = useIsMobile();
  const [regNumber, setRegNumber] = useState('');
  const [mileage, setMileage] = useState('');
  const [mileageSelection, setMileageSelection] = useState<string>(''); // 'under120k' or 'over120k'
  const [showMileageField, setShowMileageField] = useState(false);
  const [isLookingUp, setIsLookingUp] = useState(false);
  const [mileageError, setMileageError] = useState('');
  const [vehicleAgeError, setVehicleAgeError] = useState('');
  const [openFaqId, setOpenFaqId] = useState<number | null>(null);

  // Default benefits if none provided
  const defaultBenefits = [
    'Full mechanical & electrical cover',
    'Parts & labour included',
    'UK-wide garage network',
    'Fast claims - 94% approved',
    '14-day money-back guarantee'
  ];

  const benefits = heroContent?.benefits || defaultBenefits;
  const ctaText = heroContent?.ctaText || 'Get my instant quote';

  const validateMileage = (value: string): boolean => {
    const numericMileage = parseInt(value.replace(/,/g, ''), 10);
    if (isNaN(numericMileage)) {
      setMileageError('Please enter a valid mileage');
      return false;
    }
    if (numericMileage > 150000) {
      setMileageError('Sorry, we only cover vehicles under 150,000 miles');
      return false;
    }
    setMileageError('');
    return true;
  };

  const handleRegSubmit = async () => {
    if (!regNumber.trim()) {
      toast({
        title: "Registration required",
        description: "Please enter your vehicle registration number",
        variant: "destructive"
      });
      return;
    }

    if (!showMileageField) {
      setShowMileageField(true);
      return;
    }

    if (!mileage) {
      toast({
        title: "Mileage required",
        description: "Please select your approximate mileage",
        variant: "destructive"
      });
      return;
    }

    setIsLookingUp(true);
    trackButtonClick(`${brandName.toLowerCase()}_landing_get_quote`);

    try {
      // Call DVLA lookup
      const { data: vehicleInfo, error: lookupError } = await supabase.functions.invoke('dvla-vehicle-lookup', {
        body: { registrationNumber: regNumber.toUpperCase().replace(/\s/g, '') }
      });

      if (lookupError) throw lookupError;

      // Check vehicle age
      if (vehicleInfo?.manufactureDate) {
        const manufactureDate = new Date(vehicleInfo.manufactureDate);
        const now = new Date();
        const ageInYears = (now.getTime() - manufactureDate.getTime()) / (1000 * 60 * 60 * 24 * 365.25);
        
        if (ageInYears >= 15) {
          setVehicleAgeError('Sorry, we only cover vehicles under 15 years old');
          setIsLookingUp(false);
          return;
        }
      }

      const vehicleData: VehicleData = {
        regNumber: regNumber.toUpperCase().replace(/\s/g, ''),
        mileage: mileage.replace(/,/g, ''),
        make: vehicleInfo?.make || '',
        model: vehicleInfo?.model || '',
        fuelType: vehicleInfo?.fuelType || '',
        transmission: vehicleInfo?.transmission || '',
        year: vehicleInfo?.year || '',
        vehicleType: vehicleInfo?.vehicleType || 'car',
        manufactureDate: vehicleInfo?.manufactureDate
      };

      trackQuoteRequest();

      onRegistrationSubmit(vehicleData);

    } catch (error) {
      console.error('Vehicle lookup error:', error);
      // Continue with basic data if lookup fails
      const vehicleData: VehicleData = {
        regNumber: regNumber.toUpperCase().replace(/\s/g, ''),
        mileage: mileage.replace(/,/g, ''),
        vehicleType: 'car'
      };
      onRegistrationSubmit(vehicleData);
    } finally {
      setIsLookingUp(false);
    }
  };

  const handleMileageSelection = (selection: string) => {
    setMileageSelection(selection);
    // Set a representative mileage value for the selection
    if (selection === 'under120k') {
      setMileage('100000'); // Representative value under 120k
      setMileageError('');
    } else if (selection === 'over120k') {
      setMileage('130000'); // Representative value over 120k
      setMileageError('');
    }
  };

  const toggleFaq = (index: number) => {
    setOpenFaqId(openFaqId === index ? null : index);
  };

  return (
    <div className="w-full">
      {/* Hero Section - Exact homepage design */}
      <section className="relative bg-gradient-to-br from-orange-50 via-white to-green-50 py-8 md:py-16 overflow-hidden">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="grid lg:grid-cols-2 gap-8 lg:gap-12 items-center">
            {/* Left Column - Content */}
            <div className="space-y-6">
              {/* Brand Logo */}
              {brandLogoUrl && (
                <div className="flex items-center gap-4 mb-4">
                  <img 
                    src={brandLogoUrl} 
                    alt={`${brandName} Logo`} 
                    className="h-12 md:h-16 w-auto object-contain"
                  />
                </div>
              )}

              {/* H1 Headline */}
              <h1 className="text-3xl md:text-4xl lg:text-5xl font-bold text-gray-900 leading-tight">
                {h1Headline}
              </h1>

              {/* Subheadline */}
              {heroContent?.subheadline && (
                <h2 className="text-xl md:text-2xl font-semibold text-gray-700">
                  {heroContent.subheadline}
                </h2>
              )}

              {/* Description */}
              {heroContent?.description && (
                <p className="text-lg text-gray-600">
                  {heroContent.description}
                </p>
              )}

              {/* Benefits List */}
              <div className="space-y-3">
                {benefits.map((benefit, index) => (
                  <div key={index} className="flex items-start gap-3">
                    <div className="flex-shrink-0 w-6 h-6 bg-green-100 rounded-full flex items-center justify-center">
                      <Check className="h-4 w-4 text-green-600" />
                    </div>
                    <span className="text-gray-700 font-medium">{benefit}</span>
                  </div>
                ))}
              </div>

              {/* Trust Indicators */}
              <div className="flex flex-wrap items-center gap-4 pt-4">
                <TrustpilotHeader className="flex-shrink-0" />
              </div>
            </div>

            {/* Right Column - Quote Form */}
            <div className="lg:pl-8" id="quote-form">
              <div className="bg-white rounded-2xl shadow-xl border border-gray-100 p-6 md:p-8">
                <div className="text-center mb-6">
                  <h3 className="text-2xl font-bold text-gray-900 mb-2">
                    Get Your Instant Quote
                  </h3>
                  <p className="text-gray-600">
                    Protect your {brandName} in under 60 seconds
                  </p>
                </div>

                <div className="space-y-4">
                  {/* Registration Input */}
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-2">
                      Vehicle Registration
                    </label>
                    <input
                      type="text"
                      value={regNumber}
                      onChange={(e) => setRegNumber(e.target.value.toUpperCase())}
                      placeholder="Enter reg (e.g. AB12 CDE)"
                      className={`w-full px-4 py-3 text-lg font-bold text-center uppercase tracking-wider border-2 rounded-lg focus:outline-none focus:ring-2 focus:ring-primary transition-all ${
                        vehicleAgeError ? 'border-red-500 bg-red-50' : 'border-gray-300 focus:border-primary'
                      }`}
                      style={{ fontFamily: 'monospace' }}
                    />
                    {vehicleAgeError && (
                      <p className="mt-2 text-sm text-red-600">{vehicleAgeError}</p>
                    )}
                  </div>

                  {/* Mileage Quick Select - Shows after reg entered */}
                  {showMileageField && (
                    <div className="animate-in fade-in slide-in-from-top-2 duration-300">
                      <MileageQuickSelect
                        value={mileageSelection}
                        onChange={handleMileageSelection}
                        onAutoSubmit={handleRegSubmit}
                        error={mileageError}
                        isLoading={isLookingUp}
                      />
                    </div>
                  )}

                  {/* Trust Text */}
                  <p className="text-center text-sm text-gray-500">
                    🔒 Your details are encrypted and safe
                  </p>
                </div>
              </div>

              {/* Featured Image */}
              {featuredImageUrl && (
                <div className="mt-6">
                  <img
                    src={featuredImageUrl}
                    alt={`${brandName} warranty coverage`}
                    className="w-full h-auto rounded-lg shadow-md"
                    loading="lazy"
                  />
                </div>
              )}
            </div>
          </div>
        </div>
      </section>

      {/* Warranty Benefits Section - Reuse homepage component */}
      <Suspense fallback={<div className="py-16 bg-gray-50 animate-pulse" />}>
        <WarrantyBenefitsSection />
      </Suspense>

      {/* Video Section - Reuse homepage component */}
      <Suspense fallback={<div className="py-16 animate-pulse" />}>
        <VideoSection scrollToQuoteForm={() => document.getElementById('quote-form')?.scrollIntoView({ behavior: 'smooth' })} />
      </Suspense>

      {/* Cover Clarity Section - Reuse homepage component */}
      <Suspense fallback={<div className="py-16 bg-gray-50 animate-pulse" />}>
        <CoverClaritySection />
      </Suspense>

      {/* Custom Coverage Section - Brand Specific */}
      {coverageContent && coverageContent.sections && coverageContent.sections.length > 0 && (
        <section className="py-16 bg-gradient-to-br from-blue-50 via-white to-orange-50">
          <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
            <h2 className="text-3xl md:text-4xl font-bold text-center mb-12">
              {coverageContent.title || `What Does Your ${brandName} Warranty Cover?`}
            </h2>

            <div className="grid md:grid-cols-3 gap-8">
              {coverageContent.sections.map((section, idx) => (
                <div key={idx} className="bg-white p-6 rounded-xl shadow-md border border-gray-100">
                  <h3 className="text-xl font-bold mb-4 flex items-center gap-2">
                    <Shield className="h-6 w-6 text-primary" />
                    {section.title}
                  </h3>
                  <ul className="space-y-3">
                    {section.items.map((item, itemIdx) => (
                      <li key={itemIdx} className="flex items-start gap-2">
                        <Check className="h-5 w-5 text-green-600 flex-shrink-0 mt-0.5" />
                        <span className="text-gray-700">{item}</span>
                      </li>
                    ))}
                  </ul>
                </div>
              ))}
            </div>
          </div>
        </section>
      )}

      {/* Testimonials Section */}
      {testimonialsContent && testimonialsContent.items && testimonialsContent.items.length > 0 && (
        <section className="py-16 bg-white">
          <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
            <h2 className="text-3xl md:text-4xl font-bold text-center mb-12">
              {testimonialsContent.title || `What ${brandName} Owners Say`}
            </h2>

            <div className="grid md:grid-cols-3 gap-8">
              {testimonialsContent.items.map((testimonial, idx) => (
                <div key={idx} className="bg-gray-50 p-6 rounded-xl">
                  <div className="flex gap-1 mb-4">
                    {Array.from({ length: testimonial.rating }).map((_, i) => (
                      <Star key={i} className="h-5 w-5 text-yellow-400 fill-current" />
                    ))}
                  </div>
                  <p className="text-gray-700 mb-4 italic">"{testimonial.text}"</p>
                  <p className="font-semibold text-gray-900">- {testimonial.name}</p>
                </div>
              ))}
            </div>
          </div>
        </section>
      )}

      {/* FAQ Section */}
      {faqs && faqs.length > 0 && (
        <section className="py-16 bg-gray-50">
          <div className="max-w-4xl mx-auto px-4 sm:px-6 lg:px-8">
            <h2 className="text-3xl md:text-4xl font-bold text-center mb-12">
              Frequently Asked Questions
            </h2>

            <div className="space-y-4">
              {faqs.map((faq, index) => (
                <div 
                  key={index}
                  className="bg-white border border-gray-200 rounded-lg overflow-hidden shadow-sm"
                >
                  <button
                    className="w-full flex items-center justify-between p-4 md:p-6 text-left hover:bg-gray-50 transition-colors"
                    onClick={() => toggleFaq(index)}
                  >
                    <span className="font-semibold text-gray-900 pr-4">{faq.question}</span>
                    {openFaqId === index ? (
                      <ChevronUp className="h-5 w-5 text-gray-500 flex-shrink-0" />
                    ) : (
                      <ChevronDown className="h-5 w-5 text-gray-500 flex-shrink-0" />
                    )}
                  </button>
                  {openFaqId === index && (
                    <div className="p-4 md:p-6 pt-0 text-gray-600 border-t bg-gray-50">
                      {faq.answer}
                    </div>
                  )}
                </div>
              ))}
            </div>
          </div>
        </section>
      )}

      {/* Homepage FAQ - Reuse component */}
      <Suspense fallback={<div className="py-16 animate-pulse" />}>
        <HomepageFAQ />
      </Suspense>

      {/* Internal Links Section */}
      {internalLinks && internalLinks.length > 0 && (
        <section className="py-8 bg-white border-t border-gray-200">
          <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
            <div className="flex flex-wrap justify-center gap-4">
              {internalLinks.map((link, index) => (
                <a
                  key={index}
                  href={link.url}
                  className="text-primary hover:text-primary/80 hover:underline transition-colors"
                >
                  {link.text}
                </a>
              ))}
            </div>
          </div>
        </section>
      )}

      {/* Final CTA Section */}
      <section className="py-16 bg-primary">
        <div className="max-w-4xl mx-auto px-4 sm:px-6 lg:px-8 text-center">
          <h2 className="text-3xl md:text-4xl font-bold text-white mb-4">
            Ready to Protect Your {brandName}?
          </h2>
          <p className="text-white/90 text-lg mb-8">
            Get an instant quote in under 60 seconds. No obligation, no hidden fees.
          </p>
          <div className="flex flex-col sm:flex-row gap-4 justify-center">
            <Button 
              size="lg" 
              variant="secondary"
              onClick={() => document.getElementById('quote-form')?.scrollIntoView({ behavior: 'smooth' })}
              className="bg-white text-primary hover:bg-gray-100 font-bold"
            >
              Get my instant quote <ArrowRight className="ml-2 h-5 w-5" />
            </Button>
            <Button 
              size="lg" 
              variant="outline"
              asChild
              className="border-white text-white hover:bg-white/10"
            >
              <a href="tel:03302295040">
                <Phone className="mr-2 h-5 w-5" />
                Call 0330 229 5040
              </a>
            </Button>
          </div>
        </div>
      </section>
    </div>
  );
};

export default HomepageLandingTemplate;
