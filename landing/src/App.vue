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
    <header class="border-b border-border/50 bg-background/95 backdrop-blur-sm sticky top-0 z-50">
      <div class="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
        <div class="flex justify-between items-center h-16">
          <!-- Logo -->
          <div class="flex items-center">
            <img src="/logo.svg" alt="Clippster" class="h-8 w-auto">
          </div>

          <!-- Desktop Navigation -->
          <nav class="hidden lg:flex items-center space-x-8">
            <a href="#features" class="text-sm font-medium text-muted-foreground hover:text-foreground transition-colors">Features</a>
            <a href="#pricing" class="text-sm font-medium text-muted-foreground hover:text-foreground transition-colors">Pricing</a>
            <a href="#download" class="text-sm font-medium text-muted-foreground hover:text-foreground transition-colors">Download</a>
          </nav>

          <!-- CTA Button -->
          <div class="hidden lg:block">
            <a href="#pricing" class="px-4 py-2 text-sm font-medium text-foreground bg-card border border-border rounded-lg hover:bg-muted transition-colors">
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
        <div v-show="mobileMenuOpen" class="lg:hidden border-t border-border/50">
          <div class="px-2 pt-2 pb-3 space-y-1">
            <a href="#features" class="block px-3 py-2 text-base font-medium text-muted-foreground hover:text-foreground hover:bg-muted/50 rounded-md transition-colors" @click="closeMobileMenu">
              Features
            </a>
            <a href="#pricing" class="block px-3 py-2 text-base font-medium text-muted-foreground hover:text-foreground hover:bg-muted/50 rounded-md transition-colors" @click="closeMobileMenu">
              Pricing
            </a>
            <a href="#download" class="block px-3 py-2 text-base font-medium text-muted-foreground hover:text-foreground hover:bg-muted/50 rounded-md transition-colors" @click="closeMobileMenu">
              Download
            </a>
            <a href="#pricing" class="block w-full px-4 py-2 mt-4 text-center text-base font-medium text-primary-foreground bg-primary hover:bg-primary/90 rounded-md transition-colors" @click="closeMobileMenu">
              Get Started
            </a>
          </div>
        </div>
      </div>
    </header>

    <!-- Hero Section -->
    <main>
      <section class="py-24 sm:py-32">
        <div class="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div class="text-center">
            <div class="max-w-4xl mx-auto">
              <!-- Badge -->
              <div class="inline-flex items-center px-3 py-1 rounded-full text-sm font-medium bg-muted/50 border border-border/50 mb-8">
                <Sparkles class="w-4 h-4 mr-2 text-purple-400" />
                AI-Powered Video Clip Generation
              </div>

              <!-- Main Heading -->
              <h1 class="text-4xl sm:text-6xl lg:text-7xl font-bold tracking-tight">
                Turn long videos into
                <span class="block mt-2 bg-gradient-to-r from-purple-400 to-indigo-400 bg-clip-text text-transparent">
                  viral clips
                </span>
              </h1>

              <!-- Description -->
              <p class="mt-6 text-lg sm:text-xl text-muted-foreground max-w-2xl mx-auto leading-relaxed">
                AI finds your best moments and turns them into viral clips for TikTok, YouTube Shorts, and Instagram Reels.
                Save 72-81% compared to subscription-based alternatives while keeping your videos private on your computer.
              </p>

              <!-- CTA Buttons -->
              <div class="mt-10 flex flex-col sm:flex-row gap-4 justify-center">
                <a href="#download" class="inline-flex items-center justify-center px-8 py-3 text-base font-medium text-primary-foreground bg-primary rounded-lg hover:bg-primary/90 transition-colors">
                  Download Clippster
                </a>
                <a href="#pricing" class="inline-flex items-center justify-center px-8 py-3 text-base font-medium text-foreground bg-card border border-border rounded-lg hover:bg-muted transition-colors">
                  View Pricing
                </a>
              </div>

              <!-- Trust indicators -->
              <div class="mt-8 flex flex-wrap justify-center items-center gap-6 text-sm text-muted-foreground">
                <div class="flex items-center">
                  <Shield class="w-4 h-4 mr-2" />
                  Privacy First
                </div>
                <div class="flex items-center">
                  <Coins class="w-4 h-4 mr-2" />
                  Crypto Payments
                </div>
                <div class="flex items-center">
                  <Check class="w-4 h-4 mr-2" />
                  Credits Never Expire
                </div>
              </div>
            </div>
          </div>
        </div>
      </section>

    <!-- Features Section -->
    <section id="features" class="py-24 sm:py-32 relative overflow-hidden">
      <!-- Background gradient -->
      <div class="absolute inset-0 bg-gradient-to-br from-primary/10 via-background to-primary/5"></div>
      <div class="relative max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 z-10">
        <!-- Section Header -->
        <div class="text-center mb-20">
          <div class="inline-flex items-center px-4 py-2 bg-gradient-to-r from-purple-500/10 to-indigo-500/10 border border-purple-500/20 rounded-full text-sm font-medium mb-6">
            <Sparkles class="w-4 h-4 mr-2 text-purple-400" />
            Why Creators Choose Clippster
          </div>
          <h2 class="text-4xl sm:text-5xl font-bold mb-6">
            Built for <span class="bg-gradient-to-r from-purple-400 to-indigo-400 bg-clip-text text-transparent">modern creators</span>
          </h2>
          <p class="text-xl text-muted-foreground max-w-3xl mx-auto leading-relaxed">
            The professional choice for content creation and clip generation. Join thousands of creators who've already made the switch.
          </p>
        </div>

        <!-- Features Grid -->
        <div class="grid md:grid-cols-3 gap-8 max-w-6xl mx-auto">
          <!-- Feature 1: Cost Savings -->
          <div class="group relative">
            <div class="bg-card border border-border rounded-2xl p-8 h-full hover:border-purple-500/50 transition-all duration-300 hover:shadow-lg">
              <!-- Icon -->
              <div class="inline-flex items-center justify-center w-12 h-12 bg-gradient-to-br from-purple-500/20 to-indigo-500/20 rounded-xl mb-6 group-hover:scale-110 transition-transform duration-300">
                <DollarSign class="w-6 h-6 text-purple-300" />
              </div>

              <!-- Content -->
              <div class="space-y-4">
                <div class="flex items-center gap-2">
                  <h3 class="text-xl font-semibold">Save 72-81%</h3>
                  <span class="px-2 py-1 bg-green-500/10 text-green-400 text-xs font-semibold rounded-full">Best Value</span>
                </div>
                <p class="text-muted-foreground leading-relaxed">
                  One-time payment instead of expensive subscriptions. Keep more of your earnings while getting professional results that rival any subscription service.
                </p>
                <div class="pt-2">
                  <span class="text-sm font-medium text-foreground">$2/hour vs $14/hour competition</span>
                </div>
              </div>
            </div>
          </div>

          <!-- Feature 2: Privacy -->
          <div class="group relative">
            <div class="bg-card border border-border rounded-2xl p-8 h-full hover:border-indigo-500/50 transition-all duration-300 hover:shadow-lg">
              <!-- Icon -->
              <div class="inline-flex items-center justify-center w-12 h-12 bg-gradient-to-br from-indigo-500/20 to-purple-500/20 rounded-xl mb-6 group-hover:scale-110 transition-transform duration-300">
                <Shield class="w-6 h-6 text-indigo-300" />
              </div>

              <!-- Content -->
              <div class="space-y-4">
                <div class="flex items-center gap-2">
                  <h3 class="text-xl font-semibold">Privacy First</h3>
                  <span class="px-2 py-1 bg-blue-500/10 text-blue-400 text-xs font-semibold rounded-full">Secure</span>
                </div>
                <p class="text-muted-foreground leading-relaxed">
                  Desktop application processes everything locally. Your content never leaves your computer, keeping it secure and private. Perfect for sensitive content and professional creators.
                </p>
                <div class="pt-2">
                  <span class="text-sm font-medium text-foreground">No cloud uploads • Local processing</span>
                </div>
              </div>
            </div>
          </div>

          <!-- Feature 3: Crypto -->
          <div class="group relative">
            <div class="bg-card border border-border rounded-2xl p-8 h-full hover:border-emerald-500/50 transition-all duration-300 hover:shadow-lg">
              <!-- Icon -->
              <div class="inline-flex items-center justify-center w-12 h-12 bg-gradient-to-br from-emerald-500/20 to-purple-500/20 rounded-xl mb-6 group-hover:scale-110 transition-transform duration-300">
                <Coins class="w-6 h-6 text-emerald-300" />
              </div>

              <!-- Content -->
              <div class="space-y-4">
                <div class="flex items-center gap-2">
                  <h3 class="text-xl font-semibold">Crypto Native</h3>
                  <span class="px-2 py-1 bg-purple-500/10 text-purple-400 text-xs font-semibold rounded-full">Web3</span>
                </div>
                <p class="text-muted-foreground leading-relaxed">
                  Pay instantly with SOL via Phantom wallet. No credit cards, no forms, no borders. Web3 payments designed for the modern creator economy.
                </p>
                <div class="pt-2">
                  <span class="text-sm font-medium text-foreground">Instant • Global • No KYC</span>
                </div>
              </div>
            </div>
          </div>
        </div>

              </div>
    </section>

    <!-- How It Works -->
    <section id="how" role="region" aria-labelledby="how-heading" class="container mx-auto px-4 sm:px-6 lg:px-8 py-16 sm:py-20">
      <div class="max-w-4xl mx-auto">
        <!-- Section Header -->
        <div class="text-center space-y-3 sm:space-y-4 mb-12 sm:mb-16">
          <h2 id="how-heading" class="text-3xl sm:text-4xl md:text-5xl font-bold leading-tight">
            Simple. Fast. Effective.
          </h2>
          <p class="text-muted-foreground text-base sm:text-lg md:text-xl">
            Get viral clips in 3 easy steps
          </p>
        </div>

        <!-- Steps -->
        <div class="space-y-8 sm:space-y-12">
          <!-- Step 1 -->
          <div class="flex gap-4 sm:gap-6 items-start">
            <div class="w-10 h-10 sm:w-12 sm:h-12 rounded-full bg-primary text-primary-foreground flex items-center justify-center font-bold text-lg sm:text-xl flex-shrink-0">
              1
            </div>
            <div class="space-y-2 sm:space-y-3 flex-1">
              <h3 class="text-lg sm:text-xl font-semibold">Upload Your Stream</h3>
              <p class="text-sm sm:text-base text-muted-foreground leading-relaxed">
                Drop your VOD, stream recording, or long-form video. We support all major formats.
              </p>
            </div>
          </div>

          <!-- Step 2 -->
          <div class="flex gap-4 sm:gap-6 items-start">
            <div class="w-10 h-10 sm:w-12 sm:h-12 rounded-full bg-primary text-primary-foreground flex items-center justify-center font-bold text-lg sm:text-xl flex-shrink-0">
              2
            </div>
            <div class="space-y-2 sm:space-y-3 flex-1">
              <h3 class="text-lg sm:text-xl font-semibold">AI Finds the Best Moments</h3>
              <p class="text-sm sm:text-base text-muted-foreground leading-relaxed">
                Our intelligent algorithms analyze your content and identify highlight-worthy moments automatically.
              </p>
            </div>
          </div>

          <!-- Step 3 -->
          <div class="flex gap-4 sm:gap-6 items-start">
            <div class="w-10 h-10 sm:w-12 sm:h-12 rounded-full bg-primary text-primary-foreground flex items-center justify-center font-bold text-lg sm:text-xl flex-shrink-0">
              3
            </div>
            <div class="space-y-2 sm:space-y-3 flex-1">
              <h3 class="text-lg sm:text-xl font-semibold">Download & Share</h3>
              <p class="text-sm sm:text-base text-muted-foreground leading-relaxed">
                Get your perfectly-cut clips ready for TikTok, YouTube Shorts, Instagram Reels, and more.
              </p>
            </div>
          </div>
        </div>
      </div>
    </section>

    <!-- Pricing Section -->
    <section id="pricing" class="py-24 sm:py-32">
      <div class="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
        <!-- Section Header -->
        <div class="text-center mb-16">
          <h2 class="text-3xl sm:text-4xl font-bold mb-4">
            Choose Your <span class="bg-gradient-to-r from-purple-400 to-indigo-400 bg-clip-text text-transparent">Credit Pack</span>
          </h2>
          <p class="text-xl text-muted-foreground max-w-2xl mx-auto">
            Pay once, use forever. No subscriptions, no expiration dates.
          </p>
        </div>

        <!-- Pricing Grid -->
        <div class="grid sm:grid-cols-2 lg:grid-cols-4 gap-6">
          <!-- Starter Pack -->
          <div class="relative overflow-hidden rounded-2xl border border-border bg-card hover:border-purple-500/50 transition-all cursor-pointer h-full flex flex-col">
            <div class="p-6 flex-1 flex flex-col">
              <h3 class="text-2xl font-bold mb-2">Starter</h3>
              <div class="mb-4">
                <span class="text-4xl font-bold text-foreground">5</span>
                <span class="text-muted-foreground ml-2">hours</span>
              </div>
              <div class="mb-6">
                <div class="text-3xl font-bold mb-1">$10</div>
                <div class="text-xs text-muted-foreground mt-1">$2/hour</div>
              </div>
              <ul class="space-y-2.5 mb-6 flex-1">
                <li class="flex items-center gap-2 text-sm text-muted-foreground">
                  <Check class="h-4 w-4 text-green-500 flex-shrink-0" />
                  <span>Credits never expire</span>
                </li>
                <li class="flex items-center gap-2 text-sm text-muted-foreground">
                  <Check class="h-4 w-4 text-green-500 flex-shrink-0" />
                  <span>Use anytime, no limits</span>
                </li>
                <li class="flex items-center gap-2 text-sm text-muted-foreground">
                  <Check class="h-4 w-4 text-green-500 flex-shrink-0" />
                  <span>~2-5 videos</span>
                </li>
              </ul>
              <div class="text-center text-sm text-muted-foreground">
                Download the app to purchase
              </div>
            </div>
          </div>

          <!-- Creator Pack (Popular) -->
          <div class="relative ring-2 ring-purple-500 rounded-2xl">
            <div class="absolute -top-4 left-1/2 transform -translate-x-1/2 bg-gradient-to-r from-purple-600 to-indigo-600 text-white text-xs font-bold px-4 py-1 rounded-full z-10 whitespace-nowrap">
              ⭐ MOST POPULAR
            </div>
            <div class="relative overflow-hidden rounded-2xl border border-purple-500 bg-card shadow-lg shadow-purple-500/20 h-full flex flex-col">
              <div class="p-6 flex-1 flex flex-col">
                <h3 class="text-2xl font-bold mb-2">Creator</h3>
                <div class="mb-4">
                  <span class="text-4xl font-bold text-foreground">15</span>
                  <span class="text-muted-foreground ml-2">hours</span>
                </div>
                <div class="mb-6">
                  <div class="text-3xl font-bold mb-1">$20</div>
                  <div class="text-xs text-muted-foreground mt-1">$1.33/hour</div>
                </div>
                <ul class="space-y-2.5 mb-6 flex-1">
                  <li class="flex items-center gap-2 text-sm text-muted-foreground">
                    <Check class="h-4 w-4 text-green-500 flex-shrink-0" />
                    <span>Credits never expire</span>
                  </li>
                  <li class="flex items-center gap-2 text-sm text-muted-foreground">
                    <Check class="h-4 w-4 text-green-500 flex-shrink-0" />
                    <span>Use anytime, no limits</span>
                  </li>
                  <li class="flex items-center gap-2 text-sm text-muted-foreground">
                    <Check class="h-4 w-4 text-green-500 flex-shrink-0" />
                    <span>~7-15 videos</span>
                  </li>
                </ul>
                <div class="text-center text-sm text-muted-foreground">
                  Download the app to purchase
                </div>
              </div>
            </div>
          </div>

          <!-- Pro Pack -->
          <div class="relative overflow-hidden rounded-2xl border border-border bg-card hover:border-purple-500/50 transition-all cursor-pointer h-full flex flex-col">
            <div class="p-6 flex-1 flex flex-col">
              <h3 class="text-2xl font-bold mb-2">Pro</h3>
              <div class="mb-4">
                <span class="text-4xl font-bold text-foreground">50</span>
                <span class="text-muted-foreground ml-2">hours</span>
              </div>
              <div class="mb-6">
                <div class="text-3xl font-bold mb-1">$50</div>
                <div class="text-xs text-muted-foreground mt-1">$1.00/hour</div>
              </div>
              <ul class="space-y-2.5 mb-6 flex-1">
                <li class="flex items-center gap-2 text-sm text-muted-foreground">
                  <Check class="h-4 w-4 text-green-500 flex-shrink-0" />
                  <span>Credits never expire</span>
                </li>
                <li class="flex items-center gap-2 text-sm text-muted-foreground">
                  <Check class="h-4 w-4 text-green-500 flex-shrink-0" />
                  <span>Use anytime, no limits</span>
                </li>
                <li class="flex items-center gap-2 text-sm text-muted-foreground">
                  <Check class="h-4 w-4 text-green-500 flex-shrink-0" />
                  <span>~25-50 videos</span>
                </li>
              </ul>
              <div class="text-center text-sm text-muted-foreground">
                Download the app to purchase
              </div>
            </div>
          </div>

          <!-- Studio Pack -->
          <div class="relative overflow-hidden rounded-2xl border border-border bg-card hover:border-purple-500/50 transition-all cursor-pointer h-full flex flex-col">
            <div class="p-6 flex-1 flex flex-col">
              <h3 class="text-2xl font-bold mb-2">Studio</h3>
              <div class="mb-4">
                <span class="text-4xl font-bold text-foreground">250</span>
                <span class="text-muted-foreground ml-2">hours</span>
              </div>
              <div class="mb-6">
                <div class="text-3xl font-bold mb-1">$200</div>
                <div class="text-xs text-muted-foreground mt-1">$0.80/hour</div>
              </div>
              <ul class="space-y-2.5 mb-6 flex-1">
                <li class="flex items-center gap-2 text-sm text-muted-foreground">
                  <Check class="h-4 w-4 text-green-500 flex-shrink-0" />
                  <span>Credits never expire</span>
                </li>
                <li class="flex items-center gap-2 text-sm text-muted-foreground">
                  <Check class="h-4 w-4 text-green-500 flex-shrink-0" />
                  <span>Use anytime, no limits</span>
                </li>
                <li class="flex items-center gap-2 text-sm text-muted-foreground">
                  <Check class="h-4 w-4 text-green-500 flex-shrink-0" />
                  <span>~125-250 videos</span>
                </li>
              </ul>
              <div class="text-center text-sm text-muted-foreground">
                Download the app to purchase
              </div>
            </div>
          </div>
        </div>

        <!-- Trust Badge -->
        <div class="mt-12 text-center">
          <div class="inline-flex items-center gap-2 px-6 py-3 rounded-full bg-gradient-to-r from-purple-500/10 to-indigo-500/10 border border-purple-500/20">
            <Check class="w-5 h-5 text-purple-400" />
            <span class="text-sm font-medium text-muted-foreground">
              Trusted by content creators • <span class="text-purple-400 font-semibold">No subscriptions</span> • Credits never expire
            </span>
          </div>
        </div>
      </div>
    </section>

    <!-- Download Section -->
    <section id="download" class="py-24 sm:py-32 relative overflow-hidden">
      <!-- Background gradient -->
      <div class="absolute inset-0 bg-gradient-to-br from-primary/10 via-background to-primary/5"></div>

      <div class="relative max-w-6xl mx-auto px-4 sm:px-6 lg:px-8 z-10">
        <div class="text-center">
          <!-- Badge -->
          <div class="inline-flex items-center px-4 py-2 bg-gradient-to-r from-purple-500/10 to-indigo-500/10 border border-purple-500/20 rounded-full text-sm font-medium mb-8">
            <Zap class="w-4 h-4 mr-2 text-purple-400" />
            Available Now
          </div>

          <h2 class="text-4xl sm:text-6xl font-bold mb-6">
            Ready to <span class="bg-gradient-to-r from-purple-400 to-indigo-400 bg-clip-text text-transparent">create?</span>
          </h2>
          <p class="text-xl text-muted-foreground max-w-2xl mx-auto mb-16 leading-relaxed">
            Join thousands of creators who are already saving time and money with Clippster.
            Download now and turn your long videos into viral clips in minutes.
          </p>

          <!-- Platform Cards -->
          <div class="grid sm:grid-cols-2 lg:grid-cols-2 gap-6 max-w-4xl mx-auto mb-16">
            <!-- Main Platform Card -->
            <div class="relative group">
              <div class="absolute inset-0 bg-gradient-to-r from-purple-600 to-indigo-600 rounded-2xl opacity-0 group-hover:opacity-100 transition-opacity duration-300 blur-lg"></div>
              <div class="relative bg-card border border-border rounded-2xl p-8 h-full">
                <div class="text-center">
                  <div class="inline-flex items-center justify-center w-16 h-16 bg-gradient-to-br from-purple-500/20 to-indigo-500/20 rounded-2xl mb-4">
                    <!-- Windows Icon -->
                    <svg v-if="platform === 'windows'" class="w-8 h-8 text-purple-300" viewBox="0 0 24 24" fill="currentColor">
                      <path d="M0 3.449L9.75 2.1v9.451H0m10.949-9.602L24 0v11.4H10.949M0 12.6h9.75v9.451L0 20.699M10.949 12.6H24V24l-12.9-1.801"/>
                    </svg>
                    <!-- macOS Icon -->
                    <svg v-else-if="platform === 'macos'" class="w-8 h-8 text-purple-300" viewBox="0 0 24 24" fill="currentColor">
                      <path d="M18.71 19.5c-.83 1.24-1.71 2.45-3.05 2.47-1.34.03-1.77-.79-3.29-.79-1.53 0-2 .77-3.27.82-1.31.05-2.3-1.32-3.14-2.53C4.25 17 2.94 12.45 4.7 9.39c.87-1.52 2.43-2.48 4.12-2.51 1.28-.02 2.5.87 3.29.87.78 0 2.26-1.07 3.81-.91.65.03 2.47.26 3.64 1.98-.09.06-2.17 1.28-2.15 3.81.03 3.02 2.65 4.03 2.68 4.04-.03.07-.42 1.44-1.38 2.83M13 3.5c.73-.83 1.94-1.46 2.94-1.5.13 1.17-.34 2.35-1.04 3.19-.69.85-1.83 1.51-2.95 1.42-.15-1.15.41-2.35 1.05-3.11z"/>
                    </svg>
                    <!-- Fallback icon -->
                    <Scissors v-else class="w-8 h-8 text-purple-300" />
                  </div>
                  <h3 class="text-xl font-semibold mb-2">{{ getPlatformName(platform) }}</h3>
                  <p class="text-sm text-muted-foreground mb-6">Recommended for your system</p>
                  <a v-if="platform !== 'unknown'" href="#" class="inline-flex items-center justify-center w-full px-6 py-3 text-base font-medium text-primary-foreground bg-primary rounded-lg hover:bg-primary/90 transition-colors">
                    Download Now
                  </a>
                </div>
              </div>
            </div>

            <!-- Alternative Platform Card -->
            <div v-if="otherPlatform" class="relative group">
              <div class="absolute inset-0 bg-gradient-to-r from-muted to-muted rounded-2xl opacity-0 group-hover:opacity-100 transition-opacity duration-300 blur-lg"></div>
              <div class="relative bg-card border border-border rounded-2xl p-8 h-full">
                <div class="text-center">
                  <div class="inline-flex items-center justify-center w-16 h-16 bg-muted rounded-2xl mb-4">
                    <!-- Windows Icon -->
                    <svg v-if="otherPlatform === 'windows'" class="w-8 h-8 text-muted-foreground" viewBox="0 0 24 24" fill="currentColor">
                      <path d="M0 3.449L9.75 2.1v9.451H0m10.949-9.602L24 0v11.4H10.949M0 12.6h9.75v9.451L0 20.699M10.949 12.6H24V24l-12.9-1.801"/>
                    </svg>
                    <!-- macOS Icon -->
                    <svg v-else-if="otherPlatform === 'macos'" class="w-8 h-8 text-muted-foreground" viewBox="0 0 24 24" fill="currentColor">
                      <path d="M18.71 19.5c-.83 1.24-1.71 2.45-3.05 2.47-1.34.03-1.77-.79-3.29-.79-1.53 0-2 .77-3.27.82-1.31.05-2.3-1.32-3.14-2.53C4.25 17 2.94 12.45 4.7 9.39c.87-1.52 2.43-2.48 4.12-2.51 1.28-.02 2.5.87 3.29.87.78 0 2.26-1.07 3.81-.91.65.03 2.47.26 3.64 1.98-.09.06-2.17 1.28-2.15 3.81.03 3.02 2.65 4.03 2.68 4.04-.03.07-.42 1.44-1.38 2.83M13 3.5c.73-.83 1.94-1.46 2.94-1.5.13 1.17-.34 2.35-1.04 3.19-.69.85-1.83 1.51-2.95 1.42-.15-1.15.41-2.35 1.05-3.11z"/>
                    </svg>
                    <!-- Fallback icon -->
                    <Scissors v-else class="w-8 h-8 text-muted-foreground" />
                  </div>
                  <h3 class="text-xl font-semibold mb-2">{{ getPlatformName(otherPlatform) }}</h3>
                  <p class="text-sm text-muted-foreground mb-6">Also available</p>
                  <a href="#" class="inline-flex items-center justify-center w-full px-6 py-3 text-base font-medium text-foreground bg-muted hover:bg-muted/80 transition-colors">
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
    <footer class="border-t border-border py-12">
      <div class="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
        <div class="flex flex-col sm:flex-row justify-between items-center">
          <div class="flex items-center mb-4 sm:mb-0">
            <img src="/logo.svg" alt="Clippster" class="h-6 w-auto">
          </div>
          <div class="text-sm text-muted-foreground">
            © 2025 Clippster. All rights reserved.
          </div>
        </div>
      </div>
    </footer>
  </div>
</template>
