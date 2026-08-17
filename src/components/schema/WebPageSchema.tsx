import { useEffect } from 'react';

interface WebPageSchemaProps {
  name: string;
  description: string;
  url: string;
  lastReviewed?: string;
  significantLink?: string;
  specialty?: string;
}

export const WebPageSchema = ({ 
  name, 
  description, 
  url,
  lastReviewed = new Date().toISOString().split('T')[0],
  significantLink = "https://www.trustpilot.com/review/buyawarranty.co.uk",
  specialty = "Car Warranty, Vehicle Warranty, Extended Warranty"
}: WebPageSchemaProps) => {
  useEffect(() => {
    const schema = {
      "@context": "https://schema.org",
      "@type": "WebPage",
      "name": name,
      "description": description,
      "url": url,
      "lastReviewed": lastReviewed,
      "reviewedBy": {
        "@type": "Organization",
        "name": "Buy A Warranty"
      },
      "mainEntity": {
        "@type": "LocalBusiness",
        "@id": "https://buyawarranty.co.uk/#localbusiness",
        "name": "Buy A Warranty",
        "legalName": "BUY A WARRANTY LIMITED",
        "url": "https://buyawarranty.co.uk/",
        "description": "Active UK car warranty provider since 2016",
        "image": "https://buyawarranty.co.uk/extended_warranty_uk-car-trustworthy-reviews.png",
        "logo": "https://buyawarranty.co.uk/extended_warranty_uk-car-trustworthy-reviews.png",
        "telephone": "+44-330-229-5040",
        "email": "support@buyawarranty.co.uk",
        "priceRange": "££",
        "currenciesAccepted": "GBP",
        "paymentAccepted": "Credit Card, Debit Card, Bank Transfer",
        "address": {
          "@type": "PostalAddress",
          "streetAddress": "Warranty House, 62 Berkhamsted Avenue",
          "addressLocality": "Wembley",
          "addressRegion": "London",
          "postalCode": "HA9 6DT",
          "addressCountry": "GB"
        },
        "geo": {
          "@type": "GeoCoordinates",
          "latitude": 51.5626,
          "longitude": -0.2789
        },
        "openingHoursSpecification": [
          {
            "@type": "OpeningHoursSpecification",
            "dayOfWeek": ["Monday", "Tuesday", "Wednesday", "Thursday", "Friday"],
            "opens": "09:00",
            "closes": "17:30"
          }
        ],
        "areaServed": { "@type": "Country", "name": "United Kingdom" },
        "sameAs": ["https://uk.trustpilot.com/review/buyawarranty.co.uk"],
        "foundingDate": "2016",
        "knowsAbout": specialty,
        "slogan": "Warranty that works when your car doesn't"
      },

      "significantLink": significantLink,
      "speakable": {
        "@type": "SpeakableSpecification",
        "cssSelector": ["h1", "h2", ".faq-question"]
      },
      "publisher": {
        "@type": "Organization",
        "name": "Buy A Warranty",
        "legalName": "BUY A WARRANTY LIMITED",
        "url": "https://buyawarranty.co.uk"
      }
    };

    const scriptId = 'webpage-schema';
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
  }, [name, description, url, lastReviewed, significantLink, specialty]);

  return null;
};
