import { useEffect } from 'react';

interface LocalBusinessSchemaProps {
  name?: string;
  telephone?: string;
  email?: string;
  address?: {
    streetAddress?: string;
    addressLocality?: string;
    addressRegion?: string;
    postalCode?: string;
    addressCountry?: string;
  };
  geo?: {
    latitude?: number;
    longitude?: number;
  };
  openingHours?: string;
  priceRange?: string;
  areaServed?: string;
  url?: string;
}

export const LocalBusinessSchema = ({
  name = 'Buy A Warranty',
  telephone = '+443302295040',
  email = 'support@buyawarranty.co.uk',
  address = {
    streetAddress: 'United Kingdom',
    addressLocality: 'London',
    addressRegion: 'England',
    postalCode: '',
    addressCountry: 'GB'
  },
  geo = {
    latitude: 51.5074,
    longitude: -0.1278
  },
  openingHours = 'Mo-Fr 09:00-17:30',
  priceRange = '££',
  areaServed = 'GB',
  url = 'https://buyawarranty.co.uk'
}: LocalBusinessSchemaProps) => {
  useEffect(() => {
    const schema = {
      "@context": "https://schema.org",
      "@type": "LocalBusiness",
      "@id": `${url}#localbusiness`,
      "name": name,
      "description": "UK's leading car warranty provider offering flexible, affordable vehicle protection with instant quotes and no hidden fees.",
      "url": url,
      "logo": "https://buyawarranty.co.uk/lovable-uploads/53652a24-3961-4346-bf9d-6588ef727aeb.png",
      "image": "https://buyawarranty.co.uk/lovable-uploads/53652a24-3961-4346-bf9d-6588ef727aeb.png",
      "telephone": telephone,
      "email": email,
      "address": {
        "@type": "PostalAddress",
        "streetAddress": address.streetAddress,
        "addressLocality": address.addressLocality,
        "addressRegion": address.addressRegion,
        "postalCode": address.postalCode,
        "addressCountry": address.addressCountry
      },
      "geo": {
        "@type": "GeoCoordinates",
        "latitude": geo.latitude,
        "longitude": geo.longitude
      },
      "openingHoursSpecification": {
        "@type": "OpeningHoursSpecification",
        "dayOfWeek": ["Monday", "Tuesday", "Wednesday", "Thursday", "Friday"],
        "opens": "09:00",
        "closes": "17:30"
      },
      "priceRange": priceRange,
      "currenciesAccepted": "GBP",
      "paymentAccepted": "Credit Card, Debit Card, Bank Transfer",
      "areaServed": {
        "@type": "Country",
        "name": "United Kingdom"
      },
      "hasMap": "https://www.google.com/maps/place/United+Kingdom",
      "sameAs": [
        "https://uk.trustpilot.com/review/buyawarranty.co.uk"
      ],
      "aggregateRating": {
        "@type": "AggregateRating",
        "ratingValue": "4.7",
        "reviewCount": "30",
        "bestRating": "5",
        "worstRating": "1"
      },
      "knowsAbout": [
        "Car Warranty",
        "Vehicle Warranty",
        "Extended Warranty",
        "Used Car Warranty",
        "Van Warranty",
        "EV Warranty",
        "Motorbike Warranty"
      ],
      "foundingDate": "2016",
      "legalName": "BUY A WARRANTY LIMITED"
    };

    const scriptId = 'local-business-schema';
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
  }, [name, telephone, email, address, geo, openingHours, priceRange, areaServed, url]);

  return null;
};
