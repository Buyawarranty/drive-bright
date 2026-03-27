import React from 'react';
import { Star, Phone, Mail, MessageCircle } from 'lucide-react';
import { Link, useLocation } from 'react-router-dom';
import { OptimizedImage } from '@/components/OptimizedImage';
import buyawarrantyLogo from '@/assets/buyawarranty-logo.webp';

// Pages that have their own final CTA section
const pagesWithOwnCTA = ['/warranty-types/vans-warranty', '/warranty-types/vans-warranty/'];

const WebsiteFooter = () => {
  const location = useLocation();
  const hideCtaSection = pagesWithOwnCTA.includes(location.pathname);

  return (
    <div className="relative">
      {/* CTA Section */}
      {!hideCtaSection && (
      <section className="bg-[#1e3a5f] py-12">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 text-center">
          <h2 className="text-2xl md:text-3xl font-bold text-white mb-4">
            Ready to Protect Your Vehicle?
          </h2>
          <p className="text-white/90 mb-6 max-w-2xl mx-auto">
            Get an instant quote and find the perfect warranty for your vehicle today.
          </p>
          <div className="flex flex-col sm:flex-row items-center justify-center gap-4">
            <button 
              onClick={() => window.scrollTo({ top: 0, behavior: 'smooth' })}
              className="bg-[#eb4b00] hover:bg-[#d63f00] text-white font-semibold px-8 py-3 rounded-lg transition-colors animate-breathing"
            >
              Get your free quote
            </button>
            <a 
              href="tel:03302295040" 
              className="text-white font-semibold text-lg hover:text-white/80 transition-colors flex items-center gap-2"
            >
              <Phone className="w-5 h-5" />
              0330 229 5040
            </a>
          </div>
        </div>
      </section>
      )}

      {/* Main Footer */}
      <footer className="bg-white pt-0 pb-16">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="text-center mb-8 pt-8">
            <h2 className="text-xl font-bold text-gray-900 mb-3">
              Need advice? Have any questions?
            </h2>
            <div className="flex flex-col sm:flex-row items-center justify-center space-y-2 sm:space-y-0 sm:space-x-6">
              <a 
                href="tel:03302295040" 
                className="flex items-center text-sm font-semibold text-[#eb4b00] hover:text-[#d63f00] transition-colors"
              >
                <Phone className="w-4 h-4 mr-1.5" />
                Call us: 0330 229 5040
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

          <div className="grid grid-cols-1 md:grid-cols-4 gap-8 mb-12">
            {/* Quick Links */}
            <div>
              <h3 className="text-lg font-bold text-gray-900 mb-6">Quick Links</h3>
              <ul className="space-y-3 text-gray-600">
                <li><a href="/" className="hover:text-[#eb4b00] transition-colors">Home</a></li>
                <li><a href="/discount-promo-offers/" className="hover:text-[#eb4b00] transition-colors">Discounts & Offers</a></li>
                <li><a href="/customer-dashboard/" className="hover:text-[#eb4b00] transition-colors font-semibold">Customer Login</a></li>
                <li><a href="/make-a-claim/" className="hover:text-[#eb4b00] transition-colors">Make a Claim</a></li>
                <li><a href="/contact-us/" className="hover:text-[#eb4b00] transition-colors">Contact Us</a></li>
                <li><a href="/buy-a-used-car-warranty-reliable-warranties/" className="hover:text-[#eb4b00] transition-colors">Car Warranty</a></li>
                <li><a href="/van-warranty/" className="hover:text-[#eb4b00] transition-colors">Van Warranty</a></li>
                <li><a href="/ev-warranty/" className="hover:text-[#eb4b00] transition-colors">EV Warranty</a></li>
                <li><a href="/motorcycle-warranty/" className="hover:text-[#eb4b00] transition-colors">Motorbike Warranty</a></li>
                <li><a href="/car-extended-warranty/" className="hover:text-[#eb4b00] transition-colors">Extended Warranty</a></li>
                <li><a href="/warranty-types/" className="hover:text-[#eb4b00] transition-colors">Warranty Types</a></li>
              </ul>
            </div>

            {/* Legal */}
            <div>
              <h3 className="text-lg font-bold text-gray-900 mb-6">Legal</h3>
              <ul className="space-y-3 text-gray-600">
                <li><a href="/privacy/" className="hover:text-[#eb4b00] transition-colors">Privacy Policy</a></li>
                <li><a href="/terms/" className="hover:text-[#eb4b00] transition-colors">Terms & Conditions</a></li>
                <li><a href="/cookies/" className="hover:text-[#eb4b00] transition-colors">Cookie Policy</a></li>
                <li><a href="/complaints/" className="hover:text-[#eb4b00] transition-colors">Complaints Procedure</a></li>
                <li><a href="/thewarrantyhub/" className="hover:text-[#eb4b00] transition-colors">Warranty Hub</a></li>
                <li><a href="/used-car-warranty-uk/" className="hover:text-[#eb4b00] transition-colors">Used Car Warranty UK</a></li>
                <li><a href="/cancel-warranty" className="hover:text-[#eb4b00] transition-colors">Cancel your warranty</a></li>
              </ul>
            </div>

            {/* Help */}
            <div>
              <h3 className="text-lg font-bold text-gray-900 mb-6">Help</h3>
              <div className="space-y-3 text-gray-600">
                <div>
                  <a href="/faq/" className="text-[#eb4b00] hover:text-[#d63f00] transition-colors font-semibold">
                    FAQ's
                  </a>
                </div>
                <div>
                  <p className="font-semibold text-gray-900">Sales Enquiries:</p>
                  <a href="tel:03302295040" className="text-lg font-bold text-[#eb4b00] hover:underline">0330 229 5040</a>
                </div>
                <div>
                  <p className="font-semibold text-gray-900">Claims Hotline:</p>
                  <a href="tel:03302295045" className="text-lg font-bold text-[#eb4b00] hover:underline">0330 229 5045</a>
                </div>
                <div>
                  <p className="font-semibold text-gray-900">Email Support:</p>
                  <a href="mailto:support@buyawarranty.co.uk" className="text-[#eb4b00] font-bold hover:underline">support@buyawarranty.co.uk</a>
                </div>
              </div>
            </div>

            {/* About Our Service */}
            <div>
              <h3 className="text-lg font-bold text-gray-900 mb-6">Get fast, affordable cover tailored to your needs</h3>
              <p className="text-gray-600 text-sm leading-relaxed mb-4">
                Buyawarranty.co.uk - Get fast, affordable cover tailored to your car, van, SUV or motorbike. 'Buy-a-warranty' vehicle warranty plans are designed to suit your driving needs - with simple online quotes, flexible options, and reliable protection. If your vehicle is under 15 years old and has fewer than 150,000 miles, you're eligible for comprehensive warranty cover with Buyawarranty today.
              </p>
            </div>
          </div>

          {/* Copyright & Company Details */}
          <div className="text-center pt-8 border-t border-gray-200 mt-8">
            <p className="text-sm text-gray-600 max-w-4xl mx-auto">
              © Buy a Warranty. All rights reserved.
            </p>
            <p className="text-sm text-gray-600 mt-2 max-w-4xl mx-auto">
              Buyawarranty.co.uk is a trading name of Buy A Warranty Limited. Established 2016. Registered in the United Kingdom under Company number: 10314863 Registered address: Warranty House, 62 Berkhamsted Ave, Wembley, HA9 6DT, England
            </p>
          </div>
        </div>
      </footer>
    </div>
  );
};

export default WebsiteFooter;
