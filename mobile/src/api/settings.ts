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
  // Branding assets
  web_logo_url?: string;
  favicon_url?: string;
  app_icon_url?: string;
  splash_logo_url?: string;
  login_logo_url?: string;
  notification_icon_url?: string;
  primary_logo_url?: string;
  logo_light_url?: string;
}

export const settingsApi = {
  // Get site settings (public)
  async getSettings(): Promise<SiteSettings> {
    const response = await apiClient.get<SiteSettings>('/settings');
    return response.data;
  },
};
