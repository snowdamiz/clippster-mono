<script setup lang="ts">
import { 
  Sparkles, 
  Play, 
  MessageSquare, 
  Layers, 
  Download, 
  Maximize, 
  Users, 
  Shield, 
  ImageIcon,
  Boxes
} from 'lucide-vue-next'

const features = [
  {
    icon: Sparkles,
    title: 'AI Clip Detection',
    description: 'Advanced AI analyzes audio peaks, visual changes, and context to identify the most engaging, viral-worthy moments.',
    highlight: true,
  },
  {
    icon: Play,
    title: 'Live Stream DVR',
    description: 'Watch live streams with full DVR rewind capability. Clip manually or let AI detect highlights in real-time.',
  },
  {
    icon: MessageSquare,
    title: 'AI Subtitles',
    description: 'Generate accurate, stylized subtitles automatically. Choose from multiple styles, fonts, and animation presets.',
    highlight: true,
  },
  {
    icon: Layers,
    title: 'Multi-Track Timeline',
    description: 'Professional timeline editor with video, audio, and subtitle tracks. Drag, drop, trim with precision.',
  },
  {
    icon: Download,
    title: 'VOD Downloads',
    description: 'Download VODs directly from Kick, YouTube, Twitch, and PumpFun. No external tools needed.',
  },
  {
    icon: Maximize,
    title: 'Aspect Ratio Presets',
    description: 'Export clips in 9:16 for TikTok/Shorts, 16:9 for YouTube, 1:1 for Instagram, or any custom ratio.',
  },
  {
    icon: Users,
    title: 'Team Collaboration',
    description: 'Share assets with team members, manage org-level AI credits, assign roles, and collaborate seamlessly.',
  },
  {
    icon: Shield,
    title: 'Privacy First',
    description: 'Your videos stay on your machine. No cloud uploads, no data harvesting. Total control over your content.',
  },
  {
    icon: ImageIcon,
    title: 'Custom Watermarks',
    description: 'Add your logo, brand colors, and custom watermarks. Position them anywhere with full control.',
  },
]
</script>

<template>
  <section id="features" class="py-24 relative overflow-hidden">
    <!-- Background - smoother gradient with more stops -->
    <div 
      class="absolute inset-0" 
      style="background: linear-gradient(180deg, transparent 0%, rgba(24, 24, 27, 0.15) 25%, rgba(24, 24, 27, 0.3) 50%, rgba(24, 24, 27, 0.15) 75%, transparent 100%);"
    />
    
    <div class="container relative">
      <!-- Header -->
      <div class="text-center mb-16">
        <div class="section-label">
          <Boxes class="w-3.5 h-3.5" />
          <span>Everything You Need</span>
        </div>
        <h2 class="section-heading">
          Built for <span class="gradient-text">Content Creators</span>
        </h2>
        <p class="section-subheading mx-auto">
          A complete toolkit designed for streamers and creators who want to work smarter, not harder.
        </p>
      </div>

      <!-- Features Grid -->
      <div class="grid md:grid-cols-2 lg:grid-cols-3 gap-5">
        <div 
          v-for="feature in features" 
          :key="feature.title"
          class="group"
        >
          <div 
            class="card p-6 h-full transition-all duration-200 hover:border-zinc-700"
            :class="feature.highlight ? 'border-violet-500/30 bg-violet-500/5' : ''"
          >
            <!-- Icon -->
            <div class="feature-icon mb-5">
              <component :is="feature.icon" class="w-5 h-5 text-violet-400" />
            </div>
            
            <!-- Content -->
            <h3 class="text-lg font-semibold text-white mb-2 flex items-center gap-2">
              {{ feature.title }}
              <span 
                v-if="feature.highlight" 
                class="px-1.5 py-0.5 bg-violet-500/20 rounded text-[10px] text-violet-400 font-bold uppercase tracking-wide"
              >
                AI
              </span>
            </h3>
            <p class="text-sm text-zinc-400 leading-relaxed">{{ feature.description }}</p>
          </div>
        </div>
      </div>
    </div>
  </section>
</template>
