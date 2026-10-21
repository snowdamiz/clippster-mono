<template>
  <div class="flex shrink-0 items-center gap-2">
    <span class="text-xs font-medium text-fg-muted">Preview</span>
    <div class="w-[132px]">
      <CustomDropdown
        :model-value="ratio"
        @update:model-value="$emit('update:ratio', String($event))"
        :options="options"
        placeholder="Select aspect ratio"
        size="sm"
      />
    </div>

    <!-- Platform preview overlay (9:16 only) -->
    <DropdownMenu v-if="ratio === '9:16'">
      <DropdownMenuTrigger as-child>
        <Button variant="secondary" size="sm">
          <Smartphone />
          <span>{{ social?.label || 'Platform' }}</span>
          <ChevronDown class="text-fg-subtle" />
        </Button>
      </DropdownMenuTrigger>
      <DropdownMenuContent align="center" class="min-w-[180px]">
        <DropdownMenuRadioGroup :model-value="social?.platform ?? 'none'" @update:model-value="choose">
          <DropdownMenuRadioItem value="none">None</DropdownMenuRadioItem>
          <DropdownMenuRadioItem
            v-for="preset in SOCIAL_OVERLAY_PRESETS"
            :key="preset.platform"
            :value="preset.platform"
          >
            <span class="grid w-4 place-items-center">{{ preset.icon }}</span>
            {{ preset.label }}
          </DropdownMenuRadioItem>
        </DropdownMenuRadioGroup>
      </DropdownMenuContent>
    </DropdownMenu>
  </div>
</template>
<script setup lang="ts">
  import { Smartphone, ChevronDown } from 'lucide-vue-next';
  import CustomDropdown from './CustomDropdown.vue';
  import { Button } from '@/components/ui/button';
  import {
    DropdownMenu,
    DropdownMenuTrigger,
    DropdownMenuContent,
    DropdownMenuRadioGroup,
    DropdownMenuRadioItem,
  } from '@/components/ui/dropdown-menu';
  import { SOCIAL_OVERLAY_PRESETS } from '@/editor/constants/social-overlay-constants';
  import type { SocialOverlayPreset } from '@/editor/types/social-overlays';
  defineProps<{
    ratio: string;
    options: Array<{ value: string; label: string }>;
    social: SocialOverlayPreset | null;
  }>();
  const emit = defineEmits<{ 'update:ratio': [value: string]; 'update:social': [value: SocialOverlayPreset | null] }>();
  function choose(value: unknown) {
    emit('update:social', typeof value === 'string' ? SOCIAL_OVERLAY_PRESETS.find((preset) => preset.platform === value) ?? null : null);
  }
</script>
