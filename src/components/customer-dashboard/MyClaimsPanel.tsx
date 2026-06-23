import { useEffect, useMemo, useState } from "react";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import {
  ArrowLeft,
  Car,
  CheckCircle2,
  ChevronRight,
  Clock,
  ExternalLink,
  FileText,
  Loader2,
  Mail,
  MessageSquare,
  Paperclip,
  Phone,
  Shield,
  Upload,
} from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { format } from "date-fns";
import { cn } from "@/lib/utils";

// TEST-ONLY: this redesigned panel is gated to test customers while we validate
// the new UX. Remove this allowlist (and the gate below) to roll out for everyone.
const TEST_EMAILS = ["buyawarranty1@gmail.com", "1fairdeal@gmail.com"];

interface ClaimAttachmentRaw {
  url?: string;
  publicUrl?: string;
  name?: string;
  size?: number;
  type?: string;
}

interface Claim {
  id: string;
  status: string | null;
  vehicle_registration: string | null;
  vehicle_make?: string | null;
  vehicle_model?: string | null;
  vehicle_year?: string | null;
  claim_reason: string | null;
  created_at: string;
  date_of_incident: string | null;
  payment_amount: number | null;
  policy_id: string | null;
  approved_at?: string | null;
  paid_at?: string | null;
  updated_at?: string | null;
  warranty_type?: string | null;
  file_url?: string | null;
  file_urls?: ClaimAttachmentRaw[] | null;
  message?: string | null;
  email?: string | null;
  phone?: string | null;
  name?: string | null;
}

// Plain-language status mapping for customers. Hides admin jargon.
type FriendlyStage =
  | "received"
  | "info_needed"
  | "in_review"
  | "overdue"
  | "authorised"
  | "invoice"
  | "completed"
  | "declined";

interface StatusMeta {
  stage: FriendlyStage;
  label: string;            // chip text
  headline: string;         // big card headline
  explanation: string;      // plain-language paragraph
  nextStep: string;         // what the customer should do now
  expected: string;         // expected next update
  tone: "info" | "action" | "good" | "bad" | "neutral";
}

const STAGE_META: Record<FriendlyStage, Omit<StatusMeta, "stage">> = {
  received: {
    label: "Claim received",
    headline: "We have your claim",
    explanation: "Thanks for letting us know. Our claims team will review it shortly and get back to you with the next step.",
    nextStep: "No action needed right now — we'll be in touch.",
    expected: "We aim to make first contact within 1 working day.",
    tone: "info",
  },
  info_needed: {
    label: "We need more information",
    headline: "We need a few more details",
    explanation: "To progress your claim we need additional information or documents. Please respond as soon as you can so we can keep things moving.",
    nextStep: "Upload the requested documents or reply to our message.",
    expected: "Once received, we'll review within 1 working day.",
    tone: "action",
  },
  in_review: {
    label: "We are reviewing your claim",
    headline: "We're reviewing your claim",
    explanation: "Our claims team is checking your warranty cover and the details you've sent over. There's nothing for you to do at this stage.",
    nextStep: "Sit tight — we'll message you with the decision.",
    expected: "Most reviews are completed within 1–2 working days.",
    tone: "info",
  },
  overdue: {
    label: "Action needed — claim overdue",
    headline: "Your claim is overdue for an update",
    explanation: "This claim has been open longer than expected. Our claims team has been notified and will prioritise getting it moving again.",
    nextStep: "If we've asked you for documents, please send them as soon as possible. Otherwise, no action is needed.",
    expected: "We aim to contact you within 1 working day.",
    tone: "bad",
  },
  authorised: {
    label: "Repair authorised",
    headline: "Repair authorised",
    explanation: "Your claim has been approved for the agreed repair. Please ask the garage to send us the final invoice before work is completed or before payment is requested.",
    nextStep: "Ask your repairer to email the final invoice to claims@buyawarranty.co.uk.",
    expected: "We'll process payment within 1 working day of receiving the invoice.",
    tone: "good",
  },
  invoice: {
    label: "Invoice being checked",
    headline: "We're checking the invoice",
    explanation: "We've received your repairer's invoice and our team is reviewing it before releasing payment.",
    nextStep: "No action needed — we'll confirm once payment is sent.",
    expected: "Typically completed within 1 working day.",
    tone: "info",
  },
  completed: {
    label: "Claim completed",
    headline: "Your claim is closed",
    explanation: "Everything is wrapped up. If you have any questions about this claim, our team is here to help.",
    nextStep: "No further action required.",
    expected: "—",
    tone: "good",
  },
  declined: {
    label: "Claim declined",
    headline: "Your claim has been declined",
    explanation: "Unfortunately we weren't able to approve this claim. Please see the message from our claims team for the reason. If you'd like to discuss it, get in touch.",
    nextStep: "Contact our claims team if you'd like to discuss the decision.",
    expected: "—",
    tone: "bad",
  },
};

function toStage(raw: string | null | undefined): FriendlyStage {
  const k = (raw || "").toLowerCase().trim();
  if (k === "overdue") return "overdue";
  if (["triage"].includes(k)) return "received";
  if (["awaiting_info", "awaiting_information", "evidence_needed"].includes(k)) return "info_needed";
  if (["in_review", "under_review", "review", "evidence_received"].includes(k)) return "in_review";
  if (["approved", "awaiting_authorisation", "awaiting_authorization"].includes(k)) return "authorised";
  if (["invoice_received", "payment_pending"].includes(k)) return "invoice";
  if (["paid", "closed", "resolved"].includes(k)) return "completed";
  if (["declined", "rejected", "cancelled", "canceled"].includes(k)) return "declined";
  return "received";
}

const TIMELINE: { stage: FriendlyStage; label: string }[] = [
  { stage: "received", label: "Submitted" },
  { stage: "info_needed", label: "Evidence" },
  { stage: "in_review", label: "Review" },
  { stage: "authorised", label: "Authorised" },
  { stage: "invoice", label: "Invoice" },
  { stage: "completed", label: "Closed" },
];

function stageIndex(s: FriendlyStage): number {
  // info_needed is a side-branch of "received" — treat as past "received"
  // overdue isn't a step on the line; map it next to "in_review" so the bar still shows progress
  if (s === "overdue") return 2;
  const order: FriendlyStage[] = ["received", "info_needed", "in_review", "authorised", "invoice", "completed"];
  return order.indexOf(s);
}

const toneClasses = {
  info: {
    card: "bg-blue-50 border-blue-200",
    chip: "bg-blue-100 text-blue-800 border-blue-200",
    accent: "text-blue-700",
  },
  action: {
    card: "bg-amber-50 border-amber-200",
    chip: "bg-amber-100 text-amber-900 border-amber-300",
    accent: "text-amber-800",
  },
  good: {
    card: "bg-emerald-50 border-emerald-200",
    chip: "bg-emerald-100 text-emerald-800 border-emerald-200",
    accent: "text-emerald-700",
  },
  bad: {
    card: "bg-rose-50 border-rose-200",
    chip: "bg-rose-100 text-rose-800 border-rose-200",
    accent: "text-rose-700",
  },
  neutral: {
    card: "bg-gray-50 border-gray-200",
    chip: "bg-gray-100 text-gray-700 border-gray-200",
    accent: "text-gray-700",
  },
};

function buildAttachments(c: Claim): { url: string; name: string; size?: number; type?: string }[] {
  const out: { url: string; name: string; size?: number; type?: string }[] = [];
  if (Array.isArray(c.file_urls)) {
    c.file_urls.forEach((f) => {
      const url = f?.publicUrl || f?.url;
      if (url) out.push({ url, name: f?.name || "attachment", size: f?.size, type: f?.type });
    });
  }
  if (out.length === 0 && c.file_url) {
    out.push({ url: c.file_url, name: "attachment" });
  }
  return out;
}

function vehicleLine(c: Claim): string {
  const bits = [c.vehicle_year, c.vehicle_make, c.vehicle_model].filter(Boolean);
  return bits.length ? bits.join(" ") : "Vehicle";
}

interface Props {
  customerEmail?: string | null;
  selectedPolicyId?: string | null;
}

export const MyClaimsPanel = ({ customerEmail, selectedPolicyId }: Props) => {
  const enabled = !!customerEmail && TEST_EMAILS.includes(customerEmail.toLowerCase());
  const [claims, setClaims] = useState<Claim[]>([]);
  const [loading, setLoading] = useState(true);
  const [openId, setOpenId] = useState<string | null>(null);

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
        .select("*")
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

  // Sort: claims tied to current policy first, then newest
  const sorted = useMemo(() => {
    const list = [...claims];
    if (selectedPolicyId) {
      list.sort((a, b) => (a.policy_id === selectedPolicyId ? -1 : b.policy_id === selectedPolicyId ? 1 : 0));
    }
    return list;
  }, [claims, selectedPolicyId]);

  const activeClaim = useMemo(() => {
    // Pick the most recent non-completed claim as the "active" hero card.
    return sorted.find((c) => toStage(c.status) !== "completed" && toStage(c.status) !== "declined") || sorted[0] || null;
  }, [sorted]);

  const openClaim = openId ? sorted.find((c) => c.id === openId) || null : null;

  if (!enabled) return null;

  if (loading) {
    return (
      <Card>
        <CardContent className="py-8 flex items-center justify-center gap-2 text-sm text-muted-foreground">
          <Loader2 className="h-4 w-4 animate-spin" /> Loading your claims…
        </CardContent>
      </Card>
    );
  }

  if (sorted.length === 0) {
    return (
      <Card>
        <CardContent className="py-10 text-center space-y-3">
          <Shield className="h-10 w-10 text-blue-500 mx-auto" />
          <h3 className="text-lg font-semibold text-foreground">No claims yet</h3>
          <p className="text-sm text-muted-foreground max-w-md mx-auto">
            If something goes wrong with your vehicle, you can start a claim and we'll guide you through it.
          </p>
          <Button asChild>
            <a href="/make-a-claim/">Start a claim</a>
          </Button>
        </CardContent>
      </Card>
    );
  }

  if (openClaim) {
    return <ClaimDetail claim={openClaim} onBack={() => setOpenId(null)} />;
  }

  return (
    <div className="space-y-5">
      {activeClaim && <ActiveClaimCard claim={activeClaim} onOpen={() => setOpenId(activeClaim.id)} />}

      {sorted.length > 1 && (
        <div>
          <h3 className="text-sm font-semibold text-foreground mb-2 px-1">All claims ({sorted.length})</h3>
          <ul className="space-y-2">
            {sorted.map((c) => (
              <ClaimRow key={c.id} claim={c} onClick={() => setOpenId(c.id)} highlight={c.id === activeClaim?.id} />
            ))}
          </ul>
        </div>
      )}

      <ContactCard />
    </div>
  );
};

// ───────── Active claim hero card ─────────

const ActiveClaimCard: React.FC<{ claim: Claim; onOpen: () => void }> = ({ claim, onOpen }) => {
  const stage = toStage(claim.status);
  const meta = STAGE_META[stage];
  const tone = toneClasses[meta.tone];

  return (
    <Card className={cn("border-2", tone.card)}>
      <CardContent className="p-5 sm:p-6 space-y-5">
        <div className="flex items-start justify-between gap-3 flex-wrap">
          <div className="min-w-0">
            <div className="text-[11px] font-bold uppercase tracking-wider text-muted-foreground">Active claim</div>
            <h2 className={cn("text-xl sm:text-2xl font-bold mt-1", tone.accent)}>{meta.headline}</h2>
            <div className="mt-1 flex items-center gap-2 text-sm text-foreground/80 flex-wrap">
              <Car className="h-4 w-4" />
              <span>{vehicleLine(claim)}</span>
              {claim.vehicle_registration && (
                <span className="inline-block px-1.5 py-0.5 rounded bg-yellow-300 border border-slate-800 text-slate-900 font-mono font-bold text-[10px] tracking-wider">
                  {claim.vehicle_registration}
                </span>
              )}
              <span className="text-muted-foreground">· BAW-{claim.id.slice(0, 8).toUpperCase()}</span>
            </div>
          </div>
          <span className={cn("inline-flex items-center px-2.5 py-1 rounded-full text-xs font-semibold border", tone.chip)}>
            {meta.label}
          </span>
        </div>

        <ProgressTimeline stage={stage} />

        <div className="grid sm:grid-cols-2 gap-3">
          <InfoTile
            icon={ChevronRight}
            title="What you need to do next"
            body={meta.nextStep}
            tone={meta.tone === "action" ? "action" : "neutral"}
          />
          <InfoTile
            icon={Clock}
            title="When to expect an update"
            body={meta.expected}
            tone="neutral"
          />
        </div>

        <p className="text-sm text-foreground/80 leading-relaxed">{meta.explanation}</p>

        <div className="flex flex-wrap gap-2">
          <Button onClick={onOpen} className="gap-1.5">
            View claim details
            <ChevronRight className="h-4 w-4" />
          </Button>
          <Button variant="outline" asChild>
            <a href="tel:03302295045" className="gap-1.5">
              <Phone className="h-4 w-4" />
              Call claims team
            </a>
          </Button>
        </div>
      </CardContent>
    </Card>
  );
};

// ───────── Timeline ─────────

const ProgressTimeline: React.FC<{ stage: FriendlyStage }> = ({ stage }) => {
  const currentIdx = stageIndex(stage);
  const declined = stage === "declined";
  const steps = TIMELINE.filter((t) => t.stage !== "info_needed");

  return (
    <div className="w-full">
      <ol className="flex items-center w-full overflow-x-auto pb-2">
        {steps.map((step, i) => {
          const idx = stageIndex(step.stage);
          const done = !declined && idx <= currentIdx;
          const current = !declined && idx === currentIdx;
          const isLast = i === steps.length - 1;
          return (
            <li key={step.stage} className={cn("flex items-center", !isLast && "flex-1 min-w-[60px]")}>
              <div className="flex flex-col items-center gap-1 shrink-0">
                <div
                  className={cn(
                    "h-7 w-7 rounded-full flex items-center justify-center border-2 text-[11px] font-bold",
                    done
                      ? "bg-emerald-500 border-emerald-500 text-white"
                      : current
                      ? "bg-blue-500 border-blue-500 text-white"
                      : "bg-card border-border text-muted-foreground",
                  )}
                >
                  {done ? <CheckCircle2 className="h-4 w-4" /> : i + 1}
                </div>
                <span className={cn(
                  "text-[10px] font-medium whitespace-nowrap",
                  done || current ? "text-foreground" : "text-muted-foreground",
                )}>
                  {step.label}
                </span>
              </div>
              {!isLast && (
                <div className={cn("flex-1 h-0.5 mx-1 sm:mx-2 mb-4", done ? "bg-emerald-500" : "bg-border")} />
              )}
            </li>
          );
        })}
      </ol>
    </div>
  );
};

// ───────── Info tile ─────────

const InfoTile: React.FC<{
  icon: React.ComponentType<any>;
  title: string;
  body: string;
  tone: "action" | "neutral";
}> = ({ icon: Icon, title, body, tone }) => (
  <div className={cn(
    "rounded-lg border p-3 bg-card",
    tone === "action" ? "border-amber-300 bg-amber-50/60" : "border-border",
  )}>
    <div className="flex items-center gap-1.5 text-[11px] font-bold uppercase tracking-wider text-muted-foreground">
      <Icon className="h-3.5 w-3.5" />
      {title}
    </div>
    <p className="mt-1 text-sm text-foreground leading-snug">{body}</p>
  </div>
);

// ───────── Compact row ─────────

const ClaimRow: React.FC<{ claim: Claim; onClick: () => void; highlight?: boolean }> = ({ claim, onClick, highlight }) => {
  const stage = toStage(claim.status);
  const meta = STAGE_META[stage];
  const tone = toneClasses[meta.tone];
  return (
    <li>
      <button
        type="button"
        onClick={onClick}
        className={cn(
          "w-full flex items-center justify-between gap-3 p-3 rounded-lg border bg-card hover:bg-muted/40 transition-colors text-left",
          highlight ? "border-primary/30" : "border-border",
        )}
      >
        <div className="min-w-0 flex items-center gap-3">
          <div className="h-9 w-9 rounded-full bg-blue-100 text-blue-700 flex items-center justify-center shrink-0">
            <Car className="h-4 w-4" />
          </div>
          <div className="min-w-0">
            <div className="font-medium text-sm text-foreground truncate">
              {vehicleLine(claim)} {claim.vehicle_registration && <span className="text-muted-foreground">· {claim.vehicle_registration}</span>}
            </div>
            <div className="text-xs text-muted-foreground truncate">
              Submitted {format(new Date(claim.created_at), "d MMM yyyy")}
            </div>
          </div>
        </div>
        <div className="flex items-center gap-2 shrink-0">
          <span className={cn("inline-flex items-center px-2 py-0.5 rounded-full text-[11px] font-semibold border", tone.chip)}>
            {meta.label}
          </span>
          <ChevronRight className="h-4 w-4 text-muted-foreground" />
        </div>
      </button>
    </li>
  );
};

// ───────── Detail view ─────────

const ClaimDetail: React.FC<{ claim: Claim; onBack: () => void }> = ({ claim, onBack }) => {
  const stage = toStage(claim.status);
  const meta = STAGE_META[stage];
  const tone = toneClasses[meta.tone];
  const attachments = buildAttachments(claim);

  const timeline = [
    { label: "Claim submitted", date: claim.created_at, done: true },
    { label: "Evidence received", date: attachments.length > 0 ? claim.created_at : null, done: attachments.length > 0 },
    { label: "Claim reviewed", date: stageIndex(stage) >= stageIndex("in_review") ? claim.updated_at || null : null, done: stageIndex(stage) >= stageIndex("in_review") },
    { label: "Repair authorised", date: claim.approved_at, done: !!claim.approved_at },
    { label: "Invoice received", date: stageIndex(stage) >= stageIndex("invoice") ? claim.updated_at || null : null, done: stageIndex(stage) >= stageIndex("invoice") },
    { label: "Claim closed", date: claim.paid_at, done: stage === "completed" },
  ];

  return (
    <div className="space-y-5">
      <button
        type="button"
        onClick={onBack}
        className="inline-flex items-center gap-1.5 text-sm text-muted-foreground hover:text-foreground transition-colors"
      >
        <ArrowLeft className="h-4 w-4" />
        Back to all claims
      </button>

      <Card className={cn("border-2", tone.card)}>
        <CardContent className="p-5 sm:p-6 space-y-4">
          <div className="flex items-start justify-between gap-3 flex-wrap">
            <div className="min-w-0">
              <div className="text-[11px] font-bold uppercase tracking-wider text-muted-foreground">
                Claim BAW-{claim.id.slice(0, 8).toUpperCase()}
              </div>
              <h2 className={cn("text-xl sm:text-2xl font-bold mt-1", tone.accent)}>{meta.headline}</h2>
            </div>
            <span className={cn("inline-flex items-center px-2.5 py-1 rounded-full text-xs font-semibold border", tone.chip)}>
              {meta.label}
            </span>
          </div>
          <p className="text-sm text-foreground/80 leading-relaxed">{meta.explanation}</p>
          <div className="grid sm:grid-cols-2 gap-3">
            <InfoTile icon={ChevronRight} title="What you need to do next" body={meta.nextStep} tone={meta.tone === "action" ? "action" : "neutral"} />
            <InfoTile icon={Clock} title="When to expect an update" body={meta.expected} tone="neutral" />
          </div>
        </CardContent>
      </Card>

      <div className="grid lg:grid-cols-3 gap-5">
        <div className="lg:col-span-2 space-y-5">
          {/* Vehicle */}
          <Section title="Vehicle" icon={Car}>
            <DetailRow label="Vehicle">{vehicleLine(claim)}</DetailRow>
            <DetailRow label="Registration">
              {claim.vehicle_registration ? (
                <span className="inline-block px-1.5 py-0.5 rounded bg-yellow-300 border border-slate-800 text-slate-900 font-mono font-bold text-xs tracking-wider">
                  {claim.vehicle_registration}
                </span>
              ) : "—"}
            </DetailRow>
            <DetailRow label="Warranty">{claim.warranty_type || "Active warranty"}</DetailRow>
          </Section>

          {/* Issue */}
          <Section title="Issue reported" icon={FileText}>
            <p className="text-sm text-foreground whitespace-pre-wrap">
              {claim.claim_reason || claim.message || "No description provided."}
            </p>
            {claim.date_of_incident && (
              <div className="mt-2 text-xs text-muted-foreground">
                Date of incident: {format(new Date(claim.date_of_incident), "d MMM yyyy")}
              </div>
            )}
          </Section>

          {/* Decision (only when approved) */}
          {stage === "authorised" && (
            <Section title="Decision" icon={CheckCircle2} tone="good">
              <DetailRow label="Approved for">
                <span className="font-mono font-semibold">£{(claim.payment_amount || 0).toLocaleString()}</span>
              </DetailRow>
              {claim.approved_at && (
                <DetailRow label="Authorisation date">
                  {format(new Date(claim.approved_at), "d MMM yyyy")}
                </DetailRow>
              )}
              <div className="mt-2 text-xs text-emerald-800 bg-emerald-100/50 rounded px-2 py-1.5">
                Ask your garage to email the final invoice to <strong>claims@buyawarranty.co.uk</strong> before payment is requested.
              </div>
            </Section>
          )}

          {/* Timeline */}
          <Section title="Timeline" icon={Clock}>
            <ol className="space-y-3">
              {timeline.map((t, i) => (
                <li key={i} className="flex items-start gap-3">
                  <div className={cn(
                    "mt-0.5 h-5 w-5 rounded-full flex items-center justify-center shrink-0 border-2",
                    t.done ? "bg-emerald-500 border-emerald-500 text-white" : "bg-card border-border text-muted-foreground",
                  )}>
                    {t.done ? <CheckCircle2 className="h-3 w-3" /> : <span className="h-1.5 w-1.5 rounded-full bg-muted-foreground" />}
                  </div>
                  <div className="min-w-0 flex-1">
                    <div className={cn("text-sm font-medium", t.done ? "text-foreground" : "text-muted-foreground")}>
                      {t.label}
                    </div>
                    <div className="text-xs text-muted-foreground">
                      {t.date ? format(new Date(t.date), "d MMM yyyy") : "Pending"}
                    </div>
                  </div>
                </li>
              ))}
            </ol>
          </Section>

          {/* Documents */}
          <Section title="Documents" icon={Paperclip}>
            {attachments.length === 0 ? (
              <p className="text-sm text-muted-foreground">No documents uploaded yet.</p>
            ) : (
              <ul className="space-y-2">
                {attachments.map((a, i) => (
                  <li key={i} className="flex items-center gap-2 p-2 rounded border border-border bg-muted/30">
                    <Paperclip className="h-4 w-4 text-muted-foreground" />
                    <a
                      href={a.url}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="flex-1 min-w-0 text-sm font-medium text-blue-600 hover:underline truncate"
                    >
                      {a.name}
                    </a>
                    <a
                      href={a.url}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="h-7 w-7 inline-flex items-center justify-center rounded border border-border bg-card hover:bg-muted"
                      aria-label="Open"
                    >
                      <ExternalLink className="h-3.5 w-3.5" />
                    </a>
                  </li>
                ))}
              </ul>
            )}
            <Button variant="outline" size="sm" className="mt-3 gap-1.5" asChild>
              <a href="/make-a-claim/">
                <Upload className="h-4 w-4" />
                Upload more documents
              </a>
            </Button>
          </Section>

          {/* Messages */}
          <Section title="Messages" icon={MessageSquare}>
            <p className="text-sm text-muted-foreground">
              In-portal messaging is coming soon. For now, please reply to the claims team's emails or call us.
            </p>
            <div className="mt-3 flex flex-wrap gap-2">
              <Button size="sm" variant="outline" asChild>
                <a href="mailto:claims@buyawarranty.co.uk" className="gap-1.5">
                  <Mail className="h-4 w-4" /> Email claims team
                </a>
              </Button>
              <Button size="sm" variant="outline" asChild>
                <a href="tel:03302295045" className="gap-1.5">
                  <Phone className="h-4 w-4" /> Call claims team
                </a>
              </Button>
            </div>
          </Section>
        </div>

        <div className="space-y-5">
          <ContactCard />
        </div>
      </div>
    </div>
  );
};

// ───────── Building blocks ─────────

const Section: React.FC<{
  title: string;
  icon: React.ComponentType<any>;
  tone?: "good";
  children: React.ReactNode;
}> = ({ title, icon: Icon, tone, children }) => (
  <Card className={cn(tone === "good" && "border-emerald-200")}>
    <CardContent className="p-4 sm:p-5">
      <div className="flex items-center gap-2 mb-3">
        <Icon className={cn("h-4 w-4", tone === "good" ? "text-emerald-600" : "text-blue-600")} />
        <h3 className="text-sm font-semibold text-foreground">{title}</h3>
      </div>
      <div className="space-y-2">{children}</div>
    </CardContent>
  </Card>
);

const DetailRow: React.FC<{ label: string; children: React.ReactNode }> = ({ label, children }) => (
  <div className="flex items-start gap-2 text-sm">
    <span className="text-muted-foreground w-32 shrink-0">{label}</span>
    <span className="text-foreground min-w-0 flex-1">{children}</span>
  </div>
);

const ContactCard: React.FC = () => (
  <Card>
    <CardContent className="p-4 sm:p-5 space-y-3">
      <div className="flex items-center gap-2">
        <MessageSquare className="h-4 w-4 text-blue-600" />
        <h3 className="text-sm font-semibold text-foreground">Need help with this claim?</h3>
      </div>
      <div className="space-y-2">
        <a href="tel:03302295045" className="flex items-center gap-3 p-3 rounded-lg border border-border hover:bg-muted/40 transition-colors">
          <div className="h-9 w-9 rounded-full bg-green-100 flex items-center justify-center">
            <Phone className="h-4 w-4 text-green-700" />
          </div>
          <div className="min-w-0">
            <div className="text-sm font-medium text-foreground">Claims & Complaints</div>
            <div className="text-xs text-muted-foreground">0330 229 5045 · Mon–Fri 9am–6pm</div>
          </div>
        </a>
        <a href="mailto:claims@buyawarranty.co.uk" className="flex items-center gap-3 p-3 rounded-lg border border-border hover:bg-muted/40 transition-colors">
          <div className="h-9 w-9 rounded-full bg-blue-100 flex items-center justify-center">
            <Mail className="h-4 w-4 text-blue-700" />
          </div>
          <div className="min-w-0">
            <div className="text-sm font-medium text-foreground">Email the claims team</div>
            <div className="text-xs text-muted-foreground truncate">claims@buyawarranty.co.uk</div>
          </div>
        </a>
      </div>
    </CardContent>
  </Card>
);

export default MyClaimsPanel;
