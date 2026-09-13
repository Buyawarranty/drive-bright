import React from 'react';
import { Button } from '@/components/ui/button';
import { PIPELINE_ORDER, PIPELINE_LABELS, type WhatsAppPipelineStatus } from '@/lib/whatsappPipeline';

interface Props {
  status: string;
  disabled?: boolean;
  onChange: (next: WhatsAppPipelineStatus) => void;
}

/** New Lead → Contacted → Quote Sent → Hot Opportunity → Follow-Up → Won → Lost */
export const WhatsAppPipelineBar: React.FC<Props> = ({ status, disabled, onChange }) => (
  <div className="flex flex-wrap gap-1.5">
    {PIPELINE_ORDER.map((s) => (
      <Button
        key={s}
        size="sm"
        variant={s === status ? 'default' : 'outline'}
        disabled={disabled}
        onClick={() => onChange(s)}
      >
        {PIPELINE_LABELS[s]}
      </Button>
    ))}
  </div>
);

export default WhatsAppPipelineBar;
