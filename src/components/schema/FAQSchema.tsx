import { useEffect } from 'react';

interface FAQ {
  question: string;
  answer: string;
}

interface FAQSchemaProps {
  faqs: FAQ[];
}

export const FAQSchema = ({ faqs }: FAQSchemaProps) => {
  useEffect(() => {
    const schema = {
      "@context": "https://schema.org",
      "@type": "FAQPage",
      "mainEntity": faqs.map(faq => ({
        "@type": "Question",
        "name": faq.question,
        "acceptedAnswer": {
          "@type": "Answer",
          "text": faq.answer
        }
      }))
    };

    const scriptId = 'faq-schema';
    let script = document.getElementById(scriptId) as HTMLScriptElement;
    
    if (script) {
      script.textContent = JSON.stringify(schema);
    } else {
      script = document.createElement('script');
      script.id = scriptId;
      script.type = 'application/ld+json';
      script.textContent = JSON.stringify(schema);
      document.head.appendChild(script);
    }

    return () => {
      const existingScript = document.getElementById(scriptId);
      if (existingScript) {
        existingScript.remove();
      }
    };
  }, [faqs]);

  return null;
};

// Default car warranty FAQs
export const defaultWarrantyFAQs: FAQ[] = [
  {
    question: "What does a car warranty cover?",
    answer: "A car warranty covers repairs to mechanical and electrical components that fail due to manufacturing defects or wear and tear. Coverage typically includes engine, gearbox, turbocharger, electrical systems, and more depending on your plan."
  },
  {
    question: "How much does a car warranty cost in the UK?",
    answer: "Car warranty prices in the UK vary based on your vehicle's make, model, age, and mileage. Plans typically range from £20-£50 per month. Get an instant quote on our website for accurate pricing for your specific vehicle."
  },
  {
    question: "Can I cancel my car warranty?",
    answer: "Yes, you can cancel within 14 days for a full refund. After this cooling-off period, cancellation terms depend on your specific warranty plan. Contact our support team for assistance."
  },
  {
    question: "How quickly can I make a claim?",
    answer: "You can make a claim immediately after your warranty becomes active. Simply contact our UK-based support team on 0330 229 5040, and we'll guide you through the fast, easy claims process."
  },
  {
    question: "Do you cover used cars and older vehicles?",
    answer: "Yes, we offer warranties for used cars and vehicles up to 15 years old with mileage up to 150,000 miles. Coverage options are tailored to your vehicle's age and condition."
  },
  {
    question: "How long does it take to get covered?",
    answer: "You can get covered in just 60 seconds! Simply enter your vehicle details online, choose your plan, and your warranty activates immediately after purchase."
  },
  {
    question: "Is there a discount code available?",
    answer: "Yes! Use code SAVE10NOW for 10% off your first warranty. We also offer referral rewards where you and a friend both save when they purchase using your unique link."
  },
  {
    question: "What makes Buy A Warranty different?",
    answer: "We offer flexible cover options, UK-based support, fast easy claims, 14-day money-back guarantee, and instant online quotes. Our warranties work when your car doesn't, giving you peace of mind on the road."
  }
];
