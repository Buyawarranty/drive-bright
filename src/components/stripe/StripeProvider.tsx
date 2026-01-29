import React, { useState, useEffect } from 'react';
import { loadStripe, Stripe } from '@stripe/stripe-js';
import { Elements } from '@stripe/react-stripe-js';
import { Loader2 } from 'lucide-react';

// Get Stripe publishable key from environment
// This is a publishable key (starts with pk_) and is safe to expose in frontend code
const stripePublishableKey = import.meta.env.VITE_STRIPE_PUBLISHABLE_KEY || '';

// Lazy load Stripe to avoid blocking initial render
let stripePromise: Promise<Stripe | null> | null = null;

const getStripe = () => {
  if (!stripePromise && stripePublishableKey) {
    stripePromise = loadStripe(stripePublishableKey);
  }
  return stripePromise;
};

// Stripe Elements appearance configuration - BuyAWarranty brand themed
const appearance = {
  theme: 'stripe' as const,
  variables: {
    colorPrimary: '#E65100',
    colorBackground: '#ffffff',
    colorText: '#1a1a1a',
    colorDanger: '#dc2626',
    fontFamily: 'system-ui, -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, sans-serif',
    spacingUnit: '4px',
    borderRadius: '8px',
    fontSizeBase: '16px',
  },
  rules: {
    '.Input': {
      border: '1px solid #e5e7eb',
      boxShadow: 'none',
      padding: '12px 14px',
    },
    '.Input:focus': {
      border: '2px solid #E65100',
      boxShadow: '0 0 0 1px #E65100',
    },
    '.Input--invalid': {
      border: '1px solid #dc2626',
    },
    '.Label': {
      fontWeight: '500',
      marginBottom: '8px',
    },
    '.Error': {
      color: '#dc2626',
      fontSize: '14px',
    },
  },
};

interface StripeProviderProps {
  children: React.ReactNode;
  clientSecret: string;
}

export const StripeProvider: React.FC<StripeProviderProps> = ({ children, clientSecret }) => {
  const [stripe, setStripe] = useState<Stripe | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    const loadStripeInstance = async () => {
      try {
        if (!stripePublishableKey) {
          setError('Stripe publishable key not configured. Please add VITE_STRIPE_PUBLISHABLE_KEY to your environment.');
          setIsLoading(false);
          return;
        }

        const stripeInstance = await getStripe();
        if (stripeInstance) {
          setStripe(stripeInstance);
        } else {
          setError('Failed to initialize Stripe');
        }
      } catch (err) {
        console.error('Error loading Stripe:', err);
        setError('Failed to load payment system');
      } finally {
        setIsLoading(false);
      }
    };

    loadStripeInstance();
  }, []);

  if (isLoading) {
    return (
      <div className="flex items-center justify-center py-8">
        <Loader2 className="w-6 h-6 animate-spin text-primary" />
        <span className="ml-2 text-muted-foreground">Loading payment...</span>
      </div>
    );
  }

  if (error || !stripe) {
    return (
      <div className="p-4 text-center text-red-600 bg-red-50 rounded-lg">
        <p className="font-medium">Payment system unavailable</p>
        <p className="text-sm mt-1">{error || 'Please contact support.'}</p>
      </div>
    );
  }

  if (!clientSecret) {
    return (
      <div className="flex items-center justify-center py-8">
        <Loader2 className="w-6 h-6 animate-spin text-primary" />
        <span className="ml-2 text-muted-foreground">Initializing payment...</span>
      </div>
    );
  }

  const options = {
    clientSecret,
    appearance,
    locale: 'en-GB' as const,
  };

  return (
    <Elements stripe={stripe} options={options}>
      {children}
    </Elements>
  );
};

export default StripeProvider;
