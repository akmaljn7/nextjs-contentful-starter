import apiClient from './client';
import { Consultation } from '../types/api';

interface ConsultationCreateData {
  user_id: string;
  consultation_type: 'online' | 'physical';
  package_title: string;
  price: number;
  business_name: string;
  industry: string;
  business_stage?: string;
  description: string;
  goals?: string;
  budget_range?: string;
  preferred_date?: string;
  preferred_time?: string;
  contact_name: string;
  contact_email?: string;
  contact_phone: string;
  payment_method?: 'online' | 'cash';
}

export const consultationsApi = {
  // Create consultation
  async create(data: ConsultationCreateData): Promise<{
    status: string;
    message: string;
    consultation: Consultation;
  }> {
    const response = await apiClient.post('/consultations', data);
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

  // Update consultation payment status
  async updatePayment(id: string, data: {
    payment_status: string;
    payment_method: string;
  }): Promise<{ status: string; message: string }> {
    const response = await apiClient.patch(`/consultations/${id}/payment`, data);
    return response.data;
  },
};
