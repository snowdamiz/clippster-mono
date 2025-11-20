<template>
  <PageLayout title="Twitch" description="Manage your Twitch streaming content" :show-header="false" :icon="Twitch">
    <div class="flex flex-col items-center justify-center min-h-[calc(100vh-16rem)]">
      <div class="p-5 bg-muted rounded-full mb-6 flex items-center justify-center">
        <div
          class="h-16 w-16 text-muted-foreground"
          :style="{
            backgroundColor: 'currentColor',
            maskImage: 'url(/twitch.svg)',
            WebkitMaskImage: 'url(/twitch.svg)',
            maskSize: 'contain',
            WebkitMaskSize: 'contain',
            maskRepeat: 'no-repeat',
            WebkitMaskRepeat: 'no-repeat',
            maskPosition: 'center',
            WebkitMaskPosition: 'center',
          }"
        />
      </div>

      <h3 class="text-xl font-semibold text-foreground mb-2">Twitch Integration Coming Soon</h3>

      <p class="text-muted-foreground text-center max-w-md">
        We're working hard to bring Twitch streaming content management to Clippster. This feature will allow you to
        import, organize, and create clips from your Twitch streams and VODs.
      </p>
    </div>
  </PageLayout>
</template>

<script setup lang="ts">
  import PageLayout from '@/components/PageLayout.vue';
  import { Twitch } from 'lucide-vue-next';
</script>
