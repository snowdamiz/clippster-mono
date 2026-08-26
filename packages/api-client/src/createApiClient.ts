export type ClientPlatform = 'mobile' | 'desktop' | 'web';

export interface ApiClientConfig {
  baseUrl: string;
  getToken: () => Promise<string | null>;
  onUnauthorized: () => void;
  platform: ClientPlatform;
  fetchImpl?: typeof fetch;
  timeoutMs?: number;
}

export interface RequestOptions extends Omit<RequestInit, 'body'> {
  body?: unknown;
  skipAuth?: boolean;
}

export interface ApiClient {
  get: <T = unknown>(path: string, options?: RequestOptions) => Promise<T>;
  post: <T = unknown>(path: string, body?: unknown, options?: RequestOptions) => Promise<T>;
  put: <T = unknown>(path: string, body?: unknown, options?: RequestOptions) => Promise<T>;
  patch: <T = unknown>(path: string, body?: unknown, options?: RequestOptions) => Promise<T>;
  delete: <T = unknown>(path: string, options?: RequestOptions) => Promise<T>;
  requestWithStatus: <T = unknown>(
    path: string,
    options?: RequestOptions,
  ) => Promise<{ status: number; data: T }>;
}

function normalizeBaseUrl(baseUrl: string): string {
  let url = baseUrl.trim();
  if (url.endsWith('/')) {
    url = url.slice(0, -1);
  }
  if (!url.endsWith('/api')) {
    url += '/api';
  }
  return url;
}

export function createApiClient(config: ApiClientConfig): ApiClient {
  const baseUrl = normalizeBaseUrl(config.baseUrl);
  const fetchFn = config.fetchImpl ?? fetch;
  const timeoutMs = config.timeoutMs ?? 300_000;

  async function request<T>(path: string, options: RequestOptions = {}): Promise<T> {
    const headers: Record<string, string> = {
      ...(options.headers as Record<string, string> | undefined),
      'X-Client-Platform': config.platform,
    };

    if (!options.skipAuth) {
      const token = await config.getToken();
      if (token) {
        headers.Authorization = `Bearer ${token}`;
      }
    }

    let body: BodyInit | undefined;
    if (options.body instanceof FormData) {
      body = options.body;
    } else if (options.body !== undefined) {
      headers['Content-Type'] = headers['Content-Type'] ?? 'application/json';
      body = JSON.stringify(options.body);
    } else if (!headers['Content-Type']) {
      headers['Content-Type'] = 'application/json';
    }

    const controller = new AbortController();
    const timeout = setTimeout(() => controller.abort(), timeoutMs);

    try {
      const response = await fetchFn(`${baseUrl}${path}`, {
        ...options,
        headers,
        body,
        signal: controller.signal,
      });

      if (response.status === 401) {
        config.onUnauthorized();
      }

      const data = (await response.json()) as T;
      return data;
    } finally {
      clearTimeout(timeout);
    }
  }

  return {
    get: <T = unknown>(path: string, options?: RequestOptions) => request<T>(path, { ...options, method: 'GET' }),
    post: <T = unknown>(path: string, body?: unknown, options?: RequestOptions) =>
      request<T>(path, { ...options, method: 'POST', body }),
    put: <T = unknown>(path: string, body?: unknown, options?: RequestOptions) =>
      request<T>(path, { ...options, method: 'PUT', body }),
    patch: <T = unknown>(path: string, body?: unknown, options?: RequestOptions) =>
      request<T>(path, { ...options, method: 'PATCH', body }),
    delete: <T = unknown>(path: string, options?: RequestOptions) =>
      request<T>(path, { ...options, method: 'DELETE' }),
    requestWithStatus: async <T = unknown>(path: string, options: RequestOptions = {}) => {
      const headers: Record<string, string> = {
        ...(options.headers as Record<string, string> | undefined),
        'X-Client-Platform': config.platform,
      };

      if (!options.skipAuth) {
        const token = await config.getToken();
        if (token) {
          headers.Authorization = `Bearer ${token}`;
        }
      }

      let body: BodyInit | undefined;
      if (options.body instanceof FormData) {
        body = options.body;
      } else if (options.body !== undefined) {
        headers['Content-Type'] = headers['Content-Type'] ?? 'application/json';
        body = JSON.stringify(options.body);
      }

      const controller = new AbortController();
      const timeout = setTimeout(() => controller.abort(), timeoutMs);

      try {
        const response = await fetchFn(`${baseUrl}${path}`, {
          ...options,
          headers,
          body,
          signal: controller.signal,
        });

        if (response.status === 401) {
          config.onUnauthorized();
        }

        const data = (await response.json()) as T;
        return { status: response.status, data };
      } finally {
        clearTimeout(timeout);
      }
    },
  };
}
