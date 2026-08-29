import React from 'react';
import { Link } from 'react-router-dom';
import { CheckCircle2, Phone, Mail, ShieldCheck } from 'lucide-react';
import { OptimizedImage } from '@/components/OptimizedImage';
import buyawarrantyLogo from '@/assets/buyawarranty-logo.webp';
import TrustpilotMicroWidget from '@/components/TrustpilotMicroWidget';
import { CLAIMS_PHONE, CLAIMS_PHONE_TEL, CLAIMS_EMAIL } from '@/constants/contact';

/**
 * Landing page customers return to after paying the inspection fee on
 * Worldpay's hosted payment page (Pay by Link). Public — no token needed.
 */
const InspectionThankYou: React.FC = () => {
  return (
    <div className="min-h-screen bg-[#F4F6F8] flex flex-col">
      <header className="bg-white border-b border-[#E2E8F0]">
        <div className="max-w-6xl mx-auto px-4 sm:px-6 py-3 flex items-center justify-between gap-4">
          <Link to="/" className="flex items-center">
            <OptimizedImage src={buyawarrantyLogo} alt="Buy a Warranty" className="h-8 sm:h-10 w-auto" />
          </Link>
          <a
            href={CLAIMS_PHONE_TEL}
            className="inline-flex items-center gap-2 rounded-full bg-white border border-[#E2E8F0] px-3 py-1.5 text-xs sm:text-sm font-semibold text-[#1A2B4A] shadow-sm"
          >
            <Phone className="h-3.5 w-3.5 text-[#E8541A]" />
            {CLAIMS_PHONE}
          </a>
        </div>
      </header>

      <main className="flex-1 flex items-center justify-center p-4 sm:p-8">
        <div className="max-w-lg w-full bg-white rounded-2xl shadow-sm border border-[#E2E8F0] p-6 sm:p-10 text-center space-y-4">
          <div className="w-16 h-16 rounded-full bg-green-50 flex items-center justify-center mx-auto">
            <CheckCircle2 className="h-9 w-9 text-[#00B67A]" />
          </div>
          <h1 className="text-2xl font-bold text-[#1A2B4A]">Thank you — payment received</h1>
          <p className="text-sm sm:text-base text-slate-600 leading-relaxed">
            Your payment has been received for the independent vehicle inspection.
          </p>
          <div className="rounded-xl border border-[#E2E8F0] bg-[#F4F6F8] p-4 text-sm text-slate-600 space-y-2 text-left">
            <p className="font-semibold text-[#1A2B4A]">What happens next</p>
            <ul className="list-disc pl-5 space-y-1.5">
              <li>The independent inspection company will contact the garage directly to arrange the visit.</li>
              <li>Inspections take on average 7 to 14 working days to complete.</li>
              <li>We'll be in touch as soon as the engineer's report is available.</li>
            </ul>
          </div>
          <div className="flex items-center justify-center gap-2 text-xs text-slate-600">
            <ShieldCheck className="h-4 w-4 text-[#00B67A]" />
            <span>Independent, impartial engineer · FCA-regulated claims process</span>
          </div>
          <TrustpilotMicroWidget className="pt-1" />
          <p className="text-sm text-slate-600 pt-2">
            Questions? Call our claims team on{' '}
            <a href={CLAIMS_PHONE_TEL} className="font-semibold text-[#E8541A]">
              {CLAIMS_PHONE}
            </a>{' '}
            or email{' '}
            <a href={`mailto:${CLAIMS_EMAIL}`} className="font-semibold text-[#E8541A]">
              {CLAIMS_EMAIL}
            </a>
            .
          </p>
        </div>
      </main>

      <footer className="bg-white border-t border-[#E2E8F0]">
        <div className="max-w-6xl mx-auto px-4 sm:px-6 py-6 text-center text-sm text-slate-600">
          Buy a Warranty Claims Department
        </div>
      </footer>
    </div>
  );
};

export default InspectionThankYou;
