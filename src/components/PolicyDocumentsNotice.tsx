import React, { useEffect, useState } from 'react';
import { FileText, Info, X } from 'lucide-react';
import { supabase } from '@/integrations/supabase/client';

interface DocMeta {
  id: string;
  file_url: string;
  created_at: string;
}

interface Props {
  /** Plan types to track. Defaults to Platinum + Terms. */
  planTypes?: string[];
  /** How recent (in days) counts as a "recent update" for the banner. */
  recentDays?: number;
  className?: string;
}

const LABELS: Record<string, string> = {
  platinum: 'Platinum Warranty Plan',
  'terms-and-conditions': "Terms & Conditions",
};

const formatDate = (iso: string) =>
  new Date(iso).toLocaleDateString('en-GB', {
    day: 'numeric',
    month: 'long',
    year: 'numeric',
  });

/**
 * Passive in-portal notice that:
 *  - Shows "Last updated: <date>" beneath each policy document link.
 *  - If a doc was uploaded within `recentDays`, shows a dismissible banner.
 *
 * Dismissal is keyed by the document row id, so uploading a new version
 * automatically re-surfaces the banner.
 */
const PolicyDocumentsNotice: React.FC<Props> = ({
  planTypes = ['platinum', 'terms-and-conditions'],
  recentDays = 7,
  className = '',
}) => {
  const [docs, setDocs] = useState<Record<string, DocMeta>>({});
  const [dismissed, setDismissed] = useState<Record<string, boolean>>({});

  useEffect(() => {
    const load = async () => {
      const { data, error } = await supabase
        .from('customer_documents')
        .select('id, plan_type, file_url, created_at')
        .in('plan_type', planTypes)
        .order('created_at', { ascending: false });
      if (error || !data) return;

      const latest: Record<string, DocMeta> = {};
      for (const row of data) {
        if (!latest[row.plan_type]) {
          latest[row.plan_type] = {
            id: row.id,
            file_url: row.file_url,
            created_at: row.created_at,
          };
        }
      }
      setDocs(latest);

      const dis: Record<string, boolean> = {};
      Object.values(latest).forEach((d) => {
        dis[d.id] = localStorage.getItem(`doc-update-dismissed-${d.id}`) === '1';
      });
      setDismissed(dis);
    };
    load();
  }, [planTypes.join(',')]);

  const recent = Object.entries(docs).filter(([, d]) => {
    const ageDays = (Date.now() - new Date(d.created_at).getTime()) / 86_400_000;
    return ageDays <= recentDays && !dismissed[d.id];
  });

  const dismiss = (id: string) => {
    localStorage.setItem(`doc-update-dismissed-${id}`, '1');
    setDismissed((prev) => ({ ...prev, [id]: true }));
  };

  if (Object.keys(docs).length === 0) return null;

  return (
    <div className={`space-y-3 ${className}`}>
      {recent.map(([planType, d]) => (
        <div
          key={d.id}
          className="flex items-start gap-3 rounded-lg border border-blue-200 bg-blue-50 px-4 py-3"
          role="status"
        >
          <Info className="mt-0.5 h-4 w-4 flex-shrink-0 text-blue-600" />
          <div className="flex-1 text-sm text-blue-900">
            Your <strong>{LABELS[planType] ?? planType}</strong> document was
            updated on <strong>{formatDate(d.created_at)}</strong>.{' '}
            <a
              href={d.file_url}
              target="_blank"
              rel="noopener noreferrer"
              className="font-semibold underline hover:text-blue-700"
            >
              View latest version
            </a>
          </div>
          <button
            onClick={() => dismiss(d.id)}
            aria-label="Dismiss notification"
            className="flex-shrink-0 rounded p-1 text-blue-700 hover:bg-blue-100"
          >
            <X className="h-4 w-4" />
          </button>
        </div>
      ))}

      <div className="flex flex-wrap gap-x-6 gap-y-1 text-xs text-gray-500">
        {Object.entries(docs).map(([planType, d]) => (
          <span key={d.id} className="inline-flex items-center gap-1.5">
            <FileText className="h-3 w-3" />
            {LABELS[planType] ?? planType} — Last updated:{' '}
            <span className="font-medium text-gray-700">
              {formatDate(d.created_at)}
            </span>
          </span>
        ))}
      </div>
    </div>
  );
};

export default PolicyDocumentsNotice;
