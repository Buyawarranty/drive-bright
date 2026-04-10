import React, { useState } from 'react';
import { Helmet } from 'react-helmet-async';
import { Input } from '@/components/ui/input';
import { Button } from '@/components/ui/button';
import { Label } from '@/components/ui/label';
import { ArrowRightLeft, Shield, CheckCircle, Loader2 } from 'lucide-react';
import { supabase } from '@/integrations/supabase/client';
import { toast } from 'sonner';
import Footer from '@/components/Footer';

const TRANSFER_FEE = 19.95;

const WarrantyTransfer = () => {
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [isComplete, setIsComplete] = useState(false);
  const [transferredTo, setTransferredTo] = useState('');

  const [formData, setFormData] = useState({
    regNumber: '',
    currentOwnerName: '',
    currentMileage: '',
    // New owner details
    firstName: '',
    lastName: '',
    email: '',
    phone: '',
    addressLine1: '',
    addressLine2: '',
    city: '',
    county: '',
    postcode: '',
  });

  const handleChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const { name, value } = e.target;
    if (name === 'regNumber') {
      setFormData(prev => ({ ...prev, [name]: value.toUpperCase().replace(/[^A-Z0-9 ]/g, '') }));
    } else if (name === 'currentMileage') {
      setFormData(prev => ({ ...prev, [name]: value.replace(/[^0-9]/g, '') }));
    } else {
      setFormData(prev => ({ ...prev, [name]: value }));
    }
  };

  const isValid = formData.regNumber && formData.currentOwnerName && formData.currentMileage
    && formData.firstName && formData.lastName && formData.email && formData.phone
    && formData.addressLine1 && formData.city && formData.postcode;

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!isValid || isSubmitting) return;

    setIsSubmitting(true);
    try {
      const { data, error } = await supabase.functions.invoke('create-stripe-checkout', {
        body: {
          planId: 'warranty-transfer',
          paymentType: 'one-off',
          finalAmount: TRANSFER_FEE,
          vehicleData: {
            regNumber: formData.regNumber,
            mileage: formData.currentMileage,
          },
          customerData: {
            email: formData.email,
            phone: formData.phone,
            first_name: formData.firstName,
            last_name: formData.lastName,
            address_line_1: formData.addressLine1,
            address_line_2: formData.addressLine2,
            city: formData.city,
            county: formData.county,
            postcode: formData.postcode,
          },
          protectionAddOns: {},
          claimLimit: 0,
          labourRate: 0,
          voluntaryExcess: 0,
        },
      });

      if (error) throw error;
      if (data?.url) {
        // Store transfer details for thank-you page
        sessionStorage.setItem('warrantyTransfer', JSON.stringify({
          regNumber: formData.regNumber,
          currentOwner: formData.currentOwnerName,
          newOwner: `${formData.firstName} ${formData.lastName}`,
          mileage: formData.currentMileage,
        }));
        window.location.href = data.url;
      } else {
        throw new Error('No checkout URL returned');
      }
    } catch (err: any) {
      console.error('Transfer checkout error:', err);
      toast.error(err.message || 'Failed to start payment. Please try again.');
    } finally {
      setIsSubmitting(false);
    }
  };

  if (isComplete) {
    return (
      <div className="min-h-screen bg-gray-50">
        <Helmet>
          <title>Transfer Confirmed - Buy a Warranty</title>
        </Helmet>
        <div className="max-w-xl mx-auto px-4 py-20 text-center">
          <CheckCircle className="h-16 w-16 text-emerald-500 mx-auto mb-6" />
          <h1 className="text-3xl font-bold text-gray-900 mb-4">Transfer Request Submitted</h1>
          <p className="text-lg text-gray-600 mb-2">
            Your warranty will be transferred to <span className="font-semibold text-gray-900">{transferredTo}</span>.
          </p>
          <p className="text-gray-500">Please allow 5-7 working days to process this transfer.</p>
          <a href="/" className="inline-block mt-8 text-[#eb4b00] hover:underline font-medium">Back to Home</a>
        </div>
        <Footer />
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gray-50">
      <Helmet>
        <title>Warranty Transfer - Buy a Warranty</title>
        <meta name="description" content="Transfer your Buy a Warranty vehicle warranty to a new owner for just £19.95. Quick and easy online process." />
      </Helmet>

      {/* Hero */}
      <section className="bg-[#2c5282] text-white py-16">
        <div className="max-w-4xl mx-auto px-4 text-center">
          <div className="inline-flex items-center justify-center w-16 h-16 bg-white/10 rounded-full mb-6">
            <ArrowRightLeft className="h-8 w-8 text-[#eb4b00]" />
          </div>
          <h1 className="text-3xl md:text-4xl font-bold mb-4">Transfer Your Warranty</h1>
          <p className="text-lg text-blue-100 max-w-2xl mx-auto">
            Selling your vehicle? Transfer your warranty to the new owner quickly and easily for just <span className="font-bold text-white">£19.95</span>.
          </p>
        </div>
      </section>

      {/* Form */}
      <section className="max-w-2xl mx-auto px-4 py-12">
        <div className="bg-white rounded-2xl shadow-sm border p-6 md:p-8">
          <form onSubmit={handleSubmit} className="space-y-8">
            {/* Current Vehicle Info */}
            <div>
              <h2 className="text-xl font-bold text-gray-900 mb-1">Current Vehicle &amp; Owner</h2>
              <p className="text-sm text-gray-500 mb-4">Details of the vehicle being transferred.</p>
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div>
                  <Label htmlFor="regNumber">Registration Plate *</Label>
                  <Input id="regNumber" name="regNumber" placeholder="e.g. AB12 CDE" value={formData.regNumber} onChange={handleChange} className="h-14 rounded-xl bg-[#F5F5F5] text-lg font-semibold tracking-wider uppercase" required />
                </div>
                <div>
                  <Label htmlFor="currentOwnerName">Current Owner Name *</Label>
                  <Input id="currentOwnerName" name="currentOwnerName" placeholder="Full name" value={formData.currentOwnerName} onChange={handleChange} className="h-14 rounded-xl bg-[#F5F5F5]" required />
                </div>
                <div className="md:col-span-2">
                  <Label htmlFor="currentMileage">Current Mileage *</Label>
                  <Input id="currentMileage" name="currentMileage" placeholder="e.g. 45000" value={formData.currentMileage} onChange={handleChange} className="h-14 rounded-xl bg-[#F5F5F5]" required />
                </div>
              </div>
            </div>

            <hr className="border-gray-200" />

            {/* New Owner Details */}
            <div>
              <h2 className="text-xl font-bold text-gray-900 mb-1">New Owner Details</h2>
              <p className="text-sm text-gray-500 mb-4">The warranty will be transferred to this person.</p>
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div>
                  <Label htmlFor="firstName">First Name *</Label>
                  <Input id="firstName" name="firstName" placeholder="First name" value={formData.firstName} onChange={handleChange} className="h-14 rounded-xl bg-[#F5F5F5]" required />
                </div>
                <div>
                  <Label htmlFor="lastName">Last Name *</Label>
                  <Input id="lastName" name="lastName" placeholder="Last name" value={formData.lastName} onChange={handleChange} className="h-14 rounded-xl bg-[#F5F5F5]" required />
                </div>
                <div>
                  <Label htmlFor="email">Email Address *</Label>
                  <Input id="email" name="email" type="email" placeholder="email@example.com" value={formData.email} onChange={handleChange} className="h-14 rounded-xl bg-[#F5F5F5]" required />
                </div>
                <div>
                  <Label htmlFor="phone">Phone Number *</Label>
                  <Input id="phone" name="phone" type="tel" placeholder="07xxx xxxxxx" value={formData.phone} onChange={handleChange} className="h-14 rounded-xl bg-[#F5F5F5]" required />
                </div>
                <div className="md:col-span-2">
                  <Label htmlFor="addressLine1">Address Line 1 *</Label>
                  <Input id="addressLine1" name="addressLine1" placeholder="Street address" value={formData.addressLine1} onChange={handleChange} className="h-14 rounded-xl bg-[#F5F5F5]" required />
                </div>
                <div className="md:col-span-2">
                  <Label htmlFor="addressLine2">Address Line 2</Label>
                  <Input id="addressLine2" name="addressLine2" placeholder="Flat, suite, etc. (optional)" value={formData.addressLine2} onChange={handleChange} className="h-14 rounded-xl bg-[#F5F5F5]" />
                </div>
                <div>
                  <Label htmlFor="city">City / Town *</Label>
                  <Input id="city" name="city" placeholder="City" value={formData.city} onChange={handleChange} className="h-14 rounded-xl bg-[#F5F5F5]" required />
                </div>
                <div>
                  <Label htmlFor="county">County</Label>
                  <Input id="county" name="county" placeholder="County (optional)" value={formData.county} onChange={handleChange} className="h-14 rounded-xl bg-[#F5F5F5]" />
                </div>
                <div>
                  <Label htmlFor="postcode">Postcode *</Label>
                  <Input id="postcode" name="postcode" placeholder="e.g. SW1A 1AA" value={formData.postcode} onChange={handleChange} className="h-14 rounded-xl bg-[#F5F5F5]" required />
                </div>
              </div>
            </div>

            <hr className="border-gray-200" />

            {/* Payment Summary */}
            <div className="bg-gray-50 rounded-xl p-5">
              <div className="flex items-center justify-between mb-3">
                <span className="text-gray-700 font-medium">Warranty Transfer Fee</span>
                <span className="text-2xl font-bold text-gray-900">£{TRANSFER_FEE.toFixed(2)}</span>
              </div>
              <div className="flex items-start gap-2 text-sm text-gray-500">
                <Shield className="h-4 w-4 mt-0.5 text-[#2c5282] flex-shrink-0" />
                <span>Secure payment via Stripe. Your warranty will be transferred to the new owner within 5-7 working days.</span>
              </div>
            </div>

            <Button
              type="submit"
              disabled={!isValid || isSubmitting}
              className="w-full h-14 rounded-xl text-lg font-semibold bg-[#eb4b00] hover:bg-[#d44300] text-white"
            >
              {isSubmitting ? (
                <><Loader2 className="h-5 w-5 animate-spin mr-2" /> Processing...</>
              ) : (
                <>Pay £{TRANSFER_FEE.toFixed(2)} &amp; Submit Transfer</>
              )}
            </Button>
          </form>
        </div>
      </section>

      <Footer />
    </div>
  );
};

export default WarrantyTransfer;
