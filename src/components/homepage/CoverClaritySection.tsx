import React, { useState, useEffect } from 'react';
import { Check, CheckCircle, ChevronDown, Shield, ArrowRight } from 'lucide-react';
import { Collapsible, CollapsibleContent, CollapsibleTrigger } from '@/components/ui/collapsible';
import { Button } from '@/components/ui/button';
import { supabase } from '@/integrations/supabase/client';

const CoverClaritySection = () => {
  const [platinumDocUrl, setPlatinumDocUrl] = useState<string | null>(null);
  const [termsDocUrl, setTermsDocUrl] = useState<string | null>(null);

  useEffect(() => {
    const fetchDocumentUrls = async () => {
      try {
        // Fetch Platinum Plan document - same query as PricingTable
        const { data: platinumData } = await supabase
          .from('customer_documents')
          .select('file_url')
          .eq('plan_type', 'platinum')
          .order('created_at', { ascending: false })
          .limit(1)
          .single();
        
        if (platinumData?.file_url) {
          setPlatinumDocUrl(platinumData.file_url);
        }

        // Fetch Terms & Conditions document
        const { data: termsData } = await supabase
          .from('customer_documents')
          .select('file_url')
          .eq('plan_type', 'terms-and-conditions')
          .order('created_at', { ascending: false })
          .limit(1)
          .single();
        
        if (termsData?.file_url) {
          setTermsDocUrl(termsData.file_url);
        }
      } catch (error) {
        console.error('Error fetching document URLs:', error);
      }
    };

    fetchDocumentUrls();
  }, []);

  return (
    <section className="py-10 md:py-16 bg-gray-50">
      <div className="max-w-5xl mx-auto px-4 sm:px-6 lg:px-8">
        {/* Section Header */}
        <div className="text-center mb-8">
          <div className="inline-flex items-center gap-2 bg-green-50 border border-green-200 rounded-full px-4 py-2 mb-4">
            <Shield className="w-5 h-5 text-green-600" />
            <span className="text-sm font-semibold text-green-700">Transparent Coverage</span>
          </div>
          <h2 className="text-2xl md:text-3xl font-bold text-brand-dark-text mb-3">
            Your cover, made <span className="text-brand-orange">crystal clear</span>
          </h2>
          <p className="text-base md:text-lg text-gray-600 max-w-2xl mx-auto">
            See what's included - clear terms, no jargon, no surprises.
          </p>
        </div>
        
        {/* Collapsible Items */}
        <div className="space-y-3">
          <Collapsible>
            <CollapsibleTrigger className="flex items-center justify-between w-full bg-gradient-to-r from-orange-50 to-orange-100/50 hover:from-orange-100 hover:to-orange-100 rounded-lg px-5 py-4 transition-all duration-200 group border border-orange-200/50">
              <div className="flex items-center gap-3">
                <div className="w-8 h-8 bg-brand-orange rounded-full flex items-center justify-center">
                  <CheckCircle className="w-5 h-5 text-white" />
                </div>
                <span className="font-semibold text-brand-dark-text text-lg md:text-xl">Comprehensive Platinum Plan</span>
              </div>
              <ChevronDown className="w-10 h-10 text-brand-orange transition-transform duration-200 group-data-[state=open]:rotate-180" />
            </CollapsibleTrigger>
            <CollapsibleContent className="pt-3">
              <div className="bg-gray-50 rounded-lg p-5 border border-gray-100">
                <p className="text-gray-700 text-sm md:text-base leading-relaxed mb-4">
                  The Platinum Plan provides comprehensive coverage for your vehicle and complete peace of mind.
                </p>
                <ul className="text-gray-700 text-sm md:text-base space-y-2 mb-4">
                  <li className="flex items-start gap-2">
                    <Check className="w-5 h-5 text-green-500 mt-0.5 flex-shrink-0" />
                    <span>Fast and easy claims</span>
                  </li>
                  <li className="flex items-start gap-2">
                    <Check className="w-5 h-5 text-green-500 mt-0.5 flex-shrink-0" />
                    <span>Fault diagnostics included</span>
                  </li>
                  <li className="flex items-start gap-2">
                    <Check className="w-5 h-5 text-green-500 mt-0.5 flex-shrink-0" />
                    <span>Consequential damage protection</span>
                  </li>
                  <li className="flex items-start gap-2">
                    <Check className="w-5 h-5 text-green-500 mt-0.5 flex-shrink-0" />
                    <span>14-day money-back guarantee</span>
                  </li>
                </ul>
                {platinumDocUrl ? (
                  <a 
                    href={platinumDocUrl} 
                    target="_blank" 
                    rel="noopener noreferrer"
                    className="text-brand-orange hover:text-orange-600 font-medium text-base underline"
                  >
                    View Full Platinum Plan Details
                  </a>
                ) : (
                  <span className="text-gray-400 font-medium text-sm">Loading PDF...</span>
                )}
              </div>
            </CollapsibleContent>
          </Collapsible>

          <Collapsible>
            <CollapsibleTrigger className="flex items-center justify-between w-full bg-gradient-to-r from-green-50 to-green-100/50 hover:from-green-100 hover:to-green-100 rounded-lg px-5 py-4 transition-all duration-200 group border border-green-200/50">
              <div className="flex items-center gap-3">
                <div className="w-8 h-8 bg-green-600 rounded-full flex items-center justify-center">
                  <CheckCircle className="w-5 h-5 text-white" />
                </div>
                <span className="font-semibold text-brand-dark-text text-lg md:text-xl">Terms & Conditions</span>
              </div>
              <ChevronDown className="w-10 h-10 text-green-600 transition-transform duration-200 group-data-[state=open]:rotate-180" />
            </CollapsibleTrigger>
            <CollapsibleContent className="pt-3">
              <div className="bg-gray-50 rounded-lg p-5 border border-gray-100">
                <p className="text-gray-700 text-sm md:text-base leading-relaxed mb-4">
                  Clear, straightforward terms designed to protect you and give you peace of mind. No hidden surprises.
                </p>
                {termsDocUrl ? (
                  <a 
                    href={termsDocUrl} 
                    target="_blank" 
                    rel="noopener noreferrer"
                    className="text-green-600 hover:text-green-700 font-medium text-base underline"
                  >
                    View Full Terms and Conditions
                  </a>
                ) : (
                  <span className="text-gray-400 font-medium text-sm">Loading PDF...</span>
                )}
              </div>
            </CollapsibleContent>
          </Collapsible>
        </div>

        {/* Get My Quote CTA */}
        <div className="flex justify-center mt-8">
          <Button 
            onClick={() => window.scrollTo({ top: 0, behavior: 'smooth' })}
            className="bg-brand-orange text-white font-bold px-6 md:px-10 py-4 md:py-6 rounded-lg text-lg md:text-xl flex items-center gap-3 shadow-lg animate-breathing"
          >
            Get my quote
            <ArrowRight className="w-5 h-5 md:w-6 md:h-6" />
          </Button>
        </div>
      </div>
    </section>
  );
};

export default CoverClaritySection;
