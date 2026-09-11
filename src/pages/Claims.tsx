import React, { useState, useEffect, useRef } from 'react';
import { Menu, Upload, X, Mail, Phone, Search, Loader2, Info, ShieldCheck, CalendarDays, Headphones, Lock, ArrowRight, ArrowLeft, Check, Pencil, FileText, ExternalLink, Ban, ShieldOff } from 'lucide-react';
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
import { CLAIMS_PHONE, CLAIMS_PHONE_TEL } from '@/constants/contact';



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
    currentMileage: 0,
    additionalInfo: ''
  });
  const [uploadedFiles, setUploadedFiles] = useState<File[]>([]);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [showSuccessModal, setShowSuccessModal] = useState(false);
  const [hasSubmittedClaim, setHasSubmittedClaim] = useState(false);
  const [isMobileMenuOpen, setIsMobileMenuOpen] = useState(false);
  const [errors, setErrors] = useState<{[key: string]: string}>({});
  const [isDragging, setIsDragging] = useState(false);
  const [isLookingUpVehicle, setIsLookingUpVehicle] = useState(false);
  const [vehicleDetails, setVehicleDetails] = useState<{make?: string; model?: string; year?: string} | null>(null);
  const [isMileageOpen, setIsMileageOpen] = useState(false);
  const [platinumDocUrl, setPlatinumDocUrl] = useState<string | null>(null);
  const [termsDocUrl, setTermsDocUrl] = useState<string | null>(null);
  const [policyMatchStatus, setPolicyMatchStatus] = useState<'idle' | 'checking' | 'matched' | 'no_match' | 'error'>('idle');
  const policyMatchTimer = useRef<number | null>(null);

  useEffect(() => {
    const fetchDocs = async () => {
      try {
        const { data: platinumData } = await supabase
          .from('customer_documents')
          .select('file_url')
          .eq('plan_type', 'platinum')
          .order('created_at', { ascending: false })
          .limit(1)
          .maybeSingle();
        if (platinumData?.file_url) setPlatinumDocUrl(platinumData.file_url);

        const { data: termsData } = await supabase
          .from('customer_documents')
          .select('file_url')
          .eq('plan_type', 'terms-and-conditions')
          .order('created_at', { ascending: false })
          .limit(1)
          .maybeSingle();
        if (termsData?.file_url) setTermsDocUrl(termsData.file_url);
    } catch (err) {
      console.error('Error fetching claim docs:', err);
    }
  };
  fetchDocs();
}, []);

  // Debounced policy match check: once we have a valid email + verified vehicle reg,
  // confirm the combination exists in our customer database. A mismatch shows a
  // soft warning (form remains submittable) so genuine customers with data quirks
  // are not hard-blocked.
  useEffect(() => {
    const email = formData.email;
    const reg = formData.vehicleReg.trim();
    if (!validateEmail(email) || !reg || !vehicleDetails || (!vehicleDetails.make && !vehicleDetails.model)) {
      setPolicyMatchStatus('idle');
      return;
    }

    setPolicyMatchStatus('checking');
    if (policyMatchTimer.current) window.clearTimeout(policyMatchTimer.current);
    policyMatchTimer.current = window.setTimeout(async () => {
      try {
        const { data, error } = await supabase.functions.invoke('validate-customer-reg', {
          body: { registrationPlate: reg, email },
        });
        if (error) {
          console.error('Policy match check error:', error);
          setPolicyMatchStatus('error');
          return;
        }
        setPolicyMatchStatus(data?.valid ? 'matched' : 'no_match');
      } catch (err) {
        console.error('Policy match check failed:', err);
        setPolicyMatchStatus('error');
      }
    }, 600);

    return () => { if (policyMatchTimer.current) window.clearTimeout(policyMatchTimer.current); };
  }, [formData.email, formData.vehicleReg, vehicleDetails]);

  // Wizard state
  const [ackChecked, setAckChecked] = useState(false);
  const [formStarted, setFormStarted] = useState(false);
  const [currentStep, setCurrentStep] = useState<1 | 2 | 3 | 4>(1);
  const STEP_LABELS = ['Contact', 'Vehicle', 'Fault', 'Review'] as const;
  const progressPercent = (currentStep / 4) * 100;

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

  const MAX_FILE_SIZE = 20 * 1024 * 1024; // 20MB
  const ALLOWED_TYPES = [
    'application/pdf',
    'application/msword',
    'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
    'image/jpeg',
    'image/jpg',
    'image/png',
    'image/heic',
    'image/heif',
    'image/webp'
  ];

  // Compress an image File to keep it under maxSizeMB. Returns original if not an image or already small.
  const compressImageIfNeeded = async (file: File, maxSizeMB = 5): Promise<File> => {
    if (!file.type.startsWith('image/')) return file;
    if (file.size <= maxSizeMB * 1024 * 1024) return file;

    try {
      const dataUrl: string = await new Promise((resolve, reject) => {
        const r = new FileReader();
        r.onload = () => resolve(r.result as string);
        r.onerror = reject;
        r.readAsDataURL(file);
      });

      const img: HTMLImageElement = await new Promise((resolve, reject) => {
        const i = new Image();
        i.onload = () => resolve(i);
        i.onerror = reject;
        i.src = dataUrl;
      });

      const maxDim = 1920;
      let { width, height } = img;
      if (width > maxDim || height > maxDim) {
        const ratio = Math.min(maxDim / width, maxDim / height);
        width = Math.round(width * ratio);
        height = Math.round(height * ratio);
      }

      const canvas = document.createElement('canvas');
      canvas.width = width;
      canvas.height = height;
      const ctx = canvas.getContext('2d');
      if (!ctx) return file;
      ctx.drawImage(img, 0, 0, width, height);

      // Try decreasing quality until we are under the cap
      const qualities = [0.85, 0.7, 0.55, 0.4];
      for (const q of qualities) {
        const blob: Blob | null = await new Promise((resolve) =>
          canvas.toBlob(resolve, 'image/jpeg', q)
        );
        if (blob && blob.size <= maxSizeMB * 1024 * 1024) {
          const newName = file.name.replace(/\.[^.]+$/, '') + '.jpg';
          return new File([blob], newName, { type: 'image/jpeg' });
        }
      }
      // Fallback: return last attempt even if still > cap
      const finalBlob: Blob | null = await new Promise((resolve) =>
        canvas.toBlob(resolve, 'image/jpeg', 0.4)
      );
      if (finalBlob) {
        const newName = file.name.replace(/\.[^.]+$/, '') + '.jpg';
        return new File([finalBlob], newName, { type: 'image/jpeg' });
      }
      return file;
    } catch (err) {
      console.error('Image compression failed:', err);
      return file;
    }
  };

  const MAX_FILES = 10;

  const acceptFile = async (file: File): Promise<File | null> => {
    // Loose type check (some mobile browsers send empty type for HEIC, etc.)
    const lowerName = file.name.toLowerCase();
    const extOk = /\.(pdf|doc|docx|jpe?g|png|heic|heif|webp)$/i.test(lowerName);
    if (file.type && !ALLOWED_TYPES.includes(file.type) && !extOk) {
      toast({
        title: "Invalid file type",
        description: `${file.name}: Please upload a PDF, DOC, DOCX, JPG, PNG or HEIC file.`,
        variant: "destructive",
      });
      return null;
    }

    let finalFile = file;
    if (file.type.startsWith('image/') && file.size > 5 * 1024 * 1024) {
      finalFile = await compressImageIfNeeded(file, 5);
    }

    if (finalFile.size > MAX_FILE_SIZE) {
      toast({
        title: "File too large",
        description: `${file.name}: Please upload files smaller than 20MB.`,
        variant: "destructive",
      });
      return null;
    }

    return finalFile;
  };

  const acceptFiles = async (files: FileList | File[]) => {
    const incoming = Array.from(files);
    const remaining = MAX_FILES - uploadedFiles.length;
    if (remaining <= 0) {
      toast({
        title: "Attachment limit reached",
        description: `You can attach up to ${MAX_FILES} files per claim.`,
        variant: "destructive",
      });
      return;
    }
    const toProcess = incoming.slice(0, remaining);
    if (incoming.length > remaining) {
      toast({
        title: "Some files skipped",
        description: `Only the first ${remaining} file(s) were added (max ${MAX_FILES} per claim).`,
      });
    }
    if (toProcess.some(f => f.type.startsWith('image/') && f.size > 5 * 1024 * 1024)) {
      toast({ title: "Optimising your photos…", description: "Shrinking large images so they upload quickly." });
    }
    const processed: File[] = [];
    for (const f of toProcess) {
      const ok = await acceptFile(f);
      if (ok) processed.push(ok);
    }
    if (processed.length) {
      setUploadedFiles(prev => [...prev, ...processed]);
    }
  };

  const handleFileUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const files = e.target.files;
    if (files && files.length > 0) await acceptFiles(files);
    // reset input so the same file can be reselected later
    e.target.value = '';
  };

  const removeFile = (index: number) => {
    setUploadedFiles(prev => prev.filter((_, i) => i !== index));
  };

  const handleDragOver = (e: React.DragEvent<HTMLElement>) => {
    e.preventDefault();
    e.stopPropagation();
    setIsDragging(true);
  };

  const handleDragLeave = (e: React.DragEvent<HTMLElement>) => {
    e.preventDefault();
    e.stopPropagation();
    setIsDragging(false);
  };

  const handleDrop = async (e: React.DragEvent<HTMLElement>) => {
    e.preventDefault();
    e.stopPropagation();
    setIsDragging(false);

    const files = e.dataTransfer.files;
    if (files && files.length > 0) {
      await acceptFiles(files);
    }
  };

  // ── Wizard helpers ──
  const startForm = () => {
    if (!ackChecked) return;
    setFormStarted(true);
    setCurrentStep(1);
    setTimeout(() => {
      document.getElementById('claim-form')?.scrollIntoView({ behavior: 'smooth' });
    }, 50);
  };

  const validateStep = (step: number): boolean => {
    const newErrors: {[key: string]: string} = {};
    if (step === 1) {
      if (!formData.name.trim()) newErrors.name = 'Could you let us know your name?';
      if (!formData.email.trim()) newErrors.email = 'We just need an email so we can get back to you.';
      else if (!validateEmail(formData.email)) newErrors.email = "That email doesn't look quite right - mind double-checking it?";
      if (!formData.phone.trim()) newErrors.phone = 'A contact number helps us reach you faster.';
      else if (!validatePhone(formData.phone)) newErrors.phone = "Please update to a UK number e.g 07123 456789.";
    }
    if (step === 2) {
      if (!formData.vehicleReg.trim()) newErrors.vehicleReg = 'Please pop in your vehicle registration.';
      else if (!vehicleDetails || (!vehicleDetails.make && !vehicleDetails.model)) {
        newErrors.vehicleReg = 'Please enter a valid UK registration we can verify.';
      }
    }
    if (step === 3) {
      if (!formData.faultDescription.trim()) newErrors.faultDescription = 'Please describe the fault or problem.';
    }
    setErrors(newErrors);
    if (Object.keys(newErrors).length > 0) {
      toast({ title: 'Just a few details missing', description: 'Please complete the highlighted fields.', variant: 'destructive' });
      setTimeout(() => {
        const el = document.getElementById(Object.keys(newErrors)[0]);
        el?.scrollIntoView({ behavior: 'smooth', block: 'center' });
      }, 50);
      return false;
    }
    return true;
  };

  const goToStep = (step: 1 | 2 | 3 | 4, skipValidation = false) => {
    if (!skipValidation && step > currentStep) {
      for (let s = currentStep; s < step; s++) {
        if (!validateStep(s)) return;
      }
    }
    setCurrentStep(step);
    setTimeout(() => {
      document.getElementById('claim-form')?.scrollIntoView({ behavior: 'smooth', block: 'start' });
    }, 50);
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
      // skipAgeCheck: claim customers already hold a warranty, so the 15-year
      // sales-eligibility gate must not block them from filing a claim.
      const { data, error } = await supabase.functions.invoke('dvla-vehicle-lookup', {
        body: { registrationNumber: cleanReg, skipAgeCheck: true }
      });

      if (error) {
        console.error('Vehicle lookup error:', error);
        setVehicleDetails(null);
        setErrors((prev) => ({ ...prev, vehicleReg: "We couldn't verify that registration. Please double-check it." }));
        return;
      }

      // Existing warranty holders must always be able to file a claim, so the
      // sales-side eligibility/exclusion blocks (e.g. specialist makes) must not
      // stop the lookup here. If DVLA returned a vehicle, accept it.
      if (data?.make || data?.model) {
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

    if (hasSubmittedClaim) {
      toast({
        title: "You've already submitted a claim",
        description: "To add more details, please use the 'Already submitted a claim?' section above to upload extra evidence.",
        variant: "destructive",
      });
      // Scroll to upload-evidence section at top of page
      const el = document.querySelector('a[href="/add-evidence/"]');
      if (el) el.scrollIntoView({ behavior: 'smooth', block: 'center' });
      return;
    }

    // Validate all required fields together so every issue is shown at once
    const newErrors: {[key: string]: string} = {};

    if (!formData.name.trim()) {
      newErrors.name = 'Could you let us know your name?';
    }

    if (!formData.email.trim()) {
      newErrors.email = 'We just need an email so we can get back to you.';
    } else if (!validateEmail(formData.email)) {
      newErrors.email = 'That email doesn\'t look quite right - mind double-checking it?';
    }

    if (!formData.phone.trim()) {
      newErrors.phone = 'A contact number helps us reach you faster.';
    } else if (!validatePhone(formData.phone)) {
      newErrors.phone = 'Please update to a UK number e.g 07123 456789.';
    }

    if (!formData.vehicleReg.trim()) {
      newErrors.vehicleReg = 'Please pop in your vehicle registration.';
    } else if (errors.vehicleReg) {
      newErrors.vehicleReg = errors.vehicleReg;
    } else if (!vehicleDetails || (!vehicleDetails.make && !vehicleDetails.model)) {
      newErrors.vehicleReg = 'Please enter a valid UK registration we can verify.';
    }

    if (!formData.faultDescription.trim()) {
      newErrors.faultDescription = 'Please describe the fault or problem.';
    }

    if (Object.keys(newErrors).length > 0) {
      setErrors(newErrors);
      toast({
        title: "Just a few details missing",
        description: "We've highlighted the fields below - please take a quick look.",
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
      const filesPayload: Array<{ name: string; size: number; type: string; data: string }> = [];

      for (const f of uploadedFiles) {
        const fileBase64 = await new Promise<string>((resolve, reject) => {
          const reader = new FileReader();
          reader.onload = () => resolve(reader.result as string);
          reader.onerror = reject;
          reader.readAsDataURL(f);
        });
        filesPayload.push({
          name: f.name,
          size: f.size,
          type: f.type,
          data: fileBase64,
        });
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
          file: filesPayload[0] || null, // backwards compat
          files: filesPayload,
        }
      });

      if (response.error) {
        throw new Error(response.error.message || 'Failed to submit claim');
      }

      setShowSuccessModal(true);
      setHasSubmittedClaim(true);

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
        currentMileage: 0,
        additionalInfo: ''
      });
      setUploadedFiles([]);
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

      <style>{`
        .claims-pro {
          --c-orange: #E8541A;
          --c-orange-light: #FEF0E8;
          --c-navy: #1A2B4A;
          --c-navy-light: #EEF1F6;
          --c-navy-mid: #2E4470;
          --c-cream: #F4F6F8;
          --c-ink: #1A2B4A;
          --c-ink-60: #5A6B82;
          --c-ink-30: #B0BAC6;
          --c-border: #E2E8F0;
          --c-shadow: 0 2px 20px rgba(26,43,74,0.08);
          font-family: 'DM Sans', system-ui, -apple-system, sans-serif;
          color: var(--c-ink);
        }
        .claims-pro .pro-serif { font-family: 'Fraunces', Georgia, serif; font-weight: 500; letter-spacing: -0.02em; }
        .claims-pro .pro-card {
          background: #fff;
          border: 1px solid var(--c-border);
          border-radius: 16px;
          box-shadow: var(--c-shadow);
        }
        .claims-pro .pro-card-pad { padding: 1.75rem; }
        @media(min-width: 640px) { .claims-pro .pro-card-pad { padding: 2rem; } }
        .claims-pro h2, .claims-pro h3 { font-family: 'Fraunces', Georgia, serif; font-weight: 500; letter-spacing: -0.02em; color: var(--c-ink); }
        .claims-pro label { font-family: 'DM Sans', sans-serif; font-size: 13px !important; font-weight: 500 !important; color: var(--c-ink-60) !important; }
        .claims-pro input, .claims-pro textarea, .claims-pro select {
          background: var(--c-cream) !important;
          border: 1.5px solid var(--c-border) !important;
          border-radius: 10px !important;
          font-family: 'DM Sans', sans-serif;
          color: var(--c-ink);
          transition: border-color .2s, box-shadow .2s, background .2s;
        }
        .claims-pro input:focus, .claims-pro textarea:focus, .claims-pro select:focus {
          border-color: var(--c-orange) !important;
          background: #fff !important;
          box-shadow: 0 0 0 3px rgba(232,84,26,0.1) !important;
        }
        .claims-pro .pro-step-num {
          width: 28px; height: 28px; background: var(--c-navy-light); color: var(--c-navy);
          border-radius: 8px; display: inline-flex; align-items: center; justify-content: center;
          font-size: 13px; font-weight: 500; flex-shrink: 0; font-family: 'DM Sans', sans-serif;
        }
        .claims-pro .pro-btn-primary {
          background: var(--c-navy) !important; color: #fff !important;
          border-radius: 10px !important; font-weight: 500 !important;
          box-shadow: 0 4px 14px rgba(26,43,74,0.25);
          transition: all .2s;
        }
        .claims-pro .pro-btn-primary:hover { background: var(--c-navy-mid) !important; transform: translateY(-1px); }
        .claims-pro .pro-divider-soft { border-top: 1px solid var(--c-border); }
      `}</style>

      <div className="min-h-screen bg-white claims-pro">
        {/* Hero Section - UX Optimized with Orange Branding */}
        {/* Hero + intro */}
        <section className="bg-white pt-10 sm:pt-14 pb-6 px-4 sm:px-6">
          <div className="max-w-2xl mx-auto">
            <button
              type="button"
              onClick={() => navigate(-1)}
              className="mb-4 inline-flex items-center gap-1.5 text-[13px] font-medium text-[#5A6B82] hover:text-[#1A2B4A] transition-colors"
            >
              <ArrowLeft className="w-4 h-4" /> Back
            </button>
            {/* Slim working hours pill */}
            <div className="mb-5 ml-4 inline-flex items-center gap-2 rounded-full bg-[#FEF0E8] border border-[#E8541A]/20 px-3 py-1.5 text-xs font-medium text-[#E8541A]">
              <CalendarDays className="w-3.5 h-3.5" />
              Claims team open Monday–Friday, 9am–5pm
            </div>

            <h1 className="pro-serif text-[clamp(2rem,5vw,2.8rem)] leading-[1.15] text-[#1A2B4A] mb-2">
              Making a claim
            </h1>
            <p className="text-[15px] text-[#5A6B82] mb-6">
              Simple and supportive.
            </p>

            <p className="text-[15px] text-[#5A6B82] leading-[1.7] mb-8">
              We know that vehicle issues can be stressful, but making a claim shouldn't be. At Buy-A-Warranty, we've made the process clear, quick and customer focused - so you get the help you need without the hassle.
            </p>

            {/* 14-day cover notice */}
            <div className="mb-8 rounded-2xl border border-[#A7F3D0] bg-[#ECFDF5] border-l-4 border-l-[#059669] p-4 sm:p-5">
              <p className="text-[14px] font-semibold text-[#065F46] mb-1.5 flex items-center gap-2">
                <ShieldCheck className="w-4 h-4" /> Your warranty cover is now active.
              </p>
              <p className="text-[13px] text-[#065F46] leading-[1.6]">
                Please note that claims can be submitted after your first <strong>14 days of continuous cover</strong>. Full details can be found in your policy documents.
              </p>
            </div>



            {/* Why you're in safe hands */}
            <p className="text-[11px] font-medium text-[#E8541A] uppercase tracking-[0.07em] mb-3">
              Why you're in safe hands
            </p>
            <div className="grid grid-cols-1 sm:grid-cols-3 gap-2.5 mb-8">
              {[
                { title: 'Quick response', body: 'We respond to claims quickly and fairly, with no unnecessary delays.' },
                { title: 'UK-based team', body: 'Our UK-based claims team is here to guide you every step of the way.' },
                { title: 'Simple process', body: 'We keep things simple - no confusing jargon or hidden terms.' },
              ].map((c) => (
                <div key={c.title} className="bg-white border border-[#E2E8F0] rounded-2xl p-4">
                  <div className="w-9 h-9 bg-[#FEF0E8] rounded-[10px] flex items-center justify-center mb-3">
                    <ShieldCheck className="w-[18px] h-[18px] text-[#E8541A]" strokeWidth={1.8} />
                  </div>
                  <div className="text-[13px] font-medium text-[#1A2B4A] mb-1">{c.title}</div>
                  <div className="text-[12px] text-[#5A6B82] leading-[1.5]">{c.body}</div>
                </div>
              ))}
            </div>

            {/* What you'll need */}
            <p className="text-[11px] font-medium text-[#B0BAC6] uppercase tracking-[0.07em] mb-3">
              What you'll need
            </p>
            <div className="bg-white border border-[#E2E8F0] rounded-2xl p-5 mb-8">
              <ul className="space-y-2.5 text-[14px] text-[#1A2B4A]">
                {[
                  'Your vehicle registration',
                  'A brief description of the issue',
                  'Any supporting documents, garage report or invoice',
                ].map((t) => (
                  <li key={t} className="flex items-start gap-2.5">
                    <Check className="w-4 h-4 text-[#16A34A] mt-0.5 flex-shrink-0" />
                    <span>{t}</span>
                  </li>
                ))}
              </ul>
            </div>

            {/* Already submitted? */}
            <div className="bg-white border border-[#E2E8F0] rounded-2xl p-4 sm:p-5 flex flex-col sm:flex-row items-start sm:items-center gap-3 justify-between mb-2">
              <div className="text-left">
                <div className="text-[14px] font-medium text-[#1A2B4A] mb-0.5">Already submitted a claim?</div>
                <p className="text-[13px] text-[#5A6B82]">Just upload extra evidence (photos, reports, invoices) to your existing claim.</p>
              </div>
              <Link to="/add-evidence/" className="flex-shrink-0">
                <Button className="pro-btn-primary h-10 px-4 text-[13px] inline-flex items-center gap-2">
                  <Upload className="w-3.5 h-3.5" /> Upload evidence
                </Button>
              </Link>
            </div>
          </div>
        </section>

        {/* Form section */}
        <section className="bg-white pt-4 pb-16 px-4 sm:px-6">
          <div className="max-w-2xl mx-auto">
            <div id="claim-form">
              <div className="mb-6 text-left">
                <h2 className="pro-serif text-[clamp(1.5rem,3.5vw,2rem)] text-[#1A2B4A] mb-1">
                  Start your claim
                </h2>
                <p className="text-[14px] text-[#5A6B82]">
                  Takes about 3 minutes.
                </p>
              </div>

              <div>
                <div>
                  {/* form column */}
                   {!formStarted ? (
                     <>
                       {/* ── Acknowledgement gate ── */}
                       <div className="mb-5 pro-card p-5 sm:p-7">
                         {/* Header */}
                         <div className="flex items-start gap-3.5 mb-5">
                           <div className="flex-shrink-0 flex items-center justify-center w-10 h-10 rounded-full bg-[#1A2B4A] text-white">
                             <Info className="w-5 h-5" strokeWidth={2.25} />
                           </div>
                           <div>
                             <h3 className="pro-serif text-[1.35rem] text-[#1A2B4A] text-left leading-tight mb-1">
                               Before you begin
                             </h3>
                             <p className="text-[14px] text-[#5A6B82] text-left">
                               Please take a moment to review this important information.
                             </p>
                           </div>
                         </div>

                         {/* Callout: No refund */}
                         <div className="mb-3 rounded-[12px] bg-[#FFF1EA] border border-[#FBD9C6] p-4 sm:p-5 flex items-start gap-4 text-left">
                           <div className="flex-shrink-0 flex items-center justify-center w-11 h-11 rounded-full bg-[#FCE0D0] text-[#E8541A]">
                             <Ban className="w-5 h-5" strokeWidth={2.25} />
                           </div>
                           <div className="min-w-0">
                             <p className="text-[15px] font-semibold text-[#1A2B4A] mb-1">No refund after submitting</p>
                             <p className="text-[13.5px] text-[#5A6B82] leading-relaxed">
                               Once you submit a claim, your warranty will no longer be eligible for cancellation or refund. Our claims team begins reviewing your case straight away, including assessing your claim and working with approved garages on your behalf. These costs are incurred as soon as the process starts and cannot be recovered.
                             </p>
                           </div>
                         </div>

                         {/* Callout: Cover stays active */}
                         <div className="mb-3 rounded-[12px] bg-[#EDF8F2] border border-[#CDEBD9] p-4 sm:p-5 flex items-start gap-4 text-left">
                           <div className="flex-shrink-0 flex items-center justify-center w-11 h-11 rounded-full bg-[#D5EFDF] text-[#1F8A52]">
                             <ShieldCheck className="w-5 h-5" strokeWidth={2.25} />
                           </div>
                           <div className="min-w-0">
                             <p className="text-[15px] font-semibold text-[#1A2B4A] mb-1">Your cover stays active</p>
                             <p className="text-[13.5px] text-[#5A6B82] leading-relaxed">
                               This is standard practice across the warranty industry and is outlined in your policy terms. Your warranty cover will continue as normal for the remainder of your policy period - submitting a claim will not reduce or affect your ongoing protection.
                             </p>
                           </div>
                         </div>

                         {/* Callout: Need help */}
                         <div className="mb-5 rounded-[12px] bg-[#EEF3FB] border border-[#D4E0F2] p-4 sm:p-5 flex items-start gap-4 text-left">
                           <div className="flex-shrink-0 flex items-center justify-center w-11 h-11 rounded-full bg-[#DCE6F6] text-[#1A2B4A]">
                             <Headphones className="w-5 h-5" strokeWidth={2.25} />
                           </div>
                           <div className="min-w-0 flex-1">
                             <p className="text-[15px] font-semibold text-[#1A2B4A] mb-1">Not sure? We're here to help</p>
                             <p className="text-[13.5px] text-[#5A6B82] leading-relaxed mb-2.5">
                               Our friendly team can answer any questions before you proceed.
                             </p>
                             <div className="flex flex-wrap items-center gap-x-4 gap-y-1.5 text-[13.5px]">
                               <a href="tel:03302295045" className="inline-flex items-center gap-1.5 font-medium text-[#1A2B4A] hover:text-[#E8541A]">
                                 <Phone className="w-4 h-4 text-[#1A2B4A]" /> 0330 229 5045
                               </a>
                               <span className="text-[#C7D0DD]">|</span>
                               <a href="mailto:claims@buyawarranty.co.uk" className="inline-flex items-center gap-1.5 font-medium text-[#1A2B4A] hover:text-[#E8541A]">
                                 <Mail className="w-4 h-4 text-[#1A2B4A]" /> claims@buyawarranty.co.uk
                               </a>
                             </div>
                           </div>
                         </div>

                         {/* Divider */}
                         <div className="border-t border-[#E2E8F0] my-5" />

                         {/* Important documents */}
                         <div className="mb-5 text-left">
                           <p className="text-[15px] font-semibold text-[#1A2B4A] mb-1">Important documents</p>
                           <p className="text-[13.5px] text-[#5A6B82] mb-3">Please review the relevant documents before submitting your claim.</p>
                           <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                             <a
                               href={platinumDocUrl || '#'}
                               target="_blank"
                               rel="noopener noreferrer"
                               onClick={(e) => { if (!platinumDocUrl) { e.preventDefault(); toast({ title: 'Document loading', description: 'Please try again in a moment.' }); } }}
                               className="flex items-center justify-between gap-2 rounded-[10px] border border-[#E2E8F0] bg-white px-4 py-3.5 hover:border-[#E8541A] hover:bg-[#FEF0E8]/40 transition-colors group"
                             >
                               <span className="flex items-center gap-2.5 min-w-0">
                                 <FileText className="w-4 h-4 text-[#1A2B4A] flex-shrink-0" />
                                 <span className="text-[13.5px] font-semibold text-[#1A2B4A] truncate">Platinum Plan</span>
                               </span>
                               <ExternalLink className="w-4 h-4 text-[#5A6B82] group-hover:text-[#E8541A] flex-shrink-0" />
                             </a>
                             <a
                               href={termsDocUrl || '#'}
                               target="_blank"
                               rel="noopener noreferrer"
                               onClick={(e) => { if (!termsDocUrl) { e.preventDefault(); toast({ title: 'Document loading', description: 'Please try again in a moment.' }); } }}
                               className="flex items-center justify-between gap-2 rounded-[10px] border border-[#E2E8F0] bg-white px-4 py-3.5 hover:border-[#E8541A] hover:bg-[#FEF0E8]/40 transition-colors group"
                             >
                               <span className="flex items-center gap-2.5 min-w-0">
                                 <FileText className="w-4 h-4 text-[#1A2B4A] flex-shrink-0" />
                                 <span className="text-[13.5px] font-semibold text-[#1A2B4A] truncate">Terms &amp; Conditions</span>
                               </span>
                               <ExternalLink className="w-4 h-4 text-[#5A6B82] group-hover:text-[#E8541A] flex-shrink-0" />
                             </a>
                           </div>
                         </div>

                         {/* Gate checkbox */}
                         <label
                           htmlFor="ackCheck"
                           className={`flex gap-3 items-start rounded-[10px] p-4 cursor-pointer transition-colors ${
                             ackChecked ? 'bg-[#FEF0E8] border border-[#E8541A]/40' : 'bg-white border border-[#E2E8F0] hover:border-[#1A2B4A]/30'
                           }`}
                         >
                           <input
                             type="checkbox"
                             id="ackCheck"
                             checked={ackChecked}
                             onChange={(e) => setAckChecked(e.target.checked)}
                             className="w-[18px] h-[18px] mt-0.5 flex-shrink-0 accent-[#E8541A] cursor-pointer"
                           />
                           <span className="text-[13.5px] text-[#1A2B4A] leading-relaxed text-left">
                             I confirm the information provided is accurate and that I have read and understood the information above.
                           </span>
                         </label>
                       </div>

                       {/* Continue button */}
                       <div className="mb-3">
                         <Button
                           type="button"
                           onClick={startForm}
                           disabled={!ackChecked}
                            className={`w-full h-14 text-[15px] font-semibold rounded-[12px] inline-flex items-center justify-center gap-3 transition-all ${
                              ackChecked
                                ? 'bg-[#EB6A2C] hover:bg-[#D55A1F] text-white'
                                : 'bg-[#EB6A2C]/40 text-white cursor-not-allowed'
                            }`}
                         >
                           <ShieldCheck className="w-5 h-5" />
                           Continue to claim form
                           <ArrowRight className="w-5 h-5 ml-auto" />
                         </Button>
                         <p className="flex items-center justify-center gap-1.5 text-[12.5px] text-[#5A6B82] mt-3">
                           <Lock className="w-3.5 h-3.5" />
                           {ackChecked ? 'Your information is secure and will only be used to process your claim.' : 'Please tick the box above to continue.'}
                         </p>
                       </div>
                       </>
                   ) : (
                     <>
                       
                         <div className="mb-5 rounded-[10px] bg-[#FEF0E8] border border-[#E8541A]/20 px-3.5 py-2.5 flex items-start gap-2 text-[13px] text-[#5A6B82]">
                           <CalendarDays className="w-4 h-4 text-[#E8541A] flex-shrink-0 mt-0.5" />
                           <span><strong className="text-[#1A2B4A] font-medium">Claims team hours:</strong> Monday–Friday, 9am–5pm. Submissions outside these hours are reviewed the next working day.</span>
                         </div>

                        {/* No matching policy warning — soft, form remains submittable */}
                        {policyMatchStatus === 'no_match' && (
                          <div className="mb-5 rounded-[12px] bg-[#FF385C] border border-[#E01941] p-4 sm:p-5 flex items-start gap-3 text-white">
                            <Info className="w-5 h-5 flex-shrink-0 mt-0.5" />
                            <p className="text-[14px] leading-relaxed text-left">
                              We can't find a matching policy for this vehicle. For assistance please call Claims on{' '}
                              <a href={CLAIMS_PHONE_TEL} className="font-semibold underline underline-offset-2 hover:text-white/90">
                                {CLAIMS_PHONE}
                              </a>{' '}
                              Mon–Fri 9am to 6pm.
                            </p>
                          </div>
                        )}

                       {/* Step tracker */}
                       <div className="mb-4">
                         <div className="flex items-center gap-1 sm:gap-2">
                           {STEP_LABELS.map((label, i) => {
                             const stepNum = (i + 1) as 1 | 2 | 3 | 4;
                             const isDone = stepNum < currentStep;
                             const isActive = stepNum === currentStep;
                             return (
                               <React.Fragment key={label}>
                                 <button
                                   type="button"
                                   onClick={() => stepNum < currentStep && goToStep(stepNum, true)}
                                   className={`flex items-center gap-2 ${stepNum < currentStep ? 'cursor-pointer' : 'cursor-default'}`}
                                 >
                                    <div className={`w-8 h-8 rounded-full flex items-center justify-center text-xs font-medium transition-all flex-shrink-0 ${
                                      isDone ? 'bg-[#E8541A] text-white' :
                                      isActive ? 'bg-[#1A2B4A] text-white ring-4 ring-[#1A2B4A]/12' :
                                      'bg-[#E2E8F0] text-[#5A6B82]'
                                    }`}>
                                      {isDone ? <Check className="w-4 h-4" /> : stepNum}
                                    </div>
                                    <span className={`hidden sm:inline text-xs ${
                                      isActive ? 'text-[#1A2B4A] font-medium' : 'text-[#5A6B82]'
                                    }`}>
                                      {label}
                                    </span>
                                  </button>
                                  {i < STEP_LABELS.length - 1 && (
                                    <div className={`flex-1 h-px ${stepNum < currentStep ? 'bg-[#E8541A]' : 'bg-[#E2E8F0]'}`} />
                                  )}
                                </React.Fragment>
                              );
                            })}
                          </div>
                          <div className="mt-3 h-[3px] bg-[#E2E8F0] rounded-full overflow-hidden">
                            <div
                              className="h-full rounded-full transition-all duration-500"
                              style={{ width: `${progressPercent}%`, background: 'linear-gradient(90deg,#1A2B4A,#E8541A)' }}
                            />
                          </div>
                        </div>

                       <div className="pro-card pro-card-pad">
                         <form onSubmit={handleSubmit} className="space-y-6">
                           {/* STEP 1: Contact */}
                           {currentStep === 1 && (
                             <div className="space-y-5 animate-fade-in">
                               <div>
                                 <h3 className="text-xl text-[#1A2B4A] text-left flex items-center gap-2.5"><span className="pro-step-num">1</span> Let's start with you</h3>
                                 <p className="text-sm text-gray-600 mt-1 text-left">Just a few quick details so we know who to get back to.</p>
                               </div>
                                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                                  <div>
                                    <Label htmlFor="name" className="text-gray-900 font-bold text-sm block text-left">Full name *</Label>
                                    <div className="relative">
                                      <Input id="name" name="name" type="text" placeholder="Jane Smith" value={formData.name} onChange={handleInputChange} required
                                        className={`mt-1.5 h-11 border-gray-300 focus:border-orange-500 focus:ring-orange-500 pr-10 ${errors.name ? 'border-[#FF385C]' : ''}`} />
                                      {!errors.name && formData.name.trim().length >= 2 && (
                                        <Check className="w-5 h-5 text-green-600 absolute right-3 top-1/2 -translate-y-1/2 mt-[3px]" />
                                      )}
                                    </div>
                                    {errors.name && <p className="mt-1 text-sm text-[#FF385C] text-left">{errors.name}</p>}
                                  </div>
                                  <div>
                                    <Label htmlFor="email" className="text-gray-900 font-bold text-sm block text-left">Email address *</Label>
                                    <div className="relative">
                                      <Input id="email" name="email" type="email" placeholder="you@email.com" value={formData.email} onChange={handleInputChange} required
                                        className={`mt-1.5 h-11 border-gray-300 focus:border-orange-500 focus:ring-orange-500 pr-10 ${errors.email ? 'border-[#FF385C]' : ''}`} />
                                      {!errors.email && validateEmail(formData.email) && (
                                        <Check className="w-5 h-5 text-green-600 absolute right-3 top-1/2 -translate-y-1/2 mt-[3px]" />
                                      )}
                                    </div>
                                    {errors.email && <p className="mt-1 text-sm text-[#FF385C] text-left">{errors.email}</p>}
                                  </div>
                                  <div className="md:col-span-2">
                                    <Label htmlFor="phone" className="text-gray-900 font-bold text-sm block text-left">Phone number *</Label>
                                    <div className="relative">
                                      <Input id="phone" name="phone" type="tel" placeholder="07123 456 789" value={formData.phone} onChange={handleInputChange}
                                        className={`mt-1.5 h-11 border-gray-300 focus:border-orange-500 focus:ring-orange-500 pr-10 ${errors.phone ? 'border-[#FF385C]' : ''}`} />
                                      {!errors.phone && validatePhone(formData.phone) && (
                                        <Check className="w-5 h-5 text-green-600 absolute right-3 top-1/2 -translate-y-1/2 mt-[3px]" />
                                      )}
                                    </div>
                                    {errors.phone && <p className="mt-1 text-sm text-[#FF385C] text-left">{errors.phone}</p>}
                                  </div>
                                </div>
                               <div className="flex justify-end pt-3 border-t border-gray-100">
                                 <Button type="button" onClick={() => goToStep(2)} className="pro-btn-primary px-6 h-11 inline-flex items-center gap-2 font-semibold">
                                   Continue <ArrowRight className="w-4 h-4" />
                                 </Button>
                               </div>
                             </div>
                           )}

                           {/* STEP 2: Vehicle */}
                           {currentStep === 2 && (
                             <div className="space-y-5 animate-fade-in">
                               <div>
                                 <h3 className="text-xl text-[#1A2B4A] text-left flex items-center gap-2.5"><span className="pro-step-num">2</span> Vehicle details</h3>
                                 <p className="text-sm text-gray-600 mt-1 text-left">We'll look up your vehicle automatically using the registration.</p>
                               </div>
                               <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                                 <div className="md:col-span-2">
                                   <Label htmlFor="vehicleReg" className="text-gray-900 font-bold text-sm block text-left">Vehicle registration *</Label>
                                   <div className="relative">
                                     <Input id="vehicleReg" name="vehicleReg" type="text" placeholder="AB12 CDE"
                                       value={formData.vehicleReg}
                                       onChange={(e) => { handleInputChange(e); setVehicleDetails(null); }}
                                       onBlur={(e) => { const v = e.target.value.trim(); if (v.length >= 2) lookupVehicle(v); }}
                                       required
                                       style={{ textTransform: 'uppercase', fontWeight: 600, letterSpacing: '0.05em' }}
                                       className={`mt-1.5 h-11 border-gray-300 focus:border-orange-500 focus:ring-orange-500 pr-10 ${errors.vehicleReg ? 'border-[#FF385C]' : ''}`} />
                                     {isLookingUpVehicle && (
                                       <div className="absolute right-3 top-1/2 -translate-y-1/2 mt-0.5">
                                         <Loader2 className="w-4 h-4 animate-spin text-orange-500" />
                                       </div>
                                     )}
                                   </div>
                                   {errors.vehicleReg && <p className="mt-1 text-sm text-[#FF385C] text-left">{errors.vehicleReg}</p>}
                                   {vehicleDetails && (vehicleDetails.make || vehicleDetails.model) && (
                                     <div className="mt-2 p-3 bg-green-50 border border-green-200 rounded-md flex items-center gap-2">
                                       <Check className="w-4 h-4 text-green-600 flex-shrink-0" />
                                       <p className="text-sm text-green-700 font-medium">
                                         {vehicleDetails.make} {vehicleDetails.model} {vehicleDetails.year ? `(${vehicleDetails.year})` : ''} · ready to claim
                                       </p>
                                     </div>
                                   )}
                                 </div>

                                 <div className="md:col-span-2">
                                   <Label htmlFor="currentMileage" className="text-gray-900 font-bold text-sm block text-left">Current mileage</Label>
                                   <div className="flex gap-2 mt-1.5">
                                     <Input id="currentMileage" name="currentMileage" type="text" inputMode="numeric" placeholder="e.g. 45,000"
                                       value={formData.currentMileage ? formData.currentMileage.toLocaleString('en-GB') : ''}
                                       onChange={(e) => {
                                         const digits = e.target.value.replace(/[^0-9]/g, '');
                                         const value = digits ? parseInt(digits, 10) : 0;
                                         setFormData({ ...formData, currentMileage: Math.min(Math.max(value, 0), 200000) });
                                       }}
                                       className="h-11 border-gray-300 focus:border-orange-500 focus:ring-orange-500 flex-1" />
                                     <Popover open={isMileageOpen} onOpenChange={setIsMileageOpen}>
                                       <PopoverTrigger asChild>
                                         <Button type="button" variant="outline" className="h-11 px-3 border-gray-300" aria-label="Pick mileage">
                                           <ChevronDown className="h-4 w-4" />
                                         </Button>
                                       </PopoverTrigger>
                                       <PopoverContent className="w-48 p-0 bg-white z-50" align="end" sideOffset={4}>
                                         <div className="max-h-72 overflow-y-auto overscroll-contain py-1">
                                           {Array.from({ length: 200 }, (_, i) => (i + 1) * 1000).map((m) => (
                                             <button key={m} type="button"
                                               onClick={() => { setFormData((p) => ({ ...p, currentMileage: m })); setIsMileageOpen(false); }}
                                               className="w-full text-left px-3 py-2 text-sm hover:bg-orange-50 hover:text-orange-700">
                                               {m.toLocaleString('en-GB')}
                                             </button>
                                           ))}
                                         </div>
                                       </PopoverContent>
                                     </Popover>
                                   </div>
                                 </div>
                               </div>
                               <div className="flex justify-between items-center pt-3 border-t border-gray-100">
                                 <Button type="button" variant="outline" onClick={() => goToStep(1, true)} className="h-11 inline-flex items-center gap-2">
                                   <ArrowLeft className="w-4 h-4" /> Back
                                 </Button>
                                 <Button type="button" onClick={() => goToStep(3)} className="pro-btn-primary px-6 h-11 inline-flex items-center gap-2 font-semibold">
                                   Continue <ArrowRight className="w-4 h-4" />
                                 </Button>
                               </div>
                             </div>
                           )}

                           {/* STEP 3: Fault */}
                           {currentStep === 3 && (
                             <div className="space-y-5 animate-fade-in">
                               <div>
                                 <h3 className="text-xl text-[#1A2B4A] text-left flex items-center gap-2.5"><span className="pro-step-num">3</span> Describe the fault</h3>
                                 <p className="text-sm text-gray-600 mt-1 text-left">Help our team understand what's happening with your vehicle.</p>
                               </div>

                               <div>
                                 <Label htmlFor="faultDescription" className="text-gray-900 font-bold text-sm block text-left">Describe the fault / problem *</Label>
                                 <Textarea id="faultDescription" name="faultDescription"
                                   placeholder="Please explain what's wrong with the vehicle (e.g. strange noise from engine, gearbox slipping, warning lights on dashboard...)"
                                   value={formData.faultDescription} onChange={handleInputChange} required rows={4}
                                   className={`mt-1.5 border-gray-300 focus:border-orange-500 focus:ring-orange-500 ${errors.faultDescription ? 'border-[#FF385C]' : ''}`} />
                                 {errors.faultDescription && <p className="mt-1 text-sm text-[#FF385C] text-left">{errors.faultDescription}</p>}
                               </div>

                                <div>
                                  <Label htmlFor="dateOccurred" className="text-gray-900 font-bold text-sm block text-left">When did the fault occur?</Label>
                                  <Input id="dateOccurred" name="dateOccurred" type="date"
                                    value={formData.dateOccurred} onChange={handleInputChange}
                                    max={new Date().toISOString().split('T')[0]}
                                    className="mt-1.5 h-11 border-gray-300 focus:border-orange-500 focus:ring-orange-500 md:max-w-xs" />
                                </div>
                                <div>
                                  <Label htmlFor="issueTiming" className="text-gray-900 font-bold text-sm block text-left">When does the issue happen?</Label>
                                  <Textarea id="issueTiming" name="issueTiming"
                                    placeholder="e.g. on start-up, when braking, after driving for 10 minutes, only when cold..."
                                    value={formData.issueTiming} onChange={handleInputChange} rows={3}
                                    className="mt-1.5 border-gray-300 focus:border-orange-500 focus:ring-orange-500" />
                                </div>

                               <div>
                                 <Label htmlFor="faultDetails" className="text-gray-900 font-bold text-sm block text-left">Any other relevant details</Label>
                                 <Textarea id="faultDetails" name="faultDetails"
                                   placeholder="Garage diagnosis, recent repairs, anything else we should know..."
                                   value={formData.faultDetails} onChange={handleInputChange} rows={3}
                                   className="mt-1.5 border-gray-300 focus:border-orange-500 focus:ring-orange-500" />
                               </div>

                               {/* Supporting documents */}
                               <div>
                                 <Label className="text-gray-900 font-bold text-sm block text-left mb-1.5">Supporting documents (optional)</Label>
                                 <label htmlFor="file-upload"
                                   onDragOver={handleDragOver} onDragLeave={handleDragLeave} onDrop={handleDrop}
                                   className={`relative block cursor-pointer rounded-lg border-2 border-dashed p-5 text-center transition-colors ${
                                     isDragging ? 'border-orange-500 bg-orange-50' : 'border-gray-300 hover:border-orange-400 hover:bg-orange-50/50'
                                   }`}>
                                   <Upload className="mx-auto h-8 w-8 text-orange-500 mb-2" />
                                   <p className="text-sm font-medium text-gray-700">
                                     {uploadedFiles.length > 0 ? 'Add more files' : 'Click to upload or drag and drop'}
                                   </p>
                                   <p className="text-xs text-gray-500 mt-1">
                                     PDF, DOC, DOCX, JPG, PNG or HEIC - up to {MAX_FILES} files (max 20MB each)
                                   </p>
                                 </label>
                                 <input id="file-upload" type="file" multiple className="sr-only"
                                   accept="image/*,.pdf,.doc,.docx,.heic,.heif,application/pdf,application/msword,application/vnd.openxmlformats-officedocument.wordprocessingml.document"
                                   onChange={handleFileUpload} />
                                 {uploadedFiles.length > 0 && (
                                   <div className="mt-3 space-y-2">
                                     {uploadedFiles.map((f, idx) => (
                                       <div key={`${f.name}-${idx}`} className="flex items-center justify-between rounded-lg border border-green-200 bg-green-50 p-2.5">
                                         <div className="flex items-center gap-3 min-w-0">
                                           <div className="flex-shrink-0 h-8 w-8 rounded-full bg-green-100 flex items-center justify-center">
                                             <Upload className="h-3.5 w-3.5 text-green-600" />
                                           </div>
                                           <div className="min-w-0 text-left">
                                             <p className="text-sm font-medium text-gray-900 truncate">{f.name}</p>
                                             <p className="text-xs text-gray-500">{(f.size / 1024 / 1024).toFixed(2)} MB</p>
                                           </div>
                                         </div>
                                         <button type="button" onClick={(e) => { e.stopPropagation(); removeFile(idx); }}
                                           className="ml-3 flex-shrink-0 rounded-full p-1 text-gray-400 hover:bg-gray-200 hover:text-gray-600"
                                           aria-label={`Remove ${f.name}`}>
                                           <X className="h-4 w-4" />
                                         </button>
                                       </div>
                                     ))}
                                     <p className="text-xs text-gray-500 text-left">{uploadedFiles.length} of {MAX_FILES} attached</p>
                                   </div>
                                 )}
                               </div>

                               <div className="flex justify-between items-center pt-3 border-t border-gray-100">
                                 <Button type="button" variant="outline" onClick={() => goToStep(2, true)} className="h-11 inline-flex items-center gap-2">
                                   <ArrowLeft className="w-4 h-4" /> Back
                                 </Button>
                                  <Button type="button" onClick={() => goToStep(4)} className="bg-[#EB6A2C] hover:bg-[#D55A1F] text-white px-6 h-11 inline-flex items-center gap-2 font-semibold rounded-lg">
                                    Review claim <ArrowRight className="w-4 h-4" />
                                  </Button>
                               </div>
                             </div>
                           )}

                           {/* STEP 4: Review & submit */}
                           {currentStep === 4 && (
                             <div className="space-y-5 animate-fade-in">
                               <div>
                                 <h3 className="text-xl text-[#1A2B4A] text-left flex items-center gap-2.5"><span className="pro-step-num">4</span> Review &amp; submit</h3>
                                 <p className="text-sm text-gray-600 mt-1 text-left">Please double-check your details before submitting.</p>
                               </div>

                               <div className="rounded-xl border border-gray-200 divide-y divide-gray-100">
                                 {[
                                   { key: 'Name', value: formData.name || '-', step: 1 as const },
                                   { key: 'Email', value: formData.email || '-', step: 1 as const },
                                   { key: 'Phone', value: formData.phone || '-', step: 1 as const },
                                   { key: 'Vehicle', value: `${formData.vehicleReg.toUpperCase()}${vehicleDetails?.make ? ` · ${vehicleDetails.make} ${vehicleDetails.model || ''}` : ''}`.trim() || '-', step: 2 as const },
                                   { key: 'Mileage', value: formData.currentMileage ? `${formData.currentMileage.toLocaleString('en-GB')} miles` : '-', step: 2 as const },
                                   { key: 'Fault description', value: formData.faultDescription || '-', step: 3 as const },
                                   { key: 'When it occurred', value: formData.dateOccurred || '-', step: 3 as const },
                                   { key: 'When it happens', value: formData.issueTiming || '-', step: 3 as const },
                                   { key: 'Other details', value: formData.faultDetails || '-', step: 3 as const },
                                   { key: 'Attachments', value: uploadedFiles.length ? `${uploadedFiles.length} file${uploadedFiles.length > 1 ? 's' : ''} attached` : 'None', step: 3 as const },
                                 ].map((row) => (
                                   <div key={row.key} className="flex items-start justify-between gap-3 px-4 py-3">
                                     <span className="text-sm text-gray-500 flex-shrink-0">{row.key}</span>
                                     <div className="flex items-start gap-2 text-right max-w-[60%]">
                                       <span className="text-sm font-medium text-gray-900 break-words">{row.value}</span>
                                       <button type="button" onClick={() => goToStep(row.step, true)} className="text-xs text-orange-600 hover:text-orange-700 underline inline-flex items-center gap-0.5 flex-shrink-0">
                                         <Pencil className="w-3 h-3" /> Edit
                                       </button>
                                     </div>
                                   </div>
                                 ))}
                               </div>

                                 <div className="rounded-lg bg-orange-50 border border-orange-200 p-4 flex items-start gap-3">
                                   <Info className="w-5 h-5 text-orange-600 flex-shrink-0 mt-0.5" />
                                   <p className="text-sm text-gray-700 text-left">
                                     By submitting your claim, you confirm the details provided are accurate to the best of your knowledge and that you have read and understood the relevant policy and claims information.
                                   </p>
                                 </div>

                               <div className="flex justify-between items-center pt-3 border-t border-gray-100">
                                 <Button type="button" variant="outline" onClick={() => goToStep(3, true)} className="h-11 inline-flex items-center gap-2">
                                   <ArrowLeft className="w-4 h-4" /> Back
                                 </Button>
                                 <Button type="submit" disabled={isSubmitting}
                                   className="bg-[#EB6A2C] hover:bg-[#D55A1F] text-white px-6 h-11 rounded-lg inline-flex items-center gap-2 font-semibold shadow-md">
                                   {isSubmitting ? (
                                     <><Loader2 className="w-4 h-4 animate-spin" /> Submitting…</>
                                   ) : (
                                     <>Submit claim <ArrowRight className="w-4 h-4" /></>
                                   )}
                                 </Button>
                               </div>
                             </div>
                           )}
                         </form>
                       </div>
                     </>
                   )}
                 </div>

                {/* (illustration column removed for cleaner single-column layout) */}

              </div>
            </div>
          </div>
        </section>


        {/* Your repair limit explained */}
        <section className="py-12 lg:py-16 px-4 bg-white">
          <div className="max-w-2xl mx-auto">
            <p className="text-[11px] font-medium text-[#E8541A] uppercase tracking-[0.07em] mb-3 text-left">
              Your repair limit
            </p>
            <h2 className="pro-serif text-2xl lg:text-3xl text-[#1A2B4A] mb-4 text-left">
              Clear limits, no surprises
            </h2>
            <div className="space-y-3 text-[15px] text-[#5A6B82] leading-relaxed text-left">
              <p>
                Your maximum repair limit is clearly outlined in your warranty email and visible in your online account. If a repair exceeds your limit, you can simply top it up.
              </p>
              <p>
                In our experience, this situation is very rare - especially if you've selected a claim limit that suits your vehicle and driving habits.
              </p>
              <div className="bg-white border border-[#E2E8F0] rounded-2xl p-5 mt-4 flex items-center gap-3">
                <Check className="w-5 h-5 text-[#16A34A] flex-shrink-0" />
                <p className="text-[14px] text-[#1A2B4A] font-medium">
                  We cover what we promise - no hidden surprises.
                </p>
              </div>
            </div>
          </div>
        </section>

        {/* Contact us */}
        <section className="py-12 lg:py-16 px-4 bg-white">
          <div className="max-w-2xl mx-auto">
            <p className="text-[11px] font-medium text-[#E8541A] uppercase tracking-[0.07em] mb-3 text-left">
              Get in touch
            </p>
            <h2 className="pro-serif text-2xl lg:text-3xl text-[#1A2B4A] mb-5 text-left">
              Talk to our claims team
            </h2>
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
              <a
                href="mailto:claims@buyawarranty.co.uk"
                className="group block p-4 bg-white rounded-2xl border border-[#E2E8F0] hover:border-[#E8541A]/40 transition-colors"
              >
                <div className="flex items-center gap-3 mb-2">
                  <div className="w-10 h-10 bg-[#FEF0E8] rounded-[10px] flex items-center justify-center">
                    <Mail className="w-[18px] h-[18px] text-[#E8541A]" />
                  </div>
                  <div>
                    <div className="text-[14px] font-medium text-[#1A2B4A]">Email us</div>
                    <div className="text-[12px] text-[#5A6B82]">Send your claim details</div>
                  </div>
                </div>
                <p className="text-[14px] font-medium text-[#1A2B4A] break-all">claims@buyawarranty.co.uk</p>
              </a>

              <a
                href="tel:03302295045"
                className="group block p-4 bg-white rounded-2xl border border-[#E2E8F0] hover:border-[#E8541A]/40 transition-colors"
              >
                <div className="flex items-center gap-3 mb-2">
                  <div className="w-10 h-10 bg-[#FEF0E8] rounded-[10px] flex items-center justify-center">
                    <Phone className="w-[18px] h-[18px] text-[#E8541A]" />
                  </div>
                  <div>
                    <div className="text-[14px] font-medium text-[#1A2B4A]">Call us</div>
                    <div className="text-[12px] text-[#5A6B82]">Mon–Fri, 9am–5pm</div>
                  </div>
                </div>
                <p className="text-[14px] font-medium text-[#1A2B4A]">0330 229 5045</p>
              </a>
            </div>
          </div>
        </section>

      </div>

      {/* Success modal */}
      {showSuccessModal && (
        <div className="fixed inset-0 z-[100] flex items-center justify-center px-5 py-10 bg-black/50 backdrop-blur-sm animate-in fade-in duration-200">
          <div className="relative w-[90%] sm:w-full sm:max-w-[380px] bg-white rounded-2xl shadow-2xl p-6 sm:p-8 text-center animate-in zoom-in-95 duration-200">
            <button
              type="button"
              onClick={() => setShowSuccessModal(false)}
              aria-label="Close"
              className="absolute top-3 right-3 w-8 h-8 rounded-full flex items-center justify-center text-gray-400 hover:text-gray-700 hover:bg-gray-100 transition-colors"
            >
              <X className="w-4 h-4" />
            </button>
            <div className="mx-auto w-14 h-14 sm:w-16 sm:h-16 rounded-full bg-green-100 flex items-center justify-center mb-4">
              <Check className="w-7 h-7 sm:w-9 sm:h-9 text-green-600" strokeWidth={3} />
            </div>
            <h3 className="text-[18px] sm:text-[20px] font-semibold text-[#1A2B4A] mb-2">Claim submitted</h3>
            <p className="text-[13px] sm:text-[14px] text-[#5A6B82] leading-relaxed mb-6">
              Thank you. Our claims team will process your claim during working hours: Monday to Friday, 9am–5pm. You'll hear from us on the next working day.
            </p>
            <Button
              type="button"
              onClick={() => setShowSuccessModal(false)}
              className="w-full h-10 sm:h-11 bg-[#1A2B4A] hover:bg-[#15233D] text-white rounded-lg font-semibold"
            >
              Done
            </Button>
          </div>
        </div>
      )}
    </>
  );
};

export default Claims;