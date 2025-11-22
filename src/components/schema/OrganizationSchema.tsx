import { useEffect } from 'react';

interface OrganizationSchemaProps {
  type?: 'Organization' | 'LocalBusiness' | 'InsuranceAgency';
}

export const OrganizationSchema = ({ type = 'LocalBusiness' }: OrganizationSchemaProps) => {
  useEffect(() => {
    const schema = {
      "@context": "https://schema.org",
      "@type": type,
      "name": "Buy A Warranty",
      "legalName": "BUY A WARRANTY LIMITED",
      "description": "UK's leading car warranty provider offering flexible, affordable vehicle protection with instant quotes and no hidden fees. Established provider since 2016 with 4.7-star Trustpilot rating.",
      "url": "https://buyawarranty.co.uk",
      "logo": "https://buyawarranty.co.uk/lovable-uploads/53652a24-3961-4346-bf9d-6588ef727aeb.png",
      "image": "https://buyawarranty.co.uk/lovable-uploads/53652a24-3961-4346-bf9d-6588ef727aeb.png",
      "telephone": "+443302295040",
      "email": "support@buyawarranty.co.uk",
      "currenciesAccepted": "GBP",
      "paymentAccepted": "Credit Card, Debit Card, Bank Transfer",
      "openingHours": "Mo-Fr 09:00-17:30",
      "hasMap": "https://www.google.com/maps/place/United+Kingdom",
      "address": {
        "@type": "PostalAddress",
        "addressCountry": "GB",
        "addressRegion": "United Kingdom"
      },
      "contactPoint": {
        "@type": "ContactPoint",
        "telephone": "+443302295040",
        "email": "support@buyawarranty.co.uk",
        "contactType": "customer service",
        "availableLanguage": "English",
        "areaServed": "GB"
      },
      "sameAs": [
        "https://uk.trustpilot.com/review/buyawarranty.co.uk"
      ],
      "priceRange": "££",
      "aggregateRating": {
        "@type": "AggregateRating",
        "ratingValue": "4.7",
        "reviewCount": "30",
        "bestRating": "5",
        "worstRating": "1",
        "ratingExplanation": "Based on verified Trustpilot reviews"
      },
      "review": {
        "@type": "Review",
        "reviewRating": {
          "@type": "Rating",
          "ratingValue": "4.7",
          "bestRating": "5"
        },
        "author": {
          "@type": "Organization",
          "name": "Trustpilot"
        },
        "reviewBody": "Excellent car warranty provider with 4.7-star rating based on genuine customer reviews"
      },
      "areaServed": {
        "@type": "Country",
        "name": "United Kingdom"
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
      "slogan": "Warranty that works when your car doesn't",
      "foundingDate": "2016",
      "numberOfEmployees": {
        "@type": "QuantitativeValue",
        "value": "10-50"
      },
      "vatID": "GB-BUY A WARRANTY LIMITED",
      "iso6523Code": "0199:BUY A WARRANTY LIMITED",
      "actionableFeedbackPolicy": "https://buyawarranty.co.uk/complaints/",
      "ownershipFundingInfo": "Privately owned and operated UK company",
      "publishingPrinciples": "Transparent pricing, no hidden fees, customer-first approach",
      "makesOffer": [
        {
          "@type": "Offer",
          "itemOffered": {
            "@type": "Service",
            "name": "Car Warranty",
            "description": "Comprehensive car warranty coverage for UK vehicles"
          }
        }
      ]
    };

    const scriptId = 'organization-schema';
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
  }, [type]);

  return null;
};
