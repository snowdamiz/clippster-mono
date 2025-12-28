<script setup lang="ts">
import { Link, Sparkles, Sliders, Upload, Zap, Clock } from 'lucide-vue-next'

const steps = [
  {
    number: '01',
    title: 'Connect Your Stream',
    description: 'Import VODs from Kick, YouTube, Twitch, or PumpFun, or watch live streams directly with DVR capabilities.',
    icon: Link,
  },
  {
    number: '02',
    title: 'AI Detects Best Moments',
    description: 'Our AI analyzes audio, visuals, and context to identify the most engaging, clip-worthy moments automatically.',
    icon: Sparkles,
  },
  {
    number: '03',
    title: 'Edit & Customize',
    description: 'Fine-tune clips in the built-in editor. Add subtitles, adjust aspect ratios, apply filters, and add watermarks.',
    icon: Sliders,
  },
  {
    number: '04',
    title: 'Export & Share',
    description: 'Export polished clips in any format. Ready for TikTok, YouTube Shorts, Instagram Reels, and more.',
    icon: Upload,
  }
]
</script>

<template>
  <section id="how-it-works" class="py-24 relative overflow-hidden">
    <!-- Background -->
    <div class="absolute inset-0 glow-accent opacity-30" />
    
    <div class="container relative">
      <!-- Header -->
      <div class="text-center mb-16">
        <div class="section-label">
          <Zap class="w-3.5 h-3.5" />
          <span>Simple Workflow</span>
        </div>
        <h2 class="section-heading">
          From Stream to <span class="gradient-text">Viral Clip</span>
        </h2>
        <p class="section-subheading mx-auto">
          Our streamlined workflow turns hours of content into share-ready clips in minutes.
        </p>
      </div>

      <!-- Steps grid -->
      <div class="grid md:grid-cols-2 lg:grid-cols-4 gap-6 mb-16">
        <div 
          v-for="(step, index) in steps" 
          :key="step.number"
          class="group"
        >
          <div class="card p-6 h-full relative overflow-hidden transition-all duration-200 hover:border-zinc-700">
            <!-- Step number -->
            <div class="absolute top-4 right-4 text-4xl font-bold text-zinc-800/50 font-display">
              {{ step.number }}
            </div>
            
            <!-- Icon -->
            <div class="feature-icon mb-5">
              <component :is="step.icon" class="w-5 h-5 text-violet-400" />
            </div>
            
            <!-- Content -->
            <h3 class="text-lg font-semibold text-white mb-2">{{ step.title }}</h3>
            <p class="text-sm text-zinc-400 leading-relaxed">{{ step.description }}</p>
            
            <!-- Connection line for desktop -->
            <div 
              v-if="index < steps.length - 1" 
              class="hidden lg:block absolute top-1/2 -right-3 w-6 h-px bg-gradient-to-r from-zinc-700 to-transparent"
            />
          </div>
        </div>
      </div>

      <!-- Visual workflow -->
      <div class="flex justify-center">
        <div class="inline-flex items-center gap-4 px-6 py-4 rounded-2xl bg-zinc-900/50 border border-zinc-800">
          <!-- Input -->
          <div class="flex items-center gap-3">
            <div class="w-12 h-12 rounded-xl bg-zinc-800 flex items-center justify-center relative">
              <span class="absolute -top-1 -right-1 flex h-2.5 w-2.5">
                <span class="animate-ping absolute inline-flex h-full w-full rounded-full bg-red-400 opacity-75"></span>
                <span class="relative inline-flex rounded-full h-2.5 w-2.5 bg-red-500"></span>
              </span>
              <svg class="w-5 h-5 text-zinc-400" fill="currentColor" viewBox="0 0 20 20">
                <path d="M6.3 2.84A1.5 1.5 0 004 4.11v11.78a1.5 1.5 0 002.3 1.27l9.344-5.891a1.5 1.5 0 000-2.538L6.3 2.84z"/>
              </svg>
            </div>
            <div class="text-left">
              <div class="text-sm text-zinc-300 font-medium">4hr Stream</div>
              <div class="text-xs text-zinc-500">Live</div>
            </div>
          </div>
          
          <!-- Arrow -->
          <div class="flex items-center gap-2">
            <div class="w-12 h-px bg-gradient-to-r from-zinc-700 to-violet-500/50" />
            <svg class="w-4 h-4 text-violet-400" fill="none" viewBox="0 0 24 24" stroke="currentColor" stroke-width="2">
              <path stroke-linecap="round" stroke-linejoin="round" d="M9 5l7 7-7 7" />
            </svg>
          </div>
          
          <!-- Processing -->
          <div class="flex items-center gap-3">
            <div class="w-12 h-12 rounded-xl bg-violet-500/20 border border-violet-500/30 flex items-center justify-center">
              <Sparkles class="w-5 h-5 text-violet-400" />
            </div>
            <div class="text-left">
              <div class="text-sm text-zinc-300 font-medium">AI Analysis</div>
              <div class="text-xs text-violet-400">Processing...</div>
            </div>
          </div>
          
          <!-- Arrow -->
          <div class="flex items-center gap-2">
            <div class="w-12 h-px bg-gradient-to-r from-violet-500/50 to-emerald-500/50" />
            <svg class="w-4 h-4 text-emerald-400" fill="none" viewBox="0 0 24 24" stroke="currentColor" stroke-width="2">
              <path stroke-linecap="round" stroke-linejoin="round" d="M9 5l7 7-7 7" />
            </svg>
          </div>
          
          <!-- Output -->
          <div class="flex items-center gap-3">
            <div class="w-12 h-12 rounded-xl bg-emerald-500/20 border border-emerald-500/30 flex items-center justify-center">
              <svg class="w-5 h-5 text-emerald-400" fill="none" viewBox="0 0 24 24" stroke="currentColor" stroke-width="2">
                <path stroke-linecap="round" stroke-linejoin="round" d="M5 13l4 4L19 7" />
              </svg>
            </div>
            <div class="text-left">
              <div class="text-sm text-white font-semibold">12 Clips</div>
              <div class="text-xs text-emerald-400">Ready!</div>
            </div>
          </div>
        </div>
      </div>
      
      <!-- Time saved -->
      <div class="mt-6 flex justify-center">
        <div class="inline-flex items-center gap-2 px-4 py-2 rounded-full bg-emerald-500/10 border border-emerald-500/20">
          <Clock class="w-4 h-4 text-emerald-400" />
          <span class="text-sm text-emerald-300">Save <span class="font-semibold">3+ hours</span> per stream</span>
        </div>
      </div>
    </div>
  </section>
</template>
