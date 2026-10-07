<template>
  <section class="mx-auto flex w-full max-w-xl flex-col gap-5 p-8">
    <div
      class="mb-2 flex h-14 w-14 items-center justify-center rounded-xl border border-sky-500/20 bg-sky-500/10 text-sky-400"
    >
      <Download :size="24" />
    </div>
    <div>
      <h2 class="text-xl font-semibold">Bring in your source</h2>
      <p class="mt-2 text-sm leading-relaxed text-zinc-400">Paste a video link or upload a file to start clipping.</p>
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
      <p class="text-xs text-zinc-500">YouTube, Twitch, Kick, Vimeo, Rumble, and X · Public, completed videos</p>
      <button class="button-primary justify-center" :disabled="busy">
        <Download :size="16" />
        Download source
      </button>
    </form>
    <div class="flex items-center gap-4 text-xs text-zinc-500">
      <span class="h-px flex-1 bg-white/10" />
      or upload a video
      <span class="h-px flex-1 bg-white/10" />
    </div>
    <label
      class="grid cursor-pointer justify-items-center gap-3 rounded-xl border border-dashed border-white/15 p-6 text-sm hover:border-sky-500/50"
    >
      <Upload :size="22" class="text-zinc-400" />
      <span>Choose a video file</span>
      <input
        type="file"
        accept="video/*,.mkv"
        :disabled="busy"
        aria-label="Upload source video"
        class="max-w-full text-xs text-zinc-400"
        @change="choose"
      />
      <span class="text-xs text-zinc-500">Up to 2 GB and 2 hours</span>
    </label>
    <p v-if="uploadProgress !== null" role="status" class="text-sm text-sky-300">Uploading… {{ uploadProgress }}%</p>
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
