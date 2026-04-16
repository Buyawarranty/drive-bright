
import React, { useState, useEffect, useCallback, useMemo, lazy, useRef } from 'react';
import { toast } from 'sonner';
import { useNavigate, useSearchParams } from 'react-router-dom';
import { Button } from '@/components/ui/button';
import Homepage from '@/components/Homepage';
import { DiscountPopup } from '@/components/DiscountPopup';
import { SEOHead } from '@/components/SEOHead';
import { OrganizationSchema } from '@/components/schema/OrganizationSchema';
import { FAQSchema, defaultWarrantyFAQs } from '@/components/schema/FAQSchema';
import { ProductSchema } from '@/components/schema/ProductSchema';
import { BreadcrumbSchema } from '@/components/schema/BreadcrumbSchema';
import { ReviewSchema } from '@/components/schema/ReviewSchema';
import { WebPageSchema } from '@/components/schema/WebPageSchema';
import { supabase } from '@/integrations/supabase/client';
import { useMobileBackNavigation } from '@/hooks/useMobileBackNavigation';
import { useQuoteRestoration } from '@/hooks/useQuoteRestoration';
import { batchLocalStorageWrite, safeLocalStorageRemove, parseLocalStorageJSON, saveWithTimestamp, getWithTimestamp } from '@/utils/localStorage';
import PerformanceOptimizedSuspense from '@/components/PerformanceOptimizedSuspense';
import { BackNavigationConfirmDialog } from '@/components/BackNavigationConfirmDialog';
import QuoteDeliveryStep from '@/components/QuoteDeliveryStep';

import { captureGclid, getStoredGclid } from '@/utils/gclidCapture';
import { captureFbclid, getStoredFbclid, getStoredFbReferrer } from '@/utils/fbclidCapture';
import { trackMetaPixelFunnelEvent } from '@/utils/metaPixelTracking';
import { CarDrivingLoader } from '@/components/ui/car-driving-loader';


// Lazy load heavy components that are not immediately visible
const RegistrationForm = lazy(() => import('@/components/RegistrationForm'));
const PricingTable = lazy(() => import('@/components/PricingTable'));
// Step3Mobile removed - using PricingTable for now
const CompactProgressBar = lazy(() => import('@/components/CompactProgressBar'));
const CarJourneyProgress = lazy(() => import('@/components/CarJourneyProgress'));
const CustomerDetailsStep = lazy(() => import('@/components/CustomerDetailsStep'));
const MaintenanceBanner = lazy(() => import('@/components/MaintenanceBanner'));


interface VehicleData {
  regNumber: string;
  mileage: string;
  email: string;
  phone: string;
  firstName: string;
  lastName: string;
  address: string;
  make?: string;
  model?: string;
  fuelType?: string;
  transmission?: string;
  year?: string;
  vehicleType?: string;
  isManualEntry?: boolean;
  blocked?: boolean;
  blockReason?: string;
  manufactureDate?: string; // Full manufacture date for precise age calculation
}

// Helper to parse stored data - handles both timestamped and raw formats
const parseStoredDataSync = (key: string): any => {
  try {
    const raw = localStorage.getItem(key);
    if (!raw) return null;
    
    const parsed = JSON.parse(raw);
    
    // Handle timestamped format (from saveWithTimestamp)
    if (parsed && typeof parsed === 'object' && 'value' in parsed && 'timestamp' in parsed) {
      const expiryTime = 30 * 24 * 60 * 60 * 1000;
      if (Date.now() - parsed.timestamp > expiryTime) {
        return null;
      }
      return JSON.parse(parsed.value);
    }
    
    // Handle raw format (direct JSON)
    return parsed;
  } catch (error) {
    console.error(`❌ Error parsing ${key}:`, error);
    return null;
  }
};

// Recovery fallback component - optimized for bfcache restoration
const RecoveryFallback: React.FC<{
  onRecovered: (vehicleData: VehicleData, selectedPlan: any) => void;
  onStartOver: () => void;
}> = ({ onRecovered, onStartOver }) => {
  // CRITICAL: Start with loading hidden to prevent flash during bfcache restoration
  const [showLoadingUI, setShowLoadingUI] = useState(false);
  const [recoveryFailed, setRecoveryFailed] = useState(false);
  const hasAttemptedRef = useRef(false);
  const recoveryCompleteRef = useRef(false);

  // Scroll to top when recovery fails
  useEffect(() => {
    if (recoveryFailed) {
      window.scrollTo({ top: 0, behavior: 'smooth' });
    }
  }, [recoveryFailed]);

  // Immediate recovery attempt on mount - optimized for bfcache
  useEffect(() => {
    // Only attempt recovery once to prevent infinite loops
    if (hasAttemptedRef.current) return;
    hasAttemptedRef.current = true;
    
    const attemptRecovery = (): boolean => {
      if (recoveryCompleteRef.current) return true;
      
      try {
        const parsedVehicleData = parseStoredDataSync('buyawarranty_vehicleData');
        const parsedSelectedPlan = parseStoredDataSync('buyawarranty_selectedPlan');
        
        // Validate the data has required fields
        if (parsedVehicleData?.regNumber && parsedSelectedPlan?.paymentType) {
          console.log('✅ RecoveryFallback: Recovery successful');
          recoveryCompleteRef.current = true;
          onRecovered(parsedVehicleData, parsedSelectedPlan);
          return true;
        }
      } catch (error) {
        console.error('❌ RecoveryFallback: Error during recovery:', error);
      }
      return false;
    };

    // Try SYNCHRONOUS recovery first - no UI flash
    if (attemptRecovery()) {
      return; // Success - parent will re-render without this component
    }
    
    // If immediate recovery failed, wait ONE animation frame for parent's
    // bfcache handler to potentially restore state first
    requestAnimationFrame(() => {
      if (recoveryCompleteRef.current) return;
      
      // Try again after frame
      if (attemptRecovery()) {
        return;
      }
      
      // Still failed after frame - NOW show loading UI
      // This gives parent's pageshow handler time to restore state
      setShowLoadingUI(true);
    });
  }, []); // Empty dependency array - only run once

  // Safety timeout - 800ms max to prevent long freezes
  useEffect(() => {
    if (!showLoadingUI || recoveryCompleteRef.current) return;
    
    const safetyTimeout = setTimeout(() => {
      if (!recoveryCompleteRef.current) {
        console.log('⚠️ RecoveryFallback: Timeout - final recovery attempt');
        
        const parsedVehicleData = parseStoredDataSync('buyawarranty_vehicleData');
        const parsedSelectedPlan = parseStoredDataSync('buyawarranty_selectedPlan');
        
        if (parsedVehicleData?.regNumber && parsedSelectedPlan?.paymentType) {
          recoveryCompleteRef.current = true;
          setShowLoadingUI(false);
          onRecovered(parsedVehicleData, parsedSelectedPlan);
          return;
        }
        
        // If we get here, recovery truly failed
        setRecoveryFailed(true);
        setShowLoadingUI(false);
      }
    }, 800); // Reduced to 800ms for faster feedback
    
    return () => clearTimeout(safetyTimeout);
  }, [showLoadingUI, onRecovered]);

  // Only show loading AFTER confirming we need it (prevents bfcache flash)
  if (showLoadingUI && !recoveryFailed) {
    return (
      <div className="w-full px-4 py-8">
        <div className="max-w-4xl mx-auto text-center space-y-6">
          <h2 className="text-2xl font-bold text-gray-900">
            Restoring your details...
          </h2>
          <p className="text-gray-600">
            We're recovering your warranty details. This will only take a moment.
          </p>
          <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-blue-600 mx-auto"></div>
        </div>
      </div>
    );
  }

  if (recoveryFailed) {
    return (
      <div className="w-full px-4 py-8">
        <div className="max-w-4xl mx-auto text-center space-y-6">
          <h2 className="text-2xl font-bold text-gray-900">
            Oops! We've lost your order details
          </h2>
          <p className="text-gray-600">
            It looks like your session has expired or you've navigated back from a payment page. 
            Please start your warranty journey again to continue.
          </p>
          <div className="space-y-4">
            <Button 
              onClick={onStartOver}
              className="bg-blue-600 hover:bg-blue-700 text-white px-8 py-3"
            >
              Start Over
            </Button>
            <p className="text-sm text-gray-500">
              If you've already completed a payment, please check your email for confirmation.
            </p>
          </div>
        </div>
      </div>
    );
  }

  return null;
};

const Index = () => {
  console.log('Index component rendering, URL:', window.location.href);
  const [searchParams, setSearchParams] = useSearchParams();
  const navigate = useNavigate();

  // Check for quote restoration immediately
  const quoteParam = searchParams.get('quote');
  const emailParam = searchParams.get('email');
  console.log('Immediate quote check:', { quoteParam, emailParam });
  console.log('All URL params:', Object.fromEntries(searchParams.entries()));
  
  // CRITICAL: Check for restore parameter FIRST and initialize state with it
  const getInitialVehicleData = (): VehicleData | null => {
    // Priority 1: Check for restore parameter from email links
    const restoreParam = searchParams.get('restore');
    if (restoreParam) {
      try {
        console.log('🔗 Attempting to restore from URL parameter');
        const decoded = atob(restoreParam);
        console.log('🔗 Decoded restore data:', decoded);
        const restoredData = JSON.parse(decoded);
        console.log('🔗 Parsed restore data:', restoredData);
        
        // Validate required fields
        if (!restoredData.regNumber && !restoredData.email) {
          console.error('❌ Invalid restore data - missing both regNumber and email');
          return null;
        }
        
        // Build complete vehicle data object with all required fields
        const completeVehicleData: VehicleData = {
          regNumber: restoredData.regNumber || '',
          mileage: restoredData.mileage || '0',
          email: restoredData.email || '',
          phone: restoredData.phone || '',
          firstName: restoredData.firstName || '',
          lastName: restoredData.lastName || '',
          address: restoredData.address || '',
          make: restoredData.make || '',
          model: restoredData.model || '',
          fuelType: restoredData.fuelType || '',
          transmission: restoredData.transmission || '',
          year: restoredData.year || '',
          vehicleType: restoredData.vehicleType || 'car'
        };
        
        // Save to localStorage immediately with timestamp
        saveWithTimestamp('buyawarranty_vehicleData', JSON.stringify(completeVehicleData));
        saveWithTimestamp('buyawarranty_formData', JSON.stringify(completeVehicleData));
        
        // Save Step 3 pricing selections if present (for PricingTable restoration)
        if (restoredData.paymentType || restoredData.claimLimit || restoredData.labourRate || restoredData.voluntaryExcess !== undefined) {
          const planSettings = {
            paymentType: restoredData.paymentType || '24months',
            claimLimit: restoredData.claimLimit || 1250,
            labourRate: restoredData.labourRate || 70,
            voluntaryExcess: restoredData.voluntaryExcess ?? 100,
            boostAddon: restoredData.boostAddon || false,
            addOns: restoredData.protectionAddons 
              ? Object.entries(restoredData.protectionAddons)
                  .filter(([_, enabled]) => enabled)
                  .map(([key]) => key)
              : []
          };
          console.log('🔗 Saving restored plan settings to localStorage:', planSettings);
          localStorage.setItem('buyawarranty_quotePlanSettings', JSON.stringify(planSettings));
        }
        
        console.log('✅ Successfully restored vehicle data from email:', completeVehicleData);
        return completeVehicleData;
      } catch (error) {
        console.error('❌ Error decoding restore parameter:', error);
        return null;
      }
    }
    
    // Priority 2: Check localStorage - handle both timestamped and raw formats
    try {
      const raw = localStorage.getItem('buyawarranty_vehicleData');
      if (!raw) {
        console.log('⏰ Vehicle data not found');
        return null;
      }
      
      const parsed = JSON.parse(raw);
      
      // Handle timestamped format (from saveWithTimestamp)
      if (parsed && typeof parsed === 'object' && 'value' in parsed && 'timestamp' in parsed) {
        const expiryTime = 30 * 24 * 60 * 60 * 1000;
        if (Date.now() - parsed.timestamp > expiryTime) {
          localStorage.removeItem('buyawarranty_vehicleData');
          console.log('⏰ Vehicle data expired');
          return null;
        }
        return JSON.parse(parsed.value);
      }
      
      // Handle raw format (direct JSON)
      return parsed;
    } catch (error) {
      console.error('❌ Error reading vehicle data:', error);
      return null;
    }
  };
  
  // Initialize state variables first - check restore param and localStorage with timestamp check
  const [vehicleData, setVehicleData] = useState<VehicleData | null>(getInitialVehicleData);
  const getInitialSelectedPlan = () => {
    // Priority 1: Check for restore parameter from email links
    const restoreParam = searchParams.get('restore');
    if (restoreParam) {
      try {
        const restoredData = JSON.parse(atob(restoreParam));
        
        let reconstructedPlan = null;
        if (restoredData.selectedPlan) {
          reconstructedPlan = restoredData.selectedPlan;
        } else if (restoredData.planName && restoredData.paymentType) {
          reconstructedPlan = {
            id: 'pending',
            name: restoredData.planName,
            paymentType: restoredData.paymentType
          };
        }
        
        if (reconstructedPlan) {
          console.log('🔗 Initializing with restored plan:', reconstructedPlan);
          saveWithTimestamp('buyawarranty_selectedPlan', JSON.stringify(reconstructedPlan));
          return reconstructedPlan;
        }
      } catch (error) {
        console.error('❌ Error decoding restore plan:', error);
      }
    }
    
    // Priority 2: Check localStorage - handle both timestamped and raw formats
    try {
      const raw = localStorage.getItem('buyawarranty_selectedPlan');
      if (!raw) {
        console.log('⏰ Selected plan not found');
        return null;
      }
      
      const parsed = JSON.parse(raw);
      
      // Handle timestamped format (from saveWithTimestamp)
      if (parsed && typeof parsed === 'object' && 'value' in parsed && 'timestamp' in parsed) {
        const expiryTime = 30 * 24 * 60 * 60 * 1000;
        if (Date.now() - parsed.timestamp > expiryTime) {
          localStorage.removeItem('buyawarranty_selectedPlan');
          console.log('⏰ Selected plan expired');
          return null;
        }
        return JSON.parse(parsed.value);
      }
      
      // Handle raw format (direct JSON)
      return parsed;
    } catch (error) {
      console.error('❌ Error reading selected plan:', error);
      return null;
    }
  };
  
  const [selectedPlan, setSelectedPlan] = useState<{
    id: string, 
    paymentType: string, 
    name?: string, 
    pricingData?: {
      totalPrice: number, 
      monthlyPrice: number, 
      voluntaryExcess: number, 
      selectedAddOns: {[addon: string]: boolean},
      protectionAddOns?: {[key: string]: boolean},
      claimLimit?: number,
      labourRate?: number,
      boostAddon?: boolean
    }
  } | null>(getInitialSelectedPlan);
  const getInitialFormData = () => {
    // Priority 1: Check for restore parameter from email links
    const restoreParam = searchParams.get('restore');
    if (restoreParam) {
      try {
        const restoredData = JSON.parse(atob(restoreParam));
        console.log('🔗 Initializing formData with restored data');
        return restoredData;
      } catch (error) {
        console.error('❌ Error decoding restore formData:', error);
      }
    }
    
    // Priority 2: Check localStorage - handle both timestamped and raw formats
    try {
      const raw = localStorage.getItem('buyawarranty_formData');
      if (raw) {
        const parsed = JSON.parse(raw);
        
        // Handle timestamped format (from saveWithTimestamp)
        if (parsed && typeof parsed === 'object' && 'value' in parsed && 'timestamp' in parsed) {
          const expiryTime = 30 * 24 * 60 * 60 * 1000;
          if (Date.now() - parsed.timestamp < expiryTime) {
            return JSON.parse(parsed.value);
          }
        } else {
          // Handle raw format (direct JSON)
          return parsed;
        }
      }
    } catch {
      // Continue to default
    }
    
    // Priority 3: Return empty form
    return {
      regNumber: '',
      mileage: '',
      email: '',
      phone: '',
      firstName: '',
      lastName: '',
      address: '',
      make: '',
      model: '',
      fuelType: '',
      transmission: '',
      year: '',
      vehicleType: ''
    };
  };
  
  const [formData, setFormData] = useState(getInitialFormData);
  
  // State for back navigation confirmation dialog
  const [showBackConfirmDialog, setShowBackConfirmDialog] = useState(false);
  
  // Get current step from URL or default to 1 with 30-day expiry
  const getStepFromUrl = () => {
    // Priority 1: Check for restore parameter which includes step
    const restoreParam = searchParams.get('restore');
    if (restoreParam) {
      try {
        const restoredData = JSON.parse(atob(restoreParam));
        const restoredStep = restoredData.step || 3;
        console.log('🔗 Initializing with restored step:', restoredStep);
        
        // Save to localStorage with timestamp
        saveWithTimestamp('buyawarranty_currentStep', restoredStep.toString());
        
        return restoredStep;
      } catch (error) {
        console.error('❌ Error decoding restore step:', error);
      }
    }
    
    // Priority 2: Check URL step parameter
    const stepParam = searchParams.get('step');
    console.log('getStepFromUrl - stepParam:', stepParam);
    if (stepParam) {
      const step = parseInt(stepParam);
      console.log('getStepFromUrl - parsed step:', step);
      return step >= 1 && step <= 5 ? step : 1;
    }
    
    // Priority 3: Check localStorage with 30-day expiry
    try {
      const saved = getWithTimestamp('buyawarranty_currentStep', 30);
      if (!saved) {
        console.log('⏰ Current step expired or not found, clearing all saved data');
        // Clear all related data if step has expired
        safeLocalStorageRemove([
          'buyawarranty_vehicleData',
          'buyawarranty_selectedPlan',
          'buyawarranty_formData',
          'warrantyJourneyState'
        ]);
        return 1;
      }
      const step = parseInt(saved);
      return step >= 1 && step <= 5 ? step : 1;
    } catch {
      return 1;
    }
    
    return 1;
  };
  
  const [currentStep, setCurrentStep] = useState(getStepFromUrl());
  const [showDiscountPopup, setShowDiscountPopup] = useState(false);
  const isNavigatingRef = useRef(false);
  // Track previous step to only scroll when step actually changes, not on every state update
  const previousStepRef = useRef<number | null>(null);
  
  const { restoreQuoteData } = useQuoteRestoration();

  // Track restoration state to prevent premature redirects
  const [isRestoringFromUrl, setIsRestoringFromUrl] = useState(() => {
    const hasRestore = !!searchParams.get('restore');
    console.log('🔗 Initial restoration check:', hasRestore);
    return hasRestore;
  });
  
  // Loading state for showing restoration UI
  const [isRestoring, setIsRestoring] = useState(() => !!searchParams.get('restore'));

  // CRITICAL: Clean up restore parameter from URL after state initialization
  useEffect(() => {
    const restoreParam = searchParams.get('restore');
    
    if (restoreParam && !isRestoringFromUrl) {
      console.log('🔗 Cleaning up restore parameter from URL after restoration');
      
      try {
        // Parse the restore data to get the intended step
        const restoredData = JSON.parse(atob(restoreParam));
        const targetStep = restoredData.step || 3;
        
        // Update URL to remove restore param but keep step
        const newSearchParams = new URLSearchParams();
        newSearchParams.set('step', targetStep.toString());
        
        // Use replace to avoid adding to browser history
        setSearchParams(newSearchParams, { replace: true });
        
        console.log('✅ URL cleanup complete, now on step:', targetStep);
      } catch (error) {
        console.error('❌ Error cleaning up URL:', error);
        // If there's an error, keep current step
        const newSearchParams = new URLSearchParams();
        newSearchParams.set('step', currentStep.toString());
        setSearchParams(newSearchParams, { replace: true });
      }
    }
  }, [isRestoringFromUrl]); // Run when restoration completes
  
  useEffect(() => {
    if (isRestoringFromUrl) {
      console.log('⏳ Restoration in progress, allowing 2 seconds for state initialization');
      const timer = setTimeout(() => {
        console.log('✅ Restoration period complete');
        setIsRestoringFromUrl(false);
        setIsRestoring(false);
      }, 2000); // Increased to 2 seconds to ensure state is fully initialized
      return () => clearTimeout(timer);
    }
  }, [isRestoringFromUrl]);

  // Capture promo code from URL (?promo=SAVE10TODAY) and store for checkout auto-apply
  useEffect(() => {
    const promoParam = searchParams.get('promo');
    if (promoParam) {
      const code = promoParam.toUpperCase();
      localStorage.setItem('buyawarranty_promoCode', code);
      console.log('🎟️ Promo code captured from URL:', code);
      
      // Show immediate notification so users know the voucher is applied
      toast.success(`Voucher ${code} has been applied — your discount will show at checkout`, {
        duration: 6000,
        id: 'promo-applied',
        style: {
          background: '#E91E63',
          color: '#ffffff',
          fontWeight: '600',
          borderRadius: '8px',
          border: 'none',
        },
      });

      // Clean param from URL
      const newParams = new URLSearchParams(searchParams);
      newParams.delete('promo');
      setSearchParams(newParams, { replace: true });
    }
  }, [searchParams, setSearchParams]);

  // Capture GCLID/FBCLID from ads on page load for server-side conversion tracking
  useEffect(() => {
    captureGclid();
    captureFbclid();
  }, []);
  
  // Handle PayPal/redirect payment returns
  // When users return from PayPal, Stripe redirects to /?step=4&payment_return=true&redirect_status=...
  useEffect(() => {
    const redirectStatus = searchParams.get('redirect_status');
    const paymentReturn = searchParams.get('payment_return');
    
    if (paymentReturn && redirectStatus) {
      console.log('💳 Payment redirect return detected:', redirectStatus);
      
      if (redirectStatus === 'succeeded') {
        // Payment successful! Redirect to thank-you
        console.log('✅ Redirect payment succeeded, navigating to thank-you');
        navigate('/thank-you?source=stripe', { replace: true });
        return;
      } else if (redirectStatus === 'failed') {
        // Payment failed - show error and let them retry
        console.log('❌ Redirect payment failed');
        // Clean URL but stay on step 4
        const newParams = new URLSearchParams();
        newParams.set('step', '4');
        setSearchParams(newParams, { replace: true });
        // Toast will be shown by StreamlinedCheckout
      } else if (redirectStatus === 'pending') {
        console.log('⏳ Redirect payment pending');
        // Clean URL but stay on step 4
        const newParams = new URLSearchParams();
        newParams.set('step', '4');
        setSearchParams(newParams, { replace: true });
      }
    }
  }, [searchParams, navigate, setSearchParams]);

  // Helper function to parse localStorage data (handles both timestamped and raw formats)
  const parseStoredData = useCallback((key: string) => {
    try {
      const raw = localStorage.getItem(key);
      if (!raw) return null;
      
      const parsed = JSON.parse(raw);
      
      // Handle timestamped format (from saveWithTimestamp)
      if (parsed && typeof parsed === 'object' && 'value' in parsed && 'timestamp' in parsed) {
        // Check 30-day expiry
        const expiryTime = 30 * 24 * 60 * 60 * 1000;
        if (Date.now() - parsed.timestamp > expiryTime) {
          localStorage.removeItem(key);
          return null;
        }
        return JSON.parse(parsed.value);
      }
      
      // Handle raw format (direct JSON)
      return parsed;
    } catch (error) {
      console.error(`❌ Error parsing ${key}:`, error);
      return null;
    }
  }, []);

  // Handle bfcache restoration (when user navigates back from payment gateway)
  // This MUST run synchronously to prevent RecoveryFallback from flashing
  useEffect(() => {
    const recoverStateFromStorage = () => {
      const urlStep = parseInt(searchParams.get('step') || '1');
      
      if (urlStep === 4) {
        console.log('📱 Index: Attempting state recovery for step 4');
        
        const parsedVehicleData = parseStoredData('buyawarranty_vehicleData');
        const parsedSelectedPlan = parseStoredData('buyawarranty_selectedPlan');
        
        if (parsedVehicleData?.regNumber && parsedSelectedPlan?.paymentType) {
          console.log('✅ Index: State recovered successfully');
          setVehicleData(parsedVehicleData);
          setSelectedPlan(parsedSelectedPlan);
          return true;
        }
      }
      return false;
    };
    
    const handlePageShow = (event: PageTransitionEvent) => {
      if (event.persisted) {
        console.log('📱 Index: Page restored from bfcache');
        recoverStateFromStorage();
        
        // Force a re-render after a frame to ensure state is applied
        requestAnimationFrame(() => {
          recoverStateFromStorage();
        });
      }
    };
    
    const handleVisibilityChange = () => {
      if (document.visibilityState === 'visible') {
        console.log('📱 Index: Page visible again');
        recoverStateFromStorage();
      }
    };
    
    const handleFocus = () => {
      console.log('📱 Index: Window focused');
      recoverStateFromStorage();
    };
    
    // Add all listeners immediately
    window.addEventListener('pageshow', handlePageShow as EventListener);
    document.addEventListener('visibilitychange', handleVisibilityChange);
    window.addEventListener('focus', handleFocus);
    
    return () => {
      window.removeEventListener('pageshow', handlePageShow as EventListener);
      document.removeEventListener('visibilitychange', handleVisibilityChange);
      window.removeEventListener('focus', handleFocus);
    };
  }, [searchParams, parseStoredData]);

  // Quote restoration effect - optimized with memoization
  useEffect(() => {
    // Skip if we're handling a restore parameter (handled by effect above)
    const restoreParam = searchParams.get('restore');
    if (restoreParam) {
      return;
    }
    
    if (quoteParam && emailParam) {
      restoreQuoteData(quoteParam, emailParam).then(restoredData => {
        if (restoredData) {
          setVehicleData(restoredData);
          setFormData(prev => ({ ...prev, ...restoredData }));
          
          // Batch localStorage operations
          const updates = {
            buyawarranty_vehicleData: JSON.stringify(restoredData),
            buyawarranty_formData: JSON.stringify(restoredData),
            buyawarranty_currentStep: '3'
          };
          Object.entries(updates).forEach(([key, value]) => 
            localStorage.setItem(key, value)
          );
          
          setCurrentStep(3);
          updateStepInUrl(3);
        }
      });
    }
  }, [quoteParam, emailParam, restoreQuoteData]);
  
  // Handle reg and mileage URL parameters from van warranty page
  useEffect(() => {
    const regParam = searchParams.get('reg');
    const mileageParam = searchParams.get('mileage');
    const makeParam = searchParams.get('make');
    const modelParam = searchParams.get('model');
    const fuelTypeParam = searchParams.get('fuelType');
    const yearParam = searchParams.get('year');
    const vehicleTypeParam = searchParams.get('vehicleType');
    const stepParam = searchParams.get('step');
    
    // Only process if we have reg and mileage params and we're on step 2
    if (regParam && mileageParam && stepParam === '2' && !vehicleData) {
      console.log('📋 Processing URL parameters from van warranty page:', { regParam, mileageParam, makeParam, modelParam });
      
      const urlVehicleData: VehicleData = {
        regNumber: decodeURIComponent(regParam),
        mileage: decodeURIComponent(mileageParam),
        email: '',
        phone: '',
        firstName: '',
        lastName: '',
        address: '',
        make: makeParam ? decodeURIComponent(makeParam) : '',
        model: modelParam ? decodeURIComponent(modelParam) : '',
        fuelType: fuelTypeParam ? decodeURIComponent(fuelTypeParam) : '',
        transmission: '',
        year: yearParam ? decodeURIComponent(yearParam) : '',
        vehicleType: vehicleTypeParam ? decodeURIComponent(vehicleTypeParam) : ''
      };
      
      console.log('✅ Setting vehicle data from URL params:', urlVehicleData);
      setVehicleData(urlVehicleData);
      saveWithTimestamp('buyawarranty_vehicleData', JSON.stringify(urlVehicleData));
    }
  }, [searchParams, vehicleData]);
  
  // Optimized localStorage operations with batching and 30-day expiry
  const saveStateToLocalStorage = useCallback((step?: number, overrideVehicleData?: VehicleData | null, overrideFormData?: any) => {
    const currentStepValue = step || currentStep;
    const dataToSave = overrideVehicleData !== undefined ? overrideVehicleData : vehicleData;
    const formDataToSave = overrideFormData || formData;
    
    const state = {
      step: currentStepValue,
      vehicleData: dataToSave,
      selectedPlan,
      formData: formDataToSave
    };
    
    // Save with timestamps for 30-day expiry
    saveWithTimestamp('warrantyJourneyState', JSON.stringify(state));
    saveWithTimestamp('buyawarranty_formData', JSON.stringify(formDataToSave));
    saveWithTimestamp('buyawarranty_currentStep', String(currentStepValue));
    
    if (dataToSave) {
      saveWithTimestamp('buyawarranty_vehicleData', JSON.stringify(dataToSave));
    }
    if (selectedPlan) {
      saveWithTimestamp('buyawarranty_selectedPlan', JSON.stringify(selectedPlan));
    }
  }, [currentStep, vehicleData, selectedPlan, formData]);
  
  // Memoized localStorage operations
  const loadStateFromLocalStorage = useCallback(() => {
    try {
      const savedState = localStorage.getItem('warrantyJourneyState');
      return savedState ? JSON.parse(savedState) : null;
    } catch (error) {
      console.error('Error loading state from localStorage:', error);
      return null;
    }
  }, []);
  
  // Update URL when step changes
  const updateStepInUrl = (step: number) => {
    console.log('🔗 updateStepInUrl called:', { step, currentUrl: window.location.href });
    const newSearchParams = new URLSearchParams(searchParams);
    newSearchParams.set('step', step.toString());
    
    // Push state to history (not replace) so each step creates a history entry
    // This allows proper back button navigation
    const newUrl = `${window.location.pathname}?${newSearchParams.toString()}`;
    window.history.pushState({ step }, '', newUrl);
    console.log('🔗 History pushed, new URL:', newUrl);
    
    // Also update React Router's search params without adding another history entry
    setSearchParams(newSearchParams, { replace: true });
    console.log('✅ updateStepInUrl completed');
  };
  
  // Restore state from localStorage for a specific step
  const restoreStateFromStep = useCallback((step: number) => {
    console.log('🔄 Restoring state for step', step);
    const savedState = loadStateFromLocalStorage();
    
    if (savedState) {
      console.log('✅ Found saved state:', savedState);
      if (savedState.vehicleData) setVehicleData(savedState.vehicleData);
      if (savedState.selectedPlan) setSelectedPlan(savedState.selectedPlan);
      if (savedState.formData) setFormData(savedState.formData);
    } else {
      console.log('⚠️ No saved state found, checking individual items');
      // Try individual localStorage items as fallback
      const savedVehicleData = localStorage.getItem('buyawarranty_vehicleData');
      const savedSelectedPlan = localStorage.getItem('buyawarranty_selectedPlan');
      const savedFormData = localStorage.getItem('buyawarranty_formData');
      
      if (savedVehicleData) {
        try {
          setVehicleData(JSON.parse(savedVehicleData));
        } catch (e) {
          console.error('Error parsing vehicleData:', e);
        }
      }
      
      if (savedSelectedPlan) {
        try {
          setSelectedPlan(JSON.parse(savedSelectedPlan));
        } catch (e) {
          console.error('Error parsing selectedPlan:', e);
        }
      }
      
      if (savedFormData) {
        try {
          setFormData(JSON.parse(savedFormData));
        } catch (e) {
          console.error('Error parsing formData:', e);
        }
      }
    }
  }, [loadStateFromLocalStorage]);
  
  const handleStepChange = (step: number) => {
    console.log('📍 Step change:', currentStep, '->', step);
    setCurrentStep(step);
    updateStepInUrl(step);
    // Store current state in localStorage for persistence
    saveStateToLocalStorage(step);
    window.scrollTo({ top: 0, behavior: 'smooth' });
  };

  // Removed backup restoration - navigation should preserve state without restoration logic
  

  // Handle mobile back button navigation to keep users on the site
  const { allowLeave, stay } = useMobileBackNavigation({
    currentStep,
    onStepChange: handleStepChange,
    totalSteps: 5,
    restoreStateFromStep,
    journeyId: 'warranty-journey',
    isGuarded: currentStep > 1, // Only guard if user has progressed past step 1
    onShowConfirmDialog: () => setShowBackConfirmDialog(true)
  });
  
  // Debounced state saving to reduce localStorage writes
  useEffect(() => {
    if (vehicleData || selectedPlan) {
      const timeoutId = setTimeout(() => {
        saveStateToLocalStorage();
      }, 300);
      return () => clearTimeout(timeoutId);
    }
  }, [vehicleData, selectedPlan, saveStateToLocalStorage]);
  
  // Reset state when navigating to homepage without step param (e.g., from header logo)
  useEffect(() => {
    const stepParam = searchParams.get('step');
    const pathname = window.location.pathname;
    
    // If we're on "/" without a step param and localStorage was cleared, reset UI state
    if (pathname === '/' && !stepParam) {
      const savedVehicleData = localStorage.getItem('warrantyVehicleData');
      const savedFormData = localStorage.getItem('warrantyFormData');
      
      // If localStorage was cleared (by logo click), reset all state
      if (!savedVehicleData && !savedFormData && (vehicleData || currentStep > 1)) {
        console.log('🏠 Resetting state after logo navigation');
        setVehicleData(null);
        setSelectedPlan(null);
        setCurrentStep(1);
      }
    }
  }, [searchParams]);
  
  
  useEffect(() => {
    console.log('useEffect triggered, current URL:', window.location.href);
    console.log('searchParams:', Object.fromEntries(searchParams.entries()));
    console.log('currentStep:', currentStep);
    
    // Only scroll to top when the step actually changes, not on every state update
    // This prevents the annoying scroll-to-top on mobile when interacting with form fields
    if (previousStepRef.current !== null && previousStepRef.current !== currentStep) {
      window.scrollTo(0, 0);
    }
    previousStepRef.current = currentStep;
    
    // Check for quote parameter from email links FIRST
    const quoteParam = searchParams.get('quote');
    const emailParam = searchParams.get('email');
    
    console.log('URL params check:', { quoteParam, emailParam, currentUrl: window.location.href });
    
    // Quote restoration is now handled by the earlier effect to avoid duplication

    // Discount popup DISABLED - not converting
    // Show discount popup after 20 seconds of scrolling (not on homepage)
    if (false && currentStep !== 1) {
      // Check if already seen popup in this session
      const hasSeenPopup = sessionStorage.getItem('hasSeenDiscountPopup');
      if (hasSeenPopup) return;
      
      let scrollTime = 0;
      let scrollTimer: NodeJS.Timeout;
      let isScrolling = false;
      
      const handleScroll = () => {
        if (!isScrolling) {
          isScrolling = true;
          scrollTimer = setInterval(() => {
            scrollTime += 100; // Increment by 100ms
            if (scrollTime >= 20000) { // 20 seconds
              setShowDiscountPopup(true);
              clearInterval(scrollTimer);
              window.removeEventListener('scroll', handleScroll);
            }
          }, 100);
        }
        
        // Reset scrolling flag after a brief pause
        clearTimeout(scrollTimer);
        scrollTimer = setTimeout(() => {
          isScrolling = false;
          clearInterval(scrollTimer);
        }, 150);
      };
      
      window.addEventListener('scroll', handleScroll);
      
      return () => {
        window.removeEventListener('scroll', handleScroll);
        clearInterval(scrollTimer);
      };
    }
    
    // Note: popstate is now handled by useMobileBackNavigation hook
    // which includes state restoration logic
    
    // Skip if we're handling a restore parameter (handled by dedicated effect above)
    const restoreParam = searchParams.get('restore');
    if (restoreParam) {
      return;
    }
    
    // Load saved state on initial load ONLY if we don't already have data in state
    const savedState = loadStateFromLocalStorage();
    const stepFromUrl = getStepFromUrl();
    
    // Only restore from localStorage if vehicleData/selectedPlan are not already set
    if (savedState && stepFromUrl > 1 && !vehicleData && !selectedPlan) {
      console.log('📦 Restoring from localStorage on initial load');
      setVehicleData(savedState.vehicleData);
      setSelectedPlan(savedState.selectedPlan);
      setFormData(prev => savedState.formData || prev);
    } else if (stepFromUrl === 1) {
      // Clear localStorage if we're starting fresh
      localStorage.removeItem('warrantyJourneyState');
      localStorage.removeItem('buyawarranty_vehicleData');
      localStorage.removeItem('buyawarranty_selectedPlan');
      localStorage.removeItem('buyawarranty_formData');
      localStorage.removeItem('buyawarranty_currentStep');
      localStorage.removeItem('buyawarranty_customerData');
    }
    
    // Additional recovery for when users return from payment pages
    // CRITICAL: Check if user returned from payment gateway via browser back button
    const returnedFromPayment = localStorage.getItem('buyawarranty_returnedFromPayment') === 'true';
    if (returnedFromPayment) {
      console.log('🔙 User returned from payment gateway - restoring step 4');
      localStorage.removeItem('buyawarranty_returnedFromPayment'); // Clear flag
    }
    
    if (stepFromUrl === 4 && (!vehicleData || !selectedPlan)) {
      console.log('Step 4 detected without required data, attempting recovery from localStorage');
      
      const savedVehicleData = localStorage.getItem('buyawarranty_vehicleData');
      const savedSelectedPlan = localStorage.getItem('buyawarranty_selectedPlan');
      const savedFormData = localStorage.getItem('buyawarranty_formData');
      
      if (savedVehicleData && !vehicleData) {
        try {
          const parsedVehicleData = JSON.parse(savedVehicleData);
          console.log('Recovered vehicle data:', parsedVehicleData);
          setVehicleData(parsedVehicleData);
        } catch (error) {
          console.error('Error parsing saved vehicle data:', error);
        }
      }
      
      if (savedSelectedPlan && !selectedPlan) {
        try {
          const parsedSelectedPlan = JSON.parse(savedSelectedPlan);
          console.log('Recovered selected plan:', parsedSelectedPlan);
          setSelectedPlan(parsedSelectedPlan);
        } catch (error) {
          console.error('Error parsing saved selected plan:', error);
        }
      }
      
      if (savedFormData) {
        try {
          const parsedFormData = JSON.parse(savedFormData);
          setFormData(prev => ({ ...prev, ...parsedFormData }));
        } catch (error) {
          console.error('Error parsing saved form data:', error);
        }
      }
    }
    
    // Cleanup handled by useMobileBackNavigation hook
  }, [searchParams, quoteParam, emailParam, restoreQuoteData, currentStep, vehicleData, selectedPlan, loadStateFromLocalStorage, setSearchParams]);
  
  const steps = ['Your Reg Plate', 'Receive Quote', 'Choose Your Plan', 'Review & Confirm'];

  const handleRegistrationComplete = (data: VehicleData) => {
    const nextStep = data.isManualEntry ? 3 : 2;
    
    setVehicleData(data);
    setFormData({ ...formData, ...data });
    setCurrentStep(nextStep);
    updateStepInUrl(nextStep);
    saveStateToLocalStorage(nextStep);
    window.scrollTo({ top: 0, behavior: 'smooth' });
  };

  const handleHomepageRegistration = (newVehicleData: VehicleData) => {
    console.log('🚀 handleHomepageRegistration called with:', newVehicleData);
    
    // Merge new vehicle data with existing form data
    const updatedFormData = { ...formData, ...newVehicleData };
    
    // Save to localStorage FIRST before updating state
    saveStateToLocalStorage(2, newVehicleData, updatedFormData);
    
    // Update all state together in a batch
    setVehicleData(newVehicleData);
    setFormData(updatedFormData);
    setCurrentStep(2);
    
    // Update URL after state is set
    updateStepInUrl(2);
    window.scrollTo({ top: 0, behavior: 'smooth' });
    
    console.log('✅ Navigation to step 2 complete, vehicleData:', newVehicleData);
  };

  const handleBackToStep = (step: number) => {
    console.log('🔙 handleBackToStep called:', { from: currentStep, to: step });
    setCurrentStep(step);
    updateStepInUrl(step);
    saveStateToLocalStorage(step);
    window.scrollTo({ top: 0, behavior: 'smooth' });
    console.log('✅ handleBackToStep completed');
  };

  const handleFormDataUpdate = (data: Partial<VehicleData>) => {
    setFormData({ ...formData, ...data });
  };

  const handleQuoteDeliveryComplete = (contactData: { email: string; phone: string; firstName: string; lastName: string }) => {
    const updatedData = { ...vehicleData, ...contactData };
    setVehicleData(updatedData as VehicleData);
    setFormData({ ...formData, ...contactData });
    setCurrentStep(3);
    updateStepInUrl(3);
    saveStateToLocalStorage(3);
    window.scrollTo({ top: 0, behavior: 'smooth' });
    
    // Fire Meta Pixel Lead event on Step 2 completion
    trackMetaPixelFunnelEvent('Lead', {
      content_name: 'Step 2 - Quote Delivery',
      content_category: 'Lead Capture',
      vehicle_reg: vehicleData?.regNumber,
    });
    
    // NOTE: Do NOT call trackAbandonedCart here - a sales_lead was already
    // created in QuoteDeliveryStep, so this would cause duplicate entries.
  };

  const handlePlanSelected = (
    planId: string, 
    paymentType: string, 
    planName?: string, 
    pricingData?: {
      totalPrice: number, 
      monthlyPrice: number, 
      voluntaryExcess: number, 
      selectedAddOns: {[addon: string]: boolean}, 
      protectionAddOns?: {[key: string]: boolean},
      claimLimit?: number,
      labourRate?: number,
      boostAddon?: boolean
    }
  ) => {
    const newSelectedPlan = { id: planId, paymentType, name: planName, pricingData };
    setSelectedPlan(newSelectedPlan);
    
    // CRITICAL: Save the NEW selectedPlan directly to localStorage to avoid stale closure issue
    // saveStateToLocalStorage() captures the OLD selectedPlan from its closure,
    // so we must manually save the fresh plan data immediately
    const saveNewPlanToLocalStorage = (step: number) => {
      const state = {
        step,
        vehicleData,
        selectedPlan: newSelectedPlan,
        formData
      };
      saveWithTimestamp('warrantyJourneyState', JSON.stringify(state));
      saveWithTimestamp('buyawarranty_selectedPlan', JSON.stringify(newSelectedPlan));
      saveWithTimestamp('buyawarranty_currentStep', String(step));
      if (vehicleData) {
        saveWithTimestamp('buyawarranty_vehicleData', JSON.stringify(vehicleData));
      }
      saveWithTimestamp('buyawarranty_formData', JSON.stringify(formData));
    };
    
    // Check if S17DRW registration - redirect to /steptest for Payment Assist testing
    const normalizedReg = (vehicleData?.regNumber || '').replace(/\s/g, '').toUpperCase();
    if (normalizedReg === 'S17DRW') {
      saveNewPlanToLocalStorage(4);
      window.location.href = '/steptest';
      return;
    }
    
    setCurrentStep(4); // Go to step 4 for customer details/checkout
    updateStepInUrl(4);
    saveNewPlanToLocalStorage(4);
    window.scrollTo({ top: 0, behavior: 'smooth' });
    
    // Send instant email when customer reaches step 4 (they already provided email in step 2)
    if (vehicleData?.email && vehicleData?.regNumber) {
      console.log('📧 Sending step 4 instant email to:', vehicleData.email);
      supabase.functions.invoke('send-step4-instant-email', {
        body: {
          email: vehicleData.email,
          firstName: vehicleData.firstName || '',
          lastName: vehicleData.lastName || '',
          phone: vehicleData.phone || '',
          vehicleReg: vehicleData.regNumber,
          vehicleMake: vehicleData.make || '',
          vehicleModel: vehicleData.model || '',
          vehicleYear: vehicleData.year || '',
          vehicleType: vehicleData.vehicleType || 'car',
          mileage: vehicleData.mileage || '',
          fuelType: vehicleData.fuelType || '',
          transmission: vehicleData.transmission || '',
          planName: planName || '',
          paymentType: paymentType,
          totalPrice: pricingData?.totalPrice,
          monthlyPrice: pricingData?.monthlyPrice
        }
      }).then(() => {
        console.log('✅ Step 4 instant email sent successfully');
      }).catch((error) => {
        console.error('❌ Error sending step 4 instant email:', error);
      });
      
      // Also track abandoned cart for step 4
      trackAbandonedCart(vehicleData as VehicleData, 4, planName, paymentType);
    }
  };


  const handleCustomerDetailsComplete = (customerData: any) => {
    // This will be handled by the CustomerDetailsStep component itself
    console.log('Customer details completed:', customerData);
  };

  // Memoized abandoned cart tracking to avoid unnecessary calls
  const trackAbandonedCart = useCallback(async (data: VehicleData, step: number, planName?: string, paymentType?: string) => {
    // Track if we have either an email OR a vehicle registration
    const hasValidEmail = data.email && data.email.includes('@');
    const hasVehicleReg = data.regNumber && data.regNumber.trim() !== '';
    
    if (!hasValidEmail && !hasVehicleReg) {
      console.log('⏭️ Skipping abandoned cart tracking - no email or vehicle reg');
      return;
    }
    
    try {
      // Only track if we have a valid email
      if (!hasValidEmail) {
        console.log('⏭️ Skipping abandoned cart tracking - no valid email yet');
        return;
      }
      
      const fbclid = getStoredFbclid();
      const gclid = getStoredGclid();
      const fbReferrer = getStoredFbReferrer();
      
      await supabase.functions.invoke('track-abandoned-cart', {
        body: {
          full_name: data.firstName ? `${data.firstName}${data.lastName ? ' ' + data.lastName : ''}`.trim() : null,
          email: data.email,
          phone: data.phone?.trim() || undefined,
          vehicle_reg: data.regNumber,
          vehicle_make: data.make,
          vehicle_model: data.model,
          vehicle_year: data.year,
          vehicle_type: data.vehicleType,
          mileage: data.mileage,
          plan_name: planName,
          payment_type: paymentType,
          step_abandoned: step,
          ...(fbclid ? { fbclid } : {}),
          ...(gclid ? { gclid } : {}),
          ...(fbReferrer && !fbclid ? { fb_referrer: fbReferrer } : {}),
        }
      });
      console.log(`✅ Tracked abandoned cart at step ${step} for:`, data.email);
    } catch (error) {
      console.error('Error tracking abandoned cart:', error);
    }
  }, []);

  // All vehicles now use the modern PricingTable layout

  // Show loading state during restoration
  if (isRestoring) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-gradient-to-b from-blue-50 to-white">
        <div className="max-w-md w-full mx-auto px-6 text-center space-y-6">
          <div className="animate-spin rounded-full h-16 w-16 border-b-4 border-blue-600 mx-auto"></div>
          <h2 className="text-2xl font-bold text-gray-900">
            Restoring Your Cart...
          </h2>
          <p className="text-gray-600">
            We're loading your warranty details. This will only take a moment.
          </p>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen w-full">
      <SEOHead 
        title={
          currentStep === 1 ? "Car Warranty Prices | Affordable UK Vehicle Warranties" :
          currentStep === 2 ? "Get Your Car Warranty Quote | Instant Online Quotes" :
          currentStep === 3 ? "Choose Your Car Warranty Plan | Compare Prices" :
          "Complete Your Car Warranty Purchase | Secure Checkout"
        }
        description={
          currentStep === 1 ? "Compare our car warranty prices and choose the perfect plan for your vehicle. Flexible, affordable UK coverage with no hidden fees. Instant online quotes available." :
          currentStep === 2 ? "Get an instant quote for your car warranty. Enter your vehicle details and receive competitive pricing for comprehensive coverage in the UK." :
          currentStep === 3 ? "Compare car warranty plans and choose the best coverage for your vehicle. Basic, Gold, and Platinum options available with flexible payment terms." :
          "Complete your car warranty purchase with our secure checkout. Review your selected plan and enter your details for instant approval."
        }
        keywords="car warranty, vehicle warranty, UK warranty, car insurance, breakdown cover, warranty prices, vehicle protection, extended warranty"
        canonical="https://buyawarranty.co.uk/"
      />
      
      {/* Schema.org Structured Data for AI Search & SEO */}
      <OrganizationSchema type="LocalBusiness" />
      <ReviewSchema />
      <WebPageSchema 
        name="Car Warranty UK | Instant Quotes"
        description="Leading UK car warranty provider since 2016 with 4.7-star Trustpilot rating. Get instant quotes for comprehensive vehicle protection."
        url="https://buyawarranty.co.uk/"
      />
      <FAQSchema faqs={defaultWarrantyFAQs} />
      <ProductSchema 
        name="Car Warranty UK"
        description="Comprehensive car warranty protection for UK vehicles. Flexible plans from £20/month with instant online quotes and 14-day money-back guarantee."
        price="20"
        priceCurrency="GBP"
      />
      <BreadcrumbSchema 
        items={[
          { name: 'HOME PAGE', url: 'https://buyawarranty.co.uk/' },
          { name: 'MAKE A CLAIM', url: 'https://buyawarranty.co.uk/make-a-claim/' },
          { name: "WHAT'S COVERED", url: 'https://buyawarranty.co.uk/what-is-covered/' },
          { name: "FAQ'S", url: 'https://buyawarranty.co.uk/faq/' },
          { name: 'LOGIN', url: 'https://buyawarranty.co.uk/customer-dashboard/' },
          { name: 'CAR WARRANTY', url: 'https://buyawarranty.co.uk/buy-a-used-car-warranty-reliable-warranties/' },
          { name: 'VAN WARRANTY', url: 'https://buyawarranty.co.uk/van-warranty/' },
          { name: 'EV WARRANTY', url: 'https://buyawarranty.co.uk/ev-warranty/' },
          { name: 'MOTOR CYCLE WARRANTY', url: 'https://buyawarranty.co.uk/motorcycle-warranty/' },
          { name: 'WARRANTY TYPES', url: 'https://buyawarranty.co.uk/warranty-types/' },
        ]}
      />
      
      {/* Compact Progress Bar - Steps 2, 3, and 4 */}
      {currentStep >= 2 && currentStep <= 4 && (
        <PerformanceOptimizedSuspense height="80px">
          <CompactProgressBar currentStep={currentStep} />
        </PerformanceOptimizedSuspense>
      )}
      
      {currentStep === 1 && (
        <Homepage onRegistrationSubmit={handleHomepageRegistration} />
      )}

      {currentStep === 2 && (
        <>
          {console.log('🎨 Rendering Step 2, vehicleData:', vehicleData)}
          <div className="bg-[#e8f4fb] w-full px-4 py-2 sm:py-4">
            <div className="max-w-4xl mx-auto">
              {vehicleData ? (
                <QuoteDeliveryStep 
                  vehicleData={vehicleData}
                  onNext={handleQuoteDeliveryComplete}
                  onBack={() => handleBackToStep(1)}
                  onSkip={() => handleStepChange(3)}
                />
              ) : (
                <div className="min-h-[60vh] flex items-center justify-center bg-white rounded-lg shadow-md">
                  <div className="text-center p-8">
                    <CarDrivingLoader text="Loading your quote..." />
                  </div>
                </div>
              )}
            </div>
          </div>
        </>
      )}

      {currentStep === 3 && (
        <div className="w-full">
          {vehicleData ? (
            <PerformanceOptimizedSuspense height="60vh">
              <PricingTable 
                vehicleData={vehicleData} 
                onBack={() => handleBackToStep(2)}
                onChangeVehicle={() => {
                  setVehicleData(null);
                  setSelectedPlan(null);
                  handleStepChange(1);
                }}
                onPlanSelected={handlePlanSelected}
                previousPaymentType={selectedPlan?.paymentType as '12months' | '24months' | '36months' | undefined}
                previousVoluntaryExcess={selectedPlan?.pricingData?.voluntaryExcess}
                previousClaimLimit={selectedPlan?.pricingData?.claimLimit}
                previousSelectedAddOns={selectedPlan?.pricingData?.selectedAddOns}
                previousProtectionAddOns={selectedPlan?.pricingData?.protectionAddOns}
                previousLabourRate={selectedPlan?.pricingData?.labourRate ?? 50}
                previousBoostAddon={selectedPlan?.pricingData?.boostAddon}
              />
            </PerformanceOptimizedSuspense>
          ) : (
            <div className="w-full px-4 py-8">
              <div className="max-w-4xl mx-auto text-center space-y-6">
                <h2 className="text-2xl font-bold text-gray-900">
                  Vehicle Details Required
                </h2>
                <p className="text-gray-600">
                  To view our warranty plans, we need your vehicle details first.
                </p>
                <Button 
                  onClick={() => handleStepChange(1)}
                  className="bg-blue-600 hover:bg-blue-700 text-white px-8 py-3"
                >
                  Enter Vehicle Details
                </Button>
              </div>
            </div>
          )}
        </div>
      )}


      {currentStep === 4 && (
        <div className="bg-[#e8f4fb]">
          {vehicleData && selectedPlan ? (
            <PerformanceOptimizedSuspense height="60vh">
              <CustomerDetailsStep
                vehicleData={{
                  ...vehicleData,
                  make: vehicleData.make || 'Unknown'
                }}
                planId={selectedPlan.id}
                paymentType={selectedPlan.paymentType}
                planName={selectedPlan.name}
                pricingData={{
                  basePrice: selectedPlan.pricingData?.totalPrice || 0,
                  totalPrice: selectedPlan.pricingData?.totalPrice || 0,
                  ...(selectedPlan.pricingData || {})
                }}
                onNext={handleCustomerDetailsComplete}
                onBack={() => handleBackToStep(3)}
              />
            </PerformanceOptimizedSuspense>
          ) : (
            <RecoveryFallback 
              onRecovered={(recoveredVehicleData, recoveredSelectedPlan) => {
                setVehicleData(recoveredVehicleData);
                setSelectedPlan(recoveredSelectedPlan);
              }}
              onStartOver={() => handleStepChange(1)}
            />
          )}
        </div>
      )}
      

      {/* Discount Popup */}
      <DiscountPopup 
        isOpen={showDiscountPopup} 
        onClose={() => {
          setShowDiscountPopup(false);
          sessionStorage.setItem('hasSeenDiscountPopup', 'true');
        }}
      />

      {/* Back Navigation Confirmation Dialog */}
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
        journeyName="warranty journey"
      />
      
      {/* ScrollToTopButton removed */}
      
      
    </div>
  );
};

export default Index;
