<template>
  <div class="refinement-badge">
    <div class="refinement-badge__round">
      <span class="refinement-badge__label">Round</span>
      <span class="refinement-badge__value">{{ round }}/{{ maxRounds }}</span>
    </div>
    <div class="refinement-badge__sep" />
    <div class="refinement-badge__msgs">
      <span class="refinement-badge__label">Messages</span>
      <span class="refinement-badge__value">{{ messagesRemaining }} left</span>
    </div>
  </div>
</template>

<script setup lang="ts">
defineProps<{
  round: number;
  maxRounds: number;
  messagesRemaining: number;
}>();
</script>

<style scoped>
.refinement-badge {
  display: flex;
  align-items: center;
  gap: 10px;
  padding: 6px 12px;
  background: rgba(251, 191, 36, 0.08);
  border: 1px solid rgba(251, 191, 36, 0.15);
  border-radius: 8px;
  font-size: 11px;
}

.refinement-badge__round,
.refinement-badge__msgs {
  display: flex;
  align-items: center;
  gap: 4px;
}

.refinement-badge__label {
  color: rgba(255, 255, 255, 0.4);
}

.refinement-badge__value {
  color: #fbbf24;
  font-weight: 600;
}

.refinement-badge__sep {
  width: 1px;
  height: 14px;
  background: rgba(255, 255, 255, 0.1);
}
</style>
