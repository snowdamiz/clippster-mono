<script setup lang="ts">
import { ref, onMounted } from 'vue'
import { Sparkles, Zap, DollarSign, Scissors, Shield, Coins, Check } from 'lucide-vue-next'

const platform = ref<'windows' | 'macos' | 'unknown'>('unknown')
const otherPlatform = ref<'windows' | 'macos' | null>(null)

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
</script>

<template>
  <div class="min-h-screen bg-background text-foreground">
    <!-- Header -->
    <header role="banner" class="border-b border-border/50 backdrop-blur-sm sticky top-0 z-50 bg-background/80">
      <div class="container mx-auto px-4 py-4 flex items-center justify-between">
        <div class="flex items-center gap-2">
          <img src="/logo.svg" alt="Clippster - AI Video Clip Generator" class="h-8" />
        </div>
        <nav role="navigation" aria-label="Main navigation" class="hidden md:flex gap-8">
          <a href="#features" class="text-sm text-muted-foreground hover:text-foreground transition-colors">Features</a>
          <a href="#pricing" class="text-sm text-muted-foreground hover:text-foreground transition-colors">Pricing</a>
          <a href="#download" class="text-sm text-muted-foreground hover:text-foreground transition-colors">Download</a>
        </nav>
        <a href="#pricing" class="px-6 py-2 bg-gradient-to-r from-purple-600 to-indigo-600 text-white rounded-lg hover:from-purple-700 hover:to-indigo-700 transition-all font-medium shadow-sm inline-block">
          Download
        </a>
      </div>
    </header>

    <!-- Hero Section -->
    <main>
      <section role="banner" aria-labelledby="hero-heading" class="relative container mx-auto px-4 py-20 md:py-32 overflow-hidden">
      <!-- Background decoration -->
      <div class="absolute inset-0 -z-10">
        <div class="absolute top-1/4 left-1/4 w-96 h-96 bg-purple-500/10 rounded-full blur-3xl"></div>
        <div class="absolute top-1/3 right-1/4 w-96 h-96 bg-indigo-500/10 rounded-full blur-3xl"></div>
      </div>
      
      <div class="relative max-w-4xl mx-auto text-center space-y-8">
        <div class="inline-flex items-center gap-2 px-4 py-2 rounded-full bg-gradient-to-r from-purple-500/10 to-indigo-500/10 border border-purple-500/20 text-sm">
          <Sparkles class="w-4 h-4 text-purple-400" />
          <span>AI-Powered Clip Generation</span>
        </div>
        <h1 id="hero-heading" class="text-5xl md:text-7xl font-bold tracking-tight leading-tight md:leading-tight">
          Turn Long Videos Into<br /><span class="bg-gradient-to-r from-purple-400 to-indigo-400 bg-clip-text text-transparent">Viral Clips</span>
        </h1>
        <p class="text-xl text-muted-foreground max-w-2xl mx-auto">
          AI finds your best moments and turns them into viral clips for TikTok, YouTube Shorts, and Instagram Reels.
          Save 72-81% compared to subscription-based alternatives while keeping your videos private on your computer.
        </p>
        <div class="flex flex-col sm:flex-row gap-4 justify-center items-center">
          <a href="#download" class="px-8 py-4 bg-gradient-to-r from-purple-600 to-indigo-600 text-white rounded-lg hover:from-purple-700 hover:to-indigo-700 transition-all font-semibold text-lg shadow-lg shadow-purple-500/25 inline-block">
            Download Clippster
          </a>
          <a href="#pricing" class="px-8 py-4 border border-border rounded-lg hover:border-purple-500/50 hover:bg-secondary/50 transition-colors font-medium text-lg inline-block">
            View Pricing
          </a>
        </div>
        <p class="text-sm text-muted-foreground">
          Pay with crypto • Desktop app for privacy • Credits never expire
        </p>
      </div>
    </section>

    <!-- Features Section -->
    <section id="features" role="region" aria-labelledby="features-heading" class="relative container mx-auto px-4 py-20">
      <!-- Background decoration -->
      <div class="absolute inset-0 -z-10 overflow-hidden">
        <div class="absolute top-0 left-1/3 w-96 h-96 bg-purple-500/8 rounded-full blur-3xl"></div>
        <div class="absolute bottom-0 right-1/3 w-96 h-96 bg-indigo-500/8 rounded-full blur-3xl"></div>
      </div>
      
      <div class="relative">
        <div class="text-center space-y-4 mb-16">
          <h2 id="features-heading" class="text-3xl md:text-5xl font-bold">Why Choose <span class="bg-gradient-to-r from-purple-400 to-indigo-400 bg-clip-text text-transparent">Clippster?</span></h2>
          <p class="text-muted-foreground text-lg">The smarter way to create clips</p>
        </div>
        
        <div class="grid md:grid-cols-3 gap-8 max-w-6xl mx-auto">
          <div class="group relative">
            <div class="absolute inset-0 bg-gradient-to-br from-purple-500/20 to-transparent rounded-2xl blur-xl opacity-0 group-hover:opacity-100 transition-opacity"></div>
            <div class="relative p-6 rounded-2xl border border-border/50 bg-card/50 backdrop-blur-sm hover:border-purple-500/50 transition-all space-y-4">
              <div class="w-12 h-12 rounded-lg bg-gradient-to-br from-purple-500/20 to-indigo-500/20 flex items-center justify-center">
                <DollarSign class="w-6 h-6 text-purple-400" />
              </div>
              <h3 class="text-xl font-semibold">72-81% Cheaper</h3>
              <p class="text-muted-foreground">
                Save thousands compared to Opus Clips and other subscription-based video editing tools.
                Pay once, use forever with no recurring fees.
              </p>
            </div>
          </div>

          <div class="group relative">
            <div class="absolute inset-0 bg-gradient-to-br from-indigo-500/20 to-transparent rounded-2xl blur-xl opacity-0 group-hover:opacity-100 transition-opacity"></div>
            <div class="relative p-6 rounded-2xl border border-border/50 bg-card/50 backdrop-blur-sm hover:border-indigo-500/50 transition-all space-y-4">
              <div class="w-12 h-12 rounded-lg bg-gradient-to-br from-indigo-500/20 to-purple-500/20 flex items-center justify-center">
                <Shield class="w-6 h-6 text-indigo-400" />
              </div>
              <h3 class="text-xl font-semibold">Privacy First</h3>
              <p class="text-muted-foreground">
                Desktop application keeps your videos secure on your local machine. No cloud uploads, data mining, or privacy concerns.
                Perfect for sensitive content and professional creators.
              </p>
            </div>
          </div>

          <div class="group relative">
            <div class="absolute inset-0 bg-gradient-to-br from-purple-500/20 to-transparent rounded-2xl blur-xl opacity-0 group-hover:opacity-100 transition-opacity"></div>
            <div class="relative p-6 rounded-2xl border border-border/50 bg-card/50 backdrop-blur-sm hover:border-purple-500/50 transition-all space-y-4">
              <div class="w-12 h-12 rounded-lg bg-gradient-to-br from-purple-500/20 to-indigo-500/20 flex items-center justify-center">
                <Coins class="w-6 h-6 text-purple-400" />
              </div>
              <h3 class="text-xl font-semibold">Crypto Native</h3>
              <p class="text-muted-foreground">
                Pay with SOL via Phantom wallet. No credit cards required, no personal information collected,
                instant global transactions. Web3 creator tools for the modern economy.
              </p>
            </div>
          </div>
        </div>
      </div>
    </section>

    <!-- How It Works -->
    <section id="how" role="region" aria-labelledby="how-heading" class="container mx-auto px-4 py-20 border-t border-border">
      <div class="text-center space-y-4 mb-16">
        <h2 id="how-heading" class="text-3xl md:text-5xl font-bold">Simple. Fast. Effective.</h2>
        <p class="text-muted-foreground text-lg">Get viral clips in 3 easy steps</p>
      </div>

      <div class="max-w-4xl mx-auto space-y-8">
        <div class="flex gap-6 items-start">
          <div class="w-12 h-12 rounded-full bg-primary text-primary-foreground flex items-center justify-center font-bold text-xl flex-shrink-0">
            1
          </div>
          <div class="space-y-2 flex-1">
            <h3 class="text-xl font-semibold">Upload Your Stream</h3>
            <p class="text-muted-foreground">
              Drop your VOD, stream recording, or long-form video. We support all major formats.
            </p>
          </div>
        </div>

        <div class="flex gap-6 items-start">
          <div class="w-12 h-12 rounded-full bg-primary text-primary-foreground flex items-center justify-center font-bold text-xl flex-shrink-0">
            2
          </div>
          <div class="space-y-2 flex-1">
            <h3 class="text-xl font-semibold">AI Finds the Best Moments</h3>
            <p class="text-muted-foreground">
              Our intelligent algorithms analyze your content and identify highlight-worthy moments automatically.
            </p>
          </div>
        </div>

        <div class="flex gap-6 items-start">
          <div class="w-12 h-12 rounded-full bg-primary text-primary-foreground flex items-center justify-center font-bold text-xl flex-shrink-0">
            3
          </div>
          <div class="space-y-2 flex-1">
            <h3 class="text-xl font-semibold">Download & Share</h3>
            <p class="text-muted-foreground">
              Get your perfectly-cut clips ready for TikTok, YouTube Shorts, Instagram Reels, and more.
            </p>
          </div>
        </div>
      </div>
    </section>

    <!-- Pricing -->
    <section id="pricing" role="region" aria-labelledby="pricing-heading" class="container mx-auto px-4 py-20">
      <div class="text-center space-y-4 mb-16">
        <h2 id="pricing-heading" class="text-3xl md:text-5xl font-bold">Choose Your <span class="bg-gradient-to-r from-purple-400 to-indigo-400 bg-clip-text text-transparent">Credit Pack</span></h2>
        <p class="text-muted-foreground text-lg">Pay once, use forever. No subscriptions, no expiration dates.</p>
      </div>

      <div class="grid md:grid-cols-4 gap-6 max-w-7xl mx-auto">
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
        <div class="relative group ring-2 ring-purple-500 rounded-2xl">
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

      <!-- Info badge -->
      <div class="mt-12 text-center">
        <div class="inline-flex items-center gap-2 px-6 py-3 rounded-full bg-gradient-to-r from-purple-500/10 to-indigo-500/10 border border-purple-500/20">
          <Check class="w-5 h-5 text-purple-400" />
          <span class="text-sm font-medium text-muted-foreground">
            Trusted by content creators • <span class="text-purple-400 font-semibold">No subscriptions</span> • Credits never expire
          </span>
        </div>
      </div>
    </section>

    <!-- Download Section -->
    <section id="download" role="region" aria-labelledby="download-heading" class="container mx-auto px-4 py-20">
      <div class="relative">
        <!-- Background decoration -->
        <div class="absolute inset-0 -z-10 overflow-hidden">
          <div class="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 w-[600px] h-[300px] bg-purple-500/10 rounded-full blur-3xl"></div>
          <div class="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 w-[400px] h-[400px] bg-indigo-500/8 rounded-full blur-3xl"></div>
        </div>
        
        <div class="relative max-w-3xl mx-auto text-center space-y-8 p-12 rounded-2xl bg-gradient-to-br from-card via-card to-muted/30 border border-border/50 overflow-hidden">
          <!-- Top gradient bar -->
          <div class="absolute top-0 inset-x-0 h-1 bg-gradient-to-r from-purple-600 via-indigo-600 to-purple-600"></div>
          
          <h2 id="download-heading" class="text-3xl md:text-5xl font-bold">Download <span class="bg-gradient-to-r from-purple-400 to-indigo-400 bg-clip-text text-transparent">Clippster</span></h2>
          <p class="text-xl text-muted-foreground">
            Available for Windows and macOS. Install once, clip forever.
          </p>
          <div class="flex flex-col items-center gap-3">
            <a v-if="platform !== 'unknown'" href="#" class="px-8 py-4 bg-gradient-to-r from-purple-600 to-indigo-600 text-white rounded-lg hover:from-purple-700 hover:to-indigo-700 transition-all font-semibold text-lg shadow-lg shadow-purple-500/25 inline-block">
              Download for {{ getPlatformName(platform) }}
            </a>
            <a v-if="otherPlatform" href="#" class="text-sm text-muted-foreground hover:text-foreground underline underline-offset-4 transition-colors">
              Download for {{ getPlatformName(otherPlatform) }}
            </a>
          </div>
          <p class="text-sm text-muted-foreground">
            Purchase credits from within the app after installation
          </p>
        </div>
      </div>
    </section>

    </main>

    <!-- Footer -->
    <footer role="contentinfo" class="border-t border-border mt-20">
      <div class="container mx-auto px-4 py-8">
        <div class="flex flex-col md:flex-row justify-between items-center gap-4">
          <div class="flex items-center gap-2">
            <img src="/logo.svg" alt="Clippster - AI Video Clip Generator" class="h-6" />
          </div>
          <div class="text-sm text-muted-foreground">
            © 2025 Clippster. All rights reserved.
          </div>
        </div>
      </div>
    </footer>
  </div>
</template>
