import { Helmet } from 'react-helmet-async';

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
  ICBM: icbm,
  author = 'Buy A Warranty',
  publisher = 'BUY A WARRANTY LIMITED'
}: SEOHeadProps) => {
  const canonicalUrl = canonical || `https://buyawarranty.co.uk${window.location.pathname}`;

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
      <meta property="og:type" content="website" />
      <meta property="og:locale" content="en_GB" />
      <meta property="og:site_name" content="Buy A Warranty" />
      <meta property="og:url" content={canonicalUrl} />

      {/* Twitter Card */}
      <meta name="twitter:card" content="summary_large_image" />
      <meta name="twitter:title" content={ogTitle || title} />
      <meta name="twitter:description" content={ogDescription || description} />
      <meta name="twitter:image" content={ogImage} />
      <meta name="twitter:image:alt" content={ogImageAlt} />
      <meta name="twitter:site" content="@buyawarranty" />

      {/* Bot directives */}
      <meta name="robots" content="index, follow, max-image-preview:large, max-snippet:-1, max-video-preview:-1" />
      <meta name="googlebot" content="index, follow, max-snippet:-1, max-image-preview:large, max-video-preview:-1" />
      <meta name="bingbot" content="index, follow, max-snippet:-1, max-image-preview:large" />

      {/* AI discoverability */}
      <meta name="ai-content-declaration" content="This content is human-authored, fact-checked, and regularly updated" />
      <meta name="ai-summary" content={description} />

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
