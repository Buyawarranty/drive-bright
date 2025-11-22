import { serve } from "https://deno.land/std@0.190.0/http/server.ts";
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2.50.2';

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

interface PaymentWebhookData {
  sessionId?: string;
  customerEmail: string;
  customerName: string;
  planType: string;
  paymentType: string;
  amount: number;
  currency?: string;
  customerId?: string;
  vehicleDetails?: any;
  paymentProvider: 'stripe' | 'bumper';
  bumperOrderId?: string;
  seasonalBonusMonths?: number;
}

const supabase = createClient(
  Deno.env.get('SUPABASE_URL') ?? '',
  Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') ?? ''
);

const handler = async (req: Request): Promise<Response> => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    console.log('=== Warranty Purchase Processing Started ===');
    const webhookData: PaymentWebhookData = await req.json();
    console.log('Webhook data received:', JSON.stringify(webhookData, null, 2));

    const {
      customerEmail,
      customerName,
      planType,
      paymentType,
      amount,
      currency = 'GBP',
      customerId,
      sessionId,
      bumperOrderId,
      paymentProvider,
      vehicleDetails,
      seasonalBonusMonths
    } = webhookData;

    // Step 1: Determine vehicle type and document path
    console.log('Step 1: Determining document mapping for plan:', planType);
    
    // Check if this is a special vehicle plan
    const isSpecialVehicle = ['motorcycle', 'van', 'motorhome', 'caravan'].some(type => 
      planType.toLowerCase().includes(type)
    );
    
    const vehicleType = isSpecialVehicle ? 'special_vehicle' : 'standard';
    
    // Get the document path from mapping
    const { data: docMapping, error: docError } = await supabase
      .from('plan_document_mapping')
      .select('document_path')
      .eq('plan_name', planType)
      .eq('vehicle_type', vehicleType)
      .single();

    if (docError || !docMapping) {
      console.error('No document mapping found for plan:', planType, 'vehicle type:', vehicleType);
      throw new Error(`No document mapping found for plan: ${planType} (${vehicleType})`);
    }

    const documentPath = docMapping.document_path;
    console.log('Document path determined:', documentPath);

    // Step 2: Create customer record if not exists
    console.log('Step 2: Creating/updating customer record');
    
    const customerRecord = {
      email: customerEmail,
      name: customerName,
      plan_type: planType,
      status: 'Active',
      stripe_customer_id: paymentProvider === 'stripe' ? customerId : null,
      stripe_session_id: paymentProvider === 'stripe' ? sessionId : null,
      bumper_order_id: paymentProvider === 'bumper' ? bumperOrderId : null,
      payment_type: paymentType,
      final_amount: amount,
      signup_date: new Date().toISOString(),
      country: 'United Kingdom',
      voluntary_excess: vehicleDetails?.voluntaryExcess ?? vehicleDetails?.voluntary_excess ?? 0,
      seasonal_bonus_months: seasonalBonusMonths || vehicleDetails?.seasonalBonusMonths || 0,
      ...(vehicleDetails || {})
    };

    const { data: customer, error: customerError } = await supabase
      .from('customers')
      .upsert(customerRecord, { onConflict: 'email' })
      .select()
      .single();

    if (customerError) {
      console.error('Error creating customer:', customerError);
      throw customerError;
    }

    console.log('Customer record created/updated:', customer.id);

    // Step 3: Create policy record
    console.log('Step 3: Creating policy record');
    
    const policyStartDate = new Date();
    const policyEndDate = new Date();
    
    // Calculate policy end date based on payment type
    switch (paymentType.toLowerCase()) {
      case 'monthly':
        policyEndDate.setMonth(policyEndDate.getMonth() + 1);
        break;
      case 'yearly':
        policyEndDate.setFullYear(policyEndDate.getFullYear() + 1);
        break;
      case 'twoyear':
      case 'two_year':
        policyEndDate.setFullYear(policyEndDate.getFullYear() + 2);
        break;
      case 'threeyear':
      case 'three_year':
        policyEndDate.setFullYear(policyEndDate.getFullYear() + 3);
        break;
      default:
        policyEndDate.setMonth(policyEndDate.getMonth() + 1);
    }

    const policyRecord = {
      customer_id: customer.id,
      email: customerEmail,
      plan_type: planType.toLowerCase(),
      payment_type: paymentType,
      policy_start_date: policyStartDate.toISOString(),
      policy_end_date: policyEndDate.toISOString(),
      status: 'active',
      stripe_session_id: paymentProvider === 'stripe' ? sessionId : null,
      bumper_order_id: paymentProvider === 'bumper' ? bumperOrderId : null,
      payment_amount: amount,
      payment_currency: currency,
      customer_full_name: customerName,
      document_type: vehicleType,
      pdf_document_path: documentPath,
      email_sent_status: 'pending',
      seasonal_bonus_months: seasonalBonusMonths || vehicleDetails?.seasonalBonusMonths || 0
    };

    const { data: policy, error: policyError } = await supabase
      .from('customer_policies')
      .insert(policyRecord)
      .select()
      .single();

    if (policyError) {
      console.error('Error creating policy:', policyError);
      throw policyError;
    }

    console.log('Policy created with warranty number:', policy.warranty_number);

    // Step 4: Log the payment event
    await supabase.rpc('log_warranty_event', {
      p_policy_id: policy.id,
      p_customer_id: customer.id,
      p_event_type: 'payment_received',
      p_event_data: {
        payment_provider: paymentProvider,
        session_id: sessionId,
        bumper_order_id: bumperOrderId,
        amount: amount,
        currency: currency,
        plan_type: planType,
        payment_type: paymentType
      },
      p_created_by: 'webhook'
    });

    // Step 5: Trigger welcome email
    console.log('Step 5: Triggering welcome email');
    
    try {
      // Get the welcome email template
      const { data: template, error: templateError } = await supabase
        .from('email_templates')
        .select('*')
        .eq('template_type', 'welcome')
        .eq('is_active', true)
        .single();

      if (!templateError && template) {
        // Prepare email variables
        const emailVariables = {
          customer_name: customerName,
          warranty_number: policy.warranty_number,
          policy_start_date: new Date(policy.policy_start_date).toLocaleDateString('en-GB'),
          policy_end_date: new Date(policy.policy_end_date).toLocaleDateString('en-GB'),
          secure_download_link: `https://buyawarranty.co.uk/download-policy/${policy.id}`
        };

        // Prepare PDF attachment (simplified - you'll need to implement actual PDF retrieval)
        const attachments = [{
          filename: `warranty-policy-${policy.warranty_number}.pdf`,
          content: documentPath, // This should be the actual PDF content
          type: 'application/pdf'
        }];

        // Send welcome email via send-email function
        const emailResponse = await supabase.functions.invoke('send-email', {
          body: {
            templateId: template.id,
            recipientEmail: customerEmail,
            customerId: customer.id,
            variables: emailVariables,
            attachments: attachments
          }
        });

        if (emailResponse.error) {
          console.error('Error sending welcome email:', emailResponse.error);
          // Update policy status to indicate email failed
          await supabase
            .from('customer_policies')
            .update({ 
              email_sent_status: 'failed',
              email_sent_at: new Date().toISOString()
            })
            .eq('id', policy.id);

          // Log the email failure
          await supabase.rpc('log_warranty_event', {
            p_policy_id: policy.id,
            p_customer_id: customer.id,
            p_event_type: 'email_failed',
            p_event_data: { error: emailResponse.error },
            p_created_by: 'system'
          });
        } else {
          console.log('Welcome email sent successfully');
          // Update policy status to indicate email sent
          await supabase
            .from('customer_policies')
            .update({ 
              email_sent_status: 'sent',
              email_sent_at: new Date().toISOString()
            })
            .eq('id', policy.id);

          // Log the email success
          await supabase.rpc('log_warranty_event', {
            p_policy_id: policy.id,
            p_customer_id: customer.id,
            p_event_type: 'email_sent',
            p_event_data: { 
              template_id: template.id,
              email_id: emailResponse.data?.emailId 
            },
            p_created_by: 'system'
          });
        }
      }
    } catch (emailError) {
      console.error('Error in email process:', emailError);
      // Don't fail the whole process if email fails
    }

    console.log('=== Warranty Purchase Processing Complete ===');
    
    return new Response(JSON.stringify({ 
      success: true, 
      policyId: policy.id,
      warrantyNumber: policy.warranty_number,
      customerId: customer.id
    }), {
      status: 200,
      headers: { "Content-Type": "application/json", ...corsHeaders },
    });

  } catch (error: any) {
    console.error("Error in warranty purchase processing:", error);
    return new Response(
      JSON.stringify({ error: error.message }),
      { status: 500, headers: { "Content-Type": "application/json", ...corsHeaders } }
    );
  }
};

serve(handler);