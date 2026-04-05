import apiClient from './client';
import { AuthResponse, LoginCredentials, RegisterCredentials, User } from '../types/api';

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

export const authApi = {
  // Login
  async login(credentials: LoginCredentials): Promise<AuthResponse> {
    const response = await apiClient.post<AuthResponse>('/auth/login', credentials);
    return response.data;
  },

  // Apple Sign-in
  async appleLogin(credentials: AppleLoginCredentials): Promise<AuthResponse> {
    const response = await apiClient.post<AuthResponse>('/auth/apple', credentials);
    return response.data;
  },

  // Google Sign-in
  async googleLogin(credentials: GoogleLoginCredentials): Promise<AuthResponse> {
    const response = await apiClient.post<AuthResponse>('/auth/google', credentials);
    return response.data;
  },

  // Register
  async register(data: RegisterCredentials): Promise<AuthResponse> {
    const response = await apiClient.post<AuthResponse>('/auth/register', data);
    return response.data;
  },

  // Get current user
  async getCurrentUser(): Promise<User> {
    const response = await apiClient.get<User>('/auth/me');
    return response.data;
  },

  // Forgot password
  async forgotPassword(email: string): Promise<{ message: string }> {
    const response = await apiClient.post('/auth/forgot-password', { email });
    return response.data;
  },

  // Reset password
  async resetPassword(token: string, password: string): Promise<{ message: string }> {
    const response = await apiClient.post('/auth/reset-password', { token, password });
    return response.data;
  },

  // Update profile
  async updateProfile(data: Partial<User>): Promise<User> {
    const response = await apiClient.put<User>('/auth/profile', data);
    return response.data;
  },

  // Change password
  async changePassword(currentPassword: string, newPassword: string): Promise<{ message: string }> {
    const response = await apiClient.post('/auth/change-password', {
      current_password: currentPassword,
      new_password: newPassword,
    });
    return response.data;
  },

  // Register push token
  async registerPushToken(token: string): Promise<{ message: string }> {
    const response = await apiClient.post('/auth/push-token', { token });
    return response.data;
  },

  // Delete account
  async deleteAccount(): Promise<{ message: string }> {
    const response = await apiClient.delete('/auth/account');
    return response.data;
  },
};
