import React from 'react';
import { supabase } from '@/integrations/supabase/client';
import { format, differenceInCalendarDays } from 'date-fns';
import {
  Briefcase, Clock, Download, FileText, Loader2, Mail, Phone, RefreshCw,
  ShieldCheck, Star, ThumbsDown, UserCheck, PauseCircle,
} from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Textarea } from '@/components/ui/textarea';
import { Input } from '@/components/ui/input';
import { toast } from 'sonner';

type Status = 'new' | 'shortlisted' | 'interview' | 'hired' | 'rejected' | 'on_hold';

interface Application {
  id: string;
  full_name: string;
  email: string | null;
  phone: string | null;
  role_applied: string;
  covering_note: string | null;
  cv_file_name: string | null;
  cv_storage_path: string | null;
  status: Status;
  applied_at: string;
  rejection_due_at: string | null;
  acknowledgement_sent_at: string | null;
  rejection_sent_at: string | null;
  auto_reject_enabled: boolean;
  internal_notes: string | null;
}

const STATUS_META: Record<Status, { label: string; className: string }> = {
  new: { label: 'Awaiting decision', className: 'border-amber-500 text-amber-700 bg-amber-50' },
  shortlisted: { label: 'Shortlisted', className: 'border-emerald-500 text-emerald-700 bg-emerald-50' },
  interview: { label: 'Interview', className: 'border-blue-500 text-blue-700 bg-blue-50' },
  hired: { label: 'Hired', className: 'border-violet-500 text-violet-700 bg-violet-50' },
  rejected: { label: 'Rejected', className: 'border-rose-500 text-rose-700 bg-rose-50' },
  on_hold: { label: 'On hold', className: 'border-slate-400 text-slate-700 bg-slate-50' },
};

const FILTERS: { id: 'live' | 'all' | Status; label: string }[] = [
  { id: 'live', label: 'Needs a decision' },
  { id: 'shortlisted', label: 'Shortlisted' },
  { id: 'interview', label: 'Interview' },
  { id: 'hired', label: 'Hired' },
  { id: 'rejected', label: 'Rejected' },
  { id: 'all', label: 'All' },
];

export const CareerApplicationsTab: React.FC<{ canEdit?: boolean }> = ({ canEdit = true }) => {
  const [rows, setRows] = React.useState<Application[]>([]);
  const [loading, setLoading] = React.useState(true);
  const [busy, setBusy] = React.useState<string | null>(null);
  const [filter, setFilter] = React.useState<'live' | 'all' | Status>('live');
  const [search, setSearch] = React.useState('');
  const [noteDraft, setNoteDraft] = React.useState<Record<string, string>>({});

  const load = React.useCallback(async () => {
    setLoading(true);
    const { data, error } = await supabase
      .from('career_applications')
      .select('*')
      .order('applied_at', { ascending: false })
      .limit(500);
    if (error) toast.error(error.message);
    setRows((data || []) as Application[]);
    setLoading(false);
  }, []);

  React.useEffect(() => { load(); }, [load]);

  const setStatus = async (row: Application, status: Status) => {
    setBusy(row.id);
    const { data: me } = await supabase.auth.getUser();
    let adminId: string | null = null;
    if (me.user?.id) {
      const { data: au } = await supabase
        .from('admin_users').select('id').eq('user_id', me.user.id).maybeSingle();
      adminId = (au as any)?.id ?? null;
    }
    const { error } = await supabase
      .from('career_applications')
      .update({ status, decided_by: adminId, decided_at: new Date().toISOString() })
      .eq('id', row.id);
    setBusy(null);
    if (error) { toast.error(error.message); return; }
    toast.success(
      status === 'rejected'
        ? `${row.full_name} marked as rejected`
        : `${row.full_name} → ${STATUS_META[status].label}. Automatic rejection stopped.`,
    );
    load();
  };

  const saveNote = async (row: Application) => {
    const value = noteDraft[row.id] ?? '';
    setBusy(row.id);
    const { error } = await supabase
      .from('career_applications')
      .update({ internal_notes: value })
      .eq('id', row.id);
    setBusy(null);
    if (error) { toast.error(error.message); return; }
    toast.success('Note saved');
    load();
  };

  const downloadCv = async (row: Application) => {
    if (!row.cv_storage_path) { toast.error('No CV stored for this application'); return; }
    const { data, error } = await supabase.storage
      .from('career-cvs')
      .createSignedUrl(row.cv_storage_path, 300);
    if (error || !data?.signedUrl) { toast.error(error?.message || 'Could not open the CV'); return; }
    window.open(data.signedUrl, '_blank', 'noopener,noreferrer');
  };

  const filtered = rows.filter(r => {
    if (filter === 'live' && r.status !== 'new') return false;
    if (filter !== 'live' && filter !== 'all' && r.status !== filter) return false;
    if (search.trim()) {
      const q = search.toLowerCase();
      const hay = `${r.full_name} ${r.email || ''} ${r.phone || ''}`.toLowerCase();
      if (!hay.includes(q)) return false;
    }
    return true;
  });

  const awaiting = rows.filter(r => r.status === 'new');
  const dueToday = awaiting.filter(
    r => r.rejection_due_at && differenceInCalendarDays(new Date(r.rejection_due_at), new Date()) <= 0,
  );

  const countdown = (row: Application) => {
    if (!row.rejection_due_at) return null;
    const days = differenceInCalendarDays(new Date(row.rejection_due_at), new Date());
    if (days <= 0) return <span className="text-rose-700 font-semibold">Rejection sends on the next sweep</span>;
    return (
      <span className={days <= 1 ? 'text-rose-700 font-semibold' : 'text-amber-700'}>
        Rejection sends in {days} day{days === 1 ? '' : 's'} ({format(new Date(row.rejection_due_at), 'EEE d MMM')})
      </span>
    );
  };

  return (
    <div className="p-4 sm:p-6 max-w-6xl mx-auto space-y-5">
      <div className="flex items-start justify-between flex-wrap gap-3">
        <div>
          <h1 className="text-2xl font-bold tracking-tight text-foreground flex items-center gap-2">
            <Briefcase className="h-6 w-6 text-muted-foreground" />
            Careers Applications
          </h1>
          <p className="text-sm text-muted-foreground mt-1 max-w-2xl">
            Every application from the careers page lands here. Anyone still awaiting a decision after
            5 working days is sent the polite rejection letter automatically — shortlist the people you want to
            speak to and their clock stops for good.
          </p>
        </div>
        <Button variant="outline" size="sm" onClick={load} disabled={loading}>
          <RefreshCw className={`h-3.5 w-3.5 mr-1.5 ${loading ? 'animate-spin' : ''}`} />
          Refresh
        </Button>
      </div>

      {/* Summary */}
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
        {[
          { label: 'Awaiting decision', value: awaiting.length, tone: 'text-amber-700' },
          { label: 'Rejection due now', value: dueToday.length, tone: 'text-rose-700' },
          { label: 'Shortlisted', value: rows.filter(r => r.status === 'shortlisted').length, tone: 'text-emerald-700' },
          { label: 'Total applications', value: rows.length, tone: 'text-foreground' },
        ].map(s => (
          <Card key={s.label}>
            <CardContent className="py-3 px-4">
              <div className={`text-2xl font-bold ${s.tone}`}>{s.value}</div>
              <div className="text-[11px] uppercase tracking-wide text-muted-foreground mt-0.5">{s.label}</div>
            </CardContent>
          </Card>
        ))}
      </div>

      <Card className="border-amber-300 bg-amber-50/60">
        <CardContent className="py-3 px-4 text-xs text-amber-900 flex items-start gap-2">
          <ShieldCheck className="h-4 w-4 mt-0.5 shrink-0" />
          <span>
            <strong>How this works.</strong> Applicants get an instant acknowledgement when they apply. If you do
            nothing, the rejection letter sends automatically on working day 5 (Mon–Fri, bank holidays skipped).
            Marking someone <strong>Shortlisted</strong>, <strong>Interview</strong>, <strong>Hired</strong> or
            <strong> On hold</strong> stops their rejection permanently — that's how you tell us you want them.
          </span>
        </CardContent>
      </Card>

      {/* Filters */}
      <div className="flex flex-wrap items-center gap-2">
        {FILTERS.map(f => (
          <button
            key={f.id}
            type="button"
            onClick={() => setFilter(f.id)}
            className={`px-3 py-1 text-xs font-medium rounded-full border transition-colors ${
              filter === f.id
                ? 'bg-foreground text-background border-foreground'
                : 'bg-background text-muted-foreground border-border hover:bg-muted'
            }`}
          >
            {f.label}
          </button>
        ))}
        <Input
          value={search}
          onChange={e => setSearch(e.target.value)}
          placeholder="Search name, email or phone…"
          className="h-8 w-full sm:w-64 ml-auto"
        />
      </div>

      {/* List */}
      {loading ? (
        <div className="py-16 text-center text-sm text-muted-foreground">Loading applications…</div>
      ) : filtered.length === 0 ? (
        <Card>
          <CardContent className="py-12 text-center text-sm text-muted-foreground">
            No applications in this view yet.
          </CardContent>
        </Card>
      ) : (
        <div className="space-y-3">
          {filtered.map(row => {
            const meta = STATUS_META[row.status];
            return (
              <Card key={row.id}>
                <CardHeader className="pb-2">
                  <div className="flex flex-wrap items-start justify-between gap-3">
                    <div className="min-w-0">
                      <CardTitle className="text-base flex flex-wrap items-center gap-2">
                        {row.full_name}
                        <Badge variant="outline" className={meta.className}>{meta.label}</Badge>
                      </CardTitle>
                      <div className="text-xs text-muted-foreground mt-1">
                        {row.role_applied} · applied {format(new Date(row.applied_at), 'EEE d MMM yyyy, HH:mm')}
                      </div>
                      <div className="flex flex-wrap items-center gap-3 text-xs mt-1.5">
                        {row.email && (
                          <a href={`mailto:${row.email}`} className="inline-flex items-center gap-1 text-primary hover:underline">
                            <Mail className="h-3 w-3" />{row.email}
                          </a>
                        )}
                        {row.phone && (
                          <a href={`tel:${row.phone}`} className="inline-flex items-center gap-1 text-primary hover:underline">
                            <Phone className="h-3 w-3" />{row.phone}
                          </a>
                        )}
                        {row.cv_storage_path ? (
                          <button
                            type="button"
                            onClick={() => downloadCv(row)}
                            className="inline-flex items-center gap-1 text-primary hover:underline"
                          >
                            <Download className="h-3 w-3" />{row.cv_file_name || 'CV'}
                          </button>
                        ) : row.cv_file_name ? (
                          <span className="inline-flex items-center gap-1 text-muted-foreground">
                            <FileText className="h-3 w-3" />{row.cv_file_name} (emailed only)
                          </span>
                        ) : null}
                      </div>
                    </div>

                    <div className="text-xs text-right shrink-0">
                      {row.status === 'new' ? (
                        <div className="inline-flex items-center gap-1.5">
                          <Clock className="h-3.5 w-3.5 text-amber-600" />
                          {countdown(row)}
                        </div>
                      ) : row.rejection_sent_at ? (
                        <span className="text-muted-foreground">
                          Rejection sent {format(new Date(row.rejection_sent_at), 'd MMM yyyy')}
                        </span>
                      ) : (
                        <span className="text-emerald-700">Auto-rejection stopped</span>
                      )}
                      <div className="text-[11px] text-muted-foreground mt-0.5">
                        {row.acknowledgement_sent_at ? 'Acknowledgement sent' : 'No acknowledgement sent'}
                      </div>
                    </div>
                  </div>
                </CardHeader>

                <CardContent className="pt-0 space-y-3">
                  {row.covering_note && (
                    <p className="text-sm text-muted-foreground whitespace-pre-line border-l-2 border-border pl-3">
                      {row.covering_note}
                    </p>
                  )}

                  {canEdit && (
                    <div className="flex flex-wrap gap-2">
                      <Button
                        size="sm"
                        className="h-8 bg-emerald-600 hover:bg-emerald-700 text-white"
                        disabled={busy === row.id || row.status === 'shortlisted'}
                        onClick={() => setStatus(row, 'shortlisted')}
                      >
                        {busy === row.id ? <Loader2 className="h-3.5 w-3.5 mr-1.5 animate-spin" /> : <Star className="h-3.5 w-3.5 mr-1.5" />}
                        Shortlist — we want to speak to them
                      </Button>
                      <Button size="sm" variant="outline" className="h-8" disabled={busy === row.id}
                        onClick={() => setStatus(row, 'interview')}>
                        <UserCheck className="h-3.5 w-3.5 mr-1.5" />Interview
                      </Button>
                      <Button size="sm" variant="outline" className="h-8" disabled={busy === row.id}
                        onClick={() => setStatus(row, 'hired')}>
                        <ShieldCheck className="h-3.5 w-3.5 mr-1.5" />Hired
                      </Button>
                      <Button size="sm" variant="outline" className="h-8" disabled={busy === row.id}
                        onClick={() => setStatus(row, 'on_hold')}>
                        <PauseCircle className="h-3.5 w-3.5 mr-1.5" />On hold
                      </Button>
                      {row.status === 'new' && (
                        <Button
                          size="sm"
                          variant="outline"
                          className="h-8 border-rose-400 text-rose-700 hover:bg-rose-50"
                          disabled={busy === row.id}
                          onClick={() => setStatus(row, 'rejected')}
                        >
                          <ThumbsDown className="h-3.5 w-3.5 mr-1.5" />Reject now
                        </Button>
                      )}
                    </div>
                  )}

                  {canEdit && (
                    <div className="flex flex-col sm:flex-row gap-2 items-start">
                      <Textarea
                        value={noteDraft[row.id] ?? row.internal_notes ?? ''}
                        onChange={e => setNoteDraft(p => ({ ...p, [row.id]: e.target.value }))}
                        placeholder="Internal note (applicants never see this)…"
                        className="text-sm min-h-[38px]"
                        rows={1}
                      />
                      <Button size="sm" variant="outline" className="h-9 shrink-0"
                        disabled={busy === row.id} onClick={() => saveNote(row)}>
                        Save note
                      </Button>
                    </div>
                  )}
                </CardContent>
              </Card>
            );
          })}
        </div>
      )}
    </div>
  );
};

export default CareerApplicationsTab;
