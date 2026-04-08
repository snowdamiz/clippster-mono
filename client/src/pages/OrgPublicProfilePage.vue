<template>
  <PageLayout
    :title="profile?.name || 'Organization'"
    :description="profile?.description || ''"
    :show-header="true"
    :icon="Building2"
    :breadcrumbs="breadcrumbs"
  >
    <template #actions>
      <div v-if="profile" class="profile-header-actions">
        <button @click="copyProfileLink" class="profile-action-btn profile-action-btn--outline">
          <Share2 class="profile-action-btn__icon" />
          Share
        </button>
      </div>
    </template>
      <div v-if="loading" class="profile-content profile-content--loading">
        <div class="loading-spinner">
          <Loader2 class="loading-spinner__icon" />
        </div>
      </div>
      <div v-else-if="!profile" class="profile-content profile-content--empty">
        <div class="empty-state">
          <div class="empty-state__icon-wrapper">
            <Building2 class="empty-state__icon" />
          </div>
          <h3 class="empty-state__title">Organization not found</h3>
          <p class="empty-state__description">This organization profile doesn't exist or is private</p>
        </div>
      </div>
      <div v-else class="org-profile">
        <!-- Hero Banner -->
        <div class="org-hero">
          <div class="org-hero__banner"></div>
          <div class="org-hero__content">
            <div class="org-hero__avatar">
              <img v-if="profile.logo_url" :src="profile.logo_url" class="org-hero__avatar-img" />
              <Building2 v-else class="org-hero__avatar-fallback" />
            </div>
            <div class="org-hero__info">
              <h1 class="org-hero__name">{{ profile.name }}</h1>
              <p v-if="profile.description" class="org-hero__tagline">{{ profile.description }}</p>
              <div v-if="profile.content_type_tags?.length" class="org-hero__tags">
                <span v-for="tag in profile.content_type_tags" :key="tag" class="org-hero__tag">{{ getContentTypeLabel(tag) }}</span>
              </div>
            </div>
          </div>
        </div>

        <!-- Stats Grid -->
        <div class="org-stats-grid">
          <div class="org-stat-card">
            <div class="org-stat-card__icon org-stat-card__icon--cyan">
              <TrendingUp :size="18" />
            </div>
            <div class="org-stat-card__content">
              <span class="org-stat-card__value">{{ profile.stats.campaigns_running }}</span>
              <span class="org-stat-card__label">Active Campaigns</span>
            </div>
          </div>
          <div class="org-stat-card">
            <div class="org-stat-card__icon org-stat-card__icon--green">
              <CheckCircle2 :size="18" />
            </div>
            <div class="org-stat-card__content">
              <span class="org-stat-card__value">{{ profile.stats.campaigns_completed }}</span>
              <span class="org-stat-card__label">Completed</span>
            </div>
          </div>
          <div class="org-stat-card">
            <div class="org-stat-card__icon org-stat-card__icon--violet">
              <Video :size="18" />
            </div>
            <div class="org-stat-card__content">
              <span class="org-stat-card__value">{{ profile.stats.streamers_count }}</span>
              <span class="org-stat-card__label">Streamers</span>
            </div>
          </div>
          <div class="org-stat-card">
            <div class="org-stat-card__icon org-stat-card__icon--amber">
              <Users2 :size="18" />
            </div>
            <div class="org-stat-card__content">
              <span class="org-stat-card__value">{{ profile.stats.clippers_count }}</span>
              <span class="org-stat-card__label">Clippers</span>
            </div>
          </div>
          <div class="org-stat-card">
            <div class="org-stat-card__icon org-stat-card__icon--pink">
              <Eye :size="18" />
            </div>
            <div class="org-stat-card__content">
              <span class="org-stat-card__value">{{ formatStatNumber(profile.stats.total_views ?? 0) }}</span>
              <span class="org-stat-card__label">Total Views</span>
            </div>
          </div>
        </div>

        <!-- Main Content Grid -->
        <div class="org-grid">
          <!-- Left Column - Main Content -->
          <div class="org-main">
            <!-- About Card -->
            <div v-if="profile.bio" class="org-card">
              <div class="org-card__header">
                <h2 class="org-card__title">About</h2>
              </div>
              <div class="org-card__body">
                <p class="org-card__text">{{ profile.bio }}</p>
              </div>
            </div>

            <!-- Empty State -->
            <div v-if="!profile.streamers?.length && !profile.bio" class="org-card org-card--empty">
              <Building2 class="org-card__empty-icon" />
              <p class="org-card__empty-text">No public information available yet</p>
            </div>

            <!-- Streamers Card -->
            <div v-if="profile.streamers?.length" class="org-card">
              <div class="org-card__header">
                <h2 class="org-card__title">Streamers</h2>
                <span class="org-card__count">{{ profile.streamers.length }}</span>
              </div>
              <div class="org-card__body org-card__body--streamers">
                <component
                  v-for="s in profile.streamers"
                  :key="s.id"
                  :is="streamerProfileUrl(s) ? 'a' : 'div'"
                  v-bind="streamerCardBind(s)"
                  class="creator-card"
                  :class="{ 'creator-card--link': !!streamerProfileUrl(s) }"
                >
                  <div class="creator-card__banner"></div>
                  <div class="creator-card__content">
                    <div class="creator-card__avatar">
                      <img v-if="s.profile_image_url" :src="s.profile_image_url" class="creator-card__avatar-img" />
                      <UserCircle v-else class="creator-card__avatar-fallback" />
                    </div>
                    <span class="creator-card__name">{{ s.display_name || s.name || 'Streamer' }}</span>
                    <div
                      class="creator-card__platform"
                      :title="s.platform ? platformTitle(s.platform) : 'No platform linked'"
                    >
                      <img
                        v-if="s.platform"
                        :src="getPlatformIcon(s.platform)"
                        class="creator-card__platform-icon"
                        :style="{ filter: getPlatformFilter(s.platform) }"
                        alt=""
                      />
                      <Link v-else class="creator-card__platform-empty" />
                    </div>
                  </div>
                </component>
              </div>
            </div>
          </div>

          <!-- Right Sidebar -->
          <aside class="org-sidebar">
            <!-- Connected Accounts -->
            <div v-if="profile.social_accounts?.length" class="org-card org-card--compact">
              <div class="org-card__header">
                <Users class="org-card__header-icon" />
                <h3 class="org-card__title">Connected</h3>
              </div>
              <div class="org-card__body">
                <div v-for="a in profile.social_accounts" :key="a.id" class="org-account">
                  <img v-if="a.profile_image_url" :src="a.profile_image_url" class="org-account__avatar" />
                  <div v-else class="org-account__avatar org-account__avatar--placeholder">
                    <Users :size="14" />
                  </div>
                  <div class="org-account__info">
                    <span class="org-account__name">{{ a.display_name || a.username || a.platform }}</span>
                    <div class="org-account__platform-row">
                      <span
                        class="org-account__platform-chip"
                        :title="a.platform ? platformTitle(a.platform) : 'No platform linked'"
                      >
                        <img
                          v-if="a.platform && getPlatformIcon(a.platform)"
                          :src="getPlatformIcon(a.platform)"
                          class="org-account__platform-icon"
                          :style="{ filter: getPlatformFilter(a.platform) }"
                          alt=""
                        />
                        <Link v-else class="org-account__platform-empty" />
                      </span>
                      <span class="org-account__platform">{{ a.platform ? platformTitle(a.platform) : 'Unknown' }}</span>
                    </div>
                  </div>
                </div>
              </div>
            </div>

            <!-- Contact -->
            <div v-if="publicContactRows.length" class="org-card org-card--compact">
              <div class="org-card__header">
                <Globe class="org-card__header-icon" />
                <h3 class="org-card__title">Contact</h3>
              </div>
              <div class="org-card__body">
                <div v-for="row in publicContactRows" :key="row.key" class="org-contact">
                  <span class="org-contact__label">{{ row.label }}</span>
                  <a
                    v-if="row.href"
                    :href="row.href"
                    :target="row.external ? '_blank' : undefined"
                    :rel="row.external ? 'noopener noreferrer' : undefined"
                    class="org-contact__value org-contact__value--link"
                  >{{ row.text }}</a>
                  <span v-else class="org-contact__value">{{ row.text }}</span>
                </div>
              </div>
            </div>

            <!-- Hiring -->
            <div v-if="profile.hiring" class="org-card org-card--compact org-card--hiring">
              <div class="org-card__header">
                <Briefcase class="org-card__header-icon" />
                <h3 class="org-card__title">Hiring</h3>
                <span class="org-card__badge">{{ profile.hiring.status }}</span>
              </div>
              <div class="org-card__body">
                <div class="org-hiring__title">{{ profile.hiring.title }}</div>
                <p v-if="profile.hiring.description" class="org-hiring__desc">{{ profile.hiring.description }}</p>
                <div class="org-hiring__meta">
                  <div class="org-hiring__row">
                    <span>Slots</span>
                    <span>{{ profile.hiring.clipper_slots_filled }} / {{ profile.hiring.clipper_slots ?? '∞' }}</span>
                  </div>
                  <div class="org-hiring__row">
                    <span>Experience</span>
                    <span>{{ profile.hiring.experience_level || 'Any' }}</span>
                  </div>
                  <div class="org-hiring__row">
                    <span>Payment</span>
                    <span>{{ profile.hiring.payment_type || 'Not specified' }}</span>
                  </div>
                </div>
              </div>
            </div>
          </aside>
        </div>
      </div>
    </PageLayout>
</template>

<script setup lang="ts">
import { onMounted, ref, computed } from 'vue';
import { useRoute } from 'vue-router';
import { useToast } from '@/composables/useToast';
import { Building2, Loader2, UserCircle, Link, Users, Globe, TrendingUp, CheckCircle2, Users2, Video, Briefcase, Share2, FileText, Eye } from 'lucide-vue-next';
import PageLayout from '@/components/PageLayout.vue';
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
    crumbs.push({ label: 'Clipper Directory', path: '/clippers' });
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
      title: 'Link Copied',
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

function getPlatformIcon(platform: string): string {
  const icons: Record<string, string> = {
    pumpfun: '/capsule.svg',
    kick: '/kick.svg',
    twitch: '/twitch.svg',
    youtube: '/youtube.svg',
    x: '/x.svg',
    twitter: '/x.svg',
    tiktok: '/tiktok.svg',
    rumble: '/rumble.svg',
  };
  return icons[platform] || '';
}

function getPlatformFilter(platform: string): string {
  const filters: Record<string, string> = {
    pumpfun: 'brightness(0) saturate(100%) invert(67%) sepia(52%) saturate(559%) hue-rotate(109deg) brightness(93%) contrast(92%)',
    kick: 'brightness(0) saturate(100%) invert(83%) sepia(47%) saturate(1113%) hue-rotate(57deg) brightness(106%) contrast(98%)',
    twitch: 'brightness(0) saturate(100%) invert(37%) sepia(98%) saturate(1932%) hue-rotate(249deg) brightness(93%) contrast(109%)',
    youtube: 'brightness(0) saturate(100%) invert(22%) sepia(99%) saturate(3013%) hue-rotate(352deg) brightness(95%) contrast(91%)',
  };
  return filters[platform] || 'none';
}

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

function streamerCardBind(s: { platform: string | null; platform_id: string | null }) {
  const href = streamerProfileUrl(s);
  if (!href) return {};
  return { href, target: '_blank', rel: 'noopener noreferrer' };
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

<style scoped>
/* ===== Header Actions ===== */
.profile-header-actions {
  display: flex;
  align-items: center;
  gap: 0.5rem;
}

.profile-action-btn {
  display: inline-flex;
  align-items: center;
  gap: 0.5rem;
  height: 36px;
  padding: 0 1rem;
  border-radius: 8px;
  font-size: 0.8125rem;
  font-weight: 500;
  cursor: pointer;
  transition: all 150ms ease;
  border: 1px solid var(--sidebar-border);
  background: var(--sidebar-surface);
  color: var(--sidebar-text);
}

.profile-action-btn:hover {
  background: var(--sidebar-hover);
  border-color: #22d3ee;
  color: #22d3ee;
}

.profile-action-btn__icon {
  width: 16px;
  height: 16px;
}

/* ===== Loading & Empty States ===== */
.profile-content {
  display: flex;
  flex-direction: column;
  max-width: 1100px;
  margin: 0 auto;
  width: 100%;
  padding: 1.5rem;
}

.profile-content--loading,
.profile-content--empty {
  justify-content: center;
  align-items: center;
  min-height: 400px;
}

.loading-spinner {
  display: flex;
  align-items: center;
  justify-content: center;
}

.loading-spinner__icon {
  width: 32px;
  height: 32px;
  color: #22d3ee;
  animation: spin 1s linear infinite;
}

@keyframes spin {
  to { transform: rotate(360deg); }
}

.empty-state {
  display: flex;
  flex-direction: column;
  align-items: center;
  text-align: center;
}

.empty-state__icon-wrapper {
  display: flex;
  align-items: center;
  justify-content: center;
  width: 64px;
  height: 64px;
  background: var(--sidebar-hover);
  border-radius: 16px;
  margin-bottom: 1rem;
}

.empty-state__icon {
  width: 28px;
  height: 28px;
  color: var(--sidebar-text-muted);
}

.empty-state__title {
  font-size: 1rem;
  font-weight: 600;
  color: var(--sidebar-text);
  margin: 0 0 0.375rem;
}

.empty-state__description {
  font-size: 0.875rem;
  color: var(--sidebar-text-muted);
  margin: 0;
}

/* ===== Organization Profile ===== */
.org-profile {
  display: flex;
  flex-direction: column;
  gap: 0;
  max-width: 1100px;
  margin: 0 auto;
  width: 100%;
  padding: 0 1.5rem 2rem;
}

/* ===== Hero Section ===== */
.org-hero {
  position: relative;
  margin-bottom: 0;
  /* Clear gap between tags / avatar row and stat cards */
  padding-bottom: 1.75rem;
}

.org-hero__banner {
  height: 120px;
  background: linear-gradient(135deg, #0891b2 0%, #06b6d4 25%, #22d3ee 50%, #0891b2 75%, #164e63 100%);
  background-size: 200% 200%;
  border-radius: 14px 14px 0 0;
  position: relative;
  overflow: hidden;
}

.org-hero__banner::before {
  content: '';
  position: absolute;
  inset: 0;
  background: 
    radial-gradient(ellipse 80% 50% at 20% 100%, rgba(255,255,255,0.1) 0%, transparent 50%),
    radial-gradient(ellipse 60% 40% at 80% 20%, rgba(255,255,255,0.08) 0%, transparent 40%);
}

.org-hero__banner::after {
  content: '';
  position: absolute;
  bottom: 0;
  left: 0;
  right: 0;
  height: 52px;
  background: linear-gradient(to top, var(--sidebar-surface) 0%, transparent 100%);
}

.org-hero__content {
  display: flex;
  align-items: flex-start;
  gap: 1.25rem;
  padding: 0 1.5rem;
  /* Overlap cover — tuned for shorter banner */
  margin-top: -48px;
  position: relative;
  z-index: 1;
}

.org-hero__avatar {
  width: 96px;
  height: 96px;
  border-radius: 14px;
  background: var(--sidebar-surface);
  border: 4px solid var(--sidebar-surface);
  overflow: hidden;
  flex-shrink: 0;
  box-shadow: 0 8px 32px rgba(0,0,0,0.3);
}

.org-hero__avatar-img {
  width: 100%;
  height: 100%;
  object-fit: cover;
}

.org-hero__avatar-fallback {
  width: 100%;
  height: 100%;
  display: flex;
  align-items: center;
  justify-content: center;
  background: var(--sidebar-hover);
  color: var(--sidebar-text-muted);
  padding: 24px;
}

.org-hero__info {
  flex: 1;
  min-width: 0;
  padding-top: 0.375rem;
  padding-bottom: 0.25rem;
}

.org-hero__name {
  font-size: 1.5rem;
  font-weight: 700;
  color: var(--sidebar-text);
  margin: 0 0 0.25rem;
  letter-spacing: -0.02em;
  line-height: 1.2;
}

.org-hero__tagline {
  font-size: 0.875rem;
  color: var(--sidebar-text-muted);
  margin: 0 0 0.625rem;
  line-height: 1.5;
}

.org-hero__tags {
  display: flex;
  flex-wrap: wrap;
  gap: 0.375rem;
}

.org-hero__tag {
  display: inline-flex;
  align-items: center;
  padding: 0.25rem 0.625rem;
  background: rgba(34, 211, 238, 0.1);
  border: 1px solid rgba(34, 211, 238, 0.2);
  border-radius: 6px;
  font-size: 0.6875rem;
  font-weight: 500;
  color: #22d3ee;
  letter-spacing: 0.01em;
}

/* ===== Stats Grid ===== */
.org-stats-grid {
  display: grid;
  grid-template-columns: repeat(5, 1fr);
  gap: 0.75rem;
  margin-top: 0.25rem;
  margin-bottom: 1.5rem;
}

@media (max-width: 900px) {
  .org-stats-grid {
    grid-template-columns: repeat(3, 1fr);
  }
}

@media (max-width: 640px) {
  .org-stats-grid {
    grid-template-columns: repeat(2, 1fr);
  }
}

.org-stat-card {
  display: flex;
  align-items: center;
  gap: 0.75rem;
  padding: 1rem;
  background: var(--sidebar-surface);
  border: 1px solid rgba(34, 211, 238, 0.15);
  border-radius: 12px;
  transition: all 200ms ease;
}

.org-stat-card:hover {
  border-color: rgba(34, 211, 238, 0.54);
  box-shadow: 0 0 0 1px rgba(34, 211, 238, 0.28), 0 0 16px rgba(34, 211, 238, 0.14);
}

.org-stat-card__icon {
  display: flex;
  align-items: center;
  justify-content: center;
  width: 40px;
  height: 40px;
  border-radius: 10px;
  flex-shrink: 0;
}

.org-stat-card__icon--cyan {
  background: rgba(34, 211, 238, 0.15);
  color: #22d3ee;
}

.org-stat-card__icon--green {
  background: rgba(52, 211, 153, 0.15);
  color: #34d399;
}

.org-stat-card__icon--violet {
  background: rgba(167, 139, 250, 0.15);
  color: #a78bfa;
}

.org-stat-card__icon--amber {
  background: rgba(251, 191, 36, 0.15);
  color: #fbbf24;
}

.org-stat-card__icon--pink {
  background: rgba(244, 114, 182, 0.15);
  color: #f472b6;
}

.org-stat-card__content {
  display: flex;
  flex-direction: column;
  min-width: 0;
}

.org-stat-card__value {
  font-size: 1.25rem;
  font-weight: 700;
  color: var(--sidebar-text);
  line-height: 1.2;
  font-variant-numeric: tabular-nums;
}

.org-stat-card__label {
  font-size: 0.6875rem;
  color: var(--sidebar-text-muted);
  text-transform: uppercase;
  letter-spacing: 0.03em;
  font-weight: 500;
  white-space: nowrap;
}

/* ===== Main Grid Layout ===== */
.org-grid {
  display: grid;
  grid-template-columns: 1fr 300px;
  gap: 1.5rem;
  align-items: start;
}

@media (max-width: 900px) {
  .org-grid {
    grid-template-columns: 1fr;
  }
}

.org-main {
  display: flex;
  flex-direction: column;
  gap: 1rem;
}

.org-sidebar {
  display: flex;
  flex-direction: column;
  gap: 1rem;
  position: sticky;
  top: 1rem;
}

@media (max-width: 900px) {
  .org-sidebar {
    position: static;
  }
}

/* ===== Cards ===== */
.org-card {
  background: var(--sidebar-surface);
  border: 1px solid rgba(34, 211, 238, 0.15);
  border-radius: 14px;
  overflow: hidden;
  transition: border-color 200ms ease, box-shadow 200ms ease;
}

.org-card:hover {
  border-color: rgba(34, 211, 238, 0.54);
  box-shadow: 0 0 0 1px rgba(34, 211, 238, 0.3), 0 0 18px rgba(34, 211, 238, 0.15);
}

.org-card--compact .org-card__header {
  padding: 0.875rem 1rem;
}

.org-card--compact .org-card__body {
  padding: 1rem;
}

.org-card--empty {
  display: flex;
  flex-direction: column;
  align-items: center;
  justify-content: center;
  padding: 3rem 1.5rem;
  text-align: center;
}

.org-card__empty-icon {
  width: 40px;
  height: 40px;
  color: #22d3ee;
  opacity: 0.35;
  margin-bottom: 0.75rem;
}

.org-card__empty-text {
  font-size: 0.875rem;
  color: var(--sidebar-text-muted);
  margin: 0;
}

.org-card__header {
  display: flex;
  align-items: center;
  gap: 0.625rem;
  padding: 1rem 1.25rem;
  border-bottom: 1px solid rgba(34, 211, 238, 0.1);
  background: linear-gradient(90deg, rgba(34, 211, 238, 0.05) 0%, transparent 50%);
}

.org-card__header-icon {
  width: 18px;
  height: 18px;
  color: #22d3ee;
}

.org-card__title {
  font-size: 0.9375rem;
  font-weight: 600;
  color: var(--sidebar-text);
  margin: 0;
  flex: 1;
}

.org-card__count {
  font-size: 0.75rem;
  font-weight: 500;
  color: #22d3ee;
  background: rgba(34, 211, 238, 0.1);
  padding: 0.1875rem 0.5rem;
  border-radius: 6px;
}

.org-card__badge {
  font-size: 0.6875rem;
  font-weight: 600;
  color: #10b981;
  background: rgba(16, 185, 129, 0.12);
  border: 1px solid rgba(16, 185, 129, 0.25);
  padding: 0.25rem 0.625rem;
  border-radius: 6px;
  text-transform: capitalize;
}

.org-card__body {
  padding: 1.25rem;
}

.org-card__body--grid {
  display: grid;
  grid-template-columns: repeat(auto-fill, minmax(200px, 1fr));
  gap: 0.75rem;
}

.org-card__body--streamers {
  display: grid;
  grid-template-columns: repeat(auto-fill, minmax(180px, 1fr));
  gap: 1rem;
}

.org-card__text {
  font-size: 0.875rem;
  color: var(--sidebar-text-muted);
  line-height: 1.65;
  margin: 0;
  white-space: pre-wrap;
}

/* ===== Creator Cards ===== */
.creator-card {
  position: relative;
  display: flex;
  flex-direction: column;
  background: var(--sidebar-surface);
  border: 1px solid rgba(34, 211, 238, 0.15);
  border-radius: 14px;
  overflow: hidden;
  transition: all 200ms ease;
}

.creator-card--link {
  text-decoration: none;
  color: inherit;
  cursor: pointer;
}

.creator-card:hover {
  border-color: rgba(34, 211, 238, 0.54);
  transform: translateY(-3px);
  box-shadow: 0 12px 28px rgba(0, 0, 0, 0.2), 0 0 0 1px rgba(34, 211, 238, 0.28), 0 0 18px rgba(34, 211, 238, 0.15);
}

.creator-card__banner {
  height: 56px;
  background: linear-gradient(135deg, rgba(34, 211, 238, 0.2) 0%, rgba(34, 211, 238, 0.1) 50%, transparent 100%);
}

.creator-card__content {
  display: flex;
  flex-direction: column;
  align-items: center;
  text-align: center;
  padding: 0 1rem 1.25rem;
  margin-top: -32px;
}

.creator-card__avatar {
  width: 64px;
  height: 64px;
  border-radius: 50%;
  overflow: hidden;
  background: var(--sidebar-hover);
  border: 3px solid var(--sidebar-surface);
  box-shadow: 0 4px 12px rgba(0, 0, 0, 0.25), 0 0 0 1px rgba(34, 211, 238, 0.2);
  margin-bottom: 0.75rem;
}

.creator-card__avatar-img {
  width: 100%;
  height: 100%;
  object-fit: cover;
}

.creator-card__avatar-fallback {
  width: 100%;
  height: 100%;
  color: var(--sidebar-text-muted);
  padding: 12px;
}

.creator-card__name {
  font-size: 0.9375rem;
  font-weight: 600;
  color: var(--sidebar-text);
  margin-bottom: 0.375rem;
  max-width: 100%;
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
}

.creator-card__platform {
  display: flex;
  align-items: center;
  justify-content: center;
  min-width: 2.5rem;
  min-height: 2.5rem;
  padding: 0.375rem;
  background: rgba(255, 255, 255, 0.06);
  border-radius: 10px;
}

.creator-card__platform-icon {
  width: 22px;
  height: 22px;
  object-fit: contain;
}

.creator-card__platform-empty {
  width: 22px;
  height: 22px;
  color: var(--sidebar-text-muted);
  opacity: 0.55;
}

/* ===== Account Items ===== */
.org-account {
  display: flex;
  align-items: center;
  gap: 0.625rem;
  padding: 0.5rem;
  border-radius: 8px;
  transition: background 150ms ease;
}

.org-account:hover {
  background: var(--sidebar-hover);
}

.org-account__avatar {
  width: 32px;
  height: 32px;
  border-radius: 50%;
  object-fit: cover;
  flex-shrink: 0;
}

.org-account__avatar--placeholder {
  display: flex;
  align-items: center;
  justify-content: center;
  background: var(--sidebar-hover);
  color: var(--sidebar-text-muted);
}

.org-account__info {
  flex: 1;
  min-width: 0;
}

.org-account__name {
  display: block;
  font-size: 0.8125rem;
  font-weight: 500;
  color: var(--sidebar-text);
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
}

.org-account__platform {
  font-size: 0.6875rem;
  color: var(--sidebar-text-muted);
  text-transform: capitalize;
}

.org-account__platform-row {
  display: flex;
  align-items: center;
  gap: 0.375rem;
}

.org-account__platform-chip {
  display: inline-flex;
  align-items: center;
  justify-content: center;
  width: 1.125rem;
  height: 1.125rem;
  border-radius: 0.3125rem;
  background: rgba(255, 255, 255, 0.08);
}

.org-account__platform-icon {
  width: 0.75rem;
  height: 0.75rem;
  object-fit: contain;
}

.org-account__platform-empty {
  width: 0.6875rem;
  height: 0.6875rem;
  color: var(--sidebar-text-muted);
  opacity: 0.7;
}

/* ===== Contact Items ===== */
.org-contact {
  display: flex;
  justify-content: space-between;
  align-items: baseline;
  padding: 0.5rem 0;
  border-bottom: 1px solid var(--sidebar-border);
}

.org-contact:last-child {
  border-bottom: none;
  padding-bottom: 0;
}

.org-contact:first-child {
  padding-top: 0;
}

.org-contact__label {
  font-size: 0.75rem;
  color: var(--sidebar-text-muted);
  font-weight: 500;
}

.org-contact__value {
  font-size: 0.8125rem;
  color: var(--sidebar-text);
  text-align: right;
  word-break: break-word;
}

.org-contact__value--link {
  text-decoration: none;
  color: #22d3ee;
  transition: opacity 150ms ease;
}

.org-contact__value--link:hover {
  opacity: 0.8;
}

/* ===== Hiring Card ===== */
.org-card--hiring {
  border-color: rgba(16, 185, 129, 0.2);
}

.org-card--hiring:hover {
  border-color: rgba(16, 185, 129, 0.54);
  box-shadow: 0 0 0 1px rgba(16, 185, 129, 0.3), 0 0 18px rgba(16, 185, 129, 0.15);
}

.org-card--hiring .org-card__header {
  background: linear-gradient(90deg, rgba(16, 185, 129, 0.06) 0%, transparent 50%);
  border-bottom-color: rgba(16, 185, 129, 0.12);
}

.org-hiring__title {
  font-size: 0.9375rem;
  font-weight: 600;
  color: var(--sidebar-text);
  margin-bottom: 0.375rem;
}

.org-hiring__desc {
  font-size: 0.8125rem;
  color: var(--sidebar-text-muted);
  line-height: 1.5;
  margin: 0 0 0.75rem;
}

.org-hiring__meta {
  display: flex;
  flex-direction: column;
  gap: 0.375rem;
}

.org-hiring__row {
  display: flex;
  justify-content: space-between;
  font-size: 0.75rem;
  padding: 0.375rem 0;
  border-bottom: 1px solid var(--sidebar-border);
}

.org-hiring__row:last-child {
  border-bottom: none;
}

.org-hiring__row span:first-child {
  color: var(--sidebar-text-muted);
}

.org-hiring__row span:last-child {
  color: var(--sidebar-text);
  font-weight: 500;
}

/* ===== Responsive ===== */
@media (max-width: 640px) {
  .org-profile {
    padding: 0 1rem 1.5rem;
  }

  .org-hero {
    padding-bottom: 1.5rem;
  }

  .org-hero__banner {
    height: 100px;
  }

  .org-hero__content {
    flex-direction: column;
    align-items: center;
    text-align: center;
    margin-top: -40px;
    padding: 0 1rem;
  }

  .org-hero__avatar {
    width: 88px;
    height: 88px;
  }

  .org-hero__info {
    padding-top: 0.5rem;
    padding-bottom: 0;
  }

  .org-hero__name {
    font-size: 1.25rem;
  }

  .org-hero__tags {
    justify-content: center;
  }

  .org-stats-grid {
    margin-top: 0.5rem;
  }

  .org-card__body--grid {
    grid-template-columns: 1fr;
  }
}
</style>
