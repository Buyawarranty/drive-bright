import React, { useState, useEffect } from 'react';
import { Check, CheckCircle, ChevronDown } from 'lucide-react';
import { Collapsible, CollapsibleContent, CollapsibleTrigger } from '@/components/ui/collapsible';
import { supabase } from '@/integrations/supabase/client';

const CoverClaritySection = () => {
  const [platinumDocUrl, setPlatinumDocUrl] = useState<string | null>(null);
  const [termsDocUrl, setTermsDocUrl] = useState<string | null>(null);

  useEffect(() => {
    const fetchDocumentUrls = async () => {
      try {
        // Fetch Platinum Plan document
        const { data: platinumData } = await supabase
          .from('customer_documents')
          .select('file_url')
          .eq('plan_type', 'Platinum')
          .eq('vehicle_type', 'car')
          .single();
        
        if (platinumData?.file_url) {
          setPlatinumDocUrl(platinumData.file_url);
        }

        // Fetch Terms & Conditions document
        const { data: termsData } = await supabase
          .from('customer_documents')
          .select('file_url')
          .eq('document_name', 'Terms and Conditions')
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
    <section className="py-8 md:py-12 bg-gray-50">
      <div className="max-w-3xl mx-auto px-4 sm:px-6 lg:px-8">
        <div className="bg-white rounded-lg p-6 md:p-8 border border-gray-200 shadow-sm">
          <div className="mb-6">
            <div className="flex items-center justify-between mb-4">
              <h3 className="text-xl font-semibold text-foreground">
                Your cover, made crystal clear 🛡️
              </h3>
            </div>
            
            <div className="flex items-start gap-2">
              <Check className="h-5 w-5 text-green-500 mt-1 flex-shrink-0" strokeWidth={3} />
              <p className="text-black text-lg font-medium">
                See what's included - clear terms, no jargon, no surprises.
              </p>
            </div>
          </div>
          
          <div className="space-y-4">
            <Collapsible>
              <CollapsibleTrigger className="flex items-center gap-3 w-full text-left text-orange-500 hover:text-orange-600 font-semibold py-3 transition-colors text-lg group">
                <ChevronDown className="w-5 h-5 transition-transform duration-200 group-data-[state=open]:rotate-180" />
                <span>Your Platinum Plan</span>
              </CollapsibleTrigger>
              <CollapsibleContent className="pt-4 pl-7">
                <div className="bg-gray-50 rounded-lg p-6 border border-gray-200 shadow-sm">
                  <p className="text-gray-700 text-base leading-relaxed mb-4">
                    The Platinum Plan provides comprehensive coverage for your vehicle and complete peace of mind. Key features include:
                  </p>
                  <ul className="text-gray-700 text-base space-y-2 mb-4">
                    <li className="flex items-start gap-2">
                      <CheckCircle className="w-5 h-5 text-green-500 mt-0.5 flex-shrink-0" />
                      <span>Fast and easy claims</span>
                    </li>
                    <li className="flex items-start gap-2">
                      <CheckCircle className="w-5 h-5 text-green-500 mt-0.5 flex-shrink-0" />
                      <span>Fault diagnostics</span>
                    </li>
                    <li className="flex items-start gap-2">
                      <CheckCircle className="w-5 h-5 text-green-500 mt-0.5 flex-shrink-0" />
                      <span>Consequential damage protection</span>
                    </li>
                    <li className="flex items-start gap-2">
                      <CheckCircle className="w-5 h-5 text-green-500 mt-0.5 flex-shrink-0" />
                      <span>14-day money-back guarantee</span>
                    </li>
                  </ul>
                  {platinumDocUrl ? (
                    <a 
                      href={platinumDocUrl} 
                      target="_blank" 
                      rel="noopener noreferrer"
                      className="text-blue-600 hover:text-blue-800 font-medium text-base underline"
                    >
                      View Full Platinum Plan Details
                    </a>
                  ) : (
                    <span className="text-gray-400 font-medium text-base">Loading PDF...</span>
                  )}
                </div>
              </CollapsibleContent>
            </Collapsible>

            <Collapsible>
              <CollapsibleTrigger className="flex items-center gap-3 w-full text-left text-orange-500 hover:text-orange-600 font-semibold py-3 transition-colors text-lg group">
                <ChevronDown className="w-5 h-5 transition-transform duration-200 group-data-[state=open]:rotate-180" />
                <span>Terms & Conditions</span>
              </CollapsibleTrigger>
              <CollapsibleContent className="pt-4 pl-7">
                <div className="bg-gray-50 rounded-lg p-6 border border-gray-200 shadow-sm">
                  <p className="text-gray-700 text-base leading-relaxed mb-4">
                    Clear, straightforward terms designed to protect you and give you peace of mind.
                  </p>
                  {termsDocUrl ? (
                    <a 
                      href={termsDocUrl} 
                      target="_blank" 
                      rel="noopener noreferrer"
                      className="text-blue-600 hover:text-blue-800 font-medium text-base underline"
                    >
                      View Full Terms and Conditions
                    </a>
                  ) : (
                    <span className="text-gray-400 font-medium text-base">Loading PDF...</span>
                  )}
                </div>
              </CollapsibleContent>
            </Collapsible>
          </div>
        </div>
      </div>
    </section>
  );
};

export default CoverClaritySection;
