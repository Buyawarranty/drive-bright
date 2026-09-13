/** WhatsApp sales pipeline: New Lead → Contacted → Quote Sent → Hot Opportunity → Follow-Up → Won → Lost */

export type WhatsAppPipelineStatus =
  | 'new_lead'
  | 'contacted'
  | 'quote_sent'
  | 'hot_opportunity'
  | 'follow_up'
  | 'won'
  | 'lost';

export const PIPELINE_ORDER: WhatsAppPipelineStatus[] = [
  'new_lead',
  'contacted',
  'quote_sent',
  'hot_opportunity',
  'follow_up',
  'won',
  'lost',
];

export const PIPELINE_LABELS: Record<WhatsAppPipelineStatus, string> = {
  new_lead: 'New Lead',
  contacted: 'Contacted',
  quote_sent: 'Quote Sent',
  hot_opportunity: 'Hot Opportunity',
  follow_up: 'Follow-Up',
  won: 'Won',
  lost: 'Lost',
};

export const PIPELINE_CLASSES: Record<WhatsAppPipelineStatus, string> = {
  new_lead: 'bg-blue-100 text-blue-800 border border-blue-300',
  contacted: 'bg-slate-100 text-slate-800 border border-slate-300',
  quote_sent: 'bg-violet-100 text-violet-800 border border-violet-300',
  hot_opportunity: 'bg-destructive text-destructive-foreground',
  follow_up: 'bg-amber-100 text-amber-900 border border-amber-300',
  won: 'bg-emerald-100 text-emerald-800 border border-emerald-300',
  lost: 'bg-muted text-muted-foreground border border-border',
};

export function pipelineLabel(status: string | null | undefined): string {
  const key = (status || 'new_lead') as WhatsAppPipelineStatus;
  return PIPELINE_LABELS[key] ?? 'New Lead';
}

export function pipelineClass(status: string | null | undefined): string {
  const key = (status || 'new_lead') as WhatsAppPipelineStatus;
  return PIPELINE_CLASSES[key] ?? PIPELINE_CLASSES.new_lead;
}
