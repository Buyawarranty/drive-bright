// Trustpilot invitation utility
declare global {
  interface Window {
    tp?: (command: string, data?: any) => void;
    TrustpilotObject?: string;
  }
}

export interface TrustpilotInvitationData {
  recipientEmail: string;
  recipientName: string;
  referenceId: string;
  orderDate?: string;
  productUrl?: string;
  productName?: string;
}

/**
 * Send a Trustpilot review invitation after a purchase
 */
export const sendTrustpilotInvitation = (data: TrustpilotInvitationData): void => {
  if (typeof window === 'undefined' || !window.tp) {
    console.warn('Trustpilot SDK not loaded');
    return;
  }

  try {
    window.tp('createInvitation', {
      recipientEmail: data.recipientEmail,
      recipientName: data.recipientName,
      referenceId: data.referenceId,
      source: 'InvitationScript',
      ...(data.orderDate && { orderDate: data.orderDate }),
      ...(data.productUrl && { productUrl: data.productUrl }),
      ...(data.productName && { productName: data.productName }),
    });

    console.log('Trustpilot invitation sent for:', data.recipientEmail);
  } catch (error) {
    console.error('Error sending Trustpilot invitation:', error);
  }
};
