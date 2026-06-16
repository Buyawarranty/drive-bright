import React from 'react';
import { Phone, Mail, MessageCircle } from 'lucide-react';
import { Link } from 'react-router-dom';
import TrustpilotMicroWidget from '@/components/TrustpilotMicroWidget';

const BMWPPCFooter: React.FC = () => {
  return (
    <footer className="bg-white border-t border-gray-200 pt-12 pb-10">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
        {/* Contact / reassurance row */}
        <div className="text-center mb-10">
          <h2 className="text-xl font-bold text-gray-900 mb-3">
            Need advice? Have any questions?
          </h2>
          <div className="flex flex-col sm:flex-row items-center justify-center space-y-2 sm:space-y-0 sm:space-x-6">
            <a
              href="tel:03300532667"
              className="flex items-center text-sm font-semibold text-[#eb4b00] hover:text-[#d63f00] transition-colors"
            >
              <Phone className="w-4 h-4 mr-1.5" />
              Call us: 0330 053 2667
            </a>
            <a
              href="mailto:support@buyawarranty.co.uk"
              className="flex items-center text-sm font-semibold text-[#eb4b00] hover:text-[#d63f00] transition-colors"
            >
              <Mail className="w-4 h-4 mr-1.5" />
              support@buyawarranty.co.uk
            </a>
            <a
              href="https://wa.me/message/SPQPJ6O3UBF5B1"
              target="_blank"
              rel="noopener noreferrer"
              className="flex items-center text-sm font-semibold text-[#25D366] hover:text-[#20BA5A] transition-colors"
            >
              <MessageCircle className="w-4 h-4 mr-1.5" />
              WhatsApp Us
            </a>
          </div>
        </div>

        {/* 4 columns */}
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-8 mb-10">
          {/* Column 1: Buyawarranty */}
          <div className="text-left">
            <h3 className="text-lg font-bold text-gray-900 mb-4 text-left">Buyawarranty</h3>
            <p className="text-sm text-gray-600 leading-relaxed mb-4 text-left">
              Helping UK BMW owners protect their car from unexpected repair bills with flexible extended warranty cover designed for BMW models.
            </p>
            <div className="flex justify-start [&_*]:!justify-start [&_*]:!text-left">
              <TrustpilotMicroWidget />
            </div>
          </div>

          {/* Column 2: Help */}
          <div>
            <h3 className="text-lg font-bold text-gray-900 mb-4">Help</h3>
            <ul className="space-y-3 text-gray-600 text-sm">
              <li><a href="/faq/" className="hover:text-[#eb4b00] transition-colors">FAQs</a></li>
              <li><a href="/make-a-claim/" className="hover:text-[#eb4b00] transition-colors">Make a Claim</a></li>
              <li><a href="/contact-us/" className="hover:text-[#eb4b00] transition-colors">Contact Us</a></li>
              <li><a href="/customer-dashboard/" className="hover:text-[#eb4b00] transition-colors font-semibold">Customer Login</a></li>
            </ul>
          </div>

          {/* Column 3: Legal */}
          <div>
            <h3 className="text-lg font-bold text-gray-900 mb-4">Legal</h3>
            <ul className="space-y-3 text-gray-600 text-sm">
              <li><a href="/privacy/" className="hover:text-[#eb4b00] transition-colors">Privacy Policy</a></li>
              <li><a href="/terms/" className="hover:text-[#eb4b00] transition-colors">Terms &amp; Conditions</a></li>
              <li><a href="/cookies/" className="hover:text-[#eb4b00] transition-colors">Cookie Policy</a></li>
              <li><a href="/complaints/" className="hover:text-[#eb4b00] transition-colors">Complaints Procedure</a></li>
              <li><a href="/cancellation-policy/" className="hover:text-[#eb4b00] transition-colors">Cancellation Policy</a></li>
            </ul>
          </div>

          {/* Column 4: Contact */}
          <div>
            <h3 className="text-lg font-bold text-gray-900 mb-4">Contact</h3>
            <div className="space-y-3 text-sm text-gray-600">
              <div>
                <p className="font-semibold text-gray-900">Sales:</p>
                <a href="tel:03300532667" className="text-[#eb4b00] font-bold hover:underline">0330 053 2667</a>
              </div>
              <div>
                <p className="font-semibold text-gray-900">Claims:</p>
                <a href="tel:03302295045" className="text-[#eb4b00] font-bold hover:underline">0330 229 5045</a>
              </div>
            </div>
          </div>
        </div>

        {/* Combined trust + legal section */}
        <div className="text-center pt-6 border-t border-gray-200 max-w-4xl mx-auto">
          <p className="text-xs text-gray-600 leading-relaxed">
            Fast online quotes for BMW extended warranty cover and used BMW car warranties. Trusted BMW vehicle warranty protection for BMW 1 Series, 3 Series, 5 Series, 7 Series, X Series SUVs (X1, X3, X5, X7) and i Series EVs and hybrids (i3, i4, i7, iX). Cover levels and eligibility criteria apply. Buyawarranty.co.uk is a trading name of Buy A Warranty Limited, established 2016, registered in the United Kingdom under Company number 10314863, registered address: Warranty House, 62 Berkhamsted Ave, Wembley, HA9 6DT, England. Buyawarranty is an independent warranty provider and is not affiliated with BMW. Cover levels, limits, exclusions and eligibility criteria apply — please refer to your selected policy documents for full terms and conditions. © Buy a Warranty. All rights reserved.
          </p>
        </div>
      </div>
    </footer>
  );
};

export default BMWPPCFooter;
