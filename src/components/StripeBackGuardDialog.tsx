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
      <AlertDialogContent className="w-[calc(100%-2rem)] max-w-md sm:max-w-lg rounded-2xl p-6 sm:p-8 shadow-2xl border-2">
        <AlertDialogHeader className="text-left">
          <div className="mb-3 inline-flex h-12 w-12 items-center justify-center rounded-full bg-primary/10">
            <ShieldCheck className="h-6 w-6 text-primary" />
          </div>
          <AlertDialogTitle className="text-2xl font-bold">
            Cancel your payment?
          </AlertDialogTitle>
          <AlertDialogDescription className="text-base text-muted-foreground leading-relaxed">
            You were on the secure payment page. Do you want to cancel
            the payment and return to the checkout, or continue paying?
          </AlertDialogDescription>
        </AlertDialogHeader>
        <AlertDialogFooter className="flex-col sm:flex-row gap-2 sm:gap-3 mt-2">
          <AlertDialogCancel
            onClick={handleCancelPayment}
            className="mt-0 order-2 sm:order-1 sm:flex-1"
          >
            Yes, cancel
          </AlertDialogCancel>
          <AlertDialogAction
            onClick={handleResumePayment}
            className="bg-primary hover:bg-primary/90 text-primary-foreground order-1 sm:order-2 sm:flex-1 group font-semibold shadow-md hover:shadow-lg transition-all"
          >
            No, continue payment
            <ArrowRight className="ml-2 h-5 w-5 stroke-[3] transition-transform group-hover:translate-x-1" />
          </AlertDialogAction>
        </AlertDialogFooter>
      </AlertDialogContent>
    </AlertDialog>
  );
};
