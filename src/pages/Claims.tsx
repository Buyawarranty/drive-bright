import React, { useState } from 'react';
import { Menu, Upload, X, Mail, Phone, Search, Loader2 } from 'lucide-react';
import { Link, useNavigate } from 'react-router-dom';
import { SEOHead } from '@/components/SEOHead';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { Sheet, SheetContent, SheetTrigger } from '@/components/ui/sheet';
import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover';
import { ChevronDown } from 'lucide-react';
import { useToast } from '@/hooks/use-toast';
import { supabase } from '@/integrations/supabase/client';
import pandaMechanicFix from '@/assets/panda-mechanic-fix.png';


const Claims = () => {
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
    vehicleReg: '',
    faultDescription: '',
    dateOccurred: '',
    faultDetails: '',
    issueTiming: '',
    currentMileage: 50000,
    additionalInfo: ''
  });
  const [uploadedFile, setUploadedFile] = useState<File | null>(null);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [isMobileMenuOpen, setIsMobileMenuOpen] = useState(false);
  const [errors, setErrors] = useState<{[key: string]: string}>({});
  const [isDragging, setIsDragging] = useState(false);
  const [isLookingUpVehicle, setIsLookingUpVehicle] = useState(false);
  const [vehicleDetails, setVehicleDetails] = useState<{make?: string; model?: string; year?: string} | null>(null);

  // Validation functions
  const validateEmail = (email: string): boolean => {
    const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
    return emailRegex.test(email);
  };

  const validatePhone = (phone: string): boolean => {
    // UK phone number validation - accepts various formats
    const phoneRegex = /^(\+44\s?|0)(\d{2}\s?\d{4}\s?\d{4}|\d{3}\s?\d{3}\s?\d{4}|\d{4}\s?\d{6}|\d{5}\s?\d{5})$/;
    const cleanPhone = phone.replace(/\s/g, '');
    return phoneRegex.test(cleanPhone) && cleanPhone.length >= 10;
  };

  const handleInputChange = (e: React.ChangeEvent<HTMLInputElement | HTMLTextAreaElement>) => {
    const { name, value } = e.target;

    setFormData({
      ...formData,
      [name]: value
    });

    // Clear the error for this field as soon as the user edits it
    if (errors[name]) {
      setErrors((prev) => ({
        ...prev,
        [name]: ''
      }));
    }
  };

  const handleFileUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file) {
      setUploadedFile(file);
    }
  };

  const removeFile = () => {
    setUploadedFile(null);
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
      const file = files[0];
      
      // Validate file size (20MB max)
      if (file.size > 20 * 1024 * 1024) {
        toast({
          title: "File too large",
          description: "Please upload a file smaller than 20MB.",
          variant: "destructive",
        });
        return;
      }

      // Validate file type
      const allowedTypes = ['application/pdf', 'application/msword', 'application/vnd.openxmlformats-officedocument.wordprocessingml.document', 'image/jpeg', 'image/png', 'image/jpg'];
      if (!allowedTypes.includes(file.type)) {
        toast({
          title: "Invalid file type",
          description: "Please upload a PDF, DOC, DOCX, JPG, or PNG file.",
          variant: "destructive",
        });
        return;
      }

      setUploadedFile(file);
    }
  };


  // DVLA vehicle lookup function
  const lookupVehicle = async (regPlate: string) => {
    const cleanReg = regPlate.replace(/\s/g, '').toUpperCase();
    if (cleanReg.length < 5) {
      setVehicleDetails(null);
      setErrors((prev) => ({ ...prev, vehicleReg: 'Please enter a valid UK registration plate.' }));
      return;
    }

    setIsLookingUpVehicle(true);
    setErrors((prev) => ({ ...prev, vehicleReg: '' }));
    try {
      const { data, error } = await supabase.functions.invoke('dvla-vehicle-lookup', {
        body: { registrationNumber: cleanReg }
      });

      if (error) {
        console.error('Vehicle lookup error:', error);
        setVehicleDetails(null);
        setErrors((prev) => ({ ...prev, vehicleReg: "We couldn't verify that registration. Please double-check it." }));
        return;
      }

      if (data?.found && (data?.make || data?.model)) {
        setVehicleDetails({
          make: data.make,
          model: data.model,
          year: data.yearOfManufacture || data.manufactureYear
        });
        setErrors((prev) => ({ ...prev, vehicleReg: '' }));
      } else {
        setVehicleDetails(null);
        setErrors((prev) => ({ ...prev, vehicleReg: 'No vehicle found for that registration. Please check and try again.' }));
      }
    } catch (err) {
      console.error('Vehicle lookup failed:', err);
      setVehicleDetails(null);
      setErrors((prev) => ({ ...prev, vehicleReg: "We couldn't verify that registration. Please try again." }));
    } finally {
      setIsLookingUpVehicle(false);
    }
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    
    // Validate all required fields together so every issue is shown at once
    const newErrors: {[key: string]: string} = {};

    if (!formData.name.trim()) {
      newErrors.name = 'Could you let us know your name?';
    }

    if (!formData.email.trim()) {
      newErrors.email = 'We just need an email so we can get back to you.';
    } else if (!validateEmail(formData.email)) {
      newErrors.email = 'That email doesn\'t look quite right — mind double-checking it?';
    }

    if (!formData.phone.trim()) {
      newErrors.phone = 'A contact number helps us reach you faster.';
    } else if (!validatePhone(formData.phone)) {
      newErrors.phone = 'Hmm, that number doesn\'t look like a UK number. Try 07123 456789.';
    }

    if (!formData.vehicleReg.trim()) {
      newErrors.vehicleReg = 'Please pop in your vehicle registration.';
    } else if (errors.vehicleReg) {
      newErrors.vehicleReg = errors.vehicleReg;
    } else if (!vehicleDetails || (!vehicleDetails.make && !vehicleDetails.model)) {
      newErrors.vehicleReg = 'Please enter a valid UK registration we can verify.';
    }

    if (Object.keys(newErrors).length > 0) {
      setErrors(newErrors);
      toast({
        title: "Just a few details missing",
        description: "We've highlighted the fields below — please take a quick look.",
        variant: "destructive",
      });
      // Scroll to the first error so it's visible on mobile
      setTimeout(() => {
        const firstErrorField = Object.keys(newErrors)[0];
        const el = document.getElementById(firstErrorField);
        if (el) {
          el.scrollIntoView({ behavior: 'smooth', block: 'center' });
        }
      }, 50);
      return;
    }


    setIsSubmitting(true);
    
    try {
      let fileData = null;
      
      if (uploadedFile) {
        const reader = new FileReader();
        const fileBase64 = await new Promise<string>((resolve) => {
          reader.onload = () => resolve(reader.result as string);
          reader.readAsDataURL(uploadedFile);
        });
        
        fileData = {
          name: uploadedFile.name,
          size: uploadedFile.size,
          type: uploadedFile.type,
          data: fileBase64
        };
      }

      const claimMessage = `
Claim Details:
Vehicle: ${formData.vehicleReg}
Current Mileage: ${formData.currentMileage}
Fault Description: ${formData.faultDescription}
Date Occurred: ${formData.dateOccurred}
Fault Details: ${formData.faultDetails}
Issue Timing: ${formData.issueTiming}
Additional Information: ${formData.additionalInfo}
      `.trim();

      const response = await supabase.functions.invoke('submit-claim', {
        body: {
          name: formData.name,
          email: formData.email,
          phone: formData.phone,
          vehicleReg: formData.vehicleReg,
          currentMileage: formData.currentMileage,
          faultDescription: formData.faultDescription,
          dateOccurred: formData.dateOccurred,
          faultDetails: formData.faultDetails,
          issueTiming: formData.issueTiming,
          additionalInfo: formData.additionalInfo,
          file: fileData
        }
      });

      if (response.error) {
        throw new Error(response.error.message || 'Failed to submit claim');
      }

      toast({
        title: "✓ Claim Submitted!",
        description: "We'll review and respond Monday–Friday, 9 AM–5 PM. You can also call our claims line during these hours on 0330 229 5045. Thank you!",
        className: "bg-green-600 text-white border-green-700 [&>div]:text-white",
      });

      // Reset form
      setFormData({
        name: '',
        email: '',
        phone: '',
        vehicleReg: '',
        faultDescription: '',
        dateOccurred: '',
        faultDetails: '',
        issueTiming: '',
        currentMileage: 50000,
        additionalInfo: ''
      });
      setUploadedFile(null);
      setErrors({});
      
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
        title="Get Car Warranty UK | Easy Online Instant Quote | BuyA Warranty"
        description="Get car warranty cover quickly and easily with BuyA Warranty UK. Simple online process, instant quotes and immediate protection for your vehicle."
        keywords="warranty claim, car warranty claim, vehicle warranty support, customer service"
      />

      <div className="min-h-screen bg-white">
        {/* Hero Section - UX Optimized with Orange Branding */}
        <section className="bg-white py-10 sm:py-14 lg:py-24 px-4 sm:px-6">
          <div className="max-w-4xl mx-auto text-center">
            <h1 className="text-3xl sm:text-4xl lg:text-5xl font-bold text-black mb-4 sm:mb-6 text-left">
              Making a Claim
            </h1>
            <p className="text-xl lg:text-2xl font-semibold text-orange-600 mb-8">
              Simple, Supportive and Stress Free
            </p>
            <div className="max-w-3xl mx-auto">
              <p className="text-lg lg:text-xl text-gray-600 mb-8 leading-relaxed">
                We know that vehicle issues can be stressful, but making a claim shouldn't be. At 
                <span className="font-semibold text-orange-600"> Buy-A-Warranty</span>, we've made the process clear, quick and customer focused.
              </p>
              <p className="text-green-600 font-medium">
                Get the help you need without the hassle
              </p>
            </div>
            
            {/* Why You're in Safe Hands */}
            <div className="mt-16 mb-12">
              <h2 className="text-2xl lg:text-3xl font-bold text-black mb-8 text-left">Why You're in Safe Hands</h2>
              <div className="grid grid-cols-1 md:grid-cols-3 gap-6 text-center">
                <div className="bg-orange-50 rounded-xl p-6 shadow-lg hover:shadow-xl transition-all duration-300 border border-orange-100 hover:border-orange-200">
                  <h3 className="text-xl font-bold text-gray-900 mb-3">Quick Response</h3>
                  <p className="text-sm text-gray-700">We respond to claims quickly and fairly, with no unnecessary delays</p>
                </div>
                <div className="bg-green-50 rounded-xl p-6 shadow-lg hover:shadow-xl transition-all duration-300 border border-green-100 hover:border-green-200">
                  <h3 className="text-xl font-bold text-gray-900 mb-3">UK-Based Team</h3>
                  <p className="text-sm text-gray-700">Our UK-based claims team is here to guide you every step of the way</p>
                </div>
                <div className="bg-blue-50 rounded-xl p-6 shadow-lg hover:shadow-xl transition-all duration-300 border border-blue-100 hover:border-blue-200">
                  <h3 className="text-xl font-bold text-gray-900 mb-3">Simple Process</h3>
                  <p className="text-sm text-gray-700">We keep things simple, with no confusing jargon or hidden terms</p>
                </div>
              </div>
            </div>

            {/* What You'll Need */}
            <div className="mb-12">
              <h2 className="text-2xl lg:text-3xl font-bold text-black mb-8 text-left">What You'll Need</h2>
              <div className="bg-white rounded-xl p-5 sm:p-8 shadow-lg border border-orange-100">
                <ul className="space-y-4 text-left text-gray-700">
                  <li className="flex items-start gap-3">
                    <span className="text-orange-500 font-bold mt-1">•</span>
                    <span className="font-medium">Your warranty registration number</span>
                  </li>
                  <li className="flex items-start gap-3">
                    <span className="text-orange-500 font-bold mt-1">•</span>
                    <span className="font-medium">Vehicle details including make, model and registration</span>
                  </li>
                  <li className="flex items-start gap-3">
                    <span className="text-orange-500 font-bold mt-1">•</span>
                    <span className="font-medium">A brief description of the issue</span>
                  </li>
                  <li className="flex items-start gap-3">
                    <span className="text-orange-500 font-bold mt-1">•</span>
                    <span className="font-medium">Any supporting documents or garage reports</span>
                  </li>
                </ul>
              </div>
            </div>

            {/* How to Start Your Claim */}
            <div className="mb-12">
              <h2 className="text-2xl lg:text-3xl font-bold text-black mb-8 text-left">How to Start Your Claim</h2>
              <p className="text-lg text-gray-700 mb-8 font-medium">Choose your preferred way to contact us:</p>
              <div className="grid grid-cols-1 md:grid-cols-2 gap-6 mb-8">
                <a 
                  href="mailto:claims@buyawarranty.co.uk"
                  className="group block p-5 sm:p-8 bg-white rounded-xl shadow-lg hover:shadow-xl transition-all duration-300 border-2 border-orange-100 hover:border-orange-300 hover:-translate-y-1"
                >
                  <div className="flex items-center gap-4 mb-4">
                    <div className="flex-shrink-0 w-14 h-14 bg-orange-100 rounded-full flex items-center justify-center group-hover:bg-orange-500 transition-colors duration-300">
                      <Mail className="w-7 h-7 text-orange-500 group-hover:text-white transition-colors duration-300" />
                    </div>
                    <div>
                      <h3 className="text-xl font-bold text-gray-900 group-hover:text-orange-500 transition-colors duration-300">Email Us</h3>
                      <p className="text-sm text-gray-500">Send us your claim details</p>
                    </div>
                  </div>
                  <p className="text-lg font-semibold text-orange-500 group-hover:text-orange-600 transition-colors duration-300">claims@buyawarranty.co.uk</p>
                  <p className="text-sm text-green-600 font-medium mt-3">We respond as quickly as possible during working hours.</p>
                </a>

                <a 
                  href="tel:03302295045"
                  className="group block p-5 sm:p-8 bg-white rounded-xl shadow-lg hover:shadow-xl transition-all duration-300 border-2 border-orange-100 hover:border-orange-300 hover:-translate-y-1"
                >
                  <div className="flex items-center gap-4 mb-4">
                    <div className="flex-shrink-0 w-14 h-14 bg-orange-100 rounded-full flex items-center justify-center group-hover:bg-orange-500 transition-colors duration-300">
                      <Phone className="w-7 h-7 text-orange-500 group-hover:text-white transition-colors duration-300" />
                    </div>
                    <div>
                      <h3 className="text-xl font-bold text-gray-900 group-hover:text-orange-500 transition-colors duration-300">Call Us</h3>
                      <p className="text-sm text-gray-500">Speak to our claims team</p>
                    </div>
                  </div>
                  <p className="text-lg font-semibold text-orange-500 group-hover:text-orange-600 transition-colors duration-300">0330 229 5045</p>
                  <p className="text-sm text-green-600 font-medium mt-3">Monday to Friday, 9am to 5pm</p>
                </a>
              </div>
            </div>

            {/* Make A Claim Form */}
            <div className="mb-12 mt-16" id="claim-form">
              <div className="mb-8">
                <h2 className="text-3xl lg:text-4xl font-bold text-black mb-3 text-left">
                  Make A Claim
                </h2>
                <p className="text-gray-600 text-lg max-w-2xl mx-auto">
                  Fill out the form below quick, easy and hassle-free
                </p>
              </div>

              <div className="grid grid-cols-1 lg:grid-cols-3 gap-8 items-start">
                {/* Form Section - Takes 2 columns */}
                <div className="lg:col-span-2">
                  <div className="bg-white p-4 sm:p-6 lg:p-8 rounded-xl shadow-lg">
                    <form onSubmit={handleSubmit} className="space-y-6 sm:space-y-8">
                      {/* Section 1: Contact Information */}
                      <div>
                        <div className="flex items-center gap-3 mb-4 pb-3 border-b-2 border-orange-100">
                          <div className="flex items-center justify-center w-8 h-8 rounded-full bg-orange-500 text-white font-bold text-sm">
                            1
                          </div>
                          <h3 className="text-xl font-bold text-gray-900">Your Contact Details</h3>
                        </div>
                        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                          <div>
                            <Label htmlFor="name" className="text-gray-700 font-medium text-sm">
                              Name *
                            </Label>
                            <Input
                              id="name"
                              name="name"
                              type="text"
                              placeholder="Your Name"
                              value={formData.name}
                              onChange={handleInputChange}
                              required
                              className={`mt-1.5 h-11 border-gray-300 focus:border-orange-500 focus:ring-orange-500 ${errors.name ? 'border-[#FF385C] focus:border-[#FF385C] focus:ring-[#FF385C]' : ''}`}
                            />
                            {errors.name && <p className="mt-1 text-sm text-[#FF385C]">{errors.name}</p>}
                          </div>

                          <div>
                            <Label htmlFor="email" className="text-gray-700 font-medium text-sm">
                              Email *
                            </Label>
                            <Input
                              id="email"
                              name="email"
                              type="email"
                              placeholder="Your Email Address"
                              value={formData.email}
                              onChange={handleInputChange}
                              required
                              className={`mt-1.5 h-11 border-gray-300 focus:border-orange-500 focus:ring-orange-500 ${errors.email ? 'border-[#FF385C] focus:border-[#FF385C] focus:ring-[#FF385C]' : ''}`}
                            />
                            {errors.email && <p className="mt-1 text-sm text-[#FF385C]">{errors.email}</p>}
                          </div>

                          <div>
                            <Label htmlFor="phone" className="text-gray-700 font-medium text-sm">
                              Phone Number *
                            </Label>
                            <Input
                              id="phone"
                              name="phone"
                              type="tel"
                              placeholder="07123456789"
                              value={formData.phone}
                              onChange={handleInputChange}
                              className={`mt-1.5 h-11 border-gray-300 focus:border-orange-500 focus:ring-orange-500 ${errors.phone ? 'border-[#FF385C] focus:border-[#FF385C] focus:ring-[#FF385C]' : ''}`}
                            />
                            {errors.phone && <p className="mt-1 text-sm text-[#FF385C]">{errors.phone}</p>}
                          </div>

                          <div>
                            <Label htmlFor="vehicleReg" className="text-gray-700 font-medium text-sm">
                              Vehicle Registration *
                            </Label>
                            <div className="relative">
                              <Input
                                id="vehicleReg"
                                name="vehicleReg"
                                type="text"
                                placeholder="AB12 CDE"
                                value={formData.vehicleReg}
                                onChange={(e) => {
                                  handleInputChange(e);
                                  // Clear vehicle details when reg changes
                                  setVehicleDetails(null);
                                }}
                                onBlur={(e) => {
                                  const value = e.target.value.trim();
                                  if (value.length >= 2) {
                                    lookupVehicle(value);
                                  }
                                }}
                                required
                                className={`mt-1.5 h-11 border-gray-300 focus:border-orange-500 focus:ring-orange-500 pr-10 ${errors.vehicleReg ? 'border-[#FF385C] focus:border-[#FF385C] focus:ring-[#FF385C]' : ''}`}
                              />
                              {isLookingUpVehicle && (
                                <div className="absolute right-3 top-1/2 -translate-y-1/2 mt-0.5">
                                  <Loader2 className="w-4 h-4 animate-spin text-orange-500" />
                                </div>
                              )}
                            </div>
                            {errors.vehicleReg && <p className="mt-1 text-sm text-[#FF385C]">{errors.vehicleReg}</p>}
                            {vehicleDetails && (vehicleDetails.make || vehicleDetails.model) && (
                              <div className="mt-2 p-2 bg-green-50 border border-green-200 rounded-md">
                                <p className="text-sm text-green-700 font-medium">
                                  ✓ {vehicleDetails.make} {vehicleDetails.model} {vehicleDetails.year ? `(${vehicleDetails.year})` : ''}
                                </p>
                              </div>
                            )}
                          </div>
                        </div>
                      </div>

                      {/* Section 2: Mileage */}
                      <div>
                        <div className="flex items-center gap-3 mb-4 pb-3 border-b-2 border-orange-100">
                          <div className="flex items-center justify-center w-8 h-8 rounded-full bg-orange-500 text-white font-bold text-sm">
                            2
                          </div>
                          <h3 className="text-xl font-bold text-gray-900">Current Mileage</h3>
                        </div>
                        <div>
                          <Label htmlFor="currentMileage" className="text-gray-700 font-medium text-sm mb-2 block">
                            Enter current approximate mileage
                          </Label>
                          <div className="flex gap-2 mt-1.5">
                            <Input
                              id="currentMileage"
                              name="currentMileage"
                              type="text"
                              inputMode="numeric"
                              placeholder="e.g. 45,000"
                              value={formData.currentMileage ? formData.currentMileage.toLocaleString('en-GB') : ''}
                              onChange={(e) => {
                                const digits = e.target.value.replace(/[^0-9]/g, '');
                                const value = digits ? parseInt(digits, 10) : 0;
                                setFormData({ ...formData, currentMileage: Math.min(Math.max(value, 0), 200000) });
                              }}
                              className="h-11 border-gray-300 focus:border-orange-500 focus:ring-orange-500 flex-1"
                            />
                            <Popover>
                              <PopoverTrigger asChild>
                                <Button
                                  type="button"
                                  variant="outline"
                                  className="h-11 px-3 border-gray-300"
                                  aria-label="Pick mileage"
                                >
                                  <ChevronDown className="h-4 w-4" />
                                </Button>
                              </PopoverTrigger>
                              <PopoverContent className="w-48 p-0 max-h-72 overflow-y-auto" align="end">
                                <div className="py-1">
                                  {Array.from({ length: 200 }, (_, i) => (i + 1) * 1000).map((m) => (
                                    <button
                                      key={m}
                                      type="button"
                                      onClick={() => setFormData({ ...formData, currentMileage: m })}
                                      className="w-full text-left px-3 py-2 text-sm hover:bg-orange-50 hover:text-orange-700 transition-colors"
                                    >
                                      {m.toLocaleString('en-GB')}
                                    </button>
                                  ))}
                                </div>
                              </PopoverContent>
                            </Popover>
                          </div>
                          <p className="mt-1.5 text-xs text-gray-500">
                            Type your own mileage or pick a value from the list (1,000-mile increments).
                          </p>
                        </div>
                      </div>

                      {/* Section 3: What Happened */}
                      <div>
                        <div className="flex items-center gap-3 mb-4 pb-3 border-b-2 border-orange-100">
                          <div className="flex items-center justify-center w-8 h-8 rounded-full bg-orange-500 text-white font-bold text-sm">
                            3
                          </div>
                          <h3 className="text-xl font-bold text-gray-900">What Happened</h3>
                        </div>
                        <div className="space-y-4">
                          <div>
                            <Label htmlFor="faultDescription" className="text-gray-700 font-medium text-sm">
                              Describe the fault / problem *
                            </Label>
                            <Textarea
                              id="faultDescription"
                              name="faultDescription"
                              placeholder="Please explain what's wrong with the vehicle (e.g. strange noise from engine, gearbox slipping, warning lights on dashboard...)"
                              value={formData.faultDescription}
                              onChange={handleInputChange}
                              rows={4}
                              className={`mt-1.5 border-gray-300 focus:border-orange-500 focus:ring-orange-500 ${errors.faultDescription ? 'border-[#FF385C] focus:border-[#FF385C] focus:ring-[#FF385C]' : ''}`}
                            />
                            {errors.faultDescription && <p className="mt-1 text-sm text-[#FF385C]">{errors.faultDescription}</p>}
                          </div>

                          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                            <div>
                              <Label htmlFor="dateOccurred" className="text-gray-700 font-medium text-sm">
                                When did the fault occur?
                              </Label>
                              <Input
                                id="dateOccurred"
                                name="dateOccurred"
                                type="date"
                                value={formData.dateOccurred}
                                onChange={handleInputChange}
                                max={new Date().toISOString().split('T')[0]}
                                className="mt-1.5 h-11 border-gray-300 focus:border-orange-500 focus:ring-orange-500"
                              />
                            </div>
                            <div>
                              <Label htmlFor="issueTiming" className="text-gray-700 font-medium text-sm">
                                When does the issue happen?
                              </Label>
                              <Input
                                id="issueTiming"
                                name="issueTiming"
                                type="text"
                                placeholder="e.g. on start-up, when braking, all the time"
                                value={formData.issueTiming}
                                onChange={handleInputChange}
                                className="mt-1.5 h-11 border-gray-300 focus:border-orange-500 focus:ring-orange-500"
                              />
                            </div>
                          </div>

                          <div>
                            <Label htmlFor="faultDetails" className="text-gray-700 font-medium text-sm">
                              Any other relevant details
                            </Label>
                            <Textarea
                              id="faultDetails"
                              name="faultDetails"
                              placeholder="Garage diagnosis, recent repairs, anything else we should know..."
                              value={formData.faultDetails}
                              onChange={handleInputChange}
                              rows={3}
                              className="mt-1.5 border-gray-300 focus:border-orange-500 focus:ring-orange-500"
                            />
                          </div>

                          <div>
                            <Label htmlFor="additionalInfo" className="text-gray-700 font-medium text-sm">
                              Additional information
                            </Label>
                            <Textarea
                              id="additionalInfo"
                              name="additionalInfo"
                              placeholder="Anything else you'd like to add"
                              value={formData.additionalInfo}
                              onChange={handleInputChange}
                              rows={2}
                              className="mt-1.5 border-gray-300 focus:border-orange-500 focus:ring-orange-500"
                            />
                          </div>
                        </div>
                      </div>

                      {/* Section 4: Supporting Documents */}
                      <div>
                        <div className="flex items-center gap-3 mb-4 pb-3 border-b-2 border-orange-100">
                          <div className="flex items-center justify-center w-8 h-8 rounded-full bg-orange-500 text-white font-bold text-sm">
                            4
                          </div>
                          <h3 className="text-xl font-bold text-gray-900">Supporting Documents (Optional)</h3>
                        </div>

                        {!uploadedFile ? (
                          <div
                            onDragOver={handleDragOver}
                            onDragLeave={handleDragLeave}
                            onDrop={handleDrop}
                            onClick={() => document.getElementById('file-upload')?.click()}
                            className={`relative cursor-pointer rounded-lg border-2 border-dashed p-6 text-center transition-colors ${
                              isDragging
                                ? 'border-orange-500 bg-orange-50'
                                : 'border-gray-300 hover:border-orange-400 hover:bg-orange-50/50'
                            }`}
                          >
                            <Upload className="mx-auto h-10 w-10 text-orange-500 mb-2" />
                            <p className="text-sm font-medium text-gray-700">
                              Click to upload or drag and drop
                            </p>
                            <p className="text-xs text-gray-500 mt-1">
                              PDF, DOC, DOCX, JPG or PNG (max 20MB)
                            </p>
                            <input
                              id="file-upload"
                              type="file"
                              className="hidden"
                              accept=".pdf,.doc,.docx,.jpg,.jpeg,.png,application/pdf,application/msword,application/vnd.openxmlformats-officedocument.wordprocessingml.document,image/jpeg,image/png"
                              onChange={handleFileUpload}
                            />
                          </div>
                        ) : (
                          <div className="flex items-center justify-between rounded-lg border border-green-200 bg-green-50 p-4">
                            <div className="flex items-center gap-3 min-w-0">
                              <div className="flex-shrink-0 h-10 w-10 rounded-full bg-green-100 flex items-center justify-center">
                                <Upload className="h-5 w-5 text-green-600" />
                              </div>
                              <div className="min-w-0">
                                <p className="text-sm font-medium text-gray-900 truncate">{uploadedFile.name}</p>
                                <p className="text-xs text-gray-500">
                                  {(uploadedFile.size / 1024 / 1024).toFixed(2)} MB
                                </p>
                              </div>
                            </div>
                            <button
                              type="button"
                              onClick={removeFile}
                              className="ml-3 flex-shrink-0 rounded-full p-1 text-gray-400 hover:bg-gray-200 hover:text-gray-600 transition-colors"
                              aria-label="Remove file"
                            >
                              <X className="h-5 w-5" />
                            </button>
                          </div>
                        )}
                      </div>

                      <Button 
                        type="submit" 
                        disabled={isSubmitting}
                        className="bg-orange-500 hover:bg-orange-600 text-white px-8 py-3 w-full text-base font-semibold rounded-lg disabled:opacity-50 transition-colors"
                      >
                        {isSubmitting ? 'Submitting...' : 'Submit Claim'}
                      </Button>
                    </form>
                  </div>
                </div>
                
                {/* Right Side - Illustration and Info - Takes 1 column */}
                <div className="space-y-6">
                  <div className="flex justify-center lg:justify-start">
                    <img 
                      src={pandaMechanicFix} 
                      alt="Panda mechanic with tools fixing a car" 
                      className="w-full max-w-48 h-auto"
                    />
                  </div>
                  
                  {/* Quick Info Cards */}
                  <div className="space-y-3">
                    <div className="bg-orange-50 border border-orange-200 rounded-lg p-4">
                      <h4 className="font-semibold text-gray-900 text-sm mb-1">Fast Response</h4>
                      <p className="text-xs text-gray-600">We typically respond within 2 hours</p>
                    </div>
                    
                    <div className="bg-green-50 border border-green-200 rounded-lg p-4">
                      <h4 className="font-semibold text-gray-900 text-sm mb-1">UK-Based Team</h4>
                      <p className="text-xs text-gray-600">Our experts are here to help you</p>
                    </div>
                    
                    <div className="bg-blue-50 border border-blue-200 rounded-lg p-4">
                      <h4 className="font-semibold text-gray-900 text-sm mb-1">Simple Process</h4>
                      <p className="text-xs text-gray-600">We keep things clear and straightforward</p>
                    </div>
                  </div>
                </div>
              </div>
            </div>
          </div>
        </section>

        {/* Repair Process */}
        <section className="py-16 lg:py-24 px-4 bg-white">
          <div className="max-w-4xl mx-auto">
            <h2 className="text-3xl lg:text-4xl font-bold text-gray-900 text-center mb-6">
              Repair Process
            </h2>
            <p className="text-gray-600 text-lg text-center mb-12 max-w-3xl mx-auto">
              If something goes wrong, we're here to help - quickly and efficiently. Just follow these simple steps to ensure your claim is processed smoothly:
            </p>
            
            <div className="space-y-6">
              {/* Step 1 */}
              <div className="flex items-start gap-6 p-6 bg-gray-50 rounded-xl">
                <div className="bg-orange-500 text-white rounded-full w-10 h-10 flex items-center justify-center font-bold text-lg flex-shrink-0">
                  1
                </div>
                <p className="text-gray-700 text-lg leading-relaxed">
                  Report the fault to us at <span className="font-semibold text-orange-500">0330 229 5045</span> (Mon-Fri 9am to 6pm) or complete the form on this page
                </p>
              </div>
              
              {/* Step 2 */}
              <div className="flex items-start gap-6 p-6 bg-gray-50 rounded-xl">
                <div className="bg-orange-500 text-white rounded-full w-10 h-10 flex items-center justify-center font-bold text-lg flex-shrink-0">
                  2
                </div>
                <p className="text-gray-700 text-lg leading-relaxed">
                  Choose your own VAT-registered garage or use an approved repairer
                </p>
              </div>
              
              {/* Step 3 */}
              <div className="flex items-start gap-6 p-6 bg-gray-50 rounded-xl">
                <div className="bg-orange-500 text-white rounded-full w-10 h-10 flex items-center justify-center font-bold text-lg flex-shrink-0">
                  3
                </div>
                <p className="text-gray-700 text-lg leading-relaxed">
                  Wait for written approval before any repairs begin
                </p>
              </div>
              
              {/* Step 4 */}
              <div className="flex items-start gap-6 p-6 bg-gray-50 rounded-xl">
                <div className="bg-orange-500 text-white rounded-full w-10 h-10 flex items-center justify-center font-bold text-lg flex-shrink-0">
                  4
                </div>
                <p className="text-gray-700 text-lg leading-relaxed">
                  Proceed with the repair (once approved)
                </p>
              </div>
              
              {/* Step 5 */}
              <div className="flex items-start gap-6 p-6 bg-gray-50 rounded-xl">
                <div className="bg-orange-500 text-white rounded-full w-10 h-10 flex items-center justify-center font-bold text-lg flex-shrink-0">
                  5
                </div>
                <p className="text-gray-700 text-lg leading-relaxed">
                  Submit the final invoice and proof of repair
                </p>
              </div>
            </div>
            
          </div>
        </section>

        {/* Your Repair Limit Explained */}
        <section className="py-16 lg:py-24 px-4 bg-white">
          <div className="max-w-4xl mx-auto text-center">
            <h2 className="text-3xl lg:text-4xl font-bold text-gray-900 mb-8">
              Your Repair Limit Explained
            </h2>
            <div className="space-y-6 text-lg text-gray-600 max-w-3xl mx-auto">
              <p className="leading-relaxed">
                At Buyawarranty.co.uk, your maximum repair limit is clearly outlined in your warranty email and visible in your online account. If a repair exceeds your limit, you can simply top it up.
              </p>
              <p className="leading-relaxed">
                In our experience at Buy-A-Warranty, this situation is very rare - especially if you've selected a claim limit that suits your vehicle and driving habits.
              </p>
              <div className="bg-white p-8 rounded-xl shadow-lg border border-orange-100 mt-8 hover:shadow-xl transition-all duration-300">
                <p className="font-semibold text-xl text-gray-900">
                  ✓ We cover what we promise - no hidden surprises.
                </p>
              </div>
            </div>
          </div>
        </section>

        {/* Ready to Start CTA */}
        <section className="py-16 lg:py-24 px-4 bg-gradient-to-r from-orange-500 to-orange-600">
          <div className="max-w-4xl mx-auto text-center">
            <h2 className="text-4xl lg:text-5xl font-bold text-white mb-8">
              Ready To <span className="text-yellow-300">Start</span> Your Claim?
            </h2>
            <Button 
              className="bg-white text-orange-500 hover:bg-gray-100 px-10 py-5 text-xl font-semibold rounded-xl shadow-lg hover:shadow-xl transition-all"
              onClick={() => document.getElementById('claim-form')?.scrollIntoView({ behavior: 'smooth' })}
            >
              Start Your Claim Now
            </Button>
          </div>
        </section>
      </div>
    </>
  );
};

export default Claims;