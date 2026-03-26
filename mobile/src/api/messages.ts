import apiClient from './client';
import { Message, Conversation } from '../types/api';

export const messagesApi = {
  // Get all conversations
  async getConversations(): Promise<Conversation[]> {
    const response = await apiClient.get<Conversation[]>('/conversations');
    return response.data;
  },

  // Get messages for a conversation
  async getMessages(conversationId: string): Promise<Message[]> {
    const response = await apiClient.get<Message[]>(`/conversations/${conversationId}/messages`);
    return response.data;
  },

  // Send message
  async send(data: {
    conversation_id?: string;
    order_id?: string;
    content: string;
  }): Promise<Message> {
    const response = await apiClient.post<Message>('/messages', data);
    return response.data;
  },

  // Mark messages as read
  async markAsRead(conversationId: string): Promise<{ message: string }> {
    const response = await apiClient.post(`/conversations/${conversationId}/read`);
    return response.data;
  },

  // Get unread count
  async getUnreadCount(): Promise<{ count: number }> {
    const response = await apiClient.get('/messages/unread-count');
    return response.data;
  },

  // Create support conversation
  async createSupportConversation(): Promise<Conversation> {
    const response = await apiClient.post<Conversation>('/conversations/support');
    return response.data;
  },
};
