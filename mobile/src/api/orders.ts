import apiClient from './client';
import { Order, UserStats, OrderCreateData } from '../types/api';

export const ordersApi = {
  // Create order (for individual service booking)
  async create(data: OrderCreateData): Promise<Order> {
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

  // Get order tracking with timeline
  async getTracking(id: string): Promise<{
    order: Order;
    listing_info: any;
    timeline: Array<{
      status: string;
      title: string;
      description: string;
      date: string | null;
      completed: boolean;
    }>;
    type: string;
  }> {
    const response = await apiClient.get(`/orders/${id}/tracking`);
    return response.data;
  },

  // Update order status
  async updateStatus(id: string, data: {
    payment_status?: string;
    order_status?: string;
    payment_method?: string;
  }): Promise<{ status: string; message: string }> {
    const response = await apiClient.put(`/orders/${id}/status`, data);
    return response.data;
  },

  // Get dashboard stats
  async getStats(): Promise<UserStats> {
    const response = await apiClient.get<UserStats>('/dashboard/stats');
    return response.data;
  },

  // Initialize Paystack payment
  async initializePayment(data: {
    order_id: string;
    email: string;
    callback_url: string;
    amount?: number;
    metadata?: any;
  }): Promise<{
    status: string;
    authorization_url: string;
    access_code: string;
    reference: string;
  }> {
    const response = await apiClient.post('/payments/initialize', data);
    return response.data;
  },

  // Verify payment
  async verifyPayment(reference: string): Promise<{
    status: string;
    message: string;
    order_id?: string;
    amount?: number;
  }> {
    const response = await apiClient.get(`/payments/verify/${reference}`);
    return response.data;
  },

  // Get Paystack public key
  async getPaymentConfig(): Promise<{ public_key: string }> {
    const response = await apiClient.get('/payments/config');
    return response.data;
  },
};
