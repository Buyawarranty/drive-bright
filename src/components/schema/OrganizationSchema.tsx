import { useEffect } from 'react';
import { BUSINESS_POSTAL_ADDRESS, SITE_URL } from '@/lib/seo/businessInfo';

interface OrganizationSchemaProps {
  type?: 'Organization' | 'LocalBusiness' | 'InsuranceAgency';
}

export const OrganizationSchema = ({ type = 'LocalBusiness' }: OrganizationSchemaProps) => {
  useEffect(() => {
    const schema = {
      "@context": "https://schema.org",
      "@type": "Organization",
      "@id": `${SITE_URL}#organization`,
      "name": "Buyawarranty",
      "legalName": "BUY A WARRANTY LIMITED",
      "alternateName": "Buy A Warranty UK",
      "url": `${SITE_URL}/`,
      "logo": "https://buyawarranty.co.uk/extended_warranty_uk-car-trustworthy-reviews.png",
      "email": "support@buyawarranty.co.uk",
      "telephone": "+44-330-229-5040",
      "address": BUSINESS_POSTAL_ADDRESS,
      "areaServed": {
        "@type": "Country",
        "name": "United Kingdom"
      },
      "contactPoint": [
        {
          "@type": "ContactPoint",
          "telephone": "+44-330-229-5040",
          "contactType": "customer service",
          "areaServed": "GB",
          "availableLanguage": "en"
        },
        {
          "@type": "ContactPoint",
          "telephone": "+44-330-229-5045",
          "contactType": "sales",
          "areaServed": "GB",
          "availableLanguage": "en"
        }
      ],
      "sameAs": [
        "https://uk.trustpilot.com/review/buyawarranty.co.uk"
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
