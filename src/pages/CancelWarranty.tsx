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
import pandaMechanic from '@/assets/panda-mechanic.png';
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
  const [errors, setErrors] = useState<{[key: string]: string}>({});

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

  if (isSuccess) {
    return (
      <>
        <SEOHead
          title="Cancellation Request Received - Buy a Warranty"
          description="Your warranty cancellation request has been received"
        />

        <div className="min-h-screen bg-white">
          <div className="max-w-4xl mx-auto px-4 py-16">
            <div className="bg-green-50 border-2 border-green-500 rounded-xl p-8 text-center">
              <div className="w-16 h-16 bg-green-500 rounded-full flex items-center justify-center mx-auto mb-4">
                <svg className="w-8 h-8 text-white" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M5 13l4 4L19 7" />
                </svg>
              </div>
              <h1 className="text-3xl font-bold text-gray-900 mb-4">
                Thank You
              </h1>
              <p className="text-xl text-gray-700 mb-6">
                Your cancellation request has been received
              </p>
              <p className="text-gray-600 mb-8">
                Our Accounts Team will review your request and process it within 2–3 working days.
              </p>
              <Link to="/">
                <Button className="bg-primary hover:bg-primary/90">
                  Return to Homepage
                </Button>
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
        <section className="bg-white py-16 lg:py-24 px-4">
          <div className="max-w-4xl mx-auto text-center">
            <h1 className="text-4xl lg:text-5xl font-bold text-gray-900 mb-6">
              Cancel Your Warranty
            </h1>
            <p className="text-xl lg:text-2xl text-gray-700 mb-8 leading-relaxed">
              We understand that circumstances change, and you may need to cancel your warranty. Here's everything you need to know:
            </p>
          </div>
        </section>

        {/* Cooling-Off Period Section */}
        <section className="bg-gradient-to-br from-orange-50 to-orange-100 py-12 px-4">
          <div className="max-w-4xl mx-auto">
            <div className="bg-white rounded-xl p-8 shadow-lg">
              <h2 className="text-2xl lg:text-3xl font-bold text-gray-900 mb-6">Your Cooling-Off Period</h2>
              <p className="text-lg text-gray-700 mb-4">
                Under the terms of your warranty, you have a <span className="font-bold text-orange-600">14-day cooling-off period</span>:
              </p>
              <ul className="space-y-3 text-gray-700">
                <li className="flex items-start gap-3">
                  <span className="text-green-500 font-bold mt-1">✓</span>
                  <span>If you cancel within this time, you'll receive a <span className="font-semibold">full refund</span>.</span>
                </li>
                <li className="flex items-start gap-3">
                  <span className="text-green-500 font-bold mt-1">✓</span>
                  <span>No questions asked – we want you to feel confident in your decision.</span>
                </li>
              </ul>
            </div>
          </div>
        </section>

        {/* After 14 Days Section with Image */}
        <section className="py-12 px-4">
          <div className="max-w-4xl mx-auto">
            <div className="grid grid-cols-1 lg:grid-cols-3 gap-8 items-center">
              <div className="lg:col-span-2">
                <h2 className="text-2xl lg:text-3xl font-bold text-gray-900 mb-6">After 14 Days</h2>
                <p className="text-lg text-gray-700 mb-4">
                  Once the cooling-off period has passed, your cover is already active and protecting your vehicle.
                </p>
                <p className="text-lg text-gray-700">
                  This means the insurer and/or finance provider has committed to providing that protection for the agreed term, 
                  so full refunds are processed <span className="font-semibold">pro-rata</span> and include a <span className="font-semibold text-orange-600">£40 flat service fee</span>.
                </p>
              </div>
              <div className="lg:col-span-1">
                <img 
                  src={pandaMechanic} 
                  alt="Panda mechanic mascot" 
                  className="w-full max-w-[200px] mx-auto"
                />
              </div>
            </div>
          </div>
        </section>

        {/* Cancellation Form Section */}
        <section className="bg-gray-50 py-12 px-4">
          <div className="max-w-4xl mx-auto">
            <div className="text-center mb-8">
              <h2 className="text-3xl lg:text-4xl font-bold text-gray-900 mb-3">
                Cancellation Form
              </h2>
              <p className="text-gray-600 text-lg">
                Please allow 2–3 working days for processing.
              </p>
            </div>

            <div className="grid grid-cols-1 lg:grid-cols-3 gap-8 items-start">
              {/* Form Section - Takes 2 columns */}
              <div className="lg:col-span-2">
                <div className="bg-white p-6 lg:p-8 rounded-xl shadow-lg">
                  <form onSubmit={handleSubmit} className="space-y-6">
                    {/* Registration Plate */}
                    <div>
                      <Label htmlFor="registrationPlate" className="text-gray-700 font-medium text-sm">
                        Registration Plate *
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
                      <Label htmlFor="fullName" className="text-gray-700 font-medium text-sm">
                        Full Name *
                      </Label>
                      <Input
                        id="fullName"
                        name="fullName"
                        type="text"
                        placeholder="Your Full Name"
                        value={formData.fullName}
                        onChange={handleInputChange}
                        required
                        className={`mt-1.5 h-11 border-gray-300 focus:border-orange-500 focus:ring-orange-500 ${errors.fullName ? 'border-red-500' : ''}`}
                      />
                      {errors.fullName && <p className="mt-1 text-sm text-red-600">{errors.fullName}</p>}
                    </div>

                    {/* Reason for Cancellation */}
                    <div>
                      <Label htmlFor="reason" className="text-gray-700 font-medium text-sm">
                        Reason for Cancellation *
                      </Label>
                      <Select onValueChange={handleReasonChange} value={formData.reason}>
                        <SelectTrigger className={`mt-1.5 h-11 border-gray-300 focus:border-orange-500 focus:ring-orange-500 ${errors.reason ? 'border-red-500' : ''}`}>
                          <SelectValue placeholder="Select a reason" />
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
                    <div>
                      <Label htmlFor="feedback" className="text-gray-700 font-medium text-sm mb-2 block">
                        We'd Love Your Honest Thoughts
                      </Label>
                      <p className="text-sm text-gray-500 mb-3 italic">
                        Your Opinion Matters – It Won't Affect Your Refund
                      </p>
                      <p className="text-sm text-gray-600 mb-3">
                        There's no right or wrong answer, and you can't offend us. We genuinely want to know what you think, 
                        even if something didn't go as expected. Your feedback helps us improve for you and others, 
                        and it won't impact your refund or support in any way. Big or small, we'd love to hear it!
                      </p>
                      <Textarea
                        id="feedback"
                        name="feedback"
                        placeholder="Share your thoughts (optional)"
                        value={formData.feedback}
                        onChange={handleInputChange}
                        rows={4}
                        className="border-gray-300 focus:border-orange-500 focus:ring-orange-500"
                      />
                    </div>

                    {/* Submit Button */}
                    <Button
                      type="submit"
                      disabled={isSubmitting}
                      className="w-full h-12 bg-orange-500 hover:bg-orange-600 text-white font-semibold text-lg"
                    >
                      {isSubmitting ? 'Submitting...' : 'Cancel My Warranty'}
                    </Button>
                  </form>
                </div>
              </div>

              {/* Image Section - Takes 1 column */}
              <div className="lg:col-span-1 flex items-center justify-center">
                <img 
                  src={pandaVehicles} 
                  alt="Panda with vehicles" 
                  className="w-full max-w-[250px]"
                />
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
