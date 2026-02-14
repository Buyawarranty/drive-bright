import React, { useState } from 'react';
import { ChevronDown, ExternalLink } from 'lucide-react';
import { Link } from 'react-router-dom';

const faqs = [
  {
    q: 'Is £1,000, £2,000 or £3,000 right for me?',
    a: 'It depends on your vehicle and budget. Higher limits cover more of the repair cost and are ideal for newer or more complex vehicles. £1,000 is great for peace of mind on smaller repairs, while £3,000 covers most common faults in full.',
  },
  {
    q: 'What happens if a repair costs more than my limit?',
    a: 'We pay up to your selected claim limit per approved claim. You only pay the difference. For example, if your limit is £2,000 and the repair is £2,300, we pay £2,000 and you pay £300.',
  },
  {
    q: 'What is an approved claim?',
    a: 'An approved claim is one where the fault is covered under your plan and the repair is carried out at a VAT-registered garage. We aim to approve claims on the same day.',
  },
  {
    q: 'Are diagnostics and labour included?',
    a: 'Yes. Diagnostics are usually covered when the fault is approved, and labour is included up to the rate selected on your plan.',
  },
  {
    q: 'When does my cover start?',
    a: 'Your cover starts immediately from the date of purchase. As long as there are no pre-existing faults, you are protected from day one.',
  },
];

interface CoverMiniFAQProps {
  onAskQuestion: () => void;
}

const CoverMiniFAQ: React.FC<CoverMiniFAQProps> = ({ onAskQuestion }) => {
  const [openIdx, setOpenIdx] = useState<number | null>(null);

  return (
    <section className="py-16 md:py-20 bg-white">
      <div className="max-w-3xl mx-auto px-4 sm:px-6 lg:px-8">
        <div className="text-center mb-10">
          <h2 className="text-2xl md:text-3xl font-bold text-foreground">
            Frequently asked questions
          </h2>
        </div>

        <div className="space-y-3">
          {faqs.map((faq, i) => (
            <div key={i} className="bg-white border border-border rounded-xl overflow-hidden shadow-sm">
              <button
                onClick={() => setOpenIdx(openIdx === i ? null : i)}
                className="w-full px-5 py-4 text-left flex items-center justify-between hover:bg-muted/30 transition-colors"
                aria-expanded={openIdx === i}
              >
                <span className="font-semibold text-foreground pr-4 text-sm md:text-base">
                  {faq.q}
                </span>
                <ChevronDown
                  className={`w-5 h-5 text-muted-foreground flex-shrink-0 transition-transform duration-200 ${
                    openIdx === i ? 'rotate-180' : ''
                  }`}
                />
              </button>
              <div
                className={`overflow-hidden transition-all duration-200 ${
                  openIdx === i ? 'max-h-screen opacity-100' : 'max-h-0 opacity-0'
                }`}
              >
                <div className="px-5 pb-4 border-t border-border">
                  <p className="pt-3 text-sm text-muted-foreground leading-relaxed">
                    {faq.a}
                  </p>
                </div>
              </div>
            </div>
          ))}
        </div>

        <div className="flex flex-col sm:flex-row items-center justify-center gap-4 mt-8">
          <Link
            to="/faq/"
            target="_blank"
            rel="noopener noreferrer"
            className="text-primary hover:underline text-sm font-semibold inline-flex items-center gap-1"
          >
            View all FAQs
            <ExternalLink className="w-3.5 h-3.5" />
          </Link>
          <span className="text-muted-foreground hidden sm:inline">·</span>
          <button
            onClick={onAskQuestion}
            className="text-primary hover:underline text-sm font-medium"
          >
            Ask a question not covered →
          </button>
        </div>
      </div>
    </section>
  );
};

export default CoverMiniFAQ;
