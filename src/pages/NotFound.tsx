
import { useLocation } from "react-router-dom";
import { useEffect } from "react";
import TrustpilotHeader from '@/components/TrustpilotHeader';
import { SEOHead } from '@/components/SEOHead';
import pandaImage from '@/assets/404-panda.png';

const NotFound = () => {
  const location = useLocation();

  useEffect(() => {
    console.error(
      "404 Error: User attempted to access non-existent route:",
      location.pathname
    );
  }, [location.pathname]);

  return (
    <div className="min-h-screen bg-background flex flex-col">
      <SEOHead 
        title="Page Not Found | BuyAWarranty"
        description="The page you're looking for doesn't exist. Return to our car warranty homepage to find the perfect coverage for your vehicle."
        keywords="404, page not found, car warranty, vehicle warranty"
      />
      {/* Trustpilot header */}
      <div className="w-full px-4 pt-4">
        <div className="max-w-6xl mx-auto">
          <TrustpilotHeader />
        </div>
      </div>
      
      <div className="flex-1 flex items-center justify-center py-20 px-4">
        <div className="text-center max-w-2xl mx-auto">
          <div className="mb-8">
            <img 
              src={pandaImage} 
              alt="Friendly panda mechanic" 
              className="w-32 h-32 mx-auto mb-6 object-contain"
            />
            <h1 className="text-5xl font-bold text-foreground mb-2">Oops!</h1>
            <h2 className="text-2xl font-semibold text-foreground mb-4">This page has gone walkabout.</h2>
            <p className="text-lg text-muted-foreground mb-8">
              Let's head back and try again.
            </p>
          </div>
          
          <div className="flex flex-col sm:flex-row gap-4 justify-center items-center mb-12">
            <a
              href="/"
              className="inline-flex items-center justify-center rounded-md text-sm font-medium ring-offset-background transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 bg-primary text-primary-foreground hover:bg-primary/90 h-11 px-8 w-full sm:w-auto"
            >
              Return to Homepage
            </a>
            <a
              href="/faq/"
              className="inline-flex items-center justify-center rounded-md text-sm font-medium ring-offset-background transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 border border-input bg-background hover:bg-accent hover:text-accent-foreground h-11 px-8 w-full sm:w-auto"
            >
              Visit FAQ
            </a>
          </div>

          <div className="pt-8 border-t border-border">
            <p className="text-sm text-muted-foreground mb-4">Looking for car warranty options?</p>
            <div className="flex flex-wrap gap-3 justify-center text-sm">
              <a href="/buy-a-used-car-warranty-reliable-warranties/" className="text-primary hover:underline">
                Used Car Warranty
              </a>
              <span className="text-muted-foreground">•</span>
              <a href="/van-warranty/" className="text-primary hover:underline">
                Van Warranty
              </a>
              <span className="text-muted-foreground">•</span>
              <a href="/ev-warranty/" className="text-primary hover:underline">
                EV Warranty
              </a>
              <span className="text-muted-foreground">•</span>
              <a href="/contact-us/" className="text-primary hover:underline">
                Contact Us
              </a>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};

export default NotFound;
