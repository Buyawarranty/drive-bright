import React, { useState, useEffect } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from '@/components/ui/dialog';
import { Command, CommandEmpty, CommandGroup, CommandInput, CommandItem, CommandList } from '@/components/ui/command';
import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover';
import { toast } from 'sonner';
import { Tag, X, Plus } from 'lucide-react';
import { cn } from '@/lib/utils';

interface CustomerTag {
  id: string;
  name: string;
  category: string;
  color: string;
}

interface CustomerTagAssignment {
  id: string;
  tag_id: string;
  customer_tags: CustomerTag;
}

interface CustomerTagsManagerProps {
  customerId: string;
  onTagsUpdate?: () => void;
}

export const CustomerTagsManager: React.FC<CustomerTagsManagerProps> = ({ customerId, onTagsUpdate }) => {
  const [availableTags, setAvailableTags] = useState<CustomerTag[]>([]);
  const [assignedTags, setAssignedTags] = useState<CustomerTagAssignment[]>([]);
  const [open, setOpen] = useState(false);
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    fetchAvailableTags();
    fetchAssignedTags();
  }, [customerId]);

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

  const fetchAssignedTags = async () => {
    try {
      const { data, error } = await supabase
        .from('customer_tag_assignments')
        .select(`
          id,
          tag_id,
          customer_tags (
            id,
            name,
            category,
            color
          )
        `)
        .eq('customer_id', customerId);

      if (error) throw error;
      setAssignedTags(data || []);
    } catch (error) {
      console.error('Error fetching assigned tags:', error);
    }
  };

  const assignTag = async (tagId: string) => {
    setLoading(true);
    try {
      const { error } = await supabase
        .from('customer_tag_assignments')
        .insert({
          customer_id: customerId,
          tag_id: tagId,
        });

      if (error) throw error;

      await fetchAssignedTags();
      toast.success('Tag assigned successfully');
      onTagsUpdate?.();
    } catch (error: any) {
      console.error('Error assigning tag:', error);
      if (error.code === '23505') {
        toast.error('Tag already assigned');
      } else {
        toast.error('Failed to assign tag');
      }
    } finally {
      setLoading(false);
    }
  };

  const removeTag = async (assignmentId: string) => {
    setLoading(true);
    try {
      const { error } = await supabase
        .from('customer_tag_assignments')
        .delete()
        .eq('id', assignmentId);

      if (error) throw error;

      await fetchAssignedTags();
      toast.success('Tag removed successfully');
      onTagsUpdate?.();
    } catch (error) {
      console.error('Error removing tag:', error);
      toast.error('Failed to remove tag');
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

  const assignedTagIds = assignedTags.map(a => a.tag_id);

  return (
    <div className="space-y-2">
      <div className="flex flex-wrap gap-2">
        {assignedTags.map((assignment) => {
          const tag = assignment.customer_tags as CustomerTag;
          return (
            <Badge
              key={assignment.id}
              style={{ backgroundColor: tag.color }}
              className="text-white gap-1 pr-1"
            >
              {tag.name}
              <button
                onClick={() => removeTag(assignment.id)}
                disabled={loading}
                className="ml-1 hover:bg-white/20 rounded-full p-0.5 transition-colors"
              >
                <X className="h-3 w-3" />
              </button>
            </Badge>
          );
        })}
        
        <Popover open={open} onOpenChange={setOpen}>
          <PopoverTrigger asChild>
            <Button 
              variant="outline" 
              size="sm" 
              className="h-6 px-2 text-xs"
              disabled={loading}
            >
              <Plus className="h-3 w-3 mr-1" />
              Add Tag
            </Button>
          </PopoverTrigger>
          <PopoverContent className="w-[300px] p-0" align="start">
            <Command>
              <CommandInput placeholder="Search tags..." />
              <CommandList>
                <CommandEmpty>No tags found.</CommandEmpty>
                {sortedCategories.map(([category, tags]) => (
                  <CommandGroup key={category} heading={category}>
                    {tags.map((tag) => {
                      const isAssigned = assignedTagIds.includes(tag.id);
                      return (
                        <CommandItem
                          key={tag.id}
                          onSelect={() => {
                            if (!isAssigned) {
                              assignTag(tag.id);
                              setOpen(false);
                            }
                          }}
                          disabled={isAssigned}
                          className={cn(
                            "cursor-pointer",
                            isAssigned && "opacity-50 cursor-not-allowed"
                          )}
                        >
                          <div 
                            className="w-3 h-3 rounded-full mr-2" 
                            style={{ backgroundColor: tag.color }}
                          />
                          {tag.name}
                          {isAssigned && (
                            <span className="ml-auto text-xs text-muted-foreground">
                              Assigned
                            </span>
                          )}
                        </CommandItem>
                      );
                    })}
                  </CommandGroup>
                ))}
              </CommandList>
            </Command>
          </PopoverContent>
        </Popover>
      </div>
    </div>
  );
};

export default CustomerTagsManager;
