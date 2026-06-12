
import React from 'react';
import { Phone, Mail, BookOpen, X, LogIn } from 'lucide-react';
import { Link } from 'react-router-dom';

const NewFooter = () => {
  return (
    <div className="bg-white border-t border-gray-200">

      {/* Main footer section */}
      <div className="bg-[#284185] text-white py-8">
        <div className="max-w-6xl mx-auto px-4 text-center">
          <h3 className="text-xl font-semibold mb-6 text-white">
            Need help? Our team of warranty experts are here to help.
          </h3>
          
          <div className="flex flex-col sm:flex-row items-center justify-center gap-8">
            <a 
              href="tel:03302295040" 
              className="flex items-center gap-2 text-white hover:text-white/80 transition-colors font-medium"
            >
              <Phone size={18} className="text-white" />
              <span className="text-white">Call us: 0330 229 5040</span>
            </a>
            
            <a 
              href="mailto:support@buyawarranty.co.uk" 
              className="flex items-center gap-2 text-white hover:text-white/80 transition-colors font-medium"
            >
              <Mail size={18} className="text-white" />
              <span className="text-white">Email us: support@buyawarranty.co.uk</span>
            </a>

            <Link 
              to="/thewarrantyhub/" 
              className="flex items-center gap-2 text-white hover:text-white/80 transition-colors font-medium"
            >
              <BookOpen size={18} className="text-white" />
              <span className="text-white">Drive Smarter</span>
            </Link>

            <Link 
              to="/cancel-warranty" 
              className="flex items-center gap-2 text-white hover:text-white/80 transition-colors font-medium"
            >
              <X size={18} className="text-white" />
              <span className="text-white">Cancel your warranty</span>
            </Link>

            <Link 
              to="/customer-dashboard/" 
              className="flex items-center gap-2 text-white hover:text-white/80 transition-colors font-medium"
            >
              <LogIn size={18} className="text-white" />
              <span className="text-white">Login</span>
            </Link>
          </div>

          <div className="mt-8 bg-white/10 border border-white/20 rounded-xl px-6 py-6 max-w-2xl mx-auto">
            <h3 className="text-base font-bold text-white mb-2">
              Like our content? Follow us on Google
            </h3>
            <p className="text-sm text-white/80 mb-4 max-w-md mx-auto">
              Add Buyawarranty as a preferred source so our latest warranty advice shows up more often in your Google search results.
            </p>
            <a
              href="https://www.google.com/preferences/source?q=buyawarranty.co.uk"
              target="_blank"
              rel="noopener noreferrer"
              className="inline-flex items-center gap-2 bg-[#eb4b00] hover:bg-[#d63f00] text-white font-semibold px-6 py-3 rounded-lg transition-colors"
            >
              <svg className="w-5 h-5" viewBox="0 0 24 24" fill="currentColor" aria-hidden="true">
                <path d="M21.35 11.1H12v3.2h5.35c-.5 2.4-2.55 3.7-5.35 3.7-3.25 0-5.9-2.65-5.9-5.9s2.65-5.9 5.9-5.9c1.5 0 2.85.55 3.9 1.45l2.4-2.4C16.55 3.7 14.4 2.85 12 2.85 6.95 2.85 2.85 6.95 2.85 12s4.1 9.15 9.15 9.15c5.3 0 8.8-3.7 8.8-8.9 0-.4-.05-.8-.1-1.15z"/>
              </svg>
              Add to Google
            </a>
          </div>
        </div>
      </div>
    </div>
  );
};

export default NewFooter;
