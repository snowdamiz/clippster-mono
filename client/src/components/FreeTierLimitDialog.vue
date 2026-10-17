<template>
  <Modal :open="show" size="sm" :title="title" :description="description" :icon="Lock" tone="warning" @close="$emit('close')">
    <p v-if="limitInfo" class="flex items-center justify-between gap-3 text-sm">
      <span class="text-fg-muted first-letter:uppercase">{{ limitInfo.label }} used today</span>
      <span class="tabular font-semibold text-warning">{{ limitInfo.used }}/{{ limitInfo.limit }}</span>
    </p>

    <template #footer>
      <Button variant="ghost" @click="$emit('close')">Maybe later</Button>
      <Button variant="primary" @click="handleUpgrade">
        <Crown />
        Upgrade plan
      </Button>
    </template>
  </Modal>
</template>

<script setup lang="ts">
  import { Lock, Crown } from 'lucide-vue-next';
  import { useRouter } from 'vue-router';
  import { Button } from '@/components/ui/button';
  import { Modal } from '@/components/ui/modal';

  interface Props {
    show: boolean;
    title?: string;
    description?: string;
    limitInfo?: {
      used: number;
      limit: number;
      label: string;
    } | null;
  }

  withDefaults(defineProps<Props>(), {
    title: 'Daily limit reached',
    description: 'Upgrade to a paid plan for unlimited access.',
    limitInfo: null,
  });

  defineEmits<{
    (e: 'close'): void;
  }>();

  const router = useRouter();

  function handleUpgrade() {
    router.push('/billing');
  }
</script>
