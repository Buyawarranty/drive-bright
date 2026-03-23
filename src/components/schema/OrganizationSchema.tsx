import { useEffect } from 'react';

interface OrganizationSchemaProps {
  type?: 'Organization' | 'LocalBusiness' | 'InsuranceAgency';
}

export const OrganizationSchema = ({ type = 'LocalBusiness' }: OrganizationSchemaProps) => {
  useEffect(() => {
    const schema = {
      "@context": "https://schema.org",
      "@type": "Organization",
      "name": "Buyawarranty",
      "alternateName": "Car Warranty Uk",
      "url": "https://buyawarranty.co.uk/",
      "logo": "https://buyawarranty.co.uk/extended_warranty_uk-car-trustworthy-reviews.png",
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
      "sameAs": "trustpilot.com/review/buyawarranty.co.uk/"
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
