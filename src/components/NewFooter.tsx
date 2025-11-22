
import React from 'react';
import { Phone, Mail, BookOpen } from 'lucide-react';
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
          </div>
        </div>
      </div>
    </div>
  );
};

export default NewFooter;
