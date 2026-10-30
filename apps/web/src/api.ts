import { ref } from 'vue'
import { createApiClient, createAuthApi, createWebProjectsApi } from '@clippster/api-client'
import { WEB_UPLOAD_CHUNK_BYTES } from '@clippster/shared-types'
export const sessionExpired = ref(false)
const apiPrefix = new URLSearchParams(location.search).has('embedded') ? '/workspace/api' : '/api'
export const webApiPath = `${apiPrefix}/web`
export const client = createApiClient({
  baseUrl: `${location.origin}${apiPrefix}`,
  platform: 'web',
  getToken: async () => null,
  onUnauthorized: () => {
    sessionExpired.value = true
  }
})
export const auth = createAuthApi(client)
export const projects = createWebProjectsApi(client)
async function workspaceRequest<T>(path: string, method: string, body?: unknown): Promise<T> {
  const response = await client.requestWithStatus<T & { error?: string; success?: boolean }>(path, { method, body })
  if (response.status >= 400 || response.data?.success === false)
    throw new Error(response.data?.error || 'The request failed. Please try again.')
  return response.data
}
export const workspaceClient = {
  get: <T = unknown>(path: string) => workspaceRequest<T>(path, 'GET'),
  post: <T = unknown>(path: string, body?: unknown) => workspaceRequest<T>(path, 'POST', body),
  put: <T = unknown>(path: string, body?: unknown) => workspaceRequest<T>(path, 'PUT', body),
  patch: <T = unknown>(path: string, body?: unknown) => workspaceRequest<T>(path, 'PATCH', body),
  delete: <T = unknown>(path: string) => workspaceRequest<T>(path, 'DELETE'),
}
export const sourcePath = (id: string) => `${apiPrefix}/web/projects/${id}/source`
export const clipPreviewPath = (projectId: string, clipId: string) => `${apiPrefix}/web/projects/${projectId}/clips/${clipId}/preview`
export const downloadPath = (id: string, clipId: string) =>
  `${apiPrefix}/web/projects/${id}/clips/${clipId}/download`
export const framingAssetPath = (projectId: string, id?: string) => `${apiPrefix}/web/projects/${projectId}/framing-assets${id ? `/${id}` : ''}`
function sendFile(method: string, url: string, body: Blob | null, timeout: number, onProgress?: (loaded: number) => void) {
  return new Promise<{ status: number; data: { error?: string; received?: number } }>((resolve, reject) => {
    const request = new XMLHttpRequest()
    request.open(method, url)
    request.setRequestHeader('Content-Type', 'application/octet-stream')
    request.timeout = timeout
    request.upload.onprogress = (event) => onProgress?.(event.loaded)
    request.onload = () => {
      if (request.status === 401) sessionExpired.value = true
      let data = {}
      try { data = JSON.parse(request.responseText) } catch { /* Callers report a generic failure. */ }
      resolve({ status: request.status, data })
    }
    request.onerror = () =>
      reject(new Error('Upload interrupted. Check your connection and try again.'))
    request.ontimeout = () => reject(new Error('Upload timed out. Please use a smaller file.'))
    request.send(body)
  })
}
/** Stages files over the chunk size so no request body exceeds Cloudflare's limit; the target then names the upload. */
export async function prepareUpload(url: string, file: File, onProgress?: (loaded: number) => void): Promise<{ url: string; body: File | null }> {
  if (file.size <= WEB_UPLOAD_CHUNK_BYTES) return { url, body: file }
  const { id } = await workspaceClient.post<{ id: string }>('/web/uploads', { size: file.size })
  let offset = 0, failures = 0
  while (offset < file.size) {
    const start = offset
    let response
    try {
      response = await sendFile('PUT', `${webApiPath}/uploads/${id}?offset=${start}`, file.slice(start, start + WEB_UPLOAD_CHUNK_BYTES), 10 * 60_000, (loaded) => onProgress?.(start + loaded))
    } catch (error) {
      if (++failures >= 3) throw error
      continue
    }
    // 409 reports where the server is after a chunk that arrived but whose response was lost.
    if ((response.status < 300 || response.status === 409) && typeof response.data.received === 'number') {
      offset = response.data.received
      failures = 0
    } else throw new Error(response.data.error || 'Upload failed. Please try again.')
  }
  return { url: `${url}${url.includes('?') ? '&' : '?'}upload=${id}`, body: null }
}
export async function upload(
  id: string,
  file: File,
  onProgress: (value: number) => void
): Promise<void> {
  const percent = (loaded: number) => onProgress(Math.round((loaded / (file.size || 1)) * 100))
  const target = await prepareUpload(sourcePath(id), file, percent)
  const { status, data } = await sendFile('PUT', target.url, target.body, 30 * 60_000, target.body ? percent : undefined)
  if (status >= 300) throw new Error(data.error || 'Upload failed. Please try again.')
}
export function errorMessage(error: unknown) {
  return error instanceof Error ? error.message : 'Something went wrong. Please try again.'
}
