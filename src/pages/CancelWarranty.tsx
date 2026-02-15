import React, { useState } from 'react';
import { Link } from 'react-router-dom';
import { SEOHead } from '@/components/SEOHead';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Textarea } from '@/components/ui/textarea';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { supabase } from '@/integrations/supabase/client';
import { useToast } from '@/hooks/use-toast';
import {
  Mail, Phone, Clock, Pause, ArrowRightLeft, TrendingUp,
  CheckCircle, Info, Gift, MessageCircle, Heart, Car, Wrench,
  ShieldCheck, XSquare, Star, RefreshCcw, FileText, Banknote,
  CalendarCheck, AlertCircle, CreditCard, ArrowRight
} from 'lucide-react';

const CancelWarranty = () => {
  const { toast } = useToast();
  const [isSuccess, setIsSuccess] = useState(false);
  const [isStaySuccess, setIsStaySuccess] = useState(false);
  const [submittedData, setSubmittedData] = useState<{ registrationPlate: string } | null>(null);
  const [isCancellingRequest, setIsCancellingRequest] = useState(false);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [isStaying, setIsStaying] = useState(false);
  const [showStayForm, setShowStayForm] = useState(false);

  const [stayFormData, setStayFormData] = useState({ registrationPlate: '', email: '' });
  const [formData, setFormData] = useState({
    registrationPlate: '', email: '', reason: '', message: '', serviceIssue: '', serviceDetail: ''
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
      const feedbackParts = [formData.message];
      if (formData.reason === 'unhappy-with-service' && formData.serviceIssue) {
        feedbackParts.unshift(`Service issue: ${formData.serviceIssue}`);
        if (formData.serviceDetail) feedbackParts.push(`Details: ${formData.serviceDetail}`);
      }
      const response = await supabase.functions.invoke('submit-cancellation', {
        body: {
          registrationPlate: formData.registrationPlate,
          fullName: 'Customer',
          email: formData.email,
          reason: formData.reason,
          feedback: feedbackParts.filter(Boolean).join('\n') || ''
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

  const scrollToForm = () => {
    document.getElementById('cancel-form')?.scrollIntoView({ behavior: 'smooth' });
  };

  // Stay success screen
  if (isStaySuccess) {
    return (
      <>
        <SEOHead title="Welcome Back! - Buy a Warranty" description="Thank you for staying with us" />
        <div className="min-h-screen bg-white py-16 px-6">
          <div className="max-w-[720px] mx-auto bg-[#f0faf4] border-2 border-[#009A44] rounded-lg p-8 text-center">
            <div className="text-6xl mb-4">🎉</div>
            <h1 className="text-3xl font-bold text-[#000] mb-4">Welcome Back!</h1>
            <p className="text-lg text-[#333] mb-6">
              Your warranty is <strong className="text-[#009A44]">fully active</strong>. We'll add <strong className="text-[#009A44]">3 months FREE cover</strong> within 2 to 3 working days.
            </p>
            <Link to="/">
              <Button className="bg-[#009A44] hover:bg-[#007a36] text-white font-bold rounded-lg">Return to Homepage</Button>
            </Link>
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
        <div className="min-h-screen bg-white py-16 px-6">
          <div className="max-w-[720px] mx-auto space-y-6">
            <div className="bg-[#f0faf4] border-2 border-[#009A44] rounded-xl p-8">
              <CheckCircle className="w-14 h-14 text-[#009A44] mx-auto mb-4" />
              <h1 className="text-2xl font-bold text-[#000] text-center mb-3">Your cancellation request has been received</h1>
              <div className="space-y-3 text-[#333] text-[15px]">
                <p>Thanks – we've received your request and it's now being processed.</p>
                <div className="flex items-start gap-2">
                  <CheckCircle className="w-4 h-4 text-[#009A44] flex-shrink-0 mt-0.5" />
                  <p>This is your confirmation, and you don't need to wait for another message.</p>
                </div>
                <div className="flex items-start gap-2">
                  <CheckCircle className="w-4 h-4 text-[#009A44] flex-shrink-0 mt-0.5" />
                  <p>You can close this page whenever you're ready.</p>
                </div>
              </div>

              <div className="mt-6 bg-white rounded-lg p-5 border border-[#009A44]/20">
                <p className="font-bold text-[#000] mb-3">Refund timeline</p>
                <div className="space-y-2 text-[#333] text-sm">
                  <div className="flex items-start gap-2">
                    <CheckCircle className="w-4 h-4 text-[#009A44] flex-shrink-0 mt-0.5" />
                    <p>If you cancel within 14 days: refunds are processed within <strong>7 working days</strong></p>
                  </div>
                  <div className="flex items-start gap-2">
                    <CheckCircle className="w-4 h-4 text-[#009A44] flex-shrink-0 mt-0.5" />
                    <p>If you cancel after 14 days: refunds are processed within <strong>14 working days</strong></p>
                  </div>
                </div>
              </div>

              <p className="mt-4 text-[#333] text-sm">If we need anything else from you, we'll get in touch — otherwise, we'll update you once everything is complete.</p>
            </div>

            <div className="bg-[#fff7ed] border-2 border-[#FF7A00] rounded-xl p-6 text-center">
              <h2 className="text-xl font-bold text-[#000] mb-4">Changed your mind?</h2>
              <Button onClick={handleKeepWarranty} disabled={isCancellingRequest} className="bg-[#FF7A00] hover:bg-[#e56e00] text-white font-bold rounded-lg">
                {isCancellingRequest ? 'Processing...' : 'Keep my warranty'}
              </Button>
            </div>
            <div className="text-center">
              <Link to="/" className="text-[#333] hover:underline">Return to Homepage</Link>
            </div>
          </div>
        </div>
      </>
    );
  }

  return (
    <>
      <SEOHead
        title="Cancel Your Warranty | BuyAWarranty"
        description="Cancel your used car warranty easily. Understand your cooling off rights, refund process and alternative options."
        keywords="cancel warranty, warranty cancellation, cooling off period, refund policy"
      />

      <div className="min-h-screen bg-white">
        {/* Header */}
        <header className="py-14 px-6 border-b border-[#E6E6E6]">
          <div className="max-w-[720px] mx-auto text-center">
            <h1 className="text-3xl lg:text-4xl font-bold text-[#000] mb-3">
              Cancellation Rights
            </h1>
            <p className="text-lg text-[#333]">
              We understand plans change. Here's everything you need to know.
            </p>
          </div>
        </header>

        <main className="max-w-[720px] mx-auto px-6 py-12 space-y-12">

          {/* ── 14 Day Cooling Off ── */}
          <section className="space-y-4" aria-labelledby="cooling-off-heading">
            <div className="flex items-center gap-3">
              <div className="w-10 h-10 bg-[#f0faf4] rounded-full flex items-center justify-center flex-shrink-0">
                <CheckCircle className="w-5 h-5 text-[#009A44]" />
              </div>
              <h2 id="cooling-off-heading" className="text-2xl font-bold text-[#000]">14 Day Cooling Off Period</h2>
            </div>

            <p className="text-[#333] leading-relaxed">
              Cancel within 14 days of your cover start date or document receipt, whichever is later.
            </p>

            <div className="space-y-4 pl-1">
              <div className="flex items-start gap-3 bg-[#f0faf4] rounded-lg p-4 border border-[#009A44]/20">
                <div className="w-8 h-8 bg-[#009A44]/10 rounded-full flex items-center justify-center flex-shrink-0 mt-0.5">
                  <CalendarCheck className="w-4 h-4 text-[#009A44]" />
                </div>
                <div>
                  <p className="font-semibold text-[#000] mb-1">If your cover has not yet started</p>
                  <p className="text-[#333] text-sm">This includes any future activation date.</p>
                  <p className="text-[#009A44] font-medium text-sm mt-1">✓ Full refund – no part of the service has been used or paid out.</p>
                </div>
              </div>
              <div className="flex items-start gap-3 bg-[#fff7ed] rounded-lg p-4 border border-[#FF7A00]/20">
                <div className="w-8 h-8 bg-[#FF7A00]/10 rounded-full flex items-center justify-center flex-shrink-0 mt-0.5">
                  <RefreshCcw className="w-4 h-4 text-[#FF7A00]" />
                </div>
                <div>
                  <p className="font-semibold text-[#000] mb-1">If your cover has started</p>
                  <p className="text-[#333] text-sm">You will receive a refund minus the value of the days already covered.</p>
                </div>
              </div>
              <div className="flex items-start gap-3 bg-[#fef2f2] rounded-lg p-4 border border-red-200">
                <div className="w-8 h-8 bg-red-50 rounded-full flex items-center justify-center flex-shrink-0 mt-0.5">
                  <AlertCircle className="w-4 h-4 text-red-500" />
                </div>
                <div>
                  <p className="font-semibold text-[#000] mb-1">If a claim has been started</p>
                  <p className="text-[#333] text-sm">
                    We deduct the value of any service already provided, such as a claim review or assessment.
                  </p>
                  <p className="text-[#333] text-sm mt-1">
                    If the value of work already completed is higher than the remaining amount on your plan, no refund will be due.
                  </p>
                </div>
              </div>
            </div>
          </section>

          <hr className="border-[#E6E6E6]" />

          {/* ── After 14 Days ── */}
          <section className="space-y-4" aria-labelledby="after-14-heading">
            <div className="flex items-center gap-3">
              <div className="w-10 h-10 bg-[#fff7ed] rounded-full flex items-center justify-center flex-shrink-0">
                <ShieldCheck className="w-5 h-5 text-[#FF7A00]" />
              </div>
              <h2 id="after-14-heading" className="text-2xl font-bold text-[#000]">After 14 Days</h2>
            </div>

            <div className="space-y-5 pl-1">
              {/* Paid in Full */}
              <div className="bg-[#f9f9f9] rounded-xl p-5 border border-[#E6E6E6]">
                <div className="flex items-center gap-2 mb-4">
                  <Banknote className="w-5 h-5 text-[#FF7A00]" />
                  <p className="font-bold text-[#000] text-lg">Paid in Full</p>
                </div>
                <div className="space-y-3">
                  <div className="flex items-start gap-3 bg-white rounded-lg p-3 border border-[#E6E6E6]">
                    <div className="w-7 h-7 bg-[#f0faf4] rounded-full flex items-center justify-center flex-shrink-0 mt-0.5">
                      <CheckCircle className="w-4 h-4 text-[#009A44]" />
                    </div>
                    <div>
                      <p className="font-semibold text-[#000] mb-1">If no claim work has been carried out</p>
                      <p className="text-[#333] text-sm">We refund any unused full months on a pro rata basis.</p>
                      <p className="text-[#333] text-sm mt-1">A reasonable administration charge may apply to cover our actual costs.</p>
                    </div>
                  </div>
                  <div className="flex items-start gap-3 bg-white rounded-lg p-3 border border-[#E6E6E6]">
                    <div className="w-7 h-7 bg-[#fef2f2] rounded-full flex items-center justify-center flex-shrink-0 mt-0.5">
                      <Wrench className="w-4 h-4 text-red-500" />
                    </div>
                    <div>
                      <p className="font-semibold text-[#000] mb-1">If claim work has been completed</p>
                      <p className="text-[#333] text-sm">We deduct the value of the work already provided.</p>
                      <p className="text-[#333] text-sm mt-1">If the claim work costs more than the remaining balance, no refund will be due.</p>
                    </div>
                  </div>
                </div>
              </div>

              {/* Paid Monthly Finance */}
              <div className="bg-[#fff7ed] rounded-xl p-5 border-2 border-[#FF7A00]/30">
                <div className="flex items-center gap-2 mb-4">
                  <CreditCard className="w-5 h-5 text-[#FF7A00]" />
                  <p className="font-bold text-[#000] text-lg">Paid Monthly Finance</p>
                </div>
                <div className="space-y-2">
                  <div className="flex items-start gap-2">
                    <AlertCircle className="w-4 h-4 text-[#FF7A00] flex-shrink-0 mt-0.5" />
                    <p className="text-[#333] text-sm">Cancelling your warranty <strong>doesn't automatically cancel</strong> your finance plan.</p>
                  </div>
                  <div className="flex items-start gap-2">
                    <ArrowRight className="w-4 h-4 text-[#FF7A00] flex-shrink-0 mt-0.5" />
                    <p className="text-[#333] text-sm">Your finance provider will then update or close your plan.</p>
                  </div>
                  <div className="flex items-start gap-2">
                    <CheckCircle className="w-4 h-4 text-[#009A44] flex-shrink-0 mt-0.5" />
                    <p className="text-[#333] text-sm">Any refund due will be handled directly by the finance provider.</p>
                  </div>
                  <div className="flex items-start gap-2 mt-2 bg-[#009A44]/10 rounded-lg p-2">
                    <CheckCircle className="w-4 h-4 text-[#009A44] flex-shrink-0 mt-0.5" />
                    <p className="text-[#009A44] text-sm font-semibold">But don't worry – we'll help you with the process 💪</p>
                  </div>
                </div>
              </div>
            </div>
          </section>

          <hr className="border-[#E6E6E6]" />

          {/* ── Alternative Options ── */}
          <section className="space-y-4" aria-labelledby="alternatives-heading">
            <div className="flex items-center gap-3">
              <div className="w-10 h-10 bg-[#f9f9f9] rounded-full flex items-center justify-center flex-shrink-0">
                <Pause className="w-5 h-5 text-[#333]" />
              </div>
              <h2 id="alternatives-heading" className="text-2xl font-bold text-[#000]">Alternative Options</h2>
            </div>

            <p className="text-[#333]">Before cancelling, you may want to consider these options.</p>

            <div className="space-y-4">
              <div className="flex items-start gap-4 bg-[#f9f9f9] rounded-lg p-4 border border-[#E6E6E6]">
                <div className="w-9 h-9 bg-white rounded-full flex items-center justify-center flex-shrink-0 border border-[#E6E6E6]">
                  <Pause className="w-4 h-4 text-[#FF7A00]" />
                </div>
                <div>
                  <p className="font-semibold text-[#000]">Pause Your Cover</p>
                  <p className="text-[#333] text-sm">Pause your cover for up to three months.</p>
                </div>
              </div>
              <div className="flex items-start gap-4 bg-[#f9f9f9] rounded-lg p-4 border border-[#E6E6E6]">
                <div className="w-9 h-9 bg-white rounded-full flex items-center justify-center flex-shrink-0 border border-[#E6E6E6]">
                  <ArrowRightLeft className="w-4 h-4 text-[#FF7A00]" />
                </div>
                <div>
                  <p className="font-semibold text-[#000]">Transfer Your Warranty</p>
                  <p className="text-[#333] text-sm">If you are selling your car, you can transfer your warranty to the new owner.</p>
                </div>
              </div>
              <div className="flex items-start gap-4 bg-[#f9f9f9] rounded-lg p-4 border border-[#E6E6E6]">
                <div className="w-9 h-9 bg-white rounded-full flex items-center justify-center flex-shrink-0 border border-[#E6E6E6]">
                  <Star className="w-4 h-4 text-[#FF7A00]" />
                </div>
                <div>
                  <p className="font-semibold text-[#000]">Upgrade Your Plan</p>
                  <p className="text-[#333] text-sm">You can upgrade to a more comprehensive plan.</p>
                </div>
              </div>
            </div>

            <p className="text-[#333] text-sm">
              If you would like to explore these options, <button onClick={() => document.getElementById('stay-section')?.scrollIntoView({ behavior: 'smooth' })} className="text-[#FF7A00] hover:underline font-semibold">contact us</button>.
            </p>
          </section>

          <hr className="border-[#E6E6E6]" />

          {/* ── Refund Timeline ── */}
          <section className="space-y-4" aria-labelledby="timeline-heading">
            <h2 id="timeline-heading" className="text-2xl font-bold text-[#000]">Refund Timeline</h2>
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              <div className="bg-[#f0faf4] border border-[#009A44]/30 rounded-lg p-5 text-center">
                <Clock className="w-6 h-6 text-[#009A44] mx-auto mb-2" />
                <p className="font-semibold text-[#000] mb-1">Cooling off refunds</p>
                <p className="text-[#009A44] font-bold">Processed within 7 working days</p>
              </div>
              <div className="bg-[#fff7ed] border border-[#FF7A00]/30 rounded-lg p-5 text-center">
                <Clock className="w-6 h-6 text-[#FF7A00] mx-auto mb-2" />
                <p className="font-semibold text-[#000] mb-1">After 14 day refunds</p>
                <p className="text-[#FF7A00] font-bold">Processed within 14 working days</p>
              </div>
            </div>
          </section>

          <hr className="border-[#E6E6E6]" />

          {/* ── What if a claim has been made ── */}
          <section className="space-y-3" aria-labelledby="claim-heading">
            <div className="flex items-center gap-3">
              <div className="w-10 h-10 bg-[#f9f9f9] rounded-full flex items-center justify-center flex-shrink-0">
                <Info className="w-5 h-5 text-[#666]" />
              </div>
              <h2 id="claim-heading" className="text-2xl font-bold text-[#000]">What if a claim has been made</h2>
            </div>
            <p className="text-[#333] leading-relaxed">
              If a claim has already been started or completed, your warranty remains active for the rest of the term.
            </p>
            <p className="text-[#333] leading-relaxed">
              Refunds do not usually apply because the service has already been provided.
            </p>
          </section>

          <hr className="border-[#E6E6E6]" />

          {/* ── Exceptional Circumstances ── */}
          <section className="space-y-3" aria-labelledby="exceptional-heading">
            <div className="flex items-center gap-3">
              <div className="w-10 h-10 bg-[#fff7ed] rounded-full flex items-center justify-center flex-shrink-0">
                <Heart className="w-5 h-5 text-[#FF7A00]" />
              </div>
              <h2 id="exceptional-heading" className="text-2xl font-bold text-[#000]">Exceptional Circumstances</h2>
            </div>
            <p className="text-[#333] leading-relaxed">
              If your situation is unusual or unexpected, tell us.
            </p>
            <p className="text-[#333] leading-relaxed">
              We review every request individually and always aim to be fair.
            </p>
          </section>

          <hr className="border-[#E6E6E6]" />

          {/* ── Stay Offer ── */}
          <section id="stay-section" className="bg-[#f0faf4] border-2 border-[#009A44] rounded-lg p-6 sm:p-8" aria-labelledby="stay-heading">
            <div className="text-center mb-5">
              <div className="w-12 h-12 bg-[#009A44] rounded-full flex items-center justify-center mx-auto mb-3">
                <ShieldCheck className="w-6 h-6 text-white" />
              </div>
              <h2 id="stay-heading" className="text-2xl font-bold text-[#000] mb-3">We would love to keep you as a valued customer</h2>
              <p className="text-[#333]">
                If you decide to stay with us, we can offer special incentives that may include
              </p>
            </div>

            <div className="bg-white rounded-lg p-4 mb-5 border border-[#009A44]/20">
              <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
                <div className="flex items-center gap-2 text-[#333]">
                  <CheckCircle className="w-5 h-5 text-[#009A44] flex-shrink-0" />
                  <span className="text-sm font-medium">Three months extended cover</span>
                </div>
                <div className="flex items-center gap-2 text-[#333]">
                  <CheckCircle className="w-5 h-5 text-[#009A44] flex-shrink-0" />
                  <span className="text-sm font-medium">Vehicle rental benefits</span>
                </div>
                <div className="flex items-center gap-2 text-[#333]">
                  <CheckCircle className="w-5 h-5 text-[#009A44] flex-shrink-0" />
                  <span className="text-sm font-medium">Recovery assistance upgrades</span>
                </div>
              </div>
            </div>

            <p className="text-[#333] text-center mb-5">
              Message us on <a href="https://wa.me/message/SPQPJ6O3UBF5B1" target="_blank" rel="noopener noreferrer" className="text-[#009A44] font-semibold hover:underline">WhatsApp</a> or call <a href="tel:03302295040" className="text-[#009A44] font-semibold hover:underline">0330 229 5040</a> if you would like to continue your cover.
            </p>

            {!showStayForm ? (
              <Button
                onClick={() => setShowStayForm(true)}
                className="w-full h-12 bg-[#009A44] hover:bg-[#007a36] text-white font-bold rounded-lg text-lg"
              >
                Keep my cover
              </Button>
            ) : (
              <div className="space-y-3 bg-white border border-[#009A44]/20 rounded-lg p-4">
                <div>
                  <label className="block text-sm font-medium text-[#333] mb-1">Registration Plate *</label>
                  <Input
                    type="text"
                    placeholder="e.g. AB12 CDE"
                    value={stayFormData.registrationPlate}
                    onChange={(e) => setStayFormData({ ...stayFormData, registrationPlate: e.target.value.toUpperCase() })}
                    className="h-12 bg-[#FFD700] border-2 border-[#000] text-[#000] font-bold text-lg text-center tracking-widest placeholder:text-[#000]/40 placeholder:font-normal placeholder:text-base placeholder:tracking-normal"
                  />
                </div>
                <div>
                  <label className="block text-sm font-medium text-[#333] mb-1">Email Address *</label>
                  <Input
                    type="email"
                    placeholder="your@email.com"
                    value={stayFormData.email}
                    onChange={(e) => setStayFormData({ ...stayFormData, email: e.target.value })}
                    className={`h-12 border-[#E6E6E6] bg-white ${stayFormData.email ? 'text-[#000] font-semibold' : ''}`}
                  />
                </div>
                <Button
                  onClick={handleStayWithUs}
                  disabled={isStaying || !stayFormData.email || !stayFormData.registrationPlate}
                  className="w-full h-12 bg-[#009A44] hover:bg-[#007a36] text-white font-bold rounded-lg"
                >
                  {isStaying ? 'Processing...' : 'Confirm & Keep My Cover'}
                </Button>
                <button
                  type="button"
                  onClick={() => setShowStayForm(false)}
                  className="w-full text-sm text-[#666] hover:text-[#333]"
                >
                  Cancel
                </button>
              </div>
            )}
          </section>

          <hr className="border-[#E6E6E6]" />

          {/* ── Cancel Form ── */}
          <section id="cancel-form" className="space-y-4" aria-labelledby="cancel-heading">
            <div className="flex items-center gap-3">
              <div className="w-10 h-10 bg-[#fff7ed] rounded-full flex items-center justify-center flex-shrink-0">
                <FileText className="w-5 h-5 text-[#FF7A00]" />
              </div>
              <h2 id="cancel-heading" className="text-2xl font-bold text-[#000]">Cancel my warranty</h2>
            </div>

            <p className="text-[#333]">
              We are sorry to see you go. Please confirm your details so we can process your cancellation.
            </p>

            <form onSubmit={handleSubmit} className="space-y-4">
              <div>
                <label htmlFor="reg" className="block text-sm font-medium text-[#333] mb-1">Registration Number *</label>
                <div className="max-w-[280px]">
                  <Input
                    id="reg"
                    type="text"
                    placeholder="ENTER REG"
                    value={formData.registrationPlate}
                    onChange={(e) => setFormData({ ...formData, registrationPlate: e.target.value.toUpperCase() })}
                    className="h-12 bg-[#FFD700] border-2 border-[#000] text-[#000] font-bold text-lg text-center tracking-widest rounded-lg placeholder:text-[#000]/40 placeholder:font-normal placeholder:text-base placeholder:tracking-normal"
                    aria-required="true"
                  />
                </div>
              </div>
              <div>
                <label htmlFor="cancel-email" className="block text-sm font-medium text-[#333] mb-1">Email Address *</label>
                <Input
                  id="cancel-email"
                  type="email"
                  placeholder="your@email.com"
                  value={formData.email}
                  onChange={(e) => setFormData({ ...formData, email: e.target.value })}
                  className={`h-12 border-[#E6E6E6] bg-white ${formData.email ? 'text-[#000] font-semibold' : ''}`}
                  aria-required="true"
                />
              </div>
              <div>
                <label htmlFor="cancel-reason" className="block text-sm font-medium text-[#333] mb-1">Reason for Cancellation *</label>
                <Select value={formData.reason} onValueChange={(value) => setFormData({ ...formData, reason: value, serviceIssue: '' })}>
                  <SelectTrigger id="cancel-reason" className={`h-12 border-[#E6E6E6] bg-white ${formData.reason ? 'text-[#000] font-semibold' : ''}`} aria-required="true">
                    <SelectValue placeholder="Select a reason" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="sold-my-car">Sold my car</SelectItem>
                    <SelectItem value="getting-a-new-car">Getting a new car</SelectItem>
                    <SelectItem value="car-written-off">Car written off</SelectItem>
                    <SelectItem value="too-expensive">Too expensive</SelectItem>
                    <SelectItem value="found-cheaper-cover">Found cheaper cover</SelectItem>
                    <SelectItem value="want-different-features">Want different features</SelectItem>
                    <SelectItem value="not-needed-anymore">Not needed anymore</SelectItem>
                    <SelectItem value="change-in-circumstances">Change in circumstances</SelectItem>
                    <SelectItem value="unhappy-with-service">Unhappy with service</SelectItem>
                    <SelectItem value="other">Other</SelectItem>
                  </SelectContent>
                </Select>
              </div>
              {formData.reason === 'unhappy-with-service' && (
                <div className="space-y-3 bg-[#fff7ed] border border-[#FF7A00]/30 rounded-lg p-4">
                  <p className="text-sm font-semibold text-[#000]">We'd really like to put things right. Help us understand what happened.</p>
                  <div>
                    <label htmlFor="service-issue" className="block text-sm font-medium text-[#333] mb-1">How can we do things better? *</label>
                    <Select value={formData.serviceIssue || ''} onValueChange={(value) => setFormData({ ...formData, serviceIssue: value })}>
                      <SelectTrigger id="service-issue" className="h-12 border-[#E6E6E6] bg-white">
                        <SelectValue placeholder="Select an issue" />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="slow-response">Slow response times</SelectItem>
                        <SelectItem value="claim-denied">Claim was denied</SelectItem>
                        <SelectItem value="poor-communication">Poor communication</SelectItem>
                        <SelectItem value="cover-not-as-expected">Cover not as expected</SelectItem>
                        <SelectItem value="difficult-claims-process">Difficult claims process</SelectItem>
                        <SelectItem value="other-service-issue">Other</SelectItem>
                      </SelectContent>
                    </Select>
                  </div>
                  <div>
                    <label htmlFor="service-detail" className="block text-sm font-medium text-[#333] mb-1">Tell us a little more (optional)</label>
                    <Textarea
                      id="service-detail"
                      placeholder="Your feedback helps us improve for everyone..."
                      value={formData.serviceDetail || ''}
                      onChange={(e) => setFormData({ ...formData, serviceDetail: e.target.value })}
                      className="border-[#E6E6E6] bg-white min-h-[80px]"
                    />
                  </div>
                </div>
              )}
              <div>
                <label htmlFor="cancel-msg" className="block text-sm font-medium text-[#333] mb-1">Message (optional)</label>
                <Textarea
                  id="cancel-msg"
                  placeholder="Anything else you'd like us to know?"
                  value={formData.message}
                  onChange={(e) => setFormData({ ...formData, message: e.target.value })}
                  className="border-[#E6E6E6] bg-white min-h-[100px]"
                />
              </div>
              <Button
                type="submit"
                disabled={isSubmitting}
                className="w-full h-14 bg-[#FF7A00] hover:bg-[#e56e00] text-white font-bold text-lg rounded-lg"
              >
                {isSubmitting ? 'Submitting...' : 'Cancel my warranty'}
              </Button>
            </form>
          </section>

          {/* Need Help */}
          <section className="text-center py-8 border-t border-[#E6E6E6]" aria-label="Contact support">
            <h3 className="text-lg font-bold text-[#000] mb-2">Need Help?</h3>
            <p className="text-[#333] mb-4">Our friendly team is here to assist.</p>
            <div className="flex flex-wrap gap-4 justify-center">
              <a href="mailto:support@buyawarranty.co.uk" className="flex items-center gap-2 text-[#FF7A00] hover:underline font-medium">
                <Mail className="w-4 h-4" /> support@buyawarranty.co.uk
              </a>
              <a href="tel:03302295045" className="flex items-center gap-2 text-[#333] hover:underline font-medium">
                <Phone className="w-4 h-4" /> 0330 229 5045
              </a>
              <a
                href="https://wa.me/443302295040?text=Hi%2C%20I%20have%20a%20question%20about%20cancelling%20my%20warranty"
                target="_blank"
                rel="noopener noreferrer"
                className="flex items-center gap-2 text-[#009A44] hover:underline font-medium"
              >
                <MessageCircle className="w-4 h-4" /> WhatsApp Us
              </a>
            </div>
          </section>
        </main>
      </div>
    </>
  );
};

export default CancelWarranty;
