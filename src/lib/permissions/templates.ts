// BuyAWarranty Permissions System - Role Templates
// Pre-built policies for common roles

import { PermissionPolicy, TabPermission, ColumnMask, ActionPermissions, SecuritySettings } from './types';

const baseTabPermission: TabPermission = {
  view: false,
  create: false,
  edit: false,
  delete: false,
  export: false,
  approve: false,
};

const baseSecuritySettings: SecuritySettings = {
  require_2fa: true,
  require_sso: false,
  session_timeout_minutes: 30,
  export_rate_limit_per_hour: 2,
  approval_required_for_export: true,
};

const baseActionPermissions: ActionPermissions = {
  approve_discount: { allowed: false, limit_percent: 0 },
  invite_user: { allowed: false, scope: 'none' },
  manage_roles: { allowed: false, scope: 'none' },
  resend_invite: { allowed: false },
  deactivate_user: { allowed: false },
  reactivate_user: { allowed: false },
};

// Helper to create full masking
const fullMask: ColumnMask = { view: false, mask: 'full' };
const partialMask: ColumnMask = { view: true, mask: 'partial' };
const noMask: ColumnMask = { view: true, mask: 'none' };

export const ROLE_TEMPLATES: Record<string, PermissionPolicy> = {
  super_admin: {
    name: 'Super Admin',
    description: 'Full control including security, SSO, and global settings',
    department: null,
    security: {
      ...baseSecuritySettings,
      require_2fa: true,
      session_timeout_minutes: 60,
      export_rate_limit_per_hour: 100,
      approval_required_for_export: false,
    },
    tabs: {
      analytics: { view: true, create: true, edit: true, delete: true, export: true, approve: true },
      user_permissions: { view: true, create: true, edit: true, delete: true, export: true, approve: true },
      document_mapping: { view: true, create: true, edit: true, delete: true, export: true, approve: true },
      blog_writing: { view: true, create: true, edit: true, delete: true, export: true, approve: true },
      landing_pages: { view: true, create: true, edit: true, delete: true, export: true, approve: true },
      customers: { view: true, create: true, edit: true, delete: true, export: true, approve: true },
      new_leads: { view: true, create: true, edit: true, delete: true, export: true, approve: true },
      orders: { view: true, create: true, edit: true, delete: true, export: true, approve: true },
      warranties: { view: true, create: true, edit: true, delete: true, export: true, approve: true },
      claims: { view: true, create: true, edit: true, delete: true, export: true, approve: true },
      payments: { view: true, create: true, edit: true, delete: true, export: true, approve: true },
      marketing: { view: true, create: true, edit: true, delete: true, export: true, approve: true },
      settings: { view: true, create: true, edit: true, delete: true, export: true, approve: true },
    },
    columns: {
      'customers.email': noMask,
      'customers.phone': noMask,
      'customers.address': noMask,
      'orders.customer_email': noMask,
      'orders.customer_phone': noMask,
      'orders.vehicle_reg': noMask,
      'orders.policy_number': noMask,
      'orders.net_price': noMask,
      'orders.commission': noMask,
    },
    actions: {
      approve_discount: { allowed: true, limit_percent: 100 },
      invite_user: { allowed: true, scope: 'global' },
      manage_roles: { allowed: true, scope: 'global' },
      resend_invite: { allowed: true },
      deactivate_user: { allowed: true },
      reactivate_user: { allowed: true },
    },
  },

  sales_manager: {
    name: 'Sales Manager',
    description: 'Manage sales team, customers, orders, approve discounts up to 10%',
    department: 'sales',
    security: baseSecuritySettings,
    tabs: {
      analytics: { view: 'team', create: false, edit: false, delete: false, export: true, approve: false },
      user_permissions: { view: true, create: false, edit: true, delete: false, export: false, approve: false },
      customers: { view: true, create: true, edit: true, delete: false, export: true, approve: false },
      orders: { view: true, create: true, edit: true, delete: false, export: true, approve: true },
      warranties: { view: true, create: true, edit: true, delete: false, export: false, approve: false },
      claims: { view: true, create: false, edit: false, delete: false, export: false, approve: false },
      marketing: { view: true, create: false, edit: false, delete: false, export: false, approve: false },
      get_quote: { view: true, create: true, edit: true, delete: false, export: false, approve: false },
      abandoned_carts: { view: true, create: false, edit: true, delete: false, export: true, approve: false },
    },
    columns: {
      'customers.email': noMask,
      'customers.phone': partialMask,
      'customers.address': partialMask,
      'orders.customer_email': noMask,
      'orders.customer_phone': partialMask,
      'orders.vehicle_reg': noMask,
      'orders.policy_number': noMask,
      'orders.net_price': noMask,
      'orders.commission': noMask,
    },
    actions: {
      approve_discount: { allowed: true, limit_percent: 10 },
      invite_user: { allowed: true, scope: 'department' },
      manage_roles: { allowed: true, scope: 'department' },
      resend_invite: { allowed: true },
      deactivate_user: { allowed: true },
      reactivate_user: { allowed: true },
    },
  },

  sales_agent: {
    name: 'Sales Agent',
    description: 'Handle customer orders and warranties, limited export',
    department: 'sales',
    security: baseSecuritySettings,
    tabs: {
      analytics: { view: 'team', create: false, edit: false, delete: false, export: false, approve: false },
      new_leads: { view: true, create: true, edit: true, delete: false, export: false, approve: false },
      get_quote: { view: true, create: true, edit: true, delete: false, export: false, approve: false },
      customers: { view: true, create: true, edit: true, delete: false, export: false, approve: false },
      orders: { view: true, create: true, edit: 'own', delete: false, export: false, approve: false },
      warranties: { view: true, create: true, edit: true, delete: false, export: false, approve: false },
      discount_codes: { view: true, create: false, edit: false, delete: false, export: false, approve: false },
      abandoned_carts: { view: true, create: false, edit: true, delete: false, export: false, approve: false },
      sales_scoreboard: { view: true, create: false, edit: false, delete: false, export: false, approve: false },
    },
    columns: {
      'customers.email': partialMask,
      'customers.phone': partialMask,
      'customers.address': fullMask,
      'orders.customer_email': partialMask,
      'orders.customer_phone': partialMask,
      'orders.vehicle_reg': noMask,
      'orders.policy_number': noMask,
      'orders.net_price': fullMask,
      'orders.commission': fullMask,
    },
    actions: baseActionPermissions,
  },

  accounts_admin: {
    name: 'Accounts Admin',
    description: 'Manage payments, refunds, and financial reporting',
    department: 'accounts',
    security: baseSecuritySettings,
    tabs: {
      analytics: { view: true, create: false, edit: false, delete: false, export: true, approve: false },
      orders: { view: true, create: false, edit: false, delete: false, export: false, approve: false },
      payments: { view: true, create: true, edit: true, delete: false, export: true, approve: true },
      claims: { view: true, create: false, edit: true, delete: false, export: false, approve: true },
    },
    columns: {
      'customers.email': noMask,
      'customers.phone': partialMask,
      'customers.address': noMask,
      'orders.customer_email': noMask,
      'orders.customer_phone': partialMask,
      'orders.vehicle_reg': noMask,
      'orders.policy_number': noMask,
      'orders.net_price': noMask,
      'orders.commission': noMask,
    },
    actions: {
      ...baseActionPermissions,
      invite_user: { allowed: true, scope: 'department' },
    },
  },

  support_agent: {
    name: 'Support Agent',
    description: 'Handle claims and customer inquiries',
    department: 'support',
    security: baseSecuritySettings,
    tabs: {
      customers: { view: true, create: false, edit: false, delete: false, export: false, approve: false },
      orders: { view: true, create: false, edit: false, delete: false, export: false, approve: false },
      claims: { view: true, create: true, edit: true, delete: false, export: false, approve: false },
      document_mapping: { view: true, create: false, edit: false, delete: false, export: false, approve: false },
      contact: { view: true, create: false, edit: true, delete: false, export: false, approve: false },
    },
    columns: {
      'customers.email': partialMask,
      'customers.phone': partialMask,
      'customers.address': fullMask,
      'orders.customer_email': partialMask,
      'orders.customer_phone': partialMask,
      'orders.vehicle_reg': noMask,
      'orders.policy_number': noMask,
      'orders.net_price': fullMask,
      'orders.commission': fullMask,
    },
    actions: baseActionPermissions,
  },

  auditor: {
    name: 'Auditor',
    description: 'Read-only access for audit purposes with optional export',
    department: null,
    security: {
      ...baseSecuritySettings,
      approval_required_for_export: true,
    },
    tabs: {
      analytics: { view: true, create: false, edit: false, delete: false, export: true, approve: false },
      customers: { view: true, create: false, edit: false, delete: false, export: false, approve: false },
      orders: { view: true, create: false, edit: false, delete: false, export: false, approve: false },
      payments: { view: true, create: false, edit: false, delete: false, export: false, approve: false },
      claims: { view: true, create: false, edit: false, delete: false, export: false, approve: false },
    },
    columns: {
      'customers.email': partialMask,
      'customers.phone': fullMask,
      'customers.address': fullMask,
      'orders.customer_email': partialMask,
      'orders.customer_phone': fullMask,
      'orders.vehicle_reg': partialMask,
      'orders.policy_number': noMask,
      'orders.net_price': fullMask,
      'orders.commission': fullMask,
    },
    actions: baseActionPermissions,
  },

  ai_content_editor: {
    name: 'AI Content Editor',
    description: 'Blog writing and content management only',
    department: 'marketing',
    security: baseSecuritySettings,
    tabs: {
      blog_writing: { view: true, create: true, edit: true, delete: true, export: false, approve: false },
      landing_pages: { view: true, create: true, edit: true, delete: false, export: false, approve: false },
    },
    columns: {},
    actions: baseActionPermissions,
  },

  marketing: {
    name: 'Marketing',
    description: 'Marketing team with data export access for campaigns and analysis',
    department: 'marketing',
    security: {
      ...baseSecuritySettings,
      export_rate_limit_per_hour: 10,
      approval_required_for_export: false,
    },
    tabs: {
      customers: { view: true, create: false, edit: false, delete: false, export: true, approve: false },
      new_leads: { view: true, create: false, edit: false, delete: false, export: true, approve: false },
      discount_codes: { view: true, create: true, edit: true, delete: false, export: true, approve: false },
      abandoned_carts: { view: true, create: false, edit: false, delete: false, export: true, approve: false },
      referrals: { view: true, create: false, edit: false, delete: false, export: true, approve: false },
      emails: { view: true, create: true, edit: true, delete: false, export: true, approve: false },
      blog_writing: { view: true, create: true, edit: true, delete: false, export: false, approve: false },
      landing_pages: { view: true, create: true, edit: true, delete: false, export: false, approve: false },
      analytics: { view: true, create: false, edit: false, delete: false, export: true, approve: false },
    },
    columns: {
      'customers.email': noMask,
      'customers.phone': noMask,
      'customers.address': partialMask,
      'orders.customer_email': noMask,
      'orders.customer_phone': noMask,
      'orders.vehicle_reg': noMask,
      'orders.policy_number': noMask,
      'orders.net_price': fullMask,
      'orders.commission': fullMask,
    },
    actions: baseActionPermissions,
  },

  sales_lead: {
    name: 'Sales Lead',
    description: 'Team leader who assigns leads, sets targets, and monitors sales agent performance',
    department: 'sales',
    security: baseSecuritySettings,
    tabs: {
      analytics: { view: 'team', create: false, edit: false, delete: false, export: true, approve: false },
      new_leads: { view: true, create: true, edit: true, delete: false, export: true, approve: true },
      get_quote: { view: true, create: true, edit: true, delete: false, export: false, approve: false },
      customers: { view: true, create: false, edit: false, delete: false, export: true, approve: false },
      abandoned_carts: { view: true, create: false, edit: true, delete: false, export: true, approve: false },
      discount_codes: { view: true, create: false, edit: false, delete: false, export: false, approve: false },
      referrals: { view: true, create: false, edit: false, delete: false, export: false, approve: false },
      sales_scoreboard: { view: true, create: false, edit: false, delete: false, export: false, approve: false },
    },
    columns: {
      'customers.email': noMask,
      'customers.phone': noMask,
      'customers.address': partialMask,
      'orders.customer_email': noMask,
      'orders.customer_phone': noMask,
      'orders.vehicle_reg': noMask,
      'orders.policy_number': noMask,
      'orders.net_price': noMask,
      'orders.commission': fullMask,
    },
    actions: {
      approve_discount: { allowed: true, limit_percent: 10 },
      invite_user: { allowed: false, scope: 'none' },
      manage_roles: { allowed: false, scope: 'none' },
      resend_invite: { allowed: false },
      deactivate_user: { allowed: false },
      reactivate_user: { allowed: false },
    },
  },
};

// Get template by role name
export const getTemplateByRole = (role: string): PermissionPolicy | null => {
  return ROLE_TEMPLATES[role] || null;
};

// Get all template names
export const getTemplateNames = (): string[] => {
  return Object.keys(ROLE_TEMPLATES);
};

// Create empty base policy
export const createEmptyPolicy = (name: string = 'Custom'): PermissionPolicy => ({
  name,
  description: '',
  department: null,
  security: baseSecuritySettings,
  tabs: {},
  columns: {},
  actions: baseActionPermissions,
});
