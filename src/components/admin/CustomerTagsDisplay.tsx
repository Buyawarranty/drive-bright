import React, { useState, useEffect } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { Badge } from '@/components/ui/badge';

interface CustomerTag {
  id: string;
  name: string;
  category: string;
  color: string;
}

interface CustomerTagAssignment {
  customer_tags: CustomerTag;
}

interface CustomerTagsDisplayProps {
  customerId: string;
  maxVisible?: number;
}

export const CustomerTagsDisplay: React.FC<CustomerTagsDisplayProps> = ({ 
  customerId, 
  maxVisible = 3 
}) => {
  const [tags, setTags] = useState<CustomerTagAssignment[]>([]);

  useEffect(() => {
    fetchTags();
  }, [customerId]);

  const fetchTags = async () => {
    try {
      const { data, error } = await supabase
        .from('customer_tag_assignments')
        .select(`
          customer_tags (
            id,
            name,
            category,
            color
          )
        `)
        .eq('customer_id', customerId);

      if (error) throw error;
      setTags(data || []);
    } catch (error) {
      console.error('Error fetching tags:', error);
    }
  };

  if (tags.length === 0) {
    return <span className="text-xs text-muted-foreground">No tags</span>;
  }

  const visibleTags = tags.slice(0, maxVisible);
  const remainingCount = tags.length - maxVisible;

  return (
    <div className="flex flex-wrap gap-1">
      {visibleTags.map((assignment, index) => {
        const tag = assignment.customer_tags as CustomerTag;
        return (
          <Badge
            key={index}
            style={{ 
              backgroundColor: tag.color,
              color: '#ffffff',
              borderColor: tag.color 
            }}
            className="text-xs font-medium shadow-sm"
          >
            {tag.name}
          </Badge>
        );
      })}
      {remainingCount > 0 && (
        <Badge variant="outline" className="text-xs bg-muted">
          +{remainingCount}
        </Badge>
      )}
    </div>
  );
};

export default CustomerTagsDisplay;
