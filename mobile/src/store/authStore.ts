import { create } from 'zustand';
import { authApi } from '../api/auth';
import { authStorage, userStorage, clearAllStorage } from '../utils/storage';
import { User, LoginCredentials, RegisterCredentials, AuthResponse } from '../types/api';

interface AppleLoginCredentials {
  identityToken: string;
  email?: string;
  name: string;
  appleUserId: string;
}

interface AuthState {
  user: User | null;
  isAuthenticated: boolean;
  isLoading: boolean;
  error: string | null;
  
  // Actions
  login: (credentials: LoginCredentials) => Promise<boolean>;
  appleLogin: (credentials: AppleLoginCredentials) => Promise<boolean>;
  register: (data: RegisterCredentials) => Promise<boolean>;
  logout: () => Promise<void>;
  loadUser: () => Promise<void>;
  clearError: () => void;
  updateUser: (data: Partial<User>) => void;
  deleteAccount: () => Promise<boolean>;
}

export const useAuthStore = create<AuthState>((set, get) => ({
  user: null,
  isAuthenticated: false,
  isLoading: true,
  error: null,

  login: async (credentials: LoginCredentials) => {
    set({ isLoading: true, error: null });
    try {
      const response: AuthResponse = await authApi.login(credentials);
      
      // Store token and user
      await authStorage.setToken(response.access_token);
      await userStorage.setUser(response.user);
      
      set({
        user: response.user,
        isAuthenticated: true,
        isLoading: false,
        error: null,
      });
      
      return true;
    } catch (error: any) {
      set({
        isLoading: false,
        error: error.message || 'Login failed',
      });
      return false;
    }
  },

  appleLogin: async (credentials: AppleLoginCredentials) => {
    set({ isLoading: true, error: null });
    try {
      const response: AuthResponse = await authApi.appleLogin(credentials);
      
      // Store token and user
      await authStorage.setToken(response.access_token);
      await userStorage.setUser(response.user);
      
      set({
        user: response.user,
        isAuthenticated: true,
        isLoading: false,
        error: null,
      });
      
      return true;
    } catch (error: any) {
      set({
        isLoading: false,
        error: error.message || 'Apple sign-in failed',
      });
      return false;
    }
  },

  register: async (data: RegisterCredentials) => {
    set({ isLoading: true, error: null });
    try {
      const response: AuthResponse = await authApi.register(data);
      
      // Store token and user
      await authStorage.setToken(response.access_token);
      await userStorage.setUser(response.user);
      
      set({
        user: response.user,
        isAuthenticated: true,
        isLoading: false,
        error: null,
      });
      
      return true;
    } catch (error: any) {
      set({
        isLoading: false,
        error: error.message || 'Registration failed',
      });
      return false;
    }
  },

  deleteAccount: async () => {
    set({ isLoading: true, error: null });
    try {
      await authApi.deleteAccount();
      
      // Clear all stored data
      await clearAllStorage();
      
      set({
        user: null,
        isAuthenticated: false,
        isLoading: false,
        error: null,
      });
      
      return true;
    } catch (error: any) {
      set({
        isLoading: false,
        error: error.message || 'Failed to delete account',
      });
      return false;
    }
  },

  logout: async () => {
    set({ isLoading: true });
    try {
      await clearAllStorage();
      set({
        user: null,
        isAuthenticated: false,
        isLoading: false,
        error: null,
      });
    } catch (error) {
      set({ isLoading: false });
    }
  },

  loadUser: async () => {
    set({ isLoading: true });
    try {
      const token = await authStorage.getToken();
      
      if (!token) {
        set({ isLoading: false, isAuthenticated: false });
        return;
      }

      // Try to get user from storage first
      const storedUser = await userStorage.getUser();
      
      if (storedUser) {
        set({
          user: storedUser,
          isAuthenticated: true,
          isLoading: false,
        });
      }

      // Verify token is still valid by fetching current user
      try {
        const user = await authApi.getCurrentUser();
        await userStorage.setUser(user);
        set({
          user,
          isAuthenticated: true,
          isLoading: false,
        });
      } catch (error) {
        // Token expired or invalid
        await clearAllStorage();
        set({
          user: null,
          isAuthenticated: false,
          isLoading: false,
        });
      }
    } catch (error) {
      set({ isLoading: false, isAuthenticated: false });
    }
  },

  clearError: () => set({ error: null }),

  updateUser: (data: Partial<User>) => {
    const currentUser = get().user;
    if (currentUser) {
      const updatedUser = { ...currentUser, ...data };
      set({ user: updatedUser });
      userStorage.setUser(updatedUser);
    }
  },
}));
