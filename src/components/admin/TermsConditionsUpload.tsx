import React, { useState, useEffect } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { useToast } from '@/hooks/use-toast';
import { Upload, FileText, Trash2, Download } from 'lucide-react';

interface TermsDocument {
  id: string;
  document_name: string;
  file_url: string;
  file_size: number | null;
  created_at: string;
}

const TermsConditionsUpload = () => {
  const { toast } = useToast();
  const [documents, setDocuments] = useState<TermsDocument[]>([]);
  const [loading, setLoading] = useState(true);
  const [uploading, setUploading] = useState(false);
  const [documentName, setDocumentName] = useState<string>('Terms and Conditions');
  const [selectedFile, setSelectedFile] = useState<File | null>(null);

  useEffect(() => {
    fetchTermsDocuments();
  }, []);

  const fetchTermsDocuments = async () => {
    try {
      const { data, error } = await supabase
        .from('customer_documents')
        .select('*')
        .eq('plan_type', 'terms-and-conditions')
        .order('created_at', { ascending: false });

      if (error) throw error;
      setDocuments(data || []);
    } catch (error) {
      console.error('Error fetching terms documents:', error);
      toast({
        title: "Error",
        description: "Failed to fetch terms and conditions documents.",
        variant: "destructive",
      });
    } finally {
      setLoading(false);
    }
  };

  const handleFileSelect = (event: React.ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
    if (file) {
      if (file.type !== 'application/pdf') {
        toast({
          title: "Invalid file type",
          description: "Please select a PDF file.",
          variant: "destructive",
        });
        return;
      }
      setSelectedFile(file);
      if (!documentName || documentName === 'Terms and Conditions') {
        setDocumentName(file.name.replace('.pdf', ''));
      }
    }
  };

  const uploadDocument = async () => {
    console.log('Upload terms document called with:', {
      selectedFile: selectedFile?.name,
      documentName
    });

    if (!selectedFile || !documentName) {
      console.log('Missing required fields');
      toast({
        title: "Missing information",
        description: "Please select a file and enter a document name.",
        variant: "destructive",
      });
      return;
    }

    setUploading(true);
    try {
      // Create a unique file path for terms and conditions
      const fileExt = selectedFile.name.split('.').pop();
      const filePath = `terms-and-conditions/${documentName}-${Date.now()}.${fileExt}`;
      
      console.log('Attempting to upload terms document to path:', filePath);
      
      // Upload file to Supabase Storage
      const { data: uploadData, error: uploadError } = await supabase.storage
        .from('policy-documents')
        .upload(filePath, selectedFile);

      console.log('Storage upload result:', { uploadData, uploadError });

      if (uploadError) {
        console.error('Storage upload error:', uploadError);
        throw uploadError;
      }

      // Get the public URL
      const { data: { publicUrl } } = supabase.storage
        .from('policy-documents')
        .getPublicUrl(filePath);
      
      console.log('Generated public URL:', publicUrl);
      
      // Save document metadata to database with plan_type as 'terms-and-conditions'
      const insertData = {
        plan_type: 'terms-and-conditions',
        document_name: documentName,
        file_url: publicUrl,
        file_size: selectedFile.size,
      };
      
      console.log('Inserting terms document metadata:', insertData);
      
      const { error } = await supabase
        .from('customer_documents')
        .insert(insertData);

      if (error) {
        console.error('Database insert error:', error);
        throw error;
      }

      console.log('Terms document uploaded successfully');

      toast({
        title: "Document uploaded",
        description: "The terms and conditions document has been successfully uploaded and will be sent to all new customers.",
      });

      // Reset form
      setSelectedFile(null);
      setDocumentName('Terms and Conditions');
      const fileInput = document.getElementById('terms-file-upload') as HTMLInputElement;
      if (fileInput) fileInput.value = '';

      // Refresh documents list
      fetchTermsDocuments();
    } catch (error) {
      console.error('Error uploading terms document:', error);
      toast({
        title: "Upload failed",
        description: `Failed to upload document: ${error.message || error}`,
        variant: "destructive",
      });
    } finally {
      setUploading(false);
    }
  };

  const deleteDocument = async (id: string) => {
    try {
      const { error } = await supabase
        .from('customer_documents')
        .delete()
        .eq('id', id);

      if (error) throw error;

      toast({
        title: "Document deleted",
        description: "The terms and conditions document has been successfully deleted.",
      });

      fetchTermsDocuments();
    } catch (error) {
      console.error('Error deleting terms document:', error);
      toast({
        title: "Delete failed",
        description: "Failed to delete document. Please try again.",
        variant: "destructive",
      });
    }
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center h-32">
        <div className="animate-spin rounded-full h-16 w-16 border-b-2 border-blue-600"></div>
      </div>
    );
  }

  return (
    <Card>
      <CardHeader>
        <CardTitle className="flex items-center gap-2">
          <FileText className="h-5 w-5" />
          Terms and Conditions Document
        </CardTitle>
        <CardDescription>
          Upload the terms and conditions document that will be automatically sent to every customer in their welcome email.
        </CardDescription>
      </CardHeader>
      <CardContent className="space-y-6">
        {/* Upload Section */}
        <div className="space-y-4">
          <div>
            <Label htmlFor="terms-document-name">Document Name</Label>
            <Input
              id="terms-document-name"
              value={documentName}
              onChange={(e) => setDocumentName(e.target.value)}
              placeholder="e.g., Terms and Conditions 2024"
            />
          </div>
          
          <div>
            <Label htmlFor="terms-file-upload">PDF Document</Label>
            <Input
              id="terms-file-upload"
              type="file"
              accept=".pdf"
              onChange={handleFileSelect}
              className="cursor-pointer"
            />
            {selectedFile && (
              <p className="text-sm text-gray-600 mt-1">
                Selected: {selectedFile.name} ({Math.round(selectedFile.size / 1024)} KB)
              </p>
            )}
          </div>

          <Button 
            onClick={uploadDocument} 
            disabled={uploading || !selectedFile || !documentName}
            className="w-full"
          >
            {uploading ? (
              <div className="flex items-center">
                <div className="animate-spin rounded-full h-4 w-4 border-b-2 border-white mr-2"></div>
                Uploading...
              </div>
            ) : (
              <div className="flex items-center">
                <Upload className="mr-2 h-4 w-4" />
                Upload Terms & Conditions Document
              </div>
            )}
          </Button>
        </div>

        {/* Current Document Section */}
        <div className="border-t pt-4">
          <h4 className="font-medium text-gray-900 mb-3">Current Terms & Conditions Document</h4>
          {documents.length === 0 ? (
            <div className="text-center text-gray-500 py-6 bg-gray-50 rounded-lg">
              <FileText className="h-12 w-12 mx-auto text-gray-300 mb-2" />
              <p>No terms and conditions document uploaded yet.</p>
              <p className="text-sm">Upload one above to send it to all new customers.</p>
            </div>
          ) : (
            <div className="space-y-3">
              {documents.map((doc) => (
                <div key={doc.id} className="flex items-center justify-between p-4 border rounded-lg bg-green-50 border-green-200">
                  <div className="flex items-center space-x-3">
                    <FileText className="h-5 w-5 text-green-600" />
                    <div>
                      <p className="font-medium text-green-900">{doc.document_name}</p>
                      <p className="text-sm text-green-700">
                        Uploaded {new Date(doc.created_at).toLocaleDateString()}
                        {doc.file_size && ` • ${Math.round(doc.file_size / 1024)} KB`}
                      </p>
                      <p className="text-xs text-green-600 mt-1">
                        ✓ This document will be sent to all new customers
                      </p>
                    </div>
                  </div>
                  <div className="flex items-center space-x-2">
                    <Button variant="outline" size="sm" asChild>
                      <a href={doc.file_url} target="_blank" rel="noopener noreferrer">
                        <Download className="h-4 w-4 mr-1" />
                        View
                      </a>
                    </Button>
                    <Button 
                      variant="outline" 
                      size="sm"
                      onClick={() => deleteDocument(doc.id)}
                      className="text-red-600 hover:text-red-700 hover:bg-red-50"
                    >
                      <Trash2 className="h-4 w-4" />
                    </Button>
                  </div>
                </div>
              ))}
              {documents.length > 1 && (
                <div className="text-xs text-amber-600 bg-amber-50 p-2 rounded border border-amber-200">
                  ⚠️ Multiple documents found. Only the most recently uploaded document will be sent to customers.
                </div>
              )}
            </div>
          )}
        </div>
      </CardContent>
    </Card>
  );
};

export default TermsConditionsUpload;