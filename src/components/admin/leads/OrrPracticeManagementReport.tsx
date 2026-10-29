import { managementReport } from '@/lib/orrPractice/managementReport';
import { canOverride, type PracticeRole } from '@/lib/orrPractice/openClaim';
import type { PracticeAgent, PracticeLead } from '@/lib/orrPractice/types';
import type { OrrPracticeSettings } from '@/lib/orrPractice/settings';
import { Label } from '@/components/ui/label';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';

const time = (value: number | null) => value === null ? '—' : `${value.toFixed(1)} min`;
const date = (at: number) => new Intl.DateTimeFormat('en-GB', { timeZone: 'Europe/London', weekday: 'short', hour: '2-digit', minute: '2-digit' }).format(at);

export function OrrPracticeManagementReport({ leads, agents, settings, clock, role, onRole }: {
  leads: PracticeLead[]; agents: PracticeAgent[]; settings: OrrPracticeSettings; clock: number;
  role: PracticeRole; onRole: (role: PracticeRole) => void;
}) {
  const report = managementReport(leads, agents, settings, clock);
  return <section id="orr-management" className="space-y-4 border-t border-border pt-4">
    <div className="flex flex-wrap items-end justify-between gap-3">
      <h3 className="text-sm font-semibold text-foreground">Phase 4: Management and reports</h3>
      <div className="space-y-1">
        <Label htmlFor="orr-report-role">Practice reporting role</Label>
        <Select value={role} onValueChange={v => onRole(v as PracticeRole)}>
          <SelectTrigger id="orr-report-role" className="w-48"><SelectValue /></SelectTrigger>
          <SelectContent>{(['admin', 'super_admin', 'sales_manager', 'sales', 'sales_lead', 'viewer'] as PracticeRole[]).map(r => <SelectItem key={r} value={r}>{r.replaceAll('_', ' ')}</SelectItem>)}</SelectContent>
        </Select>
      </div>
    </div>
    {!canOverride(role) ? <p className="text-sm text-muted-foreground">Management reports and settings are restricted to management in this rehearsal.</p> : <>
      <div className="grid grid-cols-2 gap-4 lg:grid-cols-4">
        {[
          ['Unworked backlog', report.backlog], ['Oldest enquiry', time(report.oldestEnquiryMinutes)],
          ['Contact cleared', report.callable], ['Needs management review', report.escalated],
          ['First attempt average', time(report.firstAttemptMinutes)], ['Attempt sample', report.firstAttemptSample],
          ['First conversation average', time(report.firstConversationMinutes)], ['Conversation sample', report.firstConversationSample],
        ].map(([label, value]) => <div key={label} className="border-l-2 border-primary pl-3"><p className="text-xs text-muted-foreground">{label}</p><p className="text-xl font-semibold tabular-nums text-foreground">{value}</p></div>)}
      </div>
      <p className="text-xs text-muted-foreground">Response times run from enquiry creation. All figures cover this made-up run only. Voicemails are not conversations.</p>
      <div className="overflow-x-auto">
        <table aria-label="Practice agent workload" className="w-full text-sm text-left">
          <caption className="text-left font-semibold mb-2">Agent workload</caption>
          <thead className="text-xs text-muted-foreground"><tr>{['Agent', 'Availability', 'Held', 'Owned', 'Taken today', 'Spare allowance', 'Attempts', 'Conversations'].map(t => <th key={t} className="p-2 whitespace-nowrap">{t}</th>)}</tr></thead>
          <tbody>{report.workload.map(a => <tr key={a.id} className="border-t border-border">
            {[a.name, a.available ? 'Available' : 'Away', a.held, a.owned, a.taken, a.remaining, a.attempts, a.conversations].map((v, i) => <td key={i} className="p-2 whitespace-nowrap tabular-nums">{v}</td>)}
          </tr>)}</tbody>
        </table>
      </div>
      <div className="space-y-2">
        <h4 className="text-sm font-semibold">Pending callbacks ({report.callbacks.length})</h4>
        {report.callbacks.length === 0 && <p className="text-sm text-muted-foreground">No pending callbacks.</p>}
        {report.callbacks.map(c => <div key={c.id} className="border-b border-border py-2 flex flex-wrap justify-between gap-2 text-sm">
          <span className="font-medium">{c.name}</span><span>{date(c.dueAt)} UK · {c.overdue ? 'Overdue' : 'Scheduled'}</span>
          <span className="w-full text-xs text-muted-foreground">{c.contact.reason}</span>
        </div>)}
      </div>
    </>}
  </section>;
}