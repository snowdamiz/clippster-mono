<script setup lang="ts">
  /**
   * Campaign collection card (Campaigns page, organization campaigns): cover
   * thumbnail (no banner, so cards with and without a cover line up), title +
   * status, organization + deadline, the description, then under a hairline
   * the payout and budget usage and a meta row (streamers, platforms,
   * clippers). Emits `open` when the card is activated. Slots: `actions`
   * (end of the title row, e.g. admin buttons; the status badge then moves to
   * the meta line), `meta` (replaces the organization). For campaigns the user is
   * assigned to on "My creators", see `components/creators/AssignedCampaignCard.vue`.
   */
  import { computed } from 'vue';
  import { Building2, Clock, Globe, Megaphone, Sparkles, Users } from 'lucide-vue-next';
  import { Badge } from '@/components/ui/badge';
  import { Avatar } from '@/components/ui/avatar';
  import { PlatformLogo } from '@/components/ui/platform-logo';
  import type { Campaign } from '@/services/campaignApi';
  import { budgetPercent, daysRemaining, deadlineLabel, formatBudget, humanize, payout, statusVariant } from './campaignDisplay';

  const props = defineProps<{
    campaign: Campaign;
    /** Link target for the organization (when it has a public profile). */
    orgTo?: string | Record<string, unknown> | null;
  }>();

  const emit = defineEmits<{ open: [] }>();

  const pay = computed(() => payout(props.campaign));
  const used = computed(() => budgetPercent(props.campaign));
  const deadline = computed(() => deadlineLabel(props.campaign.ends_at));
  const endingSoon = computed(() => {
    const days = daysRemaining(props.campaign.ends_at);
    return days !== null && days <= 3;
  });
  // Global branding: no specific creator, but a branding profile
  const anyStreamer = computed(
    () => props.campaign.creator_profile_id === null && props.campaign.branding_profile_id !== null
  );
  const creators = computed(() => props.campaign.creator_profiles ?? []);
</script>

<template>
  <article
    role="button"
    tabindex="0"
    class="group flex min-w-0 cursor-pointer flex-col overflow-hidden rounded-xl border border-line-subtle bg-surface transition-colors duration-[var(--duration-fast)] hover:border-line-strong focus-visible:shadow-[var(--focus-ring)] focus-visible:outline-none"
    @click="emit('open')"
    @keydown.enter.prevent="emit('open')"
  >
    <div class="flex flex-1 flex-col gap-2.5 px-3.5 py-3">
      <!-- Cover thumbnail, title, status, organization, deadline, description -->
      <div class="min-w-0">
        <div class="flex min-w-0 items-start gap-2.5">
          <Avatar :src="campaign.cover_image_url" :icon="Megaphone" size="md" shape="square" />
          <div class="min-w-0 flex-1">
            <div class="flex min-w-0 items-center gap-2">
              <h3 class="min-w-0 flex-1 truncate text-sm font-semibold text-fg" :title="campaign.title">
                {{ campaign.title }}
              </h3>
              <Badge v-if="!$slots.actions" :variant="statusVariant(campaign.status)" class="shrink-0">
                {{ humanize(campaign.status) }}
              </Badge>
              <slot name="actions" />
            </div>
            <div class="mt-0.5 flex min-w-0 items-center gap-1.5 text-xs text-fg-muted">
              <Badge v-if="$slots.actions" :variant="statusVariant(campaign.status)" class="mr-0.5 shrink-0">
                {{ humanize(campaign.status) }}
              </Badge>
              <slot name="meta">
                <template v-if="campaign.is_platform_campaign">
                  <Sparkles class="size-3.5 shrink-0 text-brand" />
                  <span class="truncate">Clippster campaign</span>
                </template>
                <template v-else-if="campaign.organization">
                  <Avatar
                    :src="campaign.organization.logo_url"
                    :name="campaign.organization.name"
                    :icon="Building2"
                    size="xs"
                    shape="square"
                  />
                  <router-link
                    v-if="orgTo"
                    :to="orgTo"
                    class="truncate transition-colors hover:text-fg hover:underline"
                    @click.stop
                  >
                    {{ campaign.organization.name }}
                  </router-link>
                  <span v-else class="truncate">{{ campaign.organization.name }}</span>
                </template>
              </slot>
              <span
                v-if="deadline"
                class="ml-auto flex shrink-0 items-center gap-1 pl-2"
                :class="endingSoon ? 'text-warning' : ''"
              >
                <Clock class="size-3.5" :class="endingSoon ? '' : 'text-fg-subtle'" />
                {{ deadline }}
              </span>
            </div>
          </div>
        </div>
        <p v-if="campaign.description" class="mt-2 line-clamp-2 text-xs leading-[1.125rem] text-fg-muted">
          {{ campaign.description }}
        </p>
      </div>

      <div class="mt-auto flex flex-col gap-2 border-t border-line-subtle pt-2.5">
        <!-- Key figures: payout and budget usage -->
        <div :title="`${used.toFixed(0)}% of the budget used`">
          <div class="flex min-w-0 items-baseline justify-between gap-3">
            <p class="min-w-0 truncate">
              <span class="tabular text-sm font-semibold text-fg">{{ pay.value }}</span>
              <span class="ml-1 text-xs text-fg-muted">{{ pay.unit }}</span>
            </p>
            <p class="tabular shrink-0 text-xs text-fg-muted">
              <span class="font-medium text-fg">${{ formatBudget(campaign.spent_budget || 0) }}</span>
              of ${{ formatBudget(campaign.budget) }}
            </p>
          </div>
          <div class="mt-1.5 h-1 overflow-hidden rounded-full bg-surface-active">
            <div
              class="h-full rounded-full transition-[width] duration-300"
              :class="used >= 90 ? 'bg-warning' : 'bg-brand'"
              :style="{ width: used + '%' }"
            />
          </div>
        </div>

        <!-- Meta: streamers, platforms, clippers -->
        <div class="flex min-w-0 items-center justify-between gap-3 text-xs text-fg-muted">
          <span v-if="anyStreamer" class="flex min-w-0 items-center gap-1.5">
            <Globe class="size-3.5 shrink-0 text-fg-subtle" />
            <span class="truncate">Any streamer</span>
          </span>
          <span
            v-else-if="creators.length"
            class="flex min-w-0 items-center"
            :title="creators.map((c) => c.name).join(', ')"
          >
            <Avatar
              v-for="profile in creators.slice(0, 3)"
              :key="profile.id"
              :src="profile.profile_image_url"
              :name="profile.name"
              size="xs"
              class="-ml-1 ring-2 ring-surface first:ml-0"
            />
            <span class="ml-1.5 truncate">
              {{ creators.length === 1 ? creators[0].name : `${creators.length} streamers` }}
            </span>
          </span>
          <span v-else />
          <div class="flex shrink-0 items-center gap-2.5">
            <span v-if="campaign.allowed_platforms?.length" class="flex items-center gap-1">
              <PlatformLogo
                v-for="platform in campaign.allowed_platforms"
                :key="platform"
                :platform="platform"
                size="xs"
              />
            </span>
            <span class="flex items-center gap-1" :title="`${campaign.participants_count || 0} clippers`">
              <Users class="size-3.5 text-fg-subtle" />
              <span class="tabular">{{ campaign.participants_count || 0 }}</span>
            </span>
          </div>
        </div>
      </div>
    </div>
  </article>
</template>
