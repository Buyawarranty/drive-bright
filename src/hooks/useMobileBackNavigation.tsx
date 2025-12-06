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
  const initializedRef = useRef(false);

  // Reset confirmation flag when step changes
  useEffect(() => {
    if (currentStep !== lastStepRef.current) {
      setHasShownConfirmOnThisStep(false);
      lastStepRef.current = currentStep;
    }
  }, [currentStep]);

  const handleBackNavigation = useCallback((event: PopStateEvent) => {
    console.log('📱 Mobile back navigation triggered', { 
      currentStep, 
      isGuarded, 
      hasShownConfirmOnThisStep,
      isLeaving: isLeavingRef.current,
      historyState: event.state
    });
    
    // If we're in the process of leaving (user confirmed), allow it
    if (isLeavingRef.current) {
      console.log('📱 User confirmed leave, allowing navigation');
      trackEvent('back_intercept_leave', {
        journey_id: journeyId,
        step: currentStep,
        step_name: `step_${currentStep}`
      });
      return;
    }
    
    // Get the step from the history state first, then fall back to URL
    const stateStep = event.state?.step;
    const urlParams = new URLSearchParams(window.location.search);
    const urlStep = parseInt(urlParams.get('step') || '1');
    const targetStep = stateStep !== undefined ? stateStep : urlStep;
    const referrer = urlParams.get('referrer');
    
    console.log('📱 Target step:', targetStep, 'Current step:', currentStep, 'State:', event.state, 'Referrer:', referrer);
    
    // If event state exists and has journey_base marker, user is trying to leave the journey
    if (event.state?.journey_base === journeyId) {
      console.log('📱 Hit journey base marker, user is trying to leave');
      
      if (isGuarded && currentStep > 1 && !hasShownConfirmOnThisStep && onShowConfirmDialog) {
        console.log('📱 Showing confirmation dialog before leaving');
        
        // Re-push current step to prevent leaving
        const currentUrl = `${window.location.pathname}?step=${currentStep}`;
        window.history.pushState({ step: currentStep }, '', currentUrl);
        
        trackEvent('back_intercept_shown', {
          journey_id: journeyId,
          step: currentStep,
          step_name: `step_${currentStep}`
        });
        
        setHasShownConfirmOnThisStep(true);
        onShowConfirmDialog();
        return;
      }
      
      // If not guarded or already shown, go back to step 1
      console.log('📱 Navigating to step 1');
      onStepChange(1);
      const step1Url = `${window.location.pathname}?step=1`;
      window.history.replaceState({ step: 1 }, '', step1Url);
      return;
    }
    
    // If state is null/undefined and we're on a step > 1, prevent leaving the site
    if (!event.state && currentStep > 1) {
      console.log('📱 No history state and on step > 1, preventing site exit');
      
      // Re-push current step to stay on site
      const currentUrl = `${window.location.pathname}?step=${currentStep}`;
      window.history.pushState({ step: currentStep }, '', currentUrl);
      
      if (isGuarded && !hasShownConfirmOnThisStep && onShowConfirmDialog) {
        trackEvent('back_intercept_shown', {
          journey_id: journeyId,
          step: currentStep,
          step_name: `step_${currentStep}`
        });
        
        setHasShownConfirmOnThisStep(true);
        onShowConfirmDialog();
      }
      return;
    }
    
    // If on step 2 and going back, check for referrer
    if (currentStep === 2 && targetStep < 2 && referrer) {
      console.log('📱 Going back from step 2 with referrer, navigating to:', referrer);
      window.location.href = referrer;
      return;
    }
    
    // If moving between internal steps (not leaving the site)
    if (targetStep >= 1 && targetStep <= totalSteps && targetStep !== currentStep) {
      console.log('📱 Internal step navigation to step', targetStep);
      
      // Track internal step change
      trackEvent('journey_step_changed', {
        journey_id: journeyId,
        from_step: currentStep,
        to_step: targetStep,
        direction: targetStep < currentStep ? 'back' : 'forward'
      });
      
      // If target step differs from current step, restore state for that step
      if (restoreStateFromStep) {
        console.log('📱 Restoring state for step', targetStep);
        restoreStateFromStep(targetStep);
      }
      
      // Update current step to match target
      onStepChange(targetStep);
      return;
    }
    
    // If we're on step 1 and trying to go back, allow it (user wants to leave)
    if (targetStep <= 1 && currentStep <= 1) {
      console.log('📱 On step 1, allowing natural back navigation');
      
      // Check if there's a referrer parameter to navigate back to
      if (referrer) {
        console.log('📱 Found referrer, navigating back to:', referrer);
        window.location.href = referrer;
        return;
      }
      
      return;
    }
    
  }, [currentStep, onStepChange, restoreStateFromStep, totalSteps, isGuarded, onShowConfirmDialog, hasShownConfirmOnThisStep, journeyId]);

  // Method to allow leaving (called when user confirms)
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
    navigate('/?step=1', { replace: true });
    onStepChange(1);
    
    // Reset the leaving flag after navigation
    setTimeout(() => {
      isLeavingRef.current = false;
    }, 100);
  }, [currentStep, journeyId, navigate, onStepChange]);

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

  useEffect(() => {
    console.log('📱 Setting up mobile navigation listeners');
    
    // Set scroll restoration to manual for better control
    if ('scrollRestoration' in window.history) {
      window.history.scrollRestoration = 'manual';
    }
    
    // On first initialization, set up a proper history stack
    if (!initializedRef.current) {
      initializedRef.current = true;
      
      const urlParams = new URLSearchParams(window.location.search);
      const urlStep = parseInt(urlParams.get('step') || '1');
      
      // First, push a "base" entry that will catch attempts to leave
      // This ensures the back button first hits our base marker before exiting
      if (urlStep > 1) {
        // Push a base marker so back button hits this before leaving the site
        window.history.replaceState({ journey_base: journeyId, step: 0 }, '', window.location.href);
        
        // Then push the current step state
        const stepUrl = `${window.location.pathname}?step=${urlStep}`;
        window.history.pushState({ step: urlStep }, '', stepUrl);
        console.log('📱 Initialized history stack with base marker and step', urlStep);
      } else {
        // For step 1, just set proper state
        window.history.replaceState({ step: urlStep }, '', window.location.href);
        console.log('📱 Initialized history with step', urlStep);
      }
    }
    
    // Listen for popstate events (back/forward button presses)
    window.addEventListener('popstate', handleBackNavigation);
    
    // iOS Safari specific: handle bfcache
    const handlePageShow = (event: PageTransitionEvent) => {
      if (event.persisted) {
        console.log('📱 Page restored from bfcache');
        // Reset state when page comes back from bfcache
        isLeavingRef.current = false;
        setHasShownConfirmOnThisStep(false);
        
        // Re-establish proper history state
        const urlParams = new URLSearchParams(window.location.search);
        const urlStep = parseInt(urlParams.get('step') || '1');
        if (urlStep > 1 && (!window.history.state || !window.history.state.step)) {
          window.history.replaceState({ step: urlStep }, '', window.location.href);
        }
      }
    };
    
    const handlePageHide = (event: PageTransitionEvent) => {
      if (event.persisted) {
        console.log('📱 Page going into bfcache');
      }
    };
    
    window.addEventListener('pageshow', handlePageShow);
    window.addEventListener('pagehide', handlePageHide);
    
    return () => {
      console.log('📱 Cleaning up mobile navigation listeners');
      window.removeEventListener('popstate', handleBackNavigation);
      window.removeEventListener('pageshow', handlePageShow);
      window.removeEventListener('pagehide', handlePageHide);
    };
  }, [handleBackNavigation, journeyId]);

  // When step changes, push new history entry
  useEffect(() => {
    const urlParams = new URLSearchParams(window.location.search);
    const urlStep = parseInt(urlParams.get('step') || '1');
    
    // Only push if step changed and doesn't match URL
    if (currentStep !== urlStep && initializedRef.current) {
      const stepUrl = `${window.location.pathname}?step=${currentStep}`;
      window.history.pushState({ step: currentStep }, '', stepUrl);
      console.log('📱 Pushed history for step change to', currentStep);
    }
  }, [currentStep]);

  return {
    allowLeave,
    stay
  };
};
