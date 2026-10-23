import { useState } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { Button } from '@/components/ui/button';
import { ShieldCheck, RefreshCw, ExternalLink, AlertTriangle, CheckCircle2, HelpCircle, KeyRound } from 'lucide-react';
import { protectionState } from '../../../supabase/functions/_shared/cyber-security-rules';

type WebsiteCheck = { path: string; reachable: boolean; https?: boolean; hsts?: boolean; csp?: boolean; framing?: boolean; nosniff?: boolean };
type SectionAccess = { section: string; table_name: string; server_enforced: boolean };
type Report = { checked_at: string; tables: number; tables_without_rls: number; tables_without_policies: number; active_staff: number; staff_renewal_due: number; gateway_due_at: string | null; functions_without_pinned_path: number; privileged_functions_anon_callable: number; lockout_function_present: boolean; renewal_hook_configured: boolean; website: WebsiteCheck[]; section_access?: SectionAccess[] };
const dashboard = 'https://supabase.com/dashboard/project/mzlpuxzwyrcyrgrongeb';
function Status({ state }: { state: 'checked' | 'attention' | 'unknown' }) {
  const Icon = state === 'checked' ? CheckCircle2 : state === 'attention' ? AlertTriangle : HelpCircle;
  return <span className={`inline-flex items-center gap-1.5 text-xs font-medium ${state === 'attention' ? 'text-destructive' : 'text-muted-foreground'}`}><Icon className="h-4 w-4" />{state === 'checked' ? 'Checked' : state === 'attention' ? 'Needs attention' : 'Not verified'}</span>;
}
export default function CyberSecurityTab() {
  const [report, setReport] = useState<Report | null>(null);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');
  const check = async () => {
    setBusy(true); setError('');
    try {
      const { data, error: failure } = await supabase.functions.invoke('cyber-security', { body: { action: 'check' } });
      if (failure || data?.error) throw new Error(data?.error || 'Unable to check protections. Sign in as an active admin or super admin and try again.');
      setReport(data);
    } catch (e) { setError(e instanceof Error ? e.message : 'Check unavailable'); }
    finally { setBusy(false); }
  };
  const rows = report ? [
    { name: 'Customer data access', issues: report.tables_without_rls, detail: `${report.tables} public tables checked; ${report.tables_without_rls} without row-level protection. Enabled protection does not prove every access rule is correct.` },
    { name: 'Access policy coverage', issues: report.tables_without_policies, detail: `${report.tables_without_policies} protected tables have no access policies. These may be deliberately inaccessible; review before changing.` },
    { name: 'Staff password renewal', issues: report.staff_renewal_due, detail: `${report.staff_renewal_due} of ${report.active_staff} active staff records need renewal or enrolment. Three-calendar-month renewal.` },
    { name: 'Gateway password renewal', issues: !report.gateway_due_at || Date.parse(report.gateway_due_at) <= Date.now() ? 1 : 0, detail: report.gateway_due_at ? `Next renewal: ${new Date(report.gateway_due_at).toLocaleDateString('en-GB')}. Admins choose the new password.` : 'Gateway renewal date unavailable.' },
    { name: 'Account lockout control', issues: report.lockout_function_present ? 0 : 1, detail: 'Checks that the account-lockout control exists. The configured login rule is five failures in 15 minutes; a real failed-login test is still required.' },
    { name: 'Expired staff access enforcement', issues: report.renewal_hook_configured ? 0 : 1, detail: 'Checks the saved data-access enforcement setting. Expired-account end-to-end access is not verified by this check.' },
    { name: 'Elevated function lookup safety', issues: report.functions_without_pinned_path, detail: `${report.functions_without_pinned_path} elevated functions lack a fixed lookup location and need review.` },
    { name: 'Publicly callable elevated functions', issues: report.privileged_functions_anon_callable, detail: `${report.privileged_functions_anon_callable} elevated functions can be called without staff sign-in. Some are intentional public services; review their internal access checks individually.` },
  ] : [];
  return <div className="space-y-7 p-4 md:p-6 text-foreground">
    <header className="flex flex-wrap items-start justify-between gap-4 border-b border-border pb-5">
      <div><div className="flex items-center gap-3"><ShieldCheck className="h-7 w-7 text-primary" /><h1 className="text-2xl font-semibold">Cyber security</h1></div><p className="mt-2 text-sm text-muted-foreground">Admin dashboard · staff login · customer website · dealer portal</p></div>
      <Button onClick={check} disabled={busy}><RefreshCw className={`mr-2 h-4 w-4 ${busy ? 'animate-spin' : ''}`} />{busy ? 'Checking…' : report ? 'Check again' : 'Check protections'}</Button>
    </header>
    <nav className="flex flex-wrap gap-2" aria-label="Security settings">
      <Button variant="outline" asChild><a href="/admin?tab=user-permissions"><KeyRound className="mr-2 h-4 w-4" />Passwords and staff access</a></Button>
      <Button variant="outline" asChild><a href={`${dashboard}/auth/settings`} target="_blank" rel="noreferrer"><ExternalLink className="mr-2 h-4 w-4" />Sign-in settings</a></Button>
      <Button variant="outline" asChild><a href={`${dashboard}/database/security-advisor`} target="_blank" rel="noreferrer"><ExternalLink className="mr-2 h-4 w-4" />Security adviser</a></Button>
    </nav>
    <div className="border-l-4 border-destructive pl-4"><h2 className="font-semibold">Protection needs ongoing review</h2><p className="mt-1 text-sm text-muted-foreground">No check guarantees complete protection. Results below are read-only; passwords, access rules and website settings are not changed.</p></div>
    {error && <p role="alert" className="text-destructive">{error}</p>}
    {!report && <p className="text-sm text-muted-foreground">No current protection check. Use Check protections to retrieve current settings and inspect the published website.</p>}
    {report && <><p className="text-xs text-muted-foreground">Checked {new Date(report.checked_at).toLocaleString('en-GB')} {busy ? '· refresh in progress' : ''}{error ? ' · previous results; refresh failed' : ''}</p>
      <section><h2 className="mb-3 text-lg font-semibold">Admin and data safeguards</h2><div className="divide-y divide-border border-y border-border">{rows.map(row => <div key={row.name} className="grid gap-2 py-4 md:grid-cols-[1fr_160px]"><div><h3 className="font-medium">{row.name}</h3><p className="mt-1 max-w-3xl text-sm text-muted-foreground">{row.detail}</p></div><Status state={protectionState(row.issues)} /></div>)}</div></section>
      {report.section_access && <section><h2 className="mb-3 text-lg font-semibold">Admin section access</h2><p className="mb-3 max-w-3xl text-sm text-muted-foreground">Hiding a menu button is not real protection: a staff member can still request the data directly. &quot;Enforced by the database&quot; means the database itself refuses the data to staff without the right role or permission, so the section cannot be reached by guessing its address or calling the data service. &quot;Menu-hidden only&quot; means any signed-in staff member could still read that data directly — treat those sections as visible to all staff.</p><div className="divide-y divide-border border-y border-border">{report.section_access.map(item => <div key={item.section} className="grid gap-2 py-4 md:grid-cols-[1fr_160px]"><div><h3 className="font-medium">{item.section}</h3><p className="mt-1 max-w-3xl text-sm text-muted-foreground">{item.server_enforced ? 'The database checks the staff member\u2019s role or permission before returning any records.' : 'Access is only hidden in the menu; the underlying records are readable by any signed-in staff member.'}</p></div><Status state={item.server_enforced ? 'checked' : 'attention'} /></div>)}</div></section>}
      <section><h2 className="mb-3 text-lg font-semibold">Published website checks</h2><p className="mb-3 text-sm text-muted-foreground">Checks buyawarranty.co.uk, not the unpublished preview. Presence of a header is not a full security assessment.</p><div className="grid gap-3 md:grid-cols-2">{report.website.map(site => <article key={site.path} className="rounded-md border border-border p-4"><h3 className="mb-3 font-medium">{site.path === '/' ? 'Website' : site.path === '/auth' ? 'Admin login' : site.path === '/sales-login' ? 'Staff login' : 'Dealer portal login'}</h3>{!site.reachable ? <Status state="unknown" /> : <dl className="space-y-2">{[['Secure HTTPS connection', site.https], ['HTTPS enforcement header', site.hsts], ['Content security policy', site.csp], ['Page framing protection', site.framing], ['File-type protection', site.nosniff]].map(([label, value]) => <div key={String(label)} className="flex flex-wrap justify-between gap-2 text-sm"><dt>{label}</dt><dd><Status state={value ? 'checked' : 'attention'} /></dd></div>)}</dl>}</article>)}</div></section>
    </>}
    <section className="border-t border-border pt-5"><h2 className="text-lg font-semibold">Independent security review</h2><p className="mt-2 text-sm text-muted-foreground">Last recorded database scan: 21 October 2026, 06:44 UTC — 34 warnings and 9 informational findings. This is dated evidence, not a current all-clear. Existing adviser findings remain unresolved.</p><p className="mt-2 text-sm text-muted-foreground">That scan reported leaked-password protection disabled. Review it in Sign-in settings; Supabase offers it on Pro plans and above.</p><p className="mt-2 text-sm text-muted-foreground">Multi-factor sign-in requirements, session expiry, backup recovery, dependency vulnerabilities and full access-policy testing are not verified here. Review these before treating the portals as fully assessed.</p></section>
  </div>;
}