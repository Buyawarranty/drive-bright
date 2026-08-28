import React, { useEffect, useRef, useState } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { Lock, Loader2, ShieldCheck, CreditCard, AlertCircle } from 'lucide-react';
import { toast } from 'sonner';

declare global {
  interface Window {
    WorldpayCheckout?: any;
  }
}

interface Props {
  token: string;
  fee: number;
  onPaid: () => void;
  onFallback: () => void; // redirect to hosted/Stripe payment page
  onUnavailable?: () => void; // custom form can't load — show the hosted-page button
}

type Stage = 'loading' | 'unavailable' | 'form' | 'processing' | 'challenge';

const SDK_URLS: Record<string, string> = {
  live: 'https://access.worldpay.com/checkout-web/v1/checkout.js',
  sandbox: 'https://try.access.worldpay.com/checkout-web/v1/checkout.js',
};

const collectDeviceData = () => {
  const n = window.navigator;
  return {
    acceptHeader: 'text/html,application/xhtml+xml,application/xml;q=0.9,*/*;q=0.8',
    userAgent: n.userAgent,
    browserLanguage: n.language,
    browserScreenHeight: window.screen.height,
    browserScreenWidth: window.screen.width,
    browserJavaEnabled: false,
    browserJavascriptEnabled: true,
    browserColorDepth: String(window.screen.colorDepth),
    browserWindowInnerHeight: window.innerHeight,
    browserWindowInnerWidth: window.innerWidth,
    timeZoneOffsetMinutes: String(new Date().getTimezoneOffset()),
  };
};

const WorldpayCardForm: React.FC<Props> = ({ token, fee, onPaid, onFallback, onUnavailable }) => {
  const [stage, setStage] = useState<Stage>('loading');
  const [cardHolder, setCardHolder] = useState('');
  const [holderError, setHolderError] = useState('');
  const [challenge, setChallenge] = useState<{ url: string; jwt: string; reference: string | null } | null>(null);
  const [txRef, setTxRef] = useState<string | null>(null);
  const checkoutRef = useRef<any>(null);
  const iframeFormRef = useRef<HTMLFormElement | null>(null);

  // Handle 3DS return inside the iframe
  useEffect(() => {
    const handler = async (e: MessageEvent) => {
      if (e?.data !== 'wp3ds-done') return;
      setChallenge(null);
      setStage('processing');
      if (!txRef) return;
      const { data } = await supabase.functions.invoke('worldpay-payment-status', {
        body: { token, transactionReference: txRef },
      });
      if (data?.outcome === 'paid') {
        onPaid();
      } else if (data?.outcome === 'refused') {
        toast.error('Your bank declined the payment. Please try another card.');
        setStage('form');
      } else {
        toast.message('Waiting for your bank to confirm…');
        setTimeout(() => onPaid(), 2500); // re-fetch; confirm may lag a moment
      }
    };
    window.addEventListener('message', handler);
    return () => window.removeEventListener('message', handler);
  }, [txRef, token, onPaid]);

  useEffect(() => {
    let cancelled = false;
    (async () => {
      const { data } = await supabase.functions.invoke('worldpay-checkout-config', { body: { token } });
      if (cancelled) return;
      if (!data?.available) {
        setStage('unavailable');
        onUnavailable?.();
        return;
      }
      try {
        await loadScript(SDK_URLS[data.environment] || SDK_URLS.sandbox);
        if (cancelled || !window.WorldpayCheckout) throw new Error('SDK unavailable');
        checkoutRef.current = new window.WorldpayCheckout({
          id: data.checkoutId,
          form: '#wp-card-form',
          fields: {
            pan: { selector: '#wp-card-pan', placeholder: 'Card number' },
            expiry: { selector: '#wp-card-expiry', placeholder: 'MM / YY' },
            cvv: { selector: '#wp-card-cvv', placeholder: 'CVC' },
          },
          styles: {
            input: {
              'font-size': '15px',
              color: '#1A2B4A',
              'font-family': 'inherit',
            },
            '.is-valid': { color: '#1A2B4A' },
            '.is-invalid': { color: '#dc2626' },
          },
          accessibility: { ariaLabel: true, lang: { locale: 'en-GB' } },
        });
        setStage('form');
      } catch {
        setStage('unavailable');
        onUnavailable?.();
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [token]);

  const pay = () => {
    if (!cardHolder.trim()) {
      setHolderError('Please enter the name on the card');
      return;
    }
    setHolderError('');
    setStage('processing');
    checkoutRef.current?.generateSessionState(async (error: any, sessionState: any) => {
      if (error || !sessionState?.sessionHref) {
        toast.error('Please check your card details and try again.');
        setStage('form');
        return;
      }
      const { data, error: fnError } = await supabase.functions.invoke('worldpay-take-inspection-payment', {
        body: {
          token,
          sessionHref: sessionState.sessionHref,
          cardHolderName: cardHolder.trim(),
          deviceData: collectDeviceData(),
        },
      });
      if (fnError || !data) {
        toast.error('Payment could not be started. Please try again.');
        setStage('form');
        return;
      }
      if (data.outcome === 'authorized' || data.outcome === 'already_paid') {
        onPaid();
        return;
      }
      if (data.outcome === '3dsChallenged' && data.threeDS?.challengeUrl && data.threeDS?.challengeJwt) {
        setTxRef(data.transactionReference);
        setChallenge({
          url: data.threeDS.challengeUrl,
          jwt: data.threeDS.challengeJwt,
          reference: data.threeDS.challengeReference || data.transactionReference,
        });
        setStage('challenge');
        return;
      }
      if (data.outcome === '3dsDeviceDataRequired' && data.threeDS?.challengeUrl) {
        setTxRef(data.transactionReference);
        setChallenge({
          url: data.threeDS.challengeUrl,
          jwt: data.threeDS.challengeJwt,
          reference: data.threeDS.challengeReference || data.transactionReference,
        });
        setStage('challenge');
        return;
      }
      if (data.fallback) {
        toast.error('Card form unavailable — opening the secure payment page instead.');
        onFallback();
        return;
      }
      toast.error(data.error || 'Payment declined. Please try another card.');
      setStage('form');
    });
  };

  if (stage === 'unavailable') return null; // caller keeps the normal hosted/Stripe button

  return (
    <div className="rounded-2xl border border-[#E2E8F0] bg-white overflow-hidden">
      <div className="px-5 py-4 border-b border-[#E2E8F0] bg-[#F4F6F8] flex items-center justify-between">
        <div className="flex items-center gap-2">
          <CreditCard className="h-4 w-4 text-[#1A2B4A]" />
          <span className="text-sm font-bold text-[#1A2B4A]">Card payment</span>
        </div>
        <div className="flex items-center gap-1.5 text-xs text-slate-500">
          <Lock className="h-3.5 w-3.5 text-[#00B67A]" />
          Secured by Worldpay
        </div>
      </div>

      <form
        id="wp-card-form"
        className="p-5 space-y-4"
        onSubmit={(e) => {
          e.preventDefault();
          pay();
        }}
      >
        <div>
          <label className="block text-sm font-medium text-[#1A2B4A] mb-1.5">Name on card *</label>
          <input
            value={cardHolder}
            onChange={(e) => {
              setCardHolder(e.target.value);
              setHolderError('');
            }}
            placeholder="e.g. J Smith"
            autoComplete="cc-name"
            className={`w-full px-3 py-2.5 border rounded-md text-sm bg-white text-slate-900 focus:outline-none focus:ring-2 transition-colors ${
              holderError
                ? 'border-red-500 bg-red-50/40 focus:ring-red-300'
                : 'border-slate-300 focus:ring-[#1A2B4A]/30 focus:border-[#1A2B4A]'
            }`}
          />
          {holderError && <p className="mt-1 text-xs font-medium text-red-600">{holderError}</p>}
        </div>

        <div>
          <label className="block text-sm font-medium text-[#1A2B4A] mb-1.5">Card number *</label>
          <div
            id="wp-card-pan"
            className="w-full px-3 py-2.5 border border-slate-300 rounded-md bg-white focus-within:ring-2 focus-within:ring-[#1A2B4A]/30 focus-within:border-[#1A2B4A] transition-colors min-h-[42px]"
          />
        </div>

        <div className="grid grid-cols-2 gap-4">
          <div>
            <label className="block text-sm font-medium text-[#1A2B4A] mb-1.5">Expiry *</label>
            <div
              id="wp-card-expiry"
              className="w-full px-3 py-2.5 border border-slate-300 rounded-md bg-white focus-within:ring-2 focus-within:ring-[#1A2B4A]/30 focus-within:border-[#1A2B4A] transition-colors min-h-[42px]"
            />
          </div>
          <div>
            <label className="block text-sm font-medium text-[#1A2B4A] mb-1.5">Security code *</label>
            <div
              id="wp-card-cvv"
              className="w-full px-3 py-2.5 border border-slate-300 rounded-md bg-white focus-within:ring-2 focus-within:ring-[#1A2B4A]/30 focus-within:border-[#1A2B4A] transition-colors min-h-[42px]"
            />
          </div>
        </div>

        <button
          type="submit"
          disabled={stage !== 'form'}
          className="w-full inline-flex items-center justify-center gap-2 py-3.5 bg-[#E8541A] hover:bg-[#cf471a] disabled:opacity-60 text-white font-semibold rounded-lg transition-colors shadow-sm"
        >
          {stage === 'processing' || stage === 'loading' ? (
            <Loader2 className="h-4 w-4 animate-spin" />
          ) : (
            <>
              <Lock className="h-4 w-4" />
              Pay now · £{fee.toFixed(2)}
            </>
          )}
        </button>

        <div className="flex items-center justify-center gap-2 text-xs text-slate-500">
          <ShieldCheck className="h-3.5 w-3.5 text-[#00B67A]" />
          Your card details go directly to Worldpay — we never see or store them.
        </div>
      </form>

      {/* 3-D Secure challenge overlay */}
      {stage === 'challenge' && challenge && (
        <div className="fixed inset-0 z-50 bg-black/60 flex items-center justify-center p-4">
          <div className="bg-white rounded-2xl w-full max-w-lg overflow-hidden shadow-xl">
            <div className="px-5 py-3 border-b border-[#E2E8F0] flex items-center gap-2 text-sm font-semibold text-[#1A2B4A]">
              <ShieldCheck className="h-4 w-4 text-[#00B67A]" />
              Confirm with your bank
            </div>
            <iframe
              name="wp-3ds-frame"
              title="Bank verification"
              className="w-full h-[480px]"
            />
            <form
              ref={iframeFormRef}
              method="POST"
              action={challenge.url}
              target="wp-3ds-frame"
              className="hidden"
            >
              <input type="hidden" name="JWT" value={challenge.jwt} />
              {challenge.reference && <input type="hidden" name="MD" value={challenge.reference} />}
            </form>
            <ChallengeAutoSubmit formRef={iframeFormRef} />
          </div>
        </div>
      )}
    </div>
  );
};

const ChallengeAutoSubmit: React.FC<{ formRef: React.RefObject<HTMLFormElement | null> }> = ({ formRef }) => {
  useEffect(() => {
    formRef.current?.submit();
  }, [formRef]);
  return null;
};

function loadScript(src: string) {
  return new Promise<void>((resolve, reject) => {
    if (document.querySelector(`script[src="${src}"]`)) return resolve();
    const s = document.createElement('script');
    s.src = src;
    s.async = true;
    s.onload = () => resolve();
    s.onerror = () => reject(new Error('script load failed'));
    document.head.appendChild(s);
  });
}

export default WorldpayCardForm;
