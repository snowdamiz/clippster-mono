<script setup lang="ts">
import Navbar from './components/Navbar.vue'
import HeroSection from './components/HeroSection.vue'
import HowItWorksSection from './components/HowItWorksSection.vue'
import FeaturesSection from './components/FeaturesSection.vue'
import PlatformsSection from './components/PlatformsSection.vue'
import EditorSection from './components/EditorSection.vue'
import StatsSection from './components/StatsSection.vue'
import PricingSection from './components/PricingSection.vue'
import CTASection from './components/CTASection.vue'
import FooterSection from './components/FooterSection.vue'
</script>

<template>
  <div class="min-h-screen bg-background noise-overlay">
    <Navbar />
    <main>
      <HeroSection />
      <HowItWorksSection />
      <FeaturesSection />
      <PlatformsSection />
      <EditorSection />
      <StatsSection />
      <PricingSection />
      <CTASection />
    </main>
    <FooterSection />
  </div>
</template>
