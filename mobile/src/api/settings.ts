import apiClient from './client';

export interface SiteSettings {
  site_name: string;
  tagline: string;
  contact_email: string;
  contact_phone: string;
  office_address: string;
  business_hours: string;
  consultation_price_online: number;
  consultation_price_office: number;
  platform_fee_percentage: number;
  currency: string;
  currency_symbol: string;
  social_links: Record<string, string>;
  seo_title: string;
  seo_description: string;
}

export const settingsApi = {
  // Get site settings (public)
  async getSettings(): Promise<SiteSettings> {
    const response = await apiClient.get<SiteSettings>('/settings');
    return response.data;
  },
};
