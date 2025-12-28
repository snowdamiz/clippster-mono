<script setup lang="ts">
import logoIcon from '@/assets/logo-icon.svg'
import kickIcon from '@/assets/platforms/kick.svg'
import twitchIcon from '@/assets/platforms/twitch.svg'
import youtubeIcon from '@/assets/platforms/youtube.svg'
import { Download, Play, Check, Sparkles, Users, FolderOpen, Scissors, Wifi, Film, Image, Clock, BarChart3 } from 'lucide-vue-next'
import { ref, onMounted, onUnmounted, computed } from 'vue'

const platformIcons: Record<string, string> = {
  Kick: kickIcon,
  Twitch: twitchIcon,
  YouTube: youtubeIcon,
}

const platformColors: Record<string, string> = {
  Kick: '#53FC18',
  Twitch: '#9146FF',
  YouTube: '#FF0000',
  PumpFun: '#00D1FF',
}

const mockCreators = [
  {
    name: 'ShadowFox',
    avatar: 'S',
    avatarGradient: 'from-violet-600 to-purple-700',
    platforms: ['Kick', 'YouTube'],
    status: 'live',
    isMonitoring: true,
    viewers: '12.4K',
    thumbnail: 'from-rose-900/40 via-violet-900/30 to-indigo-900/40',
    game: 'GTA V RP',
  },
  {
    name: 'CryptoKing',
    avatar: 'C',
    avatarGradient: 'from-emerald-600 to-teal-700',
    platforms: ['PumpFun'],
    status: 'live',
    isMonitoring: true,
    viewers: '8.2K',
    thumbnail: 'from-cyan-900/40 via-emerald-900/30 to-teal-900/40',
    game: 'Just Chatting',
  },
  {
    name: 'LunaPlays',
    avatar: 'L',
    avatarGradient: 'from-pink-600 to-rose-700',
    platforms: ['Twitch', 'YouTube'],
    status: 'offline',
    isMonitoring: false,
    viewers: null,
    thumbnail: 'from-zinc-800 to-zinc-900',
    game: 'Valorant',
  }
]

const liveAnimation = ref(true)
let liveInterval: ReturnType<typeof setInterval> | null = null

const currentTime = ref(new Date())
const formattedTime = computed(() => {
  return currentTime.value.toLocaleTimeString('en-US', { 
    hour: '2-digit', 
    minute: '2-digit',
    hour12: false 
  })
})

onMounted(() => {
  liveInterval = setInterval(() => {
    liveAnimation.value = !liveAnimation.value
    currentTime.value = new Date()
  }, 1000)
})

onUnmounted(() => {
  if (liveInterval) clearInterval(liveInterval)
})
</script>

<template>
  <section class="relative min-h-screen flex items-center pt-24 pb-20 overflow-hidden">
    <!-- Background -->
    <div class="absolute inset-0 bg-grid opacity-40" />
    <div class="absolute inset-0 glow-top" />
    
    <!-- Accent orbs -->
    <div 
      class="absolute top-1/4 left-1/4 w-[700px] h-[700px] rounded-full pointer-events-none"
      style="background: radial-gradient(circle, rgba(139, 92, 246, 0.08) 0%, rgba(139, 92, 246, 0.04) 35%, rgba(139, 92, 246, 0.01) 60%, transparent 80%);"
    />
    <div 
      class="absolute bottom-1/4 right-1/4 w-[600px] h-[600px] rounded-full pointer-events-none"
      style="background: radial-gradient(circle, rgba(6, 182, 212, 0.06) 0%, rgba(6, 182, 212, 0.03) 35%, rgba(6, 182, 212, 0.01) 60%, transparent 80%);"
    />
    
    <div class="container relative z-10">
      <div class="max-w-4xl mx-auto text-center mb-16">
        <!-- Badge -->
        <div class="section-label">
          <Sparkles class="w-3.5 h-3.5" />
          <span>AI-Powered Clip Detection</span>
        </div>

        <!-- Headline -->
        <h1 class="font-display text-5xl sm:text-6xl lg:text-7xl font-bold text-white mb-6 leading-[1.1] tracking-tight">
          Turn Hours of Streams<br>
          <span class="gradient-text">Into Viral Clips</span>
        </h1>

        <!-- Subheadline -->
        <p class="text-lg sm:text-xl text-zinc-400 mb-10 max-w-2xl mx-auto leading-relaxed">
          AI automatically detects the best moments from your streams. 
          Edit, customize, and export — all from one powerful desktop app.
        </p>

        <!-- CTA Buttons -->
        <div class="flex flex-col sm:flex-row gap-3 justify-center mb-12">
          <a href="#download" class="btn-primary px-8 py-3.5 text-base">
            <Download class="w-5 h-5" />
            Download for Free
          </a>
          <a href="#how-it-works" class="btn-secondary px-8 py-3.5 text-base">
            <Play class="w-5 h-5" />
            Watch Demo
          </a>
        </div>

        <!-- Trust indicators -->
        <div class="flex flex-wrap justify-center gap-6 text-sm text-zinc-500">
          <div class="flex items-center gap-2">
            <div class="w-5 h-5 rounded-full bg-emerald-500/20 flex items-center justify-center">
              <Check class="w-3 h-3 text-emerald-400" />
            </div>
            <span>No subscription required</span>
          </div>
          <div class="flex items-center gap-2">
            <div class="w-5 h-5 rounded-full bg-emerald-500/20 flex items-center justify-center">
              <Check class="w-3 h-3 text-emerald-400" />
            </div>
            <span>Desktop native performance</span>
          </div>
          <div class="flex items-center gap-2">
            <div class="w-5 h-5 rounded-full bg-emerald-500/20 flex items-center justify-center">
              <Check class="w-3 h-3 text-emerald-400" />
            </div>
            <span>Credits never expire</span>
          </div>
        </div>
      </div>

      <!-- App Preview -->
      <div class="max-w-5xl mx-auto">
        <div class="relative">
          <!-- Outer glow -->
          <div 
            class="absolute -inset-8 rounded-3xl blur-3xl opacity-40"
            style="background: linear-gradient(135deg, rgba(139, 92, 246, 0.2) 0%, rgba(139, 92, 246, 0.05) 25%, transparent 50%, rgba(6, 182, 212, 0.05) 75%, rgba(6, 182, 212, 0.15) 100%);"
          />
          
          <!-- App window -->
          <div class="relative rounded-2xl overflow-hidden border border-zinc-800/80 bg-zinc-950 shadow-2xl shadow-black/50">
            <!-- Titlebar -->
            <div class="flex items-center justify-between h-11 bg-gradient-to-b from-zinc-900 to-zinc-900/90 border-b border-zinc-800/80 px-4">
              <div class="flex items-center gap-2.5">
                <img :src="logoIcon" alt="Clippster" class="h-5 w-auto" />
                <span class="text-xs text-zinc-400 font-medium">Clippster</span>
                <div class="w-px h-4 bg-zinc-800 ml-1" />
                <span class="text-[10px] text-zinc-600 font-mono">v2.4.1</span>
              </div>
              <div class="flex items-center gap-3">
                <span class="text-[10px] text-zinc-600 font-mono">{{ formattedTime }}</span>
                <div class="flex items-center gap-1.5">
                  <div class="w-3 h-3 rounded-full bg-zinc-800 hover:bg-yellow-500/80 transition-colors cursor-pointer border border-zinc-700/50" />
                  <div class="w-3 h-3 rounded-full bg-zinc-800 hover:bg-emerald-500/80 transition-colors cursor-pointer border border-zinc-700/50" />
                  <div class="w-3 h-3 rounded-full bg-zinc-800 hover:bg-red-500/80 transition-colors cursor-pointer border border-zinc-700/50" />
                </div>
              </div>
            </div>
            
            <!-- App content -->
            <div class="flex bg-zinc-950">
              <!-- Sidebar -->
              <div class="w-56 bg-gradient-to-b from-zinc-900/70 to-zinc-900/40 border-r border-zinc-800/60 p-3 space-y-1 hidden sm:flex flex-col">
                <div class="flex items-center gap-2.5 px-3 py-2.5 rounded-xl bg-gradient-to-r from-violet-500/15 to-violet-500/5 text-white text-sm font-medium border border-violet-500/20 shadow-lg shadow-violet-500/5">
                  <Users class="w-4 h-4 text-violet-400" />
                  <span>Creators</span>
                </div>
                <div class="flex items-center gap-2.5 px-3 py-2.5 rounded-xl text-zinc-500 text-sm hover:text-zinc-300 hover:bg-zinc-800/40 transition-all cursor-pointer">
                  <FolderOpen class="w-4 h-4" />
                  <span>Projects</span>
                </div>
                <div class="flex items-center gap-2.5 px-3 py-2.5 rounded-xl text-zinc-500 text-sm hover:text-zinc-300 hover:bg-zinc-800/40 transition-all cursor-pointer">
                  <Scissors class="w-4 h-4" />
                  <span>My Clips</span>
                  <span class="ml-auto text-[10px] px-1.5 py-0.5 rounded-full bg-zinc-800 text-zinc-400">24</span>
                </div>
                <div class="flex items-center gap-2.5 px-3 py-2.5 rounded-xl text-zinc-500 text-sm hover:text-zinc-300 hover:bg-zinc-800/40 transition-all cursor-pointer">
                  <Wifi class="w-4 h-4" />
                  <span>Live</span>
                  <span class="ml-auto flex items-center gap-1">
                    <span class="w-1.5 h-1.5 rounded-full bg-emerald-500 animate-pulse" />
                    <span class="text-[10px] text-emerald-400">2</span>
                  </span>
                </div>
                <div class="flex items-center gap-2.5 px-3 py-2.5 rounded-xl text-zinc-500 text-sm hover:text-zinc-300 hover:bg-zinc-800/40 transition-all cursor-pointer">
                  <Film class="w-4 h-4" />
                  <span>Stream VODs</span>
                </div>
                <div class="flex items-center gap-2.5 px-3 py-2.5 rounded-xl text-zinc-500 text-sm hover:text-zinc-300 hover:bg-zinc-800/40 transition-all cursor-pointer">
                  <Image class="w-4 h-4" />
                  <span>Assets</span>
                </div>
                
                <!-- Spacer -->
                <div class="flex-1" />
                
                <!-- Stats Card -->
                <div class="p-3 rounded-xl bg-zinc-900/50 border border-zinc-800/80 space-y-3">
                  <div class="flex items-center justify-between">
                    <span class="text-[10px] text-zinc-500 uppercase tracking-wider font-semibold">This Week</span>
                    <BarChart3 class="w-3 h-3 text-zinc-600" />
                  </div>
                  <div class="flex items-baseline gap-1">
                    <span class="text-xl font-bold text-white">47</span>
                    <span class="text-xs text-zinc-500">clips</span>
                  </div>
                  <div class="h-1 bg-zinc-800 rounded-full overflow-hidden">
                    <div class="h-full w-[68%] bg-gradient-to-r from-violet-500 to-cyan-500 rounded-full" />
                  </div>
                </div>
                
                <!-- Credits -->
                <div class="p-3 rounded-xl bg-gradient-to-br from-violet-500/10 via-violet-500/5 to-transparent border border-violet-500/20">
                  <div class="flex items-center justify-between mb-2">
                    <span class="text-[10px] text-zinc-400 uppercase tracking-wider font-semibold">Credits</span>
                    <Clock class="w-3 h-3 text-violet-400" />
                  </div>
                  <div class="flex items-baseline gap-1">
                    <span class="text-lg font-bold text-white">25.5</span>
                    <span class="text-xs text-zinc-500">hours</span>
                  </div>
                  <div class="mt-2 h-1 bg-zinc-800 rounded-full overflow-hidden">
                    <div class="h-full w-[85%] bg-gradient-to-r from-violet-500 to-violet-400 rounded-full" />
                  </div>
                </div>
              </div>
              
              <!-- Main content -->
              <div class="flex-1 p-5 min-h-[420px] bg-gradient-to-br from-zinc-950 via-zinc-950 to-zinc-900/30">
                <!-- Header -->
                <div class="flex items-center justify-between mb-5">
                  <div>
                    <h2 class="text-base font-semibold text-white">Creator Profiles</h2>
                    <p class="text-xs text-zinc-500 mt-0.5">Manage and monitor your content creators</p>
                  </div>
                  <div class="flex items-center gap-2">
                    <div class="px-3 py-1.5 bg-zinc-900/80 rounded-lg border border-zinc-800/60 text-[10px] text-zinc-400 flex items-center gap-2">
                      <span class="w-1.5 h-1.5 rounded-full bg-emerald-500" />
                      <span>2 Live</span>
                    </div>
                    <button class="px-3 py-1.5 bg-gradient-to-r from-violet-600 to-violet-500 hover:from-violet-500 hover:to-violet-400 rounded-lg text-xs text-white font-medium transition-all shadow-lg shadow-violet-500/20">
                      + Add Creator
                    </button>
                  </div>
                </div>
                
                <!-- Creator cards -->
                <div class="space-y-3">
                  <div 
                    v-for="creator in mockCreators" 
                    :key="creator.name"
                    class="group flex items-center gap-4 p-4 rounded-xl border transition-all"
                    :class="creator.isMonitoring && creator.status === 'live' 
                      ? 'bg-gradient-to-r from-emerald-500/[0.08] via-emerald-500/[0.03] to-transparent border-emerald-500/30' 
                      : 'bg-zinc-900/30 border-zinc-800/60 hover:border-zinc-700/80 hover:bg-zinc-900/50'"
                  >
                    <!-- Thumbnail Preview -->
                    <div class="relative w-28 h-16 rounded-lg overflow-hidden flex-shrink-0 border border-zinc-800/60">
                      <div 
                        class="absolute inset-0 bg-gradient-to-br"
                        :class="creator.thumbnail"
                      />
                      <!-- Scanlines effect -->
                      <div class="absolute inset-0 opacity-[0.03]" style="background: repeating-linear-gradient(0deg, transparent, transparent 2px, rgba(255,255,255,0.1) 2px, rgba(255,255,255,0.1) 4px);" />
                      <!-- Play overlay -->
                      <div v-if="creator.status === 'live'" class="absolute inset-0 flex items-center justify-center bg-black/20">
                        <div class="w-6 h-6 rounded-full bg-white/10 backdrop-blur-sm flex items-center justify-center border border-white/20">
                          <Play class="w-2.5 h-2.5 text-white ml-0.5" fill="currentColor" />
                        </div>
                      </div>
                      <!-- Live badge -->
                      <div v-if="creator.status === 'live' && creator.isMonitoring" class="absolute top-1 left-1 px-1 py-0.5 rounded bg-red-500 text-[8px] font-bold text-white flex items-center gap-0.5">
                        <span class="w-1 h-1 rounded-full bg-white" :class="{ 'animate-pulse': liveAnimation }" />
                        LIVE
                      </div>
                      <!-- Viewers -->
                      <div v-if="creator.viewers" class="absolute bottom-1 right-1 px-1 py-0.5 rounded bg-black/70 text-[8px] text-white font-mono">
                        {{ creator.viewers }}
                      </div>
                    </div>
                    
                    <!-- Info -->
                    <div class="flex-1 min-w-0">
                      <div class="flex items-center gap-2 mb-1.5">
                        <!-- Avatar -->
                        <div 
                          class="w-8 h-8 rounded-lg flex items-center justify-center text-white font-bold text-sm bg-gradient-to-br shadow-lg"
                          :class="creator.avatarGradient"
                        >
                          {{ creator.avatar }}
                        </div>
                        <div>
                          <div class="flex items-center gap-2">
                            <span class="text-sm font-semibold text-white">{{ creator.name }}</span>
                            <div 
                              v-if="creator.status === 'live' && creator.isMonitoring"
                              class="px-1.5 py-0.5 rounded text-[9px] font-bold bg-emerald-500/20 text-emerald-400 border border-emerald-500/30"
                            >
                              MONITORING
                            </div>
                          </div>
                          <div class="text-[10px] text-zinc-500 mt-0.5">{{ creator.game }}</div>
                        </div>
                      </div>
                      
                      <!-- Platform badges -->
                      <div class="flex items-center gap-2">
                        <div 
                          v-for="platform in creator.platforms" 
                          :key="platform"
                          class="flex items-center gap-1 px-1.5 py-0.5 rounded bg-zinc-800/80 border border-zinc-700/50"
                        >
                          <img 
                            v-if="platformIcons[platform]" 
                            :src="platformIcons[platform]" 
                            :alt="platform" 
                            class="w-3 h-3"
                            :style="{ color: platformColors[platform] }"
                          />
                          <span 
                            v-else
                            class="w-2 h-2 rounded-full"
                            :style="{ backgroundColor: platformColors[platform] }"
                          />
                          <span class="text-[10px] text-zinc-400">{{ platform }}</span>
                        </div>
                      </div>
                    </div>
                    
                    <!-- Stats -->
                    <div v-if="creator.isMonitoring" class="hidden lg:flex flex-col items-end gap-1 text-right">
                      <div class="text-[10px] text-zinc-500">Clips today</div>
                      <div class="text-sm font-semibold text-white">12</div>
                    </div>
                    
                    <!-- Action -->
                    <button 
                      v-if="creator.isMonitoring"
                      class="px-3 py-1.5 rounded-lg text-xs font-medium bg-red-500/10 text-red-400 hover:bg-red-500/20 border border-red-500/20 transition-all"
                    >
                      Stop
                    </button>
                    <button 
                      v-else
                      class="px-3 py-1.5 rounded-lg text-xs font-medium bg-violet-500/20 text-violet-400 hover:bg-violet-500/30 border border-violet-500/30 transition-all"
                    >
                      Start
                    </button>
                  </div>
                </div>
              </div>
            </div>
            
            <!-- Bottom status bar -->
            <div class="flex items-center justify-between h-7 bg-zinc-900/50 border-t border-zinc-800/60 px-4 text-[10px]">
              <div class="flex items-center gap-4">
                <div class="flex items-center gap-1.5 text-zinc-500">
                  <span class="w-1.5 h-1.5 rounded-full bg-emerald-500" />
                  <span>Connected</span>
                </div>
                <div class="text-zinc-600">3 creators · 2 live</div>
              </div>
              <div class="flex items-center gap-3 text-zinc-600">
                <span>CPU: 12%</span>
                <span>RAM: 847 MB</span>
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  </section>
</template>
