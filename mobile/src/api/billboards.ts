import apiClient from './client';
import { 
  Billboard, 
  BillboardState, 
  BillboardSize, 
  BillboardType, 
  BillboardPackage 
} from '../types/api';

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
    const response = await apiClient.get<BillboardState[]>('/led-billboard/states');
    return response.data;
  },

  // Get LED billboard sizes
  async getSizes(): Promise<BillboardSize[]> {
    const response = await apiClient.get<BillboardSize[]>('/led-billboard/sizes');
    return response.data;
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
    const response = await apiClient.get<BillboardType[]>('/billboard-types', { params });
    return response.data;
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
