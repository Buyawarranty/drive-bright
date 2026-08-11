import React, { useEffect, useState } from 'react';
import { ArrowRight, Phone } from 'lucide-react';
import { trackButtonClick } from '@/utils/analytics';

/**
 * Mobile-only sticky CTA bar for blog articles.
 * Scrolls the reader back to the reg-entry box (same journey as the homepage).
 */
const BlogStickyQuoteBar: React.FC<{ targetId?: string }> = ({ targetId = 'blog-reg-quote' }) => {
  const [visible, setVisible] = useState(false);

  useEffect(() => {
    const onScroll = () => setVisible(window.scrollY > 600);
    onScroll();
    window.addEventListener('scroll', onScroll, { passive: true });
    return () => window.removeEventListener('scroll', onScroll);
  }, []);

  const scrollToReg = () => {
    trackButtonClick('blog_sticky_bar_get_quote', { source: 'blog_sticky_bar' });
    const el = document.getElementById(targetId);
    if (el) {
      el.scrollIntoView({ behavior: 'smooth', block: 'center' });
      const input = el.querySelector('input');
      if (input) setTimeout(() => (input as HTMLInputElement).focus(), 500);
    }
  };

  return (
    <div
      className={`fixed inset-x-0 bottom-0 z-50 lg:hidden transition-transform duration-300 ${
        visible ? 'translate-y-0' : 'translate-y-full'
      }`}
      style={{ paddingBottom: 'env(safe-area-inset-bottom)' }}
    >
      <div className="border-t border-slate-200 bg-white/95 px-3 py-2.5 shadow-[0_-4px_16px_rgba(0,0,0,0.12)] backdrop-blur">
        <div className="flex items-center gap-2">
          <a
            href="tel:03302295040"
            aria-label="Call us"
            onClick={() => trackButtonClick('blog_sticky_bar_call', { source: 'blog_sticky_bar' })}
            className="flex h-11 w-11 flex-shrink-0 items-center justify-center rounded-lg border-2 border-[#001F3F] text-[#001F3F]"
          >
            <Phone className="h-5 w-5" />
          </a>
          <button
            type="button"
            onClick={scrollToReg}
            className="flex h-11 min-w-0 flex-1 items-center justify-center gap-2 rounded-lg bg-primary px-4 text-sm font-bold uppercase tracking-wide text-primary-foreground"
          >
            Enter reg — get my price
            <ArrowRight className="h-4 w-4 flex-shrink-0" />
          </button>
        </div>
      </div>
    </div>
  );
};

export default BlogStickyQuoteBar;
