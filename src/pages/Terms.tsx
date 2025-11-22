import React, { useState, useEffect } from 'react';
import { Link } from 'react-router-dom';
import { ChevronDown, Phone, Mail, Shield, FileText, Clock, Users, Menu } from 'lucide-react';
import { SEOHead } from '@/components/SEOHead';
import { Button } from '@/components/ui/button';
import { Sheet, SheetContent, SheetTrigger } from '@/components/ui/sheet';
import { supabase } from '@/integrations/supabase/client';

const Terms = () => {
  const [openItems, setOpenItems] = useState<{ [key: string]: boolean }>({});
  const [isMobileMenuOpen, setIsMobileMenuOpen] = useState(false);
  const [termsDocUrl, setTermsDocUrl] = useState<string>('');

  useEffect(() => {
    const fetchTermsDoc = async () => {
      const { data, error } = await supabase
        .from('customer_documents')
        .select('file_url')
        .eq('plan_type', 'terms-and-conditions')
        .order('created_at', { ascending: false })
        .limit(1)
        .single();
      
      if (data && !error) {
        setTermsDocUrl(data.file_url);
      }
    };
    
    fetchTermsDoc();
  }, []);

  const toggleItem = (id: string) => {
    setOpenItems(prev => ({
      ...prev,
      [id]: !prev[id]
    }));
  };

  const TermsAccordionItem = ({ item }: { item: any }) => (
    <div className="bg-brand-orange rounded-lg overflow-hidden shadow-lg border border-orange-400 mb-4">
      <button
        onClick={() => toggleItem(item.id)}
        className="w-full px-6 py-5 text-left flex items-center justify-between text-white hover:bg-orange-600 transition-colors"
      >
        <span className="font-bold text-lg pr-4">{item.title}</span>
        <ChevronDown 
          className={`w-6 h-6 flex-shrink-0 transition-transform duration-300 text-white ${
            openItems[item.id] ? 'rotate-180' : ''
          }`}
        />
      </button>
      
      {openItems[item.id] && (
        <div className="px-6 pb-6 text-gray-800 bg-white border-t border-orange-400 animate-accordion-down">
          <div className="pt-6">
            {item.content}
          </div>
        </div>
      )}
    </div>
  );

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
            Covers vehicles up to 15 years old and 150,000 miles. 30-day waiting period applies.
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
        title="Terms & Conditions | Buy A Warranty - Vehicle Warranty Terms"
        description="Read our comprehensive terms and conditions for vehicle warranty coverage."
        keywords="terms and conditions, warranty terms, vehicle warranty"
        canonical={`${window.location.origin}/terms`}
      />

      {/* Header Section */}
      <div className="bg-white border-b border-gray-200">
        <div className="max-w-6xl mx-auto px-4 py-8">
          <div className="flex items-center mb-4">
            <Link to="/" className="text-brand-orange hover:text-orange-600 transition-colors text-sm font-medium">
              ← Back to Home
            </Link>
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
        <div className="mb-8 text-center">
          {termsDocUrl ? (
            <a 
              href={termsDocUrl} 
              target="_blank" 
              rel="noopener noreferrer"
              className="inline-flex items-center bg-brand-orange text-white px-6 py-3 rounded-full font-semibold hover:bg-orange-600 transition-colors"
            >
              <FileText className="w-5 h-5 mr-2" />
              <div className="text-center">
                <div>Your Extended Warranty Guide</div>
                <div className="text-sm opacity-90">See full terms and conditions (PDF)</div>
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