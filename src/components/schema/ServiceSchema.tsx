import { useEffect } from 'react';

interface ServiceSchemaProps {
  name: string;
  description: string;
  provider?: string;
  serviceType?: string;
  areaServed?: string;
  url?: string;
  image?: string;
  priceRange?: string;
  aggregateRating?: {
    ratingValue: string;
    reviewCount: string;
  };
}

export const ServiceSchema = ({
  name,
  description,
  provider = 'Buy A Warranty',
  serviceType = 'Extended Warranty Service',
  areaServed = 'United Kingdom',
  url = 'https://buyawarranty.co.uk',
  image = 'https://buyawarranty.co.uk/lovable-uploads/53652a24-3961-4346-bf9d-6588ef727aeb.png',
  priceRange = '££',
  aggregateRating = { ratingValue: '4.7', reviewCount: '30' }
}: ServiceSchemaProps) => {
  useEffect(() => {
    const schema = {
      "@context": "https://schema.org",
      "@type": "Service",
      "name": name,
      "description": description,
      "provider": {
        "@type": "Organization",
        "name": provider,
        "url": "https://buyawarranty.co.uk",
        "logo": image
      },
      "serviceType": serviceType,
      "areaServed": {
        "@type": "Country",
        "name": areaServed
      },
      "url": url,
      "image": image,
      "priceRange": priceRange,
      "hasOfferCatalog": {
        "@type": "OfferCatalog",
        "name": "Mercedes-Benz Warranty Plans",
        "itemListElement": [
          {
            "@type": "Offer",
            "itemOffered": {
              "@type": "Service",
              "name": "Basic Warranty Cover"
            }
          },
          {
            "@type": "Offer",
            "itemOffered": {
              "@type": "Service",
              "name": "Gold Warranty Cover"
            }
          },
          {
            "@type": "Offer",
            "itemOffered": {
              "@type": "Service",
              "name": "Platinum Warranty Cover"
            }
          }
        ]
      },
      "aggregateRating": {
        "@type": "AggregateRating",
        "ratingValue": aggregateRating.ratingValue,
        "reviewCount": aggregateRating.reviewCount,
        "bestRating": "5",
        "worstRating": "1"
      },
      "termsOfService": "https://buyawarranty.co.uk/terms-conditions/",
      "availableChannel": {
        "@type": "ServiceChannel",
        "serviceUrl": "https://buyawarranty.co.uk",
        "servicePhone": "+44 330 229 5040",
        "serviceSmsNumber": "+44 7700 900123"
      }
    };

    const scriptId = 'service-schema';
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
  }, [name, description, provider, serviceType, areaServed, url, image, priceRange, aggregateRating]);

  return null;
};
