<script setup lang="ts">
import { onMounted } from 'vue'
import { Toaster } from '@/components/ui/sonner'
import WalletAuth from '@/components/WalletAuth.vue'

// Ensure dark mode is always applied
onMounted(() => {
  document.documentElement.classList.add('dark')
  document.body.classList.add('dark')
})
</script>

<template>
  <div class="min-h-screen bg-background text-foreground">
    <!-- Toast notifications provider -->
    <Toaster position="bottom-right" />
    
    <!-- Main content -->
    <div class="container mx-auto p-6">
      <!-- Wallet Authentication -->
      <WalletAuth />
    </div>
  </div>
</template>

<style scoped>
</style>
