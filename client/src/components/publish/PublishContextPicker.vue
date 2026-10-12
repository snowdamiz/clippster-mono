<script setup lang="ts">
  /**
   * "Post for" block shared by the publish and schedule dialogs: switch
   * between posting for the organization (creator profile) or a campaign
   * (campaign + branding profile). All selection state stays in the parent.
   */
  import { computed } from 'vue';
  import { Building2, Trophy, User } from 'lucide-vue-next';
  import { Field } from '@/components/ui/field';
  import { SegmentedControl } from '@/components/ui/segmented-control';
  import PublishEntitySelect from './PublishEntitySelect.vue';

  type PostingContext = 'org' | 'campaign';

  const props = defineProps<{
    context: PostingContext;
    disabled?: boolean;
    loadingOrgProfiles?: boolean;
    orgProfiles: Array<{ id: number; name: string; profile_image_url?: string | null; scope?: string | null }>;
    orgProfileId: number | null;
    loadingCampaigns?: boolean;
    campaigns: Array<{ id: number; title: string; cover_image_url?: string | null; organization?: { name: string } | null }>;
    campaignId: number | null;
    campaignProfiles: Array<{ id: number; name: string; profile_image_url?: string | null; isGlobal?: boolean }>;
    campaignProfileId: number | null;
  }>();

  const emit = defineEmits<{
    'update:context': [value: PostingContext];
    'update:orgProfileId': [value: number];
    'update:campaignId': [value: number];
    'update:campaignProfileId': [value: number];
  }>();

  const contextOptions = computed(() => [
    { value: 'org' as const, label: 'Organization', icon: Building2 },
    ...(props.campaigns.length > 0 ? [{ value: 'campaign' as const, label: 'Campaign', icon: Trophy }] : []),
  ]);

  const orgProfileOptions = computed(() =>
    props.orgProfiles.map((p) => ({
      id: p.id,
      name: p.name,
      imageUrl: p.profile_image_url,
      tag: p.scope === 'global' ? 'Global' : null,
    }))
  );
  const campaignOptions = computed(() =>
    props.campaigns.map((c) => ({ id: c.id, name: c.title, imageUrl: c.cover_image_url, tag: c.organization?.name ?? null }))
  );
  const campaignProfileOptions = computed(() =>
    props.campaignProfiles.map((p) => ({
      id: p.id,
      name: p.name,
      imageUrl: p.profile_image_url,
      tag: p.isGlobal ? 'Global' : null,
    }))
  );
</script>

<template>
  <Field label="Post for">
    <SegmentedControl
      :model-value="context"
      :options="contextOptions"
      block
      @update:model-value="(v) => emit('update:context', v)"
    />

    <!-- Organization: creator profile -->
    <div v-if="context === 'org'" class="mt-1 animate-enter">
      <p v-if="loadingOrgProfiles" class="skeleton-group text-xs text-fg-subtle">Loading profiles…</p>
      <template v-else-if="orgProfiles.length > 0">
        <Field v-if="orgProfiles.length > 1" label="Creator profile">
          <PublishEntitySelect
            :model-value="orgProfileId"
            :options="orgProfileOptions"
            :icon="User"
            :disabled="disabled"
            placeholder="Select creator profile"
            @update:model-value="(v) => typeof v === 'number' && emit('update:orgProfileId', v)"
          />
        </Field>
        <p v-else class="flex items-center gap-1.5 text-xs text-fg-muted">
          <User class="size-3.5 text-fg-subtle" />
          Posting as <span class="font-medium text-fg">{{ orgProfiles[0]?.name }}</span>
        </p>
      </template>
      <p v-else class="text-xs text-fg-subtle">No creator profiles found for this organization</p>
    </div>

    <!-- Campaign: campaign + branding profile -->
    <div v-else-if="context === 'campaign'" class="mt-1 flex animate-enter flex-col gap-3">
      <p v-if="loadingCampaigns" class="skeleton-group text-xs text-fg-subtle">Loading campaigns…</p>
      <template v-else-if="campaigns.length > 0">
        <Field label="Campaign">
          <PublishEntitySelect
            :model-value="campaignId"
            :options="campaignOptions"
            :icon="Trophy"
            :disabled="disabled"
            placeholder="Select campaign"
            @update:model-value="(v) => typeof v === 'number' && emit('update:campaignId', v)"
          />
        </Field>
        <Field v-if="campaignId && campaignProfiles.length > 1" label="Branding profile">
          <PublishEntitySelect
            :model-value="campaignProfileId"
            :options="campaignProfileOptions"
            :icon="User"
            :disabled="disabled"
            placeholder="Select branding profile"
            @update:model-value="(v) => typeof v === 'number' && emit('update:campaignProfileId', v)"
          />
        </Field>
        <p v-else-if="campaignId && campaignProfiles.length === 1" class="flex items-center gap-1.5 text-xs text-fg-muted">
          <User class="size-3.5 text-fg-subtle" />
          Branding <span class="font-medium text-fg">{{ campaignProfiles[0]?.name }}</span>
        </p>
      </template>
      <p v-else class="text-xs text-fg-subtle">No active campaigns found. Join a campaign first.</p>
    </div>
  </Field>
</template>
