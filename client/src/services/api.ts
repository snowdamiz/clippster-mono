import axios, { AxiosInstance, AxiosError, InternalAxiosRequestConfig, AxiosResponse } from 'axios';
import { useAuthStore } from '../stores/auth';

const api: AxiosInstance = axios.create({
  baseURL: import.meta.env.VITE_API_URL || 'http://localhost:4000/api',
  timeout: 30000,
  headers: {
    'Content-Type': 'application/json',
  },
});

// Request interceptor to add auth token
api.interceptors.request.use(
  (config: InternalAxiosRequestConfig): InternalAxiosRequestConfig => {
    const authStore = useAuthStore();
    if (authStore.token) {
      config.headers.Authorization = `Bearer ${authStore.token}`;
    }
    return config;
  },
  (error: AxiosError): Promise<AxiosError> => {
    return Promise.reject(error);
  }
);

// Response interceptor for auth errors
api.interceptors.response.use(
  (response: AxiosResponse): AxiosResponse => response,
  async (error: AxiosError): Promise<AxiosError> => {
    const authStore = useAuthStore();

    if (error.response?.status === 401) {
      // Only auto-logout if user was previously authenticated
      if (authStore.isAuthenticated) {
        authStore.logout();
        // Dispatch auth-required event for components to handle individually
        window.dispatchEvent(new CustomEvent('auth-required'));
      }
    }

    return Promise.reject(error);
  }
);

export default api;
