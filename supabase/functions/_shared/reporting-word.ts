import { Document, Packer, Paragraph, HeadingLevel, Table, TableRow, TableCell, WidthType, TextRun } from 'npm:docx@9.5.1';

const money = (v: number) => new Intl.NumberFormat('en-GB', { style: 'currency', currency: 'GBP' }).format(v);
const lines = (text: string) => text.split(/\r?\n/).map(line => new Paragraph(line));
export async function reportingWord(snapshot: any, invoiceNumber?: string): Promise<string> {
  const title = invoiceNumber ? `Invoice ${invoiceNumber}` : 'Sales and commission report';
  const widths = [5000, 4026];
  const rows = [
    ['Period', `${snapshot.from} to ${snapshot.to}`],
    ['Sales selection', snapshot.account.sales_source],
    ['Number of sales', String(snapshot.salesCount)],
    ['Total sales', money(snapshot.salesTotal)],
    [`Head office charge (${snapshot.account.commission_pct}%)`, money(snapshot.commission)],
    [`VAT (${snapshot.account.vat_pct}%)`, money(snapshot.vat)],
    ['Total invoice amount', money(snapshot.total)],
  ];
  const doc = new Document({ styles: { default: { document: { run: { font: 'Arial', size: 22 } } } }, sections: [{
    properties: { page: { size: { width: 11906, height: 16838 }, margin: { top: 1440, bottom: 1440, left: 1440, right: 1440 } } },
    children: [new Paragraph({ heading: HeadingLevel.HEADING_1, children: [new TextRun({ text: title, bold: true })] }),
      ...lines(snapshot.account.document_intro),
      ...(invoiceNumber ? [new Paragraph({ heading: HeadingLevel.HEADING_2, text: 'From' }), ...lines(snapshot.account.invoice_from), new Paragraph({ heading: HeadingLevel.HEADING_2, text: 'Invoice to' }), ...lines(snapshot.account.invoice_to)] : []),
      new Paragraph(''), new Table({ width: { size: 9026, type: WidthType.DXA }, columnWidths: widths, rows: rows.map(row => new TableRow({ children: row.map((text, i) => new TableCell({ width: { size: widths[i], type: WidthType.DXA }, margins: { top: 100, bottom: 100, left: 120, right: 120 }, children: [new Paragraph(text)] })) })) }),
      new Paragraph({ heading: HeadingLevel.HEADING_2, text: 'Sales by source' }),
      ...Object.entries(snapshot.sources ?? {}).map(([source, summary]: [string, any]) => new Paragraph(`${source}: ${summary.count} sales — ${money(summary.total)}`)),
      ...(invoiceNumber ? [new Paragraph({ heading: HeadingLevel.HEADING_2, text: 'Payment details and terms' }), ...lines(snapshot.account.payment_details)] : []),
    ],
  }] });
  return await Packer.toBase64String(doc);
}