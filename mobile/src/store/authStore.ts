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

interface GoogleLoginCredentials {
  idToken: string;
  email: string;
  name: string;
  googleUserId: string;
  photo?: string;
}

interface AuthState {
  user: User | null;
  isAuthenticated: boolean;
  isLoading: boolean;
  error: string | null;
  
  // Actions
  login: (credentials: LoginCredentials) => Promise<boolean>;
  appleLogin: (credentials: AppleLoginCredentials) => Promise<boolean>;
  googleLogin: (credentials: GoogleLoginCredentials) => Promise<boolean>;
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
      
      console.log('Login successful, storing token...');
      console.log('Token length:', response.access_token?.length);
      console.log('User ID:', response.user?.id);
      
      // Store token and user
      await authStorage.setToken(response.access_token);
      await userStorage.setUser(response.user);
      
      // Verify token was stored
      const storedToken = await authStorage.getToken();
      console.log('Token stored successfully:', storedToken ? 'Yes' : 'No');
      console.log('Stored token matches:', storedToken === response.access_token ? 'Yes' : 'No');
      
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

  googleLogin: async (credentials: GoogleLoginCredentials) => {
    set({ isLoading: true, error: null });
    try {
      const response: AuthResponse = await authApi.googleLogin(credentials);
      
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
        error: error.message || 'Google sign-in failed',
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
      console.log('loadUser: Token exists?', token ? 'Yes' : 'No');
      
      if (!token) {
        console.log('loadUser: No token found, setting not authenticated');
        set({ isLoading: false, isAuthenticated: false });
        return;
      }

      // Try to get user from storage first
      const storedUser = await userStorage.getUser();
      console.log('loadUser: Stored user exists?', storedUser ? 'Yes' : 'No');
      
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
        console.log('loadUser: Token verification successful');
        await userStorage.setUser(user);
        set({
          user,
          isAuthenticated: true,
          isLoading: false,
        });
      } catch (error: any) {
        // Only clear storage if it's a definite auth error (401)
        // Don't clear on network errors or other issues
        console.log('loadUser: Token verification failed:', error.status, error.message);
        if (error.status === 401) {
          console.log('loadUser: 401 error, clearing storage');
          await clearAllStorage();
          set({
            user: null,
            isAuthenticated: false,
            isLoading: false,
          });
        } else {
          // For network errors, keep the user logged in with stored data
          console.log('loadUser: Non-401 error, keeping user authenticated with stored data');
          if (storedUser) {
            set({
              user: storedUser,
              isAuthenticated: true,
              isLoading: false,
            });
          } else {
            set({ isLoading: false });
          }
        }
      }
    } catch (error) {
      console.log('loadUser: Unexpected error:', error);
      set({ isLoading: false });
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
