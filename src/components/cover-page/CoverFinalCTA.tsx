import React from 'react';
import { Button } from '@/components/ui/button';
import { ArrowRight, Phone, Shield, Lock } from 'lucide-react';
import { Link } from 'react-router-dom';

const CoverFinalCTA: React.FC = () => {
  return (
    <section className="py-16 md:py-20 bg-[#1a2e5a]">
      <div className="max-w-3xl mx-auto px-4 sm:px-6 lg:px-8 text-center">
        <h2 className="text-2xl md:text-3xl font-bold text-white mb-4">
          Ready to protect your vehicle?
        </h2>
        <p className="text-white/80 mb-8 text-base md:text-lg">
          Get your instant quote and choose the perfect cover.
        </p>

        <Link to="/">
          <Button
            size="lg"
            className="bg-brand-orange hover:bg-brand-orange/90 text-white font-bold px-10 py-6 text-lg rounded-xl shadow-lg shadow-brand-orange/30 hover:shadow-xl hover:-translate-y-0.5 transition-all duration-200 flex items-center gap-2 mx-auto mb-6"
          >
            Get your free quote
            <ArrowRight className="w-5 h-5" />
          </Button>
        </Link>

        <a
          href="tel:03302295040"
          className="text-white/80 hover:text-white text-sm font-medium inline-flex items-center gap-1.5 mb-8"
        >
          <Phone className="w-4 h-4" />
          0330 229 5040
        </a>

        <div className="flex items-center justify-center gap-4 text-xs text-white/60">
          <span className="flex items-center gap-1">
            <Lock className="w-3.5 h-3.5" />
            Secure checkout
          </span>
          <span className="flex items-center gap-1">
            <Shield className="w-3.5 h-3.5" />
            14-day money-back guarantee
          </span>
        </div>
      </div>
    </section>
  );
};

export default CoverFinalCTA;
