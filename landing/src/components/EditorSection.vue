<script setup lang="ts">
import logoIcon from '@/assets/logo-icon.svg'
import { ref, onMounted, onUnmounted, computed } from 'vue'
import { Clapperboard, SkipBack, Play, Pause, SkipForward, Scissors, ArrowRight, Volume2, Maximize, ZoomIn, Type, Layers, ChevronDown, Undo2, Redo2 } from 'lucide-vue-next'

const editorFeatures = [
  {
    title: 'Multi-track timeline',
    description: 'Separate video, audio, and subtitle tracks with precise drag & drop editing'
  },
  {
    title: 'AI-generated subtitles',
    description: 'Automatic transcription with customizable styles, fonts, and animations'
  },
  {
    title: 'Smart crop & zoom',
    description: 'AI-powered focal point detection keeps the action centered in any aspect ratio'
  },
  {
    title: 'Export presets',
    description: 'One-click export for TikTok, YouTube Shorts, Instagram Reels, and more'
  }
]

const playheadPosition = ref(25)
const isPlaying = ref(true)
let animationInterval: ReturnType<typeof setInterval> | null = null

onMounted(() => {
  animationInterval = setInterval(() => {
    if (isPlaying.value) {
      playheadPosition.value = playheadPosition.value >= 75 ? 8 : playheadPosition.value + 0.4
    }
  }, 50)
})

onUnmounted(() => {
  if (animationInterval) clearInterval(animationInterval)
})

// More realistic audio waveform with variation
const audioWaveform = computed(() => {
  return Array.from({ length: 60 }, (_, i) => {
    const base = Math.sin(i * 0.3) * 30 + 50
    const noise = Math.sin(i * 1.7) * 15 + Math.sin(i * 2.9) * 10
    return Math.max(15, Math.min(95, base + noise))
  })
})

const subtitles = [
  { text: 'This is insane!', highlight: 'insane' },
  { text: 'No way that happened!', highlight: 'No way' },
  { text: "Let's gooo!", highlight: "gooo" },
  { text: 'That was absolutely crazy!', highlight: 'crazy' }
]
const currentSubtitle = ref(0)

onMounted(() => {
  setInterval(() => {
    currentSubtitle.value = (currentSubtitle.value + 1) % subtitles.length
  }, 3000)
})

const timelineMarkers = ['0:00', '0:10', '0:20', '0:30', '0:40']

const currentTime = computed(() => {
  const seconds = Math.floor((playheadPosition.value / 100) * 47)
  return `00:${String(seconds).padStart(2, '0')}`
})
</script>

<template>
  <section class="py-24 relative overflow-hidden">
    <!-- Background -->
    <div 
      class="absolute top-0 left-0 w-full h-px" 
      style="background: linear-gradient(90deg, transparent 0%, transparent 15%, rgba(139, 92, 246, 0.25) 50%, transparent 85%, transparent 100%);"
    />
    <div 
      class="absolute bottom-0 left-0 w-full h-px" 
      style="background: linear-gradient(90deg, transparent 0%, transparent 15%, rgba(139, 92, 246, 0.25) 50%, transparent 85%, transparent 100%);"
    />
    <div 
      class="absolute inset-0" 
      style="background: linear-gradient(180deg, rgba(24, 24, 27, 0.3) 0%, rgba(24, 24, 27, 0.1) 15%, transparent 35%, transparent 65%, rgba(24, 24, 27, 0.1) 85%, rgba(24, 24, 27, 0.3) 100%);"
    />
    
    <div class="container relative">
      <!-- Header -->
      <div class="text-center mb-16">
        <div class="section-label">
          <Clapperboard class="w-3.5 h-3.5" />
          <span>Built-in Video Editor</span>
        </div>
        <h2 class="section-heading">
          Professional Editing, <span class="gradient-text">Zero Learning Curve</span>
        </h2>
        <p class="section-subheading mx-auto">
          Edit your clips without leaving the app. Our intuitive timeline editor gives you pro-level control without the complexity.
        </p>
      </div>

      <div class="grid lg:grid-cols-5 gap-10 items-start">
        <!-- Features list -->
        <div class="lg:col-span-2 space-y-2">
          <div 
            v-for="(feature, index) in editorFeatures" 
            :key="feature.title"
            class="group flex gap-4 p-4 rounded-xl transition-all hover:bg-zinc-900/50 border border-transparent hover:border-zinc-800/60"
          >
            <div class="w-10 h-10 rounded-xl bg-gradient-to-br from-violet-500/15 to-violet-500/5 border border-violet-500/20 flex items-center justify-center flex-shrink-0 group-hover:from-violet-500/20 group-hover:to-violet-500/10 transition-all">
              <span class="text-sm font-bold text-violet-400 font-mono">{{ index + 1 }}</span>
            </div>
            <div>
              <h4 class="font-semibold text-white mb-1.5">{{ feature.title }}</h4>
              <p class="text-sm text-zinc-400 leading-relaxed">{{ feature.description }}</p>
            </div>
          </div>
          
          <!-- CTA -->
          <div class="pt-4 pl-4">
            <a href="#download" class="inline-flex items-center gap-2 text-violet-400 hover:text-violet-300 transition-colors text-sm font-medium group">
              <span>See all editor features</span>
              <ArrowRight class="w-4 h-4 group-hover:translate-x-1 transition-transform" />
            </a>
          </div>
        </div>
        
        <!-- Editor Preview -->
        <div class="lg:col-span-3">
          <div class="relative">
            <!-- Glow -->
            <div 
              class="absolute -inset-6 rounded-3xl blur-3xl opacity-40"
              style="background: linear-gradient(135deg, rgba(139, 92, 246, 0.15) 0%, rgba(139, 92, 246, 0.05) 30%, transparent 50%, rgba(6, 182, 212, 0.05) 70%, rgba(6, 182, 212, 0.12) 100%);"
            />
            
            <div class="relative rounded-2xl overflow-hidden border border-zinc-800/80 bg-zinc-950 shadow-2xl shadow-black/50">
              <!-- Titlebar -->
              <div class="flex items-center justify-between h-10 bg-gradient-to-b from-zinc-900 to-zinc-900/90 border-b border-zinc-800/80 px-3">
                <div class="flex items-center gap-2">
                  <img :src="logoIcon" alt="Clippster" class="h-4 w-auto" />
                  <span class="text-[10px] text-zinc-400 font-medium">Clip Editor</span>
                  <div class="w-px h-3.5 bg-zinc-800 ml-1" />
                  <span class="text-[10px] text-zinc-600 truncate max-w-24">ShadowFox_clip_001.mp4</span>
                </div>
                <div class="flex items-center gap-2">
                  <button class="flex items-center gap-1 px-2 py-1 text-[10px] text-zinc-500 hover:text-white transition-colors rounded hover:bg-zinc-800/50">
                    <Undo2 class="w-3 h-3" />
                  </button>
                  <button class="flex items-center gap-1 px-2 py-1 text-[10px] text-zinc-600 transition-colors rounded cursor-not-allowed">
                    <Redo2 class="w-3 h-3" />
                  </button>
                  <button class="px-2.5 py-1 bg-gradient-to-r from-violet-600 to-violet-500 rounded text-[10px] text-white font-medium hover:from-violet-500 hover:to-violet-400 transition-all shadow-lg shadow-violet-500/20">
                    Export
                  </button>
                </div>
              </div>
              
              <!-- Content -->
              <div class="p-3 bg-zinc-950">
                <div class="grid grid-cols-3 gap-3">
                  <!-- Preview -->
                  <div class="col-span-2">
                    <div class="aspect-video bg-zinc-900 rounded-xl relative overflow-hidden border border-zinc-800/80">
                      <!-- Video content simulation -->
                      <div class="absolute inset-0">
                        <!-- Base gradient -->
                        <div class="absolute inset-0 bg-gradient-to-br from-violet-900/40 via-zinc-900 to-indigo-900/30" />
                        <!-- Ambient light effect -->
                        <div class="absolute top-0 left-1/3 w-1/2 h-1/2 bg-gradient-to-br from-violet-500/10 to-transparent rounded-full blur-2xl" />
                        <!-- Game-like overlay -->
                        <div class="absolute bottom-1/4 right-1/4 w-1/3 h-1/3 bg-gradient-to-tl from-cyan-500/5 to-transparent rounded-full blur-xl" />
                      </div>
                      
                      <!-- Focal point indicator -->
                      <div class="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 w-20 h-20 border-2 border-dashed border-violet-500/30 rounded-lg" />
                      <div class="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 w-2 h-2 bg-violet-500 rounded-full shadow-lg shadow-violet-500/50" />
                      
                      <!-- Play button -->
                      <div class="absolute inset-0 flex items-center justify-center">
                        <div class="w-14 h-14 rounded-full bg-white/10 backdrop-blur-sm flex items-center justify-center border border-white/20 shadow-2xl">
                          <component 
                            :is="isPlaying ? Pause : Play" 
                            class="w-5 h-5 text-white" 
                            :class="{ 'ml-0.5': !isPlaying }"
                            fill="currentColor"
                          />
                        </div>
                      </div>
                      
                      <!-- Top bar -->
                      <div class="absolute top-0 left-0 right-0 h-8 bg-gradient-to-b from-black/60 to-transparent flex items-center justify-between px-2.5">
                        <div class="flex items-center gap-2">
                          <div class="px-1.5 py-0.5 bg-black/50 rounded text-[9px] text-white font-mono border border-white/10">
                            9:16
                          </div>
                          <div class="px-1.5 py-0.5 bg-violet-500/30 rounded text-[9px] text-violet-300 font-medium border border-violet-500/30">
                            <ZoomIn class="w-2.5 h-2.5 inline mr-0.5" />
                            Auto Crop
                          </div>
                        </div>
                        <button class="p-1 hover:bg-white/10 rounded transition-colors">
                          <Maximize class="w-3 h-3 text-white/70" />
                        </button>
                      </div>
                      
                      <!-- Subtitle -->
                      <div class="absolute bottom-4 left-1/2 -translate-x-1/2">
                        <div class="px-3 py-1.5 bg-black/80 rounded-lg border border-white/10 backdrop-blur-sm">
                          <span class="text-white text-sm font-bold tracking-wide" style="text-shadow: 2px 2px 0 #000, -1px -1px 0 #000;">
                            {{ subtitles[currentSubtitle].text.split(subtitles[currentSubtitle].highlight)[0] }}<span class="text-yellow-400">{{ subtitles[currentSubtitle].highlight }}</span>{{ subtitles[currentSubtitle].text.split(subtitles[currentSubtitle].highlight)[1] || '' }}
                          </span>
                        </div>
                      </div>
                    </div>
                  </div>
                  
                  <!-- Side panel -->
                  <div class="space-y-2.5">
                    <!-- Subtitle Style Panel -->
                    <div class="p-3 bg-gradient-to-b from-zinc-900/80 to-zinc-900/40 rounded-xl border border-zinc-800/80">
                      <div class="flex items-center justify-between mb-2.5">
                        <span class="text-[9px] text-zinc-400 uppercase tracking-wider font-semibold flex items-center gap-1.5">
                          <Type class="w-3 h-3" />
                          Subtitle Style
                        </span>
                        <ChevronDown class="w-3 h-3 text-zinc-600" />
                      </div>
                      <div class="space-y-2">
                        <div class="flex items-center justify-between">
                          <span class="text-[10px] text-zinc-500">Font</span>
                          <span class="text-[10px] text-white font-medium bg-zinc-800 px-1.5 py-0.5 rounded">Montserrat</span>
                        </div>
                        <div class="flex items-center justify-between">
                          <span class="text-[10px] text-zinc-500">Size</span>
                          <div class="flex items-center gap-1">
                            <div class="w-12 h-1 bg-zinc-800 rounded-full overflow-hidden">
                              <div class="h-full w-3/4 bg-violet-500 rounded-full" />
                            </div>
                            <span class="text-[10px] text-white font-mono">48</span>
                          </div>
                        </div>
                        <div class="flex items-center justify-between">
                          <span class="text-[10px] text-zinc-500">Highlight</span>
                          <div class="flex gap-1">
                            <div class="w-4 h-4 rounded bg-yellow-400 border border-yellow-300 ring-1 ring-offset-1 ring-offset-zinc-900 ring-violet-500" />
                            <div class="w-4 h-4 rounded bg-cyan-400 border border-cyan-300" />
                            <div class="w-4 h-4 rounded bg-pink-400 border border-pink-300" />
                          </div>
                        </div>
                        <div class="flex items-center justify-between">
                          <span class="text-[10px] text-zinc-500">Animation</span>
                          <span class="text-[10px] text-violet-400 font-medium">Pop ✨</span>
                        </div>
                      </div>
                    </div>
                    
                    <!-- Export Panel -->
                    <div class="p-3 bg-gradient-to-b from-zinc-900/80 to-zinc-900/40 rounded-xl border border-zinc-800/80">
                      <div class="flex items-center justify-between mb-2.5">
                        <span class="text-[9px] text-zinc-400 uppercase tracking-wider font-semibold flex items-center gap-1.5">
                          <Layers class="w-3 h-3" />
                          Export Settings
                        </span>
                        <ChevronDown class="w-3 h-3 text-zinc-600" />
                      </div>
                      <div class="space-y-2">
                        <div class="flex items-center justify-between">
                          <span class="text-[10px] text-zinc-500">Quality</span>
                          <span class="text-[10px] text-emerald-400 font-medium">1080p HD</span>
                        </div>
                        <div class="flex items-center justify-between">
                          <span class="text-[10px] text-zinc-500">Format</span>
                          <span class="text-[10px] text-white">MP4 (H.264)</span>
                        </div>
                        <div class="flex items-center justify-between">
                          <span class="text-[10px] text-zinc-500">Bitrate</span>
                          <span class="text-[10px] text-white font-mono">8 Mbps</span>
                        </div>
                      </div>
                      <div class="mt-2.5 pt-2.5 border-t border-zinc-800/60">
                        <div class="flex gap-1.5">
                          <div class="flex-1 px-2 py-1 bg-zinc-800/80 rounded text-[9px] text-center text-zinc-400 border border-zinc-700/50 hover:border-zinc-600 transition-colors cursor-pointer">TikTok</div>
                          <div class="flex-1 px-2 py-1 bg-violet-500/20 rounded text-[9px] text-center text-violet-400 border border-violet-500/30">Shorts</div>
                          <div class="flex-1 px-2 py-1 bg-zinc-800/80 rounded text-[9px] text-center text-zinc-400 border border-zinc-700/50 hover:border-zinc-600 transition-colors cursor-pointer">Reels</div>
                        </div>
                      </div>
                    </div>
                  </div>
                </div>
                
                <!-- Timeline -->
                <div class="mt-3 bg-gradient-to-b from-zinc-900/70 to-zinc-900/40 rounded-xl border border-zinc-800/80 overflow-hidden">
                  <!-- Toolbar -->
                  <div class="flex items-center gap-3 px-3 py-2.5 border-b border-zinc-800/60 bg-zinc-900/30">
                    <div class="flex items-center gap-1">
                      <button class="w-7 h-7 rounded-lg bg-zinc-800/80 flex items-center justify-center text-zinc-400 hover:text-white hover:bg-zinc-700 transition-all border border-zinc-700/50">
                        <SkipBack class="w-3.5 h-3.5" />
                      </button>
                      <button class="w-7 h-7 rounded-lg bg-violet-500/20 flex items-center justify-center text-violet-400 border border-violet-500/30 hover:bg-violet-500/30 transition-all">
                        <Pause class="w-3.5 h-3.5" />
                      </button>
                      <button class="w-7 h-7 rounded-lg bg-zinc-800/80 flex items-center justify-center text-zinc-400 hover:text-white hover:bg-zinc-700 transition-all border border-zinc-700/50">
                        <SkipForward class="w-3.5 h-3.5" />
                      </button>
                    </div>
                    
                    <div class="flex items-center gap-2 px-2 py-1 bg-zinc-800/50 rounded-lg border border-zinc-700/30">
                      <span class="text-[10px] text-white font-mono font-medium">{{ currentTime }}</span>
                      <span class="text-[10px] text-zinc-600">/</span>
                      <span class="text-[10px] text-zinc-500 font-mono">00:47</span>
                    </div>
                    
                    <div class="flex-1" />
                    
                    <div class="flex items-center gap-2">
                      <button class="w-7 h-7 rounded-lg bg-zinc-800/80 flex items-center justify-center text-zinc-400 hover:text-white hover:bg-zinc-700 transition-all border border-zinc-700/50">
                        <Scissors class="w-3.5 h-3.5" />
                      </button>
                      <button class="w-7 h-7 rounded-lg bg-zinc-800/80 flex items-center justify-center text-zinc-400 hover:text-white hover:bg-zinc-700 transition-all border border-zinc-700/50">
                        <Volume2 class="w-3.5 h-3.5" />
                      </button>
                    </div>
                    
                    <div class="flex gap-1.5">
                      <div class="px-2 py-1 bg-violet-500/20 rounded-md text-[9px] text-violet-400 border border-violet-500/30 font-medium">9:16</div>
                      <div class="px-2 py-1 bg-zinc-800/60 rounded-md text-[9px] text-zinc-400 border border-zinc-700/50">16:9</div>
                      <div class="px-2 py-1 bg-zinc-800/60 rounded-md text-[9px] text-zinc-400 border border-zinc-700/50">1:1</div>
                    </div>
                  </div>
                  
                  <!-- Timeline markers -->
                  <div class="px-3 py-1 bg-zinc-900/20 flex border-b border-zinc-800/40">
                    <div class="w-10 flex-shrink-0" />
                    <div class="flex-1 flex justify-between text-[8px] text-zinc-600 font-mono">
                      <span v-for="marker in timelineMarkers" :key="marker">{{ marker }}</span>
                    </div>
                  </div>
                  
                  <!-- Tracks -->
                  <div class="p-3 space-y-2 relative">
                    <!-- Playhead -->
                    <div 
                      class="absolute top-0 bottom-0 w-0.5 bg-white z-20 pointer-events-none"
                      :style="{ left: `calc(40px + (100% - 52px) * ${playheadPosition / 100})` }"
                    >
                      <div class="absolute -top-1 left-1/2 -translate-x-1/2 w-2.5 h-2.5 bg-white rounded-sm rotate-45 shadow-lg shadow-white/30" />
                      <div class="absolute inset-0 bg-white/50 blur-sm" />
                    </div>
                    
                    <!-- Video track -->
                    <div class="flex items-center gap-2">
                      <span class="text-[9px] text-zinc-500 w-10 flex-shrink-0 font-mono flex items-center gap-1">
                        <div class="w-1.5 h-1.5 rounded-full bg-violet-500" />
                        Video
                      </span>
                      <div class="flex-1 h-10 bg-zinc-800/40 rounded-lg overflow-hidden relative border border-zinc-800/60">
                        <!-- Video clip -->
                        <div class="absolute inset-y-1 left-1 right-[20%] bg-gradient-to-r from-violet-600/50 via-violet-500/40 to-indigo-500/30 rounded-md border border-violet-500/40 overflow-hidden">
                          <!-- Thumbnail strips -->
                          <div class="absolute inset-0 flex">
                            <div v-for="i in 8" :key="i" class="flex-1 border-r border-violet-900/30 last:border-r-0 bg-gradient-to-b from-violet-700/20 to-transparent" />
                          </div>
                          <!-- Clip handles -->
                          <div class="absolute left-0 top-0 bottom-0 w-1 bg-violet-400/50 cursor-ew-resize hover:bg-violet-400 transition-colors" />
                          <div class="absolute right-0 top-0 bottom-0 w-1 bg-violet-400/50 cursor-ew-resize hover:bg-violet-400 transition-colors" />
                        </div>
                      </div>
                    </div>
                    
                    <!-- Audio track -->
                    <div class="flex items-center gap-2">
                      <span class="text-[9px] text-zinc-500 w-10 flex-shrink-0 font-mono flex items-center gap-1">
                        <div class="w-1.5 h-1.5 rounded-full bg-emerald-500" />
                        Audio
                      </span>
                      <div class="flex-1 h-7 bg-zinc-800/40 rounded-lg overflow-hidden border border-zinc-800/60">
                        <div class="h-full flex items-center gap-[1px] px-1.5 py-1">
                          <div 
                            v-for="(height, i) in audioWaveform" 
                            :key="i" 
                            class="flex-1 rounded-full transition-all"
                            :class="i < (playheadPosition / 100) * audioWaveform.length ? 'bg-emerald-400/70' : 'bg-emerald-400/30'"
                            :style="{ height: `${height}%` }"
                          />
                        </div>
                      </div>
                    </div>
                    
                    <!-- Subtitle track -->
                    <div class="flex items-center gap-2">
                      <span class="text-[9px] text-zinc-500 w-10 flex-shrink-0 font-mono flex items-center gap-1">
                        <div class="w-1.5 h-1.5 rounded-full bg-pink-500" />
                        Subs
                      </span>
                      <div class="flex-1 h-6 bg-zinc-800/40 rounded-lg flex items-center px-1.5 gap-2 border border-zinc-800/60">
                        <div class="h-4 w-14 bg-gradient-to-r from-pink-500/50 to-pink-500/30 rounded border border-pink-500/40 flex items-center justify-center">
                          <span class="text-[7px] text-pink-200 truncate px-1">insane!</span>
                        </div>
                        <div class="h-4 w-20 bg-gradient-to-r from-pink-500/50 to-pink-500/30 rounded border border-pink-500/40 flex items-center justify-center">
                          <span class="text-[7px] text-pink-200 truncate px-1">No way that...</span>
                        </div>
                        <div class="h-4 w-12 bg-gradient-to-r from-pink-500/50 to-pink-500/30 rounded border border-pink-500/40 flex items-center justify-center">
                          <span class="text-[7px] text-pink-200 truncate px-1">gooo!</span>
                        </div>
                        <div class="h-4 w-16 bg-gradient-to-r from-pink-500/40 to-pink-500/20 rounded border border-pink-500/30 flex items-center justify-center opacity-60">
                          <span class="text-[7px] text-pink-200 truncate px-1">crazy!</span>
                        </div>
                      </div>
                    </div>
                  </div>
                </div>
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  </section>
</template>
