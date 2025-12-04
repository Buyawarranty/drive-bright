import React, { useState } from 'react';
import { Link } from 'react-router-dom';
import { SEOHead } from '@/components/SEOHead';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { useToast } from '@/hooks/use-toast';
import { supabase } from '@/integrations/supabase/client';
import pandaVehicles from '@/assets/panda-vehicles.png';

const CancelWarranty = () => {
  const { toast } = useToast();
  
  const [formData, setFormData] = useState({
    registrationPlate: '',
    fullName: '',
    reason: '',
    feedback: ''
  });
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [isSuccess, setIsSuccess] = useState(false);
  const [isCancellingRequest, setIsCancellingRequest] = useState(false);
  const [errors, setErrors] = useState<{[key: string]: string}>({});
  const [submittedData, setSubmittedData] = useState<{registrationPlate: string; fullName: string} | null>(null);

  const handleInputChange = (e: React.ChangeEvent<HTMLInputElement | HTMLTextAreaElement>) => {
    const { name, value } = e.target;
    
    setFormData({
      ...formData,
      [name]: value
    });

    // Clear errors when user starts typing
    if (errors[name]) {
      setErrors({
        ...errors,
        [name]: ''
      });
    }
  };

  const handleReasonChange = (value: string) => {
    setFormData({
      ...formData,
      reason: value
    });

    // Clear errors when user selects
    if (errors.reason) {
      setErrors({
        ...errors,
        reason: ''
      });
    }
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    
    // Validate required fields
    const newErrors: {[key: string]: string} = {};
    
    if (!formData.registrationPlate.trim()) {
      newErrors.registrationPlate = 'Registration plate is required';
    }
    
    if (!formData.fullName.trim()) {
      newErrors.fullName = 'Full name is required';
    }
    
    if (!formData.reason) {
      newErrors.reason = 'Please select a reason for cancellation';
    }
    
    if (Object.keys(newErrors).length > 0) {
      setErrors(newErrors);
      toast({
        title: "Please check your information",
        description: "Please fill in all required fields.",
        variant: "destructive",
      });
      return;
    }

    setIsSubmitting(true);
    
    try {
      const response = await supabase.functions.invoke('submit-cancellation', {
        body: {
          registrationPlate: formData.registrationPlate,
          fullName: formData.fullName,
          reason: formData.reason,
          feedback: formData.feedback
        }
      });

      if (response.error) {
        throw new Error(response.error.message || 'Failed to submit cancellation request');
      }

      // Store submitted data for potential "Keep My Warranty" action
      setSubmittedData({
        registrationPlate: formData.registrationPlate,
        fullName: formData.fullName
      });

      // Show success message
      setIsSuccess(true);
      
      // Reset form
      setFormData({
        registrationPlate: '',
        fullName: '',
        reason: '',
        feedback: ''
      });
      setErrors({});

      // Scroll to top to show success message
      window.scrollTo({ top: 0, behavior: 'smooth' });
      
    } catch (error: any) {
      console.error('Submission error:', error);
      toast({
        title: "Submission Failed",
        description: error.message || "Please try again or contact us directly.",
        variant: "destructive",
      });
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleKeepWarranty = async () => {
    if (!submittedData) return;
    
    setIsCancellingRequest(true);
    
    try {
      const response = await supabase.functions.invoke('submit-cancellation', {
        body: {
          registrationPlate: submittedData.registrationPlate,
          fullName: submittedData.fullName,
          reason: 'CANCELLATION_WITHDRAWN',
          feedback: 'Customer has changed their mind and wishes to keep their warranty. Please disregard previous cancellation request.'
        }
      });

      if (response.error) {
        throw new Error(response.error.message || 'Failed to process request');
      }

      toast({
        title: "Great news!",
        description: "Your warranty will remain active. Welcome back!",
      });
      
      // Navigate to homepage
      window.location.href = '/';
      
    } catch (error: any) {
      console.error('Keep warranty error:', error);
      toast({
        title: "Request Failed",
        description: "Please contact us directly at support@buyawarranty.co.uk",
        variant: "destructive",
      });
    } finally {
      setIsCancellingRequest(false);
    }
  };

  if (isSuccess) {
    return (
      <>
        <SEOHead
          title="Cancellation Request Received - Buy a Warranty"
          description="Your warranty cancellation request has been received"
        />

        <div className="min-h-screen bg-white">
          <div className="max-w-4xl mx-auto px-4 py-16">
            {/* Success Message */}
            <div className="bg-green-50 border-2 border-green-500 rounded-xl p-8 text-center mb-8">
              <div className="w-16 h-16 bg-green-500 rounded-full flex items-center justify-center mx-auto mb-4">
                <svg className="w-8 h-8 text-white" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M5 13l4 4L19 7" />
                </svg>
              </div>
              <h1 className="text-2xl lg:text-3xl font-bold text-gray-900 mb-4">
                ✅ Your Cancellation Request Has Been Received
              </h1>
              <p className="text-lg text-gray-700 mb-3">
                Our Accounts Team will review your request and process it within <strong>5 working days</strong>.
              </p>
              <p className="text-gray-600">
                Thank you for your patience.
              </p>
            </div>

            {/* Changed your mind section */}
            <div className="bg-orange-50 border-2 border-orange-400 rounded-xl p-8 text-center">
              <h2 className="text-xl font-bold text-gray-900 mb-4">
                Changed your mind? We'd love to have you back!
              </h2>
              <Button
                onClick={handleKeepWarranty}
                disabled={isCancellingRequest}
                className="bg-orange-500 hover:bg-orange-600 text-white font-semibold text-lg px-8 py-3 h-auto"
              >
                {isCancellingRequest ? 'Processing...' : '👉 Keep My Warranty'}
              </Button>
            </div>

            {/* Return to homepage link */}
            <div className="text-center mt-8">
              <Link to="/" className="text-gray-500 hover:text-gray-700 underline">
                Return to Homepage
              </Link>
            </div>
          </div>
        </div>
      </>
    );
  }

  return (
    <>
      <SEOHead
        title="Cancel Your Warranty - Buy a Warranty"
        description="Need to cancel your warranty? Simple process with clear terms. Submit your cancellation request online."
        keywords="cancel warranty, warranty cancellation, cooling off period, refund policy"
      />

      <div className="min-h-screen bg-white">
        {/* Hero Section */}
        <section className="bg-white py-12 lg:py-16 px-4">
          <div className="max-w-6xl mx-auto text-center">
            <h1 className="text-4xl lg:text-5xl font-bold text-gray-900 mb-6">
              Cancel Your Warranty
            </h1>
            <p className="text-xl text-gray-700 mb-4">
              We understand that <strong>you may change your mind</strong>, and we've made our <span className="bg-yellow-300 px-1">cancel</span>lation process <strong>simple and hassle-free</strong>
            </p>
          </div>
        </section>

        {/* 3-Column Info Cards Section */}
        <section className="py-8 px-4">
          <div className="max-w-6xl mx-auto">
            <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
              
              {/* Card 1: Full Refund – Cooling-Off Period */}
              <div className="relative bg-white border-2 border-orange-500 rounded-xl p-6 pt-12">
                <div className="absolute -top-5 left-1/2 transform -translate-x-1/2 w-12 h-12 bg-orange-500 rounded-full flex items-center justify-center">
                  <span className="text-white text-xl">💷</span>
                </div>
                <h3 className="text-xl font-bold text-gray-900 mb-4">Full Refund – Cooling-Off Period</h3>
                <p className="text-gray-700 mb-4">
                  You may <span className="bg-yellow-300 px-1">cancel</span> your policy <strong>within 14 days of purchase for a full refund</strong>, provided no claims have been made.
                </p>
                <p className="text-gray-700 mb-4">
                  To <span className="bg-yellow-300 px-1">cancel</span>, you must send an email request within the cooling-off period to{' '}
                  <a href="mailto:support@buyawarranty.co.uk" className="text-orange-600 underline font-semibold">support@buyawarranty.co.uk</a>.
                </p>
                <p className="text-gray-700">
                  Alternatively, you can complete the '<span className="bg-yellow-300 px-1 font-semibold">Cancel</span> My Warranty' form via the link at the bottom of our homepage.
                </p>
              </div>

              {/* Card 2: Refund policy after 14 days */}
              <div className="relative bg-white border-2 border-orange-500 rounded-xl p-6 pt-12">
                <div className="absolute -top-5 left-1/2 transform -translate-x-1/2 w-12 h-12 bg-orange-500 rounded-full flex items-center justify-center">
                  <span className="text-white text-xl">💰</span>
                </div>
                <h3 className="text-xl font-bold text-gray-900 mb-4">Refund policy after 14 days</h3>
                <p className="text-gray-700 mb-4">
                  If you need to <span className="bg-yellow-300 px-1">cancel</span> your policy after the initial 14-day cooling-off period, <strong>refunds will be calculated on a pro-rata basis for the unused portion of your cover</strong>, minus:
                </p>
                <ul className="space-y-3 text-gray-700 mb-4">
                  <li className="flex items-start gap-2">
                    <span className="text-gray-400 mt-1">•</span>
                    <span>If you <span className="bg-yellow-300 px-1">cancel</span> after the 14-day cooling-off period, your refund will be calculated on a pro-rata basis for the unused portion of your cover, minus:</span>
                  </li>
                  <li className="flex items-start gap-2">
                    <span className="text-gray-400 mt-1">•</span>
                    <span>A standard fair usage fee of <strong>£40</strong></span>
                  </li>
                  <li className="flex items-start gap-2">
                    <span className="text-gray-400 mt-1">•</span>
                    <span>The first instalment is non-refundable as it covers initial administrative and liability costs</span>
                  </li>
                  <li className="flex items-start gap-2">
                    <span className="text-gray-400 mt-1">•</span>
                    <span>The value of any claims already paid during the policy term</span>
                  </li>
                </ul>
                <p className="text-gray-700 font-semibold">
                  If you pay by instalments, any remaining payments will be <span className="bg-yellow-300 px-1">cancel</span>led.
                </p>
              </div>

              {/* Card 3: Example refund calculation */}
              <div className="relative bg-white border-2 border-orange-500 rounded-xl p-6 pt-12">
                <div className="absolute -top-5 left-1/2 transform -translate-x-1/2 w-12 h-12 bg-orange-500 rounded-full flex items-center justify-center">
                  <span className="text-white text-xl">🧮</span>
                </div>
                <h3 className="text-xl font-bold text-gray-900 mb-4">Example refund calculation</h3>
                <p className="text-gray-700 mb-4">
                  To show how refunds work, here's an example if you <span className="bg-yellow-300 px-1">cancel</span> after 1 month:
                </p>
                <ul className="space-y-2 text-gray-700">
                  <li className="flex items-start gap-2">
                    <span className="text-gray-400 mt-1">•</span>
                    <span><strong>Policy purchased:</strong> 12-month cover for £450</span>
                  </li>
                  <li className="flex items-start gap-2">
                    <span className="text-gray-400 mt-1">•</span>
                    <span><strong>Monthly instalment:</strong> £37.50</span>
                  </li>
                  <li className="flex items-start gap-2">
                    <span className="text-gray-400 mt-1">•</span>
                    <span><strong><span className="bg-yellow-300 px-1">Cancel</span>led after:</strong> 1 month</span>
                  </li>
                  <li className="flex items-start gap-2">
                    <span className="text-gray-400 mt-1">•</span>
                    <span><strong>Remaining term:</strong> 11 months</span>
                  </li>
                  <li className="flex items-start gap-2">
                    <span className="text-gray-400 mt-1">•</span>
                    <span><strong>Unused premium:</strong> £412.50 (calculated as £37.50 × 11)</span>
                  </li>
                  <li className="flex items-start gap-2">
                    <span className="text-gray-400 mt-1">•</span>
                    <span><strong>Fair usage fee :</strong> £40</span>
                  </li>
                  <li className="flex items-start gap-2">
                    <span className="text-gray-400 mt-1">•</span>
                    <span><strong>First instalment</strong> (non-refundable): £37.50</span>
                  </li>
                  <li className="flex items-start gap-2">
                    <span className="text-gray-400 mt-1">•</span>
                    <span><strong>Minus any claims paid during the policy term</strong></span>
                  </li>
                </ul>
                <div className="mt-4 pt-4 border-t border-gray-200">
                  <p className="text-gray-900 font-bold">Final refund amount:</p>
                  <p className="text-gray-700">£412.50 – £40 – £37.50 = <strong className="text-lg">£335.00</strong></p>
                  <p className="text-sm text-gray-500 italic mt-1">(if no claims have been paid)</p>
                </div>
              </div>
            </div>
          </div>
        </section>

        {/* Cancellation Form Section */}
        <section className="bg-gray-50 py-12 px-4">
          <div className="max-w-5xl mx-auto">
            <div className="text-center mb-8">
              <h2 className="text-3xl lg:text-4xl font-bold text-gray-900 mb-3">
                ✅ Cancellation Form
              </h2>
              <p className="text-gray-600 text-lg">
                We're sorry to see you go! Before you leave, could you share a little feedback? It really helps us improve. 😊
              </p>
            </div>

            <div className="grid grid-cols-1 lg:grid-cols-3 gap-8 items-start">
              {/* Form Section - Takes 2 columns */}
              <div className="lg:col-span-2">
                <div className="bg-white p-6 lg:p-8 rounded-xl shadow-lg">
                  <h3 className="text-xl font-bold text-gray-900 mb-6">Your Details</h3>
                  
                  <form onSubmit={handleSubmit} className="space-y-6">
                    {/* Registration Plate */}
                    <div>
                      <Label htmlFor="registrationPlate" className="text-gray-700 font-medium text-sm flex items-center gap-2">
                        🚗 Registration Plate *
                      </Label>
                      <Input
                        id="registrationPlate"
                        name="registrationPlate"
                        type="text"
                        placeholder="e.g., AB12 CDE"
                        value={formData.registrationPlate}
                        onChange={handleInputChange}
                        required
                        className={`mt-1.5 h-11 border-gray-300 focus:border-orange-500 focus:ring-orange-500 ${errors.registrationPlate ? 'border-red-500' : ''}`}
                      />
                      {errors.registrationPlate && <p className="mt-1 text-sm text-red-600">{errors.registrationPlate}</p>}
                    </div>

                    {/* Full Name */}
                    <div>
                      <Label htmlFor="fullName" className="text-gray-700 font-medium text-sm flex items-center gap-2">
                        👤 Full Name *
                      </Label>
                      <Input
                        id="fullName"
                        name="fullName"
                        type="text"
                        placeholder="Your full name"
                        value={formData.fullName}
                        onChange={handleInputChange}
                        required
                        className={`mt-1.5 h-11 border-gray-300 focus:border-orange-500 focus:ring-orange-500 ${errors.fullName ? 'border-red-500' : ''}`}
                      />
                      {errors.fullName && <p className="mt-1 text-sm text-red-600">{errors.fullName}</p>}
                    </div>

                    {/* Reason for Cancellation */}
                    <div>
                      <Label htmlFor="reason" className="text-gray-700 font-medium text-sm flex items-center gap-2">
                        ❓ Reason for Cancellation *
                      </Label>
                      <Select onValueChange={handleReasonChange} value={formData.reason}>
                        <SelectTrigger className={`mt-1.5 h-11 border-gray-300 focus:border-orange-500 focus:ring-orange-500 ${errors.reason ? 'border-red-500' : ''}`}>
                          <SelectValue placeholder="Select a reason from the list" />
                        </SelectTrigger>
                        <SelectContent className="bg-white z-50">
                          <SelectItem value="too-expensive">Too expensive</SelectItem>
                          <SelectItem value="no-longer-needed">No longer needed</SelectItem>
                          <SelectItem value="not-using-vehicle">Not using the vehicle</SelectItem>
                          <SelectItem value="sold-vehicle">Sold the vehicle</SelectItem>
                          <SelectItem value="found-better-deal">Found a better deal</SelectItem>
                          <SelectItem value="other">Other</SelectItem>
                        </SelectContent>
                      </Select>
                      {errors.reason && <p className="mt-1 text-sm text-red-600">{errors.reason}</p>}
                    </div>

                    {/* Feedback */}
                    <div className="bg-gray-50 rounded-lg p-5">
                      <Label htmlFor="feedback" className="text-gray-900 font-bold text-base mb-2 block">
                        💬 We'd Love Your Honest Thoughts
                      </Label>
                      <p className="text-sm text-gray-600 mb-3">
                        Your opinion matters – and it won't affect your refund.
                      </p>
                      <p className="text-sm text-gray-600 mb-4">
                        There's no right or wrong answer, and you can't offend us! We genuinely want to know what you think because:
                      </p>
                      <ul className="space-y-2 mb-4">
                        <li className="flex items-start gap-2 text-sm text-gray-700">
                          <span className="text-green-500 mt-0.5">✅</span>
                          <span>Your feedback helps us improve for you and others</span>
                        </li>
                        <li className="flex items-start gap-2 text-sm text-gray-700">
                          <span className="text-green-500 mt-0.5">✅</span>
                          <span>It won't impact your refund or support in any way</span>
                        </li>
                        <li className="flex items-start gap-2 text-sm text-gray-700">
                          <span className="text-green-500 mt-0.5">✅</span>
                          <span>Big or small, we'd love to hear it!</span>
                        </li>
                      </ul>
                      <Textarea
                        id="feedback"
                        name="feedback"
                        placeholder="Share your thoughts (optional)"
                        value={formData.feedback}
                        onChange={handleInputChange}
                        rows={4}
                        className="border-gray-300 focus:border-orange-500 focus:ring-orange-500 bg-white"
                      />
                    </div>

                    {/* Submit Button */}
                    <Button
                      type="submit"
                      disabled={isSubmitting}
                      className="w-full h-12 bg-gray-600 hover:bg-gray-700 text-white font-semibold text-lg"
                    >
                      {isSubmitting ? 'Submitting...' : '👉 Cancel My Warranty'}
                    </Button>
                  </form>
                </div>
              </div>

              {/* Stay Offer Section - Takes 1 column */}
              <div className="lg:col-span-1">
                <div className="bg-gradient-to-br from-green-50 to-green-100 border-2 border-green-500 rounded-xl p-6 text-center">
                  <div className="text-4xl mb-3">🎁</div>
                  <h3 className="text-xl font-bold text-gray-900 mb-3">
                    Wait! Want to Stay?
                  </h3>
                  <p className="text-gray-700 mb-4">
                    Get <span className="font-bold text-green-600">3 months FREE</span> cover if you keep your warranty!
                  </p>
                  <ul className="space-y-2 text-left mb-6">
                    <li className="flex items-center gap-2 text-gray-700">
                      <span className="text-green-500">✅</span>
                      <span>No extra cost</span>
                    </li>
                    <li className="flex items-center gap-2 text-gray-700">
                      <span className="text-green-500">✅</span>
                      <span>Immediate benefit</span>
                    </li>
                    <li className="flex items-center gap-2 text-gray-700">
                      <span className="text-green-500">✅</span>
                      <span>Stay protected longer</span>
                    </li>
                  </ul>
                  <Link to="/">
                    <Button className="w-full h-12 bg-green-600 hover:bg-green-700 text-white font-semibold text-lg">
                      👉 Yes, I'll Stay
                    </Button>
                  </Link>
                </div>
                
                {/* Panda Image */}
                <div className="mt-6 flex items-center justify-center">
                  <img 
                    src={pandaVehicles} 
                    alt="Panda with vehicles" 
                    className="w-full max-w-[200px]"
                  />
                </div>
              </div>
            </div>
          </div>
        </section>

        {/* What Happens Next Section */}
        <section className="py-12 px-4">
          <div className="max-w-4xl mx-auto">
            <div className="bg-white rounded-xl p-8 shadow-lg border border-orange-100">
              <h2 className="text-2xl lg:text-3xl font-bold text-gray-900 mb-6">What Happens Next?</h2>
              <ul className="space-y-4 text-gray-700">
                <li className="flex items-start gap-3">
                  <span className="text-orange-500 font-bold mt-1">1.</span>
                  <span className="text-lg">Once submitted, our Accounts Team will review your request.</span>
                </li>
                <li className="flex items-start gap-3">
                  <span className="text-orange-500 font-bold mt-1">2.</span>
                  <span className="text-lg">If eligible, your refund will be processed within 2–3 working days.</span>
                </li>
                <li className="flex items-start gap-3">
                  <span className="text-orange-500 font-bold mt-1">3.</span>
                  <span className="text-lg">If we don't hear from you, your policy will remain active and continue to protect your vehicle.</span>
                </li>
              </ul>
            </div>
          </div>
        </section>
      </div>
    </>
  );
};

export default CancelWarranty;
