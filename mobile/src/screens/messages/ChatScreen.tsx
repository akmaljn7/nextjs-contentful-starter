import React, { useState, useEffect, useRef } from 'react';
import {
  View,
  Text,
  StyleSheet,
  FlatList,
  TextInput,
  TouchableOpacity,
  KeyboardAvoidingView,
  Platform,
  RefreshControl,
} from 'react-native';
import { useRoute } from '@react-navigation/native';
import { Ionicons } from '@expo/vector-icons';
import { Colors } from '../../constants/colors';
import { Fonts } from '../../constants/fonts';
import { LoadingSpinner, ErrorMessage } from '../../components/common';
import { messagesApi } from '../../api';
import { useAuthStore } from '../../store';
import { Message } from '../../types/api';
import { formatRelativeTime } from '../../utils/formatters';

export const ChatScreen: React.FC = () => {
  const route = useRoute<any>();
  const { orderId, title } = route.params;
  const { user } = useAuthStore();
  const flatListRef = useRef<FlatList>(null);

  const [messages, setMessages] = useState<Message[]>([]);
  const [newMessage, setNewMessage] = useState('');
  const [isLoading, setIsLoading] = useState(true);
  const [isRefreshing, setIsRefreshing] = useState(false);
  const [isSending, setIsSending] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // Auto-refresh interval (every 5 seconds)
  useEffect(() => {
    loadMessages();
    // Mark messages as read when entering
    messagesApi.markAsRead(orderId).catch(console.error);
    
    // Set up auto-refresh
    const refreshInterval = setInterval(() => {
      loadMessagesQuiet();
    }, 5000);
    
    return () => clearInterval(refreshInterval);
  }, [orderId]);

  const loadMessages = async () => {
    try {
      setError(null);
      const data = await messagesApi.getMessages(orderId);
      setMessages(data);
    } catch (err: any) {
      setError(err.message || 'Failed to load messages');
    } finally {
      setIsLoading(false);
      setIsRefreshing(false);
    }
  };

  // Quiet refresh without loading state (for auto-refresh)
  const loadMessagesQuiet = async () => {
    try {
      const data = await messagesApi.getMessages(orderId);
      setMessages(prevMessages => {
        // Only update if there are new messages
        if (data.length !== prevMessages.length) {
          // Scroll to bottom if new messages
          setTimeout(() => {
            flatListRef.current?.scrollToEnd({ animated: true });
          }, 100);
          return data;
        }
        return prevMessages;
      });
    } catch (err) {
      // Silent fail for auto-refresh
      console.log('Auto-refresh failed:', err);
    }
  };

  const onRefresh = () => {
    setIsRefreshing(true);
    loadMessages();
  };

  const handleSend = async () => {
    if (!newMessage.trim() || isSending) return;

    setIsSending(true);
    try {
      const message = await messagesApi.send({
        order_id: orderId,
        message: newMessage.trim(),
      });
      setMessages(prev => [...prev, message]);
      setNewMessage('');
      // Scroll to bottom
      setTimeout(() => {
        flatListRef.current?.scrollToEnd({ animated: true });
      }, 100);
    } catch (err: any) {
      console.error('Failed to send message:', err);
    } finally {
      setIsSending(false);
    }
  };

  const isOwnMessage = (msg: Message) => {
    return msg.sender_id === user?.id;
  };

  const renderMessage = ({ item, index }: { item: Message; index: number }) => {
    const isOwn = isOwnMessage(item);
    const showTime = index === 0 || 
      (messages[index - 1] && 
       new Date(item.created_at).getTime() - new Date(messages[index - 1].created_at).getTime() > 300000);

    return (
      <View style={styles.messageContainer}>
        {showTime && (
          <Text style={styles.timestamp}>{formatRelativeTime(item.created_at)}</Text>
        )}
        <View style={[styles.messageBubble, isOwn ? styles.ownMessage : styles.otherMessage]}>
          {!isOwn && (
            <Text style={styles.senderName}>{item.sender_role === 'admin' ? 'Lightban Support' : item.sender_role}</Text>
          )}
          <Text style={[styles.messageText, isOwn ? styles.ownMessageText : styles.otherMessageText]}>
            {item.message}
          </Text>
        </View>
      </View>
    );
  };

  if (isLoading) {
    return <LoadingSpinner fullScreen message="Loading messages..." />;
  }

  if (error) {
    return <ErrorMessage message={error} onRetry={loadMessages} fullScreen />;
  }

  return (
    <KeyboardAvoidingView
      style={styles.container}
      behavior={Platform.OS === 'ios' ? 'padding' : undefined}
      keyboardVerticalOffset={Platform.OS === 'ios' ? 90 : 0}
    >
      <FlatList
        ref={flatListRef}
        data={messages}
        renderItem={renderMessage}
        keyExtractor={(item) => item.id}
        contentContainerStyle={styles.messagesList}
        showsVerticalScrollIndicator={false}
        refreshControl={
          <RefreshControl refreshing={isRefreshing} onRefresh={onRefresh} />
        }
        onContentSizeChange={() => flatListRef.current?.scrollToEnd({ animated: false })}
        ListEmptyComponent={
          <View style={styles.emptyContainer}>
            <Ionicons name="chatbubbles-outline" size={48} color={Colors.gray[400]} />
            <Text style={styles.emptyText}>No messages yet</Text>
            <Text style={styles.emptySubtext}>Send a message to start the conversation</Text>
          </View>
        }
      />

      <View style={styles.inputContainer}>
        <TextInput
          style={styles.input}
          placeholder="Type a message..."
          placeholderTextColor={Colors.textMuted}
          value={newMessage}
          onChangeText={setNewMessage}
          multiline
          maxLength={1000}
        />
        <TouchableOpacity
          style={[styles.sendButton, (!newMessage.trim() || isSending) && styles.sendButtonDisabled]}
          onPress={handleSend}
          disabled={!newMessage.trim() || isSending}
        >
          <Ionicons 
            name={isSending ? 'time-outline' : 'send'} 
            size={20} 
            color={Colors.white} 
          />
        </TouchableOpacity>
      </View>
    </KeyboardAvoidingView>
  );
};

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: Colors.background,
  },
  messagesList: {
    padding: 16,
    flexGrow: 1,
  },
  messageContainer: {
    marginBottom: 8,
  },
  timestamp: {
    fontSize: Fonts.size.xs,
    color: Colors.textMuted,
    textAlign: 'center',
    marginVertical: 12,
  },
  messageBubble: {
    maxWidth: '80%',
    padding: 12,
    borderRadius: 16,
  },
  ownMessage: {
    alignSelf: 'flex-end',
    backgroundColor: Colors.accent,
    borderBottomRightRadius: 4,
  },
  otherMessage: {
    alignSelf: 'flex-start',
    backgroundColor: Colors.white,
    borderBottomLeftRadius: 4,
  },
  senderName: {
    fontSize: Fonts.size.xs,
    color: Colors.textSecondary,
    marginBottom: 4,
    textTransform: 'capitalize',
  },
  messageText: {
    fontSize: Fonts.size.md,
    lineHeight: 20,
  },
  ownMessageText: {
    color: Colors.white,
  },
  otherMessageText: {
    color: Colors.textPrimary,
  },
  inputContainer: {
    flexDirection: 'row',
    alignItems: 'flex-end',
    padding: 12,
    backgroundColor: Colors.white,
    borderTopWidth: 1,
    borderTopColor: Colors.border,
  },
  input: {
    flex: 1,
    minHeight: 40,
    maxHeight: 100,
    backgroundColor: Colors.background,
    borderRadius: 20,
    paddingHorizontal: 16,
    paddingVertical: 10,
    fontSize: Fonts.size.md,
    color: Colors.textPrimary,
    marginRight: 8,
  },
  sendButton: {
    width: 40,
    height: 40,
    borderRadius: 20,
    backgroundColor: Colors.accent,
    alignItems: 'center',
    justifyContent: 'center',
  },
  sendButtonDisabled: {
    backgroundColor: Colors.gray[400],
  },
  emptyContainer: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: 60,
  },
  emptyText: {
    fontSize: Fonts.size.lg,
    fontWeight: Fonts.weight.semibold,
    color: Colors.textSecondary,
    marginTop: 16,
  },
  emptySubtext: {
    fontSize: Fonts.size.sm,
    color: Colors.textMuted,
    marginTop: 8,
  },
});
