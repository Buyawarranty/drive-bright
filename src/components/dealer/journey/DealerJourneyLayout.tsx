import React, { ReactNode, useEffect } from 'react';
import { Navigate, useLocation, useNavigate } from 'react-router-dom';
import { useDealerAuth } from '@/hooks/useDealerAuth';
import { useDealerJourney } from '@/contexts/DealerJourneyContext';
import { Loader2, ArrowLeft } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { supabase } from '@/integrations/supabase/client';

interface Props {
  step: 1 | 2 | 3 | 4 | 5;
  title: string;
  subtitle?: string;
  children: ReactNode;
  showBack?: boolean;
  backTo?: string;
}

const STEPS = [
  { n: 1, label: 'Vehicle' },
  { n: 2, label: 'Customer' },
  { n: 3, label: 'Plan' },
  { n: 4, label: 'Checkout' },
  { n: 5, label: 'Done' },
];

export const DealerJourneyLayout: React.FC<Props> = ({ step, title, subtitle, children, showBack = true, backTo }) => {
  const { dealer, loading } = useDealerAuth();
  const location = useLocation();
  const navigate = useNavigate();
  const { setDiscountPct, discount_pct } = useDealerJourney();

  // Hydrate dealer discount once
  useEffect(() => {
    if (!dealer?.id) return;
    let cancelled = false;
    (async () => {
      const { data } = await supabase
        .from('dealers')
        .select('discount_pct')
        .eq('id', dealer.id)
        .maybeSingle();
      if (!cancelled && data && typeof (data as any).discount_pct === 'number') {
        setDiscountPct((data as any).discount_pct);
      }
    })();
    return () => { cancelled = true; };
  }, [dealer?.id]);

  if (loading) {
    return (
      <div className="min-h-screen bg-gray-950 flex items-center justify-center">
        <Loader2 className="h-8 w-8 animate-spin text-orange-500" />
      </div>
    );
  }

  if (!dealer) {
    return <Navigate to={`/dealer-portal/login?redirect=${encodeURIComponent(location.pathname)}`} replace />;
  }

  return (
    <div className="min-h-screen bg-gray-950 text-white">
      <header className="border-b border-gray-800 bg-gray-900/50 backdrop-blur sticky top-0 z-10">
        <div className="max-w-4xl mx-auto px-4 py-4 flex items-center justify-between">
          <div className="flex items-center gap-3">
            {showBack && (
              <Button
                variant="ghost"
                size="sm"
                onClick={() => (backTo ? navigate(backTo) : navigate(-1))}
                className="text-gray-400 hover:text-white hover:bg-gray-800"
              >
                <ArrowLeft className="h-4 w-4 mr-1" /> Back
              </Button>
            )}
            <span className="text-sm font-semibold text-orange-500">DEALER QUOTE</span>
          </div>
          {discount_pct > 0 && (
            <span className="text-xs px-3 py-1 rounded-full bg-orange-500/10 text-orange-400 font-semibold">
              Your dealer discount: {discount_pct}%
            </span>
          )}
        </div>

        {/* Progress */}
        <div className="max-w-4xl mx-auto px-4 pb-4">
          <div className="flex items-center gap-2">
            {STEPS.map((s, i) => {
              const active = s.n === step;
              const done = s.n < step;
              return (
                <React.Fragment key={s.n}>
                  <div className="flex items-center gap-2">
                    <div
                      className={`w-7 h-7 rounded-full flex items-center justify-center text-xs font-bold transition-colors ${
                        done
                          ? 'bg-orange-500 text-white'
                          : active
                          ? 'bg-orange-500 text-white ring-4 ring-orange-500/20'
                          : 'bg-gray-800 text-gray-500'
                      }`}
                    >
                      {s.n}
                    </div>
                    <span className={`text-xs hidden sm:inline ${active ? 'text-white font-semibold' : 'text-gray-500'}`}>
                      {s.label}
                    </span>
                  </div>
                  {i < STEPS.length - 1 && (
                    <div className={`flex-1 h-px ${done ? 'bg-orange-500' : 'bg-gray-800'}`} />
                  )}
                </React.Fragment>
              );
            })}
          </div>
        </div>
      </header>

      <main className="max-w-4xl mx-auto px-4 py-6 sm:py-10">
        <div className="mb-6">
          <h1 className="text-2xl sm:text-3xl font-bold text-white">{title}</h1>
          {subtitle && <p className="text-gray-400 mt-1 text-sm sm:text-base">{subtitle}</p>}
        </div>
        {children}
      </main>
    </div>
  );
};
