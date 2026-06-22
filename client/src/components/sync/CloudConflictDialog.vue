<script setup lang="ts">
import { ref, onMounted, onUnmounted } from 'vue';
import type { CloudProjectSnapshot } from '@clippster/cloud-sync-schema';
import { resolveConflict } from '@/services/cloudSync';
import { Button } from '@/components/ui/button';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';

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
  <Dialog v-model:open="visible">
    <DialogContent>
      <DialogHeader>
        <DialogTitle>Sync conflict</DialogTitle>
        <DialogDescription>
          This project was edited on another device. Choose which version to keep.
        </DialogDescription>
      </DialogHeader>

      <div class="grid grid-cols-2 gap-3 text-sm">
        <div class="rounded-md border p-3">
          <p class="text-xs uppercase text-muted-foreground">Your version</p>
          <p class="font-medium">{{ localSnapshot?.project.name }}</p>
          <p>{{ localSnapshot?.clips.length ?? 0 }} clips</p>
        </div>
        <div class="rounded-md border p-3">
          <p class="text-xs uppercase text-muted-foreground">Cloud version</p>
          <p class="font-medium">{{ serverSnapshot?.project.name }}</p>
          <p>{{ serverSnapshot?.clips.length ?? 0 }} clips</p>
        </div>
      </div>

      <DialogFooter class="flex-col gap-2 sm:flex-col">
        <Button @click="choose('keep_mine')">Keep mine</Button>
        <Button variant="outline" @click="choose('use_cloud')">Use cloud</Button>
        <Button variant="outline" @click="choose('save_copy')">Save mine as copy</Button>
      </DialogFooter>
    </DialogContent>
  </Dialog>
</template>
