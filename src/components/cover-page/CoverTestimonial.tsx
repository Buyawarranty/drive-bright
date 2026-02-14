import React from 'react';
import { Star } from 'lucide-react';

const CoverTestimonial: React.FC = () => {
  return (
    <section className="py-16 md:py-20 bg-muted">
      <div className="max-w-3xl mx-auto px-4 sm:px-6 lg:px-8 text-center">
        <div className="bg-white rounded-2xl border border-border p-8 md:p-10 shadow-sm">
          <div className="flex justify-center mb-4">
            {[1, 2, 3, 4, 5].map((s) => (
              <Star key={s} className="w-5 h-5 fill-yellow-400 text-yellow-400" />
            ))}
          </div>
          <blockquote className="text-lg md:text-xl text-foreground italic mb-4 leading-relaxed">
            "My BMW needed a new water pump. The garage quoted £780. Buyawarranty approved
            the repair and I paid nothing. It was fast and easy."
          </blockquote>
          <p className="font-semibold text-foreground">Matt, Leeds</p>
        </div>
      </div>
    </section>
  );
};

export default CoverTestimonial;
