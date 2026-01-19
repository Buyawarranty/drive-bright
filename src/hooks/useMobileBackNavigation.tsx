import { useEffect, useCallback, useState, useRef } from 'react';
import { useNavigate, useLocation } from 'react-router-dom';
import { trackEvent } from '@/utils/analytics';

interface UseMobileBackNavigationProps {
  currentStep: number;
  onStepChange: (step: number) => void;
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
  const historyStackRef = useRef<number[]>([]);
  const isHandlingBackRef = useRef(false);

  // Reset confirmation flag when step changes
  useEffect(() => {
    if (currentStep !== lastStepRef.current) {
      setHasShownConfirmOnThisStep(false);
      
      // Track step in our own history stack
      if (!historyStackRef.current.includes(currentStep)) {
        historyStackRef.current.push(currentStep);
      }
      
      lastStepRef.current = currentStep;
    }
  }, [currentStep]);

  // Initialize our history stack on mount
  useEffect(() => {
    const urlParams = new URLSearchParams(window.location.search);
    const urlStep = parseInt(urlParams.get('step') || '1');
    
    // Build initial history stack from step 1 to current step
    historyStackRef.current = [];
    for (let i = 1; i <= urlStep; i++) {
      historyStackRef.current.push(i);
    }
    
    console.log('📱 Initialized history stack:', historyStackRef.current);
  }, []);

  const handleBackNavigation = useCallback((event: PopStateEvent) => {
    // Prevent re-entrancy
    if (isHandlingBackRef.current) {
      console.log('📱 Already handling back, skipping');
      return;
    }
    
    isHandlingBackRef.current = true;
    
    console.log('📱 Mobile back navigation triggered', { 
      currentStep, 
      isGuarded, 
      hasShownConfirmOnThisStep,
      isLeaving: isLeavingRef.current,
      historyStack: historyStackRef.current,
      historyState: event.state
    });
    
    // Always prevent leaving the site by intercepting and handling navigation ourselves
    event.preventDefault();
    
    // If we're in the process of leaving (user confirmed), navigate to step 1
    if (isLeavingRef.current) {
      console.log('📱 User confirmed leave, going to step 1');
      isLeavingRef.current = false;
      isHandlingBackRef.current = false;
      
      // Go to step 1 instead of leaving
      const step1Url = `${window.location.pathname}?step=1`;
      window.history.replaceState({ step: 1 }, '', step1Url);
      onStepChange(1);
      historyStackRef.current = [1];
      
      trackEvent('back_intercept_leave', {
        journey_id: journeyId,
        step: currentStep,
        step_name: `step_${currentStep}`
      });
      return;
    }
    
    // Calculate the previous step (same as internal back button)
    const previousStep = currentStep - 1;
    
    console.log('📱 Current step:', currentStep, 'Previous step would be:', previousStep);
    
    // If we're on step 1, show confirmation or allow leave
    if (currentStep <= 1) {
      console.log('📱 On step 1, re-establishing state');
      
      // Stay on step 1
      const step1Url = `${window.location.pathname}?step=1`;
      window.history.pushState({ step: 1 }, '', step1Url);
      isHandlingBackRef.current = false;
      return;
    }
    
    // If trying to go back from step 2 to step 1 (homepage), use pushState to allow proper navigation
    if (previousStep === 1) {
      console.log('📱 Navigating back to homepage (step 1)');
      
      // Track step change
      trackEvent('journey_step_changed', {
        journey_id: journeyId,
        from_step: currentStep,
        to_step: 1,
        direction: 'back',
        trigger: 'mobile_back_button'
      });
      
      // Restore state for step 1 if handler provided
      if (restoreStateFromStep) {
        restoreStateFromStep(1);
      }
      
      // Update URL to step 1 (homepage)
      const step1Url = `${window.location.pathname}?step=1`;
      window.history.replaceState({ step: 1 }, '', step1Url);
      
      // Update current step
      onStepChange(1);
      
      // Reset our history stack
      historyStackRef.current = [1];
      
      // Scroll to top
      window.scrollTo({ top: 0, behavior: 'smooth' });
      
      isHandlingBackRef.current = false;
      return;
    }
    
    // If trying to go back from step > 2, navigate to previous step
    if (previousStep >= 1) {
      console.log('📱 Navigating to previous step:', previousStep);
      
      // Track step change
      trackEvent('journey_step_changed', {
        journey_id: journeyId,
        from_step: currentStep,
        to_step: previousStep,
        direction: 'back',
        trigger: 'mobile_back_button'
      });
      
      // Restore state for previous step if handler provided
      if (restoreStateFromStep) {
        restoreStateFromStep(previousStep);
      }
      
      // Update URL and state
      const stepUrl = `${window.location.pathname}?step=${previousStep}`;
      window.history.replaceState({ step: previousStep }, '', stepUrl);
      
      // Update current step (this will trigger the internal onStepChange)
      onStepChange(previousStep);
      
      // Update our history stack
      historyStackRef.current = historyStackRef.current.filter(s => s <= previousStep);
      
      // Scroll to top like internal back button
      window.scrollTo({ top: 0, behavior: 'smooth' });
      
      isHandlingBackRef.current = false;
      return;
    }
    
    // Fallback: stay on current step
    console.log('📱 Fallback: staying on current step');
    const currentUrl = `${window.location.pathname}?step=${currentStep}`;
    window.history.pushState({ step: currentStep }, '', currentUrl);
    isHandlingBackRef.current = false;
    
  }, [currentStep, onStepChange, restoreStateFromStep, totalSteps, isGuarded, onShowConfirmDialog, hasShownConfirmOnThisStep, journeyId]);

  // Method to allow leaving (called when user confirms from dialog)
  const allowLeave = useCallback(() => {
    console.log('📱 Setting allow leave flag');
    isLeavingRef.current = true;
    setHasShownConfirmOnThisStep(false);
    
    // Track user decision to leave
    trackEvent('back_intercept_leave', {
      journey_id: journeyId,
      step: currentStep,
      step_name: `step_${currentStep}`
    });
    
    // Navigate to step 1 instead of leaving the site entirely
    const step1Url = `${window.location.pathname}?step=1`;
    window.history.replaceState({ step: 1 }, '', step1Url);
    onStepChange(1);
    historyStackRef.current = [1];
    
    // Reset the leaving flag
    isLeavingRef.current = false;
  }, [currentStep, journeyId, onStepChange]);

  // Method to stay (called when user cancels)
  const stay = useCallback(() => {
    console.log('📱 User chose to stay');
    isLeavingRef.current = false;
    
    // Track user decision to stay
    trackEvent('back_intercept_stay', {
      journey_id: journeyId,
      step: currentStep,
      step_name: `step_${currentStep}`
    });
    
    // Re-push current state to ensure history is correct
    const currentUrl = `${window.location.pathname}?step=${currentStep}`;
    window.history.pushState({ step: currentStep }, '', currentUrl);
  }, [currentStep, journeyId]);

  // Track if we've already pushed a guard entry for this session
  const hasInitializedHistoryRef = useRef(false);
  const lastPushedStepRef = useRef<number | null>(null);

  useEffect(() => {
    console.log('📱 Setting up mobile navigation listeners for step', currentStep);
    
    // Set scroll restoration to manual for better control
    if ('scrollRestoration' in window.history) {
      window.history.scrollRestoration = 'manual';
    }
    
    // Ensure we have proper history state for current step
    const urlParams = new URLSearchParams(window.location.search);
    const urlStep = parseInt(urlParams.get('step') || '1');
    
    // Always ensure history state matches current step
    if (!window.history.state || window.history.state.step !== urlStep) {
      window.history.replaceState({ step: urlStep }, '', window.location.href);
      console.log('📱 Set history state for step', urlStep);
    }
    
    // Only push guard entry once per step to prevent history pollution
    // This prevents slow loading when returning from external sites like Stripe
    if (!hasInitializedHistoryRef.current || lastPushedStepRef.current !== urlStep) {
      window.history.pushState({ step: urlStep, guard: true }, '', window.location.href);
      console.log('📱 Pushed guard entry for step', urlStep);
      hasInitializedHistoryRef.current = true;
      lastPushedStepRef.current = urlStep;
    }
    
    // Listen for popstate events (back/forward button presses)
    window.addEventListener('popstate', handleBackNavigation);
    
    // iOS Safari specific: handle bfcache
    const handlePageShow = (event: PageTransitionEvent) => {
      if (event.persisted) {
        console.log('📱 Page restored from bfcache - fast path');
        // Reset state when page comes back from bfcache
        isLeavingRef.current = false;
        isHandlingBackRef.current = false;
        setHasShownConfirmOnThisStep(false);
        
        // Re-establish proper history state WITHOUT pushing new entries
        // This is the key fix - we only replaceState, not pushState
        const urlParams = new URLSearchParams(window.location.search);
        const urlStep = parseInt(urlParams.get('step') || '1');
        
        // Just ensure history state is correct, don't push more entries
        window.history.replaceState({ step: urlStep }, '', window.location.href);
        
        // Only push a guard entry if we don't already have one
        if (lastPushedStepRef.current !== urlStep) {
          window.history.pushState({ step: urlStep, guard: true }, '', window.location.href);
          lastPushedStepRef.current = urlStep;
        }
      }
    };
    
    const handlePageHide = (event: PageTransitionEvent) => {
      if (event.persisted) {
        console.log('📱 Page going into bfcache');
      }
    };
    
    // Handle beforeunload to prevent accidental navigation away
    const handleBeforeUnload = (event: BeforeUnloadEvent) => {
      if (currentStep > 1 && isGuarded) {
        // Don't show browser dialog, but ensure we can catch this
        console.log('📱 beforeunload triggered on step', currentStep);
      }
    };
    
    window.addEventListener('pageshow', handlePageShow);
    window.addEventListener('pagehide', handlePageHide);
    window.addEventListener('beforeunload', handleBeforeUnload);
    
    return () => {
      console.log('📱 Cleaning up mobile navigation listeners');
      window.removeEventListener('popstate', handleBackNavigation);
      window.removeEventListener('pageshow', handlePageShow);
      window.removeEventListener('pagehide', handlePageHide);
      window.removeEventListener('beforeunload', handleBeforeUnload);
    };
  }, [handleBackNavigation, currentStep, isGuarded]);

  return {
    allowLeave,
    stay
  };
};
