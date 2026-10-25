/**
 * Per-user pop-up visibility for the Live Alerts panel.
 * Stored in admin_users.permissions as `popup_<id>`:
 *   absent = role default, true = always on, false = always off.
 * Each pop-up's own internal rules (named chat recipients, lead owner, etc.) still apply.
 */
export const MANAGEMENT_ROLES = ['admin', 'super_admin', 'sales_manager'];
const SALES_CHAT_ROLES = ['admin', 'super_admin'];

export const isSalesPopupRole = (role?: string | null) => role === 'sales' || role === 'sales_lead';

/** Ownership is mandatory even if a pop-up permission was explicitly enabled. */
export const canSeeLeadPopup = (role: string | null | undefined, viewerId: string | null | undefined, ownerId: string | null | undefined) =>
  !!role && (!isSalesPopupRole(role) || (!!viewerId && ownerId === viewerId));

/** Notifications must have a verified current lead, not merely an old recipient. */
export const canSeeVerifiedLeadNotification = (
  role: string | null | undefined,
  leadId: string | null | undefined,
  currentlyVerified: boolean,
) => !!role && (!isSalesPopupRole(role) || (!!leadId && currentlyVerified));

// These surfaces resolve and enforce current lead ownership before showing rows.
const OWN_LEAD_POPUPS = new Set(['new_leads', 'stuck_checkout', 'failed_payment', 'reminders']);

export const POPUP_TYPES: { id: string; label: string; description: string; defaultRoles: string[] | 'all' }[] = [
  { id: 'new_leads', label: 'New lead alerts', description: 'New leads landing in the agent queue', defaultRoles: 'all' },
  { id: 'stuck_checkout', label: 'Checkout stuck', description: 'Customer stuck part-way through checkout', defaultRoles: 'all' },
  { id: 'failed_payment', label: 'Payment failed', description: 'Failed Stripe or Bumper payments', defaultRoles: 'all' },
  { id: 'chat_request', label: 'Chat customer wants someone', description: 'Website chat customer asked for a person', defaultRoles: SALES_CHAT_ROLES },
  { id: 'live_chat_question', label: 'Live chat questions', description: 'Live chat messages for the people on chat duty', defaultRoles: 'all' },
  { id: 'complaint', label: 'Complaints (not claim)', description: 'New non-claim complaints', defaultRoles: MANAGEMENT_ROLES },
  { id: 'missed_calls', label: 'Missed calls', description: 'Missed inbound calls', defaultRoles: MANAGEMENT_ROLES },
  { id: 'missed_callback', label: 'Missed callbacks', description: 'Callbacks that were not made on time', defaultRoles: MANAGEMENT_ROLES },
  { id: 'incoming_call', label: 'Incoming calls', description: 'Live incoming call', defaultRoles: MANAGEMENT_ROLES },
  { id: 'reminders', label: 'Reminders due', description: 'Lead and customer reminders falling due', defaultRoles: MANAGEMENT_ROLES },
  { id: 'discount_auth_needed', label: 'Authorisation needed', description: 'Agent price/discount requests to authorise', defaultRoles: MANAGEMENT_ROLES },
  { id: 'discount_payment_pending', label: 'Authorised discount · payment pending', description: 'Over-30% discounts approved but not yet paid', defaultRoles: MANAGEMENT_ROLES },
  { id: 'whatsapp_hot_lead', label: 'Hot WhatsApp leads', description: 'Unclaimed hot WhatsApp conversations', defaultRoles: MANAGEMENT_ROLES },
];

export const popupKey = (id: string) => `popup_${id}`;

export const canSeePopup = (id: string, role: string | null | undefined, perms: Record<string, boolean> | null | undefined) => {
  if (!role) return false;
  if (['sales', 'sales_lead', 'sales_manager'].includes(role) && ['chat_request', 'live_chat_question'].includes(id)) return false;
  if (isSalesPopupRole(role) && !OWN_LEAD_POPUPS.has(id)) return false;
  const k = popupKey(id);
  if (perms && k in perms) return perms[k] === true;
  const t = POPUP_TYPES.find((p) => p.id === id);
  if (!t) return true;
  return t.defaultRoles === 'all' || t.defaultRoles.includes(role || '');
};
