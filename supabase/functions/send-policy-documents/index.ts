import { serve } from "https://deno.land/std@0.190.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.45.0";
import { encode as base64Encode } from "https://deno.land/std@0.190.0/encoding/base64.ts";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

const logStep = (step: string, details?: any) => {
  const detailsStr = details ? ` - ${JSON.stringify(details)}` : '';
  console.log(`[SEND-POLICY-DOCUMENTS] ${step}${detailsStr}`);
};

// Generate random temporary password
const generateTempPassword = () => {
  const chars = 'ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789';
  let result = '';
  for (let i = 0; i < 8; i++) {
    result += chars.charAt(Math.floor(Math.random() * chars.length));
  }
  return result;
};

serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  const supabaseClient = createClient(
    Deno.env.get("SUPABASE_URL") ?? "",
    Deno.env.get("SUPABASE_SERVICE_ROLE_KEY") ?? "",
    { 
      auth: { 
        persistSession: false,
        autoRefreshToken: false 
      }
    }
  );

  try {
    logStep("Function started");
    
    const { recipientEmail, variables, forceResend } = await req.json();
    const { 
      planType, 
      customerName, 
      paymentType, 
      policyNumber, 
      registrationPlate,
      stripeSessionId,
      bumperOrderId,
      paymentSource 
    } = variables || {};
    logStep("Request data", { recipientEmail, planType, customerName, paymentType, policyNumber, paymentSource });

    if (!recipientEmail || !planType) {
      throw new Error("Missing required parameters");
    }

    // Get the policy documents email template
    const { data: template, error: templateError } = await supabaseClient
      .from('email_templates')
      .select('*')
      .eq('template_type', 'policy_documents')
      .eq('is_active', true)
      .single();

    if (templateError || !template) {
      throw new Error("Policy Documents Email template not found");
    }

    logStep("Found policy documents template", { templateId: template.id });

    // Check if we should skip sending duplicate emails (unless forced)
    if (!forceResend && policyNumber) {
      // Check if an email was already sent for this SPECIFIC policy recently
      // This prevents duplicate emails for the same purchase but allows multiple purchases
      const { data: recentEmail } = await supabaseClient
        .from('email_logs')
        .select('id, created_at, metadata')
        .eq('recipient_email', recipientEmail)
        .eq('template_id', template.id)
        .eq('status', 'sent')
        .gte('created_at', new Date(Date.now() - 24 * 60 * 60 * 1000).toISOString()) // Last 24 hours
        .order('created_at', { ascending: false });

      // Check if any recent email was for the same policy number
      const duplicateForSamePolicy = recentEmail?.find(email => 
        email.metadata?.policy_number === policyNumber
      );

      if (duplicateForSamePolicy) {
        logStep("Email already sent recently for this policy, skipping duplicate", { 
          lastSentAt: duplicateForSamePolicy.created_at,
          emailLogId: duplicateForSamePolicy.id,
          policyNumber 
        });
        
        return new Response(JSON.stringify({ 
          success: true, 
          message: "Email already sent recently for this policy, duplicate prevented",
          skipped: true,
          lastSentAt: duplicateForSamePolicy.created_at,
          policyNumber
        }), {
          headers: { ...corsHeaders, "Content-Type": "application/json" },
          status: 200,
        });
      }
    }

    // Determine vehicle type based on plan type for correct document mapping
    const isSpecialVehicle = ['motorcycle', 'van', 'motorhome', 'caravan', 'motorbike'].some(type => 
      planType.toLowerCase().includes(type)
    );
    const vehicleType = isSpecialVehicle ? 'special_vehicle' : 'standard';
    
    // Fetch plan-specific document using correct vehicle type
    const attachments = [];
    
    logStep("Determining vehicle type and document mapping", { 
      planType, 
      vehicleType, 
      isSpecialVehicle 
    });

    // Try plan_document_mapping first with correct vehicle type
    const { data: documentMapping } = await supabaseClient
      .from('plan_document_mapping')
      .select('document_path')
      .eq('plan_name', planType)
      .eq('vehicle_type', vehicleType)
      .maybeSingle();

    logStep("Plan document mapping result", { documentMapping, planType, vehicleType });

    if (documentMapping?.document_path) {
      try {
        logStep("Attempting to fetch document from mapping", { path: documentMapping.document_path });
        
        const { data: fileData, error: downloadError } = await supabaseClient.storage
          .from('policy-documents')
          .download(documentMapping.document_path);

        if (!downloadError && fileData) {
          const fileBuffer = await fileData.arrayBuffer();
          const bytes = new Uint8Array(fileBuffer);
          const base64Content = base64Encode(bytes);
          
          attachments.push({
            filename: `${planType}-Warranty-Policy.pdf`,
            content: base64Content,
            type: 'application/pdf'
          });
          logStep("Document from mapping attached successfully", { 
            filename: `${planType}-Warranty-Policy.pdf`, 
            size: fileBuffer.byteLength 
          });
        } else {
          logStep("Failed to download document from mapping", { 
            path: documentMapping.document_path, 
            error: downloadError?.message 
          });
        }
      } catch (error) {
        const errorMessage = error instanceof Error ? error.message : String(error);
        logStep("Error downloading document from mapping", { 
          error: errorMessage, 
          path: documentMapping.document_path 
        });
      }
    }

    // Fallback to customer_documents table if no document found from mapping

    if (attachments.length === 0) {
      // Updated plan type mapping - all standard car warranties now use premium
      const planTypeMapping: Record<string, string> = {
        'basic': 'premium',
        'basic car plan': 'premium',
        'gold': 'premium', 
        'gold car plan': 'premium',
        'platinum': 'premium',
        'platinum car plan': 'premium',
        'premium': 'premium',
        'premium car plan': 'premium',
        'electric': 'electric',
        'ev': 'electric',  // Map EV to electric
        'phev': 'phev',
        'hybrid': 'phev',  // Map hybrid to phev
        'motorbike': 'motorbike',
        'motorcycle': 'motorbike',  // Map motorcycle to motorbike
        'motorbike extended warranty': 'motorbike'
      };

      const mappedPlanType = planTypeMapping[planType.toLowerCase()] || planType.toLowerCase().replace(/\s+(car|vehicle)\s+plan$/i, '');
      logStep("Falling back to customer_documents table", { planType, mappedPlanType });
      
      const { data: planDoc, error: planError } = await supabaseClient
        .from('customer_documents')
        .select('document_name, file_url')
        .eq('plan_type', mappedPlanType)
        .order('created_at', { ascending: false })
        .limit(1)
        .maybeSingle();

        if (planDoc && !planError) {
        try {
          logStep("Attempting to fetch plan document from customer_documents", { url: planDoc.file_url });
          const response = await fetch(planDoc.file_url);
          logStep("Fetch response status", { status: response.status, ok: response.ok });
          
          if (response.ok) {
            const fileBuffer = await response.arrayBuffer();
            const bytes = new Uint8Array(fileBuffer);
            const base64Content = base64Encode(bytes);
            
            attachments.push({
              filename: planDoc.document_name.endsWith('.pdf') ? planDoc.document_name : `${planDoc.document_name}.pdf`,
              content: base64Content,
              type: 'application/pdf'
            });
            logStep("Plan document prepared for attachment", { filename: planDoc.document_name, size: fileBuffer.byteLength });
          } else {
            logStep("Failed to fetch plan document", { status: response.status, statusText: response.statusText });
          }
        } catch (error) {
          const errorMessage = error instanceof Error ? error.message : String(error);
          logStep("Error preparing plan document", { error: errorMessage });
        }
      } else {
        logStep("No plan-specific document found in customer_documents", { planType: mappedPlanType, error: planError });
      }
    }

    // Fetch terms and conditions document
    const { data: termsDoc, error: termsError } = await supabaseClient
      .from('customer_documents')
      .select('document_name, file_url')
      .eq('plan_type', 'terms-and-conditions')
      .order('created_at', { ascending: false })
      .limit(1)
      .maybeSingle();

    if (termsDoc && !termsError) {
      try {
        logStep("Attempting to fetch terms document", { url: termsDoc.file_url });
        const response = await fetch(termsDoc.file_url);
        logStep("Fetch response status for terms", { status: response.status, ok: response.ok });
        
        if (response.ok) {
          const fileBuffer = await response.arrayBuffer();
          const bytes = new Uint8Array(fileBuffer);
          const base64Content = base64Encode(bytes);
          
          attachments.push({
            filename: termsDoc.document_name.endsWith('.pdf') ? termsDoc.document_name : `${termsDoc.document_name}.pdf`,
            content: base64Content,
            type: 'application/pdf'
          });
          logStep("Terms document prepared for attachment", { filename: termsDoc.document_name, size: fileBuffer.byteLength });
        } else {
          logStep("Failed to fetch terms document", { status: response.status, statusText: response.statusText });
        }
      } catch (error) {
        const errorMessage = error instanceof Error ? error.message : String(error);
        logStep("Error preparing terms document", { error: errorMessage });
      }
    }

    // Use centralized warranty duration utilities for consistency
    const getWarrantyDurationInMonths = (paymentType: string): number => {
      const normalizedPaymentType = paymentType?.toLowerCase().replace(/[_-]/g, '').trim();
      
      // Handle different formats that might come from different sources
      switch (normalizedPaymentType) {
        case 'monthly':
        case '1month':
        case 'month':
        case '12months':
        case '12month':
        case 'yearly':
        case '12 months':
        case '1year':
        case 'year':
          return 12;
        case '24months':
        case '24month':
        case 'twomonthly':
        case '2monthly':
        case 'twoyearly':
        case '24 months':
        case '2year':
        case 'twoyear':
          return 24;
        case '36months':
        case '36month':
        case 'threemonthly':
        case '3monthly':
        case 'threeyearly':
        case '36 months':
        case '3year':
        case 'threeyear':
          return 36;
        case '48months':
        case '48month':
        case 'fourmonthly':
        case '4monthly':
          return 48;
        case '60months':
        case '60month':
        case 'fivemonthly':
        case '5monthly':
          return 60;
        default:
          console.warn(`[SEND-POLICY-DOCUMENTS] Unknown payment type: ${paymentType}, defaulting to 12 months`);
          return 12;
      }
    };
    const calculateExpiryDate = (startDate: Date, paymentType: string): Date => {
      const expiry = new Date(startDate);
      const months = getWarrantyDurationInMonths(paymentType);
      expiry.setMonth(expiry.getMonth() + months);
      return expiry;
    };

    // Determine payment method based on payment source
    const getPaymentMethodDisplay = (): string => {
      if (paymentSource) {
        return paymentSource === 'stripe' ? 'Stripe' : paymentSource === 'bumper' ? 'Bumper' : 'Online Payment';
      }
      // Fallback logic based on session IDs
      if (stripeSessionId) {
        return 'Stripe';
      } else if (bumperOrderId) {
        return 'Bumper';
      }
      return 'Online Payment';
    };

    const startDate = new Date();
    const expiryDate = calculateExpiryDate(startDate, paymentType || 'yearly');
    const periodInMonths = getWarrantyDurationInMonths(paymentType || 'yearly');

    // Normalize plan type for consistent display
    const getDisplayPlanType = (planType: string): string => {
      const planLower = planType.toLowerCase();
      
      // Map various plan type formats to standardized display names
      if (planLower.includes('basic') || planLower.includes('blue') || 
          planLower.includes('gold') || planLower.includes('platinum') || 
          planLower.includes('premium')) {
        return 'Premium';
      } else if (planLower.includes('phev') || planLower.includes('hybrid')) {
        return 'PHEV';
      } else if (planLower.includes('ev') || planLower.includes('electric')) {
        return 'EV';
      } else if (planLower.includes('motorbike') || planLower.includes('motorcycle')) {
        return 'Motorbike';
      }
      
      // Return capitalized version of original if no match
      return planType.charAt(0).toUpperCase() + planType.slice(1).toLowerCase();
    };

    // Send policy documents email using the template
    const emailVariables = {
      customerName: customerName || recipientEmail.split('@')[0],
      planType: getDisplayPlanType(planType),
      policyNumber: policyNumber,
      registrationPlate: registrationPlate || 'N/A',
      paymentMethod: getPaymentMethodDisplay(), // Correct payment method name (new field)
      paymentType: getPaymentMethodDisplay(), // Keep for backward compatibility with existing template
      periodInMonths: periodInMonths,
      coveragePeriod: `${periodInMonths} month${periodInMonths === 1 ? '' : 's'}`, // Correct coverage period
      policyStartDate: startDate.toLocaleDateString('en-GB', { 
        day: '2-digit', 
        month: '2-digit', 
        year: 'numeric' 
      }),
      policyEndDate: expiryDate.toLocaleDateString('en-GB', { // Policy End Date field (new field)
        day: '2-digit', 
        month: '2-digit', 
        year: 'numeric' 
      }),
      policyExpiryDate: expiryDate.toLocaleDateString('en-GB', { // Keep for backward compatibility
        day: '2-digit', 
        month: '2-digit', 
        year: 'numeric' 
      }),
      // Handle customer login credentials
      loginUrl: "https://buyawarranty.co.uk/customer-dashboard",
      loginEmail: recipientEmail,
      ...(await getCustomerCredentials(supabaseClient, recipientEmail, policyNumber))
    };

    const emailPayload: any = {
      templateId: template.template_type,
      recipientEmail: recipientEmail,
      variables: emailVariables
    };

    // Add attachments if any were successfully fetched
    if (attachments.length > 0) {
      emailPayload.attachments = attachments;
      logStep("Attachments added to email", { count: attachments.length });
    }

    const { data: emailResult, error: emailError } = await supabaseClient.functions.invoke('send-email', {
      body: emailPayload
    });

    if (emailError) {
      throw new Error(`Failed to send policy documents email: ${emailError.message}`);
    }

    logStep("Policy documents email sent successfully", emailResult);

    // Log the email send
    await supabaseClient
      .from('email_logs')
      .insert({
        template_id: template.id,
        recipient_email: recipientEmail,
        subject: template.subject,
        status: 'sent',
        metadata: {
          plan_type: planType,
          policy_number: policyNumber,
          registration_plate: registrationPlate,
          attachments_count: attachments.length
        }
      });

    return new Response(JSON.stringify({ 
      success: true, 
      message: "Policy documents email sent successfully",
      attachments_sent: attachments.length
    }), {
      headers: { ...corsHeaders, "Content-Type": "application/json" },
      status: 200,
    });
  } catch (error) {
    const errorMessage = error instanceof Error ? error.message : String(error);
    logStep("ERROR in send-policy-documents", { message: errorMessage });
    return new Response(JSON.stringify({ error: errorMessage }), {
      headers: { ...corsHeaders, "Content-Type": "application/json" },
      status: 500,
    });
  }
});

// Get customer credentials - password only if user hasn't reset it
async function getCustomerCredentials(supabaseClient: any, email: string, policyNumber: string): Promise<{temporaryPassword?: string, isExistingCustomer?: boolean}> {
  try {
    logStep("Getting customer credentials", { email });
    
    // Check if customer has reset their password
    const { data: existingWelcome } = await supabaseClient
      .from('welcome_emails')
      .select('temporary_password, password_reset_by_user, user_id')
      .eq('email', email)
      .order('created_at', { ascending: false })
      .limit(1)
      .maybeSingle();
    
    // If user has reset their password, show existing customer message
    if (existingWelcome?.password_reset_by_user) {
      logStep("User has reset password, showing existing customer message");
      return { 
        temporaryPassword: "Use your existing password that you set previously",
        isExistingCustomer: true
      };
    }
    
    // If existing password exists and user hasn't reset it, use it
    if (existingWelcome?.temporary_password && !existingWelcome.password_reset_by_user) {
      logStep("Using existing temporary password for returning customer");
      return { 
        temporaryPassword: existingWelcome.temporary_password,
        isExistingCustomer: true
      };
    }
    
    // Generate new temporary password for first-time customer
    const tempPassword = generateTempPassword();
    logStep("Generated new temporary password for first-time customer");
    
    // Check if user exists in auth
    const { data: existingUsers } = await supabaseClient.auth.admin.listUsers();
    const userExists = existingUsers?.users?.find((u: any) => u.email === email);
    
    let userId = null;
    
    if (userExists) {
      // Update existing user's password
      await supabaseClient.auth.admin.updateUserById(userExists.id, {
        password: tempPassword,
        user_metadata: {
          ...userExists.user_metadata,
          policy_number: policyNumber
        }
      });
      userId = userExists.id;
      logStep("Updated existing user password");
    } else {
      // Create new user
      const { data: userData, error: userError } = await supabaseClient.auth.admin.createUser({
        email: email,
        password: tempPassword,
        email_confirm: true,
        user_metadata: {
          policy_number: policyNumber
        }
      });
      
      if (userError) {
        logStep("User creation failed", userError);
        throw new Error(`Failed to create user: ${userError.message}`);
      }
      userId = userData.user?.id;
      logStep("Created new user with password");
    }
    
    // Add delay to ensure password is propagated
    await new Promise(resolve => setTimeout(resolve, 1500));
    
    // Store password in welcome_emails table for reference
    await supabaseClient
      .from('welcome_emails')
      .insert({
        user_id: userId,
        email: email,
        temporary_password: tempPassword,
        email_sent_at: new Date().toISOString(),
        password_reset_by_user: false // New customers haven't reset yet
      });
    
    logStep("Stored credentials in welcome_emails table");
    
    return { 
      temporaryPassword: tempPassword,
      isExistingCustomer: false
    };
    
  } catch (error) {
    logStep("Error getting customer credentials", error);
    // Generate a temporary password even on error to ensure customer can login
    const emergencyPassword = generateTempPassword();
    logStep("Using emergency password due to error");
    return { 
      temporaryPassword: emergencyPassword,
      isExistingCustomer: false
    };
  }
}