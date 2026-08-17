import React from 'react';
import { Link } from 'react-router-dom';

export interface RelatedInternalLink {
  to: string;
  label: string;
}

interface RelatedInternalLinksProps {
  links: RelatedInternalLink[];
  heading?: string;
}

/**
 * Small contextual internal-link strip used for SEO interlinking.
 * Purely presentational — adds keyword-anchored links to related pages.
 */
export const RelatedInternalLinks: React.FC<RelatedInternalLinksProps> = ({
  links,
  heading = 'Related reading',
}) => {
  if (!links?.length) return null;

  return (
    <section className="py-8 bg-white border-t border-gray-100">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
        <h2 className="text-base font-semibold text-gray-900 mb-2">{heading}</h2>
        <p className="text-sm text-gray-700">
          {links.map((link, index) => (
            <React.Fragment key={link.to + link.label}>
              {index > 0 && <span className="text-gray-400"> · </span>}
              <Link
                to={link.to}
                className="text-[#eb4b00] underline hover:no-underline"
              >
                {link.label}
              </Link>
            </React.Fragment>
          ))}
        </p>
      </div>
    </section>
  );
};

export default RelatedInternalLinks;
