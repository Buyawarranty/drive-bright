import { ShieldCheck, ShieldAlert, UserCog, Info } from 'lucide-react';
import { Switch } from '@/components/ui/switch';
import { Badge } from '@/components/ui/badge';
import { useAdminConfig } from '@/hooks/useAdminConfig';
import { toast } from '@/hooks/use-toast';

/**
 * Staff Lead Access
 *
 * Explains — in plain English — who is allowed to assign / reassign leads to
 * other agents, and gives managers the single toggle that controls whether
 * sales leads can do it too.
 *
 * This is the human-readable companion to the `can_manage_lead_routing`
 * permission check. The rules are:
 *
 *   admin, super_admin, sales_manager, performance_manager  →  always
 *   sales_lead                                             →  only when
 *                                                            `sales_lead_distribution_access`
 *                                                            is true (the toggle below)
 *   sales (plain agents)                                   →  never
 */
export const StaffLeadAccessPanel = () => {
  const { value: salesLeadDistributionAccess, updateConfig } =
    useAdminConfig('sales_lead_distribution_access');

  const enabled = salesLeadDistributionAccess !== false;

  const handleToggle = async (checked: boolean) => {
    const success = await updateConfig(checked);
    if (success) {
      toast({
        title: checked ? 'Access granted' : 'Access revoked',
        description: checked
          ? 'Sales leads can now assign leads to other agents.'
          : 'Only managers can assign leads to other agents.',
      });
    }
  };

  return (
    <section
      id="staff-lead-access"
      className="rounded-lg border border-border bg-card shadow-sm overflow-hidden"
    >
      <div className="px-5 py-4 border-b border-border bg-muted/30">
        <div className="flex items-start justify-between gap-3 flex-wrap">
          <div className="flex items-start gap-2.5 min-w-0">
            <UserCog className="h-5 w-5 text-primary shrink-0 mt-0.5" />
            <div className="min-w-0">
              <h3 className="text-base font-semibold text-foreground">
                Staff Lead Access
              </h3>
              <p className="text-sm text-muted-foreground mt-0.5">
                Who can assign leads to other agents, and how to switch it on for
                team leads.
              </p>
            </div>
          </div>

          {/* Master toggle — managers only (this panel is manager-gated). */}
          <div className="flex items-center gap-2.5 p-2.5 bg-background border rounded-lg shrink-0">
            <ShieldCheck className={`h-4 w-4 ${enabled ? 'text-green-600' : 'text-muted-foreground'}`} />
            <span className="text-sm font-medium whitespace-nowrap">
              Sales leads can assign leads
            </span>
            <Switch checked={enabled} onCheckedChange={handleToggle} />
          </div>
        </div>
      </div>

      <div className="px-5 py-4 space-y-4">
        {/* Who can do it today */}
        <div className="space-y-2">
          <div className="flex items-center gap-2">
            <Info className="h-4 w-4 text-muted-foreground" />
            <h4 className="text-sm font-semibold text-foreground">
              Who can assign leads to other agents
            </h4>
          </div>

          <ul className="space-y-2 text-sm">
            <li className="flex items-start gap-2.5">
              <Badge
                variant="outline"
                className="shrink-0 bg-green-50 text-green-700 border-green-200"
              >
                Always
              </Badge>
              <span className="text-foreground">
                <strong>Managers</strong> — admin, super_admin, sales_manager and
                performance_manager — can always assign and reassign leads to any
                agent.
              </span>
            </li>

            <li className="flex items-start gap-2.5">
              <Badge
                variant="outline"
                className={`shrink-0 ${enabled ? 'bg-green-50 text-green-700 border-green-200' : 'bg-amber-50 text-amber-700 border-amber-200'}`}
              >
                {enabled ? 'Allowed now' : 'Switched off'}
              </Badge>
              <span className="text-foreground">
                <strong>Team leads (sales_lead)</strong> — when the toggle above is
                on, sales leads get the reassign / allocate controls on New Leads
                and Lead Allocation, scoped to their own team. Turning it off
                removes those controls for every sales lead at once.
              </span>
            </li>

            <li className="flex items-start gap-2.5">
              <Badge
                variant="outline"
                className="shrink-0 bg-rose-50 text-rose-700 border-rose-200"
              >
                Never
              </Badge>
              <span className="text-foreground">
                <strong>Sales agents</strong> (sales) cannot assign leads to other
                agents. Reassignment is limited to managers and team leads.
              </span>
            </li>
          </ul>
        </div>

        {/* How to grant / revoke */}
        <div className="rounded-lg border border-border bg-muted/20 p-4 space-y-2.5">
          <h4 className="text-sm font-semibold text-foreground">
            How to grant or revoke this
          </h4>
          <ol className="list-decimal ml-5 space-y-1.5 text-sm text-muted-foreground">
            <li>
              <span className="text-foreground">
                To grant one person:
              </span>{' '}
              set their role to <code className="px-1 py-0.5 rounded bg-muted text-xs">sales_lead</code>{' '}
              in <strong>User Permissions</strong>, then make sure the toggle at the
              top of this card is on.
            </li>
            <li>
              <span className="text-foreground">
                To revoke it for all team leads at once:
              </span>{' '}
              turn the <em>Sales leads can assign leads</em> toggle off. Every sales
              lead loses the controls immediately.
            </li>
            <li>
              <span className="text-foreground">
                To reinstate a single manager:
              </span>{' '}
              set their role back to <code className="px-1 py-0.5 rounded bg-muted text-xs">sales_manager</code>{' '}
              or <code className="px-1 py-0.5 rounded bg-muted text-xs">admin</code>{' '}
              — they bypass the toggle entirely.
            </li>
          </ol>
        </div>

        {/* Status line */}
        <div className="flex items-center gap-2 text-xs">
          {enabled ? (
            <>
              <ShieldCheck className="h-4 w-4 text-green-600" />
              <span className="text-green-700 font-medium">
                Sales leads currently have lead-assignment access.
              </span>
            </>
          ) : (
            <>
              <ShieldAlert className="h-4 w-4 text-amber-600" />
              <span className="text-amber-700 font-medium">
                Sales leads currently cannot assign leads — only managers can.
              </span>
            </>
          )}
        </div>
      </div>
    </section>
  );
};

export default StaffLeadAccessPanel;
