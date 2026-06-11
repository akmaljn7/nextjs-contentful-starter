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
  Image,
  ActivityIndicator,
  Alert,
} from 'react-native';
import { useRoute } from '@react-navigation/native';
import { Ionicons } from '@expo/vector-icons';
import * as ImagePicker from 'expo-image-picker';
import { Colors } from '../../constants/colors';
import { Fonts } from '../../constants/fonts';
import { API_URL } from '../../constants/config';
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
  const [isUploading, setIsUploading] = useState(false);
  const [pendingMedia, setPendingMedia] = useState<Array<{type: string; url: string; filename?: string}>>([]);
  const [error, setError] = useState<string | null>(null);

  // Helper to get absolute media URL
  const baseUrl = API_URL.replace('/api', '');
  const getAbsoluteMediaUrl = (url: string) => {
    if (!url) return '';
    if (url.startsWith('http://') || url.startsWith('https://')) {
      return url;
    }
    return `${baseUrl}${url.startsWith('/') ? '' : '/'}${url}`;
  };

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

  const pickMedia = async () => {
    const { status } = await ImagePicker.requestMediaLibraryPermissionsAsync();
    if (status !== 'granted') {
      Alert.alert('Permission needed', 'Please allow access to your media library');
      return;
    }

    const result = await ImagePicker.launchImageLibraryAsync({
      mediaTypes: ['images', 'videos'],
      allowsMultipleSelection: true,
      quality: 0.8,
    });

    if (!result.canceled && result.assets.length > 0) {
      setIsUploading(true);
      
      try {
        for (const asset of result.assets) {
          const formData = new FormData();
          const fileUri = asset.uri;
          const fileType = asset.mimeType || (asset.type === 'video' ? 'video/mp4' : 'image/jpeg');
          const fileName = asset.fileName || `upload_${Date.now()}.${fileType.split('/')[1]}`;
          
          formData.append('file', {
            uri: fileUri,
            type: fileType,
            name: fileName,
          } as any);

          const response = await messagesApi.uploadMedia(orderId, formData);
          if (response.status === 'success') {
            setPendingMedia(prev => [...prev, response.media]);
          }
        }
      } catch (err: any) {
        console.error('Upload error:', err);
        Alert.alert('Upload Failed', err.message || 'Failed to upload media');
      } finally {
        setIsUploading(false);
      }
    }
  };

  const removePendingMedia = (index: number) => {
    setPendingMedia(prev => prev.filter((_, i) => i !== index));
  };

  const handleSend = async () => {
    if ((!newMessage.trim() && pendingMedia.length === 0) || isSending) return;

    setIsSending(true);
    try {
      const message = await messagesApi.send({
        order_id: orderId,
        message: newMessage.trim() || (pendingMedia.length > 0 ? '📎 Media attached' : ''),
        media: pendingMedia.length > 0 ? pendingMedia : undefined,
      });
      setMessages(prev => [...prev, message]);
      setNewMessage('');
      setPendingMedia([]);
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
            <Text style={styles.senderName}>{item.sender_role === 'admin' ? 'Adlinka Support' : item.sender_role}</Text>
          )}
          
          {/* Media attachments */}
          {item.media && item.media.length > 0 && (
            <View style={styles.mediaContainer}>
              {item.media.map((media, idx) => (
                <View key={idx} style={styles.mediaItem}>
                  {media.type === 'video' ? (
                    <View style={styles.videoPlaceholder}>
                      <Ionicons name="play-circle" size={32} color={Colors.white} />
                    </View>
                  ) : (
                    <Image 
                      source={{ uri: getAbsoluteMediaUrl(media.url) }}
                      style={styles.mediaImage}
                      resizeMode="cover"
                    />
                  )}
                </View>
              ))}
            </View>
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

      {/* Pending Media Preview */}
      {pendingMedia.length > 0 && (
        <View style={styles.pendingMediaContainer}>
          {pendingMedia.map((media, idx) => (
            <View key={idx} style={styles.pendingMediaItem}>
              {media.type === 'video' ? (
                <View style={styles.pendingVideoPlaceholder}>
                  <Ionicons name="videocam" size={20} color={Colors.white} />
                </View>
              ) : (
                <Image 
                  source={{ uri: getAbsoluteMediaUrl(media.url) }}
                  style={styles.pendingMediaImage}
                />
              )}
              <TouchableOpacity 
                style={styles.removePendingMedia}
                onPress={() => removePendingMedia(idx)}
              >
                <Ionicons name="close" size={14} color={Colors.white} />
              </TouchableOpacity>
            </View>
          ))}
        </View>
      )}

      <View style={styles.inputContainer}>
        <TouchableOpacity 
          style={styles.attachButton}
          onPress={pickMedia}
          disabled={isUploading}
        >
          {isUploading ? (
            <ActivityIndicator size="small" color={Colors.accent} />
          ) : (
            <Ionicons name="attach" size={24} color={Colors.accent} />
          )}
        </TouchableOpacity>
        
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
          style={[styles.sendButton, ((!newMessage.trim() && pendingMedia.length === 0) || isSending) && styles.sendButtonDisabled]}
          onPress={handleSend}
          disabled={(!newMessage.trim() && pendingMedia.length === 0) || isSending}
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
  attachButton: {
    width: 40,
    height: 40,
    alignItems: 'center',
    justifyContent: 'center',
    marginRight: 4,
  },
  mediaContainer: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 8,
    marginBottom: 8,
  },
  mediaItem: {
    borderRadius: 8,
    overflow: 'hidden',
  },
  mediaImage: {
    width: 150,
    height: 150,
    borderRadius: 8,
  },
  videoPlaceholder: {
    width: 150,
    height: 150,
    backgroundColor: Colors.gray[700],
    borderRadius: 8,
    alignItems: 'center',
    justifyContent: 'center',
  },
  pendingMediaContainer: {
    flexDirection: 'row',
    paddingHorizontal: 16,
    paddingVertical: 8,
    gap: 8,
    backgroundColor: Colors.white,
    borderTopWidth: 1,
    borderTopColor: Colors.border,
  },
  pendingMediaItem: {
    position: 'relative',
  },
  pendingMediaImage: {
    width: 60,
    height: 60,
    borderRadius: 8,
  },
  pendingVideoPlaceholder: {
    width: 60,
    height: 60,
    backgroundColor: Colors.gray[700],
    borderRadius: 8,
    alignItems: 'center',
    justifyContent: 'center',
  },
  removePendingMedia: {
    position: 'absolute',
    top: -6,
    right: -6,
    width: 20,
    height: 20,
    borderRadius: 10,
    backgroundColor: Colors.error,
    alignItems: 'center',
    justifyContent: 'center',
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
