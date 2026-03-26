import apiClient from './client';
import { KannywoodProduction, Package } from '../types/api';

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

  // Get packages for a production
  async getPackages(id: string): Promise<Package[]> {
    const response = await apiClient.get<Package[]>(`/kannywood/${id}/packages`);
    return response.data;
  },

  // Filter productions
  async filter(params: {
    type?: string;
    genre?: string;
  }): Promise<KannywoodProduction[]> {
    const response = await apiClient.get<KannywoodProduction[]>('/kannywood', { params });
    return response.data;
  },
};
