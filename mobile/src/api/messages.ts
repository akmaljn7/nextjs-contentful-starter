import apiClient from './client';
import { Message, Conversation } from '../types/api';

export const messagesApi = {
  // Get all conversations (combines orders + consultations with their messages)
  async getConversations(): Promise<Conversation[]> {
    const response = await apiClient.get<Conversation[]>('/conversations');
    return response.data;
  },

  // Get messages for an order/consultation
  async getMessages(orderId: string): Promise<Message[]> {
    const response = await apiClient.get<Message[]>(`/messages/${orderId}`);
    return response.data;
  },

  // Send message
  async send(data: {
    order_id: string;
    message: string;
  }): Promise<Message> {
    const response = await apiClient.post<Message>('/messages', data);
    return response.data;
  },

  // Mark messages as read
  async markAsRead(orderId: string): Promise<{ status: string }> {
    const response = await apiClient.put(`/messages/${orderId}/read`);
    return response.data;
  },
};
