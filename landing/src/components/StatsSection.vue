<script setup lang="ts">
import { ref, onMounted } from 'vue'
import { Heart, Film, Users, Star, Zap, Quote } from 'lucide-vue-next'

const stats = [
  { value: 10000, suffix: '+', label: 'Clips Generated', icon: Film },
  { value: 500, suffix: '+', label: 'Active Creators', icon: Users },
  { value: 4.8, suffix: '', label: 'Average Rating', icon: Star },
  { value: 50, suffix: '%+', label: 'Time Saved', icon: Zap }
]

const testimonials = [
  {
    quote: "Clippster cut my editing time in half. The AI detection is scary accurate.",
    author: "Alex Rivera",
    role: "Kick Partner",
    avatar: "A",
    color: '#53FC18'
  },
  {
    quote: "Finally a clipping tool that doesn't require a degree to use. Export quality is amazing.",
    author: "Sarah Chen",
    role: "YouTube Creator",
    avatar: "S",
    color: '#FF0000'
  },
  {
    quote: "The DVR feature alone is worth it. No more missing moments during live streams.",
    author: "Marcus Johnson",
    role: "Twitch Streamer",
    avatar: "M",
    color: '#9146FF'
  }
]

const animatedValues = ref(stats.map(() => 0))
const isVisible = ref(false)

onMounted(() => {
  const observer = new IntersectionObserver((entries) => {
    if (entries[0].isIntersecting && !isVisible.value) {
      isVisible.value = true
      stats.forEach((stat, index) => {
        const duration = 2000
        const steps = 60
        const increment = stat.value / steps
        let current = 0
        const interval = setInterval(() => {
          current += increment
          if (current >= stat.value) {
            animatedValues.value[index] = stat.value
            clearInterval(interval)
          } else {
            animatedValues.value[index] = Math.floor(current * 10) / 10
          }
        }, duration / steps)
      })
    }
  }, { threshold: 0.3 })

  const section = document.getElementById('stats-section')
  if (section) observer.observe(section)
})

const formatValue = (value: number, index: number) => {
  if (index === 2) return value.toFixed(1)
  if (value >= 1000) return `${(value / 1000).toFixed(0)}K`
  return Math.floor(value).toString()
}
</script>

<template>
  <section id="stats-section" class="py-24 relative overflow-hidden">
    <!-- Background -->
    <div class="absolute inset-0 glow-accent opacity-20" />
    
    <div class="container relative">
      <!-- Stats grid -->
      <div class="grid grid-cols-2 md:grid-cols-4 gap-4 mb-20">
        <div 
          v-for="(stat, index) in stats" 
          :key="stat.label"
          class="text-center p-6 rounded-2xl bg-zinc-900/30 border border-zinc-800 transition-colors hover:border-zinc-700"
        >
          <div class="w-10 h-10 rounded-xl bg-violet-500/10 border border-violet-500/20 flex items-center justify-center mx-auto mb-4">
            <component :is="stat.icon" class="w-5 h-5 text-violet-400" />
          </div>
          
          <div class="text-3xl sm:text-4xl font-bold text-white mb-1 font-display">
            {{ formatValue(animatedValues[index], index) }}<span class="text-violet-400">{{ stat.suffix }}</span>
          </div>
          
          <div class="text-sm text-zinc-500">{{ stat.label }}</div>
        </div>
      </div>
      
      <!-- Testimonials -->
      <div class="text-center mb-12">
        <div class="section-label">
          <Heart class="w-3.5 h-3.5" />
          <span>Loved by Creators</span>
        </div>
        <h3 class="text-2xl sm:text-3xl font-bold text-white font-display mb-3">See What Creators Are Saying</h3>
        <p class="text-zinc-400 max-w-lg mx-auto">Join thousands of content creators who are saving time and creating better clips.</p>
      </div>
      
      <div class="grid md:grid-cols-3 gap-5">
        <div 
          v-for="testimonial in testimonials" 
          :key="testimonial.author"
          class="card p-6 relative transition-all duration-200 hover:border-zinc-700"
        >
          <!-- Quote icon -->
          <Quote class="w-8 h-8 text-zinc-800 absolute top-4 right-4" />
          
          <p class="text-zinc-300 mb-6 leading-relaxed relative z-10">{{ testimonial.quote }}</p>
          
          <div class="flex items-center gap-3">
            <div 
              class="w-10 h-10 rounded-full flex items-center justify-center text-white font-semibold text-sm"
              :style="{ backgroundColor: `${testimonial.color}20`, border: `1px solid ${testimonial.color}40` }"
            >
              {{ testimonial.avatar }}
            </div>
            <div>
              <div class="font-semibold text-white text-sm">{{ testimonial.author }}</div>
              <div class="text-xs text-zinc-500">{{ testimonial.role }}</div>
            </div>
          </div>
        </div>
      </div>
      
      <!-- Social proof -->
      <div class="mt-12 flex justify-center">
        <div class="inline-flex items-center gap-5 px-6 py-4 rounded-2xl bg-zinc-900/30 border border-zinc-800">
          <div class="flex -space-x-2">
            <div class="w-9 h-9 rounded-full bg-violet-500/20 border-2 border-zinc-900 flex items-center justify-center text-xs font-bold text-violet-400">A</div>
            <div class="w-9 h-9 rounded-full bg-indigo-500/20 border-2 border-zinc-900 flex items-center justify-center text-xs font-bold text-indigo-400">M</div>
            <div class="w-9 h-9 rounded-full bg-pink-500/20 border-2 border-zinc-900 flex items-center justify-center text-xs font-bold text-pink-400">S</div>
            <div class="w-9 h-9 rounded-full bg-emerald-500/20 border-2 border-zinc-900 flex items-center justify-center text-xs font-bold text-emerald-400">J</div>
            <div class="w-9 h-9 rounded-full bg-zinc-800 border-2 border-zinc-900 flex items-center justify-center text-[10px] font-bold text-zinc-400">+99</div>
          </div>
          <div class="text-sm">
            <span class="text-white font-medium">500+ creators</span>
            <span class="text-zinc-500"> already using Clippster</span>
          </div>
        </div>
      </div>
    </div>
  </section>
</template>
