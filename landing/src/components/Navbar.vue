<script setup lang="ts">
import { ref, onMounted, onUnmounted } from 'vue'
import { Download, Menu, X } from 'lucide-vue-next'

const scrolled = ref(false)
const mobileMenuOpen = ref(false)

function handleScroll() {
  scrolled.value = window.scrollY > 20
}

onMounted(() => {
  window.addEventListener('scroll', handleScroll)
})

onUnmounted(() => {
  window.removeEventListener('scroll', handleScroll)
})
</script>

<template>
  <nav 
    class="fixed top-0 left-0 right-0 z-50 transition-all duration-300"
    :class="scrolled 
      ? 'py-3 bg-background/90 backdrop-blur-xl border-b border-border/50' 
      : 'py-5 bg-transparent'"
  >
    <div class="container">
      <div class="flex items-center justify-between">
        <!-- Logo -->
        <a href="#" class="flex items-center gap-2.5">
          <img src="@/assets/logo.svg" alt="Clippster" class="h-7" />
        </a>

        <!-- Desktop Navigation -->
        <div class="hidden md:flex items-center gap-8">
          <a href="#features" class="text-sm text-zinc-400 hover:text-white transition-colors">Features</a>
          <a href="#how-it-works" class="text-sm text-zinc-400 hover:text-white transition-colors">How It Works</a>
          <a href="#platforms" class="text-sm text-zinc-400 hover:text-white transition-colors">Platforms</a>
          <a href="#pricing" class="text-sm text-zinc-400 hover:text-white transition-colors">Pricing</a>
        </div>

        <!-- CTA Button -->
        <div class="flex items-center gap-3">
          <a href="#download" class="hidden sm:inline-flex btn-primary py-2.5 px-5">
            <Download class="w-4 h-4" />
            <span>Download</span>
          </a>
          
          <!-- Mobile menu button -->
          <button 
            @click="mobileMenuOpen = !mobileMenuOpen"
            class="md:hidden p-2 text-zinc-400 hover:text-white rounded-lg hover:bg-white/5 transition-colors"
          >
            <Menu v-if="!mobileMenuOpen" class="w-5 h-5" />
            <X v-else class="w-5 h-5" />
          </button>
        </div>
      </div>
      
      <!-- Mobile Navigation -->
      <div 
        v-if="mobileMenuOpen"
        class="md:hidden mt-4 pb-4 border-t border-border pt-4 space-y-1"
      >
        <a href="#features" class="block px-3 py-2 text-sm text-zinc-400 hover:text-white hover:bg-white/5 rounded-lg transition-colors">Features</a>
        <a href="#how-it-works" class="block px-3 py-2 text-sm text-zinc-400 hover:text-white hover:bg-white/5 rounded-lg transition-colors">How It Works</a>
        <a href="#platforms" class="block px-3 py-2 text-sm text-zinc-400 hover:text-white hover:bg-white/5 rounded-lg transition-colors">Platforms</a>
        <a href="#pricing" class="block px-3 py-2 text-sm text-zinc-400 hover:text-white hover:bg-white/5 rounded-lg transition-colors">Pricing</a>
        <a href="#download" class="block btn-primary text-center mt-3">
          <Download class="w-4 h-4" />
          Download Free
        </a>
      </div>
    </div>
  </nav>
</template>
