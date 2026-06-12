import React from 'react';
import { Phone, Mail } from 'lucide-react';

const MinimalLandingFooter: React.FC = () => {
  return (
    <footer className="bg-gray-100 py-6">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
        <div className="flex flex-col items-center gap-4 text-sm">
          <div className="text-center bg-white border border-gray-200 rounded-xl px-5 py-5 max-w-xl w-full">
            <h3 className="text-sm font-bold text-gray-900 mb-1">
              Like our content? Follow us on Google
            </h3>
            <p className="text-xs text-gray-600 mb-3 max-w-sm mx-auto">
              Add Buyawarranty as a preferred source for more warranty advice in your Google results.
            </p>
            <a
              href="https://www.google.com/preferences/source?q=buyawarranty.co.uk"
              target="_blank"
              rel="noopener noreferrer"
              className="inline-flex items-center gap-2 bg-[#eb4b00] hover:bg-[#d63f00] text-white font-semibold px-5 py-2.5 rounded-lg transition-colors text-sm"
            >
              <svg className="w-4 h-4" viewBox="0 0 24 24" fill="currentColor" aria-hidden="true">
                <path d="M21.35 11.1H12v3.2h5.35c-.5 2.4-2.55 3.7-5.35 3.7-3.25 0-5.9-2.65-5.9-5.9s2.65-5.9 5.9-5.9c1.5 0 2.85.55 3.9 1.45l2.4-2.4C16.55 3.7 14.4 2.85 12 2.85 6.95 2.85 2.85 6.95 2.85 12s4.1 9.15 9.15 9.15c5.3 0 8.8-3.7 8.8-8.9 0-.4-.05-.8-.1-1.15z"/>
              </svg>
              Add to Google
            </a>
          </div>
          <div className="flex flex-col sm:flex-row items-center justify-between gap-3 w-full">
            <div className="flex items-center gap-4">
              <a href="tel:03302295040" className="flex items-center gap-1.5 text-gray-700 hover:text-gray-900 transition-colors font-medium">
                <Phone className="w-4 h-4" />
                0330 229 5040
              </a>
              <a href="mailto:support@buyawarranty.co.uk" className="flex items-center gap-1.5 text-gray-600 hover:text-gray-900 transition-colors">
                <Mail className="w-4 h-4" />
                support@buyawarranty.co.uk
              </a>
            </div>
            <p className="text-gray-500 text-xs">
              © {new Date().getFullYear()} Buy A Warranty. All rights reserved.
            </p>
          </div>
        </div>
      </div>
    </footer>
  );
};

export default MinimalLandingFooter;
