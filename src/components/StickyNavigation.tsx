import React from 'react';
import { Link } from 'react-router-dom';
import { Button } from '@/components/ui/button';
import { Phone, Clock } from 'lucide-react';
import { DropdownMenu, DropdownMenuContent, DropdownMenuTrigger, DropdownMenuItem } from '@/components/ui/dropdown-menu';
import { OptimizedImage } from '@/components/OptimizedImage';
import buyawarrantyLogo from '@/assets/buyawarranty-logo.webp';
import MobileNavigation from '@/components/MobileNavigation';

const StickyNavigation: React.FC = () => {
  return (
    <header className="bg-white shadow-sm py-1 sm:py-2 sticky top-0 z-50">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
        <div className="flex items-center justify-between">
          {/* Logo */}
          <div className="flex items-center">
            <Link to="/" className="hover:opacity-80 transition-opacity">
              <OptimizedImage 
                src={buyawarrantyLogo} 
                alt="Buy a Warranty Logo - Affordable Car Warranty UK" 
                className="h-6 sm:h-8 w-auto"
                priority={true}
                width={240}
                height={40}
              />
            </Link>
          </div>

          {/* Navigation - Hidden on mobile */}
          <nav className="hidden lg:flex items-center space-x-4 xl:space-x-6">
            <Link to="/what-is-covered/" className="relative text-gray-700 hover:text-gray-900 font-medium text-sm xl:text-base after:content-[''] after:absolute after:w-full after:scale-x-0 after:h-0.5 after:bottom-0 after:left-0 after:bg-orange-500 after:origin-bottom-right after:transition-transform after:duration-300 hover:after:scale-x-100 hover:after:origin-bottom-left">What's Covered</Link>
            <Link to="/make-a-claim/" className="relative text-gray-700 hover:text-gray-900 font-medium text-sm xl:text-base after:content-[''] after:absolute after:w-full after:scale-x-0 after:h-0.5 after:bottom-0 after:left-0 after:bg-orange-500 after:origin-bottom-right after:transition-transform after:duration-300 hover:after:scale-x-100 hover:after:origin-bottom-left">Make a Claim</Link>
            <Link to="/faq/" className="relative text-gray-700 hover:text-gray-900 font-medium text-sm xl:text-base after:content-[''] after:absolute after:w-full after:scale-x-0 after:h-0.5 after:bottom-0 after:left-0 after:bg-orange-500 after:origin-bottom-right after:transition-transform after:duration-300 hover:after:scale-x-100 hover:after:origin-bottom-left">FAQs</Link>
            <Link to="/contact-us/" className="relative text-gray-700 hover:text-gray-900 font-medium text-sm xl:text-base after:content-[''] after:absolute after:w-full after:scale-x-0 after:h-0.5 after:bottom-0 after:left-0 after:bg-orange-500 after:origin-bottom-right after:transition-transform after:duration-300 hover:after:scale-x-100 hover:after:origin-bottom-left">Contact Us</Link>
            
            {/* Call Us Dropdown */}
            <DropdownMenu>
              <DropdownMenuTrigger asChild>
                <Button variant="ghost" className="text-orange-500 hover:text-orange-600 font-semibold text-sm xl:text-base p-2 h-auto flex items-center gap-1">
                  <Phone className="h-4 w-4 text-orange-500" />
                  Call Us
                </Button>
              </DropdownMenuTrigger>
              <DropdownMenuContent align="end" className="w-72 p-4 bg-white border shadow-lg z-50">
                <div className="space-y-3">
                  <div className="text-left text-base font-medium text-gray-600 mb-4 flex items-center gap-2">
                    <Clock className="h-4 w-4 text-gray-600" />
                    Mon-Fri 9am to 5:30pm
                  </div>
                  <DropdownMenuItem asChild>
                    <a href="tel:03302295040" className="flex items-center p-3 rounded-lg hover:bg-gray-50 cursor-pointer border-none focus:outline-none">
                      <Phone className="h-5 w-5 mr-3 text-orange-500" />
                      <div>
                        <div className="font-semibold text-base text-black">Get a Quote</div>
                        <div className="text-orange-500 font-semibold text-base">0330 229 5040</div>
                      </div>
                    </a>
                  </DropdownMenuItem>
                  <DropdownMenuItem asChild>
                    <a href="tel:03302295045" className="flex items-center p-3 rounded-lg hover:bg-gray-50 cursor-pointer border-none focus:outline-none">
                      <Phone className="h-5 w-5 mr-3 text-orange-500" />
                      <div>
                        <div className="font-semibold text-base text-black">Make a Claim</div>
                        <div className="text-orange-500 font-semibold text-base">0330 229 5045</div>
                      </div>
                    </a>
                  </DropdownMenuItem>
                </div>
              </DropdownMenuContent>
            </DropdownMenu>

            {/* WhatsApp Us Button */}
            <a 
              href="https://wa.me/+4403302295040" 
              target="_blank" 
              rel="noopener noreferrer"
              className="inline-flex items-center px-3 xl:px-4 py-2 bg-[#25D366] text-white text-sm xl:text-base font-semibold rounded-lg hover:bg-[#20BA5A] transition-colors whitespace-nowrap"
            >
              WhatsApp Us
            </a>

            {/* Get my quote Button */}
            <Link 
              to="/?step=1"
              className="inline-flex items-center px-3 xl:px-4 py-2 bg-[#eb4b00] text-white text-sm xl:text-base font-semibold rounded-lg hover:bg-[#d63f00] transition-colors whitespace-nowrap"
            >
              Get my quote
            </Link>
          </nav>

          {/* Mobile Menu Button */}
          <div className="lg:hidden flex items-center gap-2">
            {/* Mobile WhatsApp Button */}
            <a 
              href="https://wa.me/+4403302295040" 
              target="_blank" 
              rel="noopener noreferrer"
              className="inline-flex items-center px-2 sm:px-3 py-1.5 sm:py-2 bg-[#25D366] text-white text-xs sm:text-sm font-semibold rounded-lg hover:bg-[#20BA5A] transition-colors whitespace-nowrap"
            >
              WhatsApp
            </a>
            
            {/* Mobile Get Quote Button */}
            <Link 
              to="/?step=1"
              className="inline-flex items-center px-2 sm:px-3 py-1.5 sm:py-2 bg-[#eb4b00] text-white text-xs sm:text-sm font-semibold rounded-lg hover:bg-[#d63f00] transition-colors whitespace-nowrap"
            >
              Get Quote
            </Link>

            <MobileNavigation />
          </div>
        </div>
      </div>
    </header>
  );
};

export default StickyNavigation;
