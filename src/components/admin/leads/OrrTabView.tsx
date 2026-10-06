import React from 'react';
import OrrSandboxTabView from '@/components/admin/leads/OrrSandboxTabView';

/**
 * Legacy Open Round Robin tab URLs use the dedicated sandbox view.
 */
export const OrrTabView: React.FC<{ onNavigateToTab?: (tab: string) => void }> = ({ onNavigateToTab }) => {
  return <OrrSandboxTabView onNavigateToTab={onNavigateToTab} />;
};

export default OrrTabView;
