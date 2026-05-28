import axios, { AxiosInstance, AxiosError, InternalAxiosRequestConfig } from 'axios';
import { Config } from '../constants/config';
import { authStorage } from '../utils/storage';

// Create axios instance
const apiClient: AxiosInstance = axios.create({
  baseURL: Config.api.baseUrl,
  timeout: Config.api.timeout,
  headers: {
    'Content-Type': 'application/json',
  },
});

// Request interceptor - add auth token
apiClient.interceptors.request.use(
  async (config: InternalAxiosRequestConfig) => {
    try {
      const token = await authStorage.getToken();
      if (token && token.length > 0) {
        config.headers.Authorization = `Bearer ${token}`;
      } else {
        console.log('API Request: No token available for', config.url);
      }
    } catch (error) {
      console.error('Error getting auth token:', error);
    }
    return config;
  },
  (error: AxiosError) => {
    return Promise.reject(error);
  }
);

// Response interceptor - handle errors
apiClient.interceptors.response.use(
  (response) => response,
  async (error: AxiosError) => {
    if (error.response) {
      const { status, data } = error.response;

      // Handle 401 Unauthorized - DON'T automatically remove token
      // This was causing issues where temporary 401s would log users out permanently
      // Instead, let the calling code handle the re-authentication
      if (status === 401) {
        console.log('401 Unauthorized - token may be expired or invalid');
        // Don't remove token here - let the user retry or the app will prompt re-login
        // await authStorage.removeToken(); // REMOVED - was causing permanent logout issues
      }

      // Extract error message
      const errorMessage = 
        (data as any)?.detail || 
        (data as any)?.message || 
        'An error occurred';

      return Promise.reject({
        status,
        message: errorMessage,
        data,
      });
    }

    // Network error
    if (error.request) {
      return Promise.reject({
        status: 0,
        message: 'Network error. Please check your connection.',
        data: null,
      });
    }

    return Promise.reject({
      status: -1,
      message: error.message || 'An unexpected error occurred',
      data: null,
    });
  }
);

export default apiClient;

// Helper types for API responses
export interface ApiError {
  status: number;
  message: string;
  data: any;
}

export const isApiError = (error: any): error is ApiError => {
  return error && typeof error.status === 'number' && typeof error.message === 'string';
};
