import React, { useState } from 'react';
import { Eye, FileText, Wrench, BarChart3 } from 'lucide-react';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import WhatsCoveredAccordion from './WhatsCoveredAccordion';
import WhatsNotCoveredAccordion from './WhatsNotCoveredAccordion';
import PolicyTermsAccordion from './PolicyTermsAccordion';
import PartsListContent from './PartsListContent';
import TermComparison from './TermComparison';

type PaymentType = '12months' | '24months' | '36months';

interface SidebarQuickActionsProps {
  selectedTerm: PaymentType | null;
  onSelectTerm: (t: PaymentType) => void;
  availableTerms: PaymentType[];
}

type ModalKey = 'covered' | 'policy' | 'parts' | 'compare' | null;

const ACTIONS: { key: Exclude<ModalKey, null>; label: string; icon: React.ComponentType<{ className?: string }> }[] = [
  { key: 'covered', label: 'See what\'s covered', icon: Eye },
  { key: 'policy', label: 'View policy details', icon: FileText },
  { key: 'parts', label: 'View parts list', icon: Wrench },
  { key: 'compare', label: 'Compare plans', icon: BarChart3 },
];

const TITLES: Record<Exclude<ModalKey, null>, string> = {
  covered: 'What\'s covered',
  policy: 'Policy & terms',
  parts: 'Full parts list',
  compare: 'Compare 1, 2 & 3 year plans',
};

const SidebarQuickActions: React.FC<SidebarQuickActionsProps> = ({
  selectedTerm,
  onSelectTerm,
  availableTerms,
}) => {
  const [open, setOpen] = useState<ModalKey>(null);

  return (
    <div className="bg-white border border-[#e9e9e7] rounded-2xl p-4 shadow-[0_10px_30px_rgba(16,24,40,0.06)]">
      <h3 className="m-0 mb-3 text-base tracking-tight text-[#161616]">Quick actions</h3>
      <div className="grid gap-2">
        {ACTIONS.map(({ key, label, icon: Icon }) => (
          <button
            key={key}
            onClick={() => setOpen(key)}
            className="w-full flex items-center gap-3 px-3 py-2.5 rounded-xl border border-border bg-card hover:border-primary hover:bg-primary/5 transition-all text-left"
          >
            <span className="w-8 h-8 rounded-full bg-primary/10 flex items-center justify-center flex-shrink-0">
              <Icon className="w-4 h-4 text-primary" />
            </span>
            <span className="text-sm font-semibold text-foreground">{label}</span>
          </button>
        ))}
      </div>

      <Dialog open={open !== null} onOpenChange={(o) => !o && setOpen(null)}>
        <DialogContent className="max-w-3xl max-h-[85vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle>{open ? TITLES[open] : ''}</DialogTitle>
          </DialogHeader>
          <div className="mt-2">
            {open === 'covered' && (
              <div className="space-y-4">
                <WhatsCoveredAccordion variant="desktop" />
                <WhatsNotCoveredAccordion variant="desktop" />
              </div>
            )}
            {open === 'policy' && <PolicyTermsAccordion variant="desktop" />}
            {open === 'parts' && <PartsListContent />}
            {open === 'compare' && (
              <TermComparison
                variant="desktop"
                selectedTerm={selectedTerm}
                onSelectTerm={(t) => {
                  onSelectTerm(t);
                  setOpen(null);
                }}
                availableTerms={availableTerms as any}
              />
            )}
          </div>
        </DialogContent>
      </Dialog>
    </div>
  );
};

export default SidebarQuickActions;
