import apiClient from './client';
import { 
  Billboard, 
  BillboardState, 
  BillboardSize, 
  BillboardType, 
  BillboardPackage 
} from '../types/api';
import { Platform } from 'react-native';

export const billboardsApi = {
  // Get all billboards (categories)
  async getAll(): Promise<Billboard[]> {
    const response = await apiClient.get<Billboard[]>('/billboards');
    return response.data;
  },

  // Get billboard by ID
  async getById(id: string): Promise<Billboard> {
    const response = await apiClient.get<Billboard>(`/billboards/${id}`);
    return response.data;
  },

  // Get LED billboard states
  async getStates(): Promise<BillboardState[]> {
    try {
      const response = await apiClient.get<BillboardState[]>('/led-billboard/states');
      // Ensure data is an array and each state has roads array
      const data = response.data;
      if (!Array.isArray(data)) {
        console.warn('Billboard states response is not an array:', typeof data);
        return [];
      }
      // Normalize the data to ensure roads is always an array
      return data.map(state => ({
        ...state,
        roads: Array.isArray(state.roads) ? state.roads : []
      }));
    } catch (error) {
      console.error('Error fetching billboard states:', error);
      return [];
    }
  },

  // Get LED billboard sizes
  async getSizes(): Promise<BillboardSize[]> {
    try {
      const response = await apiClient.get<BillboardSize[]>('/led-billboard/sizes');
      const data = response.data;
      if (!Array.isArray(data)) {
        console.warn('Billboard sizes response is not an array:', typeof data);
        return [];
      }
      return data;
    } catch (error) {
      console.error('Error fetching billboard sizes:', error);
      return [];
    }
  },

  // Get LED billboard packages
  async getLedPackages(params: {
    state_id?: string;
    road_name?: string;
    size_id?: string;
  }): Promise<BillboardPackage[]> {
    const response = await apiClient.get<BillboardPackage[]>('/led-billboard/packages', { params });
    return response.data;
  },

  // Get billboard types (for Static Banner and Lightbox)
  async getTypes(params?: { 
    category?: string;
    independent_only?: boolean;
  }): Promise<BillboardType[]> {
    try {
      const response = await apiClient.get<BillboardType[]>('/billboard-types', { params });
      const data = response.data;
      if (!Array.isArray(data)) {
        console.warn('Billboard types response is not an array:', typeof data);
        return [];
      }
      return data;
    } catch (error) {
      console.error('Error fetching billboard types:', error);
      return [];
    }
  },

  // Get static billboard packages
  async getStaticPackages(params: {
    category?: string;
    billboard_type_id?: string;
    state_id?: string;
    road_name?: string;
    type_id?: string;
  }): Promise<BillboardPackage[]> {
    const response = await apiClient.get<BillboardPackage[]>('/static-billboard/packages', { params });
    return response.data;
  },

  // Get independent billboard types
  async getIndependentTypes(): Promise<BillboardType[]> {
    const response = await apiClient.get<BillboardType[]>('/billboard-types', {
      params: { independent_only: true },
    });
    return response.data;
  },
};
