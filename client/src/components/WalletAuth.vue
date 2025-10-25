<template>
  <div class="flex items-center justify-center min-h-[calc(100vh-12rem)]">
    <!-- Not Authenticated - Login Card -->
    <div v-if="!authStore.isAuthenticated" class="w-full max-w-md">
      <div class="relative overflow-hidden rounded-2xl border border-border/50 bg-card backdrop-blur-sm">
        <!-- Gradient overlay -->
        <div class="absolute inset-0 bg-gradient-to-br from-primary/5 via-transparent to-purple-500/5 pointer-events-none" />
        
        <div class="relative p-8">
          <!-- Icon -->
          <div class="flex justify-center mb-6">
            <div class="p-4 rounded-full bg-primary/10 ring-1 ring-primary/20">
              <svg xmlns="http://www.w3.org/2000/svg" class="h-12 w-12 text-primary" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path stroke-linecap="round" stroke-linejoin="round" stroke-width="1.5" d="M21 12a2.25 2.25 0 00-2.25-2.25H15a3 3 0 11-6 0H5.25A2.25 2.25 0 003 12m18 0v6a2.25 2.25 0 01-2.25 2.25H5.25A2.25 2.25 0 013 18v-6m18 0V9M3 12V9m18 0a2.25 2.25 0 00-2.25-2.25H5.25A2.25 2.25 0 003 9m18 0V6a2.25 2.25 0 00-2.25-2.25H5.25A2.25 2.25 0 003 6v3" />
              </svg>
            </div>
          </div>

          <!-- Title -->
          <div class="text-center mb-8">
            <h2 class="text-2xl font-bold text-foreground mb-2">Connect Your Wallet</h2>
            <p class="text-muted-foreground text-sm">Sign in securely with your Phantom wallet to access Clippster</p>
          </div>

          <!-- Connect Button -->
          <button
            @click="connectWallet"
            :disabled="authStore.loading"
            class="w-full group relative overflow-hidden rounded-lg bg-gradient-to-r from-purple-600 to-indigo-600 p-[1px] transition-all hover:shadow-lg hover:shadow-purple-500/50 disabled:opacity-50 disabled:cursor-not-allowed disabled:hover:shadow-none"
          >
            <div class="relative rounded-lg bg-gradient-to-r from-purple-600 to-indigo-600 px-6 py-3 transition-all group-hover:from-purple-500 group-hover:to-indigo-500">
              <span class="flex items-center justify-center gap-2 font-semibold text-white">
                <svg v-if="!authStore.loading" class="h-5 w-5" viewBox="0 0 24 24" fill="currentColor">
                  <path d="M6.5 2h11c1.1 0 2 .9 2 2v16c0 1.1-.9 2-2 2h-11c-1.1 0-2-.9-2-2V4c0-1.1.9-2 2-2zm0 2v16h11V4h-11zm2 2h7v2h-7V6zm0 4h7v2h-7v-2zm0 4h4v2h-4v-2z"/>
                </svg>
                <svg v-else class="h-5 w-5 animate-spin" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24">
                  <circle class="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" stroke-width="4"></circle>
                  <path class="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path>
                </svg>
                {{ authStore.loading ? 'Connecting...' : 'Connect Phantom Wallet' }}
              </span>
            </div>
          </button>

          <!-- Error Message -->
          <div v-if="authStore.error" class="mt-4 rounded-lg bg-destructive/10 border border-destructive/20 p-4">
            <div class="flex items-start gap-3">
              <svg class="h-5 w-5 text-destructive flex-shrink-0 mt-0.5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z" />
              </svg>
              <p class="text-sm text-destructive">{{ authStore.error }}</p>
            </div>
          </div>

          <!-- Info Section -->
          <div class="mt-6 pt-6 border-t border-border/50">
            <p class="text-xs text-muted-foreground text-center">
              Don't have Phantom? 
              <a href="https://phantom.app/" target="_blank" rel="noopener noreferrer" class="text-primary hover:underline">
                Download here
              </a>
            </p>
          </div>
        </div>
      </div>
    </div>

    <!-- Authenticated - Connected Card -->
    <div v-else class="w-full max-w-md">
      <div class="relative overflow-hidden rounded-2xl border border-primary/30 bg-card backdrop-blur-sm">
        <!-- Success gradient overlay -->
        <div class="absolute inset-0 bg-gradient-to-br from-green-500/10 via-transparent to-primary/10 pointer-events-none" />
        
        <div class="relative p-8">
          <!-- Success Icon -->
          <div class="flex justify-center mb-6">
            <div class="p-4 rounded-full bg-green-500/10 ring-1 ring-green-500/20">
              <svg xmlns="http://www.w3.org/2000/svg" class="h-12 w-12 text-green-500" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z" />
              </svg>
            </div>
          </div>

          <!-- Title -->
          <div class="text-center mb-8">
            <h3 class="text-2xl font-bold text-foreground mb-2">Connected Successfully</h3>
            <p class="text-muted-foreground text-sm mb-4">Your wallet is connected to Clippster</p>
            
            <!-- Wallet Address Badge -->
            <div class="inline-flex items-center gap-2 px-4 py-2 rounded-full bg-primary/10 border border-primary/20">
              <div class="h-2 w-2 rounded-full bg-green-500 animate-pulse" />
              <span class="font-mono text-sm font-medium text-primary">{{ formatAddress(authStore.walletAddress) }}</span>
            </div>
          </div>

          <!-- Disconnect Button -->
          <button
            @click="disconnect"
            class="w-full group relative overflow-hidden rounded-lg bg-destructive/10 border border-destructive/20 px-6 py-3 transition-all hover:bg-destructive hover:border-destructive"
          >
            <span class="flex items-center justify-center gap-2 font-semibold text-destructive group-hover:text-white transition-colors">
              <svg class="h-5 w-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M17 16l4-4m0 0l-4-4m4 4H7m6 4v1a3 3 0 01-3 3H6a3 3 0 01-3-3V7a3 3 0 013-3h4a3 3 0 013 3v1" />
              </svg>
              Disconnect Wallet
            </span>
          </button>
        </div>
      </div>
    </div>
  </div>
</template>

<script setup>
import { useAuthStore } from '../stores/auth'
import { onMounted } from 'vue'

const authStore = useAuthStore()

const connectWallet = async () => {
  const result = await authStore.authenticateWithWallet()
  if (result.success) {
    console.log('Authentication successful!')
  }
}

const disconnect = () => {
  authStore.logout()
}

const formatAddress = (address) => {
  if (!address) return ''
  return `${address.slice(0, 6)}...${address.slice(-4)}`
}

onMounted(() => {
  // Check if already authenticated
  authStore.checkAuth()
})
</script>
