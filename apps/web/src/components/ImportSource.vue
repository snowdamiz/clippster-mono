<template>
  <section class="mx-auto flex w-full max-w-lg flex-col gap-5 px-6 py-10">
    <div
      class="flex size-11 items-center justify-center rounded-xl border border-brand-line bg-brand-soft text-brand"
    >
      <Download :size="24" />
    </div>
    <div>
      <h2 class="text-lg font-semibold">Bring in your source</h2>
      <p class="mt-2 text-sm leading-relaxed text-fg-muted">Paste a video link or upload a file to start clipping.</p>
    </div>
    <form class="grid gap-3" @submit.prevent="$emit('import', url)">
      <label for="source-url" class="text-sm">Video URL</label>
      <input
        id="source-url"
        v-model="url"
        type="url"
        placeholder="https://www.youtube.com/watch?v=…"
        class="field"
        required
        :disabled="busy"
      />
      <p class="text-xs text-fg-subtle">YouTube, Twitch, Kick, Vimeo, Rumble, and X · Public, completed videos</p>
      <button class="button-primary justify-center" :disabled="busy">
        <Download :size="16" />
        Download source
      </button>
    </form>
    <div class="flex items-center gap-4 text-xs text-fg-subtle">
      <span class="h-px flex-1 bg-surface-active" />
      or upload a video
      <span class="h-px flex-1 bg-surface-active" />
    </div>
    <label
      class="grid cursor-pointer justify-items-center gap-3 rounded-xl border border-dashed border-line-strong p-6 text-sm hover:border-brand-line"
    >
      <Upload :size="22" class="text-fg-muted" />
      <span>Choose a video file</span>
      <input
        type="file"
        accept="video/*,.mkv"
        :disabled="busy"
        aria-label="Upload source video"
        class="max-w-full text-xs text-fg-muted"
        @change="choose"
      />
      <span class="text-xs text-fg-subtle">Up to 2 GB and 2 hours</span>
    </label>
    <p v-if="uploadProgress !== null" role="status" class="text-sm text-brand">Uploading… {{ uploadProgress }}%</p>
  </section>
</template>
<script setup lang="ts">
  import { ref } from 'vue'
  import { Download, Upload } from 'lucide-vue-next'
  defineProps<{ busy: boolean; uploadProgress: number | null }>()
  const emit = defineEmits<{ import: [url: string]; upload: [file: File] }>()
  const url = ref('')
  function choose(event: Event) {
    const input = event.target as HTMLInputElement
    const file = input.files?.[0]
    if (file) emit('upload', file)
    input.value = ''
  }
</script>
