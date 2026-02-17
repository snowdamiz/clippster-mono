import { defineStore } from 'pinia';
import { invoke } from '@tauri-apps/api/core';
import { listen } from '@tauri-apps/api/event';
import { setCurrentUserId, clearCurrentUserId } from '../services/database/core';

const API_BASE = import.meta.env.VITE_API_URL || 'http://localhost:4000';

// Lazy load api to avoid circular dependency (api.ts imports useAuthStore)
let apiInstance = null;
async function getApi() {
  if (!apiInstance) {
    const module = await import('../services/api');
    apiInstance = module.default;
  }
  return apiInstance;
}

/**
 * Set user context in both TypeScript (database) and Rust (storage) layers
 */
async function setUserContext(userId) {
  // Set user ID in TypeScript database layer
  setCurrentUserId(userId);

  // Set user ID in Rust storage layer for per-user file paths
  try {
    await invoke('set_current_user_id', { userId });
  } catch (error) {
    console.error('[Auth] Failed to set Rust user context:', error);
  }
}

/**
 * Clear user context from both TypeScript and Rust layers
 */
async function clearUserContext() {
  // Clear user ID in TypeScript database layer
  clearCurrentUserId();

  // Clear user ID in Rust storage layer
  try {
    await invoke('clear_current_user_id');
  } catch (error) {
    console.error('[Auth] Failed to clear Rust user context:', error);
  }
}

/**
 * Emit auth state changed event to trigger data refresh across the app
 */
function emitAuthStateChanged(userId) {
  console.log('[Auth] Emitting auth-state-changed event, userId:', userId);
  window.dispatchEvent(
    new CustomEvent('auth-state-changed', {
      detail: { userId, timestamp: Date.now() },
    })
  );
}

export const useAuthStore = defineStore('auth', {
  state: () => ({
    isAuthenticated: false,
    walletAddress: null,
    email: null,
    token: null,
    user: null,
    loading: false,
    error: null,
    authProvider: null, // 'wallet', 'google', 'email', or null
    // Email verification state
    pendingVerificationEmail: null,
    verificationSentAt: null,
  }),

  getters: {
    /**
     * Get the auth token, with localStorage fallback to handle race conditions
     * where the store state might not be updated yet
     */
    authToken: (state) => {
      return state.token || localStorage.getItem('auth_token');
    },
  },

  actions: {
    /**
     * Helper to get token - uses localStorage as primary source for reliability
     * The store state can have race conditions, but localStorage is synchronous
     */
    getAuthToken() {
      const token = localStorage.getItem('auth_token') || this.token;
      console.log('[Auth] getAuthToken called, token exists:', !!token);
      return token;
    },

    async requestChallenge() {
      const response = await fetch(`${API_BASE}/api/auth/challenge`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          client_id: await this.getClientId(),
        }),
      });

      if (!response.ok) throw new Error('Failed to get challenge');
      return await response.json();
    },

    async authenticateWithWallet(referralCode = null) {
      this.loading = true;
      this.error = null;

      try {
        // Open wallet auth in browser, passing the API base URL
        const apiBase = import.meta.env.VITE_API_URL || 'http://localhost:4000';
        await invoke('open_wallet_auth_window', { apiBase });

        // Listen for auth result via Tauri event or polling
        const result = await new Promise((resolve, reject) => {
          let unlisten = null;
          let pollInterval = null;
          let timeoutId = null;

          const cleanup = () => {
            if (unlisten) unlisten();
            if (pollInterval) clearInterval(pollInterval);
            if (timeoutId) clearTimeout(timeoutId);
          };

          // Listen for event from Rust backend
          listen('wallet-auth-complete', (event) => {
            cleanup();
            resolve(event.payload);
          }).then((u) => {
            unlisten = u;
          });

          // Fallback: poll for result every second
          pollInterval = setInterval(async () => {
            try {
              const polledResult = await invoke('poll_auth_result');
              if (polledResult) {
                cleanup();
                resolve(polledResult);
              }
            } catch (error) {
              console.error('Poll error:', error);
            }
          }, 1000);

          // Timeout after 5 minutes
          timeoutId = setTimeout(() => {
            cleanup();
            reject(new Error('Authentication timeout - please try again'));
          }, 300000);
        });

        // Verify signature with backend
        const verifyBody = {
          signature: result.signature,
          public_key: result.public_key,
          message: result.message,
          nonce: result.nonce,
        };
        if (referralCode) verifyBody.referral_code = referralCode;

        const verifyResponse = await fetch(`${API_BASE}/api/auth/verify`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify(verifyBody),
        });

        if (!verifyResponse.ok) {
          const errorData = await verifyResponse.json();
          throw new Error(errorData.error || 'Signature verification failed');
        }

        const data = await verifyResponse.json();

        if (!data.success) {
          throw new Error(data.error || 'Authentication failed');
        }

        // Store auth data
        this.token = data.token;
        this.walletAddress = data.wallet_address;
        this.user = data.user;
        this.authProvider = 'wallet';
        this.isAuthenticated = true;

        console.log('[Auth] Wallet login successful, user data:', {
          account_type: data.user.account_type,
          owned_organization_id: data.user.owned_organization_id,
        });

        // Store in localStorage for persistence
        localStorage.setItem('auth_token', data.token);
        localStorage.setItem('wallet_address', data.wallet_address);
        localStorage.setItem('user', JSON.stringify(data.user));
        localStorage.setItem('auth_provider', 'wallet');

        // Set user context for database queries and storage paths
        await setUserContext(data.user.id);

        // Emit event to trigger data refresh across the app
        emitAuthStateChanged(data.user.id);

        return { success: true, user: data.user, is_new_user: !!data.is_new_user };
      } catch (error) {
        this.error = error.message;
        return { success: false, error: error.message };
      } finally {
        this.loading = false;
      }
    },

    async authenticateWithGoogle(referralCode = null) {
      this.loading = true;
      this.error = null;

      try {
        // Open Google OAuth in browser via Tauri, passing referral code if present
        const googleApiBase = referralCode
          ? `${API_BASE}?referral_code=${encodeURIComponent(referralCode)}`
          : API_BASE;
        await invoke('open_google_auth_window', { apiBase: googleApiBase });

        // Listen for auth result via Tauri event or polling
        const result = await new Promise((resolve, reject) => {
          let unlisten = null;
          let pollInterval = null;
          let timeoutId = null;

          const cleanup = () => {
            if (unlisten) unlisten();
            if (pollInterval) clearInterval(pollInterval);
            if (timeoutId) clearTimeout(timeoutId);
          };

          // Listen for event from Rust backend
          listen('google-auth-complete', (event) => {
            cleanup();
            resolve(event.payload);
          }).then((u) => {
            unlisten = u;
          });

          // Fallback: poll for result every second
          pollInterval = setInterval(async () => {
            try {
              const polledResult = await invoke('poll_google_auth_result');
              if (polledResult) {
                cleanup();
                resolve(polledResult);
              }
            } catch (error) {
              console.error('Poll error:', error);
            }
          }, 1000);

          // Timeout after 5 minutes
          timeoutId = setTimeout(() => {
            cleanup();
            reject(new Error('Authentication timeout - please try again'));
          }, 300000);
        });

        if (!result.success) {
          throw new Error('Google authentication failed');
        }

        // Store auth data
        this.token = result.token;
        this.email = result.user.email;
        this.user = result.user;
        this.authProvider = 'google';
        this.isAuthenticated = true;

        console.log('[Auth] Google login successful, user data:', {
          account_type: result.user.account_type,
          owned_organization_id: result.user.owned_organization_id,
          subscription_tier: result.user.subscription?.tier,
        });

        // Store in localStorage for persistence
        localStorage.setItem('auth_token', result.token);
        localStorage.setItem('email', result.user.email || '');
        localStorage.setItem('user', JSON.stringify(result.user));
        localStorage.setItem('auth_provider', 'google');

        // Set user context for database queries and storage paths
        await setUserContext(result.user.id);

        // Emit event to trigger data refresh across the app
        emitAuthStateChanged(result.user.id);

        return { success: true, user: result.user, is_new_user: result.is_new_user === 'true' || result.is_new_user === true };
      } catch (error) {
        this.error = error.message;
        return { success: false, error: error.message };
      } finally {
        this.loading = false;
      }
    },

    // ============================================
    // Email Authentication Methods
    // ============================================

    /**
     * Register a new user with email and password.
     * Sends verification email with OTP code.
     */
    async registerWithEmail(email, password, referralCode = null) {
      this.loading = true;
      this.error = null;

      try {
        const body = { email, password };
        if (referralCode) body.referral_code = referralCode;

        const response = await fetch(`${API_BASE}/api/auth/email/register`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify(body),
        });

        const data = await response.json();

        if (!response.ok || !data.success) {
          throw new Error(data.error || 'Registration failed');
        }

        // Store pending verification email
        this.pendingVerificationEmail = email;
        this.verificationSentAt = Date.now();

        // Start listening for magic link verification (in background)
        this.startEmailVerificationListener();

        return { success: true, message: data.message };
      } catch (error) {
        this.error = error.message;
        return { success: false, error: error.message };
      } finally {
        this.loading = false;
      }
    },

    /**
     * Verify email using 6-digit OTP code.
     */
    async verifyEmailOtp(email, otp) {
      this.loading = true;
      this.error = null;

      try {
        const response = await fetch(`${API_BASE}/api/auth/email/verify-otp`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ email, otp }),
        });

        const data = await response.json();

        if (!response.ok || !data.success) {
          throw new Error(data.error || 'Verification failed');
        }

        // Store auth data
        this.token = data.token;
        this.email = data.user.email;
        this.user = data.user;
        this.authProvider = 'email';
        this.isAuthenticated = true;
        this.pendingVerificationEmail = null;
        this.verificationSentAt = null;

        console.log('[Auth] OTP verification successful, user data:', {
          account_type: data.user.account_type,
          owned_organization_id: data.user.owned_organization_id,
        });

        // Store in localStorage for persistence
        localStorage.setItem('auth_token', data.token);
        localStorage.setItem('email', data.user.email || '');
        localStorage.setItem('user', JSON.stringify(data.user));
        localStorage.setItem('auth_provider', 'email');

        // Set user context for database queries and storage paths
        await setUserContext(data.user.id);

        // Emit event to trigger data refresh across the app
        emitAuthStateChanged(data.user.id);

        return { success: true, user: data.user, is_new_user: !!data.is_new_user };
      } catch (error) {
        this.error = error.message;
        return { success: false, error: error.message };
      } finally {
        this.loading = false;
      }
    },

    /**
     * Login with email and password.
     */
    async loginWithEmail(email, password) {
      this.loading = true;
      this.error = null;

      try {
        const response = await fetch(`${API_BASE}/api/auth/email/login`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ email, password }),
        });

        const data = await response.json();

        if (!response.ok || !data.success) {
          // Check if email not verified
          if (data.code === 'EMAIL_NOT_VERIFIED') {
            this.pendingVerificationEmail = email;
            return { success: false, error: data.error, needsVerification: true };
          }
          throw new Error(data.error || 'Login failed');
        }

        // Store auth data
        this.token = data.token;
        this.email = data.user.email;
        this.user = data.user;
        this.authProvider = 'email';
        this.isAuthenticated = true;

        console.log('[Auth] Login successful, user data:', {
          account_type: data.user.account_type,
          owned_organization_id: data.user.owned_organization_id,
        });

        // Store in localStorage for persistence
        localStorage.setItem('auth_token', data.token);
        localStorage.setItem('email', data.user.email || '');
        localStorage.setItem('user', JSON.stringify(data.user));
        localStorage.setItem('auth_provider', 'email');

        // Set user context for database queries and storage paths
        await setUserContext(data.user.id);

        // Emit event to trigger data refresh across the app
        emitAuthStateChanged(data.user.id);

        return { success: true, user: data.user, is_new_user: !!data.is_new_user };
      } catch (error) {
        this.error = error.message;
        return { success: false, error: error.message };
      } finally {
        this.loading = false;
      }
    },

    /**
     * Resend verification email.
     */
    async resendVerificationEmail(email) {
      this.loading = true;
      this.error = null;

      try {
        const response = await fetch(`${API_BASE}/api/auth/email/resend-verification`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ email }),
        });

        const data = await response.json();

        if (!response.ok || !data.success) {
          throw new Error(data.error || 'Failed to resend verification email');
        }

        this.verificationSentAt = Date.now();

        return { success: true, message: data.message };
      } catch (error) {
        this.error = error.message;
        return { success: false, error: error.message };
      } finally {
        this.loading = false;
      }
    },

    /**
     * Request password reset email.
     */
    async forgotPassword(email) {
      this.loading = true;
      this.error = null;

      try {
        const response = await fetch(`${API_BASE}/api/auth/email/forgot-password`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ email }),
        });

        const data = await response.json();

        if (!response.ok || !data.success) {
          throw new Error(data.error || 'Failed to send reset email');
        }

        return { success: true, message: data.message };
      } catch (error) {
        this.error = error.message;
        return { success: false, error: error.message };
      } finally {
        this.loading = false;
      }
    },

    /**
     * Reset password with token.
     */
    async resetPassword(token, newPassword) {
      this.loading = true;
      this.error = null;

      try {
        const response = await fetch(`${API_BASE}/api/auth/email/reset-password`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ token, password: newPassword }),
        });

        const data = await response.json();

        if (!response.ok || !data.success) {
          throw new Error(data.error || 'Password reset failed');
        }

        return { success: true, message: data.message };
      } catch (error) {
        this.error = error.message;
        return { success: false, error: error.message };
      } finally {
        this.loading = false;
      }
    },

    /**
     * Change user's email address.
     * Requires current password for verification.
     */
    async changeEmail(newEmail, password) {
      this.loading = true;
      this.error = null;

      try {
        const api = await getApi();
        const response = await api.post('/account/change-email', {
          new_email: newEmail,
          password,
        });

        const data = response.data;

        if (!data.success) {
          throw new Error(data.error || 'Failed to change email');
        }

        return { success: true, message: data.message };
      } catch (error) {
        this.error = error.response?.data?.error || error.message;
        return { success: false, error: this.error };
      } finally {
        this.loading = false;
      }
    },

    /**
     * Change user's password.
     * Requires current password for verification.
     */
    async changePassword(currentPassword, newPassword) {
      this.loading = true;
      this.error = null;

      try {
        const api = await getApi();
        const response = await api.post('/account/change-password', {
          current_password: currentPassword,
          new_password: newPassword,
        });

        const data = response.data;

        if (!data.success) {
          throw new Error(data.error || 'Failed to change password');
        }

        return { success: true, message: data.message };
      } catch (error) {
        this.error = error.response?.data?.error || error.message;
        return { success: false, error: this.error };
      } finally {
        this.loading = false;
      }
    },

    /**
     * Verify email change with token.
     */
    async verifyEmailChange(token) {
      this.loading = true;
      this.error = null;

      try {
        const api = await getApi();
        const response = await api.get(`/account/verify-email-change/${token}`);

        const data = response.data;

        if (!data.success) {
          throw new Error(data.error || 'Email verification failed');
        }

        // Update user email in store if verification successful
        if (data.user && this.user) {
          this.user.email = data.user.email;
          this.email = data.user.email;
          localStorage.setItem('email', data.user.email);
          localStorage.setItem('user', JSON.stringify(this.user));
        }

        return { success: true, message: data.message };
      } catch (error) {
        this.error = error.response?.data?.error || error.message;
        return { success: false, error: this.error };
      } finally {
        this.loading = false;
      }
    },

    /**
     * Start listening for magic link email verification.
     * This runs in background while user might also use OTP.
     */
    async startEmailVerificationListener() {
      try {
        // Start the Tauri callback server
        await invoke('start_email_verification_listener');

        // Listen for verification result via Tauri event
        const unlisten = await listen('email-verification-complete', async (event) => {
          const result = event.payload;

          if (result.success && result.token && result.user) {
            // Store auth data from magic link verification
            this.token = result.token;
            this.email = result.user.email;
            this.user = result.user;
            this.authProvider = 'email';
            this.isAuthenticated = true;
            this.pendingVerificationEmail = null;
            this.verificationSentAt = null;

            console.log('[Auth] Magic link verification successful, user data:', {
              account_type: result.user.account_type,
              owned_organization_id: result.user.owned_organization_id,
            });

            // Store in localStorage for persistence
            localStorage.setItem('auth_token', result.token);
            localStorage.setItem('email', result.user.email || '');
            localStorage.setItem('user', JSON.stringify(result.user));
            localStorage.setItem('auth_provider', 'email');

            // Set user context for database queries and storage paths
            await setUserContext(result.user.id);

            // Emit event to trigger data refresh across the app
            emitAuthStateChanged(result.user.id);

            // Emit custom event for UI to react
            window.dispatchEvent(new CustomEvent('email-verified', { detail: result }));
          }

          unlisten();
        });

        // Also poll for result (fallback)
        const pollInterval = setInterval(async () => {
          if (!this.pendingVerificationEmail) {
            clearInterval(pollInterval);
            return;
          }

          try {
            const result = await invoke('poll_email_verification_result');
            if (result && result.success) {
              clearInterval(pollInterval);
              // The event listener above will handle the auth
            }
          } catch (error) {
            console.error('[Auth] Poll email verification error:', error);
          }
        }, 2000);

        // Stop polling after 30 minutes
        setTimeout(
          () => {
            clearInterval(pollInterval);
          },
          30 * 60 * 1000
        );
      } catch (error) {
        console.error('[Auth] Failed to start email verification listener:', error);
      }
    },

    /**
     * Clear pending verification state
     */
    clearPendingVerification() {
      this.pendingVerificationEmail = null;
      this.verificationSentAt = null;
    },

    async getClientId() {
      let clientId = localStorage.getItem('client_id');
      if (!clientId) {
        clientId = crypto.randomUUID();
        localStorage.setItem('client_id', clientId);
      }
      return clientId;
    },

    async logout() {
      this.isAuthenticated = false;
      this.walletAddress = null;
      this.email = null;
      this.token = null;
      this.user = null;
      this.authProvider = null;
      this.pendingVerificationEmail = null;
      this.verificationSentAt = null;
      localStorage.removeItem('auth_token');
      localStorage.removeItem('wallet_address');
      localStorage.removeItem('email');
      localStorage.removeItem('user');
      localStorage.removeItem('auth_provider');

      // Clear user context from database and storage layers
      await clearUserContext();

      // Emit event to trigger data refresh across the app
      emitAuthStateChanged(null);
    },

    async checkAuth() {
      const token = localStorage.getItem('auth_token');
      const walletAddress = localStorage.getItem('wallet_address');
      const email = localStorage.getItem('email');
      const userJson = localStorage.getItem('user');
      const authProvider = localStorage.getItem('auth_provider');

      if (token && userJson) {
        try {
          // Parse user data first (don't set authenticated yet)
          const parsedUser = JSON.parse(userJson);

          // Verify token is still valid before setting authenticated state
          const API_BASE = import.meta.env.VITE_API_URL || 'http://localhost:4000';
          const response = await fetch(`${API_BASE}/api/auth/me`, {
            headers: { Authorization: `Bearer ${token}` },
          });

          if (!response.ok) {
            // Token is invalid - clear stored data
            console.warn('[Auth] Stored token is invalid, clearing auth state');
            localStorage.removeItem('auth_token');
            localStorage.removeItem('wallet_address');
            localStorage.removeItem('email');
            localStorage.removeItem('user');
            localStorage.removeItem('auth_provider');
            return false;
          }

          const data = await response.json();
          if (!data.success || !data.user) {
            console.warn('[Auth] Token validation failed, clearing auth state');
            localStorage.removeItem('auth_token');
            localStorage.removeItem('wallet_address');
            localStorage.removeItem('email');
            localStorage.removeItem('user');
            localStorage.removeItem('auth_provider');
            return false;
          }

          // Token is valid - now set authenticated state
          this.token = token;
          this.walletAddress = walletAddress;
          this.email = email;
          this.user = { ...parsedUser, ...data.user }; // Merge with fresh server data
          this.authProvider = authProvider;
          this.isAuthenticated = true;

          // Update localStorage with fresh user data
          localStorage.setItem('user', JSON.stringify(this.user));

          // Set user context for database queries and storage paths
          if (this.user && this.user.id) {
            await setUserContext(this.user.id);
          }

          return true;
        } catch (error) {
          console.error('[Auth] Failed to verify auth:', error);
          // On network errors, we could either:
          // 1. Clear auth (strict) - user must re-login
          // 2. Use cached data (lenient) - allows offline usage
          // Going with strict for security
          localStorage.removeItem('auth_token');
          localStorage.removeItem('wallet_address');
          localStorage.removeItem('email');
          localStorage.removeItem('user');
          localStorage.removeItem('auth_provider');
          return false;
        }
      }
      return false;
    },

    /**
     * Refresh user data from the server.
     * This ensures account_type and other fields are always up-to-date.
     */
    async refreshUserData() {
      if (!this.token) return;

      try {
        const response = await fetch(`${API_BASE}/api/auth/me`, {
          headers: { Authorization: `Bearer ${this.getAuthToken()}` },
        });

        if (response.ok) {
          const data = await response.json();
          if (data.success && data.user) {
            // Update user data with fresh data from server
            this.user = { ...this.user, ...data.user };
            localStorage.setItem('user', JSON.stringify(this.user));
          }
        } else if (response.status === 401) {
          // Token is invalid/expired, logout
          console.warn('[Auth] Token invalid, logging out');
          await this.logout();
        }
      } catch (error) {
        console.error('[Auth] Failed to refresh user data:', error);
        // Don't logout on network errors - use cached data
      }
    },

    // ============================================
    // Organization Methods
    // ============================================

    /**
     * Set account type (personal or organization)
     */
    async setAccountType(accountType) {
      try {
        // Use axios api instance which handles auth token automatically
        const api = await getApi();
        const response = await api.post('/account/type', { account_type: accountType });

        if (response.data.success) {
          if (this.user) {
            this.user.account_type = response.data.account_type;
            localStorage.setItem('user', JSON.stringify(this.user));
          }
          return { success: true, needsOrgSetup: response.data.needs_org_setup };
        }

        return { success: false, error: response.data.error };
      } catch (error) {
        return { success: false, error: error.response?.data?.error || error.message };
      }
    },

    /**
     * Create a new organization
     */
    async createOrganization(orgData) {
      try {
        const response = await fetch(`${API_BASE}/api/organizations`, {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            Authorization: `Bearer ${this.getAuthToken()}`,
          },
          body: JSON.stringify(orgData),
        });

        const data = await response.json();

        if (data.success) {
          if (this.user) {
            this.user.account_type = 'organization';
            this.user.owned_organization_id = data.organization.id;
            localStorage.setItem('user', JSON.stringify(this.user));
          }
          return { success: true, organization: data.organization };
        }

        return { success: false, error: data.error };
      } catch (error) {
        return { success: false, error: error.message };
      }
    },

    /**
     * Get organization details
     */
    async getOrganization(orgId) {
      try {
        const response = await fetch(`${API_BASE}/api/organizations/${orgId}`, {
          headers: { Authorization: `Bearer ${this.getAuthToken()}` },
        });

        const data = await response.json();
        return data.success ? data : { success: false, error: data.error };
      } catch (error) {
        return { success: false, error: error.message };
      }
    },

    /**
     * Get user's organizations
     */
    async getOrganizations() {
      try {
        // Use axios api instance which handles auth token automatically
        const api = await getApi();
        const response = await api.get('/organizations');
        return response.data.success
          ? response.data
          : { success: false, error: response.data.error };
      } catch (error) {
        return { success: false, error: error.response?.data?.error || error.message };
      }
    },

    /**
     * Update organization
     */
    async updateOrganization(orgId, updates) {
      try {
        const response = await fetch(`${API_BASE}/api/organizations/${orgId}`, {
          method: 'PUT',
          headers: {
            'Content-Type': 'application/json',
            Authorization: `Bearer ${this.getAuthToken()}`,
          },
          body: JSON.stringify(updates),
        });

        const data = await response.json();
        return data.success ? data : { success: false, error: data.error };
      } catch (error) {
        return { success: false, error: error.message };
      }
    },

    /**
     * Delete organization
     */
    async deleteOrganization(orgId) {
      try {
        const response = await fetch(`${API_BASE}/api/organizations/${orgId}`, {
          method: 'DELETE',
          headers: { Authorization: `Bearer ${this.getAuthToken()}` },
        });

        const data = await response.json();

        if (data.success && this.user) {
          this.user.account_type = 'personal';
          this.user.owned_organization_id = null;
          localStorage.setItem('user', JSON.stringify(this.user));
        }

        return data.success ? data : { success: false, error: data.error };
      } catch (error) {
        return { success: false, error: error.message };
      }
    },

    /**
     * Get organization members
     */
    async getOrganizationMembers(orgId) {
      try {
        const response = await fetch(`${API_BASE}/api/organizations/${orgId}/members`, {
          headers: { Authorization: `Bearer ${this.getAuthToken()}` },
        });

        const data = await response.json();
        return data.success ? data : { success: false, error: data.error };
      } catch (error) {
        return { success: false, error: error.message };
      }
    },

    /**
     * Update member role
     */
    async updateOrganizationMemberRole(orgId, userId, role) {
      try {
        const response = await fetch(`${API_BASE}/api/organizations/${orgId}/members/${userId}`, {
          method: 'PUT',
          headers: {
            'Content-Type': 'application/json',
            Authorization: `Bearer ${this.getAuthToken()}`,
          },
          body: JSON.stringify({ role }),
        });

        const data = await response.json();
        return data.success ? data : { success: false, error: data.error };
      } catch (error) {
        return { success: false, error: error.message };
      }
    },

    /**
     * Remove organization member
     */
    async removeOrganizationMember(orgId, userId) {
      try {
        const response = await fetch(`${API_BASE}/api/organizations/${orgId}/members/${userId}`, {
          method: 'DELETE',
          headers: { Authorization: `Bearer ${this.getAuthToken()}` },
        });

        const data = await response.json();
        return data.success ? data : { success: false, error: data.error };
      } catch (error) {
        return { success: false, error: error.message };
      }
    },

    /**
     * Update member account details (admin only)
     */
    async updateOrganizationMemberAccount(orgId, userId, updates) {
      try {
        const response = await fetch(
          `${API_BASE}/api/organizations/${orgId}/members/${userId}/account`,
          {
            method: 'PATCH',
            headers: {
              'Content-Type': 'application/json',
              Authorization: `Bearer ${this.getAuthToken()}`,
            },
            body: JSON.stringify(updates),
          }
        );

        const data = await response.json();
        return data.success ? data : { success: false, error: data.error };
      } catch (error) {
        return { success: false, error: error.message };
      }
    },

    /**
     * Get pending invitations
     */
    async getOrganizationInvitations(orgId) {
      try {
        const response = await fetch(`${API_BASE}/api/organizations/${orgId}/invitations`, {
          headers: { Authorization: `Bearer ${this.getAuthToken()}` },
        });

        const data = await response.json();
        return data.success ? data : { success: false, error: data.error };
      } catch (error) {
        return { success: false, error: error.message };
      }
    },

    /**
     * Invite a member to organization
     */
    async inviteOrganizationMember(orgId, email, role = 'member') {
      try {
        const response = await fetch(`${API_BASE}/api/organizations/${orgId}/invitations`, {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            Authorization: `Bearer ${this.getAuthToken()}`,
          },
          body: JSON.stringify({ email, role }),
        });

        const data = await response.json();
        return data.success ? data : { success: false, error: data.error };
      } catch (error) {
        return { success: false, error: error.message };
      }
    },

    /**
     * Cancel an invitation
     */
    async cancelOrganizationInvitation(orgId, invitationId) {
      try {
        const response = await fetch(
          `${API_BASE}/api/organizations/${orgId}/invitations/${invitationId}`,
          {
            method: 'DELETE',
            headers: { Authorization: `Bearer ${this.getAuthToken()}` },
          }
        );

        const data = await response.json();
        return data.success ? data : { success: false, error: data.error };
      } catch (error) {
        return { success: false, error: error.message };
      }
    },

    /**
     * Resend an invitation email
     */
    async resendOrganizationInvitation(orgId, invitationId) {
      try {
        const response = await fetch(
          `${API_BASE}/api/organizations/${orgId}/invitations/${invitationId}/resend`,
          {
            method: 'POST',
            headers: { Authorization: `Bearer ${this.getAuthToken()}` },
          }
        );

        const data = await response.json();
        return data.success ? data : { success: false, error: data.error };
      } catch (error) {
        return { success: false, error: error.message };
      }
    },

    /**
     * Create a member account directly
     */
    async createOrganizationMember(orgId, email, password, role = 'member', name = '') {
      try {
        const response = await fetch(`${API_BASE}/api/organizations/${orgId}/create-member`, {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            Authorization: `Bearer ${this.getAuthToken()}`,
          },
          body: JSON.stringify({ email, password, role, name: name || undefined }),
        });

        const data = await response.json();
        return data.success ? data : { success: false, error: data.error };
      } catch (error) {
        return { success: false, error: error.message };
      }
    },

    /**
     * Get invitation details (public)
     */
    async getInvitationDetails(token) {
      try {
        const response = await fetch(`${API_BASE}/api/invitations/${token}`);
        const data = await response.json();
        return data.success ? data : { success: false, error: data.error };
      } catch (error) {
        return { success: false, error: error.message };
      }
    },

    /**
     * Accept an invitation
     */
    async acceptInvitation(inviteToken) {
      try {
        const response = await fetch(`${API_BASE}/api/invitations/${inviteToken}/accept`, {
          method: 'POST',
          headers: { Authorization: `Bearer ${this.getAuthToken()}` },
        });

        const data = await response.json();
        return data.success ? data : { success: false, error: data.error };
      } catch (error) {
        return { success: false, error: error.message };
      }
    },

    /**
     * Get organization credits
     */
    async getOrganizationCredits(orgId) {
      try {
        const response = await fetch(`${API_BASE}/api/organizations/${orgId}/credits`, {
          headers: { Authorization: `Bearer ${this.getAuthToken()}` },
        });

        const data = await response.json();
        return data.success ? data : { success: false, error: data.error };
      } catch (error) {
        return { success: false, error: error.message };
      }
    },

    /**
     * Allocate credits to a member
     */
    async allocateOrganizationCredits(orgId, userId, hours) {
      try {
        const response = await fetch(`${API_BASE}/api/organizations/${orgId}/credits/allocate`, {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            Authorization: `Bearer ${this.getAuthToken()}`,
          },
          body: JSON.stringify({ user_id: userId, hours }),
        });

        const data = await response.json();
        return data.success ? data : { success: false, error: data.error };
      } catch (error) {
        return { success: false, error: error.message };
      }
    },

    /**
     * Get organization transaction history
     */
    async getOrganizationTransactions(orgId, options = {}) {
      try {
        const params = new URLSearchParams();
        if (options.limit) params.append('limit', options.limit);
        if (options.offset) params.append('offset', options.offset);

        const url = `${API_BASE}/api/organizations/${orgId}/transactions${params.toString() ? '?' + params.toString() : ''}`;
        const response = await fetch(url, {
          headers: { Authorization: `Bearer ${this.getAuthToken()}` },
        });

        const data = await response.json();
        return data.success ? data : { success: false, error: data.error };
      } catch (error) {
        return { success: false, error: error.message };
      }
    },
  },
});
