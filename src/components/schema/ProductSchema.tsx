import { useEffect } from 'react';

interface ProductSchemaProps {
  name: string;
  description: string;
  price?: string;
  priceCurrency?: string;
  brand?: string;
  category?: string;
  image?: string;
  availability?: string;
  areaServed?: string;
}

export const ProductSchema = ({
  name,
  description,
  price,
  priceCurrency = 'GBP',
  brand = 'Buy A Warranty',
  category = 'Vehicle Warranty',
  image = 'https://buyawarranty.co.uk/lovable-uploads/53652a24-3961-4346-bf9d-6588ef727aeb.png',
  availability = 'InStock',
  areaServed = 'GB'
}: ProductSchemaProps) => {
  useEffect(() => {
    const schema = {
      "@context": "https://schema.org",
      "@type": "Product",
      "name": name,
      "description": description,
      "brand": {
        "@type": "Brand",
        "name": brand
      },
      "image": image,
      "category": category,
      ...(areaServed && {
        "areaServed": {
          "@type": "Country",
          "name": areaServed === 'GB' ? 'United Kingdom' : areaServed
        }
      }),
      ...(price && {
        "offers": {
          "@type": "Offer",
          "price": price,
          "priceCurrency": priceCurrency,
          "availability": availability === 'InStock' ? "https://schema.org/InStock" : `https://schema.org/${availability}`,
          "url": "https://buyawarranty.co.uk",
          "priceValidUntil": new Date(new Date().setFullYear(new Date().getFullYear() + 1)).toISOString().split('T')[0],
          "seller": {
            "@type": "Organization",
            "name": "Buy A Warranty"
          }
        }
      }),
      "aggregateRating": {
        "@type": "AggregateRating",
        "ratingValue": "5",
        "reviewCount": "100",
        "bestRating": "5",
        "worstRating": "1"
      }
    };

    const scriptId = 'product-schema';
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
  }, [name, description, price, priceCurrency, brand, category, image, availability, areaServed]);

  return null;
};
