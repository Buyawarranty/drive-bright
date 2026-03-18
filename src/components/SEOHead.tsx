import { useEffect } from 'react';

interface SEOHeadProps {
  title?: string;
  description?: string;
  keywords?: string;
  ogTitle?: string;
  ogDescription?: string;
  ogImage?: string;
  ogImageWidth?: string;
  ogImageHeight?: string;
  ogImageAlt?: string;
  canonical?: string;
  geoRegion?: string;
  geoPlacename?: string;
  geoPosition?: string;
  ICBM?: string;
  author?: string;
  publisher?: string;
}

export const SEOHead = ({
  title = "Car Warranty UK | Instant Quotes | Buy A Warranty",
  description = "Get instant car warranty quotes in 60 seconds. UK's trusted warranty provider with 5-star reviews. Flexible plans from £20/month. 14-day money back guarantee. Use code SAVE10NOW for 10% off.",
  keywords = "car warranty UK, vehicle warranty, used car warranty, extended car warranty, warranty prices UK, cheap car warranty, best car warranty, van warranty, EV warranty, motorbike warranty",
  ogTitle,
  ogDescription,
  ogImage = "https://buyawarranty.co.uk/lovable-uploads/53652a24-3961-4346-bf9d-6588ef727aeb.png",
  ogImageWidth = "1200",
  ogImageHeight = "630",
  ogImageAlt = "Buy A Warranty - UK Car Warranty Provider",
  canonical,
  geoRegion = 'GB',
  geoPlacename = 'United Kingdom',
  geoPosition,
  ICBM,
  author = 'Buy A Warranty',
  publisher = 'BUY A WARRANTY LIMITED'
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

    // Open Graph tags with image dimensions and alt text
    updateMetaTag('og:title', ogTitle || title, true);
    updateMetaTag('og:description', ogDescription || description, true);
    updateMetaTag('og:image', ogImage, true);
    updateMetaTag('og:image:width', ogImageWidth, true);
    updateMetaTag('og:image:height', ogImageHeight, true);
    updateMetaTag('og:image:alt', ogImageAlt, true);
    updateMetaTag('og:type', 'website', true);
    updateMetaTag('og:locale', 'en_GB', true);
    updateMetaTag('og:site_name', 'Buy A Warranty', true);

    // Twitter Card meta tags
    updateMetaTag('twitter:card', 'summary_large_image');
    updateMetaTag('twitter:title', ogTitle || title);
    updateMetaTag('twitter:description', ogDescription || description);
    updateMetaTag('twitter:image', ogImage);
    updateMetaTag('twitter:image:alt', ogImageAlt);
    updateMetaTag('twitter:site', '@buyawarranty');

    // Author and Publisher meta tags
    updateMetaTag('author', author);
    updateMetaTag('publisher', publisher);
    
    // Bot directives with max-snippet settings
    updateMetaTag('robots', 'index, follow, max-image-preview:large, max-snippet:-1, max-video-preview:-1');
    updateMetaTag('googlebot', 'index, follow, max-snippet:-1, max-image-preview:large, max-video-preview:-1');
    updateMetaTag('bingbot', 'index, follow, max-snippet:-1, max-image-preview:large');
    
    // AI-specific meta tags for AI search engine discoverability
    updateMetaTag('ai-content-declaration', 'This content is human-authored, fact-checked, and regularly updated');
    updateMetaTag('ai-summary', description);
    
    // Geographic targeting for UK
    updateMetaTag('geo.region', geoRegion);
    updateMetaTag('geo.placename', geoPlacename);
    if (geoPosition) {
      updateMetaTag('geo.position', geoPosition);
    }
    if (ICBM) {
      updateMetaTag('ICBM', ICBM);
    }
    
    // Language and content type
    if (!document.querySelector('meta[http-equiv="content-language"]')) {
      const langMeta = document.createElement('meta');
      langMeta.setAttribute('http-equiv', 'content-language');
      langMeta.content = 'en-GB';
      document.head.appendChild(langMeta);
    }
    
    // Content type
    updateMetaTag('content-type', 'text/html; charset=UTF-8');
    
    // Distribution and coverage
    updateMetaTag('distribution', 'global');
    updateMetaTag('coverage', 'United Kingdom');
    updateMetaTag('target', 'all');
    updateMetaTag('audience', 'all');
    updateMetaTag('rating', 'general');

    // Canonical URL — always set to avoid duplicate content issues
    const canonicalUrl = canonical || `https://buyawarranty.co.uk${window.location.pathname}`;
    let link = document.querySelector('link[rel="canonical"]') as HTMLLinkElement;
    if (link) {
      link.href = canonicalUrl;
    } else {
      link = document.createElement('link');
      link.rel = 'canonical';
      link.href = canonicalUrl;
      document.head.appendChild(link);
    }

    // Also set og:url to match canonical
    updateMetaTag('og:url', canonicalUrl, true);

    // Viewport meta tag (ensure it exists)
    if (!document.querySelector('meta[name="viewport"]')) {
      const viewport = document.createElement('meta');
      viewport.name = 'viewport';
      viewport.content = 'width=device-width, initial-scale=1.0';
      document.head.appendChild(viewport);
    }
  }, [title, description, keywords, ogTitle, ogDescription, ogImage, ogImageWidth, ogImageHeight, ogImageAlt, canonical, geoRegion, geoPlacename, geoPosition, ICBM, author, publisher]);

  return null;
};