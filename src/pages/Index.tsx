
import React, { useState, useEffect, useCallback, useMemo, lazy } from 'react';
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

// Lazy load heavy components that are not immediately visible
const RegistrationForm = lazy(() => import('@/components/RegistrationForm'));
const PricingTable = lazy(() => import('@/components/PricingTable'));
const CarJourneyProgress = lazy(() => import('@/components/CarJourneyProgress'));
const QuoteDeliveryStep = lazy(() => import('@/components/QuoteDeliveryStep'));
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
}

// Recovery fallback component
const RecoveryFallback: React.FC<{
  onRecovered: (vehicleData: VehicleData, selectedPlan: any) => void;
  onStartOver: () => void;
}> = ({ onRecovered, onStartOver }) => {
  const [isAttemptingRecovery, setIsAttemptingRecovery] = useState(false);
  const [recoveryFailed, setRecoveryFailed] = useState(false);

  useEffect(() => {
    // Attempt automatic recovery once
    const attemptRecovery = () => {
      setIsAttemptingRecovery(true);
      
      try {
        const savedVehicleData = localStorage.getItem('buyawarranty_vehicleData');
        const savedSelectedPlan = localStorage.getItem('buyawarranty_selectedPlan');
        
        if (savedVehicleData && savedSelectedPlan) {
          const parsedVehicleData = JSON.parse(savedVehicleData);
          const parsedSelectedPlan = JSON.parse(savedSelectedPlan);
          
          console.log('Recovery attempt successful:', { parsedVehicleData, parsedSelectedPlan });
          onRecovered(parsedVehicleData, parsedSelectedPlan);
          return;
        }
      } catch (error) {
        console.error('Error during recovery attempt:', error);
      }
      
      // Recovery failed
      setRecoveryFailed(true);
      setIsAttemptingRecovery(false);
    };

    attemptRecovery();
  }, [onRecovered]);

  if (isAttemptingRecovery) {
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
    // Scroll to top so user can see the error message
    useEffect(() => {
      window.scrollTo({ top: 0, behavior: 'smooth' });
    }, []);
    
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
        
        console.log('✅ Successfully restored vehicle data from email:', completeVehicleData);
        return completeVehicleData;
      } catch (error) {
        console.error('❌ Error decoding restore parameter:', error);
        return null;
      }
    }
    
    // Priority 2: Check localStorage with 30-day expiry
    try {
      const saved = getWithTimestamp('buyawarranty_vehicleData', 30);
      if (!saved) {
        console.log('⏰ Vehicle data expired or not found');
        return null;
      }
      return JSON.parse(saved);
    } catch {
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
    
    // Priority 2: Check localStorage with 30-day expiry
    try {
      const saved = getWithTimestamp('buyawarranty_selectedPlan', 30);
      if (!saved) {
        console.log('⏰ Selected plan expired or not found');
        return null;
      }
      return JSON.parse(saved);
    } catch {
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
      claimLimit?: number
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
    
    // Priority 2: Check localStorage with 30-day expiry
    try {
      const saved = getWithTimestamp('buyawarranty_formData', 30);
      if (saved) {
        return JSON.parse(saved);
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
  const saveStateToLocalStorage = useCallback((step?: number) => {
    const currentStepValue = step || currentStep;
    const state = {
      step: currentStepValue,
      vehicleData,
      selectedPlan,
      formData
    };
    
    // Save with timestamps for 30-day expiry
    saveWithTimestamp('warrantyJourneyState', JSON.stringify(state));
    saveWithTimestamp('buyawarranty_formData', JSON.stringify(formData));
    saveWithTimestamp('buyawarranty_currentStep', String(currentStepValue));
    
    if (vehicleData) {
      saveWithTimestamp('buyawarranty_vehicleData', JSON.stringify(vehicleData));
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

  // Redirect to step 1 if accessing step 2+ without vehicle data
  // BUT: Don't redirect if we're still restoring from URL
  useEffect(() => {
    console.log('🔍 Checking vehicle data:', { 
      currentStep, 
      hasVehicleData: !!vehicleData, 
      isRestoringFromUrl,
      vehicleDataKeys: vehicleData ? Object.keys(vehicleData) : 'null'
    });
    
    // Skip redirect check if we're still restoring from URL
    if (isRestoringFromUrl) {
      console.log('⏳ Skipping redirect check - restoring from URL');
      return;
    }
    
    if (currentStep >= 2 && !vehicleData) {
      console.log('⚠️ Accessing step', currentStep, 'without vehicle data, redirecting to step 1');
      handleStepChange(1);
    }
  }, [currentStep, vehicleData, isRestoringFromUrl]);

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
  
  
  useEffect(() => {
    console.log('useEffect triggered, current URL:', window.location.href);
    console.log('searchParams:', Object.fromEntries(searchParams.entries()));
    console.log('currentStep:', currentStep);
    window.scrollTo(0, 0);
    
    // Check for quote parameter from email links FIRST
    const quoteParam = searchParams.get('quote');
    const emailParam = searchParams.get('email');
    
    console.log('URL params check:', { quoteParam, emailParam, currentUrl: window.location.href });
    
    // Quote restoration is now handled by the earlier effect to avoid duplication

    // Show discount popup after 20 seconds of scrolling (not on homepage)
    if (currentStep !== 1) {
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
    
    // Load saved state on initial load
    const savedState = loadStateFromLocalStorage();
    const stepFromUrl = getStepFromUrl();
    
    if (savedState && stepFromUrl > 1) {
      // Restore from localStorage if we're not on step 1
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

  const handleHomepageRegistration = (vehicleData: VehicleData) => {
    console.log('Homepage registration submitted:', vehicleData);
    
    setVehicleData(vehicleData);
    setFormData({ ...formData, ...vehicleData });
    setCurrentStep(2); // Go to quote delivery step
    updateStepInUrl(2);
    saveStateToLocalStorage(2);
    window.scrollTo({ top: 0, behavior: 'smooth' });
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
    
    // Track pricing page view for abandoned cart emails
    trackAbandonedCart(updatedData as VehicleData, 3);
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
      claimLimit?: number
    }
  ) => {
    setSelectedPlan({ id: planId, paymentType, name: planName, pricingData });
    setCurrentStep(4); // Go to step 4 for customer details/checkout
    updateStepInUrl(4);
    saveStateToLocalStorage(4);
    window.scrollTo({ top: 0, behavior: 'smooth' });
    
    // Note: Abandoned cart tracking for step 4 is handled in CustomerDetailsStep
    // once the user enters their email in the checkout form
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
      
      await supabase.functions.invoke('track-abandoned-cart', {
        body: {
          full_name: data.firstName && data.lastName ? `${data.firstName} ${data.lastName}` : data.email,
          email: data.email,
          phone: data.phone || '',
          vehicle_reg: data.regNumber,
          vehicle_make: data.make,
          vehicle_model: data.model,
          vehicle_year: data.year,
          vehicle_type: data.vehicleType,
          mileage: data.mileage,
          plan_name: planName,
          payment_type: paymentType,
          step_abandoned: step
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
          { name: 'Home', url: 'https://buyawarranty.co.uk/' },
          ...(currentStep === 2 ? [{ name: 'Get Quote', url: 'https://buyawarranty.co.uk/' }] : []),
          ...(currentStep === 3 ? [{ name: 'Choose Plan', url: 'https://buyawarranty.co.uk/' }] : []),
          ...(currentStep === 4 ? [{ name: 'Checkout', url: 'https://buyawarranty.co.uk/' }] : [])
        ]}
      />
      
      {/* Progress Bar with Moving Car - Steps 2, 3, and 4 */}
      {currentStep >= 2 && currentStep <= 4 && (
        <PerformanceOptimizedSuspense height="120px">
          <CarJourneyProgress 
            currentStep={currentStep}
            onLogoClick={() => {
              // Clear all saved data
              safeLocalStorageRemove([
                'buyawarranty_vehicleData',
                'buyawarranty_selectedPlan',
                'buyawarranty_formData',
                'buyawarranty_currentStep',
                'warrantyJourneyState'
              ]);
              // Reset state
              setVehicleData(null);
              setSelectedPlan(null);
              setFormData({
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
              });
              // Go to step 1
              handleStepChange(1);
            }}
          />
        </PerformanceOptimizedSuspense>
      )}
      
      {currentStep === 1 && (
        <Homepage onRegistrationSubmit={handleHomepageRegistration} />
      )}

      {currentStep === 2 && vehicleData && (
        <div className="bg-[#e8f4fb] w-full px-4 py-2 sm:py-4">
          <div className="max-w-4xl mx-auto">
        <PerformanceOptimizedSuspense height="40vh">
          <QuoteDeliveryStep 
            vehicleData={vehicleData}
            onNext={handleQuoteDeliveryComplete}
            onBack={() => handleBackToStep(1)}
            onSkip={() => handleStepChange(3)}
          />
        </PerformanceOptimizedSuspense>
          </div>
        </div>
      )}

      {currentStep === 3 && (
        <div className="bg-[#e8f4fb] w-full">
          {(() => {
            console.log('🚗 Step 3 rendering - vehicleData:', vehicleData);
            console.log('🚗 vehicleData exists:', !!vehicleData);
            if (vehicleData) {
              console.log('✅ Rendering PricingTable with vehicleData:', {
                regNumber: vehicleData.regNumber,
                make: vehicleData.make,
                model: vehicleData.model
              });
            } else {
              console.log('❌ No vehicleData available, showing fallback');
            }
            return vehicleData;
          })() ? (
            <PerformanceOptimizedSuspense height="60vh">
              <PricingTable 
                vehicleData={vehicleData} 
                onBack={() => handleBackToStep(2)} 
                onPlanSelected={handlePlanSelected}
                previousPaymentType={selectedPlan?.paymentType as '12months' | '24months' | '36months' | undefined}
                previousVoluntaryExcess={selectedPlan?.pricingData?.voluntaryExcess}
                previousClaimLimit={selectedPlan?.pricingData?.claimLimit}
                previousSelectedAddOns={selectedPlan?.pricingData?.selectedAddOns}
                previousProtectionAddOns={selectedPlan?.pricingData?.protectionAddOns}
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
                  basePrice: selectedPlan.pricingData.totalPrice || 0,
                  totalPrice: selectedPlan.pricingData.totalPrice || 0,
                  ...selectedPlan.pricingData
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
    </div>
  );
};

export default Index;
