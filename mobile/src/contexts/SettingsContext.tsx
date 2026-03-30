import React, { createContext, useContext, useState, useEffect, ReactNode } from 'react';
import { settingsApi, SiteSettings } from '../api/settings';

// Default logo URL
const DEFAULT_LOGO = 'https://customer-assets.emergentagent.com/job_ads-kano/artifacts/xiehimyl_App_logo.PNG';

interface SettingsContextType {
  settings: SiteSettings | null;
  isLoading: boolean;
  error: string | null;
  refreshSettings: () => Promise<void>;
  getLogoUrl: (type: 'login' | 'splash' | 'primary' | 'light') => string;
}

const SettingsContext = createContext<SettingsContextType | undefined>(undefined);

export const SettingsProvider: React.FC<{ children: ReactNode }> = ({ children }) => {
  const [settings, setSettings] = useState<SiteSettings | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const fetchSettings = async () => {
    try {
      setIsLoading(true);
      setError(null);
      const data = await settingsApi.getSettings();
      setSettings(data);
    } catch (err) {
      console.log('Failed to fetch settings, using defaults');
      setError('Failed to load settings');
    } finally {
      setIsLoading(false);
    }
  };

  useEffect(() => {
    fetchSettings();
  }, []);

  const getLogoUrl = (type: 'login' | 'splash' | 'primary' | 'light'): string => {
    if (!settings) return DEFAULT_LOGO;
    
    switch (type) {
      case 'login':
        return settings.login_logo_url || settings.primary_logo_url || DEFAULT_LOGO;
      case 'splash':
        return settings.splash_logo_url || settings.primary_logo_url || DEFAULT_LOGO;
      case 'primary':
        return settings.primary_logo_url || DEFAULT_LOGO;
      case 'light':
        return settings.logo_light_url || settings.primary_logo_url || DEFAULT_LOGO;
      default:
        return DEFAULT_LOGO;
    }
  };

  return (
    <SettingsContext.Provider
      value={{
        settings,
        isLoading,
        error,
        refreshSettings: fetchSettings,
        getLogoUrl,
      }}
    >
      {children}
    </SettingsContext.Provider>
  );
};

export const useSettings = (): SettingsContextType => {
  const context = useContext(SettingsContext);
  if (!context) {
    throw new Error('useSettings must be used within a SettingsProvider');
  }
  return context;
};
