import React from 'react';
import { createRoot } from 'react-dom/client';
import './index.css';
import { OrrWebsiteTriggerPracticePanel } from './components/admin/leads/OrrWebsiteTriggerPracticePanel';

/** Temporary rehearsal page used only to check the practice panel renders. */
createRoot(document.getElementById('root')!).render(
  <div className="min-h-screen bg-background p-6">
    <OrrWebsiteTriggerPracticePanel />
  </div>,
);
