import apiClient from './client';
import { KannywoodProduction } from '../types/api';

export const kannywoodApi = {
  // Get all Kannywood productions
  async getAll(): Promise<KannywoodProduction[]> {
    const response = await apiClient.get<KannywoodProduction[]>('/kannywood');
    return response.data;
  },

  // Get Kannywood production by ID
  async getById(id: string): Promise<KannywoodProduction> {
    const response = await apiClient.get<KannywoodProduction>(`/kannywood/${id}`);
    return response.data;
  },

  // Filter productions by type or genre
  async filter(params: {
    placement_type?: string;
    genre?: string;
  }): Promise<KannywoodProduction[]> {
    const response = await apiClient.get<KannywoodProduction[]>('/kannywood', { params });
    return response.data;
  },
};
