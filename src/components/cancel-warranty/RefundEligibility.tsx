import React from 'react';
import { Clock, CreditCard, Banknote, AlertTriangle, CheckCircle2, XCircle } from 'lucide-react';

const RefundEligibility: React.FC = () => {
  return (
    <section className="py-12 px-4">
      <div className="max-w-6xl mx-auto">
        <div className="text-center mb-10">
          <h2 className="text-3xl lg:text-4xl font-bold text-gray-900 mb-4">
            Refund eligibility
          </h2>
          <p className="text-lg text-gray-600 max-w-2xl mx-auto">
            Clear and fair terms – here's exactly what to expect
          </p>
        </div>

        <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
          {/* Cooling-off Period Card */}
          <div className="bg-white border-2 border-green-400 rounded-xl overflow-hidden shadow-sm">
            <div className="bg-green-500 px-6 py-4">
              <div className="flex items-center gap-3">
                <Clock className="w-6 h-6 text-white" />
                <h3 className="text-lg font-bold text-white">Within 14-Day Cooling-Off</h3>
              </div>
            </div>
            <div className="p-6 space-y-4">
              <div className="flex items-start gap-3">
                <CheckCircle2 className="w-5 h-5 text-green-500 flex-shrink-0 mt-0.5" />
                <p className="text-gray-700">
                  <strong>Full refund</strong> if no claim has been submitted and no services used.
                </p>
              </div>
              <div className="flex items-start gap-3">
                <XCircle className="w-5 h-5 text-red-500 flex-shrink-0 mt-0.5" />
                <p className="text-gray-700">
                  <strong>No refund</strong> if a claim has been submitted (accepted, rejected, or pending).
                </p>
              </div>
              <div className="mt-4 pt-4 border-t border-gray-200">
                <p className="text-sm text-gray-500">
                  ⏱️ Processed within <strong>5 working days</strong>
                </p>
              </div>
            </div>
          </div>

          {/* Pay in Full Card */}
          <div className="bg-white border-2 border-blue-400 rounded-xl overflow-hidden shadow-sm">
            <div className="bg-blue-500 px-6 py-4">
              <div className="flex items-center gap-3">
                <Banknote className="w-6 h-6 text-white" />
                <h3 className="text-lg font-bold text-white">After 14 days – Paid in full</h3>
              </div>
            </div>
            <div className="p-6 space-y-4">
              <p className="text-gray-700 font-medium mb-3">If no claim has been submitted:</p>
              <div className="space-y-2">
                <div className="flex items-start gap-2">
                  <span className="text-green-500">✔</span>
                  <span className="text-gray-700">Pro-rata refund for unused full months</span>
                </div>
                <div className="flex items-start gap-2">
                  <span className="text-green-500">✔</span>
                  <span className="text-gray-700">£40 fair usage fee applies</span>
                </div>
                <div className="flex items-start gap-2">
                  <span className="text-green-500">✔</span>
                  <span className="text-gray-700">Minimum of 2 months' equivalent retained</span>
                </div>
              </div>
              <div className="mt-4 pt-4 border-t border-gray-200">
                <div className="flex items-start gap-2">
                  <XCircle className="w-4 h-4 text-red-500 flex-shrink-0 mt-0.5" />
                  <span className="text-gray-600 text-sm">If any claim submitted: <strong>No refund applies</strong></span>
                </div>
              </div>
              <div className="pt-2">
                <p className="text-sm text-gray-500">
                  ⏱️ Processed within <strong>7 working days</strong>
                </p>
              </div>
            </div>
          </div>

          {/* Pay Monthly Card */}
          <div className="bg-white border-2 border-purple-400 rounded-xl overflow-hidden shadow-sm">
            <div className="bg-purple-500 px-6 py-4">
              <div className="flex items-center gap-3">
                <CreditCard className="w-6 h-6 text-white" />
                <h3 className="text-lg font-bold text-white">After 14 days – Paid monthly</h3>
              </div>
            </div>
            <div className="p-6 space-y-4">
              <div className="bg-amber-50 border border-amber-200 rounded-lg p-3 mb-4">
                <div className="flex items-start gap-2">
                  <AlertTriangle className="w-4 h-4 text-amber-600 flex-shrink-0 mt-0.5" />
                  <p className="text-amber-800 text-sm">
                    <strong>Important:</strong> Cancelling your warranty does not cancel your finance agreement.
                  </p>
                </div>
              </div>
              <div className="space-y-2">
                <div className="flex items-start gap-2">
                  <span className="text-purple-500">•</span>
                  <span className="text-gray-700">Minimum 2 months' equivalent + £40 fee applies</span>
                </div>
              </div>
              <p className="text-gray-700 font-medium mt-3">If no claim has been submitted:</p>
              <div className="flex items-start gap-2">
                <span className="text-green-500">✔</span>
                <span className="text-gray-700">Remaining balance refunded on a pro-rata basis via your finance provider</span>
              </div>
              <p className="text-sm text-green-600 font-medium mt-2">
                💪 We will help you process this quickly and smoothly!
              </p>
            </div>
          </div>
        </div>

        {/* Claim Made Section */}
        <div className="mt-8 bg-amber-50 border-2 border-amber-300 rounded-xl p-6">
          <div className="flex items-start gap-4">
            <div className="w-12 h-12 bg-amber-400 rounded-full flex items-center justify-center flex-shrink-0">
              <AlertTriangle className="w-6 h-6 text-white" />
            </div>
            <div>
              <h3 className="text-xl font-bold text-gray-900 mb-2">What if a claim has been made?</h3>
              <p className="text-gray-700 mb-3">
                If a claim has been submitted – whether accepted, rejected, or pending – your warranty remains valid and active for the rest of the term.
              </p>
              <p className="text-gray-700 mb-3">
                Refunds do not apply once a claim has been made, because service has already been accessed.
              </p>
              <p className="text-gray-600 italic">
                We understand this can be disappointing; your protection continues for future issues. If you believe your situation deserves special consideration, please tell us – we're here to help.
              </p>
            </div>
          </div>
        </div>
      </div>
    </section>
  );
};

export default RefundEligibility;
