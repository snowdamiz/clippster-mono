<script setup lang="ts">
import { ref, onMounted, onUnmounted } from 'vue';
import type { CloudProjectSnapshot } from '@clippster/cloud-sync-schema';
import { resolveConflict } from '@/services/cloudSync';
import { RefreshCw } from 'lucide-vue-next';
import { Button } from '@/components/ui/button';
import { Modal } from '@/components/ui/modal';

const visible = ref(false);
const projectId = ref('');
const localSnapshot = ref<CloudProjectSnapshot | null>(null);
const serverSnapshot = ref<CloudProjectSnapshot | null>(null);

function onConflict(event: Event) {
  const detail = (event as CustomEvent).detail as {
    projectId: string;
    localSnapshot: CloudProjectSnapshot;
    serverSnapshot: CloudProjectSnapshot;
  };
  projectId.value = detail.projectId;
  localSnapshot.value = detail.localSnapshot;
  serverSnapshot.value = detail.serverSnapshot;
  visible.value = true;
}

async function choose(choice: 'keep_mine' | 'use_cloud' | 'save_copy') {
  if (!localSnapshot.value || !serverSnapshot.value) return;
  await resolveConflict(projectId.value, choice, {
    local: localSnapshot.value,
    server: serverSnapshot.value,
  });
  visible.value = false;
}

onMounted(() => window.addEventListener('cloud-sync-conflict', onConflict));
onUnmounted(() => window.removeEventListener('cloud-sync-conflict', onConflict));
</script>

<template>
  <Modal
    v-model:open="visible"
    title="Sync conflict"
    description="This project was edited on another device. Choose which version to keep."
    :icon="RefreshCw"
    tone="warning"
    size="md"
  >
    <div class="grid grid-cols-2 divide-x divide-line-subtle border-y border-line-subtle">
      <div class="flex min-w-0 flex-col gap-1 py-3 pr-3">
        <p class="eyebrow">Your version</p>
        <p class="truncate text-sm font-medium text-fg">{{ localSnapshot?.project.name }}</p>
        <p class="text-xs text-fg-muted">{{ localSnapshot?.clips.length ?? 0 }} clips</p>
      </div>
      <div class="flex min-w-0 flex-col gap-1 py-3 pl-3">
        <p class="eyebrow">Cloud version</p>
        <p class="truncate text-sm font-medium text-fg">{{ serverSnapshot?.project.name }}</p>
        <p class="text-xs text-fg-muted">{{ serverSnapshot?.clips.length ?? 0 }} clips</p>
      </div>
    </div>

    <template #footer>
      <Button variant="ghost" @click="choose('save_copy')">Save mine as copy</Button>
      <Button variant="secondary" @click="choose('use_cloud')">Use cloud</Button>
      <Button variant="primary" @click="choose('keep_mine')">Keep mine</Button>
    </template>
  </Modal>
</template>
