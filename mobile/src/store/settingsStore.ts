import { create } from 'zustand';
import { settingsStorage } from '../utils/storage';

type ThemeMode = 'light' | 'dark' | 'system';
type Language = 'en' | 'ha';

interface SettingsState {
  theme: ThemeMode;
  language: Language;
  notificationsEnabled: boolean;
  isLoading: boolean;
  
  // Actions
  setTheme: (theme: ThemeMode) => Promise<void>;
  setLanguage: (language: Language) => Promise<void>;
  toggleNotifications: () => Promise<void>;
  loadSettings: () => Promise<void>;
}

const defaultSettings = {
  theme: 'system' as ThemeMode,
  language: 'en' as Language,
  notificationsEnabled: true,
};

export const useSettingsStore = create<SettingsState>((set, get) => ({
  ...defaultSettings,
  isLoading: false,

  setTheme: async (theme: ThemeMode) => {
    set({ theme });
    const currentSettings = {
      theme,
      language: get().language,
      notificationsEnabled: get().notificationsEnabled,
    };
    await settingsStorage.setSettings(currentSettings);
  },

  setLanguage: async (language: Language) => {
    set({ language });
    const currentSettings = {
      theme: get().theme,
      language,
      notificationsEnabled: get().notificationsEnabled,
    };
    await settingsStorage.setSettings(currentSettings);
  },

  toggleNotifications: async () => {
    const newValue = !get().notificationsEnabled;
    set({ notificationsEnabled: newValue });
    const currentSettings = {
      theme: get().theme,
      language: get().language,
      notificationsEnabled: newValue,
    };
    await settingsStorage.setSettings(currentSettings);
  },

  loadSettings: async () => {
    set({ isLoading: true });
    try {
      const settings = await settingsStorage.getSettings();
      set({
        theme: settings.theme || defaultSettings.theme,
        language: settings.language || defaultSettings.language,
        notificationsEnabled: settings.notificationsEnabled ?? defaultSettings.notificationsEnabled,
        isLoading: false,
      });
    } catch (error) {
      set({ isLoading: false });
    }
  },
}));
