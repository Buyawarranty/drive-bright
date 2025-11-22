import React, { useState } from 'react';
import { Button } from '@/components/ui/button';
import { Menu, Phone, Clock } from 'lucide-react';
import { Sheet, SheetContent, SheetTrigger } from '@/components/ui/sheet';
import { DropdownMenu, DropdownMenuContent, DropdownMenuTrigger, DropdownMenuItem } from '@/components/ui/dropdown-menu';
import { Link } from 'react-router-dom';
import { OptimizedImage } from '@/components/OptimizedImage';
import buyawarrantyLogo from '@/assets/buyawarranty-logo.webp';

const MobileNavigation: React.FC = () => {
  const [isMobileMenuOpen, setIsMobileMenuOpen] = useState(false);

  return (
    <>
      {/* Mobile Menu Button */}
      <Sheet open={isMobileMenuOpen} onOpenChange={setIsMobileMenuOpen}>
        <SheetTrigger asChild>
          <Button
            variant="ghost"
            size="lg"
            className="lg:hidden p-3 min-w-[48px] min-h-[48px]"
            aria-label="Open menu"
          >
            <Menu className="h-8 w-8" />
          </Button>
        </SheetTrigger>
        <SheetContent side="right" className="w-[300px] sm:w-[400px] overflow-y-auto">
          <div className="flex flex-col h-full max-h-screen">
            {/* Header with logo */}
            <div className="flex items-center justify-between pb-4 flex-shrink-0">
              <Link 
                to="/" 
                className="hover:opacity-80 transition-opacity"
                onClick={() => setIsMobileMenuOpen(false)}
              >
                  <OptimizedImage 
                    src={buyawarrantyLogo} 
                    alt="Buy a Warranty Logo"
                    className="h-8 w-auto"
                    priority={false}
                    width={240}
                    height={40}
                  />
              </Link>
            </div>

            {/* Navigation Links */}
            <nav className="flex flex-col space-y-4 flex-1 overflow-y-auto pb-4">
              <Link 
                to="/what-is-covered/" 
                className="text-lg font-medium text-gray-700 hover:text-gray-900 py-2"
                onClick={() => setIsMobileMenuOpen(false)}
              >
                What's Covered
              </Link>
              <Link 
                to="/make-a-claim/" 
                className="text-lg font-medium text-gray-700 hover:text-gray-900 py-2"
                onClick={() => setIsMobileMenuOpen(false)}
              >
                Make a Claim
              </Link>
              <Link 
                to="/faq/" 
                className="text-lg font-medium text-gray-700 hover:text-gray-900 py-2"
                onClick={() => setIsMobileMenuOpen(false)}
              >
                FAQs
              </Link>
              <Link 
                to="/contact-us/" 
                className="text-lg font-medium text-gray-700 hover:text-gray-900 py-2"
                onClick={() => setIsMobileMenuOpen(false)}
              >
                Contact Us
              </Link>
              
              {/* Call Us Section */}
              <div className="pt-4 border-t">
                <div className="text-sm text-gray-600 mb-3 flex items-center gap-2">
                  <Clock className="h-4 w-4" />
                  Mon-Fri 9am to 5:30pm
                </div>
                <a 
                  href="tel:03302295040" 
                  className="flex items-center p-3 rounded-lg hover:bg-gray-50 mb-2"
                  onClick={() => setIsMobileMenuOpen(false)}
                >
                  <Phone className="h-5 w-5 mr-3 text-orange-500" />
                  <div>
                    <div className="font-semibold text-sm">Get a Quote</div>
                    <div className="text-orange-500 font-semibold">0330 229 5040</div>
                  </div>
                </a>
                <a 
                  href="tel:03302295045" 
                  className="flex items-center p-3 rounded-lg hover:bg-gray-50"
                  onClick={() => setIsMobileMenuOpen(false)}
                >
                  <Phone className="h-5 w-5 mr-3 text-orange-500" />
                  <div>
                    <div className="font-semibold text-sm">Make a Claim</div>
                    <div className="text-orange-500 font-semibold">0330 229 5045</div>
                  </div>
                </a>
              </div>
              
              <Link 
                to="/customer-dashboard/" 
                className="text-lg font-semibold text-gray-700 hover:text-gray-900 py-2 pt-4 border-t"
                onClick={() => setIsMobileMenuOpen(false)}
              >
                Login
              </Link>
            </nav>

            {/* Bottom CTA */}
            <div className="flex-shrink-0 pt-4 border-t space-y-2">
              <a 
                href="https://wa.me/message/SPQPJ6O3UBF5B1" 
                target="_blank" 
                rel="noopener noreferrer"
                onClick={() => setIsMobileMenuOpen(false)}
              >
                <Button 
                  className="w-full bg-[#00B67A] text-white hover:bg-[#008C5A]"
                >
                  WhatsApp Us
                </Button>
              </a>
            </div>
          </div>
        </SheetContent>
      </Sheet>
    </>
  );
};

export default MobileNavigation;
