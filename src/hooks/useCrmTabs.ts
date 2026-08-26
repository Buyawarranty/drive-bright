import { useEffect, useState } from 'react';
import {
  getCrmTabState,
  startCrmTabCoordinator,
  subscribeCrmTabState,
  type CrmTabState,
} from '@/lib/crmTabCoordinator';

/** How many CRM tabs this browser has open, and whether this one is primary. */
export function useCrmTabs(): CrmTabState {
  const [state, setState] = useState<CrmTabState>(() => getCrmTabState());

  useEffect(() => {
    startCrmTabCoordinator();
    return subscribeCrmTabState(setState);
  }, []);

  return state;
}
