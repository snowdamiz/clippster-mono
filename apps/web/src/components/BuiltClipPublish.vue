<template>
  <Modal :open="true" :title="`Publish ${item.clip.name}`" size="lg" @close="$emit('close')">
    <p v-if="error" role="alert" class="mb-4 text-danger">{{ error }}</p>
    <QuickPublishStep :model="model" />
    <template #footer>
      <Button variant="ghost" :disabled="targets.publishing.value" @click="$emit('close')">Cancel</Button>
      <Button
        variant="primary"
        :loading="targets.publishing.value"
        :disabled="!model.canPublish || targets.publishing.value"
        @click="model.handlePublish"
      >
        Publish
      </Button>
    </template>
  </Modal>
</template>
<script setup lang="ts">
  import { reactive, ref, onMounted } from 'vue'
  import QuickPublishStep from '@/components/QuickPublishStep.vue'
  import { Modal } from '@/components/ui/modal'
  import { Button } from '@/components/ui/button'
  import { useWorkspacePublishTargets } from '../useWorkspacePublishTargets'
  import type { BuiltClipItem } from '../useBuiltClips'
  const props = defineProps<{ item: BuiltClipItem }>()
  const emit = defineEmits<{ close: []; published: [] }>()
  const error = ref('')
  const targets = useWorkspacePublishTargets(
    () => props.item.project,
    () => props.item.clip,
    () => emit('published'),
    (cause) => {
      error.value = String(cause)
    }
  )
  const model = reactive({
    ...targets.model,
    currentStep: 'publish',
    buildState: { status: 'completed', progress: 100, error: null }
  })
  onMounted(() => {
    targets.ready([props.item.build])
    void targets.load().catch((cause) => {
      error.value = String(cause)
    })
  })
</script>
