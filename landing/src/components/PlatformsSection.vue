<script setup lang="ts">
import { Link2, Check } from 'lucide-vue-next'

const platforms = [
  { 
    name: 'Kick', 
    color: '#53FC18',
    description: 'Full VOD & live support',
    features: ['VOD Downloads', 'Live DVR', 'Clip Detection']
  },
  { 
    name: 'YouTube', 
    color: '#FF0000',
    description: 'Videos & livestreams',
    features: ['Video Downloads', 'Live Streams', 'Chapters Support']
  },
  { 
    name: 'Twitch', 
    color: '#9146FF',
    description: 'VODs & highlights',
    features: ['VOD Downloads', 'Clip Import', 'Chat Integration']
  },
  { 
    name: 'PumpFun', 
    color: '#10B981',
    description: 'Web3 streaming',
    features: ['Live Streams', 'Token Clips', 'Real-time Detection']
  },
]

const benefits = [
  {
    title: 'One-Click VOD Import',
    description: 'Just paste the URL and Clippster handles the rest. Download entire VODs or specific time ranges.'
  },
  {
    title: 'Live Stream DVR',
    description: 'Watch live with full DVR capabilities. Rewind, pause, and clip moments as they happen.'
  },
  {
    title: 'Cross-Platform Projects',
    description: 'Mix content from different platforms in a single project. Perfect for multi-stream highlights.'
  }
]
</script>

<template>
  <section id="platforms" class="py-24 relative overflow-hidden">
    <!-- Background -->
    <div class="absolute inset-0 glow-accent opacity-20" />
    
    <div class="container relative">
      <div class="grid lg:grid-cols-2 gap-16 items-center">
        <!-- Content -->
        <div>
          <div class="section-label">
            <Link2 class="w-3.5 h-3.5" />
            <span>Platform Integrations</span>
          </div>
          <h2 class="section-heading">
            Works With <span class="gradient-text">All Major Platforms</span>
          </h2>
          <p class="section-subheading mb-10">
            Download VODs, watch live streams with DVR rewind, and detect clips from the platforms you already use.
          </p>
          
          <!-- Benefits -->
          <div class="space-y-4">
            <div 
              v-for="benefit in benefits"
              :key="benefit.title"
              class="flex items-start gap-4"
            >
              <div class="w-8 h-8 rounded-lg bg-emerald-500/10 border border-emerald-500/20 flex items-center justify-center flex-shrink-0">
                <Check class="w-4 h-4 text-emerald-400" />
              </div>
              <div>
                <h4 class="font-semibold text-white mb-1">{{ benefit.title }}</h4>
                <p class="text-sm text-zinc-400">{{ benefit.description }}</p>
              </div>
            </div>
          </div>
        </div>
        
        <!-- Platform cards -->
        <div class="grid grid-cols-2 gap-4">
          <div 
            v-for="platform in platforms"
            :key="platform.name"
            class="card p-5 transition-all duration-200 hover:border-zinc-700"
          >
            <!-- Platform icon -->
            <div 
              class="w-12 h-12 rounded-xl flex items-center justify-center mb-4"
              :style="{ backgroundColor: `${platform.color}15` }"
            >
              <!-- Kick -->
              <svg v-if="platform.name === 'Kick'" class="w-6 h-6" viewBox="0 0 933 300" :fill="platform.color">
                <path fill-rule="evenodd" clip-rule="evenodd" d="M0 0H100V66.6667H133.333V33.3333H166.667V0H266.667V100H233.333V133.333H200V166.667H233.333V200H266.667V300H166.667V266.667H133.333V233.333H100V300H0V0ZM666.667 0H766.667V66.6667H800V33.3333H833.333V0H933.333V100H900V133.333H866.667V166.667H900V200H933.333V300H833.333V266.667H800V233.333H766.667V300H666.667V0ZM300 0H400V300H300V0ZM533.333 0H466.667V33.3333H433.333V266.667H466.667V300H533.333H633.333V200H533.333V100H633.333V0H533.333Z"/>
              </svg>
              
              <!-- YouTube -->
              <svg v-else-if="platform.name === 'YouTube'" class="w-6 h-6" viewBox="0 0 24 24" :fill="platform.color">
                <path d="M23.498 6.186a3.016 3.016 0 0 0-2.122-2.136C19.505 3.545 12 3.545 12 3.545s-7.505 0-9.377.505A3.017 3.017 0 0 0 .502 6.186C0 8.07 0 12 0 12s0 3.93.502 5.814a3.016 3.016 0 0 0 2.122 2.136c1.871.505 9.376.505 9.376.505s7.505 0 9.377-.505a3.015 3.015 0 0 0 2.122-2.136C24 15.93 24 12 24 12s0-3.93-.502-5.814zM9.545 15.568V8.432L15.818 12l-6.273 3.568z"/>
              </svg>
              
              <!-- Twitch -->
              <svg v-else-if="platform.name === 'Twitch'" class="w-6 h-6" viewBox="0 0 24 24" :fill="platform.color">
                <path d="M11.571 4.714h1.715v5.143H11.57zm4.715 0H18v5.143h-1.714zM6 0L1.714 4.286v15.428h5.143V24l4.286-4.286h3.428L22.286 12V0zm14.571 11.143l-3.428 3.428h-3.429l-3 3v-3H6.857V1.714h13.714Z"/>
              </svg>
              
              <!-- PumpFun -->
              <svg v-else-if="platform.name === 'PumpFun'" class="w-6 h-6" viewBox="0 0 24 24" :fill="platform.color">
                <path d="M8.434 20.566c1.335 0 2.591-.52 3.535-1.464l7.134-7.133a5.008 5.008 0 0 0-.001-7.072 4.969 4.969 0 0 0-3.536-1.463c-1.335 0-2.59.52-3.534 1.464l-7.134 7.133a5.01 5.01 0 0 0-.001 7.072 4.971 4.971 0 0 0 3.537 1.463zm5.011-14.254a2.979 2.979 0 0 1 2.12-.878c.802 0 1.556.312 2.122.878a3.004 3.004 0 0 1 .001 4.243l-2.893 2.892-4.242-4.244 2.892-2.891z"/>
              </svg>
            </div>
            
            <!-- Platform info -->
            <h3 class="text-lg font-semibold text-white mb-1">{{ platform.name }}</h3>
            <p class="text-sm text-zinc-500 mb-4">{{ platform.description }}</p>
            
            <!-- Features -->
            <div class="flex flex-wrap gap-1.5">
              <span 
                v-for="feature in platform.features" 
                :key="feature"
                class="px-2 py-0.5 bg-zinc-800/50 rounded text-[10px] text-zinc-400"
              >
                {{ feature }}
              </span>
            </div>
          </div>
        </div>
      </div>
    </div>
  </section>
</template>
