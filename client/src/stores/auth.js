import { defineStore } from 'pinia'
import { invoke } from '@tauri-apps/api/core'

const API_BASE = import.meta.env.VITE_API_URL || 'http://localhost:4000'

export const useAuthStore = defineStore('auth', {
  state: () => ({
    isAuthenticated: false,
    walletAddress: null,
    token: null,
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
        // Open wallet auth window
        await invoke('open_wallet_auth_window')

        // Listen for auth result
        const result = await new Promise((resolve, reject) => {
          const handleAuthComplete = (event) => {
            window.removeEventListener('wallet-auth-complete', handleAuthComplete)
            resolve(event.detail)
          }

          window.addEventListener('wallet-auth-complete', handleAuthComplete)

          // Timeout after 2 minutes
          setTimeout(() => {
            window.removeEventListener('wallet-auth-complete', handleAuthComplete)
            reject(new Error('Auth timeout'))
          }, 120000)
        })

        // Verify signature with backend
        const verifyResponse = await fetch(`${API_BASE}/api/auth/verify`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            signature: result.signature,
            public_key: result.publicKey,
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
        this.isAuthenticated = true

        // Store in localStorage for persistence
        localStorage.setItem('auth_token', data.token)
        localStorage.setItem('wallet_address', data.wallet_address)

        // Close auth window
        await invoke('close_auth_window')

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
      localStorage.removeItem('auth_token')
      localStorage.removeItem('wallet_address')
    },

    async checkAuth() {
      const token = localStorage.getItem('auth_token')
      const walletAddress = localStorage.getItem('wallet_address')

      if (token && walletAddress) {
        // Optionally verify token with backend
        this.token = token
        this.walletAddress = walletAddress
        this.isAuthenticated = true
        return true
      }
      return false
    }
  }
})
