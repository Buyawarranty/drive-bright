import React, { useEffect, useState } from 'react';
import { ArrowRight, ShieldCheck } from 'lucide-react';
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from '@/components/ui/alert-dialog';
import {
  readStripeBackGuard,
  clearStripeBackGuard,
} from '@/lib/stripeBackGuard';

/**
 * Mounts globally on every checkout page. When the user comes back from Stripe
 * Checkout via the browser/device back button, we detect it (sentinel guard +
 * popstate / pageshow from bfcache) and ask whether they want to cancel the
 * payment. If they say "No, continue payment" we re-send them to the saved
 * Stripe URL. If "Yes, cancel" we clear the guard and let them stay.
 */
export const StripeBackGuardDialog: React.FC = () => {
  const [open, setOpen] = useState(false);
  const [stripeUrl, setStripeUrl] = useState<string | null>(null);

  useEffect(() => {
    const tryShow = () => {
      const guard = readStripeBackGuard();
      if (guard?.url) {
        setStripeUrl(guard.url);
        setOpen(true);
      }
    };

    // Fired on initial mount (covers the case where user navigates back and
    // the page is freshly rendered) and whenever they pop back to this entry.
    tryShow();

    const onPopState = () => tryShow();
    const onPageShow = (e: PageTransitionEvent) => {
      // bfcache restore on iOS / mobile browsers
      if (e.persisted) tryShow();
    };

    window.addEventListener('popstate', onPopState);
    window.addEventListener('pageshow', onPageShow);
    return () => {
      window.removeEventListener('popstate', onPopState);
      window.removeEventListener('pageshow', onPageShow);
    };
  }, []);

  const handleCancelPayment = () => {
    clearStripeBackGuard();
    setOpen(false);
  };

  const handleResumePayment = () => {
    if (stripeUrl) {
      window.location.href = stripeUrl;
    } else {
      setOpen(false);
    }
  };

  return (
    <AlertDialog open={open}>
      <AlertDialogContent className="max-w-md">
        <AlertDialogHeader>
          <AlertDialogTitle className="text-xl">
            Cancel your payment?
          </AlertDialogTitle>
          <AlertDialogDescription className="text-base text-muted-foreground">
            You were on the secure Stripe payment page. Do you want to cancel
            the payment and return to the checkout, or continue paying?
          </AlertDialogDescription>
        </AlertDialogHeader>
        <AlertDialogFooter className="flex-col sm:flex-row gap-2">
          <AlertDialogAction
            onClick={handleResumePayment}
            className="bg-primary hover:bg-primary/90 text-primary-foreground order-1 sm:order-2"
          >
            No, continue payment
          </AlertDialogAction>
          <AlertDialogCancel
            onClick={handleCancelPayment}
            className="mt-0 order-2 sm:order-1"
          >
            Yes, cancel
          </AlertDialogCancel>
        </AlertDialogFooter>
      </AlertDialogContent>
    </AlertDialog>
  );
};
