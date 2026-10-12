<script setup lang="ts">
import { ref, computed, watch } from 'vue';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Modal } from '@/components/ui/modal';
import { SectionHeader } from '@/components/ui/section-header';
import {
  useBrandingProfileSelection,
  type ApplicableProfile,
} from '@/composables/useBrandingProfileSelection';
import {
  Paintbrush,
  User,
  Building2,
  Megaphone,
  Image,
  Film,
  Check,
} from 'lucide-vue-next';

const { showSelector, applicableProfiles, completeBrandingSelection } =
  useBrandingProfileSelection();

const selectedProfileId = ref<string | null>(null);

const groupedProfiles = computed(() => {
  const groups: Record<string, ApplicableProfile[]> = {};
  for (const ap of applicableProfiles.value) {
    const key = ap.label;
    if (!groups[key]) groups[key] = [];
    groups[key].push(ap);
  }
  return groups;
});

// Auto-select required campaign profile if present
const requiredProfile = computed(() =>
  applicableProfiles.value.find((p) => p.required)
);

function onOpen() {
  if (requiredProfile.value) {
    selectedProfileId.value = requiredProfile.value.profile.id;
  } else if (applicableProfiles.value.length > 0) {
    selectedProfileId.value = applicableProfiles.value[0].profile.id;
  }
}

// Pre-select when the selector is opened (it is opened programmatically).
watch(showSelector, (open) => {
  if (open) onOpen();
});

function confirm() {
  const selected = applicableProfiles.value.find(
    (p) => p.profile.id === selectedProfileId.value
  );
  completeBrandingSelection(selected?.profile ?? null);
}

function skip() {
  completeBrandingSelection(null);
}

function sourceIcon(source: string) {
  switch (source) {
    case 'Streamer Profile':
      return User;
    case 'Global Branding':
      return Paintbrush;
    case 'Org Member Default':
      return Building2;
    case 'Campaign Branding':
      return Megaphone;
    default:
      return Paintbrush;
  }
}

function hasAsset(profile: ApplicableProfile, asset: 'watermark' | 'intro' | 'outro'): boolean {
  const p = profile.profile;
  if (asset === 'watermark') return !!p.watermark_id;
  if (asset === 'intro') return !!p.intro_id || !!p.intro_ratio_settings;
  if (asset === 'outro') return !!p.outro_id || !!p.outro_ratio_settings;
  return false;
}
</script>

<template>
  <Modal
    v-model:open="showSelector"
    size="md"
    :icon="Paintbrush"
    title="Select branding profile"
    description="Multiple branding profiles are available for this project. Choose which one to apply."
  >
    <div class="flex flex-col gap-4">
      <section v-for="(profiles, groupLabel) in groupedProfiles" :key="groupLabel" class="flex flex-col gap-1.5">
        <SectionHeader :title="String(groupLabel)" variant="eyebrow" :icon="sourceIcon(groupLabel as string)" />

        <button
          v-for="ap in profiles"
          :key="ap.profile.id"
          type="button"
          class="flex w-full flex-col gap-1.5 rounded-lg border px-3 py-2.5 text-left transition-colors focus-visible:shadow-[var(--focus-ring)] focus-visible:outline-none"
          :class="
            selectedProfileId === ap.profile.id
              ? 'border-brand-line bg-brand-soft'
              : 'border-line bg-surface hover:border-line-strong hover:bg-surface-hover'
          "
          :aria-pressed="selectedProfileId === ap.profile.id"
          @click="selectedProfileId = ap.profile.id"
        >
          <div class="flex items-center gap-2">
            <span class="min-w-0 flex-1 truncate text-sm font-medium text-fg">{{ ap.profile.name }}</span>
            <Badge v-if="ap.required" variant="warning">Required</Badge>
            <span
              class="grid size-4 shrink-0 place-items-center rounded-full border transition-colors"
              :class="
                selectedProfileId === ap.profile.id
                  ? 'border-brand bg-brand text-brand-fg'
                  : 'border-line-strong text-transparent'
              "
            >
              <Check class="size-2.5" :stroke-width="3.5" />
            </span>
          </div>

          <p v-if="ap.profile.description" class="text-xs text-fg-muted">{{ ap.profile.description }}</p>

          <div class="flex flex-wrap gap-1">
            <Badge :variant="hasAsset(ap, 'watermark') ? 'success' : 'outline'" :class="!hasAsset(ap, 'watermark') && 'opacity-60'">
              <Image />
              Watermark
            </Badge>
            <Badge :variant="hasAsset(ap, 'intro') ? 'success' : 'outline'" :class="!hasAsset(ap, 'intro') && 'opacity-60'">
              <Film />
              Intro
            </Badge>
            <Badge :variant="hasAsset(ap, 'outro') ? 'success' : 'outline'" :class="!hasAsset(ap, 'outro') && 'opacity-60'">
              <Film />
              Outro
            </Badge>
          </div>
        </button>
      </section>
    </div>

    <template #footer>
      <Button variant="ghost" @click="skip">No branding</Button>
      <Button variant="primary" :disabled="!selectedProfileId" @click="confirm">
        <Check />
        Apply selected
      </Button>
    </template>
  </Modal>
</template>
