import React from 'react';
import LeadTeamsTab from '@/components/admin/LeadTeamsTab';

/**
 * Open Round Robin tab: renders Lead Allocation and jumps straight to the
 * Open Round Robin section at the bottom of that page.
 */
export const OrrTabView: React.FC<{ onNavigateToTab?: (tab: string) => void }> = ({ onNavigateToTab }) => {
  React.useEffect(() => {
    if (window.location.hash !== '#open-round-robin') {
      window.history.replaceState(null, '', `${window.location.pathname}${window.location.search}#open-round-robin`);
    }
    const t = window.setTimeout(() => {
      document.getElementById('open-round-robin')?.scrollIntoView({ behavior: 'smooth', block: 'start' });
    }, 400);
    return () => window.clearTimeout(t);
  }, []);

  return <LeadTeamsTab onNavigateToTab={onNavigateToTab} />;
};

export default OrrTabView;
