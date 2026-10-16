<template>
  <PageLayout
    :title="profile?.name || 'Organization'"
    :description="profile?.description || ''"
    :show-header="true"
    :icon="Building2"
    :breadcrumbs="breadcrumbs"
  >
    <template #actions>
      <Button v-if="profile" variant="secondary" size="sm" @click="copyProfileLink">
        <Share2 />
        Share
      </Button>
    </template>

    <div class="@container flex flex-1 flex-col px-5 py-4">
      <!-- Loading -->
      <div v-if="loading && !profile" class="flex flex-col gap-4" aria-busy="true">
        <div class="flex items-start gap-4 pb-4">
          <div class="skeleton size-11 shrink-0 rounded-[10px]" />
          <div class="flex flex-1 flex-col gap-2 pt-0.5">
            <div class="skeleton h-4 w-48" />
            <div class="skeleton h-3.5 w-full max-w-[420px]" />
          </div>
          <div class="skeleton hidden h-10 w-[560px] @5xl:block" />
        </div>
        <div class="grid grid-cols-1 gap-4 @3xl:grid-cols-[minmax(0,1fr)_17rem]">
          <div class="skeleton h-44 rounded-xl" />
          <div class="skeleton h-44 rounded-xl" />
        </div>
      </div>

      <!-- Not found -->
      <EmptyState
        v-else-if="!profile"
        :icon="Building2"
        title="Organization not found"
        description="This organization profile doesn't exist or is private."
      />

      <!-- Profile -->
      <div v-else class="flex animate-enter flex-col gap-5">
        <ProfileHeader
          :name="profile.name"
          :avatar="profile.logo_url"
          :avatar-icon="Building2"
          shape="square"
          :subtitle="profile.description"
          class="border-b border-line-subtle pb-4"
        >
          <template v-if="profile.content_type_tags?.length">
            <Badge v-for="tag in profile.content_type_tags" :key="tag">{{ getContentTypeLabel(tag) }}</Badge>
          </template>
          <template #aside>
            <!-- Five figures: keep them on one row down to the 800px window (the sm grid would wrap the fifth) -->
            <StatGrid size="sm" class="w-full max-w-[560px] shrink-0 self-center">
              <StatCard label="Campaigns" :value="profile.stats.campaigns_running" hint="active" />
              <StatCard label="Completed" :value="profile.stats.campaigns_completed" />
              <StatCard label="Streamers" :value="profile.stats.streamers_count" />
              <StatCard label="Clippers" :value="profile.stats.clippers_count" />
              <StatCard
                label="Total views"
                :value="formatCompact(profile.stats.total_views ?? 0)"
                :title="formatStatNumber(profile.stats.total_views ?? 0)"
              />
            </StatGrid>
          </template>
        </ProfileHeader>

        <div class="grid grid-cols-1 items-start gap-5 @3xl:grid-cols-[minmax(0,1fr)_17rem]">
          <!-- Main column -->
          <div class="flex min-w-0 flex-col gap-5">
            <section v-if="profile.bio" class="flex flex-col gap-1.5">
              <SectionHeader title="About" />
              <p class="max-w-[720px] whitespace-pre-line text-sm leading-relaxed text-fg-muted">{{ profile.bio }}</p>
            </section>

            <EmptyState
              v-if="!profile.streamers?.length && !profile.bio"
              size="sm"
              :icon="Building2"
              title="No public information yet"
              description="This organization hasn't added a bio or streamers."
            />

            <section v-if="profile.streamers?.length" class="flex flex-col gap-2.5">
              <SectionHeader title="Streamers" :count="profile.streamers.length" />
              <ListGroup :columns="2">
                <ListItem
                  v-for="s in profile.streamers"
                  :key="s.id"
                  :title="s.display_name || s.name || 'Streamer'"
                  :href="streamerProfileUrl(s) ?? undefined"
                  :target="streamerProfileUrl(s) ? '_blank' : undefined"
                  :rel="streamerProfileUrl(s) ? 'noopener noreferrer' : undefined"
                  :chevron="false"
                >
                  <template #leading>
                    <Avatar :src="s.profile_image_url" :name="s.display_name || s.name" :icon="UserCircle" size="sm" />
                  </template>
                  <p class="flex min-w-0 items-center gap-1 text-xs text-fg-muted">
                    <template v-if="s.platform">
                      <PlatformLogo :platform="s.platform" size="xs" />
                      <span class="truncate">{{ platformTitle(s.platform) }}</span>
                    </template>
                    <template v-else>
                      <Link class="size-3 text-fg-subtle" />
                      <span class="truncate">No platform linked</span>
                    </template>
                  </p>
                  <template v-if="streamerProfileUrl(s)" #trailing>
                    <ExternalLink class="size-3.5 shrink-0 text-fg-subtle" />
                  </template>
                </ListItem>
              </ListGroup>
            </section>
          </div>

          <!-- Side column: one frame, sections divided by hairlines -->
          <aside
            v-if="profile.hiring || publicContactRows.length || profile.social_accounts?.length"
            class="min-w-0 divide-y divide-line-subtle overflow-hidden rounded-xl border border-line-subtle bg-surface"
          >
            <ProfileAsideSection v-if="profile.hiring" title="Hiring" :icon="Briefcase">
              <template #actions>
                <Badge :variant="profile.hiring.status === 'open' ? 'success' : 'neutral'">
                  {{ humanize(profile.hiring.status) }}
                </Badge>
              </template>
              <div>
                <p class="text-sm font-medium text-fg">{{ profile.hiring.title }}</p>
                <p v-if="profile.hiring.description" class="mt-0.5 text-xs text-fg-muted">{{ profile.hiring.description }}</p>
              </div>
              <InfoList
                compact
                :rows="[
                  {
                    label: 'Slots',
                    value: `${profile.hiring.clipper_slots_filled} / ${profile.hiring.clipper_slots ?? '∞'}`,
                  },
                  { label: 'Experience', value: humanize(profile.hiring.experience_level) || 'Any' },
                  { label: 'Payment', value: profile.hiring.payment_type || 'Not specified' },
                ]"
              />
            </ProfileAsideSection>

            <ProfileAsideSection v-if="publicContactRows.length" title="Contact" :icon="Globe">
              <InfoList
                compact
                :rows="
                  publicContactRows.map((row) => ({
                    label: row.label,
                    value: row.text,
                    href: row.href,
                    external: row.external,
                  }))
                "
              />
            </ProfileAsideSection>

            <ProfileAsideSection v-if="profile.social_accounts?.length" title="Connected" :icon="Users">
              <div class="flex flex-col">
                <LinkRow
                  v-for="a in profile.social_accounts"
                  :key="a.id"
                  :title="a.display_name || a.username || a.platform"
                  :subtitle="a.platform ? platformTitle(a.platform) : 'Unknown'"
                >
                  <template #leading>
                    <Avatar
                      v-if="a.profile_image_url"
                      :src="a.profile_image_url"
                      :name="a.display_name || a.username"
                      size="sm"
                    />
                    <PlatformLogo v-else :platform="a.platform" size="md" />
                  </template>
                </LinkRow>
              </div>
            </ProfileAsideSection>
          </aside>
        </div>
      </div>
    </div>
  </PageLayout>
</template>

<script setup lang="ts">
import { onMounted, ref, computed } from 'vue';
import { useRoute } from 'vue-router';
import { useToast } from '@/composables/useToast';
import { Building2, UserCircle, Link, Users, Globe, Briefcase, Share2, ExternalLink } from 'lucide-vue-next';
import PageLayout from '@/components/PageLayout.vue';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { EmptyState } from '@/components/ui/empty-state';
import { StatCard, StatGrid } from '@/components/ui/stat-card';
import { ListGroup, ListItem } from '@/components/ui/list-group';
import { SectionHeader } from '@/components/ui/section-header';
import { InfoList } from '@/components/ui/info-list';
import LinkRow from '@/components/directory/LinkRow.vue';
import { Avatar } from '@/components/ui/avatar';
import { PlatformLogo } from '@/components/ui/platform-logo';
import ProfileHeader from '@/components/directory/ProfileHeader.vue';
import ProfileAsideSection from '@/components/directory/ProfileAsideSection.vue';
import { formatCompact, humanize } from '@/components/campaigns/campaignDisplay';
import { getOrgPublicProfileBySlug, getContentTypeLabel, type OrgPublicProfile } from '@/services/orgPublicProfilesApi';

const route = useRoute();
const { toast } = useToast();
const loading = ref(true);
const profile = ref<OrgPublicProfile | null>(null);

type PublicContactRow = {
  key: string;
  label: string;
  text: string;
  href: string | null;
  external?: boolean;
};

const publicContactRows = computed((): PublicContactRow[] => {
  const p = profile.value;
  if (!p) return [];
  const rows: PublicContactRow[] = [];
  if (p.public_contact_email?.trim()) {
    rows.push({
      key: 'email',
      label: 'Email',
      text: p.public_contact_email.trim(),
      href: `mailto:${p.public_contact_email.trim()}`,
    });
  }
  if (p.website_url?.trim()) {
    rows.push({
      key: 'website',
      label: 'Website',
      text: p.website_url.trim(),
      href: ensureUrl(p.website_url.trim()),
      external: true,
    });
  }
  if (p.public_discord?.trim()) {
    const text = p.public_discord.trim();
    const dh = discordContactHref(text);
    rows.push({
      key: 'discord',
      label: 'Discord',
      text,
      href: dh,
      external: !!dh,
    });
  }
  if (p.public_telegram?.trim()) {
    const text = p.public_telegram.trim();
    rows.push({
      key: 'telegram',
      label: 'Telegram',
      text,
      href: telegramContactHref(text),
      external: true,
    });
  }
  return rows;
});

const breadcrumbs = computed(() => {
  const from = route.query.from as string | undefined;
  if (!from) return undefined;
  const crumbs: { label: string; path?: string }[] = [];
  if (from.includes('/organizations')) {
    crumbs.push({ label: 'Organizations', path: '/organizations' });
  } else if (from.includes('/clippers')) {
    crumbs.push({ label: 'Clipper directory', path: '/clippers' });
  } else {
    crumbs.push({ label: 'Back', path: from });
  }
  crumbs.push({ label: profile.value?.name || 'Organization' });
  return crumbs;
});

const copyProfileLink = () => {
  // Generate landing web app URL, not desktop app URL
  const landingUrl = import.meta.env.VITE_LANDING_URL || 'https://clippster.app';
  const url = `${landingUrl}/orgs/${profile.value?.slug}`;
  navigator.clipboard.writeText(url).then(() => {
    toast({
      title: 'Link copied',
      description: 'Organization profile link copied to clipboard',
    });
  });
};

onMounted(async () => {
  const slug = route.params.slug as string;
  try {
    const res = await getOrgPublicProfileBySlug(slug);
    if (res.success && res.profile) profile.value = res.profile;
  } finally {
    loading.value = false;
  }
});

const platformLabels: Record<string, string> = {
  kick: 'Kick',
  twitch: 'Twitch',
  youtube: 'YouTube',
  pumpfun: 'Pump.fun',
  x: 'X',
  twitter: 'X',
  tiktok: 'TikTok',
  instagram: 'Instagram',
  rumble: 'Rumble',
};

function platformTitle(platform: string): string {
  return platformLabels[platform] || platform;
}

function streamerProfileUrl(s: { platform: string | null; platform_id: string | null }): string | null {
  if (!s.platform || !s.platform_id?.trim()) return null;
  const id = s.platform_id.trim();
  switch (s.platform) {
    case 'kick':
      return `https://kick.com/${id}`;
    case 'pumpfun':
      return `https://pump.fun/coin/${id}`;
    case 'twitch':
      return `https://twitch.tv/${id}`;
    case 'youtube':
      return `https://youtube.com/@${id}`;
    default:
      return null;
  }
}

function ensureUrl(url: string): string {
  if (url.startsWith('http://') || url.startsWith('https://')) return url;
  return `https://${url}`;
}

/** Resolves Discord invite links; returns null when value should be shown as plain text. */
function discordContactHref(raw: string): string | null {
  const t = raw.trim();
  if (!t) return null;
  if (/^https?:\/\//i.test(t)) return t;
  if (t.includes('discord.gg/') || t.includes('discord.com/')) return ensureUrl(t);
  if (/^[a-zA-Z0-9_-]{2,40}$/.test(t)) return `https://discord.gg/${encodeURIComponent(t)}`;
  return null;
}

function telegramContactHref(raw: string): string {
  const t = raw.trim();
  if (/^https?:\/\//i.test(t)) return t;
  const u = t.replace(/^@/, '').replace(/^https?:\/\/(www\.)?t\.me\//i, '');
  return `https://t.me/${u}`;
}

function formatStatNumber(n: number): string {
  return n.toLocaleString();
}
</script>
