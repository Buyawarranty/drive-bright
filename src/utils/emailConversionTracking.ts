// Track email conversions when users complete purchases
import { supabase } from '@/integrations/supabase/client';
import { trackMetaPixelEmailConversion } from './emailTracking';

export async function trackEmailConversion(
  email: string,
  conversionValue: number,
  conversionType: string = 'purchase'
) {
  try {
    // Find the most recent email sent to this user
    const { data: emailLog } = await supabase
      .from('email_logs')
      .select('*')
      .eq('recipient_email', email)
      .order('sent_at', { ascending: false })
      .limit(1)
      .maybeSingle();

    if (emailLog && emailLog.tracking_id) {
      // Update the email log to mark conversion
      await supabase
        .from('email_logs')
        .update({
          conversion_tracked: true,
          delivery_status: 'converted',
        })
        .eq('id', emailLog.id);

      // Insert conversion tracking event
      await supabase
        .from('email_tracking_events')
        .insert({
          email_log_id: emailLog.id,
          event_type: 'conversion',
          event_data: {
            conversion_type: conversionType,
            value: conversionValue,
            currency: 'GBP',
          },
        });

      // Track with Meta Pixel
      trackMetaPixelEmailConversion(
        emailLog.tracking_id,
        emailLog.utm_campaign || 'email',
        conversionValue
      );

      console.log('Email conversion tracked:', emailLog.tracking_id);
    }
    
    // Also mark any abandoned carts as converted
    await supabase
      .from('abandoned_carts')
      .update({ 
        is_converted: true,
        converted_at: new Date().toISOString()
      })
      .eq('email', email)
      .eq('is_converted', false);
      
  } catch (error) {
    console.error('Error tracking email conversion:', error);
  }
}

// Call this after successful payment
export async function trackPurchaseConversion(
  customerEmail: string,
  orderValue: number,
  orderId: string
) {
  await trackEmailConversion(customerEmail, orderValue, 'purchase');
  
  // Also track with Google Analytics
  if (typeof window !== 'undefined' && window.gtag) {
    window.gtag('event', 'purchase_from_email', {
      transaction_id: orderId,
      value: orderValue,
      currency: 'GBP',
    });
  }
}
