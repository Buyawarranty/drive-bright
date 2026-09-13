import React from 'react';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover';
import { Tag, X, Plus } from 'lucide-react';
import {
  tagChipClass,
  useConversationTags,
  useWhatsAppTagList,
} from '@/hooks/useWhatsAppTags';

interface Props {
  conversationId: string;
  disabled?: boolean;
}

/** Chips showing a conversation's tags plus a picker to add or remove them. */
const WhatsAppTagPicker: React.FC<Props> = ({ conversationId, disabled }) => {
  const { tags } = useWhatsAppTagList();
  const { tagIds, toggleTag } = useConversationTags(conversationId);
  const chosen = tags.filter((t) => tagIds.includes(t.id));

  return (
    <div className="flex flex-wrap items-center gap-1.5">
      <span className="flex items-center gap-1 text-xs text-muted-foreground">
        <Tag className="h-3 w-3" /> Tags
      </span>
      {chosen.map((t) => (
        <Badge key={t.id} className={`gap-1 ${tagChipClass(t.color)}`}>
          {t.name}
          {!disabled && (
            <button
              type="button"
              aria-label={`Remove ${t.name}`}
              onClick={() => void toggleTag(t.id)}
              className="opacity-80 hover:opacity-100"
            >
              <X className="h-3 w-3" />
            </button>
          )}
        </Badge>
      ))}
      {chosen.length === 0 && (
        <span className="text-xs text-muted-foreground">None yet</span>
      )}
      {!disabled && (
        <Popover>
          <PopoverTrigger asChild>
            <Button size="sm" variant="outline" className="h-6 px-2 text-xs">
              <Plus className="mr-1 h-3 w-3" /> Add tag
            </Button>
          </PopoverTrigger>
          <PopoverContent align="start" className="w-56 p-2">
            <div className="flex flex-wrap gap-1.5">
              {tags.map((t) => {
                const on = tagIds.includes(t.id);
                return (
                  <button key={t.id} type="button" onClick={() => void toggleTag(t.id)}>
                    <Badge
                      className={on ? tagChipClass(t.color) : 'bg-muted text-foreground border-border'}
                    >
                      {t.name}
                    </Badge>
                  </button>
                );
              })}
            </div>
          </PopoverContent>
        </Popover>
      )}
    </div>
  );
};

export default WhatsAppTagPicker;
