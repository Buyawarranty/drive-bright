import React, { useState, useEffect } from 'react';
import { Link, useNavigate, useLocation } from 'react-router-dom';
import { Button } from '@/components/ui/button';
import { Phone, Clock, PhoneCall, LogIn, ArrowRight } from 'lucide-react';
import { HoverCard, HoverCardContent, HoverCardTrigger } from '@/components/ui/hover-card';
import { OptimizedImage } from '@/components/OptimizedImage';
import buyawarrantyLogo from '@/assets/buyawarranty-logo.webp';
import MobileNavigation from '@/components/MobileNavigation';
import RequestCallbackModal from '@/components/modals/RequestCallbackModal';
import { useIsMobile } from '@/hooks/use-mobile';

const StickyNavigation: React.FC = () => {
  const navigate = useNavigate();
  const location = useLocation();
  const isMobile = useIsMobile();
  const [isCallbackModalOpen, setIsCallbackModalOpen] = useState(false);
  const [isScrolled, setIsScrolled] = useState(false);

  useEffect(() => {
    const onScroll = () => setIsScrolled(window.scrollY > 300);
    window.addEventListener('scroll', onScroll);
    return () => window.removeEventListener('scroll', onScroll);
  }, []);

  // Hide mobile sticky bar on admin/checkout/auth pages and checkout steps 2-4
  const hiddenPaths = ['/admin', '/sales-login', '/checkout', '/auth', '/widget', '/dealer-portal/dashboard', '/dealer-portal/quotes', '/dealer-portal/warranties'];
  const searchParams = new URLSearchParams(location.search);
  const currentStep = searchParams.get('step');
  const isCheckoutStep = currentStep && ['2', '3', '4'].includes(currentStep);
  const showMobileStickyBar = isMobile && isScrolled && !hiddenPaths.some(p => location.pathname.startsWith(p)) && !isCheckoutStep;

  const handleLogoClick = (e: React.MouseEvent) => {
    e.preventDefault();
    // Clear checkout flow state and navigate to homepage
    localStorage.removeItem('warrantyVehicleData');
    localStorage.removeItem('warrantyFormData');
    navigate('/', { replace: true });
    window.scrollTo(0, 0);
  };

  return (
    <>
      <header className="bg-white shadow-sm py-1 sm:py-2 sticky top-0 z-50">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="flex items-center justify-between">
            {/* Logo */}
            <div className="flex items-center">
              <a href="/" onClick={handleLogoClick} className="hover:opacity-80 transition-opacity cursor-pointer">
                <OptimizedImage 
                  src={buyawarrantyLogo} 
                  alt="Buy a Warranty Logo - Affordable Car Warranty UK" 
                  className="h-6 sm:h-8 w-auto object-contain"
                  priority={true}
                  width={240}
                  height={40}
                />
              </a>
            </div>

            {/* Navigation - Hidden on mobile */}
            <nav className="hidden lg:flex items-center space-x-4 xl:space-x-6">
              <Link to="/what-is-covered/" className="relative text-gray-700 hover:text-gray-900 font-medium text-sm xl:text-base after:content-[''] after:absolute after:w-full after:scale-x-0 after:h-0.5 after:bottom-0 after:left-0 after:bg-orange-500 after:origin-bottom-right after:transition-transform after:duration-300 hover:after:scale-x-100 hover:after:origin-bottom-left">What's Covered</Link>
              <Link to="/make-a-claim/" className="relative text-gray-700 hover:text-gray-900 font-medium text-sm xl:text-base after:content-[''] after:absolute after:w-full after:scale-x-0 after:h-0.5 after:bottom-0 after:left-0 after:bg-orange-500 after:origin-bottom-right after:transition-transform after:duration-300 hover:after:scale-x-100 hover:after:origin-bottom-left">Make a Claim</Link>
              <Link to="/faq/" className="relative text-gray-700 hover:text-gray-900 font-medium text-sm xl:text-base after:content-[''] after:absolute after:w-full after:scale-x-0 after:h-0.5 after:bottom-0 after:left-0 after:bg-orange-500 after:origin-bottom-right after:transition-transform after:duration-300 hover:after:scale-x-100 hover:after:origin-bottom-left">FAQs</Link>
              <Link to="/contact-us/" className="relative text-gray-700 hover:text-gray-900 font-medium text-sm xl:text-base after:content-[''] after:absolute after:w-full after:scale-x-0 after:h-0.5 after:bottom-0 after:left-0 after:bg-orange-500 after:origin-bottom-right after:transition-transform after:duration-300 hover:after:scale-x-100 hover:after:origin-bottom-left">Contact Us</Link>
              
              {/* Call Us Hover Card */}
              <HoverCard openDelay={0} closeDelay={200}>
                <HoverCardTrigger asChild>
                  <button className="text-orange-500 hover:text-orange-600 font-semibold text-sm xl:text-base p-2 h-auto flex items-center gap-1 bg-transparent border-none cursor-pointer">
                    <Phone className="h-4 w-4 text-orange-500" />
                    Call Us
                  </button>
                </HoverCardTrigger>
                <HoverCardContent align="end" className="w-72 p-4 bg-white border shadow-lg z-50">
                  <div className="space-y-3">
                    <div className="text-left text-base font-medium text-gray-600 mb-4 flex items-center gap-2">
                      <Clock className="h-4 w-4 text-gray-600" />
                      Mon-Fri 9am to 5:30pm
                    </div>
                    <a href="tel:03302295040" className="flex items-center p-3 rounded-lg hover:bg-gray-50 cursor-pointer">
                      <Phone className="h-5 w-5 mr-3 text-orange-500" />
                      <div>
                        <div className="font-semibold text-base text-black">Get a Quote</div>
                        <div className="text-orange-500 font-semibold text-base">0330 229 5040</div>
                      </div>
                    </a>
                    <a href="tel:03302295045" className="flex items-center p-3 rounded-lg hover:bg-gray-50 cursor-pointer">
                      <Phone className="h-5 w-5 mr-3 text-orange-500" />
                      <div>
                        <div className="font-semibold text-base text-black">Make a Claim</div>
                        <div className="text-orange-500 font-semibold text-base">0330 229 5045</div>
                      </div>
                    </a>
                    
                    {/* Request Call-Back Option */}
                    <button 
                      onClick={() => setIsCallbackModalOpen(true)}
                      className="flex items-center w-full p-3 rounded-lg bg-brand-orange/10 hover:bg-brand-orange/20 transition-colors cursor-pointer"
                    >
                      <PhoneCall className="h-5 w-5 mr-3 text-brand-orange" />
                      <div className="text-left">
                        <div className="font-semibold text-base text-black">Request Call-Back</div>
                        <div className="text-sm text-muted-foreground">We'll call you back</div>
                      </div>
                    </button>
                  </div>
                </HoverCardContent>
              </HoverCard>

              {/* WhatsApp Us Button */}
              <a 
                href="https://wa.me/message/SPQPJ6O3UBF5B1" 
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

              {/* Customer Login Button */}
              <Link 
                to="/customer-dashboard/"
                className="inline-flex items-center gap-1 px-3 xl:px-4 py-2 text-gray-600 hover:text-gray-900 text-sm xl:text-base font-medium transition-colors"
              >
                <LogIn className="h-4 w-4" />
                Login
              </Link>
            </nav>

            {/* Mobile Menu Button */}
            <div className="lg:hidden flex items-center gap-2">
              <MobileNavigation />
            </div>
          </div>
        </div>
      </header>

      {/* Request Callback Modal */}
      <RequestCallbackModal 
        isOpen={isCallbackModalOpen} 
        onClose={() => setIsCallbackModalOpen(false)} 
      />

      {/* Global Mobile Sticky CTA Bar */}
      {showMobileStickyBar && (
        <div className="fixed bottom-0 left-0 right-0 z-40 bg-white border-t border-border shadow-[0_-4px_12px_rgba(0,0,0,0.08)] p-2.5 pb-[env(safe-area-inset-bottom,10px)] lg:hidden animate-in slide-in-from-bottom-4 duration-300">
          <div className="flex gap-2">
            <button
              onClick={() => navigate('/?step=1')}
              className="flex-1 bg-[#1B2A4A] hover:bg-[#152238] text-white font-bold py-3.5 rounded-xl text-sm flex items-center justify-center gap-2 shadow-md transition-colors"
              aria-label="Get instant quote"
            >
              Get Instant Quote
              <ArrowRight className="w-4 h-4" />
            </button>
            <a
              href="tel:03302295040"
              className="flex-1 bg-brand-orange hover:bg-brand-orange/90 text-white font-bold py-3.5 rounded-xl text-sm flex items-center justify-center gap-2 shadow-md transition-colors"
              aria-label="Call now"
            >
              <Phone className="w-4 h-4" />
              Call Now
            </a>
          </div>
        </div>
      )}
    </>
  );
};

export default StickyNavigation;
