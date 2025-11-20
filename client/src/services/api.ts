import axios, { AxiosInstance, AxiosError, InternalAxiosRequestConfig, AxiosResponse } from 'axios';
import { useAuthStore } from '../stores/auth';

const getBaseUrl = () => {
  let url = import.meta.env.VITE_API_URL || 'http://localhost:4000/api';

  // Remove trailing slash if present
  if (url.endsWith('/')) {
    url = url.slice(0, -1);
  }

  // Ensure it ends with /api if it doesn't already
  if (!url.endsWith('/api')) {
    url += '/api';
  }

  return url;
};

const api: AxiosInstance = axios.create({
  baseURL: getBaseUrl(),
  timeout: 300000, // 5 minutes timeout for long-running AI operations
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
