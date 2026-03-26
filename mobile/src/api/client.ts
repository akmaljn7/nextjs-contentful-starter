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
    const token = await authStorage.getToken();
    if (token) {
      config.headers.Authorization = `Bearer ${token}`;
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

      // Handle 401 Unauthorized
      if (status === 401) {
        await authStorage.removeToken();
        // The auth store will handle navigation to login
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
