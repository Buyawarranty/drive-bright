import { useEffect } from 'react';

interface Review {
  author: string;
  rating: number;
  reviewBody: string;
  datePublished: string;
}

interface ReviewSchemaProps {
  reviews?: Review[];
}

export const ReviewSchema = ({ reviews }: ReviewSchemaProps) => {
  useEffect(() => {
    const defaultReviews = reviews || [
      {
        author: "Trustpilot Verified Customer",
        rating: 5,
        reviewBody: "Extremely helpful service with the cover plan I needed for my range rover, they covered all parts and laboured and were easy to deal with.",
        datePublished: new Date().toISOString().split('T')[0]
      },
      {
        author: "Trustpilot Verified Customer",
        rating: 5,
        reviewBody: "Trustworthy company with great customer service. I needed a full cover with labour for my van and got an all in one packages at an unbelievable price. Well pleased",
        datePublished: new Date().toISOString().split('T')[0]
      },
      {
        author: "Trustpilot Verified Customer",
        rating: 5,
        reviewBody: "It's so hard to find a good car warranty provider. Going through their terms and conditions I found the best match to my car all the coverage and parts and labour good stuff.",
        datePublished: new Date().toISOString().split('T')[0]
      }
    ];

    const schema = {
      "@context": "https://schema.org",
      "@type": "Organization",
      "name": "Buy A Warranty",
      "review": defaultReviews.map(review => ({
        "@type": "Review",
        "author": {
          "@type": "Person",
          "name": review.author
        },
        "reviewRating": {
          "@type": "Rating",
          "ratingValue": review.rating,
          "bestRating": 5,
          "worstRating": 1
        },
        "reviewBody": review.reviewBody,
        "datePublished": review.datePublished,
        "publisher": {
          "@type": "Organization",
          "name": "Trustpilot"
        }
      })),
      "aggregateRating": {
        "@type": "AggregateRating",
        "ratingValue": "4.7",
        "reviewCount": "30",
        "bestRating": "5",
        "worstRating": "1"
      }
    };

    const scriptId = 'review-schema';
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
  }, [reviews]);

  return null;
};
