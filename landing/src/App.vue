<script setup lang="ts">
import { ref, onMounted } from 'vue'
import { Sparkles, Zap, DollarSign, Scissors, Shield, Coins, Check } from 'lucide-vue-next'

const platform = ref<'windows' | 'macos' | 'unknown'>('unknown')
const otherPlatform = ref<'windows' | 'macos' | null>(null)
const mobileMenuOpen = ref(false)

onMounted(() => {
  const userAgent = navigator.userAgent.toLowerCase()
  if (userAgent.includes('win')) {
    platform.value = 'windows'
    otherPlatform.value = 'macos'
  } else if (userAgent.includes('mac')) {
    platform.value = 'macos'
    otherPlatform.value = 'windows'
  } else {
    // Default to windows for unknown platforms
    platform.value = 'windows'
    otherPlatform.value = 'macos'
  }
})

const getPlatformName = (p: string) => {
  return p === 'windows' ? 'Windows' : 'macOS'
}

const toggleMobileMenu = () => {
  mobileMenuOpen.value = !mobileMenuOpen.value
}

const closeMobileMenu = () => {
  mobileMenuOpen.value = false
}
</script>

<template>
  <div class="min-h-screen bg-background text-foreground">
    <!-- Header -->
    <header class="border-b border-border/40 bg-background/80 backdrop-blur-md sticky top-0 z-50 shadow-sm">
      <div class="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
        <div class="flex justify-between items-center h-16">
          <!-- Logo -->
          <div class="flex items-center">
            <img src="/logo.svg" alt="Clippster" class="h-8 w-auto hover:opacity-90 transition-opacity">
          </div>

          <!-- Desktop Navigation -->
          <nav class="hidden lg:flex items-center space-x-8">
            <a href="#features" class="text-sm font-medium text-muted-foreground hover:text-foreground transition-colors relative group">
              Features
              <span class="absolute -bottom-1 left-0 w-0 h-0.5 bg-purple-400 group-hover:w-full transition-all duration-300"></span>
            </a>
            <a href="#pricing" class="text-sm font-medium text-muted-foreground hover:text-foreground transition-colors relative group">
              Pricing
              <span class="absolute -bottom-1 left-0 w-0 h-0.5 bg-purple-400 group-hover:w-full transition-all duration-300"></span>
            </a>
            <a href="#download" class="text-sm font-medium text-muted-foreground hover:text-foreground transition-colors relative group">
              Download
              <span class="absolute -bottom-1 left-0 w-0 h-0.5 bg-purple-400 group-hover:w-full transition-all duration-300"></span>
            </a>
          </nav>

           <!-- CTA Button -->
           <div class="hidden lg:block">
             <a href="#pricing" class="px-5 py-2.5 text-sm font-semibold text-white bg-gradient-to-r from-purple-600 to-indigo-600 rounded-lg hover:from-purple-500 hover:to-indigo-500 transition-all duration-200 shadow-lg shadow-purple-500/25 hover:shadow-purple-500/40">
               Get Started
             </a>
           </div>

          <!-- Mobile menu button -->
          <button
            type="button"
            class="lg:hidden p-2 text-muted-foreground"
            aria-label="Open menu"
            @click="toggleMobileMenu"
          >
            <svg class="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M4 6h16M4 12h16M4 18h16" v-if="!mobileMenuOpen"/>
              <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M6 18L18 6M6 6l12 12" v-else/>
            </svg>
          </button>
        </div>

        <!-- Mobile Navigation Menu -->
        <div v-show="mobileMenuOpen" class="lg:hidden border-t border-border/40 bg-card/50 backdrop-blur-sm">
          <div class="px-4 pt-3 pb-4 space-y-2">
            <a href="#features" class="block px-4 py-3 text-base font-medium text-muted-foreground hover:text-foreground hover:bg-muted/50 rounded-lg transition-all duration-200" @click="closeMobileMenu">
              Features
            </a>
            <a href="#pricing" class="block px-4 py-3 text-base font-medium text-muted-foreground hover:text-foreground hover:bg-muted/50 rounded-lg transition-all duration-200" @click="closeMobileMenu">
              Pricing
            </a>
            <a href="#download" class="block px-4 py-3 text-base font-medium text-muted-foreground hover:text-foreground hover:bg-muted/50 rounded-lg transition-all duration-200" @click="closeMobileMenu">
              Download
            </a>
             <a href="#pricing" class="block w-full px-6 py-3 mt-4 text-center text-base font-semibold text-white bg-gradient-to-r from-purple-600 to-indigo-600 hover:from-purple-500 hover:to-indigo-500 rounded-lg transition-all duration-200 shadow-lg shadow-purple-500/30" @click="closeMobileMenu">
               Get Started
             </a>
          </div>
        </div>
      </div>
    </header>

    <!-- Hero Section -->
    <main>
      <section class="relative py-20 sm:py-28 lg:py-36 overflow-hidden">
        <!-- Subtle background decoration -->
        <div class="absolute inset-0 overflow-hidden pointer-events-none">
          <div class="absolute -top-1/2 -right-1/4 w-96 h-96 bg-purple-500/10 rounded-full blur-3xl"></div>
          <div class="absolute -bottom-1/2 -left-1/4 w-96 h-96 bg-indigo-500/10 rounded-full blur-3xl"></div>
        </div>
        
        <div class="relative max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div class="text-center">
            <div class="max-w-4xl mx-auto">
              <!-- Badge -->
              <div class="inline-flex items-center gap-2 px-4 py-2 rounded-full text-sm font-medium bg-gradient-to-r from-purple-500/10 to-indigo-500/10 border border-purple-500/20 mb-8 hover:border-purple-500/40 transition-colors">
                <Sparkles class="w-4 h-4 text-purple-400" />
                <span class="bg-gradient-to-r from-purple-200 to-indigo-200 bg-clip-text text-transparent font-semibold">AI-Powered Video Clip Generation</span>
              </div>

              <!-- Main Heading -->
              <h1 class="text-5xl sm:text-6xl lg:text-7xl font-extrabold tracking-tight leading-tight mb-6">
                Turn long videos into
                <span class="block mt-2 bg-gradient-to-r from-purple-400 via-purple-300 to-indigo-400 bg-clip-text text-transparent">
                  viral clips
                </span>
              </h1>

              <!-- Description -->
              <p class="mt-6 text-lg sm:text-xl text-muted-foreground/90 max-w-3xl mx-auto leading-relaxed">
                AI finds your best moments and turns them into viral clips for TikTok, YouTube Shorts, and Instagram Reels.
                <span class="block mt-2 text-foreground/80 font-medium">Save 72-81% compared to subscription-based alternatives</span> while keeping your videos private on your computer.
              </p>

               <!-- CTA Buttons -->
               <div class="mt-12 flex flex-col sm:flex-row gap-4 justify-center items-center">
                 <a href="#download" class="group inline-flex items-center justify-center px-8 py-4 text-base font-semibold text-white bg-gradient-to-r from-purple-600 to-indigo-600 rounded-xl hover:from-purple-500 hover:to-indigo-500 transition-all duration-200 shadow-xl shadow-purple-500/30 hover:shadow-purple-500/50 hover:scale-105">
                   Download Clippster
                   <svg class="ml-2 w-5 h-5 group-hover:translate-x-1 transition-transform" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                     <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M13 7l5 5m0 0l-5 5m5-5H6"/>
                   </svg>
                 </a>
                 <a href="#pricing" class="inline-flex items-center justify-center px-8 py-4 text-base font-semibold text-foreground bg-card/50 border border-border/50 rounded-xl hover:bg-card hover:border-purple-500/30 transition-all duration-200 backdrop-blur-sm">
                   View Pricing
                 </a>
               </div>

              <!-- Trust indicators -->
              <div class="mt-10 flex flex-wrap justify-center items-center gap-6 sm:gap-8 text-sm">
                <div class="flex items-center gap-2 text-muted-foreground group">
                  <div class="w-8 h-8 rounded-full bg-green-500/10 flex items-center justify-center group-hover:bg-green-500/20 transition-colors">
                    <Shield class="w-4 h-4 text-green-400" />
                  </div>
                  <span class="font-medium">Privacy First</span>
                </div>
                <div class="flex items-center gap-2 text-muted-foreground group">
                  <div class="w-8 h-8 rounded-full bg-purple-500/10 flex items-center justify-center group-hover:bg-purple-500/20 transition-colors">
                    <Coins class="w-4 h-4 text-purple-400" />
                  </div>
                  <span class="font-medium">Crypto Payments</span>
                </div>
                <div class="flex items-center gap-2 text-muted-foreground group">
                  <div class="w-8 h-8 rounded-full bg-blue-500/10 flex items-center justify-center group-hover:bg-blue-500/20 transition-colors">
                    <Check class="w-4 h-4 text-blue-400" />
                  </div>
                  <span class="font-medium">Credits Never Expire</span>
                </div>
              </div>
            </div>
          </div>
        </div>
      </section>

    <!-- Features Section -->
    <section id="features" class="py-24 sm:py-32 relative overflow-hidden">
      <!-- Background gradient -->
      <div class="absolute inset-0 bg-gradient-to-br from-purple-500/5 via-background to-indigo-500/5"></div>
      <div class="relative max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 z-10">
        <!-- Section Header -->
        <div class="text-center mb-20">
          <div class="inline-flex items-center gap-2 px-4 py-2 bg-gradient-to-r from-purple-500/10 to-indigo-500/10 border border-purple-500/20 rounded-full text-sm font-medium mb-6">
            <Sparkles class="w-4 h-4 text-purple-400" />
            <span class="text-foreground/90">Why Creators Choose Clippster</span>
          </div>
          <h2 class="text-4xl sm:text-5xl font-bold mb-6 leading-tight">
            Built for <span class="bg-gradient-to-r from-purple-400 to-indigo-400 bg-clip-text text-transparent">modern creators</span>
          </h2>
          <p class="text-lg sm:text-xl text-muted-foreground/90 max-w-3xl mx-auto leading-relaxed">
            The professional choice for content creation and clip generation. Join thousands of creators who've already made the switch.
          </p>
        </div>

        <!-- Features Grid -->
        <div class="grid md:grid-cols-3 gap-6 lg:gap-8 max-w-6xl mx-auto">
          <!-- Feature 1: Cost Savings -->
          <div class="group relative">
            <div class="absolute inset-0 bg-gradient-to-br from-purple-500/20 to-indigo-500/20 rounded-2xl opacity-0 group-hover:opacity-100 transition-opacity duration-300 blur-xl"></div>
            <div class="relative bg-card/50 backdrop-blur-sm border border-border/50 rounded-2xl p-8 h-full group-hover:border-purple-500/50 transition-all duration-300 group-hover:shadow-2xl group-hover:shadow-purple-500/10 group-hover:-translate-y-1">
              <!-- Icon -->
              <div class="inline-flex items-center justify-center w-14 h-14 bg-gradient-to-br from-purple-500/20 to-indigo-500/20 rounded-xl mb-6 group-hover:scale-110 transition-transform duration-300">
                <DollarSign class="w-7 h-7 text-purple-300" />
              </div>

              <!-- Content -->
              <div class="space-y-4">
                <div class="flex items-center gap-2 flex-wrap">
                  <h3 class="text-2xl font-bold">Save 72-81%</h3>
                  <span class="px-2.5 py-1 bg-green-500/10 text-green-400 text-xs font-semibold rounded-full border border-green-500/20">Best Value</span>
                </div>
                <p class="text-muted-foreground/90 leading-relaxed text-[15px]">
                  One-time payment instead of expensive subscriptions. Keep more of your earnings while getting professional results that rival any subscription service.
                </p>
              </div>
            </div>
          </div>

          <!-- Feature 2: Privacy -->
          <div class="group relative">
            <div class="absolute inset-0 bg-gradient-to-br from-indigo-500/20 to-blue-500/20 rounded-2xl opacity-0 group-hover:opacity-100 transition-opacity duration-300 blur-xl"></div>
            <div class="relative bg-card/50 backdrop-blur-sm border border-border/50 rounded-2xl p-8 h-full group-hover:border-indigo-500/50 transition-all duration-300 group-hover:shadow-2xl group-hover:shadow-indigo-500/10 group-hover:-translate-y-1">
              <!-- Icon -->
              <div class="inline-flex items-center justify-center w-14 h-14 bg-gradient-to-br from-indigo-500/20 to-blue-500/20 rounded-xl mb-6 group-hover:scale-110 transition-transform duration-300">
                <Shield class="w-7 h-7 text-indigo-300" />
              </div>

              <!-- Content -->
              <div class="space-y-4">
                <div class="flex items-center gap-2 flex-wrap">
                  <h3 class="text-2xl font-bold">Privacy First</h3>
                  <span class="px-2.5 py-1 bg-blue-500/10 text-blue-400 text-xs font-semibold rounded-full border border-blue-500/20">Secure</span>
                </div>
                <p class="text-muted-foreground/90 leading-relaxed text-[15px]">
                  Desktop application processes everything locally. Your content never leaves your computer, keeping it secure and private. Perfect for sensitive content and professional creators.
                </p>
              </div>
            </div>
          </div>

          <!-- Feature 3: Crypto -->
          <div class="group relative">
            <div class="absolute inset-0 bg-gradient-to-br from-emerald-500/20 to-purple-500/20 rounded-2xl opacity-0 group-hover:opacity-100 transition-opacity duration-300 blur-xl"></div>
            <div class="relative bg-card/50 backdrop-blur-sm border border-border/50 rounded-2xl p-8 h-full group-hover:border-emerald-500/50 transition-all duration-300 group-hover:shadow-2xl group-hover:shadow-emerald-500/10 group-hover:-translate-y-1">
              <!-- Icon -->
              <div class="inline-flex items-center justify-center w-14 h-14 bg-gradient-to-br from-emerald-500/20 to-purple-500/20 rounded-xl mb-6 group-hover:scale-110 transition-transform duration-300">
                <Coins class="w-7 h-7 text-emerald-300" />
              </div>

              <!-- Content -->
              <div class="space-y-4">
                <div class="flex items-center gap-2 flex-wrap">
                  <h3 class="text-2xl font-bold">Crypto Native</h3>
                  <span class="px-2.5 py-1 bg-purple-500/10 text-purple-400 text-xs font-semibold rounded-full border border-purple-500/20">Web3</span>
                </div>
                <p class="text-muted-foreground/90 leading-relaxed text-[15px]">
                  Pay instantly with SOL via Phantom wallet. No credit cards, no forms, no borders. Web3 payments designed for the modern creator economy.
                </p>
              </div>
            </div>
          </div>
        </div>

              </div>
    </section>

     <!-- How It Works -->
     <section id="how" role="region" aria-labelledby="how-heading" class="relative py-24 sm:py-32 overflow-hidden">
       <!-- Background -->
       <div class="absolute inset-0 bg-card/20"></div>
       
       <div class="relative max-w-5xl mx-auto px-4 sm:px-6 lg:px-8 z-10">
        <!-- Section Header -->
        <div class="text-center space-y-4 mb-16 sm:mb-20">
          <h2 id="how-heading" class="text-4xl sm:text-5xl font-bold leading-tight">
            Simple. Fast. <span class="bg-gradient-to-r from-purple-400 to-indigo-400 bg-clip-text text-transparent">Effective.</span>
          </h2>
          <p class="text-muted-foreground/90 text-lg sm:text-xl">
            Get viral clips in 3 easy steps
          </p>
        </div>

        <!-- Steps -->
        <div class="relative space-y-8 sm:space-y-10">
          <!-- Connecting line -->
          <div class="absolute left-5 sm:left-6 top-0 bottom-0 w-0.5 bg-gradient-to-b from-purple-500/50 via-indigo-500/50 to-purple-500/50 hidden sm:block"></div>
          
          <!-- Step 1 -->
          <div class="relative flex gap-4 sm:gap-6 items-start group">
            <div class="relative z-10 w-10 h-10 sm:w-12 sm:h-12 rounded-full bg-gradient-to-br from-purple-600 to-indigo-600 flex items-center justify-center font-bold text-lg sm:text-xl flex-shrink-0 shadow-lg shadow-purple-500/50 group-hover:scale-110 transition-transform duration-200">
              1
            </div>
            <div class="flex-1 bg-card/30 backdrop-blur-sm border border-border/50 rounded-xl p-6 group-hover:border-purple-500/50 transition-all duration-200 group-hover:shadow-lg group-hover:shadow-purple-500/10">
              <h3 class="text-xl sm:text-2xl font-bold mb-3">Upload Your Stream</h3>
              <p class="text-base text-muted-foreground/90 leading-relaxed">
                Drop your VOD, stream recording, or long-form video. We support all major formats including MP4, MOV, AVI, and more.
              </p>
            </div>
          </div>

          <!-- Step 2 -->
          <div class="relative flex gap-4 sm:gap-6 items-start group">
            <div class="relative z-10 w-10 h-10 sm:w-12 sm:h-12 rounded-full bg-gradient-to-br from-purple-600 to-indigo-600 flex items-center justify-center font-bold text-lg sm:text-xl flex-shrink-0 shadow-lg shadow-purple-500/50 group-hover:scale-110 transition-transform duration-200">
              2
            </div>
            <div class="flex-1 bg-card/30 backdrop-blur-sm border border-border/50 rounded-xl p-6 group-hover:border-purple-500/50 transition-all duration-200 group-hover:shadow-lg group-hover:shadow-purple-500/10">
              <h3 class="text-xl sm:text-2xl font-bold mb-3">AI Finds the Best Moments</h3>
              <p class="text-base text-muted-foreground/90 leading-relaxed">
                Our intelligent algorithms analyze your content and identify highlight-worthy moments automatically. Sit back and let AI do the work.
              </p>
            </div>
          </div>

          <!-- Step 3 -->
          <div class="relative flex gap-4 sm:gap-6 items-start group">
            <div class="relative z-10 w-10 h-10 sm:w-12 sm:h-12 rounded-full bg-gradient-to-br from-purple-600 to-indigo-600 flex items-center justify-center font-bold text-lg sm:text-xl flex-shrink-0 shadow-lg shadow-purple-500/50 group-hover:scale-110 transition-transform duration-200">
              3
            </div>
            <div class="flex-1 bg-card/30 backdrop-blur-sm border border-border/50 rounded-xl p-6 group-hover:border-purple-500/50 transition-all duration-200 group-hover:shadow-lg group-hover:shadow-purple-500/10">
              <h3 class="text-xl sm:text-2xl font-bold mb-3">Download & Share</h3>
              <p class="text-base text-muted-foreground/90 leading-relaxed">
                Get your perfectly-cut clips ready for TikTok, YouTube Shorts, Instagram Reels, and more. Export in any format you need.
              </p>
            </div>
          </div>
        </div>
      </div>
    </section>

     <!-- Pricing Section -->
     <section id="pricing" class="relative py-24 sm:py-32 overflow-hidden">
       <!-- Background decoration -->
       <div class="absolute inset-0 bg-gradient-to-br from-indigo-500/5 via-background to-purple-500/5"></div>
      
      <div class="relative max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
        <!-- Section Header -->
        <div class="text-center mb-16">
          <h2 class="text-4xl sm:text-5xl font-bold mb-4 leading-tight">
            Choose Your <span class="bg-gradient-to-r from-purple-400 to-indigo-400 bg-clip-text text-transparent">Credit Pack</span>
          </h2>
          <p class="text-lg sm:text-xl text-muted-foreground/90 max-w-2xl mx-auto">
            Pay once, use forever. No subscriptions, no expiration dates.
          </p>
        </div>

        <!-- Pricing Grid -->
        <div class="grid sm:grid-cols-2 lg:grid-cols-4 gap-6 lg:gap-6">
          <!-- Starter Pack -->
          <div class="group relative overflow-hidden rounded-2xl border border-border/50 bg-card/50 backdrop-blur-sm hover:border-purple-500/50 transition-all duration-300 cursor-pointer h-full flex flex-col hover:-translate-y-1 hover:shadow-xl hover:shadow-purple-500/10">
            <div class="p-6 flex-1 flex flex-col">
              <h3 class="text-2xl font-bold mb-3">Starter</h3>
              <div class="mb-4">
                <span class="text-5xl font-bold text-foreground">5</span>
                <span class="text-lg text-muted-foreground ml-2">hours</span>
              </div>
              <div class="mb-6 pb-6 border-b border-border/50">
                <div class="text-4xl font-bold mb-1">$10</div>
                <div class="text-sm text-muted-foreground mt-1">$2.00 per hour</div>
              </div>
              <ul class="space-y-3 mb-8 flex-1">
                <li class="flex items-start gap-3 text-sm text-muted-foreground/90">
                  <Check class="h-5 w-5 text-green-400 flex-shrink-0 mt-0.5" />
                  <span>Credits never expire</span>
                </li>
                <li class="flex items-start gap-3 text-sm text-muted-foreground/90">
                  <Check class="h-5 w-5 text-green-400 flex-shrink-0 mt-0.5" />
                  <span>Use anytime, no limits</span>
                </li>
                <li class="flex items-start gap-3 text-sm text-muted-foreground/90">
                  <Check class="h-5 w-5 text-green-400 flex-shrink-0 mt-0.5" />
                  <span>~2-5 videos</span>
                </li>
              </ul>
              <div class="text-center text-xs text-muted-foreground py-3 px-4 bg-muted/50 rounded-lg">
                Download the app to purchase
              </div>
            </div>
          </div>

          <!-- Creator Pack (Popular) -->
          <div class="relative lg:scale-105 z-10">
            <div class="absolute -top-4 left-1/2 transform -translate-x-1/2 bg-gradient-to-r from-purple-600 to-indigo-600 text-white text-xs font-bold px-4 py-1.5 rounded-full z-20 whitespace-nowrap shadow-lg">
              ⭐ MOST POPULAR
            </div>
            <div class="group relative overflow-hidden rounded-2xl border-2 border-purple-500 bg-card shadow-2xl shadow-purple-500/30 h-full flex flex-col hover:-translate-y-1 hover:shadow-purple-500/40 transition-all duration-300">
              <div class="absolute inset-0 bg-gradient-to-br from-purple-500/10 to-indigo-500/10 pointer-events-none"></div>
              <div class="relative p-6 flex-1 flex flex-col">
                <h3 class="text-2xl font-bold mb-3 text-purple-300">Creator</h3>
                <div class="mb-4">
                  <span class="text-5xl font-bold text-foreground">15</span>
                  <span class="text-lg text-muted-foreground ml-2">hours</span>
                </div>
                <div class="mb-6 pb-6 border-b border-purple-500/30">
                  <div class="text-4xl font-bold mb-1">$20</div>
                  <div class="text-sm text-purple-300 mt-1">$1.33 per hour</div>
                </div>
                <ul class="space-y-3 mb-8 flex-1">
                  <li class="flex items-start gap-3 text-sm text-muted-foreground/90">
                    <Check class="h-5 w-5 text-green-400 flex-shrink-0 mt-0.5" />
                    <span>Credits never expire</span>
                  </li>
                  <li class="flex items-start gap-3 text-sm text-muted-foreground/90">
                    <Check class="h-5 w-5 text-green-400 flex-shrink-0 mt-0.5" />
                    <span>Use anytime, no limits</span>
                  </li>
                  <li class="flex items-start gap-3 text-sm text-muted-foreground/90">
                    <Check class="h-5 w-5 text-green-400 flex-shrink-0 mt-0.5" />
                    <span>~7-15 videos</span>
                  </li>
                </ul>
                <div class="text-center text-xs text-muted-foreground py-3 px-4 bg-purple-500/10 rounded-lg border border-purple-500/20">
                  Download the app to purchase
                </div>
              </div>
            </div>
          </div>

          <!-- Pro Pack -->
          <div class="group relative overflow-hidden rounded-2xl border border-border/50 bg-card/50 backdrop-blur-sm hover:border-purple-500/50 transition-all duration-300 cursor-pointer h-full flex flex-col hover:-translate-y-1 hover:shadow-xl hover:shadow-purple-500/10">
            <div class="p-6 flex-1 flex flex-col">
              <h3 class="text-2xl font-bold mb-3">Pro</h3>
              <div class="mb-4">
                <span class="text-5xl font-bold text-foreground">50</span>
                <span class="text-lg text-muted-foreground ml-2">hours</span>
              </div>
              <div class="mb-6 pb-6 border-b border-border/50">
                <div class="text-4xl font-bold mb-1">$50</div>
                <div class="text-sm text-muted-foreground mt-1">$1.00 per hour</div>
              </div>
              <ul class="space-y-3 mb-8 flex-1">
                <li class="flex items-start gap-3 text-sm text-muted-foreground/90">
                  <Check class="h-5 w-5 text-green-400 flex-shrink-0 mt-0.5" />
                  <span>Credits never expire</span>
                </li>
                <li class="flex items-start gap-3 text-sm text-muted-foreground/90">
                  <Check class="h-5 w-5 text-green-400 flex-shrink-0 mt-0.5" />
                  <span>Use anytime, no limits</span>
                </li>
                <li class="flex items-start gap-3 text-sm text-muted-foreground/90">
                  <Check class="h-5 w-5 text-green-400 flex-shrink-0 mt-0.5" />
                  <span>~25-50 videos</span>
                </li>
              </ul>
              <div class="text-center text-xs text-muted-foreground py-3 px-4 bg-muted/50 rounded-lg">
                Download the app to purchase
              </div>
            </div>
          </div>

          <!-- Studio Pack -->
          <div class="group relative overflow-hidden rounded-2xl border border-border/50 bg-card/50 backdrop-blur-sm hover:border-purple-500/50 transition-all duration-300 cursor-pointer h-full flex flex-col hover:-translate-y-1 hover:shadow-xl hover:shadow-purple-500/10">
            <div class="absolute top-3 right-3 px-2 py-1 bg-indigo-500/20 text-indigo-300 text-xs font-semibold rounded-md border border-indigo-500/30">
              Best Deal
            </div>
            <div class="p-6 flex-1 flex flex-col">
              <h3 class="text-2xl font-bold mb-3">Studio</h3>
              <div class="mb-4">
                <span class="text-5xl font-bold text-foreground">250</span>
                <span class="text-lg text-muted-foreground ml-2">hours</span>
              </div>
              <div class="mb-6 pb-6 border-b border-border/50">
                <div class="text-4xl font-bold mb-1">$200</div>
                <div class="text-sm text-muted-foreground mt-1">$0.80 per hour</div>
              </div>
              <ul class="space-y-3 mb-8 flex-1">
                <li class="flex items-start gap-3 text-sm text-muted-foreground/90">
                  <Check class="h-5 w-5 text-green-400 flex-shrink-0 mt-0.5" />
                  <span>Credits never expire</span>
                </li>
                <li class="flex items-start gap-3 text-sm text-muted-foreground/90">
                  <Check class="h-5 w-5 text-green-400 flex-shrink-0 mt-0.5" />
                  <span>Use anytime, no limits</span>
                </li>
                <li class="flex items-start gap-3 text-sm text-muted-foreground/90">
                  <Check class="h-5 w-5 text-green-400 flex-shrink-0 mt-0.5" />
                  <span>~125-250 videos</span>
                </li>
              </ul>
              <div class="text-center text-xs text-muted-foreground py-3 px-4 bg-muted/50 rounded-lg">
                Download the app to purchase
              </div>
            </div>
          </div>
        </div>

        <!-- Trust Badge -->
        <div class="mt-16 text-center">
          <div class="inline-flex items-center gap-3 px-8 py-4 rounded-2xl bg-gradient-to-r from-purple-500/10 to-indigo-500/10 border border-purple-500/20 backdrop-blur-sm">
            <Check class="w-5 h-5 text-purple-400 flex-shrink-0" />
            <span class="text-sm sm:text-base font-medium text-muted-foreground">
              Trusted by content creators • <span class="text-purple-400 font-semibold">No subscriptions</span> • Credits never expire
            </span>
          </div>
        </div>
      </div>
    </section>

     <!-- Download Section -->
     <section id="download" class="py-24 sm:py-32 relative overflow-hidden">
       <!-- Background gradient -->
       <div class="absolute inset-0 bg-card/30"></div>

      <div class="relative max-w-6xl mx-auto px-4 sm:px-6 lg:px-8 z-10">
        <div class="text-center">
          <!-- Badge -->
          <div class="inline-flex items-center gap-2 px-4 py-2 bg-gradient-to-r from-purple-500/10 to-indigo-500/10 border border-purple-500/20 rounded-full text-sm font-medium mb-8">
            <Zap class="w-4 h-4 text-purple-400" />
            <span class="text-foreground/90">Available Now</span>
          </div>

          <h2 class="text-4xl sm:text-6xl font-bold mb-6 leading-tight">
            Ready to <span class="bg-gradient-to-r from-purple-400 to-indigo-400 bg-clip-text text-transparent">create?</span>
          </h2>
          <p class="text-lg sm:text-xl text-muted-foreground/90 max-w-2xl mx-auto mb-16 leading-relaxed">
            Join thousands of creators who are already saving time and money with Clippster.
            Download now and turn your long videos into viral clips in minutes.
          </p>

          <!-- Platform Cards -->
          <div class="grid sm:grid-cols-2 gap-6 lg:gap-8 max-w-3xl mx-auto">
            <!-- Main Platform Card -->
            <div class="relative group">
              <div class="absolute inset-0 bg-gradient-to-br from-purple-600/30 to-indigo-600/30 rounded-2xl opacity-0 group-hover:opacity-100 transition-opacity duration-300 blur-xl"></div>
              <div class="relative bg-card/50 backdrop-blur-sm border-2 border-purple-500/50 rounded-2xl p-8 sm:p-10 h-full group-hover:border-purple-500 transition-all duration-300 group-hover:shadow-2xl group-hover:shadow-purple-500/20 group-hover:-translate-y-1">
                <div class="text-center">
                  <div class="inline-flex items-center justify-center w-20 h-20 bg-gradient-to-br from-purple-500/20 to-indigo-500/20 rounded-2xl mb-6 group-hover:scale-110 transition-transform duration-300">
                    <!-- Windows Icon -->
                    <svg v-if="platform === 'windows'" class="w-10 h-10 text-purple-300" viewBox="0 0 24 24" fill="currentColor">
                      <path d="M0 3.449L9.75 2.1v9.451H0m10.949-9.602L24 0v11.4H10.949M0 12.6h9.75v9.451L0 20.699M10.949 12.6H24V24l-12.9-1.801"/>
                    </svg>
                    <!-- macOS Icon -->
                    <svg v-else-if="platform === 'macos'" class="w-10 h-10 text-purple-300" viewBox="0 0 24 24" fill="currentColor">
                      <path d="M18.71 19.5c-.83 1.24-1.71 2.45-3.05 2.47-1.34.03-1.77-.79-3.29-.79-1.53 0-2 .77-3.27.82-1.31.05-2.3-1.32-3.14-2.53C4.25 17 2.94 12.45 4.7 9.39c.87-1.52 2.43-2.48 4.12-2.51 1.28-.02 2.5.87 3.29.87.78 0 2.26-1.07 3.81-.91.65.03 2.47.26 3.64 1.98-.09.06-2.17 1.28-2.15 3.81.03 3.02 2.65 4.03 2.68 4.04-.03.07-.42 1.44-1.38 2.83M13 3.5c.73-.83 1.94-1.46 2.94-1.5.13 1.17-.34 2.35-1.04 3.19-.69.85-1.83 1.51-2.95 1.42-.15-1.15.41-2.35 1.05-3.11z"/>
                    </svg>
                    <!-- Fallback icon -->
                    <Scissors v-else class="w-10 h-10 text-purple-300" />
                  </div>
                  <h3 class="text-2xl font-bold mb-2">{{ getPlatformName(platform) }}</h3>
                  <p class="text-sm text-muted-foreground/90 mb-8">Recommended for your system</p>
                   <a v-if="platform !== 'unknown'" href="#" class="group inline-flex items-center justify-center w-full px-8 py-4 text-base font-semibold text-white bg-gradient-to-r from-purple-600 to-indigo-600 rounded-xl hover:from-purple-500 hover:to-indigo-500 transition-all duration-200 shadow-lg shadow-purple-500/40 hover:shadow-purple-500/60">
                     Download Now
                     <svg class="ml-2 w-5 h-5 group-hover:translate-x-1 transition-transform" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                       <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M4 16v1a3 3 0 003 3h10a3 3 0 003-3v-1m-4-4l-4 4m0 0l-4-4m4 4V4"/>
                     </svg>
                   </a>
                </div>
              </div>
            </div>

            <!-- Alternative Platform Card -->
            <div v-if="otherPlatform" class="relative group">
              <div class="absolute inset-0 bg-gradient-to-br from-muted/30 to-muted/30 rounded-2xl opacity-0 group-hover:opacity-100 transition-opacity duration-300 blur-xl"></div>
              <div class="relative bg-card/30 backdrop-blur-sm border border-border/50 rounded-2xl p-8 sm:p-10 h-full group-hover:border-border transition-all duration-300 group-hover:shadow-lg group-hover:-translate-y-1">
                <div class="text-center">
                  <div class="inline-flex items-center justify-center w-20 h-20 bg-muted/50 rounded-2xl mb-6 group-hover:scale-110 transition-transform duration-300">
                    <!-- Windows Icon -->
                    <svg v-if="otherPlatform === 'windows'" class="w-10 h-10 text-muted-foreground" viewBox="0 0 24 24" fill="currentColor">
                      <path d="M0 3.449L9.75 2.1v9.451H0m10.949-9.602L24 0v11.4H10.949M0 12.6h9.75v9.451L0 20.699M10.949 12.6H24V24l-12.9-1.801"/>
                    </svg>
                    <!-- macOS Icon -->
                    <svg v-else-if="otherPlatform === 'macos'" class="w-10 h-10 text-muted-foreground" viewBox="0 0 24 24" fill="currentColor">
                      <path d="M18.71 19.5c-.83 1.24-1.71 2.45-3.05 2.47-1.34.03-1.77-.79-3.29-.79-1.53 0-2 .77-3.27.82-1.31.05-2.3-1.32-3.14-2.53C4.25 17 2.94 12.45 4.7 9.39c.87-1.52 2.43-2.48 4.12-2.51 1.28-.02 2.5.87 3.29.87.78 0 2.26-1.07 3.81-.91.65.03 2.47.26 3.64 1.98-.09.06-2.17 1.28-2.15 3.81.03 3.02 2.65 4.03 2.68 4.04-.03.07-.42 1.44-1.38 2.83M13 3.5c.73-.83 1.94-1.46 2.94-1.5.13 1.17-.34 2.35-1.04 3.19-.69.85-1.83 1.51-2.95 1.42-.15-1.15.41-2.35 1.05-3.11z"/>
                    </svg>
                    <!-- Fallback icon -->
                    <Scissors v-else class="w-10 h-10 text-muted-foreground" />
                  </div>
                  <h3 class="text-2xl font-bold mb-2">{{ getPlatformName(otherPlatform) }}</h3>
                  <p class="text-sm text-muted-foreground/90 mb-8">Also available</p>
                  <a href="#" class="inline-flex items-center justify-center w-full px-8 py-4 text-base font-semibold text-foreground bg-card/50 border border-border/50 rounded-xl hover:bg-card hover:border-border transition-all duration-200">
                    Download
                  </a>
                </div>
              </div>
            </div>
          </div>
        </div>
      </div>
    </section>

    </main>

    <!-- Footer -->
    <footer class="border-t border-border/50 bg-card/20 backdrop-blur-sm py-16">
      <div class="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
        <div class="grid grid-cols-1 md:grid-cols-3 gap-12 mb-12">
          <!-- Brand Column -->
          <div class="space-y-4">
            <div class="flex items-center">
              <img src="/logo.svg" alt="Clippster" class="h-8 w-auto">
            </div>
            <p class="text-sm text-muted-foreground/80 leading-relaxed max-w-xs">
              AI-powered video clip generation. Turn long videos into viral clips in minutes.
            </p>
            <div class="flex items-center gap-2 text-sm">
              <div class="w-2 h-2 bg-green-400 rounded-full animate-pulse"></div>
              <span class="text-muted-foreground/80">Available for Windows & macOS</span>
            </div>
          </div>

          <!-- Quick Links Column -->
          <div class="space-y-4">
            <h3 class="text-sm font-semibold text-foreground uppercase tracking-wider">Quick Links</h3>
            <ul class="space-y-3">
              <li>
                <a href="#features" class="text-sm text-muted-foreground/80 hover:text-foreground transition-colors flex items-center gap-2 group">
                  <span class="w-1 h-1 bg-purple-400 rounded-full opacity-0 group-hover:opacity-100 transition-opacity"></span>
                  Features
                </a>
              </li>
              <li>
                <a href="#pricing" class="text-sm text-muted-foreground/80 hover:text-foreground transition-colors flex items-center gap-2 group">
                  <span class="w-1 h-1 bg-purple-400 rounded-full opacity-0 group-hover:opacity-100 transition-opacity"></span>
                  Pricing
                </a>
              </li>
              <li>
                <a href="#download" class="text-sm text-muted-foreground/80 hover:text-foreground transition-colors flex items-center gap-2 group">
                  <span class="w-1 h-1 bg-purple-400 rounded-full opacity-0 group-hover:opacity-100 transition-opacity"></span>
                  Download
                </a>
              </li>
            </ul>
          </div>

          <!-- Trust & Security Column -->
          <div class="space-y-4">
            <h3 class="text-sm font-semibold text-foreground uppercase tracking-wider">Why Clippster?</h3>
            <ul class="space-y-3">
              <li class="flex items-start gap-2 text-sm text-muted-foreground/80">
                <Check class="w-4 h-4 text-green-400 flex-shrink-0 mt-0.5" />
                <span>72-81% cost savings</span>
              </li>
              <li class="flex items-start gap-2 text-sm text-muted-foreground/80">
                <Check class="w-4 h-4 text-green-400 flex-shrink-0 mt-0.5" />
                <span>Privacy-first local processing</span>
              </li>
              <li class="flex items-start gap-2 text-sm text-muted-foreground/80">
                <Check class="w-4 h-4 text-green-400 flex-shrink-0 mt-0.5" />
                <span>No subscriptions or expiration</span>
              </li>
              <li class="flex items-start gap-2 text-sm text-muted-foreground/80">
                <Check class="w-4 h-4 text-green-400 flex-shrink-0 mt-0.5" />
                <span>Crypto-native payments</span>
              </li>
            </ul>
          </div>
        </div>

        <!-- Footer Bottom -->
        <div class="pt-8 border-t border-border/50 flex flex-col sm:flex-row justify-between items-center gap-4">
          <div class="text-sm text-muted-foreground/70">
            © 2025 Clippster. All rights reserved.
          </div>
          <div class="flex items-center gap-6">
            <a href="#" class="text-sm text-muted-foreground/70 hover:text-foreground transition-colors">Privacy Policy</a>
            <a href="#" class="text-sm text-muted-foreground/70 hover:text-foreground transition-colors">Terms of Service</a>
          </div>
        </div>
      </div>
    </footer>
  </div>
</template>
