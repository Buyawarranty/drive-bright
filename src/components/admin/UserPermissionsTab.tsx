import React, { useState, useEffect } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Badge } from '@/components/ui/badge';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from '@/components/ui/dialog';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Checkbox } from '@/components/ui/checkbox';
import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover';
import { Command, CommandEmpty, CommandGroup, CommandInput, CommandItem, CommandList } from '@/components/ui/command';
import { toast } from 'sonner';
import { UserPlus, Shield, Eye, Users, Trash2, RotateCcw, Mail, Settings, Download, ShieldCheck, Key, Copy, Check, TestTube, ChevronDown, ChevronRight, FileText, Pencil, LogIn, ExternalLink, Info, PauseCircle, PlayCircle, X } from 'lucide-react';
import { AccessRequestsPanel } from './AccessRequestsPanel';
import { ViewAsStaffButton } from './ViewAsStaffButton';

import { TeamActivityPanel } from './TeamActivityPanel';
import { AdminAccessLogPanel } from './AdminAccessLogPanel';
import { useAuth } from '@/hooks/useAuth';
import { defaultTabs as SIDEBAR_TABS } from './AdminSidebar';

interface AdminUser {
  id: string;
  user_id: string | null;
  email: string;
  first_name: string;
  last_name: string;
  role: string;
  permissions: Record<string, boolean> | any;
  is_active: boolean;
  invited_at: string;
  last_login: string | null;
  sip_extension?: string | null;
}

interface Permission {
  permission_key: string;
  permission_name: string;
  description: string;
  category: string;
}

// Define all admin tabs that can be granted as permissions
const ADMIN_TABS = [
  { id: 'new-leads', label: 'New Leads', description: 'Manage sales pipeline and lead assignments', hasGranular: true },
  { id: 'recontact-leads', label: 'Recontact Leads', description: 'Past enquiries ready for follow-up' },
  { id: 'renewals', label: 'Renewals', description: 'Renewals and upsells for active customers' },
  { id: 'get-quote', label: 'Quotes & Orders', description: 'Generate quotes and process manual orders' },
  { id: 'selling-tips', label: 'Sales Script', description: 'Sales script, tips and customer feedback' },
  { id: 'customers', label: 'Customers', description: 'Manage customer accounts and policies', hasGranular: true },
  { id: 'plans', label: 'Terms & Conditions', description: 'Upload Terms & Conditions and Platinum Plan PDFs (super admin by default)' },
  { id: 'bulk-pricing', label: 'Bulk Pricing', description: 'Update pricing using CSV files' },
  { id: 'special-plans', label: 'Special Vehicle Plans', description: 'Manage EV, PHEV, and Motorbike plans' },
  { id: 'discount-codes', label: 'Discount Codes', description: 'Manage discount codes and promotions' },
  { id: 'referrals', label: 'Referrals', description: 'Track customer referrals and conversions' },
  { id: 'claims', label: 'Claims', description: 'Manage customer claim submissions' },
  { id: 'reviews', label: 'Reviews', description: 'Monitor Trustpilot and Google reviews' },
  { id: 'contact', label: 'Contact Submissions', description: 'Manage customer contact form submissions' },
  { id: 'abandoned-carts', label: 'Abandoned Carts', description: 'Track and follow up with incomplete purchases' },
  
  { id: 'marketing-audience', label: 'Marketing Contacts', description: 'Unified mailing list for remarketing' },
  { id: 'emails', label: 'Email Hub', description: 'Unified email management' },
  { id: 'analytics', label: 'Analytics', description: 'View reports and analytics' },
  { id: 'page-analytics', label: 'Page Analytics', description: 'Track page visits, traffic sources & Google Ads' },
  { id: 'google-ads', label: 'Marketing Analytics', description: 'Google Ads, Facebook Ads, conversions & ROAS' },
  { id: 'ab-testing', label: 'A/B Testing', description: 'Compare A vs B variants: visits, submissions, conversions' },
  { id: 'vehicle-stats', label: 'Vehicle Stats', description: 'Analyse which vehicles sell the most warranties' },
  { id: 'lead-backup', label: 'Lead Backup & Recovery', description: 'Backup all contacts, export & sync to marketing' },
  { id: 'user-permissions', label: 'User Permissions', description: 'Manage admin user access and permissions' },
  { id: 'document-mapping', label: 'Document Mapping', description: 'Manage plan to document mappings' },
  { id: 'policy-documents', label: 'Policy Letters', description: 'Generate printable A4 policy letters for customers' },
  { id: 'blogs-data', label: 'Blogs Data', description: 'Create and manage blog content with AI tools' },
  { id: 'landing-pages', label: 'Landing Pages', description: 'Create SEO-optimised landing pages' },
  { id: 'testing', label: 'Testing', description: 'Test APIs and create test data' },
  { id: 'timesheets', label: 'Timesheets', description: 'Track work hours, deals and commissions' },
  { id: 'sales-scoreboard', label: 'Sales Scoreboard', description: 'Leaderboard, awards and sales competition' },
  { id: 'sales-agent-targets', label: 'Sales Agent Monthly Targets', description: 'Set monthly revenue targets (management)' },
  { id: 'discounts-given', label: 'Discounts Given', description: 'Track agent discounts vs retail pricing' },
  { id: 'cancellations', label: 'Cancellations', description: 'Cancelled & refunded warranties (commission reconciliation)' },
  { id: 'refunds-paid', label: 'Refunds Paid', description: 'Refunds issued to customers (commission reconciliation)' },
  { id: 'attribution-settings', label: 'Attribution Settings', description: 'Configure lead source attribution rules' },
  { id: 'staff-hub', label: 'Staff Hub', description: 'Internal staff resources and tools' },
  { id: 'feature-flags', label: 'Feature Flags', description: 'Toggle experimental features on/off' },
  { id: 'ghl-sync-log', label: 'GHL Sync Log', description: 'GoHighLevel synchronisation audit log' },
  { id: 'security', label: 'Security', description: 'Security scans, blocked IPs and audit logs' },
  { id: 'unsubscribe', label: 'Unsubscribe', description: 'Manually unsubscribe customers from emails or remove from new leads' },
  { id: 'overview', label: 'Live Calls Data', description: 'Manager landing page — live KPIs, hourly performance, queue and alerts' },
  { id: 'call-tracking', label: 'Call rail', description: 'Inbound call tracking and assignments' },
  
  { id: 'complaints', label: 'Complaints', description: 'Manage customer complaints and resolutions' },
  { id: 'lead-teams', label: 'Lead Teams', description: 'Team allocation, workstreams and Open Round Robin' },
  { id: 'attendance', label: 'Attendance & Rota', description: 'Working days rota and weekend shift sign-ups' },
  { id: 'goldmine-leads', label: 'Goldmine Leads', description: 'High-intent leads flagged for priority follow-up' },
  { id: 'call-stats', label: 'Call Stats', description: 'Detailed call statistics and speed-to-dial (merged into Live Calls Data)' },
  { id: 'account', label: 'Account Settings', description: 'Manage your account and password' },
];

// Auto-merge any sidebar tab that isn't in ADMIN_TABS yet, so newly added
// sections in the sidebar automatically appear in the Bulk Access Management
// list without needing a manual update here.
(() => {
  const existing = new Set(ADMIN_TABS.map(t => t.id));
  SIDEBAR_TABS.forEach(t => {
    if (!existing.has(t.id)) {
      ADMIN_TABS.push({ id: t.id, label: t.label, description: t.description || '' });
    }
  });
})();


// Granular permissions for specific tabs
const GRANULAR_PERMISSIONS = {
  'customers': [
    { key: 'view', label: 'View', description: 'Can view customer data' },
    { key: 'own-only', label: 'Own Customers Only', description: 'Only see customers from their own orders (via Quotes & Orders)' },
    { key: 'see-source', label: 'See Source', description: 'Can see the customer acquisition source (Google/Facebook/Organic/Website)' },
    { key: 'export', label: 'Export', description: 'Can export customer data to CSV/Excel' },
    { key: 'delete', label: 'Delete', description: 'Can delete customer records' },
  ],
  'new-leads': [
    { key: 'view', label: 'View', description: 'Can view lead data' },
    { key: 'assign', label: 'Assign Leads', description: 'Can assign or reassign leads to agents' },
    { key: 'see-source', label: 'See Source', description: 'Can see the lead source (Google/Facebook/Organic)' },
    { key: 'export', label: 'Export', description: 'Can export lead data to CSV/Excel' },
    { key: 'delete', label: 'Delete', description: 'Can delete lead records' },
    { key: 'all-leads', label: 'See All Leads', description: 'Can see all leads (OFF = only their own assigned leads)' },
    { key: 'my-dashboard', label: 'My Dashboard', description: 'Can view My Dashboard section' },
    { key: 'team-view', label: 'Team View', description: 'Can view Team View (manager view)' },
    { key: 'fake-audit', label: 'Fake Lead Audit', description: 'Can access the Fake Lead Audit panel (audit-only review of leads marked Fake 404)' },
    { key: 'lead-routing', label: 'Lead Routing & Distribution', description: 'Can configure how Google/Facebook/mixed leads are distributed to teams based on conversion performance thresholds' },
    { key: 'live-tracking', label: 'Live Tracking', description: 'Business hours 09:00–18:00 · Mon–Fri · flagged after 30m of no note or call' },
  ],
};

const CLAIMS_AGENT_PERMISSIONS: Record<string, boolean> = {
  'tab_claims': true,
  'tab_customers': true,
  'tab_customers_view': true,
  'tab_discount-codes': true,
  'tab_discounts-given': true,
  'tab_cancellations': true,
  'tab_refunds-paid': true,
  'tab_staff-hub': true,
  'tab_account': true,
};

const CLAIMS_MANAGER_PERMISSIONS: Record<string, boolean> = {
  'tab_claims': true,
  'tab_customers': true,
  'tab_customers_view': true,
  'tab_staff-hub': true,
  'tab_account': true,
};

// Default tab permissions per role - auto-applied when role is selected
const ROLE_DEFAULT_PERMISSIONS: Record<string, Record<string, boolean>> = {
  super_admin: { ...ADMIN_TABS.reduce((acc, tab) => { acc[`tab_${tab.id}`] = true; return acc; }, {} as Record<string, boolean>), 'tab_customers_see-source': true, 'tab_new-leads_see-source': true, 'tab_new-leads_lead-routing': true, 'tab_new-leads_live-tracking': true },
  admin: { ...ADMIN_TABS.reduce((acc, tab) => { acc[`tab_${tab.id}`] = true; return acc; }, {} as Record<string, boolean>), 'tab_customers_see-source': true, 'tab_new-leads_see-source': true, 'tab_new-leads_lead-routing': true, 'tab_new-leads_live-tracking': true },
  dev_tester: { ...ADMIN_TABS.reduce((acc, tab) => { acc[`tab_${tab.id}`] = true; return acc; }, {} as Record<string, boolean>), 'tab_customers_see-source': true, 'tab_new-leads_see-source': true },
  sales_lead: {
    'tab_new-leads': true,
    'tab_get-quote': true,
    'tab_customers': true,
    'tab_selling-tips': true,
    'tab_sales-scoreboard': true,
    'tab_timesheets': true,
    'tab_new-leads_view': true,
    'tab_new-leads_assign': true,
    'tab_new-leads_all-leads': true,
    'tab_new-leads_team-view': true,
    'tab_new-leads_my-dashboard': true,
    'tab_new-leads_fake-audit': true,
    'tab_customers_view': true,
    'tab_unsubscribe': true,
  },
  sales: {
    'tab_new-leads': true,
    'tab_get-quote': true,
    'tab_customers': true,
    'tab_selling-tips': true,
    'tab_abandoned-carts': true,
    'tab_discount-codes': true,
    'tab_sales-scoreboard': true,
    'tab_timesheets': true,
    'tab_new-leads_view': true,
    'tab_new-leads_my-dashboard': true,
    'tab_customers_view': true,
    'tab_customers_own-only': true,
    'tab_unsubscribe': true,
  },
  blog_writer: {
    'tab_blogs-data': true,
    'tab_landing-pages': true,
    'tab_unsubscribe': true,
  },
  performance_manager: {
    'tab_new-leads': true,
    'tab_get-quote': true,
    'tab_customers': true,
    'tab_selling-tips': true,
    'tab_sales-scoreboard': true,
    'tab_timesheets': true,
    'tab_new-leads_view': true,
    'tab_new-leads_assign': true,
    'tab_new-leads_all-leads': true,
    'tab_new-leads_team-view': true,
    'tab_new-leads_my-dashboard': true,
    'tab_new-leads_fake-audit': true,
    'tab_new-leads_see-source': true,
    'tab_new-leads_lead-routing': true,
    'tab_customers_view': true,
    'tab_unsubscribe': true,
  },
  lead_gen: {
    'tab_google-ads': true,
    'tab_new-leads': true,
    'tab_new-leads_view': true,
    'tab_new-leads_see-source': true,
    'tab_new-leads_fake-audit': true,
    'tab_customers_see-source': true,
    'tab_unsubscribe': true,
  },
  accounts: {
    'tab_new-leads': true,
    'tab_get-quote': true,
    'tab_customers': true,
    'tab_discount-codes': true,
    'tab_claims': true,
    'tab_policy-documents': true,
    'tab_timesheets': true,
    'tab_new-leads_view': true,
    'tab_customers_view': true,
    'tab_unsubscribe': true,
  },
  accounts_manager: {
    'tab_new-leads': true,
    'tab_get-quote': true,
    'tab_customers': true,
    'tab_discount-codes': true,
    'tab_claims': true,
    'tab_policy-documents': true,
    'tab_timesheets': true,
    'tab_analytics': true,
    'tab_new-leads_view': true,
    'tab_new-leads_assign': true,
    'tab_new-leads_all-leads': true,
    'tab_new-leads_team-view': true,
    'tab_new-leads_my-dashboard': true,
    'tab_new-leads_fake-audit': true,
    'tab_new-leads_see-source': true,
    'tab_new-leads_lead-routing': true,
    'tab_customers_view': true,
    'tab_customers_see-source': true,
    'tab_unsubscribe': true,
  },
  accounts_payroll: {
    'tab_customers': true,
    'tab_timesheets': true,
    'tab_customers_view': true,
    'tab_unsubscribe': true,
  },
  // Claims Agent: claims workflow access plus related customer/finance context
  claims_agent: { ...CLAIMS_AGENT_PERMISSIONS, 'tab_unsubscribe': true },
  // Claims Manager: claims workspace plus customer context and vehicle intelligence
  claims_manager: { ...CLAIMS_MANAGER_PERMISSIONS, 'tab_unsubscribe': true },
  viewer: ADMIN_TABS.reduce((acc, tab) => { acc[`tab_${tab.id}`] = true; return acc; }, {} as Record<string, boolean>),
  member: { 'tab_unsubscribe': true },
  guest: { 'tab_unsubscribe': true },
};

// Only super_admin / admin should be sent to /auth (debug-enabled gateway).
// All other staff use /sales-login (clean staff gateway).
const ADMIN_GATEWAY_URL = 'https://buyawarranty.co.uk/auth';
const STAFF_GATEWAY_URL = 'https://buyawarranty.co.uk/sales-login';
const loginUrlForRole = (role?: string | null) =>
  role === 'super_admin' || role === 'admin' ? ADMIN_GATEWAY_URL : STAFF_GATEWAY_URL;

export const UserPermissionsTab = () => {
  const { user } = useAuth();
  const [users, setUsers] = useState<AdminUser[]>([]);
  const [permissions, setPermissions] = useState<Permission[]>([]);
  const [loading, setLoading] = useState(true);
  const [loadError, setLoadError] = useState<string | null>(null);
  const [showInviteDialog, setShowInviteDialog] = useState(false);
  const [showEditDialog, setShowEditDialog] = useState(false);
  const [editingUser, setEditingUser] = useState<AdminUser | null>(null);
  const [currentAdminUser, setCurrentAdminUser] = useState<AdminUser | null>(null);
  const [inviteData, setInviteData] = useState({
    email: '',
    firstName: '',
    lastName: '',
    username: '',
    password: '',
    role: 'member' as 'super_admin' | 'admin' | 'member' | 'viewer' | 'guest' | 'blog_writer' | 'sales' | 'sales_lead' | 'dev_tester' | 'lead_gen' | 'claims_agent' | 'claims_manager' | 'performance_manager' | 'accounts' | 'accounts_manager',
    permissions: {} as Record<string, boolean>,
    teamId: null as string | null,
  });
  const [teams, setTeams] = useState<Array<{ id: string; name: string; color: string | null; emoji: string | null }>>([]);
  const [editingTeamId, setEditingTeamId] = useState<string | null>(null);
  const [showPasswordDialog, setShowPasswordDialog] = useState(false);
  const [passwordUser, setPasswordUser] = useState<AdminUser | null>(null);
  const [newPassword, setNewPassword] = useState('');
  const [settingPassword, setSettingPassword] = useState(false);
  const [copiedField, setCopiedField] = useState<string | null>(null);
  const [selectedUsers, setSelectedUsers] = useState<Set<string>>(new Set());
  const [expandedPermsUserId, setExpandedPermsUserId] = useState<string | null>(null);
  const [savingPermsUserId, setSavingPermsUserId] = useState<string | null>(null);
  const [signingInAsId, setSigningInAsId] = useState<string | null>(null);
  const [signInLink, setSignInLink] = useState<{ email: string; link: string } | null>(null);
  const [revealedCreds, setRevealedCreds] = useState<{ email: string; password: string; loginUrl: string } | null>(null);
  const [generatingCredsId, setGeneratingCredsId] = useState<string | null>(null);
  const [sendingLoginId, setSendingLoginId] = useState<string | null>(null);

  // Bulk access management
  const [bulkTabs, setBulkTabs] = useState<Set<string>>(new Set());
  const [bulkMode, setBulkMode] = useState<'grant' | 'revoke'>('grant');
  const [bulkApplying, setBulkApplying] = useState(false);
  const [bulkTabFilter, setBulkTabFilter] = useState('');
  const [userPickerOpen, setUserPickerOpen] = useState(false);

  const toggleUserSelection = (userId: string) => {
    setSelectedUsers(prev => {
      const next = new Set(prev);
      if (next.has(userId)) next.delete(userId);
      else next.add(userId);
      return next;
    });
  };


  const handleBulkApply = async () => {
    if (selectedUsers.size === 0) {
      toast.error('Select at least one user in the table below');
      return;
    }
    if (bulkTabs.size === 0) {
      toast.error('Select at least one section');
      return;
    }

    const value = bulkMode === 'grant';
    const affectedUsers = users.filter(u => selectedUsers.has(u.id));

    if (!confirm(`${bulkMode === 'grant' ? 'Grant' : 'Revoke'} access to ${bulkTabs.size} section(s) for ${affectedUsers.length} user(s)?`)) return;

    setBulkApplying(true);
    try {
      const updates = affectedUsers.map(u => {
        const nextPerms: Record<string, boolean> = { ...(u.permissions || {}) };
        bulkTabs.forEach(tabId => { nextPerms[`tab_${tabId}`] = value; });
        return { id: u.id, permissions: nextPerms };
      });

      const results = await Promise.allSettled(
        updates.map(u =>
          supabase.from('admin_users').update({ permissions: u.permissions }).eq('id', u.id)
        )
      );

      const failed = results.filter(r => r.status === 'rejected').length;
      if (failed > 0) {
        toast.error(`${failed} user(s) failed to update`);
      } else {
        toast.success(`Updated ${affectedUsers.length} user(s) across ${bulkTabs.size} section(s)`);
      }

      // Merge into local state
      const patchMap = new Map(updates.map(u => [u.id, u.permissions]));
      setUsers(prev => prev.map(u => patchMap.has(u.id) ? { ...u, permissions: patchMap.get(u.id)! } : u));
      setBulkTabs(new Set());
    } catch (err: any) {
      console.error('Bulk apply error:', err);
      toast.error(err.message || 'Bulk update failed');
    } finally {
      setBulkApplying(false);
    }
  };


  const handleSendLoginDetails = async (u: AdminUser) => {
    if (!confirm(`Reset password for ${u.email} and email them the new login details?\n\nTheir current password will be replaced.`)) return;
    setSendingLoginId(u.id);
    try {
      const { data, error } = await supabase.functions.invoke('send-admin-login-details', {
        body: {
          userId: u.user_id || u.id,
          email: u.email,
          name: (u as any).first_name || (u as any).name || '',
        }
      });
      if (error) throw error;
      if (data?.success === false) throw new Error(data?.error || 'Failed to send');
      toast.success(`Login details emailed to ${u.email}`);
    } catch (err: any) {
      console.error('Send login details error:', err);
      toast.error(err.message || 'Failed to send login details');
    } finally {
      setSendingLoginId(null);
    }
  };

  const handleSignInAs = async (u: AdminUser) => {
    setSigningInAsId(u.id);
    try {
      const { data, error } = await supabase.functions.invoke('admin-signin-as', {
        body: { targetEmail: u.email, redirectTo: `${window.location.origin}/admin-dashboard` }
      });
      if (error) throw error;

      // Preferred path: edge function returns an already-verified session.
      // Open the dashboard in a new tab and hand it the tokens via URL hash so
      // it can call supabase.auth.setSession() — bypasses magic-link expiry.
      if (data?.access_token && data?.refresh_token) {
        const target = data.redirect_to || `${window.location.origin}/admin-dashboard`;
        const url = `${target}#access_token=${encodeURIComponent(data.access_token)}&refresh_token=${encodeURIComponent(data.refresh_token)}&type=signin_as`;
        setSignInLink({ email: u.email, link: url });
        window.open(url, '_blank', 'noopener,noreferrer');
        return;
      }

      // Fallback: legacy magic-link action_link
      if (!data?.action_link) throw new Error('No session or link returned');
      setSignInLink({ email: u.email, link: data.action_link });
      window.open(data.action_link, '_blank', 'noopener,noreferrer');
    } catch (err: any) {
      console.error('Sign-in-as error:', err);
      toast.error(err.message || 'Failed to generate sign-in link');
    } finally {
      setSigningInAsId(null);
    }
  };

  const handleGenerateAndReveal = async (u: AdminUser) => {
    if (!confirm(`Generate a NEW password for ${u.email} and reveal it?\n\nTheir current password will be replaced. You'll then be able to copy the new password to share.`)) return;
    setGeneratingCredsId(u.id);
    try {
      const chars = 'ABCDEFGHJKLMNPQRSTUVWXYZabcdefghjkmnpqrstuvwxyz23456789';
      let pw = '';
      for (let i = 0; i < 14; i++) pw += chars.charAt(Math.floor(Math.random() * chars.length));
      const { error } = await supabase.functions.invoke('set-admin-password', {
        body: { userId: u.user_id || u.id, email: u.email, password: pw }
      });
      if (error) throw error;
      setRevealedCreds({ email: u.email, password: pw, loginUrl: loginUrlForRole(u.role) });
      toast.success(`New password generated for ${u.email}`);
    } catch (err: any) {
      console.error('Generate password error:', err);
      toast.error(err.message || 'Failed to generate password');
    } finally {
      setGeneratingCredsId(null);
    }
  };

  useEffect(() => {
    let cancelled = false;

    const loadUserPermissionsTab = async () => {
      setLoading(true);
      setLoadError(null);

      const safetyTimer = window.setTimeout(() => {
        if (!cancelled) {
          setLoading(false);
          setLoadError('The permissions screen took too long to load. Please refresh; if it repeats, the logged-in role may not have database permission yet.');
        }
      }, 12000);

      try {
        const results = await Promise.allSettled([
          fetchUsers(),
          fetchPermissions(),
          fetchCurrentAdmin(),
          fetchTeams(),
        ]);

        const failed = results.filter(result => result.status === 'rejected');
        if (!cancelled && failed.length > 0) {
          setLoadError('Some permissions data could not be loaded. User list actions may be limited until database access is fixed.');
        }
      } finally {
        window.clearTimeout(safetyTimer);
        if (!cancelled) setLoading(false);
      }
    };

    loadUserPermissionsTab();

    return () => {
      cancelled = true;
    };
  }, [user?.id]);

  const fetchTeams = async () => {
    try {
      const { data, error } = await supabase
        .from('lead_teams')
        .select('id, name, color, emoji, is_active, sort_order')
        .eq('is_active', true)
        .order('sort_order', { ascending: true });
      if (error) throw error;
      setTeams((data || []) as any);
    } catch (error) {
      console.error('Error fetching lead teams:', error);
      setLoadError('Failed to load lead teams. Team colour selection may be unavailable.');
    }
  };

  // Upsert / move / clear an agent's team assignment (lead_team_members has UNIQUE(team_id, admin_user_id))
  const assignAgentToTeam = async (adminUserId: string, newTeamId: string | null) => {
    const { data: existing } = await supabase
      .from('lead_team_members')
      .select('id, team_id')
      .eq('admin_user_id', adminUserId)
      .maybeSingle();

    if (!newTeamId) {
      if (existing?.id) {
        await supabase.from('lead_team_members').delete().eq('id', existing.id);
      }
      return;
    }
    if (existing?.id) {
      if (existing.team_id === newTeamId) return;
      await supabase
        .from('lead_team_members')
        .update({
          team_id: newTeamId,
          previous_team_id: existing.team_id,
          team_changed_at: new Date().toISOString(),
          notice_seen_at: null,
        } as any)
        .eq('id', existing.id);
    } else {
      await supabase
        .from('lead_team_members')
        .insert({
          admin_user_id: adminUserId,
          team_id: newTeamId,
          // Off by default — manager must switch on lead types in Allocation.
          workstream_new_leads: false,
          workstream_recontact: false,
          workstream_renewals: false,
          team_changed_at: new Date().toISOString(),
          notice_seen_at: null,
        } as any);
    }
  };


  const fetchCurrentAdmin = async () => {
    if (!user?.id) return;
    try {
      const { data, error } = await supabase
        .from('admin_users')
        .select('*')
        .eq('user_id', user.id)
        .single();

      if (!error && data) {
        setCurrentAdminUser(data as AdminUser);
      }
    } catch (error) {
      console.error('Error fetching current admin:', error);
    }
  };

  // Ensure every admin user's stored permissions include an entry for every
  // section currently defined in ADMIN_TABS. When a new section is added to
  // the dashboard it is auto-added to everyone's permissions using their
  // role's default (true if the role default grants it, false otherwise).
  const syncMissingTabsForAllUsers = async (adminUsers: AdminUser[]) => {
    const tabKeys = ADMIN_TABS.map(t => `tab_${t.id}`);
    const updates: Array<{ id: string; permissions: Record<string, boolean> }> = [];

    for (const u of adminUsers) {
      const currentPerms: Record<string, boolean> = { ...(u.permissions || {}) };
      const roleDefaults = ROLE_DEFAULT_PERMISSIONS[u.role] || {};
      let changed = false;

      for (const key of tabKeys) {
        if (!(key in currentPerms)) {
          currentPerms[key] = roleDefaults[key] === true;
          changed = true;
        }
      }

      if (changed) updates.push({ id: u.id, permissions: currentPerms });
    }

    if (updates.length === 0) return adminUsers;

    try {
      await Promise.all(
        updates.map(u =>
          supabase.from('admin_users').update({ permissions: u.permissions }).eq('id', u.id)
        )
      );
      // Merge into local state
      const patchMap = new Map(updates.map(u => [u.id, u.permissions]));
      return adminUsers.map(u => patchMap.has(u.id) ? { ...u, permissions: patchMap.get(u.id)! } : u);
    } catch (err) {
      console.warn('Auto-sync of new tab sections failed:', err);
      return adminUsers;
    }
  };

  const fetchUsers = async () => {
    try {
      const { data, error } = await supabase
        .from('admin_users')
        .select('*')
        .order('created_at', { ascending: false });

      if (error) throw error;
      const synced = await syncMissingTabsForAllUsers((data || []) as AdminUser[]);
      setUsers(synced);
    } catch (error) {
      console.error('Error fetching users:', error);
      setLoadError('Failed to load admin users. This is usually caused by database permissions for the logged-in role.');
      toast.error('Failed to load users');
    } finally {
      setLoading(false);
    }
  };

  const fetchPermissions = async () => {
    try {
      const { data, error } = await supabase
        .from('admin_permissions')
        .select('*')
        .order('category', { ascending: true });

      if (error) throw error;
      setPermissions(data || []);
    } catch (error) {
      console.error('Error fetching permissions:', error);
      setLoadError('Failed to load permission definitions.');
    }
  };

  const handleInviteUser = async () => {
    try {
      const { teamId, ...invitePayload } = inviteData;
      const { data, error } = await supabase.functions.invoke('invite-admin-user', {
        body: invitePayload
      });

      if (error) throw error;

      toast.success(`User invited successfully! Password: ${data.tempPassword}`, {
        duration: 10000
      });

      // Persist team assignment for the new admin user (if a team was chosen)
      if (teamId && teamId !== '__all__') {
        try {
          const { data: newAdmin } = await supabase
            .from('admin_users')
            .select('id')
            .eq('email', inviteData.email)
            .maybeSingle();
          if (newAdmin?.id) {
            await assignAgentToTeam(newAdmin.id, teamId);
          }
        } catch (teamErr) {
          console.warn('Could not assign team:', teamErr);
          toast.error('User invited, but team assignment failed — set it from Lead Allocation.');
        }
      }

      setShowInviteDialog(false);
      setInviteData({
        email: '',
        firstName: '',
        lastName: '',
        username: '',
        password: '',
        role: 'member',
        permissions: {},
        teamId: null,
      });

      fetchUsers();
    } catch (error) {
      console.error('Error inviting user:', error);
      toast.error('Failed to invite user');
    }
  };

  const handleUpdatePermissions = async () => {
    if (!editingUser) return;

    try {
      const validRoles = ['admin', 'super_admin', 'member', 'viewer', 'guest', 'blog_writer', 'sales', 'sales_lead', 'sales_manager', 'dev_tester', 'customer', 'lead_gen', 'claims_agent', 'claims_manager', 'performance_manager', 'accounts', 'accounts_manager'] as const;
      const roleValue = validRoles.includes(editingUser.role as any) 
        ? editingUser.role as typeof validRoles[number]
        : 'guest';

      const { error } = await supabase
        .from('admin_users')
        .update({ 
          permissions: editingUser.permissions,
          role: roleValue,
          sip_extension: editingUser.sip_extension?.toString().trim() || null,
        })
        .eq('id', editingUser.id);

      if (error) throw error;
      
      // Also update user_roles table for role changes using the correct user_id
      if (editingUser.user_id) {
        const { error: roleError } = await supabase
          .from('user_roles')
          .update({ role: roleValue })
          .eq('user_id', editingUser.user_id);

        if (roleError) {
          console.warn('Could not update user_roles:', roleError);
        }
      }

      toast.success('Permissions updated successfully');

      // Persist team change
      try {
        await assignAgentToTeam(editingUser.id, editingTeamId === '__all__' ? null : editingTeamId);
      } catch (teamErr) {
        console.warn('Team assignment failed:', teamErr);
        toast.error('Permissions saved, but team assignment failed.');
      }

      setShowEditDialog(false);
      setEditingUser(null);
      setEditingTeamId(null);
      fetchUsers();
    } catch (error) {
      console.error('Error updating permissions:', error);
      toast.error('Failed to update permissions');
    }
  };

  const handleDeleteUser = async (userId: string) => {
    // Find the user being deleted
    const targetUser = users.find(u => u.id === userId);
    
    // Administrators cannot delete super_admin or other admin users
    if (currentAdminUser?.role === 'admin') {
      if (targetUser?.role === 'super_admin') {
        toast.error('Administrators cannot remove Super Administrators');
        return;
      }
      if (targetUser?.role === 'admin') {
        toast.error('Administrators cannot remove other Administrators');
        return;
      }
    }
    
    if (!confirm(
      'Archive this user?\n\n' +
      '• They will no longer be able to log in\n' +
      '• Their sales history stays intact in Customer Management ' +
      '(assignments, payments confirmed, quotes sent, commission and deal records)\n' +
      '• Live queues (unassigned leads, schedules, distribution caps) are cleared\n\n' +
      'You can leave them archived permanently or reactivate later.'
    )) return;

    try {
      const { error } = await supabase.rpc('archive_admin_user_preserve_sales', {
        p_admin_user_id: userId
      });

      if (error) throw error;
      
      toast.success('User archived — sales history preserved');
      fetchUsers();
    } catch (error) {
      console.error('Error archiving user:', error);
      toast.error('Failed to archive user');
    }
  };

  const toggleUserStatus = async (userId: string, isActive: boolean) => {
    const targetUser = users.find(u => u.id === userId);
    const displayName = targetUser ? `${targetUser.first_name || ''} ${targetUser.last_name || ''}`.trim() || targetUser.email : 'this user';

    if (isActive) {
      // Deactivating — temporary block
      if (!confirm(
        `Deactivate ${displayName}?\n\n` +
        `This is a TEMPORARY block:\n` +
        `• They will not be able to log in\n` +
        `• Their account, permissions, team assignment and history are preserved\n` +
        `• You can reactivate them at any time with one click\n\n` +
        `This is NOT the same as Delete (the red bin icon), which permanently removes the user.`
      )) return;
    } else {
      if (!confirm(`Reactivate ${displayName}? They will be able to log in again with their existing permissions.`)) return;
    }

    try {
      const { error } = await supabase
        .from('admin_users')
        .update({ is_active: !isActive })
        .eq('id', userId);

      if (error) throw error;
      
      toast.success(`User ${!isActive ? 'reactivated' : 'deactivated (temporarily blocked)'} successfully`);
      fetchUsers();
    } catch (error) {
      console.error('Error updating user status:', error);
      toast.error('Failed to update user status');
    }
  };

  const handleResetPassword = async (userId: string, email: string) => {
    if (!confirm(`Are you sure you want to reset password for ${email}? This will send them a new temporary password.`)) return;

    try {
      const { data, error } = await supabase.functions.invoke('reset-admin-password', {
        body: { 
          userId,
          email
        }
      });

      if (error) throw error;
      
      toast.success(`Password reset email sent to ${email}. New temporary password: ${data.tempPassword}`, {
        duration: 15000
      });
    } catch (error: any) {
      console.error('Error resetting password:', error);
      const msg = error?.context?.error || error?.message || 'Failed to reset password';
      toast.error(`Password reset failed: ${msg}`);
    }
  };

  const handleResendInvite = async (userId: string, email: string) => {
    if (!confirm(`Are you sure you want to resend the invitation to ${email}?`)) return;

    try {
      const { data, error } = await supabase.functions.invoke('resend-admin-invite', {
        body: { 
          userId,
          email
        }
      });

      if (error) throw error;
      
      toast.success(`Invitation resent to ${email}. New temporary password: ${data.tempPassword}`, {
        duration: 15000
      });
    } catch (error) {
      console.error('Error resending invite:', error);
      toast.error('Failed to resend invitation');
    }
  };

  const openEditDialog = async (user: AdminUser) => {
    setEditingUser({ ...user, permissions: user.permissions || {} });
    setShowEditDialog(true);
    setEditingTeamId(null);
    const { data } = await supabase
      .from('lead_team_members')
      .select('team_id')
      .eq('admin_user_id', user.id)
      .maybeSingle();
    setEditingTeamId(data?.team_id ?? null);
  };

  const generatePasswordValue = () => {
    const chars = 'ABCDEFGHJKLMNPQRSTUVWXYZabcdefghjkmnpqrstuvwxyz23456789';
    let password = '';
    for (let i = 0; i < 12; i++) {
      password += chars.charAt(Math.floor(Math.random() * chars.length));
    }
    return password;
  };

  const [sendingCreds, setSendingCreds] = useState(false);

  const openPasswordDialog = (user: AdminUser) => {
    setPasswordUser(user);
    // Pre-generate a password so the admin can immediately copy / send / test it.
    setNewPassword(generatePasswordValue());
    setShowPasswordDialog(true);
  };

  const handleSetPassword = async () => {
    if (!passwordUser || !newPassword) {
      toast.error('Please enter a password');
      return;
    }

    if (newPassword.length < 6) {
      toast.error('Password must be at least 6 characters');
      return;
    }

    setSettingPassword(true);
    try {
      const { error } = await supabase.functions.invoke('set-admin-password', {
        body: {
          userId: passwordUser.user_id,
          email: passwordUser.email,
          password: newPassword
        }
      });

      if (error) throw error;

      toast.success(`Password set for ${passwordUser.email}`, { duration: 5000 });
    } catch (error: any) {
      console.error('Error setting password:', error);
      toast.error(error.message || 'Failed to set password');
    } finally {
      setSettingPassword(false);
    }
  };

  const handleSendCredentials = async () => {
    if (!passwordUser || !newPassword || newPassword.length < 6) {
      toast.error('Enter a password (min 6 chars) first');
      return;
    }
    setSendingCreds(true);
    try {
      const { error } = await supabase.functions.invoke('send-admin-login-details', {
        body: {
          userId: passwordUser.user_id,
          email: passwordUser.email,
          name: `${passwordUser.first_name || ''} ${passwordUser.last_name || ''}`.trim(),
          password: newPassword,
          loginUrl: loginUrlForRole(passwordUser.role),
          role: passwordUser.role,
        }
      });
      if (error) throw error;
      toast.success(`Credentials emailed to ${passwordUser.email}`, { duration: 5000 });
    } catch (error: any) {
      console.error('Error sending credentials:', error);
      toast.error(error.message || 'Failed to send credentials');
    } finally {
      setSendingCreds(false);
    }
  };

  const handleTestLogin = () => {
    if (!passwordUser || !newPassword) {
      toast.error('Set a password first');
      return;
    }
    // Copy credentials so they can be pasted on the gateway, then open the login page.
    const gatewayUrl = loginUrlForRole(passwordUser.role);
    const block = `Gateway: SmashSales2026!!\nLogin URL: ${gatewayUrl}\nEmail: ${passwordUser.email}\nPassword: ${newPassword}`;
    navigator.clipboard.writeText(block).catch(() => {});
    toast.success('Credentials copied — paste on the gateway / login page', { duration: 4000 });
    window.open(gatewayUrl, '_blank', 'noopener');
  };


  const copyToClipboard = async (text: string, field: string) => {
    try {
      await navigator.clipboard.writeText(text);
      setCopiedField(field);
      setTimeout(() => setCopiedField(null), 2000);
      toast.success('Copied to clipboard');
    } catch (err) {
      toast.error('Failed to copy');
    }
  };

  const generateRandomPassword = () => {
    const chars = 'ABCDEFGHJKLMNPQRSTUVWXYZabcdefghjkmnpqrstuvwxyz23456789!@#$%';
    let password = '';
    for (let i = 0; i < 12; i++) {
      password += chars.charAt(Math.floor(Math.random() * chars.length));
    }
    setNewPassword(password);
  };

  const toggleTabPermission = (tabId: string, isEditing: boolean) => {
    const permKey = `tab_${tabId}`;
    if (isEditing && editingUser) {
      setEditingUser(prev => {
        if (!prev) return null;
        const current = prev.role === 'admin'
          ? !(permKey in prev.permissions && prev.permissions[permKey] === false)
          : (prev.permissions[permKey] === true);
        return { ...prev, permissions: { ...prev.permissions, [permKey]: !current } };
      });
    } else {
      setInviteData(prev => {
        const current = prev.role === 'admin'
          ? !(permKey in prev.permissions && prev.permissions[permKey] === false)
          : (prev.permissions[permKey] === true);
        return { ...prev, permissions: { ...prev.permissions, [permKey]: !current } };
      });
    }
  };

  const selectAllTabs = (isEditing: boolean) => {
    const allTabPerms = ADMIN_TABS.reduce((acc, tab) => {
      acc[`tab_${tab.id}`] = true;
      return acc;
    }, {} as Record<string, boolean>);

    if (isEditing && editingUser) {
      setEditingUser(prev => prev ? {
        ...prev,
        permissions: { ...prev.permissions, ...allTabPerms }
      } : null);
    } else {
      setInviteData(prev => ({
        ...prev,
        permissions: { ...prev.permissions, ...allTabPerms }
      }));
    }
  };

  const clearAllTabs = (isEditing: boolean) => {
    const clearedTabPerms = ADMIN_TABS.reduce((acc, tab) => {
      acc[`tab_${tab.id}`] = false;
      return acc;
    }, {} as Record<string, boolean>);

    if (isEditing && editingUser) {
      setEditingUser(prev => prev ? {
        ...prev,
        permissions: { ...prev.permissions, ...clearedTabPerms }
      } : null);
    } else {
      setInviteData(prev => ({
        ...prev,
        permissions: { ...prev.permissions, ...clearedTabPerms }
      }));
    }
  };

  const getRoleIcon = (role: string) => {
    switch (role) {
      case 'super_admin': return <ShieldCheck className="h-4 w-4" />;
      case 'admin': return <Shield className="h-4 w-4" />;
      case 'member': return <Users className="h-4 w-4" />;
      case 'viewer': return <Eye className="h-4 w-4" />;
      case 'blog_writer': return <UserPlus className="h-4 w-4" />;
      case 'sales': return <Users className="h-4 w-4" />;
      case 'dev_tester': return <TestTube className="h-4 w-4" />;
      case 'claims_agent': return <FileText className="h-4 w-4" />;
      case 'claims_manager': return <FileText className="h-4 w-4" />;
      default: return <UserPlus className="h-4 w-4" />;
    }
  };

  const getRoleBadgeVariant = (role: string): "destructive" | "default" | "secondary" | "outline" => {
    switch (role) {
      case 'super_admin': return 'destructive';
      case 'admin': return 'destructive';
      case 'sales_lead': return 'destructive';
      case 'performance_manager': return 'destructive';
      case 'dev_tester': return 'default';
      case 'member': return 'default';
      case 'viewer': return 'secondary';
      case 'blog_writer': return 'default';
      case 'sales': return 'default';
      default: return 'outline';
    }
  };

  const getRoleBadgeClassName = (role: string) => {
    if (role === 'super_admin') return 'bg-amber-600 hover:bg-amber-700 text-white border-amber-600';
    if (role === 'sales_lead') return 'bg-violet-600 hover:bg-violet-700 text-white border-violet-600';
    if (role === 'performance_manager') return 'bg-fuchsia-600 hover:bg-fuchsia-700 text-white border-fuchsia-600';
    if (role === 'sales') return 'bg-blue-600 hover:bg-blue-700 text-white border-blue-600';
    if (role === 'lead_gen') return 'bg-teal-600 hover:bg-teal-700 text-white border-teal-600';
    if (role === 'dev_tester') return 'bg-emerald-600 hover:bg-emerald-700 text-white border-emerald-600';
    if (role === 'claims_agent') return 'bg-rose-600 hover:bg-rose-700 text-white border-rose-600';
    if (role === 'claims_manager') return 'bg-rose-700 hover:bg-rose-800 text-white border-rose-700';
    return '';
  };

  const countActiveTabPermissions = (permissions: Record<string, boolean>) => {
    return ADMIN_TABS.filter(tab => permissions[`tab_${tab.id}`]).length;
  };

  const toggleGranularPermission = (tabId: string, permKey: string, isEditing: boolean) => {
    const fullKey = `tab_${tabId}_${permKey}`;
    
    if (isEditing && editingUser) {
      setEditingUser(prev => prev ? {
        ...prev,
        permissions: {
          ...prev.permissions,
          [fullKey]: !prev.permissions[fullKey]
        }
      } : null);
    } else {
      setInviteData(prev => ({
        ...prev,
        permissions: {
          ...prev.permissions,
          [fullKey]: !prev.permissions[fullKey]
        }
      }));
    }
  };

  const groupedPermissions = permissions.reduce((acc, permission) => {
    if (!acc[permission.category]) {
      acc[permission.category] = [];
    }
    acc[permission.category].push(permission);
    return acc;
  }, {} as Record<string, Permission[]>);

  const renderTabPermissionsSection = (perms: Record<string, boolean>, isEditing: boolean, role?: string) => (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <Label className="text-base font-semibold">Tab Access Permissions</Label>
        <div className="flex gap-2">
          <Button 
            type="button" 
            variant="outline" 
            size="sm"
            onClick={() => selectAllTabs(isEditing)}
          >
            Select All
          </Button>
          <Button 
            type="button" 
            variant="outline" 
            size="sm"
            onClick={() => clearAllTabs(isEditing)}
          >
            Clear All
          </Button>
        </div>
      </div>
      <p className="text-sm text-muted-foreground">
        Select which admin panel tabs this user can access
      </p>
      <div className="grid grid-cols-1 md:grid-cols-2 gap-3 max-h-[400px] overflow-y-auto border rounded-lg p-4">
        {[...ADMIN_TABS].sort((a, b) => a.label.localeCompare(b.label)).map((tab) => {
          const permKey = `tab_${tab.id}`;
          // Admin role: default ON unless explicitly set to false
          const isChecked = role === 'admin'
            ? !(permKey in perms && perms[permKey] === false)
            : (perms[permKey] || false);
          const granularPerms = GRANULAR_PERMISSIONS[tab.id as keyof typeof GRANULAR_PERMISSIONS];
          
          return (
            <div 
              key={tab.id} 
              className={`flex flex-col p-3 rounded-lg border transition-colors ${
                isChecked ? 'bg-primary/5 border-primary/20' : 'bg-background hover:bg-muted/50'
              }`}
            >
              <div className="flex items-start space-x-3">
                <Checkbox
                  id={`${isEditing ? 'edit' : 'invite'}-${permKey}`}
                  checked={isChecked}
                  onCheckedChange={() => toggleTabPermission(tab.id, isEditing)}
                  className="mt-0.5"
                />
                <div className="flex-1 min-w-0">
                  <Label 
                    htmlFor={`${isEditing ? 'edit' : 'invite'}-${permKey}`} 
                    className="text-sm font-medium cursor-pointer"
                  >
                    {tab.label}
                  </Label>
                  <p className="text-xs text-muted-foreground mt-0.5 truncate">
                    {tab.description}
                  </p>
                </div>
              </div>
              
              {/* Granular permissions for specific tabs */}
              {isChecked && granularPerms && (
                <div className="ml-7 mt-3 pt-3 border-t border-border/50 space-y-2">
                  <p className="text-xs font-medium text-muted-foreground mb-2">Permissions:</p>
                  <div className="flex flex-wrap gap-3">
                    {granularPerms.map((gPerm) => {
                      const gPermKey = `tab_${tab.id}_${gPerm.key}`;
                      const gIsChecked = perms[gPermKey] || false;
                      
                      return (
                        <div key={gPerm.key} className="flex items-center space-x-2">
                          <Checkbox
                            id={`${isEditing ? 'edit' : 'invite'}-${gPermKey}`}
                            checked={gIsChecked}
                            onCheckedChange={() => toggleGranularPermission(tab.id, gPerm.key, isEditing)}
                            className="h-3.5 w-3.5"
                          />
                          <Label 
                            htmlFor={`${isEditing ? 'edit' : 'invite'}-${gPermKey}`}
                            className="text-xs cursor-pointer"
                            title={gPerm.description}
                          >
                            {gPerm.label}
                          </Label>
                        </div>
                      );
                    })}
                  </div>
                </div>
              )}
            </div>
          );
        })}
      </div>
    </div>
  );

  // Inline auto-save toggle for super admin: flip a single tab permission and persist
  const toggleInlineTabPerm = async (targetUser: AdminUser, tabId: string, nextValue: boolean) => {
    const permKey = `tab_${tabId}`;
    const nextPerms = { ...(targetUser.permissions || {}), [permKey]: nextValue };

    // Optimistic update
    setUsers(prev => prev.map(u => u.id === targetUser.id ? { ...u, permissions: nextPerms } : u));
    setSavingPermsUserId(targetUser.id);

    try {
      const { error } = await supabase
        .from('admin_users')
        .update({ permissions: nextPerms })
        .eq('id', targetUser.id);
      if (error) throw error;
    } catch (err: any) {
      // Rollback on failure
      setUsers(prev => prev.map(u => u.id === targetUser.id ? { ...u, permissions: targetUser.permissions } : u));
      toast.error('Failed to update permission: ' + (err.message || 'unknown error'));
    } finally {
      setSavingPermsUserId(null);
    }
  };

  if (loading) {
    return <div className="flex items-center justify-center p-8">Loading...</div>;
  }

  return (
    <div className="space-y-6">
      {loadError && (
        <Card className="border-amber-200 bg-amber-50/70">
          <CardContent className="py-4">
            <div className="flex items-start gap-3">
              <Info className="h-5 w-5 text-amber-700 shrink-0 mt-0.5" />
              <div className="flex-1">
                <p className="font-semibold text-amber-900 text-sm">Permissions screen warning</p>
                <p className="text-sm text-amber-800">{loadError}</p>
              </div>
              <Button size="sm" variant="outline" onClick={() => window.location.reload()}>
                Reload
              </Button>
            </div>
          </CardContent>
        </Card>
      )}

      {/* Staff Login Guidance */}
      <Card className="border-blue-200 bg-blue-50/60">
        <CardContent className="py-4">
          <div className="flex items-start gap-3">
            <div className="p-2 rounded-full bg-blue-100 shrink-0">
              <Info className="h-5 w-5 text-blue-700" />
            </div>
            <div className="flex-1 min-w-0">
              <p className="font-semibold text-blue-900 text-sm">Staff Login URLs — share with new users</p>
              <p className="text-xs text-blue-800/80 mb-2">
                Send these to team members along with their email and a temporary password (use "Set Password" below to assign one).
              </p>
              <div className="grid grid-cols-1 md:grid-cols-2 gap-2">
                <div className="flex items-center gap-2 bg-white border border-blue-200 rounded px-3 py-2">
                  <Shield className="h-4 w-4 text-blue-700 shrink-0" />
                  <div className="flex-1 min-w-0">
                    <p className="text-[11px] uppercase tracking-wide text-muted-foreground">Admin / Management</p>
                    <code className="text-xs font-mono break-all">https://buyawarranty.co.uk/auth</code>
                  </div>
                  <Button size="sm" variant="ghost" className="h-7 w-7 p-0" onClick={() => copyToClipboard('https://buyawarranty.co.uk/auth', 'login-url-auth')} title="Copy">
                    {copiedField === 'login-url-auth' ? <Check className="h-3.5 w-3.5 text-green-600" /> : <Copy className="h-3.5 w-3.5" />}
                  </Button>
                  <a href="https://buyawarranty.co.uk/auth" target="_blank" rel="noopener noreferrer" className="text-blue-700 hover:text-blue-900" title="Open">
                    <ExternalLink className="h-3.5 w-3.5" />
                  </a>
                </div>
                <div className="flex items-center gap-2 bg-white border border-blue-200 rounded px-3 py-2">
                  <Users className="h-4 w-4 text-blue-700 shrink-0" />
                  <div className="flex-1 min-w-0">
                    <p className="text-[11px] uppercase tracking-wide text-muted-foreground">Sales Agents</p>
                    <code className="text-xs font-mono break-all">https://buyawarranty.co.uk/sales-login</code>
                  </div>
                  <Button size="sm" variant="ghost" className="h-7 w-7 p-0" onClick={() => copyToClipboard('https://buyawarranty.co.uk/sales-login', 'login-url-sales')} title="Copy">
                    {copiedField === 'login-url-sales' ? <Check className="h-3.5 w-3.5 text-green-600" /> : <Copy className="h-3.5 w-3.5" />}
                  </Button>
                  <a href="https://buyawarranty.co.uk/sales-login" target="_blank" rel="noopener noreferrer" className="text-blue-700 hover:text-blue-900" title="Open">
                    <ExternalLink className="h-3.5 w-3.5" />
                  </a>
                </div>
              </div>
              <p className="text-[11px] text-blue-800/70 mt-2">
                Passwords are stored as one-way hashes by Supabase and cannot be displayed. Use <strong>Set Password</strong> to assign a known password, or <strong>Sign in as</strong> to verify a user's access without changing anything.
              </p>
            </div>
          </div>
        </CardContent>
      </Card>

      {/* Logged-in Admin Banner */}
      <Card className="bg-primary/5 border-primary/20">
        <CardContent className="py-4">
          <div className="flex items-center gap-3">
            <div className="p-2 rounded-full bg-primary/10">
              <ShieldCheck className="h-5 w-5 text-primary" />
            </div>
            <div>
              <p className="text-sm text-muted-foreground">Logged in as</p>
              <p className="font-semibold text-foreground">
                {currentAdminUser 
                  ? `${currentAdminUser.first_name || ''} ${currentAdminUser.last_name || ''}`.trim() || currentAdminUser.email
                  : user?.email || 'Unknown'}
              </p>
              <p className="text-xs text-muted-foreground">
                {currentAdminUser?.email || user?.email} • <Badge variant="destructive" className="text-xs py-0 px-1.5">{currentAdminUser?.role === 'super_admin' ? 'Super Administrator' : currentAdminUser?.role === 'admin' ? 'Administrator' : currentAdminUser?.role || 'admin'}</Badge>
              </p>
            </div>
          </div>
        </CardContent>
      </Card>

      
      {/* Access Requests Panel */}
      <AccessRequestsPanel />

      <div className="flex justify-between items-center">
        <div>
          <h2 className="text-2xl font-bold text-foreground">User Permissions</h2>
          <p className="text-muted-foreground">Manage admin dashboard access and permissions</p>
        </div>
        
        {/* Invite User Dialog */}
        <Dialog open={showInviteDialog} onOpenChange={setShowInviteDialog}>
          <DialogTrigger asChild>
            <Button>
              <UserPlus className="h-4 w-4 mr-2" />
              Invite User
            </Button>
          </DialogTrigger>
          <DialogContent className="max-w-2xl max-h-[85vh] overflow-y-auto">
            <DialogHeader>
              <DialogTitle>Invite New User</DialogTitle>
            </DialogHeader>
            <div className="space-y-4 pr-2">
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <Label htmlFor="firstName">First Name</Label>
                  <Input
                    id="firstName"
                    value={inviteData.firstName}
                    onChange={(e) => setInviteData(prev => ({ ...prev, firstName: e.target.value }))}
                  />
                </div>
                <div>
                  <Label htmlFor="lastName">Last Name</Label>
                  <Input
                    id="lastName"
                    value={inviteData.lastName}
                    onChange={(e) => setInviteData(prev => ({ ...prev, lastName: e.target.value }))}
                  />
                </div>
              </div>
              
              <div>
                <Label htmlFor="email">Email (Login Username)</Label>
                <Input
                  id="email"
                  type="email"
                  value={inviteData.email}
                  onChange={(e) => setInviteData(prev => ({ ...prev, email: e.target.value }))}
                  placeholder="user@example.com"
                />
                <p className="text-xs text-muted-foreground mt-1">This email will be used as the login username</p>
              </div>
              
              <div>
                <Label htmlFor="password">Initial Password</Label>
                <Input
                  id="password"
                  type="text"
                  value={inviteData.password}
                  onChange={(e) => setInviteData(prev => ({ ...prev, password: e.target.value }))}
                  placeholder="Leave empty to auto-generate"
                />
                <p className="text-xs text-muted-foreground mt-1">
                  Set a custom password or leave empty to auto-generate a secure one
                </p>
              </div>

              <div>
                <Label htmlFor="role">Role</Label>
                <Select 
                  value={inviteData.role} 
                  onValueChange={(value: any) => {
                    const defaults = ROLE_DEFAULT_PERMISSIONS[value] || {};
                    // Clear all tab permissions first, then apply role defaults
                    const clearedPerms = Object.keys(inviteData.permissions).reduce((acc, key) => {
                      if (key.startsWith('tab_')) return acc;
                      acc[key] = inviteData.permissions[key];
                      return acc;
                    }, {} as Record<string, boolean>);
                    setInviteData(prev => ({ ...prev, role: value, permissions: { ...clearedPerms, ...defaults } }));
                  }}
                >
                  <SelectTrigger>
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="super_admin">Super Administrator - Full unrestricted access</SelectItem>
                    <SelectItem value="admin">Administrator - Full access (can be restricted by Super Admin)</SelectItem>
                    <SelectItem value="member">Member - Custom tab access</SelectItem>
                    <SelectItem value="viewer">Viewer - Read-only access</SelectItem>
                    <SelectItem value="guest">Guest - Minimal access</SelectItem>
                    <SelectItem value="blog_writer">Blog Writer - Blog & Landing Pages only</SelectItem>
                    <SelectItem value="sales">Sales - Sales team tabs only</SelectItem>
                    <SelectItem value="sales_lead">Sales Lead - Team management & lead assignment</SelectItem>
                    <SelectItem value="performance_manager">Performance Manager - Sales Lead access plus lead routing & distribution</SelectItem>
                    <SelectItem value="lead_gen">Lead Gen - Marketing analytics only (Google/Facebook Ads)</SelectItem>
                    <SelectItem value="dev_tester">Dev/Tester - Full access, no destructive actions</SelectItem>
                    <SelectItem value="accounts">Accounts - Leads, customers, claims, discount codes & timesheets</SelectItem>
                    <SelectItem value="accounts_manager">Accounts Manager - Full New Leads access (like Super Admin) + accounts tools</SelectItem>
                    <SelectItem value="claims_agent">Claims Agent - Same access as Admin (filtered) with full Claims access</SelectItem>
                    <SelectItem value="claims_manager">Claims Manager - Claims tab only (incl. Vehicle Intelligence)</SelectItem>
                  </SelectContent>
                </Select>
                <p className="text-xs text-muted-foreground mt-1">
                  {(inviteData.role === 'admin' || inviteData.role === 'super_admin') && 'Full access to all tabs (Super Admin can restrict Administrator access)'}
                  {!['admin', 'super_admin'].includes(inviteData.role) && 'Select which tabs this user can access below'}
                </p>
              </div>

              <div>
                <Label htmlFor="inviteTeam">Lead Team Colour</Label>
                <Select
                  value={inviteData.teamId ?? '__none__'}
                  onValueChange={(value) =>
                    setInviteData(prev => ({ ...prev, teamId: value === '__none__' ? null : value }))
                  }
                >
                  <SelectTrigger id="inviteTeam">
                    <SelectValue placeholder="No team (assign later)" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="__none__">No team (assign later)</SelectItem>
                    {['admin', 'super_admin', 'performance_manager', 'sales_manager'].includes(inviteData.role) && (
                      <SelectItem value="__all__">All Teams</SelectItem>
                    )}
                    {teams.map(t => (
                      <SelectItem key={t.id} value={t.id}>
                        {t.emoji ? `${t.emoji} ` : ''}{t.name}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
                <p className="text-xs text-muted-foreground mt-1">
                  Optional. Sets the lead team this agent will appear in (e.g. Red, Blue, Green). You can change this any time from Lead Allocation.
                </p>
              </div>


              {/* Show tab permissions for all non-admin roles */}
              {!['super_admin', 'admin', 'dev_tester'].includes(inviteData.role) && (
                renderTabPermissionsSection(inviteData.permissions, false)
              )}

              {/* Legacy permissions section */}
              {!['super_admin', 'admin', 'dev_tester'].includes(inviteData.role) && Object.keys(groupedPermissions).length > 0 && (
                <div className="space-y-4">
                  <Label className="text-base font-semibold">Additional Permissions</Label>
                  {Object.entries(groupedPermissions).map(([category, categoryPermissions]) => (
                    <Card key={category} className="p-4">
                      <h4 className="font-medium capitalize mb-3">{category}</h4>
                      <div className="space-y-2">
                        {categoryPermissions.map((permission) => (
                          <div key={permission.permission_key} className="flex items-center space-x-2">
                            <Checkbox
                              id={permission.permission_key}
                              checked={inviteData.permissions[permission.permission_key] || false}
                              onCheckedChange={(checked) => {
                                setInviteData(prev => ({
                                  ...prev,
                                  permissions: {
                                    ...prev.permissions,
                                    [permission.permission_key]: checked as boolean
                                  }
                                }));
                              }}
                            />
                            <div>
                              <Label htmlFor={permission.permission_key} className="text-sm font-medium">
                                {permission.permission_name}
                              </Label>
                              <p className="text-xs text-muted-foreground">{permission.description}</p>
                            </div>
                          </div>
                        ))}
                      </div>
                    </Card>
                  ))}
                </div>
              )}

              <div className="flex justify-end gap-2 pt-4">
                <Button variant="outline" onClick={() => setShowInviteDialog(false)}>
                  Cancel
                </Button>
                <Button onClick={handleInviteUser}>
                  Send Invitation
                </Button>
              </div>
            </div>
          </DialogContent>
        </Dialog>
      </div>

      {/* Set Password Dialog */}
      <Dialog open={showPasswordDialog} onOpenChange={setShowPasswordDialog}>
        <DialogContent className="max-w-md">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <Key className="h-5 w-5" />
              Set Password & Send Login Details
            </DialogTitle>
          </DialogHeader>
          {passwordUser && (() => {
            const fullBlock = `Step 1 — Gateway\nLink: ${loginUrlForRole(passwordUser.role)}\nPassword: SmashSales2026!!\n\nStep 2 — ${passwordUser.first_name || ''} ${passwordUser.last_name || ''}'s login\nUsername: ${passwordUser.email}\nPassword: ${newPassword || '(set a password first)'}`;
            return (
            <div className="space-y-4">
              {/* One-click copy-all */}
              <Button
                type="button"
                variant="outline"
                className="w-full justify-center border-blue-300 bg-blue-50 hover:bg-blue-100 text-blue-900"
                onClick={() => copyToClipboard(fullBlock, 'all')}
                disabled={!newPassword}
              >
                {copiedField === 'all' ? <Check className="h-4 w-4 mr-2 text-green-600" /> : <Copy className="h-4 w-4 mr-2" />}
                {copiedField === 'all' ? 'Copied all login details' : 'Copy all login details'}
              </Button>

              {/* Step 1: Gateway */}
              <div className="rounded-lg border border-blue-200 bg-blue-50 p-3 space-y-2">
                <div className="text-xs font-semibold text-blue-900 uppercase tracking-wide">Step 1 — Gateway</div>
                <div className="space-y-1.5">
                  <div className="flex items-center justify-between gap-2">
                    <span className="text-xs text-muted-foreground shrink-0">Link</span>
                    <div className="flex items-center gap-1 min-w-0">
                      <code className="font-mono text-xs truncate">{loginUrlForRole(passwordUser.role)}</code>
                      <Button size="sm" variant="ghost" className="h-6 w-6 p-0 shrink-0"
                        onClick={() => copyToClipboard(loginUrlForRole(passwordUser.role), 'url')}>
                        {copiedField === 'url' ? <Check className="h-3 w-3 text-green-500" /> : <Copy className="h-3 w-3" />}
                      </Button>
                    </div>
                  </div>
                  <div className="flex items-center justify-between gap-2">
                    <span className="text-xs text-muted-foreground shrink-0">Password</span>
                    <div className="flex items-center gap-1">
                      <code className="font-mono text-xs">SmashSales2026!!</code>
                      <Button size="sm" variant="ghost" className="h-6 w-6 p-0 shrink-0"
                        onClick={() => copyToClipboard('SmashSales2026!!', 'gw')}>
                        {copiedField === 'gw' ? <Check className="h-3 w-3 text-green-500" /> : <Copy className="h-3 w-3" />}
                      </Button>
                    </div>
                  </div>
                </div>
              </div>

              {/* Step 2: User credentials */}
              <div className="rounded-lg border border-slate-200 bg-slate-50 p-3 space-y-2">
                <div className="text-xs font-semibold text-slate-700 uppercase tracking-wide">
                  Step 2 — {passwordUser.first_name} {passwordUser.last_name}'s login
                </div>
                <div className="flex items-center justify-between gap-2">
                  <span className="text-xs text-muted-foreground shrink-0">Username</span>
                  <div className="flex items-center gap-1 min-w-0">
                    <code className="font-mono text-xs truncate">{passwordUser.email}</code>
                    <Button size="sm" variant="ghost" className="h-6 w-6 p-0 shrink-0"
                      onClick={() => copyToClipboard(passwordUser.email, 'email')}>
                      {copiedField === 'email' ? <Check className="h-3 w-3 text-green-500" /> : <Copy className="h-3 w-3" />}
                    </Button>
                  </div>
                </div>
                <div className="space-y-1">
                  <Label htmlFor="newPassword" className="text-xs text-muted-foreground">Password</Label>
                  <div className="flex gap-1.5">
                    <Input
                      id="newPassword"
                      type="text"
                      value={newPassword}
                      onChange={(e) => setNewPassword(e.target.value)}
                      placeholder="Enter new password"
                      className="font-mono text-sm h-9"
                    />
                    <Button type="button" variant="outline" size="sm" onClick={generateRandomPassword}>
                      New
                    </Button>
                    <Button type="button" variant="outline" size="icon" className="h-9 w-9 shrink-0"
                      onClick={() => copyToClipboard(newPassword, 'password')}
                      disabled={!newPassword} title="Copy password">
                      {copiedField === 'password' ? <Check className="h-4 w-4 text-green-500" /> : <Copy className="h-4 w-4" />}
                    </Button>
                  </div>
                  <p className="text-[11px] text-muted-foreground">Min 6 chars. This is the value emailed to the user.</p>
                </div>
              </div>

              <div className="flex flex-wrap items-center justify-end gap-2 pt-4 border-t">
                <Button variant="outline" onClick={() => setShowPasswordDialog(false)}>
                  Close
                </Button>
                <Button variant="outline" onClick={handleTestLogin} disabled={!newPassword}>
                  Copy & open login page
                </Button>
                <Button variant="outline" onClick={handleSetPassword}
                  disabled={settingPassword || !newPassword}>
                  {settingPassword ? 'Saving…' : 'Save password'}
                </Button>
                <Button onClick={handleSendCredentials}
                  disabled={sendingCreds || !newPassword}
                  className="bg-emerald-600 hover:bg-emerald-700 text-white">
                  {sendingCreds ? 'Sending…' : 'Save & email login'}
                </Button>
              </div>

              {/* Safe View as User — mirrors the customer dashboard Safe View panel */}
              {currentAdminUser?.role === 'super_admin' && passwordUser.id !== currentAdminUser?.id && (
                <div className="mt-2 rounded-lg border border-blue-200 bg-blue-50 p-4">
                  <div className="flex items-center gap-2 text-blue-900 font-semibold mb-1">
                    <Eye className="h-4 w-4" />
                    Safe View as User
                  </div>
                  <p className="text-xs text-blue-800 mb-3">
                    Open this staff member's dashboard in a new tab to verify their login actually works. Your admin session stays active — no need to log out.
                  </p>
                  <Button
                    onClick={() => handleSignInAs(passwordUser)}
                    disabled={signingInAsId === passwordUser.id}
                    className="bg-orange-500 hover:bg-orange-600 text-white"
                  >
                    <Eye className="h-4 w-4 mr-2" />
                    {signingInAsId === passwordUser.id ? 'Opening…' : 'View as User'}
                  </Button>
                </div>
              )}
            </div>
            );
          })()}
        </DialogContent>
      </Dialog>


      {/* Revealed Credentials Dialog */}
      <Dialog open={!!revealedCreds} onOpenChange={(o) => !o && setRevealedCreds(null)}>
        <DialogContent className="max-w-md">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2"><Key className="h-5 w-5 text-purple-600" /> New Login Credentials</DialogTitle>
          </DialogHeader>
          {revealedCreds && (
            <div className="space-y-4">
              <div className="p-3 bg-amber-50 border border-amber-200 rounded text-xs text-amber-800">
                Save or send these now — passwords are hashed and cannot be retrieved later.
              </div>
              <div>
                <Label className="text-xs text-muted-foreground">Login URL</Label>
                <div className="flex items-center gap-2 mt-1">
                  <code className="flex-1 bg-muted px-2 py-2 rounded text-xs break-all">{revealedCreds.loginUrl}</code>
                  <Button size="sm" variant="ghost" onClick={() => copyToClipboard(revealedCreds.loginUrl, 'rev-url')}>
                    {copiedField === 'rev-url' ? <Check className="h-3 w-3 text-green-500" /> : <Copy className="h-3 w-3" />}
                  </Button>
                </div>
              </div>
              <div>
                <Label className="text-xs text-muted-foreground">Email</Label>
                <div className="flex items-center gap-2 mt-1">
                  <code className="flex-1 bg-muted px-2 py-2 rounded text-xs font-mono break-all">{revealedCreds.email}</code>
                  <Button size="sm" variant="ghost" onClick={() => copyToClipboard(revealedCreds.email, 'rev-email')}>
                    {copiedField === 'rev-email' ? <Check className="h-3 w-3 text-green-500" /> : <Copy className="h-3 w-3" />}
                  </Button>
                </div>
              </div>
              <div>
                <Label className="text-xs text-muted-foreground">Password</Label>
                <div className="flex items-center gap-2 mt-1">
                  <code className="flex-1 bg-muted px-2 py-2 rounded text-sm font-mono font-bold break-all">{revealedCreds.password}</code>
                  <Button size="sm" variant="ghost" onClick={() => copyToClipboard(revealedCreds.password, 'rev-pw')}>
                    {copiedField === 'rev-pw' ? <Check className="h-3 w-3 text-green-500" /> : <Copy className="h-3 w-3" />}
                  </Button>
                </div>
              </div>
              <Button
                className="w-full"
                onClick={() => copyToClipboard(
                  `Login URL: ${revealedCreds.loginUrl}\nEmail: ${revealedCreds.email}\nPassword: ${revealedCreds.password}`,
                  'rev-all'
                )}
              >
                {copiedField === 'rev-all' ? <><Check className="h-4 w-4 mr-2" /> Copied all</> : <><Copy className="h-4 w-4 mr-2" /> Copy all credentials</>}
              </Button>
            </div>
          )}
        </DialogContent>
      </Dialog>

      {/* Sign-in Link Dialog */}
      <Dialog open={!!signInLink} onOpenChange={(o) => !o && setSignInLink(null)}>
        <DialogContent className="max-w-lg">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2"><LogIn className="h-5 w-5 text-emerald-600" /> One-time Sign-in Link</DialogTitle>
          </DialogHeader>
          {signInLink && (
            <div className="space-y-4">
              <p className="text-sm text-muted-foreground">
                Signing in as <strong>{signInLink.email}</strong>. We tried to open a new tab — if it was blocked, click below or copy the link.
              </p>
              <div className="flex items-center gap-2">
                <code className="flex-1 bg-muted px-2 py-2 rounded text-xs break-all">{signInLink.link}</code>
                <Button size="sm" variant="ghost" onClick={() => copyToClipboard(signInLink.link, 'signin-link')}>
                  {copiedField === 'signin-link' ? <Check className="h-3 w-3 text-green-500" /> : <Copy className="h-3 w-3" />}
                </Button>
              </div>
              <Button className="w-full" onClick={() => window.open(signInLink.link, '_blank', 'noopener,noreferrer')}>
                <ExternalLink className="h-4 w-4 mr-2" /> Open sign-in link
              </Button>
            </div>
          )}
        </DialogContent>
      </Dialog>


      {/* Edit Permissions Dialog */}
      <Dialog open={showEditDialog} onOpenChange={setShowEditDialog}>
        <DialogContent className="max-w-2xl max-h-[85vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle>Edit User Permissions</DialogTitle>
          </DialogHeader>
          {editingUser && (
            <div className="space-y-4 pr-2">
              <div className="p-4 bg-muted rounded-lg">
                <div className="font-medium">{editingUser.first_name} {editingUser.last_name}</div>
                <div className="text-sm text-muted-foreground">{editingUser.email}</div>
              </div>

              <div>
                <Label htmlFor="editRole">Role</Label>
                <Select 
                  value={editingUser.role} 
                  onValueChange={(value: any) => {
                    const defaults = ROLE_DEFAULT_PERMISSIONS[value] || {};
                    setEditingUser(prev => {
                      if (!prev) return null;
                      // Clear all tab permissions first, then apply role defaults
                      const clearedPerms = Object.keys(prev.permissions).reduce((acc, key) => {
                        if (key.startsWith('tab_')) return acc;
                        acc[key] = prev.permissions[key];
                        return acc;
                      }, {} as Record<string, boolean>);
                      return { ...prev, role: value, permissions: { ...clearedPerms, ...defaults } };
                    });
                  }}
                >
                  <SelectTrigger>
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="admin">Admin - Full access to all tabs</SelectItem>
                    <SelectItem value="member">Member - Custom tab access</SelectItem>
                    <SelectItem value="viewer">Viewer - Read-only access</SelectItem>
                    <SelectItem value="guest">Guest - Minimal access</SelectItem>
                    <SelectItem value="blog_writer">Blog Writer - Blog & Landing Pages only</SelectItem>
                    <SelectItem value="sales">Sales - Sales team tabs only</SelectItem>
                    <SelectItem value="sales_lead">Sales Lead - Team management & lead assignment</SelectItem>
                    <SelectItem value="performance_manager">Performance Manager - Sales Lead access plus lead routing & distribution</SelectItem>
                    <SelectItem value="lead_gen">Lead Gen - Marketing analytics only (Google/Facebook Ads)</SelectItem>
                    <SelectItem value="dev_tester">Dev/Tester - Full access, no destructive actions</SelectItem>
                    <SelectItem value="accounts">Accounts - Leads, customers, claims, discount codes & timesheets</SelectItem>
                    <SelectItem value="accounts_manager">Accounts Manager - Full New Leads access (like Super Admin) + accounts tools</SelectItem>
                    <SelectItem value="claims_agent">Claims Agent - Same access as Admin (filtered) with full Claims access</SelectItem>
                    <SelectItem value="claims_manager">Claims Manager - Claims tab only (incl. Vehicle Intelligence)</SelectItem>
                  </SelectContent>
                </Select>
              </div>

              <div>
                <Label htmlFor="editTeam">Lead Team Colour</Label>
                <Select
                  value={editingTeamId ?? '__none__'}
                  onValueChange={(value) => setEditingTeamId(value === '__none__' ? null : value)}
                >
                  <SelectTrigger id="editTeam">
                    <SelectValue placeholder="No team" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="__none__">No team</SelectItem>
                    {editingUser && ['admin', 'super_admin', 'performance_manager', 'sales_manager'].includes(editingUser.role) && (
                      <SelectItem value="__all__">All Teams</SelectItem>
                    )}
                    {teams.map(t => (
                      <SelectItem key={t.id} value={t.id}>
                        {t.emoji ? `${t.emoji} ` : ''}{t.name}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
                <p className="text-xs text-muted-foreground mt-1">
                  Changes apply immediately on save and move the agent into the chosen team's lead queue.
                </p>
              </div>

              <div>
                <Label htmlFor="editSipExt">Dial 9 / SIP Extension</Label>
                <Input
                  id="editSipExt"
                  type="text"
                  inputMode="numeric"
                  placeholder="e.g. 202"
                  value={editingUser.sip_extension ?? ''}
                  onChange={(e) => setEditingUser(prev => prev ? { ...prev, sip_extension: e.target.value } : prev)}
                />
                <p className="text-xs text-muted-foreground mt-1">
                  Matches this agent to their Dial 9 extension so call logs, call counts and Speed-to-Dial attribute to them.
                </p>
              </div>

              {/* Show tab permissions tickboxes for all editable roles (including Admin so super admins can restrict access) */}
              {editingUser.role !== 'super_admin' && editingUser.role !== 'dev_tester' && (
                <>
                  {editingUser.role === 'admin' && (
                    <p className="text-xs text-muted-foreground -mb-2">
                      Administrators have access to all tabs by default. Untick to revoke access to specific tabs.
                    </p>
                  )}
                  {renderTabPermissionsSection(editingUser.permissions, true, editingUser.role)}
                </>
              )}

              <div className="flex justify-end gap-2 pt-4">
                <Button variant="outline" onClick={() => setShowEditDialog(false)}>
                  Cancel
                </Button>
                <Button onClick={handleUpdatePermissions}>
                  Save Changes
                </Button>
              </div>
            </div>
          )}
        </DialogContent>
      </Dialog>

      {/* Bulk Access Management */}
      <Card className="border-primary/20">
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Users className="h-5 w-5" />
            Bulk Access Management
          </CardTitle>
          <p className="text-sm text-muted-foreground">
            Grant or revoke access to one or more dashboard sections for multiple users at once.
            Tick users in the Admin Users table below, pick the sections here, then apply.
          </p>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="space-y-3">
            <div className="flex flex-wrap items-center gap-3">
              <div className="text-sm">
                <span className="font-semibold">{selectedUsers.size}</span> user{selectedUsers.size === 1 ? '' : 's'} selected
              </div>
              <div className="text-sm">
                <span className="font-semibold">{bulkTabs.size}</span> section{bulkTabs.size === 1 ? '' : 's'} selected
              </div>
              <div className="ml-auto flex items-center gap-2">
                <Select value={bulkMode} onValueChange={(v: any) => setBulkMode(v)}>
                  <SelectTrigger className="w-[140px]">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="grant">Grant access</SelectItem>
                    <SelectItem value="revoke">Revoke access</SelectItem>
                  </SelectContent>
                </Select>
                <Button
                  variant="outline"
                  size="sm"
                  onClick={() => setBulkTabs(new Set(ADMIN_TABS.map(t => t.id)))}
                >
                  Select all sections
                </Button>
                <Button
                  variant="outline"
                  size="sm"
                  onClick={() => setBulkTabs(new Set())}
                >
                  Clear sections
                </Button>
                <Button
                  onClick={handleBulkApply}
                  disabled={bulkApplying || selectedUsers.size === 0 || bulkTabs.size === 0}
                  variant={bulkMode === 'revoke' ? 'destructive' : 'default'}
                >
                  {bulkApplying ? 'Applying…' : bulkMode === 'grant' ? 'Grant to selected users' : 'Revoke from selected users'}
                </Button>
              </div>
            </div>

            <div className="flex flex-wrap items-center gap-2">
              <Popover open={userPickerOpen} onOpenChange={setUserPickerOpen}>
                <PopoverTrigger asChild>
                  <Button variant="outline" size="sm">
                    <Users className="h-4 w-4 mr-1" />
                    Select users…
                  </Button>
                </PopoverTrigger>
                <PopoverContent className="w-[320px] p-0" align="start">
                  <Command>
                    <CommandInput placeholder="Search users…" />
                    <CommandList>
                      <CommandEmpty>No users found.</CommandEmpty>
                      <CommandGroup>
                        {users.map((u) => (
                          <CommandItem
                            key={u.id}
                            value={`${u.first_name} ${u.last_name} ${u.email} ${u.role}`}
                            onSelect={() => toggleUserSelection(u.id)}
                            className="flex items-center gap-2 cursor-pointer"
                          >
                            <Checkbox checked={selectedUsers.has(u.id)} className="pointer-events-none" />
                            <span className="flex-1 text-sm">{u.first_name} {u.last_name}</span>
                            <Badge variant="outline" className="text-xs">{u.role}</Badge>
                          </CommandItem>
                        ))}
                      </CommandGroup>
                    </CommandList>
                  </Command>
                </PopoverContent>
              </Popover>

              {selectedUsers.size > 0 && (
                <div className="flex flex-wrap items-center gap-1.5">
                  {[...selectedUsers].map(id => {
                    const u = users.find(x => x.id === id);
                    if (!u) return null;
                    return (
                      <Badge key={id} variant="secondary" className="flex items-center gap-1 pl-2 pr-1">
                        {u.first_name} {u.last_name}
                        <button
                          type="button"
                          onClick={() => toggleUserSelection(id)}
                          className="rounded-full hover:bg-muted p-0.5"
                          aria-label={`Remove ${u.first_name} ${u.last_name}`}
                        >
                          <X className="h-3 w-3" />
                        </button>
                      </Badge>
                    );
                  })}
                  <Button variant="ghost" size="sm" onClick={() => setSelectedUsers(new Set())}>Clear</Button>
                </div>
              )}
            </div>
          </div>

          <Input
            placeholder="Filter sections…"
            value={bulkTabFilter}
            onChange={(e) => setBulkTabFilter(e.target.value)}
            className="max-w-sm"
          />

          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-2 max-h-[320px] overflow-y-auto border rounded-lg p-3">
            {[...ADMIN_TABS]
              .sort((a, b) => a.label.localeCompare(b.label))
              .filter(t =>
                !bulkTabFilter ||
                t.label.toLowerCase().includes(bulkTabFilter.toLowerCase()) ||
                t.id.toLowerCase().includes(bulkTabFilter.toLowerCase())
              )
              .map(tab => {
                const checked = bulkTabs.has(tab.id);
                return (
                  <div
                    key={tab.id}
                    className={`flex items-start gap-2 p-2 rounded border transition-colors ${
                      checked ? 'bg-primary/5 border-primary/30' : 'bg-background hover:bg-muted/50'
                    }`}
                  >
                    <Checkbox
                      id={`bulk-tab-${tab.id}`}
                      checked={checked}
                      onCheckedChange={(v) => {
                        setBulkTabs(prev => {
                          const next = new Set(prev);
                          if (v) next.add(tab.id); else next.delete(tab.id);
                          return next;
                        });
                      }}
                      className="mt-0.5"
                    />
                    <Label htmlFor={`bulk-tab-${tab.id}`} className="text-sm cursor-pointer leading-tight">
                      {tab.label}
                    </Label>
                  </div>
                );
              })}
          </div>
          <p className="text-xs text-muted-foreground">
            Tip: new sections added to the dashboard are automatically added to every user's permissions using their role's default access.
          </p>
        </CardContent>
      </Card>

      <Card>

        <CardHeader>
          <CardTitle>Admin Users</CardTitle>
        </CardHeader>
        <CardContent>
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead className="w-10">
                  <Checkbox
                    checked={selectedUsers.size === users.length && users.length > 0}
                    onCheckedChange={(checked) => {
                      if (checked === true) {
                        setSelectedUsers(new Set(users.map(u => u.id)));
                      } else {
                        setSelectedUsers(new Set());
                      }
                    }}
                    aria-label="Select all users"
                  />
                </TableHead>
                <TableHead>User</TableHead>
                <TableHead>Login Email</TableHead>
                <TableHead>Role</TableHead>
                <TableHead>Tab Access</TableHead>
                <TableHead>Status</TableHead>
                <TableHead>Last Login</TableHead>
                <TableHead>Actions</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {users.map((user) => {
                const isExpanded = expandedPermsUserId === user.id;
                const canExpand = currentAdminUser?.role === 'super_admin' || currentAdminUser?.role === 'admin';
                return (
                <React.Fragment key={user.id}>
                <TableRow
                  data-state={selectedUsers.has(user.id) ? 'selected' : undefined}
                  className="cursor-pointer"
                  onClick={(e) => {
                    const target = e.target as Element;
                    if (target.closest('button, a, input, textarea, select, [role=checkbox]')) return;
                    toggleUserSelection(user.id);
                  }}
                >
                  <TableCell>
                    <Checkbox
                      id={`select-user-${user.id}`}
                      checked={selectedUsers.has(user.id)}
                      onCheckedChange={(checked) => {
                        if (checked === true) {
                          setSelectedUsers(prev => {
                            const next = new Set(prev);
                            next.add(user.id);
                            return next;
                          });
                        } else {
                          setSelectedUsers(prev => {
                            const next = new Set(prev);
                            next.delete(user.id);
                            return next;
                          });
                        }
                      }}
                      aria-label={`Select ${user.first_name} ${user.last_name}`}
                    />
                  </TableCell>
                  <TableCell>
                    <div className="font-medium">
                      {user.first_name} {user.last_name}
                    </div>
                  </TableCell>
                  <TableCell>
                    <div className="flex items-center gap-2">
                      <code className="text-xs bg-muted px-2 py-1 rounded font-mono">
                        {user.email}
                      </code>
                      <Button 
                        size="sm" 
                        variant="ghost" 
                        className="h-6 w-6 p-0"
                        onClick={() => copyToClipboard(user.email, `email-${user.id}`)}
                        title="Copy email"
                      >
                        {copiedField === `email-${user.id}` ? <Check className="h-3 w-3 text-green-500" /> : <Copy className="h-3 w-3" />}
                      </Button>
                    </div>
                  </TableCell>
                  <TableCell>
                    <Badge variant={getRoleBadgeVariant(user.role)} className={`flex items-center gap-1 w-fit ${getRoleBadgeClassName(user.role)}`}>
                      {getRoleIcon(user.role)}
                      {user.role === 'super_admin' ? 'Super Administrator' : user.role === 'dev_tester' ? 'Dev/Tester' : user.role === 'admin' ? 'Administrator' : user.role === 'claims_agent' ? 'Claims Agent' : user.role === 'claims_manager' ? 'Claims Manager' : user.role}
                    </Badge>
                  </TableCell>
                  <TableCell>
                    {canExpand ? (
                      <button
                        type="button"
                        onClick={() => setExpandedPermsUserId(isExpanded ? null : user.id)}
                        className="inline-flex items-center gap-1 hover:opacity-80 transition-opacity"
                        title={isExpanded ? 'Hide permission tickboxes' : 'Show & edit permission tickboxes'}
                      >
                        {isExpanded ? <ChevronDown className="h-3.5 w-3.5 text-muted-foreground" /> : <ChevronRight className="h-3.5 w-3.5 text-muted-foreground" />}
                        {(user.role === 'super_admin' || user.role === 'admin' || user.role === 'dev_tester') ? (
                          <Badge variant="outline" className="bg-green-50 text-green-700 border-green-200 cursor-pointer">
                            {user.role === 'admin' ? 'Filtered' : 'All Tabs'}
                          </Badge>
                        ) : user.role === 'blog_writer' ? (
                          <Badge variant="outline" className="cursor-pointer">2 tabs</Badge>
                        ) : (
                          <Badge variant="outline" className="cursor-pointer">
                            {countActiveTabPermissions(user.permissions || {})} tabs
                          </Badge>
                        )}
                      </button>
                    ) : (
                      (user.role === 'super_admin' || user.role === 'admin' || user.role === 'dev_tester') ? (
                        <Badge variant="outline" className="bg-green-50 text-green-700 border-green-200">
                          {user.role === 'admin' ? 'Filtered' : 'All Tabs'}
                        </Badge>
                      ) : user.role === 'blog_writer' ? (
                        <Badge variant="outline">2 tabs</Badge>
                      ) : (
                        <Badge variant="outline">
                          {countActiveTabPermissions(user.permissions || {})} tabs
                        </Badge>
                      )
                    )}
                  </TableCell>
                  <TableCell>
                    <Badge variant={user.is_active ? 'default' : 'secondary'}>
                      {user.is_active ? 'Active' : 'Inactive'}
                    </Badge>
                  </TableCell>
                  <TableCell>{user.last_login ? new Date(user.last_login).toLocaleDateString() : 'Never'}</TableCell>
                  <TableCell>
                    <div className="flex gap-2">
                      <Button
                        size="sm"
                        variant="default"
                        onClick={() => openEditDialog(user)}
                        title="Edit Permissions & Tab Access"
                        className="bg-primary hover:bg-primary/90"
                      >
                        <Pencil className="h-4 w-4 mr-1" />
                        Edit
                      </Button>
                      {currentAdminUser?.role !== 'dev_tester' && !(currentAdminUser?.role === 'admin' && (user.role === 'super_admin' || user.role === 'admin')) && (
                      <Button
                        size="sm"
                        variant={user.is_active ? "outline" : "default"}
                        onClick={() => toggleUserStatus(user.id, user.is_active)}
                        title={user.is_active
                          ? 'Temporarily block login (reversible — different from Delete). Preserves account, permissions and history.'
                          : 'Reactivate this user so they can log in again with their existing permissions.'}
                        className={user.is_active
                          ? 'border-amber-500 text-amber-700 hover:bg-amber-50 hover:text-amber-800'
                          : 'bg-green-600 hover:bg-green-700 text-white'}
                      >
                        {user.is_active ? (
                          <><PauseCircle className="h-4 w-4 mr-1" /> Deactivate</>
                        ) : (
                          <><PlayCircle className="h-4 w-4 mr-1" /> Reactivate</>
                        )}
                      </Button>
                      )}
                      <Button
                        size="sm"
                        variant="secondary"
                        onClick={() => handleResendInvite(user.id, user.email)}
                        title="Resend Invite"
                      >
                        <Mail className="h-4 w-4" />
                      </Button>
                      <Button
                        size="sm"
                        variant="secondary"
                        onClick={() => handleResetPassword(user.user_id || user.id, user.email)}
                        title="Reset Password (Sends Email)"
                      >
                        <RotateCcw className="h-4 w-4" />
                      </Button>
                      <Button
                        size="sm"
                        variant="default"
                        onClick={() => openPasswordDialog(user)}
                        title="Set Password Manually"
                        className="bg-orange-500 hover:bg-orange-600"
                      >
                        <Key className="h-4 w-4" />
                      </Button>
                      <Button
                        size="sm"
                        variant="secondary"
                        onClick={() => handleSendLoginDetails(user)}
                        disabled={sendingLoginId === user.id}
                        title="Reset password and email login details"
                        className="bg-blue-600 hover:bg-blue-700 text-white"
                      >
                        <Mail className="h-4 w-4" />
                       </Button>
                       <ViewAsStaffButton
                         adminUserId={user.id}
                         canImpersonate={currentAdminUser?.role === 'super_admin'}
                       />

                       {currentAdminUser?.role !== 'dev_tester' && !(currentAdminUser?.role === 'admin' && (user.role === 'super_admin' || user.role === 'admin')) && (
                       <Button
                         size="sm"
                         variant="destructive"
                         onClick={() => handleDeleteUser(user.id)}
                       >
                         <Trash2 className="h-4 w-4" />
                       </Button>
                       )}
                     </div>
                  </TableCell>
                </TableRow>
                {isExpanded && canExpand && (
                  <TableRow className="bg-muted/30 hover:bg-muted/30">
                    <TableCell colSpan={8} className="p-0">
                      <div className="px-6 py-4 border-l-4 border-primary">
                        <div className="flex items-center justify-between mb-3">
                          <div>
                            <p className="text-sm font-semibold">Tab Access for {user.first_name} {user.last_name}</p>
                            <p className="text-xs text-muted-foreground">Tick to grant, untick to revoke. Changes save instantly.</p>
                          </div>
                          {savingPermsUserId === user.id && (
                            <Badge variant="outline" className="text-xs">Saving…</Badge>
                          )}
                        </div>
                        {(user.role === 'super_admin' || user.role === 'dev_tester') ? (
                          <p className="text-xs text-muted-foreground italic">This role automatically has access to all tabs and cannot be restricted here.</p>
                        ) : (
                          <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-2 max-h-[360px] overflow-y-auto">
                            {[...ADMIN_TABS].sort((a, b) => a.label.localeCompare(b.label)).map((tab) => {
                              const permKey = `tab_${tab.id}`;
                              const perms = (user.permissions || {}) as Record<string, boolean>;
                              // For 'admin' role: default ON unless explicitly false
                              const isChecked = user.role === 'admin'
                                ? !(permKey in perms && perms[permKey] === false)
                                : perms[permKey] === true;
                              const inputId = `inline-${user.id}-${permKey}`;
                              return (
                                <label
                                  key={tab.id}
                                  htmlFor={inputId}
                                  className={`flex items-start gap-2 p-2 rounded border cursor-pointer transition-colors ${isChecked ? 'bg-primary/5 border-primary/30' : 'bg-background hover:bg-muted/50'}`}
                                >
                                  <Checkbox
                                    id={inputId}
                                    checked={isChecked}
                                    onCheckedChange={(checked) => toggleInlineTabPerm(user, tab.id, checked === true)}
                                    className="mt-0.5"
                                  />
                                  <span className="text-xs font-medium leading-tight">{tab.label}</span>
                                </label>
                              );
                            })}
                          </div>
                        )}
                      </div>
                    </TableCell>
                  </TableRow>
                )}
                </React.Fragment>
                );
              })}
            </TableBody>
          </Table>
        </CardContent>
      </Card>
      {/* Super Admin Only: User Credentials Overview */}
      {currentAdminUser?.role === 'super_admin' && (
        <Card className="border-amber-200 bg-amber-50/50">
          <CardHeader>
            <CardTitle className="flex items-center gap-2 text-amber-800">
              <Key className="h-5 w-5" />
              User Credentials
              <Badge variant="outline" className="ml-2 bg-amber-100 text-amber-700 border-amber-300 text-xs">Super Admin Only</Badge>
            </CardTitle>
          </CardHeader>
          <CardContent>
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Name</TableHead>
                  <TableHead>Login Email / Username</TableHead>
                  <TableHead>Role</TableHead>
                  <TableHead>Status</TableHead>
                  <TableHead>Password Actions</TableHead>
                  <TableHead>Permissions</TableHead>
                  <TableHead className="text-right">Delete</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {users.map((u) => (
                  <TableRow key={`cred-${u.id}`}>
                    <TableCell className="font-medium">
                      {u.first_name} {u.last_name}
                    </TableCell>
                    <TableCell>
                      <div className="flex items-center gap-2">
                        <code className="text-xs bg-muted px-2 py-1 rounded font-mono">{u.email}</code>
                        <Button 
                          size="sm" 
                          variant="ghost" 
                          className="h-6 w-6 p-0"
                          onClick={() => copyToClipboard(u.email, `cred-email-${u.id}`)}
                          title="Copy email"
                        >
                          {copiedField === `cred-email-${u.id}` ? <Check className="h-3 w-3 text-green-500" /> : <Copy className="h-3 w-3" />}
                        </Button>
                      </div>
                    </TableCell>
                    <TableCell>
                      <Badge variant={getRoleBadgeVariant(u.role)} className={`text-xs ${getRoleBadgeClassName(u.role)}`}>
                        {u.role === 'super_admin' ? 'Super Admin' : u.role === 'admin' ? 'Admin' : u.role}
                      </Badge>
                    </TableCell>
                    <TableCell>
                      <Badge variant={u.is_active ? 'default' : 'secondary'} className="text-xs">
                        {u.is_active ? 'Active' : 'Inactive'}
                      </Badge>
                    </TableCell>
                    <TableCell>
                      <div className="flex flex-wrap gap-2">
                        <Button
                          size="sm"
                          variant="default"
                          onClick={() => openPasswordDialog(u)}
                          title="Set Password Manually"
                          className="bg-orange-500 hover:bg-orange-600 text-xs"
                        >
                          <Key className="h-3 w-3 mr-1" />
                          Set Password
                        </Button>
                        <Button
                          size="sm"
                          variant="secondary"
                          onClick={() => handleResetPassword(u.user_id || u.id, u.email)}
                          title="Reset Password (Sends Email)"
                          className="text-xs"
                        >
                          <RotateCcw className="h-3 w-3 mr-1" />
                          Reset
                        </Button>
                        <Button
                          size="sm"
                          variant="secondary"
                          onClick={() => handleSendLoginDetails(u)}
                          disabled={sendingLoginId === u.id}
                          title="Reset password and email login details to this user"
                          className="text-xs bg-blue-600 hover:bg-blue-700 text-white"
                        >
                          <Mail className="h-3 w-3 mr-1" />
                          {sendingLoginId === u.id ? 'Sending…' : 'Email Login'}
                        </Button>
                        {/* View As is now inside the Set Password dialog (key icon) */}
                      </div>
                    </TableCell>
                    <TableCell>
                      <Button
                        size="sm"
                        variant="outline"
                        onClick={() => openEditDialog(u)}
                        title="Edit role and tab permissions"
                        className="text-xs bg-primary text-primary-foreground hover:bg-primary/90 border-primary"
                      >
                        <Pencil className="h-3 w-3 mr-1" />
                        Edit Permissions
                      </Button>
                    </TableCell>
                    <TableCell className="text-right">
                      <Button
                        size="sm"
                        variant="destructive"
                        onClick={() => handleDeleteUser(u.id)}
                        title="Permanently delete this user"
                        className="text-xs"
                      >
                        <Trash2 className="h-3 w-3 mr-1" />
                        Delete
                      </Button>
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </CardContent>
        </Card>
      )}

      {/* Team Activity Panel */}
      <TeamActivityPanel />

      {/* Access log — start & end dates */}
      <AdminAccessLogPanel />
    </div>
  );
};
