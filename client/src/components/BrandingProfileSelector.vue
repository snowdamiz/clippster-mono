<script setup lang="ts">
import { ref, computed } from 'vue';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
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
  X,
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
  <Dialog v-model:open="showSelector" @update:open="(v: boolean) => { if (v) onOpen(); }">
    <DialogContent class="branding-selector">
      <DialogHeader>
        <DialogTitle class="branding-selector__title">
          <Paintbrush class="branding-selector__title-icon" />
          Select Branding Profile
        </DialogTitle>
        <DialogDescription class="branding-selector__desc">
          Multiple branding profiles are available for this project. Choose which one to apply.
        </DialogDescription>
      </DialogHeader>

      <div class="branding-selector__groups">
        <div
          v-for="(profiles, groupLabel) in groupedProfiles"
          :key="groupLabel"
          class="branding-selector__group"
        >
          <div class="branding-selector__group-header">
            <component :is="sourceIcon(groupLabel as string)" class="branding-selector__group-icon" />
            <span class="branding-selector__group-label">{{ groupLabel }}</span>
          </div>

          <div class="branding-selector__cards">
            <button
              v-for="ap in profiles"
              :key="ap.profile.id"
              class="branding-selector__card"
              :class="{
                'branding-selector__card--selected': selectedProfileId === ap.profile.id,
                'branding-selector__card--required': ap.required,
              }"
              @click="selectedProfileId = ap.profile.id"
            >
              <div class="branding-selector__card-header">
                <span class="branding-selector__card-name">{{ ap.profile.name }}</span>
                <Badge v-if="ap.required" variant="destructive" class="branding-selector__badge">
                  Required
                </Badge>
                <Check
                  v-if="selectedProfileId === ap.profile.id"
                  class="branding-selector__check"
                />
              </div>

              <p v-if="ap.profile.description" class="branding-selector__card-desc">
                {{ ap.profile.description }}
              </p>

              <div class="branding-selector__assets">
                <span
                  class="branding-selector__asset"
                  :class="{ 'branding-selector__asset--active': hasAsset(ap, 'watermark') }"
                >
                  <Image :size="12" />
                  Watermark
                </span>
                <span
                  class="branding-selector__asset"
                  :class="{ 'branding-selector__asset--active': hasAsset(ap, 'intro') }"
                >
                  <Film :size="12" />
                  Intro
                </span>
                <span
                  class="branding-selector__asset"
                  :class="{ 'branding-selector__asset--active': hasAsset(ap, 'outro') }"
                >
                  <Film :size="12" />
                  Outro
                </span>
              </div>
            </button>
          </div>
        </div>
      </div>

      <DialogFooter class="branding-selector__footer">
        <Button variant="ghost" size="sm" @click="skip">
          <X :size="14" />
          No Branding
        </Button>
        <Button size="sm" :disabled="!selectedProfileId" @click="confirm">
          <Check :size="14" />
          Apply Selected
        </Button>
      </DialogFooter>
    </DialogContent>
  </Dialog>
</template>

<style scoped>
.branding-selector {
  max-width: 540px;
}

.branding-selector__title {
  display: flex;
  align-items: center;
  gap: 8px;
  font-size: 16px;
  font-weight: 600;
  color: var(--color-text-primary, #e2e8f0);
}

.branding-selector__title-icon {
  width: 18px;
  height: 18px;
  color: var(--color-accent, #8b5cf6);
}

.branding-selector__desc {
  font-size: 13px;
  color: var(--color-text-secondary, #94a3b8);
  margin-top: 2px;
}

.branding-selector__groups {
  display: flex;
  flex-direction: column;
  gap: 16px;
  max-height: 400px;
  overflow-y: auto;
  padding: 4px 0;
}

.branding-selector__group-header {
  display: flex;
  align-items: center;
  gap: 6px;
  margin-bottom: 8px;
}

.branding-selector__group-icon {
  width: 14px;
  height: 14px;
  color: var(--color-text-secondary, #94a3b8);
}

.branding-selector__group-label {
  font-size: 11px;
  font-weight: 600;
  text-transform: uppercase;
  letter-spacing: 0.05em;
  color: var(--color-text-secondary, #94a3b8);
}

.branding-selector__cards {
  display: flex;
  flex-direction: column;
  gap: 6px;
}

.branding-selector__card {
  display: flex;
  flex-direction: column;
  gap: 6px;
  padding: 10px 12px;
  border-radius: 8px;
  border: 1px solid var(--color-border, rgba(255, 255, 255, 0.08));
  background: var(--color-bg-secondary, rgba(255, 255, 255, 0.03));
  cursor: pointer;
  text-align: left;
  transition: all 0.15s ease;
  width: 100%;
}

.branding-selector__card:hover {
  border-color: var(--color-border-hover, rgba(255, 255, 255, 0.15));
  background: var(--color-bg-hover, rgba(255, 255, 255, 0.05));
}

.branding-selector__card--selected {
  border-color: var(--color-accent, #8b5cf6);
  background: rgba(139, 92, 246, 0.08);
}

.branding-selector__card--selected:hover {
  border-color: var(--color-accent, #8b5cf6);
}

.branding-selector__card--required {
  border-color: rgba(239, 68, 68, 0.4);
}

.branding-selector__card-header {
  display: flex;
  align-items: center;
  gap: 8px;
}

.branding-selector__card-name {
  font-size: 13px;
  font-weight: 500;
  color: var(--color-text-primary, #e2e8f0);
  flex: 1;
}

.branding-selector__badge {
  font-size: 10px;
  padding: 1px 6px;
}

.branding-selector__check {
  width: 16px;
  height: 16px;
  color: var(--color-accent, #8b5cf6);
  flex-shrink: 0;
}

.branding-selector__card-desc {
  font-size: 12px;
  color: var(--color-text-secondary, #94a3b8);
  margin: 0;
  line-height: 1.4;
}

.branding-selector__assets {
  display: flex;
  gap: 8px;
}

.branding-selector__asset {
  display: flex;
  align-items: center;
  gap: 3px;
  font-size: 11px;
  color: var(--color-text-muted, #64748b);
  opacity: 0.5;
}

.branding-selector__asset--active {
  color: var(--color-success, #22c55e);
  opacity: 1;
}

.branding-selector__footer {
  display: flex;
  justify-content: flex-end;
  gap: 8px;
  padding-top: 8px;
}
</style>
