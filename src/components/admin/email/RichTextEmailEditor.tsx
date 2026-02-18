import React, { useRef, useState } from 'react';
import { Button } from '@/components/ui/button';
import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { Separator } from '@/components/ui/separator';
import { ScrollArea } from '@/components/ui/scroll-area';
import {
  Bold, Italic, Heading1, Heading2, Heading3, List, ListOrdered,
  Link, Smile, Type, Code, Minus, Image
} from 'lucide-react';

const EMOJI_CATEGORIES = [
  { label: 'Smileys', emojis: ['😀','😃','😄','😁','😆','😅','🤣','😂','🙂','😊','😇','🥰','😍','🤩','😘','😗','😋','😛','😜','🤪','😝','🤑','🤗','🤭','🤫','🤔','🤐','🤨','😐','😑','😶','😏','😒','🙄','😬','😮‍💨','🤥'] },
  { label: 'Gestures', emojis: ['👋','🤚','🖐️','✋','🖖','👌','🤌','🤏','✌️','🤞','🤟','🤘','🤙','👈','👉','👆','👇','☝️','👍','👎','👏','🙌','🤝','🙏','💪'] },
  { label: 'Objects', emojis: ['🚗','🚙','🏎️','🚕','🛡️','🔧','🔑','📧','📞','💰','💳','📋','📄','✅','❌','⚠️','🔔','⭐','🌟','💫','🎉','🎊','🏆','🥇','💎','🔥','❤️','💙','💚','💛','🧡','💜','🖤','💯'] },
  { label: 'Arrows', emojis: ['➡️','⬅️','⬆️','⬇️','↗️','↘️','↙️','↖️','↕️','↔️','🔄','🔃','▶️','◀️','🔼','🔽'] },
];

const TEMPLATE_VARS = [
  '{{customerFirstName}}',
  '{{customerName}}',
  '{{policyNumber}}',
  '{{planType}}',
  '{{vehicleReg}}',
  '{{expiryDate}}',
  '{{portalUrl}}',
  '{{renewalUrl}}',
];

interface RichTextEmailEditorProps {
  value: string;
  onChange: (value: string) => void;
  placeholder?: string;
}

export const RichTextEmailEditor: React.FC<RichTextEmailEditorProps> = ({ value, onChange, placeholder }) => {
  const textareaRef = useRef<HTMLTextAreaElement>(null);
  const [linkUrl, setLinkUrl] = useState('');
  const [linkText, setLinkText] = useState('');
  const [imageUrl, setImageUrl] = useState('');
  const [imageAlt, setImageAlt] = useState('');
  const [emojiOpen, setEmojiOpen] = useState(false);
  const [varsOpen, setVarsOpen] = useState(false);
  const [linkOpen, setLinkOpen] = useState(false);
  const [imageOpen, setImageOpen] = useState(false);

  const insertAtCursor = (text: string) => {
    const ta = textareaRef.current;
    if (!ta) { onChange(value + text); return; }
    const start = ta.selectionStart;
    const end = ta.selectionEnd;
    const newVal = value.substring(0, start) + text + value.substring(end);
    onChange(newVal);
    setTimeout(() => { ta.focus(); ta.selectionStart = ta.selectionEnd = start + text.length; }, 0);
  };

  const wrapSelection = (before: string, after: string) => {
    const ta = textareaRef.current;
    if (!ta) return;
    const start = ta.selectionStart;
    const end = ta.selectionEnd;
    const selected = value.substring(start, end) || 'text';
    const newVal = value.substring(0, start) + before + selected + after + value.substring(end);
    onChange(newVal);
    setTimeout(() => { ta.focus(); ta.selectionStart = start + before.length; ta.selectionEnd = start + before.length + selected.length; }, 0);
  };

  const insertLink = () => {
    if (linkUrl && linkText) {
      insertAtCursor(`[${linkText}](${linkUrl})`);
      setLinkUrl('');
      setLinkText('');
      setLinkOpen(false);
    }
  };

  const insertImage = () => {
    if (imageUrl) {
      insertAtCursor(`![${imageAlt || 'image'}](${imageUrl})`);
      setImageUrl('');
      setImageAlt('');
      setImageOpen(false);
    }
  };

  const btnClass = "h-8 w-8 p-0";

  return (
    <div className="border rounded-md overflow-hidden">
      {/* Toolbar */}
      <div className="flex flex-wrap items-center gap-0.5 p-1.5 bg-muted/50 border-b">
        <Button type="button" variant="ghost" size="sm" className={btnClass} title="Bold" onClick={() => wrapSelection('**', '**')}>
          <Bold className="w-4 h-4" />
        </Button>
        <Button type="button" variant="ghost" size="sm" className={btnClass} title="Italic" onClick={() => wrapSelection('*', '*')}>
          <Italic className="w-4 h-4" />
        </Button>
        <Separator orientation="vertical" className="h-6 mx-1" />
        <Button type="button" variant="ghost" size="sm" className={btnClass} title="Heading 1" onClick={() => insertAtCursor('\n# ')}>
          <Heading1 className="w-4 h-4" />
        </Button>
        <Button type="button" variant="ghost" size="sm" className={btnClass} title="Heading 2" onClick={() => insertAtCursor('\n## ')}>
          <Heading2 className="w-4 h-4" />
        </Button>
        <Button type="button" variant="ghost" size="sm" className={btnClass} title="Heading 3" onClick={() => insertAtCursor('\n### ')}>
          <Heading3 className="w-4 h-4" />
        </Button>
        <Separator orientation="vertical" className="h-6 mx-1" />
        <Button type="button" variant="ghost" size="sm" className={btnClass} title="Bullet List" onClick={() => insertAtCursor('\n• ')}>
          <List className="w-4 h-4" />
        </Button>
        <Button type="button" variant="ghost" size="sm" className={btnClass} title="Numbered List" onClick={() => insertAtCursor('\n1. ')}>
          <ListOrdered className="w-4 h-4" />
        </Button>
        <Button type="button" variant="ghost" size="sm" className={btnClass} title="Horizontal Rule" onClick={() => insertAtCursor('\n---\n')}>
          <Minus className="w-4 h-4" />
        </Button>
        <Separator orientation="vertical" className="h-6 mx-1" />

        {/* Link */}
        <Popover open={linkOpen} onOpenChange={setLinkOpen}>
          <PopoverTrigger asChild>
            <Button type="button" variant="ghost" size="sm" className={btnClass} title="Insert Link">
              <Link className="w-4 h-4" />
            </Button>
          </PopoverTrigger>
          <PopoverContent className="w-72 space-y-2" align="start">
            <Label className="text-xs">Link Text</Label>
            <Input value={linkText} onChange={e => setLinkText(e.target.value)} placeholder="Click here" className="h-8 text-sm" />
            <Label className="text-xs">URL</Label>
            <Input value={linkUrl} onChange={e => setLinkUrl(e.target.value)} placeholder="https://..." className="h-8 text-sm" />
            <Button type="button" size="sm" className="w-full" onClick={insertLink} disabled={!linkUrl || !linkText}>Insert Link</Button>
          </PopoverContent>
        </Popover>

        {/* Image */}
        <Popover open={imageOpen} onOpenChange={setImageOpen}>
          <PopoverTrigger asChild>
            <Button type="button" variant="ghost" size="sm" className={btnClass} title="Insert Image">
              <Image className="w-4 h-4" />
            </Button>
          </PopoverTrigger>
          <PopoverContent className="w-72 space-y-2" align="start">
            <Label className="text-xs">Image URL</Label>
            <Input value={imageUrl} onChange={e => setImageUrl(e.target.value)} placeholder="https://example.com/image.png" className="h-8 text-sm" />
            <Label className="text-xs">Alt Text (optional)</Label>
            <Input value={imageAlt} onChange={e => setImageAlt(e.target.value)} placeholder="Describe the image" className="h-8 text-sm" />
            <Button type="button" size="sm" className="w-full" onClick={insertImage} disabled={!imageUrl}>Insert Image</Button>
          </PopoverContent>
        </Popover>

        {/* Emoji */}
        <Popover open={emojiOpen} onOpenChange={setEmojiOpen}>
          <PopoverTrigger asChild>
            <Button type="button" variant="ghost" size="sm" className={btnClass} title="Insert Emoji">
              <Smile className="w-4 h-4" />
            </Button>
          </PopoverTrigger>
          <PopoverContent className="w-80 p-2" align="start">
            <ScrollArea className="h-52">
              {EMOJI_CATEGORIES.map(cat => (
                <div key={cat.label} className="mb-2">
                  <p className="text-xs font-medium text-muted-foreground mb-1">{cat.label}</p>
                  <div className="flex flex-wrap gap-0.5">
                    {cat.emojis.map(emoji => (
                      <button
                        key={emoji}
                        type="button"
                        className="w-8 h-8 flex items-center justify-center rounded hover:bg-muted text-lg cursor-pointer"
                        onClick={() => { insertAtCursor(emoji); setEmojiOpen(false); }}
                      >
                        {emoji}
                      </button>
                    ))}
                  </div>
                </div>
              ))}
            </ScrollArea>
          </PopoverContent>
        </Popover>

        {/* Template Variables */}
        <Popover open={varsOpen} onOpenChange={setVarsOpen}>
          <PopoverTrigger asChild>
            <Button type="button" variant="ghost" size="sm" className="h-8 px-2 text-xs" title="Insert Variable">
              <Code className="w-4 h-4 mr-1" />
              Variables
            </Button>
          </PopoverTrigger>
          <PopoverContent className="w-56 p-1" align="start">
            {TEMPLATE_VARS.map(v => (
              <button
                key={v}
                type="button"
                className="w-full text-left px-2 py-1.5 text-sm rounded hover:bg-muted cursor-pointer font-mono"
                onClick={() => { insertAtCursor(v); setVarsOpen(false); }}
              >
                {v}
              </button>
            ))}
          </PopoverContent>
        </Popover>
      </div>

      {/* Editor */}
      <Textarea
        ref={textareaRef}
        value={value}
        onChange={e => onChange(e.target.value)}
        placeholder={placeholder || "Write your email content here... Use **bold**, *italic*, [links](url), # headings, and emojis 🎉"}
        rows={12}
        className="border-0 rounded-none focus-visible:ring-0 resize-y font-mono text-sm"
      />
    </div>
  );
};
