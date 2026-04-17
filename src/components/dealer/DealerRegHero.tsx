import React, { useState, useEffect, useRef } from 'react';
import { useNavigate } from 'react-router-dom';
import { Button } from '@/components/ui/button';
import { useDealerAuth } from '@/hooks/useDealerAuth';
import { Loader2 } from 'lucide-react';

// Standard UK plate formats (current + older + Northern Ireland)
const UK_PLATE_REGEX = /^(?:[A-Z]{2}[0-9]{2}\s?[A-Z]{3}|[A-Z][0-9]{1,3}\s?[A-Z]{3}|[A-Z]{3}\s?[0-9]{1,3}[A-Z]?|[A-Z]{1,3}\s?[0-9]{1,4})$/i;

const PENDING_REG_KEY = 'dealerPendingReg';

export const DealerRegHero: React.FC = () => {
  const { dealer, loading } = useDealerAuth();
  const navigate = useNavigate();
  const inputRef = useRef<HTMLInputElement>(null);
  const [reg, setReg] = useState('');
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    // Restore pending reg if returning from auth
    const pending = localStorage.getItem(PENDING_REG_KEY);
    if (pending) setReg(pending.toUpperCase());
    inputRef.current?.focus();
  }, []);

  const validate = (value: string): string | null => {
    const trimmed = value.trim();
    if (!trimmed) return 'Enter registration number';
    if (!UK_PLATE_REGEX.test(trimmed)) return 'Enter valid UK registration';
    return null;
  };

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    const err = validate(reg);
    if (err) {
      setError(err);
      return;
    }
    setError(null);
    const cleaned = reg.trim().toUpperCase();

    if (!dealer) {
      // Logged out → preserve and redirect to login
      localStorage.setItem(PENDING_REG_KEY, cleaned);
      const params = new URLSearchParams({
        redirect: '/dealer-portal',
        reg: cleaned,
      });
      navigate(`/dealer-portal/login?${params.toString()}`);
    } else {
      // Logged in → start the multi-step dealer journey
      localStorage.removeItem(PENDING_REG_KEY);
      navigate(`/dealer-portal/quote/vehicle?reg=${encodeURIComponent(cleaned)}`);
    }
  };

  const ctaLabel = loading
    ? 'Loading...'
    : dealer
    ? 'Get Quote'
    : 'Sign in / Sign up to continue';

  return (
    <form onSubmit={handleSubmit} className="space-y-3 w-full max-w-md mx-auto lg:mx-0" noValidate>
      {/* UK reg-plate styled input */}
      <div className="flex items-stretch rounded-lg overflow-hidden shadow-lg border-2 border-gray-700 w-full">
        <div className="bg-blue-600 text-white font-bold px-2 sm:px-3 md:px-4 py-2 sm:py-4 flex items-center justify-center min-w-[45px] sm:min-w-[70px] md:min-w-[80px] h-[56px] sm:h-[64px] md:h-[68px]">
          <div className="flex flex-col items-center">
            <div className="text-xs sm:text-base md:text-lg leading-tight mb-1">🇬🇧</div>
            <div className="text-xs sm:text-sm md:text-base font-bold leading-none">UK</div>
          </div>
        </div>
        <input
          ref={inputRef}
          type="text"
          value={reg}
          onChange={(e) => {
            setReg(e.target.value.toUpperCase());
            if (error) setError(null);
          }}
          placeholder="ENTER REG"
          aria-label="Vehicle registration number"
          maxLength={10}
          className="bg-yellow-400 flex-1 text-center text-xl sm:text-2xl md:text-3xl text-black font-black uppercase tracking-wider h-[56px] sm:h-[64px] md:h-[68px] placeholder:text-black/40 focus:outline-none focus:ring-4 focus:ring-orange-500/40 px-3"
        />
      </div>

      {error && (
        <p className="text-sm text-red-400 font-medium px-1" role="alert">
          {error}
        </p>
      )}

      <Button
        type="submit"
        size="lg"
        disabled={loading}
        className="w-full bg-orange-500 hover:bg-orange-600 text-white font-bold text-base sm:text-lg h-14 rounded-lg transition-colors"
      >
        {loading ? (
          <Loader2 className="h-5 w-5 animate-spin" />
        ) : (
          <span>{ctaLabel} →</span>
        )}
      </Button>

      {!dealer && !loading && (
        <p className="text-xs text-gray-400 text-center">
          New to BuyAWarranty? Account creation takes 60 seconds.
        </p>
      )}
    </form>
  );
};
