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

async function handleResponse<T>(response: Response): Promise<T> {
  if (response.status === 401) {
    window.dispatchEvent(new CustomEvent('auth-required'))
  }
  const data = await response.json()
  return data as T
}

export const api = {
  async get<T = any>(path: string): Promise<T> {
    const response = await fetch(`${API_BASE}${path}`, {
      headers: getHeaders(),
    })
    return handleResponse<T>(response)
  },

  async post<T = any>(path: string, body?: any): Promise<T> {
    const response = await fetch(`${API_BASE}${path}`, {
      method: 'POST',
      headers: getHeaders(),
      body: body ? JSON.stringify(body) : undefined,
    })
    return handleResponse<T>(response)
  },

  async put<T = any>(path: string, body?: any): Promise<T> {
    const response = await fetch(`${API_BASE}${path}`, {
      method: 'PUT',
      headers: getHeaders(),
      body: body ? JSON.stringify(body) : undefined,
    })
    return handleResponse<T>(response)
  },

  async patch<T = any>(path: string, body?: any): Promise<T> {
    const response = await fetch(`${API_BASE}${path}`, {
      method: 'PATCH',
      headers: getHeaders(),
      body: body ? JSON.stringify(body) : undefined,
    })
    return handleResponse<T>(response)
  },

  async delete<T = any>(path: string): Promise<T> {
    const response = await fetch(`${API_BASE}${path}`, {
      method: 'DELETE',
      headers: getHeaders(),
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
