<script setup lang="ts">
import { computed } from 'vue';
import { useRoute } from 'vue-router';
import MessagingPanel from '@/components/messaging/MessagingPanel.vue';

const route = useRoute();

const organizationId = computed(() => {
  const id = route.params.organizationId;
  return typeof id === 'string' ? parseInt(id, 10) : null;
});
</script>

<template>
  <div class="organization-messages-page">
    <MessagingPanel
      v-if="organizationId"
      :organization-id="organizationId"
    />
    <div v-else class="error-state">
      <p>Invalid organization ID</p>
    </div>
  </div>
</template>

<style scoped>
.organization-messages-page {
  height: 100%;
  display: flex;
  flex-direction: column;
}

.error-state {
  display: flex;
  align-items: center;
  justify-content: center;
  height: 100%;
  color: var(--text-secondary, #888);
}
</style>
