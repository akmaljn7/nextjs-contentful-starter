import apiClient from './client';
import { KannywoodProduction } from '../types/api';

// Image mapping for Kannywood productions (same as web frontend)
const KANNYWOOD_IMAGE_MAP: Record<string, string> = {
  'Ya Daga Allah': 'https://customer-assets.emergentagent.com/job_ads-kano/artifacts/xuqki5h5_ya%20daga%20Allah.png',
  'Labarina': 'https://customer-assets.emergentagent.com/job_ads-kano/artifacts/rgzfcnfi_labarina.png',
  'Gidan': 'https://customer-assets.emergentagent.com/job_ads-kano/artifacts/uepkoeu8_gidan%20badamasi.png',
};

// Helper to map images to productions
const mapKannywoodImages = (productions: KannywoodProduction[]): KannywoodProduction[] => {
  return productions.map(production => {
    // If production already has an image, use it
    if (production.image_url) {
      return production;
    }
    
    // Try to find a matching image from our map
    const title = production.title || production.production_name || '';
    for (const [key, imageUrl] of Object.entries(KANNYWOOD_IMAGE_MAP)) {
      if (title.includes(key)) {
        return { ...production, image_url: imageUrl };
      }
    }
    
    return production;
  });
};

export const kannywoodApi = {
  // Get all Kannywood productions
  async getAll(): Promise<KannywoodProduction[]> {
    const response = await apiClient.get<KannywoodProduction[]>('/kannywood');
    return mapKannywoodImages(response.data);
  },

  // Get Kannywood production by ID
  async getById(id: string): Promise<KannywoodProduction> {
    const response = await apiClient.get<KannywoodProduction>(`/kannywood/${id}`);
    // Apply image mapping to single production
    const [mappedProduction] = mapKannywoodImages([response.data]);
    return mappedProduction;
  },

  // Filter productions by type or genre
  async filter(params: {
    placement_type?: string;
    genre?: string;
  }): Promise<KannywoodProduction[]> {
    const response = await apiClient.get<KannywoodProduction[]>('/kannywood', { params });
    return mapKannywoodImages(response.data);
  },
};
