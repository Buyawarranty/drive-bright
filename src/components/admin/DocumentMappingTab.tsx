import React, { useState, useEffect } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from '@/components/ui/dialog';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { toast } from 'sonner';
import { Plus, Edit, Trash2, Upload, Download } from 'lucide-react';

interface DocumentMapping {
  id: string;
  plan_name: string;
  vehicle_type: string;
  document_path: string;
  created_at: string;
  updated_at: string;
}

export const DocumentMappingTab = () => {
  const [mappings, setMappings] = useState<DocumentMapping[]>([]);
  const [loading, setLoading] = useState(true);
  const [editingMapping, setEditingMapping] = useState<DocumentMapping | null>(null);
  const [showAddDialog, setShowAddDialog] = useState(false);
  const [newMapping, setNewMapping] = useState({
    plan_name: '',
    vehicle_type: 'standard',
    document_path: ''
  });

  useEffect(() => {
    fetchMappings();
  }, []);

  const fetchMappings = async () => {
    try {
      setLoading(true);
      const { data, error } = await supabase
        .from('plan_document_mapping')
        .select('*')
        .order('plan_name', { ascending: true });

      if (error) throw error;
      setMappings(data || []);
    } catch (error: any) {
      console.error('Error fetching document mappings:', error);
      toast.error('Failed to load document mappings');
    } finally {
      setLoading(false);
    }
  };

  const handleAddMapping = async () => {
    if (!newMapping.plan_name || !newMapping.document_path) {
      toast.error('Plan name and document path are required');
      return;
    }

    try {
      const { error } = await supabase
        .from('plan_document_mapping')
        .insert([newMapping]);

      if (error) throw error;

      toast.success('Document mapping added successfully');
      setShowAddDialog(false);
      setNewMapping({ plan_name: '', vehicle_type: 'standard', document_path: '' });
      fetchMappings();
    } catch (error: any) {
      console.error('Error adding mapping:', error);
      toast.error('Failed to add document mapping');
    }
  };

  const handleUpdateMapping = async () => {
    if (!editingMapping) return;

    try {
      const { error } = await supabase
        .from('plan_document_mapping')
        .update({
          plan_name: editingMapping.plan_name,
          vehicle_type: editingMapping.vehicle_type,
          document_path: editingMapping.document_path,
          updated_at: new Date().toISOString()
        })
        .eq('id', editingMapping.id);

      if (error) throw error;

      toast.success('Document mapping updated successfully');
      setEditingMapping(null);
      fetchMappings();
    } catch (error: any) {
      console.error('Error updating mapping:', error);
      toast.error('Failed to update document mapping');
    }
  };

  const handleDeleteMapping = async (id: string) => {
    if (!confirm('Are you sure you want to delete this mapping?')) return;

    try {
      const { error } = await supabase
        .from('plan_document_mapping')
        .delete()
        .eq('id', id);

      if (error) throw error;

      toast.success('Document mapping deleted successfully');
      fetchMappings();
    } catch (error: any) {
      console.error('Error deleting mapping:', error);
      toast.error('Failed to delete document mapping');
    }
  };

  const testDocumentAccess = async (documentPath: string) => {
    try {
      // This would test if the document exists and is accessible
      // For now, we'll just show a placeholder
      toast.info(`Testing access to: ${documentPath}`);
      
      // In a real implementation, you would:
      // 1. Check if the file exists in storage
      // 2. Test if it can be downloaded
      // 3. Verify file integrity
      
    } catch (error: any) {
      toast.error(`Document access test failed: ${error.message}`);
    }
  };

  if (loading) {
    return (
      <div className="flex justify-center items-center h-64">
        <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-orange-600"></div>
        <span className="ml-2">Loading document mappings...</span>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <div className="flex justify-between items-center">
        <div>
          <h2 className="text-2xl font-bold text-gray-900">Document Mapping</h2>
          <p className="text-gray-600">Manage plan to document mappings for warranty policies</p>
        </div>

        <Dialog open={showAddDialog} onOpenChange={setShowAddDialog}>
          <DialogTrigger asChild>
            <Button className="flex items-center gap-2">
              <Plus className="w-4 h-4" />
              Add Mapping
            </Button>
          </DialogTrigger>
          <DialogContent>
            <DialogHeader>
              <DialogTitle>Add Document Mapping</DialogTitle>
            </DialogHeader>
            <div className="space-y-4">
              <div>
                <Label htmlFor="plan-name">Plan Name</Label>
                <Input
                  id="plan-name"
                  value={newMapping.plan_name}
                  onChange={(e) => setNewMapping({ ...newMapping, plan_name: e.target.value })}
                  placeholder="e.g., Basic, Premium, Platinum"
                />
              </div>
              
              <div>
                <Label htmlFor="vehicle-type">Vehicle Type</Label>
                <Select
                  value={newMapping.vehicle_type}
                  onValueChange={(value) => setNewMapping({ ...newMapping, vehicle_type: value })}
                >
                  <SelectTrigger>
                    <SelectValue placeholder="Select vehicle type" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="standard">Standard Vehicle</SelectItem>
                    <SelectItem value="special_vehicle">Special Vehicle</SelectItem>
                  </SelectContent>
                </Select>
              </div>
              
              <div>
                <Label htmlFor="document-path">Document Path</Label>
                <Input
                  id="document-path"
                  value={newMapping.document_path}
                  onChange={(e) => setNewMapping({ ...newMapping, document_path: e.target.value })}
                  placeholder="/documents/standard/basic-policy.pdf"
                />
              </div>
              
              <div className="flex gap-2">
                <Button onClick={handleAddMapping} className="flex-1">
                  Add Mapping
                </Button>
                <Button 
                  variant="outline" 
                  onClick={() => setShowAddDialog(false)}
                  className="flex-1"
                >
                  Cancel
                </Button>
              </div>
            </div>
          </DialogContent>
        </Dialog>
      </div>

      <div className="bg-white rounded-lg border">
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>Plan Name</TableHead>
              <TableHead>Vehicle Type</TableHead>
              <TableHead>Document Path</TableHead>
              <TableHead>Last Updated</TableHead>
              <TableHead>Actions</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {mappings.length === 0 ? (
              <TableRow>
                <TableCell colSpan={5} className="text-center py-8">
                  <div className="text-center">
                    <p className="text-gray-500 text-lg">No document mappings found</p>
                    <p className="text-gray-400 text-sm mt-2">
                      Add your first mapping to get started
                    </p>
                  </div>
                </TableCell>
              </TableRow>
            ) : (
              mappings.map((mapping) => (
                <TableRow key={mapping.id}>
                  <TableCell className="font-medium">{mapping.plan_name}</TableCell>
                  <TableCell>
                    <span className={`px-2 py-1 rounded-full text-xs font-medium ${
                      mapping.vehicle_type === 'standard' 
                        ? 'bg-blue-100 text-blue-800' 
                        : 'bg-purple-100 text-purple-800'
                    }`}>
                      {mapping.vehicle_type === 'standard' ? 'Standard' : 'Special Vehicle'}
                    </span>
                  </TableCell>
                  <TableCell className="font-mono text-sm">{mapping.document_path}</TableCell>
                  <TableCell>
                    {new Date(mapping.updated_at).toLocaleDateString()}
                  </TableCell>
                  <TableCell>
                    <div className="flex gap-2">
                      <Button
                        variant="ghost"
                        size="sm"
                        onClick={() => testDocumentAccess(mapping.document_path)}
                        title="Test Document Access"
                      >
                        <Download className="w-4 h-4" />
                      </Button>
                      
                      <Dialog>
                        <DialogTrigger asChild>
                          <Button
                            variant="ghost"
                            size="sm"
                            onClick={() => setEditingMapping({ ...mapping })}
                          >
                            <Edit className="w-4 h-4" />
                          </Button>
                        </DialogTrigger>
                        <DialogContent>
                          <DialogHeader>
                            <DialogTitle>Edit Document Mapping</DialogTitle>
                          </DialogHeader>
                          {editingMapping && (
                            <div className="space-y-4">
                              <div>
                                <Label htmlFor="edit-plan-name">Plan Name</Label>
                                <Input
                                  id="edit-plan-name"
                                  value={editingMapping.plan_name}
                                  onChange={(e) => setEditingMapping({ 
                                    ...editingMapping, 
                                    plan_name: e.target.value 
                                  })}
                                />
                              </div>
                              
                              <div>
                                <Label htmlFor="edit-vehicle-type">Vehicle Type</Label>
                                <Select
                                  value={editingMapping.vehicle_type}
                                  onValueChange={(value) => setEditingMapping({ 
                                    ...editingMapping, 
                                    vehicle_type: value 
                                  })}
                                >
                                  <SelectTrigger>
                                    <SelectValue />
                                  </SelectTrigger>
                                  <SelectContent>
                                    <SelectItem value="standard">Standard Vehicle</SelectItem>
                                    <SelectItem value="special_vehicle">Special Vehicle</SelectItem>
                                  </SelectContent>
                                </Select>
                              </div>
                              
                              <div>
                                <Label htmlFor="edit-document-path">Document Path</Label>
                                <Input
                                  id="edit-document-path"
                                  value={editingMapping.document_path}
                                  onChange={(e) => setEditingMapping({ 
                                    ...editingMapping, 
                                    document_path: e.target.value 
                                  })}
                                />
                              </div>
                              
                              <div className="flex gap-2">
                                <Button onClick={handleUpdateMapping} className="flex-1">
                                  Update Mapping
                                </Button>
                                <Button 
                                  variant="outline" 
                                  onClick={() => setEditingMapping(null)}
                                  className="flex-1"
                                >
                                  Cancel
                                </Button>
                              </div>
                            </div>
                          )}
                        </DialogContent>
                      </Dialog>
                      
                      <Button
                        variant="ghost"
                        size="sm"
                        onClick={() => handleDeleteMapping(mapping.id)}
                        className="text-red-600 hover:text-red-800"
                      >
                        <Trash2 className="w-4 h-4" />
                      </Button>
                    </div>
                  </TableCell>
                </TableRow>
              ))
            )}
          </TableBody>
        </Table>
      </div>

      <div className="bg-yellow-50 border border-yellow-200 rounded-lg p-4">
        <h3 className="font-semibold text-yellow-800 mb-2">Document Path Guidelines</h3>
        <ul className="text-sm text-yellow-700 space-y-1">
          <li>• Use absolute paths starting with /documents/</li>
          <li>• Organize by vehicle type: /documents/standard/ or /documents/special_vehicle/</li>
          <li>• Use descriptive filenames: basic-policy.pdf, premium-policy.pdf</li>
          <li>• Ensure documents are uploaded to the correct storage bucket</li>
          <li>• Test document access regularly to ensure files are available</li>
        </ul>
      </div>
    </div>
  );
};