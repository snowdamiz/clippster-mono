import { defineStore } from 'pinia'
import { invoke } from '@tauri-apps/api/core'
import { listen } from '@tauri-apps/api/event'

const API_BASE = import.meta.env.VITE_API_URL || 'http://localhost:4000'

export const useAuthStore = defineStore('auth', {
  state: () => ({
    isAuthenticated: false,
    walletAddress: null,
    token: null,
    user: null,
    loading: false,
    error: null
  }),

  actions: {
    async requestChallenge() {
      const response = await fetch(`${API_BASE}/api/auth/challenge`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          client_id: await this.getClientId()
        })
      })

      if (!response.ok) throw new Error('Failed to get challenge')
      return await response.json()
    },

    async authenticateWithWallet() {
      this.loading = true
      this.error = null

      try {
        // Open wallet auth in browser
        await invoke('open_wallet_auth_window')

        // Listen for auth result via Tauri event or polling
        const result = await new Promise((resolve, reject) => {
          let unlisten = null
          let pollInterval = null
          let timeoutId = null

          const cleanup = () => {
            if (unlisten) unlisten()
            if (pollInterval) clearInterval(pollInterval)
            if (timeoutId) clearTimeout(timeoutId)
          }

          // Listen for event from Rust backend
          listen('wallet-auth-complete', (event) => {
            cleanup()
            resolve(event.payload)
          }).then(u => { unlisten = u })

          // Fallback: poll for result every second
          pollInterval = setInterval(async () => {
            try {
              const polledResult = await invoke('poll_auth_result')
              if (polledResult) {
                cleanup()
                resolve(polledResult)
              }
            } catch (error) {
              console.error('Poll error:', error)
            }
          }, 1000)

          // Timeout after 5 minutes
          timeoutId = setTimeout(() => {
            cleanup()
            reject(new Error('Authentication timeout - please try again'))
          }, 300000)
        })

        console.log('Received auth result:', result)

        // Verify signature with backend
        const verifyResponse = await fetch(`${API_BASE}/api/auth/verify`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            signature: result.signature,
            public_key: result.public_key,
            message: result.message,
            nonce: result.nonce
          })
        })

        if (!verifyResponse.ok) {
          const errorData = await verifyResponse.json()
          throw new Error(errorData.error || 'Signature verification failed')
        }

        const data = await verifyResponse.json()

        if (!data.success) {
          throw new Error(data.error || 'Authentication failed')
        }

        // Store auth data
        this.token = data.token
        this.walletAddress = data.wallet_address
        this.user = data.user
        this.isAuthenticated = true

        // Store in localStorage for persistence
        localStorage.setItem('auth_token', data.token)
        localStorage.setItem('wallet_address', data.wallet_address)
        localStorage.setItem('user', JSON.stringify(data.user))

        return { success: true }

      } catch (error) {
        console.error('Auth error:', error)
        this.error = error.message
        return { success: false, error: error.message }
      } finally {
        this.loading = false
      }
    },

    async getClientId() {
      let clientId = localStorage.getItem('client_id')
      if (!clientId) {
        clientId = crypto.randomUUID()
        localStorage.setItem('client_id', clientId)
      }
      return clientId
    },

    logout() {
      this.isAuthenticated = false
      this.walletAddress = null
      this.token = null
      this.user = null
      localStorage.removeItem('auth_token')
      localStorage.removeItem('wallet_address')
      localStorage.removeItem('user')
    },

    async checkAuth() {
      const token = localStorage.getItem('auth_token')
      const walletAddress = localStorage.getItem('wallet_address')
      const userJson = localStorage.getItem('user')

      if (token && walletAddress && userJson) {
        try {
          this.token = token
          this.walletAddress = walletAddress
          this.user = JSON.parse(userJson)
          this.isAuthenticated = true
          return true
        } catch (error) {
          console.error('Failed to parse user data:', error)
        }
      }
      return false
    }
  }
})
