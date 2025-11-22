import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.50.2";
import { Resend } from "npm:resend@2.0.0";

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const resend = new Resend(Deno.env.get('RESEND_API_KEY'));
    const supabaseUrl = Deno.env.get('SUPABASE_URL')!;
    const supabaseServiceKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!;
    const supabase = createClient(supabaseUrl, supabaseServiceKey);

    const { customerIds, templateId, customSubject, customContent, customEmails } = await req.json();

    console.log('Bulk email request:', { customerIds: customerIds?.length, templateId, hasCustomContent: !!customContent, customEmails: customEmails?.length });

    if (!customerIds || !Array.isArray(customerIds) || customerIds.length === 0) {
      throw new Error('Customer IDs are required');
    }

    if (!templateId) {
      throw new Error('Template ID is required');
    }

    // Use custom content if provided, otherwise fetch template
    let emailSubject = customSubject;
    let emailContent = customContent;
    let fromEmail = 'support@buyawarranty.co.uk';

    if (!emailSubject || !emailContent) {
      // Get template
      const { data: template, error: templateError } = await supabase
        .from('email_templates')
        .select('*')
        .eq('id', templateId)
        .single();

      if (templateError || !template) {
        throw new Error('Template not found');
      }

      emailSubject = emailSubject || template.subject;
      fromEmail = template.from_email || fromEmail;
      
      // Extract content from JSONB if not provided
      if (!emailContent) {
        if (template.content?.blocks) {
          emailContent = template.content.blocks
            .map((block: any) => block.data?.text || '')
            .join('\n\n');
        } else if (template.content?.html) {
          emailContent = template.content.html;
        }
      }
    }

    // Get customers
    const { data: customers, error: customersError } = await supabase
      .from('customers')
      .select('id, name, email')
      .in('id', customerIds);

    if (customersError) {
      throw customersError;
    }

    console.log(`Sending to ${customers.length} customers`);

    // Prepare list of all recipients (customers + custom emails)
    const allRecipients = [
      ...customers.map(c => ({ email: c.email, name: c.name || 'Customer', isCustomer: true, customerId: c.id })),
      ...(customEmails || []).map((email: string) => ({ email, name: 'Recipient', isCustomer: false }))
    ];

    const results = {
      success: 0,
      failed: 0,
      errors: [] as any[]
    };

    // Send emails
    for (const recipient of allRecipients) {
      try {
        // Replace template variables with recipient data
        const recipientName = recipient.name || 'Recipient';
        const personalizedSubject = emailSubject.replace(/\{name\}/g, recipientName);
        const personalizedContent = emailContent.replace(/\{name\}/g, recipientName);

        const emailResponse = await resend.emails.send({
          from: fromEmail,
          to: [recipient.email],
          subject: personalizedSubject,
          html: personalizedContent.replace(/\n/g, '<br>'), // Convert line breaks to HTML
        });

        console.log(`Email sent to ${recipient.email}:`, emailResponse);

        // Log email (only if it's a customer)
        if (recipient.isCustomer) {
          await supabase.from('email_logs').insert({
            recipient_email: recipient.email,
            subject: personalizedSubject,
            template_id: templateId,
            delivery_status: 'sent',
            metadata: { resend_id: emailResponse.id }
          });
        }

        results.success++;
      } catch (error: any) {
        console.error(`Failed to send to ${recipient.email}:`, error);
        results.failed++;
        results.errors.push({
          email: recipient.email,
          error: error.message
        });

        // Log failure (only if it's a customer)
        if (recipient.isCustomer) {
          await supabase.from('email_logs').insert({
            recipient_email: recipient.email,
            subject: emailSubject,
            template_id: templateId,
            delivery_status: 'failed',
            error_message: error.message
          });
        }
      }
    }

    return new Response(
      JSON.stringify({
        success: true,
        results
      }),
      { 
        status: 200, 
        headers: { ...corsHeaders, 'Content-Type': 'application/json' } 
      }
    );

  } catch (error) {
    console.error('Bulk email error:', error);
    return new Response(
      JSON.stringify({ 
        error: error instanceof Error ? error.message : 'Unknown error' 
      }),
      { 
        status: 500, 
        headers: { ...corsHeaders, 'Content-Type': 'application/json' } 
      }
    );
  }
});
