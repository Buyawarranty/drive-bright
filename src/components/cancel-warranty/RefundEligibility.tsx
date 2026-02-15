import React from 'react';
import { Clock, CreditCard, Banknote, AlertTriangle, CheckCircle2, XCircle } from 'lucide-react';

const RefundEligibility: React.FC = () => {
  return (
    <section className="py-12 px-4">
      <div className="max-w-6xl mx-auto">
        <div className="text-center mb-10">
          <h2 className="text-3xl lg:text-4xl font-bold text-foreground mb-4">
            Refund eligibility
          </h2>
          <p className="text-lg text-muted-foreground max-w-2xl mx-auto">
            Clear and fair terms – here's exactly what to expect
          </p>
        </div>

        <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
          {/* Cooling-off Period Card */}
          <div className="bg-card border-2 border-success rounded-xl overflow-hidden shadow-sm">
            <div className="bg-success px-6 py-4">
              <div className="flex items-center gap-3">
                <Clock className="w-6 h-6 text-success-foreground" />
                <h3 className="text-lg font-bold text-success-foreground">Within 14-Day Cooling-Off</h3>
              </div>
            </div>
            <div className="p-6 space-y-4">
              <div className="flex items-start gap-3">
                <CheckCircle2 className="w-5 h-5 text-success flex-shrink-0 mt-0.5" />
                <p className="text-foreground">
                  <strong>Full refund</strong> if no claim has been submitted and no services used.
                </p>
              </div>
              <div className="flex items-start gap-3">
                <XCircle className="w-5 h-5 text-destructive flex-shrink-0 mt-0.5" />
                <p className="text-foreground">
                  <strong>No refund</strong> if a claim has been submitted (accepted, rejected, or pending).
                </p>
              </div>
              <div className="mt-4 pt-4 border-t border-border">
                <p className="text-sm text-muted-foreground">
                  ⏱️ Processed within <strong>5 working days</strong>
                </p>
              </div>
            </div>
          </div>

          {/* Pay in Full Card */}
          <div className="bg-card border-2 border-primary rounded-xl overflow-hidden shadow-sm">
            <div className="bg-primary px-6 py-4">
              <div className="flex items-center gap-3">
                <Banknote className="w-6 h-6 text-primary-foreground" />
                <h3 className="text-lg font-bold text-primary-foreground">After 14 days – Paid in full</h3>
              </div>
            </div>
            <div className="p-6 space-y-4">
              <p className="text-foreground font-medium mb-3">If no claim has been submitted:</p>
              <div className="space-y-2">
                <div className="flex items-start gap-2">
                  <span className="text-success">✔</span>
                  <span className="text-foreground">Pro-rata refund for unused full months</span>
                </div>
                <div className="flex items-start gap-2">
                  <span className="text-success">✔</span>
                  <span className="text-foreground">£40 fair usage fee applies</span>
                </div>
                <div className="flex items-start gap-2">
                  <span className="text-success">✔</span>
                  <span className="text-foreground">Minimum of 2 months' equivalent retained</span>
                </div>
              </div>
              <div className="mt-4 pt-4 border-t border-border">
                <div className="flex items-start gap-2">
                  <XCircle className="w-4 h-4 text-destructive flex-shrink-0 mt-0.5" />
                  <span className="text-muted-foreground text-sm">If any claim submitted: <strong>No refund applies</strong></span>
                </div>
              </div>
              <div className="pt-2">
                <p className="text-sm text-muted-foreground">
                  ⏱️ Processed within <strong>7 working days</strong>
                </p>
              </div>
            </div>
          </div>

          {/* Pay Monthly Card */}
          <div className="bg-card border-2 border-muted-foreground/30 rounded-xl overflow-hidden shadow-sm">
            <div className="bg-foreground px-6 py-4">
              <div className="flex items-center gap-3">
                <CreditCard className="w-6 h-6 text-background" />
                <h3 className="text-lg font-bold text-background">After 14 days – Paid monthly</h3>
              </div>
            </div>
            <div className="p-6 space-y-4">
              <div className="bg-primary/10 border border-primary/30 rounded-lg p-3 mb-4">
                <div className="flex items-start gap-2">
                  <AlertTriangle className="w-4 h-4 text-primary flex-shrink-0 mt-0.5" />
                  <p className="text-foreground text-sm">
                    <strong>Important:</strong> Cancelling your warranty doesn't automatically cancel your finance plan.
                  </p>
                </div>
              </div>
              <div className="space-y-2">
                <div className="flex items-start gap-2">
                  <span className="text-foreground">•</span>
                  <span className="text-foreground">Minimum 2 months' equivalent + £40 fee applies</span>
                </div>
              </div>
              <p className="text-foreground font-medium mt-3">If no claim has been submitted:</p>
              <div className="flex items-start gap-2">
                <span className="text-success">✔</span>
                <span className="text-foreground">Remaining balance refunded on a pro-rata basis via your finance provider</span>
              </div>
              <p className="text-sm text-success font-medium mt-2">
                💪 We will help you process this quickly and smoothly!
              </p>
            </div>
          </div>
        </div>

        {/* Claim Made Section */}
        <div className="mt-8 bg-secondary border-2 border-muted-foreground/20 rounded-xl p-6">
          <div className="flex items-start gap-4">
            <div className="w-12 h-12 bg-primary rounded-full flex items-center justify-center flex-shrink-0">
              <AlertTriangle className="w-6 h-6 text-primary-foreground" />
            </div>
            <div>
              <h3 className="text-xl font-bold text-foreground mb-2">What if a claim has been made?</h3>
              <p className="text-foreground mb-3">
                If a claim has been submitted – whether accepted, rejected, or pending – your warranty remains valid and active for the rest of the term.
              </p>
              <p className="text-foreground mb-3">
                Refunds do not apply once a claim has been made, because service has already been accessed.
              </p>
              <p className="text-muted-foreground italic">
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
