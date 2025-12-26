import React, { useState } from 'react';
import { Link } from 'react-router-dom';
import { SEOHead } from '@/components/SEOHead';
import { Button } from '@/components/ui/button';
import { supabase } from '@/integrations/supabase/client';
import { useToast } from '@/hooks/use-toast';
import { MessageCircle, Mail, Phone } from 'lucide-react';
import AlternativeOptions from '@/components/cancel-warranty/AlternativeOptions';
import RefundEligibility from '@/components/cancel-warranty/RefundEligibility';
import RefundCalculator from '@/components/cancel-warranty/RefundCalculator';
import CancellationForm from '@/components/cancel-warranty/CancellationForm';
import StayOfferCard from '@/components/cancel-warranty/StayOfferCard';

const CancelWarranty = () => {
  const { toast } = useToast();
  const [isSuccess, setIsSuccess] = useState(false);
  const [isStaySuccess, setIsStaySuccess] = useState(false);
  const [submittedData, setSubmittedData] = useState<{ registrationPlate: string; fullName: string } | null>(null);
  const [isCancellingRequest, setIsCancellingRequest] = useState(false);

  const handleFormSuccess = (data: { registrationPlate: string; fullName: string }) => {
    setSubmittedData(data);
    setIsSuccess(true);
    window.scrollTo({ top: 0, behavior: 'smooth' });
  };

  const handleStaySuccess = () => {
    setIsStaySuccess(true);
    window.scrollTo({ top: 0, behavior: 'smooth' });
  };

  const handleKeepWarranty = async () => {
    if (!submittedData) return;
    setIsCancellingRequest(true);
    
    try {
      await supabase.functions.invoke('submit-cancellation', {
        body: {
          registrationPlate: submittedData.registrationPlate,
          fullName: submittedData.fullName,
          reason: 'CANCELLATION_WITHDRAWN',
          feedback: 'Customer has changed their mind and wishes to keep their warranty.'
        }
      });
      toast({ title: "Great news!", description: "Your warranty will remain active." });
      window.location.href = '/';
    } catch {
      toast({ title: "Request Failed", description: "Please contact support@buyawarranty.co.uk", variant: "destructive" });
    } finally {
      setIsCancellingRequest(false);
    }
  };

  // Stay success screen
  if (isStaySuccess) {
    return (
      <>
        <SEOHead title="Welcome Back! - Buy a Warranty" description="Thank you for staying with us" />
        <div className="min-h-screen bg-white py-16 px-4">
          <div className="max-w-2xl mx-auto bg-green-50 border-2 border-green-500 rounded-xl p-8 text-center">
            <div className="text-6xl mb-4">🎉</div>
            <h1 className="text-3xl font-bold text-gray-900 mb-4">Welcome Back!</h1>
            <p className="text-lg text-gray-700 mb-6">Your warranty is <strong className="text-green-600">fully active</strong>. We'll add <strong className="text-green-600">3 months FREE cover</strong> within 2-3 working days.</p>
            <Link to="/"><Button className="bg-green-600 hover:bg-green-700">Return to Homepage</Button></Link>
          </div>
        </div>
      </>
    );
  }

  // Cancellation success screen
  if (isSuccess) {
    return (
      <>
        <SEOHead title="Request Received - Buy a Warranty" description="Your cancellation request has been received" />
        <div className="min-h-screen bg-white py-16 px-4">
          <div className="max-w-2xl mx-auto space-y-6">
            <div className="bg-green-50 border-2 border-green-500 rounded-xl p-8 text-center">
              <div className="text-5xl mb-4">✅</div>
              <h1 className="text-2xl font-bold text-gray-900 mb-4">Your Request Has Been Received</h1>
              <p className="text-gray-700">We'll confirm within <strong>2 working days</strong>. Cooling-off refunds are processed within 5 working days; pro-rata refunds within 7 working days.</p>
            </div>
            <div className="bg-orange-50 border-2 border-orange-400 rounded-xl p-6 text-center">
              <h2 className="text-xl font-bold text-gray-900 mb-4">Changed your mind?</h2>
              <Button onClick={handleKeepWarranty} disabled={isCancellingRequest} className="bg-orange-500 hover:bg-orange-600">
                {isCancellingRequest ? 'Processing...' : '👉 Keep My Warranty'}
              </Button>
            </div>
            <div className="text-center"><Link to="/" className="text-gray-500 hover:underline">Return to Homepage</Link></div>
          </div>
        </div>
      </>
    );
  }

  return (
    <>
      <SEOHead
        title="Cancel Your Warranty - Quick & Fair | Buy a Warranty"
        description="If your plans have changed, we're here to help. Cancel your warranty with a fair, transparent process. Use our refund calculator to see your eligibility."
        keywords="cancel warranty, warranty cancellation, cooling off period, refund policy, pro-rata refund"
      />

      <div className="min-h-screen bg-white">
        {/* Hero Section */}
        <section className="bg-gradient-to-b from-gray-50 to-white py-16 px-4">
          <div className="max-w-4xl mx-auto text-center">
            <h1 className="text-4xl lg:text-5xl font-bold text-gray-900 mb-6">
              If your plans have changed, we're here to help
            </h1>
            <p className="text-xl text-gray-600 mb-8">
              Cancelling your warranty is quick and fair – we'll guide you step by step.
            </p>
            <div className="flex flex-wrap gap-4 justify-center">
              <Button variant="outline" className="h-12 px-6" onClick={() => document.getElementById('alternatives')?.scrollIntoView({ behavior: 'smooth' })}>
                See Money-Saving Options
              </Button>
              <Button className="h-12 px-6 bg-gray-800 hover:bg-gray-900" onClick={() => document.getElementById('form-section')?.scrollIntoView({ behavior: 'smooth' })}>
                Start Cancellation
              </Button>
            </div>
          </div>
        </section>

        {/* Alternative Options */}
        <div id="alternatives"><AlternativeOptions /></div>

        {/* Refund Eligibility */}
        <RefundEligibility />

        {/* Calculator & Form Section */}
        <section id="form-section" className="py-12 px-4 bg-gray-50">
          <div className="max-w-6xl mx-auto">
            <div className="text-center mb-10">
              <h2 className="text-3xl lg:text-4xl font-bold text-gray-900 mb-4">Ready to Cancel?</h2>
              <p className="text-lg text-gray-600">Use our calculator to estimate your refund, then submit your request</p>
            </div>
            <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
              <div className="lg:col-span-2 space-y-8">
                <RefundCalculator />
                <CancellationForm onSuccess={handleFormSuccess} />
              </div>
              <div><StayOfferCard onStaySuccess={handleStaySuccess} /></div>
            </div>
          </div>
        </section>

        {/* Need Help */}
        <section className="py-12 px-4">
          <div className="max-w-4xl mx-auto bg-white rounded-xl border-2 border-gray-200 p-8 text-center">
            <h2 className="text-2xl font-bold text-gray-900 mb-4">Need Help?</h2>
            <p className="text-gray-600 mb-6">Our friendly team is here to assist you with any questions.</p>
            <div className="flex flex-wrap gap-4 justify-center">
              <a href="mailto:support@buyawarranty.co.uk" className="flex items-center gap-2 px-6 py-3 bg-orange-100 text-orange-700 rounded-lg font-medium hover:bg-orange-200">
                <Mail className="w-5 h-5" /> support@buyawarranty.co.uk
              </a>
              <a href="tel:03302295045" className="flex items-center gap-2 px-6 py-3 bg-gray-100 text-gray-700 rounded-lg font-medium hover:bg-gray-200">
                <Phone className="w-5 h-5" /> 0330 229 5045
              </a>
            </div>
          </div>
        </section>
      </div>
    </>
  );
};

export default CancelWarranty;
