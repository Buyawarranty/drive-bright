import { useCallback } from 'react';
import { toast } from 'sonner';

interface ExportOptions {
  filename: string;
  format: 'csv' | 'xlsx';
}

export function useDataExport() {
  const downloadFile = useCallback((content: string, filename: string, mimeType: string) => {
    try {
      // Add BOM for Excel UTF-8 compatibility
      const bom = '\uFEFF';
      const blob = new Blob([bom + content], { type: mimeType });
      
      // Create download link
      const url = window.URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.style.display = 'none';
      a.href = url;
      a.download = filename;
      
      // Append to body and trigger download
      document.body.appendChild(a);
      a.click();
      
      // Cleanup after a short delay
      setTimeout(() => {
        if (document.body.contains(a)) {
          document.body.removeChild(a);
        }
        window.URL.revokeObjectURL(url);
      }, 150);
    } catch (error) {
      console.error('Download error:', error);
      throw error;
    }
  }, []);

  const exportToCSV = useCallback((data: Record<string, any>[], options: ExportOptions) => {
    if (!data || data.length === 0) {
      toast.error('No data to export');
      return;
    }

    try {
      // Get headers from first object
      const headers = Object.keys(data[0]);
      
      // Create CSV content
      const csvRows = [headers.join(',')];
      
      for (const row of data) {
        const values = headers.map(header => {
          const value = row[header];
          if (value === null || value === undefined) return '';
          if (typeof value === 'object') return `"${JSON.stringify(value).replace(/"/g, '""')}"`;
          const stringValue = String(value);
          // Escape quotes and wrap in quotes if contains comma, quote, or newline
          if (stringValue.includes(',') || stringValue.includes('"') || stringValue.includes('\n')) {
            return `"${stringValue.replace(/"/g, '""')}"`;
          }
          return stringValue;
        });
        csvRows.push(values.join(','));
      }

      const csvContent = csvRows.join('\n');
      const filename = `${options.filename}_${new Date().toISOString().split('T')[0]}.csv`;
      
      downloadFile(csvContent, filename, 'text/csv;charset=utf-8');
      toast.success(`Exported ${data.length} records to CSV`);
    } catch (error) {
      console.error('Export error:', error);
      toast.error('Failed to export data');
    }
  }, [downloadFile]);

  const exportToExcel = useCallback((data: Record<string, any>[], options: ExportOptions) => {
    // Excel can open CSV files, so we use CSV format for compatibility
    if (!data || data.length === 0) {
      toast.error('No data to export');
      return;
    }

    try {
      const headers = Object.keys(data[0]);
      
      // Create CSV content (Excel opens CSV files perfectly)
      const csvRows = [headers.join(',')];
      
      for (const row of data) {
        const values = headers.map(header => {
          const value = row[header];
          if (value === null || value === undefined) return '';
          if (typeof value === 'object') return `"${JSON.stringify(value).replace(/"/g, '""')}"`;
          const stringValue = String(value);
          if (stringValue.includes(',') || stringValue.includes('"') || stringValue.includes('\n')) {
            return `"${stringValue.replace(/"/g, '""')}"`;
          }
          return stringValue;
        });
        csvRows.push(values.join(','));
      }

      const csvContent = csvRows.join('\n');
      const filename = `${options.filename}_${new Date().toISOString().split('T')[0]}.csv`;
      
      downloadFile(csvContent, filename, 'text/csv;charset=utf-8');
      toast.success(`Exported ${data.length} records`);
    } catch (error) {
      console.error('Export error:', error);
      toast.error('Failed to export data');
    }
  }, [downloadFile]);

  return { exportToCSV, exportToExcel };
}
