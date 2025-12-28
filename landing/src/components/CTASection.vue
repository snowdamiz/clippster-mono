<script setup lang="ts">
import { Download, Shield, Zap, RefreshCw } from 'lucide-vue-next'
</script>

<template>
  <section id="download" class="py-24 relative overflow-hidden">
    <!-- Background - smoother gradient -->
    <div 
      class="absolute inset-0" 
      style="background: linear-gradient(180deg, transparent 0%, rgba(139, 92, 246, 0.02) 20%, rgba(139, 92, 246, 0.04) 40%, rgba(139, 92, 246, 0.03) 60%, rgba(24, 24, 27, 0.3) 80%, rgba(24, 24, 27, 0.5) 100%);"
    />
    <div class="absolute inset-0 bg-grid opacity-30" />
    
    <div class="container relative">
      <div class="max-w-3xl mx-auto">
        <!-- Main CTA card -->
        <div class="card p-10 sm:p-14 text-center relative overflow-hidden border-zinc-800">
          <!-- Glow -->
          <div class="absolute inset-0 glow-accent opacity-40" />
          
          <!-- Corner accents -->
          <div class="absolute top-0 left-0 w-24 h-24 border-l-2 border-t-2 border-violet-500/30 rounded-tl-2xl" />
          <div class="absolute bottom-0 right-0 w-24 h-24 border-r-2 border-b-2 border-violet-500/30 rounded-br-2xl" />
          
          <div class="relative">
            <!-- Icon -->
            <div class="w-16 h-16 rounded-2xl bg-violet-500/10 border border-violet-500/20 flex items-center justify-center mx-auto mb-8">
              <Download class="w-8 h-8 text-violet-400" />
            </div>
            
            <h2 class="text-3xl sm:text-4xl lg:text-5xl font-bold text-white mb-5 leading-tight font-display">
              Ready to Create <span class="gradient-text">Better Clips</span>?
            </h2>
            
            <p class="text-lg text-zinc-400 mb-10 max-w-xl mx-auto">
              Download Clippster and transform your content workflow today. Start with free credits, no payment required.
            </p>

            <!-- Download buttons -->
            <div class="flex flex-col sm:flex-row gap-3 justify-center mb-10">
              <a href="#" class="btn-primary px-8 py-4 text-base">
                <svg class="w-5 h-5" viewBox="0 0 24 24" fill="currentColor">
                  <path d="M3 5.5A2.5 2.5 0 015.5 3h13A2.5 2.5 0 0121 5.5v13a2.5 2.5 0 01-2.5 2.5h-13A2.5 2.5 0 013 18.5v-13zM5.5 5a.5.5 0 00-.5.5v13a.5.5 0 00.5.5h13a.5.5 0 00.5-.5v-13a.5.5 0 00-.5-.5h-13z"/>
                  <path d="M10 17V7l6 5-6 5z"/>
                </svg>
                Download for Windows
              </a>
              <a href="#" class="btn-secondary px-8 py-4 text-base">
                <svg class="w-5 h-5" viewBox="0 0 24 24" fill="currentColor">
                  <path d="M18.71 19.5c-.83 1.24-1.71 2.45-3.05 2.47-1.34.03-1.77-.79-3.29-.79-1.53 0-2 .77-3.27.82-1.31.05-2.3-1.32-3.14-2.53C4.25 17 2.94 12.45 4.7 9.39c.87-1.52 2.43-2.48 4.12-2.51 1.28-.02 2.5.87 3.29.87.78 0 2.26-1.07 3.81-.91.65.03 2.47.26 3.64 1.98-.09.06-2.17 1.28-2.15 3.81.03 3.02 2.65 4.03 2.68 4.04-.03.07-.42 1.44-1.38 2.83M13 3.5c.73-.83 1.94-1.46 2.94-1.5.13 1.17-.34 2.35-1.04 3.19-.69.85-1.83 1.51-2.95 1.42-.15-1.15.41-2.35 1.05-3.11z"/>
                </svg>
                Download for macOS
              </a>
            </div>

            <!-- Trust badges -->
            <div class="flex flex-wrap justify-center gap-6 text-sm text-zinc-500">
              <span class="flex items-center gap-2">
                <div class="w-5 h-5 rounded-full bg-emerald-500/20 flex items-center justify-center">
                  <Shield class="w-3 h-3 text-emerald-400" />
                </div>
                Secure & Private
              </span>
              <span class="flex items-center gap-2">
                <div class="w-5 h-5 rounded-full bg-emerald-500/20 flex items-center justify-center">
                  <Zap class="w-3 h-3 text-emerald-400" />
                </div>
                Fast & Lightweight
              </span>
              <span class="flex items-center gap-2">
                <div class="w-5 h-5 rounded-full bg-emerald-500/20 flex items-center justify-center">
                  <RefreshCw class="w-3 h-3 text-emerald-400" />
                </div>
                Auto Updates
              </span>
            </div>
          </div>
        </div>
        
        <!-- Version info -->
        <div class="text-center mt-6">
          <p class="text-sm text-zinc-600">
            Latest version: <span class="text-zinc-400 font-mono">v1.0.0</span> • 
            Requires Windows 10+ or macOS 11+
          </p>
        </div>
      </div>
    </div>
  </section>
</template>
