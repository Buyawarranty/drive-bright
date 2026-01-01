// BuyAWarranty Permissions System - Helper Functions

import { PermissionPolicy, MaskLevel, TabPermission } from './types';

/**
 * Deep merge two objects
 */
export function deepMerge<T extends object>(target: T, source: Partial<T>): T {
  const output = { ...target } as any;
  
  for (const [key, value] of Object.entries(source as any)) {
    if (value && typeof value === 'object' && !Array.isArray(value)) {
      output[key] = deepMerge((output as any)[key] ?? {}, value);
    } else if (value !== undefined) {
      output[key] = value;
    }
  }
  
  return output as T;
}

/**
 * Calculate diff between two policies
 */
export function diffPolicies(
  before: Partial<PermissionPolicy>,
  after: Partial<PermissionPolicy>
): Record<string, { before: any; after: any }> {
  const diff: Record<string, { before: any; after: any }> = {};
  
  const compareObjects = (a: any, b: any, path: string = '') => {
    if (a === b) return;
    if (typeof a !== 'object' || typeof b !== 'object' || a === null || b === null) {
      diff[path] = { before: a, after: b };
      return;
    }
    
    const keys = new Set([...Object.keys(a ?? {}), ...Object.keys(b ?? {})]);
    for (const key of keys) {
      const newPath = path ? `${path}.${key}` : key;
      compareObjects(a?.[key], b?.[key], newPath);
    }
  };
  
  compareObjects(before, after);
  return diff;
}

/**
 * Check if user has tab permission
 */
export function hasTabPermission(
  policy: PermissionPolicy | null,
  tabKey: string,
  action: keyof TabPermission = 'view'
): boolean {
  if (!policy) return false;
  
  const tabPerms = policy.tabs[tabKey];
  if (!tabPerms) return false;
  
  const value = tabPerms[action];
  return value === true || value === 'team' || value === 'own';
}

/**
 * Get column mask level
 */
export function getColumnMaskLevel(
  policy: PermissionPolicy | null,
  columnKey: string
): MaskLevel {
  if (!policy) return 'full';
  
  const colPerms = policy.columns[columnKey];
  if (!colPerms || !colPerms.view) return 'full';
  
  return colPerms.mask || 'full';
}

/**
 * Apply mask to a value based on mask level
 */
export function applyMask(value: string | null | undefined, maskLevel: MaskLevel): string {
  if (!value) return '';
  
  switch (maskLevel) {
    case 'none':
      return value;
    case 'partial':
      return maskPartially(value);
    case 'full':
      return '••••••••';
    default:
      return '••••••••';
  }
}

/**
 * Partially mask a value based on its type
 */
function maskPartially(value: string): string {
  // Email masking: a***@domain.com
  if (value.includes('@')) {
    const [local, domain] = value.split('@');
    if (local.length <= 2) {
      return `${local[0]}***@${domain}`;
    }
    return `${local[0]}***@${domain}`;
  }
  
  // Phone masking: show last 4 digits
  if (/^[\d\s\-\+\(\)]+$/.test(value)) {
    const digits = value.replace(/\D/g, '');
    if (digits.length >= 4) {
      return `•••• ${digits.slice(-4)}`;
    }
    return '••••';
  }
  
  // Default: show first and last character
  if (value.length <= 4) {
    return `${value[0]}${'•'.repeat(value.length - 1)}`;
  }
  return `${value[0]}${'•'.repeat(value.length - 2)}${value[value.length - 1]}`;
}

/**
 * Check if user can perform action
 */
export function canPerformAction(
  policy: PermissionPolicy | null,
  action: keyof PermissionPolicy['actions']
): boolean {
  if (!policy) return false;
  
  const actionPerm = policy.actions[action];
  if (!actionPerm) return false;
  
  return 'allowed' in actionPerm ? actionPerm.allowed : false;
}

/**
 * Get discount approval limit
 */
export function getDiscountLimit(policy: PermissionPolicy | null): number {
  if (!policy) return 0;
  return policy.actions.approve_discount?.limit_percent || 0;
}

/**
 * Check if policy allows inviting users
 */
export function canInviteUsers(policy: PermissionPolicy | null): boolean {
  if (!policy) return false;
  const { allowed, scope } = policy.actions.invite_user || {};
  return allowed && scope !== 'none';
}

/**
 * Get user management scope
 */
export function getManagementScope(policy: PermissionPolicy | null): 'none' | 'own' | 'team' | 'department' | 'global' {
  if (!policy) return 'none';
  return policy.actions.manage_roles?.scope || 'none';
}

/**
 * Check if elevation has expired
 */
export function isElevationExpired(policy: PermissionPolicy | null): boolean {
  if (!policy?.elevated_until) return false;
  return new Date(policy.elevated_until) < new Date();
}

/**
 * Format elevation expiry for display
 */
export function formatElevationExpiry(elevatedUntil: string | null | undefined): string | null {
  if (!elevatedUntil) return null;
  
  const expiry = new Date(elevatedUntil);
  const now = new Date();
  
  if (expiry < now) return 'Expired';
  
  const diffMs = expiry.getTime() - now.getTime();
  const diffHours = Math.floor(diffMs / (1000 * 60 * 60));
  const diffMins = Math.floor((diffMs % (1000 * 60 * 60)) / (1000 * 60));
  
  if (diffHours > 24) {
    const days = Math.floor(diffHours / 24);
    return `${days} day${days > 1 ? 's' : ''} remaining`;
  }
  
  if (diffHours > 0) {
    return `${diffHours}h ${diffMins}m remaining`;
  }
  
  return `${diffMins} minutes remaining`;
}

/**
 * Generate audit note for policy change
 */
export function generateAuditNote(
  before: Partial<PermissionPolicy>,
  after: Partial<PermissionPolicy>
): string {
  const diff = diffPolicies(before, after);
  const changes: string[] = [];
  
  for (const [path, { before: b, after: a }] of Object.entries(diff)) {
    if (path.startsWith('tabs.')) {
      const [, tab, action] = path.split('.');
      changes.push(`${tab} ${action}: ${b} → ${a}`);
    } else if (path.startsWith('columns.')) {
      changes.push(`Column masking updated`);
    } else if (path.startsWith('actions.')) {
      changes.push(`Action permissions updated`);
    }
  }
  
  if (changes.length === 0) return 'No changes detected';
  if (changes.length === 1) return changes[0];
  return `${changes.length} permissions updated`;
}

/**
 * Identify risk flags in a policy
 */
export function identifyRiskFlags(policy: PermissionPolicy): string[] {
  const flags: string[] = [];
  
  // Check for export permissions
  const exportTabs = Object.entries(policy.tabs)
    .filter(([, perms]) => perms.export)
    .map(([tab]) => tab);
  
  if (exportTabs.length > 0) {
    flags.push(`Export enabled for ${exportTabs.length} tab(s)`);
  }
  
  // Check for unmasked PII
  const unmaskedPII = Object.entries(policy.columns)
    .filter(([key, mask]) => mask.mask === 'none' && (key.includes('email') || key.includes('phone') || key.includes('address')))
    .map(([key]) => key);
  
  if (unmaskedPII.length > 0) {
    flags.push(`Unmasked PII: ${unmaskedPII.length} field(s)`);
  }
  
  // Check for delete permissions
  const deleteTabs = Object.entries(policy.tabs)
    .filter(([, perms]) => perms.delete)
    .map(([tab]) => tab);
  
  if (deleteTabs.length > 0) {
    flags.push(`Delete enabled for ${deleteTabs.length} tab(s)`);
  }
  
  // Check for high discount approval
  if (policy.actions.approve_discount?.allowed && policy.actions.approve_discount.limit_percent > 20) {
    flags.push(`High discount approval limit: ${policy.actions.approve_discount.limit_percent}%`);
  }
  
  // Check for global user management
  if (policy.actions.manage_roles?.scope === 'global') {
    flags.push('Global user management access');
  }
  
  return flags;
}
