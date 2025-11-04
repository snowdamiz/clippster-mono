<template>
  <PageLayout
    title="YouTube"
    description="Manage your YouTube video content"
    :show-header="false"
    icon="M14.752 11.168l-3.197-2.132A1 1 0 0010 9.87v4.263a1 1 0 001.555.832l3.197-2.132a1 1 0 000-1.664z M21 12a9 9 0 11-18 0 9 9 0 0118 0z"
  >
    <div class="flex flex-col items-center justify-center min-h-[calc(100vh-16rem)]">
      <div class="p-5 bg-muted rounded-full mb-6 flex items-center justify-center">
        <div
          class="h-16 w-16 text-muted-foreground"
          :style="{
            backgroundColor: 'currentColor',
            maskImage: 'url(/youtube.svg)',
            WebkitMaskImage: 'url(/youtube.svg)',
            maskSize: 'contain',
            WebkitMaskSize: 'contain',
            maskRepeat: 'no-repeat',
            WebkitMaskRepeat: 'no-repeat',
            maskPosition: 'center',
            WebkitMaskPosition: 'center'
          }"
        />
      </div>

      <h3 class="text-xl font-semibold text-foreground mb-2">YouTube Integration Coming Soon</h3>

      <p class="text-muted-foreground text-center max-w-md">
        We're working hard to bring YouTube video content management to Clippster. This feature will allow you to
        import, organize, and create clips from your YouTube videos and streams.
      </p>
    </div>
  </PageLayout>
</template>

<script setup lang="ts">
  import PageLayout from '@/components/PageLayout.vue'
</script>
