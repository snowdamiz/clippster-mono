<script setup lang="ts">
import { ref } from 'vue'
import { CreditCard, Check, ChevronDown } from 'lucide-vue-next'

const plans = [
  { 
    name: 'Starter', 
    hours: 5, 
    price: 10, 
    perHour: '2.00',
    description: 'Perfect for trying out',
    features: [
      'AI clip detection',
      'Full video editor',
      'All export formats',
      'Community support'
    ]
  },
  { 
    name: 'Creator', 
    hours: 25, 
    price: 40, 
    perHour: '1.60', 
    popular: true,
    description: 'Most popular choice',
    features: [
      'Everything in Starter',
      'Priority processing',
      'Team sharing (3 seats)',
      'Email support'
    ]
  },
  { 
    name: 'Pro', 
    hours: 100, 
    price: 120, 
    perHour: '1.20',
    description: 'For serious creators',
    features: [
      'Everything in Creator',
      'Unlimited team seats',
      'API access',
      'Priority support'
    ]
  },
]

const faqs = [
  {
    q: 'What are hours used for?',
    a: 'Hours are consumed when processing video through our AI. 1 hour of video content = 1 hour of credits.',
    open: ref(false)
  },
  {
    q: 'Do credits expire?',
    a: 'No! Your credits never expire. Buy once, use whenever you need them.',
    open: ref(false)
  },
  {
    q: 'Can I upgrade later?',
    a: "Yes, you can purchase additional credit packs anytime. They'll be added to your balance.",
    open: ref(false)
  }
]
</script>

<template>
  <section id="pricing" class="py-24 relative">
    <!-- Background -->
    <div class="absolute inset-0 glow-top opacity-50" />
    
    <div class="container relative">
      <div class="text-center mb-16">
        <div class="section-label">
          <CreditCard class="w-3.5 h-3.5" />
          <span>Simple Pricing</span>
        </div>
        <h2 class="section-heading">
          Pay Once, <span class="gradient-text">Use Forever</span>
        </h2>
        <p class="section-subheading mx-auto">
          No subscriptions. No monthly fees. Buy credits once and use them whenever you need. Credits never expire.
        </p>
      </div>

      <!-- Pricing cards -->
      <div class="grid md:grid-cols-3 gap-5 max-w-5xl mx-auto mb-20">
        <div 
          v-for="plan in plans"
          :key="plan.name"
          class="card p-6 relative transition-all duration-200"
          :class="plan.popular 
            ? 'border-violet-500/50 bg-violet-500/5 scale-[1.02] lg:scale-105 z-10' 
            : 'hover:border-zinc-700'"
        >
          <!-- Popular badge -->
          <div 
            v-if="plan.popular"
            class="absolute -top-3 left-1/2 -translate-x-1/2 px-3 py-1 bg-gradient-to-r from-violet-500 to-indigo-600 text-white text-xs font-semibold rounded-full"
          >
            MOST POPULAR
          </div>

          <!-- Plan header -->
          <div class="mb-5">
            <h3 class="text-xl font-bold text-white font-display mb-1">{{ plan.name }}</h3>
            <p class="text-sm text-zinc-500">{{ plan.description }}</p>
          </div>
          
          <!-- Hours -->
          <div class="mb-2">
            <span class="text-4xl font-bold text-white font-display">{{ plan.hours }}</span>
            <span class="text-zinc-400 ml-1.5">hours</span>
          </div>

          <!-- Price -->
          <div class="mb-6 pb-6 border-b border-zinc-800">
            <span class="text-2xl font-bold text-white">${{ plan.price }}</span>
            <span class="text-sm text-zinc-500 ml-1.5">(~${{ plan.perHour }}/hr)</span>
          </div>

          <!-- Features -->
          <ul class="space-y-3 mb-6">
            <li 
              v-for="feature in plan.features" 
              :key="feature"
              class="flex items-center gap-3 text-sm"
            >
              <div 
                class="w-5 h-5 rounded-full flex items-center justify-center flex-shrink-0"
                :class="plan.popular ? 'bg-violet-500/20' : 'bg-zinc-800'"
              >
                <Check class="w-3 h-3" :class="plan.popular ? 'text-violet-400' : 'text-emerald-400'" />
              </div>
              <span class="text-zinc-300">{{ feature }}</span>
            </li>
          </ul>

          <!-- CTA -->
          <button 
            class="w-full py-3 rounded-xl font-semibold text-sm transition-all duration-200"
            :class="plan.popular 
              ? 'btn-primary' 
              : 'bg-zinc-800 text-white hover:bg-zinc-700 border border-zinc-700'"
          >
            Get Started
          </button>
        </div>
      </div>

      <!-- FAQs -->
      <div class="max-w-2xl mx-auto">
        <h3 class="text-xl font-bold text-white text-center mb-6 font-display">Common Questions</h3>
        <div class="space-y-3">
          <div 
            v-for="faq in faqs" 
            :key="faq.q"
            class="card overflow-hidden"
          >
            <button 
              @click="faq.open.value = !faq.open.value"
              class="w-full flex items-center justify-between p-4 text-left hover:bg-zinc-900/50 transition-colors"
            >
              <h4 class="font-semibold text-white">{{ faq.q }}</h4>
              <ChevronDown 
                class="w-5 h-5 text-zinc-500 transition-transform" 
                :class="{ 'rotate-180': faq.open.value }" 
              />
            </button>
            <div 
              v-if="faq.open.value"
              class="px-4 pb-4"
            >
              <p class="text-sm text-zinc-400">{{ faq.a }}</p>
            </div>
          </div>
        </div>
      </div>
    </div>
  </section>
</template>
