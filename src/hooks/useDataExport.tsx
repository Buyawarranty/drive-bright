import { useCallback } from 'react';
import { toast } from 'sonner';

interface ExportOptions {
  filename: string;
  format: 'csv' | 'xlsx';
}

export function useDataExport() {
  const exportToCSV = useCallback((data: Record<string, any>[], options: ExportOptions) => {
    if (!data || data.length === 0) {
      toast.error('No data to export');
      return;
    }

    try {
      // Get headers from first object
      const headers = Object.keys(data[0]);
      
      // Create CSV content
      const csvContent = [
        headers.join(','),
        ...data.map(row => 
          headers.map(header => {
            const value = row[header];
            // Handle null, undefined, objects
            if (value === null || value === undefined) return '';
            if (typeof value === 'object') return JSON.stringify(value).replace(/,/g, ';');
            // Escape quotes and wrap in quotes if contains comma
            const stringValue = String(value);
            if (stringValue.includes(',') || stringValue.includes('"') || stringValue.includes('\n')) {
              return `"${stringValue.replace(/"/g, '""')}"`;
            }
            return stringValue;
          }).join(',')
        )
      ].join('\n');

      // Create and download file
      const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' });
      const link = document.createElement('a');
      const url = URL.createObjectURL(blob);
      
      link.setAttribute('href', url);
      link.setAttribute('download', `${options.filename}_${new Date().toISOString().split('T')[0]}.csv`);
      link.style.visibility = 'hidden';
      document.body.appendChild(link);
      link.click();
      document.body.removeChild(link);
      URL.revokeObjectURL(url);
      
      toast.success(`Exported ${data.length} records to CSV`);
    } catch (error) {
      console.error('Export error:', error);
      toast.error('Failed to export data');
    }
  }, []);

  const exportToExcel = useCallback((data: Record<string, any>[], options: ExportOptions) => {
    // For Excel, we'll use CSV with .xlsx extension (Excel can open CSV files)
    // For proper XLSX support, you'd need a library like xlsx
    if (!data || data.length === 0) {
      toast.error('No data to export');
      return;
    }

    try {
      const headers = Object.keys(data[0]);
      
      // Tab-separated values work better for Excel
      const tsvContent = [
        headers.join('\t'),
        ...data.map(row => 
          headers.map(header => {
            const value = row[header];
            if (value === null || value === undefined) return '';
            if (typeof value === 'object') return JSON.stringify(value);
            return String(value).replace(/\t/g, ' ');
          }).join('\t')
        )
      ].join('\n');

      const blob = new Blob([tsvContent], { type: 'application/vnd.ms-excel;charset=utf-8;' });
      const link = document.createElement('a');
      const url = URL.createObjectURL(blob);
      
      link.setAttribute('href', url);
      link.setAttribute('download', `${options.filename}_${new Date().toISOString().split('T')[0]}.csv`);
      link.style.visibility = 'hidden';
      document.body.appendChild(link);
      link.click();
      document.body.removeChild(link);
      URL.revokeObjectURL(url);
      
      toast.success(`Exported ${data.length} records to CSV`);
    } catch (error) {
      console.error('Export error:', error);
      toast.error('Failed to export data');
    }
  }, []);

  return { exportToCSV, exportToExcel };
}
