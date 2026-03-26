import * as SecureStore from 'expo-secure-store';
import { Config } from '../constants/config';

// Secure storage for sensitive data (tokens)
export const secureStorage = {
  async getItem(key: string): Promise<string | null> {
    try {
      return await SecureStore.getItemAsync(key);
    } catch (error) {
      console.error('SecureStore getItem error:', error);
      return null;
    }
  },

  async setItem(key: string, value: string): Promise<boolean> {
    try {
      await SecureStore.setItemAsync(key, value);
      return true;
    } catch (error) {
      console.error('SecureStore setItem error:', error);
      return false;
    }
  },

  async removeItem(key: string): Promise<boolean> {
    try {
      await SecureStore.deleteItemAsync(key);
      return true;
    } catch (error) {
      console.error('SecureStore removeItem error:', error);
      return false;
    }
  },
};

// Auth Token Management
export const authStorage = {
  async getToken(): Promise<string | null> {
    return secureStorage.getItem(Config.storage.authToken);
  },

  async setToken(token: string): Promise<boolean> {
    return secureStorage.setItem(Config.storage.authToken, token);
  },

  async removeToken(): Promise<boolean> {
    return secureStorage.removeItem(Config.storage.authToken);
  },
};

// User Data Management
export const userStorage = {
  async getUser(): Promise<any | null> {
    const userData = await secureStorage.getItem(Config.storage.user);
    return userData ? JSON.parse(userData) : null;
  },

  async setUser(user: any): Promise<boolean> {
    return secureStorage.setItem(Config.storage.user, JSON.stringify(user));
  },

  async removeUser(): Promise<boolean> {
    return secureStorage.removeItem(Config.storage.user);
  },
};

// Cart Storage
export const cartStorage = {
  async getCart(): Promise<any[]> {
    const cartData = await secureStorage.getItem(Config.storage.cart);
    return cartData ? JSON.parse(cartData) : [];
  },

  async setCart(cart: any[]): Promise<boolean> {
    return secureStorage.setItem(Config.storage.cart, JSON.stringify(cart));
  },

  async clearCart(): Promise<boolean> {
    return secureStorage.removeItem(Config.storage.cart);
  },
};

// Settings Storage
export const settingsStorage = {
  async getSettings(): Promise<any> {
    const settingsData = await secureStorage.getItem(Config.storage.settings);
    return settingsData ? JSON.parse(settingsData) : {};
  },

  async setSettings(settings: any): Promise<boolean> {
    return secureStorage.setItem(Config.storage.settings, JSON.stringify(settings));
  },
};

// Clear all app data
export const clearAllStorage = async (): Promise<void> => {
  await Promise.all([
    secureStorage.removeItem(Config.storage.authToken),
    secureStorage.removeItem(Config.storage.user),
    secureStorage.removeItem(Config.storage.cart),
    secureStorage.removeItem(Config.storage.settings),
    secureStorage.removeItem(Config.storage.pushToken),
  ]);
};
