const API_BASE = `${import.meta.env.VITE_API_URL || 'https://clippster-server.fly.dev'}/api`

function getAuthToken(): string | null {
  return localStorage.getItem('auth_token')
}

function getHeaders(includeContentType = true): HeadersInit {
  const headers: Record<string, string> = {}
  const token = getAuthToken()
  if (token) {
    headers['Authorization'] = `Bearer ${token}`
  }
  if (includeContentType) {
    headers['Content-Type'] = 'application/json'
  }
  return headers
}

type QueryValue = string | number | boolean | null | undefined
type QueryParams = Record<string, QueryValue | QueryValue[]>

interface RequestOptions {
  headers?: HeadersInit
  params?: QueryParams
}

function buildUrl(path: string, params?: QueryParams): string {
  if (!params) return `${API_BASE}${path}`
  const search = new URLSearchParams()
  for (const [key, value] of Object.entries(params)) {
    if (value === undefined || value === null || value === '') continue
    if (Array.isArray(value)) {
      for (const item of value) {
        if (item === undefined || item === null || item === '') continue
        search.append(key, String(item))
      }
      continue
    }
    search.append(key, String(value))
  }
  const qs = search.toString()
  return qs ? `${API_BASE}${path}?${qs}` : `${API_BASE}${path}`
}

async function handleResponse<T>(response: Response): Promise<T> {
  if (response.status === 401) {
    window.dispatchEvent(new CustomEvent('auth-required'))
  }
  const data = await response.json()
  return data as T
}

export const api = {
  async get<T = any>(path: string, options?: RequestOptions): Promise<T> {
    const response = await fetch(buildUrl(path, options?.params), {
      headers: {
        ...getHeaders(),
        ...(options?.headers ?? {}),
      },
    })
    return handleResponse<T>(response)
  },

  async post<T = any>(path: string, body?: any, options?: RequestOptions): Promise<T> {
    const isFormData = body instanceof FormData
    const response = await fetch(buildUrl(path, options?.params), {
      method: 'POST',
      headers: {
        ...getHeaders(!isFormData),
        ...(options?.headers ?? {}),
      },
      body: body ? (isFormData ? body : JSON.stringify(body)) : undefined,
    })
    return handleResponse<T>(response)
  },

  async put<T = any>(path: string, body?: any, options?: RequestOptions): Promise<T> {
    const isFormData = body instanceof FormData
    const response = await fetch(buildUrl(path, options?.params), {
      method: 'PUT',
      headers: {
        ...getHeaders(!isFormData),
        ...(options?.headers ?? {}),
      },
      body: body ? (isFormData ? body : JSON.stringify(body)) : undefined,
    })
    return handleResponse<T>(response)
  },

  async patch<T = any>(path: string, body?: any, options?: RequestOptions): Promise<T> {
    const isFormData = body instanceof FormData
    const response = await fetch(buildUrl(path, options?.params), {
      method: 'PATCH',
      headers: {
        ...getHeaders(!isFormData),
        ...(options?.headers ?? {}),
      },
      body: body ? (isFormData ? body : JSON.stringify(body)) : undefined,
    })
    return handleResponse<T>(response)
  },

  async delete<T = any>(path: string, options?: RequestOptions): Promise<T> {
    const response = await fetch(buildUrl(path, options?.params), {
      method: 'DELETE',
      headers: {
        ...getHeaders(),
        ...(options?.headers ?? {}),
      },
    })
    return handleResponse<T>(response)
  },

  async upload<T = any>(path: string, formData: FormData): Promise<T> {
    const response = await fetch(`${API_BASE}${path}`, {
      method: 'POST',
      headers: getHeaders(false),
      body: formData,
    })
    return handleResponse<T>(response)
  },
}

export { API_BASE }
