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
      <div v-else class="profile-content">
        <div class="profile-header-card">
          <div class="profile-header-bg"></div>
          <div class="profile-header-content">
            <div class="profile-header-main">
              <div class="profile-avatar-wrapper">
                <div class="profile-avatar">
                  <img v-if="profile.logo_url" :src="profile.logo_url" class="profile-avatar__img" />
                  <Building2 v-else class="profile-avatar__fallback" />
                </div>
              </div>
              <div class="profile-info">
                <div class="profile-name-row">
                  <h1 class="profile-name">{{ profile.name }}</h1>
                </div>
                <p v-if="profile.description" class="profile-bio">{{ profile.description }}</p>
                <div v-if="profile.content_type_tags?.length" class="profile-tags">
                  <span v-for="tag in profile.content_type_tags" :key="tag" class="profile-tag">{{ getContentTypeLabel(tag) }}</span>
                </div>
              </div>
            </div>

            <div class="profile-stats-grid">
              <div class="profile-stat-card">
                <div class="profile-stat-card__icon profile-stat-card__icon--sky">
                  <TrendingUp :size="15" />
                </div>
                <div class="profile-stat-card__content">
                  <span class="profile-stat-card__value">{{ profile.stats.campaigns_running }}</span>
                  <span class="profile-stat-card__label">Active Campaigns</span>
                </div>
              </div>
              <div class="profile-stat-card">
                <div class="profile-stat-card__icon profile-stat-card__icon--green">
                  <CheckCircle2 :size="15" />
                </div>
                <div class="profile-stat-card__content">
                  <span class="profile-stat-card__value">{{ profile.stats.campaigns_completed }}</span>
                  <span class="profile-stat-card__label">Completed Campaigns</span>
                </div>
              </div>
              <div class="profile-stat-card">
                <div class="profile-stat-card__icon profile-stat-card__icon--violet">
                  <Video :size="15" />
                </div>
                <div class="profile-stat-card__content">
                  <span class="profile-stat-card__value">{{ profile.stats.streamers_count }}</span>
                  <span class="profile-stat-card__label">Streamers</span>
                </div>
              </div>
              <div class="profile-stat-card">
                <div class="profile-stat-card__icon profile-stat-card__icon--amber">
                  <Users2 :size="15" />
                </div>
                <div class="profile-stat-card__content">
                  <span class="profile-stat-card__value">{{ profile.stats.clippers_count }}</span>
                  <span class="profile-stat-card__label">Clippers</span>
                </div>
              </div>
              <div class="profile-stat-card">
                <div class="profile-stat-card__icon profile-stat-card__icon--fuchsia">
                  <Eye :size="15" />
                </div>
                <div class="profile-stat-card__content">
                  <span class="profile-stat-card__value">{{ formatStatNumber(profile.stats.total_views ?? 0) }}</span>
                  <span class="profile-stat-card__label">Total Views</span>
                </div>
              </div>
            </div>
          </div>
        </div>

        <div class="main-layout">
          <div class="main-column">
            <!-- Bio Section -->
            <section v-if="profile.bio" class="section">
              <div class="section__header">
                <div class="section__header-icon section__header-icon--purple">
                  <FileText />
                </div>
                <div class="section__header-text">
                  <h2 class="section__title">About</h2>
                </div>
              </div>
              <div class="section__content">
                <p class="bio-text">{{ profile.bio }}</p>
              </div>
            </section>

            <!-- Empty state when no content -->
            <div v-if="!profile.streamers?.length && !profile.bio" class="section">
              <div class="section__content" style="padding: 3rem; text-align: center;">
                <Building2 style="width: 48px; height: 48px; margin: 0 auto 1rem; opacity: 0.3;" />
                <p style="color: var(--sidebar-text-muted); font-size: 0.875rem;">No public information available yet</p>
              </div>
            </div>

            <section v-if="profile.streamers?.length" class="section">
              <div class="section__header">
                <div class="section__header-icon section__header-icon--cyan">
                  <Video />
                </div>
                <div class="section__header-text">
                  <h2 class="section__title">Streamers</h2>
                  <p class="section__subtitle">{{ profile.streamers.length }} streamers</p>
                </div>
              </div>
              <div class="section__content">
                <div class="creators__list-inner">
                <component
                  v-for="s in profile.streamers"
                  :key="s.id"
                  :is="streamerProfileUrl(s) ? 'a' : 'div'"
                  v-bind="streamerCardBind(s)"
                  class="creator-card"
                  :class="{ 'creator-card--link': !!streamerProfileUrl(s) }"
                >
                  <div class="creator-card__header">
                    <div class="creator-card__avatar">
                      <img v-if="s.profile_image_url" :src="s.profile_image_url" class="creator-card__avatar-img" />
                      <div v-else class="creator-card__avatar-fallback">
                        <UserCircle class="creator-card__avatar-icon" />
                      </div>
                    </div>
                    <div class="creator-card__header-info">
                      <div class="creator-card__name-row">
                        <span class="creator-card__name">{{ s.display_name || s.name || 'Streamer' }}</span>
                      </div>
                      <div class="creator-card__platform-icons">
                        <div
                          class="creator-card__platform-icon-wrapper"
                          :title="s.platform ? platformTitle(s.platform) : 'No platform linked'"
                        >
                          <img
                            v-if="s.platform"
                            :src="getPlatformIcon(s.platform)"
                            class="creator-card__platform-icon"
                            :style="{ filter: getPlatformFilter(s.platform) }"
                            alt=""
                          />
                          <Link v-else class="creator-card__empty-icon" />
                        </div>
                      </div>
                    </div>
                  </div>
                </component>
                </div>
              </div>
            </section>
          </div>

          <aside class="sidebar-column">
            <div v-if="profile.social_accounts?.length" class="sidebar-card">
              <div class="sidebar-card__header">
                <Users class="sidebar-card__icon" />
                <h3 class="sidebar-card__title">Connected Accounts</h3>
              </div>
              <div class="sidebar-card__content">
                <div class="connected-accounts-list">
                <div v-for="a in profile.social_accounts" :key="a.id" class="connected-account">
                  <img v-if="a.profile_image_url" :src="a.profile_image_url" class="connected-account__avatar" />
                  <div v-else class="connected-account__avatar-fallback"><Users class="connected-account__avatar-icon" /></div>
                  <div class="connected-account__info">
                    <div class="connected-account__username">{{ a.display_name || a.username || a.platform }}</div>
                    <div class="connected-account__platform">{{ a.platform }}</div>
                  </div>
                  </div>
                </div>
              </div>
            </div>

            <div v-if="publicContactRows.length" class="sidebar-card">
              <div class="sidebar-card__header">
                <Globe class="sidebar-card__icon" />
                <h3 class="sidebar-card__title">Contact</h3>
              </div>
              <div class="sidebar-card__content sidebar-card__content--contact">
                <div v-for="row in publicContactRows" :key="row.key" class="contact-field">
                  <span class="contact-field__label">{{ row.label }}</span>
                  <a
                    v-if="row.href"
                    :href="row.href"
                    :target="row.external ? '_blank' : undefined"
                    :rel="row.external ? 'noopener noreferrer' : undefined"
                    class="contact-field__value contact-field__value--link"
                  >{{ row.text }}</a>
                  <span v-else class="contact-field__value">{{ row.text }}</span>
                </div>
              </div>
            </div>

            <div v-if="profile.hiring" class="sidebar-card">
              <div class="sidebar-card__header">
                <Briefcase class="sidebar-card__icon" />
                <h3 class="sidebar-card__title">Hiring</h3>
                <span class="sidebar-card__badge">{{ profile.hiring.status }}</span>
              </div>
              <div class="sidebar-card__content">
                <div class="hiring-info">
                  <div class="hiring-info__title">{{ profile.hiring.title }}</div>
                  <p v-if="profile.hiring.description" class="hiring-info__description">{{ profile.hiring.description }}</p>
                  <div class="hiring-info__details">
                    <div class="hiring-info__item">
                      <span class="hiring-info__label">Status</span>
                      <span class="hiring-info__value">{{ profile.hiring.status }}</span>
                    </div>
                    <div class="hiring-info__item">
                      <span class="hiring-info__label">Slots</span>
                      <span class="hiring-info__value">{{ profile.hiring.clipper_slots_filled }} / {{ profile.hiring.clipper_slots ?? 'N/A' }}</span>
                    </div>
                    <div class="hiring-info__item">
                      <span class="hiring-info__label">Experience</span>
                      <span class="hiring-info__value">{{ profile.hiring.experience_level || 'Any' }}</span>
                    </div>
                    <div class="hiring-info__item">
                      <span class="hiring-info__label">Payment</span>
                      <span class="hiring-info__value">{{ profile.hiring.payment_type || 'Not specified' }}</span>
                    </div>
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
  };
  return icons[platform] || '/capsule.svg';
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
/* ===== Profile Header Actions ===== */
.profile-header-actions {
  display: flex;
  align-items: center;
  gap: 0.5rem;
}

.profile-action-btn {
  display: flex;
  align-items: center;
  gap: 0.5rem;
  height: 32px;
  padding: 0 0.875rem;
  border-radius: 6px;
  font-size: 0.75rem;
  font-weight: 600;
  cursor: pointer;
  transition: all 150ms ease;
}

.profile-action-btn--primary {
  background-color: var(--sidebar-accent);
  color: var(--sidebar-bg);
  border: none;
}

.profile-action-btn--primary:hover:not(:disabled) {
  opacity: 0.9;
}

.profile-action-btn--outline {
  background: transparent;
  border: 1px solid var(--sidebar-border);
  color: var(--sidebar-text);
}

.profile-action-btn--outline:hover:not(:disabled) {
  border-color: var(--sidebar-accent);
  color: var(--sidebar-accent);
}

.profile-action-btn:disabled {
  opacity: 0.5;
  cursor: not-allowed;
}

.profile-action-btn__icon {
  width: 14px;
  height: 14px;
}

/* ===== Profile Content ===== */
.profile-content {
  display: flex;
  flex-direction: column;
  gap: 0;
  max-width: 1400px;
  margin: 0 auto;
  width: 100%;
  min-width: 0;
  box-sizing: border-box;
  padding: 1.5rem;
}

.profile-content--loading,
.profile-content--empty {
  justify-content: center;
  align-items: center;
  min-height: 400px;
}

/* ===== Loading State ===== */
.loading-spinner {
  display: flex;
  align-items: center;
  justify-content: center;
}

.loading-spinner__icon {
  width: 40px;
  height: 40px;
  color: var(--sidebar-text-muted);
  animation: spin 1s linear infinite;
}

@keyframes spin {
  to {
    transform: rotate(360deg);
  }
}

/* ===== Empty State ===== */
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
  width: 72px;
  height: 72px;
  background-color: var(--sidebar-hover);
  border-radius: 16px;
  margin-bottom: 1.5rem;
}

.empty-state__icon {
  width: 36px;
  height: 36px;
  color: var(--sidebar-text-muted);
}

.empty-state__title {
  font-size: 1.125rem;
  font-weight: 600;
  color: var(--sidebar-text);
  margin: 0 0 0.5rem;
}

.empty-state__description {
  font-size: 0.875rem;
  color: var(--sidebar-text-muted);
  margin: 0;
  max-width: 320px;
  line-height: 1.5;
}
/* ===== Enhanced Profile Header Card ===== */
.profile-header-card {
  position: relative;
  background: var(--sidebar-surface);
  border: 1px solid var(--sidebar-border);
  border-radius: 16px;
  overflow: hidden;
  margin-bottom: 1.5rem;
}

.profile-header-bg {
  position: absolute;
  top: 0;
  left: 0;
  right: 0;
  height: 120px;
  background: linear-gradient(135deg, rgba(59, 130, 246, 0.15) 0%, rgba(37, 99, 235, 0.15) 100%);
  opacity: 0.5;
}

.profile-header-content {
  position: relative;
  padding: 2rem;
}

.profile-header-main {
  display: flex;
  align-items: flex-start;
  gap: 1.5rem;
  margin-bottom: 2rem;
}

@media (max-width: 640px) {
  .profile-header-main {
    flex-direction: column;
    align-items: center;
    text-align: center;
  }
}

.profile-avatar-wrapper {
  position: relative;
  flex-shrink: 0;
}

.profile-avatar {
  position: relative;
  width: 96px;
  height: 96px;
  border-radius: 20px;
  background: var(--sidebar-hover);
  overflow: hidden;
  border: 3px solid var(--sidebar-surface);
  box-shadow: 0 4px 12px rgba(0, 0, 0, 0.15);
}

.profile-avatar__img {
  width: 100%;
  height: 100%;
  object-fit: cover;
}

.profile-avatar__fallback {
  width: 100%;
  height: 100%;
  padding: 20px;
  color: var(--sidebar-text-muted);
}

.profile-info {
  flex: 1;
  min-width: 0;
}

.profile-name-row {
  display: flex;
  align-items: center;
  gap: 0.75rem;
  flex-wrap: wrap;
  margin-bottom: 0.75rem;
}

@media (max-width: 640px) {
  .profile-name-row {
    justify-content: center;
  }
}

.profile-name {
  font-size: 1.75rem;
  font-weight: 700;
  color: var(--sidebar-text);
  margin: 0;
  letter-spacing: -0.03em;
  line-height: 1.2;
}

.profile-bio {
  font-size: 0.9375rem;
  color: var(--sidebar-text-muted);
  margin: 0 0 0.875rem;
  line-height: 1.6;
  max-width: 600px;
}

@media (max-width: 640px) {
  .profile-bio {
    max-width: 100%;
  }
}

.profile-tags {
  display: flex;
  flex-wrap: wrap;
  gap: 0.5rem;
}

.profile-tag {
  padding: 0.375rem 0.625rem;
  background: rgba(59, 130, 246, 0.12);
  border-radius: 6px;
  font-size: 0.6875rem;
  font-weight: 600;
  color: #3b82f6;
  transition: all 150ms ease;
}

.profile-tag:hover {
  background: rgba(59, 130, 246, 0.18);
}
/* Profile Stats Grid */
.profile-stats-grid {
  display: grid;
  grid-template-columns: repeat(auto-fit, minmax(118px, 1fr));
  gap: 0.5rem;
}

@media (min-width: 900px) {
  .profile-stats-grid {
    grid-template-columns: repeat(5, minmax(0, 1fr));
  }
}

@media (max-width: 640px) {
  .profile-stats-grid {
    grid-template-columns: repeat(2, minmax(0, 1fr));
  }
}

.profile-stat-card {
  display: flex;
  align-items: center;
  gap: 0.5rem;
  padding: 0.625rem 0.75rem;
  background: var(--sidebar-hover);
  border: 1px solid var(--sidebar-border);
  border-radius: 10px;
  transition: all 200ms ease;
  min-width: 0;
}

.profile-stat-card:hover {
  border-color: rgba(255, 255, 255, 0.12);
  transform: translateY(-1px);
  box-shadow: 0 4px 16px rgba(0, 0, 0, 0.15);
}

.profile-stat-card__icon {
  display: flex;
  align-items: center;
  justify-content: center;
  width: 34px;
  height: 34px;
  border-radius: 8px;
  flex-shrink: 0;
}

.profile-stat-card__icon--sky {
  background: linear-gradient(135deg, rgba(14, 165, 233, 0.22) 0%, rgba(2, 132, 199, 0.2) 100%);
  color: #38bdf8;
}

.profile-stat-card__icon--green {
  background: linear-gradient(135deg, rgba(16, 185, 129, 0.22) 0%, rgba(5, 150, 105, 0.2) 100%);
  color: #34d399;
}

.profile-stat-card__icon--violet {
  background: linear-gradient(135deg, rgba(139, 92, 246, 0.22) 0%, rgba(109, 40, 217, 0.2) 100%);
  color: #a78bfa;
}

.profile-stat-card__icon--amber {
  background: linear-gradient(135deg, rgba(245, 158, 11, 0.22) 0%, rgba(217, 119, 6, 0.2) 100%);
  color: #fbbf24;
}

.profile-stat-card__icon--fuchsia {
  background: linear-gradient(135deg, rgba(217, 70, 239, 0.2) 0%, rgba(192, 38, 211, 0.2) 100%);
  color: #e879f9;
}

.profile-stat-card__content {
  display: flex;
  flex-direction: column;
  gap: 0.125rem;
  min-width: 0;
}

.profile-stat-card__value {
  font-size: 1.125rem;
  font-weight: 700;
  color: var(--sidebar-text);
  letter-spacing: -0.02em;
  line-height: 1.1;
  font-variant-numeric: tabular-nums;
  white-space: nowrap;
  overflow: hidden;
  text-overflow: ellipsis;
}

.profile-stat-card__label {
  font-size: 0.5625rem;
  color: var(--sidebar-text-muted);
  font-weight: 600;
  text-transform: uppercase;
  letter-spacing: 0.04em;
  line-height: 1.2;
  white-space: nowrap;
}
/* ===== Main Layout ===== */
/* Full width of .profile-content (same horizontal bounds as .profile-header-card); no nested max-width or side padding */
.main-layout {
  display: grid;
  grid-template-columns: minmax(0, 1fr) 360px;
  gap: 2rem;
  align-items: start;
  width: 100%;
  min-width: 0;
  box-sizing: border-box;
  padding: 0;
  margin: 0;
}

@media (max-width: 1024px) {
  .main-layout {
    grid-template-columns: 1fr;
  }
}

/* ===== Main Column ===== */
.main-column {
  display: flex;
  flex-direction: column;
  gap: 1.5rem;
  min-width: 0;
}

/* ===== Section ===== */
.section {
  background-color: var(--sidebar-surface);
  border: 1px solid var(--sidebar-border);
  border-radius: 12px;
  padding: 0;
  overflow: hidden;
}

.section__header {
  display: flex;
  align-items: center;
  gap: 1rem;
  padding: 1.5rem;
  border-bottom: 1px solid var(--sidebar-border);
  background: linear-gradient(to bottom, rgba(6, 182, 212, 0.03), transparent);
}

.section__header-icon {
  display: flex;
  align-items: center;
  justify-content: center;
  width: 48px;
  height: 48px;
  border-radius: 12px;
  background-color: rgba(6, 182, 212, 0.15);
  color: var(--sidebar-accent);
  flex-shrink: 0;
}

.section__header-icon svg {
  width: 22px;
  height: 22px;
}

.section__header-icon--cyan {
  background-color: rgba(6, 182, 212, 0.15);
  color: #06b6d4;
}

.section__header-icon--purple {
  background-color: rgba(139, 92, 246, 0.15);
  color: #a78bfa;
}

.section__header-text {
  flex: 1;
  min-width: 0;
}

.section__title {
  font-size: 1.125rem;
  font-weight: 600;
  color: var(--sidebar-text);
  margin: 0;
  letter-spacing: -0.02em;
}

.section__subtitle {
  font-size: 0.8125rem;
  color: var(--sidebar-text-muted);
  margin: 0.25rem 0 0;
}

.section__content {
  padding: 1.5rem;
}

.bio-text {
  font-size: 0.9375rem;
  color: var(--sidebar-text-muted);
  line-height: 1.7;
  margin: 0;
  white-space: pre-wrap;
}
/* Sidebar Card Badge */
.sidebar-card__badge {
  margin-left: auto;
  padding: 0.25rem 0.5rem;
  background: rgba(16, 185, 129, 0.15);
  color: #10b981;
  font-size: 0.6875rem;
  font-weight: 600;
  border-radius: 4px;
  text-transform: capitalize;
}

/* Hiring Info (Sidebar) */
.hiring-info {
  display: flex;
  flex-direction: column;
  gap: 0.75rem;
}

.hiring-info__title {
  font-weight: 600;
  color: var(--sidebar-text);
  font-size: 0.9375rem;
}

.hiring-info__description {
  color: var(--sidebar-text-muted);
  font-size: 0.8125rem;
  margin: 0;
  line-height: 1.5;
}

.hiring-info__details {
  display: flex;
  flex-direction: column;
  gap: 0.5rem;
}

.hiring-info__item {
  display: flex;
  justify-content: space-between;
  align-items: center;
  padding: 0.625rem;
  background: var(--sidebar-hover);
  border: 1px solid var(--sidebar-border);
  border-radius: 8px;
}

.hiring-info__label {
  font-size: 0.6875rem;
  text-transform: uppercase;
  color: var(--sidebar-text-muted);
  letter-spacing: 0.03em;
}

.hiring-info__value {
  color: var(--sidebar-text);
  font-size: 0.8125rem;
  font-weight: 500;
}
/* ===== Sidebar Column ===== */
.sidebar-column {
  display: flex;
  flex-direction: column;
  gap: 1.25rem;
  position: sticky;
  top: 1.5rem;
  min-width: 0;
}

@media (max-width: 1024px) {
  .sidebar-column {
    position: static;
  }
}

/* Sidebar Card */
.sidebar-card {
  background-color: var(--sidebar-surface);
  border: 1px solid var(--sidebar-border);
  border-radius: 12px;
  overflow: hidden;
}

.sidebar-card__header {
  display: flex;
  align-items: center;
  gap: 0.75rem;
  padding: 1.25rem;
  border-bottom: 1px solid var(--sidebar-border);
  background: linear-gradient(to bottom, rgba(6, 182, 212, 0.03), transparent);
}

.sidebar-card__icon {
  width: 20px;
  height: 20px;
  color: var(--sidebar-accent);
}

.sidebar-card__title {
  font-size: 1rem;
  font-weight: 600;
  color: var(--sidebar-text);
  margin: 0;
  letter-spacing: -0.01em;
}

.sidebar-card__content {
  padding: 1.25rem;
}
/* Connected Accounts */
.connected-accounts-list {
  display: flex;
  flex-direction: column;
  gap: 0.5rem;
}

.connected-account {
  display: flex;
  align-items: center;
  gap: 0.625rem;
  padding: 0.625rem;
  background: var(--sidebar-hover);
  border: 1px solid var(--sidebar-border);
  border-radius: 8px;
  transition: all 150ms ease;
}

.connected-account:hover {
  background: var(--sidebar-active);
  border-color: var(--sidebar-accent);
}

.connected-account__avatar {
  width: 32px;
  height: 32px;
  border-radius: 50%;
  object-fit: cover;
  flex-shrink: 0;
}

.connected-account__avatar-fallback {
  width: 32px;
  height: 32px;
  border-radius: 50%;
  background: var(--sidebar-surface);
  display: flex;
  align-items: center;
  justify-content: center;
  flex-shrink: 0;
}

.connected-account__avatar-icon {
  width: 16px;
  height: 16px;
  color: var(--sidebar-text-muted);
}

.connected-account__info {
  min-width: 0;
}

.connected-account__username {
  font-size: 0.8125rem;
  font-weight: 500;
  color: var(--sidebar-text);
}

.connected-account__platform {
  font-size: 0.6875rem;
  color: var(--sidebar-text-muted);
}
/* Contact card (labeled rows) */
.sidebar-card__content--contact {
  display: flex;
  flex-direction: column;
  gap: 0.625rem;
}

.contact-field {
  display: flex;
  flex-direction: column;
  gap: 0.25rem;
  padding: 0.5rem 0.625rem;
  border: 1px solid var(--sidebar-border);
  border-radius: 8px;
  background: var(--sidebar-hover);
}

.contact-field__label {
  font-size: 0.625rem;
  font-weight: 600;
  text-transform: uppercase;
  letter-spacing: 0.06em;
  color: var(--sidebar-text-muted);
}

.contact-field__value {
  font-size: 0.8125rem;
  color: var(--sidebar-text);
  word-break: break-word;
  line-height: 1.35;
}

.contact-field__value--link {
  text-decoration: none;
  color: var(--sidebar-text);
  transition: color 150ms ease;
}

.contact-field__value--link:hover {
  color: var(--sidebar-accent);
}
/* ===== Creator Cards ===== */
.creators__list-inner {
  display: grid;
  grid-template-columns: repeat(auto-fill, minmax(280px, 1fr));
  gap: 1.25rem;
}
.creator-card {
  position: relative;
  display: flex;
  flex-direction: column;
  background: linear-gradient(to bottom, var(--sidebar-surface) 0%, rgba(0, 0, 0, 0.2) 100%);
  border: 1px solid var(--sidebar-border);
  border-radius: 16px;
  overflow: hidden;
  transition: all 200ms cubic-bezier(0.4, 0, 0.2, 1);
}

.creator-card--link {
  text-decoration: none;
  color: inherit;
  cursor: pointer;
}

.creator-card--link:focus-visible {
  outline: 2px solid var(--sidebar-accent);
  outline-offset: 2px;
}

.creator-card::before {
  content: '';
  position: absolute;
  top: 0;
  left: 0;
  right: 0;
  height: 80px;
  background: linear-gradient(135deg, rgba(6, 182, 212, 0.1) 0%, rgba(14, 165, 233, 0.05) 100%);
  opacity: 0.5;
  pointer-events: none;
}

.creator-card:hover {
  border-color: rgba(6, 182, 212, 0.4);
  transform: translateY(-4px);
  box-shadow: 0 12px 24px rgba(0, 0, 0, 0.3), 0 0 0 1px rgba(6, 182, 212, 0.1);
}
.creator-card__header {
  position: relative;
  display: flex;
  flex-direction: column;
  align-items: center;
  text-align: center;
  gap: 0.875rem;
  padding: 1.5rem 1.25rem 1.25rem;
  border-bottom: 1px solid var(--sidebar-border);
}

.creator-card__avatar {
  width: 80px;
  height: 80px;
  border-radius: 50%;
  flex-shrink: 0;
  overflow: hidden;
  background-color: var(--sidebar-hover);
  border: 4px solid var(--sidebar-surface);
  box-shadow: 0 4px 12px rgba(0, 0, 0, 0.2), 0 0 0 2px rgba(6, 182, 212, 0.2);
  position: relative;
  z-index: 1;
}

.creator-card__avatar-img {
  width: 100%;
  height: 100%;
  object-fit: cover;
}

.creator-card__avatar-fallback {
  width: 100%;
  height: 100%;
  display: flex;
  align-items: center;
  justify-content: center;
  background: linear-gradient(135deg, rgba(6, 182, 212, 0.15) 0%, var(--sidebar-hover) 100%);
}

.creator-card__avatar-icon {
  width: 28px;
  height: 28px;
  color: var(--sidebar-text-muted);
  opacity: 0.6;
}
.creator-card__header-info {
  width: 100%;
  display: flex;
  flex-direction: column;
  align-items: center;
  gap: 0.5rem;
}

.creator-card__name-row {
  display: flex;
  flex-direction: column;
  align-items: center;
  gap: 0.5rem;
  width: 100%;
}

.creator-card__name {
  font-size: 1.125rem;
  font-weight: 700;
  color: var(--sidebar-text);
  line-height: 1.3;
  letter-spacing: -0.02em;
  max-width: 100%;
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
}

.creator-card__platform-icons {
  display: flex;
  align-items: center;
  justify-content: center;
  gap: 0.375rem;
  margin-top: 0.125rem;
}

.creator-card__platform-icon-wrapper {
  width: 28px;
  height: 28px;
  display: flex;
  align-items: center;
  justify-content: center;
  background-color: rgba(255, 255, 255, 0.08);
  border-radius: 6px;
  transition: all 150ms ease;
}

.creator-card__platform-icon-wrapper:hover {
  background-color: rgba(255, 255, 255, 0.12);
  transform: translateY(-1px);
}

.creator-card__platform-icon {
  width: 18px;
  height: 18px;
}

.creator-card__empty-icon {
  width: 16px;
  height: 16px;
  color: var(--sidebar-text-muted);
}

/* ===== Responsive ===== */
@media (max-width: 768px) {
  .main-layout {
    gap: 1.5rem;
  }

  .creators__list-inner {
    grid-template-columns: repeat(auto-fill, minmax(150px, 1fr));
    gap: 1rem;
  }

  .section__header {
    padding: 1rem;
  }

  .section__content {
    padding: 1rem;
  }
}
</style>
