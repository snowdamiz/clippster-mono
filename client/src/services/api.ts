import axios, { AxiosInstance, AxiosError, InternalAxiosRequestConfig, AxiosResponse } from 'axios';
import { useAuthStore } from '../stores/auth';
import { isSocialTokenExpiredApiError } from '@/utils/socialAuthErrors';

const getBaseUrl = () => {
  let url = import.meta.env.VITE_API_URL || (import.meta.env.DEV ? 'http://localhost:4000/api' : 'https://api.clippster.app/api');

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

const isDesktopRuntime = (): boolean => {
  if (typeof window === 'undefined') return false;
  const candidate = window as unknown as Record<string, unknown>;
  return '__TAURI_INTERNALS__' in candidate || '__TAURI__' in candidate;
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

    if (isDesktopRuntime()) {
      config.headers['X-Client-Platform'] = 'desktop';
    }

    // Let the browser set Content-Type for FormData (needs multipart boundary)
    if (config.data instanceof FormData) {
      delete config.headers['Content-Type'];
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

    if (error.response?.status === 401 && !isSocialTokenExpiredApiError(error)) {
      // Social token expiry also used to return 401; never treat that as a session logout.
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
