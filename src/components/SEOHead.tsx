import { useEffect } from 'react';

interface SEOHeadProps {
  title?: string;
  description?: string;
  keywords?: string;
  ogTitle?: string;
  ogDescription?: string;
  ogImage?: string;
  canonical?: string;
  geoRegion?: string;
  geoPlacename?: string;
  geoPosition?: string;
  ICBM?: string;
}

export const SEOHead = ({
  title = "Car Warranty UK | Instant Quotes | Buy A Warranty",
  description = "Get instant car warranty quotes in 60 seconds. UK's trusted warranty provider with 5-star reviews. Flexible plans from £20/month. 14-day money back guarantee. Use code SAVE10NOW for 10% off.",
  keywords = "car warranty UK, vehicle warranty, used car warranty, extended car warranty, warranty prices UK, cheap car warranty, best car warranty, van warranty, EV warranty, motorbike warranty",
  ogTitle,
  ogDescription,
  ogImage = "https://buyawarranty.co.uk/lovable-uploads/53652a24-3961-4346-bf9d-6588ef727aeb.png",
  canonical,
  geoRegion = 'GB',
  geoPlacename = 'United Kingdom',
  geoPosition,
  ICBM
}: SEOHeadProps) => {
  useEffect(() => {
    // Update document title
    document.title = title;

    // Update or create meta tags
    const updateMetaTag = (property: string, content: string, isProperty = false) => {
      const attribute = isProperty ? 'property' : 'name';
      let meta = document.querySelector(`meta[${attribute}="${property}"]`) as HTMLMetaElement;
      
      if (meta) {
        meta.content = content;
      } else {
        meta = document.createElement('meta');
        meta.setAttribute(attribute, property);
        meta.content = content;
        document.head.appendChild(meta);
      }
    };

    // Basic meta tags
    updateMetaTag('description', description);
    updateMetaTag('keywords', keywords);

    // Open Graph tags
    updateMetaTag('og:title', ogTitle || title, true);
    updateMetaTag('og:description', ogDescription || description, true);
    updateMetaTag('og:image', ogImage, true);
    updateMetaTag('og:type', 'website', true);

    // Twitter tags
    updateMetaTag('twitter:card', 'summary_large_image');
    updateMetaTag('twitter:title', ogTitle || title);
    updateMetaTag('twitter:description', ogDescription || description);
    updateMetaTag('twitter:image', ogImage);

    // Additional SEO meta tags
    updateMetaTag('author', 'Buy A Warranty');
    updateMetaTag('robots', 'index, follow, max-image-preview:large, max-snippet:-1, max-video-preview:-1');
    updateMetaTag('googlebot', 'index, follow');
    updateMetaTag('bingbot', 'index, follow');
    
    // AI Search Engine meta tags
    updateMetaTag('ai-content-declaration', 'This content is human-authored and fact-checked');
    
    // Geographic targeting
    updateMetaTag('geo.region', geoRegion);
    updateMetaTag('geo.placename', geoPlacename);
    if (geoPosition) {
      updateMetaTag('geo.position', geoPosition);
    }
    if (ICBM) {
      updateMetaTag('ICBM', ICBM);
    }
    
    // Language
    if (!document.querySelector('meta[http-equiv="content-language"]')) {
      const langMeta = document.createElement('meta');
      langMeta.setAttribute('http-equiv', 'content-language');
      langMeta.content = 'en-GB';
      document.head.appendChild(langMeta);
    }

    // Canonical URL
    if (canonical) {
      let link = document.querySelector('link[rel="canonical"]') as HTMLLinkElement;
      if (link) {
        link.href = canonical;
      } else {
        link = document.createElement('link');
        link.rel = 'canonical';
        link.href = canonical;
        document.head.appendChild(link);
      }
    }

    // Viewport meta tag (ensure it exists)
    if (!document.querySelector('meta[name="viewport"]')) {
      const viewport = document.createElement('meta');
      viewport.name = 'viewport';
      viewport.content = 'width=device-width, initial-scale=1.0';
      document.head.appendChild(viewport);
    }
  }, [title, description, keywords, ogTitle, ogDescription, ogImage, canonical, geoRegion, geoPlacename, geoPosition, ICBM]);

  return null;
};