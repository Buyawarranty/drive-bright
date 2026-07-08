import React, { useMemo } from 'react';
import { useNavigate, useParams } from 'react-router-dom';
import { ArrowLeft, Loader2 } from 'lucide-react';
import { useClaims } from '@/hooks/useClaims';
import { ClaimWorkspace } from '@/components/admin/claims-manager/workbench/ClaimWorkspace';

const AdminClaimDetail: React.FC = () => {
  const { id } = useParams<{ id: string }>();
  const navigate = useNavigate();
  const { claims, loading, refetch } = useClaims();

  const claim = useMemo(() => claims.find((c) => c.id === id) || null, [claims, id]);

  const goBack = () => {
    if (window.history.length > 1) navigate(-1);
    else navigate('/admin');
  };

  if (claim) {
    return <ClaimWorkspace claim={claim} onClose={goBack} onUpdated={refetch} />;
  }

  return (
    <div className="min-h-screen bg-muted/30">
      <div className="max-w-6xl mx-auto p-4 lg:p-6 space-y-4">
        <button
          type="button"
          onClick={goBack}
          className="inline-flex items-center gap-2 text-sm font-medium text-muted-foreground hover:text-foreground"
        >
          <ArrowLeft className="h-4 w-4" />
          Back to claims
        </button>
        {loading ? (
          <div className="flex items-center gap-2 text-sm text-muted-foreground p-8 justify-center">
            <Loader2 className="h-4 w-4 animate-spin" /> Loading claim…
          </div>
        ) : (
          <div className="bg-card border border-border rounded-lg p-8 text-center">
            <div className="text-base font-semibold text-foreground">Claim not found</div>
            <div className="text-sm text-muted-foreground mt-1">
              This claim may have been deleted or you may not have access to it.
            </div>
          </div>
        )}
      </div>
    </div>
  );
};

export default AdminClaimDetail;
