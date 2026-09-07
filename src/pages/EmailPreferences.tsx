import React from 'react';
import { Link, useSearchParams } from 'react-router-dom';
import { CheckCircle, AlertCircle, Mail } from 'lucide-react';
import { SEOHead } from '@/components/SEOHead';
import WebsiteFooter from '@/components/WebsiteFooter';

/**
 * Landing page for the unsubscribe / re-subscribe links in our emails.
 *
 * Why this page exists: the Supabase functions gateway serves function
 * responses as text/plain, so HTML returned straight from the unsubscribe
 * function showed up in some browsers as raw markup. The functions now do the
 * work and redirect here, so customers always land on a real branded page.
 */

const FUNCTIONS_BASE = `${import.meta.env.VITE_SUPABASE_URL}/functions/v1`;

type StateKey =
  | 'unsubscribed'
  | 'essentials'
  | 'resubscribed'
  | 'invalid'
  | 'missing-email'
  | 'error';

const EmailPreferences: React.FC = () => {
  const [params] = useSearchParams();
  const state = (params.get('state') || 'unsubscribed') as StateKey;
  const email = (params.get('email') || '').trim();
  const token = params.get('token') || '';

  const unsubUrl = `${FUNCTIONS_BASE}/handle-email-unsubscribe?email=${encodeURIComponent(email)}&token=${encodeURIComponent(token)}&choice=off`;
  const essentialsUrl = `${FUNCTIONS_BASE}/handle-email-unsubscribe?email=${encodeURIComponent(email)}&token=${encodeURIComponent(token)}&choice=essentials`;
  const resubUrl = `${FUNCTIONS_BASE}/handle-email-resubscribe?email=${encodeURIComponent(email)}`;

  const isProblem = state === 'invalid' || state === 'missing-email' || state === 'error';

  const content: Record<StateKey, { title: string; body: React.ReactNode; links: React.ReactNode }> = {
    unsubscribed: {
      title: 'You have been unsubscribed',
      body: (
        <>
          {email ? <strong>{email}</strong> : 'Your email address'} has been removed from our marketing
          email list. You will not receive promotional emails from Buy A Warranty again.
          <br />
          <br />
          Policy documents, renewal paperwork and claims updates will still come through, as we are
          required to send those.
        </>
      ),
      links: (
        <>
          <a href={essentialsUrl} className="text-primary underline">
            Actually, just send me the essentials (3-4 emails a year)
          </a>
          <a href={resubUrl} className="text-primary underline">
            Changed your mind? Re-subscribe in one click
          </a>
        </>
      ),
    },
    essentials: {
      title: "You're on the essentials list",
      body: (
        <>
          We will only send {email ? <strong>{email}</strong> : 'you'} the important things — renewal
          reminders and the occasional claims tip. About 3-4 emails a year, no promotions and no
          newsletters.
        </>
      ),
      links: (
        <a href={unsubUrl} className="text-primary underline">
          Stop marketing emails completely
        </a>
      ),
    },
    resubscribed: {
      title: 'Welcome back',
      body: (
        <>
          {email ? <strong>{email}</strong> : 'Your email address'} is back on the list. You will now
          receive our renewal discounts, free cover upgrades and members-only offers.
        </>
      ),
      links: (
        <a href={`${resubUrl}&choice=essentials`} className="text-primary underline">
          Prefer fewer emails? Just send me the essentials
        </a>
      ),
    },
    invalid: {
      title: 'This link has expired',
      body: (
        <>
          We could not confirm this unsubscribe link. Email us and we will take you off the list
          straight away.
        </>
      ),
      links: (
        <a href="mailto:support@buyawarranty.co.uk" className="text-primary underline">
          support@buyawarranty.co.uk
        </a>
      ),
    },
    'missing-email': {
      title: 'We could not read your email address',
      body: <>The link did not include an email address, so we could not update your preferences.</>,
      links: (
        <a href="mailto:support@buyawarranty.co.uk" className="text-primary underline">
          Email support@buyawarranty.co.uk and we will remove you manually
        </a>
      ),
    },
    error: {
      title: 'Something went wrong',
      body: <>We could not update your email preferences just then. Please get in touch and we will sort it.</>,
      links: (
        <a href="mailto:support@buyawarranty.co.uk" className="text-primary underline">
          support@buyawarranty.co.uk
        </a>
      ),
    },
  };

  const { title, body, links } = content[state] ?? content.unsubscribed;

  return (
    <div className="min-h-screen bg-muted/30 flex flex-col">
      <SEOHead
        title="Email preferences | Buy A Warranty"
        description="Manage the marketing emails you receive from Buy A Warranty, or unsubscribe completely."
        noindex
      />
      <main className="flex-1 flex items-center justify-center px-4 py-16">
        <div className="w-full max-w-xl bg-card border-2 border-border rounded-xl shadow-lg p-8 sm:p-12 text-center">
          <div className="flex justify-center mb-6">
            <span
              className={`inline-flex h-14 w-14 items-center justify-center rounded-full ${
                isProblem ? 'bg-destructive/10 text-destructive' : 'bg-primary/10 text-primary'
              }`}
            >
              {isProblem ? (
                <AlertCircle className="h-7 w-7" />
              ) : state === 'unsubscribed' ? (
                <Mail className="h-7 w-7" />
              ) : (
                <CheckCircle className="h-7 w-7" />
              )}
            </span>
          </div>

          <h1 className="text-2xl sm:text-3xl font-bold text-foreground mb-4">{title}</h1>
          <p className="text-base text-muted-foreground leading-relaxed">{body}</p>

          <div className="mt-8 flex flex-col gap-3 text-sm">{links}</div>

          <div className="mt-10">
            <Link
              to="/"
              className="inline-block bg-primary text-primary-foreground font-semibold rounded-md px-6 py-3"
            >
              Back to Buy A Warranty
            </Link>
          </div>
        </div>
      </main>
      <WebsiteFooter />
    </div>
  );
};

export default EmailPreferences;
