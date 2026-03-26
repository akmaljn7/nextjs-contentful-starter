import apiClient from './client';
import { SearchResult } from '../types/api';

interface SearchResponse {
  results: SearchResult[];
  total: number;
  filters: {
    query?: string;
    category?: string;
    city?: string;
    min_price?: number;
    max_price?: number;
  };
}

export const searchApi = {
  // Global search
  async search(query: string, limit: number = 20): Promise<SearchResponse> {
    const response = await apiClient.get<SearchResponse>('/search', {
      params: { q: query, limit },
    });
    return response.data;
  },

  // Search with filters
  async searchWithFilters(params: {
    q?: string;
    category?: string;
    city?: string;
    min_price?: number;
    max_price?: number;
    limit?: number;
  }): Promise<SearchResponse> {
    const response = await apiClient.get<SearchResponse>('/search', { params });
    return response.data;
  },

  // Get search suggestions for autocomplete
  async getSuggestions(query: string, limit: number = 5): Promise<string[]> {
    const response = await apiClient.get<{ suggestions: string[] }>('/search/suggestions', {
      params: { q: query, limit },
    });
    return response.data.suggestions;
  },
};
