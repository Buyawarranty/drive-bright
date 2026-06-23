import { useEffect, useState } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { FileText, Loader2 } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { format } from "date-fns";

// TEST-ONLY: until we sign off, only this email sees the My Claims panel
const TEST_EMAILS = ["1fairdeal@gmail.com", "buyawarranty1@gmail.com"];

interface Claim {
  id: string;
  status: string;
  vehicle_registration: string | null;
  claim_reason: string | null;
  created_at: string;
  date_of_incident: string | null;
  payment_amount: number | null;
  policy_id: string | null;
}

const STATUS_META: Record<string, { label: string; cls: string }> = {
  new: { label: "Received", cls: "bg-gray-100 text-gray-700 border-gray-200" },
  open: { label: "Open", cls: "bg-gray-100 text-gray-700 border-gray-200" },
  in_review: { label: "In Review", cls: "bg-blue-100 text-blue-700 border-blue-200" },
  awaiting_info: { label: "Evidence Needed", cls: "bg-amber-100 text-amber-700 border-amber-200" },
  approved: { label: "Approved", cls: "bg-green-100 text-green-700 border-green-200" },
  rejected: { label: "Rejected", cls: "bg-red-100 text-red-700 border-red-200" },
  closed: { label: "Closed", cls: "bg-gray-100 text-gray-600 border-gray-200" },
  paid: { label: "Paid", cls: "bg-green-100 text-green-700 border-green-200" },
};

interface Props {
  customerEmail?: string | null;
  selectedPolicyId?: string | null;
}

export const MyClaimsPanel = ({ customerEmail, selectedPolicyId }: Props) => {
  const [claims, setClaims] = useState<Claim[]>([]);
  const [loading, setLoading] = useState(true);

  const enabled = !!customerEmail && TEST_EMAILS.includes(customerEmail.toLowerCase());

  useEffect(() => {
    if (!enabled) {
      setLoading(false);
      return;
    }
    let cancelled = false;
    (async () => {
      setLoading(true);
      const { data, error } = await supabase
        .from("claims_submissions")
        .select("id,status,vehicle_registration,claim_reason,created_at,date_of_incident,payment_amount,policy_id")
        .ilike("email", customerEmail!)
        .order("created_at", { ascending: false });
      if (!cancelled) {
        if (error) console.error("Failed to load claims", error);
        setClaims((data as Claim[]) || []);
        setLoading(false);
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [customerEmail, enabled]);

  if (!enabled) return null;

  // If a policy is selected, prioritise claims for it but still show others
  const sorted = selectedPolicyId
    ? [...claims].sort((a, b) =>
        a.policy_id === selectedPolicyId ? -1 : b.policy_id === selectedPolicyId ? 1 : 0
      )
    : claims;

  return (
    <Card>
      <CardHeader>
        <CardTitle className="flex items-center gap-2 text-base">
          <FileText className="h-5 w-5 text-blue-600" />
          My Claims
          <Badge variant="outline" className="ml-2 text-[10px]">TEST</Badge>
        </CardTitle>
      </CardHeader>
      <CardContent>
        {loading ? (
          <div className="flex items-center gap-2 text-sm text-gray-500 py-4">
            <Loader2 className="h-4 w-4 animate-spin" /> Loading your claims…
          </div>
        ) : sorted.length === 0 ? (
          <p className="text-sm text-gray-500 py-3">
            You haven't submitted any claims yet. Visit{" "}
            <a href="/make-a-claim/" className="text-blue-600 underline">
              make a claim
            </a>{" "}
            to start one.
          </p>
        ) : (
          <ul className="divide-y">
            {sorted.map((c) => {
              const meta = STATUS_META[c.status] || {
                label: c.status,
                cls: "bg-gray-100 text-gray-700 border-gray-200",
              };
              const linked = selectedPolicyId && c.policy_id === selectedPolicyId;
              return (
                <li key={c.id} className="py-3 flex items-start justify-between gap-3">
                  <div className="min-w-0">
                    <div className="flex items-center gap-2 flex-wrap">
                      <span className="font-medium text-sm">
                        {c.vehicle_registration || "No reg"}
                      </span>
                      {linked && (
                        <Badge variant="outline" className="text-[10px] border-blue-200 text-blue-700">
                          This policy
                        </Badge>
                      )}
                    </div>
                    <p className="text-xs text-gray-600 mt-0.5 truncate max-w-[420px]">
                      {c.claim_reason || "Claim submitted"}
                    </p>
                    <p className="text-[11px] text-gray-400 mt-0.5">
                      Submitted {format(new Date(c.created_at), "d MMM yyyy")}
                    </p>
                  </div>
                  <span
                    className={`inline-flex shrink-0 px-2 py-0.5 rounded text-[11px] font-semibold border ${meta.cls}`}
                  >
                    {meta.label}
                  </span>
                </li>
              );
            })}
          </ul>
        )}
      </CardContent>
    </Card>
  );
};

export default MyClaimsPanel;
