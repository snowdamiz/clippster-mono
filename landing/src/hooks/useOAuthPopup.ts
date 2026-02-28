import { useCallback, useRef } from 'react'
import { api } from '@/lib/api'

interface SocialAccountResult {
  id: number
  platform: string
  username: string
  display_name?: string | null
  profile_image_url?: string | null
}

interface OAuthResult {
  success: boolean
  account?: SocialAccountResult
  username?: string
  error?: string
}

interface ConnectUrlResponse {
  success: boolean
  auth_url?: string
  connection_id?: string
  error?: string
}

interface ConnectStatusResponse {
  success: boolean
  status?: 'pending' | 'callback_received' | 'synced' | 'failed' | 'expired'
  error?: string
}

interface CompleteConnectResponse {
  success: boolean
  account?: SocialAccountResult
  accounts?: SocialAccountResult[]
  error?: string
}

const STATUS_POLL_INTERVAL_MS = 1500
const STATUS_POLL_TIMEOUT_MS = 180000

/**
 * Hook for opening social OAuth flows in a popup window using server-side callback tracking.
 */
export function useOAuthPopup() {
  const popupRef = useRef<Window | null>(null)
  const runIdRef = useRef(0)

  const openOAuth = useCallback(
    (
      platform: 'instagram' | 'tiktok' | 'youtube' | 'twitter' | 'x',
      organizationId: string | number,
      onResult: (result: OAuthResult) => void
    ) => {
      runIdRef.current += 1
      const runId = runIdRef.current

      if (popupRef.current && !popupRef.current.closed) {
        popupRef.current.close()
      }

      void (async () => {
        try {
          const normalizedPlatform = platform === 'twitter' ? 'x' : platform

          const connectResponse = await api.post<ConnectUrlResponse>('/social/connect-url', {
            organization_id: organizationId,
            platform: normalizedPlatform,
            return_mode: 'web',
            return_url: `${window.location.origin}/oauth/callback`
          })

          if (
            !connectResponse.success ||
            !connectResponse.auth_url ||
            !connectResponse.connection_id
          ) {
            throw new Error(connectResponse.error || 'Failed to create OAuth connection URL')
          }

          const connectionId = connectResponse.connection_id

          const width = 600
          const height = 720
          const left = window.screenX + (window.outerWidth - width) / 2
          const top = window.screenY + (window.outerHeight - height) / 2

          popupRef.current = window.open(
            connectResponse.auth_url,
            `oauth-${normalizedPlatform}`,
            `width=${width},height=${height},left=${left},top=${top},toolbar=no,menubar=no,scrollbars=yes`
          )

          const status = await pollConnectStatus(
            organizationId,
            connectionId,
            () => runIdRef.current !== runId,
            () => !!popupRef.current && popupRef.current.closed
          )

          if (runIdRef.current !== runId) return

          if (status.status !== 'synced') {
            onResult({
              success: false,
              error: status.error || 'Social account connection failed'
            })
            return
          }

          const completeResponse = await api.post<CompleteConnectResponse>(
            '/social/complete-connect',
            {
              organization_id: organizationId,
              connection_id: connectionId,
              platform: normalizedPlatform
            }
          )

          if (!completeResponse.success) {
            onResult({
              success: false,
              error: completeResponse.error || 'Failed to finalize social account connection'
            })
            return
          }

          const account = completeResponse.account || completeResponse.accounts?.[0]

          onResult({
            success: true,
            account,
            username: account?.username
          })
        } catch (error: unknown) {
          if (runIdRef.current !== runId) return

          const errorMessage = error instanceof Error ? error.message : undefined
          onResult({
            success: false,
            error: errorMessage || 'Failed to connect social account'
          })
        } finally {
          if (popupRef.current && !popupRef.current.closed) {
            popupRef.current.close()
          }
        }
      })()
    },
    []
  )

  return { openOAuth }
}

async function pollConnectStatus(
  organizationId: string | number,
  connectionId: string,
  isCancelled: () => boolean,
  isPopupClosed: () => boolean
): Promise<ConnectStatusResponse> {
  const startedAt = Date.now()
  let popupClosedAt: number | null = null

  while (!isCancelled()) {
    if (isPopupClosed()) {
      popupClosedAt = popupClosedAt || Date.now()
    } else {
      popupClosedAt = null
    }

    const statusResponse = await api.get<ConnectStatusResponse>('/social/connect-status', {
      params: {
        organization_id: organizationId,
        connection_id: connectionId
      }
    })

    if (!statusResponse.success) {
      throw new Error(statusResponse.error || 'Failed to fetch connection status')
    }

    if (
      statusResponse.status === 'synced' ||
      statusResponse.status === 'failed' ||
      statusResponse.status === 'expired'
    ) {
      return statusResponse
    }

    if (popupClosedAt && Date.now() - popupClosedAt > 5000) {
      throw new Error('Authentication window was closed')
    }

    if (Date.now() - startedAt > STATUS_POLL_TIMEOUT_MS) {
      throw new Error('Timed out waiting for social account connection')
    }

    await new Promise((resolve) => setTimeout(resolve, STATUS_POLL_INTERVAL_MS))
  }

  throw new Error('Authentication window was closed')
}

export type { OAuthResult }
