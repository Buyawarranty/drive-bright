import React from 'react';
import { Phone, Mail } from 'lucide-react';

const MinimalLandingFooter: React.FC = () => {
  return (
    <footer className="bg-gray-100 py-6">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
        <div className="flex flex-col sm:flex-row items-center justify-between gap-3 text-sm">
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
    </footer>
  );
};

export default MinimalLandingFooter;
