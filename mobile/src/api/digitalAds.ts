import apiClient from './client';
import { DigitalAd } from '../types/api';

export const digitalAdsApi = {
  // Get all digital ad platforms
  async getAll(): Promise<DigitalAd[]> {
    const response = await apiClient.get<DigitalAd[]>('/digital-ads');
    return response.data;
  },

  // Get digital ad by ID
  async getById(id: string): Promise<DigitalAd> {
    const response = await apiClient.get<DigitalAd>(`/digital-ads/${id}`);
    return response.data;
  },
};
