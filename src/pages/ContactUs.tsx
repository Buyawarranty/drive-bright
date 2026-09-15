import React, { useState } from 'react';
import { MessageCircle, Mail, Clock, Upload, X, ArrowRight, Phone, MapPin, HeartHandshake, Timer, ShieldCheck, Milestone } from 'lucide-react';
import { useNavigate } from 'react-router-dom';
import RequestCallbackModal from '@/components/modals/RequestCallbackModal';

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

const ContactUs = () => {
  const { toast } = useToast();
  const navigate = useNavigate();

  const navigateToQuoteForm = () => {
    navigate('/');
    setTimeout(() => {
      const element = document.getElementById('quote-form');
      if (element) {
        element.scrollIntoView({ behavior: 'smooth' });
      }
    }, 100);
  };

  const [formData, setFormData] = useState({
    name: '',
    email: '',
    phone: '',
    message: ''
  });
  const [file, setFile] = useState<File | null>(null);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [isDragging, setIsDragging] = useState(false);
  const [showCallbackModal, setShowCallbackModal] = useState(false);
  const handleInputChange = (e: React.ChangeEvent<HTMLInputElement | HTMLTextAreaElement>) => {
    const { name, value } = e.target;

    // For phone field, only allow numbers, spaces, dashes, and plus sign
    if (name === 'phone') {
      const filteredValue = value.replace(/[^\d\s\-+]/g, '');
      setFormData({
        ...formData,
        [name]: filteredValue
      });
    } else {
      setFormData({
        ...formData,
        [name]: value
      });
    }
  };

  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const selectedFile = e.target.files?.[0];
    if (selectedFile) {
      // Validate file size (20MB max)
      if (selectedFile.size > 20 * 1024 * 1024) {
        toast({
          title: "File too large",
          description: "Please upload a file smaller than 20MB.",
          variant: "destructive",
        });
        return;
      }

      // Validate file type
      const allowedTypes = ['application/pdf', 'application/msword', 'application/vnd.openxmlformats-officedocument.wordprocessingml.document', 'image/jpeg', 'image/png', 'image/jpg'];
      if (!allowedTypes.includes(selectedFile.type)) {
        toast({
          title: "Invalid file type",
          description: "Please upload a PDF, DOC, DOCX, JPG, or PNG file.",
          variant: "destructive",
        });
        return;
      }

      setFile(selectedFile);
    }
  };

  const removeFile = () => {
    setFile(null);
    const fileInput = document.getElementById('file-upload') as HTMLInputElement;
    if (fileInput) {
      fileInput.value = '';
    }
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

    const files = e.dataTransfer.files;
    if (files && files.length > 0) {
      const droppedFile = files[0];

      // Validate file size (20MB max)
      if (droppedFile.size > 20 * 1024 * 1024) {
        toast({
          title: "File too large",
          description: "Please upload a file smaller than 20MB.",
          variant: "destructive",
        });
        return;
      }

      // Validate file type
      const allowedTypes = ['application/pdf', 'application/msword', 'application/vnd.openxmlformats-officedocument.wordprocessingml.document', 'image/jpeg', 'image/png', 'image/jpg'];
      if (!allowedTypes.includes(droppedFile.type)) {
        toast({
          title: "Invalid file type",
          description: "Please upload a PDF, DOC, DOCX, JPG, or PNG file.",
          variant: "destructive",
        });
        return;
      }

      setFile(droppedFile);
    }
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();

    if (!formData.name || !formData.email) {
      toast({
        title: "Missing Information",
        description: "Please fill in your name and email address.",
        variant: "destructive",
      });
      return;
    }

    setIsSubmitting(true);

    try {
      let fileData = null;

      if (file) {
        // Convert file to base64
        const reader = new FileReader();
        const fileBase64 = await new Promise<string>((resolve, reject) => {
          reader.onload = () => resolve(reader.result as string);
          reader.onerror = reject;
          reader.readAsDataURL(file);
        });

        fileData = {
          name: file.name,
          size: file.size,
          type: file.type,
          data: fileBase64
        };
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

      toast({
        title: "✓ Message Sent Successfully",
        description: "Thank you for contacting us! We'll get back to you within 1-2 business days.",
        className: "bg-green-500 text-white border-green-600 animate-in slide-in-from-top-5 duration-300",
      });

      // Reset form
      setFormData({
        name: '',
        email: '',
        phone: '',
        message: ''
      });
      setFile(null);

    } catch (error: any) {
      console.error('Submission error:', error);
      toast({
        title: "Submission Failed",
        description: error.message || "Please try again or call us at 0330 229 5045.",
        variant: "destructive",
      });
    } finally {
      setIsSubmitting(false);
    }
  };

  const contactOptions = [
    {
      icon: <Mail size={20} className="sm:w-6 sm:h-6" />,
      title: 'Customer Sales and Support',
      body: (
        <div className="space-y-2">
          <div className="text-sm sm:text-base">
            <span className="font-medium text-gray-700">Email:</span>
            <a href={`mailto:${SUPPORT_EMAIL}`} className="font-bold text-brand-orange hover:underline"> {SUPPORT_EMAIL}</a>
          </div>
          <div className="text-sm sm:text-base">
            <span className="font-medium text-gray-700">Phone:</span>
            <a href={SALES_PHONE_TEL} className="font-bold text-brand-orange hover:underline"> {SALES_PHONE}</a>
          </div>
        </div>
      ),
    },
    {
      icon: <Phone size={20} className="sm:w-6 sm:h-6" />,
      title: 'Claims and Repairs',
      body: (
        <div className="space-y-2">
          <div className="text-sm sm:text-base">
            <span className="font-medium text-gray-700">Email:</span>
            <a href={`mailto:${CLAIMS_EMAIL}`} className="font-bold text-brand-orange hover:underline"> {CLAIMS_EMAIL}</a>
          </div>
          <div className="text-sm sm:text-base">
            <span className="font-medium text-gray-700">Phone:</span>
            <a href={CLAIMS_PHONE_TEL} className="font-bold text-brand-orange hover:underline"> {CLAIMS_PHONE}</a>
          </div>
        </div>
      ),
    },
    {
      icon: <MessageCircle size={20} className="sm:w-6 sm:h-6" />,
      title: 'Chat With Us On WhatsApp',
      body: (
        <div className="space-y-3">
          <p className="text-gray-600 text-sm sm:text-base">Quick question? Send us a message on WhatsApp and we'll be right with you.</p>
          <a href={WHATSAPP_URL} target="_blank" rel="noopener noreferrer nofollow">
            <button className="bg-green-500 hover:bg-green-600 text-white px-4 sm:px-6 py-2 rounded-lg font-medium transition-colors text-sm sm:text-base">
              WhatsApp Us ✓
            </button>
          </a>
        </div>
      ),
    },
    {
      icon: <Clock size={20} className="sm:w-6 sm:h-6" />,
      title: 'Opening Hours',
      body: (
        <p className="text-gray-600 text-sm sm:text-base">Monday – Saturday : 9am to 5pm</p>
      ),
    },
    {
      icon: <MapPin size={20} className="sm:w-6 sm:h-6" />,
      title: 'Our Address',
      body: (
        <div>
          <address className="not-italic text-gray-600 text-sm sm:text-base leading-relaxed">
            Buy A Warranty Limited<br />
            Warranty House<br />
            62 Berkhamsted Avenue<br />
            Wembley, London, HA9 6DT<br />
            United Kingdom
          </address>
          <p className="mt-2 text-gray-500 text-xs sm:text-sm">
            We cover vehicles across the whole of the UK — cover is arranged online or over the phone.
          </p>
        </div>
      ),
    },
  ];

  const features = [
    {
      icon: <HeartHandshake className="w-8 h-8 text-brand-orange" />,
      title: 'Friendly UK Support Team',
      text: 'Real people based in the UK, ready to help with quotes, cover and claims.',
    },
    {
      icon: <Timer className="w-8 h-8 text-brand-orange" />,
      title: 'Quick Response Times',
      text: 'Fast answers by phone, email or WhatsApp — so you are never left waiting.',
    },
    {
      icon: <ShieldCheck className="w-8 h-8 text-brand-orange" />,
      title: 'Trusted by Thousands',
      text: 'Thousands of UK drivers protect their vehicles with us every year.',
    },
    {
      icon: <Milestone className="w-8 h-8 text-brand-orange" />,
      title: 'Here for the Long Journey',
      text: 'From your first quote to any claim, we stick with you for the miles ahead.',
    },
  ];

  return (
    <>
      <SEOHead
        title="Cheap Car Warranty UK | Affordable Extended Cover | BuyA Warranty"
        description="Looking for cheap car warranty in the UK? Contact BuyA Warranty today for affordable extended cover with fast response and expert advice on your policy now."
        keywords="contact us, customer service, warranty support, help, contact"
      />

      <div className="min-h-screen bg-white">
        {/* Hero - Contact Us / We're Here to Help */}
        <section className="bg-gray-50 py-10 sm:py-14 lg:py-20 px-4">
          <div className="max-w-7xl mx-auto">
            <div className="text-center max-w-3xl mx-auto mb-10 sm:mb-14">
              <p className="text-brand-orange text-base sm:text-lg font-bold mb-2">Contact Us</p>
              <h1 className="text-3xl sm:text-4xl lg:text-5xl font-extrabold text-gray-900 mb-4">
                We're Here to <span className="text-brand-orange">Help</span>
              </h1>
              <p className="text-gray-600 text-base sm:text-lg leading-relaxed">
                Whether you have a question, need to make a claim, or just want to chat about your warranty options — our friendly team is ready to help.
              </p>
            </div>

            <div className="flex flex-col lg:flex-row items-center lg:items-start justify-center gap-8 sm:gap-10 lg:gap-14">
              {/* Panda Image */}
              <div className="flex flex-col items-center order-2 lg:order-1 space-y-4 shrink-0">
                <img
                  src={pandaSupport.url}
                  alt="BuyA Warranty UK customer support panda answering the phone — friendly car warranty help and advice team"
                  width={384}
                  height={480}
                  className="w-52 sm:w-60 lg:w-72 h-auto"
                  loading="eager"
                  fetchPriority="high"
                />
                {/* Trustpilot Section */}
                <TrustpilotMicroStarWidget className="max-w-xs" />
              </div>

              {/* Contact Options */}
              <div className="space-y-6 sm:space-y-8 order-1 lg:order-2 w-full max-w-xl lg:max-w-none lg:flex-1">
                {contactOptions.map((option) => (
                  <div key={option.title} className="space-y-3 sm:space-y-4">
                    <div className="flex items-center gap-3">
                      <div className="bg-primary text-white rounded-full p-2">
                        {option.icon}
                      </div>
                      <h2 className="text-lg sm:text-xl font-semibold text-gray-900">{option.title}</h2>
                    </div>
                    <div className="ml-11 sm:ml-14">
                      {option.body}
                    </div>
                  </div>
                ))}
              </div>
            </div>
          </div>
        </section>

        {/* Send Us a Message - Form + Callback */}
        <section className="py-10 sm:py-14 lg:py-20 px-4 bg-white">
          <div className="max-w-7xl mx-auto">
            <div className="grid grid-cols-1 lg:grid-cols-2 gap-6 sm:gap-8 lg:gap-12 items-start">
              {/* Left Side - Form */}
              <div className="bg-white rounded-2xl shadow-lg border border-gray-100 p-4 sm:p-6 lg:p-8 order-1">
                <h2 className="text-xl sm:text-2xl lg:text-3xl font-bold text-gray-900 mb-2 text-center lg:text-left">
                  Send Us a <span className="text-brand-orange">Message</span>
                </h2>
                <p className="text-gray-600 text-sm sm:text-base mb-6 sm:mb-8 text-center lg:text-left">
                  Fill in the form below and our team will get back to you within 1-2 business days.
                </p>

                <form onSubmit={handleSubmit} className="space-y-4 sm:space-y-6">
                  {/* Name Field */}
                  <div>
                    <Label htmlFor="name" className="text-gray-700 font-medium text-sm sm:text-base">
                      Your Name <span className="text-red-500">*</span>
                    </Label>
                    <Input
                      id="name"
                      name="name"
                      type="text"
                      placeholder="Enter Your Name"
                      value={formData.name}
                      onChange={handleInputChange}
                      required
                      className="mt-1"
                    />
                  </div>

                  {/* Email and Phone Row */}
                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                    <div>
                      <Label htmlFor="email" className="text-gray-700 font-medium text-sm sm:text-base">
                        Email <span className="text-red-500">*</span>
                      </Label>
                      <Input
                        id="email"
                        name="email"
                        type="email"
                        placeholder="Email"
                        value={formData.email}
                        onChange={handleInputChange}
                        required
                        className="mt-1"
                      />
                    </div>
                    <div>
                      <Label htmlFor="phone" className="text-gray-700 font-medium text-sm sm:text-base">
                        Phone Number (optional)
                      </Label>
                      <Input
                        id="phone"
                        name="phone"
                        type="tel"
                        placeholder="Telephone"
                        value={formData.phone}
                        onChange={handleInputChange}
                        pattern="[\d\s\-+]*"
                        className="mt-1"
                      />
                    </div>
                  </div>

                  {/* File Upload */}
                  <div>
                    <Label htmlFor="file-upload" className="text-gray-700 font-medium text-sm sm:text-base">
                      Attach a File (Optional)
                    </Label>
                    <p className="text-gray-500 text-xs sm:text-sm mb-2">
                      Documents, photos, or files (Max 20MB)
                    </p>

                    {!file ? (
                      <div className="mt-1">
                        <label htmlFor="file-upload" className="cursor-pointer">
                          <div
                            className={`border-2 border-dashed rounded-lg p-6 text-center transition-colors ${
                              isDragging
                                ? 'border-primary bg-primary/5'
                                : 'border-gray-300 hover:border-primary'
                            }`}
                            onDragOver={handleDragOver}
                            onDragLeave={handleDragLeave}
                            onDrop={handleDrop}
                          >
                            <Upload className="mx-auto h-8 w-8 text-gray-400" />
                            <p className="mt-2 text-sm text-gray-600">
                              Click to upload or drag and drop
                            </p>
                            <p className="text-xs text-gray-500">
                              PDF, DOC, JPG, PNG up to 20MB
                            </p>
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
                      <div className="mt-1 p-3 bg-gray-50 rounded-lg border flex items-center justify-between">
                        <div className="flex items-center space-x-3">
                          <div className="text-primary">
                            <Upload className="h-5 w-5" />
                          </div>
                          <div>
                            <p className="text-sm font-medium text-gray-900">{file.name}</p>
                            <p className="text-xs text-gray-500">
                              {(file.size / 1024 / 1024).toFixed(2)} MB
                            </p>
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

                  {/* Message Field */}
                  <div>
                    <Label htmlFor="message" className="text-gray-700 font-medium">
                      Your Message
                    </Label>
                    <Textarea
                      id="message"
                      name="message"
                      placeholder="How Can We Help You?"
                      value={formData.message}
                      onChange={handleInputChange}
                      rows={4}
                      className="mt-1"
                    />
                  </div>

                  {/* Submit Button */}
                  <div className="flex justify-end">
                    <Button
                      type="submit"
                      disabled={isSubmitting}
                      className="bg-brand-orange hover:bg-brand-orange/90 text-white px-8 py-3 text-lg disabled:opacity-50 flex items-center gap-2"
                    >
                      {isSubmitting ? 'Submitting...' : (
                        <>
                          Submit
                          <ArrowRight className="w-5 h-5" strokeWidth={3} />
                        </>
                      )}
                    </Button>
                  </div>
                </form>
              </div>

              {/* Right Side - Callback Card */}
              <div className="order-2 space-y-6">
                <div className="bg-brand-orange/5 border-2 border-brand-orange/20 rounded-2xl p-5 sm:p-6 lg:p-8">
                  <div className="flex items-start gap-4">
                    <div className="w-12 h-12 rounded-full bg-brand-orange/10 flex items-center justify-center flex-shrink-0">
                      <Phone className="w-6 h-6 text-brand-orange" />
                    </div>
                    <div className="flex-1 space-y-2">
                      <h3 className="text-lg sm:text-xl font-bold text-foreground">Want us to call you?</h3>
                      <p className="text-sm text-muted-foreground">Leave your number and we'll call you right back — no waiting on hold.</p>
                      <button
                        onClick={() => setShowCallbackModal(true)}
                        className="mt-2 inline-flex items-center gap-2 bg-brand-orange hover:bg-brand-orange/90 text-white font-bold px-6 py-3 rounded-xl shadow-lg shadow-brand-orange/25 hover:shadow-xl hover:-translate-y-0.5 transition-all duration-200 text-sm"
                      >
                        <Phone className="w-4 h-4" />
                        Request a callback
                      </button>
                    </div>
                  </div>
                </div>

                <div className="bg-gray-50 border border-gray-200 rounded-2xl p-5 sm:p-6 lg:p-8">
                  <h3 className="text-lg sm:text-xl font-bold text-gray-900 mb-4">Prefer to talk now?</h3>
                  <div className="space-y-3">
                    <a href={SALES_PHONE_TEL} className="flex items-center gap-3 text-gray-700 hover:text-brand-orange transition-colors">
                      <Phone className="w-5 h-5 text-brand-orange flex-shrink-0" />
                      <span className="text-sm sm:text-base"><span className="font-medium">Sales &amp; support:</span> <span className="font-bold">{SALES_PHONE}</span></span>
                    </a>
                    <a href={CLAIMS_PHONE_TEL} className="flex items-center gap-3 text-gray-700 hover:text-brand-orange transition-colors">
                      <Phone className="w-5 h-5 text-brand-orange flex-shrink-0" />
                      <span className="text-sm sm:text-base"><span className="font-medium">Claims &amp; repairs:</span> <span className="font-bold">{CLAIMS_PHONE}</span></span>
                    </a>
                    <p className="text-gray-500 text-xs sm:text-sm pt-1">Monday – Saturday, 9am to 5pm</p>
                  </div>
                </div>
              </div>
            </div>
          </div>
        </section>

        {/* Features Row */}
        <section className="bg-gray-50 py-10 sm:py-14 lg:py-16 px-4">
          <div className="max-w-7xl mx-auto">
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-6 sm:gap-8">
              {features.map((feature) => (
                <div key={feature.title} className="bg-white rounded-2xl border border-gray-100 shadow-sm p-6 text-center">
                  <div className="flex justify-center mb-4">
                    <div className="w-14 h-14 rounded-full bg-brand-orange/10 flex items-center justify-center">
                      {feature.icon}
                    </div>
                  </div>
                  <h3 className="text-base sm:text-lg font-bold text-gray-900 mb-2">{feature.title}</h3>
                  <p className="text-gray-600 text-sm leading-relaxed">{feature.text}</p>
                </div>
              ))}
            </div>
          </div>
        </section>

        {/* CTA Band */}
        <section className="bg-[#11253E] py-12 sm:py-16 px-4">
          <div className="max-w-4xl mx-auto text-center">
            <h2 className="text-2xl sm:text-3xl lg:text-4xl font-extrabold text-white mb-4">
              Ready to Protect Your Vehicle?
            </h2>
            <p className="text-white/80 text-base sm:text-lg mb-8">
              Get a quote in under 60 seconds — or call our team and we'll find the right cover for you.
            </p>
            <div className="flex flex-col sm:flex-row items-center justify-center gap-4">
              <Button
                onClick={navigateToQuoteForm}
                className="bg-brand-orange hover:bg-brand-orange/90 text-white font-bold px-8 py-3 text-lg rounded-xl shadow-lg shadow-brand-orange/25"
              >
                Get my quote
                <ArrowRight className="w-5 h-5 ml-2" strokeWidth={3} />
              </Button>
              <a
                href={SALES_PHONE_TEL}
                className="inline-flex items-center gap-2 text-white font-bold text-lg sm:text-xl hover:text-white/80 transition-colors"
              >
                <Phone className="w-5 h-5" />
                {SALES_PHONE}
              </a>
            </div>
          </div>
        </section>
      </div>

      <RequestCallbackModal
        isOpen={showCallbackModal}
        onClose={() => setShowCallbackModal(false)}
      />
    </>
  );
};

export default ContactUs;
