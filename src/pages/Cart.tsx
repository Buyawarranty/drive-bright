import React, { useState, useEffect, useRef } from 'react';
import { useNavigate } from 'react-router-dom';
import { toast } from 'sonner';
import WarrantyCart from '@/components/WarrantyCart';
import MultiWarrantyCheckout from '@/components/MultiWarrantyCheckout';
import { useCart, CartItem } from '@/contexts/CartContext';
import { SEOHead } from '@/components/SEOHead';
import { BackNavigationConfirmDialog } from '@/components/BackNavigationConfirmDialog';
import { useMobileBackNavigation } from '@/hooks/useMobileBackNavigation';
import { Loader2 } from 'lucide-react';

const Cart: React.FC = () => {
  const navigate = useNavigate();
  const { items } = useCart();
  const [isRestoringFromPayment, setIsRestoringFromPayment] = useState(false);
  const restorationAttemptedRef = useRef(false);
  
  const [showCheckout, setShowCheckout] = useState(() => {
    try {
      // Check if returning from payment - restore checkout view
      const wasInCheckout = sessionStorage.getItem('wasInCheckout') === 'true';
      const urlParams = new URLSearchParams(window.location.search);
      const returnFromPayment = urlParams.get('returnFromPayment') === 'true';
      
      // If user is returning from payment gateway or was in checkout, show checkout view
      if (returnFromPayment && !wasInCheckout) {
        sessionStorage.setItem('wasInCheckout', 'true');
        console.log('✅ Detected return from payment gateway - showing checkout');
        return true;
      }
      
      return wasInCheckout;
    } catch (error) {
      console.error('❌ Storage access error (iOS/Safari):', error);
      // Fallback: check URL params only if storage fails
      const urlParams = new URLSearchParams(window.location.search);
      return urlParams.get('returnFromPayment') === 'true';
    }
  });
  const [showBackConfirmDialog, setShowBackConfirmDialog] = useState(false);

  // Determine current step based on checkout state
  const currentStep = showCheckout ? 2 : 1;

  // Enable back navigation guard for checkout flow
  const { allowLeave, stay } = useMobileBackNavigation({
    currentStep,
    onStepChange: (step) => {
      if (step === 1) {
        setShowCheckout(false);
        sessionStorage.removeItem('wasInCheckout');
      }
    },
    totalSteps: 2,
    journeyId: 'cart-checkout',
    isGuarded: showCheckout, // Only guard when in checkout
    onShowConfirmDialog: () => setShowBackConfirmDialog(true)
  });

  // Handle bfcache restoration - CRITICAL for returning from Stripe
  useEffect(() => {
    const handlePageShow = (event: PageTransitionEvent) => {
      if (event.persisted) {
        console.log('📱 Cart: Page restored from bfcache');
        setIsRestoringFromPayment(false);
        restorationAttemptedRef.current = false;
      }
    };
    
    const handleVisibilityChange = () => {
      if (document.visibilityState === 'visible') {
        console.log('📱 Cart: Page visible again');
        setIsRestoringFromPayment(false);
      }
    };
    
    window.addEventListener('pageshow', handlePageShow as EventListener);
    document.addEventListener('visibilitychange', handleVisibilityChange);
    
    return () => {
      window.removeEventListener('pageshow', handlePageShow as EventListener);
      document.removeEventListener('visibilitychange', handleVisibilityChange);
    };
  }, []);

  // Clear checkout flag when component unmounts
  useEffect(() => {
    return () => {
      try {
        sessionStorage.removeItem('wasInCheckout');
      } catch (error) {
        console.error('❌ Storage cleanup error:', error);
      }
    };
  }, []);

  const handleAddMore = () => {
    navigate('/?step=1');
  };

  const handleProceedToCheckout = (cartItems: CartItem[]) => {
    // Validate cart has items before proceeding
    if (cartItems.length === 0) {
      toast.error('Your cart is empty. Please add items before checkout.');
      console.error('❌ Attempted checkout with empty cart');
      return;
    }
    
    try {
      sessionStorage.setItem('wasInCheckout', 'true');
    } catch (error) {
      console.error('❌ Storage write error:', error);
    }
    setShowCheckout(true);
  };

  const handleBackToCart = () => {
    try {
      sessionStorage.removeItem('wasInCheckout');
    } catch (error) {
      console.error('❌ Storage cleanup error:', error);
    }
    // Clear return from payment URL param if present
    const urlParams = new URLSearchParams(window.location.search);
    if (urlParams.has('returnFromPayment')) {
      urlParams.delete('returnFromPayment');
      window.history.replaceState({}, '', `${window.location.pathname}?${urlParams.toString()}`);
    }
    setShowCheckout(false);
  };

  const handleAddAnother = () => {
    setShowCheckout(false);
    navigate('/?step=1');
  };

  if (showCheckout) {
    // Show brief loading state while cart is being restored from localStorage
    // This prevents the "Cart Empty" error when returning from Stripe
    if (items.length === 0) {
      // Check if cart should have items (from localStorage)
      let hasStoredItems = false;
      try {
        const savedCart = localStorage.getItem('warrantyCart');
        if (savedCart) {
          const parsed = JSON.parse(savedCart);
          hasStoredItems = parsed && parsed.length > 0;
        }
      } catch (e) {
        console.error('❌ Error checking stored cart:', e);
      }
      
      // If localStorage has items but React state doesn't yet, show loading
      if (hasStoredItems) {
        console.log('📱 Cart: Waiting for cart restoration...');
        return (
          <div className="min-h-screen bg-gradient-to-b from-gray-50 to-white flex items-center justify-center">
            <div className="flex flex-col items-center gap-4">
              <Loader2 className="h-8 w-8 animate-spin text-primary" />
              <p className="text-gray-600">Restoring your cart...</p>
            </div>
          </div>
        );
      }
      
      // Actually empty - redirect back
      console.error('❌ Checkout view with genuinely empty cart - redirecting back');
      setShowCheckout(false);
      return null;
    }
    
    return (
      <>
        <SEOHead 
          title="Warranty Checkout | Complete Your Purchase"
          description="Complete your car warranty purchase. Review your selections and proceed with secure payment for comprehensive vehicle coverage."
          keywords="warranty checkout, car warranty purchase, secure payment, vehicle coverage"
        />
        <MultiWarrantyCheckout 
          items={items}
          onBack={handleBackToCart}
          onAddAnother={handleAddAnother}
        />
        <BackNavigationConfirmDialog
          open={showBackConfirmDialog}
          onStay={() => {
            setShowBackConfirmDialog(false);
            stay();
          }}
          onLeave={() => {
            setShowBackConfirmDialog(false);
            allowLeave();
          }}
          journeyName="checkout"
        />
      </>
    );
  }

  return (
    <>
      <SEOHead 
        title="Warranty Cart | Review Your Selections"
        description="Review your car warranty selections before checkout. Compare plans and ensure you have the right coverage for all your vehicles."
        keywords="warranty cart, review selections, car warranty comparison, multiple warranties"
      />
      <WarrantyCart 
        onAddMore={handleAddMore}
        onProceedToCheckout={handleProceedToCheckout}
      />
      <BackNavigationConfirmDialog
        open={showBackConfirmDialog}
        onStay={() => {
          setShowBackConfirmDialog(false);
          stay();
        }}
        onLeave={() => {
          setShowBackConfirmDialog(false);
          allowLeave();
        }}
        journeyName="cart"
      />
    </>
  );
};

export default Cart;