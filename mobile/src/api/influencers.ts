import apiClient from './client';
import { Influencer } from '../types/api';

export const influencersApi = {
  // Get all influencers (only approved ones by default)
  async getAll(params?: {
    city?: string;
    niche?: string;
    min_followers?: number;
    max_price?: number;
    status?: string;
  }): Promise<Influencer[]> {
    const response = await apiClient.get<Influencer[]>('/influencers', { params });
    return response.data;
  },

  // Get influencer by ID
  async getById(id: string): Promise<Influencer> {
    const response = await apiClient.get<Influencer>(`/influencers/${id}`);
    return response.data;
  },

  // Filter influencers by platform, niche, location, etc.
  async filter(params: {
    platform?: string;
    niche?: string;
    city?: string;
    min_followers?: number;
    max_price?: number;
  }): Promise<Influencer[]> {
    const response = await apiClient.get<Influencer[]>('/influencers', { params });
    return response.data;
  },
};
