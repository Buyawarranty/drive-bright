import React from 'react';
import { CheckCircle, Clock, Phone, Mail } from 'lucide-react';
import { Card, CardContent } from '@/components/ui/card';
import { Helmet } from 'react-helmet-async';

const PaymentReceived = () => {
  const params = new URLSearchParams(window.location.search);
  const customerName = params.get('first_name') || 'there';
  const vehicleReg = params.get('vehicle_reg') || '';
  const vehicleMake = params.get('vehicle_make') || '';
  const vehicleModel = params.get('vehicle_model') || '';
  const amount = params.get('final_amount') || '';
  const paymentMethod = params.get('source') || params.get('payment') || '';

  return (
    <>
      <Helmet>
        <title>Payment Received | Buy a Warranty</title>
        <meta name="robots" content="noindex, nofollow" />
      </Helmet>
      
      <div className="min-h-screen bg-gradient-to-b from-green-50 to-white flex items-center justify-center p-4">
        <div className="max-w-lg w-full space-y-6">
          {/* Success Icon */}
          <div className="text-center">
            <div className="inline-flex items-center justify-center w-20 h-20 rounded-full bg-green-100 mb-4">
              <CheckCircle className="w-10 h-10 text-green-600" />
            </div>
            <h1 className="text-2xl sm:text-3xl font-bold text-gray-900">
              Payment Received!
            </h1>
            <p className="text-gray-600 mt-2">
              Thank you{customerName !== 'there' ? `, ${customerName}` : ''}. Your payment has been successfully processed.
            </p>
          </div>

          {/* Vehicle & Amount Summary */}
          {(vehicleReg || amount) && (
            <Card className="border-green-200 bg-green-50/50">
              <CardContent className="pt-6">
                <div className="grid grid-cols-2 gap-4 text-sm">
                  {vehicleReg && (
                    <div>
                      <span className="text-gray-500">Vehicle</span>
                      <div className="font-semibold text-gray-900">
                        {vehicleReg}
                        {vehicleMake && ` - ${vehicleMake}`}
                        {vehicleModel && ` ${vehicleModel}`}
                      </div>
                    </div>
                  )}
                  {amount && (
                    <div>
                      <span className="text-gray-500">Amount Paid</span>
                      <div className="font-semibold text-gray-900">£{amount}</div>
                    </div>
                  )}
                  {paymentMethod && (
                    <div>
                      <span className="text-gray-500">Payment Method</span>
                      <div className="font-semibold text-gray-900 capitalize">{paymentMethod}</div>
                    </div>
                  )}
                </div>
              </CardContent>
            </Card>
          )}

          {/* What Happens Next */}
          <Card className="border-amber-200 bg-amber-50/80">
            <CardContent className="pt-6">
              <div className="flex items-start gap-3">
                <Clock className="w-6 h-6 text-amber-600 flex-shrink-0 mt-0.5" />
                <div>
                  <h2 className="font-semibold text-amber-900 text-lg">What happens next?</h2>
                  <ul className="mt-3 space-y-3 text-sm text-amber-800">
                    <li className="flex items-start gap-2">
                      <span className="font-bold text-amber-600 mt-0.5">1.</span>
                      <span>Our team is now reviewing your details to ensure everything is correct.</span>
                    </li>
                    <li className="flex items-start gap-2">
                      <span className="font-bold text-amber-600 mt-0.5">2.</span>
                      <span>Once confirmed, your warranty will be activated and you will receive a <strong>welcome email</strong> with your policy details and login credentials.</span>
                    </li>
                    <li className="flex items-start gap-2">
                      <span className="font-bold text-amber-600 mt-0.5">3.</span>
                      <span>This usually takes less than <strong>1 working hour</strong> during business hours.</span>
                    </li>
                  </ul>
                </div>
              </div>
            </CardContent>
          </Card>

          {/* Contact Info */}
          <Card>
            <CardContent className="pt-6">
              <p className="text-sm text-gray-600 mb-3">
                If you have any questions, feel free to contact us:
              </p>
              <div className="flex flex-col sm:flex-row gap-3 text-sm">
                <a 
                  href="tel:01onal011234567890" 
                  className="flex items-center gap-2 text-primary hover:underline"
                >
                  <Phone className="w-4 h-4" />
                  Call Us
                </a>
                <a 
                  href="mailto:info@buyawarranty.co.uk" 
                  className="flex items-center gap-2 text-primary hover:underline"
                >
                  <Mail className="w-4 h-4" />
                  info@buyawarranty.co.uk
                </a>
              </div>
            </CardContent>
          </Card>

          <p className="text-center text-xs text-gray-400">
            You can safely close this page. We will email you once your warranty is confirmed.
          </p>
        </div>
      </div>
    </>
  );
};

export default PaymentReceived;
