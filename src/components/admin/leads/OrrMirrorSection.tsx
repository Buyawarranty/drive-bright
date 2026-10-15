import React from 'react';
import { Info, ExternalLink } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { OrrSection } from './OrrSection';

/**
 * Read-only reflection of the Open Round Robin Sandbox.
 * It renders the very same section, reading the same saved settings, so any
 * change made in the sandbox shows here automatically. Editing is blocked —
 * the sandbox is the only place ORR is changed.
 */
export const OrrMirrorSection: React.FC<{ onOpenSandbox?: () => void }> = ({ onOpenSandbox }) => (
  <div id="orr-mirror" className="space-y-3">
    <div className="border-l-4 border-primary/60 pl-3">
      <h2 className="text-lg font-semibold text-foreground">Open Round Robin (reflection)</h2>
    </div>
    <div className="flex flex-wrap items-start gap-3 rounded-md border border-primary/40 bg-primary/5 p-3 text-sm text-foreground">
      <Info className="h-4 w-4 mt-0.5 text-primary shrink-0" />
      <p className="flex-1 min-w-[220px]">
        This is a view-only reflection of the Open Round Robin Sandbox, which is the single source of truth.
        Anything changed in the sandbox updates here automatically. To make changes, open the sandbox.
      </p>
      {onOpenSandbox && (
        <Button size="sm" variant="outline" onClick={onOpenSandbox}>
          Open the sandbox <ExternalLink className="h-3.5 w-3.5 ml-1" />
        </Button>
      )}
    </div>
    <div className="relative">
      <fieldset disabled aria-readonly="true" className="pointer-events-none select-none opacity-90">
        <OrrSection isManagement sandboxTab />
      </fieldset>
    </div>
  </div>
);

export default OrrMirrorSection;
