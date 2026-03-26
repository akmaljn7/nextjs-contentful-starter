import apiClient from './client';
import { Influencer, Package } from '../types/api';

export const influencersApi = {
  // Get all influencers
  async getAll(): Promise<Influencer[]> {
    const response = await apiClient.get<Influencer[]>('/influencers');
    return response.data;
  },

  // Get influencer by ID
  async getById(id: string): Promise<Influencer> {
    const response = await apiClient.get<Influencer>(`/influencers/${id}`);
    return response.data;
  },

  // Get influencer packages
  async getPackages(id: string): Promise<Package[]> {
    const response = await apiClient.get<Package[]>(`/influencers/${id}/packages`);
    return response.data;
  },

  // Search influencers
  async search(query: string): Promise<Influencer[]> {
    const response = await apiClient.get<Influencer[]>('/influencers/search', {
      params: { q: query },
    });
    return response.data;
  },

  // Filter influencers
  async filter(params: {
    platform?: string;
    category?: string;
    minFollowers?: number;
    maxFollowers?: number;
  }): Promise<Influencer[]> {
    const response = await apiClient.get<Influencer[]>('/influencers', { params });
    return response.data;
  },
};
