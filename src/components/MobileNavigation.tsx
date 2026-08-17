import React, { useState } from 'react';
import { Button } from '@/components/ui/button';
import { Menu, X, Phone, Clock, PhoneCall, LogIn, Check } from 'lucide-react';
import { Sheet, SheetContent, SheetTrigger } from '@/components/ui/sheet';
import { Link, useNavigate } from 'react-router-dom';
import { OptimizedImage } from '@/components/OptimizedImage';
import buyawarrantyLogo from '@/assets/buyawarranty-logo.webp';
import RequestCallbackModal from '@/components/modals/RequestCallbackModal';

const MobileNavigation: React.FC = () => {
  const [isMobileMenuOpen, setIsMobileMenuOpen] = useState(false);
  const [isCallbackModalOpen, setIsCallbackModalOpen] = useState(false);
  const navigate = useNavigate();

  const handleLogoClick = (e: React.MouseEvent) => {
    e.preventDefault();
    localStorage.removeItem('warrantyVehicleData');
    localStorage.removeItem('warrantyFormData');
    setIsMobileMenuOpen(false);
    navigate('/', { replace: true });
    window.scrollTo(0, 0);
  };

  const handleRequestCallback = () => {
    setIsMobileMenuOpen(false);
    setIsCallbackModalOpen(true);
  };

  return (
    <>
      {/* Mobile Menu Button */}
      <Sheet open={isMobileMenuOpen} onOpenChange={setIsMobileMenuOpen}>
        <SheetTrigger asChild>
          <button
            type="button"
            className="lg:hidden inline-flex items-center gap-1.5 min-h-[34px] px-2.5 py-1 rounded-xl bg-background/80 border border-border/50 hover:bg-muted/60 active:scale-[0.97] transition-all"
            aria-label={isMobileMenuOpen ? 'Close menu' : 'Open menu'}
            aria-expanded={isMobileMenuOpen}
          >
            {isMobileMenuOpen ? (
              <X className="h-4 w-4 text-foreground" strokeWidth={2.5} />
            ) : (
              <Menu className="h-4 w-4 text-foreground" strokeWidth={2.5} />
            )}
            <span className="text-[13px] font-semibold leading-none text-foreground">Menu</span>

          </button>
        </SheetTrigger>

        <SheetContent side="right" className="w-[300px] sm:w-[400px] overflow-y-auto">
          <div className="flex flex-col h-full max-h-screen">
            {/* Header with logo */}
            <div className="flex items-center justify-between pb-3 flex-shrink-0">
              <button 
                onClick={handleLogoClick}
                className="hover:opacity-80 transition-opacity"
              >
                  <OptimizedImage 
                    src={buyawarrantyLogo} 
                    alt="Buy a Warranty Logo"
                    className="h-7 w-auto object-contain"
                    priority={false}
                    width={240}
                    height={40}
                  />
              </button>
            </div>

            {/* Navigation Links */}
            <nav className="flex flex-col space-y-0.5 flex-1 overflow-y-auto pb-2">
              <Link 
                to="/what-is-covered/" 
                className="text-base font-medium text-gray-700 py-1.5 px-2 -mx-2 rounded-lg transition-colors hover:bg-muted hover:text-gray-900"
                onClick={() => setIsMobileMenuOpen(false)}
              >
                What's Covered
              </Link>
              <Link 
                to="/make-a-claim/" 
                className="text-base font-medium text-gray-700 py-1.5 px-2 -mx-2 rounded-lg transition-colors hover:bg-muted hover:text-gray-900"
                onClick={() => setIsMobileMenuOpen(false)}
              >
                Make a Claim
              </Link>
              <Link 
                to="/faq/" 
                className="text-base font-medium text-gray-700 py-1.5 px-2 -mx-2 rounded-lg transition-colors hover:bg-muted hover:text-gray-900"
                onClick={() => setIsMobileMenuOpen(false)}
              >
                FAQs
              </Link>
              <Link 
                to="/contact-us/" 
                className="text-base font-medium text-gray-700 py-1.5 px-2 -mx-2 rounded-lg transition-colors hover:bg-muted hover:text-gray-900"
                onClick={() => setIsMobileMenuOpen(false)}
              >
                Contact Us
              </Link>
              <Link 
                to="/customer-dashboard/" 
                className="text-base font-medium text-gray-700 py-1.5 px-2 -mx-2 rounded-lg transition-colors hover:bg-muted hover:text-gray-900 flex items-center gap-2"
                onClick={() => setIsMobileMenuOpen(false)}
              >
                <LogIn className="h-4 w-4" />
                Login
              </Link>
              
              {/* Call Us Section */}
              <div className="pt-3 mt-1 border-t">
                <div className="text-xs text-gray-600 mb-2 flex items-center gap-2">
                  <Clock className="h-3.5 w-3.5" />
                  Mon-Fri 9am to 5:30pm
                </div>
                <a 
                  href="tel:03302295040" 
                  className="flex items-center p-2 rounded-lg transition-colors hover:bg-muted"
                  onClick={() => setIsMobileMenuOpen(false)}
                >
                  <Phone className="h-4 w-4 mr-2.5 text-orange-500" />
                  <div>
                    <div className="font-semibold text-xs">Get a Quote</div>
                    <div className="text-orange-500 font-semibold text-sm">0330 229 5040</div>
                  </div>
                </a>
                <a 
                  href="tel:03302295045" 
                  className="flex items-center p-2 rounded-lg transition-colors hover:bg-muted"
                  onClick={() => setIsMobileMenuOpen(false)}
                >
                  <Phone className="h-4 w-4 mr-2.5 text-orange-500" />
                  <div>
                    <div className="font-semibold text-xs">Make a Claim</div>
                    <div className="text-orange-500 font-semibold text-sm">0330 229 5045</div>
                  </div>
                </a>
                
                {/* Request Call-Back Button */}
                <button 
                  onClick={handleRequestCallback}
                  className="flex items-center w-full p-2 mt-1 rounded-lg bg-brand-orange/10 hover:bg-brand-orange/20 transition-colors"
                >
                  <PhoneCall className="h-4 w-4 mr-2.5 text-brand-orange" />
                  <div className="text-left">
                    <div className="font-semibold text-xs text-foreground">Request Call-Back</div>
                    <div className="text-[11px] text-muted-foreground">We'll call you back</div>
                  </div>
                </button>
              </div>

              
            </nav>

            {/* Bottom CTA */}
            <div className="flex-shrink-0 pt-3 border-t">
              <Link
                to="/?step=1"
                onClick={() => setIsMobileMenuOpen(false)}
              >
                <Button 
                  className="w-full bg-[#eb4b00] text-white hover:bg-[#d63f00]"
                >
                  Get a Quote
                </Button>
              </Link>
            </div>
          </div>
        </SheetContent>
      </Sheet>

      {/* Request Callback Modal */}
      <RequestCallbackModal 
        isOpen={isCallbackModalOpen} 
        onClose={() => setIsCallbackModalOpen(false)} 
      />
    </>
  );
};

export default MobileNavigation;
