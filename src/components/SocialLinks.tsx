import React from 'react';
import { Facebook, Instagram } from 'lucide-react';
import { cn } from '@/lib/utils';
import { FACEBOOK_URL, INSTAGRAM_URL, TIKTOK_URL } from '@/constants/social';

const TikTokIcon: React.FC<{ className?: string }> = ({ className }) => (
  <svg
    className={className}
    viewBox="0 0 24 24"
    fill="currentColor"
    aria-hidden="true"
    focusable="false"
  >
    <path d="M12.525.02c1.8-.1 3.37.92 4.16 2.32.22.4.37.85.43 1.32.06.47.07.96.07 1.44v8.24c0 .48-.01.97-.07 1.44-.06.47-.21.92-.43 1.32-.79 1.4-2.36 2.42-4.16 2.32-1.8.1-3.37-.92-4.16-2.32a4.85 4.85 0 0 1-.43-1.32c-.06-.47-.07-.96-.07-1.44V4.8c0-.48.01-.97.07-1.44.06-.47.21-.92.43-1.32C9.155.64 10.725-.38 12.525.02zm6.93 4.66c.14-.02.28-.03.43-.03v3.46c-.15 0-.29-.01-.43-.03-1.14-.15-2.17-.66-2.91-1.4v6.22c0 3.66-2.97 6.63-6.63 6.63S3.67 19.29 3.67 15.63s2.97-6.63 6.63-6.63c.55 0 1.08.07 1.59.2v3.52a3.13 3.13 0 0 0-1.59-.43 3.11 3.11 0 0 0-3.11 3.11 3.11 3.11 0 0 0 3.11 3.11 3.11 3.11 0 0 0 3.11-3.11V0h3.43v.02c.02.15.03.3.03.45 0 1.6.65 3.05 1.7 4.1.75.75 1.72 1.25 2.83 1.4v-.31z" />
  </svg>
);

interface SocialLinksProps {
  variant?: 'light' | 'dark';
  className?: string;
}

const SocialLinks: React.FC<SocialLinksProps> = ({ variant = 'dark', className }) => {
  const isLight = variant === 'light';
  const linkBase = cn(
    'inline-flex items-center justify-center rounded-full transition-colors focus:outline-none focus:ring-2 focus:ring-offset-2',
    isLight
      ? 'text-white/80 hover:text-white bg-white/10 hover:bg-white/20 focus:ring-white/50'
      : 'text-gray-500 hover:text-[#eb4b00] bg-gray-100 hover:bg-gray-200 focus:ring-[#eb4b00]/50',
    'w-10 h-10 sm:w-9 sm:h-9'
  );

  return (
    <div className={cn('flex items-center gap-3', className)} aria-label="Social media links">
      <a
        href={FACEBOOK_URL}
        target="_blank"
        rel="noopener noreferrer"
        aria-label="Buy a Warranty on Facebook"
        className={linkBase}
      >
        <Facebook className="w-5 h-5 sm:w-4 sm:h-4" />
      </a>
      <a
        href={INSTAGRAM_URL}
        target="_blank"
        rel="noopener noreferrer"
        aria-label="Buy a Warranty on Instagram"
        className={linkBase}
      >
        <Instagram className="w-5 h-5 sm:w-4 sm:h-4" />
      </a>
      <a
        href={TIKTOK_URL}
        target="_blank"
        rel="noopener noreferrer"
        aria-label="Buy a Warranty on TikTok"
        className={linkBase}
      >
        <TikTokIcon className="w-5 h-5 sm:w-4 sm:h-4" />
      </a>
    </div>
  );
};

export default SocialLinks;
