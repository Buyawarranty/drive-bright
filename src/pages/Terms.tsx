import React, { useState, useEffect } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { ChevronDown, Phone, Mail, Shield, FileText, Clock, Users, Menu, ArrowLeft } from 'lucide-react';
import { SEOHead } from '@/components/SEOHead';
import { Button } from '@/components/ui/button';
import { Sheet, SheetContent, SheetTrigger } from '@/components/ui/sheet';
import { supabase } from '@/integrations/supabase/client';

const Terms = () => {
  const [openItems, setOpenItems] = useState<{ [key: string]: boolean }>({});
  const [isMobileMenuOpen, setIsMobileMenuOpen] = useState(false);
  const [termsDocUrl, setTermsDocUrl] = useState<string>('');
  const [platinumDocUrl, setPlatinumDocUrl] = useState<string>('');
  const navigate = useNavigate();
  useEffect(() => {
    const fetchDocs = async () => {
      const { data: termsData } = await supabase
        .from('customer_documents')
        .select('file_url')
        .eq('plan_type', 'terms-and-conditions')
        .order('created_at', { ascending: false })
        .limit(1)
        .single();
      if (termsData?.file_url) setTermsDocUrl(termsData.file_url);

      const { data: platinumData } = await supabase
        .from('customer_documents')
        .select('file_url')
        .eq('plan_type', 'platinum')
        .order('created_at', { ascending: false })
        .limit(1)
        .single();
      if (platinumData?.file_url) setPlatinumDocUrl(platinumData.file_url);
    };

    fetchDocs();
  }, []);

  const toggleItem = (id: string) => {
    setOpenItems(prev => ({
      ...prev,
      [id]: !prev[id]
    }));
  };

  const TermsAccordionItem = ({ item }: { item: any }) => {
    const open = !!openItems[item.id];
    return (
      <div
        className={`bg-white rounded-[14px] overflow-hidden border border-[#DCE3EC] border-l-4 border-l-[#FFB580] shadow-[0_4px_14px_rgba(15,23,42,0.04)] mb-3 transition-all ${
          open
            ? 'bg-[#FFF9F4] border-[#FFB278] shadow-[0_8px_22px_rgba(15,23,42,0.07)]'
            : 'hover:bg-[#FFF9F4] hover:border-[#FFB278] hover:shadow-[0_8px_22px_rgba(15,23,42,0.07)]'
        }`}
      >
        <button
          onClick={() => toggleItem(item.id)}
          className="group w-full px-6 md:px-[30px] py-6 text-left flex items-center justify-between gap-3"
        >
          <span className="font-semibold text-base md:text-lg text-gray-900 pr-2">{item.title}</span>
          <span
            className={`flex items-center justify-center w-8 h-8 rounded-full transition-colors flex-shrink-0 ${
              open ? 'bg-[#FFE8D6]' : 'bg-transparent group-hover:bg-[#FFE8D6]'
            }`}
          >
            <ChevronDown
              className={`w-4 h-4 text-[#F97316] transition-transform duration-300 ${open ? 'rotate-180' : ''}`}
            />
          </span>
        </button>

        {open && (
          <div className="px-6 md:px-[30px] pb-6 text-gray-700 animate-accordion-down">
            <div className="pt-2 border-t border-[#DCE3EC]">
              <div className="pt-4">{item.content}</div>
            </div>
          </div>
        )}
      </div>
    );
  };


  const termsContent = [
    {
      id: 'introduction',
      title: 'Introduction & Our Promise',
      content: (
        <div className="space-y-6">
          <div className="space-y-4">
            <p className="text-gray-600">
              We know how important peace of mind is when it comes to car ownership, and that's exactly what we're here to provide.
            </p>
            <p className="text-gray-600">
              With our warranty cover, you're backed by a reliable service that includes comprehensive protection for mechanical and electrical repairs, quick claims payouts, and access to trusted garages across the UK.
            </p>
            <p className="text-gray-600">
              We're committed to making things simple, fair and stress-free - so if something goes wrong, we'll be here to help get you back on the road as quickly as possible.
            </p>
          </div>
        </div>
      )
    },
    {
      id: 'warranty-confirmation',
      title: 'Warranty Confirmation & Coverage',
      content: (
        <div className="space-y-6">
          <p className="text-gray-600">
            Warranty is confirmed when you receive your confirmation email and payment is received.
          </p>
        </div>
      )
    },
    {
      id: 'conditions',
      title: 'Conditions & Requirements',
      content: (
        <div className="space-y-6">
          <p className="text-gray-600">
            Covers vehicles up to 15 years old and 150,000 miles. Cover begins immediately; pre-existing faults are excluded.
          </p>
        </div>
      )
    },
    {
      id: 'cancellation',
      title: 'Cancellation Rights & Refunds',
      content: (
        <div className="space-y-6">
          <p className="text-gray-600">
            14-day cooling off period with full refund if no claims made.
          </p>
        </div>
      )
    }
  ];

  return (
    <div className="min-h-screen bg-gray-50">
      <SEOHead 
        title="Car Warranty Terms UK | Full Conditions Explained | BuyA Warranty"
        description="Full car warranty terms and conditions explained by BuyA Warranty UK. Clear details on coverage, exclusions, cancellations and your customer rights."
        keywords="terms and conditions, warranty terms, vehicle warranty"
        canonical={`${window.location.origin}/terms`}
      />

      {/* Header Section */}
      <div className="bg-white border-b border-gray-200">
        <div className="max-w-6xl mx-auto px-4 py-8">
          <div className="flex items-center mb-4">
            <button 
              onClick={() => navigate(-1)}
              className="flex items-center gap-2 text-sm font-medium py-2 px-3 rounded-lg transition-all duration-200 bg-gray-100 hover:bg-gray-200 text-gray-700"
            >
              <ArrowLeft className="w-4 h-4" />
              Back
            </button>
          </div>
          
          <div className="text-center">
            <h1 className="text-4xl font-bold text-gray-900 mb-4">
              Terms & Conditions
            </h1>
            <p className="text-xl text-gray-600 max-w-3xl mx-auto leading-relaxed">
              Simple and Clear - Your Extended Warranty Guide. Everything you need to know about your vehicle warranty coverage explained in plain language.
            </p>
          </div>
        </div>
      </div>

      {/* Main Content */}
      <div className="max-w-6xl mx-auto px-4 py-12">
        <div className="mb-8 flex flex-col sm:flex-row gap-4 justify-center items-center">
          {termsDocUrl ? (
            <a 
              href={termsDocUrl} 
              target="_blank" 
              rel="noopener noreferrer"
              className="inline-flex items-center bg-brand-orange text-white px-6 py-3 rounded-full font-semibold hover:bg-orange-600 transition-colors"
            >
              <FileText className="w-5 h-5 mr-2" />
              <div className="text-center">
              <div>Terms and Conditions</div>
                <div className="text-sm opacity-90">Extended Warranty Guide (PDF)</div>
              </div>
            </a>
          ) : (
            <div className="inline-flex items-center bg-gray-400 text-white px-6 py-3 rounded-full font-semibold cursor-not-allowed">
              <FileText className="w-5 h-5 mr-2" />
              <div className="text-center">
                <div>Loading document...</div>
              </div>
            </div>
          )}

          {platinumDocUrl ? (
            <a 
              href={platinumDocUrl} 
              target="_blank" 
              rel="noopener noreferrer"
              className="inline-flex items-center bg-green-600 text-white px-6 py-3 rounded-full font-semibold hover:bg-green-700 transition-colors"
            >
              <Shield className="w-5 h-5 mr-2" />
              <div className="text-center">
                <div>Platinum Warranty Plan</div>
                <div className="text-sm opacity-90">See what's covered (PDF)</div>
              </div>
            </a>
          ) : (
            <Link
              to="/what-is-covered"
              className="inline-flex items-center bg-green-600 text-white px-6 py-3 rounded-full font-semibold hover:bg-green-700 transition-colors"
            >
              <Shield className="w-5 h-5 mr-2" />
              <div className="text-center">
                <div>Platinum Warranty Plan</div>
                <div className="text-sm opacity-90">See what's covered</div>
              </div>
            </Link>
          )}
        </div>

        {/* Terms Accordions */}
        <div className="space-y-4">
          {termsContent.map((item) => (
            <TermsAccordionItem key={item.id} item={item} />
          ))}
        </div>

        {/* Contact Section */}
        <div className="mt-12 bg-white rounded-xl border border-gray-200 p-8">
          <h2 className="text-2xl font-bold text-gray-900 mb-6 text-center">Contact Information</h2>
          <div className="grid md:grid-cols-2 gap-8">
            <div className="text-center">
              <Phone className="w-8 h-8 text-brand-orange mx-auto mb-4" />
              <h4 className="text-xl font-bold text-gray-900 mb-4">Customer Service</h4>
              <a href="tel:03302295040" className="text-2xl font-bold text-brand-orange hover:text-orange-600 transition-colors">
                0330 229 5040
              </a>
            </div>
            <div className="text-center">
              <Mail className="w-8 h-8 text-brand-orange mx-auto mb-4" />
              <h4 className="text-xl font-bold text-gray-900 mb-4">Email Support</h4>
              <a href="mailto:support@buyawarranty.co.uk" className="text-lg font-semibold text-brand-orange hover:text-orange-600 transition-colors">
                support@buyawarranty.co.uk
              </a>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};

export default Terms;