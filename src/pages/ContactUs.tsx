import React, { useState } from 'react';
import { MessageCircle, Mail, Clock, Upload, Menu, X, ArrowRight } from 'lucide-react';
import { Link, useNavigate } from 'react-router-dom';
import { SEOHead } from '@/components/SEOHead';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Textarea } from '@/components/ui/textarea';
import { Label } from '@/components/ui/label';
import { Sheet, SheetContent, SheetTrigger } from '@/components/ui/sheet';
import { useToast } from '@/hooks/use-toast';
import { supabase } from '@/integrations/supabase/client';
import { OptimizedImage } from '@/components/OptimizedImage';
import trustpilotLogo from '@/assets/trustpilot-logo.webp';

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
  const [isMobileMenuOpen, setIsMobileMenuOpen] = useState(false);
  const [isDragging, setIsDragging] = useState(false);

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

  return (
    <>
      <SEOHead
        title="Contact Us - Buy a Warranty"
        description="Get in touch with our customer service team via email, WhatsApp, or phone. We're here to help with all your warranty needs."
        keywords="contact us, customer service, warranty support, help, contact"
      />

      <div className="min-h-screen bg-white">
        {/* Top Section - Get In Touch With Us */}
        <section className="bg-white py-8 sm:py-12 lg:py-16 px-4">
          <div className="max-w-7xl mx-auto">
            <div className="grid grid-cols-1 lg:grid-cols-2 gap-6 sm:gap-8 lg:gap-12 items-center">
              {/* Panda Image */}
              <div className="flex flex-col items-center lg:items-start order-2 lg:order-1 space-y-4">
                <img 
                  src="/car-warranty-uk-suv-warranty-uk.png" 
                  alt="Car warranty UK SUV warranty - Panda mascot with cars vans motorcycles and savings jar showing affordable protection" 
                  className="w-full max-w-md sm:max-w-lg lg:max-w-2xl h-auto"
                />
                
                {/* Trustpilot Section */}
                <a 
                  href="https://uk.trustpilot.com/review/buyawarranty.co.uk"
                  target="_blank"
                  rel="noopener noreferrer"
                  className="inline-block hover:opacity-80 transition-opacity"
                >
                  <OptimizedImage 
                    src={trustpilotLogo} 
                    alt="Trustpilot Excellent Rating - 5 Stars"
                    className="h-12 w-auto object-contain"
                    priority={false}
                    width={160}
                    height={50}
                  />
                </a>
              </div>
              
              {/* Contact Information */}
              <div className="space-y-6 sm:space-y-8 order-1 lg:order-2">
                <h1 className="text-2xl sm:text-3xl lg:text-4xl font-bold text-gray-900 mb-4 sm:mb-6 lg:mb-8 text-center lg:text-left">
                  Get In Touch With Us
                </h1>
                
                {/* Customer Sales and Support Section */}
                <div className="space-y-3 sm:space-y-4">
                  <div className="flex items-center gap-3">
                    <div className="bg-primary text-white rounded-full p-2">
                      <Mail size={20} className="sm:w-6 sm:h-6" />
                    </div>
                    <h2 className="text-lg sm:text-xl font-semibold text-gray-900">Customer Sales and Support</h2>
                  </div>
                  <div className="ml-11 sm:ml-14 space-y-2">
                    <div className="text-sm sm:text-base">
                      <span className="font-medium text-gray-700">Email:</span>
                      <span className="font-bold text-brand-orange"> support@buyawarranty.co.uk</span>
                    </div>
                    <div className="text-sm sm:text-base">
                      <span className="font-medium text-gray-700">Phone:</span>
                      <span className="font-bold text-brand-orange"> 0330 229 5040</span>
                    </div>
                  </div>
                </div>
                
                {/* Claims and Repairs Section */}
                <div className="space-y-3 sm:space-y-4">
                  <div className="flex items-center gap-3">
                    <div className="bg-primary text-white rounded-full p-2">
                      <Mail size={20} className="sm:w-6 sm:h-6" />
                    </div>
                    <h2 className="text-lg sm:text-xl font-semibold text-gray-900">Claims and Repairs</h2>
                  </div>
                  <div className="ml-11 sm:ml-14 space-y-2">
                    <div className="text-sm sm:text-base">
                      <span className="font-medium text-gray-700">Email:</span>
                      <span className="font-bold text-brand-orange"> claims@buyawarranty.co.uk</span>
                    </div>
                    <div className="text-sm sm:text-base">
                      <span className="font-medium text-gray-700">Phone:</span>
                      <span className="font-bold text-brand-orange"> 0330 229 5045</span>
                    </div>
                  </div>
                </div>
                
                {/* WhatsApp Section */}
                <div className="space-y-3 sm:space-y-4">
                  <div className="flex items-center gap-3">
                    <div className="bg-primary text-white rounded-full p-2">
                      <MessageCircle size={20} className="sm:w-6 sm:h-6" />
                    </div>
                    <h2 className="text-lg sm:text-xl font-semibold text-gray-900">Chat With Us On WhatsApp:</h2>
                  </div>
                  <div className="ml-11 sm:ml-14 space-y-3">
                    <p className="text-gray-600 text-sm sm:text-base">Quick question? Send us a message on WhatsApp and we'll be right with you.</p>
                    <a href="https://wa.me/message/SPQPJ6O3UBF5B1" target="_blank" rel="noopener noreferrer">
                      <button className="bg-green-500 hover:bg-green-600 text-white px-4 sm:px-6 py-2 rounded-lg font-medium transition-colors text-sm sm:text-base">
                        WhatsApp Us ✓
                      </button>
                    </a>
                  </div>
                </div>
                
                {/* Opening Hours Section */}
                <div className="space-y-3 sm:space-y-4">
                  <div className="flex items-center gap-3">
                    <div className="bg-primary text-white rounded-full p-2">
                      <Clock size={20} className="sm:w-6 sm:h-6" />
                    </div>
                    <h2 className="text-lg sm:text-xl font-semibold text-gray-900">Opening Hours:</h2>
                  </div>
                  <div className="ml-11 sm:ml-14">
                    <p className="text-gray-600 text-sm sm:text-base">Monday – Saturday : 9am to 5pm</p>
                  </div>
                </div>
              </div>
            </div>
          </div>
        </section>
        
        {/* Contact Form Section */}
        <section className="py-8 sm:py-12 lg:py-16 px-4 bg-gray-100">
          <div className="max-w-7xl mx-auto">
            <div className="grid grid-cols-1 lg:grid-cols-2 gap-6 sm:gap-8 lg:gap-12 items-center">
              {/* Left Side - Image and Text */}
              <div className="space-y-4 sm:space-y-6 order-2 lg:order-1">
                <div className="text-center lg:text-left">
                  <p className="text-primary text-base sm:text-lg font-bold mb-2">Contact Us</p>
                  <h2 className="text-2xl sm:text-3xl lg:text-4xl font-bold text-gray-900 mb-4">
                    Get in Touch With Our <span className="text-primary">Support</span> Team!
                  </h2>
                </div>
                
                <div className="flex justify-center mt-12">
                  <img 
                    src="/car-warranty-uk-petrol-car-warranty.png" 
                    alt="Car warranty UK petrol car warranty - Volkswagen Golf GTI with buyawarranty branding showing professional coverage" 
                    className="w-full max-w-[320px] sm:max-w-[384px] lg:max-w-[448px] h-auto"
                  />
                </div>
              </div>
              
              {/* Right Side - Form */}
              <div className="bg-white rounded-lg shadow-lg p-4 sm:p-6 lg:p-8 order-1 lg:order-2">
                <h3 className="text-xl sm:text-2xl font-bold text-gray-900 mb-6 sm:mb-8 text-center lg:text-left">
                  How Can We Help You Today?
                </h3>
                
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
                      className="bg-primary hover:bg-primary/90 text-white px-8 py-3 text-lg disabled:opacity-50 flex items-center gap-2"
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
            </div>
          </div>
        </section>
        
        {/* Google Maps Location Section */}
        <section className="py-8 sm:py-12 lg:py-16 px-4 bg-white" itemScope itemType="https://schema.org/LocalBusiness">
          <div className="max-w-7xl mx-auto">
            <div className="text-center mb-8">
              <h2 className="text-2xl sm:text-3xl lg:text-4xl font-bold text-gray-900 mb-4" itemProp="name">
                Visit Our <span className="text-primary">Location</span>
              </h2>
              <p className="text-gray-600 text-base sm:text-lg max-w-2xl mx-auto">
                Find us on Google Maps. We're here to help with all your warranty needs.
              </p>
            </div>
            
            <div className="flex justify-center">
              <div className="w-full max-w-5xl rounded-lg overflow-hidden shadow-lg" itemProp="hasMap" itemScope itemType="https://schema.org/Map">
                <iframe 
                  src="https://www.google.com/maps/embed?pb=!1m18!1m12!1m3!1d21980869.000782322!2d12.5088275!3d47.73855!2m3!1f0!2f0!3f0!3m2!1i1024!2i768!4f13.1!3m3!1m2!1s0xf2bbc5bf1c415d3%3A0xbb186fb472c7fd48!2sBuyawarranty.co.uk!5e0!3m2!1sen!2s!4v1763390747051!5m2!1sen!2s" 
                  width="100%" 
                  height="450" 
                  style={{ border: 0 }}
                  allowFullScreen
                  loading="lazy" 
                  referrerPolicy="no-referrer-when-downgrade"
                  title="Buyawarranty.co.uk Location on Google Maps"
                  aria-label="Google Maps showing Buyawarranty.co.uk business location"
                  itemProp="url"
                />
              </div>
            </div>
            
            {/* Hidden structured data for SEO */}
            <div style={{ display: 'none' }}>
              <span itemProp="address" itemScope itemType="https://schema.org/PostalAddress">
                <meta itemProp="addressCountry" content="GB" />
              </span>
              <meta itemProp="telephone" content="0330 229 5040" />
              <meta itemProp="email" content="info@buyawarranty.co.uk" />
              <link itemProp="url" href="https://buyawarranty.co.uk" />
            </div>
          </div>
        </section>
      </div>
    </>
  );
};

export default ContactUs;