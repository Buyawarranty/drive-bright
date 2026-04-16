import React from 'react';
import { Link } from 'react-router-dom';
import { Button } from '@/components/ui/button';
import { Phone } from 'lucide-react';

export const DealerPublicHeader: React.FC = () => {
  return (
    <header className="bg-gray-900 border-b border-gray-800 sticky top-0 z-50">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
        <div className="flex items-center justify-between h-14 sm:h-16">
          <div className="flex items-center">
            <Link to="/dealer-portal/" className="hover:opacity-80 transition-opacity">
              <img src="/lovable-uploads/53652a24-3961-4346-bf9d-6588ef727aeb.png" alt="Buy a Warranty" className="h-6 sm:h-8 w-auto brightness-0 invert" />
            </Link>
            <span className="ml-3 text-xs font-semibold text-orange-500 bg-orange-500/10 px-2 py-0.5 rounded">DEALER</span>
          </div>

          <nav className="hidden md:flex items-center space-x-1">
            <a href="tel:03302295040" className="flex items-center gap-1.5 px-3 py-2 text-sm font-medium text-gray-300 hover:text-white hover:bg-gray-800 rounded-md transition-colors">
              <Phone className="h-3.5 w-3.5" /> 0330 229 5040
            </a>
            <Link to="/dealer-portal/login" className="px-3 py-2 text-sm font-medium text-gray-300 hover:text-white hover:bg-gray-800 rounded-md transition-colors">Dealer Login</Link>
            <Link to="/dealer-portal/signup">
              <Button size="sm" className="bg-orange-500 hover:bg-orange-600 text-white font-bold">
                Sign Up Free
              </Button>
            </Link>
          </nav>

          <div className="flex md:hidden items-center gap-2">
            <Link to="/dealer-portal/login" className="text-sm text-gray-300 hover:text-white font-medium">Login</Link>
            <Link to="/dealer-portal/signup">
              <Button size="sm" className="bg-orange-500 hover:bg-orange-600 text-white font-bold text-xs">
                Sign Up
              </Button>
            </Link>
          </div>
        </div>
      </div>
    </header>
  );
};
