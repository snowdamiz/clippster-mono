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
    // Use token from store, with localStorage fallback for race conditions
    const authStore = useAuthStore();
    const token = authStore.token || localStorage.getItem('auth_token');
    if (token) {
      config.headers.Authorization = `Bearer ${token}`;
    }
    return config;
  },
  (error: AxiosError): Promise<AxiosError> => {
    return Promise.reject(error);
  }
);

// Track when user last logged in to prevent immediate logout on race condition 401s
let lastLoginTime = 0;

// Listen for successful logins
window.addEventListener('auth-state-changed', (event: Event) => {
  const customEvent = event as CustomEvent;
  if (customEvent.detail?.userId) {
    lastLoginTime = Date.now();
  }
});

// Response interceptor for auth errors
api.interceptors.response.use(
  (response: AxiosResponse): AxiosResponse => response,
  async (error: AxiosError): Promise<AxiosError> => {
    const authStore = useAuthStore();

    if (error.response?.status === 401) {
      // Only auto-logout if user was previously authenticated
      // AND it's been more than 5 seconds since login (to avoid race condition logouts)
      const timeSinceLogin = Date.now() - lastLoginTime;
      if (authStore.isAuthenticated && timeSinceLogin > 5000) {
        authStore.logout();
        // Dispatch auth-required event for components to handle individually
        window.dispatchEvent(new CustomEvent('auth-required'));
      }
    }

    return Promise.reject(error);
  }
);

export default api;
