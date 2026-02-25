import React, { useState, useEffect } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Textarea } from '@/components/ui/textarea';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { 
  Plus, Lightbulb, MessageSquare, Package, Globe, Users, 
  Pin, PinOff, Check, Trash2, Edit2, X, Save, Sparkles,
  AlertCircle, CheckCircle2
} from 'lucide-react';
import { toast } from 'sonner';
import { format } from 'date-fns';
import { cn } from '@/lib/utils';
import { SalesScriptCard } from './SalesScriptCard';

interface SellingTip {
  id: string;
  category: string;
  title: string;
  content: string;
  is_pinned: boolean;
  is_resolved: boolean;
  resolved_at: string | null;
  resolved_by: string | null;
  created_by: string | null;
  created_at: string;
  updated_at: string;
  creator?: {
    first_name?: string;
    last_name?: string;
    email: string;
  };
}

// Selling Tips categories
const SELLING_TIPS_CATEGORIES = [
  { value: 'selling_technique', label: 'Selling Technique', icon: Sparkles, color: 'bg-purple-100 text-purple-800' },
  { value: 'word_phrase', label: 'Words That Work', icon: MessageSquare, color: 'bg-blue-100 text-blue-800' },
  { value: 'objection_handling', label: 'Objection Handling', icon: AlertCircle, color: 'bg-amber-100 text-amber-800' },
];

// Customer Feedback categories
const CUSTOMER_FEEDBACK_CATEGORIES = [
  { value: 'service_improvement', label: 'Service Improvement', icon: Users, color: 'bg-cyan-100 text-cyan-800' },
  { value: 'missing_product', label: 'Missing Product', icon: Package, color: 'bg-orange-100 text-orange-800' },
  { value: 'website_feedback', label: 'Website Feedback', icon: Globe, color: 'bg-green-100 text-green-800' },
  { value: 'other', label: 'Other Feedback', icon: Lightbulb, color: 'bg-gray-100 text-gray-800' },
];

// All categories combined for backwards compatibility
const CATEGORIES = [...SELLING_TIPS_CATEGORIES, ...CUSTOMER_FEEDBACK_CATEGORIES];

export const SellingTipsSection: React.FC = () => {
  const [tips, setTips] = useState<SellingTip[]>([]);
  const [loading, setLoading] = useState(true);
  const [activeTab, setActiveTab] = useState('all');
  const [showAddForm, setShowAddForm] = useState(false);
  const [editingTip, setEditingTip] = useState<string | null>(null);
  const [editTitle, setEditTitle] = useState('');
  const [editContent, setEditContent] = useState('');
  const [editCategory, setEditCategory] = useState('');
  
  // Quick add form state
  const [newCategory, setNewCategory] = useState('selling_technique');
  const [newTitle, setNewTitle] = useState('');
  const [newContent, setNewContent] = useState('');
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    fetchTips();
  }, []);

  const fetchTips = async () => {
    try {
      const { data, error } = await supabase
        .from('selling_tips')
        .select(`
          *,
          creator:admin_users!created_by(first_name, last_name, email)
        `)
        .order('is_pinned', { ascending: false })
        .order('created_at', { ascending: false });

      if (error) throw error;
      setTips((data as SellingTip[]) || []);
    } catch (error) {
      console.error('Error fetching tips:', error);
      toast.error('Failed to load tips');
    } finally {
      setLoading(false);
    }
  };

  const handleQuickAdd = async () => {
    if (!newTitle.trim() || !newContent.trim()) {
      toast.error('Please fill in title and content');
      return;
    }

    setSaving(true);
    try {
      // Get current admin user
      const { data: { user } } = await supabase.auth.getUser();
      let createdBy = null;
      
      if (user) {
        const { data: adminUser } = await supabase
          .from('admin_users')
          .select('id')
          .eq('user_id', user.id)
          .single();
        createdBy = adminUser?.id || null;
      }

      const { error } = await supabase
        .from('selling_tips')
        .insert({
          category: newCategory,
          title: newTitle.trim(),
          content: newContent.trim(),
          created_by: createdBy
        });

      if (error) throw error;

      toast.success('Tip added successfully!');
      setNewTitle('');
      setNewContent('');
      setShowAddForm(false);
      fetchTips();
    } catch (error) {
      console.error('Error adding tip:', error);
      toast.error('Failed to add tip');
    } finally {
      setSaving(false);
    }
  };

  const handleTogglePin = async (tipId: string, currentPinned: boolean) => {
    try {
      const { error } = await supabase
        .from('selling_tips')
        .update({ is_pinned: !currentPinned })
        .eq('id', tipId);

      if (error) throw error;
      
      toast.success(currentPinned ? 'Unpinned' : 'Pinned to top');
      fetchTips();
    } catch (error) {
      console.error('Error toggling pin:', error);
      toast.error('Failed to update');
    }
  };

  const handleToggleResolved = async (tipId: string, currentResolved: boolean) => {
    try {
      const { data: { user } } = await supabase.auth.getUser();
      let resolvedBy = null;
      
      if (user && !currentResolved) {
        const { data: adminUser } = await supabase
          .from('admin_users')
          .select('id')
          .eq('user_id', user.id)
          .single();
        resolvedBy = adminUser?.id || null;
      }

      const { error } = await supabase
        .from('selling_tips')
        .update({ 
          is_resolved: !currentResolved,
          resolved_at: !currentResolved ? new Date().toISOString() : null,
          resolved_by: resolvedBy
        })
        .eq('id', tipId);

      if (error) throw error;
      
      toast.success(currentResolved ? 'Marked as open' : 'Marked as resolved');
      fetchTips();
    } catch (error) {
      console.error('Error toggling resolved:', error);
      toast.error('Failed to update');
    }
  };

  const handleDelete = async (tipId: string) => {
    if (!confirm('Delete this tip?')) return;
    
    try {
      const { error } = await supabase
        .from('selling_tips')
        .delete()
        .eq('id', tipId);

      if (error) throw error;
      
      toast.success('Tip deleted');
      fetchTips();
    } catch (error) {
      console.error('Error deleting tip:', error);
      toast.error('Failed to delete');
    }
  };

  const handleStartEdit = (tip: SellingTip) => {
    setEditingTip(tip.id);
    setEditTitle(tip.title);
    setEditContent(tip.content);
    setEditCategory(tip.category);
  };

  const handleCancelEdit = () => {
    setEditingTip(null);
    setEditTitle('');
    setEditContent('');
    setEditCategory('');
  };

  const handleUpdateTip = async () => {
    if (!editingTip || !editTitle.trim() || !editContent.trim()) {
      toast.error('Please fill in title and content');
      return;
    }

    setSaving(true);
    try {
      const { error } = await supabase
        .from('selling_tips')
        .update({
          title: editTitle.trim(),
          content: editContent.trim(),
          category: editCategory
        })
        .eq('id', editingTip);

      if (error) throw error;

      toast.success('Tip updated successfully!');
      handleCancelEdit();
      fetchTips();
    } catch (error) {
      console.error('Error updating tip:', error);
      toast.error('Failed to update tip');
    } finally {
      setSaving(false);
    }
  };

  const getCategoryInfo = (category: string) => {
    return CATEGORIES.find(c => c.value === category) || CUSTOMER_FEEDBACK_CATEGORIES[CUSTOMER_FEEDBACK_CATEGORIES.length - 1];
  };

  const filteredTips = tips.filter(tip => {
    if (activeTab === 'all') return true;
    if (activeTab === 'resolved') return tip.is_resolved;
    if (activeTab === 'open') return !tip.is_resolved;
    if (activeTab === 'selling_tips') return SELLING_TIPS_CATEGORIES.some(c => c.value === tip.category);
    if (activeTab === 'customer_feedback') return CUSTOMER_FEEDBACK_CATEGORIES.some(c => c.value === tip.category);
    return tip.category === activeTab;
  });

  const pinnedTips = filteredTips.filter(t => t.is_pinned);
  const regularTips = filteredTips.filter(t => !t.is_pinned);

  if (loading) {
    return (
      <div className="space-y-4 p-4">
        <div className="h-8 bg-muted animate-pulse rounded" />
        <div className="h-32 bg-muted animate-pulse rounded" />
        <div className="h-32 bg-muted animate-pulse rounded" />
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {/* Sales Script - Always visible at the top */}
      <SalesScriptCard />

      {/* Header with Quick Add */}
      <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4">
        <div>
          <h2 className="text-2xl font-bold flex items-center gap-2">
            <Lightbulb className="h-6 w-6 text-yellow-500" />
            Tips & feedback
          </h2>
          <p className="text-muted-foreground text-sm">
            Sales techniques that work and customer suggestions to improve our service
          </p>
        </div>
        <Button 
          onClick={() => setShowAddForm(!showAddForm)}
          className="gap-2"
          size="lg"
        >
          <Plus className="h-5 w-5" />
          Add New
        </Button>
      </div>

      {/* Quick Add Form - Expandable */}
      {showAddForm && (
        <Card className="border-2 border-primary/30 bg-primary/5 animate-in slide-in-from-top-2">
          <CardContent className="p-4 space-y-4">
            <div className="flex items-center gap-2 mb-2">
              <Sparkles className="h-5 w-5 text-primary" />
              <span className="font-semibold">Add New Tip or Feedback</span>
            </div>
            
            {/* Category Selection - Two Sections */}
            <div className="space-y-3">
              {/* Selling Tips Section */}
              <div>
                <p className="text-xs font-semibold text-muted-foreground mb-2 flex items-center gap-1">
                  <Sparkles className="h-3 w-3" /> Selling Tips That Work
                </p>
                <div className="grid grid-cols-3 gap-2">
                  {SELLING_TIPS_CATEGORIES.map((cat) => {
                    const Icon = cat.icon;
                    return (
                      <button
                        key={cat.value}
                        onClick={() => setNewCategory(cat.value)}
                        className={cn(
                          "flex flex-col items-center gap-1 p-3 rounded-lg border-2 transition-all text-xs",
                          newCategory === cat.value 
                            ? "border-primary bg-primary/10 shadow-md" 
                            : "border-muted hover:border-primary/50 hover:bg-muted"
                        )}
                      >
                        <Icon className="h-5 w-5" />
                        <span className="font-medium text-center leading-tight">{cat.label}</span>
                      </button>
                    );
                  })}
                </div>
              </div>
              
              {/* Customer Feedback Section */}
              <div>
                <p className="text-xs font-semibold text-muted-foreground mb-2 flex items-center gap-1">
                  <Users className="h-3 w-3" /> Customer Feedback on Improving Service
                </p>
                <div className="grid grid-cols-4 gap-2">
                  {CUSTOMER_FEEDBACK_CATEGORIES.map((cat) => {
                    const Icon = cat.icon;
                    return (
                      <button
                        key={cat.value}
                        onClick={() => setNewCategory(cat.value)}
                        className={cn(
                          "flex flex-col items-center gap-1 p-3 rounded-lg border-2 transition-all text-xs",
                          newCategory === cat.value 
                            ? "border-primary bg-primary/10 shadow-md" 
                            : "border-muted hover:border-primary/50 hover:bg-muted"
                        )}
                      >
                        <Icon className="h-5 w-5" />
                        <span className="font-medium text-center leading-tight">{cat.label}</span>
                      </button>
                    );
                  })}
                </div>
              </div>
            </div>

            {/* Title */}
            <Input
              placeholder="Quick title (e.g., 'Mention MOT cover early')"
              value={newTitle}
              onChange={(e) => setNewTitle(e.target.value)}
              className="text-lg font-medium"
              autoFocus
            />

            {/* Content */}
            <Textarea
              placeholder="Describe your tip, technique, or feedback in detail...

Examples:
• 'When customers hesitate, mention the breakdown cover included'
• 'Missing: Electric van warranty option'
• 'Website: Quote form should show monthly price first'"
              value={newContent}
              onChange={(e) => setNewContent(e.target.value)}
              className="min-h-[120px] resize-none"
            />

            {/* Actions */}
            <div className="flex items-center gap-2">
              <Button onClick={handleQuickAdd} disabled={saving} className="gap-2">
                <Save className="h-4 w-4" />
                {saving ? 'Saving...' : 'Save Tip'}
              </Button>
              <Button 
                variant="outline" 
                onClick={() => {
                  setShowAddForm(false);
                  setNewTitle('');
                  setNewContent('');
                }}
              >
                Cancel
              </Button>
            </div>
          </CardContent>
        </Card>
      )}

      {/* Filter Tabs - Two main sections */}
      <Tabs value={activeTab} onValueChange={setActiveTab}>
        <TabsList className="flex-wrap h-auto gap-1 p-1">
          <TabsTrigger value="all" className="gap-1">
            All ({tips.length})
          </TabsTrigger>
          <div className="w-px h-6 bg-border mx-1" />
          <TabsTrigger value="selling_tips" className="gap-1">
            <Sparkles className="h-3 w-3" />
            Selling Tips ({tips.filter(t => SELLING_TIPS_CATEGORIES.some(c => c.value === t.category)).length})
          </TabsTrigger>
          <TabsTrigger value="customer_feedback" className="gap-1">
            <Users className="h-3 w-3" />
            Customer Feedback ({tips.filter(t => CUSTOMER_FEEDBACK_CATEGORIES.some(c => c.value === t.category)).length})
          </TabsTrigger>
          <div className="w-px h-6 bg-border mx-1" />
          <TabsTrigger value="open" className="gap-1">
            <AlertCircle className="h-3 w-3" />
            Open ({tips.filter(t => !t.is_resolved).length})
          </TabsTrigger>
          <TabsTrigger value="resolved" className="gap-1">
            <CheckCircle2 className="h-3 w-3" />
            Resolved ({tips.filter(t => t.is_resolved).length})
          </TabsTrigger>
        </TabsList>

        <TabsContent value={activeTab} className="mt-4 space-y-3">
          {/* Pinned Tips */}
          {pinnedTips.length > 0 && (
            <div className="space-y-2">
              <div className="flex items-center gap-2 text-sm text-muted-foreground">
                <Pin className="h-4 w-4" />
                <span>Pinned</span>
              </div>
              {pinnedTips.map((tip) => (
                <TipCard 
                  key={tip.id} 
                  tip={tip} 
                  getCategoryInfo={getCategoryInfo}
                  onTogglePin={handleTogglePin}
                  onToggleResolved={handleToggleResolved}
                  onDelete={handleDelete}
                  isEditing={editingTip === tip.id}
                  onStartEdit={handleStartEdit}
                  onCancelEdit={handleCancelEdit}
                  onSaveEdit={handleUpdateTip}
                  editTitle={editTitle}
                  setEditTitle={setEditTitle}
                  editContent={editContent}
                  setEditContent={setEditContent}
                  editCategory={editCategory}
                  setEditCategory={setEditCategory}
                  saving={saving}
                />
              ))}
            </div>
          )}

          {/* Regular Tips */}
          {regularTips.length > 0 && (
            <div className="space-y-2">
              {pinnedTips.length > 0 && (
                <div className="text-sm text-muted-foreground">All Tips</div>
              )}
              {regularTips.map((tip) => (
                <TipCard 
                  key={tip.id} 
                  tip={tip} 
                  getCategoryInfo={getCategoryInfo}
                  onTogglePin={handleTogglePin}
                  onToggleResolved={handleToggleResolved}
                  onDelete={handleDelete}
                  isEditing={editingTip === tip.id}
                  onStartEdit={handleStartEdit}
                  onCancelEdit={handleCancelEdit}
                  onSaveEdit={handleUpdateTip}
                  editTitle={editTitle}
                  setEditTitle={setEditTitle}
                  editContent={editContent}
                  setEditContent={setEditContent}
                  editCategory={editCategory}
                  setEditCategory={setEditCategory}
                  saving={saving}
                />
              ))}
            </div>
          )}

          {/* Empty State */}
          {filteredTips.length === 0 && (
            <div className="text-center py-12 text-muted-foreground">
              <Lightbulb className="h-12 w-12 mx-auto mb-4 opacity-30" />
              <p className="text-lg font-medium">No tips yet</p>
              <p className="text-sm">Be the first to share a selling technique or feedback!</p>
              <Button 
                className="mt-4 gap-2" 
                onClick={() => setShowAddForm(true)}
              >
                <Plus className="h-4 w-4" />
                Add First Tip
              </Button>
            </div>
          )}
        </TabsContent>
      </Tabs>
    </div>
  );
};

// Individual Tip Card Component
interface TipCardProps {
  tip: SellingTip;
  getCategoryInfo: (category: string) => typeof CATEGORIES[0];
  onTogglePin: (id: string, current: boolean) => void;
  onToggleResolved: (id: string, current: boolean) => void;
  onDelete: (id: string) => void;
  isEditing: boolean;
  onStartEdit: (tip: SellingTip) => void;
  onCancelEdit: () => void;
  onSaveEdit: () => void;
  editTitle: string;
  setEditTitle: (value: string) => void;
  editContent: string;
  setEditContent: (value: string) => void;
  editCategory: string;
  setEditCategory: (value: string) => void;
  saving: boolean;
}

const TipCard: React.FC<TipCardProps> = ({ 
  tip, 
  getCategoryInfo, 
  onTogglePin, 
  onToggleResolved, 
  onDelete,
  isEditing,
  onStartEdit,
  onCancelEdit,
  onSaveEdit,
  editTitle,
  setEditTitle,
  editContent,
  setEditContent,
  editCategory,
  setEditCategory,
  saving
}) => {
  const catInfo = getCategoryInfo(tip.category);
  const Icon = catInfo.icon;
  
  const creatorName = tip.creator 
    ? `${tip.creator.first_name || ''} ${tip.creator.last_name || ''}`.trim() || tip.creator.email?.split('@')[0]
    : 'Unknown';

  // Edit mode view
  if (isEditing) {
    return (
      <Card className="border-primary/50 bg-primary/5">
        <CardContent className="p-4 space-y-3">
          <div className="flex items-center justify-between">
            <span className="text-sm font-medium text-muted-foreground">Editing Tip</span>
            <div className="flex items-center gap-2">
              <Button
                variant="ghost"
                size="sm"
                onClick={onCancelEdit}
                disabled={saving}
              >
                <X className="h-4 w-4 mr-1" />
                Cancel
              </Button>
              <Button
                size="sm"
                onClick={onSaveEdit}
                disabled={saving}
              >
                <Save className="h-4 w-4 mr-1" />
                {saving ? 'Saving...' : 'Save'}
              </Button>
            </div>
          </div>
          
          <Select value={editCategory} onValueChange={setEditCategory}>
            <SelectTrigger className="w-full">
              <SelectValue placeholder="Category" />
            </SelectTrigger>
            <SelectContent>
              <div className="px-2 py-1.5 text-xs font-semibold text-muted-foreground">Selling Tips</div>
              {SELLING_TIPS_CATEGORIES.map((cat) => (
                <SelectItem key={cat.value} value={cat.value}>
                  <div className="flex items-center gap-2">
                    <cat.icon className="h-4 w-4" />
                    {cat.label}
                  </div>
                </SelectItem>
              ))}
              <div className="px-2 py-1.5 text-xs font-semibold text-muted-foreground border-t mt-1">Customer Feedback</div>
              {CUSTOMER_FEEDBACK_CATEGORIES.map((cat) => (
                <SelectItem key={cat.value} value={cat.value}>
                  <div className="flex items-center gap-2">
                    <cat.icon className="h-4 w-4" />
                    {cat.label}
                  </div>
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
          
          <Input
            placeholder="Title"
            value={editTitle}
            onChange={(e) => setEditTitle(e.target.value)}
          />
          
          <Textarea
            placeholder="Content"
            value={editContent}
            onChange={(e) => setEditContent(e.target.value)}
            rows={3}
          />
        </CardContent>
      </Card>
    );
  }

  // Normal view
  return (
    <Card className={cn(
      "transition-all hover:shadow-md",
      tip.is_resolved && "opacity-60",
      tip.is_pinned && "border-primary/30 bg-primary/5"
    )}>
      <CardContent className="p-4">
        <div className="flex items-start gap-3">
          {/* Category Icon */}
          <div className={cn("p-2 rounded-lg flex-shrink-0", catInfo.color)}>
            <Icon className="h-5 w-5" />
          </div>

          {/* Content */}
          <div className="flex-1 min-w-0">
            <div className="flex items-start justify-between gap-2">
              <div className="flex-1">
                <div className="flex items-center gap-2 flex-wrap">
                  <h3 className={cn(
                    "font-semibold",
                    tip.is_resolved && "line-through"
                  )}>
                    {tip.title}
                  </h3>
                  <Badge variant="outline" className={cn("text-xs", catInfo.color)}>
                    {catInfo.label}
                  </Badge>
                  {tip.is_pinned && (
                    <Badge className="bg-yellow-500 text-white text-xs">📌 Pinned</Badge>
                  )}
                  {tip.is_resolved && (
                    <Badge className="bg-green-500 text-white text-xs">✓ Resolved</Badge>
                  )}
                </div>
                <p className="text-sm text-foreground mt-1 whitespace-pre-wrap">
                  {tip.content}
                </p>
                <div className="flex items-center gap-3 mt-2 text-xs text-muted-foreground">
                  <span>By {creatorName}</span>
                  <span>•</span>
                  <span>{format(new Date(tip.created_at), 'dd MMM yyyy, HH:mm')}</span>
                </div>
              </div>

              {/* Actions */}
              <div className="flex items-center gap-1 flex-shrink-0">
                <Button
                  variant="ghost"
                  size="icon"
                  className="h-8 w-8"
                  onClick={() => onStartEdit(tip)}
                  title="Edit"
                >
                  <Edit2 className="h-4 w-4" />
                </Button>
                <Button
                  variant="ghost"
                  size="icon"
                  className="h-8 w-8"
                  onClick={() => onTogglePin(tip.id, tip.is_pinned)}
                  title={tip.is_pinned ? 'Unpin' : 'Pin to top'}
                >
                  {tip.is_pinned ? (
                    <PinOff className="h-4 w-4" />
                  ) : (
                    <Pin className="h-4 w-4" />
                  )}
                </Button>
                <Button
                  variant="ghost"
                  size="icon"
                  className={cn("h-8 w-8", tip.is_resolved && "text-green-600")}
                  onClick={() => onToggleResolved(tip.id, tip.is_resolved)}
                  title={tip.is_resolved ? 'Mark as open' : 'Mark as resolved'}
                >
                  <Check className="h-4 w-4" />
                </Button>
                <Button
                  variant="ghost"
                  size="icon"
                  className="h-8 w-8 text-destructive hover:text-destructive"
                  onClick={() => onDelete(tip.id)}
                  title="Delete"
                >
                  <Trash2 className="h-4 w-4" />
                </Button>
              </div>
            </div>
          </div>
        </div>
      </CardContent>
    </Card>
  );
};
