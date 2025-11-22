import React, { useState, useEffect } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { Button } from '@/components/ui/button';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from '@/components/ui/dialog';
import { Command, CommandEmpty, CommandGroup, CommandInput, CommandItem, CommandList } from '@/components/ui/command';
import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover';
import { toast } from 'sonner';
import { Tag, Plus } from 'lucide-react';
import { cn } from '@/lib/utils';

interface CustomerTag {
  id: string;
  name: string;
  category: string;
  color: string;
}

interface BulkTagDialogProps {
  selectedCustomerIds: string[];
  onComplete?: () => void;
}

export const BulkTagDialog: React.FC<BulkTagDialogProps> = ({ 
  selectedCustomerIds, 
  onComplete 
}) => {
  const [open, setOpen] = useState(false);
  const [popoverOpen, setPopoverOpen] = useState(false);
  const [availableTags, setAvailableTags] = useState<CustomerTag[]>([]);
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    if (open) {
      fetchAvailableTags();
    }
  }, [open]);

  const fetchAvailableTags = async () => {
    try {
      const { data, error } = await supabase
        .from('customer_tags')
        .select('*')
        .order('category', { ascending: true })
        .order('name', { ascending: true });

      if (error) throw error;
      setAvailableTags(data || []);
    } catch (error) {
      console.error('Error fetching tags:', error);
      toast.error('Failed to load tags');
    }
  };

  const assignTagToCustomers = async (tagId: string, tagName: string) => {
    setLoading(true);
    try {
      // For each customer, insert a tag assignment (or ignore if already exists)
      const assignments = selectedCustomerIds.map(customerId => ({
        customer_id: customerId,
        tag_id: tagId,
      }));

      const { error } = await supabase
        .from('customer_tag_assignments')
        .upsert(assignments, { 
          onConflict: 'customer_id,tag_id',
          ignoreDuplicates: true 
        });

      if (error) throw error;

      toast.success(`Tag "${tagName}" assigned to ${selectedCustomerIds.length} customer(s)`);
      setOpen(false);
      setPopoverOpen(false);
      onComplete?.();
    } catch (error: any) {
      console.error('Error assigning tag:', error);
      toast.error('Failed to assign tag to all customers');
    } finally {
      setLoading(false);
    }
  };

  const groupedTags = availableTags.reduce((acc, tag) => {
    if (!acc[tag.category]) {
      acc[tag.category] = [];
    }
    acc[tag.category].push(tag);
    return acc;
  }, {} as Record<string, CustomerTag[]>);

  // Sort categories to ensure "Sales Funnel" appears first
  const sortedCategories = Object.entries(groupedTags).sort(([categoryA], [categoryB]) => {
    if (categoryA === 'Sales Funnel') return -1;
    if (categoryB === 'Sales Funnel') return 1;
    return categoryA.localeCompare(categoryB);
  });

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild>
        <Button 
          variant="outline" 
          size="sm"
          disabled={selectedCustomerIds.length === 0}
        >
          <Tag className="h-3 w-3 mr-1" />
          Bulk Tag ({selectedCustomerIds.length})
        </Button>
      </DialogTrigger>
      <DialogContent className="max-w-md">
        <DialogHeader>
          <DialogTitle>Assign Tag to Selected Customers</DialogTitle>
        </DialogHeader>
        
        <div className="space-y-4">
          <p className="text-sm text-muted-foreground">
            Select a tag to assign to {selectedCustomerIds.length} selected customer(s).
          </p>

          <Popover open={popoverOpen} onOpenChange={setPopoverOpen}>
            <PopoverTrigger asChild>
              <Button 
                variant="outline" 
                className="w-full justify-start"
                disabled={loading}
              >
                <Plus className="h-4 w-4 mr-2" />
                Select a tag to assign
              </Button>
            </PopoverTrigger>
            <PopoverContent className="w-[300px] p-0" align="start">
              <Command>
                <CommandInput placeholder="Search tags..." />
                <CommandList>
                  <CommandEmpty>No tags found.</CommandEmpty>
                  {sortedCategories.map(([category, tags]) => (
                    <CommandGroup key={category} heading={category}>
                      {tags.map((tag) => (
                        <CommandItem
                          key={tag.id}
                          onSelect={() => assignTagToCustomers(tag.id, tag.name)}
                          disabled={loading}
                          className="cursor-pointer"
                        >
                          <div 
                            className="w-3 h-3 rounded-full mr-2" 
                            style={{ backgroundColor: tag.color }}
                          />
                          {tag.name}
                        </CommandItem>
                      ))}
                    </CommandGroup>
                  ))}
                </CommandList>
              </Command>
            </PopoverContent>
          </Popover>
        </div>
      </DialogContent>
    </Dialog>
  );
};

export default BulkTagDialog;
