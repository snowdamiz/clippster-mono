import { useCallback, useEffect, useRef } from 'react'
import { API_BASE } from '@/lib/apiBase'

interface OAuthResult {
  success: boolean
  account_id?: string
  platform?: string
  platform_user_id?: string
  username?: string
  display_name?: string
  profile_image_url?: string
  connected_at?: string
  error?: string
}

/**
 * Hook for opening OAuth flows in a popup window.
 * 
 * Flow:
 * 1. Opens backend /api/auth/{platform}/start with web_redirect_uri pointing to /oauth/callback
 * 2. Backend redirects to platform OAuth
 * 3. After auth, backend redirects back to /oauth/callback?success=true&...
 * 4. OAuthCallbackPage reads params and postMessages them back to this window
 * 5. This hook receives the message and calls onResult
 */
export function useOAuthPopup() {
  const popupRef = useRef<Window | null>(null)
  const callbackRef = useRef<((result: OAuthResult) => void) | null>(null)

  useEffect(() => {
    const handleMessage = (event: MessageEvent) => {
      // Only accept messages from our own origin
      if (event.origin !== window.location.origin) return
      if (event.data?.type !== 'oauth-callback') return

      const result: OAuthResult = {
        success: event.data.success === 'true',
        account_id: event.data.account_id,
        platform: event.data.platform,
        platform_user_id: event.data.platform_user_id,
        username: event.data.username,
        display_name: event.data.display_name,
        profile_image_url: event.data.profile_image_url,
        connected_at: event.data.connected_at,
        error: event.data.error,
      }

      if (callbackRef.current) {
        callbackRef.current(result)
        callbackRef.current = null
      }
    }

    window.addEventListener('message', handleMessage)
    return () => window.removeEventListener('message', handleMessage)
  }, [])

  const openPopup = useCallback((url: string, name: string, onResult: (result: OAuthResult) => void) => {
    // Close any existing popup
    if (popupRef.current && !popupRef.current.closed) {
      popupRef.current.close()
    }

    callbackRef.current = onResult

    // Open popup centered on screen
    const width = 600
    const height = 700
    const left = window.screenX + (window.outerWidth - width) / 2
    const top = window.screenY + (window.outerHeight - height) / 2

    popupRef.current = window.open(
      url,
      name,
      `width=${width},height=${height},left=${left},top=${top},toolbar=no,menubar=no,scrollbars=yes`
    )

    // Poll for popup close (user closed it manually)
    const pollTimer = setInterval(() => {
      if (popupRef.current?.closed) {
        clearInterval(pollTimer)
        if (callbackRef.current) {
          callbackRef.current({ success: false, error: 'Authentication window was closed' })
          callbackRef.current = null
        }
      }
    }, 500)
  }, [])

  const openOAuth = useCallback((
    platform: 'instagram' | 'twitter',
    organizationId: string | number,
    authToken: string,
    onResult: (result: OAuthResult) => void
  ) => {
    const webRedirectUri = `${window.location.origin}/oauth/callback`
    const params = new URLSearchParams({
      organization_id: String(organizationId),
      auth_token: authToken,
      web_redirect_uri: webRedirectUri,
    })
    const url = `${API_BASE}/auth/${platform}/start?${params.toString()}`
    openPopup(url, `oauth-${platform}`, onResult)
  }, [openPopup])

  /**
   * Open PFM OAuth for org-level accounts (Instagram Business, TikTok, YouTube)
   */
  const openPfmOAuth = useCallback((
    platform: 'instagram_business' | 'tiktok' | 'youtube',
    organizationId: string | number,
    authToken: string,
    onResult: (result: OAuthResult) => void
  ) => {
    const webRedirectUri = `${window.location.origin}/oauth/callback`
    const params = new URLSearchParams({
      platform,
      organization_id: String(organizationId),
      auth_token: authToken,
      web_redirect_uri: webRedirectUri,
    })
    const url = `${API_BASE}/auth/postforme/start?${params.toString()}`
    openPopup(url, `oauth-pfm-${platform}`, onResult)
  }, [openPopup])

  /**
   * Open PFM OAuth for user-level accounts (no org)
   */
  const openPfmUserOAuth = useCallback((
    platform: 'instagram_business' | 'tiktok' | 'youtube',
    authToken: string,
    onResult: (result: OAuthResult) => void
  ) => {
    const webRedirectUri = `${window.location.origin}/oauth/callback`
    const params = new URLSearchParams({
      platform,
      auth_token: authToken,
      web_redirect_uri: webRedirectUri,
    })
    const url = `${API_BASE}/auth/postforme/start?${params.toString()}`
    openPopup(url, `oauth-pfm-${platform}`, onResult)
  }, [openPopup])

  return { openOAuth, openPfmOAuth, openPfmUserOAuth }
}

export type { OAuthResult }
