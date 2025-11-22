import React, { useState } from 'react';
import { ChevronDown } from 'lucide-react';
import { Link } from 'react-router-dom';
import { Button } from '@/components/ui/button';

const HomepageFAQ = () => {
  const [openItems, setOpenItems] = useState<{ [key: string]: boolean }>({});

  const toggleItem = (id: string) => {
    setOpenItems(prev => ({
      ...prev,
      [id]: !prev[id]
    }));
  };

  // Helper function to render text with clickable links
  const renderAnswerWithLinks = (text: string) => {
    // Split text by URLs
    const urlRegex = /(https?:\/\/[^\s]+)/g;
    const parts = text.split(urlRegex);
    
    return parts.map((part, index) => {
      if (part.match(urlRegex)) {
        return (
          <a
            key={index}
            href={part}
            className="text-brand-orange hover:underline font-medium"
            target="_blank"
            rel="noopener noreferrer"
          >
            {part}
          </a>
        );
      }
      return <span key={index}>{part}</span>;
    });
  };

  // Top 10 FAQs from the main FAQ page - most popular and important questions
  const leftColumnFAQs = [
    {
      id: 'what-is-warranty',
      question: 'What\'s a car warranty and why should I get one?',
      answer: 'Think of a warranty as a backup plan for your car. If something goes wrong – like a mechanical or electrical fault – your warranty helps cover the cost of repairs. New cars usually come with a manufacturer\'s warranty for about 3 years. After that, you\'re on your own unless you get an extended warranty. That\'s where we come in – giving you peace of mind and helping you avoid surprise bills.'
    },
    {
      id: 'whats-covered-warranty',
      question: 'What\'s covered in my warranty?',
      answer: 'At Buy-a-Warranty, we like to keep things simple. One solid plan that works for cars, vans, and motorbikes, whether you\'re driving electric, hybrid, petrol, or diesel. We keep things simple with no confusing packages, you won\'t encounter any unexpected rejections, and we offer straightforward cover without the hassle.'
    },
    {
      id: 'car-issue',
      question: 'What should I do if my car has an issue?',
      answer: 'If your car experiences a problem, please contact our Claims Team at 0330 229 5045. They are available Monday to Friday from 09:00 to 17:30 and can help start and process your warranty claim. If the issue arises outside of these hours, please fill out our online contact form.'
    },
    {
      id: 'how-long-cover',
      question: 'How long can I get cover for?',
      answer: 'You can choose a plan that suits you – pay in full and save more money, spread it over 12 months interest free, or go for monthly Pay As You Go. We offer 1, 2, or 3-year warranty plans.'
    },
    {
      id: 'service-regularly',
      question: 'Do I need to service my car regularly?',
      answer: 'Yes please! Keeping up with your car\'s servicing schedule helps keep your warranty valid. Just follow the manufacturer\'s guidelines and keep your receipts.'
    }
  ];

  const rightColumnFAQs = [
    {
      id: 'how-make-claim',
      question: 'How do I make a claim?',
      answer: 'Arrange for your vehicle to be inspected by a local independent repair garage to diagnose any issues. Once diagnosed, before any repairs are conducted, the repairer must directly contact our Claims Team at 0330 229 5045. It\'s important to note that failure to do so will not allow us to process your claim.'
    },
    {
      id: 'how-much-cost',
      question: 'How much does it cost?',
      answer: 'Warranty costs start from just £12 per month, depending on your vehicle and the level of cover you choose. Get an instant quote by entering your registration number above.'
    },
    {
      id: 'preferred-garage',
      question: 'Can I use my preferred garage for repairs?',
      answer: 'You can use your own garage, including main dealers or local independents, as long as they\'re VAT registered. If the repair cost goes over your claim limit, you may need to pay the difference (top up the extra amount).'
    },
    {
      id: 'cancel-warranty',
      question: 'Can I cancel my warranty?',
      answer: 'You have 14 days to cancel your warranty for a full refund (if no repairs have been made). After this period, our standard cancellation policy applies. Contact us at support@buyawarranty.co.uk or call 0330 229 5040.'
    },
    {
      id: 'transferable',
      question: 'Is the warranty transferable?',
      answer: 'Yes, our warranties can be transferred to a new owner if you sell your car privately—this can help you sell your vehicle and may even increase its value. There\'s a £19.99 fee if you choose to transfer the warranty at the time of purchase. If you decide to transfer it later, the fee is £30, so it\'s worth sorting early for the best deal.'
    }
  ];

  const FAQItem = ({ faq }: { faq: { id: string; question: string; answer: string } }) => (
    <div className="bg-brand-orange rounded-lg overflow-hidden shadow-lg border border-orange-400">
      <button
        onClick={() => toggleItem(faq.id)}
        className="w-full px-6 py-5 text-left flex items-center justify-between text-white hover:bg-orange-600 transition-colors"
      >
        <span className="font-bold text-lg pr-4">{faq.question}</span>
        <ChevronDown 
          className={`w-6 h-6 flex-shrink-0 transition-transform duration-300 text-white ${
            openItems[faq.id] ? 'rotate-180' : ''
          }`}
        />
      </button>
      
      <div className={`overflow-hidden transition-all duration-200 ease-out ${
        openItems[faq.id] 
          ? 'max-h-screen opacity-100 animate-accordion-down' 
          : 'max-h-0 opacity-0'
      }`}>
        <div className="px-6 pb-5 text-gray-800 bg-white border-t border-orange-400">
          <p className="text-base leading-relaxed pt-4 transform translate-y-0 whitespace-pre-line">{renderAnswerWithLinks(faq.answer)}</p>
        </div>
      </div>
    </div>
  );

  return (
    <section className="pt-16 sm:pt-20 pb-8 bg-gray-50">
      <div className="max-w-7xl mx-auto px-6 sm:px-6 lg:px-8">
        {/* Header */}
        <div className="text-center mb-16">
          <h2 className="text-4xl font-bold text-brand-dark-text mb-6 leading-tight">
            <span className="text-brand-orange">FAQ's</span>
          </h2>
          <p className="text-lg text-brand-dark-text max-w-3xl mx-auto leading-relaxed">
            Find answers to the most common questions about our warranty services.
          </p>
        </div>

        {/* FAQ Grid */}
        <div className="grid lg:grid-cols-2 gap-8 max-w-6xl mx-auto">
          {/* Left Column */}
          <div className="space-y-6">
            {leftColumnFAQs.map((faq) => (
              <FAQItem key={faq.id} faq={faq} />
            ))}
          </div>

          {/* Right Column */}
          <div className="space-y-6">
            {rightColumnFAQs.map((faq) => (
              <FAQItem key={faq.id} faq={faq} />
            ))}
          </div>
        </div>

        {/* View All FAQs Button */}
        <div className="text-center mt-12">
          <Link to="/faq/">
            <Button 
              size="lg"
              className="bg-brand-orange hover:bg-brand-orange/90 text-white px-8 py-3 text-lg font-semibold"
            >
              View All FAQs
            </Button>
          </Link>
          <p className="text-sm text-gray-600 mt-3">
            Have more questions? Check out our comprehensive FAQ page for detailed answers.
          </p>
        </div>
      </div>
    </section>
  );
};

export default HomepageFAQ;