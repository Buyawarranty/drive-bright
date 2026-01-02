import React, { useState } from 'react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { useToast } from '@/hooks/use-toast';
import { supabase } from '@/integrations/supabase/client';
import { Send, MessageSquare } from 'lucide-react';

interface CancellationFormProps {
  onSuccess: (data: { registrationPlate: string; fullName: string }) => void;
}

const CancellationForm: React.FC<CancellationFormProps> = ({ onSuccess }) => {
  const { toast } = useToast();
  
  const [formData, setFormData] = useState({
    registrationPlate: '',
    fullName: '',
    email: '',
    reason: '',
    feedback: '',
    exceptionalCircumstances: ''
  });
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [errors, setErrors] = useState<Record<string, string>>({});

  const handleInputChange = (e: React.ChangeEvent<HTMLInputElement | HTMLTextAreaElement>) => {
    const { name, value } = e.target;
    setFormData({ ...formData, [name]: value });
    if (errors[name]) {
      setErrors({ ...errors, [name]: '' });
    }
  };

  const handleReasonChange = (value: string) => {
    setFormData({ ...formData, reason: value });
    if (errors.reason) {
      setErrors({ ...errors, reason: '' });
    }
  };

  const validateRegistrationPlate = (plate: string): boolean => {
    // Remove spaces and convert to uppercase for validation
    const cleanPlate = plate.replace(/\s/g, '').toUpperCase();
    
    // UK registration plate formats:
    // Current format (2001+): AB12 CDE (2 letters, 2 numbers, 3 letters)
    // Prefix format (1983-2001): A123 BCD (1 letter, 1-3 numbers, 3 letters)
    // Suffix format (1963-1983): ABC 123A (3 letters, 1-3 numbers, 1 letter)
    // Dateless format: Various combinations
    
    const currentFormat = /^[A-Z]{2}[0-9]{2}[A-Z]{3}$/;
    const prefixFormat = /^[A-Z][0-9]{1,3}[A-Z]{3}$/;
    const suffixFormat = /^[A-Z]{3}[0-9]{1,3}[A-Z]$/;
    const datelessFormat1 = /^[A-Z]{1,3}[0-9]{1,4}$/;
    const datelessFormat2 = /^[0-9]{1,4}[A-Z]{1,3}$/;
    
    return (
      currentFormat.test(cleanPlate) ||
      prefixFormat.test(cleanPlate) ||
      suffixFormat.test(cleanPlate) ||
      datelessFormat1.test(cleanPlate) ||
      datelessFormat2.test(cleanPlate)
    );
  };

  const validateEmail = (email: string): boolean => {
    // More comprehensive email validation
    const emailRegex = /^[a-zA-Z0-9.!#$%&'*+/=?^_`{|}~-]+@[a-zA-Z0-9](?:[a-zA-Z0-9-]{0,61}[a-zA-Z0-9])?(?:\.[a-zA-Z0-9](?:[a-zA-Z0-9-]{0,61}[a-zA-Z0-9])?)+$/;
    return emailRegex.test(email.trim());
  };

  const validateForm = (): boolean => {
    const newErrors: Record<string, string> = {};
    
    if (!formData.registrationPlate.trim()) {
      newErrors.registrationPlate = 'Registration plate is required';
    } else if (!validateRegistrationPlate(formData.registrationPlate)) {
      newErrors.registrationPlate = 'Please enter a valid UK registration plate (e.g., AB12 CDE)';
    }
    
    if (!formData.fullName.trim()) {
      newErrors.fullName = 'Full name is required';
    } else if (formData.fullName.trim().length < 2) {
      newErrors.fullName = 'Please enter your full name';
    }
    
    if (!formData.email.trim()) {
      newErrors.email = 'Email is required';
    } else if (!validateEmail(formData.email)) {
      newErrors.email = 'Please enter a valid email address';
    }
    
    if (!formData.reason) {
      newErrors.reason = 'Please select a reason';
    }
    
    setErrors(newErrors);
    return Object.keys(newErrors).length === 0;
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    
    if (!validateForm()) {
      toast({
        title: "Please check your information",
        description: "Please fill in all required fields.",
        variant: "destructive",
      });
      return;
    }

    setIsSubmitting(true);
    
    try {
      const feedbackMessage = [
        formData.feedback,
        formData.exceptionalCircumstances ? `\n\nExceptional Circumstances: ${formData.exceptionalCircumstances}` : '',
        `\n\nCustomer Email: ${formData.email}`
      ].join('');

      const response = await supabase.functions.invoke('submit-cancellation', {
        body: {
          registrationPlate: formData.registrationPlate,
          fullName: formData.fullName,
          reason: formData.reason,
          feedback: feedbackMessage
        }
      });

      if (response.error) {
        throw new Error(response.error.message || 'Failed to submit cancellation request');
      }

      onSuccess({
        registrationPlate: formData.registrationPlate,
        fullName: formData.fullName
      });
      
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

  const cancellationReasons = [
    { value: 'sold-vehicle', label: 'Sold the vehicle' },
    { value: 'too-expensive', label: 'Too expensive' },
    { value: 'no-longer-needed', label: 'No longer needed' },
    { value: 'not-using-vehicle', label: 'Not using the vehicle' },
    { value: 'found-better-deal', label: 'Found a better deal elsewhere' },
    { value: 'financial-hardship', label: 'Financial hardship' },
    { value: 'moving-abroad', label: 'Moving abroad' },
    { value: 'other', label: 'Other reason' }
  ];

  return (
    <div className="bg-card rounded-2xl shadow-lg border border-border overflow-hidden">
      <div className="bg-foreground px-6 py-4">
        <div className="flex items-center gap-3">
          <Send className="w-6 h-6 text-background" />
          <h3 className="text-xl font-bold text-background">Cancellation Request Form</h3>
        </div>
        <p className="text-background/70 text-sm mt-1">We'll confirm your request within 2 working days</p>
      </div>

      <form onSubmit={handleSubmit} className="p-6 space-y-5">
        {/* Registration Plate */}
        <div>
          <Label htmlFor="registrationPlate" className="text-foreground font-medium flex items-center gap-2">
            🚗 Registration Plate <span className="text-destructive">*</span>
          </Label>
          <Input
            id="registrationPlate"
            name="registrationPlate"
            value={formData.registrationPlate}
            onChange={handleInputChange}
            placeholder="e.g., AB12 CDE"
            className={`mt-1.5 h-11 ${errors.registrationPlate ? 'border-destructive' : ''}`}
          />
          {errors.registrationPlate && <p className="mt-1 text-sm text-destructive">{errors.registrationPlate}</p>}
        </div>

        {/* Full Name */}
        <div>
          <Label htmlFor="fullName" className="text-foreground font-medium flex items-center gap-2">
            👤 Full Name <span className="text-destructive">*</span>
          </Label>
          <Input
            id="fullName"
            name="fullName"
            value={formData.fullName}
            onChange={handleInputChange}
            placeholder="Your full name"
            className={`mt-1.5 h-11 ${errors.fullName ? 'border-destructive' : ''}`}
          />
          {errors.fullName && <p className="mt-1 text-sm text-destructive">{errors.fullName}</p>}
        </div>

        {/* Email */}
        <div>
          <Label htmlFor="email" className="text-foreground font-medium flex items-center gap-2">
            📧 Email Address <span className="text-destructive">*</span>
          </Label>
          <Input
            id="email"
            name="email"
            type="email"
            value={formData.email}
            onChange={handleInputChange}
            placeholder="your@email.com"
            className={`mt-1.5 h-11 ${errors.email ? 'border-destructive' : ''}`}
          />
          {errors.email && <p className="mt-1 text-sm text-destructive">{errors.email}</p>}
        </div>

        {/* Reason */}
        <div>
          <Label htmlFor="reason" className="text-foreground font-medium flex items-center gap-2">
            ❓ Reason for Cancellation <span className="text-destructive">*</span>
          </Label>
          <Select onValueChange={handleReasonChange} value={formData.reason}>
            <SelectTrigger className={`mt-1.5 h-11 ${errors.reason ? 'border-destructive' : ''}`}>
              <SelectValue placeholder="Select a reason" />
            </SelectTrigger>
            <SelectContent className="bg-card">
              {cancellationReasons.map((reason) => (
                <SelectItem key={reason.value} value={reason.value}>
                  {reason.label}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
          {errors.reason && <p className="mt-1 text-sm text-destructive">{errors.reason}</p>}
        </div>

        {/* Feedback */}
        <div className="bg-secondary rounded-lg p-4">
          <Label htmlFor="feedback" className="text-foreground font-bold flex items-center gap-2 mb-2">
            <MessageSquare className="w-4 h-4" />
            Share your feedback (optional)
          </Label>
          <p className="text-sm text-muted-foreground mb-3">
            Your honest feedback helps us improve – and it won't affect your refund.
          </p>
          <Textarea
            id="feedback"
            name="feedback"
            value={formData.feedback}
            onChange={handleInputChange}
            placeholder="What could we have done better?"
            rows={3}
            className="bg-card"
          />
        </div>

        {/* Exceptional Circumstances */}
        <div className="bg-primary/10 rounded-lg p-4 border border-primary/30">
          <Label htmlFor="exceptionalCircumstances" className="text-foreground font-bold mb-2 block">
            💬 Exceptional circumstances?
          </Label>
          <p className="text-sm text-muted-foreground mb-3">
            Life can be unpredictable. If you believe your situation deserves special consideration, please share details and we'll review your case.
          </p>
          <Textarea
            id="exceptionalCircumstances"
            name="exceptionalCircumstances"
            value={formData.exceptionalCircumstances}
            onChange={handleInputChange}
            placeholder="Tell us about any exceptional circumstances (optional)"
            rows={2}
            className="bg-card"
          />
        </div>

        {/* Submit Button */}
        <Button
          type="submit"
          disabled={isSubmitting}
          className="w-full h-12 bg-foreground hover:bg-foreground/90 text-background font-semibold text-lg"
        >
          {isSubmitting ? 'Submitting...' : 'Submit Cancellation Request'}
        </Button>

        <p className="text-center text-sm text-muted-foreground">
          We'll review your request and respond within 2 working days.
        </p>
      </form>
    </div>
  );
};

export default CancellationForm;
