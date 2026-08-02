import React from 'react';
import { Car, Loader2, Lock } from 'lucide-react';
import { useClaims } from '@/hooks/useClaims';
import { useIsManagement } from '@/hooks/useIsManagement';
import { VehicleIntelligenceExplorer } from './claims/VehicleIntelligenceExplorer';
import { ClaimsAnalyticsPanel } from './claims/ClaimsAnalyticsPanel';
import { ClaimsAgeMileageAnalytics } from './claims/ClaimsAgeMileageAnalytics';

/**
 * Vehicle Intelligence — standalone management-only admin section.
 * Moved out of the Claims tab so claims agents no longer see it.
 */
const VehicleIntelligenceTab: React.FC = () => {
  const { isManagement, loading: roleLoading } = useIsManagement();
  const { claims, loading } = useClaims();

  const realClaims = (claims || []).filter((c: any) => c.status !== 'fake_test');

  if (roleLoading) {
    return (
      <div className="p-6 flex items-center gap-2 text-sm text-muted-foreground">
        <Loader2 className="h-4 w-4 animate-spin" /> Checking access…
      </div>
    );
  }

  if (!isManagement) {
    return (
      <div className="p-6">
        <div className="max-w-md rounded-lg border border-border bg-card p-6 text-center space-y-2">
          <Lock className="h-6 w-6 mx-auto text-muted-foreground" />
          <h2 className="font-semibold">Management access only</h2>
          <p className="text-sm text-muted-foreground">
            Vehicle Intelligence is designed for managers. Ask an administrator if you need access.
          </p>
        </div>
      </div>
    );
  }

  return (
    <div className="p-6 space-y-6">
      <div className="flex items-center gap-2">
        <Car className="h-5 w-5 text-orange-600" />
        <div>
          <h1 className="text-2xl font-bold">Vehicle Intelligence</h1>
          <p className="text-sm text-muted-foreground mt-0.5">
            Claim patterns by make, model, fuel, age and mileage — management view
          </p>
        </div>
      </div>

      {loading ? (
        <div className="flex items-center gap-2 text-sm text-muted-foreground">
          <Loader2 className="h-4 w-4 animate-spin" /> Loading vehicle data…
        </div>
      ) : (
        <>
          <VehicleIntelligenceExplorer claims={realClaims as any} />
          <div id="claims-analytics-section" className="scroll-mt-4 space-y-6">
            <ClaimsAnalyticsPanel claims={realClaims as any} />
            <ClaimsAgeMileageAnalytics claims={realClaims as any} />
          </div>
        </>
      )}
    </div>
  );
};

export default VehicleIntelligenceTab;
