import React, { useState, useEffect } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover';
import { Command, CommandEmpty, CommandGroup, CommandInput, CommandItem, CommandList } from '@/components/ui/command';
import { Plus, X } from 'lucide-react';
import { toast } from 'sonner';

interface CustomerTag {
  id: string;
  name: string;
  category: string;
  color: string;
}

interface CustomerTagAssignment {
  tag_id: string;
  customer_tags: CustomerTag;
}

interface InlineCustomerTagsProps {
  customerId: string;
  onTagsUpdate?: () => void;
}

export const InlineCustomerTags: React.FC<InlineCustomerTagsProps> = ({ 
  customerId,
  onTagsUpdate 
}) => {
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
    }
  };

  const fetchAssignedTags = async () => {
    try {
      const { data, error } = await supabase
        .from('customer_tag_assignments')
        .select(`
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
          tag_id: tagId
        });

      if (error) throw error;
      
      await fetchAssignedTags();
      toast.success('Tag added successfully');
      onTagsUpdate?.();
    } catch (error: any) {
      console.error('Error assigning tag:', error);
      toast.error('Failed to add tag: ' + error.message);
    } finally {
      setLoading(false);
    }
  };

  const removeTag = async (tagId: string) => {
    setLoading(true);
    try {
      const { error } = await supabase
        .from('customer_tag_assignments')
        .delete()
        .eq('customer_id', customerId)
        .eq('tag_id', tagId);

      if (error) throw error;
      
      await fetchAssignedTags();
      toast.success('Tag removed successfully');
      onTagsUpdate?.();
    } catch (error: any) {
      console.error('Error removing tag:', error);
      toast.error('Failed to remove tag: ' + error.message);
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

  const assignedTagIds = assignedTags.map(a => a.tag_id);

  return (
    <div className="flex items-center gap-1 flex-wrap">
      {assignedTags.slice(0, 2).map((assignment) => {
        const tag = assignment.customer_tags;
        return (
          <Badge
            key={assignment.tag_id}
            style={{ 
              backgroundColor: tag.color,
              color: '#ffffff',
              borderColor: tag.color 
            }}
            className="text-xs font-medium pr-1 flex items-center gap-1"
          >
            {tag.name}
            <button
              onClick={(e) => {
                e.stopPropagation();
                removeTag(assignment.tag_id);
              }}
              className="ml-1 hover:bg-white/20 rounded-full p-0.5 transition-colors"
              disabled={loading}
            >
              <X className="h-2.5 w-2.5" />
            </button>
          </Badge>
        );
      })}
      
      {assignedTags.length > 2 && (
        <Badge variant="outline" className="text-xs">
          +{assignedTags.length - 2}
        </Badge>
      )}

      <Popover open={open} onOpenChange={setOpen}>
        <PopoverTrigger asChild>
          <Button
            variant="ghost"
            size="sm"
            className="h-5 w-5 p-0 hover:bg-muted"
            onClick={(e) => e.stopPropagation()}
          >
            <Plus className="h-3 w-3" />
          </Button>
        </PopoverTrigger>
        <PopoverContent className="w-[300px] p-0" align="start">
          <Command>
            <CommandInput placeholder="Search tags..." />
            <CommandList>
              <CommandEmpty>No tags found.</CommandEmpty>
              {Object.entries(groupedTags).map(([category, tags]) => (
                <CommandGroup key={category} heading={category}>
                  {tags.map((tag) => {
                    const isAssigned = assignedTagIds.includes(tag.id);
                    return (
                      <CommandItem
                        key={tag.id}
                        onSelect={() => {
                          if (isAssigned) {
                            removeTag(tag.id);
                          } else {
                            assignTag(tag.id);
                          }
                        }}
                        disabled={loading}
                        className="cursor-pointer"
                      >
                        <div className="flex items-center gap-2 w-full">
                          <div 
                            className="w-3 h-3 rounded-full flex-shrink-0" 
                            style={{ backgroundColor: tag.color }}
                          />
                          <span className="flex-1">{tag.name}</span>
                          {isAssigned && (
                            <X className="h-3 w-3 text-muted-foreground" />
                          )}
                        </div>
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
  );
};

export default InlineCustomerTags;
