import React from 'react';
import { useSearchParams } from 'react-router-dom';
import { Button } from '@/components/ui/button';
import { MailX } from 'lucide-react';

/**
 * Compact quick link that jumps to the Unsubscribe tab from the top of the
 * New Leads and Customer Management sections.
 */
export const UnsubscribeQuickLink: React.FC = () => {
  const [, setSearchParams] = useSearchParams();
  return (
    <Button
      variant="outline"
      size="sm"
      onClick={() => setSearchParams({ tab: 'unsubscribe' })}
      className="h-7 px-2 sm:px-2.5 text-[11px] font-medium rounded-md gap-1.5 transition-none text-red-700 hover:bg-red-50 border-red-200 bg-red-50/50"
      title="Manage unsubscribed emails"
    >
      <MailX className="h-3.5 w-3.5" />
      <span className="hidden sm:inline">Unsubscribe</span>
    </Button>
  );
};

export default UnsubscribeQuickLink;
