import React from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Accordion, AccordionContent, AccordionItem, AccordionTrigger } from '@/components/ui/accordion';
import { ShieldAlert, Snowflake, Clock, Gavel, Info } from 'lucide-react';

type Row = { c1: string; c2: string; c3: string; c4?: string };

const STAGE_HEADERS = ['Performance trigger', 'Formal stage', 'What happens next', 'Possible outcome'];

const STAGES: Row[] = [
  {
    c1: 'One underperformance month',
    c2: 'Stage 1 — service performance notice',
    c3: 'A formal service-review meeting may be held. A written service-performance notice and a 30-day improvement plan may be issued. During the plan, the Contractor must normally achieve the applicable monthly revenue target, at least 10% conversion and at least 150 valid customer call attempts per full agreed service day, with the expected range being 200 to 250. Where fewer Company-provided leads are allocated, a proportionately reduced revenue target will apply. Satisfactory call handling, follow-ups, CRM records, availability and lead management are also required.',
    c4: 'If the plan is passed, normal monitoring resumes. Failure of the plan, or another underperformance month while the notice is active, may move the Contractor to Stage 2.',
  },
  {
    c1: 'Two consecutive underperformance months, two underperformance months within any rolling three-month period, or failure of Stage 1',
    c2: 'Stage 2 — final service performance notice',
    c3: 'A further formal service-review meeting may be held. A final written performance notice and a final 30-day improvement plan may be issued. The applicable revenue, conversion and call-activity standards continue to apply. Monitoring may be daily or weekly. Leads may be reduced, paused or reallocated where customer service or sales opportunities are at risk.',
    c4: 'Failure of the final plan, or further underperformance while the final notice is active, may move the Contractor to Stage 3.',
  },
  {
    c1: 'Three underperformance months within any rolling six-month period, or failure of the final improvement plan',
    c2: 'Stage 3 — final service review',
    c3: 'The Company will hold a final service review and consider the performance evidence, support provided, the Contractor’s explanation and any other relevant circumstances.',
    c4: 'Termination is not automatic. Possible outcomes include a short final review period, an agreed change to the services or termination under Section 9. The decision will be confirmed in writing.',
  },
  {
    c1: 'Serious underperformance in any month',
    c2: 'Direct escalation to Stage 2',
    c3: 'Where qualifying monthly revenue is below 60% of the applicable target, or conversion is below 5%, together with materially inadequate activity, repeated call shortfalls, repeated missed calls, unavailability, failure to follow up leads, inaccurate CRM records or customer risk without a reasonable explanation, the Company may start at Stage 2 after a fair review meeting.',
    c4: 'A final service-performance notice and final improvement plan may be issued without Stage 1. Further failure may lead to Stage 3 and possible termination.',
  },
  {
    c1: 'During an active Stage 1 or Stage 2 improvement plan',
    c2: 'Weekly reviews and process-improvement meetings',
    c3: 'Management will normally hold a weekly one-to-one review covering revenue, conversion, valid call activity, follow-ups, CRM records, availability, agreed actions and support. Where fewer leads are allocated, the proportionately reduced revenue target will be recorded. The Company may also hold group process-improvement meetings.',
    c4: 'Actions and review dates will be recorded. Group meetings are supportive and do not by themselves amount to a formal service-performance notice. Failure to engage with agreed reasonable actions may be considered at the next formal review.',
  },
];

const FREEZE_HEADERS = ['Condition or review point', 'Lead allocation action', 'Additional provisions or possible outcome'];

const FREEZE: Row[] = [
  {
    c1: 'No more than one completed and validated sale across any two consecutive agreed service days.',
    c2: 'The Company will normally apply a one-service-day Lead Freeze on the next agreed service day. New live, high-intent and newly allocated leads will stop while existing and management-assigned recovery opportunities are worked.',
    c3: 'The operational measure is described in Section 7.1.',
  },
  {
    c1: 'Before a Lead Freeze is applied.',
    c2: 'The Company may hold a one-to-one meeting with the Sales Agent to understand the circumstances.',
    c3: 'A lack of sales alone will not automatically constitute a material breach, but an unsupported assertion of poor leads or bad luck will not automatically prevent the operational freeze.',
  },
  {
    c1: 'No more than one completed and validated sale across any three consecutive agreed service days.',
    c2: 'The Company will normally apply a fixed two-service-day Lead Freeze beginning on the next agreed service day. The freeze will not end early because a sale is completed during it.',
    c3: 'Normal new-lead allocation will normally resume after the fixed period once management confirms availability. Reallocated leads will not automatically be returned.',
  },
  {
    c1: 'The Sales Agent has already achieved or exceeded the monthly revenue target.',
    c2: 'A Lead Freeze will not always be applied automatically.',
    c3: 'Management may decide whether to apply it after considering the Sales Agent’s overall monthly performance. The final decision lies with management, acting reasonably.',
  },
  {
    c1: 'Repeated Lead Freeze triggers, repeated failure to meet the call minimum, repeated failure to progress leads, repeated unavailability or inaccurate CRM records.',
    c2: 'The Company may take further formal service-performance or contractual action where appropriate.',
    c3: 'The matter may be managed under the service-performance process or as a material breach, depending on the circumstances. The final decision lies with management, acting reasonably and after considering the available evidence.',
  },
];

const AVAIL_HEADERS = ['Time unavailable', 'What happens while unavailable?', 'What happens on return?'];

const AVAILABILITY: Row[] = [
  {
    c1: 'Up to 30 minutes',
    c2: 'New leads will temporarily stop. Existing leads will normally remain with the Sales Agent. If a customer is ready to proceed or a lead is likely to close during the absence, the Sales Agent must hand that lead to a colleague so the customer can be assisted without delay.',
    c3: 'New leads will be switched back on once the Sales Agent returns, is logged in and confirms they are ready to provide the services.',
  },
  {
    c1: 'More than 30 minutes and up to 1 hour',
    c2: 'New leads will temporarily stop. Urgent callbacks, appointments, payment requests, customers ready to proceed and other time-sensitive leads may be passed to a colleague.',
    c3: 'New leads will be switched back on once the Sales Agent returns, is logged in and confirms readiness. Leads already passed to a colleague will normally remain with that colleague.',
  },
  {
    c1: 'More than 1 hour, or no reliable return time',
    c2: 'New leads will stop. The Company may reassign some or all open leads where needed to avoid delaying customers or losing sales.',
    c3: 'New leads may be switched back on after the Sales Agent returns and management confirms readiness. Reassigned leads will not automatically be returned.',
  },
  {
    c1: 'Returning after 13:00',
    c2: 'New leads remain stopped while the Sales Agent is unavailable. Urgent or ready-to-close leads may be reassigned.',
    c3: 'Management will decide whether to switch new leads back on for the remaining time that day, depending on lead availability and operational needs. Otherwise normal allocation resumes on the next agreed service day.',
  },
];

const PolicyTable: React.FC<{ headers: string[]; rows: Row[] }> = ({ headers, rows }) => (
  <div className="overflow-x-auto rounded-lg border">
    <table className="w-full min-w-[720px] border-collapse text-sm">
      <thead>
        <tr className="bg-primary text-primary-foreground">
          {headers.map((h) => (
            <th key={h} className="p-2 text-left align-top font-semibold">
              {h}
            </th>
          ))}
        </tr>
      </thead>
      <tbody>
        {rows.map((r, i) => (
          <tr key={r.c1} className={i % 2 ? 'bg-muted/40' : undefined}>
            <td className="border-t p-2 align-top font-medium">{r.c1}</td>
            <td className="border-t p-2 align-top text-muted-foreground">{r.c2}</td>
            <td className="border-t p-2 align-top text-muted-foreground">{r.c3}</td>
            {r.c4 !== undefined && <td className="border-t p-2 align-top text-muted-foreground">{r.c4}</td>}
          </tr>
        ))}
      </tbody>
    </table>
  </div>
);

const Para: React.FC<{ children: React.ReactNode }> = ({ children }) => (
  <p className="text-sm leading-relaxed text-muted-foreground">{children}</p>
);

/**
 * Service performance & conduct — the management-only reference for the
 * contractor service-performance stages, Lead Freeze rules, availability
 * rules and termination provisions. Reference document only; no actions here.
 */
export const ServicePerformancePanel: React.FC = () => (
  <div className="space-y-4">
    <Card>
      <CardHeader className="pb-3">
        <CardTitle className="flex flex-wrap items-center gap-2 text-lg">
          <ShieldAlert className="h-5 w-5 text-amber-600" />
          Service performance &amp; conduct
          <Badge variant="secondary">Management only</Badge>
        </CardTitle>
      </CardHeader>
      <CardContent className="space-y-2">
        <Para>
          The staged process management follows where a Sales Agent’s service performance falls below the agreed
          standard, alongside the operational Lead Freeze and availability rules. Nothing here is applied
          automatically — every formal stage needs a fair review meeting and a written decision.
        </Para>
        <p className="flex items-start gap-1.5 text-xs text-muted-foreground">
          <Info className="mt-0.5 h-3.5 w-3.5 shrink-0" />
          Agents see only the plain-English Lead Freeze summary in New Leads. This section is not shared with them.
        </p>
      </CardContent>
    </Card>

    <Accordion type="multiple" defaultValue={['stages']} className="space-y-3">
      <AccordionItem value="stages" className="rounded-lg border bg-card px-3">
        <AccordionTrigger className="text-sm font-semibold">
          <span className="flex items-center gap-2">
            <Gavel className="h-4 w-4 text-primary" /> 7. Service-performance stages
          </span>
        </AccordionTrigger>
        <AccordionContent className="pb-4">
          <PolicyTable headers={STAGE_HEADERS} rows={STAGES} />
        </AccordionContent>
      </AccordionItem>

      <AccordionItem value="freeze" className="rounded-lg border bg-card px-3">
        <AccordionTrigger className="text-sm font-semibold">
          <span className="flex items-center gap-2">
            <Snowflake className="h-4 w-4 text-sky-600" /> 7.1 Review and Fixed Lead Freeze
          </span>
        </AccordionTrigger>
        <AccordionContent className="space-y-3 pb-4">
          <Para>
            One agreed service day without a completed and validated sale will trigger an immediate management review
            of calls, contact attempts, follow-ups, CRM activity, lead allocation, availability and any relevant
            explanation.
          </Para>
          <Para>
            At the end of any two consecutive agreed service days, if no more than one sale has been completed and
            validated in total across those two days, the Company will normally impose a one-service-day Lead Freeze on
            the next agreed service day, subject to the management discretion below.
          </Para>
          <Para>
            During a Lead Freeze, no new live, high-intent or newly allocated leads will be issued. The Contractor must
            remain available and continue working existing open leads, callbacks, quotations, follow-ups and any
            management-assigned recovery leads. The Company may reallocate urgent or time-sensitive opportunities to
            protect customers and sales opportunities.
          </Para>
          <Para>
            At the end of any three consecutive agreed service days, if no more than one sale has been completed and
            validated in total across those three days, the Company will normally impose a fixed two-service-day Lead
            Freeze beginning on the next agreed service day. The restriction will not end early because a sale is
            completed during the freeze.
          </Para>
          <Para>
            At the end of the fixed period, normal new-lead allocation will normally resume once management confirms
            that the Contractor is available, logged into the required systems and ready to provide the services. A
            Lead Freeze is an operational customer-protection measure and is not, by itself, a formal performance
            notice.
          </Para>
          <h4 className="pt-1 text-sm font-semibold">7.1.1 Lead Freeze triggers, review and outcomes</h4>
          <PolicyTable headers={FREEZE_HEADERS} rows={FREEZE} />
        </AccordionContent>
      </AccordionItem>

      <AccordionItem value="availability" className="rounded-lg border bg-card px-3">
        <AccordionTrigger className="text-sm font-semibold">
          <span className="flex items-center gap-2">
            <Clock className="h-4 w-4 text-emerald-600" /> 8. Availability, unavailability and lead distribution
          </span>
        </AccordionTrigger>
        <AccordionContent className="space-y-3 pb-4">
          <h4 className="text-sm font-semibold">8.1 Company ownership and reallocation of leads</h4>
          <Para>
            All leads, customer enquiries, CRM records, quotations, appointments and associated information are the
            property of the Company. Allocation of a lead is temporary and does not give the Contractor permanent
            ownership of that lead. The Company may reallocate a lead where reasonably necessary to protect response
            times, customer service, compliance or sales opportunities.
          </Para>

          <h4 className="text-sm font-semibold">8.2 Availability, missed calls and lead progression</h4>
          <Para>
            During agreed customer-coverage periods, the Contractor must remain available, contactable, logged into the
            required telephone, CRM and communication systems, and ready to provide the services, except during agreed
            breaks, agreed unavailability, training, meetings or other periods accepted by management. The Contractor
            must answer or promptly return customer and Company calls, respond to callbacks and appointments, actively
            progress allocated leads, complete required follow-ups and keep CRM notes and lead statuses complete and
            accurate.
          </Para>
          <Para>
            Repeated or deliberate missed calls, failure to return calls, ignoring or abandoning leads, cherry-picking,
            unnecessarily withdrawing or misclassifying leads, becoming unavailable without notice, taking extended
            unagreed breaks, failing to log into required systems, manipulating call volumes or entering false or
            misleading telephone or CRM information may be treated as underperformance or a material breach.
          </Para>

          <h4 className="text-sm font-semibold">8.3 Short unavailability and lead allocation</h4>
          <PolicyTable headers={AVAIL_HEADERS} rows={AVAILABILITY} />
          <Para>
            The Sales Agent must notify management as soon as reasonably possible and give an estimated return time. A
            temporary stop to new leads means only that no fresh leads will be allocated while the Sales Agent is
            unavailable; it is not a Lead Freeze under Section 7.1. Where the Sales Agent returns within one hour, new
            leads will normally be switched back on once the Sales Agent is logged in, available and ready. Urgent,
            high-intent or time-sensitive leads may be reassigned at any time. Leads already reassigned will not
            automatically be returned. The final decision on reassignment and when to restart new leads lies with
            management, acting reasonably.
          </Para>

          <h4 className="text-sm font-semibold">8.4 Longer unavailability and lead reallocation</h4>
          <Para>
            Where the Contractor is unavailable for a longer period, allocation of new leads will stop. The Company may
            reassign new or uncontacted leads, callbacks, appointments and follow-ups due that day, customers waiting
            for a quotation, payment link, document or response, and any urgent, high-intent or time-sensitive
            opportunity. If the unavailability continues, the Company may reassign all remaining open leads. Reassigned
            leads will remain with the covering Sales Agent and will not automatically be returned. On return, the
            Contractor will receive new leads through the normal live distribution process. CRM notes must be kept
            complete and current so another person can continue each customer enquiry without unnecessary delay.
          </Para>

          <h4 className="text-sm font-semibold">8.5 Exceptional circumstances and management discretion</h4>
          <Para>
            The Company will consider any genuine emergency, medical issue, disability-related circumstance, family
            emergency, travel disruption, verified system failure or other reasonable explanation before making a final
            decision. The Company may agree a different arrangement where appropriate while applying the operational
            rules consistently and lawfully.
          </Para>
        </AccordionContent>
      </AccordionItem>

      <AccordionItem value="termination" className="rounded-lg border bg-card px-3">
        <AccordionTrigger className="text-sm font-semibold">
          <span className="flex items-center gap-2">
            <ShieldAlert className="h-4 w-4 text-destructive" /> 9–10. Termination, gross misconduct and final invoice
          </span>
        </AccordionTrigger>
        <AccordionContent className="space-y-3 pb-4">
          <Para>
            Either party may terminate this agreement by giving one week’s written notice. The Company may terminate
            this agreement immediately and without notice for material breach, gross misconduct, dishonesty, unlawful
            sales activity, a material data-security breach, loss of a required permission, insolvency, repeated
            unexplained failure to provide the agreed services, or repeated failure to remedy a material service defect
            after reasonable written notice.
          </Para>

          <h4 className="text-sm font-semibold">9.1 Immediate removal for gross misconduct</h4>
          <Para>
            Where the Company reasonably believes that the Contractor has committed gross misconduct or another serious
            material breach, the Company may immediately remove the Contractor from providing the services, stop
            allocating leads, disable access to Company systems and customer information, require an immediate
            handover, and terminate this agreement without notice.
          </Para>
          <Para>
            Gross misconduct includes, without limitation, fraud, theft, dishonesty, falsification of records,
            deliberate mis-selling, serious unlawful or regulatory conduct, harassment, threats or violence, serious
            misuse of customer data or Company systems, a material breach of confidentiality or data security, or
            conduct that causes or is reasonably likely to cause serious harm to the Company, its customers, business
            partners or reputation.
          </Para>
          <Para>
            The Company may take immediate protective action, including suspending access and removing leads, while the
            matter is reviewed. Any undisputed fees and commission properly earned before termination remain subject to
            the validation, cancellation, clawback and reconciliation provisions of this agreement. Termination does not
            remove any right to fees and commission properly earned before the termination date, subject to validation,
            cancellation, clawback and reconciliation.
          </Para>

          <h4 className="text-sm font-semibold">10. Final invoice and outstanding commission</h4>
          <Para>
            The Contractor must submit a final invoice in accordance with the normal invoicing process. Commission and
            milestone bonuses will continue to be processed through the normal contractor payment cycle after the
            relevant validation and clawback conditions have been satisfied, even where the payment date falls after
            the agreement ends.
          </Para>
          <Para>
            The Company may withhold a genuinely disputed amount while completing a reasonable reconciliation but will
            not withhold an undisputed amount without another lawful basis. Unless confirmed otherwise in writing, no
            commission is earned on a sale first completed after the effective termination date. Where another Sales
            Agent completes a customer opportunity after termination, the attribution rules in Section 6.7 may be
            applied by management.
          </Para>
        </AccordionContent>
      </AccordionItem>
    </Accordion>
  </div>
);

export default ServicePerformancePanel;
