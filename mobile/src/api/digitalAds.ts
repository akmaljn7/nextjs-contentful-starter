import apiClient from './client';
import { DigitalAd, Package } from '../types/api';

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

  // Get packages for a platform
  async getPackages(id: string): Promise<Package[]> {
    const response = await apiClient.get<Package[]>(`/digital-ads/${id}/packages`);
    return response.data;
  },
};
