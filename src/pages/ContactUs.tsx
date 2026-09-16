import React, { useState } from 'react';
import { MessageCircle, Mail, Clock, Upload, X, ArrowRight, Phone, MapPin, HeartHandshake, Timer, ShieldCheck, Milestone, CheckCircle2, Loader2 } from 'lucide-react';


import { SEOHead } from '@/components/SEOHead';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Textarea } from '@/components/ui/textarea';
import { Label } from '@/components/ui/label';
import { useToast } from '@/hooks/use-toast';
import { supabase } from '@/integrations/supabase/client';
import TrustpilotMicroStarWidget from '@/components/TrustpilotMicroStarWidget';
import { SALES_PHONE, SALES_PHONE_TEL, CLAIMS_PHONE, CLAIMS_PHONE_TEL, SUPPORT_EMAIL, CLAIMS_EMAIL, WHATSAPP_URL } from '@/constants/contact';
import pandaSupport from '@/assets/buyawarranty-customer-support-panda.asset.json';

const ALLOWED_TYPES = [
  'application/pdf',
  'application/msword',
  'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
  'image/jpeg',
  'image/png',
  'image/jpg',
];

const ContactUs = () => {
  const { toast } = useToast();
  


  const [formData, setFormData] = useState({
    name: '',
    email: '',
    phone: '',
    message: ''
  });
  const [file, setFile] = useState<File | null>(null);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [isDragging, setIsDragging] = useState(false);
  const [reference, setReference] = useState<string | null>(null);

  // Callback micro-form
  const [callbackPhone, setCallbackPhone] = useState('');
  const [callbackTime, setCallbackTime] = useState('Anytime');
  const [callbackSending, setCallbackSending] = useState(false);
  const [callbackDone, setCallbackDone] = useState(false);

  const handleInputChange = (e: React.ChangeEvent<HTMLInputElement | HTMLTextAreaElement>) => {
    const { name, value } = e.target;

    if (name === 'phone') {
      const filteredValue = value.replace(/[^\d\s\-+]/g, '');
      setFormData({ ...formData, [name]: filteredValue });
    } else {
      setFormData({ ...formData, [name]: value });
    }
  };

  const acceptFile = (selectedFile: File) => {
    if (selectedFile.size > 20 * 1024 * 1024) {
      toast({
        title: "File too large",
        description: "Please upload a file smaller than 20MB.",
        variant: "destructive",
      });
      return;
    }
    if (!ALLOWED_TYPES.includes(selectedFile.type)) {
      toast({
        title: "Invalid file type",
        description: "Please upload a PDF, DOC, DOCX, JPG, or PNG file.",
        variant: "destructive",
      });
      return;
    }
    setFile(selectedFile);
  };

  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const selectedFile = e.target.files?.[0];
    if (selectedFile) acceptFile(selectedFile);
  };

  const removeFile = () => {
    setFile(null);
    const fileInput = document.getElementById('file-upload') as HTMLInputElement;
    if (fileInput) fileInput.value = '';
  };

  const handleDragOver = (e: React.DragEvent<HTMLDivElement>) => {
    e.preventDefault();
    e.stopPropagation();
    setIsDragging(true);
  };

  const handleDragLeave = (e: React.DragEvent<HTMLDivElement>) => {
    e.preventDefault();
    e.stopPropagation();
    setIsDragging(false);
  };

  const handleDrop = (e: React.DragEvent<HTMLDivElement>) => {
    e.preventDefault();
    e.stopPropagation();
    setIsDragging(false);
    const dropped = e.dataTransfer.files?.[0];
    if (dropped) acceptFile(dropped);
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();

    if (!formData.name || !formData.email) {
      toast({
        title: "Missing information",
        description: "Please fill in your name and email address.",
        variant: "destructive",
      });
      return;
    }

    setIsSubmitting(true);

    try {
      let fileData = null;

      if (file) {
        const reader = new FileReader();
        const fileBase64 = await new Promise<string>((resolve, reject) => {
          reader.onload = () => resolve(reader.result as string);
          reader.onerror = reject;
          reader.readAsDataURL(file);
        });

        fileData = { name: file.name, size: file.size, type: file.type, data: fileBase64 };
      }

      const response = await supabase.functions.invoke('submit-contact', {
        body: {
          name: formData.name,
          email: formData.email,
          phone: formData.phone,
          message: formData.message,
          file: fileData
        }
      });

      if (response.error) {
        throw new Error(response.error.message || 'Failed to submit contact form');
      }

      setReference(`BAW-${Math.floor(10000 + Math.random() * 89999)}`);
      setFormData({ name: '', email: '', phone: '', message: '' });
      setFile(null);

    } catch (error: any) {
      console.error('Submission error:', error);
      toast({
        title: "Submission failed",
        description: error.message || `Please try again or call us on ${SALES_PHONE}.`,
        variant: "destructive",
      });
    } finally {
      setIsSubmitting(false);
    }
  };

  const validUkPhone = (value: string) => {
    const cleaned = value.replace(/\D/g, '');
    if (cleaned.startsWith('07') && cleaned.length === 11) return true;
    if ((cleaned.startsWith('01') || cleaned.startsWith('02')) && cleaned.length >= 10 && cleaned.length <= 11) return true;
    if (cleaned.startsWith('03') && cleaned.length === 11) return true;
    return false;
  };

  const handleCallbackSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!validUkPhone(callbackPhone)) {
      toast({
        title: "Check your number",
        description: "Please enter a valid UK phone number, for example 07123 456789.",
        variant: "destructive",
      });
      return;
    }

    setCallbackSending(true);
    try {
      const { error } = await supabase
        .from('abandoned_carts')
        .insert({
          phone: callbackPhone.replace(/\D/g, ''),
          email: `callback_${Date.now()}@callback.temp`,
          step_abandoned: 0,
          contact_status: 'new',
          contact_notes: `[${new Date().toLocaleDateString('en-GB')} - System] Callback requested from contact page. Preferred time: ${callbackTime}`,
          full_name: 'Callback Request',
          cart_metadata: {
            source: 'contact_page_callback',
            priority: 'urgent',
            request_type: 'urgent_callback',
            preferred_time: callbackTime,
          }
        });
      if (error) throw error;
      setCallbackDone(true);
      setCallbackPhone('');
    } catch (err: any) {
      console.error('Callback request error:', err);
      toast({
        title: "Something went wrong",
        description: `Please try again or call us on ${SALES_PHONE}.`,
        variant: "destructive",
      });
    } finally {
      setCallbackSending(false);
    }
  };

  const features = [
    {
      icon: <HeartHandshake className="w-7 h-7 text-brand-orange" />,
      title: 'Friendly UK team',
      text: 'Real people based in the UK, ready to help with quotes, cover and claims.',
    },
    {
      icon: <Timer className="w-7 h-7 text-brand-orange" />,
      title: 'Quick response',
      text: 'Fast answers by phone, email or WhatsApp — so you are never left waiting.',
    },
    {
      icon: <ShieldCheck className="w-7 h-7 text-brand-orange" />,
      title: 'Trusted by thousands',
      text: 'Thousands of UK drivers protect their vehicles with us every year.',
    },
    {
      icon: <Milestone className="w-7 h-7 text-brand-orange" />,
      title: 'Here long-term',
      text: 'From your first quote to any claim, we stick with you for the miles ahead.',
    },
  ];

  return (
    <>
      <SEOHead
        title="Contact Buy A Warranty | UK Car Warranty Support & Claims Help"
        description="Contact the Buy A Warranty UK team for support, claims help or a quote. Call, email or message us on WhatsApp — Monday to Saturday, 9am to 6pm."
        keywords="contact us, customer service, warranty support, claims help, contact"
      />

      <div className="min-h-screen bg-white">
        {/* ── CONTACT HERO: choose a route ── */}
        <section className="bg-[#F7F8FA] pt-10 pb-8 sm:pt-14 sm:pb-12 lg:pt-16 lg:pb-14 px-4">
          <div className="max-w-[1180px] mx-auto">
            <div className="flex items-center justify-center gap-4 mb-6 sm:mb-8">
              <img
                src={pandaSupport.url}
                alt="Buy A Warranty UK customer support panda answering the phone — friendly car warranty help team"
                width={384}
                height={480}
                className="w-16 sm:w-20 lg:w-24 h-auto shrink-0"
                loading="eager"
                fetchPriority="high"
              />
              <div className="text-left">
                <p className="text-brand-orange text-sm sm:text-base font-bold">Contact us</p>
                <h1 className="text-3xl sm:text-4xl lg:text-[2.75rem] leading-tight font-extrabold text-[#11253E]">
                  We're here to help
                </h1>
                <p className="text-gray-600 text-sm sm:text-base mt-1">
                  Get support, talk to our claims team, or message us on WhatsApp.
                </p>
              </div>
            </div>

            {/* Three equal route cards */}
            <div className="grid grid-cols-1 md:grid-cols-3 gap-5 sm:gap-6">
              {/* Customer support */}
              <div className="bg-white rounded-2xl border border-gray-200 shadow-sm p-5 sm:p-6 flex flex-col">
                <div className="flex items-center gap-3 mb-3">
                  <div className="w-11 h-11 rounded-full bg-brand-orange/10 flex items-center justify-center">
                    <Phone className="w-5 h-5 text-brand-orange" />
                  </div>
                  <h2 className="text-lg font-bold text-[#11253E]">Customer support</h2>
                </div>
                <p className="text-gray-600 text-sm mb-4">Quotes, cover questions and anything about your policy.</p>
                <a
                  href={SALES_PHONE_TEL}
                  className="block text-center bg-brand-orange hover:bg-brand-orange/90 text-white font-bold rounded-xl py-3 text-base transition-colors"
                >
                  Call {SALES_PHONE}
                </a>
                <a
                  href={`mailto:${SUPPORT_EMAIL}`}
                  className="mt-3 inline-flex items-center justify-center gap-2 text-[#11253E] font-semibold text-sm hover:text-brand-orange transition-colors"
                >
                  <Mail className="w-4 h-4" /> Email us <ArrowRight className="w-4 h-4" />
                </a>
                <span className="mt-3 text-center text-gray-500 text-sm">Monday – Saturday · 9am to 6pm</span>
              </div>

              {/* Claims & repairs */}
              <div className="bg-white rounded-2xl border border-gray-200 shadow-sm p-5 sm:p-6 flex flex-col">
                <div className="flex items-center gap-3 mb-3">
                  <div className="w-11 h-11 rounded-full bg-brand-orange/10 flex items-center justify-center">
                    <ShieldCheck className="w-5 h-5 text-brand-orange" />
                  </div>
                  <h2 className="text-lg font-bold text-[#11253E]">Claims &amp; repairs</h2>
                </div>
                <p className="text-gray-600 text-sm mb-4">Start a claim or check progress with our claims team.</p>
                <a
                  href={CLAIMS_PHONE_TEL}
                  className="block text-center bg-brand-orange hover:bg-brand-orange/90 text-white font-bold rounded-xl py-3 text-base transition-colors"
                >
                  Call {CLAIMS_PHONE}
                </a>
                <a
                  href={`mailto:${CLAIMS_EMAIL}`}
                  className="mt-3 inline-flex items-center justify-center gap-2 text-[#11253E] font-semibold text-sm hover:text-brand-orange transition-colors"
                >
                  <Mail className="w-4 h-4" /> Email us <ArrowRight className="w-4 h-4" />
                </a>
                <span className="mt-3 text-center text-gray-500 text-sm">Monday – Friday · 9am to 5pm</span>
              </div>

              {/* WhatsApp */}
              <div className="bg-white rounded-2xl border border-gray-200 shadow-sm p-5 sm:p-6 flex flex-col order-first md:order-none">
                <div className="flex items-center gap-3 mb-3">
                  <div className="w-11 h-11 rounded-full bg-green-100 flex items-center justify-center">
                    <MessageCircle className="w-5 h-5 text-green-600" />
                  </div>
                  <h2 className="text-lg font-bold text-[#11253E]">WhatsApp</h2>
                </div>
                <p className="text-gray-600 text-sm mb-4">Quick question? Message us and we'll be right with you.</p>
                <a
                  href={WHATSAPP_URL}
                  target="_blank"
                  rel="noopener noreferrer nofollow"
                  className="block text-center bg-green-600 hover:bg-green-700 text-white font-bold rounded-xl py-3 text-base transition-colors"
                >
                  Start chat
                </a>
                <span className="mt-3 text-center text-gray-500 text-sm">Replies during opening hours</span>
              </div>
            </div>

            <div className="mt-6 flex flex-col sm:flex-row items-center justify-center gap-3 sm:gap-6">
              <p className="text-gray-600 text-sm font-medium inline-flex items-center gap-2">
                <Clock className="w-4 h-4 text-brand-orange" /> Customer support: Monday – Saturday · 9am to 6pm
              </p>
              <p className="text-gray-600 text-sm font-medium inline-flex items-center gap-2">
                <Clock className="w-4 h-4 text-brand-orange" /> Claims &amp; repairs: Monday – Friday · 9am to 5pm
              </p>
              <TrustpilotMicroStarWidget className="max-w-xs" />
            </div>
          </div>
        </section>

        {/* ── MAIN CONTACT AREA: form + callback ── */}
        <section className="py-12 sm:py-16 lg:py-20 px-4 bg-white">
          <div className="max-w-[1180px] mx-auto">
            <div className="grid grid-cols-1 lg:grid-cols-12 gap-6 sm:gap-8 items-start">
              {/* Form — 65% */}
              <div className="lg:col-span-8 bg-white rounded-2xl shadow-lg border border-gray-200 p-5 sm:p-7">
                {reference ? (
                  <div className="py-8 text-center space-y-4">
                    <div className="w-16 h-16 mx-auto rounded-full bg-emerald-100 flex items-center justify-center">
                      <CheckCircle2 className="w-9 h-9 text-emerald-600" />
                    </div>
                    <h2 className="text-2xl font-bold text-[#11253E]">Thanks — we've got your message.</h2>
                    <p className="text-gray-600">Our team usually responds within 1–2 business days.</p>
                    <p className="text-sm font-semibold text-[#11253E]">Reference: {reference}</p>
                    <Button
                      variant="outline"
                      onClick={() => setReference(null)}
                      className="mt-2"
                    >
                      Send another message
                    </Button>
                  </div>
                ) : (
                  <>
                    <h2 className="text-xl sm:text-2xl font-bold text-[#11253E] mb-1">Send us a message</h2>
                    <p className="text-gray-600 text-sm mb-6">Usually answered within 1–2 business days.</p>

                    <form onSubmit={handleSubmit} className="space-y-5">
                      <div>
                        <Label htmlFor="name" className="text-[#11253E] font-semibold text-sm">
                          Name <span className="text-red-500">*</span>
                        </Label>
                        <Input
                          id="name"
                          name="name"
                          type="text"
                          value={formData.name}
                          onChange={handleInputChange}
                          required
                          className="mt-1.5 h-12"
                        />
                      </div>

                      <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                        <div>
                          <Label htmlFor="email" className="text-[#11253E] font-semibold text-sm">
                            Email <span className="text-red-500">*</span>
                          </Label>
                          <Input
                            id="email"
                            name="email"
                            type="email"
                            value={formData.email}
                            onChange={handleInputChange}
                            required
                            className="mt-1.5 h-12"
                          />
                        </div>
                        <div>
                          <Label htmlFor="phone" className="text-[#11253E] font-semibold text-sm">
                            Phone <span className="text-gray-400 font-normal">(optional)</span>
                          </Label>
                          <Input
                            id="phone"
                            name="phone"
                            type="tel"
                            value={formData.phone}
                            onChange={handleInputChange}
                            pattern="[\d\s\-+]*"
                            className="mt-1.5 h-12"
                          />
                        </div>
                      </div>

                      {/* Attachment */}
                      <div>
                        <Label htmlFor="file-upload" className="text-[#11253E] font-semibold text-sm">
                          Attachment <span className="text-gray-400 font-normal">(optional)</span>
                        </Label>
                        <p className="text-gray-500 text-xs mb-2">Accepted formats: PDF, DOC, DOCX, JPG, PNG — up to 20MB</p>

                        {!file ? (
                          <div className="mt-1">
                            <label htmlFor="file-upload" className="cursor-pointer">
                              <div
                                className={`border-2 border-dashed rounded-xl p-5 text-center transition-colors ${
                                  isDragging ? 'border-brand-orange bg-brand-orange/5' : 'border-gray-300 hover:border-brand-orange'
                                }`}
                                onDragOver={handleDragOver}
                                onDragLeave={handleDragLeave}
                                onDrop={handleDrop}
                              >
                                <Upload className="mx-auto h-7 w-7 text-gray-400" />
                                <p className="mt-2 text-sm text-gray-600">Click to upload or drag and drop</p>
                              </div>
                            </label>
                            <input
                              id="file-upload"
                              name="file-upload"
                              type="file"
                              className="hidden"
                              accept=".pdf,.doc,.docx,.jpg,.jpeg,.png"
                              onChange={handleFileChange}
                            />
                          </div>
                        ) : (
                          <div className="mt-1 p-3 bg-emerald-50 rounded-xl border border-emerald-200 flex items-center justify-between">
                            <div className="flex items-center gap-3">
                              <CheckCircle2 className="h-5 w-5 text-emerald-600 shrink-0" />
                              <div>
                                <p className="text-sm font-semibold text-gray-900">File attached — {file.name}</p>
                                <p className="text-xs text-gray-500">{(file.size / 1024 / 1024).toFixed(2)} MB</p>
                              </div>
                            </div>
                            <Button
                              type="button"
                              variant="ghost"
                              size="sm"
                              onClick={removeFile}
                              className="text-gray-500 hover:text-red-500"
                            >
                              <X className="h-4 w-4" />
                            </Button>
                          </div>
                        )}
                      </div>

                      <div>
                        <Label htmlFor="message" className="text-[#11253E] font-semibold text-sm">
                          Message
                        </Label>
                        <Textarea
                          id="message"
                          name="message"
                          placeholder="How can we help?"
                          value={formData.message}
                          onChange={handleInputChange}
                          rows={8}
                          className="mt-1.5 min-h-[180px]"
                        />
                      </div>

                      <Button
                        type="submit"
                        disabled={isSubmitting}
                        className="w-full sm:w-auto bg-brand-orange hover:bg-brand-orange/90 text-white font-bold px-8 h-12 text-base rounded-xl disabled:opacity-50 inline-flex items-center gap-2"
                      >
                        {isSubmitting ? (
                          <>
                            <Loader2 className="w-5 h-5 animate-spin" /> Sending...
                          </>
                        ) : (
                          <>
                            Send message <ArrowRight className="w-5 h-5" strokeWidth={3} />
                          </>
                        )}
                      </Button>
                    </form>
                  </>
                )}
              </div>

              {/* Callback panel — 35% */}
              <div className="lg:col-span-4 space-y-5">
                <div className="bg-[#F7F8FA] border border-gray-200 rounded-2xl p-5 sm:p-6">
                  <div className="flex items-center gap-3 mb-2">
                    <div className="w-10 h-10 rounded-full bg-brand-orange/10 flex items-center justify-center">
                      <Phone className="w-5 h-5 text-brand-orange" />
                    </div>
                    <h2 className="text-lg font-bold text-[#11253E]">Prefer us to call you?</h2>
                  </div>

                  {callbackDone ? (
                    <div className="py-3 space-y-2">
                      <div className="inline-flex items-center gap-2 text-emerald-700 font-semibold text-sm">
                        <CheckCircle2 className="w-5 h-5" /> Callback requested
                      </div>
                      <p className="text-sm text-gray-600">We'll call you during business hours — usually the same day.</p>
                    </div>
                  ) : (
                    <form onSubmit={handleCallbackSubmit} className="space-y-4">
                      <div>
                        <Label htmlFor="callback-phone" className="text-[#11253E] font-semibold text-sm">Phone number</Label>
                        <Input
                          id="callback-phone"
                          type="tel"
                          inputMode="tel"
                          autoComplete="tel"
                          placeholder="07900 000000"
                          value={callbackPhone}
                          onChange={(e) => setCallbackPhone(e.target.value.replace(/[^\d\s+]/g, '').slice(0, 15))}
                          className="mt-1.5 h-12 bg-white"
                        />
                      </div>
                      <div>
                        <Label htmlFor="callback-time" className="text-[#11253E] font-semibold text-sm">Preferred time</Label>
                        <select
                          id="callback-time"
                          value={callbackTime}
                          onChange={(e) => setCallbackTime(e.target.value)}
                          className="mt-1.5 w-full h-12 rounded-md border border-input bg-white px-3 text-sm text-[#11253E]"
                        >
                          <option value="Anytime">Anytime</option>
                          <option value="Morning (9am – 12pm)">Morning (9am – 12pm)</option>
                          <option value="Afternoon (12pm – 3pm)">Afternoon (12pm – 3pm)</option>
                          <option value="Late afternoon (3pm – 5pm)">Late afternoon (3pm – 5pm)</option>
                        </select>
                      </div>
                      <Button
                        type="submit"
                        disabled={callbackSending}
                        className="w-full bg-brand-orange hover:bg-brand-orange/90 text-white font-bold h-12 rounded-xl disabled:opacity-60"
                      >
                        {callbackSending ? (
                          <span className="inline-flex items-center gap-2"><Loader2 className="w-5 h-5 animate-spin" /> Sending...</span>
                        ) : 'Request a callback'}
                      </Button>
                      <p className="text-xs text-gray-500">Usually within business hours.</p>
                    </form>
                  )}

                  <div className="border-t border-gray-200 mt-5 pt-5 space-y-4">
                    <div>
                      <p className="text-sm font-semibold text-[#11253E]">Sales &amp; support</p>
                      <a href={SALES_PHONE_TEL} className="text-lg font-bold text-brand-orange hover:underline">{SALES_PHONE}</a>
                    </div>
                    <div>
                      <p className="text-sm font-semibold text-[#11253E]">Claims &amp; repairs</p>
                      <a href={CLAIMS_PHONE_TEL} className="text-lg font-bold text-brand-orange hover:underline">{CLAIMS_PHONE}</a>
                    </div>
                  </div>
                </div>
              </div>
            </div>
          </div>
        </section>

        {/* ── OTHER INFORMATION ── */}
        <section className="px-4 pb-12 sm:pb-16">
          <div className="max-w-[1180px] mx-auto grid grid-cols-1 sm:grid-cols-2 gap-5 sm:gap-6">
            <div className="bg-[#F7F8FA] border border-gray-200 rounded-xl p-5">
              <div className="flex items-center gap-2 mb-2">
                <Clock className="w-4 h-4 text-brand-orange" />
                <h2 className="text-base font-bold text-[#11253E]">Opening hours</h2>
              </div>
              <p className="text-gray-600 text-sm">Customer support: Monday – Saturday, 9am to 6pm</p>
              <p className="text-gray-600 text-sm">Claims &amp; repairs: Monday – Friday, 9am to 5pm</p>
            </div>
            <div className="bg-[#F7F8FA] border border-gray-200 rounded-xl p-5">
              <div className="flex items-center gap-2 mb-2">
                <MapPin className="w-4 h-4 text-brand-orange" />
                <h2 className="text-base font-bold text-[#11253E]">Postal address</h2>
              </div>
              <address className="not-italic text-gray-600 text-sm leading-relaxed">
                Buy A Warranty Limited, Warranty House, 62 Berkhamsted Avenue, Wembley, London, HA9 6DT, United Kingdom
              </address>
            </div>
          </div>
        </section>

        {/* ── WHY CUSTOMERS CHOOSE US ── */}
        <section className="bg-[#F7F8FA] py-12 sm:py-16 px-4">
          <div className="max-w-[1180px] mx-auto">
            <div className="grid grid-cols-2 lg:grid-cols-4 gap-4 sm:gap-6">
              {features.map((feature) => (
                <div key={feature.title} className="bg-white rounded-xl border border-gray-200 shadow-sm p-5 text-center">
                  <div className="flex justify-center mb-3">
                    <div className="w-12 h-12 rounded-full bg-brand-orange/10 flex items-center justify-center">
                      {feature.icon}
                    </div>
                  </div>
                  <h3 className="text-sm sm:text-base font-bold text-[#11253E] mb-1">{feature.title}</h3>
                  <p className="text-gray-600 text-xs sm:text-sm leading-relaxed">{feature.text}</p>
                </div>
              ))}
            </div>
          </div>
        </section>

      </div>
    </>
  );
};

export default ContactUs;
