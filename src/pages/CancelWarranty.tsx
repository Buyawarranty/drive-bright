import React, { useState } from 'react';
import { Link } from 'react-router-dom';
import { SEOHead } from '@/components/SEOHead';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Textarea } from '@/components/ui/textarea';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { supabase } from '@/integrations/supabase/client';
import { useToast } from '@/hooks/use-toast';
import { Mail, Phone, Clock, Pause, ArrowRightLeft, TrendingDown, CheckCircle, AlertCircle, Gift, MessageCircle, Heart, Car, Wrench, ArrowDown } from 'lucide-react';

const CancelWarranty = () => {
  const { toast } = useToast();
  const [isSuccess, setIsSuccess] = useState(false);
  const [isStaySuccess, setIsStaySuccess] = useState(false);
  const [submittedData, setSubmittedData] = useState<{ registrationPlate: string } | null>(null);
  const [isCancellingRequest, setIsCancellingRequest] = useState(false);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [isStaying, setIsStaying] = useState(false);
  const [showStayForm, setShowStayForm] = useState(false);

  // Stay form state (separate from cancellation form)
  const [stayFormData, setStayFormData] = useState({
    registrationPlate: '',
    email: ''
  });

  // Cancellation form state
  const [formData, setFormData] = useState({
    registrationPlate: '',
    email: '',
    reason: '',
    exceptionalCircumstances: ''
  });

  const handleFormSuccess = (data: { registrationPlate: string }) => {
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
          fullName: 'Customer',
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

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    
    if (!formData.registrationPlate || !formData.email || !formData.reason) {
      toast({ title: "Missing Information", description: "Please fill in all required fields.", variant: "destructive" });
      return;
    }

    if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(formData.email)) {
      toast({ title: "Invalid Email", description: "Please enter a valid email address.", variant: "destructive" });
      return;
    }

    setIsSubmitting(true);

    try {
      const response = await supabase.functions.invoke('submit-cancellation', {
        body: {
          registrationPlate: formData.registrationPlate,
          fullName: 'Customer',
          email: formData.email,
          reason: formData.reason,
          feedback: formData.exceptionalCircumstances || ''
        }
      });

      if (response.error) throw new Error(response.error.message);
      handleFormSuccess({ registrationPlate: formData.registrationPlate });
    } catch (error) {
      console.error('Cancellation submission error:', error);
      toast({ title: "Submission Failed", description: "Please try again or contact support.", variant: "destructive" });
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleStayWithUs = async () => {
    if (!stayFormData.email || !stayFormData.registrationPlate) {
      toast({ title: "Missing Information", description: "Please enter your email and registration plate.", variant: "destructive" });
      return;
    }

    if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(stayFormData.email)) {
      toast({ title: "Invalid Email", description: "Please enter a valid email address.", variant: "destructive" });
      return;
    }

    setIsStaying(true);

    try {
      await supabase.functions.invoke('submit-cancellation', {
        body: {
          registrationPlate: stayFormData.registrationPlate,
          fullName: stayFormData.email,
          reason: 'CUSTOMER_STAYING',
          feedback: `Customer has decided to STAY and keep their warranty. They accepted the 3 months FREE offer. Email: ${stayFormData.email}, Registration: ${stayFormData.registrationPlate}.`
        }
      });
      handleStaySuccess();
    } catch {
      toast({ title: "Request Failed", description: "Please contact support@buyawarranty.co.uk", variant: "destructive" });
    } finally {
      setIsStaying(false);
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
            <Link to="/"><Button className="bg-green-600 hover:bg-green-700 text-white">Return to Homepage</Button></Link>
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
              <CheckCircle className="w-16 h-16 text-green-500 mx-auto mb-4" />
              <h1 className="text-2xl font-bold text-gray-900 mb-4">Your Request Has Been Received</h1>
              <p className="text-gray-700">We'll confirm your cancellation within <strong>2 working days</strong>.</p>
              <div className="mt-4 text-left bg-white rounded-lg p-4 border border-green-200">
                <p className="text-sm text-gray-600 mb-2"><strong>Refund Timeline:</strong></p>
                <ul className="text-sm text-gray-600 space-y-1">
                  <li>• 14 day Cooling-off refunds: within 5 working days</li>
                  <li>• After 14 days refunds: within 14 working days</li>
                </ul>
              </div>
            </div>
            <div className="bg-orange-50 border-2 border-orange-400 rounded-xl p-6 text-center">
              <h2 className="text-xl font-bold text-gray-900 mb-4">Changed your mind?</h2>
              <Button onClick={handleKeepWarranty} disabled={isCancellingRequest} className="bg-orange-500 hover:bg-orange-600 text-white">
                {isCancellingRequest ? 'Processing...' : 'Keep My Warranty'}
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
        title="Cancel Your Warranty - Buy a Warranty"
        description="We understand plans change. Here's how to cancel your warranty easily with our simple, transparent process."
        keywords="cancel warranty, warranty cancellation, cooling off period, refund policy"
      />

      <div className="min-h-screen bg-white">
        {/* Header */}
        <section className="py-12 px-4 border-b border-gray-100">
          <div className="max-w-2xl mx-auto text-center">
            <h1 className="text-3xl lg:text-4xl font-bold text-gray-900 mb-4">
              Cancel Your Warranty
            </h1>
            <p className="text-lg text-gray-600">
              We understand plans change. Here's how to cancel easily.
            </p>
          </div>
        </section>

        <div className="max-w-2xl mx-auto px-4 py-8 space-y-8">

          {/* Cancellation Rights */}
          <section className="space-y-6">
            <h2 className="text-2xl font-bold text-gray-900">Cancellation Rights</h2>
            
            {/* 14-Day Cooling-Off */}
            <div className="border-l-4 border-green-500 pl-4 py-2">
              <div className="flex items-center gap-2 mb-2">
                <Clock className="w-5 h-5 text-green-600" />
                <h3 className="text-lg font-bold text-gray-900">14-Day Cooling-Off Period</h3>
              </div>
              <ul className="text-gray-600 space-y-2 ml-7">
                <li>• Cancel within 14 days of your start date or receiving documents (whichever is later)</li>
                <li>• <strong className="text-green-600">Full refund</strong> if no claim has been submitted and no services used</li>
                <li>• If a claim has been submitted (accepted, pending, or rejected), no refund applies</li>
                <li>• £40 administration fee applies to cover processing costs</li>
              </ul>
            </div>

            {/* After 14 Days */}
            <div className="border-l-4 border-orange-500 pl-4 py-2">
              <div className="flex items-center gap-2 mb-2">
                <Clock className="w-5 h-5 text-orange-600" />
                <h3 className="text-lg font-bold text-gray-900">After 14 Days</h3>
              </div>
              <p className="text-gray-600 mb-3 ml-7">You can cancel anytime after the initial cooling-off period.</p>
              
              <div className="ml-7 space-y-4">
                <div>
                  <p className="font-semibold text-gray-900 mb-1">Paid in Full:</p>
                  <ul className="text-gray-600 space-y-1">
                    <li>• If no claim submitted: pro-rata refund for unused full months, minus £40 fair usage fee</li>
                    <li>• Minimum of 2 months' equivalent warranty payment retained</li>
                    <li>• If any claim submitted: no refund applies</li>
                  </ul>
                </div>
                
                <div>
                  <p className="font-semibold text-gray-900 mb-1">Paid Monthly (Finance):</p>
                  <ul className="text-gray-600 space-y-1">
                    <li>• Cancelling your warranty does not automatically cancel your finance agreement</li>
                    <li>• Any refund will be routed via your finance provider</li>
                    <li>• Minimum 2 months' equivalent payment + £40 fee applies</li>
                    <li>• If no claim submitted: remaining balance refunded on a pro-rata basis</li>
                  </ul>
                </div>
              </div>
            </div>
          </section>

          {/* Alternative Options */}
          <section className="bg-gray-50 rounded-xl p-6">
            <h2 className="text-2xl font-bold text-gray-900 mb-4">Alternative Options</h2>
            <p className="text-gray-600 mb-4">Before cancelling, consider these options:</p>
            <div className="space-y-3">
              <div className="flex items-start gap-3">
                <div className="w-8 h-8 bg-orange-100 rounded-full flex items-center justify-center flex-shrink-0">
                  <Pause className="w-4 h-4 text-orange-600" />
                </div>
                <div>
                  <p className="font-semibold text-gray-900">Pause Your Cover</p>
                  <p className="text-sm text-gray-600">Pause for up to 3 months</p>
                </div>
              </div>
              <div className="flex items-start gap-3">
                <div className="w-8 h-8 bg-orange-100 rounded-full flex items-center justify-center flex-shrink-0">
                  <ArrowRightLeft className="w-4 h-4 text-orange-600" />
                </div>
                <div>
                  <p className="font-semibold text-gray-900">Transfer Your Warranty</p>
                  <p className="text-sm text-gray-600">Transfer to a new owner when selling your car</p>
                </div>
              </div>
              <div className="flex items-start gap-3">
                <div className="w-8 h-8 bg-orange-100 rounded-full flex items-center justify-center flex-shrink-0">
                  <TrendingDown className="w-4 h-4 text-orange-600" />
                </div>
                <div>
                  <p className="font-semibold text-gray-900">Downgrade Your Plan</p>
                  <p className="text-sm text-gray-600">Switch to a lower-cost plan</p>
                </div>
              </div>
            </div>
            <p className="text-sm text-gray-600 mt-4">
              Interested? <a href="mailto:support@buyawarranty.co.uk" className="text-orange-600 hover:underline font-medium">Contact us</a> to discuss these options.
            </p>
          </section>

          {/* Refund Timeline */}
          <section>
            <h2 className="text-2xl font-bold text-gray-900 mb-4">Refund Timeline</h2>
            <div className="grid grid-cols-2 gap-4">
              <div className="bg-green-50 border border-green-200 rounded-lg p-4 text-center">
                <p className="font-semibold text-gray-900">14 day Cooling-off refunds</p>
                <p className="text-green-600 font-bold">Within 5 working days</p>
              </div>
              <div className="bg-orange-50 border border-orange-200 rounded-lg p-4 text-center">
                <p className="font-semibold text-gray-900">After 14 days refunds</p>
                <p className="text-orange-600 font-bold">Within 14 working days</p>
              </div>
            </div>
          </section>

          {/* What if a claim has been made */}
          <section className="bg-gray-50 rounded-xl p-6">
            <div className="flex items-start gap-3">
              <AlertCircle className="w-6 h-6 text-orange-500 flex-shrink-0 mt-1" />
              <div>
                <h2 className="text-xl font-bold text-gray-900 mb-2">What if a claim has been made?</h2>
                <p className="text-gray-600 mb-3">
                  If a claim has been submitted – whether accepted, rejected, or pending – your warranty remains valid and active for the rest of the term.
                </p>
                <p className="text-gray-600">
                  Refunds do not apply once a claim has been made, as the service has already been accessed.
                </p>
              </div>
            </div>
          </section>

          {/* Exceptional Circumstances */}
          <section className="border border-gray-200 rounded-xl p-6">
            <h2 className="text-lg font-bold text-gray-900 mb-2">Exceptional Circumstances</h2>
            <p className="text-gray-600 text-sm">
              We understand life can be unpredictable. While our refund policy is designed to be fair and consistent, we may exercise discretion in exceptional cases. If you believe your situation deserves special consideration, please let us know when submitting your request.
            </p>
          </section>

          {/* Stay Offer */}
          <section className="bg-green-50 border-2 border-green-500 rounded-xl p-6">
            <div className="text-center mb-4">
              <div className="w-12 h-12 bg-green-500 rounded-full flex items-center justify-center mx-auto mb-3">
                <Heart className="w-6 h-6 text-white" />
              </div>
              <h2 className="text-xl font-bold text-gray-900 mb-3">We'd love to keep you as a valued customer!</h2>
              <p className="text-gray-700">
                If you decide to stay with us, we can offer great incentives such as three months of extended cover, vehicle rental benefits, and recovery assistance.
              </p>
            </div>
            
            <div className="bg-white rounded-lg p-4 mb-4 border border-green-200">
              <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
                <div className="flex items-center gap-2 text-gray-700">
                  <Gift className="w-5 h-5 text-green-600 flex-shrink-0" />
                  <span className="text-sm font-medium">3 Months Extended Cover</span>
                </div>
                <div className="flex items-center gap-2 text-gray-700">
                  <Car className="w-5 h-5 text-green-600 flex-shrink-0" />
                  <span className="text-sm font-medium">Vehicle Rental Benefits</span>
                </div>
                <div className="flex items-center gap-2 text-gray-700">
                  <Wrench className="w-5 h-5 text-green-600 flex-shrink-0" />
                  <span className="text-sm font-medium">Recovery Assistance</span>
                </div>
              </div>
            </div>

            <p className="text-gray-700 text-center mb-4">
              Please reach out via <a href="https://wa.me/message/SPQPJ6O3UBF5B1" target="_blank" rel="noopener noreferrer" className="text-green-600 font-semibold hover:underline">WhatsApp</a>, call us on <a href="tel:03302295040" className="text-green-600 font-semibold hover:underline">0330 229 5040</a>, or click the button below to stay with us.
            </p>
            
            {!showStayForm ? (
              <Button 
                onClick={() => setShowStayForm(true)}
                className="w-full h-12 bg-green-600 hover:bg-green-700 text-white font-bold gap-2"
              >
                Keep My Cover
              </Button>
            ) : (
              <div className="space-y-3 bg-white border border-green-200 rounded-lg p-4">
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">Registration Plate *</label>
                  <Input
                    type="text"
                    placeholder="e.g. AB12 CDE"
                    value={stayFormData.registrationPlate}
                    onChange={(e) => setStayFormData({ ...stayFormData, registrationPlate: e.target.value.toUpperCase() })}
                    className="h-12 border-gray-300"
                  />
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">Email Address *</label>
                  <Input
                    type="email"
                    placeholder="your@email.com"
                    value={stayFormData.email}
                    onChange={(e) => setStayFormData({ ...stayFormData, email: e.target.value })}
                    className="h-12 border-gray-300"
                  />
                </div>
                <Button 
                  onClick={handleStayWithUs}
                  disabled={isStaying || !stayFormData.email || !stayFormData.registrationPlate}
                  className="w-full h-12 bg-green-600 hover:bg-green-700 text-white font-bold gap-2"
                >
                  {isStaying ? 'Processing...' : 'Confirm & Keep My Cover'}
                </Button>
                <button 
                  type="button"
                  onClick={() => setShowStayForm(false)}
                  className="w-full text-sm text-gray-500 hover:text-gray-700"
                >
                  Cancel
                </button>
              </div>
            )}
          </section>

          {/* Cancellation Form */}
          <section id="form-section" className="border-2 border-gray-200 rounded-xl p-6">
            <h2 className="text-2xl font-bold text-gray-900 mb-2">Cancel my warranty</h2>
            <p className="text-gray-600 mb-4">We're sorry to see you go. Please confirm your details to cancel your warranty.</p>
            <form onSubmit={handleSubmit} className="space-y-4">
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Registration Plate *</label>
                <Input
                  type="text"
                  placeholder="e.g. AB12 CDE"
                  value={formData.registrationPlate}
                  onChange={(e) => setFormData({ ...formData, registrationPlate: e.target.value.toUpperCase() })}
                  className="h-12 border-gray-300"
                />
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Email Address *</label>
                <Input
                  type="email"
                  placeholder="your@email.com"
                  value={formData.email}
                  onChange={(e) => setFormData({ ...formData, email: e.target.value })}
                  className="h-12 border-gray-300"
                />
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Reason for Cancellation *</label>
                <Select value={formData.reason} onValueChange={(value) => setFormData({ ...formData, reason: value, exceptionalCircumstances: '' })}>
                  <SelectTrigger className="h-12 border-gray-300">
                    <SelectValue placeholder="Select a reason" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="sold-vehicle">Sold my vehicle</SelectItem>
                    <SelectItem value="financial-reasons">Financial reasons</SelectItem>
                    <SelectItem value="found-alternative">Found alternative cover</SelectItem>
                    <SelectItem value="no-longer-needed">No longer need cover</SelectItem>
                    <SelectItem value="exceptional-circumstances">Exceptional circumstances</SelectItem>
                    <SelectItem value="other">Other</SelectItem>
                  </SelectContent>
                </Select>
              </div>
              {(formData.reason === 'other' || formData.reason === 'exceptional-circumstances') && (
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">
                    {formData.reason === 'exceptional-circumstances' 
                      ? 'Please describe your exceptional circumstances *' 
                      : 'Please tell us your reason *'}
                  </label>
                  <Textarea
                    placeholder={formData.reason === 'exceptional-circumstances' 
                      ? "Please describe your exceptional circumstances here..." 
                      : "Please let us know your reason for cancelling..."}
                    value={formData.exceptionalCircumstances}
                    onChange={(e) => setFormData({ ...formData, exceptionalCircumstances: e.target.value })}
                    className="border-gray-300 min-h-[100px]"
                    required
                  />
                </div>
              )}
              <Button 
                type="submit" 
                disabled={isSubmitting}
                className="w-full h-14 bg-orange-500 hover:bg-orange-600 text-white font-bold text-lg"
              >
                {isSubmitting ? 'Submitting...' : 'Cancel my warranty'}
              </Button>
            </form>
          </section>

          {/* Need Help */}
          <section className="text-center py-6 border-t border-gray-200">
            <h3 className="text-lg font-bold text-gray-900 mb-2">Need Help?</h3>
            <p className="text-gray-600 mb-4">Our friendly team is here to assist.</p>
            <div className="flex flex-wrap gap-4 justify-center">
              <a href="mailto:support@buyawarranty.co.uk" className="flex items-center gap-2 text-orange-600 hover:underline font-medium">
                <Mail className="w-4 h-4" /> support@buyawarranty.co.uk
              </a>
              <a href="tel:03302295045" className="flex items-center gap-2 text-gray-700 hover:underline font-medium">
                <Phone className="w-4 h-4" /> 0330 229 5045
              </a>
              <a 
                href="https://wa.me/443302295040?text=Hi%2C%20I%20have%20a%20question%20about%20cancelling%20my%20warranty" 
                target="_blank" 
                rel="noopener noreferrer"
                className="flex items-center gap-2 text-green-600 hover:underline font-medium"
              >
                <MessageCircle className="w-4 h-4" /> WhatsApp Us
              </a>
            </div>
          </section>

        </div>
      </div>
    </>
  );
};

export default CancelWarranty;
