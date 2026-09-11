import React, { Suspense, lazy, useMemo } from 'react';
import { useLocation, useSearchParams } from 'react-router-dom';

const SiteChatWidget = lazy(() => import('@/components/ai-sandbox/SiteChatWidget'));

/**
 * Where Miles (the website chat) is allowed to appear.
 *
 * Shown on: homepage, blog/articles, warranty information and vehicle pages,
 * what's covered / how it works, FAQs and general marketing pages.
 *
 * Never shown on: lead forms, checkout, payment pages, or any multi-step
 * quote/application flow — chat there distracts people mid-purchase.
 */
const BLOCKED_PREFIXES = [
  // Checkout, cart and payments
  '/cart',
  '/checkout',
  '/payment',
  '/payment-received',
  '/payment-fallback',
  '/thank-you',
  '/quote/',
  // Lead forms and application flows
  '/contact-us',
  '/claims',
  '/make-a-claim',
  '/add-evidence',
  '/claim-evidence',
  '/appeals',
  '/complaints',
  '/cancel-warranty',
  '/warranty-transfer',
  '/email-preferences',
  // Staff, customer accounts and internal tools
  '/admin',
  '/admin-dashboard',
  '/auth',
  '/sales-login',
  '/customer-dashboard',
  '/forgot-password',
  '/reset-password',
  '/password-reset',
  '/quick-reset',
  '/request-access',
  '/setup-admin',
  '/update-admin',
  '/widget',
  '/ai-sandbox',
];

export default function GlobalSiteChat() {
  const { pathname } = useLocation();
  const [searchParams] = useSearchParams();

  const show = useMemo(() => {
    const path = pathname.toLowerCase().replace(/\/+$/, '') || '/';

    if (BLOCKED_PREFIXES.some((p) => path === p || path.startsWith(`${p}/`))) return false;

    // The homepage carries the multi-step quote journey in ?step= — keep chat on
    // the landing view only, and drop it as soon as somebody starts a quote.
    if (path === '/') {
      const step = Number(searchParams.get('step') ?? '1');
      if (Number.isFinite(step) && step > 1) return false;
      if (searchParams.get('payment_return')) return false;
    }

    return true;
  }, [pathname, searchParams]);

  if (!show) return null;

  const source = pathname.replace(/^\/|\/$/g, '') || 'homepage';

  return (
    <Suspense fallback={null}>
      <SiteChatWidget source={source} greeting="Hi - need any help?" />
    </Suspense>
  );
}
