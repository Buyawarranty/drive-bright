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
    return ageDays <= recentDays;
  });

  // Combine all recent doc ids into a single dismissal key so updating ANY doc
  // re-surfaces the banner, but we only ever show ONE banner at a time.
  const bundleKey = recent.map(([, d]) => d.id).sort().join('|');
  const bundleDismissed = bundleKey
    ? localStorage.getItem(`doc-update-dismissed-${bundleKey}`) === '1' || dismissed[bundleKey]
    : true;

  const dismissBundle = () => {
    if (!bundleKey) return;
    localStorage.setItem(`doc-update-dismissed-${bundleKey}`, '1');
    setDismissed((prev) => ({ ...prev, [bundleKey]: true }));
  };

  if (Object.keys(docs).length === 0) return null;

  // Build a single friendly message that covers 1 or many updated docs.
  const showBanner = recent.length > 0 && !bundleDismissed;
  const latestDate = recent.length
    ? formatDate(
        recent
          .map(([, d]) => d.created_at)
          .sort()
          .reverse()[0]
      )
    : '';
  const docNames = recent.map(([planType]) => LABELS[planType] ?? planType);
  const docsLabel =
    docNames.length === 1
      ? docNames[0]
      : docNames.length === 2
      ? `${docNames[0]} and ${docNames[1]}`
      : `${docNames.slice(0, -1).join(', ')} and ${docNames[docNames.length - 1]}`;

  return (
    <div className={`space-y-3 ${className}`}>
      {showBanner && (
        <div
          className="flex items-start gap-3 rounded-lg border border-blue-200 bg-blue-50 px-4 py-3"
          role="status"
        >
          <Info className="mt-0.5 h-4 w-4 flex-shrink-0 text-blue-600" />
          <div className="flex-1 text-sm text-blue-900">
            {recent.length > 1 ? (
              <>
                Your <strong>{docsLabel}</strong> documents have been updated
                (latest change <strong>{latestDate}</strong>). Please review the
                latest versions below.
              </>
            ) : (
              <>
                Your <strong>{docsLabel}</strong> document was updated on{' '}
                <strong>{latestDate}</strong>.{' '}
                <a
                  href={recent[0][1].file_url}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="font-semibold underline hover:text-blue-700"
                >
                  View latest version
                </a>
              </>
            )}
          </div>
          <button
            onClick={dismissBundle}
            aria-label="Close notification"
            title="Close"
            className="flex-shrink-0 rounded-md p-1.5 text-blue-700 hover:bg-blue-100 hover:text-blue-900 focus:outline-none focus:ring-2 focus:ring-blue-400"
          >
            <X className="h-5 w-5" strokeWidth={2.5} />
          </button>
        </div>
      )}


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
