import { useState, useEffect, useRef } from 'react';
import { useNavigate, useSearchParams } from 'react-router-dom';
import { useAuthStore } from '@/lib/store';
import api from '@/lib/api';
import { formatDateTime } from '@/lib/utils';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Input } from '@/components/ui/input';
import { ScrollArea } from '@/components/ui/scroll-area';
import { Avatar, AvatarFallback } from '@/components/ui/avatar';
import {
  MessageSquare,
  Send,
  Loader2,
  ArrowLeft,
  Search,
  User,
  Clock,
  CheckCircle,
  CheckCheck,
  Package,
  Calendar,
  ChevronRight,
  Inbox,
  RefreshCw
} from 'lucide-react';
import { toast } from 'sonner';

// Special ID for new support message
const SUPPORT_CONVERSATION_ID = 'support-new';

export const MessagingCenterPage = () => {
  const { user } = useAuthStore();
  const navigate = useNavigate();
  const [searchParams, setSearchParams] = useSearchParams();
  const selectedId = searchParams.get('id');
  
  const [conversations, setConversations] = useState([]);
  const [messages, setMessages] = useState([]);
  const [loading, setLoading] = useState(true);
  const [messagesLoading, setMessagesLoading] = useState(false);
  const [sending, setSending] = useState(false);
  const [newMessage, setNewMessage] = useState('');
  const [searchQuery, setSearchQuery] = useState('');
  const [refreshing, setRefreshing] = useState(false);
  const [showNewMessage, setShowNewMessage] = useState(false);
  const messagesEndRef = useRef(null);
  const refreshIntervalRef = useRef(null);

  useEffect(() => {
    if (!user) {
      navigate('/login');
      return;
    }
    fetchConversations();
  }, [user, navigate]);

  useEffect(() => {
    if (selectedId === SUPPORT_CONVERSATION_ID) {
      // New support message - show empty chat
      setMessages([]);
      setShowNewMessage(true);
      setMessagesLoading(false);
      
      // Clear interval for new message
      if (refreshIntervalRef.current) {
        clearInterval(refreshIntervalRef.current);
      }
    } else if (selectedId) {
      setShowNewMessage(false);
      fetchMessages(selectedId);
      markAsRead(selectedId);
      
      // Auto-refresh messages every 3 seconds
      refreshIntervalRef.current = setInterval(() => {
        fetchMessagesQuiet(selectedId);
      }, 3000);
      
      return () => {
        if (refreshIntervalRef.current) {
          clearInterval(refreshIntervalRef.current);
        }
      };
    }
  }, [selectedId]);

  useEffect(() => {
    scrollToBottom();
  }, [messages]);

  const scrollToBottom = () => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  };

  const fetchConversations = async () => {
    try {
      const response = await api.get('/conversations');
      setConversations(response.data);
    } catch (error) {
      toast.error('Failed to load conversations');
    } finally {
      setLoading(false);
    }
  };

  const fetchMessages = async (orderId) => {
    setMessagesLoading(true);
    try {
      const response = await api.get(`/messages/${orderId}`);
      setMessages(response.data);
    } catch (error) {
      toast.error('Failed to load messages');
    } finally {
      setMessagesLoading(false);
    }
  };

  // Quiet fetch for auto-refresh (no loading state)
  const fetchMessagesQuiet = async (orderId) => {
    try {
      const response = await api.get(`/messages/${orderId}`);
      setMessages(prev => {
        // Only update if there are new messages
        if (JSON.stringify(prev) !== JSON.stringify(response.data)) {
          return response.data;
        }
        return prev;
      });
    } catch (error) {
      console.error('Auto-refresh failed:', error);
    }
  };

  // Manual refresh with visual feedback
  const handleRefresh = async () => {
    if (!selectedId) return;
    setRefreshing(true);
    try {
      const [messagesRes, convoRes] = await Promise.all([
        api.get(`/messages/${selectedId}`),
        api.get('/conversations')
      ]);
      setMessages(messagesRes.data);
      setConversations(convoRes.data);
      markAsRead(selectedId);
    } catch (error) {
      toast.error('Failed to refresh');
    } finally {
      setRefreshing(false);
    }
  };

  const markAsRead = async (orderId) => {
    try {
      await api.put(`/messages/${orderId}/read`);
      setConversations(prev => 
        prev.map(c => c.id === orderId ? { ...c, unread_count: 0 } : c)
      );
    } catch (error) {
      console.error('Failed to mark as read:', error);
    }
  };

  const sendMessage = async (e) => {
    e.preventDefault();
    if (!newMessage.trim() || !selectedId) return;

    setSending(true);
    try {
      // For new support messages, use 'support' as order_id
      const orderId = selectedId === SUPPORT_CONVERSATION_ID ? 'support' : selectedId;
      
      const response = await api.post('/messages', {
        order_id: orderId,
        message: newMessage.trim()
      });
      setMessages(prev => [...prev, response.data]);
      setNewMessage('');
      
      // If this was a new support message, add it to conversations and select it
      if (selectedId === SUPPORT_CONVERSATION_ID) {
        const newConvo = {
          id: 'support',
          type: 'support',
          title: 'Support',
          subtitle: 'General Inquiry',
          status: 'active',
          last_message: newMessage.trim(),
          last_message_time: new Date().toISOString(),
          unread_count: 0,
          created_at: new Date().toISOString()
        };
        setConversations(prev => [newConvo, ...prev.filter(c => c.id !== 'support')]);
        setSearchParams({ id: 'support' });
        setShowNewMessage(false);
      } else {
        // Update conversation preview
        setConversations(prev => 
          prev.map(c => c.id === selectedId 
            ? { ...c, last_message: newMessage.trim(), last_message_time: new Date().toISOString() }
            : c
          ).sort((a, b) => new Date(b.last_message_time || b.created_at) - new Date(a.last_message_time || a.created_at))
        );
      }
    } catch (error) {
      toast.error('Failed to send message');
    } finally {
      setSending(false);
    }
  };

  const startNewMessage = () => {
    setSearchParams({ id: SUPPORT_CONVERSATION_ID });
  };

  const selectConversation = (id) => {
    setSearchParams({ id });
  };

  const getStatusColor = (status) => {
    const colors = {
      pending: 'bg-amber-100 text-amber-800',
      accepted: 'bg-blue-100 text-blue-800',
      in_progress: 'bg-purple-100 text-purple-800',
      completed: 'bg-green-100 text-green-800',
      cancelled: 'bg-gray-100 text-gray-800',
      scheduled: 'bg-blue-100 text-blue-800',
    };
    return colors[status] || 'bg-gray-100 text-gray-800';
  };

  const filteredConversations = conversations.filter(c => 
    c.title.toLowerCase().includes(searchQuery.toLowerCase()) ||
    c.subtitle.toLowerCase().includes(searchQuery.toLowerCase())
  );

  const selectedConversation = conversations.find(c => c.id === selectedId);

  if (!user) return null;

  // On mobile with conversation selected, render full-screen chat without header/footer interference
  if (selectedId && typeof window !== 'undefined' && window.innerWidth < 1024) {
    return (
      <div className="fixed inset-0 z-50 bg-background flex flex-col" data-testid="messaging-center-page">
        <Card className="flex-1 flex flex-col rounded-none border-0 shadow-none">
          {/* Conversation Header */}
          <CardHeader className="border-b pb-3 px-3 flex-shrink-0 bg-card">
            <div className="flex items-center justify-between gap-2">
              <div className="flex items-center gap-2 min-w-0">
                <Button
                  variant="ghost"
                  size="sm"
                  onClick={() => setSearchParams({})}
                  className="p-2 flex-shrink-0"
                >
                  <ArrowLeft className="h-5 w-5" />
                </Button>
                <div className={`h-8 w-8 rounded-full flex items-center justify-center flex-shrink-0 ${
                  showNewMessage || selectedId === 'support' ? 'bg-green-100' :
                  selectedConversation?.type === 'order' ? 'bg-primary/10' : 
                  selectedConversation?.type === 'support' ? 'bg-green-100' : 'bg-accent/10'
                }`}>
                  {showNewMessage || selectedId === 'support' || selectedConversation?.type === 'support' ? (
                    <MessageSquare className="h-4 w-4 text-green-600" />
                  ) : selectedConversation?.type === 'order' ? (
                    <Package className="h-4 w-4 text-primary" />
                  ) : (
                    <Calendar className="h-4 w-4 text-accent" />
                  )}
                </div>
                <div className="min-w-0">
                  <h3 className="font-semibold text-foreground text-sm truncate">
                    {showNewMessage ? 'New Message' : (selectedId === 'support' ? 'Support' : selectedConversation?.title || 'Chat')}
                  </h3>
                  <p className="text-xs text-muted-foreground truncate">
                    {showNewMessage ? 'Send to support' : (selectedId === 'support' ? 'General Inquiry' : selectedConversation?.subtitle || '')}
                  </p>
                </div>
              </div>
              <div className="flex items-center gap-1 flex-shrink-0">
                <Button
                  variant="ghost"
                  size="sm"
                  onClick={handleRefresh}
                  disabled={refreshing}
                  className="p-1"
                >
                  <RefreshCw className={`h-4 w-4 ${refreshing ? 'animate-spin' : ''}`} />
                </Button>
                {selectedConversation?.type !== 'support' && selectedId !== 'support' && !showNewMessage && (
                  <Button
                    variant="outline"
                    size="sm"
                    onClick={() => navigate(`/orders/${selectedId}/tracking`)}
                    className="text-xs px-2"
                  >
                    Track
                  </Button>
                )}
              </div>
            </div>
          </CardHeader>

          {/* Messages */}
          <CardContent className="flex-1 overflow-hidden p-0">
            {messagesLoading ? (
              <div className="flex items-center justify-center h-full">
                <Loader2 className="h-6 w-6 animate-spin text-accent" />
              </div>
            ) : messages.length === 0 ? (
              <div className="flex flex-col items-center justify-center h-full text-center px-4">
                <MessageSquare className="h-12 w-12 text-muted-foreground/30 mb-3" />
                <p className="text-muted-foreground">No messages yet</p>
                <p className="text-sm text-muted-foreground">Start the conversation below</p>
              </div>
            ) : (
              <ScrollArea className="h-full p-3">
                <div className="space-y-3">
                  {messages.map((message) => {
                    const isOwn = message.sender_id === user.id;
                    const isAdmin = user.role === 'admin';
                    const showReadReceipt = isOwn && isAdmin;
                    return (
                      <div key={message.id} className={`flex ${isOwn ? 'justify-end' : 'justify-start'}`}>
                        <div className={`max-w-[85%] ${isOwn ? 'bg-accent text-white rounded-l-lg rounded-tr-lg' : 'bg-muted rounded-r-lg rounded-tl-lg'} p-2`}>
                          <p className={`text-sm ${isOwn ? 'text-white' : 'text-foreground'}`}>{message.message}</p>
                          <div className={`flex items-center gap-1 mt-1 ${isOwn ? 'justify-end' : ''}`}>
                            <span className={`text-xs ${isOwn ? 'text-white/60' : 'text-muted-foreground'}`}>
                              {formatDateTime(message.created_at)}
                            </span>
                            {showReadReceipt && (
                              message.read ? <CheckCheck className="h-3 w-3 text-blue-300" /> : <CheckCircle className="h-3 w-3 text-white/60" />
                            )}
                          </div>
                        </div>
                      </div>
                    );
                  })}
                  <div ref={messagesEndRef} />
                </div>
              </ScrollArea>
            )}
          </CardContent>

          {/* Input */}
          <div className="p-3 border-t flex-shrink-0 bg-card">
            <form onSubmit={sendMessage} className="flex gap-2">
              <Input
                placeholder="Type a message..."
                value={newMessage}
                onChange={(e) => setNewMessage(e.target.value)}
                disabled={sending}
                className="flex-1 text-base"
                data-testid="message-input"
              />
              <Button type="submit" disabled={!newMessage.trim() || sending} className="bg-accent hover:bg-accent/90" data-testid="send-message-btn">
                {sending ? <Loader2 className="h-4 w-4 animate-spin" /> : <Send className="h-4 w-4" />}
              </Button>
            </form>
          </div>
        </Card>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-background" data-testid="messaging-center-page">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-4 sm:py-6">
        {/* Header */}
        <div className="flex items-center gap-3 mb-4 sm:mb-6">
          <Button
            variant="ghost"
            size="sm"
            onClick={() => navigate('/dashboard')}
            className="gap-2 px-2 sm:px-3"
          >
            <ArrowLeft className="h-4 w-4" />
            <span className="hidden sm:inline">Back to Dashboard</span>
          </Button>
          <div>
            <h1 className="text-xl sm:text-2xl font-bold text-foreground">Messages</h1>
            <p className="text-xs sm:text-sm text-muted-foreground hidden sm:block">
              Communicate about your orders and consultations
            </p>
          </div>
        </div>

        <div className="grid grid-cols-1 lg:grid-cols-3 gap-4 sm:gap-6 h-[calc(100vh-160px)] sm:h-[calc(100vh-200px)]">
          {/* Conversations List */}
          <Card className="lg:col-span-1 flex flex-col">
            <CardHeader className="pb-3 space-y-3 px-3 sm:px-6">
              {/* New Message Button */}
              <Button
                onClick={startNewMessage}
                className="w-full bg-accent hover:bg-accent/90 gap-2"
                data-testid="new-message-btn"
              >
                <MessageSquare className="h-4 w-4" />
                New Message
              </Button>
              <div className="relative">
                <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
                <Input
                  placeholder="Search..."
                  value={searchQuery}
                  onChange={(e) => setSearchQuery(e.target.value)}
                  className="pl-9"
                  data-testid="conversation-search"
                />
              </div>
            </CardHeader>
            <CardContent className="flex-1 overflow-hidden p-0">
              {loading ? (
                <div className="flex items-center justify-center h-40">
                  <Loader2 className="h-6 w-6 animate-spin text-accent" />
                </div>
              ) : filteredConversations.length === 0 ? (
                <div className="flex flex-col items-center justify-center h-40 text-center px-4">
                  <Inbox className="h-12 w-12 text-muted-foreground/30 mb-3" />
                  <p className="text-muted-foreground">No conversations yet</p>
                  <p className="text-sm text-muted-foreground">
                    Messages will appear here when you place orders
                  </p>
                </div>
              ) : (
                <ScrollArea className="h-[calc(100vh-320px)] sm:h-[calc(100vh-340px)]">
                  <div className="space-y-1 p-2">
                    {filteredConversations.map((conversation) => (
                      <button
                        key={conversation.id}
                        onClick={() => selectConversation(conversation.id)}
                        className={`w-full p-2 sm:p-3 rounded-lg text-left transition-colors ${
                          selectedId === conversation.id
                            ? 'bg-accent/10 border-l-4 border-accent'
                            : 'hover:bg-muted/50'
                        }`}
                        data-testid={`conversation-${conversation.id}`}
                      >
                        <div className="flex items-start gap-2 sm:gap-3">
                          <div className={`h-8 w-8 sm:h-10 sm:w-10 rounded-full flex items-center justify-center flex-shrink-0 ${
                            conversation.type === 'order' ? 'bg-primary/10' : 
                            conversation.type === 'support' ? 'bg-green-100' : 'bg-accent/10'
                          }`}>
                            {conversation.type === 'order' ? (
                              <Package className="h-4 w-4 sm:h-5 sm:w-5 text-primary" />
                            ) : conversation.type === 'support' ? (
                              <MessageSquare className="h-4 w-4 sm:h-5 sm:w-5 text-green-600" />
                            ) : (
                              <Calendar className="h-4 w-4 sm:h-5 sm:w-5 text-accent" />
                            )}
                          </div>
                          <div className="flex-1 min-w-0">
                            <div className="flex items-center justify-between gap-2">
                              <p className="font-medium text-foreground truncate">
                                {conversation.title}
                              </p>
                              {conversation.unread_count > 0 && (
                                <Badge className="bg-accent text-white text-xs h-5 min-w-5 flex items-center justify-center">
                                  {conversation.unread_count}
                                </Badge>
                              )}
                            </div>
                            <p className="text-xs text-muted-foreground truncate">
                              {conversation.subtitle}
                            </p>
                            {conversation.last_message && (
                              <p className="text-sm text-muted-foreground truncate mt-1">
                                {conversation.last_message}
                              </p>
                            )}
                            <div className="flex items-center gap-2 mt-1">
                              <Badge className={`text-xs ${getStatusColor(conversation.status)}`}>
                                {conversation.status?.replace(/_/g, ' ')}
                              </Badge>
                            </div>
                          </div>
                        </div>
                      </button>
                    ))}
                  </div>
                </ScrollArea>
              )}
            </CardContent>
          </Card>

          {/* Messages Area - Show on mobile when conversation selected */}
          <Card className={`lg:col-span-2 flex flex-col rounded-none lg:rounded-lg ${!selectedId ? 'hidden lg:flex' : 'flex h-[100dvh] lg:h-auto'}`}>
            {showNewMessage || selectedId ? (
              <>
                {/* Conversation Header */}
                <CardHeader className="border-b pb-3 sm:pb-4 px-3 sm:px-6 flex-shrink-0 bg-card">
                  <div className="flex items-center justify-between gap-2">
                    <div className="flex items-center gap-2 sm:gap-3 min-w-0">
                      {/* Back button for mobile */}
                      <Button
                        variant="ghost"
                        size="sm"
                        onClick={() => setSearchParams({})}
                        className="lg:hidden p-2 flex-shrink-0"
                      >
                        <ArrowLeft className="h-5 w-5" />
                      </Button>
                      <div className={`h-8 w-8 sm:h-10 sm:w-10 rounded-full flex items-center justify-center flex-shrink-0 ${
                        showNewMessage || selectedId === 'support' ? 'bg-green-100' :
                        selectedConversation?.type === 'order' ? 'bg-primary/10' : 
                        selectedConversation?.type === 'support' ? 'bg-green-100' : 'bg-accent/10'
                      }`}>
                        {showNewMessage || selectedId === 'support' || selectedConversation?.type === 'support' ? (
                          <MessageSquare className="h-4 w-4 sm:h-5 sm:w-5 text-green-600" />
                        ) : selectedConversation?.type === 'order' ? (
                          <Package className="h-4 w-4 sm:h-5 sm:w-5 text-primary" />
                        ) : (
                          <Calendar className="h-4 w-4 sm:h-5 sm:w-5 text-accent" />
                        )}
                      </div>
                      <div className="min-w-0">
                        <h3 className="font-semibold text-foreground text-sm sm:text-base truncate">
                          {showNewMessage ? 'New Message' : (selectedId === 'support' ? 'Support' : selectedConversation?.title || 'Chat')}
                        </h3>
                        <p className="text-xs sm:text-sm text-muted-foreground truncate">
                          {showNewMessage ? 'Send to support' : (selectedId === 'support' ? 'General Inquiry' : selectedConversation?.subtitle || '')}
                        </p>
                      </div>
                    </div>
                    <div className="flex items-center gap-1 sm:gap-2 flex-shrink-0">
                      {!showNewMessage && (
                        <>
                          <Button
                            variant="ghost"
                            size="sm"
                            onClick={handleRefresh}
                            disabled={refreshing}
                            className="p-1 sm:p-2"
                            data-testid="refresh-messages-btn"
                          >
                            <RefreshCw className={`h-4 w-4 ${refreshing ? 'animate-spin' : ''}`} />
                          </Button>
                          <Badge className={`text-xs hidden sm:flex ${getStatusColor(selectedConversation?.status)}`}>
                            {selectedConversation?.status?.replace(/_/g, ' ')}
                          </Badge>
                          {selectedConversation?.type !== 'support' && (
                            <Button
                              variant="outline"
                              size="sm"
                              onClick={() => navigate(`/orders/${selectedId}/tracking`)}
                              className="gap-1 text-xs sm:text-sm px-2 sm:px-3"
                            >
                              <span className="hidden sm:inline">Track Order</span>
                              <span className="sm:hidden">Track</span>
                              <ChevronRight className="h-4 w-4" />
                            </Button>
                          )}
                        </>
                      )}
                    </div>
                  </div>
                </CardHeader>

                {/* Messages List */}
                <CardContent className="flex-1 overflow-hidden p-0">
                  {messagesLoading ? (
                    <div className="flex items-center justify-center h-40">
                      <Loader2 className="h-6 w-6 animate-spin text-accent" />
                    </div>
                  ) : messages.length === 0 ? (
                    <div className="flex flex-col items-center justify-center h-full text-center px-4">
                      <MessageSquare className="h-12 w-12 text-muted-foreground/30 mb-3" />
                      <p className="text-muted-foreground">No messages yet</p>
                      <p className="text-sm text-muted-foreground">
                        Start a conversation by sending a message below
                      </p>
                    </div>
                  ) : (
                    <ScrollArea className="h-[calc(100vh-300px)] sm:h-[calc(100vh-420px)] p-3 sm:p-4">
                      <div className="space-y-3 sm:space-y-4">
                        {messages.map((message) => {
                          const isOwn = message.sender_id === user.id;
                          const isAdmin = user.role === 'admin';
                          const showReadReceipt = isOwn && isAdmin;
                          return (
                            <div
                              key={message.id}
                              className={`flex ${isOwn ? 'justify-end' : 'justify-start'}`}
                            >
                              <div
                                className={`max-w-[85%] sm:max-w-[80%] ${
                                  isOwn
                                    ? 'bg-accent text-white rounded-l-lg rounded-tr-lg'
                                    : 'bg-muted rounded-r-lg rounded-tl-lg'
                                } p-2 sm:p-3`}
                              >
                                <div className="flex items-center gap-2 mb-1">
                                  <span className={`text-xs font-medium ${
                                    isOwn ? 'text-white/80' : 'text-muted-foreground'
                                  }`}>
                                    {isOwn ? 'You' : (message.sender_role === 'admin' ? 'Support' : (isAdmin ? 'Customer' : 'Seller'))}
                                  </span>
                                </div>
                                <p className={`text-sm ${isOwn ? 'text-white' : 'text-foreground'}`}>
                                  {message.message}
                                </p>
                                <div className={`flex items-center gap-1 mt-1 ${
                                  isOwn ? 'justify-end' : ''
                                }`}>
                                  <span className={`text-xs ${
                                    isOwn ? 'text-white/60' : 'text-muted-foreground'
                                  }`}>
                                    {formatDateTime(message.created_at)}
                                  </span>
                                  {showReadReceipt && (
                                    <span title={message.read ? 'Read' : 'Sent'}>
                                      {message.read ? (
                                        <CheckCheck className="h-3 w-3 text-blue-300" />
                                      ) : (
                                        <CheckCircle className="h-3 w-3 text-white/60" />
                                      )}
                                    </span>
                                  )}
                                </div>
                              </div>
                            </div>
                          );
                        })}
                        <div ref={messagesEndRef} />
                      </div>
                    </ScrollArea>
                  )}
                </CardContent>

                {/* Message Input - Fixed at bottom on mobile */}
                <div className="p-3 sm:p-4 border-t flex-shrink-0 bg-background">
                  <form onSubmit={sendMessage} className="flex gap-2">
                    <Input
                      placeholder="Type a message..."
                      value={newMessage}
                      onChange={(e) => setNewMessage(e.target.value)}
                      disabled={sending}
                      className="flex-1 text-base"
                      data-testid="message-input"
                    />
                    <Button
                      type="submit"
                      disabled={!newMessage.trim() || sending}
                      className="bg-accent hover:bg-accent/90"
                      data-testid="send-message-btn"
                    >
                      {sending ? (
                        <Loader2 className="h-4 w-4 animate-spin" />
                      ) : (
                        <Send className="h-4 w-4" />
                      )}
                    </Button>
                  </form>
                </div>
              </>
            ) : (
              <div className="flex flex-col items-center justify-center h-full text-center px-4">
                <div className="h-20 w-20 bg-muted rounded-full flex items-center justify-center mb-4">
                  <MessageSquare className="h-10 w-10 text-muted-foreground/50" />
                </div>
                <h3 className="text-lg font-semibold text-foreground mb-2">
                  Select a conversation
                </h3>
                <p className="text-muted-foreground max-w-sm">
                  Choose a conversation from the list to view messages and communicate about your orders
                </p>
              </div>
            )}
          </Card>
        </div>
      </div>
    </div>
  );
};

export default MessagingCenterPage;
