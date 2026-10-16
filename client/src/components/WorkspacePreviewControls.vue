<template>
  <div class="workspace-dialog__aspect-selector">
    <label class="workspace-dialog__aspect-label">Preview:</label>
    <CustomDropdown :model-value="ratio" :options="options" placeholder="Select aspect ratio" class="workspace-dialog__aspect-dropdown" @update:model-value="$emit('update:ratio', String($event))" />
    <button v-if="ratio === '9:16'" ref="button" type="button" class="workspace-dialog__platform-button" @click="opened = !opened"><Smartphone :size="14" /><span>{{ social?.label || 'Platform' }}</span></button>
    <Teleport to="body"><Transition name="dropdown"><div v-if="opened && ratio === '9:16'" ref="menu" class="workspace-dialog__social-menu" :style="menuStyle">
      <button type="button" class="workspace-dialog__social-option" :class="{ 'workspace-dialog__social-option--active': !social }" @click="choose(null)"><span class="workspace-dialog__social-icon">✕</span><span class="workspace-dialog__social-label">None</span></button>
      <button v-for="preset in SOCIAL_OVERLAY_PRESETS" :key="preset.platform" type="button" class="workspace-dialog__social-option" :class="{ 'workspace-dialog__social-option--active': social?.platform === preset.platform }" @click="choose(preset)"><span class="workspace-dialog__social-icon">{{ preset.icon }}</span><span class="workspace-dialog__social-label">{{ preset.label }}</span></button>
    </div></Transition></Teleport>
  </div>
</template>
<script setup lang="ts">
import { ref, computed, onMounted, onUnmounted } from 'vue';
import { Smartphone } from 'lucide-vue-next';
import CustomDropdown from './CustomDropdown.vue';
import { SOCIAL_OVERLAY_PRESETS } from '@/editor/constants/social-overlay-constants';
import type { SocialOverlayPreset } from '@/editor/types/social-overlays';
const props = defineProps<{ ratio: string; options: Array<{ value: string; label: string }>; social: SocialOverlayPreset | null }>();
const emit = defineEmits<{ 'update:ratio': [value: string]; 'update:social': [value: SocialOverlayPreset | null] }>();
const opened = ref(false), button = ref<HTMLElement>(), menu = ref<HTMLElement>();
const menuStyle = computed(() => { const bounds = button.value?.getBoundingClientRect(); return bounds ? { top: `${bounds.bottom + 6}px`, left: `${bounds.left + bounds.width / 2}px`, transform: 'translateX(-50%)' } : {}; });
function choose(value: SocialOverlayPreset | null) { emit('update:social', value && props.social?.platform === value.platform ? null : value); opened.value = false; }
function outside(event: MouseEvent) { if (!button.value?.contains(event.target as Node) && !menu.value?.contains(event.target as Node)) opened.value = false; }
onMounted(() => document.addEventListener('click', outside)); onUnmounted(() => document.removeEventListener('click', outside));
</script>
<style scoped src="../styles/workspacePreviewControls.css"></style>
