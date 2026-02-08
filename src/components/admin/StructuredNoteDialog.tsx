import { useState } from "react";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Badge } from "@/components/ui/badge";
import { Plus, X, Calendar, AlertTriangle, CheckCircle, AlertCircle } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";
import { format } from "date-fns";

interface NextStep {
  step: string;
  dueDate: string;
  owner: string;
}

interface Deadline {
  reason: string;
  dueDate: string;
}

interface StructuredNote {
  id?: string;
  customer_id: string;
  policy_number?: string;
  vehicle_reg?: string;
  title: string;
  summary: string;
  actions_taken: string[];
  next_steps: NextStep[];
  deadlines: Deadline[];
  compliance_notes?: string;
  risk_level: 'low' | 'medium' | 'high';
  risk_reason?: string;
  tags: string[];
  interaction_type?: 'call' | 'email' | 'chat' | 'in_person';
  purpose?: 'claim_query' | 'sales_enquiry' | 'cancellation' | 'renewal' | 'payment' | 'general' | 'complaint';
  interaction_date?: string;
  claim_reference?: string;
  call_recording_id?: string;
}

interface StructuredNoteDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  customerId: string;
  customerName: string;
  policyNumber?: string;
  vehicleReg?: string;
  existingNote?: StructuredNote;
  onSaved: () => void;
}

const INTERACTION_TYPES = [
  { value: 'call', label: 'Call' },
  { value: 'email', label: 'Email' },
  { value: 'chat', label: 'Chat' },
  { value: 'in_person', label: 'In Person' },
];

const PURPOSES = [
  { value: 'claim_query', label: 'Claim Query' },
  { value: 'sales_enquiry', label: 'Sales Enquiry' },
  { value: 'cancellation', label: 'Cancellation' },
  { value: 'renewal', label: 'Renewal' },
  { value: 'payment', label: 'Payment' },
  { value: 'complaint', label: 'Complaint' },
  { value: 'general', label: 'General' },
];

const RISK_LEVELS = [
  { value: 'low', label: 'Low', icon: CheckCircle, color: 'text-green-600' },
  { value: 'medium', label: 'Medium', icon: AlertCircle, color: 'text-yellow-600' },
  { value: 'high', label: 'High', icon: AlertTriangle, color: 'text-red-600' },
];

const COMMON_TAGS = ['claim', 'renewal', 'payment', 'complaint', 'cancellation', 'consent', 'follow-up', 'repair', 'authorisation', 'refund'];

export function StructuredNoteDialog({
  open,
  onOpenChange,
  customerId,
  customerName,
  policyNumber,
  vehicleReg,
  existingNote,
  onSaved,
}: StructuredNoteDialogProps) {
  const [saving, setSaving] = useState(false);
  const [title, setTitle] = useState(existingNote?.title || '');
  const [summary, setSummary] = useState(existingNote?.summary || '');
  const [actionsTaken, setActionsTaken] = useState<string[]>(existingNote?.actions_taken || ['']);
  const [nextSteps, setNextSteps] = useState<NextStep[]>(existingNote?.next_steps || [{ step: '', dueDate: '', owner: '' }]);
  const [deadlines, setDeadlines] = useState<Deadline[]>(existingNote?.deadlines || []);
  const [complianceNotes, setComplianceNotes] = useState(existingNote?.compliance_notes || '');
  const [riskLevel, setRiskLevel] = useState<'low' | 'medium' | 'high'>(existingNote?.risk_level || 'low');
  const [riskReason, setRiskReason] = useState(existingNote?.risk_reason || '');
  const [tags, setTags] = useState<string[]>(existingNote?.tags || []);
  const [newTag, setNewTag] = useState('');
  const [interactionType, setInteractionType] = useState(existingNote?.interaction_type || '');
  const [purpose, setPurpose] = useState(existingNote?.purpose || '');
  const [interactionDate, setInteractionDate] = useState(existingNote?.interaction_date || format(new Date(), "yyyy-MM-dd'T'HH:mm"));
  const [claimReference, setClaimReference] = useState(existingNote?.claim_reference || '');
  const [callRecordingId, setCallRecordingId] = useState(existingNote?.call_recording_id || '');

  const addAction = () => setActionsTaken([...actionsTaken, '']);
  const removeAction = (index: number) => setActionsTaken(actionsTaken.filter((_, i) => i !== index));
  const updateAction = (index: number, value: string) => {
    const updated = [...actionsTaken];
    updated[index] = value;
    setActionsTaken(updated);
  };

  const addNextStep = () => setNextSteps([...nextSteps, { step: '', dueDate: '', owner: '' }]);
  const removeNextStep = (index: number) => setNextSteps(nextSteps.filter((_, i) => i !== index));
  const updateNextStep = (index: number, field: keyof NextStep, value: string) => {
    const updated = [...nextSteps];
    updated[index] = { ...updated[index], [field]: value };
    setNextSteps(updated);
  };

  const addDeadline = () => setDeadlines([...deadlines, { reason: '', dueDate: '' }]);
  const removeDeadline = (index: number) => setDeadlines(deadlines.filter((_, i) => i !== index));
  const updateDeadline = (index: number, field: keyof Deadline, value: string) => {
    const updated = [...deadlines];
    updated[index] = { ...updated[index], [field]: value };
    setDeadlines(updated);
  };

  const addTag = (tag: string) => {
    const trimmed = tag.trim().toLowerCase();
    if (trimmed && !tags.includes(trimmed) && tags.length < 5) {
      setTags([...tags, trimmed]);
      setNewTag('');
    }
  };

  const removeTag = (tag: string) => setTags(tags.filter(t => t !== tag));

  const handleSave = async () => {
    if (!title.trim()) {
      toast.error("Title is required");
      return;
    }
    if (!summary.trim()) {
      toast.error("Summary is required");
      return;
    }

    setSaving(true);
    try {
      const { data: userData } = await supabase.auth.getUser();
      const { data: adminUser } = await supabase
        .from('admin_users')
        .select('id')
        .eq('user_id', userData.user?.id)
        .maybeSingle();

      const noteData = {
        customer_id: customerId,
        policy_number: policyNumber || null,
        vehicle_reg: vehicleReg || null,
        title: title.trim(),
        summary: summary.trim(),
        actions_taken: actionsTaken.filter(a => a.trim()) as unknown as any,
        next_steps: nextSteps.filter(s => s.step.trim()) as unknown as any,
        deadlines: deadlines.filter(d => d.reason.trim()) as unknown as any,
        compliance_notes: complianceNotes.trim() || null,
        risk_level: riskLevel as any,
        risk_reason: riskReason.trim() || null,
        tags,
        interaction_type: (interactionType || null) as any,
        purpose: (purpose || null) as any,
        interaction_date: interactionDate || null,
        claim_reference: claimReference.trim() || null,
        call_recording_id: callRecordingId.trim() || null,
        updated_by: adminUser?.id || null,
      };

      if (existingNote?.id) {
        const { error } = await supabase
          .from('structured_customer_notes')
          .update(noteData)
          .eq('id', existingNote.id);
        if (error) throw error;
        toast.success("Note updated successfully");
      } else {
        const { error } = await supabase
          .from('structured_customer_notes')
          .insert([{ ...noteData, created_by: adminUser?.id || null }]);
        if (error) throw error;
        toast.success("Note created successfully");
      }

      onSaved();
      onOpenChange(false);
    } catch (error: any) {
      toast.error(error.message || "Failed to save note");
    } finally {
      setSaving(false);
    }
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-4xl max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle>{existingNote ? 'Edit Note' : 'Create Structured Note'}</DialogTitle>
          <p className="text-sm text-muted-foreground">Customer: {customerName}</p>
        </DialogHeader>

        <div className="space-y-6">
          {/* Context Section */}
          <div className="grid grid-cols-2 gap-4">
            <div>
              <Label>Interaction Type</Label>
              <Select value={interactionType} onValueChange={setInteractionType}>
                <SelectTrigger><SelectValue placeholder="Select type" /></SelectTrigger>
                <SelectContent>
                  {INTERACTION_TYPES.map(t => (
                    <SelectItem key={t.value} value={t.value}>{t.label}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div>
              <Label>Purpose</Label>
              <Select value={purpose} onValueChange={setPurpose}>
                <SelectTrigger><SelectValue placeholder="Select purpose" /></SelectTrigger>
                <SelectContent>
                  {PURPOSES.map(p => (
                    <SelectItem key={p.value} value={p.value}>{p.label}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div>
              <Label>Interaction Date/Time (GMT)</Label>
              <Input type="datetime-local" value={interactionDate} onChange={e => setInteractionDate(e.target.value)} />
            </div>
            <div>
              <Label>Claim Reference (optional)</Label>
              <Input value={claimReference} onChange={e => setClaimReference(e.target.value)} placeholder="e.g., CR-21876" />
            </div>
          </div>

          {/* Title */}
          <div>
            <Label>Title *</Label>
            <Input value={title} onChange={e => setTitle(e.target.value)} placeholder="One-line, action-oriented title" />
          </div>

          {/* Summary */}
          <div>
            <Label>Summary *</Label>
            <Textarea value={summary} onChange={e => setSummary(e.target.value)} placeholder="2-4 sentences describing the interaction and decision" rows={3} />
          </div>

          {/* Actions Taken */}
          <div>
            <div className="flex items-center justify-between mb-2">
              <Label>Actions Taken</Label>
              <Button type="button" variant="outline" size="sm" onClick={addAction}>
                <Plus className="h-4 w-4 mr-1" /> Add
              </Button>
            </div>
            {actionsTaken.map((action, i) => (
              <div key={i} className="flex gap-2 mb-2">
                <span className="flex items-center justify-center w-6 h-9 text-sm font-medium text-muted-foreground">{i + 1}.</span>
                <Input value={action} onChange={e => updateAction(i, e.target.value)} placeholder="Action completed" className="flex-1" />
                {actionsTaken.length > 1 && (
                  <Button type="button" variant="ghost" size="icon" onClick={() => removeAction(i)}>
                    <X className="h-4 w-4" />
                  </Button>
                )}
              </div>
            ))}
          </div>

          {/* Next Steps */}
          <div>
            <div className="flex items-center justify-between mb-2">
              <Label>Next Steps</Label>
              <Button type="button" variant="outline" size="sm" onClick={addNextStep}>
                <Plus className="h-4 w-4 mr-1" /> Add
              </Button>
            </div>
            {nextSteps.map((step, i) => (
              <div key={i} className="flex gap-2 mb-2 items-start">
                <span className="flex items-center justify-center w-6 h-9 text-sm font-medium text-muted-foreground">{i + 1}.</span>
                <Input value={step.step} onChange={e => updateNextStep(i, 'step', e.target.value)} placeholder="Step description" className="flex-1" />
                <Input type="date" value={step.dueDate} onChange={e => updateNextStep(i, 'dueDate', e.target.value)} className="w-40" />
                <Input value={step.owner} onChange={e => updateNextStep(i, 'owner', e.target.value)} placeholder="Owner" className="w-32" />
                {nextSteps.length > 1 && (
                  <Button type="button" variant="ghost" size="icon" onClick={() => removeNextStep(i)}>
                    <X className="h-4 w-4" />
                  </Button>
                )}
              </div>
            ))}
          </div>

          {/* Deadlines */}
          <div>
            <div className="flex items-center justify-between mb-2">
              <Label>Deadlines & Reminders</Label>
              <Button type="button" variant="outline" size="sm" onClick={addDeadline}>
                <Calendar className="h-4 w-4 mr-1" /> Add
              </Button>
            </div>
            {deadlines.map((deadline, i) => (
              <div key={i} className="flex gap-2 mb-2">
                <span className="flex items-center justify-center w-6 h-9 text-sm font-medium text-muted-foreground">{i + 1}.</span>
                <Input value={deadline.reason} onChange={e => updateDeadline(i, 'reason', e.target.value)} placeholder="Reason" className="flex-1" />
                <Input type="date" value={deadline.dueDate} onChange={e => updateDeadline(i, 'dueDate', e.target.value)} className="w-40" />
                <Button type="button" variant="ghost" size="icon" onClick={() => removeDeadline(i)}>
                  <X className="h-4 w-4" />
                </Button>
              </div>
            ))}
          </div>

          {/* Compliance Notes */}
          <div>
            <Label>Compliance Notes</Label>
            <Textarea value={complianceNotes} onChange={e => setComplianceNotes(e.target.value)} placeholder="FCA-relevant statements, consent, disclosures..." rows={2} />
          </div>

          {/* Risk Level */}
          <div className="grid grid-cols-2 gap-4">
            <div>
              <Label>Risk Level</Label>
              <Select value={riskLevel} onValueChange={(v: 'low' | 'medium' | 'high') => setRiskLevel(v)}>
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {RISK_LEVELS.map(r => (
                    <SelectItem key={r.value} value={r.value}>
                      <div className="flex items-center gap-2">
                        <r.icon className={`h-4 w-4 ${r.color}`} />
                        {r.label}
                      </div>
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div>
              <Label>Risk Justification</Label>
              <Input value={riskReason} onChange={e => setRiskReason(e.target.value)} placeholder="Short justification" />
            </div>
          </div>

          {/* Tags */}
          <div>
            <Label>Tags (up to 5)</Label>
            <div className="flex flex-wrap gap-2 mb-2">
              {tags.map(tag => (
                <Badge key={tag} variant="secondary" className="cursor-pointer" onClick={() => removeTag(tag)}>
                  {tag} <X className="h-3 w-3 ml-1" />
                </Badge>
              ))}
            </div>
            <div className="flex gap-2">
              <Input value={newTag} onChange={e => setNewTag(e.target.value)} placeholder="Add custom tag" onKeyDown={e => e.key === 'Enter' && (e.preventDefault(), addTag(newTag))} className="flex-1" />
              <Button type="button" variant="outline" onClick={() => addTag(newTag)} disabled={tags.length >= 5}>Add</Button>
            </div>
            <div className="flex flex-wrap gap-1 mt-2">
              {COMMON_TAGS.filter(t => !tags.includes(t)).slice(0, 8).map(tag => (
                <Badge key={tag} variant="outline" className="cursor-pointer text-xs" onClick={() => addTag(tag)}>
                  + {tag}
                </Badge>
              ))}
            </div>
          </div>

          {/* Actions */}
          <div className="flex justify-end gap-2 pt-4 border-t">
            <Button variant="outline" onClick={() => onOpenChange(false)}>Cancel</Button>
            <Button onClick={handleSave} disabled={saving}>
              {saving ? 'Saving...' : existingNote ? 'Update Note' : 'Create Note'}
            </Button>
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
}
