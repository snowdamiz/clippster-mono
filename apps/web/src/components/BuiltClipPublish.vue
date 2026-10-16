<template>
  <Teleport to="body"><div class="quick-publish-scope fixed inset-0 z-[10000] flex items-center justify-center bg-black/80 p-4" role="dialog" aria-label="Publish built clip">
    <div class="max-h-[90vh] w-full max-w-2xl overflow-auto rounded-xl border border-zinc-800 bg-[#111112] p-6">
      <h2 class="mb-5 text-xl font-semibold">Publish {{ item.clip.name }}</h2>
      <p v-if="error" role="alert" class="mb-4 text-red-400">{{ error }}</p>
      <QuickPublishStep :model="model" />
      <div class="mt-5 flex justify-end gap-3"><button :disabled="targets.publishing.value" @click="$emit('close')">Cancel</button><button class="rounded-lg bg-cyan-400 px-5 py-2 text-black disabled:opacity-40" :disabled="!model.canPublish || targets.publishing.value" @click="model.handlePublish">{{ targets.publishing.value ? 'Publishing…' : 'Publish' }}</button></div>
    </div>
  </div></Teleport>
</template>
<script setup lang="ts">
import { reactive, ref, onMounted } from 'vue'
import QuickPublishStep from '@/components/QuickPublishStep.vue'
import { useWorkspacePublishTargets } from '../useWorkspacePublishTargets'
import type { BuiltClipItem } from '../useBuiltClips'
const props = defineProps<{ item: BuiltClipItem }>()
const emit = defineEmits<{ close: []; published: [] }>()
const error = ref('')
const targets = useWorkspacePublishTargets(() => props.item.project, () => props.item.clip, () => emit('published'), cause => { error.value = String(cause) })
const model = reactive({ ...targets.model, currentStep: 'publish', buildState: { status: 'completed', progress: 100, error: null } })
onMounted(() => { targets.ready([props.item.build]); void targets.load().catch(cause => { error.value = String(cause) }) })
</script>
<style src="@/styles/quickPublish.css"></style>
