
import React from 'react';
import { Phone, Mail, Facebook, Instagram } from 'lucide-react';
import { X } from 'lucide-react';

const Footer = () => {
  return (
    <div className="px-4 pb-4">
      <footer className="bg-[#2c5282] text-white relative overflow-hidden rounded-3xl w-4/5 mx-auto">
        {/* Main footer section */}
        <div className="py-12 relative z-10">
          {/* Need help section */}
          <div className="text-center mb-8">
            <h3 className="text-2xl font-semibold mb-2">Need help?</h3>
            <p className="text-lg mb-6">Our customer support team are here to help.</p>
            
            <div className="flex flex-col sm:flex-row items-center justify-center gap-8">
              <a 
                href="tel:0300456576" 
                className="flex items-center gap-2 text-[#eb4b00] hover:text-orange-400 transition-colors font-medium text-lg"
              >
                <Phone size={20} />
                Call us: 0300 456 576
              </a>
              
              <a 
                href="mailto:info@buyawarranty.co.uk" 
                className="flex items-center gap-2 text-[#eb4b00] hover:text-orange-400 transition-colors font-medium text-lg"
              >
                <Mail size={20} />
                Email us: info@buyawarranty.co.uk
              </a>
            </div>
          </div>

          {/* Orange divider line */}
          <div className="w-full h-px bg-[#eb4b00] my-8"></div>

          {/* Footer content grid */}
          <div className="grid grid-cols-1 lg:grid-cols-3 gap-8 items-center">
            {/* Logo section */}
            <div className="flex justify-center lg:justify-start">
              <a href="/" className="hover:opacity-80 transition-opacity">
                <img 
                  src="/lovable-uploads/ce43a78c-28ec-400b-8a16-1e98b15e0185.png" 
                  alt="Buy a Warranty" 
                  className="h-16 w-auto"
                />
              </a>
            </div>

            {/* Navigation links */}
            <div className="flex flex-col sm:flex-row items-center justify-center gap-6">
              <a 
                href="/" 
                className="text-white hover:text-[#eb4b00] transition-colors font-medium"
              >
                Home
              </a>
              <a 
                href="/faq" 
                className="text-white hover:text-[#eb4b00] transition-colors font-medium"
              >
                Frequently Asked Questions
              </a>
              <a 
                href="/contact-us" 
                className="text-white hover:text-[#eb4b00] transition-colors font-medium"
              >
                Contact Us
              </a>
            </div>

            {/* Social media links */}
            <div className="flex justify-center lg:justify-end gap-4">
              <a 
                href="https://facebook.com" 
                target="_blank" 
                rel="noopener noreferrer"
                className="w-10 h-10 bg-white/10 rounded-full flex items-center justify-center hover:bg-[#eb4b00] transition-colors"
              >
                <Facebook size={20} />
              </a>
              <a 
                href="https://twitter.com" 
                target="_blank" 
                rel="noopener noreferrer"
                className="w-10 h-10 bg-white/10 rounded-full flex items-center justify-center hover:bg-[#eb4b00] transition-colors"
              >
                <X size={20} />
              </a>
              <a 
                href="https://instagram.com" 
                target="_blank" 
                rel="noopener noreferrer"
                className="w-10 h-10 bg-white/10 rounded-full flex items-center justify-center hover:bg-[#eb4b00] transition-colors"
              >
                <Instagram size={20} />
              </a>
            </div>
          </div>

          {/* Bottom section */}
          <div className="mt-8 pt-4 border-t border-white/10 text-center text-sm text-gray-300">
            <p>&copy; {new Date().getFullYear()} Buy a Warranty. All rights reserved.</p>
          </div>
        </div>
      </footer>
    </div>
  );
};

export default Footer;
