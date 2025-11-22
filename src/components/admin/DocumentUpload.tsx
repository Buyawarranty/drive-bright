
import React, { useState, useEffect } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { useToast } from '@/hooks/use-toast';
import { Upload, FileText, Trash2 } from 'lucide-react';

interface Document {
  id: string;
  plan_type: string;
  document_name: string;
  file_url: string;
  file_size: number | null;
  created_at: string;
}

const DocumentUpload = () => {
  const { toast } = useToast();
  const [documents, setDocuments] = useState<Document[]>([]);
  const [loading, setLoading] = useState(true);
  const [uploading, setUploading] = useState(false);
  const [selectedPlan, setSelectedPlan] = useState<string>('');
  const [documentName, setDocumentName] = useState<string>('');
  const [selectedFile, setSelectedFile] = useState<File | null>(null);

  useEffect(() => {
    fetchDocuments();
  }, []);

  const fetchDocuments = async () => {
    try {
      const { data, error } = await supabase
        .from('customer_documents')
        .select('*')
        .order('created_at', { ascending: false });

      if (error) throw error;
      setDocuments(data || []);
    } catch (error) {
      console.error('Error fetching documents:', error);
      toast({
        title: "Error",
        description: "Failed to fetch documents.",
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
      if (!documentName) {
        setDocumentName(file.name.replace('.pdf', ''));
      }
    }
  };

  const uploadDocument = async () => {
    console.log('Upload document called with:', {
      selectedFile: selectedFile?.name,
      selectedPlan,
      documentName
    });

    if (!selectedFile || !selectedPlan || !documentName) {
      console.log('Missing required fields');
      toast({
        title: "Missing information",
        description: "Please select a file, plan type, and enter a document name.",
        variant: "destructive",
      });
      return;
    }

    setUploading(true);
    try {
      // Create a unique file path
      const fileExt = selectedFile.name.split('.').pop();
      const filePath = `${selectedPlan}/${documentName}-${Date.now()}.${fileExt}`;
      
      console.log('Attempting to upload to path:', filePath);
      
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
      
      // Save document metadata to database
      const insertData = {
        plan_type: selectedPlan,
        document_name: documentName,
        file_url: publicUrl,
        file_size: selectedFile.size,
      };
      
      console.log('Inserting document metadata:', insertData);
      
      const { error } = await supabase
        .from('customer_documents')
        .insert(insertData);

      if (error) {
        console.error('Database insert error:', error);
        throw error;
      }

      console.log('Document uploaded successfully');

      toast({
        title: "Document uploaded",
        description: "The document has been successfully uploaded.",
      });

      // Reset form
      setSelectedFile(null);
      setSelectedPlan('');
      setDocumentName('');
      const fileInput = document.getElementById('file-upload') as HTMLInputElement;
      if (fileInput) fileInput.value = '';

      // Refresh documents list
      fetchDocuments();
    } catch (error) {
      console.error('Error uploading document:', error);
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
        description: "The document has been successfully deleted.",
      });

      fetchDocuments();
    } catch (error) {
      console.error('Error deleting document:', error);
      toast({
        title: "Delete failed",
        description: "Failed to delete document. Please try again.",
        variant: "destructive",
      });
    }
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center h-64">
        <div className="animate-spin rounded-full h-32 w-32 border-b-2 border-blue-600"></div>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <Card>
        <CardHeader>
          <CardTitle>Upload Policy Documents</CardTitle>
          <CardDescription>
            Upload PDF documents for each warranty plan. These will be sent to customers upon purchase.
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div>
              <Label htmlFor="plan-select">Plan Type</Label>
              <Select value={selectedPlan} onValueChange={setSelectedPlan}>
                <SelectTrigger>
                  <SelectValue placeholder="Select plan type" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="basic">Basic</SelectItem>
                  <SelectItem value="gold">Gold</SelectItem>
                  <SelectItem value="platinum">Platinum</SelectItem>
                  <SelectItem value="electric">Electric Vehicle EV Extended Warranty</SelectItem>
                  <SelectItem value="motorbike">Motorbike Extended Warranty</SelectItem>
                  <SelectItem value="phev">PHEV Hybrid Extended Warranty</SelectItem>
                  <SelectItem value="terms-and-conditions">Terms and conditions</SelectItem>
                </SelectContent>
              </Select>
            </div>
            <div>
              <Label htmlFor="document-name">Document Name</Label>
              <Input
                id="document-name"
                value={documentName}
                onChange={(e) => setDocumentName(e.target.value)}
                placeholder="e.g., Basic Warranty Terms"
              />
            </div>
          </div>
          
          <div>
            <Label htmlFor="file-upload">PDF Document</Label>
            <Input
              id="file-upload"
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
            disabled={uploading || !selectedFile || !selectedPlan || !documentName}
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
                Upload Document
              </div>
            )}
          </Button>
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle>Uploaded Documents</CardTitle>
          <CardDescription>
            Manage your uploaded policy documents
          </CardDescription>
        </CardHeader>
        <CardContent>
          {documents.length === 0 ? (
            <p className="text-center text-gray-500 py-8">No documents uploaded yet.</p>
          ) : (
            <div className="space-y-3">
              {documents.map((doc) => (
                <div key={doc.id} className="flex items-center justify-between p-3 border rounded-lg">
                  <div className="flex items-center space-x-3">
                    <FileText className="h-5 w-5 text-red-500" />
                    <div>
                      <p className="font-medium">{doc.document_name}</p>
                      <p className="text-sm text-gray-500">
                        {doc.plan_type.charAt(0).toUpperCase() + doc.plan_type.slice(1)} Plan
                        {doc.file_size && ` • ${Math.round(doc.file_size / 1024)} KB`}
                      </p>
                    </div>
                  </div>
                  <div className="flex items-center space-x-2">
                    <Button variant="outline" size="sm" asChild>
                      <a href={doc.file_url} target="_blank" rel="noopener noreferrer">
                        View
                      </a>
                    </Button>
                    <Button 
                      variant="outline" 
                      size="sm"
                      onClick={() => deleteDocument(doc.id)}
                      className="text-red-600 hover:text-red-700"
                    >
                      <Trash2 className="h-4 w-4" />
                    </Button>
                  </div>
                </div>
              ))}
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  );
};

export default DocumentUpload;
