import apiClient from './client';
import { SearchResult } from '../types/api';

export const searchApi = {
  // Global search
  async search(query: string): Promise<SearchResult[]> {
    const response = await apiClient.get<SearchResult[]>('/search', {
      params: { q: query },
    });
    return response.data;
  },

  // Search with filters
  async searchWithFilters(params: {
    q: string;
    type?: string;
    minPrice?: number;
    maxPrice?: number;
  }): Promise<SearchResult[]> {
    const response = await apiClient.get<SearchResult[]>('/search', { params });
    return response.data;
  },
};
