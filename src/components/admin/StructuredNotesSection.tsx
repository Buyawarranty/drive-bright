import { useState, useEffect } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Collapsible, CollapsibleContent, CollapsibleTrigger } from "@/components/ui/collapsible";
import { Plus, Search, ChevronDown, ChevronUp, Edit, Trash2, AlertTriangle, CheckCircle, AlertCircle, Phone, Mail, MessageSquare, User, Calendar } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";
import { format, parseISO } from "date-fns";
import { StructuredNoteDialog } from "./StructuredNoteDialog";
import { AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent, AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle } from "@/components/ui/alert-dialog";
import { Skeleton } from "@/components/ui/skeleton";

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
  id: string;
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
  purpose?: string;
  interaction_date?: string;
  claim_reference?: string;
  call_recording_id?: string;
  created_at: string;
  created_by?: string;
  updated_at: string;
  admin_user?: { first_name: string; last_name: string; email: string };
}

interface StructuredNotesSectionProps {
  customerId: string;
  customerName: string;
  policyNumber?: string;
  vehicleReg?: string;
}

const INTERACTION_ICONS = {
  call: Phone,
  email: Mail,
  chat: MessageSquare,
  in_person: User,
};

const RISK_CONFIG = {
  low: { icon: CheckCircle, color: 'text-green-600', bg: 'bg-green-100' },
  medium: { icon: AlertCircle, color: 'text-yellow-600', bg: 'bg-yellow-100' },
  high: { icon: AlertTriangle, color: 'text-red-600', bg: 'bg-red-100' },
};

export function StructuredNotesSection({ customerId, customerName, policyNumber, vehicleReg }: StructuredNotesSectionProps) {
  const [notes, setNotes] = useState<StructuredNote[]>([]);
  const [loading, setLoading] = useState(true);
  const [searchTerm, setSearchTerm] = useState('');
  const [filterRisk, setFilterRisk] = useState<string>('all');
  const [filterTag, setFilterTag] = useState<string>('all');
  const [expandedNotes, setExpandedNotes] = useState<Set<string>>(new Set());
  const [dialogOpen, setDialogOpen] = useState(false);
  const [editingNote, setEditingNote] = useState<StructuredNote | undefined>();
  const [deleteConfirm, setDeleteConfirm] = useState<string | null>(null);

  const fetchNotes = async () => {
    setLoading(true);
    try {
      const { data, error } = await supabase
        .from('structured_customer_notes')
        .select('*')
        .eq('customer_id', customerId)
        .order('created_at', { ascending: false });

      if (error) throw error;
      
      // Get admin users for created_by
      const createdByIds = [...new Set((data || []).map(n => n.created_by).filter(Boolean))];
      let adminUsers: Record<string, any> = {};
      
      if (createdByIds.length > 0) {
        const { data: admins } = await supabase
          .from('admin_users')
          .select('id, first_name, last_name, email')
          .in('id', createdByIds);
        
        if (admins) {
          adminUsers = admins.reduce((acc, admin) => ({ ...acc, [admin.id]: admin }), {});
        }
      }
      
      // Transform the data to handle JSONB fields
      const transformedNotes: StructuredNote[] = (data || []).map(note => ({
        id: note.id,
        customer_id: note.customer_id,
        policy_number: note.policy_number || undefined,
        vehicle_reg: note.vehicle_reg || undefined,
        title: note.title,
        summary: note.summary,
        actions_taken: Array.isArray(note.actions_taken) ? note.actions_taken.map(String) : [],
        next_steps: Array.isArray(note.next_steps) ? (note.next_steps as unknown as NextStep[]) : [],
        deadlines: Array.isArray(note.deadlines) ? (note.deadlines as unknown as Deadline[]) : [],
        compliance_notes: note.compliance_notes || undefined,
        risk_level: (note.risk_level || 'low') as 'low' | 'medium' | 'high',
        risk_reason: note.risk_reason || undefined,
        tags: Array.isArray(note.tags) ? note.tags : [],
        interaction_type: note.interaction_type as any,
        purpose: note.purpose || undefined,
        interaction_date: note.interaction_date || undefined,
        claim_reference: note.claim_reference || undefined,
        call_recording_id: note.call_recording_id || undefined,
        created_at: note.created_at,
        created_by: note.created_by || undefined,
        updated_at: note.updated_at,
        admin_user: note.created_by ? adminUsers[note.created_by] : undefined,
      }));
      
      setNotes(transformedNotes);
    } catch (error: any) {
      toast.error("Failed to load notes");
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchNotes();
  }, [customerId]);

  const handleDelete = async (noteId: string) => {
    try {
      const { error } = await supabase
        .from('structured_customer_notes')
        .delete()
        .eq('id', noteId);
      if (error) throw error;
      toast.success("Note deleted");
      fetchNotes();
    } catch (error: any) {
      toast.error("Failed to delete note");
    }
    setDeleteConfirm(null);
  };

  const toggleExpand = (noteId: string) => {
    const newExpanded = new Set(expandedNotes);
    if (newExpanded.has(noteId)) {
      newExpanded.delete(noteId);
    } else {
      newExpanded.add(noteId);
    }
    setExpandedNotes(newExpanded);
  };

  const formatUKDate = (dateStr: string) => {
    try {
      return format(parseISO(dateStr), 'dd/MM/yyyy');
    } catch {
      return dateStr;
    }
  };

  const formatUKDateTime = (dateStr: string) => {
    try {
      return format(parseISO(dateStr), 'dd/MM/yyyy HH:mm') + ' GMT';
    } catch {
      return dateStr;
    }
  };

  // Get all unique tags for filter
  const allTags = Array.from(new Set(notes.flatMap(n => n.tags)));

  // Filter notes
  const filteredNotes = notes.filter(note => {
    const matchesSearch = searchTerm === '' || 
      note.title.toLowerCase().includes(searchTerm.toLowerCase()) ||
      note.summary.toLowerCase().includes(searchTerm.toLowerCase()) ||
      note.policy_number?.toLowerCase().includes(searchTerm.toLowerCase()) ||
      note.vehicle_reg?.toLowerCase().includes(searchTerm.toLowerCase());
    
    const matchesRisk = filterRisk === 'all' || note.risk_level === filterRisk;
    const matchesTag = filterTag === 'all' || note.tags.includes(filterTag);
    
    return matchesSearch && matchesRisk && matchesTag;
  });

  if (loading) {
    return (
      <Card>
        <CardHeader>
          <Skeleton className="h-6 w-48" />
        </CardHeader>
        <CardContent>
          <Skeleton className="h-20 w-full mb-4" />
          <Skeleton className="h-20 w-full" />
        </CardContent>
      </Card>
    );
  }

  return (
    <Card>
      <CardHeader className="flex flex-row items-center justify-between">
        <CardTitle className="text-lg">Structured Notes ({notes.length})</CardTitle>
        <Button onClick={() => { setEditingNote(undefined); setDialogOpen(true); }}>
          <Plus className="h-4 w-4 mr-2" /> Add Note
        </Button>
      </CardHeader>
      <CardContent>
        {/* Filters */}
        <div className="flex flex-wrap gap-3 mb-4">
          <div className="relative flex-1 min-w-[200px]">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
            <Input
              placeholder="Search notes..."
              value={searchTerm}
              onChange={e => setSearchTerm(e.target.value)}
              className="pl-9"
            />
          </div>
          <Select value={filterRisk} onValueChange={setFilterRisk}>
            <SelectTrigger className="w-[140px]">
              <SelectValue placeholder="Risk level" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all">All risks</SelectItem>
              <SelectItem value="low">Low</SelectItem>
              <SelectItem value="medium">Medium</SelectItem>
              <SelectItem value="high">High</SelectItem>
            </SelectContent>
          </Select>
          <Select value={filterTag} onValueChange={setFilterTag}>
            <SelectTrigger className="w-[140px]">
              <SelectValue placeholder="Filter by tag" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all">All tags</SelectItem>
              {allTags.map(tag => (
                <SelectItem key={tag} value={tag}>{tag}</SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>

        {/* Notes List */}
        {filteredNotes.length === 0 ? (
          <p className="text-center text-muted-foreground py-8">
            {notes.length === 0 ? 'No notes yet. Click "Add Note" to create one.' : 'No notes match your filters.'}
          </p>
        ) : (
          <div className="space-y-3">
            {filteredNotes.map(note => {
              const isExpanded = expandedNotes.has(note.id);
              const RiskIcon = RISK_CONFIG[note.risk_level].icon;
              const InteractionIcon = note.interaction_type ? INTERACTION_ICONS[note.interaction_type] : null;

              return (
                <Collapsible key={note.id} open={isExpanded} onOpenChange={() => toggleExpand(note.id)}>
                  <div className="border rounded-lg">
                    <CollapsibleTrigger asChild>
                      <div className="p-4 cursor-pointer hover:bg-muted/50 transition-colors">
                        <div className="flex items-start justify-between gap-4">
                          <div className="flex-1 min-w-0">
                            <div className="flex items-center gap-2 mb-1">
                              {InteractionIcon && <InteractionIcon className="h-4 w-4 text-muted-foreground" />}
                              <h4 className="font-semibold truncate">{note.title}</h4>
                              <Badge className={`${RISK_CONFIG[note.risk_level].bg} ${RISK_CONFIG[note.risk_level].color} text-xs`}>
                                <RiskIcon className="h-3 w-3 mr-1" />
                                {note.risk_level.toUpperCase()}
                              </Badge>
                            </div>
                            <p className="text-sm text-muted-foreground line-clamp-2">{note.summary}</p>
                            <div className="flex items-center gap-2 mt-2 text-xs text-muted-foreground">
                              <Calendar className="h-3 w-3" />
                              {note.interaction_date ? formatUKDateTime(note.interaction_date) : formatUKDateTime(note.created_at)}
                              {note.admin_user && (
                                <span>• {note.admin_user.first_name} {note.admin_user.last_name}</span>
                              )}
                            </div>
                          </div>
                          <div className="flex items-center gap-2">
                            <Button variant="ghost" size="icon" onClick={e => { e.stopPropagation(); setEditingNote(note); setDialogOpen(true); }}>
                              <Edit className="h-4 w-4" />
                            </Button>
                            <Button variant="ghost" size="icon" onClick={e => { e.stopPropagation(); setDeleteConfirm(note.id); }}>
                              <Trash2 className="h-4 w-4 text-destructive" />
                            </Button>
                            {isExpanded ? <ChevronUp className="h-5 w-5" /> : <ChevronDown className="h-5 w-5" />}
                          </div>
                        </div>
                        {note.tags.length > 0 && (
                          <div className="flex flex-wrap gap-1 mt-2">
                            {note.tags.map(tag => (
                              <Badge key={tag} variant="outline" className="text-xs">{tag}</Badge>
                            ))}
                          </div>
                        )}
                      </div>
                    </CollapsibleTrigger>

                    <CollapsibleContent>
                      <div className="px-4 pb-4 space-y-4 border-t pt-4">
                        {/* Summary */}
                        <div>
                          <h5 className="font-medium text-sm mb-1">Summary</h5>
                          <p className="text-sm">{note.summary}</p>
                        </div>

                        {/* Actions Taken */}
                        {note.actions_taken.length > 0 && (
                          <div>
                            <h5 className="font-medium text-sm mb-1">Actions Taken</h5>
                            <ol className="list-decimal list-inside text-sm space-y-1">
                              {note.actions_taken.map((action, i) => (
                                <li key={i}>{action}</li>
                              ))}
                            </ol>
                          </div>
                        )}

                        {/* Next Steps */}
                        {note.next_steps.length > 0 && (
                          <div>
                            <h5 className="font-medium text-sm mb-1">Next Steps</h5>
                            <ol className="list-decimal list-inside text-sm space-y-1">
                              {note.next_steps.map((step, i) => (
                                <li key={i}>
                                  {step.step}
                                  {step.dueDate && <span className="text-muted-foreground"> (Due: {formatUKDate(step.dueDate)})</span>}
                                  {step.owner && <span className="text-muted-foreground"> — {step.owner}</span>}
                                </li>
                              ))}
                            </ol>
                          </div>
                        )}

                        {/* Deadlines */}
                        {note.deadlines.length > 0 && (
                          <div>
                            <h5 className="font-medium text-sm mb-1">Deadlines & Reminders</h5>
                            <ol className="list-decimal list-inside text-sm space-y-1">
                              {note.deadlines.map((d, i) => (
                                <li key={i}>{d.reason} — {formatUKDate(d.dueDate)}</li>
                              ))}
                            </ol>
                          </div>
                        )}

                        {/* Compliance Notes */}
                        {note.compliance_notes && (
                          <div>
                            <h5 className="font-medium text-sm mb-1">Compliance Notes</h5>
                            <p className="text-sm bg-muted/50 p-2 rounded">{note.compliance_notes}</p>
                          </div>
                        )}

                        {/* Risk Level */}
                        <div>
                          <h5 className="font-medium text-sm mb-1">Risk Level</h5>
                          <div className="flex items-center gap-2">
                            <Badge className={`${RISK_CONFIG[note.risk_level].bg} ${RISK_CONFIG[note.risk_level].color}`}>
                              <RiskIcon className="h-3 w-3 mr-1" />
                              {note.risk_level.charAt(0).toUpperCase() + note.risk_level.slice(1)}
                            </Badge>
                            {note.risk_reason && <span className="text-sm text-muted-foreground">{note.risk_reason}</span>}
                          </div>
                        </div>

                        {/* References */}
                        {(note.claim_reference || note.call_recording_id) && (
                          <div>
                            <h5 className="font-medium text-sm mb-1">References</h5>
                            <div className="text-sm space-y-1">
                              {note.claim_reference && <p>Claim: {note.claim_reference}</p>}
                              {note.call_recording_id && <p>Call Recording: {note.call_recording_id}</p>}
                            </div>
                          </div>
                        )}

                        {/* Audit */}
                        <div className="text-xs text-muted-foreground pt-2 border-t">
                          Created: {formatUKDateTime(note.created_at)}
                          {note.updated_at !== note.created_at && ` • Updated: ${formatUKDateTime(note.updated_at)}`}
                        </div>
                      </div>
                    </CollapsibleContent>
                  </div>
                </Collapsible>
              );
            })}
          </div>
        )}
      </CardContent>

      {/* Dialog */}
      <StructuredNoteDialog
        open={dialogOpen}
        onOpenChange={setDialogOpen}
        customerId={customerId}
        customerName={customerName}
        policyNumber={policyNumber}
        vehicleReg={vehicleReg}
        existingNote={editingNote as any}
        onSaved={fetchNotes}
      />

      {/* Delete Confirmation */}
      <AlertDialog open={!!deleteConfirm} onOpenChange={() => setDeleteConfirm(null)}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Delete Note?</AlertDialogTitle>
            <AlertDialogDescription>
              This action cannot be undone. The note will be permanently deleted.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancel</AlertDialogCancel>
            <AlertDialogAction onClick={() => deleteConfirm && handleDelete(deleteConfirm)} className="bg-destructive text-destructive-foreground">
              Delete
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </Card>
  );
}
