import apiClient from './client';
import { Order, CartItem, UserStats } from '../types/api';

export const ordersApi = {
  // Create order
  async create(data: {
    items: CartItem[];
    payment_method: 'online' | 'cash';
    notes?: string;
  }): Promise<Order> {
    const response = await apiClient.post<Order>('/orders', data);
    return response.data;
  },

  // Get user orders
  async getAll(): Promise<Order[]> {
    const response = await apiClient.get<Order[]>('/orders');
    return response.data;
  },

  // Get order by ID
  async getById(id: string): Promise<Order> {
    const response = await apiClient.get<Order>(`/orders/${id}`);
    return response.data;
  },

  // Get order tracking
  async getTracking(id: string): Promise<any> {
    const response = await apiClient.get(`/orders/${id}/tracking`);
    return response.data;
  },

  // Cancel order
  async cancel(id: string): Promise<Order> {
    const response = await apiClient.post<Order>(`/orders/${id}/cancel`);
    return response.data;
  },

  // Get user stats
  async getStats(): Promise<UserStats> {
    const response = await apiClient.get<UserStats>('/user/stats');
    return response.data;
  },

  // Initialize payment
  async initializePayment(orderId: string): Promise<{
    authorization_url: string;
    reference: string;
  }> {
    const response = await apiClient.post(`/payments/initialize`, { order_id: orderId });
    return response.data;
  },

  // Verify payment
  async verifyPayment(reference: string): Promise<{
    status: string;
    message: string;
  }> {
    const response = await apiClient.get(`/payments/verify/${reference}`);
    return response.data;
  },
};
