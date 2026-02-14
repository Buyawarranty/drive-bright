import React from 'react';
import { Button } from '@/components/ui/button';
import { ArrowRight, Phone, Shield, Lock } from 'lucide-react';
import { Link } from 'react-router-dom';

const CoverHero: React.FC = () => {
  return (
    <section className="bg-gradient-to-br from-blue-50 via-white to-orange-50 py-16 md:py-20">
      <div className="max-w-4xl mx-auto px-4 sm:px-6 lg:px-8 text-center">
        <h1 className="text-4xl md:text-5xl font-bold text-foreground mb-5 leading-tight">
          Protect your vehicle from{' '}
          <span className="text-primary">unexpected repair bills</span>
        </h1>
        <p className="text-lg md:text-xl text-muted-foreground max-w-2xl mx-auto mb-8">
          Get an instant quote in under 30 seconds.
        </p>

        <div className="flex flex-col items-center gap-3 mb-4">
          <Link to="/">
            <Button
              size="lg"
              className="bg-brand-orange hover:bg-brand-orange/90 text-white font-bold px-10 py-6 text-lg rounded-xl shadow-lg shadow-brand-orange/25 hover:shadow-xl hover:-translate-y-0.5 transition-all duration-200 flex items-center gap-2"
            >
              Get your free quote
              <ArrowRight className="w-5 h-5" />
            </Button>
          </Link>

          <p className="text-muted-foreground text-sm flex items-center gap-2">
            Prefer to talk?{' '}
            <a
              href="tel:03302295040"
              className="text-primary font-semibold hover:underline inline-flex items-center gap-1"
            >
              <Phone className="w-3.5 h-3.5" />
              Call 0330 229 5040
            </a>
          </p>
        </div>

        <div className="flex items-center justify-center gap-4 text-xs text-muted-foreground">
          <span className="flex items-center gap-1">
            <Shield className="w-3.5 h-3.5 text-green-500" />
            14-day money-back guarantee
          </span>
          <span className="flex items-center gap-1">
            <Lock className="w-3.5 h-3.5 text-green-500" />
            Secure payments
          </span>
        </div>
      </div>
    </section>
  );
};

export default CoverHero;
