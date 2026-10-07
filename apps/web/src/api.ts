import { ref } from 'vue'
import { createApiClient, createAuthApi, createWebProjectsApi } from '@clippster/api-client'
export const sessionExpired = ref(false)
export const client = createApiClient({
  baseUrl: `${location.origin}/api`,
  platform: 'web',
  getToken: async () => null,
  onUnauthorized: () => {
    sessionExpired.value = true
  }
})
export const auth = createAuthApi(client)
export const projects = createWebProjectsApi(client)
export const sourcePath = (id: string) => `/api/web/projects/${id}/source`
export const downloadPath = (id: string, clipId: string) =>
  `/api/web/projects/${id}/clips/${clipId}/download`
export async function upload(
  id: string,
  file: File,
  onProgress: (value: number) => void
): Promise<void> {
  return new Promise((resolve, reject) => {
    const request = new XMLHttpRequest()
    request.open('PUT', sourcePath(id))
    request.setRequestHeader('Content-Type', 'application/octet-stream')
    request.timeout = 30 * 60_000
    request.upload.onprogress = (event) => {
      if (event.lengthComputable) onProgress(Math.round((event.loaded / event.total) * 100))
    }
    request.onload = () => {
      if (request.status === 401) sessionExpired.value = true
      if (request.status < 300) resolve()
      else {
        try {
          reject(new Error(JSON.parse(request.responseText).error))
        } catch {
          reject(new Error('Upload failed. Please try again.'))
        }
      }
    }
    request.onerror = () =>
      reject(new Error('Upload interrupted. Check your connection and try again.'))
    request.ontimeout = () => reject(new Error('Upload timed out. Please use a smaller file.'))
    request.send(file)
  })
}
export function errorMessage(error: unknown) {
  return error instanceof Error ? error.message : 'Something went wrong. Please try again.'
}
