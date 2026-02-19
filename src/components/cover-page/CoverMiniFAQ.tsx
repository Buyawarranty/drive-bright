import React, { useState } from 'react';
import { ChevronDown, ExternalLink } from 'lucide-react';
import { Link } from 'react-router-dom';

const faqs = [
  {
    q: 'Is £1,000, £2,000, £3,000 or £5,000 the right claim limit for me?',
    a: 'It depends on your vehicle and how much protection you want.\n\n£1,000 is ideal for smaller or lower‑cost repairs.\n£2,000 offers broader cover for most mid‑range repairs.\n£3,000 is our most popular option and covers the majority of common faults in full.\n£5,000 provides our highest level of protection and is best suited to newer, higher‑value or more complex vehicles where repair costs can be significantly higher.\n\nEvery plan includes unlimited claims, and you\'re covered up to the value of your vehicle, whichever limit you choose.',
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
    q: 'Can I use my own garage?',
    a: 'Yes. Any VAT registered garage is acceptable or we can recommend an approved garage near you.',
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

        <div className="space-y-4">
          {faqs.map((faq, i) => (
            <div key={i} className="bg-gradient-to-r from-orange-500 to-orange-600 rounded-lg overflow-hidden shadow-lg">
              <button
                onClick={() => setOpenIdx(openIdx === i ? null : i)}
                className="w-full px-6 py-5 text-left flex items-center justify-between text-white hover:bg-orange-600/20 transition-colors"
                aria-expanded={openIdx === i}
              >
                <span className="font-bold text-lg pr-4">
                  {faq.q}
                </span>
                <ChevronDown
                  className={`w-6 h-6 text-white flex-shrink-0 transition-transform duration-300 ${
                    openIdx === i ? 'rotate-180' : ''
                  }`}
                />
              </button>
              <div
                className={`overflow-hidden transition-all duration-200 ease-out ${
                  openIdx === i ? 'max-h-screen opacity-100 animate-accordion-down' : 'max-h-0 opacity-0'
                }`}
              >
                <div className="px-6 pb-5 bg-white border-t border-orange-200">
                  <p className="text-base leading-relaxed pt-4 text-brand-dark-text">
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
