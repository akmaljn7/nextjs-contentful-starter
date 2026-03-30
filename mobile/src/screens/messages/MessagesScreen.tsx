import React, { useState, useEffect } from 'react';
import {
  View,
  Text,
  StyleSheet,
  FlatList,
  TouchableOpacity,
  RefreshControl,
} from 'react-native';
import { useNavigation } from '@react-navigation/native';
import { Ionicons } from '@expo/vector-icons';
import { Colors } from '../../constants/colors';
import { Fonts } from '../../constants/fonts';
import { LoadingSpinner, ErrorMessage, EmptyState, Card } from '../../components/common';
import { messagesApi } from '../../api';
import { Conversation } from '../../types/api';
import { formatRelativeTime } from '../../utils/formatters';

export const MessagesScreen: React.FC = () => {
  const navigation = useNavigation<any>();
  
  const [conversations, setConversations] = useState<Conversation[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [isRefreshing, setIsRefreshing] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    loadConversations();
  }, []);

  const loadConversations = async () => {
    try {
      setError(null);
      const data = await messagesApi.getConversations();
      setConversations(data);
    } catch (err: any) {
      setError(err.message || 'Failed to load conversations');
    } finally {
      setIsLoading(false);
      setIsRefreshing(false);
    }
  };

  const onRefresh = () => {
    setIsRefreshing(true);
    loadConversations();
  };

  const getConversationIcon = (type: string) => {
    switch (type) {
      case 'support':
        return 'headset-outline';
      case 'consultation':
        return 'calendar-outline';
      case 'order':
      default:
        return 'chatbubble-outline';
    }
  };

  const getStatusColor = (status: string) => {
    switch (status) {
      case 'completed':
        return Colors.success;
      case 'pending':
        return Colors.warning;
      case 'cancelled':
        return Colors.error;
      default:
        return Colors.info;
    }
  };

  const renderConversation = ({ item }: { item: Conversation }) => (
    <TouchableOpacity
      activeOpacity={0.9}
      onPress={() => navigation.navigate('Chat', { 
        orderId: item.id, 
        title: item.title,
        type: item.type 
      })}
    >
      <Card variant="default" padding="md" style={styles.conversationCard}>
        <View style={styles.conversationContent}>
          <View style={[styles.iconContainer, { backgroundColor: getStatusColor(item.status) + '20' }]}>
            <Ionicons 
              name={getConversationIcon(item.type) as any} 
              size={24} 
              color={getStatusColor(item.status)} 
            />
          </View>
          
          <View style={styles.textContainer}>
            <View style={styles.titleRow}>
              <Text style={styles.title} numberOfLines={1}>{item.title}</Text>
              {item.unread_count > 0 && (
                <View style={styles.unreadBadge}>
                  <Text style={styles.unreadText}>{item.unread_count}</Text>
                </View>
              )}
            </View>
            <Text style={styles.subtitle} numberOfLines={1}>{item.subtitle}</Text>
            {item.last_message && (
              <Text style={styles.lastMessage} numberOfLines={1}>
                {item.last_message}
              </Text>
            )}
          </View>
          
          <View style={styles.rightContainer}>
            {item.last_message_time && (
              <Text style={styles.time}>
                {formatRelativeTime(item.last_message_time)}
              </Text>
            )}
            <Ionicons name="chevron-forward" size={20} color={Colors.textMuted} />
          </View>
        </View>
      </Card>
    </TouchableOpacity>
  );

  if (isLoading) {
    return <LoadingSpinner fullScreen message="Loading conversations..." />;
  }

  if (error) {
    return <ErrorMessage message={error} onRetry={loadConversations} fullScreen />;
  }

  if (conversations.length === 0) {
    return (
      <View style={styles.container}>
        <EmptyState
          icon="chatbubbles-outline"
          title="No messages yet"
          description="Start a conversation with our support team"
          actionLabel="Contact Support"
          onAction={() => navigation.navigate('Chat', { 
            orderId: 'support', 
            title: 'Adlinka Support',
            type: 'support' 
          })}
        />
      </View>
    );
  }

  return (
    <View style={styles.container}>
      {/* Support Chat FAB */}
      <TouchableOpacity
        style={styles.supportFab}
        onPress={() => navigation.navigate('Chat', { 
          orderId: 'support', 
          title: 'Adlinka Support',
          type: 'support' 
        })}
      >
        <Ionicons name="headset" size={24} color={Colors.white} />
      </TouchableOpacity>
      
      <FlatList
        data={conversations}
        renderItem={renderConversation}
        keyExtractor={(item) => item.id}
        contentContainerStyle={styles.list}
        showsVerticalScrollIndicator={false}
        refreshControl={
          <RefreshControl refreshing={isRefreshing} onRefresh={onRefresh} />
        }
      />
    </View>
  );
};

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: Colors.background,
  },
  list: {
    padding: 16,
  },
  supportFab: {
    position: 'absolute',
    bottom: 24,
    right: 24,
    width: 56,
    height: 56,
    borderRadius: 28,
    backgroundColor: Colors.accent,
    alignItems: 'center',
    justifyContent: 'center',
    zIndex: 100,
    elevation: 5,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.25,
    shadowRadius: 4,
  },
  conversationCard: {
    marginBottom: 12,
  },
  conversationContent: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  iconContainer: {
    width: 48,
    height: 48,
    borderRadius: 24,
    alignItems: 'center',
    justifyContent: 'center',
    marginRight: 12,
  },
  textContainer: {
    flex: 1,
  },
  titleRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginBottom: 2,
  },
  title: {
    fontSize: Fonts.size.md,
    fontWeight: Fonts.weight.semibold,
    color: Colors.textPrimary,
    flex: 1,
  },
  unreadBadge: {
    backgroundColor: Colors.accent,
    borderRadius: 10,
    minWidth: 20,
    height: 20,
    alignItems: 'center',
    justifyContent: 'center',
    paddingHorizontal: 6,
    marginLeft: 8,
  },
  unreadText: {
    color: Colors.white,
    fontSize: 11,
    fontWeight: Fonts.weight.bold,
  },
  subtitle: {
    fontSize: Fonts.size.sm,
    color: Colors.textSecondary,
    marginBottom: 4,
  },
  lastMessage: {
    fontSize: Fonts.size.sm,
    color: Colors.textMuted,
  },
  rightContainer: {
    alignItems: 'flex-end',
    marginLeft: 8,
  },
  time: {
    fontSize: Fonts.size.xs,
    color: Colors.textMuted,
    marginBottom: 4,
  },
});
