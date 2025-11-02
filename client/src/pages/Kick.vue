<template>
  <PageLayout
    title="Kick"
    description="Manage your Kick streaming content"
    :show-header="false"
    icon="M21 12a9 9 0 11-18 0 9 9 0 0118 0z"
  >
    <div class="flex flex-col items-center justify-center min-h-[calc(100vh-16rem)]">
      <div class="p-5 bg-muted rounded-full mb-6 flex items-center justify-center">
        <div
          class="h-16 w-16 text-muted-foreground"
          :style="{
            backgroundColor: 'currentColor',
            maskImage: 'url(/kick.svg)',
            WebkitMaskImage: 'url(/kick.svg)',
            maskSize: 'contain',
            WebkitMaskSize: 'contain',
            maskRepeat: 'no-repeat',
            WebkitMaskRepeat: 'no-repeat',
            maskPosition: 'center',
            WebkitMaskPosition: 'center'
          }"
        />
      </div>
      <h3 class="text-xl font-semibold text-foreground mb-2">Kick Integration Coming Soon</h3>
      <p class="text-muted-foreground text-center max-w-md">We're working hard to bring Kick streaming content management to Clippster. This feature will allow you to import, organize, and create clips from your Kick streams.</p>
    </div>
  </PageLayout>
</template>

<script setup lang="ts">
import PageLayout from '@/components/PageLayout.vue'
</script>