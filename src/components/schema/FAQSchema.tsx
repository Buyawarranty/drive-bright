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
    question: "What vehicles are eligible for warranty?",
    answer: "Vehicles under 15 years old with less than 150,000 miles are eligible for Buyawarranty cover."
  },
  {
    question: "How quickly can I get a quote?",
    answer: "You can get a simple online quote instantly through the Buyawarranty website."
  },
  {
    question: "What does the warranty cover?",
    answer: "Plans cover mechanical and electrical breakdowns with flexible options based on your driving needs."
  }
];
