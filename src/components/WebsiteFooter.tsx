import React from 'react';
import { Star, Phone, Mail, MessageCircle } from 'lucide-react';
import { Link } from 'react-router-dom';
import { OptimizedImage } from '@/components/OptimizedImage';
import buyawarrantyLogo from '@/assets/buyawarranty-logo.webp';

const WebsiteFooter = () => {
  return (
    <div className="relative">
      {/* Main Footer */}
      <footer className="bg-white pt-4 pb-16">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="text-center mb-12">
            <h2 className="text-3xl font-bold text-gray-900 mb-6">
              Need advice? Have any questions?
            </h2>
            <div className="flex flex-col sm:flex-row items-center justify-center space-y-4 sm:space-y-0 sm:space-x-8">
              <a 
                href="tel:03302295040" 
                className="flex items-center text-lg font-semibold text-[#eb4b00] hover:text-[#d63f00] transition-colors"
              >
                <Phone className="w-5 h-5 mr-2" />
                Call us: 0330 229 5040
              </a>
              <a 
                href="mailto:support@buyawarranty.co.uk" 
                className="flex items-center text-lg font-semibold text-[#eb4b00] hover:text-[#d63f00] transition-colors"
              >
                <Mail className="w-5 h-5 mr-2" />
                Email us: support@buyawarranty.co.uk
              </a>
              <a 
                href="https://wa.me/443302295040" 
                target="_blank"
                rel="noopener noreferrer"
                className="flex items-center text-lg font-semibold text-[#eb4b00] hover:text-[#d63f00] transition-colors"
              >
                <MessageCircle className="w-5 h-5 mr-2" />
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
                <li><a href="/customer-dashboard/" className="hover:text-[#eb4b00] transition-colors font-semibold">Customer Login</a></li>
                <li><a href="/make-a-claim/" className="hover:text-[#eb4b00] transition-colors">Make a Claim</a></li>
                <li><a href="/contact-us/" className="hover:text-[#eb4b00] transition-colors">Contact Us</a></li>
                <li><a href="/buy-a-used-car-warranty-reliable-warranties/" className="hover:text-[#eb4b00] transition-colors">Car Warranty</a></li>
                <li><a href="/van-warranty/" className="hover:text-[#eb4b00] transition-colors">Van Warranty</a></li>
                <li><a href="/ev-warranty/" className="hover:text-[#eb4b00] transition-colors">EV Warranty</a></li>
                <li><a href="/motorcycle-warranty/" className="hover:text-[#eb4b00] transition-colors">Motorbike Warranty</a></li>
                <li><a href="/car-extended-warranty/" className="hover:text-[#eb4b00] transition-colors">Extended Warranty</a></li>
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
                  <p className="text-lg font-bold text-[#eb4b00]">0330 229 5040</p>
                </div>
                <div>
                  <p className="font-semibold text-gray-900">Claims Hotline:</p>
                  <p className="text-lg font-bold text-[#eb4b00]">0330 229 5045</p>
                </div>
                <div>
                  <p className="font-semibold text-gray-900">Email Support:</p>
                  <p className="text-[#eb4b00]">support@buyawarranty.co.uk</p>
                </div>
              </div>
            </div>

            {/* About Our Service */}
            <div>
              <h3 className="text-lg font-bold text-gray-900 mb-6">Get fast, affordable cover tailored to your needs</h3>
              <p className="text-gray-600 text-sm leading-relaxed mb-4">
                Buyawarranty.co.uk - Get fast, affordable cover tailored to your car, van, SUV or motorbike. 'Buy-a-warranty' vehicle warranty plans are designed to suit your driving needs - with simple online quotes, flexible options, and reliable protection. If your vehicle is under 15 years old and has fewer than 150,000 miles, you're eligible for comprehensive warranty cover with Buyawarranty today.
              </p>
              <div className="flex items-center">
                <Link to="/" className="hover:opacity-80 transition-opacity">
                  <OptimizedImage 
                    src={buyawarrantyLogo} 
                    alt="Buy a Warranty Logo - Comprehensive Vehicle Warranties" 
                    className="h-8 w-auto"
                    priority={false}
                    width={240}
                    height={40}
                  />
                </Link>
              </div>
            </div>
          </div>

          {/* Legal Footer */}
          <div className="border-t border-gray-200 pt-6">
            <div className="text-center">
              <p className="text-sm text-gray-600 max-w-4xl mx-auto px-4">
                Buyawarranty.co.uk is a trading name of Buy A Warranty Limited. Established 2016. Registered in the United Kingdom under Company number: 10314863 Registered address: Warranty House, 62 Berkhamsted Ave, Wembley, HA9 6DT, England
              </p>
            </div>
          </div>
        </div>
      </footer>
    </div>
  );
};

export default WebsiteFooter;
