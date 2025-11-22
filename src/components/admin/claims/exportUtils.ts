export const exportToCSV = (data: any[], filename: string) => {
  if (data.length === 0) {
    return;
  }

  // Get headers from first object
  const headers = Object.keys(data[0]);
  
  // Create CSV content
  const csvContent = [
    headers.join(','), // Header row
    ...data.map(row => 
      headers.map(header => {
        const value = row[header];
        // Handle values that might contain commas or quotes
        if (value === null || value === undefined) return '';
        const stringValue = String(value);
        if (stringValue.includes(',') || stringValue.includes('"') || stringValue.includes('\n')) {
          return `"${stringValue.replace(/"/g, '""')}"`;
        }
        return stringValue;
      }).join(',')
    )
  ].join('\n');

  // Create blob and download
  const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' });
  const link = document.createElement('a');
  const url = URL.createObjectURL(blob);
  link.setAttribute('href', url);
  link.setAttribute('download', `${filename}_${new Date().toISOString().split('T')[0]}.csv`);
  link.style.visibility = 'hidden';
  document.body.appendChild(link);
  link.click();
  document.body.removeChild(link);
};

export const exportToPDF = async (data: any[], filename: string) => {
  // For PDF export, we'll create a simple HTML structure and use window.print
  // In a production environment, you might want to use a library like jsPDF or pdfmake
  
  const htmlContent = `
    <!DOCTYPE html>
    <html>
    <head>
      <title>${filename}</title>
      <style>
        body { font-family: Arial, sans-serif; margin: 20px; }
        h1 { color: #f97316; }
        table { width: 100%; border-collapse: collapse; margin-top: 20px; }
        th, td { border: 1px solid #ddd; padding: 8px; text-align: left; }
        th { background-color: #f97316; color: white; }
        tr:nth-child(even) { background-color: #f2f2f2; }
        .header { margin-bottom: 20px; }
        .footer { margin-top: 20px; text-align: center; color: #666; font-size: 12px; }
      </style>
    </head>
    <body>
      <div class="header">
        <h1>Claims Report</h1>
        <p>Generated on: ${new Date().toLocaleString('en-GB')}</p>
        <p>Total Records: ${data.length}</p>
      </div>
      
      <table>
        <thead>
          <tr>
            ${Object.keys(data[0] || {}).map(key => `<th>${key}</th>`).join('')}
          </tr>
        </thead>
        <tbody>
          ${data.map(row => `
            <tr>
              ${Object.values(row).map(value => `<td>${value || '-'}</td>`).join('')}
            </tr>
          `).join('')}
        </tbody>
      </table>
      
      <div class="footer">
        <p>Buy a Warranty - Claims Management System</p>
      </div>
      
      <script>
        window.onload = function() {
          window.print();
          setTimeout(function() { window.close(); }, 100);
        }
      </script>
    </body>
    </html>
  `;

  const printWindow = window.open('', '_blank');
  if (printWindow) {
    printWindow.document.write(htmlContent);
    printWindow.document.close();
  }
};

export const formatClaimForExport = (claim: any) => {
  return {
    'Claim ID': claim.id,
    'Date Submitted': new Date(claim.created_at).toLocaleDateString('en-GB'),
    'Customer Name': claim.name,
    'Email': claim.email,
    'Phone': claim.phone || 'N/A',
    'Vehicle Registration': claim.vehicle_registration || 'N/A',
    'Warranty Type': claim.warranty_type || 'N/A',
    'Claim Reason': claim.claim_reason || 'N/A',
    'Status': claim.status,
    'Payment Amount (£)': claim.payment_amount || 0,
    'Date Approved': claim.approved_at ? new Date(claim.approved_at).toLocaleDateString('en-GB') : 'N/A',
    'Date Paid': claim.paid_at ? new Date(claim.paid_at).toLocaleDateString('en-GB') : 'N/A',
  };
};
