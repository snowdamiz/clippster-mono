<template>
  <div class="admin-customer-service">
    <PageLayout
      title="Customer Service"
      description="Manage support conversations and tickets"
      :show-header="true"
      :icon="Headset"
    >
      <div class="admin-customer-service__content">
        <div class="admin-customer-service__placeholder">
          <Headset class="admin-customer-service__placeholder-icon" />
          <h2>Customer Service System</h2>
          <p>Support conversation management will be implemented here.</p>
          <p class="admin-customer-service__note">
            This feature requires additional server-side implementation for support conversations,
            messaging context updates, and WebSocket integration.
          </p>
        </div>
      </div>
    </PageLayout>
  </div>
</template>

<script setup lang="ts">
import { Headset } from 'lucide-vue-next';
import PageLayout from '@/components/PageLayout.vue';
</script>

<style scoped>
.admin-customer-service {
  width: 100%;
  min-height: 100%;
}

.admin-customer-service__content {
  display: flex;
  flex-direction: column;
  gap: 1.5rem;
  padding: 1.5rem;
  max-width: 1200px;
  margin: 0 auto;
}

.admin-customer-service__placeholder {
  display: flex;
  flex-direction: column;
  align-items: center;
  justify-content: center;
  gap: 1rem;
  padding: 4rem 2rem;
  text-align: center;
  background: var(--card);
  border: 1px solid var(--border);
  border-radius: 8px;
}

.admin-customer-service__placeholder-icon {
  width: 4rem;
  height: 4rem;
  color: var(--muted-foreground);
}

.admin-customer-service__placeholder h2 {
  font-size: 1.5rem;
  font-weight: 700;
  margin: 0;
}

.admin-customer-service__placeholder p {
  color: var(--muted-foreground);
  margin: 0;
}

.admin-customer-service__note {
  font-size: 0.875rem;
  max-width: 600px;
  margin-top: 1rem;
  padding: 1rem;
  background: var(--muted);
  border-radius: 6px;
}
</style>
