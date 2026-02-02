import { useEffect, useCallback, useState, useRef } from 'react';
import { useNavigate, useLocation } from 'react-router-dom';
import { trackEvent } from '@/utils/analytics';

interface UseMobileBackNavigationProps {
  currentStep: number;
  onStepChange: (step: number, fromBackButton?: boolean) => void;
  totalSteps: number;
  restoreStateFromStep?: (step: number) => void;
  journeyId?: string;
  isGuarded?: boolean; // Whether this journey should show confirmation dialog
  onShowConfirmDialog?: () => void; // Callback to show confirmation dialog
}

export const useMobileBackNavigation = ({ 
  currentStep, 
  onStepChange, 
  totalSteps,
  restoreStateFromStep,
  journeyId = 'warranty-journey',
  isGuarded = true,
  onShowConfirmDialog
}: UseMobileBackNavigationProps) => {
  const navigate = useNavigate();
  const location = useLocation();
  const [hasShownConfirmOnThisStep, setHasShownConfirmOnThisStep] = useState(false);
  const isLeavingRef = useRef(false);
  const lastStepRef = useRef(currentStep);
  const isHandlingBackRef = useRef(false);
  const hasInitializedRef = useRef(false);
  const lastPushedStepRef = useRef<number | null>(null);

  // Reset confirmation flag when step changes
  useEffect(() => {
    if (currentStep !== lastStepRef.current) {
      setHasShownConfirmOnThisStep(false);
      lastStepRef.current = currentStep;
    }
  }, [currentStep]);

  const handleBackNavigation = useCallback((event: PopStateEvent) => {
    // Prevent re-entrancy
    if (isHandlingBackRef.current) {
      console.log('📱 Already handling back, skipping');
      return;
    }
    
    isHandlingBackRef.current = true;
    
    console.log('📱 Back navigation triggered', { 
      currentStep, 
      isGuarded, 
      state: event.state
    });

    // Get the step from popstate event or URL
    const urlParams = new URLSearchParams(window.location.search);
    const urlStep = parseInt(urlParams.get('step') || '0');
    
    // If URL has no step param (navigated to homepage), allow it
    if (!urlParams.has('step') || urlStep === 0) {
      console.log('📱 Navigating to homepage - allowing');
      isHandlingBackRef.current = false;
      
      // If user chose to leave, just let it happen
      if (isLeavingRef.current) {
        isLeavingRef.current = false;
        return;
      }
      
      // For step 1, just go to homepage without confirmation
      if (currentStep <= 1) {
        // Navigate to clean homepage
        navigate('/', { replace: true });
        onStepChange(1, true);
        return;
      }
      
      // For steps 2+, if guarded and haven't shown dialog, show it
      if (isGuarded && !hasShownConfirmOnThisStep && onShowConfirmDialog) {
        // Push state back to prevent leaving
        const currentUrl = `${window.location.pathname}?step=${currentStep}`;
        window.history.pushState({ step: currentStep }, '', currentUrl);
        
        setHasShownConfirmOnThisStep(true);
        onShowConfirmDialog();
        
        trackEvent('back_intercept_shown', {
          journey_id: journeyId,
          step: currentStep
        });
        return;
      }
      
      // Not guarded or already shown dialog - go to homepage
      navigate('/', { replace: true });
      onStepChange(1, true);
      return;
    }
    
    // If navigating between steps (urlStep is a valid step)
    if (urlStep >= 1 && urlStep < currentStep) {
      console.log('📱 Navigating to previous step:', urlStep);
      
      // Track step change
      trackEvent('journey_step_changed', {
        journey_id: journeyId,
        from_step: currentStep,
        to_step: urlStep,
        direction: 'back',
        trigger: 'browser_back_button'
      });
      
      // Restore state for the step
      if (restoreStateFromStep) {
        restoreStateFromStep(urlStep);
      }
      
      // Update step with fromBackButton flag (don't push new history)
      onStepChange(urlStep, true);
      
      // Scroll to top
      window.scrollTo({ top: 0, behavior: 'smooth' });
      
      isHandlingBackRef.current = false;
      return;
    }
    
    // Forward navigation or same step - just update state
    if (urlStep >= 1) {
      onStepChange(urlStep, true);
    }
    
    isHandlingBackRef.current = false;
    
  }, [currentStep, onStepChange, restoreStateFromStep, isGuarded, onShowConfirmDialog, hasShownConfirmOnThisStep, journeyId, navigate]);

  // Method to allow leaving (called when user confirms from dialog)
  const allowLeave = useCallback(() => {
    console.log('📱 User confirmed leave');
    isLeavingRef.current = true;
    setHasShownConfirmOnThisStep(false);
    
    // Track user decision to leave
    trackEvent('back_intercept_leave', {
      journey_id: journeyId,
      step: currentStep
    });
    
    // Navigate to homepage
    navigate('/', { replace: true });
    onStepChange(1, true);
    isLeavingRef.current = false;
  }, [currentStep, journeyId, onStepChange, navigate]);

  // Method to stay (called when user cancels)
  const stay = useCallback(() => {
    console.log('📱 User chose to stay');
    isLeavingRef.current = false;
    
    // Track user decision to stay
    trackEvent('back_intercept_stay', {
      journey_id: journeyId,
      step: currentStep
    });
    
    // Ensure URL is correct
    const currentUrl = `${window.location.pathname}?step=${currentStep}`;
    window.history.replaceState({ step: currentStep }, '', currentUrl);
  }, [currentStep, journeyId]);

  useEffect(() => {
    console.log('📱 Setting up navigation listeners for step', currentStep);
    
    // Set scroll restoration to manual for better control
    if ('scrollRestoration' in window.history) {
      window.history.scrollRestoration = 'manual';
    }
    
    // Ensure we have proper history state for current step
    const urlParams = new URLSearchParams(window.location.search);
    const urlStep = parseInt(urlParams.get('step') || '1');
    
    // Initialize history state once per step
    if (!hasInitializedRef.current || lastPushedStepRef.current !== urlStep) {
      // Set proper state for current URL
      if (!window.history.state || window.history.state.step !== urlStep) {
        window.history.replaceState({ step: urlStep }, '', window.location.href);
      }
      hasInitializedRef.current = true;
      lastPushedStepRef.current = urlStep;
    }
    
    // Listen for popstate events (back/forward button presses)
    window.addEventListener('popstate', handleBackNavigation);
    
    // iOS Safari bfcache handling
    const handlePageShow = (event: PageTransitionEvent) => {
      if (event.persisted) {
        console.log('📱 Page restored from bfcache');
        // Reset flags when page comes back from bfcache
        isLeavingRef.current = false;
        isHandlingBackRef.current = false;
        setHasShownConfirmOnThisStep(false);
        
        // Ensure history state is correct
        const urlParams = new URLSearchParams(window.location.search);
        const urlStep = parseInt(urlParams.get('step') || '1');
        window.history.replaceState({ step: urlStep }, '', window.location.href);
      }
    };
    
    window.addEventListener('pageshow', handlePageShow);
    
    return () => {
      window.removeEventListener('popstate', handleBackNavigation);
      window.removeEventListener('pageshow', handlePageShow);
    };
  }, [handleBackNavigation, currentStep]);

  return {
    allowLeave,
    stay
  };
};
