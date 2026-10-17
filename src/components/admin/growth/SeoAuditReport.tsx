import { useState } from 'react';
import { Download, ExternalLink } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Badge } from '@/components/ui/badge';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import audit from '@/data/seo-audit-2026-10-17.json';

export default function SeoAuditReport() {
  const [query, setQuery] = useState('');
  const pages = audit.pages.filter(page => `${page.url} ${page.title ?? ''}`.toLowerCase().includes(query.toLowerCase()));
  const download = () => {
    const url = URL.createObjectURL(new Blob([JSON.stringify(audit, null, 2)], { type: 'application/json' }));
    const link = document.createElement('a');
    link.href = url;
    link.download = `buyawarranty-seo-audit-${audit.auditedAt}.json`;
    link.click();
    URL.revokeObjectURL(url);
  };

  return (
    <div className="flex-1 min-h-0 overflow-y-auto space-y-6 pb-6">
      <div className="flex flex-wrap items-start justify-between gap-3 border-b border-border pb-4">
        <div className="space-y-1">
          <h2 className="text-lg font-semibold">Full website audit · 17 October 2026</h2>
          <p className="text-sm text-muted-foreground break-all">{audit.site}</p>
          <p className="text-sm text-muted-foreground">116 public pages checked · 41 published articles · Corrections awaiting publication</p>
        </div>
        <Button variant="outline" onClick={download}><Download className="h-4 w-4 mr-2" />Download report</Button>
      </div>

      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
        {[
          ['Google clicks', '525'], ['Google impressions', '48,672'], ['Click-through rate', '1.08%'], ['Average position', '15.73'],
        ].map(([label, value]) => <div key={label} className="border-l-2 border-primary pl-3"><p className="text-xs text-muted-foreground">{label}</p><p className="text-2xl font-semibold">{value}</p></div>)}
      </div>
      <p className="text-xs text-muted-foreground">Source: {audit.performance.source} · 18 September–15 October 2026 · Google organic search, not ads or social traffic</p>

      <Tabs defaultValue="actions" className="min-w-0">
        <TabsList className="flex flex-wrap h-auto justify-start w-fit">
          <TabsTrigger value="actions">Actions</TabsTrigger>
          <TabsTrigger value="pages">Every page</TabsTrigger>
          <TabsTrigger value="google">Google opportunities</TabsTrigger>
          <TabsTrigger value="coverage">Coverage & limits</TabsTrigger>
        </TabsList>
        <TabsContent value="actions">
          <div className="divide-y divide-border">
            {audit.findings.map(finding => <article key={finding.title} className="py-5 space-y-2">
              <div className="flex flex-wrap items-center gap-2">
                <Badge variant={finding.priority === 'High' ? 'destructive' : 'secondary'}>{finding.priority}</Badge>
                <Badge variant="outline">{finding.status}</Badge>
                <h3 className="font-semibold">{finding.title}</h3>
              </div>
              <p className="text-sm"><span className="font-medium">Evidence: </span>{finding.evidence}</p>
              <p className="text-sm"><span className="font-medium">Action: </span>{finding.action}</p>
              <p className="text-sm text-muted-foreground"><span className="font-medium">Next check: </span>{finding.next}</p>
            </article>)}
          </div>
        </TabsContent>
        <TabsContent value="pages" className="space-y-3">
          <Input value={query} onChange={event => setQuery(event.target.value)} placeholder="Find a page…" aria-label="Find an audited page" className="max-w-md" />
          <p className="text-xs text-muted-foreground">{pages.length} pages · Live HTML at audit time, before these preview corrections</p>
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead className="border-b border-border text-left"><tr><th className="p-2">Page / title</th><th className="p-2">HTTP</th><th className="p-2">Canonical</th><th className="p-2">H1 / content</th><th className="p-2">Share URL</th></tr></thead>
              <tbody>{pages.map(page => <tr key={page.url} className="border-b border-border align-top">
                <td className="p-2 min-w-64 max-w-lg break-words"><a href={page.url} target="_blank" rel="noopener noreferrer" className="text-primary underline inline-flex items-start gap-1 break-all">{new URL(page.url).pathname}<ExternalLink className="h-3 w-3 shrink-0 mt-1" /></a><p className="text-xs text-muted-foreground mt-1">{page.title || 'Missing title'}</p></td>
                <td className="p-2">{page.status}</td>
                <td className="p-2">{page.canonical ? 'Present' : 'Missing'}</td>
                <td className="p-2 whitespace-nowrap">{page.h1.length ? 'H1 present' : 'No H1'}<br />{page.textPresent ? 'Text present' : 'JS required'}</td>
                <td className="p-2">{page.ogUrl ? 'Present' : 'Missing'}</td>
              </tr>)}</tbody>
            </table>
          </div>
        </TabsContent>
        <TabsContent value="google" className="space-y-5">
          <div className="overflow-x-auto">
            <table className="w-full text-sm"><thead className="border-b border-border text-left"><tr>{['Page', 'Clicks', 'Impressions', 'CTR', 'Avg. position'].map(label => <th key={label} className="p-2">{label}</th>)}</tr></thead><tbody>{audit.searchPages.map(page => <tr key={page.path} className="border-b border-border"><td className="p-2 min-w-64 break-all">{page.path}</td><td className="p-2">{page.clicks}</td><td className="p-2">{page.impressions.toLocaleString('en-GB')}</td><td className="p-2">{page.ctr}%</td><td className="p-2">{page.position}</td></tr>)}</tbody></table>
          </div>
          <p className="text-sm">Focus first on existing Land Rover, Mercedes and used-car pages: they already earn impressions. Review search intent and factual answers before changing titles or adding more articles.</p>
          <p className="text-sm text-muted-foreground">Semrush estimates 2,400 monthly UK searches for “used car warranty”, with keyword difficulty 22/100. “Are used car warranties worth it” has an estimated 170 monthly UK searches. Estimates indicate demand, not guaranteed rankings.</p>
        </TabsContent>
        <TabsContent value="coverage">
          <ul className="list-disc pl-5 space-y-3 text-sm text-muted-foreground py-3">{audit.limitations.map(limit => <li key={limit}>{limit}</li>)}</ul>
        </TabsContent>
      </Tabs>
    </div>
  );
}