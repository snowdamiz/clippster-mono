<template>
  <header class="h-16 px-8 flex items-center justify-between border-b border-border/40 bg-background">
    <nav class="flex items-center gap-2 text-sm">
      <span class="text-muted-foreground">Dashboard</span>
      <svg xmlns="http://www.w3.org/2000/svg" class="h-3.5 w-3.5 text-muted-foreground/50" fill="none" viewBox="0 0 24 24" stroke="currentColor">
        <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M9 5l7 7-7 7" />
      </svg>
      <span class="text-foreground capitalize">{{ currentPageTitle }}</span>
    </nav>
    
    <div class="flex items-center gap-4">
      <!-- Global Search -->
      <div class="relative">
        <svg xmlns="http://www.w3.org/2000/svg" class="h-4 w-4 text-muted-foreground absolute left-3 top-1/2 -translate-y-1/2" fill="none" viewBox="0 0 24 24" stroke="currentColor">
          <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z" />
        </svg>
        <input 
          type="text" 
          placeholder="Search..." 
          class="pl-9 pr-4 py-2 bg-background border border-border rounded-lg focus:outline-none focus:border-foreground/30 w-64 text-sm"
        >
      </div>

      <!-- Credit Balance -->
      <router-link 
        to="/dashboard/pricing" 
        class="flex items-center gap-2 px-4 py-2 bg-gradient-to-r from-purple-600 to-indigo-600 rounded-lg hover:from-purple-700 hover:to-indigo-700 transition-all cursor-pointer shadow-sm hover:shadow-md"
        title="View Pricing & Purchase Credits"
      >
        <svg xmlns="http://www.w3.org/2000/svg" class="h-4 w-4 text-white" fill="none" viewBox="0 0 24 24" stroke="currentColor">
          <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M12 8v4l3 3m6-3a9 9 0 11-18 0 9 9 0 0118 0z" />
        </svg>
        <span class="text-sm font-semibold text-white" v-if="!loadingBalance">
          {{ hoursRemaining }} {{ hoursRemaining === 1 ? 'hr' : 'hrs' }}
        </span>
        <span class="text-sm font-semibold text-white" v-else>
          <span class="animate-pulse">Loading...</span>
        </span>
      </router-link>
    </div>
  </header>
</template>

<script setup lang="ts">
import { computed, ref, onMounted } from 'vue'
import { useRoute } from 'vue-router'
import { useAuthStore } from '@/stores/auth'

const route = useRoute()
const authStore = useAuthStore()
const API_BASE = import.meta.env.VITE_API_URL || 'http://localhost:4000'

const hoursRemaining = ref(0)
const loadingBalance = ref(false)

const currentPageTitle = computed(() => {
  const path = route.path.split('/').pop()
  return path || 'Dashboard'
})

async function fetchBalance() {
  if (!authStore.token) return
  
  loadingBalance.value = true
  try {
    const response = await fetch(`${API_BASE}/api/credits/balance`, {
      headers: {
        'Authorization': `Bearer ${authStore.token}`,
        'Content-Type': 'application/json'
      }
    })
    
    if (response.ok) {
      const data = await response.json()
      if (data.success) {
        hoursRemaining.value = parseFloat(data.balance.hours_remaining.toFixed(1))
      }
    }
  } catch (error) {
    console.error('Failed to fetch balance:', error)
  } finally {
    loadingBalance.value = false
  }
}

onMounted(() => {
  fetchBalance()
  // Refresh balance every 30 seconds
  setInterval(fetchBalance, 30000)
})
</script>
