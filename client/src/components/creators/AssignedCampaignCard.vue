<script
  setup
  lang="ts"
  generic="C extends { id: string; name: string; platform_links: { id: string; platform: string }[] }"
>
  /**
   * Card for a campaign the user is assigned to, on the "My creators" page:
   * campaign identity, platforms, branding indicators (intro / outro /
   * watermark) and the participating creators (collapsible). Not the
   * marketplace card — browsing/joining campaigns uses
   * `components/campaigns/CampaignCard.vue` (payout, budget, deadline).
   */
  import { computed } from 'vue';
  import { ChevronDown, Globe, Image as ImageIcon, Play, SkipForward, Trophy } from 'lucide-vue-next';
  import { Avatar } from '@/components/ui/avatar';
  import { Badge } from '@/components/ui/badge';
  import { PlatformLogo } from '@/components/ui/platform-logo';

  interface CampaignCardData {
    id: number;
    title: string;
    organization_name: string;
    cover_image_url?: string;
    isGlobalBranding: boolean;
    creators: C[];
    uniquePlatforms: string[];
    hasIntro: boolean;
    hasOutro: boolean;
    hasWatermark: boolean;
  }

  const props = defineProps<{
    campaign: CampaignCardData;
    expanded: boolean;
    imageFor: (creator: C) => string | undefined;
  }>();

  const emit = defineEmits<{ toggle: [] }>();

  /** Global-branding campaigns have no creator list; nothing to expand without creators. */
  const hasCreators = computed(() => !props.campaign.isGlobalBranding && props.campaign.creators.length > 0);

  const branding = computed(() => [
    { key: 'intro', icon: Play, on: props.campaign.hasIntro, label: 'Intro' },
    { key: 'outro', icon: SkipForward, on: props.campaign.hasOutro, label: 'Outro' },
    { key: 'watermark', icon: ImageIcon, on: props.campaign.hasWatermark, label: 'Watermark' },
  ]);
</script>

<template>
  <article
    class="flex min-w-0 flex-col gap-3 rounded-xl border border-line-subtle bg-surface p-3.5 transition-colors hover:border-line"
  >
    <button
      type="button"
      class="flex items-center gap-3 rounded-lg text-left focus-visible:shadow-[var(--focus-ring)] focus-visible:outline-none"
      :aria-expanded="hasCreators ? expanded : undefined"
      @click="emit('toggle')"
    >
      <Avatar
        :src="campaign.cover_image_url"
        :icon="campaign.isGlobalBranding ? Globe : Trophy"
        shape="square"
        size="md"
      />
      <div class="min-w-0 flex-1">
        <h3 class="truncate text-sm font-semibold text-fg">{{ campaign.title }}</h3>
        <p class="truncate text-xs text-fg-muted">{{ campaign.organization_name }}</p>
      </div>
      <ChevronDown
        v-if="hasCreators"
        class="size-4 shrink-0 text-fg-subtle transition-transform"
        :class="{ 'rotate-180': expanded }"
      />
    </button>

    <div class="flex items-center justify-between gap-2">
      <div class="flex min-w-0 items-center gap-1">
        <Badge v-if="campaign.isGlobalBranding"><Globe /> Any streamer eligible</Badge>
        <template v-else>
          <PlatformLogo v-for="platform in campaign.uniquePlatforms.slice(0, 4)" :key="platform" :platform="platform" size="sm" />
          <span v-if="campaign.uniquePlatforms.length > 4" class="tabular px-1 text-2xs text-fg-subtle">
            +{{ campaign.uniquePlatforms.length - 4 }}
          </span>
          <span class="truncate text-xs text-fg-subtle" :class="{ 'ml-1': campaign.uniquePlatforms.length }">
            {{ campaign.creators.length }} {{ campaign.creators.length === 1 ? 'creator' : 'creators' }}
          </span>
        </template>
      </div>
      <div class="flex shrink-0 items-center gap-1.5">
        <component
          :is="item.icon"
          v-for="item in branding"
          :key="item.key"
          class="size-3.5"
          :class="item.on ? 'text-fg-muted' : 'text-fg-disabled opacity-50'"
          :title="item.on ? `${item.label} configured` : `No ${item.label.toLowerCase()}`"
        />
      </div>
    </div>

    <!-- Creators: avatar stack when collapsed, list when expanded -->
    <div v-if="hasCreators" class="border-t border-line-subtle pt-2.5">
      <div v-if="!expanded" class="flex items-center">
        <Avatar
          v-for="creator in campaign.creators.slice(0, 4)"
          :key="creator.id"
          :src="imageFor(creator)"
          :name="creator.name"
          size="xs"
          class="-ml-1.5 ring-2 ring-surface first:ml-0"
        />
        <span v-if="campaign.creators.length > 4" class="ml-2 text-xs text-fg-subtle">
          +{{ campaign.creators.length - 4 }} more
        </span>
      </div>
      <ul v-else class="flex animate-enter flex-col gap-1.5">
        <li v-for="creator in campaign.creators" :key="creator.id" class="flex min-w-0 items-center gap-2">
          <Avatar :src="imageFor(creator)" :name="creator.name" size="xs" />
          <span class="min-w-0 flex-1 truncate text-sm text-fg">{{ creator.name }}</span>
          <PlatformLogo
            v-for="link in creator.platform_links.slice(0, 3)"
            :key="link.id"
            :platform="link.platform"
            size="xs"
          />
        </li>
      </ul>
    </div>
  </article>
</template>
