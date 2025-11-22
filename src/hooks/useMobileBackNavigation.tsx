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
      isLeaving: isLeavingRef.current 
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
    
    // Get the step from URL to determine if we're going back or forward
    const urlParams = new URLSearchParams(window.location.search);
    const urlStep = parseInt(urlParams.get('step') || '1');
    const referrer = urlParams.get('referrer');
    
    console.log('📱 URL step:', urlStep, 'Current step:', currentStep, 'Referrer:', referrer);
    
    // If on step 2 and going back, check for referrer
    if (currentStep === 2 && urlStep < 2 && referrer) {
      console.log('📱 Going back from step 2 with referrer, navigating to:', referrer);
      window.location.href = referrer;
      return;
    }
    
    // If moving between internal steps (not leaving the site)
    if (urlStep >= 1 && urlStep <= totalSteps && urlStep !== currentStep) {
      console.log('📱 Internal step navigation to step', urlStep);
      
      // Track internal step change
      trackEvent('journey_step_changed', {
        journey_id: journeyId,
        from_step: currentStep,
        to_step: urlStep,
        direction: urlStep < currentStep ? 'back' : 'forward'
      });
      
      // If URL step differs from current step, restore state for that step
      if (restoreStateFromStep) {
        console.log('📱 Restoring state for step', urlStep);
        restoreStateFromStep(urlStep);
      }
      
      // Update current step to match URL
      onStepChange(urlStep);
      return;
    }
    
    // If trying to go before step 1 (leaving the site) and journey is guarded
    if (urlStep < 1 && isGuarded && currentStep > 1) {
      // Only show confirmation once per step
      if (!hasShownConfirmOnThisStep && onShowConfirmDialog) {
        console.log('📱 First back from guarded step, showing confirmation');
        
        // Prevent the navigation by pushing current state back
        const currentUrl = window.location.pathname + window.location.search;
        window.history.pushState({ step: currentStep }, '', currentUrl);
        
        // Track that we're showing the intercept
        trackEvent('back_intercept_shown', {
          journey_id: journeyId,
          step: currentStep,
          step_name: `step_${currentStep}`
        });
        
        // Show the confirmation dialog
        setHasShownConfirmOnThisStep(true);
        onShowConfirmDialog();
        return;
      }
    }
    
    // If we're on step 1 and trying to go back, allow it (user wants to leave)
    if (urlStep <= 1 && currentStep <= 1) {
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
    
    // Perform actual back navigation
    window.history.back();
  }, [currentStep, journeyId]);

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
    const currentUrl = window.location.pathname + window.location.search;
    window.history.pushState({ step: currentStep }, '', currentUrl);
  }, [currentStep, journeyId]);

  useEffect(() => {
    console.log('📱 Setting up mobile navigation listeners');
    
    // Set scroll restoration to manual for better control
    if ('scrollRestoration' in window.history) {
      window.history.scrollRestoration = 'manual';
    }
    
    // Push initial state if not already present - use pushState to preserve previous page history
    const urlParams = new URLSearchParams(window.location.search);
    const urlStep = parseInt(urlParams.get('step') || '1');
    
    // If there's no history state yet, or it doesn't match the current URL step,
    // we need to establish a proper history entry for this step
    if (!window.history.state || window.history.state.step !== urlStep) {
      // Use pushState (not replaceState) to create a new history entry
      // This ensures the previous page (like Google search) remains in history
      // and users can navigate back through steps without leaving the site
      window.history.pushState({ step: urlStep }, '', window.location.href);
      console.log('📱 Pushed initial history state for step', urlStep);
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
  }, [handleBackNavigation]);

  return {
    allowLeave,
    stay
  };
};