// Email tracking utilities for analytics

declare global {
  interface Window {
    gtag: (...args: any[]) => void;
    fbq: (...args: any[]) => void;
    ttq?: any;
    TiktokAnalyticsObject?: string;
    _fbq?: any;
  }
}

export interface UTMParameters {
  campaign: string;
  source: string;
  medium: string;
  content?: string;
  term?: string;
}

export function generateTrackingId(): string {
  return `${Date.now()}-${Math.random().toString(36).substr(2, 9)}`;
}

export function generateUTMParameters(
  templateType: string,
  recipientEmail: string,
  campaignId?: string
): UTMParameters {
  return {
    campaign: campaignId || `email_${templateType}`,
    source: 'email',
    medium: 'email',
    content: templateType,
  };
}

export function addUTMParametersToUrl(url: string, utm: UTMParameters): string {
  const urlObj = new URL(url);
  urlObj.searchParams.set('utm_campaign', utm.campaign);
  urlObj.searchParams.set('utm_source', utm.source);
  urlObj.searchParams.set('utm_medium', utm.medium);
  if (utm.content) urlObj.searchParams.set('utm_content', utm.content);
  if (utm.term) urlObj.searchParams.set('utm_term', utm.term);
  return urlObj.toString();
}

export function generateTrackingPixelUrl(trackingId: string, baseUrl: string): string {
  return `${baseUrl}/functions/v1/track-email-open?tracking_id=${trackingId}`;
}

export function wrapLinksWithTracking(html: string, trackingId: string, baseUrl: string): string {
  // Replace all href attributes with tracked versions
  return html.replace(
    /href="([^"]*)"/g,
    (match, url) => {
      if (url.startsWith('http') || url.startsWith('//')) {
        const trackingUrl = `${baseUrl}/functions/v1/track-email-click?tracking_id=${trackingId}&url=${encodeURIComponent(url)}`;
        return `href="${trackingUrl}"`;
      }
      return match;
    }
  );
}

// Google Analytics event tracking
export function trackEmailOpen(emailId: string, campaignName: string) {
  if (typeof window !== 'undefined' && window.gtag) {
    window.gtag('event', 'email_open', {
      event_category: 'Email',
      event_label: campaignName,
      value: emailId,
    });
  }
}

export function trackEmailClick(emailId: string, campaignName: string, linkUrl: string) {
  if (typeof window !== 'undefined' && window.gtag) {
    window.gtag('event', 'email_click', {
      event_category: 'Email',
      event_label: campaignName,
      value: linkUrl,
      email_id: emailId,
    });
  }
}

export function trackEmailConversion(emailId: string, campaignName: string, value?: number) {
  if (typeof window !== 'undefined' && window.gtag) {
    window.gtag('event', 'email_conversion', {
      event_category: 'Email',
      event_label: campaignName,
      value: value || 0,
      currency: 'GBP',
      email_id: emailId,
    });
  }
}

// Meta Pixel event tracking
export function trackMetaPixelEmailOpen(emailId: string, campaignName: string) {
  if (typeof window !== 'undefined' && window.fbq) {
    window.fbq('trackCustom', 'EmailOpen', {
      email_id: emailId,
      campaign_name: campaignName,
    });
  }
}

export function trackMetaPixelEmailClick(emailId: string, campaignName: string, linkUrl: string) {
  if (typeof window !== 'undefined' && window.fbq) {
    window.fbq('trackCustom', 'EmailClick', {
      email_id: emailId,
      campaign_name: campaignName,
      link_url: linkUrl,
    });
  }
}

export function trackMetaPixelEmailConversion(
  emailId: string,
  campaignName: string,
  value?: number
) {
  if (typeof window !== 'undefined' && window.fbq) {
    window.fbq('track', 'Purchase', {
      value: value || 0,
      currency: 'GBP',
      content_category: 'email_conversion',
      email_id: emailId,
      campaign_name: campaignName,
    });
  }
}

// Calculate email analytics metrics
export interface EmailAnalytics {
  totalSent: number;
  totalOpened: number;
  totalClicked: number;
  totalConverted: number;
  openRate: number;
  clickRate: number;
  clickToOpenRate: number;
  conversionRate: number;
}

export function calculateEmailAnalytics(emailLogs: any[]): EmailAnalytics {
  const totalSent = emailLogs.filter((log) => log.status === 'sent').length;
  const totalOpened = emailLogs.filter((log) => log.open_tracked).length;
  const totalClicked = emailLogs.filter((log) => log.click_tracked).length;
  const totalConverted = emailLogs.filter((log) => log.conversion_tracked).length;

  return {
    totalSent,
    totalOpened,
    totalClicked,
    totalConverted,
    openRate: totalSent > 0 ? (totalOpened / totalSent) * 100 : 0,
    clickRate: totalSent > 0 ? (totalClicked / totalSent) * 100 : 0,
    clickToOpenRate: totalOpened > 0 ? (totalClicked / totalOpened) * 100 : 0,
    conversionRate: totalSent > 0 ? (totalConverted / totalSent) * 100 : 0,
  };
}
