import React, { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { toast } from 'sonner';
import WarrantyCart from '@/components/WarrantyCart';
import MultiWarrantyCheckout from '@/components/MultiWarrantyCheckout';
import { useCart, CartItem } from '@/contexts/CartContext';
import { SEOHead } from '@/components/SEOHead';
import { BackNavigationConfirmDialog } from '@/components/BackNavigationConfirmDialog';
import { useMobileBackNavigation } from '@/hooks/useMobileBackNavigation';

const Cart: React.FC = () => {
  const navigate = useNavigate();
  const { items } = useCart();
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

  // Clear checkout flag when component unmounts
  React.useEffect(() => {
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
    // Additional guard: Don't show checkout if cart is empty
    if (items.length === 0) {
      console.error('❌ Checkout view with empty cart - redirecting back');
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