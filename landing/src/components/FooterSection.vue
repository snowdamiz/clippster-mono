<script setup lang="ts">
import { Twitter, MessageCircle, Github } from 'lucide-vue-next'

const currentYear = new Date().getFullYear()

const footerLinks = {
  product: [
    { name: 'Features', href: '#features' },
    { name: 'Pricing', href: '#pricing' },
    { name: 'Download', href: '#download' },
    { name: 'Changelog', href: '#' },
  ],
  resources: [
    { name: 'Documentation', href: '#' },
    { name: 'Tutorials', href: '#' },
    { name: 'Blog', href: '#' },
    { name: 'API', href: '#' },
  ],
  company: [
    { name: 'About', href: '#' },
    { name: 'Privacy', href: '#' },
    { name: 'Terms', href: '#' },
    { name: 'Contact', href: '#' },
  ]
}

const socialLinks = [
  { name: 'Twitter', href: '#', icon: Twitter },
  { name: 'Discord', href: '#', icon: MessageCircle },
  { name: 'GitHub', href: '#', icon: Github },
]
</script>

<template>
  <footer class="py-14 border-t border-zinc-800 bg-zinc-900/30">
    <div class="container">
      <div class="grid md:grid-cols-2 lg:grid-cols-5 gap-10 mb-10">
        <!-- Brand column -->
        <div class="lg:col-span-2">
          <a href="#" class="flex items-center gap-2.5 mb-4">
            <img src="@/assets/logo.svg" alt="Clippster" class="h-6" />
          </a>
          <p class="text-sm text-zinc-500 max-w-xs mb-5">
            AI-powered clip detection and video editing for content creators. Turn hours of streams into viral clips.
          </p>
          
          <!-- Social links -->
          <div class="flex items-center gap-2">
            <a 
              v-for="social in socialLinks"
              :key="social.name"
              :href="social.href"
              class="w-9 h-9 rounded-lg bg-zinc-800/50 border border-zinc-700 flex items-center justify-center text-zinc-400 hover:text-white hover:border-violet-500/30 transition-colors"
              :aria-label="social.name"
            >
              <component :is="social.icon" class="w-4 h-4" />
            </a>
          </div>
        </div>

        <!-- Link columns -->
        <div>
          <h4 class="font-semibold text-white mb-4">Product</h4>
          <ul class="space-y-2.5">
            <li v-for="link in footerLinks.product" :key="link.name">
              <a :href="link.href" class="text-sm text-zinc-400 hover:text-white transition-colors">
                {{ link.name }}
              </a>
            </li>
          </ul>
        </div>

        <div>
          <h4 class="font-semibold text-white mb-4">Resources</h4>
          <ul class="space-y-2.5">
            <li v-for="link in footerLinks.resources" :key="link.name">
              <a :href="link.href" class="text-sm text-zinc-400 hover:text-white transition-colors">
                {{ link.name }}
              </a>
            </li>
          </ul>
        </div>

        <div>
          <h4 class="font-semibold text-white mb-4">Company</h4>
          <ul class="space-y-2.5">
            <li v-for="link in footerLinks.company" :key="link.name">
              <a :href="link.href" class="text-sm text-zinc-400 hover:text-white transition-colors">
                {{ link.name }}
              </a>
            </li>
          </ul>
        </div>
      </div>

      <!-- Bottom bar -->
      <div class="pt-8 border-t border-zinc-800 flex flex-col md:flex-row justify-between items-center gap-4">
        <p class="text-sm text-zinc-500">
          © {{ currentYear }} Clippster. All rights reserved.
        </p>
        <p class="text-sm text-zinc-600">
          Built with ❤️ for content creators
        </p>
      </div>
    </div>
  </footer>
</template>
