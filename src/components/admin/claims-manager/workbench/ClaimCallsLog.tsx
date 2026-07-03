import React, { useEffect, useState } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { Phone, ArrowDownLeft, ArrowUpRight, PlayCircle, Loader2 } from 'lucide-react';

interface CallRow {
  id: string;
  direction: string | null;
  status: string | null;
  caller_number: string | null;
  caller_name: string | null;
  started_at: string | null;
  duration_seconds: number | null;
  recording_url: string | null;
}

interface Props {
  phone?: string | null;
}

const normalisePhone = (p?: string | null) => (p || '').toString().replace(/[^0-9]/g, '').replace(/^0+/, '');

const fmtDate = (iso: string | null) => {
  if (!iso) return '—';
  try {
    return new Date(iso).toLocaleString('en-GB', {
      day: '2-digit', month: 'short', year: 'numeric', hour: '2-digit', minute: '2-digit',
    });
  } catch { return iso; }
};

const fmtDuration = (s: number | null) => {
  if (!s || s <= 0) return '—';
  const m = Math.floor(s / 60);
  const sec = s % 60;
  return `${m}m ${sec.toString().padStart(2, '0')}s`;
};

export const ClaimCallsLog: React.FC<Props> = ({ phone }) => {
  const [rows, setRows] = useState<CallRow[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    let cancelled = false;
    const load = async () => {
      setLoading(true);
      const digits = normalisePhone(phone);
      if (!digits || digits.length < 6) {
        setRows([]);
        setLoading(false);
        return;
      }
      // Match on trailing digits — CallRail stores +44… whereas customers store 07…
      const tail = digits.slice(-9);
      const { data } = await supabase
        .from('callrail_calls')
        .select('id, direction, status, caller_number, caller_name, started_at, duration_seconds, recording_url')
        .ilike('caller_number', `%${tail}%`)
        .order('started_at', { ascending: false })
        .limit(50);
      if (!cancelled) {
        setRows((data as CallRow[]) || []);
        setLoading(false);
      }
    };
    load();
    return () => { cancelled = true; };
  }, [phone]);

  return (
    <div className="rounded-lg border border-border bg-card">
      <div className="px-3 py-2 border-b border-border bg-muted/30 flex items-center gap-2">
        <Phone className="h-4 w-4 text-muted-foreground" />
        <span className="text-sm font-semibold text-foreground">Calls log</span>
        <span className="text-[11px] text-muted-foreground">{rows.length}</span>
      </div>
      {loading ? (
        <div className="p-6 flex items-center justify-center text-xs text-muted-foreground">
          <Loader2 className="h-4 w-4 animate-spin mr-2" /> Loading calls…
        </div>
      ) : rows.length === 0 ? (
        <div className="p-6 text-center text-xs text-muted-foreground">
          {phone ? 'No calls found for this number.' : 'No phone number on file.'}
        </div>
      ) : (
        <div className="max-h-72 overflow-y-auto divide-y divide-border">
          {rows.map((r) => (
            <div key={r.id} className="px-3 py-2 flex items-center gap-3 text-xs">
              {r.direction === 'inbound'
                ? <ArrowDownLeft className="h-3.5 w-3.5 text-blue-600 shrink-0" />
                : <ArrowUpRight className="h-3.5 w-3.5 text-green-600 shrink-0" />}
              <div className="min-w-0 flex-1">
                <div className="font-medium text-foreground truncate">
                  {r.caller_name || r.caller_number || 'Unknown'}
                </div>
                <div className="text-[11px] text-muted-foreground">
                  {fmtDate(r.started_at)} · {fmtDuration(r.duration_seconds)} · {r.status || 'call'}
                </div>
              </div>
              {r.recording_url && (
                <a
                  href={r.recording_url}
                  target="_blank"
                  rel="noreferrer"
                  className="inline-flex items-center gap-1 text-orange-600 hover:text-orange-700 font-medium"
                  title="Play recording"
                >
                  <PlayCircle className="h-4 w-4" />
                </a>
              )}
            </div>
          ))}
        </div>
      )}
    </div>
  );
};
