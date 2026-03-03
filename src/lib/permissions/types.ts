// BuyAWarranty Permissions System - Types
// UK English throughout

export type MaskLevel = 'none' | 'partial' | 'full';
export type ActionScope = 'none' | 'own' | 'team' | 'department' | 'global';
export type Department = 'sales' | 'accounts' | 'support' | 'marketing' | null;

export interface TabPermission {
  view: boolean | 'team';
  create: boolean;
  edit: boolean | 'own';
  delete: boolean;
  export: boolean;
  approve: boolean;
}

export interface ColumnMask {
  view: boolean;
  mask: MaskLevel;
}

export interface SecuritySettings {
  require_2fa: boolean;
  require_sso: boolean;
  session_timeout_minutes: number;
  export_rate_limit_per_hour: number;
  approval_required_for_export: boolean;
}

export interface ActionPermissions {
  approve_discount: { allowed: boolean; limit_percent: number };
  invite_user: { allowed: boolean; scope: ActionScope };
  manage_roles: { allowed: boolean; scope: ActionScope };
  resend_invite: { allowed: boolean };
  deactivate_user: { allowed: boolean };
  reactivate_user: { allowed: boolean };
}

export interface PermissionPolicy {
  id?: string;
  name: string;
  description?: string;
  department: Department;
  is_template?: boolean;
  
  // Security
  security: SecuritySettings;
  
  // Permissions
  tabs: Record<string, TabPermission>;
  columns: Record<string, ColumnMask>;
  actions: ActionPermissions;
  
  // Scope
  scope_team?: string | null;
  scope_region?: string | null;
  elevated_until?: string | null;
  
  created_at?: string;
  updated_at?: string;
}

// Tab definitions for the admin panel
export const ADMIN_TAB_DEFINITIONS = [
  { id: 'new-leads', key: 'new_leads', label: 'New Leads', description: 'Manage sales pipeline and lead assignments', category: 'Sales' },
  { id: 'get-quote', key: 'get_quote', label: 'Quotes & Orders', description: 'Generate quotes and process manual orders', category: 'Sales' },
  { id: 'customers', key: 'customers', label: 'Customers', description: 'Manage customer accounts and policies', category: 'Sales' },
  { id: 'plans', key: 'plans', label: 'Standard Plans', description: 'Manage Basic, Gold, and Platinum plans', category: 'Products' },
  { id: 'bulk-pricing', key: 'bulk_pricing', label: 'Bulk Pricing', description: 'Update pricing using CSV files', category: 'Products' },
  { id: 'special-plans', key: 'special_plans', label: 'Special Vehicle Plans', description: 'Manage EV, PHEV, and Motorbike plans', category: 'Products' },
  { id: 'discount-codes', key: 'discount_codes', label: 'Discount Codes', description: 'Manage discount codes and promotions', category: 'Marketing' },
  { id: 'referrals', key: 'referrals', label: 'Referrals', description: 'Track customer referrals and conversions', category: 'Marketing' },
  { id: 'claims', key: 'claims', label: 'Claims', description: 'Manage customer claim submissions', category: 'Support' },
  { id: 'contact', key: 'contact', label: 'Contact Submissions', description: 'Manage customer contact form submissions', category: 'Support' },
  { id: 'abandoned-carts', key: 'abandoned_carts', label: 'Abandoned Carts', description: 'Track and follow up with incomplete purchases', category: 'Sales' },
  { id: 'pending-w2000', key: 'pending_w2000', label: 'Pending Register', description: 'Scheduled warranty submissions to register', category: 'Operations' },
  { id: 'emails', key: 'emails', label: 'Email Hub', description: 'Unified email management', category: 'Marketing' },
  { id: 'analytics', key: 'analytics', label: 'Analytics', description: 'View reports and analytics', category: 'Reports' },
  { id: 'user-permissions', key: 'user_permissions', label: 'User Permissions', description: 'Manage admin user access and permissions', category: 'Settings' },
  { id: 'document-mapping', key: 'document_mapping', label: 'Document Mapping', description: 'Manage plan to document mappings', category: 'Settings' },
  { id: 'blog-writing', key: 'blog_writing', label: 'Blog Writing', description: 'Create and manage blog content with AI tools', category: 'Content' },
  { id: 'landing-pages', key: 'landing_pages', label: 'Landing Pages', description: 'Create SEO-optimised landing pages', category: 'Content' },
  { id: 'sales-scoreboard', key: 'sales_scoreboard', label: 'Sales Scoreboard', description: 'View sales performance, rankings and competitions', category: 'Sales' },
  { id: 'timesheets', key: 'timesheets', label: 'Timesheets', description: 'Track work hours, deals and commissions', category: 'HR' },
  { id: 'testing', key: 'testing', label: 'Testing', description: 'Test APIs and create test data', category: 'Development' },
  { id: 'account', key: 'account', label: 'Account Settings', description: 'Manage your account and password', category: 'Settings' },
] as const;

// Sensitive columns that can be masked
export const MASKABLE_COLUMNS = [
  { key: 'customers.email', label: 'Customer Email', table: 'customers', column: 'email', category: 'PII' },
  { key: 'customers.phone', label: 'Customer Phone', table: 'customers', column: 'phone', category: 'PII' },
  { key: 'customers.address', label: 'Customer Address', table: 'customers', column: 'address', category: 'PII' },
  { key: 'orders.customer_email', label: 'Order Email', table: 'orders', column: 'customer_email', category: 'PII' },
  { key: 'orders.customer_phone', label: 'Order Phone', table: 'orders', column: 'customer_phone', category: 'PII' },
  { key: 'orders.vehicle_reg', label: 'Vehicle Registration', table: 'orders', column: 'vehicle_reg', category: 'Vehicle' },
  { key: 'orders.policy_number', label: 'Policy Number', table: 'orders', column: 'policy_number', category: 'Policy' },
  { key: 'orders.net_price', label: 'Net Price', table: 'orders', column: 'net_price', category: 'Financial' },
  { key: 'orders.commission', label: 'Commission', table: 'orders', column: 'commission', category: 'Financial' },
] as const;

// Role hierarchy for delegation rules
export const ROLE_HIERARCHY = {
  super_admin: 7,
  global_admin: 6,
  department_admin: 5,
  sales_manager: 4,
  sales_lead: 4,
  accounts_admin: 4,
  accounts_payroll: 4,
  manager: 3,
  sales_agent: 2,
  support_agent: 2,
  member: 2,
  auditor: 1,
  ai_content_editor: 1,
  viewer: 1,
  guest: 0,
} as const;

export type RoleType = keyof typeof ROLE_HIERARCHY;

// UI Microcopy for permissions interface
export const PERMISSIONS_MICROCOPY = {
  invite_modal_title: 'Invite a team member',
  role_helper_text: 'Choose a role that matches their day-to-day work. You can fine-tune access later.',
  masking_helper: 'Mask sensitive data. Agents see only what they need.',
  diff_banner: 'Review changes below. We\'ll log this update for audit.',
  export_warning: 'You\'re enabling data export. Consider limiting scope or requiring approval.',
  elevation_warning: 'This grants temporary elevated access. It will expire automatically.',
  pii_warning: 'This column contains personally identifiable information.',
  financial_warning: 'This column contains sensitive financial data.',
} as const;

// Department labels
export const DEPARTMENT_LABELS: Record<string, string> = {
  sales: 'Sales',
  accounts: 'Accounts',
  support: 'Support',
  marketing: 'Marketing',
} as const;
