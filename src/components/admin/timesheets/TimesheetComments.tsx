import React, { useState, useEffect, useCallback } from 'react';
import { format } from 'date-fns';
import { MessageSquare, Send } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Textarea } from '@/components/ui/textarea';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/hooks/useAuth';
import { toast } from 'sonner';

interface Comment {
  id: string;
  message: string;
  is_from_accounts: boolean;
  created_at: string;
  author_name: string;
}

interface TimesheetCommentsProps {
  currentMonth: Date;
}

export function TimesheetComments({ currentMonth }: TimesheetCommentsProps) {
  const { session } = useAuth();
  const [comments, setComments] = useState<Comment[]>([]);
  const [newMessage, setNewMessage] = useState('');
  const [sending, setSending] = useState(false);
  const [adminUserId, setAdminUserId] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);

  const monthKey = format(currentMonth, 'yyyy-MM');

  useEffect(() => {
    async function getAdminId() {
      if (!session?.user?.id) return;
      const { data } = await supabase
        .from('admin_users')
        .select('id')
        .eq('user_id', session.user.id)
        .maybeSingle();
      setAdminUserId(data?.id || null);
    }
    getAdminId();
  }, [session?.user?.id]);

  const fetchComments = useCallback(async () => {
    if (!adminUserId) return;
    setLoading(true);
    try {
      const { data, error } = await supabase
        .from('timesheet_comments')
        .select('*, author:author_id(first_name, last_name, email)')
        .eq('admin_user_id', adminUserId)
        .eq('month_year', monthKey)
        .order('created_at', { ascending: true });

      if (error) throw error;

      setComments((data || []).map(c => {
        const author = c.author as any;
        return {
          id: c.id,
          message: c.message,
          is_from_accounts: c.is_from_accounts ?? false,
          created_at: c.created_at,
          author_name: author ? `${author.first_name || ''} ${author.last_name || ''}`.trim() || author.email : 'Unknown',
        };
      }));
    } catch (err) {
      console.error('Error fetching comments:', err);
    } finally {
      setLoading(false);
    }
  }, [adminUserId, monthKey]);

  useEffect(() => {
    fetchComments();
  }, [fetchComments]);

  const sendMessage = async () => {
    const text = newMessage.trim();
    if (!text || !adminUserId) return;

    setSending(true);
    try {
      const { error } = await supabase
        .from('timesheet_comments')
        .insert({
          admin_user_id: adminUserId,
          author_id: adminUserId,
          month_year: monthKey,
          message: text,
          is_from_accounts: false,
        });

      if (error) throw error;
      setNewMessage('');
      toast.success('Message sent');
      await fetchComments();
    } catch (err) {
      console.error('Error sending message:', err);
      toast.error('Failed to send message');
    } finally {
      setSending(false);
    }
  };

  if (!adminUserId) return null;

  return (
    <div className="bg-white rounded-xl shadow-sm border">
      <div className="p-4 border-b flex items-center gap-2">
        <MessageSquare className="h-5 w-5 text-blue-500" />
        <h3 className="font-semibold text-gray-900">Messages & Notes</h3>
        <span className="text-xs text-gray-500">({format(currentMonth, 'MMMM yyyy')})</span>
      </div>

      {/* Messages */}
      <div className="max-h-[300px] overflow-y-auto p-4 space-y-2">
        {loading ? (
          <p className="text-sm text-gray-400 text-center py-4">Loading...</p>
        ) : comments.length === 0 ? (
          <div className="text-center py-6">
            <MessageSquare className="h-8 w-8 mx-auto mb-2 text-gray-300" />
            <p className="text-sm text-gray-400">No messages this month</p>
            <p className="text-xs text-gray-400 mt-1">Leave a note for accounts about holidays, leave, or deal queries</p>
          </div>
        ) : (
          comments.map(comment => (
            <div
              key={comment.id}
              className={`p-2.5 rounded-lg text-sm max-w-[85%] ${
                comment.is_from_accounts
                  ? 'bg-blue-50 border border-blue-100 ml-auto text-right'
                  : 'bg-gray-100 border border-gray-200 mr-auto'
              }`}
            >
              <div className={`flex items-center gap-2 mb-1 ${comment.is_from_accounts ? 'justify-end' : ''}`}>
                <span className={`text-xs font-medium ${comment.is_from_accounts ? 'text-blue-600' : 'text-gray-600'}`}>
                  {comment.is_from_accounts ? 'Accounts' : 'You'}
                </span>
                <span className="text-[10px] text-gray-400">{format(new Date(comment.created_at), 'dd/MM HH:mm')}</span>
              </div>
              <p className="text-gray-800">{comment.message}</p>
            </div>
          ))
        )}
      </div>

      {/* Input */}
      <div className="border-t p-3 flex gap-2">
        <Textarea
          placeholder="Leave a note for accounts (holidays, queries, deal info...)"
          value={newMessage}
          onChange={e => setNewMessage(e.target.value)}
          className="min-h-[50px] text-sm resize-none"
          onKeyDown={e => {
            if (e.key === 'Enter' && !e.shiftKey) {
              e.preventDefault();
              sendMessage();
            }
          }}
        />
        <Button
          size="sm"
          className="self-end bg-blue-600 hover:bg-blue-700 text-white h-9 px-3"
          onClick={sendMessage}
          disabled={!newMessage.trim() || sending}
        >
          <Send className="h-3.5 w-3.5" />
        </Button>
      </div>
    </div>
  );
}
