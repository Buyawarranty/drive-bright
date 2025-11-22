import { useState, useCallback } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { useToast } from '@/hooks/use-toast';

interface ClickValidationResponse {
  valid: boolean;
  blocked: boolean;
  risk_score: number;
  bot_detected?: boolean;
  bot_reasons?: string[];
  recent_clicks?: number;
  session_id?: string;
  message?: string;
  error?: string;
}

export function useClickFraudProtection() {
  const [isValidating, setIsValidating] = useState(false);
  const { toast } = useToast();

  const validateClick = useCallback(async (
    actionType: string,
    sessionId?: string
  ): Promise<boolean> => {
    setIsValidating(true);
    
    try {
      console.log('Starting click validation for:', actionType);
      
      // Add timeout to prevent hanging
      const timeoutPromise = new Promise<never>((_, reject) => {
        setTimeout(() => reject(new Error('Validation timeout')), 10000); // 10 second timeout
      });
      
      const validationPromise = supabase.functions.invoke('validate-click', {
        body: {
          action_type: actionType,
          session_id: sessionId || crypto.randomUUID(),
          user_agent: navigator.userAgent,
          referrer: document.referrer,
          timestamp: Date.now()
        }
      });

      const { data, error } = await Promise.race([validationPromise, timeoutPromise]);

      if (error) {
        console.error('Click validation error:', error);
        // Allow request if validation fails to prevent blocking legitimate users
        return true;
      }

      const response: ClickValidationResponse = data;
      console.log('Validation response:', response);
      
      if (response.blocked) {
        console.log('Click blocked by fraud protection:', response);
        
        // Show user-friendly message for blocked requests
        if (response.bot_detected) {
          toast({
            variant: "destructive",
            title: "Request Blocked",
            description: "Automated requests are not allowed. Please try again manually.",
          });
        } else if (response.recent_clicks && response.recent_clicks > 10) {
          toast({
            variant: "destructive", 
            title: "Too Many Requests",
            description: "Please wait a moment before trying again.",
          });
        } else {
          toast({
            variant: "destructive",
            title: "Request Blocked", 
            description: "Your request appears suspicious. Please contact support if this continues.",
          });
        }
        
        return false;
      }

      // Log high risk scores for monitoring
      if (response.risk_score > 50) {
        console.warn('High risk click detected:', {
          actionType,
          riskScore: response.risk_score,
          recentClicks: response.recent_clicks
        });
      }

      console.log('Click validation successful');
      return response.valid;

    } catch (error) {
      console.error('Click validation failed:', error);
      // Allow request if validation system is down - don't block legitimate users
      toast({
        variant: "default",
        title: "Proceeding with request",
        description: "Security validation temporarily unavailable.",
      });
      return true;
    } finally {
      setIsValidating(false);
    }
  }, [toast]);

  const protectedAction = useCallback(async (
    actionType: string,
    callback: () => Promise<void> | void,
    sessionId?: string
  ): Promise<void> => {
    const isValid = await validateClick(actionType, sessionId);
    
    if (isValid) {
      try {
        await callback();
      } catch (error) {
        console.error('Protected action failed:', error);
        throw error;
      }
    }
  }, [validateClick]);

  return {
    validateClick,
    protectedAction,
    isValidating
  };
}