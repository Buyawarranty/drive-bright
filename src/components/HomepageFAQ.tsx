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
      id: 'old-high-mileage',
      question: 'Is my car too old or too many miles?',
      answer: 'We cover many older and higher mileage vehicles up to 15 years old and 150,000 miles. Check your instant price to confirm.'
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
      id: 'modified-vehicles',
      question: 'What about modified vehicles?',
      answer: 'Most body modifications are accepted. Call us on 0330 229 5040 or request a call back using the Call us button in the top navigation bar.'
    },
    {
      id: 'claim-limit-choice',
      question: 'What claim limit is right for me?',
      answer: 'It depends on your vehicle and how much protection you want.\n\n£1,000 is ideal for smaller or lower‑cost repairs.\n£2,000 offers broader cover for most mid‑range repairs.\n£3,000 is our most popular option and covers the majority of common faults in full.\n£5,000 provides our highest level of protection and is best suited to newer, higher‑value or more complex vehicles where repair costs can be significantly higher.\n\nEvery plan includes unlimited claims, and you\'re covered up to the value of your vehicle, whichever limit you choose.'
    },
    {
      id: 'most-expensive-repair',
      question: 'What is the most expensive repair you have covered?',
      answer: 'We regularly cover repairs over £1,500 for engines, gearboxes and ECUs. Higher claim limits are available. Check your instant price by entering your registration.'
    }
  ];

  const rightColumnFAQs = [
    {
      id: 'own-garage-hp',
      question: 'Can I use my own garage?',
      answer: 'Yes. Any VAT registered garage is acceptable or we can recommend an approved garage.'
    },
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
      id: 'service-history',
      question: 'Do I need a full service history?',
      answer: 'A reasonable service history is fine. Many vehicles are accepted even if servicing has been missed.'
    },
    {
      id: 'diagnostics-covered',
      question: 'Are diagnostics covered?',
      answer: 'Diagnostics are usually covered when the fault is approved.'
    },
    {
      id: '30-day-wait',
      question: 'Is there a 30‑day wait for new customers?',
      answer: "No - your cover begins immediately. As long as there are no pre‑existing faults on the vehicle, you're protected from the moment your warranty starts. The only things we can't cover are issues that were already present before the plan began."
    }
  ];

  const FAQItem = ({ faq }: { faq: { id: string; question: string; answer: string } }) => (
    <div className="bg-gradient-to-r from-orange-500 to-orange-600 rounded-lg overflow-hidden shadow-lg">
      <button
        onClick={() => toggleItem(faq.id)}
        className="w-full px-6 py-5 text-left flex items-center justify-between text-white hover:bg-orange-600/20 transition-colors"
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
        <div className="px-6 pb-5 bg-white border-t border-orange-200">
          <p className="text-base leading-relaxed pt-4 transform translate-y-0 whitespace-pre-line text-brand-dark-text">{renderAnswerWithLinks(faq.answer)}</p>
        </div>
      </div>
    </div>
  );

  return (
    <section className="pt-16 sm:pt-20 pb-8 bg-white">
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