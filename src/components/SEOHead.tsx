import { useEffect } from 'react';
import { Helmet } from 'react-helmet-async';

const SITE_ORIGIN = 'https://buyawarranty.co.uk';

/** Social + AI crawlers need absolute image URLs. */
const absoluteUrl = (url: string) =>
  url.startsWith('http') ? url : `${SITE_ORIGIN}${url.startsWith('/') ? '' : '/'}${url}`;


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
  noindex?: boolean;
  /** Use "article" on editorial pages so Google/Meta/Discover treat it as news-style content */
  ogType?: string;
  /** ISO timestamps for article freshness signals (Discover + AI answer engines) */
  publishedTime?: string;
  modifiedTime?: string;
  articleSection?: string;
  articleTags?: string[];
}


// Canonical URLs always use a single trailing-slash form so that
// /faq and /faq/ never compete as duplicates in Google's index.
const normalisePath = (pathname: string) =>
  pathname === '/' || pathname.endsWith('/') ? pathname : `${pathname}/`;


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
  ICBM: icbm,
  author = 'Buy A Warranty',
  publisher = 'BUY A WARRANTY LIMITED',
  noindex = false,
  ogType = 'website',
  publishedTime,
  modifiedTime,
  articleSection,
  articleTags

}: SEOHeadProps) => {
  const canonicalUrl = canonical || `https://buyawarranty.co.uk${normalisePath(window.location.pathname)}`;


  return (
    <Helmet>
      <title>{title}</title>

      {/* Basic meta tags */}
      <meta name="description" content={description} />
      <meta name="keywords" content={keywords} />
      <meta name="author" content={author} />
      <meta name="publisher" content={publisher} />

      {/* Canonical */}
      <link rel="canonical" href={canonicalUrl} />

      {/* Open Graph */}
      <meta property="og:title" content={ogTitle || title} />
      <meta property="og:description" content={ogDescription || description} />
      <meta property="og:image" content={ogImage} />
      <meta property="og:image:width" content={ogImageWidth} />
      <meta property="og:image:height" content={ogImageHeight} />
      <meta property="og:image:alt" content={ogImageAlt} />
      <meta property="og:type" content={ogType} />
      <meta property="og:locale" content="en_GB" />
      <meta property="og:site_name" content="Buy A Warranty" />
      <meta property="og:url" content={canonicalUrl} />
      {publishedTime && <meta property="article:published_time" content={publishedTime} />}
      {modifiedTime && <meta property="article:modified_time" content={modifiedTime} />}
      {articleSection && <meta property="article:section" content={articleSection} />}
      {(articleTags || []).slice(0, 8).map((tag) => (
        <meta key={tag} property="article:tag" content={tag} />
      ))}


      {/* Twitter Card */}
      <meta name="twitter:card" content="summary_large_image" />
      <meta name="twitter:title" content={ogTitle || title} />
      <meta name="twitter:description" content={ogDescription || description} />
      <meta name="twitter:image" content={ogImage} />
      <meta name="twitter:image:alt" content={ogImageAlt} />
      <meta name="twitter:site" content="@buyawarranty" />

      {/* Bot directives */}
      {noindex ? (
        <meta name="robots" content="noindex, follow" />
      ) : (
        <meta name="robots" content="index, follow, max-image-preview:large, max-snippet:-1, max-video-preview:-1" />
      )}
      {!noindex && <meta name="googlebot" content="index, follow, max-snippet:-1, max-image-preview:large, max-video-preview:-1" />}
      {!noindex && <meta name="bingbot" content="index, follow, max-snippet:-1, max-image-preview:large" />}
      {!noindex && <meta name="google" content="notranslate" />}

      {/* AI answer-engine crawlers — explicitly allowed to read and cite */}
      {!noindex && <meta name="GPTBot" content="index, follow" />}
      {!noindex && <meta name="OAI-SearchBot" content="index, follow" />}
      {!noindex && <meta name="ChatGPT-User" content="index, follow" />}
      {!noindex && <meta name="ClaudeBot" content="index, follow" />}
      {!noindex && <meta name="anthropic-ai" content="index, follow" />}
      {!noindex && <meta name="Google-Extended" content="index, follow" />}
      {!noindex && <meta name="PerplexityBot" content="index, follow" />}
      {!noindex && <meta name="Applebot-Extended" content="index, follow" />}
      {!noindex && <meta name="CCBot" content="index, follow" />}

      {/* AI discoverability */}
      <meta name="ai-content-declaration" content="This content is human-authored, fact-checked, and regularly updated" />
      <meta name="ai-summary" content={description} />
      <link rel="llms-txt" href="https://buyawarranty.co.uk/llms.txt" />


      {/* Geographic targeting */}
      <meta name="geo.region" content={geoRegion} />
      <meta name="geo.placename" content={geoPlacename} />
      {geoPosition && <meta name="geo.position" content={geoPosition} />}
      {icbm && <meta name="ICBM" content={icbm} />}

      {/* Distribution */}
      <meta name="distribution" content="global" />
      <meta name="coverage" content="United Kingdom" />
      <meta name="target" content="all" />
      <meta name="audience" content="all" />
      <meta name="rating" content="general" />
      <meta name="content-type" content="text/html; charset=UTF-8" />
      <meta httpEquiv="content-language" content="en-GB" />
    </Helmet>
  );
};
