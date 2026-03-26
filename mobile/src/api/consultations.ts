import apiClient from './client';
import { Consultation } from '../types/api';

export const consultationsApi = {
  // Create consultation
  async create(data: {
    consultation_type: 'online' | 'in_office';
    business_name: string;
    industry: string;
    business_stage: string;
    description: string;
    goals: string;
    budget_range: string;
    phone: string;
    email: string;
    payment_method: 'online' | 'cash';
  }): Promise<Consultation> {
    const response = await apiClient.post<Consultation>('/consultations', data);
    return response.data;
  },

  // Get user consultations
  async getAll(): Promise<Consultation[]> {
    const response = await apiClient.get<Consultation[]>('/consultations');
    return response.data;
  },

  // Get consultation by ID
  async getById(id: string): Promise<Consultation> {
    const response = await apiClient.get<Consultation>(`/consultations/${id}`);
    return response.data;
  },

  // Cancel consultation
  async cancel(id: string): Promise<Consultation> {
    const response = await apiClient.post<Consultation>(`/consultations/${id}/cancel`);
    return response.data;
  },

  // Get consultation pricing
  async getPricing(): Promise<{
    online: number;
    in_office: number;
  }> {
    const response = await apiClient.get('/consultations/pricing');
    return response.data;
  },
};
